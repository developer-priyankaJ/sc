'use strict';


var debug = require('debug')('scopehub.api.order_reference_information');
var Async = require('async');
var _ = require('lodash');
var MWSConfig = require('../config/mws');
var amazonMws = require('amazon-mws')(MWSConfig.ACCESS_KEY_ID, MWSConfig.SECRET_ACCESS_KEY);
var ScopehubCore = require('../lib/scope_core');
var csv = require('fast-csv');
var path = require('path');
var fs = require('fs');
var i18n = require('i18n');
var Request = require('request-promise');
var {execSync} = require('child_process');
var pako = require('pako');
var sjcl = require('sjcl');
var NodeRSA = require('node-rsa');
var crypto = require('crypto');

var NotificationReferenceData = require('../data/notification_reference');
var connection = require('../lib/connection_util');
var DataUtils = require('../lib/data_utils');
var FastCsvUtils = require('../lib/fast_csv_utils');
var ErrorConfig = require('../data/error');
var AwsConfig = require('../config/aws');
var Constants = require('../data/constants');
var AuditUtils = require('../lib/audit_utils');
var S3Utils = require('../lib/s3_utils');
var knex = require('../lib/knex_util');
var ErrorUtils = require('../lib/error_utils');
var Utils = require('../lib/utils');
var CommonApi = require('../api/common');
var NotificationApi = require('../api/notification');
var CustomerApi = require('../api/customer');
var PromiseBluebird = require('bluebird');
var Decimal = require('decimal.js');
var s3 = require('../model/s3');

var OrderDirName = '..' + path.sep + 'public' + path.sep + 'orders';
OrderDirName = path.resolve(__dirname, OrderDirName);
if (fs.existsSync(OrderDirName) === false) {
    fs.mkdir(OrderDirName);
}
var count = 0;

var OrderReferenceInformation = {

    getReplicationSettingMD: async function (options, auditOptions, errorOptions, cb) {
        var accountId = options.accountId;
        var replications = [];
        var defaultEndDate = Constants.REPLICATION_END_DATE;
        var currentDate = DataUtils.getEpochMSTimestamp();
        var moment = require('moment');
        var a = [1, 2, 3];
        var err;

        try {
            var conn = await connection.getConnection();
            /*var activeReplication = await conn.query('Select CAST(uuid_from_bin(id) as CHAR) as id , CAST(uuid_from_bin(accountId) as CHAR) as accountId , mpId,' +
              ' types, orderTimeInterval, startDate,endDate, nextReplicationTime, numberOfRecords , status, updatedAt' +
              ' from ReplicationSetting WHERE accountId=uuid_to_bin(?) AND ((((endDate = ? OR endDate >= ?) AND startDate <= ?)' +
              ' OR (startDate >= ? AND endDate = ?))) OR status = 3;', [accountId, defaultEndDate, currentDate, currentDate, currentDate, defaultEndDate]);*/

            var activeReplication = await conn.query('Select CAST(uuid_from_bin(id) as CHAR) as id , CAST(uuid_from_bin(accountId) as CHAR) as accountId , mpId,' +
              ' types, orderTimeInterval, startDate,endDate, nextReplicationTime, numberOfRecords , status, updatedAt' +
              ' from ReplicationSetting WHERE accountId=uuid_to_bin(?);', [accountId, defaultEndDate, currentDate, currentDate, currentDate, defaultEndDate]);

            if (!activeReplication || activeReplication.length <= 0) {
                err = new Error(ErrorConfig.MESSAGE.NO_ACTIVE_REPLICATION_RECORD_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug('err', err);
                return cb(err);
            }
            _.map(activeReplication, function (replication) {
                if (replication.orderTimeInterval === 15) {
                    replication.frequency = Constants.ORDER_FREQUENCY_TYPE.EVERY_15_MIN;
                } else if (replication.orderTimeInterval === 60) {
                    replication.frequency = Constants.ORDER_FREQUENCY_TYPE.HOURLY;
                } else if (replication.orderTimeInterval === 1440) {
                    replication.frequency = Constants.ORDER_FREQUENCY_TYPE.DAILY;
                } else if (replication.orderTimeInterval === 10080) {
                    replication.frequency = Constants.ORDER_FREQUENCY_TYPE.WEEKLY;
                } else if (replication.orderTimeInterval === 43800) {
                    replication.frequency = Constants.ORDER_FREQUENCY_TYPE.MONTHLY;
                }
            });
            return cb(null, activeReplication);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.GET_REPLICATION_SETTING_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    getReplicationSettingByIdMD: async function (options, cb) {
        var id = options.id;
        var err;
        try {
            var conn = await connection.getConnection();
            var replication = await conn.query('Select CAST(uuid_from_bin(id) as CHAR) as id, CAST(uuid_from_bin(accountId) as CHAR) as accountId , mpId,' +
              ' types, orderTimeInterval, startDate,endDate, nextReplicationTime, numberOfRecords , status, updatedAt' +
              ' from ReplicationSetting WHERE id=uuid_to_bin(?) ',
              [id]);
            replication = Utils.filteredResponsePool(replication);
            if (!replication) {
                err = new Error(ErrorConfig.MESSAGE.REPLICATION_RECORD_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug('err', err);
                return cb(err);
            }
            return cb(null, replication);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.GET_REPLICATION_SETTING_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    updateReplicationSettingMD: function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var accountId = user.accountId;
        var id = options.id;
        var frequency = options.frequency;
        var isDisable = options.isDisable;
        var startDate = parseInt(options.startDate);
        var createdAfter = startDate;
        var numberOfRecords = options.numberOfRecords;
        var updatedAt = options.updatedAt;
        var status = Constants.REPLICATION_STATUS.NEW;
        var err;
        var nextReplicationTime;
        var currentDate = new Date();
        var defaultEndDate = Constants.REPLICATION_END_DATE;

        auditOptions.accountId = accountId;

        if (DataUtils.isUndefined(id)) {
            err = new Error(ErrorConfig.MESSAGE.REPLICATION_SETTING_ID_REQUIRED);
        } else if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_MUST_BE_NUMBER);
        } else if (updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_IS_INVALID);
        }
        /*
        else if ((DataUtils.isDefined(frequency)) && (Object.values(Constants.ORDER_FREQUENCY_TYPE).indexOf(frequency) === -1)) {
            err = new Error(ErrorConfig.MESSAGE.INVALID_FREQUENCY);
        }
        else if ((DataUtils.isDefined(startDate)) && (startDate < new Date().getTime())) {
            err = new Error(ErrorConfig.MESSAGE.START_DATE_CAN_NOT_BE_PAST_DATE);
        }*/
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        var disableOption = {
            endDate: DataUtils.getEpochMSTimestamp(),
            updatedAt: updatedAt,
            id: id,
            userId: user.id
        };

        if (isDisable) {
            OrderReferenceInformation.getReplicationSettingByIdMD({id: id}, async function (err, replication) {
                if (err || !replication) {
                    debug('err', err);
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
                var option = {
                    accountId: accountId,
                    mpId: replication.mpId
                };
                OrderReferenceInformation.getActiveAndPendingReplicationSettingMD(option, async function (err, activeReplication) {
                    if (err || !activeReplication) {
                        debug('err', err);
                        await ErrorUtils.create(errorOptions, options, err);
                        return cb(err);
                    }
                    if (activeReplication.length === 1) {
                        debug('111', disableOption);
                        OrderReferenceInformation.updateReplicationMD(disableOption, async function (err, updateResponse) {
                            if (err || !updateResponse) {
                                debug('err', err);
                                await ErrorUtils.create(errorOptions, options, err);
                                return cb(err);
                            }
                            debug('111', updateResponse);
                            AuditUtils.create(auditOptions);
                            return cb(null, updateResponse);
                        });
                    } else if (activeReplication.length === 2) {
                        try {
                            var activeRecord = _.filter(activeReplication, function (replication) {
                                return replication.startDate <= currentDate.getTime();
                            });
                            activeRecord = DataUtils.isArray(activeRecord) ? activeRecord[0] : activeRecord;

                            var pendingRecord = _.filter(activeReplication, function (replication) {
                                debug('condition', (replication.endDate === defaultEndDate) && replication.startDate >= currentDate.getTime());
                                return (replication.endDate === defaultEndDate) && replication.startDate >= currentDate.getTime();
                                //return (new Date(replication.endDate).getTime() === new Date(defaultEndDate).getTime()) && new Date(replication.startDate).getTime() >= currentDate.getTime();
                            });
                            pendingRecord = DataUtils.isArray(pendingRecord) ? pendingRecord[0] : pendingRecord;

                            if (id === activeRecord.id) {
                                OrderReferenceInformation.updateReplicationMD(disableOption, async function (err, updateResponse) {
                                    if (err || !updateResponse) {
                                        debug('err', err);
                                        await ErrorUtils.create(errorOptions, options, err);
                                        return cb(err);
                                    }
                                    AuditUtils.create(auditOptions);
                                    return cb(null, updateResponse);
                                });
                            } else {
                                var updatePendingOption = {
                                    endDate: DataUtils.getEpochMSTimestamp(),
                                    updatedAt: pendingRecord.updatedAt,
                                    id: pendingRecord.id,
                                    userId: user.id
                                };

                                OrderReferenceInformation.updateReplicationMD(updatePendingOption, async function (err, updatePendingResponse) {
                                    if (err || !updatePendingResponse) {
                                        debug('err', err);
                                        await ErrorUtils.create(errorOptions, options, err);
                                        return cb(err);
                                    }
                                    var updateActiveOption = {
                                        endDate: defaultEndDate,
                                        updatedAt: activeRecord.updatedAt,
                                        id: activeRecord.id,
                                        userId: user.id
                                    };
                                    OrderReferenceInformation.updateReplicationMD(updateActiveOption, async function (err, updateActiveResponse) {
                                        if (err || !updateActiveResponse) {
                                            debug('err', err);
                                            await ErrorUtils.create(errorOptions, options, err);
                                            return cb(err);
                                        }
                                        AuditUtils.create(auditOptions);
                                        return cb(null, updateActiveResponse);
                                    });
                                });
                            }
                        } catch (err) {
                            debug('err', err);
                            return cb(err);
                        }
                    } else {
                        err = new Error(ErrorConfig.MESSAGE.REPLICATION_RECORD_UPDATION_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        return cb(err);
                    }
                });
            });
        }
    },

    /*updateReplicationSettingMD: function (options, auditOptions, errorOptions, cb) {
      var user = options.user;
      var accountId = user.accountId;
      var id = options.id;
      var frequency = options.frequency;
      var isDisable = options.isDisable;
      var orderTimeInterval;
      var startDate = options.startDate;
      var createdAfter = startDate;
      var numberOfRecords = options.numberOfRecords;
      var updatedAt = options.updatedAt;
      var status = Constants.REPLICATION_STATUS.NEW;
      var err;
      var nextReplicationTime;

      auditOptions.accountId = accountId;

      if (DataUtils.isUndefined(id)) {
          err = new Error(ErrorConfig.MESSAGE.REPLICATION_SETTING_ID_REQUIRED);
      }
      else if (DataUtils.isUndefined(updatedAt)) {
          err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_REQUIRED);
      }
      else if (!DataUtils.isDate(updatedAt)) {
          err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_MUST_BE_VALID_DATE);
      }
      else if ((DataUtils.isDefined(frequency)) && (Object.values(Constants.ORDER_FREQUENCY_TYPE).indexOf(frequency) === -1)) {
          err = new Error(ErrorConfig.MESSAGE.INVALID_FREQUENCY);
      }
      else if ((DataUtils.isDefined(startDate)) && (new Date(startDate).getTime() < new Date().getTime())) {
          err = new Error(ErrorConfig.MESSAGE.START_DATE_CAN_NOT_BE_PAST_DATE);
      }
      if (err) {
          err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
          return cb(err);
      }

      var disableOption = {
          endDate: new Date(),
          updatedAt: new Date(updatedAt),
          id: id,
          userId: user.id
      };

      if (isDisable) {
          OrderReferenceInformation.updateReplicationMD(disableOption, async function (err, response) {
              if (err || !response) {
                  debug('err', err);
                  await ErrorUtils.create(errorOptions, options, err);
                  return cb(err);
              }
              AuditUtils.create(auditOptions);
              return cb(null, response);
          });
      } else {
          var option = {
              id: id,
          };
          OrderReferenceInformation.getNewReplicationMD(option, async function (err, replication) {
              if (err) {
                  debug('err', err);
                  await ErrorUtils.create(err, errorOptions, options);
                  return cb(err);
              }

              if (frequency) {
                  try {
                      var createReplicationOption = {
                          userId: user.id,
                          accountId: accountId,
                          types: 1,
                          status: status,
                      };

                      var oldStartDate = new Date(replication.startDate).getTime();
                      var currentDate = new Date().getTime();

                      if (oldStartDate < currentDate) {
                          err = new Error(ErrorConfig.MESSAGE.REPLICATION_IS_ALREADY_STARTED_CAN_NOT_UPDATE);
                          err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                          return cb(err);
                      }

                      if (frequency === Constants.ORDER_FREQUENCY_TYPE.EVERY_15_MIN) {
                          orderTimeInterval = 2;
                      } else if (frequency === Constants.ORDER_FREQUENCY_TYPE.HOURLY) {
                          orderTimeInterval = 60;
                      } else if (frequency === Constants.ORDER_FREQUENCY_TYPE.DAILY) {
                          orderTimeInterval = 1440;
                      } else if (frequency === Constants.ORDER_FREQUENCY_TYPE.WEEKLY) {
                          orderTimeInterval = 10080;
                      } else if (frequency === Constants.ORDER_FREQUENCY_TYPE.MONTHLY) {
                          orderTimeInterval = 43800;
                      }

                      CommonApi.startTransaction();
                      OrderReferenceInformation.updateReplicationMD(disableOption, async function (err, response) {
                          if (err) {
                              debug('err', err);
                              CommonApi.rollback();
                              await ErrorUtils.create(errorOptions, options, err);
                              return cb(err);
                          }

                          createReplicationOption.orderTimeInterval = orderTimeInterval;
                          createReplicationOption.mpId = replication.mpId;

                          // add 1 millisecond into start time
                          var oldStartDate = new Date(replication.startDate);
                          oldStartDate.setMilliseconds(oldStartDate.getMilliseconds() + 1);
                          createReplicationOption.startDate = startDate ? new Date(startDate) : new Date(oldStartDate);

                          // set nextReplicationTime
                          var oldTimeInterval = replication.orderTimeInterval;
                          if (startDate) {
                              nextReplicationTime = new Date(createReplicationOption.startDate);
                              nextReplicationTime.setMinutes(nextReplicationTime.getMinutes() + orderTimeInterval);
                          } else {
                              nextReplicationTime = new Date(replication.nextReplicationTime);
                              nextReplicationTime.setMinutes(nextReplicationTime.getMinutes() - (oldTimeInterval) + (orderTimeInterval));
                          }
                          createReplicationOption.nextReplicationTime = nextReplicationTime;
                          // Add numberOfRecords
                          createReplicationOption.numberOfRecords = numberOfRecords ? numberOfRecords : replication.numberOfRecords;

                          OrderReferenceInformation.insertReplicationMD(createReplicationOption, async function (err, response) {
                              debug('err111', err);
                              if (err) {
                                  debug('err', err);
                                  await ErrorUtils.create(errorOptions, options, err);
                                  CommonApi.rollback();
                                  return cb(err);
                              }
                              AuditUtils.create(auditOptions);
                              CommonApi.commit();
                              return cb(null, response);
                          });
                      });
                  } catch (err) {
                      debug('err', err);
                      CommonApi.rollback();
                      err = new Error(ErrorConfig.MESSAGE.REPLICATION_RECORD_UPDATION_FAILED);
                      err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                      return cb(err);
                  }
              } else {
                  if (startDate) {
                      var oldTimeInterval = replication.orderTimeInterval;
                      nextReplicationTime = new Date(startDate);
                      nextReplicationTime.setMinutes(nextReplicationTime.getMinutes() + oldTimeInterval);
                  }

                  var updateReplicationOption = {
                      userId: user.id,
                      accountId: accountId,
                      orderTimeInterval: orderTimeInterval,
                      startDate: startDate,
                      numberOfRecords: numberOfRecords,
                      nextReplicationTime: nextReplicationTime,
                      id: id,
                      updatedAt: updatedAt
                  };
                  OrderReferenceInformation.updateReplicationMD(updateReplicationOption, async function (err, response) {
                      debug('err111', err);
                      if (err) {
                          debug('err', err);
                          await ErrorUtils.create(errorOptions, options, err);
                          return cb(err);
                      }
                      AuditUtils.create(auditOptions);
                      return cb(null, response);
                  });
              }
          });
      }
  },*/

    getActiveReplicationSetting: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var accountId = options.accountId;
            var defaultEndDate = Constants.REPLICATION_END_DATE;
            var currentDate = new Date();
            var err;
            try {
                var conn = await connection.getConnection();
                var activeReplication = await conn.query('Select uuid_from_bin(id) as id, uuid_from_bin(accountId) as accountId, mpId,' +
                  ' types, orderTimeInterval, startDate, nextReplicationTime, numberOfRecords , status, updatedAt' +
                  ' from ReplicationSetting WHERE accountId=uuid_to_bin(?) AND (((endDate = ? OR endDate >= ?) AND startDate <= ?))'
                  , [accountId, defaultEndDate, currentDate, currentDate]);
                activeReplication = Utils.filteredResponsePool(activeReplication);
                if (!activeReplication) {
                    err = new Error(ErrorConfig.MESSAGE.NO_ACTIVE_REPLICATION_RECORD_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    debug('err', err);
                    return reject(err);
                }
                return resolve(activeReplication);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.GET_REPLICATION_SETTING_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    getActiveAndPendingReplicationSettingMD: async function (options, cb) {
        var accountId = options.accountId;
        var mpId = options.mpId;
        var replications = [];
        var defaultEndDate = Constants.REPLICATION_END_DATE;
        var currentDate = DataUtils.getEpochMSTimestamp();
        var err;
        try {
            var conn = await connection.getConnection();

            var activeReplication = await conn.query('Select CAST(uuid_from_bin(id) as CHAR) as id ,CAST(uuid_from_bin(accountId) as CHAR) as accountId , mpId,' +
              ' types, orderTimeInterval, startDate,endDate, nextReplicationTime, numberOfRecords , status, updatedAt ' +
              ' from ReplicationSetting WHERE accountId=uuid_to_bin(?) AND mpId=? AND (((endDate = ? OR endDate >= ?) AND startDate <= ?)' +
              ' OR (startDate >= ? AND endDate = ?))', [accountId, mpId, defaultEndDate, currentDate, currentDate, currentDate, defaultEndDate]);

            if (!activeReplication) {
                replications = [];
            } else {
                replications = activeReplication;
            }
            return cb(null, replications);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.GET_REPLICATION_SETTING_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    createReplicationSettingMD: function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var accountId = user.accountId;
        var platform = Constants.PLATFORMS.mws;
        var mpId = options.mpId;
        var frequency = options.frequency;
        var orderTimeInterval;
        var startDate = parseInt(options.startDate);
        //var createdAfter = startDate;
        var numberOfRecords = options.numberOfRecords;
        var status = Constants.REPLICATION_STATUS.NEW;
        var err;
        var nextReplicationTime = new Date(startDate);
        var activeRecord, pendingRecord, currentDate = new Date();
        var defaultEndDate = Constants.REPLICATION_END_DATE;

        auditOptions.accountId = accountId;

        if (DataUtils.isUndefined(mpId)) {
            err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_ID_REQUIRED);
        } else if (DataUtils.isUndefined(frequency)) {
            err = new Error(ErrorConfig.MESSAGE.FREQUENCY_REQUIRED);
        } else if (DataUtils.isUndefined(numberOfRecords.toString())) {
            err = new Error(ErrorConfig.MESSAGE.NUMBER_OF_RECORD_REQUIRED);
        } else if (numberOfRecords > 50) {
            err = new Error(ErrorConfig.MESSAGE.NUMBER_OF_RECORD_MUST_BE_LESS_THEN_50);
        } else if (Object.values(Constants.ORDER_FREQUENCY_TYPE).indexOf(frequency) === -1) {
            err = new Error(ErrorConfig.MESSAGE.INVALID_FREQUENCY);
        } else if (DataUtils.isUndefined(startDate)) {
            err = new Error(ErrorConfig.MESSAGE.START_DATE_REQUIRED);
        } else if (startDate < new Date().getTime()) {
            err = new Error(ErrorConfig.MESSAGE.START_DATE_CAN_NOT_BE_PAST_DATE);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        if (frequency === Constants.ORDER_FREQUENCY_TYPE.EVERY_15_MIN) {
            orderTimeInterval = 15;
        } else if (frequency === Constants.ORDER_FREQUENCY_TYPE.HOURLY) {
            orderTimeInterval = 60;
        } else if (frequency === Constants.ORDER_FREQUENCY_TYPE.DAILY) {
            orderTimeInterval = 1440;
        } else if (frequency === Constants.ORDER_FREQUENCY_TYPE.WEEKLY) {
            orderTimeInterval = 10080;
        } else if (frequency === Constants.ORDER_FREQUENCY_TYPE.MONTHLY) {
            orderTimeInterval = 43800;
        }

        startDate = new Date(startDate);
        nextReplicationTime.setMinutes(startDate.getMinutes() + orderTimeInterval);
        var replicationOption = {
            userId: user.id,
            accountId: accountId,
            types: 1,
            mpId: mpId,
            orderTimeInterval: orderTimeInterval,
            startDate: new Date(startDate).getTime(),
            numberOfRecords: numberOfRecords,
            nextReplicationTime: new Date(nextReplicationTime).getTime(),
            status: status
        };

        var option = {
            accountId: accountId,
            mpId: mpId
        };

        try {
            CommonApi.startTransaction();
            OrderReferenceInformation.getActiveAndPendingReplicationSettingMD(option, async function (err, activeReplication) {
                if (err || !activeReplication) {
                    debug('err', err);
                    CommonApi.rollback();
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
                if (activeReplication.length >= 2) {
                    err = new Error(ErrorConfig.MESSAGE.ALREADY_ONE_FUTURE_REPLICATION_IS_EXIST);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    CommonApi.rollback();
                    return cb(err);
                }

                if (activeReplication.length === 1) {
                    pendingRecord = _.filter(activeReplication, function (replication) {
                        return (replication.endDate === defaultEndDate) && replication.startDate >= currentDate.getTime();
                    });
                    if (pendingRecord.length >= 1) {
                        err = new Error(ErrorConfig.MESSAGE.ALREADY_ONE_FUTURE_REPLICATION_IS_EXIST);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        CommonApi.rollback();
                        return cb(err);
                    }
                }

                OrderReferenceInformation.createReplicationMD(replicationOption, async function (err, createResponse) {
                    debug('err1223', err);
                    if (err) {
                        debug('err', err);
                        CommonApi.rollback();
                        await ErrorUtils.create(errorOptions, options, err);
                        return cb(err);
                    }
                    if (activeReplication.length >= 1) {
                        activeRecord = _.filter(activeReplication, function (replication) {
                            return replication.startDate <= currentDate.getTime();
                        });
                        activeRecord = DataUtils.isArray(activeRecord) ? activeRecord[0] : activeRecord;
                    }
                    if (activeRecord) {
                        var newEndDate = new Date(startDate);
                        newEndDate.setMilliseconds(startDate.getMilliseconds() + 1);
                        var updateOption = {
                            id: activeRecord.id,
                            endDate: newEndDate.getTime(),
                            updatedAt: activeRecord.updatedAt,
                            userId: user.id
                        };
                        OrderReferenceInformation.updateReplicationMD(updateOption, async function (err, response) {
                            if (err || !response) {
                                debug('err', err);
                                CommonApi.rollback();
                                await ErrorUtils.create(errorOptions, options, err);
                                return cb(err);
                            }
                            AuditUtils.create(auditOptions);
                            CommonApi.commit();
                            return cb(null, createResponse);
                        });
                    } else {
                        AuditUtils.create(auditOptions);
                        CommonApi.commit();
                        return cb(null, createResponse);
                    }
                });
            });
        } catch (err) {
            debug('err', err);
            CommonApi.rollback();
            return cb(err);
        }
    },

    validateOptionalFields: function (options, cb) {
        var err;
        var replicationFields = '';
        var replicationOptionalValues = [];

        try {
            if (!DataUtils.isValidateOptionalField(options.nextReplicationTime)) {
                replicationFields += 'nextReplicationTime=? ,';
                replicationOptionalValues.push(options.nextReplicationTime);
            }
            if (!DataUtils.isValidateOptionalField(options.mpId)) {
                if (!DataUtils.isString(options.mpId)) {
                    throw err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_MP_ID_MUST_BE_STRING);
                } else if (options.mpId.length > 15) {
                    throw err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_MP_ID_MUST_BE_LESS_THAN_15_CHARACTER);
                } else {
                    replicationFields += 'mpId=? ,';
                    replicationOptionalValues.push(options.mpId);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.startDate)) {
                if (!DataUtils.isDate(new Date(options.startDate))) {
                    throw err = new Error(ErrorConfig.MESSAGE.START_DATE_MUST_BE_VALID_DATE);
                } else {
                    replicationFields += 'startDate=? ,';
                    replicationOptionalValues.push(options.startDate);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.createdAfter)) {
                replicationFields += 'createdAfter=? ,';
                replicationOptionalValues.push(options.createdAfter);
            }
            if (!DataUtils.isValidateOptionalField(options.orderTimeInterval)) {
                replicationFields += 'orderTimeInterval=? ,';
                replicationOptionalValues.push(options.orderTimeInterval);
            }
            if (!DataUtils.isValidateOptionalField(options.status)) {
                replicationFields += 'status=? ,';
                replicationOptionalValues.push(options.status);
            }
            if (!DataUtils.isValidateOptionalField(options.types)) {
                replicationFields += 'types=? ,';
                replicationOptionalValues.push(options.types);
            }
            if (!DataUtils.isValidateOptionalField(options.numberOfRecords)) {
                if (options.numberOfRecords > 50) {
                    throw err = new Error(ErrorConfig.MESSAGE.NUMBER_OF_RECORD_MUST_BE_LESS_THEN_50);
                } else if (!DataUtils.isNumber(options.numberOfRecords)) {
                    throw err = new Error(ErrorConfig.MESSAGE.NUMBER_OF_RECORD_MUST_BE_NUMBER);
                } else {
                    replicationFields += 'numberOfRecords=? ,';
                    replicationOptionalValues.push(options.numberOfRecords);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.endDate)) {
                replicationFields += 'endDate=? ,';
                replicationOptionalValues.push(options.endDate);
            }
            var response = {
                replicationFields: replicationFields,
                replicationOptionalValues: replicationOptionalValues
            };
            return cb(null, response);
        } catch (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
    },

    insertReplicationMD: async function (options, cb) {
        debug('options', options);
        var replicationFields = '';
        var replicationOptionalValues = [];
        var replicationRequiredValues = [];
        var generatedId = Utils.generateId();

        replicationRequiredValues.push(generatedId.uuid, options.accountId);
        OrderReferenceInformation.validateOptionalFields(options, async function (err, response) {
            if (err) {
                debug('err', err);
                return cb(err);
            }

            replicationFields = response.replicationFields;
            replicationOptionalValues = response.replicationOptionalValues;

            replicationRequiredValues = _.concat(replicationRequiredValues, replicationOptionalValues);
            replicationRequiredValues.push(options.userId);

            try {
                var conn = await connection.getConnection();
                var replicationcreated = await conn.query('insert into ReplicationSetting set  id= uuid_to_bin(?), ' +
                  'accountId=uuid_to_bin(?),' + replicationFields + ' updatedAt=utc_timestamp(3),' +
                  'createdAt=utc_timestamp(3), createdBy=uuid_to_bin(?) ; ', replicationRequiredValues);

                replicationcreated = Utils.isAffectedPool(replicationcreated);

                if (!replicationcreated) {
                    err = new Error(ErrorConfig.MESSAGE.REPLICATION_SETTING_RECORD_CREATION_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return cb(err);
                }
                var response = {
                    OK: Constants.SUCCESS,
                    id: generatedId.uuid
                };
                return cb(null, response);
            } catch (err) {
                debug('err123', err);
                err = new Error(ErrorConfig.MESSAGE.REPLICATION_SETTING_RECORD_CREATION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
        });
    },

    createReplicationMD: async function (options, cb) {
        var replicationFields = '';
        var replicationOptionalValues = [];
        var replicationRequiredValues = [];
        var generatedId = Utils.generateId();
        var endDate = Constants.REPLICATION_END_DATE;
        var createdAt = DataUtils.getEpochMSTimestamp();
        var updatedAt = DataUtils.getEpochMSTimestamp();

        replicationRequiredValues.push(generatedId.uuid, options.accountId);
        OrderReferenceInformation.validateOptionalFields(options, async function (err, response) {
            if (err) {
                debug('err', err);
                return cb(err);
            }

            replicationFields = response.replicationFields;
            replicationOptionalValues = response.replicationOptionalValues;

            replicationRequiredValues = _.concat(replicationRequiredValues, replicationOptionalValues);
            replicationRequiredValues.push(createdAt, updatedAt, options.userId);

            try {
                var conn = await connection.getConnection();
                var replicationcreated = await conn.query('insert into ReplicationSetting set  id= uuid_to_bin(?), ' +
                  'accountId=uuid_to_bin(?),' + replicationFields + 'createdAt=?, updatedAt= ?, createdBy=uuid_to_bin(?) ;'
                  , replicationRequiredValues);

                replicationcreated = Utils.isAffectedPool(replicationcreated);

                if (!replicationcreated) {
                    err = new Error(ErrorConfig.MESSAGE.REPLICATION_SETTING_RECORD_ALREADY_EXIST_FOR_THIS_MARKETPLACE);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return cb(err);
                }
                var response = {
                    OK: Constants.SUCCESS,
                    id: generatedId.uuid,
                    createdAt: createdAt
                };
                return cb(null, response);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.REPLICATION_SETTING_RECORD_CREATION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
        });
    },

    updateReplicationMD: async function (options, cb) {
        var replicationFields = '';
        var replicationOptionalValues = [];
        var replicationRequiredValues = [];
        var updatedAt = options.updatedAt;
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();

        replicationRequiredValues.push(options.id, options.id, updatedAt);
        OrderReferenceInformation.validateOptionalFields(options, async function (err, response) {
            if (err) {
                debug('err', err);
                return cb(err);
            }

            replicationFields = response.replicationFields;
            replicationOptionalValues = response.replicationOptionalValues;

            replicationRequiredValues = _.concat(replicationRequiredValues, replicationOptionalValues);
            replicationRequiredValues.push(newUpdatedAt, options.userId, options.id);

            try {
                var conn = await connection.getConnection();
                var replicationUpdated = await conn.query('IF (select 1 from ReplicationSetting where id=uuid_to_bin(?)) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "REPLICATION_SETTING_NOT_FOUND", MYSQL_ERRNO = 4001;' +
                  'ELSEIF (select 1 from ReplicationSetting where id=uuid_to_bin(?) and updatedAt=?) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "REPLICATION_SETTING_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
                  'ELSE update ReplicationSetting set ' + replicationFields + ' updatedAt=?, ' +
                  'updatedBy=uuid_to_bin(?) where id=uuid_to_bin(?) ;END IF;', replicationRequiredValues);
                replicationUpdated = Utils.isAffectedPool(replicationUpdated);

                if (!replicationUpdated) {
                    err = new Error(ErrorConfig.MESSAGE.REPLICATION_SETTING_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return cb(err);
                }
                return cb(null, {
                    OK: Constants.SUCCESS,
                    updatedAt: newUpdatedAt
                });
            } catch (err) {
                debug('err', err);
                if (err.errno === 4001) {
                    err = new Error(ErrorConfig.MESSAGE.REPLICATION_SETTING_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return cb(err);
                } else if (err.errno === 4002) {
                    err = new Error(ErrorConfig.MESSAGE.REPLICATION_SETTING_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    return cb(err);
                } else {
                    err = new Error(ErrorConfig.MESSAGE.REPLICATION_RECORD_UPDATION_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return cb(err);
                }
            }
        });
    },

    createReplicationLogMD: async function (options, cb) {
        var replicationSettingId = options.replicationSettingId;
        var id = options.id;
        var startTime = options.startTime;
        var status = options.status;
        var createdAt = DataUtils.getEpochMSTimestamp();
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var err;

        try {
            var conn = await connection.getConnection();
            var replicationLog = await conn.query('insert into ReplicationLog set id = uuid_to_bin(?), replicationSettingId=uuid_to_bin(?),' +
              'startTime=?,status=?, createdAt=?, updatedAt=?;', [id, replicationSettingId, startTime, status, createdAt, updatedAt]);
            replicationLog = Utils.isAffectedPool(replicationLog);
            if (!replicationLog) {
                throw err;
            }
            return cb(null, {
                OK: Constants.SUCCESS,
                createdAt: createdAt
            });
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.REPLICATION_LOG_INSERT_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    getNewReplicationMD: async function (options, cb) {
        var id = options.id;

        try {
            var conn = await connection.getConnection();
            var replication = await conn.query('select uuid_from_bin(id) as id, uuid_from_bin(accountId) as accountId, mpId, ' +
              'types, orderTimeInterval, createdAfter, startDate, nextReplicationTime, status, numberOfRecords, updatedAt ' +
              'from ReplicationSetting where id=uuid_to_bin(?)',
              [id]);
            replication = Utils.filteredResponsePool(replication);
            return cb(null, replication);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.REPLICATION_RECORD_NOT_FOUND);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
    },

    disableReplicationMD: async function (options, auditOptions, errorOptions, cb) {
        var accountId = options.accountId;
        var marketplaceId = options.marketplaceId;
        var platform = Constants.PLATFORMS.mws;

        if (DataUtils.isUndefined(marketplaceId)) {
            var err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
        try {
            var conn = await connection.getConnection();
            var disableResponse = await conn.quey('IF (select 1 from ReplicationSetting where accountId=uuid_to_bin(?) and mpId=?) is not null THEN ' +
              'delete from ReplicationSetting where accountId=uuid_to_bin(?) and mpId=?; END IF');
            disableResponse = Utils.isAffectedPool(disableResponse);
            if (!disableResponse) {
                err = new Error(ErrorConfig.MESSAGE.REPLICATION_SETTING_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            err = new Error(ErrorConfig.MESSAGE.DISABLE_REPLICATION_SETTING_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    getAccountMarketPlaceMD: async function (options, cb) {
        var accountId = options.accountId;
        var mpId = options.mpId;
        var err;

        try {
            var conn = await connection.getConnection();
            var accountMarketplace = await conn.query('select sellerId,token from AccountMarketplaces ' +
              'where accountId=uuid_to_bin(?) and mpId = ?', [accountId, mpId]);
            accountMarketplace = Utils.filteredResponsePool(accountMarketplace);
            if (!accountMarketplace) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            return cb(null, accountMarketplace);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_NOT_FOUND);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    getAuditByAccountIdMD: async function (options, cb) {
        var accountId = options.accountId;
        var eventId = options.eventId;
        var err;

        try {
            var conn = await connection.getConnection();
            var auditLog = await conn.query('select CAST(uuid_from_bin(userId) as CHAR) as userId,createdAt from AuditLog ' +
              'where accountId=uuid_to_bin(?) and eventId = ?', [accountId, eventId]);

            if (!auditLog) {
                auditLog = [];
            }
            return cb(null, auditLog);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.ORDERS_AUDIT_LOG_NOT_FOUND);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    updateReplicationRecordMD: async function (options, cb) {
        var id = options.id;
        var accountId = options.accountId;
        var status = options.status;
        var userId = options.userId;
        var err;

        try {
            var conn = await connection.getConnection();
            var isUpdated = await conn.query('IF (select 1 from ReplicationLog where id=? and accountId=uuid_to_bin(?) is not null then ' +
              'update ReplicationLog set status=?, updatedBy=uuid_to_bin(?), updatedAt=utc_timestamp(3)' +
              ' where id=? and accountId=uuid_to_bin(?);END IF;', [id, accountId, status, userId, id, accountId]);
            isUpdated = Utils.isAffectedPool(isUpdated);
            if (isUpdated) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.REPLICATION_RECORD_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.REPLICATION_RECORD_UPDATION_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    // ORDER RELATED FUNCTIONS
    /*
  *  Get order by accountId, mpId and amazonOrderId
  * */
    getOrderMD: async function (options, cb) {
        var accountId = options.accountId;
        var mpId = options.mpId;
        var amazonOrderId = options.amazonOrderId;
        var err;

        try {
            var conn = await connection.getConnection();
            var order = await conn.query('select *,CAST(uuid_from_bin(id) as CHAR) as id, CAST(uuid_from_bin(accountId) as CHAR) as accountId,' +
              ' CAST(uuid_from_bin(createdBy) as CHAR) as createdBy, uuid_from_bin(updatedBy) as updatedBy ' +
              'from OrderReferenceInformation where accountId = uuid_to_bin(?) and  ' +
              'mpId = ? and amazonOrderId = ?', [accountId, mpId, amazonOrderId]);
            order = Utils.filteredResponsePool(order);
            if (!order) {
                throw err;
            }
            return cb(null, order);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.ORDERS_NOT_FOUND);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb();
        }
    },

    /*
  * Validate order amount
  * */
    validateAmountMD: function (amount) {
        return new Promise(function (resolve, reject) {
            var err;
            var tempAmount = Decimal(amount);
            var precision;

            if (tempAmount.toString().indexOf('.') !== -1) {
                precision = tempAmount.toString().split('.')[1];
                if (precision.length > Constants.ORDER_ITEM_PRECESION) {
                    tempAmount = tempAmount.toDecimalPlaces(Constants.ORDER_ITEM_PRECESION);
                    tempAmount = tempAmount.toString().replace('.', '');
                } else if (precision.length < Constants.ORDER_ITEM_PRECESION) {
                    var zeros = Constants.ORDER_ITEM_PRECESION - precision.length;
                    tempAmount = tempAmount.toString().replace('.', '');
                    tempAmount = Decimal(tempAmount).mul(Decimal(Constants.PRECISION[zeros]));
                } else if (precision.length === Constants.ORDER_ITEM_PRECESION) {
                    tempAmount = tempAmount.toString().replace('.', '');
                }
                amount = tempAmount;
            } else if (tempAmount.toString().indexOf('.') === -1) {
                tempAmount = Decimal(tempAmount).mul(Decimal(Constants.PRECISION[Constants.ORDER_ITEM_PRECESION]));
                amount = tempAmount;
            }
            return resolve(amount.toString());
        });
    },

    /*
  *  Create order object for insert
  * */
    createOrderObjectMD: function (order) {
        return new Promise(async function (resolve, reject) {
            var orderAmount = await OrderReferenceInformation.validateAmountMD(order.OrderTotal.Amount);
            var orderObject = {
                mpId: order.MarketplaceId || Constants.TYPE_DEFAULT_VALUE.STRING,
                latestShipDate: new Date(order.LatestShipDate).getTime() || Constants.TYPE_DEFAULT_VALUE.DATETIME,
                orderType: order.OrderType || Constants.TYPE_DEFAULT_VALUE.STRING,
                purchaseDate: new Date(order.PurchaseDate).getTime() || Constants.TYPE_DEFAULT_VALUE.DATETIME,
                amazonOrderId: order.AmazonOrderId || Constants.TYPE_DEFAULT_VALUE.STRING,
                buyerEmail: order.BuyerEmail || Constants.TYPE_DEFAULT_VALUE.STRING,
                isReplacementOrder: Utils.toBoolean(order.IsReplacementOrder) || Constants.TYPE_DEFAULT_VALUE.BOOLEAN,
                lastUpdateDate: new Date(order.LastUpdateDate).getTime() || Constants.TYPE_DEFAULT_VALUE.DATETIME,
                numberOfItemsShipped: order.NumberOfItemsShipped || Constants.TYPE_DEFAULT_VALUE.NUMBER,
                shipServiceLevel: order.ShipServiceLevel || Constants.TYPE_DEFAULT_VALUE.STRING,
                orderStatus: order.OrderStatus || Constants.TYPE_DEFAULT_VALUE.STRING,
                salesChannel: order.SalesChannel || Constants.TYPE_DEFAULT_VALUE.STRING,
                shippedByAmazonTFM: Utils.toBoolean(order.ShippedByAmazonTFM) || Constants.TYPE_DEFAULT_VALUE.BOOLEAN,
                isBusinessOrder: Utils.toBoolean(order.IsBusinessOrder) || Constants.TYPE_DEFAULT_VALUE.BOOLEAN,
                latestDeliveryDate: new Date(order.LatestDeliveryDate).getTime() || Constants.TYPE_DEFAULT_VALUE.DATETIME,
                numberOfItemsUnshipped: order.NumberOfItemsUnshipped || Constants.TYPE_DEFAULT_VALUE.NUMBER,
                paymentMethodDetails: order.PaymentMethodDetails.PaymentMethodDetail || Constants.TYPE_DEFAULT_VALUE.STRING,
                buyerName: order.BuyerName || Constants.TYPE_DEFAULT_VALUE.STRING,
                earliestDeliveryDate: new Date(order.EarliestDeliveryDate).getTime() || Constants.TYPE_DEFAULT_VALUE.DATETIME,
                orderTotalCurrencyCode: order.OrderTotal.CurrencyCode || Constants.TYPE_DEFAULT_VALUE.STRING,
                orderTotalAmount: orderAmount || Constants.TYPE_DEFAULT_VALUE.NUMBER,
                isPremiumOrder: Utils.toBoolean(order.IsPremiumOrder) || Constants.TYPE_DEFAULT_VALUE.BOOLEAN,
                earliestShipDate: new Date(order.EarliestShipDate).getTime() || Constants.TYPE_DEFAULT_VALUE.DATETIME,
                fulfillmentChannel: order.FulfillmentChannel || Constants.TYPE_DEFAULT_VALUE.STRING,
                paymentMethod: order.PaymentMethod || Constants.TYPE_DEFAULT_VALUE.STRING,
                addressLine1: order.ShippingAddress.AddressLine1 || Constants.TYPE_DEFAULT_VALUE.STRING,
                addressLine2: order.ShippingAddress.AddressLine2 || Constants.TYPE_DEFAULT_VALUE.STRING,
                city: order.ShippingAddress.City || Constants.TYPE_DEFAULT_VALUE.STRING,
                name: order.ShippingAddress.Name || Constants.TYPE_DEFAULT_VALUE.STRING,
                addressType: order.ShippingAddress.AddressType || Constants.TYPE_DEFAULT_VALUE.STRING,
                postalCode: order.ShippingAddress.PostalCode || Constants.TYPE_DEFAULT_VALUE.STRING,
                stateOrRegion: order.ShippingAddress.StateOrRegion || Constants.TYPE_DEFAULT_VALUE.STRING,
                countryCode: order.ShippingAddress.CountryCode || Constants.TYPE_DEFAULT_VALUE.STRING,
                isPrime: Utils.toBoolean(order.IsPrime) || Constants.TYPE_DEFAULT_VALUE.BOOLEAN,
                shipmentServiceLevelCategory: order.ShipmentServiceLevelCategory || Constants.TYPE_DEFAULT_VALUE.STRING,
                sellerOrderId: order.SellerOrderId || Constants.TYPE_DEFAULT_VALUE.STRING,
                recordType: Constants.RECORD_TYPE.REPLICATION || Constants.TYPE_DEFAULT_VALUE.NUMBER
                //updatedAt: Constants.TYPE_DEFAULT_VALUE.STRING
            };
            return resolve(orderObject);
        });
    },

    /*
  * Insert multiple orders
  * */
    createOrderMD: function (options) {
        return new Promise(async function (resolve, reject) {
            var createOrderList = options.createOrders;
            var replicationId = options.replicationId;
            var orderErrorLogOption, orderErrorLogResponse;

            var convertedOrderList, keys, err;
            await Utils.convertObjectToArrayMD(createOrderList, async function (err, response) {
                if (err) {
                    debug('err', err);
                    return reject(err);
                }
                convertedOrderList = response.list;
                keys = response.keys;

                var query = 'insert into OrderReferenceInformation (' + keys + ') values';

                var values = ' (uuid_to_bin(?), uuid_to_bin(?),uuid_to_bin(?),?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, ?,?,?) ';

                await PromiseBluebird.each(createOrderList, function (value) {
                    query = query + values;
                    query = query + ',';
                });

                query = query.replace(/,\s*$/, '');

                try {
                    var conn = await connection.getConnection();
                    var orderInserted = await conn.query(query, convertedOrderList);
                    orderInserted = Utils.isAffectedPool(orderInserted);
                    debug('orderInserted-----------------------------------------', orderInserted);
                    if (!orderInserted) {
                        throw err;
                    }
                    return resolve(Constants.OK_MESSAGE);
                } catch (err) {
                    debug('err ', err);
                    err = new Error(ErrorConfig.MESSAGE.ORDER_CREATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;

                    // Store error Log
                    orderErrorLogOption = {
                        replicationSettingId: replicationId,
                        orderId: '',
                        metaData: err,
                        failReasonCode: Constants.ORDER_ERROR_LOG_REASON_CODE.ORDER_REFERENCE_INFORMATION_STORE_FAILED.CODE,
                        errorMessage: Constants.ORDER_ERROR_LOG_REASON_CODE.ORDER_REFERENCE_INFORMATION_STORE_FAILED.MESSAGE,
                        createdAt: DataUtils.getEpochMSTimestamp()
                    };
                    orderErrorLogResponse = await OrderReferenceInformation.insertOrderErrorLogs({orderErrorLogs: [orderErrorLogOption]});
                    debug('orderErrorLogResponse', orderErrorLogResponse);

                    return reject(err);
                }
            });
        });
    },

    buildWhereForOrders: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var orders = options.orders;
            var string = '', values = [];
            var where = 'WHERE id IN (';
            var close = ') ';

            _.map(orders, function (order) {
                string += 'uuid_to_bin(?),';
                values.push(order);
            });
            string = string.replace(/,\s*$/, ' ');
            string += close;
            return resolve({
                string: string,
                values: values
            });
        });
    },

    /*
  * Build query for multiple update order
  * */
    buildUpdateQuery: async function (options, cb) {
        var orders = options.updateOrders;
        var string = 'update OrderReferenceInformation set ';
        var end = 'END, ';
        var whereResponse = await OrderReferenceInformation.buildWhereForOrders({orders: orders});
        var values = [];
        var close = ')';
        var finalResponse;

        try {
            _.each(orders[0], function (value, key) {
                if (key === 'id') {
                    return;
                }
                string += key + ' = CASE id ';

                /*if (key === 'updatedAt') {
                  orders.forEach(function (order) {
                      string += 'WHEN uuid_to_bin(?) THEN UTC_TIMESTAMP(3) ';
                      values.push(order['id']);
                  });
              }*/
                if (key === 'accountId' || key === 'updatedBy') {
                    orders.forEach(function (order) {
                        string += 'WHEN uuid_to_bin(?) THEN uuid_to_bin(?) ';
                        values.push(order['id'], order[key]);
                    });
                } else {
                    orders.forEach(function (order) {
                        string += 'WHEN uuid_to_bin(?) THEN ? ';
                        values.push(order['id'], order[key]);
                    });
                }
                string += end;
            });
            string = string.replace(/,\s*$/, ' ');
            string += whereResponse.string;
            values.push(whereResponse.values);

            /*orders.forEach(function (order) {
              string += 'uuid_to_bin(?), ';
              values.push(order['id']);
          });

          string = string.replace(/,\s*$/, '');
          string += close;*/
            finalResponse = {
                string: string,
                values: values
            };
            return cb(null, finalResponse);
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

    },

    /*
  * Update orders
  * */
    updateOrderMD: function (options) {
        return new Promise(function (resolve, reject) {
            var string = '', values = [];
            var replicationId = options.replicationId;
            var orderErrorLogOption, orderErrorLogResponse;
            OrderReferenceInformation.buildUpdateQuery(options, async function (err, response) {
                if (err) {
                    debug('err', err);
                    return reject(err);
                }
                string = response.string;
                values = response.values;
                try {
                    var conn = await connection.getConnection();
                    var isUpdated = await conn.query(string, values);
                    isUpdated = Utils.isAffected(isUpdated);
                    debug(' ORDERS UPDATED---------', isUpdated);
                    if (!isUpdated) {
                        throw err;
                    }
                    return resolve(Constants.OK_MESSAGE);
                } catch (err) {
                    debug('err ', err);
                    err = new Error(ErrorConfig.MESSAGE.ORDER_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;

                    // Store error Log
                    orderErrorLogOption = {
                        replicationSettingId: replicationId,
                        orderId: '',
                        metaData: err,
                        failReasonCode: Constants.ORDER_ERROR_LOG_REASON_CODE.ORDER_REFERENCE_INFORMATION_UPDATE_FAILED.CODE,
                        errorMessage: Constants.ORDER_ERROR_LOG_REASON_CODE.ORDER_REFERENCE_INFORMATION_UPDATE_FAILED.MESSAGE,
                        createdAt: DataUtils.getEpochMSTimestamp()
                    };
                    orderErrorLogResponse = await OrderReferenceInformation.insertOrderErrorLogs({orderErrorLogs: [orderErrorLogOption]});
                    debug('orderErrorLogResponse', orderErrorLogResponse);

                    return reject(err);
                }
            });
        });
    },

    manageOrderMD: async function (options, cb) {
        var createOrders = options.createOrders;
        var updateOrders = options.updateOrders;
        var replicationId = options.replicationId;
        var numberOfOrders = 0, response;
        var createResponse, updateResponse, err;
        var orderErrorLogOption, orderErrorLogResponse;

        //debug('createOrders', createOrders);
        //debug('updateOrders', updateOrders);
        if (createOrders.length > 0) {
            var createOption = {
                createOrders: createOrders,
                replicationId: replicationId
            };
            try {
                createResponse = await OrderReferenceInformation.createOrderMD(createOption);
                if (!createResponse) {
                    err = new Error(ErrorConfig.MESSAGE.ORDER_CREATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }
                numberOfOrders += createOrders.length;
            } catch (err) {
                debug('err', err);
                return cb(err);
            }
        }
        if (updateOrders.length > 0) {
            var updateOption = {
                updateOrders: updateOrders,
                replicationId: replicationId
            };
            try {
                updateResponse = await OrderReferenceInformation.updateOrderMD(updateOption);
                if (!updateResponse) {
                    err = new Error(ErrorConfig.MESSAGE.ORDER_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }
                numberOfOrders += updateOrders.length;
            } catch (err) {
                debug('err', err);
                return cb(err);
            }
        }

        response = {
            numberOfOrders: numberOfOrders,
            createOrders: createOrders,
            updateOrders: updateOrders
        };

        return cb(null, response);
    },

    getOrdersData: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var sellerId = options.sellerId;
            var authToken = options.authToken;
            var mpId = options.mpId;
            var lastUpdatedAfter = options.lastUpdatedAfter;
            var numberOfRecords = options.numberOfRecords;
            try {
                var orders = await amazonMws.orders.search({
                    'Version': '2013-09-01',
                    'Action': 'ListOrders',
                    'SellerId': sellerId,
                    'MWSAuthToken': authToken,
                    'MarketplaceId.Id.1': mpId,
                    'LastUpdatedAfter': new Date(lastUpdatedAfter),//new Date('Sat Oct 29 2015 10:59:35 GMT+0530 (IST)'),//
                    'MaxResultPerPage': numberOfRecords
                });
                /*if (DataUtils.isUndefined(orders.ResponseMetadata.RequestId)) {
                      var err = new Error(ErrorConfig.MESSAGE.RESPONSE_METEDATA_NOT_FOUND);
                      err.Code = 'OrderNotFound';
                      debug('err %o', err);
                      return reject(err);
                  }*/
                debug('orders', orders.length);
                return resolve(orders);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    removeAccountMarketPlaces: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var accountId = options.accountId;
            var mpId = options.mpId;
            var err;
            try {
                var conn = await connection.getConnection();
                var isDeleted = await conn.query('delete from AccountMarketplaces where accountId =uuid_to_bin(?) and mpId=?', [accountId, mpId]);
                isDeleted = Utils.isAffectedPool(isDeleted);
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_REMOVE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },


    updateReplicationAndRemoveAccountMarketplace: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var userId = options.userId;
            var accountId = options.accountId;
            var replicationId = options.replicationId;
            var mpId = options.mpId;

            try {
                debug('update replication', options);
                // Update replication record with endDate to current date
                var updateOptions = {
                    status: Constants.REPLICATION_STATUS.HOLD,
                    //endDate: new Date(),
                    accountId: accountId,
                    userId: userId,
                    id: replicationId
                };
                OrderReferenceInformation.updateReplicationSettingsMD(updateOptions, function (err, response) {
                    if (err || !response) {
                        debug('err', err);
                        return reject(err);
                    }
                });

                debug('Delete marketplace');
                // Delete accountMarketplace record
                var deleteOption = {
                    accountId: accountId,
                    mpId: mpId
                };
                var deleteResponse = await OrderReferenceInformation.removeAccountMarketPlaces(deleteOption);

                // Notify the user
                debug('userId', userId);
                var user = await OrderReferenceInformation.getUserById(userId);
                debug('user', user);


                var date = new Date();
                var notificationExpirationDate = date.setDate(date.getDate() + Constants.INVITATION_EXPIRATION_DATE_LIMIT);
                notificationExpirationDate = new Date(notificationExpirationDate);
                debug('sending notifications');

                var notificationOption = {
                    refereId: Constants.DEFAULT_REFERE_ID,
                    user_ids: [userId],
                    topic_id: userId,
                    refereType: Constants.NOTIFICATION_REFERE_TYPE.REPLICATION,
                    notification_reference: NotificationReferenceData.INVALID_SELLER_ID,
                    notificationExpirationDate: notificationExpirationDate,
                    paramasDateTime: new Date(),
                    paramsInviter: user.email + ', ' +
                      (user.firstName ? user.firstName : '') + ' ' +
                      (user.lastName ? user.lastName : ''),
                    paramsInvitee: user.email + ', ' +
                      (user.firstName ? user.firstName : '') + ' ' +
                      (user.lastName ? user.lastName : ''),
                    metaEmail: 'scopehub@gmail.com',
                    languageCultureCode: user.languageCultureCode,
                    createdBy: userId,
                    type: Constants.DEFAULT_NOTIFICATION_TYPE
                };
                debug('notificationOptins', notificationOption);
                await NotificationApi.createMD(notificationOption);
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
      * Get orders from MWS
      * */
    getOrdersMWS: async function (options, cb) {
        var orders, requestId;
        var sellerId = options.sellerId;
        var authToken = options.authToken;
        var mpId = options.mpId;
        var lastUpdatedAfter = options.lastUpdatedAfter;
        var numberOfRecords = options.numberOfRecords;
        var userId = options.userId;
        var accountId = options.accountId;
        var replicationId = options.replicationId;
        var err, response, notifyResponse;
        var error, flag = true;

        try {
            for (var i = 1; i <= 3; i++) {
                try {
                    var getOption = {
                        sellerId: sellerId,
                        authToken: authToken,
                        mpId: mpId,
                        lastUpdatedAfter: lastUpdatedAfter,
                        numberOfRecords: numberOfRecords
                    };
                    debug('getOptions', getOption);
                    orders = await OrderReferenceInformation.getOrdersData(getOption);
                    if (orders) {
                        flag = false;
                        break;
                    }
                } catch (err) {
                    debug('err', err);
                    error = err;
                    if (err.Code === 'InvalidParameterValue' || err.Code === 'AccessDenied') {
                        flag = true;
                    } else if (err.Code === 'RequestThrottled') {
                        break;
                    }
                }
            }
            debug('error', error);
            if (!orders && flag) {
                if (error.Code === 'InvalidParameterValue') {
                    err = new Error(ErrorConfig.MESSAGE.INVALID_SELLR_ID);
                    notifyResponse = await OrderReferenceInformation.updateReplicationAndRemoveAccountMarketplace(options);
                } else if (error.Code === 'AccessDenied') {
                    err = new Error(ErrorConfig.MESSAGE.AUTH_TOKEN_NOT_VALID_FOR_SELLER_ID_AND_AWS_ACCOUNT_ID);
                    notifyResponse = await OrderReferenceInformation.updateReplicationAndRemoveAccountMarketplace(options);
                } else if (error.Code === 'RequestThrottled') {
                    err = new Error(ErrorConfig.MESSAGE.REQUEST_THROTELED);
                }
                if (err) {
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    err.hold = true;
                    return cb(err);
                }
            }

            lastUpdatedAfter = orders.LastUpdatedBefore;

            if (DataUtils.isUndefined(orders.ResponseMetadata.RequestId)) {
                err = new Error(ErrorConfig.MESSAGE.RESPONSE_METEDATA_NOT_FOUND);
                debug('err %o', err);
                return cb(err);
            }
            requestId = orders.ResponseMetadata.RequestId;

            response = {
                requestId: requestId,
                orders: orders,
                lastUpdatedAfter: lastUpdatedAfter
            };
            return cb(null, response);
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
        /*} catch (err) {
              if (err.Code === 'InvalidParameterValue') {
                  err = new Error(ErrorConfig.MESSAGE.INVALID_SELLR_ID);
              }
              if (err.Code === 'AccessDenied') {
                  err = new Error(ErrorConfig.MESSAGE.AUTH_TOKEN_NOT_VALID_FOR_SELLER_ID_AND_AWS_ACCOUNT_ID);
              }
              err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
              debug('err %o', err);
              return cb(err);
          }*/
    },

    insertOrderLogRecord: function (options, cb) {
        var OrdersUtils = require('../lib/orders_utils');
        var orderLogFields = '';
        var orderLogOptinalFields = [];
        var orderLogRequiredFields = [];
        var createdAt = DataUtils.getEpochMSTimestamp();
        var updatedAt = DataUtils.getEpochMSTimestamp();

        OrdersUtils.validateOptionalFields(options, async function (err, response) {
            if (err) {
                debug('err', err);
                return cb(err);
            }
            orderLogFields = response.orderLogFields;
            orderLogOptinalFields = response.orderLogOptinalFields;
            orderLogRequiredFields = _.concat(orderLogRequiredFields, orderLogOptinalFields);
            orderLogRequiredFields.push(createdAt, updatedAt);

            try {
                var conn = await connection.getConnection();
                var isInserted = await conn.query('insert into OrdersLog set ' + orderLogFields + ' createdAt=?,updatedAt=?'
                  , orderLogRequiredFields);
                isInserted = Utils.isAffectedPool(isInserted);
                if (!isInserted) {
                    err = new Error(ErrorConfig.MESSAGE.ORDER_LOG_INSERT_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }
                return cb(null, Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.ORDER_LOG_INSERT_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
        });
    },

    /*
  * Store order log
  * */
    storeOrderLog: async function (options) {
        return new Promise(async function (resolve, reject) {
            var oldOrder = options.oldOrder;
            var order = options.order;
            var merchantId = options.merchantId;
            var accountId = options.accountId;
            var userId = options.userId;
            var mpId = options.mpId;
            var authToken = options.authToken;
            var requestId = options.requestId;
            var platform = Constants.PLATFORMS.mws;
            var isLogStore = false;

            var oldOrderDate = !oldOrder ? new Date() : new Date(oldOrder.lastUpdateDate).getTime();
            var newOrderDate = new Date(order.LastUpdateDate).getTime();

            try {
                if (newOrderDate > oldOrderDate) {
                    var option = {
                        userId: userId,
                        requestType: 'RESPONSE',
                        endpoint: 'ImportOrder',
                        params: {},
                        metaData: oldOrder,
                        accountId: accountId,
                        platform: platform,
                        marketplace: mpId,
                        merchantId: merchantId,
                        requestId: requestId,
                        orderId: oldOrder.id
                    };
                    OrderReferenceInformation.insertOrderLogRecord(option, function (err, response) {
                        if (err || !response) {
                            debug('err %o', err);
                            return reject(err);
                        }
                        isLogStore = true;
                        debug('logStored', response);
                        return resolve({isLogStore: isLogStore});
                    });
                } else {
                    return resolve({isLogStore: isLogStore});
                }
            } catch (err) {
                debug('err %o', err);
                return reject(err);
            }
        });

    },


    /*
  * OrdersList which is need to be Update
  * */
    updateOrderList: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var accountId = options.accountId;
            var replicationLogId = options.replicationLogId;
            var oldOrder = options.oldOrder;
            var order = options.order;
            var response, updateCustomer = {};
            var updatedAt = DataUtils.getEpochMSTimestamp();

            try {
                var commonObject = {
                    accountId: accountId || Constants.TYPE_DEFAULT_VALUE.STRING,
                    updatedBy: replicationLogId,
                    updatedAt: updatedAt
                };
                var updateOption = await OrderReferenceInformation.createOrderObjectMD(order);
                updateOption = Object.assign(commonObject, updateOption);
                updateOption.id = oldOrder.id || Constants.TYPE_DEFAULT_VALUE.STRING;

                response = {
                    updateOrders: updateOption
                };

                var customerOption = {
                    accountId: accountId,
                    email: order.BuyerEmail || Constants.TYPE_DEFAULT_VALUE.STRING
                };
                var customer = await CustomerApi.getCustomerByAccountIdEmail(customerOption);
                if (customer) {
                    var customerId = DataUtils.isArray(customer) ? customer[0].id : customer.id;

                    var customerCommonObject = {
                        id: customerId || Constants.TYPE_DEFAULT_VALUE.STRING,
                        accountId: accountId || Constants.TYPE_DEFAULT_VALUE.STRING,
                        updatedBy: replicationLogId,
                        updatedAt: updatedAt || Constants.TYPE_DEFAULT_VALUE.NUMBER
                    };
                    updateCustomer = Object.assign(customerCommonObject, await OrderReferenceInformation.createCustomerObject(order));
                    response.updateCustomer = updateCustomer;
                }
                return resolve(response);
            } catch (err) {
                debug('err', err);
            }
        });
    },

    /*
  * Create customerObject
  * */
    createCustomerObject: function (order) {
        return new Promise(async function (resolve, reject) {
            debug('createCustomerObjectMD 1');
            var customerObject = {
                email: order.BuyerEmail || Constants.TYPE_DEFAULT_VALUE.STRING,
                customerName: order.BuyerName || Constants.TYPE_DEFAULT_VALUE.STRING,
                addressLine1: order.ShippingAddress.AddressLine1 || Constants.TYPE_DEFAULT_VALUE.STRING,
                addressLine2: order.ShippingAddress.AddressLine2 || Constants.TYPE_DEFAULT_VALUE.STRING,
                city: order.ShippingAddress.City || Constants.TYPE_DEFAULT_VALUE.STRING,
                firstName: order.ShippingAddress.Name || Constants.TYPE_DEFAULT_VALUE.STRING,
                zipCode: order.ShippingAddress.PostalCode || Constants.TYPE_DEFAULT_VALUE.STRING,
                state: order.ShippingAddress.StateOrRegion || Constants.TYPE_DEFAULT_VALUE.STRING,
                country: order.ShippingAddress.CountryCode || Constants.TYPE_DEFAULT_VALUE.STRING,
                recordType: Constants.RECORD_TYPE.REPLICATION || Constants.TYPE_DEFAULT_VALUE.NUMBER
            };
            return resolve(customerObject);
        });
    },

    /*
  * Create customerObject
  * */
    createCustomerObjectForCSV: function (order) {
        return new Promise(async function (resolve, reject) {
            debug('createCustomerObjectMD 1');
            var customerObject = {
                email: order.buyerEmail || Constants.TYPE_DEFAULT_VALUE.STRING,
                customerName: order.buyerName || Constants.TYPE_DEFAULT_VALUE.STRING,
                addressLine1: order.addressLine1 || Constants.TYPE_DEFAULT_VALUE.STRING,
                addressLine2: order.addressLine2 || Constants.TYPE_DEFAULT_VALUE.STRING,
                city: order.city || Constants.TYPE_DEFAULT_VALUE.STRING,
                firstName: order.name || Constants.TYPE_DEFAULT_VALUE.STRING,
                zipCode: order.postalCode || Constants.TYPE_DEFAULT_VALUE.STRING,
                state: order.stateOrRegion || Constants.TYPE_DEFAULT_VALUE.STRING,
                country: order.countryCode || Constants.TYPE_DEFAULT_VALUE.STRING,
                recordType: Constants.RECORD_TYPE.MANUAL || Constants.TYPE_DEFAULT_VALUE.NUMBER
            };
            return resolve(customerObject);
        });
    },

    /*
  * Create orderlist of required order
  * */
    createOrderList: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            debug('Inside createOrderList');
            var accountId = options.accountId;
            var replicationLogId = options.replicationLogId;
            var order = options.order;
            var createOrders = {}, response = {};
            var generatedId = Utils.generateId();
            var createCustomer = {}, updateCustomer = {};
            var customerUUID = Utils.generateId();
            var customerCommonObject;
            var createdAt = DataUtils.getEpochMSTimestamp();
            var updatedAt = DataUtils.getEpochMSTimestamp();

            try {
                var commonObject = {
                    id: generatedId.uuid,
                    accountId: accountId || Constants.TYPE_DEFAULT_VALUE.STRING,
                    createdBy: replicationLogId,
                    status: Constants.ORDER_STATUS.OLI_NOT_PROCESSED,
                    createdAt: createdAt,
                    updatedAt: updatedAt
                };
                //debug('order', order);
                createOrders = Object.assign(commonObject, await OrderReferenceInformation.createOrderObjectMD(order));
                response = {
                    createOrders: createOrders
                };
                //debug('order response', createOrders);

                var customerOption = {
                    accountId: accountId,
                    email: order.BuyerEmail || Constants.TYPE_DEFAULT_VALUE.STRING
                };
                var customer = await CustomerApi.getCustomerByAccountIdEmail(customerOption);
                if (customer) {
                    var customerId = DataUtils.isArray(customer) ? customer[0].id : customer.id;
                    customerCommonObject = {
                        id: customerId || Constants.TYPE_DEFAULT_VALUE.STRING,
                        accountId: accountId || Constants.TYPE_DEFAULT_VALUE.STRING,
                        updatedBy: replicationLogId,
                        updatedAt: updatedAt
                    };
                    updateCustomer = Object.assign(customerCommonObject, await OrderReferenceInformation.createCustomerObject(order));
                    response.updateCustomer = updateCustomer;
                }
                if (!customer) {
                    customerCommonObject = {
                        id: customerUUID.uuid,
                        accountId: accountId || Constants.TYPE_DEFAULT_VALUE.STRING,
                        createdBy: replicationLogId,
                        customerCode: OrderReferenceInformation.generateCustomerId(order.BuyerName),
                        createdAt: createdAt,
                        updatedAt: updatedAt
                    };
                    createCustomer = Object.assign(customerCommonObject, await OrderReferenceInformation.createCustomerObject(order));
                    response.createCustomer = createCustomer;
                }
                return resolve(response);
            } catch (err) {
                debug('err', err);
                //return cb(err);
            }
        });
    },

    /*
  * Create order object which is not in ORI table
  * */
    storeOrderMD: async function (options, cb) {
        var orderDetails = options.orderDetails;
        var replicationLogId = options.replicationLogId;
        var mpId = options.mpId;
        var merchantId = options.merchantId;
        var requestId = options.requestId;
        var authToken = options.authToken;
        var accountId = options.accountId;
        var replicationId = options.replicationId;
        var userId = options.userId;
        var numberOfOrders = 0, createOrders = [], updateOrders = [];
        var isLogStore = false;
        var createCustomers = [], updateCustomers = [];
        var c = 1;

        await PromiseBluebird.each(orderDetails, async function (order) {
            debug('c', c++);

            var orderOption = {
                accountId: accountId,
                mpId: mpId,
                amazonOrderId: order.AmazonOrderId
            };

            await OrderReferenceInformation.getOrderMD(orderOption, async function (err, oldOrder) {
                if (err) {
                    debug('err', err);
                    //return cb(err);
                }
                var orderObjectOption = {
                    accountId: accountId,
                    order: order,
                    replicationLogId: replicationLogId
                };
                // STORE LOG
                if (oldOrder) {
                    debug('Inside oldOrder');
                    var logOption = {
                        order: order,
                        oldOrder: oldOrder,
                        authToken: authToken,
                        merchantId: merchantId,
                        accountId: accountId,
                        userId: userId,
                        marketplaceId: mpId,
                        requestId: requestId
                    };
                    try {
                        var response = await OrderReferenceInformation.storeOrderLog(logOption);
                        if (!response) {
                            err = new Error(ErrorConfig.MESSAGE.ORDER_LOG_INSERT_FAILED);
                            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                            debug('err', err);
                            throw err;
                        }
                        isLogStore = response.isLogStore;

                        if (!err && isLogStore) {
                            orderObjectOption.oldOrder = oldOrder;
                            var orderResponse = await OrderReferenceInformation.updateOrderList(orderObjectOption);
                            debug('c', c);
                            updateOrders.push(orderResponse.updateOrders);
                            if (orderResponse.updateCustomer) {
                                updateCustomers.push(orderResponse.updateCustomer);
                            }

                        }
                    } catch (err) {
                        err = new Error(ErrorConfig.MESSAGE.UPDATE_ORDER_LIST_CREATE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        debug('err', err);
                    }
                }
                debug('err', err);
                //debug('oldOrder', oldOrder);
                if (!err && !oldOrder) {
                    try {
                        var updateOrderResponse = await OrderReferenceInformation.createOrderList(orderObjectOption);

                        createOrders.push(updateOrderResponse.createOrders);
                        if (updateOrderResponse.createCustomer) {
                            createCustomers.push(updateOrderResponse.createCustomer);
                        }
                        if (updateOrderResponse.updateCustomers) {
                            updateCustomers.push(updateOrderResponse.updateCustomers);
                        }
                    } catch (err) {
                        debug('err', err);
                    }
                }
            });
        });

        var manageOrderOptions = {
            createOrders: createOrders,
            updateOrders: updateOrders,
            replicationId: replicationId
        };
        //debug('manageOrderOptions', manageOrderOptions);

        OrderReferenceInformation.manageOrderMD(manageOrderOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return cb(err);
            }
            var manageResponse = {
                numberOfOrders: response.numberOfOrders,
                createOrders: response.createOrders,
                updateOrders: response.updateOrders,
                createCustomers: createCustomers,
                updateCustomers: updateCustomers
            };
            return cb(null, manageResponse);
        });
    },

    updateItemsBycreatedBy: async function (options, cb) {
        debug('options', options);
        var ids = options.affectedItemIds;
        var replicationLogId = options.replicationLogId;
        var values = [], err, queryString = '',
          query = 'update OrderLineItems set createdBy=?,updatedAt=utc_timestamp(3) where ';

        ids.forEach(function (value) {
            queryString = queryString + 'id = uuid_to_bin(?) or ';
        });
        queryString = queryString.replace(/or\s*$/, '');
        query = query + queryString;

        values.push(replicationLogId);
        values = values.concat(ids);

        try {
            var conn = await connection.getConnection();
            var isUpdated = await conn.query(query, values);
            isUpdated = Utils.isAffectedPool(isUpdated);
            debug('isUpdated', isUpdated);
            if (!isUpdated) {
                throw err;
            }
            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err123 %o', err);
            err = new Error(ErrorConfig.MESSAGE.ORDER_ITEM_UPDATION_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    /*
  * Validate Replication log fields
  * */
    validateReplicationLogFileds: function (options, cb) {
        var err;
        var replicationLogFields = '';
        var replicationLogOptionalValues = [];

        try {
            if (!DataUtils.isValidateOptionalField(options.startTime)) {
                replicationLogFields += 'startTime=? ,';
                replicationLogOptionalValues.push(options.startTime);
            }
            if (!DataUtils.isValidateOptionalField(options.endTime)) {
                replicationLogFields += 'endTime=? ,';
                replicationLogOptionalValues.push(options.endTime);
            }
            if (!DataUtils.isValidateOptionalField(options.numberOfOrders)) {
                replicationLogFields += 'numberOfOrders=? ,';
                replicationLogOptionalValues.push(options.numberOfOrders);
            }
            if (!DataUtils.isValidateOptionalField(options.numberOfItems)) {
                replicationLogFields += 'numberOfItems=? ,';
                replicationLogOptionalValues.push(options.numberOfItems);
            }
            if (!DataUtils.isValidateOptionalField(options.ORICompleteTime)) {
                replicationLogFields += 'ORICompleteTime=? ,';
                replicationLogOptionalValues.push(options.ORICompleteTime);
            }
            if (!DataUtils.isValidateOptionalField(options.OLICompleteTime)) {
                replicationLogFields += 'OLICompleteTime=? ,';
                replicationLogOptionalValues.push(options.OLICompleteTime);
            }
            if (!DataUtils.isValidateOptionalField(options.status)) {
                replicationLogFields += 'status=? ,';
                replicationLogOptionalValues.push(options.status);
            }

            var response = {
                replicationLogFields: replicationLogFields,
                replicationLogOptionalValues: replicationLogOptionalValues
            };
            return cb(null, response);
        } catch (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
    },

    /*
  * Update replicationLog table by numberOfOrder , numberOfItems and endTime
  * */
    updateReplicationLogMD: async function (options, cb) {
        var replicationLogFields = '';
        var replicationLogOptionalValues = [];
        var replicationLogRequiredValues = [];
        var updatedAt = DataUtils.getEpochMSTimestamp();

        OrderReferenceInformation.validateReplicationLogFileds(options, async function (err, response) {
            if (err) {
                debug('err', err);
                return cb(err);
            }

            replicationLogFields = response.replicationLogFields;
            replicationLogOptionalValues = response.replicationLogOptionalValues;

            replicationLogRequiredValues = _.concat(replicationLogRequiredValues, replicationLogOptionalValues);
            replicationLogRequiredValues.push(updatedAt, options.replicationLogId);

            try {
                var conn = await connection.getConnection();
                var replicationUpdated = await conn.query('update ReplicationLog set ' + replicationLogFields + ' updatedAt=?  ' +
                  ' where id=uuid_to_bin(?);', replicationLogRequiredValues);
                replicationUpdated = Utils.isAffectedPool(replicationUpdated);

                if (!replicationUpdated) {
                    err = new Error(ErrorConfig.MESSAGE.REPLICATION_LOG_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return cb(err);
                }
                return cb(null, {
                    OK: Constants.SUCCESS,
                    updatedAt: updatedAt
                });
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.REPLICATION_LOG_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
        });
    },

    /*
  * Update replicationSetting from RAPI without updatedAt
  * */
    updateReplicationSettingsMD: async function (options, cb) {
        var replicationFields = '';
        var replicationOptionalValues = [];
        var replicationRequiredValues = [];
        var updatedAt = DataUtils.getEpochMSTimestamp();

        OrderReferenceInformation.validateOptionalFields(options, async function (err, response) {
            if (err) {
                debug('err', err);
                return cb(err);
            }

            replicationFields = response.replicationFields;
            replicationOptionalValues = response.replicationOptionalValues;

            replicationRequiredValues = _.concat(replicationRequiredValues, replicationOptionalValues);
            replicationRequiredValues.push(updatedAt, options.userId, options.id);

            try {
                var conn = await connection.getConnection();
                var replicationUpdated = await conn.query('update ReplicationSetting set ' + replicationFields + ' updatedAt=?, ' +
                  'updatedBy=uuid_to_bin(?) where id=uuid_to_bin(?) ;', replicationRequiredValues);
                replicationUpdated = Utils.isAffectedPool(replicationUpdated);

                if (!replicationUpdated) {
                    err = new Error(ErrorConfig.MESSAGE.REPLICATION_SETTING_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return cb(err);
                }
                return cb(null, {
                    OK: Constants.SUCCESS,
                    updatedAt: updatedAt
                });
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.REPLICATION_RECORD_UPDATION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);

            }
        });
    },

    /*
  * Create object for item
  * */
    createItemObjectMD: function (options) {
        return new Promise(async function (resolve, reject) {
            var item = options.item;

            var itemOption = {
                quantityOrdered: item.QuantityOrdered || Constants.TYPE_DEFAULT_VALUE.NUMBER,
                title: item.Title || Constants.TYPE_DEFAULT_VALUE.STRING,
                shippingTaxCurrencyCode: item.ShippingTax ? item.ShippingTax.CurrencyCode : Constants.TYPE_DEFAULT_VALUE.STRING,
                shippingTaxAmount: item.ShippingTax ? await OrderReferenceInformation.validateAmountMD(item.ShippingTax.Amount) : Constants.TYPE_DEFAULT_VALUE.NUMBER,
                promotionDiscountCurrencyCode: item.PromotionDiscount ? item.PromotionDiscount.CurrencyCode : Constants.TYPE_DEFAULT_VALUE.STRING,
                promotionDiscountAmount: item.PromotionDiscount ? await OrderReferenceInformation.validateAmountMD(item.PromotionDiscount.Amount) : Constants.TYPE_DEFAULT_VALUE.NUMBER,
                conditionId: item.ConditionId || Constants.TYPE_DEFAULT_VALUE.STRING,
                mpProductId: item.ASIN || Constants.TYPE_DEFAULT_VALUE.STRING,
                sellerSKU: item.SellerSKU || Constants.TYPE_DEFAULT_VALUE.STRING,
                orderItemId: item.OrderItemId || Constants.TYPE_DEFAULT_VALUE.STRING,
                numberOfItems: item.ProductInfo ? item.ProductInfo.NumberOfItems : Constants.TYPE_DEFAULT_VALUE.NUMBER,
                giftWrapTaxCurrencyCode: item.GiftWrapTax ? item.GiftWrapTax.CurrencyCode : Constants.TYPE_DEFAULT_VALUE.STRING,
                giftWrapTaxAmount: item.GiftWrapTax ? await OrderReferenceInformation.validateAmountMD(item.GiftWrapTax.Amount) : Constants.TYPE_DEFAULT_VALUE.NUMBER,
                quantityShipped: item.QuantityShipped || Constants.TYPE_DEFAULT_VALUE.NUMBER,
                shippingPriceCurrencyCode: item.ShippingPrice ? item.ShippingPrice.CurrencyCode : Constants.TYPE_DEFAULT_VALUE.STRING,
                shippingPriceAmount: item.ShippingPrice ? await OrderReferenceInformation.validateAmountMD(item.ShippingPrice.Amount) : Constants.TYPE_DEFAULT_VALUE.NUMBER,
                giftWrapPriceCurrencyCode: item.GiftWrapPrice ? item.GiftWrapPrice.CurrencyCode : Constants.TYPE_DEFAULT_VALUE.STRING,
                giftWrapPriceAmount: item.GiftWrapPrice ? await OrderReferenceInformation.validateAmountMD(item.GiftWrapPrice.Amount) : Constants.TYPE_DEFAULT_VALUE.NUMBER,
                conditionSubtypeId: item.ConditionSubtypeId || Constants.TYPE_DEFAULT_VALUE.STRING,
                itemPriceCurrencyCode: item.ItemPrice ? item.ItemPrice.CurrencyCode : Constants.TYPE_DEFAULT_VALUE.STRING,
                itemPriceAmount: item.ItemPrice ? await OrderReferenceInformation.validateAmountMD(item.ItemPrice.Amount) : Constants.TYPE_DEFAULT_VALUE.NUMBER,
                itemTaxCurrencyCode: item.ItemTax ? item.ItemTax.CurrencyCode : Constants.TYPE_DEFAULT_VALUE.STRING,
                itemTaxAmount: item.ItemTax ? await OrderReferenceInformation.validateAmountMD(item.ItemTax.Amount) : Constants.TYPE_DEFAULT_VALUE.NUMBER,
                shippingDiscountCurrencyCode: item.ShippingDiscount ? item.ShippingDiscount.CurrencyCode : Constants.TYPE_DEFAULT_VALUE.STRING,
                shippingDiscountAmount: item.ShippingDiscount ? await OrderReferenceInformation.validateAmountMD(item.ShippingDiscount.Amount) : Constants.TYPE_DEFAULT_VALUE.NUMBER,
                isGift: Utils.toBoolean(item.IsGift) || Constants.TYPE_DEFAULT_VALUE.BOOLEAN,
                giftMessageText: item.giftMessageText || Constants.TYPE_DEFAULT_VALUE.STRING,
                priceDestination: item.priceDestination || Constants.TYPE_DEFAULT_VALUE.STRING,
                conditionNote: item.ConditionNote || Constants.TYPE_DEFAULT_VALUE.STRING,
                UOMScalId: Constants.UOM.EACH || Constants.TYPE_DEFAULT_VALUE.NUMBER,
                scheduledDeliveryStartDate: item.ScheduledDeliveryStartDate ? new Date(item.ScheduledDeliveryStartDate).getTime() : Constants.TYPE_DEFAULT_VALUE.DATETIME,
                scheduledDeliveryEndDate: item.ScheduledDeliveryEndDate ? new Date(item.ScheduledDeliveryEndDate).getTime() : Constants.TYPE_DEFAULT_VALUE.DATETIME,
                CODFeeCurrencyCode: item.CODFee ? item.CODFee.CurrencyCode : Constants.TYPE_DEFAULT_VALUE.STRING,
                CODFeeAmount: item.CODFee ? await OrderReferenceInformation.validateAmountMD(item.CODFee.Amount) : Constants.TYPE_DEFAULT_VALUE.NUMBER,
                CODFeeDiscountCurrencyCode: item.CODFeeDiscount ? item.CODFeeDiscount.CurrencyCode : Constants.TYPE_DEFAULT_VALUE.STRING,
                CODFeeDiscountAmount: item.CODFeeDiscount ? await OrderReferenceInformation.validateAmountMD(item.CODFeeDiscount.Amount) : Constants.TYPE_DEFAULT_VALUE.NUMBER
            };

            return resolve(itemOption);
        });

    },

    /*
  * Insert multiple items
  * */
    createItemsMD: async function (options, cb) {
        var allItems = options.allItems;
        var replicationId = options.replicationId;
        var amazonOrderId = options.amazonOrderId;
        var orderErrorLogOption, orderErrorLogResponse;
        var convertedItemList, keys, err;
        await Utils.convertObjectToArrayMD(allItems, async function (err, response) {
            if (err) {
                debug('err', err);
                return cb(err);
            }
            convertedItemList = response.list;
            keys = response.keys;

            var query = 'insert into OrderLineItems (' + keys + ') values';

            var values = ' (uuid_to_bin(?), uuid_to_bin(?),uuid_to_bin(?),uuid_to_bin(?),uuid_to_bin(?),uuid_to_bin(?),?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ';

            await PromiseBluebird.each(allItems, function (value) {
                query = query + values;
                query = query + ',';
            });

            query = query.replace(/,\s*$/, '');

            try {
                var conn = await connection.getConnection();
                var itemInserted = await conn.query(query, convertedItemList);
                itemInserted = Utils.isAffectedPool(itemInserted);

                debug('itemInserted----------------------------------', itemInserted);
                if (!itemInserted) {
                    throw err;
                }
                return cb(null, Constants.OK_MESSAGE);
            } catch (err) {
                debug('err ', err);
                err = new Error(ErrorConfig.MESSAGE.ORDER_ITEM_CREATION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;

                // Store error Log
                orderErrorLogOption = {
                    replicationSettingId: replicationId,
                    orderId: amazonOrderId,
                    metaData: err,
                    failReasonCode: Constants.ORDER_ERROR_LOG_REASON_CODE.ORDER_LINE_ITEM_STORE_FAILED.CODE,
                    errorMessage: Constants.ORDER_ERROR_LOG_REASON_CODE.ORDER_LINE_ITEM_STORE_FAILED.MESSAGE,
                    createdAt: DataUtils.getEpochMSTimestamp()
                };
                orderErrorLogResponse = await OrderReferenceInformation.insertOrderErrorLogs({orderErrorLogs: [orderErrorLogOption]});
                debug('orderErrorLogResponse', orderErrorLogResponse);

                return cb();
            }
        });
    },

    /*
    * Store orders error logs
    * */
    insertOrderErrorLogs: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var orderErrorLogs = options.orderErrorLogs;
            var convertedErrorList, keys, err;
            await Utils.convertObjectToArrayMD(orderErrorLogs, async function (err, response) {
                if (err) {
                    debug('err', err);
                    return resolve({});
                }
                convertedErrorList = response.list;
                keys = response.keys;

                var query = 'insert into OrdersErrorLog (' + keys + ') values';
                var values = ' (uuid_to_bin(?),?,?,?,?,?) ';

                await PromiseBluebird.each(orderErrorLogs, function (value) {
                    query = query + values;
                    query = query + ',';
                });

                query = query.replace(/,\s*$/, '');

                try {
                    var conn = await connection.getConnection();
                    var ErrorLogsInserted = await conn.query(query, convertedErrorList);
                    ErrorLogsInserted = Utils.isAffectedPool(ErrorLogsInserted);

                    debug('ErrorLogsInserted----------------------------------', ErrorLogsInserted);
                    if (!ErrorLogsInserted) {
                        throw err;
                    }
                    return resolve(Constants.OK_MESSAGE);
                } catch (err) {
                    debug('err ', err);
                    err = new Error(ErrorConfig.MESSAGE.ORDER_ERROR_LOG_CREATION_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return resolve({});
                }
            });
        });
    },

    /*
  * Get item by accountId, amazonOrderId and orderItemId
  * */
    getOrderItemMD: async function (options, cb) {
        var accountId = options.accountId;
        var amazonOrderId = options.amazonOrderId;
        var orderItemId = options.orderItemId;
        var err;

        try {
            var conn = await connection.getConnection();
            var item = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id from OrderLineItems where accountId = uuid_to_bin(?) and ' +
              'amazonOrderId = ? and orderItemId = ?', [accountId, amazonOrderId, orderItemId]);
            item = Utils.filteredResponsePool(item);
            if (!item) {
                throw err;
            }
            return cb(null, item);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.ITEMS_NOT_FOUND);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb();
        }
    },

    updateOrdersByStatus: async function (options, cb) {
        var orderRefId = options.orderRefId;
        var status = Constants.ORDER_STATUS.OLI_PROCESSED;
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var err;

        try {
            var conn = await connection.getConnection();
            var isUpdated = await conn.query('update OrderReferenceInformation set status=?,updatedAt=? where id = uuid_to_bin(?)',
              [status, updatedAt, orderRefId]);
            isUpdated = Utils.isAffectedPool(isUpdated);
            if (!isUpdated) {
                err = new Error(ErrorConfig.MESSAGE.ORDER_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err123 %o', err);
            err = new Error(ErrorConfig.MESSAGE.ORDER_UPDATE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    /*
      * Get productRefId by sku and accountId
      * */
    getProductRefIdBySKU: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var sku = options.sku;
            var accountId = options.accountId, err;
            try {
                var conn = await connection.getConnection();
                var response = await conn.query('select CAST(uuid_from_bin(PR.id) as CHAR) as productRefId,CAST(uuid_from_bin(PI.id) as CHAR) as productInventoryId  ' +
                  ' from ProductReferences  PR, ProductInventory PI ' +
                  ' where PR.sku=? and PR.accountId=uuid_to_bin(?) and PR.id=PI.productRefId ;', [sku, accountId]);
                //productRefId = Utils.filteredResponsePool(productRefId);
                if (!response || response.length > 0) {
                    return resolve(response[0]);
                } else {
                    return resolve({});
                }
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
      * Validate Optional field for inventory transaction
      * */
    validateFieldsInventoryTransaction: async function (options, cb) {
        var inventoryTransactionFields = '';
        var inventoryTransactionOptionalValues = [];
        var err;

        try {
            if (!DataUtils.isValidateOptionalField(options.productRefId)) {
                inventoryTransactionFields += 'productRefId=uuid_to_bin(?) ,';
                inventoryTransactionOptionalValues.push(options.productRefId);
            }
            if (!DataUtils.isValidateOptionalField(options.productInventoryId)) {
                inventoryTransactionFields += 'productInventoryId=uuid_to_bin(?) ,';
                inventoryTransactionOptionalValues.push(options.productInventoryId);
            }
            if (!DataUtils.isValidateOptionalField(options.pointerId)) {
                inventoryTransactionFields += 'pointerId=uuid_to_bin(?) ,';
                inventoryTransactionOptionalValues.push(options.pointerId);
            }
            if (!DataUtils.isValidateOptionalField(options.type)) {
                inventoryTransactionFields += 'type=? ,';
                inventoryTransactionOptionalValues.push(options.type);
            }
            if (!DataUtils.isValidateOptionalField(options.amount)) {
                inventoryTransactionFields += 'amount=? ,';
                inventoryTransactionOptionalValues.push(options.amount);
            }
            if (!DataUtils.isValidateOptionalField(options.UOM)) {
                inventoryTransactionFields += 'UOM=? ,';
                inventoryTransactionOptionalValues.push(options.UOM);
            }
            if (!DataUtils.isValidateOptionalField(options.reasonCode)) {
                inventoryTransactionFields += 'reasonCode=? ,';
                inventoryTransactionOptionalValues.push(options.reasonCode);
            }
            if (!DataUtils.isValidateOptionalField(options.effectDateTime)) {
                inventoryTransactionFields += 'effectDateTime=? ,';
                inventoryTransactionOptionalValues.push(options.effectDateTime);
            }
            if (!DataUtils.isValidateOptionalField(options.operation)) {
                inventoryTransactionFields += 'operation=? ,';
                inventoryTransactionOptionalValues.push(options.operation);
            }


            var response = {
                inventoryTransactionFields: inventoryTransactionFields,
                inventoryTransactionOptionalValues: inventoryTransactionOptionalValues
            };
            return cb(null, response);
        } catch (err) {
            debug('err', err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
    },


    /*
      * Create Inventory Transaction
      * */
    createInventoryTransaction: function (options) {
        return new Promise(async function (resolve, reject) {
            var productRefId = options.productRefId;
            var productInventoryId = options.productInventory;
            var pointerId = options.pointerId;
            var type = options.type;
            var qtyAmount = options.qtyAmount;
            var reasonCode = options.reasonCode;
            var effectDataTime = options.effectDataTime;
            var userId = options.userId;
            var inventoryTransactionFields, inventoryTransactionOptionalValues, err;
            var createdAt = DataUtils.getEpochMSTimestamp();
            var updatedAt = DataUtils.getEpochMSTimestamp();

            try {

                OrderReferenceInformation.validateFieldsInventoryTransaction(options, async function (err, response) {
                    if (err) {
                        debug('err', err);
                        return reject(err);
                    }
                    inventoryTransactionFields = response.inventoryTransactionFields;
                    inventoryTransactionOptionalValues = response.inventoryTransactionOptionalValues;
                    inventoryTransactionOptionalValues.push(createdAt, updatedAt, userId);
                    var conn = await connection.getConnection();
                    var isInserted = await conn.query('insert into InventoryTransaction set ' + inventoryTransactionFields + ' createdAt=?,updatedAt=?,' +
                      'createdBy=uuid_to_bin(?);', inventoryTransactionOptionalValues);
                    isInserted = Utils.isAffectedPool(isInserted);
                    if (!isInserted) {
                        err = new Error(ErrorConfig.MESSAGE.INVENTORY_TRANSACTION_CREATE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                        debug('err %o', err);
                        return reject(err);
                    }
                    return resolve(Constants.OK_MESSAGE);
                });
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.INVENTORY_TRANSACTION_CREATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                debug('err %o', err);
                return reject(err);
            }
        });
    },

    getType: function (array) {
        array = _.remove(array, undefined);
        return array[0];
    },

    /*
      * Build query
      * */
    buildQueryForInventoryUpdate: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var type = options.type;
            var operation = options.operation;
            var string = '';

            //var type = 2;
            var qtyType = _.map(Constants.QTY_TYPE, function (typeObject) {
                if (typeObject.CODE === type) {
                    return typeObject.TYPE;
                }
            });
            qtyType = OrderReferenceInformation.getType(qtyType);
            var operationSign = operation === Constants.INVENTORY_OPERATION.ADD ? ' + ' : ' - ';
            string += qtyType + ' = ' + qtyType + operationSign + ' ? , ';

            return resolve(string);
        });
    },

    /*
      * Update product Inventory after transaction is added
      * */
    updateProductInventory: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var transactions = options.transactions;
            var productInventoryId = options.productInventoryId;
            var query = 'update ProductInventory PI, uomScaling US1,uomScaling US2,uomScaling US3,uomScaling US4 set ';
            var values = [];
            var where = ' where PI.id = uuid_to_bin(?) ;';
            var subWhere = '';
            try {
                await PromiseBluebird.each(transactions, async function (transaction) {
                    var assignString = await OrderReferenceInformation.buildQueryForInventoryUpdate({
                        type: transaction.type,
                        operation: transaction.operation
                    });
                    query += assignString;
                    values.push(parseInt(transaction.amount));
                });
                query = query.replace(/,\s*$/, '');
                query += where;
                values.push(productInventoryId);

                debug('query', query);
                debug('values', values);
                var conn = await connection.getConnection();
                var isUpdated = await conn.query(query, values);
                isUpdated = Utils.isAffectedPool(isUpdated);
                debug('isUpdated', isUpdated);
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
            }
        });
    },


    /*
  * Create item object which is not in OLI table
  * */
    storeItemsMD: async function (options, cb) {
        var itemsArray = options.itemsArray;
        var accountId = options.accountId;
        var amazonOrderId = options.amazonOrderId;
        var orderRefId = options.orderRefId;
        var replicationLogId = options.replicationLogId;
        var userId = options.userId;
        var replicationId = options.replicationId;
        var itemOption;
        var numberOfItems = 0;
        var allItems = [], affectedItemIds, c = 1;
        var createdAt = DataUtils.getEpochMSTimestamp();
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var productRefId, productInventoryId, response;
        var orderErrorLogOption, orderErrorLogResponse;

        try {
            await PromiseBluebird.each(itemsArray, async function (item) {
                var itemOption = {
                    accountId: accountId,
                    orderRefId: orderRefId,
                    amazonOrderId: amazonOrderId,
                    orderItemId: item.OrderItemId
                };
                debug('itemOption', itemOption);
                await OrderReferenceInformation.getOrderItemMD(itemOption, async function (err, oldItem) {
                    if (err) {
                        debug('err', err);
                    }
                    if (!err && !oldItem) {
                        var option = {
                            item: item
                        };
                        var generatedId = Utils.generateId();
                        var commonOption = {
                            id: generatedId.uuid,
                            accountId: accountId,
                            orderRefId: orderRefId,
                            productRefId: Constants.DEFAULT_REFERE_ID,
                            createdBy: replicationLogId,
                            orderType: Constants.ORDER_TYPE_ID.ECO || Constants.DEFAULT_REFERE_ID,
                            amazonOrderId: amazonOrderId,
                            recordType: Constants.RECORD_TYPE.REPLICATION,
                            createdAt: createdAt,
                            updatedAt: updatedAt
                        };
                        itemOption = await OrderReferenceInformation.createItemObjectMD(option);
                        itemOption = Object.assign(commonOption, itemOption);

                        // Get the product from the sellerSKU
                        var productOption = {
                            sku: item.SellerSKU,
                            accountId: accountId
                        };
                        response = await OrderReferenceInformation.getProductRefIdBySKU(productOption);
                        productRefId = response.productRefId;
                        productInventoryId = response.productInventoryId;

                        if (productRefId) {
                            itemOption.productRefId = productRefId;
                            allItems.push(itemOption);
                        } else {
                            // Store error Log
                            var error = new Error(ErrorConfig.MESSAGE.PRODUCT_NOT_FOUND);
                            error.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                            orderErrorLogOption = {
                                replicationSettingId: replicationId,
                                orderId: amazonOrderId,
                                metaData: itemOption,
                                failReasonCode: Constants.ORDER_ERROR_LOG_REASON_CODE.PRODUCT_NOT_FOUND.CODE,
                                errorMessage: Constants.ORDER_ERROR_LOG_REASON_CODE.PRODUCT_NOT_FOUND.MESSAGE,
                                createdAt: DataUtils.getEpochMSTimestamp()
                            };
                            orderErrorLogResponse = await OrderReferenceInformation.insertOrderErrorLogs({orderErrorLogs: [orderErrorLogOption]});
                            debug('orderErrorLogResponse', orderErrorLogResponse);
                        }
                        /*
                          * Create Inventory transaction
                          * */
                        //debug('item', item);
                        if (productRefId && productInventoryId) {
                            var transactions = [
                                {
                                    productRefId: productRefId,
                                    productInventoryId: productInventoryId,
                                    pointerId: generatedId.uuid,
                                    type: Constants.QTY_TYPE.QTY_IN_TRANSIT.CODE,
                                    amount: item.QuantityOrdered,
                                    reasonCode: Constants.INVENTORY_TRANSACTION_REASON_CODE.ADDED_FOR_ORDER_FULLFILMENT.CODE,
                                    effectDateTime: new Date(),
                                    userId: userId,
                                    operation: Constants.INVENTORY_OPERATION.ADD
                                },
                                {
                                    productRefId: productRefId,
                                    productInventoryId: productInventoryId,
                                    pointerId: generatedId.uuid,
                                    type: Constants.QTY_TYPE.QTY_AVAILABLE.CODE,
                                    amount: item.QuantityOrdered,
                                    reasonCode: Constants.INVENTORY_TRANSACTION_REASON_CODE.REMOVED_FOR_ORDER_FULLFILMENT.CODE,
                                    effectDateTime: new Date(),
                                    operation: Constants.INVENTORY_OPERATION.DEDUCT,
                                    userId: userId
                                },
                                {
                                    productRefId: productRefId,
                                    productInventoryId: productInventoryId,
                                    pointerId: generatedId.uuid,
                                    type: Constants.QTY_TYPE.QTY_ON_HAND.CODE,
                                    amount: item.QuantityOrdered,
                                    reasonCode: Constants.INVENTORY_TRANSACTION_REASON_CODE.REMOVED_FOR_ORDER_FULLFILMENT.CODE,
                                    effectDateTime: new Date(),
                                    operation: Constants.INVENTORY_OPERATION.DEDUCT,
                                    userId: userId
                                }
                            ];
                            //debug('transactions', transactions);
                            await PromiseBluebird.each(transactions, async function (transaction) {
                                var transactionResponse = await OrderReferenceInformation.createInventoryTransaction(transaction);
                                debug('transactionResponse ', transactionResponse);
                                if (!transactionResponse) {
                                    err = new Error(ErrorConfig.MESSAGE.INVENTORY_TRANSACTION_CREATE_FAILED);
                                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                                    debug('err %o', err);
                                    //throw err;
                                }
                            });

                            /*
                              * Update Inventory record
                              * */
                            var updateInventoryOptions = {
                                transactions: transactions,
                                productInventoryId: productInventoryId
                            };
                            var updateInventoryResponse = await OrderReferenceInformation.updateProductInventory(updateInventoryOptions);
                            debug('updateInventoryResponse', updateInventoryResponse);
                        }
                    }
                });
            });

            if (allItems.length <= 0) {
                return cb(null, {
                    allItems: [],
                    numberOfItems: 0
                });
            }

            var itemOptions = {
                allItems: allItems,
                replicationId: replicationId,
                amazonOrderId: amazonOrderId
            };

            CommonApi.startTransaction();
            await OrderReferenceInformation.createItemsMD(itemOptions, async function (err, createResponse) {
                if (err) {
                    debug('err', err);
                    await CommonApi.rollback();
                    return cb(err);
                }
                numberOfItems = allItems.length;

                var orderOptions = {
                    orderRefId: orderRefId
                };

                await OrderReferenceInformation.updateOrdersByStatus(orderOptions, async function (err, updateResponse) {
                    if (err) {
                        debug('err', err);
                        await CommonApi.rollback();
                        return cb(err);
                    }
                    var response = {
                        numberOfItems: numberOfItems,
                        allItems: allItems
                    };
                    debug('response', numberOfItems);
                    allItems = [];
                    CommonApi.commit();
                    return cb(null, response);
                });
            });
        } catch (err) {
            debug('err', err);
        }
    },

    /*
  * Get item from mws for perticular order
  * */
    getItemMWS: async function (options, cb) {
        var sellerId = options.sellerId;
        var authToken = options.authToken;
        var amazonOrderId = options.amazonOrderId;
        var response = {};

        try {
            var items = await amazonMws.orders.search({
                'Version': '2013-09-01',
                'Action': 'ListOrderItems',
                'SellerId': sellerId,
                'MWSAuthToken': authToken,
                'AmazonOrderId': amazonOrderId
            });
            if (!items.OrderItems.OrderItem) {
                var err = new Error(ErrorConfig.MESSAGE.ITEMS_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug('err %o', err);
                return cb(err);
            }
            items = items.OrderItems.OrderItem;

            response = {
                items: items
            };

            return cb(null, response);
        } catch (err) {
            debug('err %o', err);
            if (err.Code === 'InvalidParameterValue') {
                err = new Error(ErrorConfig.MESSAGE.INVALID_SELLR_ID);
            }
            if (err.Code === 'AccessDenied') {
                err = new Error(ErrorConfig.MESSAGE.AUTH_TOKEN_NOT_VALID_FOR_SELLER_ID_AND_AWS_ACCOUNT_ID);
            }
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
    },

    buildWhereForItems: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var items = options.items;
            var string = '', values = [];
            var where = 'WHERE id IN (';
            var close = ') ';

            _.map(items, function (item) {
                string += 'uuid_to_bin(?),';
                values.push(item);
            });
            string = string.replace(/,\s*$/, ' ');
            string += close;
            return resolve({
                string: string,
                values: values
            });
        });
    },

    /*
  * Build query for multiple update Item
  * */
    buildUpdateItemQuery: async function (options, cb) {
        var items = options.updateItems;
        var string = 'update OrderLineItems set ';
        var end = 'END, ';
        var whereResponse = await OrderReferenceInformation.buildWhereForItems({items: items});
        var values = [];
        var close = ')';
        var finalResponse;

        try {
            _.each(items[0], function (value, key) {
                if (key === 'id' || key === 'accountId' || key === 'orderRefId' || key === 'createdBy') {
                    return;
                }
                string += key + ' = CASE id ';

                /*if (key === 'updatedAt') {
                  items.forEach(function (item) {
                      string += 'WHEN uuid_to_bin(?) THEN UTC_TIMESTAMP(3) ';
                      values.push(item['id']);
                  });
              }*/

                if (key === 'updatedBy') {
                    items.forEach(function (item) {
                        string += 'WHEN uuid_to_bin(?) THEN uuid_to_bin(?) ';
                        values.push(item['id'], item[key]);
                    });
                } else {
                    items.forEach(function (item) {
                        string += 'WHEN uuid_to_bin(?) THEN ? ';
                        values.push(item['id'], item[key]);
                    });
                }
                string += end;
            });
            string = string.replace(/,\s*$/, ' ');
            string += whereResponse.string;
            values.push(whereResponse.values);

            /*items.forEach(function (item) {
              string += 'uuid_to_bin(?), ';
              values.push(item['id']);
          });

          string = string.replace(/,\s*$/, '');
          string += close;*/
            finalResponse = {
                string: string,
                values: values
            };
            return cb(null, finalResponse);
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
    },

    /*
  * Update Items into OLI table
  * */
    updateItemsMD: function (options, cb) {
        var string = '', values = [];
        var itemOptions = {
            updateItems: options.allItems
        };
        var replicationId = options.replicationId;
        var amazonOrderId = options.amazonOrderId;
        var orderErrorLogOption, orderErrorLogResponse;
        OrderReferenceInformation.buildUpdateItemQuery(itemOptions, async function (err, response) {
            if (err) {
                debug('err', err);
            }

            string = response.string;
            values = response.values;

            try {
                var conn = await connection.getConnection();
                var isUpdated = await conn.query(string, values);
                isUpdated = Utils.isAffectedPool(isUpdated);
                debug(' ITEMS UPDATED-------------------', isUpdated);
                if (!isUpdated) {
                    throw err;
                }
                return cb(null, Constants.OK_MESSAGE);
            } catch (err) {
                debug('err ', err);
                err = new Error(ErrorConfig.MESSAGE.ORDER_ITEM_UPDATION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;

                // Store error Log
                orderErrorLogOption = {
                    replicationSettingId: replicationId,
                    orderId: amazonOrderId,
                    metaData: err,
                    failReasonCode: Constants.ORDER_ERROR_LOG_REASON_CODE.ORDER_LINE_ITEM_UPDATE_FAILED.CODE,
                    errorMessage: Constants.ORDER_ERROR_LOG_REASON_CODE.ORDER_LINE_ITEM_UPDATE_FAILED.MESSAGE,
                    createdAt: DataUtils.getEpochMSTimestamp()
                };
                orderErrorLogResponse = await OrderReferenceInformation.insertOrderErrorLogs({orderErrorLogs: [orderErrorLogOption]});
                debug('orderErrorLogResponse', orderErrorLogResponse);

                return cb(err);
            }
        });
    },

    /*
  * Create list for update items
  * */
    createUpdateItemList: function (options) {
        return new Promise(async function (resolve, reject) {
            var itemsArray = options.itemsArray;
            var accountId = options.accountId;
            var amazonOrderId = options.amazonOrderId;
            var orderRefId = options.orderRefId;
            var replicationLogId = options.replicationLogId;
            var replicationId = options.replicationId;
            var numberOfItems = 0;
            var allItems = [], affectedItemIds, c = 1;
            var updatedAt = DataUtils.getEpochMSTimestamp();

            await PromiseBluebird.each(itemsArray, async function (item) {
                var itemOption = {
                    accountId: accountId,
                    orderRefId: orderRefId,
                    amazonOrderId: amazonOrderId,
                    orderItemId: item.OrderItemId
                };
                await OrderReferenceInformation.getOrderItemMD(itemOption, async function (err, oldItem) {
                    if (err) {
                        debug('err', err);
                    } else if (oldItem) {
                        //debug('oldItem', oldItem);
                        var option = {
                            item: item
                        };
                        var commonObject = {
                            id: oldItem.id,
                            updatedBy: replicationLogId,
                            orderRefId: orderRefId,
                            accountId: accountId,
                            updatedAt: updatedAt
                        };
                        itemOption = await OrderReferenceInformation.createItemObjectMD(option);
                        itemOption = Object.assign(commonObject, itemOption);
                        allItems.push(itemOption);
                    }
                });
            });

            if (allItems.length <= 0) {
                return resolve({
                    numberOfItems: 0
                });
            }

            var itemOptions = {
                allItems: allItems,
                amazonOrderId: amazonOrderId,
                replicationId: replicationId
            };

            OrderReferenceInformation.updateItemsMD(itemOptions, function (err, response) {
                if (err) {
                    debug('err', err);
                    return reject(err);
                }
                numberOfItems = parseInt(allItems.length);

                var responseOfItems = {
                    numberOfItems: numberOfItems
                };
                allItems = [];
                return resolve(responseOfItems);
            });
        });
    },

    /*
  * Get order items from mws
  * */
    getItemsMD: async function (options, cb) {
        var createOrders = options.createOrders;
        var sellerId = options.sellerId;
        var authToken = options.authToken;
        var accountId = options.accountId;
        var userId = options.userId;
        var replicationLogId = options.replicationLogId;
        var replicationId = options.replicationId;
        var numberOfItems = 0, c = 1, d = 1, allItems = [];
        var orderErrorLogOption, orderErrorLogResponse;


        await PromiseBluebird.each(createOrders, async function (order) {
            var itemsArray = [], tempItems;

            var itemOption = {
                amazonOrderId: order.amazonOrderId,
                sellerId: sellerId,
                authToken: authToken
            };
            await OrderReferenceInformation.getItemMWS(itemOption, async function (err, itemResponse) {
                if (err) {
                    debug('err', err);

                    // Store error Log
                    orderErrorLogOption = {
                        replicationSettingId: replicationId,
                        orderId: '',
                        metaData: err,
                        failReasonCode: Constants.ORDER_ERROR_LOG_REASON_CODE.ORDER_ITEM_GET_FAILED.CODE,
                        errorMessage: Constants.ORDER_ERROR_LOG_REASON_CODE.ORDER_ITEM_GET_FAILED.MESSAGE,
                        createdAt: DataUtils.getEpochMSTimestamp()
                    };
                    orderErrorLogResponse = await OrderReferenceInformation.insertOrderErrorLogs({orderErrorLogs: [orderErrorLogOption]});
                    debug('orderErrorLogResponse', orderErrorLogResponse);

                    //return cb();
                }
                tempItems = itemResponse.items;
                if (!DataUtils.isArray(tempItems)) {
                    itemsArray.push(tempItems);
                } else {
                    itemsArray = tempItems;
                }
                if (itemsArray.length > 0) {
                    var itemOption = {
                        itemsArray: itemsArray,
                        accountId: accountId,
                        amazonOrderId: order.amazonOrderId,
                        orderRefId: order.id,
                        replicationLogId: replicationLogId,
                        replicationId: replicationId,
                        userId: userId
                    };

                    await OrderReferenceInformation.storeItemsMD(itemOption, async function (err, response) {
                        if (err || !response) {
                            debug('err', err);
                            //return cb();
                        } else {
                            numberOfItems += response.numberOfItems;
                            allItems = allItems.concat(response.allItems);
                        }
                    });
                }
            });
        });

        var arrayWithProductWiseOrder = [];
        // STORES orderRefId in product array
        if (allItems.length > 0) {
            var groupByItemArray = _.groupBy(allItems, 'productRefId');
            debug('groupByItemArray', groupByItemArray);
            _.map(groupByItemArray, function (value, key) {
                //debug('key', key);
                //debug('value', value);
                var object = {
                    productRefId: key,
                    orderRefIds: _.map(value, 'orderRefId')
                };
                arrayWithProductWiseOrder.push(object);
            });
            debug('arrayWithProductWiseOrder', arrayWithProductWiseOrder);
        }

        var response = {
            numberOfItems: parseInt(numberOfItems),
            allItems: arrayWithProductWiseOrder
            //amazonOrderIds: amazonOrderIds
        };
        return cb(null, response);
    },

    /*
  * Update replication settings
  * */
    getAndStoreUpdateItemsMD: async function (options, cb) {
        debug('Inside getItemsMD');
        var updateOrders = options.updateOrders;
        var sellerId = options.sellerId;
        var authToken = options.authToken;
        var accountId = options.accountId;
        var replicationLogId = options.replicationLogId;
        var replicationId = options.replicationId;
        var numberOfItems = 0, c = 1, d = 1, allItems = [];


        await PromiseBluebird.each(updateOrders, async function (order) {
            var itemsArray = [], tempItems;

            var itemOption = {
                amazonOrderId: order.amazonOrderId,
                sellerId: sellerId,
                authToken: authToken
            };
            await OrderReferenceInformation.getItemMWS(itemOption, async function (err, itemResponse) {
                if (err) {
                    debug('err', err);
                    //return cb();
                }
                tempItems = itemResponse.items;
                if (!DataUtils.isArray(tempItems)) {
                    itemsArray.push(tempItems);
                } else {
                    itemsArray = tempItems;
                }
                if (itemsArray.length > 0) {
                    var itemOption = {
                        itemsArray: itemsArray,
                        accountId: accountId,
                        amazonOrderId: order.amazonOrderId,
                        orderRefId: order.id,
                        replicationLogId: replicationLogId,
                        replicationId: replicationId
                    };
                    try {
                        var response = await OrderReferenceInformation.createUpdateItemList(itemOption);
                        if (!response) {
                            debug('err', err);
                            //return cb();
                        } else {
                            numberOfItems += parseInt(response.numberOfItems);
                        }
                    } catch (err) {
                        debug('err', err);
                    }

                }
            });
        });
        var response = {
            numberOfItems: numberOfItems
        };
        return cb(null, response);
    },

    /*
      * Store customer
      * */
    storeCustomerMD: async function (options, cb) {
        var createCustomers = options.createCustomers;
        var replicationId = options.replicationId;
        var orderErrorLogOption, orderErrorLogResponse;
        var convertedCustomerList, keys, err;
        await Utils.convertObjectToArrayMD(createCustomers, async function (err, response) {
            if (err) {
                debug('err', err);
                return cb(err);
            }
            convertedCustomerList = response.list;
            keys = response.keys;

            var query = 'insert into Customers (' + keys + ') values';

            var values = ' (uuid_to_bin(?), uuid_to_bin(?),uuid_to_bin(?),?,?,?,?,?,?,?,?,?,?,?,?,?) ';

            await PromiseBluebird.each(createCustomers, function (value) {
                query = query + values;
                query = query + ',';
            });

            query = query.replace(/,\s*$/, '');

            try {
                var conn = await connection.getConnection();
                var customerInserted = await conn.query(query, convertedCustomerList);
                customerInserted = Utils.isAffectedPool(customerInserted);

                debug('customerInserted ----------------------------------', customerInserted);
                if (!customerInserted) {
                    throw err;
                }
                return cb(null, Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_CREATION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;

                // Store error Log
                orderErrorLogOption = {
                    replicationSettingId: replicationId,
                    orderId: '',
                    metaData: err,
                    failReasonCode: Constants.ORDER_ERROR_LOG_REASON_CODE.CUSTOMER_STORE_FAILED.CODE,
                    errorMessage: Constants.ORDER_ERROR_LOG_REASON_CODE.CUSTOMER_STORE_FAILED.MESSAGE,
                    createdAt: DataUtils.getEpochMSTimestamp()
                };
                orderErrorLogResponse = await OrderReferenceInformation.insertOrderErrorLogs({orderErrorLogs: [orderErrorLogOption]});
                debug('orderErrorLogResponse', orderErrorLogResponse);

                return cb();
            }
        });
    },

    buildWhereForCustomers: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var customers = options.customers;
            var string = '', values = [];
            var where = 'WHERE id IN (';
            var close = ') ';

            _.map(customers, function (customer) {
                string += 'uuid_to_bin(?),';
                values.push(customer);
            });
            string = string.replace(/,\s*$/, ' ');
            string += close;
            return resolve({
                string: string,
                values: values
            });
        });
    },

    /*
      * Build query for multiple update Customer
      * */
    buildUpdateCustomerQuery: async function (options, cb) {
        var customers = options.updateCustomers;
        var string = 'update Customers set ';
        var end = 'END, ';
        var whereResponse = await OrderReferenceInformation.buildWhereForCustomers({customers: customers});
        var values = [];
        var close = ')';
        var finalResponse;

        try {
            _.each(customers[0], function (value, key) {
                if (key === 'id' || key === 'accountId') {
                    return;
                }
                string += key + ' = CASE id ';

                /*if (key === 'updatedAt') {
                  customers.forEach(function (item) {
                      string += 'WHEN uuid_to_bin(?) THEN UTC_TIMESTAMP(3) ';
                      values.push(item['id']);
                  });
              }*/
                if (key === 'updatedBy' || key === 'createdBy') {
                    customers.forEach(function (item) {
                        string += 'WHEN uuid_to_bin(?) THEN uuid_to_bin(?) ';
                        values.push(item['id'], item[key]);
                    });
                } else {
                    customers.forEach(function (item) {
                        string += 'WHEN uuid_to_bin(?) THEN ? ';
                        values.push(item['id'], item[key]);
                    });
                }
                string += end;
            });
            string = string.replace(/,\s*$/, ' ');

            string += whereResponse.string;
            values.push(whereResponse.values);

            /*customers.forEach(function (customer) {
              string += 'uuid_to_bin(?), ';
              values.push(customer['id']);
          });

          string = string.replace(/,\s*$/, '');
          string += close;*/
            finalResponse = {
                string: string,
                values: values
            };
            return cb(null, finalResponse);
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
    },

    /*
      * Update Customers
      * */
    updateCustomerMD: function (options, cb) {
        var string = '', values = [];
        var customerOptions = {
            updateCustomers: options.updateCustomers
        };
        var replicationId = options.replicationId;
        var orderErrorLogOption, orderErrorLogResponse;
        OrderReferenceInformation.buildUpdateCustomerQuery(customerOptions, async function (err, response) {
            if (err) {
                debug('err', err);
            }
            string = response.string;
            values = response.values;

            try {
                var conn = await connection.getConnection();
                var isUpdated = await conn.query(string, values);
                isUpdated = Utils.isAffectedPool(isUpdated);
                debug(' CUSTOMER UPDATED-------------------', isUpdated);
                if (!isUpdated) {
                    throw err;
                }
                return cb(null, Constants.OK_MESSAGE);
            } catch (err) {
                debug('err ', err);
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;

                // Store error Log
                orderErrorLogOption = {
                    replicationSettingId: replicationId,
                    orderId: '',
                    metaData: err,
                    failReasonCode: Constants.ORDER_ERROR_LOG_REASON_CODE.CUSTOMER_UPDATE_FAILED.CODE,
                    errorMessage: Constants.ORDER_ERROR_LOG_REASON_CODE.CUSTOMER_UPDATE_FAILED.MESSAGE,
                    createdAt: DataUtils.getEpochMSTimestamp()
                };
                orderErrorLogResponse = await OrderReferenceInformation.insertOrderErrorLogs({orderErrorLogs: [orderErrorLogOption]});
                debug('orderErrorLogResponse', orderErrorLogResponse);

                return cb(err);
            }
        });
    },

    importOrdersMD: async function (options, cb) {
        var allOrders = [];
        var orderDetails = [], customers = [];
        var userId, requestId;
        var platform = Constants.PLATFORMS.mws;
        var replicationRecord, numberOfOrders = 0, numberOfItems = 0;
        var sellerId, authToken;
        var account = options.account;
        var accountId = account.accountId;
        var mpId = account.mpId;
        var lastUpdatedAfter;
        var nextReplicationTime = parseInt(account.nextReplicationTime);
        var orderTimeInterval = account.orderTimeInterval;
        var updatedAt = account.updatedAt;
        var replicationId;
        var updateOrders, createOrders;
        var createCustomers, updateCustomers;
        var flag = false;
        var generatedId = Utils.generateId();
        var replicationLogUUID = generatedId.uuid;
        var holdFlag, orderErrorLogOption, orderErrorLogResponse;
        var allOrderLineItems = [], amazonOrderIds = [];

        replicationRecord = account;
        replicationId = replicationRecord.id;

        try {
            Async.series({

                getUser: function (cb1) {
                    debug('Inside getUser');

                    /*if (flag) {
                          return cb1();
                      }*/

                    var userOptions = {
                        accountId: accountId,
                        eventId: Constants.UPDATE_REPLICATION_SETTING_FOR_ORDER_IMPORT
                    };

                    OrderReferenceInformation.getAuditByAccountIdMD(userOptions, function (err, auditResponse) {
                        if (err || auditResponse.length <= 0) {
                            CommonApi.rollback();
                            debug('err', err);
                            flag = true;
                            return cb1();
                        }
                        _.forEach(auditResponse, function (value) {
                            value.createdAt = new Date(value.createdAt).getTime();
                        });

                        var createdAfterDates = _.map(auditResponse, 'createdAt');
                        var max = _.max(createdAfterDates);

                        _.forEach(auditResponse, function (value) {
                            if (value.createdAt === max) {
                                userId = value.userId;
                            }
                        });
                        return cb1();
                    });
                },

                updateReplicationSettingToProgressing: function (cb1) {
                    debug('Inside updateReplicationSettingToProgressing');

                    var updateOptions = {
                        status: Constants.REPLICATION_STATUS.PROGRESSING,
                        accountId: accountId,
                        userId: userId,
                        id: replicationId
                    };
                    OrderReferenceInformation.updateReplicationSettingsMD(updateOptions, function (err, response) {
                        if (err || !response) {
                            debug('err', err);
                            return cb1();
                        }
                        return cb1();
                    });
                },

                createReplicationLog: function (cb1) {
                    debug('Inside createReplicationLog');

                    var createOptions = {
                        id: replicationLogUUID,
                        replicationSettingId: replicationId,
                        startTime: DataUtils.getEpochMSTimestamp(),
                        status: Constants.REPLICATION_LOG_STATUS.PROGRESSING
                    };

                    OrderReferenceInformation.createReplicationLogMD(createOptions, async function (err, response) {
                        if (err || !response) {
                            debug('err', err);
                            flag = true;

                            // Store error Log
                            orderErrorLogOption = {
                                replicationSettingId: replicationId,
                                orderId: '',
                                metaData: err,
                                failReasonCode: Constants.ORDER_ERROR_LOG_REASON_CODE.CREATE_REPLICATION_LOG_FAIL.CODE,
                                errorMessage: Constants.ORDER_ERROR_LOG_REASON_CODE.CREATE_REPLICATION_LOG_FAIL.MESSAGE,
                                createdAt: DataUtils.getEpochMSTimestamp()
                            };
                            orderErrorLogResponse = await OrderReferenceInformation.insertOrderErrorLogs({orderErrorLogs: [orderErrorLogOption]});
                            debug('orderErrorLogResponse', orderErrorLogResponse);

                            return cb1();
                        }
                        return cb1();
                    });
                },

                getSellerToken: function (cb1) {
                    debug('Inside getSellerToken');
                    if (flag) {
                        return cb1();
                    }

                    var sellerOptions = {
                        accountId: accountId,
                        mpId: mpId
                    };
                    OrderReferenceInformation.getAccountMarketPlaceMD(sellerOptions, async function (err, accountMarketplace) {
                        if (err || !accountMarketplace) {
                            debug('err', err);
                            flag = true;

                            // Store error Log
                            orderErrorLogOption = {
                                replicationSettingId: replicationId,
                                orderId: '',
                                metaData: err,
                                failReasonCode: Constants.ORDER_ERROR_LOG_REASON_CODE.GET_SELLER_TOKEN_FAILED.CODE,
                                errorMessage: Constants.ORDER_ERROR_LOG_REASON_CODE.GET_SELLER_TOKEN_FAILED.MESSAGE,
                                createdAt: DataUtils.getEpochMSTimestamp()
                            };
                            orderErrorLogResponse = await OrderReferenceInformation.insertOrderErrorLogs({orderErrorLogs: [orderErrorLogOption]});
                            debug('orderErrorLogResponse', orderErrorLogResponse);

                            return cb1();
                        }
                        sellerId = accountMarketplace.sellerId;
                        authToken = accountMarketplace.token;
                        return cb1();
                    });
                },

                getOrderDetails: function (cb1) {
                    debug('Inside getOrderDetails');
                    lastUpdatedAfter = new Date(nextReplicationTime);
                    lastUpdatedAfter.setMinutes(lastUpdatedAfter.getMinutes() - parseInt(orderTimeInterval));

                    var orderOptions = {
                        sellerId: sellerId,
                        authToken: authToken,
                        mpId: mpId,
                        //lastUpdatedAfter: new Date(lastUpdatedAfter),
                        lastUpdatedAfter: 'Sat Oct 29 2015 10:59:35 GMT+0530 (IST)',//lastUpdatedAfter,//
                        numberOfRecords: replicationRecord.numberOfRecords || 50,
                        userId: userId,
                        accountId: accountId,
                        replicationId: replicationId
                    };
                    debug('orderOptions', orderOptions);

                    OrderReferenceInformation.getOrdersMWS(orderOptions, async function (err, response) {
                        if (err) {
                            debug('err', err);
                            holdFlag = err.hold;
                            flag = true;

                            // Store error Log
                            orderErrorLogOption = {
                                replicationSettingId: replicationId,
                                orderId: '',
                                metaData: err,
                                failReasonCode: Constants.ORDER_ERROR_LOG_REASON_CODE.ORDER_GET_FAILED.CODE,
                                errorMessage: Constants.ORDER_ERROR_LOG_REASON_CODE.ORDER_GET_FAILED.MESSAGE,
                                createdAt: DataUtils.getEpochMSTimestamp()
                            };
                            orderErrorLogResponse = await OrderReferenceInformation.insertOrderErrorLogs({orderErrorLogs: [orderErrorLogOption]});
                            debug('orderErrorLogResponse', orderErrorLogResponse);

                            return cb1();
                        }
                        lastUpdatedAfter = response.lastUpdatedAfter;
                        requestId = response.requestId;
                        orderDetails = response.orders;
                        //debug('orderDetails', orderDetails);
                        return cb1();
                    });
                },

                storeOrder: function (cb1) {
                    debug('Inside storeOrder');
                    if (flag) {
                        return cb1();
                    }

                    if (!orderDetails || !orderDetails.Orders || !orderDetails.Orders.Order) {
                        var err = new Error(ErrorConfig.MESSAGE.ORDERS_NOT_FOUND);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        debug('err %o', err);
                        flag = true;
                        return cb1();
                    }

                    orderDetails = orderDetails.Orders.Order;

                    if (!DataUtils.isArray(orderDetails)) {
                        var temp = orderDetails;
                        orderDetails = [];
                        orderDetails.push(temp);
                    }

                    if (orderDetails.length <= 0) {
                        return cb1();
                    }

                    var orderOptions = {
                        orderDetails: orderDetails,
                        replicationRecord: replicationRecord,
                        replicationId: replicationId,
                        replicationLogId: replicationLogUUID,
                        authToken: authToken,
                        merchantId: sellerId,
                        accountId: accountId,
                        userId: userId,
                        mpId: mpId,
                        platform: platform,
                        requestId: requestId
                    };

                    CommonApi.startTransaction();
                    //debug('orderOptions', orderOptions);
                    OrderReferenceInformation.storeOrderMD(orderOptions, function (err, response) {
                        if (err || !response) {
                            debug('err', err);
                            flag = true;
                            CommonApi.rollback();
                            return cb1();
                        }
                        numberOfOrders = response.numberOfOrders;
                        createOrders = response.createOrders;
                        updateOrders = response.updateOrders;
                        createCustomers = response.createCustomers;
                        updateCustomers = response.updateCustomers;

                        return cb1();
                    });
                },

                UpdateReplicationLogAfterORI: function (cb1) {
                    debug('Inside updateReplication');
                    if (flag) {
                        return cb1();
                    }

                    var updateOptions = {
                        replicationLogId: replicationLogUUID,
                        numberOfOrders: numberOfOrders || 0,
                        ORICompleteTime: DataUtils.getEpochMSTimestamp()
                    };

                    OrderReferenceInformation.updateReplicationLogMD(updateOptions, function (err, response) {
                        if (err || !response) {
                            debug('err', err);
                            CommonApi.rollback();
                            flag = true;
                            return cb1();
                        }
                        CommonApi.commit();
                        return cb1();
                    });
                },

                getAndStoreOrderItems: function (cb1) {
                    debug('Inside getOrderItems');
                    if (flag) {
                        return cb1();
                    }

                    if (createOrders.length <= 0) {
                        return cb1();
                    }

                    var importItemOption = {
                        createOrders: createOrders,
                        sellerId: sellerId,
                        authToken: authToken,
                        accountId: accountId,
                        replicationLogId: replicationLogUUID,
                        replicationId: replicationId,
                        userId: userId
                    };

                    OrderReferenceInformation.getItemsMD(importItemOption, function (err, response) {
                        if (err) {
                            debug('err', err);
                            flag = true;
                            return cb1();
                        }
                        numberOfItems += parseInt(response.numberOfItems);
                        allOrderLineItems = response.allItems;
                        return cb1();
                    });
                },

                updateOrderItems: function (cb1) {
                    if (flag) {
                        return cb1();
                    }

                    if (updateOrders.length <= 0) {
                        return cb1();
                    }
                    var importItemOption = {
                        updateOrders: updateOrders,
                        sellerId: sellerId,
                        authToken: authToken,
                        accountId: accountId,
                        replicationId: replicationId,
                        replicationLogId: replicationLogUUID
                    };

                    OrderReferenceInformation.getAndStoreUpdateItemsMD(importItemOption, function (err, response) {
                        if (err) {
                            debug('err', err);
                            flag = true;
                            return cb1();
                        }

                        numberOfItems += parseInt(response.numberOfItems);
                        return cb1();
                    });
                },

                UpdateReplicationLogAfterOLI: function (cb1) {
                    debug('Inside UpdateReplicationLogAfterOLI');
                    if (flag) {
                        return cb1();
                    }
                    var updateOptions = {
                        replicationLogId: replicationLogUUID,
                        numberOfItems: numberOfItems || 0,
                        OLICompleteTime: DataUtils.getEpochMSTimestamp()
                    };
                    OrderReferenceInformation.updateReplicationLogMD(updateOptions, function (err, response) {
                        if (err || !response) {
                            debug('err', err);
                            flag = true;
                            return cb1();
                        }
                        return cb1();
                    });
                },

                storeCustomer: function (cb1) {
                    debug('Inside storeCustomer');
                    if (flag) {
                        return cb1();
                    }

                    if (createCustomers.length <= 0) {
                        return cb1();
                    }

                    var customerOption = {
                        createCustomers: createCustomers,
                        accountId: accountId,
                        replicationLogId: replicationLogUUID,
                        replicationId: replicationId
                    };
                    debug('customerOption', customerOption);
                    OrderReferenceInformation.storeCustomerMD(customerOption, function (err, response) {
                        if (err) {
                            debug('err', err);
                            flag = true;
                            return cb1();
                        }
                        return cb1();
                    });
                },

                updateCustomer: function (cb1) {
                    debug('Inside updateCustomer');
                    if (flag) {
                        return cb1();
                    }

                    if (updateCustomers.length <= 0) {
                        return cb1();
                    }

                    var customerOption = {
                        updateCustomers: updateCustomers,
                        replicationId: replicationId
                    };
                    OrderReferenceInformation.updateCustomerMD(customerOption, function (err, response) {
                        if (err) {
                            debug('err', err);
                            flag = true;
                            return cb1();
                        }
                        return cb1();
                    });
                },

                updateReplicationSetting: function (cb1) {
                    debug('Inside updateReplicationSetting');

                    if (holdFlag) {
                        return cb1();
                    }

                    nextReplicationTime = new Date(parseInt(replicationRecord.nextReplicationTime));
                    nextReplicationTime.setMinutes(nextReplicationTime.getMinutes() + parseInt(orderTimeInterval));

                    var updateOptions = {
                        status: Constants.REPLICATION_STATUS.NEW,
                        nextReplicationTime: nextReplicationTime.getTime(),
                        accountId: accountId,
                        userId: userId,
                        id: replicationId
                    };
                    OrderReferenceInformation.updateReplicationSettingsMD(updateOptions, function (err, response) {
                        if (err || !response) {
                            debug('err', err);
                            return cb1();
                        }
                        return cb1();
                    });
                },

                UpdateReplicationLog: function (cb1) {
                    debug('Inside updateReplication');

                    var updateOptions = {
                        replicationLogId: replicationLogUUID,
                        endTime: DataUtils.getEpochMSTimestamp(),
                        status: Constants.REPLICATION_LOG_STATUS.FINISH
                    };

                    OrderReferenceInformation.updateReplicationLogMD(updateOptions, function (err, response) {
                        if (err || !response) {
                            debug('err', err);
                            return cb1();
                        }
                        numberOfOrders = 0;
                        numberOfItems = 0;
                        allOrders = [];
                        customers = [];
                        return cb1();
                    });
                }

            }, async function (err) {
                if (err) {
                    debug('err', err);
                    return cb();
                }
                CommonApi.commit();
                debug('SUCCESSFULLY COMPLETED.......................');
                flag = false;

                // CHECK FOR REAL_TIME SHARES FOR IMPORTED ORDER
                debug('allOrderLineItems.length', allOrderLineItems.length);
                if (allOrderLineItems.length > 0) {
                    var checkRealTimeShareOption = {
                        accountId: accountId,
                        allOrderLineItems: allOrderLineItems,
                        frequencyType: Constants.OUT_SHARE_FREQ_TYPE.REAL_TIME
                    };
                    debug('checkRealTimeShareOption', checkRealTimeShareOption);
                    var realTimeOutProductOrderShares = await OrderReferenceInformation.checkForRealTimeProductOrderShare(checkRealTimeShareOption);
                    var realTimeOutDependentDemandShares = await OrderReferenceInformation.checkForRealTimeDependentDemandShare(checkRealTimeShareOption);
                    var realTimeOutShares = [].concat(realTimeOutProductOrderShares).concat(realTimeOutDependentDemandShares);
                    //var realTimeOutShares = [].concat(realTimeOutDependentDemandShares);

                    if (realTimeOutShares && realTimeOutShares.length > 0) {
                        debug('realTimeOutShares after', realTimeOutShares);

                        var shareOptions = {
                            realTimeOutShares: realTimeOutShares
                        };
                        var apiResponse = OrderReferenceInformation.buildTask(shareOptions);
                        debug('API COMPLTETED', apiResponse);
                    }
                }
                return cb(null, Constants.OK_MESSAGE);
            });
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.IMPORT_ORDER_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    manipulateOrdersQuery: function (options) {
        return new Promise(function (resolve, reject) {
            var list = options.list;
            var string = '', values = [];

            _.map(list, function (value) {
                string += 'uuid_to_bin(?),';
                values.push(value);
            });
            string = string.replace(/,\s*$/, ' ');
            return resolve({
                string: string,
                values: values
            });
        });
    },

    checkForRealTimeProductOrderShare: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var accountId = options.accountId;
            var allOrderLineItems = options.allOrderLineItems;
            var frequencyType = options.frequencyType;
            var err;

            try {
                var conn = await connection.getConnection();
                debug('allOrderLineItems', allOrderLineItems);

                var response = await OrderReferenceInformation.manipulateOrdersQuery({list: _.map(allOrderLineItems, 'productRefId')});

                var realTimeOutShares = await conn.query('select CAST(uuid_from_bin(OS.id) as CHAR) as id,' +
                  ' CAST(uuid_from_bin(OSI.shareItemId) as CHAR) as shareItemId from OutShare OS,OutShareItems OSI,OutSharingProfile OSP ' +
                  ' where ' +
                  ' OS.accountId = uuid_to_bin(?) and OS.id = OSI.outShareInstanceId and OS.sharingProfileId = OSP.id AND ' +
                  ' OS.shareItemType=? and OSP.freqType = ? and OSI.shareItemId IN (' + response.string + ' ) and OS.status = 3  ',
                  [accountId, Constants.SHARING_TYPE.productOrder, frequencyType].concat(response.values));

                if (realTimeOutShares && realTimeOutShares.length > 0) {
                    _.map(realTimeOutShares, function (outshare) {
                        _.map(allOrderLineItems, function (item) {
                            if (outshare.shareItemId === item.productRefId) {
                                outshare.orderRefIds = item.orderRefIds;
                            }
                        });
                    });
                }
                return resolve(realTimeOutShares);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
    * GET BOM from multiple product Inventory
    * */
    getBillOfMaterialByProductRefId: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var productRefIds = options.productRefIds;
            var err;
            try {
                var conn = await connection.getConnection();
                var response = await OrderReferenceInformation.manipulateOrdersQuery({list: productRefIds});
                var billOfMaterials = await conn.query('SELECT CAST(uuid_from_bin(id) as CHAR) as bomId,CAST(uuid_from_bin(productRefId) as CHAR) as productRefId,' +
                  'CAST(uuid_from_bin(supplyItemId) as CHAR) as supplyItemId FROM BillOfMaterial WHERE productRefId IN ' +
                  ' (' + response.string + ') AND effectiveToDateTime = 0', [].concat(response.values));
                if (!billOfMaterials) {
                    billOfMaterials = [];
                }
                return resolve(billOfMaterials);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.BILL_OF_MATERIAL_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    checkForRealTimeDependentDemandShare: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var accountId = options.accountId;
            var allOrderLineItems = options.allOrderLineItems;
            var frequencyType = options.frequencyType;
            var productRefIds = _.map(allOrderLineItems, 'productRefId');
            var err;

            try {
                var conn = await connection.getConnection();

                // GET Bill Of Materials
                debug('productRefIds', productRefIds);
                var billOfMaterials = await OrderReferenceInformation.getBillOfMaterialByProductRefId({productRefIds: productRefIds});
                debug('billOfMaterials', billOfMaterials);
                if (billOfMaterials.length < 1) {
                    return resolve([]);
                }
                var supplyItemIds = _.uniq(_.map(billOfMaterials, 'supplyItemId'));
                debug('supplyItemIds', supplyItemIds);

                var response = await OrderReferenceInformation.manipulateOrdersQuery({list: supplyItemIds});

                var realTimeOutShares = await conn.query('select CAST(uuid_from_bin(OS.id) as CHAR) as id,' +
                  ' CAST(uuid_from_bin(OSI.shareItemId) as CHAR) as shareItemId,CAST(uuid_from_bin(SI.id) as CHAR) as supplyItemId ' +
                  ' from OutShare OS,OutShareItems OSI,OutSharingProfile OSP , SupplyItems SI ' +
                  ' WHERE ' +
                  ' OS.accountId = uuid_to_bin(?) AND OS.STATUS = ? AND SI.id IN (' + response.string + ') ' +
                  ' AND SI.STATUS = ? AND OSI.shareItemId = SI.id and OS.id = OSI.outShareInstanceId AND OS.sharingProfileId = OSP.id AND ' +
                  ' OS.shareItemType = ?  and OSP.freqType = ? ',
                  [accountId, Constants.OUT_SHARE_STATUS.ACTIVE].concat(response.values).concat(Constants.SUPPLY_ITEM_STATUS.ACTIVE,
                    Constants.SHARING_TYPE.dependentDemand, frequencyType));
                debug('realTimeOutShares', realTimeOutShares.length);

                // Get bill of materials for which we got the out shares
                debug('1');
                var billOfMaterialsWithShare = [];

                if (realTimeOutShares && realTimeOutShares.length > 0) {
                    _.map(realTimeOutShares, function (outshare) {
                        var dependentDemands = [];
                        _.map(billOfMaterials, function (billOfMaterial) {
                            if (outshare.supplyItemId === billOfMaterial.supplyItemId) {
                                _.map(allOrderLineItems, function (item) {
                                    if (billOfMaterial.productRefId === item.productRefId) {
                                        billOfMaterial.orderRefIds = item.orderRefIds;
                                        dependentDemands.push(billOfMaterial);
                                    }
                                });
                            }
                        });
                        outshare.dependentDemands = dependentDemands;
                    });
                }

                // combine duplicate outshare by concating dependentDemand
                var uniqueRealTimeOutShare = [];
                await PromiseBluebird.each(realTimeOutShares, async function (realTimeOutShare) {
                    var index = uniqueRealTimeOutShare.findIndex(outshare => outshare.id === realTimeOutShare.id);
                    if (index !== -1) {
                        uniqueRealTimeOutShare[index].dependentDemands = uniqueRealTimeOutShare[index].dependentDemands.concat(realTimeOutShare.dependentDemands);
                    } else {
                        uniqueRealTimeOutShare.push({
                            id: realTimeOutShare.id,
                            shareItemId: realTimeOutShare.shareItemId,
                            supplyItemId: realTimeOutShare.supplyItemId,
                            dependentDemands: realTimeOutShare.dependentDemands
                        });
                    }
                });
                return resolve(uniqueRealTimeOutShare);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    buildTask: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var promises = [];
            var realTimeOutShares = options.realTimeOutShares;
            var c = 0;
            _.each(realTimeOutShares, function (outShare) {
                debug('count====> ', c++);
                //var url = 'http://127.0.0.1:3000/api/out-share/shared-data/real-time';
                var url = 'https://test-be.scopehub.org/api/out-share/shared-data/real-time';
                var option = {
                    outShareInstanceId: outShare.id,
                    shareItemId: outShare.shareItemId,
                    orderRefIds: outShare.orderRefIds,
                    dependentDemands: outShare.dependentDemands,
                    apiToken: 'xlK6cQsQRkvKdhIYH9n15yuzIhaLuiug'
                };
                debug('option', option);
                var opt = {
                    url: url,
                    method: 'POST',
                    json: true,
                    form: option
                };
                promises.push(Request(opt, function (err, response, body) {
                    debug('err', err);
                    if (err || response.statusCode >= 400) {
                        err = err || new Error(ErrorConfig.MESSAGE.HTTP_REQUEST_FAILED);
                        err.status = err.status || ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                        //return cb2();
                    }
                }));
            });
            debug('promises.length', promises.length);
            PromiseBluebird.all(promises, {concurrency: realTimeOutShares.length}).then(async function (value) {
                debug('value ', value);
                resolve(true);
            });
        });
    },

    getReplicationHistoryMD: async function (options, auditOptions, errorOptions, cb) {
        var accountId = options.accountId;
        var mpId = options.mpId;
        var err;
        var allReplicationHistory = [];

        if (DataUtils.isUndefined(mpId)) {
            err = new Error(ErrorConfig.MESSAGE.MPID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
        try {
            var conn = await connection.getConnection();
            var replicationHistory = await conn.query('select CAST(uuid_from_bin(RL.id) as CHAR) as id,RL.startTime,RL.endTime,RL.numberOforders,RL.numberOfItems' +
              ' from ReplicationLog as RL , ReplicationSetting as RS  where RL.replicationSettingId = RS.id and RS.mpId=? ' +
              'and accountId=uuid_to_bin(?)', [mpId, accountId]);

            if (!replicationHistory || replicationHistory.length <= 0) {
                err = new Error(ErrorConfig.MESSAGE.REPLICATION_LOG_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            AuditUtils.create(auditOptions);
            return cb(null, replicationHistory);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.GET_REPLICATION_LOG_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    getOrdersMD: async function (options, auditOptions, errorOptions, cb) {

        var timestamp = options.timestamp;
        var accountId = options.accountId;
        var lastUpdateDate = new Date();
        var allOrders = [], err;

        /*if (DataUtils.isUndefined(timestamp)) {
            err = new Error(ErrorConfig.MESSAGE.ORDER_TIMESTAMP_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }*/

        try {
            lastUpdateDate.setTime(timestamp);
            var conn = await connection.getConnection();
            var orders = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id,CAST(uuid_from_bin(accountId) as CHAR) as accountId,mpId,latestShipDate,' +
              'orderType,purchaseDate,amazonOrderId, buyerEmail, isReplacementOrder, lastUpdateDate, numberOfItemsShipped, shipServiceLevel, ' +
              'orderStatus, salesChannel ,shippedByAmazonTFM, isBusinessOrder, latestDeliveryDate, numberOfItemsUnshipped, paymentMethodDetails,' +
              'buyerName, earliestDeliveryDate, orderTotalCurrencyCode,TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (orderTotalAmount / CAST(power(10,8) as INTEGER))))) as orderTotalAmount , ' +
              'isPremiumOrder, earliestShipDate, fulfillmentChannel, purchaseOrderNumber, paymentMethod, addressLine1, addressLine2, name, addressType,' +
              'postalCode, stateOrRegion, countryCode, isPrime, shipmentServiceLevelCategory, sellerOrderId, status, recordType, updatedAt ' +
              'from OrderReferenceInformation  where accountId=uuid_to_bin(?) order by updatedAt desc;', [accountId]);
            /*var orders = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id,CAST(uuid_from_bin(accountId) as CHAR) as accountId,mpId,latestShipDate,' +
              'orderType,purchaseDate,amazonOrderId, buyerEmail, isReplacementOrder, lastUpdateDate, numberOfItemsShipped, shipServiceLevel, ' +
              'orderStatus, salesChannel ,shippedByAmazonTFM, isBusinessOrder, latestDeliveryDate, numberOfItemsUnshipped, paymentMethodDetails,' +
              'buyerName, earliestDeliveryDate, orderTotalCurrencyCode,TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (orderTotalAmount / CAST(power(10,8) as INTEGER))))) as orderTotalAmount , ' +
              'isPremiumOrder, earliestShipDate, fulfillmentChannel, purchaseOrderNumber, paymentMethod, addressLine1, addressLine2, name, addressType,' +
              'postalCode, stateOrRegion, countryCode, isPrime, shipmentServiceLevelCategory, sellerOrderId, status, recordType, updatedAt ' +
              'from OrderReferenceInformation  where accountId=uuid_to_bin(?) and  lastUpdateDate < ? order by lastUpdateDate desc;', [accountId, lastUpdateDate]);*/
            if (!orders) {
                err = new Error(ErrorConfig.MESSAGE.ORDERS_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }

            AuditUtils.create(auditOptions);
            return cb(null, orders);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.GET_ORDER_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
        /*var p1 = function () {
          return new PromiseBluebird(function (resolve, reject) {
              for (let i = 0; i < 10; i++) {
                  console.log('Done True!');
                  c++;
                  debug('count in p1', c);
              }
              resolve(true);
          });
      };
      var p2 = function () {
          return new PromiseBluebird(function (resolve, reject) {
              for (let i = 0; i < 10; i++) {
                  console.log('Done True!');
                  c++;
                  debug('count in p2', c);
              }
              resolve(true);
          });
      };
      try {
          PromiseBluebird.all([p1(), p2()]).then(async function () {
              debug('2');
              return cb(null, Constants.OK_MESSAGE);
          });
      } catch (err) {
          debug('err', err);
          return cb(err);
      }*/
        /*try {
          response = await OrderReferenceInformation.getSpecificOrder();
          if (!response) {
              return cb();
          }

          nextToken = response.nextToken;
          orderDetails = response.orderDetails;

          debug('nextTOKEN BEFORE', nextToken);
          while (nextToken !== undefined) {
              debug('count in loop', c++);
              var response = await OrderReferenceInformation.getOrdersByToken(nextToken);
              if (!response) {
                  debug('INSIDE NOT RESPONSE');
                  return;
              }
              debug('111');
              orderDetails = orderDetails.concat(response.orderDetails);
              nextToken = response.nextToken;
          }
          debug('AFTER LOOP');
          debug('COMPLETE================',);

          debug('COMPLETE================',);
          cb(null,{ORders: orderDetails});

      } catch (err) {
          debug('err', err);
          return cb(err);
      }*/

        /* PromiseBluebird.mapSeries([
           function () {
               return new Promise(function (resolve, reject) {
                   c++;
                   debug('First');
                   resolve('1');
               });
           }, function () {
               return new Promise(function (resolve, reject) {
                   c++;
                   debug('second', c);
                   c = OrderReferenceInformation.c(c);
                   debug('second', c);
                   resolve('2');
               });
           }, function () {
               return new Promise(function (resolve, reject) {
                   c++;
                   debug('Third');
                   resolve('3');
               });
           }, function () {
               return new Promise(function (resolve, reject) {
                   c++;
                   debug('Fourth');
                   resolve('2');
               });
           },
       ], function (response) {
           return response();
       }).then(function (data) {
           debug('data', data);
           debug('Total count', c);
           return cb(null, Constants.OK_MESSAGE);
       }).catch(function (err) {
           debug('err', err);
       });*/
    },

    searchOrders: async function (options, errorOptions, cb) {
        var accountId = options.accountId;
        var sku = options.sku;
        var amazonOrderId = options.amazonOrderId;
        var mpId = options.mpId;
        var buyerName = options.buyerName;
        var buyerEmail = options.buyerEmail;
        var checkString = '', queryString = '';
        var checkValues = [];
        var orders;
        var err;

        if (DataUtils.isUndefined(sku) && DataUtils.isUndefined(amazonOrderId) && DataUtils.isUndefined(mpId) &&
          DataUtils.isUndefined(buyerName) && DataUtils.isUndefined(buyerEmail)) {
            err = new Error(ErrorConfig.MESSAGE.AT_LEASE_ONE_SEARCH_ATTRIBUTE_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            if (DataUtils.isDefined(sku)) {
                var value = '%' + sku + '%';

                queryString = 'IF (select count(1) from OrderReferenceInformation  ORI,OrderLineItems OLI,ProductReferences PR where ' +
                  ' ORI.accountId = uuid_to_bin(?) and OLI.accountId = ORI.accountId AND PR.accountId = ORI.accountId AND ' +
                  ' PR.sku LIKE ? AND OLI.productRefId = PR.id AND ORI.id = OLI.orderRefId ) > ? THEN ' +
                  ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "ROW_COUNT_EXCEED_PLEASE_USE_SEARCH_AND_FILTER", MYSQL_ERRNO = 4001; ' +
                  ' ELSE select CAST(uuid_from_bin(ORI.id) as CHAR) as id,CAST(uuid_from_bin(ORI.accountId) as CHAR) as accountId,ORI.mpId, ' +
                  ' ORI.orderType,ORI.purchaseDate,ORI.amazonOrderId, ORI.buyerEmail,PR.sku, ORI.isReplacementOrder, ORI.lastUpdateDate, ' +
                  ' ORI.numberOfItemsShipped, ORI.shipServiceLevel, ORI.orderStatus, ORI.salesChannel ,ORI.shippedByAmazonTFM, ' +
                  ' ORI.isBusinessOrder, ORI.latestDeliveryDate, ORI.numberOfItemsUnshipped, ORI.paymentMethodDetails,ORI.buyerName, ' +
                  ' ORI.earliestDeliveryDate, ORI.orderTotalCurrencyCode,TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (ORI.orderTotalAmount / CAST(power(10,8) as INTEGER))))) as orderTotalAmount , ' +
                  ' ORI.isPremiumOrder, ORI.earliestShipDate, ORI.fulfillmentChannel, ORI.purchaseOrderNumber, ORI.paymentMethod, ORI.addressLine1, ORI.addressLine2, ORI.name, ORI.addressType,' +
                  ' ORI.postalCode, ORI.stateOrRegion, ORI.countryCode, ORI.isPrime, ORI.shipmentServiceLevelCategory, ORI.sellerOrderId, ORI.status, ORI.recordType, ORI.updatedAt ' +
                  ' from OrderReferenceInformation  ORI,OrderLineItems OLI,ProductReferences PR where ORI.accountId=uuid_to_bin(?) ' +
                  ' AND OLI.accountId = ORI.accountId AND PR.accountId = ORI.accountId AND ' +
                  ' PR.sku LIKE ? AND OLI.productRefId = PR.id AND ORI.id = OLI.orderRefId ' +
                  ' order by ORI.updatedAt desc ; END IF;';

                orders = await conn.query(queryString, [accountId, value, Constants.ROW_LIMIT, accountId, value]);
                orders = Utils.filteredResponsePool(orders);

                return cb(null, orders);
            }
            if (DataUtils.isDefined(amazonOrderId)) {
                checkString += ' amazonOrderId like ?  and ';
                checkValues.push('%' + amazonOrderId + '%');
            }
            if (DataUtils.isDefined(mpId)) {
                checkString += ' mpId like ? and ';
                checkValues.push('%' + mpId + '%');
            }
            if (DataUtils.isDefined(buyerName)) {
                checkString += ' buyerName like ? and ';
                checkValues.push('%' + buyerName + '%');
            }
            if (DataUtils.isDefined(buyerEmail)) {
                checkString += ' buyerEmail like ? and ';
                checkValues.push('%' + buyerEmail + '%');
            }
            checkString = checkString.replace(/and\s*$/, '');
            debug('checkString', checkString);
            debug('checkValues', checkValues);

            /*var orders = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id,CAST(uuid_from_bin(accountId) as CHAR) as accountId,mpId,latestShipDate,' +
              'orderType,purchaseDate,amazonOrderId, buyerEmail, isReplacementOrder, lastUpdateDate, numberOfItemsShipped, shipServiceLevel, ' +
              'orderStatus, salesChannel ,shippedByAmazonTFM, isBusinessOrder, latestDeliveryDate, numberOfItemsUnshipped, paymentMethodDetails,' +
              'buyerName, earliestDeliveryDate, orderTotalCurrencyCode,TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (orderTotalAmount / CAST(power(10,8) as INTEGER))))) as orderTotalAmount , ' +
              'isPremiumOrder, earliestShipDate, fulfillmentChannel, purchaseOrderNumber, paymentMethod, addressLine1, addressLine2, name, addressType,' +
              'postalCode, stateOrRegion, countryCode, isPrime, shipmentServiceLevelCategory, sellerOrderId, status, recordType, updatedAt ' +
              'from OrderReferenceInformation  where accountId=uuid_to_bin(?)  order by lastUpdateDate desc;', [accountId]);*/

            queryString = 'IF (select count(id) from OrderReferenceInformation where accountId = uuid_to_bin(?) and ' + checkString + ') > ? THEN ' +
              ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "ROW_COUNT_EXCEED_PLEASE_USE_SEARCH_AND_FILTER", MYSQL_ERRNO = 4001; ' +
              ' ELSE select CAST(uuid_from_bin(id) as CHAR) as id,CAST(uuid_from_bin(accountId) as CHAR) as accountId,mpId,latestShipDate,' +
              ' orderType,purchaseDate,amazonOrderId, buyerEmail, isReplacementOrder, lastUpdateDate, numberOfItemsShipped, shipServiceLevel, ' +
              ' orderStatus, salesChannel ,shippedByAmazonTFM, isBusinessOrder, latestDeliveryDate, numberOfItemsUnshipped, paymentMethodDetails,' +
              ' buyerName, earliestDeliveryDate, orderTotalCurrencyCode,TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (orderTotalAmount / CAST(power(10,8) as INTEGER))))) as orderTotalAmount , ' +
              ' isPremiumOrder, earliestShipDate, fulfillmentChannel, purchaseOrderNumber, paymentMethod, addressLine1, addressLine2, name, addressType,' +
              ' postalCode, stateOrRegion, countryCode, isPrime, shipmentServiceLevelCategory, sellerOrderId, status, recordType, updatedAt ' +
              ' from OrderReferenceInformation  where accountId=uuid_to_bin(?) ' +
              ' AND ' + checkString + ' order by updatedAt desc ; END IF;';

            orders = await conn.query(queryString, [accountId].concat(checkValues, [Constants.ROW_LIMIT], accountId, checkValues));
            debug('orders', orders);
            orders = Utils.filteredResponsePool(orders);

            return cb(null, orders);
        } catch (err) {
            debug('err', err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.ROW_COUNT_EXCEED_PLEASE_USE_SEARCH_AND_FILTER);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else {
                err = new Error(ErrorConfig.MESSAGE.ORDER_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    generateRandomNumber: function (str) {
        if (str) {
            return str + Math.floor(Math.random() * Math.floor(999999));
        } else {
            const chars = Constants.CHARACTER_SET;
            let randomstring = '';
            for (let i = 0; i < 10; i++) {
                const rnum = Math.floor(Math.random() * chars.length);
                randomstring += chars.substring(rnum, rnum + 1);
            }
            return randomstring + Math.floor(Math.random() * Math.floor(999999));
        }
    },

    generateCustomerId: function (name) {
        var result;
        if (name !== undefined && name.length > 0) {
            name = name.replace(/\s/g, '');
            if (name.length > 4) {
                name = name.slice(0, 4);
            }
            debug('length', name.length);
            result = OrderReferenceInformation.generateRandomNumber(name);
        } else {
            result = OrderReferenceInformation.generateRandomNumber();
        }
        return result;
    },

    getOrderByIdMD: async function (options, auditOptions, errorOptions, cb) {
        var id = options.id;
        var order, err;

        if (DataUtils.isUndefined(id)) {
            err = new Error(ErrorConfig.MESSAGE.ORDER_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
        try {
            //TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (longitude / CAST(power(10,16) as INTEGER))))) as longitude
            var conn = await connection.getConnection();
            order = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id,CAST(uuid_from_bin(accountId) as CHAR) as accountId,mpId,latestShipDate, ' +
              'orderType,purchaseDate,amazonOrderId, buyerEmail, isReplacementOrder, lastUpdateDate, numberOfItemsShipped, shipServiceLevel, ' +
              'orderStatus, salesChannel ,shippedByAmazonTFM, isBusinessOrder, latestDeliveryDate, numberOfItemsUnshipped, paymentMethodDetails,' +
              'buyerName, earliestDeliveryDate, orderTotalCurrencyCode,TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (orderTotalAmount / CAST(power(10,8) as INTEGER))))) as orderTotalAmount ,' +
              'isPremiumOrder, earliestShipDate, fulfillmentChannel, purchaseOrderNumber, paymentMethod, addressLine1, addressLine2, name, addressType,' +
              'postalCode, stateOrRegion, countryCode, isPrime, shipmentServiceLevelCategory, sellerOrderId, status, recordType, updatedAt ' +
              'from OrderReferenceInformation  where id=uuid_to_bin(?)', [id]);
            debug('order', order);
            order = Utils.filteredResponsePool(order);
            if (!order) {
                err = new Error(ErrorConfig.MESSAGE.ORDER_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            AuditUtils.create(auditOptions);
            return cb(null, order);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.GET_ORDER_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }

    },

    getItemByIdMD: async function (options, auditOptions, errorOptions, cb) {

        var id = options.id;
        var err;

        if (DataUtils.isUndefined(id)) {
            err = new Error(ErrorConfig.MESSAGE.ORDER_ITEM_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
        try {
            //TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (orderTotalAmount / CAST(power(10,8) as INTEGER))))) as orderTotalAmount
            var conn = await connection.getConnection();
            var item = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id,CAST(uuid_from_bin(accountId) as CHAR) as accountId,' +
              ' CAST(uuid_from_bin(orderRefId) as CHAR) as orderRefId,' +
              'amazonOrderId, orderItemId, UOMScalId, quantityOrdered, title, shippingTaxCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (shippingTaxAmount / CAST(power(10,8) as INTEGER))))) as shippingTaxAmount, promotionDiscountCurrencyCode, ' +
              'TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (promotionDiscountAmount / CAST(power(10,8) as INTEGER))))) as promotionDiscountAmount, ' +
              'conditionId, mpProductId, sellerSKU, numberOfItems, giftWrapTaxCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (giftWrapTaxAmount / CAST(power(10,8) as INTEGER))))) as giftWrapTaxAmount, ' +
              'quantityShipped, shippingPriceCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (shippingPriceAmount / CAST(power(10,8) as INTEGER))))) as shippingPriceAmount, ' +
              'giftWrapPriceCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (giftWrapPriceAmount / CAST(power(10,8) as INTEGER))))) as giftWrapPriceAmount , ' +
              'conditionSubtypeId, itemPriceCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (itemPriceAmount / CAST(power(10,8) as INTEGER))))) as itemPriceAmount , ' +
              'itemTaxCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (itemTaxAmount / CAST(power(10,8) as INTEGER))))) as itemTaxAmount, ' +
              'shippingDiscountCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (shippingDiscountAmount / CAST(power(10,8) as INTEGER))))) as shippingDiscountAmount, ' +
              'giftMessageText, isGift, priceDestination, conditionNote, recordType, CAST(uuid_from_bin(orderType) as CHAR) as orderType, scheduledDeliveryStartDate, scheduledDeliveryEndDate, ' +
              'CODFeeCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (CODFeeAmount / CAST(power(10,8) as INTEGER))))) as CODFeeAmount, ' +
              'CODFeeDiscountCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (CODFeeDiscountAmount / CAST(power(10,8) as INTEGER))))) as CODFeeDiscountAmount, updatedAt from OrderLineItems ' +
              'where id=uuid_to_bin(?);', [id]);
            item = Utils.filteredResponsePool(item);
            if (!item) {
                err = new Error(ErrorConfig.MESSAGE.ORDER_ITEM_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            AuditUtils.create(auditOptions);
            return cb(null, item);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.GET_ITEM_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    validateUploadLogFieldsMD: function (options, cb) {
        var uploadLogFields = '';
        var uploadLogOptionalValues = [];

        try {
            if (!DataUtils.isValidateOptionalField(options.fileName)) {
                uploadLogFields += 'fileName=? ,';
                uploadLogOptionalValues.push(options.fileName);
            }
            if (!DataUtils.isValidateOptionalField(options.fileSize)) {
                uploadLogFields += 'fileSize=? ,';
                uploadLogOptionalValues.push(options.fileSize);
            }
            if (!DataUtils.isValidateOptionalField(options.startTime)) {
                uploadLogFields += 'startTime=? ,';
                uploadLogOptionalValues.push(options.startTime);
            }
            if (!DataUtils.isValidateOptionalField(options.endTime)) {
                uploadLogFields += 'endTime=? ,';
                uploadLogOptionalValues.push(options.endTime);
            }
            if (!DataUtils.isValidateOptionalField(options.type)) {
                uploadLogFields += 'type=? ,';
                uploadLogOptionalValues.push(options.type);
            }
            if (!DataUtils.isValidateOptionalField(options.status)) {
                uploadLogFields += 'status=? ,';
                uploadLogOptionalValues.push(options.status);
            }
            if (!DataUtils.isValidateOptionalField(options.stepCompleted)) {
                uploadLogFields += 'stepCompleted=? ,';
                uploadLogOptionalValues.push(options.stepCompleted);
            }
            if (!DataUtils.isValidateOptionalField(options.ipAddress)) {
                uploadLogFields += 'ipAddress=? ,';
                uploadLogOptionalValues.push(options.ipAddress);
            }
            if (!DataUtils.isValidateOptionalField(options.statusReasonCode)) {
                uploadLogFields += 'statusReasonCode=? ,';
                uploadLogOptionalValues.push(options.statusReasonCode);
            }
            var response = {
                uploadLogFields: uploadLogFields,
                uploadLogOptionalValues: uploadLogOptionalValues
            };
            return cb(null, response);
        } catch (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
    },

    updateUploadLogMD: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var userId = options.userId;
            var accountId = options.accountId;
            var fileName = options.fileName;
            var uploadLogFields;
            var uploadLogOptionalValues = [];
            var uploadLogRequiredValues = [];
            var updatedAt = DataUtils.getEpochMSTimestamp();


            uploadLogRequiredValues.push(accountId, fileName);
            OrderReferenceInformation.validateUploadLogFieldsMD(options, async function (err, response) {
                if (err) {
                    return reject(err);
                }
                uploadLogFields = response.uploadLogFields;
                uploadLogOptionalValues = response.uploadLogOptionalValues;

                uploadLogRequiredValues = _.concat(uploadLogRequiredValues, uploadLogOptionalValues);
                uploadLogRequiredValues.push(updatedAt, userId, accountId, fileName);

                try {
                    var conn = await connection.getConnection();
                    var uploadLodStore = await conn.query('IF (select 1 from UploadLog where accountId=uuid_to_bin(?) and fileName=?) is null then ' +
                      'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "UPLOAD_LOG_NOT_FOUND", MYSQL_ERRNO = 4001;' +
                      'ELSE update UploadLog set ' + uploadLogFields + ' updatedAt = ?,updatedBy=uuid_to_bin(?) ' +
                      'where accountId=uuid_to_bin(?) and fileName=?;end if;', uploadLogRequiredValues);
                    uploadLodStore = Utils.isAffectedPool(uploadLodStore);
                    if (!uploadLodStore) {
                        throw err;
                    }
                    debug('UPDATE UPLOAD LOG SUCCESS=============');
                    return resolve(Constants.OK_MESSAGE);
                } catch (err) {
                    debug('err 1234', err);
                    if (err.errno === 4001) {
                        err = new Error(ErrorConfig.MESSAGE.UPLOAD_LOG_NOT_FOUND);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        return reject(err);
                    } else {
                        err = new Error(ErrorConfig.MESSAGE.UPLOAD_LOG_UPDATE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                        return reject(err);
                    }
                }
            });
        });
    },

    /*
      * Initialize multipart upload
      * */
    initializeMultipart: function (options) {
        return new Promise(async function (resolve, reject) {
            var bucket = options.bucket;
            var key = options.key;

            var createMultipartOption = {
                Bucket: bucket,
                Key: key
            };
            s3.createMultipartUpload(createMultipartOption, function (err, response) {
                if (err) {
                    debug('err', err);
                    err = new Error(ErrorConfig.MESSAGE.INITIALIZE_MULTIPART_UPLOAD_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return resolve(err);
                }
                return resolve(response);
            });
        });
    },

    /*
      * Complete Multipart upload
      * */
    completeMultipartUpload: function (options) {
        return new Promise(function (resolve, reject) {
            var bucket = options.bucket;
            var key = options.key;
            var uploadId = options.uploadId;
            var parts = options.parts;
            debug('options', options);

            try {

                var params = {
                    Bucket: bucket,
                    Key: key,
                    UploadId: uploadId,
                    MultipartUpload: {
                        Parts: parts
                    }
                };
                s3.completeMultipartUpload(params, function (err, data) {
                    if (err) {
                        debug('err', err);
                        return reject(err);
                    }
                    debug('data', data);           // successful response
                    return resolve(Constants.OK_MESSAGE);
                });
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
      * Abort Multipart upload
      * */
    abortMultipartUpload: function (options) {
        return new Promise(function (resolve, reject) {
            var bucket = options.bucket;
            var key = options.key;
            var uploadId = options.uploadId;
            debug('options', options);

            try {
                var params = {
                    Bucket: bucket,
                    Key: key,
                    UploadId: uploadId
                };
                s3.abortMultipartUpload(params, function (err, data) {
                    if (err) {
                        debug('err', err);
                        return reject(err);
                    }
                    debug('data', data);           // successful response
                    return resolve(Constants.OK_MESSAGE);
                });
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
      * list Multipart upload
      * */
    listMultipartUpload: function (options) {
        return new Promise(function (resolve, reject) {
            var bucket = options.bucket;
            debug('options', options);

            try {
                var params = {
                    Bucket: bucket
                };
                s3.listMultipartUploads(params, function (err, data) {
                    if (err) {
                        debug('err', err);
                        return reject(err);
                    }
                    debug('data', data);           // successful response
                    debug('data', data.Uploads.length);           // successful response
                    return resolve(Constants.OK_MESSAGE);
                });
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
      * list Multipart upload
      * */
    listparts: function (options) {
        return new Promise(function (resolve, reject) {
            var bucket = options.bucket;
            var key = options.key;
            var uploadId = options.uploadId;
            debug('options', options);

            try {
                var params = {
                    Bucket: bucket,
                    Key: key,
                    UploadId: uploadId
                };
                s3.listParts(params, function (err, data) {
                    if (err) {
                        debug('err', err);
                        err = new Error(ErrorConfig.MESSAGE.INVALID_UPLOAD_ID);
                        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                        return reject(err);
                    }
                    debug('data', data);           // successful response
                    return resolve(data);
                });
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },


    /*
      * copy file from s3 to EFS
      * */
    copyFile: function (options) {
        return new Promise(function (resolve, reject) {
            var bucket = options.bucket;
            var fileName = options.fileName;
            var destination = options.destination;// With directory

            try {
                var params = {
                    CopySource: bucket + '/' + fileName,
                    Bucket: '/mnt/db_csv',
                    Key: fileName
                };
                debug('params', params);
                s3.copyObject(params, function (err, data) {
                    if (err) {
                        debug('err', err);
                        err = new Error(ErrorConfig.MESSAGE.COPY_FILE_FROM_S3_TO_EFS_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                        return reject(err);
                    }
                    debug('data', data);           // successful response
                    return resolve(data);
                });
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    updateUploadLogSteps: async function (options, errorOptions, cb) {
        var uploadLog = options.uploadLog;
        var userId = uploadLog.userId;
        var accountId = uploadLog.accountId;
        var fileName = uploadLog.fileName;
        var status = uploadLog.status;
        var stepsCompleted = uploadLog.stepsCompleted;


        try {
            var uploadLogOptions = {
                userId: userId,
                accountId: accountId,
                fileName: fileName,
                status: status,
                stepCompleted: stepsCompleted
            };
            var updateResponse = await OrderReferenceInformation.updateUploadLogMD(uploadLogOptions);
            debug('updateResponse', updateResponse);

            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
    },

    checkFile: async function (options) {
        return new Promise(function (resolve, reject) {
            var err;
            var firstLine = JSON.parse(options.firstLine);
            var EOF = options.EOFDelimiter;
            //var lastLine = options.lastLine;
            var totalLine = JSON.parse(options.totalLine);
            totalLine = totalLine._1;

            var firstLinearray = firstLine;
            var SOF = firstLinearray._1;//Utils.trimFileDelimeter(firstLinearray[0]);
            var versionType = firstLinearray._2;//Utils.trimFileDelimeter(firstLinearray[0]);
            var numberOfRecords = firstLinearray._3;
            var encodingType = firstLinearray._4;
            var compressionType = firstLinearray._5;
            var languageCultureCode = firstLinearray._6;
            var lineDelimiter = firstLinearray._7;
            var quoteDelimiter = firstLinearray._8;
            var columnDelimiter = firstLinearray._9;
            var fileTimestamp = firstLinearray._10;

            if (DataUtils.isUndefined(SOF)) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_FILE_FORMAT_START_DELIMITER_REQUIRED);
            } else if (DataUtils.isUndefined(versionType)) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_FILE_FORMAT_VERSION_REQUIRED);
            } else if (DataUtils.isUndefined(numberOfRecords)) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_FILE_FORMAT_NUMBER_OF_RECORD_REQUIRED);
            } else if (DataUtils.isUndefined(columnDelimiter)) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_FILE_FORMAT_COLUMN_DELIMITER_REQUIRED);
            } else if (DataUtils.isUndefined(languageCultureCode)) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_FILE_FORMAT_LANGUAGE_CULTURE_CODE_REQUIRED);
            } else if (DataUtils.isUndefined(encodingType)) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_FILE_FORMAT_ENCODING_TYPE_REQUIRED);
            } else if (DataUtils.isUndefined(compressionType)) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_FILE_FORMAT_COMPRESSION_TYPE_REQUIRED);
            } else if (DataUtils.isUndefined(lineDelimiter)) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_FILE_FORMAT_LINE_DELIMITER_REQUIRED);
            } else if (DataUtils.isUndefined(quoteDelimiter)) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_FILE_FORMAT_QUOTE_DELIMITER_REQUIRED);
            } else if (DataUtils.isUndefined(fileTimestamp)) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_FILE_FORMAT_FILE_TIMESTAMP_REQUIRED);
            } else if (DataUtils.isUndefined(EOF)) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_FILE_FORMAT_END_DELIMITER_REQUIRED);
            } else if (SOF !== Constants.FILE_DELIMETER.SOF) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_START_OF_FILE_DELIMITER);
            } else if (Constants.FILE_DELIMETER.VERSION.indexOf(versionType) === -1) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_VERSION);
            } else if (EOF !== Constants.FILE_DELIMETER.EOF) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_END_OF_FILE_DELIMITER);
            } else if (parseInt(numberOfRecords) !== parseInt(totalLine) - 2) {
                err = new Error(ErrorConfig.MESSAGE.RECORD_NUMBER_ARE_MISMATCH);
            } else if (Constants.FILE_DELIMETER.LANGUAGE_CULTURE_CODE.indexOf(languageCultureCode) === -1) {
                err = new Error(ErrorConfig.MESSAGE.LANGUAGE_CULTURE_CODE_INVALID);
            } else if (!DataUtils.isValidNumber(fileTimestamp) || fileTimestamp.toString().length > 13) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_FILE_TIMESTAMP);
            } else if (Constants.FILE_DELIMETER.ENCODING_TYPE.indexOf(encodingType) === -1) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_ENCODING_TYPE);
            } else if (Constants.FILE_DELIMETER.COMPREESION_TYPE.indexOf(compressionType) === -1) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_COMPRESSION_TYPE);
            } else if (Constants.FILE_DELIMETER.LINE_DELIMTER.indexOf(lineDelimiter) === -1) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_LINE_DELIMITER);
            } else if (Constants.FILE_DELIMETER.COLUMN_DELIMITER.indexOf(columnDelimiter) === -1) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_COLUMN_DELIMITER);
            } else if (Constants.FILE_DELIMETER.QUOTE_DELIMITER.indexOf(quoteDelimiter) === -1) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_QUOTE_DELIMITER);
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                err.uploadStatus = Constants.UPLOAD_STATUS.VALIDATE_FAIL;
                err.statusReasonCode = Constants.UPLOAD_STATUS_REASON_CODES.INVALID_FILE_FORMAT.CODE;
                debug('err', err);
                return reject(err);
            }

            var versionValue;
            _.forEach(Constants.VERSION, function (version, key) {
                if (version.type === versionType) {
                    versionValue = version.value;
                    return;
                }
            });

            return resolve({
                OK: Constants.SUCCESS,
                version: versionValue || 1,
                languageCultureCode: languageCultureCode
            });
        });
    },

    getCsvDataMD: function (options) {
        return new Promise(function (resolve, reject) {
              var fileName = options.fileName;
              var bucket = options.bucket;
              var query = options.query;
              var fileHeader = options.fileHeader;
              var type = options.type;
              var response;
              var params;

              debug('1');
              if (type === 'CSV') {
                  debug('2');
                  params = {
                      Bucket: bucket,
                      Key: fileName,
                      ExpressionType: 'SQL',
                      Expression: query,
                      InputSerialization: {
                          CSV: {
                              FileHeaderInfo: fileHeader,
                              RecordDelimiter: '\n',
                              FieldDelimiter: ','
                          },
                          CompressionType: 'GZIP'
                      },
                      OutputSerialization: {
                          CSV: {}
                      }
                  };
              } else {
                  debug('3');
                  params = {
                      Bucket: bucket,
                      Key: fileName,
                      ExpressionType: 'SQL',
                      Expression: query,
                      InputSerialization: {
                          CSV: {
                              FileHeaderInfo: fileHeader,
                              RecordDelimiter: '\n',
                              FieldDelimiter: ','
                          },
                          CompressionType: 'GZIP'
                      },
                      OutputSerialization: {
                          JSON: {}
                      }
                  };
              }

              s3.selectObjectContent(params, function (err, data) {
                  if (err) {
                      debug('err', err);
                      if (err.code === 'NoSuchKey') {
                          err = new Error(ErrorConfig.MESSAGE.FILE_NOT_FOUND);
                          err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                          err.notFound = true;
                          err.uploadStatus = Constants.UPLOAD_STATUS.UPLOAD_FAILED;
                          err.statusReasonCode = Constants.UPLOAD_STATUS_REASON_CODES.FILE_NOT_FOUND.CODE;
                      }
                      if (err.code === 'MissingHeaders') {
                          err = new Error(ErrorConfig.MESSAGE.INVALID_FILE);
                          err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                      }
                      return reject(err);
                  }
                  debug('4');
                  const eventStream = data.Payload;
                  eventStream.on('data', function (event) {
                      debug('5');
                      if (event.Records) {
                          debug('6');
                          response = event.Records.Payload.toString();
                      }
                  });
                  debug('7');
                  // Handle errors encountered during the API call
                  eventStream.on('error', (err) => {
                      debug('8');
                      switch (err.name) {
                        // Check against specific error codes that need custom handling
                      }
                  });
                  debug('10');
                  eventStream.on('end', function () {
                      debug('11');
                      return resolve(response);
                  });
              });
          }
        );
    },

    getFileFormatMD: function (options) {
        return new Promise(async function (resolve, reject) {
            var type = options.type;
            var version = options.version || 1;
            var err;
            var fields = [];
            try {
                var conn = await connection.getConnection();
                var columns = await conn.query('select columnName, columnNumber, minimumLength, maximumLength from Profile ' +
                  'where importType=? and version=? and isRequiredField=1', [type, version]);
                //columns = Utils.filteredResponse(columns);
                if (!columns || columns.length <= 0) {
                    err = new Error(ErrorConfig.MESSAGE.FIELDS_NOT_FOUND_FOR_THIS_VERSION_TYPE);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    debug('err', err);
                    return reject(err);
                }
                return resolve({
                    columns: columns
                });
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    checkRowCount: function (columnNumber, rowCount, checkValue, minimumLength, maximumLength, errorOption) {
        var flag = false;
        if (checkValue === 1) {
            if (parseInt(columnNumber) === 1 && rowCount >= 1) {
                errorOption.numberOfOccurence = rowCount;
                flag = true;
                //errors.push(errorOption);
            } else if (parseInt(columnNumber) !== 1 && rowCount > 1) {
                errorOption.numberOfOccurence = rowCount - 1;
                flag = true;
                //errors.push(errorOption);
            }
        } else if (checkValue === 2) {
            if (parseInt(columnNumber) === 1 && minimumLength > 3) {
                rowCount--;
            }
            if (parseInt(columnNumber) === 1 && rowCount >= 1) {
                errorOption.numberOfOccurence = rowCount;
                flag = true;
            } else if (parseInt(columnNumber) !== 1 && rowCount > 1) {
                errorOption.numberOfOccurence = rowCount - 1;
                flag = true;
            }
        } else if (checkValue === 3) {
            if (parseInt(columnNumber) === 1 && maximumLength < 3) {
                rowCount--;
            }
            if (rowCount >= 1) {
                errorOption.numberOfOccurence = rowCount;
                flag = true;
            }
        }
        var response = {
            flag: flag,
            errorOption: errorOption
        };
        return response;
    },

    requiredFieldValidationMD: function (options) {
        return new Promise(async function (resolve, reject) {
            var fields = options.fields;
            var bucket = options.bucket;
            var fileName = options.fileName;
            var errors = [], errorOption, query;
            var commonOption = {
                bucket: bucket,
                fileName: fileName,
                fileHeader: Constants.UPLOAD_FILE_HEADER.IGNORE
            };
            var count = 1;
            await PromiseBluebird.each(fields, async function (field) {
                debug('count', count++);
                await PromiseBluebird.each(Constants.VALIDATION_TYPE, async function (value) {
                    try {
                        if (value === 1) {
                            query = Utils.getEmptyRowQuery(field.columnNumber);

                            errorOption = {
                                columnName: field.columnName,
                                failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.EMPTY_VALUE.CODE,
                                errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.EMPTY_VALUE.MESSAGE
                            };
                        } else if (value === 2) {
                            query = Utils.getMinimumLengthQuery(field.columnNumber, field.minimumLength);
                            errorOption = {
                                columnName: field.columnName,
                                failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.FIELD_HAS_LESS_LENGTH_VALUE_THAN_MININUM_LENGTH.CODE,
                                errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.FIELD_HAS_LESS_LENGTH_VALUE_THAN_MININUM_LENGTH.MESSAGE
                            };
                        } else if (value === 3) {
                            query = Utils.getMaximumLengthQuery(field.columnNumber, field.maximumLength);

                            errorOption = {
                                columnName: field.columnName,
                                failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.FIELD_HAS_MORE_LENGTH_VALUE_THAN_MAXINUM_LENGTH.CODE,
                                errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.FIELD_HAS_MORE_LENGTH_VALUE_THAN_MAXINUM_LENGTH.MESSAGE
                            };
                        }
                        //query = 'SELECT COUNT(*) FROM S3Object where _' + field.columnNumber + '=\'\'';
                        commonOption.query = query;
                        var rowsCountResponse = await OrderReferenceInformation.getCsvDataMD(commonOption);
                        var rowsCount = JSON.parse(rowsCountResponse)._1;

                        var response = OrderReferenceInformation.checkRowCount(field.columnNumber, rowsCount, value, field.minimumLength, field.maximumLength, errorOption);
                        if (response.flag) {
                            errors.push(response.errorOption);
                        }
                    } catch (err) {
                        debug('err', err);
                        /*errorOption = {
                columnName: field.columnName,
                failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.EMPTY_VALUE.CODE,
                message: Constants.VALIDATION_FAIL_REASON_CODE.EMPTY_VALUE.MESSAGE,
                numberOfOccurence: parseInt(field.columnNumber) === 1 ? rowsCount : rowsCount - 1
            };
            errors.push(errorOption);*/
                    }
                });
            });
            debug('here123');
            return resolve({errors: errors});
        });
    },

    /*csvTypeValidationMD: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var fileName = options.fileName;
            var destination = options.destination;

            var fileData = fs.readFileSync(destination + '/' + fileName).toString();
            var data = Utils.removeLastLine(fileData);
            var length = Utils.getNumberOfColumn(data);
            fs.writeFileSync(destination + '/' + fileName, data);
            return resolve({length: length});
        });
    },

    unCompressFile: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var fileName = options.fileName;
            var destination = options.destination;
            var zlib = require('zlib');


            try {
                var decompress = zlib.createGunzip(fileName);
                var readStream = fs.createReadStream(destination + '/' + fileName);
                var newFileName = fileName.replace('.gz', '');
                var writeStream = fs.createWriteStream(destination + '/' + newFileName);

                readStream.pipe(decompress).pipe(writeStream);
                debug('2');
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },*/

    /*copyFileMD: async function (options) {
    return new PromiseBluebird(function (resolve, reject) {
        var fileName = options.fileName;
        var bucket = options.bucket;
        var destination = options.destination;
        var zlib = require('zlib');

        debug('options', options);
        var params = {
            Bucket: bucket,
            Key: fileName
        };
        /!*try {
            //var decompress = zlib.createGunzip(fileName);
            //var newFileName = fileName.replace('.gz', '');
            /!*s3.getObject(params, function (err, data) {
                if (err) {
                    //fs.unlinkSync(destination);
                    err = new Error(ErrorConfig.MESSAGE.FILE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }
                debug('data', data.Body.toString());
                return resolve({fileName: fileName});
            });*!/


            /!*var filewriteStream = fs.createWriteStream(destination + '/' + fileName);
              debug('1');
              s3.getObject(params).createReadStream().on('error', function (err) {
                  if (err.code === 'NoSuchKey') {
                      fs.unlinkSync(destination);
                      err = new Error(ErrorConfig.MESSAGE.FILE_NOT_FOUND);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                      return reject(err);
                  }
              }).pipe(filewriteStream);
              filewriteStream.on('finish', function () {
                  debug('4');
                  filewriteStream.end();
                  return resolve({fileName: fileName});
              });*!/
        } catch (err) {
            debug('err', err);
            fs.unlinkSync(destination + '/' + fileName);
            return reject(err);
        }*!/
        try {
            var decompress = zlib.createGunzip(fileName);
            var newFileName = fileName.replace('.gz', '');
            var filewriteStream = fs.createWriteStream(destination + '/' + newFileName);
            debug('1');
            s3.getObject(params).createReadStream().on('error', function (err) {
                if (err.code === 'NoSuchKey') {
                    fs.unlinkSync(destination);
                    err = new Error(ErrorConfig.MESSAGE.FILE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }
            }).pipe(decompress).pipe(filewriteStream);
            filewriteStream.on('finish', function () {
                debug('4');
                filewriteStream.end();
                return resolve({fileName: newFileName});
            });
        } catch (err) {
            debug('err', err);
            fs.unlinkSync(destination + '/' + fileName);
            return reject(err);
        }
    });
},*/

    /*validateFilesMD: async function (options, errorOptions, cb) {
        var uploadLog = options.uploadLog;
        var accountId = uploadLog.accountId;
        var userId = uploadLog.userId;
        var fileName = options.fileName;
        var version = options.version;
        var type = uploadLog.type;
        var uploadLogId = uploadLog.id;
        var bucket = Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET + '/' + accountId + '/' + Constants.S3_FOLDER.ARRIVAL_FILES;
        var uploadLogOptions, errorsWithMessage, errors;
        var createdAt = DataUtils.getEpochMSTimestamp();
        var updateResponse, date, err, catchOption;
        var user;

        /!*try {
        debug('3');
        /!*
          *  GET USER BY ID
          * *!/
        user = await OrderReferenceInformation.getUserById(userId);
        debug('user', user);
        /!*
          * STEP 1  : VALIDATE FILE ON S3 BUCKET
          * *!/
        /!*!// Get last line from file
          var getfirstColumnOptions = {
              query: 'SELECT _1 FROM S3Object;',
              bucket: bucket,
              fileName: fileName,
              fileHeader: Constants.UPLOAD_FILE_HEADER.NONE,
              type: 'CSV'
          };
          var firstColumn = await OrderReferenceInformation.getCsvDataMD(getfirstColumnOptions);
          debug('firstColumn', JSON.stringify(firstColumn));
          firstColumn = firstColumn.toString().split('\n');
          var EOFDelimiter = firstColumn[firstColumn.length - 2];
          debug('EOFDelimiter', EOFDelimiter);

          // Get first Line and total line
          var firstLineOptions = {
              query: 'SELECT * FROM S3Object limit 1;',
              bucket: bucket,
              fileName: fileName,
              fileHeader: Constants.UPLOAD_FILE_HEADER.NONE
          };
          var totalLineOptions = {
              query: 'SELECT COUNT(*) FROM S3Object;',
              bucket: bucket,
              fileName: fileName,
              fileHeader: Constants.UPLOAD_FILE_HEADER.NONE
          };

          var firstLine = await OrderReferenceInformation.getCsvDataMD(firstLineOptions);
          var totalLine = await OrderReferenceInformation.getCsvDataMD(totalLineOptions);

          // Check Header and footer delimiters
          var checkOptions = {
              firstLine: firstLine,
              totalLine: totalLine,
              EOFDelimiter: EOFDelimiter
          };
          debug('checkOptions', checkOptions);
          var checkResponse = await OrderReferenceInformation.checkFile(checkOptions);*!/

        var versionValue;
        _.forEach(Constants.VERSION, function (versionObject, key) {
            if (versionObject.type === version) {
                versionValue = versionObject.value;
                return;
            }
        });
        // Get file format by the type of file
        var formatOption = {
            type: type,
            version: versionValue
        };
        var formatResponse = await OrderReferenceInformation.getFileFormatMD(formatOption);
        var validationOption = {
            fields: formatResponse.columns,
            bucket: bucket,
            fileName: fileName
        };

        // validate required field validation according to file format
        var response = await OrderReferenceInformation.requiredFieldValidationMD(validationOption);
        if (response.errors.length > 0) {
            errorsWithMessage = response.errors;
            errors = Utils.convertMutable(response.errors);

            _.map(errors, function (error) {
                error.uploadLogId = uploadLogId;
                error.createdAt = createdAt;
            });

            // Insert errors in validation error log table
            var errorInserted = await OrderReferenceInformation.insertErrorLogMD({
                errors: errors
            });
            err = new Error(ErrorConfig.MESSAGE.INVALID_FILE);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            err.uploadStatus = Constants.UPLOAD_STATUS.VALIDATE_FAIL;
            err.statusReasonCode = Constants.UPLOAD_STATUS_REASON_CODES.INVALID_FILE.CODE;
            err.data = errorsWithMessage;
            throw err;
        } else {
            // Update UplaodLog table after validation steps are completed
            uploadLogOptions = {
                userId: userId,
                accountId: accountId,
                fileName: fileName,
                status: Constants.UPLOAD_STATUS.VALIDATE_SUCCESS,
                stepCompleted: Constants.UPLOAD_COMPLETED_STEPS.STEP_1
            };
            updateResponse = await OrderReferenceInformation.updateUploadLogMD(uploadLogOptions);
        }
        return cb(null, Constants.OK_MESSAGE);

    } catch (err) {
        debug('err inside catch', err);
        try {
            catchOption = {
                user: user,
                userId: userId,
                accountId: accountId,
                type: type,
                fileName: fileName,
                isLoad: false,
                err: err
            };
            err = await OrderReferenceInformation.fileUploadCatch(catchOption);
            return cb(err);
        } catch (err) {
            return cb(err);
        }
    }*!/
    },*/

    /*logicalValidation: async function (options, errorOptions, cb) {
        var uploadLog = options.uploadLog;
        var accountId = uploadLog.accountId;
        var userId = uploadLog.userId;
        var fileName = uploadLog.fileName;
        var type = uploadLog.type;
        var uploadLogId = uploadLog.id;
        var numberOfColumns = parseInt(uploadLog.numberOfColumns);
        var error, isMoved, uploadLogOptions;
        var removeOption, removeResponse, updateResponse, errorOption;
        var catchOption, user, version, privateKey;

        try {

            /!*
            *  GET USER BY ID
            * *!/
            user = await OrderReferenceInformation.getUserById(userId);
            debug('user', user);

            /!*
             * Get Version By accountId
             * *!/
            var account = await OrderReferenceInformation.getVersionByAccountId(accountId);
            version = account.version;
            privateKey = account.privateKey;
            debug('version', version);

            var parts = await OrderReferenceInformation.getUploadPart({fileName: fileName});
            debug('parts', parts);



            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err', err);
            try {
                catchOption = {
                    user: user,
                    userId: userId,
                    accountId: accountId,
                    type: type,
                    fileName: fileName,
                    newFileName: fileName.replace('.gz.txt', ''),
                    isLoad: true,
                    err: err
                };
                err = await OrderReferenceInformation.fileUploadCatch(catchOption);
                return cb(err);
            } catch (err) {
                return cb(err);
            }
        }

    },*/

    /* getUserById: function (id) {
         return new PromiseBluebird(async function (resolve, reject) {
             try {
                 var conn = await connection.getConnection();
                 var res = await conn.query('set global wsrep_max_ws_rows = 0');
                 var res1 = await conn.query('show variables like \'%wsrep_max_ws_rows%\'');
                 debug('res1', res1);
                 var user = await conn.query('select email, firstName,lastName,languageCultureCode from users where id=uuid_to_bin(?)', [id]);
                 user = Utils.filteredResponsePool(user);
                 return resolve(user);
             } catch (err) {
                 debug('err', err);
                 return reject(err);
             }
         });
     },*/

    getValues: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var type = options.type;
            var userId = options.userId;
            var accountId = options.accountId;
            var createdAt = DataUtils.getEpochMSTimestamp();
            var values = [];

            if (parseInt(type) === Constants.UPLOAD_FILE_TYPE.ORI) {
                values.push(accountId, userId, createdAt, accountId, userId);
            } else if (parseInt(type) === Constants.UPLOAD_FILE_TYPE.OLI) {
                values.push(userId);
            } else if (parseInt(type) === Constants.UPLOAD_FILE_TYPE.PRODUCT) {
            } else if (parseInt(type) === Constants.UPLOAD_FILE_TYPE.PRODUCT_INVENTORY) {
            } else if (parseInt(type) === Constants.UPLOAD_FILE_TYPE.SUPPLY_ITEM) {
            } else if (parseInt(type) === Constants.UPLOAD_FILE_TYPE.SUPPLY_INVENTORY) {
            }
            return resolve(values);
        });
    },

    getItemsByOrderIdMD: async function (options, auditOptions, errorOptions, cb) {
        var orderRefId = options.orderRefId;
        var user = options.user, err;
        var allItems = [];

        if (!orderRefId) {
            err = new Error(ErrorConfig.MESSAGE.ORDER_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
        try {
            var conn = await connection.getConnection();
            var items = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id,CAST(uuid_from_bin(accountId) as CHAR) as accountId,' +
              'CAST(uuid_from_bin(orderRefId) as CHAR) as orderRefId,' +
              'amazonOrderId, orderItemId, UOMScalId, quantityOrdered, title, shippingTaxCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (shippingTaxAmount / CAST(power(10,8) as INTEGER))))) as shippingTaxAmount, promotionDiscountCurrencyCode, ' +
              'TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (promotionDiscountAmount / CAST(power(10,8) as INTEGER))))) as promotionDiscountAmount, ' +
              'conditionId, mpProductId, sellerSKU, numberOfItems, giftWrapTaxCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (giftWrapTaxAmount / CAST(power(10,8) as INTEGER))))) as giftWrapTaxAmount, ' +
              'quantityShipped, shippingPriceCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (shippingPriceAmount / CAST(power(10,8) as INTEGER))))) as shippingPriceAmount, ' +
              'giftWrapPriceCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (giftWrapPriceAmount / CAST(power(10,8) as INTEGER))))) as giftWrapPriceAmount , ' +
              'conditionSubtypeId, itemPriceCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (itemPriceAmount / CAST(power(10,8) as INTEGER))))) as itemPriceAmount , ' +
              'itemTaxCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (itemTaxAmount / CAST(power(10,8) as INTEGER))))) as itemTaxAmount, ' +
              'shippingDiscountCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (shippingDiscountAmount / CAST(power(10,8) as INTEGER))))) as shippingDiscountAmount, ' +
              'giftMessageText, isGift, priceDestination, conditionNote, recordType, CAST(uuid_from_bin(orderType) as CHAR) as orderType, scheduledDeliveryStartDate, scheduledDeliveryEndDate, ' +
              'CODFeeCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (CODFeeAmount / CAST(power(10,8) as INTEGER))))) as CODFeeAmount, ' +
              'CODFeeDiscountCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (CODFeeDiscountAmount / CAST(power(10,8) as INTEGER))))) as CODFeeDiscountAmount, updatedAt from OrderLineItems ' +
              'where orderRefId=uuid_to_bin(?);', [orderRefId]);

            if (!items || items.length <= 0) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_ITEMS_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            AuditUtils.create(auditOptions);
            return cb(null, items);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.GET_ITEMS_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }

    },

    getCustomerByAccountIdEmail: async function (options, cb) {
        var order = options.order;
        var customerOption = {
            accountId: options.accountId,
            email: options.email
        };
        try {
            var customer = await CustomerApi.getCustomerByAccountIdEmail(customerOption);
            var customerObject = await OrderReferenceInformation.createCustomerObjectForCSV(order);
            var response = {
                customer: customer,
                customerObject: customerObject
            };
            return cb(null, response);
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
    },

    /*
    * Validate order fields
    * */
    validateOrderFields: async function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            try {
                var err;
                if (DataUtils.isUndefined(options.accountId)) {
                    err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
                } else if (DataUtils.isUndefined(options.sku)) {
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_SKU_REQUIRED);
                } else if (DataUtils.isUndefined(options.skuName)) {
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_SKU_NAME_REQUIRED);
                } else if (DataUtils.isUndefined(options.orderDeliveryDate)) {
                    err = new Error(ErrorConfig.MESSAGE.ORDER_DELIVERY_DATE_REQUIRED);
                } else if (DataUtils.isUndefined(options.orderLocation)) {
                    err = new Error(ErrorConfig.MESSAGE.ORDER_LOCATION_REQUIRED);
                } else if (DataUtils.isUndefined(parseInt(options.quantityOrdered))) {
                    err = new Error(ErrorConfig.MESSAGE.ORDER_QUANTITY_REQUIRED);
                } else if (DataUtils.isUndefined(options.orderId)) {
                    err = new Error(ErrorConfig.MESSAGE.ORDER_ID_REQUIRED);
                }
                if (err) {
                    throw err;
                }
                return resolve(Constants.OK_MESSAGE);

            } catch (err) {
                debug('err', err);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return reject(err);
            }
        });
    },

    /*
    * Insert Order
    * */
    insertOrder: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var err;
                var orderRefId = options.id;

                var conn = await connection.getConnection();
                if (DataUtils.isDefined(options.mpId) && options.mpId !== 'Default') {
                    debug('inside if');
                    var isMarketPlace = await conn.query('select 1 from AccountMarketplaces AM, Marketplaces MP ' +
                      ' where AM.mpId = ? and AM.accountId = uuid_to_bin(?) and AM.mpId = MP.mpId ',
                      [options.mpId, options.accountId]);

                    isMarketPlace = Utils.isAffectedPool(isMarketPlace);
                    debug('isMarketPlace', isMarketPlace);
                    if (!isMarketPlace) {
                        err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_NOT_FOUND);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        return reject(err);
                    }
                } else {
                    var marketPlace = await conn.query('select mpId from Marketplaces where isDefault = 1');
                    marketPlace = Utils.filteredResponsePool(marketPlace);
                    debug('marketPlace', marketPlace.mpId);
                    options.mpId = marketPlace.mpId;
                }

                var isInsert = await conn.query('IF NOT EXISTS (SELECT 1 from OrderReferenceInformation WHERE mpId = ? and' +
                  ' accountId = uuid_to_bin(?) and amazonOrderId = ?)' +
                  ' THEN ' +
                  ' INSERT INTO OrderReferenceInformation set id = uuid_to_bin(?), accountId =uuid_to_bin(?), mpId = ?,' +
                  ' latestShipDate = ?,amazonOrderId = ?,addressLine1 = ?,' +
                  ' addressLine2 = ?,city = ?,postalCode = ?,stateOrRegion = ?,countryCode =?, createdBy =uuid_to_bin(?),' +
                  ' updatedBy = uuid_to_bin(?), createdAt = ?, updatedAt = ?;' +
                  ' ELSE ' +
                  ' SELECT CAST(uuid_from_bin(id) as CHAR) as orderRefId from OrderReferenceInformation WHERE mpId = ? and ' +
                  ' accountId = uuid_to_bin(?) and  amazonOrderId = ?;' +
                  ' END IF;',
                  [options.mpId, options.accountId, options.orderId, options.id, options.accountId, options.mpId, options.latestShipDate,
                      options.orderId, options.addressLine1, options.addressLine2, options.city, options.postalCode, options.stateOrRegion,
                      options.countryCode, options.createdBy, options.updatedBy, options.createdAt, options.updatedAt,
                      options.mpId, options.accountId, options.orderId]);
                isInsert = Utils.filteredResponsePool(isInsert);
                debug('isInsert', (isInsert && isInsert[0].orderRefId));
                if (isInsert && isInsert[0].orderRefId) {
                    debug('inside insert');
                    orderRefId = isInsert[0].orderRefId;
                }
                debug('orderRefId', orderRefId);
                return resolve({id: orderRefId});
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
    * Insert Order Line Items
    * */
    insertOrderLineItems: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var generatedId = Utils.generateId();
                var id = generatedId.uuid;
                var conn = await connection.getConnection();

                var isInsert = await conn.query('INSERT INTO OrderLineItems (id, accountId, mpProductId, orderRefId, amazonOrderId,' +
                  ' productRefId, quantityOrdered,title,sellerSKU,orderItemId,UOMScalId, createdBy, updatedBy, createdAt, updatedAt) VALUES ' +
                  ' (uuid_to_bin(?),uuid_to_bin(?),?,uuid_to_bin(?),?,uuid_to_bin(?),?,?,?,?,?,uuid_to_bin(?),uuid_to_bin(?),?,?)',
                  [id, options.accountId, options.mpProductId, options.orderRefId, options.orderId, options.productRefId, options.quantityOrdered,
                      options.title, options.sellerSKU, options.orderItemId, Constants.AMAZON_DEFAULT_QTY_UOM_ID.QTY_UOM_ID,
                      options.createdBy, options.updatedBy, options.createdAt, options.updatedAt]);

                debug('isInsert', isInsert);
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
    * Create order
    * */
    createOrder: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var accountId = options.accountId;
        var sku = options.sku;
        var skuName = options.skuName;
        var marketplaceId = options.marketplaceId;
        var orderDeliveryDate = options.orderDeliveryDate;
        var orderLocation = options.orderLocation;
        var quantityOrdered = options.quantityOrdered;
        var orderId = options.orderId;
        var generatedId = Utils.generateId();
        var id = generatedId.uuid;
        var createdAt = DataUtils.getEpochMSTimestamp();
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var err;
        try {
            var conn = await connection.getConnection();
            await conn.query('START TRANSACTION');

            var validateOrderResponse = await OrderReferenceInformation.validateOrderFields(options);
            debug('validateOrderResponse', validateOrderResponse);

            var orderItemId = Math.floor(Math.random() * Constants.PRECISION[15]);
            debug('orderItemId', orderItemId);

            var locationDetails = await conn.query('SELECT addressLine1, addressLine2, city, zipCode, state, country  FROM ' +
              ' LocationReference WHERE accountId = uuid_to_Bin(?) AND locationId = ? ', [accountId, orderLocation]);
            locationDetails = Utils.filteredResponsePool(locationDetails);
            debug('locationDetails', locationDetails);
            if (!locationDetails) {
                debug('inside location');
                err = new Error(ErrorConfig.MESSAGE.LOCATION_REFERENCE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }

            var insertOrderOptions = {
                id: id,
                accountId: accountId,
                mpId: marketplaceId,
                latestShipDate: orderDeliveryDate,
                orderId: orderId,
                addressLine1: locationDetails.addressLine1,
                addressLine2: locationDetails.addressLine2,
                city: locationDetails.city,
                postalCode: locationDetails.zipCode,
                stateOrRegion: locationDetails.state,
                countryCode: locationDetails.country,
                createdBy: user.id,
                updatedBy: user.id,
                createdAt: createdAt,
                updatedAt: updatedAt
            };
            var insertOrderResponse = await OrderReferenceInformation.insertOrder(insertOrderOptions);
            debug('insertOrderResponse', insertOrderResponse);

            var productDetails = await conn.query('SELECT CAST(uuid_from_bin(id) as CHAR) as productRefId, mpProductId FROM ' +
              ' ProductReferences WHERE accountId = uuid_to_Bin(?) AND sku = ? ', [accountId, sku]);
            productDetails = Utils.filteredResponsePool(productDetails);
            //debug('productDetails', productDetails.productRefId);
            if (!productDetails) {
                debug('inside product');
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }


            var insertOrderLineItemsOptions = {
                accountId: accountId,
                orderRefId: insertOrderResponse.id,
                productRefId: productDetails.productRefId,
                mpProductId: productDetails.mpProductId,
                orderId: orderId,
                quantityOrdered: quantityOrdered,
                title: skuName,
                sellerSKU: sku,
                orderItemId: orderItemId,
                createdBy: user.id,
                updatedBy: user.id,
                createdAt: createdAt,
                updatedAt: updatedAt
            };
            var insertOrderLineItemsResponse = await OrderReferenceInformation.insertOrderLineItems(insertOrderLineItemsOptions);
            debug('insertOrderLineItems', insertOrderLineItemsResponse);
            await conn.query('COMMIT');
            var allOrderLineItems = [{
                productRefId: productDetails.productRefId,
                orderRefIds: [insertOrderResponse.id]
            }];

            debug('allOrderLineItems.length', allOrderLineItems.length);
            if (allOrderLineItems.length > 0) {
                var checkRealTimeShareOption = {
                    accountId: accountId,
                    allOrderLineItems: allOrderLineItems,
                    frequencyType: Constants.OUT_SHARE_FREQ_TYPE.REAL_TIME
                };
                debug('checkRealTimeShareOption', checkRealTimeShareOption);
                var realTimeOutProductOrderShares = await OrderReferenceInformation.checkForRealTimeProductOrderShare(checkRealTimeShareOption);
                var realTimeOutDependentDemandShares = await OrderReferenceInformation.checkForRealTimeDependentDemandShare(checkRealTimeShareOption);
                var realTimeOutShares = [].concat(realTimeOutProductOrderShares).concat(realTimeOutDependentDemandShares);
                //var realTimeOutShares = [].concat(realTimeOutDependentDemandShares);

                if (realTimeOutShares && realTimeOutShares.length > 0) {
                    debug('realTimeOutShares after', realTimeOutShares);

                    var shareOptions = {
                        realTimeOutShares: realTimeOutShares
                    };
                    var apiResponse = OrderReferenceInformation.buildTask(shareOptions);
                    debug('API COMPLTETED', apiResponse);
                }
            }

            await AuditUtils.create(auditOptions);
            var response = {
                OK: Constants.SUCCESS_MESSAGE.ORDER_CREATE_SUCCESS,
                id: insertOrderResponse.id,
                createdAt: createdAt
            };
            return cb(null, response);
        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK');
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    /*
   * Edit order
   * */
    editOrder: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var accountId = options.accountId;
        var id = options.id;
        var orderLocation = options.orderLocation;
        var quantityOrdered = options.quantityOrdered;
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var err;
        try {
            var conn = await connection.getConnection();
            await conn.query('START TRANSACTION');

            if (DataUtils.isUndefined(id)) {
                err = new Error(ErrorConfig.MESSAGE.ID_REQUIRED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }

            // Get order details
            var orderDetails = await conn.query('SELECT CAST(uuid_from_bin(orderRefId) as CHAR) as orderRefId FROM OrderLineItems' +
              ' WHERE id = uuid_to_bin(?) and accountId = uuid_to_bin(?)', [id, accountId]);
            orderDetails = Utils.filteredResponsePool(orderDetails);
            debug('orderDetails', orderDetails);
            if (!orderDetails) {
                debug('inside-if');
                err = new Error(ErrorConfig.MESSAGE.ORDER_ITEM_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }

            // Update quantity order for order items
            if (DataUtils.isDefined(quantityOrdered)) {
                var updateOrderLineItems = await conn.query('UPDATE OrderLineItems SET quantityOrdered = ?,updatedAt = ? WHERE ' +
                  'id = uuid_to_bin(?) ', [quantityOrdered, updatedAt, id]);

                debug('updateOrderLineItems', updateOrderLineItems);
            }

            // Update Location for order
            if (DataUtils.isDefined(orderLocation)) {
                var locationDetails = await conn.query('SELECT addressLine1, addressLine2, city, zipCode, state, country  FROM ' +
                  ' LocationReference WHERE accountId = uuid_to_Bin(?) AND locationId = ? ', [accountId, orderLocation]);
                locationDetails = Utils.filteredResponsePool(locationDetails);
                debug('locationDetails', locationDetails);
                if (!locationDetails) {
                    debug('inside location');
                    err = new Error(ErrorConfig.MESSAGE.LOCATION_REFERENCE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return cb(err);
                }
                var updateOrders = await conn.query('UPDATE OrderReferenceInformation SET addressLine1 = ?,' +
                  ' addressLine2 = ?,city = ?,postalCode = ?,stateOrRegion = ?,countryCode =?,updatedAt = ? WHERE ' +
                  ' id = uuid_to_bin(?)', [locationDetails.addressLine1, locationDetails.addressLine2, locationDetails.city,
                    locationDetails.zipCode, locationDetails.state, locationDetails.country, updatedAt, orderDetails.orderRefId]);
                debug('updateOrders', updateOrders);
            }

            await conn.query('COMMIT');
            await AuditUtils.create(auditOptions);
            return cb(null, {
                OK: Constants.SUCCESS_MESSAGE.UPDATE_ORDER_SUCCESS,
                updatedAt: updatedAt
            });
        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK');
            err = new Error(ErrorConfig.MESSAGE.UPDATE_ORDER_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    }
};

module.exports = OrderReferenceInformation;
