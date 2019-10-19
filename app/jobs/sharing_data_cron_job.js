var debug = require('debug')('scopehub.jobs.sharing_cron_job');
var _ = require('lodash');
var CronJob = require('cron').CronJob;
var DataUtils = require('../lib/data_utils');
var connection = require('../lib/connection_util');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');
var CronJobApi = require('../api/cron_job');
var OutSharingApi = require('../api/out_sharing');
var Request = require('request-promise');
var async = require('async');
var PromiseBluebird = require('bluebird');


var SHARING_DATA_CRON_JOB = Constants.SHARING_DATA_CRON_JOB;

new CronJob(SHARING_DATA_CRON_JOB.Seconds + ' ' +
  SHARING_DATA_CRON_JOB.Minutes + ' ' +
  SHARING_DATA_CRON_JOB.Hours + ' ' +
  SHARING_DATA_CRON_JOB.DayOfMonth + ' ' +
  SHARING_DATA_CRON_JOB.Months + ' ' +
  SHARING_DATA_CRON_JOB.DayOfWeek,
  function () {
      start();
  }, null, true);
debug('---------------------Sharing Cron Job Initiated Successfully------------------------');


async function start() {
    var startTime = DataUtils.getCurrentUtcDateString();
    var updateCronJobResponse, createCronJobResponse;

    debug('..............Sharing Job Start.......... %o', startTime);
    try {
        await connection.startConnectionCronJob();
        //debug('here');
        var getCronJob = await CronJobApi.getCronJobMD({name: Constants.SHARING_DATA_CRON_JOB_NAME});
        var options = {
            startTime: startTime,
            status: Constants.SHARING_DATA_CRON_JOB_STATUS.PROGRESSING,
            name: Constants.SHARING_DATA_CRON_JOB_NAME
        };

        if (!getCronJob) {
            createCronJobResponse = await CronJobApi.createCronJob(options);
        } else {
            updateCronJobResponse = await CronJobApi.updateCronJob(options);
        }

        try {
            // Find the active outShare event and then make api call for each event
            var allShareEvents = await OutSharingApi.getActiveSharingEvent();
            debug('allShareEvents', allShareEvents);

            if (allShareEvents.length <= 0) {
                var err = new Error(ErrorConfig.MESSAGE.SHARING_EVENT_NOT_EXIST);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug('err', err);
            } else {
                debug('API CALLED------------------------------------------------');
                var apiResponse = buildTask(allShareEvents);
            }

        } catch (err) {
            debug('err from inner catch block', err);
        }
    } catch (err) {
        debug('err from catch block', err);
    }
    finally {
        var endTimestamp = DataUtils.getCurrentUtcDateString();
        var options = {
            endTime: endTimestamp,
            status: Constants.SHARING_DATA_CRON_JOB_STATUS.FINISH,
            name: Constants.SHARING_DATA_CRON_JOB_NAME
        };
        updateCronJobResponse = await CronJobApi.updateCronJob(options);
        await connection.closeConnectionCronJob();
        debug('..............Job END........ %o', endTimestamp);
    }
};

var buildTask = function (allShareEvents) {
    return new Promise(function (resolve, reject) {
        var promises = [];
        var c = 0;
        _.each(allShareEvents, function (shareEvent) {
            debug('count====> ', c++);
            //var url = 'http://localhost:3000/api/out-share/shared-data';
            var url = 'https://test-be.scopehub.org/api/out-share/shared-data';
            var option = {
                shareEvent: shareEvent,
                apiToken: 'xlK6cQsQRkvKdhIYH9n15yuzIhaLuiug'
            };
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
        PromiseBluebird.all(promises, {concurrency: allShareEvents.length}).then(async function (value) {
            debug('value ', value);
            resolve(true);
        });
    });
};



