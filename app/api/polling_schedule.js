/* jslint node: true */
'use strict';


var debug = require('debug')('scopehub.api.polling_schedule');
var Util = require('util');
var _ = require('lodash');
var Async = require('async');
var Request = require('request-promise');

var DataUtils = require('../lib/data_utils');
var Constants = require('../data/constants');
var PollingScheduleModel = require('../model/polling_schedule');
var ErrorConfig = require('../data/error');
var AuditUtils = require('../lib/audit_utils');
var MarketplaceApi = require('../api/marketplace');
var SchedulingEntities = require('../data/scheduling_entities');
var SQSUtils = require('../lib/sqs_utils');
var AWSConfig = require('../config/aws');
var Endpoints = require('../config/endpoints');

var noop = function () {
}; // do nothing.

function removeDuplicateMessages(messages) {
    var messageMap = {};
    var uniqueMessages = [];
    messages.forEach(function (message) {
        messageMap[message.MessageId] = message;
    });
    Object.keys(messageMap).forEach(function (key) {
        uniqueMessages.push(messageMap[key]);
    });
    return uniqueMessages;
}

function handleSchedulingEntity(entity, options, cb) {
    Util.log('Inside handleSchedulingEntity');

    var url = entity.url;
    var opt = {
        url: url,
        method: entity.method,
        json: true,
        form: options
    };
    Request(opt, function (err, response, body) {
        if (err || response.statusCode >= 400) {
            err = err || new Error(ErrorConfig.MESSAGE.HTTP_REQUEST_FAILED);
            err.status = err.status || ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
            return cb(err);
        }
        return cb(null, body);
    });
}

function handleSchedulingEntities(options, cb) {
    Util.log('Inside handleSchedulingEntities');

    var entities = options.entities || [];
    var opt = {
        accountId: options.user.accountId
    };
    opt.options = options;
    Async.eachLimit(entities, 3, function (entity, callback) {
        var schedulingEntity = SchedulingEntities[entity];
        handleSchedulingEntity(schedulingEntity, opt, callback);
    }, function (err) {
        return cb(err);
    });
}

var PollingSchedule = {
    create: function (options, auditOptions, cb) {
        var accountId = options.accountId;
        var marketplaceId = options.marketplaceId;
        var refreshInterval = options.refreshInterval;
        var entities = options.entities;

        var err;
        if (DataUtils.isUndefined(accountId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
        } else if (DataUtils.isUndefined(marketplaceId)) {
            err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_ID_REQUIRED);
        } else if (!refreshInterval) {
            err = new Error(ErrorConfig.MESSAGE.POLLING_SCHEDULE_REFRESH_INTERVAL_REQUIRED);
        } else if (!entities || !Array.isArray(entities) || !entities.length) {
            err = new Error(ErrorConfig.MESSAGE.POLLING_SCHEDULE_ENTITIES_REQUIRED);
        }

        entities.some(function (entity) {
            if (!SchedulingEntities[entity]) {
                err = new Error(entity + ' is invalid');
                return true;
            }
        });

        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug(err);
            return cb(err);
        }

        MarketplaceApi.getMarketplace(options, function (err, marketplace) {
            if (err) {
                return cb(err);
            }

            var scheduleOptions = {
                accountId: accountId,
                marketplaceId: marketplaceId,
                refreshInterval: refreshInterval,
                entities: entities
            };
            SQSUtils.enqueue(scheduleOptions, function (err, sqsMessageId) {
                if (err) {
                    return cb(err);
                }
                scheduleOptions.sqsMessageId = sqsMessageId;
                scheduleOptions.isVisibilityTimeoutSet = false;
                scheduleOptions.active = true;

                var params = {overwrite: false};
                PollingScheduleModel.create(scheduleOptions, params, function (err, schedule) {
                    if (err || !schedule) {
                        err = err || new Error(ErrorConfig.MESSAGE.POLLING_SCHEDULE_CREATE_FAILED);
                        err.status = err.status || ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                        return cb(err);
                    }
                    auditOptions.metaData = {
                        schedule: schedule
                    };
                    AuditUtils.create(auditOptions);
                    return cb(err, schedule);
                });
            });
        });
    },

    getSchedule: function (options, cb) {
        var scheduleId = options.scheduleId;
        var err;
        if (DataUtils.isUndefined(scheduleId)) {
            err = new Error(ErrorConfig.MESSAGE.POLLING_SCHEDULE_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
        PollingScheduleModel.get(scheduleId, {
            ConsistentRead: true
        }, function (err, data) {
            var schedule = data && data.attrs;
            return cb(err, schedule);
        });
    },

    getScheduleByMessageId: function (options, cb) {
        var messageId = options.sqsMessageId;
        PollingScheduleModel.query(messageId)
          .usingIndex(Constants.POLLING_MESSAGE_ID_INDEX)
          .exec(function (err, data) {
              var schedules = data && data.Items && data.Items[0];
              return cb(err, schedules);
          });
    },

    getSchedules: function (options, cb) {
        var accountId = options.accountId;
        PollingScheduleModel.query(accountId)
          .usingIndex(Constants.POLLING_ACCOUNT_INDEX)
          .exec(function (err, data) {
              var schedules = data && data.Items;
              return cb(err, schedules);
          });
    },

    getAllSchedules: function (cb) {
        PollingScheduleModel.scan()
          .loadAll()
          .exec(function (err, data) {
              var schedules = data.Items;
              var schedulesList = [];

              schedules.forEach(function (schedule) {
                  schedulesList.push(schedule.attrs);
              });
              return cb(null, schedulesList);
          });
    },

    updateSchedule: function (options, auditOptions, cb) {
        PollingSchedule.getSchedule(options, function (err, schedule) {
            if (err || !schedule) {
                err = err || new Error(ErrorConfig.MESSAGE.POLLING_SCHEDULE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            var sqsOptions = {
                accountId: schedule.accountId,
                marketplaceId: schedule.marketplaceId,
                refreshInterval: schedule.refreshInterval,
                entities: schedule.entities
            };
            var scheduleId = options.scheduleId;
            var scheduleOptions = {
                id: scheduleId
            };
            var refreshInterval = options.refreshInterval;
            var entities = options.entities;

            if (!refreshInterval) {
                scheduleOptions.refreshInterval = refreshInterval;
                sqsOptions.refreshInterval = refreshInterval;
            }
            if (entities) {
                if (!Array.isArray(entities) || !entities.length) {
                    err = new Error(ErrorConfig.MESSAGE.POLLING_SCHEDULE_ENTITIES_REQUIRED);
                }
                entities.some(function (entity) {
                    if (!SchedulingEntities[entity]) {
                        err = new Error(entity + ' is invalid');
                        return true;
                    }
                });
                if (err) {
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return cb(err);
                }
                scheduleOptions.entities = entities;
                sqsOptions.entities = entities;
            }
            auditOptions.metaData = {
                old_schedule: schedule
            };
            SQSUtils.enqueue(sqsOptions, function (err, sqsMessageId) {
                scheduleOptions.isVisibilityTimeoutSet = false;
                scheduleOptions.sqsMessageId = sqsMessageId;

                PollingScheduleModel.update(scheduleOptions, {
                    ReturnValues: 'ALL_NEW'
                }, function (err, schedule) {
                    if (err || !schedule) {
                        err = err || new Error(ErrorConfig.MESSAGE.POLLING_SCHEDULE_UPDATE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                        Util.log(err);
                        return cb(err);
                    }
                    schedule = schedule.attrs;
                    auditOptions.metaData.new_schedule = schedule;
                    AuditUtils.create(auditOptions);
                    return cb(null, schedule);
                });
            });
        });
    },

    removeSchedule: function (options, auditOptions, cb) {
        PollingSchedule.getSchedule(options, function (err, schedule) {
            if (err || !schedule) {
                err = err || new Error(ErrorConfig.MESSAGE.POLLING_SCHEDULE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            var scheduleId = options.scheduleId;
            PollingScheduleModel.destroy(scheduleId, function (err) {
                AuditUtils.create(auditOptions);
                return cb(err);
            });
        });
    },

    handleDequeuedMessage: function (data, cb) {
        var messages = data.Messages || [];
        messages = removeDuplicateMessages(messages);
        //debug('messages', messages)
        Util.log('Processing messages: ' + messages.length);
        Async.eachSeries(messages, function (message, callback) {
            if (!message) {
                return callback();
            }
            var messageBody = JSON.parse(message.Body);


            var topicArn = messageBody.TopicArn;
            if (topicArn === AWSConfig.SQS_EMAIL_TOPIC_ARN) {
                handleEmailMessage();
            }

            if (messageBody.entities && messageBody.entities[0] && messageBody.entities[0] === 'LIST_PRODUCT') {
                Util.log('LIST_PRODUCT');
                handleListProductMessage();
            } else if (messageBody.entities && messageBody.entities[0] && messageBody.entities[0] === 'LIST_ORDER') {
                Util.log('LIST_ORDER');
                handleListOrderMessage();
            } else {
                handleScheduledMessage();
            }

            function handleListProductMessage() {
                var options = JSON.parse(message.Body);

                //debug('options', options)
                var opt = {
                    receiptHandle: message.ReceiptHandle,
                    refreshInterval: options.refreshInterval
                };
                SQSUtils.setVisibilityTimeout(opt, function (err) {
                    if (err) {
                        return callback(err);
                    }
                    handleSchedulingEntities(options, function (err, response) {
                        if (err) {
                            debug('err', err);
                            return callback(err);
                        }
                        //debug('response', response);
                        SQSUtils.deleteMessage(opt, callback);
                    });
                });
            }

            function handleListOrderMessage() {
                Util.log('Inside handleListOrderMessage');
                var options = JSON.parse(message.Body);
                var opt = {
                    receiptHandle: message.ReceiptHandle,
                    refreshInterval: options.refreshInterval
                };
                //SQSUtils.deleteMessage(opt, callback);
                handleSchedulingEntities(options, function (err, response) {
                    if (err) {
                        debug('err', err);
                        return callback(err);
                    }
                    SQSUtils.deleteMessage(opt, callback);
                });
                /*SQSUtils.setVisibilityTimeout(opt, function (err) {
                    if (err) {
                        Util.log('Inside error', err);
                        return callback(err);
                    }
                    handleSchedulingEntities(options, function (err, response) {
                        if (err) {
                            debug('err', err);
                            return callback(err);
                        }
                        Util.log('response', response);
                        SQSUtils.deleteMessage(opt, callback);
                    });
                });*/
            }


            function handleEmailMessage() {
                var opt = {
                    receiptHandle: message.ReceiptHandle
                };
                SQSUtils.deleteMessage(opt, function (err) {
                    if (err) {
                        return callback(err);
                    }
                    var message = JSON.parse(messageBody.Message);
                    var mail = message.mail;
                    var commonHeaders = mail.commonHeaders;
                    var action = message.receipt && message.receipt.action;

                    var subject = commonHeaders.subject;
                    var timestamp = new Date(mail.timestamp).getTime();
                    var source = mail.source;
                    var destination = mail.destination[0];
                    destination = destination && destination.split('@')[0];
                    destination = destination && destination.split('+')[1];


                    var data = {
                        userId: destination,
                        sender: source,
                        timestamp: timestamp,
                        subject: subject,
                        s3Object: action.objectKey
                    };
                    var opt = {
                        url: Endpoints.getSesEmailUrl(),
                        method: 'POST',
                        json: true,
                        form: data
                    };
                    Request(opt, function (err, response, body) {
                        if (err || response.statusCode >= 400) {
                            err = err || new Error(ErrorConfig.MESSAGE.HTTP_REQUEST_FAILED);
                            err.status = err.status || ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                            return cb(err);
                        }
                        return callback(null, body);
                    });
                });
            }

            function handleScheduledMessage() {
                var opt = {
                    sqsMessageId: message.MessageId
                };
                PollingSchedule.getScheduleByMessageId(opt, function (err, schedule) {
                      if (err) {
                          return callback(err);
                      }
                      // If messageId has updated or schedule has been removed - Delete the current Message from Queue
                      if (!schedule) {
                          opt = {
                              receiptHandle: message.ReceiptHandle
                          };
                          SQSUtils.deleteMessage(opt, callback);
                      } else {
                          var options = JSON.parse(message.Body);
                          var opt = {
                              receiptHandle: message.ReceiptHandle,
                              refreshInterval: options.refreshInterval
                          };
                          SQSUtils.setVisibilityTimeout(opt, function (err) {
                              if (err) {
                                  return callback(err);
                              }
                              handleSchedulingEntities(options, callback);
                          });
                      }
                  }
                );
            }
        }, function (err) {
            return cb(err);
        });
    }
};

module.exports = PollingSchedule;