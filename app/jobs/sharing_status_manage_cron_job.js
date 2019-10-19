var debug = require('debug')('scopehub.jobs.sharing_cron_job');
var _ = require('lodash');
var CronJob = require('cron').CronJob;
var DataUtils = require('../lib/data_utils');
var connection = require('../lib/connection_util');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');
var CronJobApi = require('../api/cron_job');
var InShareApi = require('../api/in_share');
var Request = require('request-promise');
var async = require('async');
var PromiseBluebird = require('bluebird');


var SHARING_STATUS_MANAGE_CRON_JOB = Constants.SHARING_STATUS_MANAGE_CRON_JOB;

new CronJob(SHARING_STATUS_MANAGE_CRON_JOB.Seconds + ' ' +
  SHARING_STATUS_MANAGE_CRON_JOB.Minutes + ' ' +
  SHARING_STATUS_MANAGE_CRON_JOB.Hours + ' ' +
  SHARING_STATUS_MANAGE_CRON_JOB.DayOfMonth + ' ' +
  SHARING_STATUS_MANAGE_CRON_JOB.Months + ' ' +
  SHARING_STATUS_MANAGE_CRON_JOB.DayOfWeek,
  function () {
      start();
  }, null, true);
debug('---------------------Sharing status manage Cron Job Initiated Successfully------------------------');


async function start() {
    var startTime = DataUtils.getCurrentUtcDateString();
    var updateCronJobResponse, createCronJobResponse;

    debug('..............Sharing status manage Job Start.......... %o', startTime);
    try {
        await connection.startConnectionCronJob();
        //debug('here');
        var getCronJob = await CronJobApi.getCronJobMD({name: Constants.SHARING_STATUS_MANAGE_CRON_JOB_NAME});
        var options = {
            startTime: startTime,
            status: Constants.SHARING_STATUS_MANAGE_CRON_JOB_STATUS.PROGRESSING,
            name: Constants.SHARING_STATUS_MANAGE_CRON_JOB_NAME
        };
        debug('getCronJob', getCronJob);
        if (!getCronJob) {
            createCronJobResponse = await CronJobApi.createCronJob(options);
        } else {
            updateCronJobResponse = await CronJobApi.updateCronJob(options);
        }
        try {
            // Find the in-share whose status is New and createdAt date is less than 30 days
            var allInShares = await InShareApi.getInShares();
            if (allInShares.length <= 0) {
                var err = new Error(ErrorConfig.MESSAGE.NEW_EXPIRED_IN_SHARE_NOT_EXIST);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug('err', err);
            } else {
                debug('API 1 CALLED------------------------------------------------');
                var apiResponse = buildTask(allInShares);
            }
        } catch (err) {
            debug('err from inner catch block', err);
        }
    } catch (err) {
        debug('err', err);
    }
    finally {
        var endTimestamp = DataUtils.getCurrentUtcDateString();
        var options = {
            endTime: endTimestamp,
            status: Constants.SHARING_STATUS_MANAGE_CRON_JOB_STATUS.FINISH,
            name: Constants.SHARING_STATUS_MANAGE_CRON_JOB_NAME
        };
        updateCronJobResponse = await CronJobApi.updateCronJob(options);
        await connection.closeConnectionCronJob();
        debug('..............Job END........ %o', endTimestamp);
    }
}

var buildTask = function (expiredRemindInShares) {
    return new Promise(function (resolve, reject) {
        var promises = [];
        debug('return from build task');
        var url = 'https://test-be.scopehub.org/api/in-share/expire-remind';
        //var url = 'http://localhost:3000/api/in-share/expire-remind';
        debug('expiredRemindInShares', expiredRemindInShares);
        var option = {
            expiredRemindInShares: expiredRemindInShares,
            apiToken: 'xlK6cQsQRkvKdhIYH9n15yuzIhaLuiug'
        };
        var opt = {
            url: url,
            method: 'PATCH',
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
        PromiseBluebird.all(promises, {concurrency: expiredRemindInShares.length}).then(async function (value) {
            debug('value ', value);
            resolve(true);
        });
    });
};