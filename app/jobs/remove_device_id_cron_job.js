/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.jobs.remove_device_id_cron_job');
var _ = require('lodash');
var Async = require('async');
var CronJob = require('cron').CronJob;

var DataUtils = require('../lib/data_utils');
var Constants = require('../data/constants');
var CronJobModel = require('../model/cron_job');
var CronJobApi = require('../api/cron_job');
var AccountModel = require('../model/account');
var TopicDeviceMappingModel = require('../model/topic_device_mapping');
var ScopehubCore = require('../lib/scope_core');
var MWSConfig = require('../config/mws');
var ErrorConfig = require('../data/error');
var amazonMws = require('amazon-mws')(MWSConfig.ACCESS_KEY_ID, MWSConfig.SECRET_ACCESS_KEY);

var REMOVE_DEVICE_ID_CRONJOB = Constants.REMOVE_DEVICE_ID_CRONJOB;
/*jshint  -W031 : false */
new CronJob(REMOVE_DEVICE_ID_CRONJOB.Seconds + ' ' +
  REMOVE_DEVICE_ID_CRONJOB.Minutes + ' ' +
  REMOVE_DEVICE_ID_CRONJOB.Hours + ' ' +
  REMOVE_DEVICE_ID_CRONJOB.DayOfMonth + ' ' +
  REMOVE_DEVICE_ID_CRONJOB.Months + ' ' +
  REMOVE_DEVICE_ID_CRONJOB.DayOfWeek,
  function () {
      start();
  }, null, true);
debug('..............Remove deviceId Job Initiated Successfully........');

function start() {
    var startTimestamp = DataUtils.getCurrentUtcDateString();
    debug('..............Remove deviceId Job Start........ :%o ', startTimestamp);
    var cronJobStore = {};
    var allTopicDeviceUsers = [];
    var startTime = startTimestamp;

    Async.series({
        getCronJob: function (cb1) {
            CronJobApi.getCronJob({name: 'RemoveDeviceIdCronJob'}, function (err, cronJob) {
                if (err) {
                    debug('err :%o ', err);
                    return cb1();
                }
                if (!cronJob) {
                    var cronJob = {
                        startTime: startTime,
                        status: 'Progressing',
                        name: 'RemoveDeviceIdCronJob'
                    };
                    var params = {
                        overwrite: true
                    };
                    CronJobModel.create(cronJob, params, function (err, cronJob) {
                        if (err) {
                            debug('err :%o ', err);
                            return cb1();
                        }
                        cronJobStore = cronJob.attrs;
                        return cb1();
                    });
                } else {
                    cronJobStore = cronJob;
                    cronJob.startTime = startTime;
                    cronJob.status = 'Progressing';
                    CronJobModel.update(cronJob, function (err, response) {
                        if (err) {
                            debug('err');
                            return cb1();
                        }
                        cronJobStore = response.attrs;
                        return cb1();
                    });
                }
            });
        },

        getAllTopicDeviceUsers: function (cb1) {
            TopicDeviceMappingModel.scan()
              .loadAll()
              .exec(function (err, topicDeviceUsers) {
                  if (err || !topicDeviceUsers) {
                      debug('err', err);
                      return cb1();
                  }
                  if (topicDeviceUsers.Items) {
                      allTopicDeviceUsers = _.map(topicDeviceUsers.Items, 'attrs');
                  }

                  // debug('topicDeviceUsers', allTopicDeviceUsers);
                  return cb1();
              });
        },

        checkDeviceTimeExpiration: function (cb1) {
            if (_.isEmpty(allTopicDeviceUsers)) {
                return cb1();
            }
            var timestamp1 = new Date();
            var timestamp2 = new Date(timestamp1);

            timestamp2.setHours(timestamp1.getHours() - 24);
            var timeExpired = Date.parse(timestamp2);

            Async.forEachOfSeries(allTopicDeviceUsers, function (topicDeviceUser, key, cb2) {
                var topicDeviceMappingOptions = {
                    topicId: topicDeviceUser.topicId
                };
                var deviceIds = [];
                deviceIds = topicDeviceUser.deviceIds;
                Async.series({

                    checkDeviceTime: function (cb3) {
                        var topicDeviceMappingIds = [];
                        //debug('before deviceIds', deviceIds);
                        Async.forEachOfSeries(deviceIds, function (device, key, cb4) {

                            if (device.timestamp < timeExpired) {
                                topicDeviceMappingIds.push(device);
                            }
                            return cb4();

                        }, function (err) {
                            if (err) {
                                debug('err', err);
                                return cb3();
                            }
                            topicDeviceMappingIds.forEach(function (device) {
                                deviceIds.splice(deviceIds.indexOf(device), 1);
                            });
                            //debug('after deviceIds', deviceIds);
                            topicDeviceMappingOptions.deviceIds = deviceIds;
                            TopicDeviceMappingModel.update(topicDeviceMappingOptions, {
                                ReturnValues: 'ALL_NEW'
                            }, function (err, topicDeviceMapping) {
                                if (err || !topicDeviceMapping) {
                                    err = err || new Error(ErrorConfig.MESSAGE.NOTIFICATION_DEVICE_UN_REGISTER_FAILED);
                                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                                    return cb3();
                                }
                                return cb3();
                            });
                        });
                    }
                }, function (err) {
                    if (err) {
                        debug('err', err);
                        return cb2();
                    }
                    return cb2();
                });

            }, function (err) {
                if (err) {
                    debug('err', err);
                    return cb1();
                }
                return cb1();
            });
        }
    }, function () {
        var endTimestamp = DataUtils.getCurrentUtcDateString();
        cronJobStore.endTime = endTimestamp;
        cronJobStore.status = 'Finish';

        CronJobModel.update(cronJobStore, function (err, response) {
            if (err) {
                debug('err', err);
                // return err;
            }
            //return cb();
            debug('..............Job END........ %o', endTimestamp);
        });
    });
}

