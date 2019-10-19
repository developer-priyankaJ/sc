var debug = require('debug')('scopehub.jobs.import_orders_cron_job');
var Async = require('async');
var _ = require('lodash');
var CronJob = require('cron').CronJob;
var DataUtils = require('../lib/data_utils');
var connection = require('../lib/connection_util');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');
var CronJobApi = require('../api/cron_job');
var Request = require('request-promise');
var async = require('async');
var PromiseBluebird = require('bluebird');


var IMPORT_ORDERS_CRON_JOB = Constants.IMPORT_ORDERS_CRON_JOB;

new CronJob(IMPORT_ORDERS_CRON_JOB.Seconds + ' ' +
  IMPORT_ORDERS_CRON_JOB.Minutes + ' ' +
  IMPORT_ORDERS_CRON_JOB.Hours + ' ' +
  IMPORT_ORDERS_CRON_JOB.DayOfMonth + ' ' +
  IMPORT_ORDERS_CRON_JOB.Months + ' ' +
  IMPORT_ORDERS_CRON_JOB.DayOfWeek,
  function () {
      start();
  }, null, true);
debug('---------------------Import Orders Cron Job Initiated Successfully------------------------');


async function start() {
    var progressFlag = false;
    var allReplication = [];
    var startTime = DataUtils.getCurrentUtcDateString();
    var cronJobStore = {}, err;
    var options, createCronJob, updateCronJob;

    debug('..............Import Orders  Job Start.......... %o', startTime);
    try {
        await connection.startConnectionCronJob();
        debug('here');
        var getCronJob = await CronJobApi.getCronJobMD({name: Constants.IMPORT_ORDERS_CRON_JOB_NAME});
        options = {
            startTime: startTime,
            status: Constants.IMPORT_ORDERS_CRON_JOB_STATUS.PROGRESSING,
            name: Constants.IMPORT_ORDERS_CRON_JOB_NAME
        };

        if (!getCronJob) {
            createCronJob = await CronJobApi.createCronJob(options);
        } else {
            updateCronJob = await CronJobApi.updateCronJob(options);
        }
        try {
            var response = await CronJobApi.getNewReplicationMD();

            if (!DataUtils.isArray(response)) {
                allReplication.push(response);
            } else {
                allReplication = response;
            }
            debug('allReplciation', allReplication);
            if (allReplication.length <= 0) {
                err = new Error(ErrorConfig.MESSAGE.REPLICATION_RECORD_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug('err', err);
            } else {
                var apiResponse = buildTask(allReplication);
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
            status: Constants.IMPORT_ORDERS_CRON_JOB_STATUS.FINISH,
            name: Constants.IMPORT_ORDERS_CRON_JOB_NAME
        };
        updateCronJob = await CronJobApi.updateCronJob(options);
        await connection.closeConnectionCronJob();
        debug('..............Job END........ %o', endTimestamp);
    }
};

/*function callRequest(options, cb) {
    Request(options, function (err, response, body) {
        if (err || response.statusCode >= 400) {
            err = err || new Error(ErrorConfig.MESSAGE.HTTP_REQUEST_FAILED);
            err.status = err.status || ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
            //return cb2();
        }
        return cb(null, body);
    });
}*/

var buildTask = function (allReplications) {
    return new Promise(function (resolve, reject) {
        var promises = [];
        _.each(allReplications, function (replication) {
            //var domain = 'http://localhost:3000';
            var domain = 'https://test-be.scopehub.org';
            var url = domain + '/api/order/replicate';
            var option = {
                account: replication,
                apiToken: 'xlK6cQsQRkvKdhIYH9n15yuzIhaLuiug'
            };
            var opt = {
                url: url,
                method: 'GET',
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
        PromiseBluebird.all(promises, {concurrency: allReplications.length}).then(async function (value) {
            debug('value ', value);
            resolve(true);
        });
    });
};



