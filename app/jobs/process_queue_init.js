/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.route.process_polling_queue');
var Util = require('util');
var Async = require('async');

var SQSUtils = require('../lib/sqs_utils');
var PollingScheduleApi = require('../api/polling_schedule');
var PollingScheduleModel = require('../model/polling_schedule');

var ProcessQueueInit = {
    init: function (cb) {
        PollingScheduleApi.getAllSchedules(function (err, schedules) {
            if (err) {
                return cb(err);
            }
            Async.eachLimit(schedules, 5, function (schedule, callback) {
                var scheduleOptions = {
                    accountId: schedule.accountId,
                    marketplaceId: schedule.marketplaceId,
                    refreshInterval: schedule.refreshInterval,
                    entities: schedule.entities
                };
                SQSUtils.enqueue(scheduleOptions, function (err, sqsMessageId) {
                    if (err) {
                        return cb(err);
                    }
                    var scheduleOptions = {
                        id: schedule.id,
                        sqsMessageId: sqsMessageId
                    };

                    PollingScheduleModel.update(scheduleOptions, {
                        ReturnValues: 'ALL_NEW'
                    }, function (err, schedule) {
                        return callback(err);
                    });
                });
            }, function (err) {
                if (err) {
                    return cb(err);
                }
            });
        });
    }
};

module.exports = ProcessQueueInit;

(function () {
    if (require.main === module) {
        ProcessQueueInit.init(console.log);
    }
}());