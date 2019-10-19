var debug = require('debug')('scopehub.jobs.load_csv_data_to_db_cron_job');
var _ = require('lodash');
var CronJob = require('cron').CronJob;
var DataUtils = require('../lib/data_utils');
var connection = require('../lib/connection_util');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');
var CronJobApi = require('../api/cron_job');
var UploadFileApi = require('../api/uploadFile');
var Request = require('request-promise');
var async = require('async');
var PromiseBluebird = require('bluebird');


var LOAD_CSV_DATA_TO_DB_CRON_JOB = Constants.LOAD_CSV_DATA_TO_DB_CRON_JOB;

new CronJob(LOAD_CSV_DATA_TO_DB_CRON_JOB.Seconds + ' ' +
  LOAD_CSV_DATA_TO_DB_CRON_JOB.Minutes + ' ' +
  LOAD_CSV_DATA_TO_DB_CRON_JOB.Hours + ' ' +
  LOAD_CSV_DATA_TO_DB_CRON_JOB.DayOfMonth + ' ' +
  LOAD_CSV_DATA_TO_DB_CRON_JOB.Months + ' ' +
  LOAD_CSV_DATA_TO_DB_CRON_JOB.DayOfWeek,
  function () {
      start();
  }, null, true);
debug('---------------------Load csv data Cron Job Initiated Successfully------------------------');


async function start() {
    var startTime = DataUtils.getCurrentUtcDateString();
    var updateCronJobResponse, createCronJobResponse;

    debug('..............Load csv data Job Start.......... %o', startTime);
    try {
        await connection.startConnectionCronJob();
        //debug('here');
        var getCronJob = await CronJobApi.getCronJobMD({name: Constants.LOAD_CSV_DATA_TO_DB_CRON_JOB_NAME});
        var options = {
            startTime: startTime,
            status: Constants.LOAD_CSV_DATA_TO_DB_CRON_JOB_STATUS.PROGRESSING,
            name: Constants.LOAD_CSV_DATA_TO_DB_CRON_JOB_NAME
        };

        if (!getCronJob) {
            createCronJobResponse = await CronJobApi.createCronJob(options);
        } else {
            updateCronJobResponse = await CronJobApi.updateCronJob(options);
        }

        try {
            // Find the upload log (copied to EFS) for load into DB
            var allUploadLog = await UploadFileApi.getUploadLogToLoad();
            debug('allUploadLog', allUploadLog);

            if (allUploadLog.length <= 0) {
                var err = new Error(ErrorConfig.MESSAGE.UPLOAD_LOG_NOT_EXIST);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug('err', err);
            } else {
                debug('API CALLED------------------------------------------------');
                var apiResponse = buildTask(allUploadLog);
            }
        } catch (err) {
            debug('err from inner catch block', err);
        }
    } catch (err) {
        debug('err from catch block', err);
    } finally {
        var endTimestamp = DataUtils.getCurrentUtcDateString();
        options = {
            endTime: endTimestamp,
            status: Constants.LOAD_CSV_DATA_TO_DB_CRON_JOB_STATUS.FINISH,
            name: Constants.LOAD_CSV_DATA_TO_DB_CRON_JOB_NAME
        };
        updateCronJobResponse = await CronJobApi.updateCronJob(options);
        await connection.closeConnectionCronJob();
        debug('..............Job END........ %o', endTimestamp);
    }
};

var buildTask = function (allUploadLog) {
    return new Promise(function (resolve, reject) {
        var promises = [];

        _.each(allUploadLog, function (uploadLog) {
            //var url = 'http://localhost:3000';
            var url = 'https://test-be.scopehub.org';
            var loadUrl = url + '/api/upload/file/load';
            var option = {
                uploadLog: uploadLog
            };
            var opt = {
                url: loadUrl,
                method: 'POST',
                json: true,
                form: option
            };

            promises.push(Request(opt, async function (err, response, body) {
                debug('err', err);
                if (err || response.statusCode >= 400) {
                    err = err || new Error(ErrorConfig.MESSAGE.HTTP_REQUEST_FAILED);
                    err.status = err.status || ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                    //return cb2();
                }
                debug('Final body ', body);
                debug('1 COMPLETE===================================================================');
                await connection.closeConnectionCronJob();
            }));
        });
        PromiseBluebird.all(promises, {concurrency: allUploadLog.length}).then(async function (value) {
            debug('value ', value);
            resolve(true);
        });
    });
};



