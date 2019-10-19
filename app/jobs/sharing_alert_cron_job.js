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


var SHARING_ALERT_CRON_JOB = Constants.SHARING_ALERT_CRON_JOB;

new CronJob(SHARING_ALERT_CRON_JOB.Seconds + ' ' +
  SHARING_ALERT_CRON_JOB.Minutes + ' ' +
  SHARING_ALERT_CRON_JOB.Hours + ' ' +
  SHARING_ALERT_CRON_JOB.DayOfMonth + ' ' +
  SHARING_ALERT_CRON_JOB.Months + ' ' +
  SHARING_ALERT_CRON_JOB.DayOfWeek,
  function () {
      start();
  }, null, true);
debug('---------------------Sharing Alert Cron Job Initiated Successfully------------------------');


async function start() {
    var startTime = DataUtils.getCurrentUtcDateString();
    var updateCronJobResponse, createCronJobResponse;
    var options;

    debug('..............Sharing Alert Job Start.......... %o', startTime);
    try {
        await connection.startConnectionCronJob();
        //debug('here');
        var getCronJob = await CronJobApi.getCronJobMD({name: Constants.SHARING_ALERT_CRON_JOB_NAME});
        options = {
            startTime: startTime,
            status: Constants.SHARING_ALERT_CRON_JOB_STATUS.PROGRESSING,
            name: Constants.SHARING_ALERT_CRON_JOB_NAME
        };

        if (!getCronJob) {
            createCronJobResponse = await CronJobApi.createCronJob(options);
        } else {
            updateCronJobResponse = await CronJobApi.updateCronJob(options);
        }

        try {
            // Find the Sharing alert whose nextAlertTime <= currentTime  and then make api call for each event
            var allSharingAlert = await InShareApi.getInShareAlerts();
            debug('allSharingAlert', allSharingAlert);

            if (allSharingAlert.length <= 0) {
                var err = new Error(ErrorConfig.MESSAGE.SHARING_ALERT_NOT_EXIST);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug('err', err);
            } else {
                debug('API CALLED------------------------------------------------');
                var apiResponse = buildTask(allSharingAlert);
            }
        } catch (err) {
            debug('err from inner catch block', err);
        }
    } catch (err) {
        debug('err from catch block', err);
    }
    finally {
        var endTimestamp = DataUtils.getCurrentUtcDateString();
        options = {
            endTime: endTimestamp,
            status: Constants.SHARING_ALERT_CRON_JOB_STATUS.FINISH,
            name: Constants.SHARING_ALERT_CRON_JOB_NAME
        };
        updateCronJobResponse = await CronJobApi.updateCronJob(options);
        await connection.closeConnectionCronJob();
        debug('..............Job END........ %o', endTimestamp);
    }
};

var buildTask = function (allSharingAlert) {
    return new Promise(function (resolve, reject) {
        var promises = [];
        var c = 0;
        _.each(allSharingAlert, function (sharingAlert) {
            debug('count====> ', c++);
            //var url = 'http://localhost:3000/api/in-share/alert/check';
            var url = 'https://test-be.scopehub.org/api/in-share/alert/check';
            var option = {
                sharingAlert: sharingAlert,
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
        PromiseBluebird.all(promises, {concurrency: allSharingAlert.length}).then(async function (value) {
            debug('value ', value);
            resolve(true);
        });
    });
};



