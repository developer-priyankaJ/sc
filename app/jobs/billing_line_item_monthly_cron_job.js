var debug = require('debug')('scopehub.jobs.billing_line_item_monthly_cron_job');
var _ = require('lodash');
var CronJob = require('cron').CronJob;
var DataUtils = require('../lib/data_utils');
var connection = require('../lib/connection_util');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');
var CronJobApi = require('../api/cron_job');
var BillingApi = require('../api/billing');
var Request = require('request-promise');
var PromiseBluebird = require('bluebird');


var BILLING_LINE_ITEM_MONTHLY_CRON_JOB = Constants.BILLING_LINE_ITEM_MONTHLY_CRON_JOB;

new CronJob(BILLING_LINE_ITEM_MONTHLY_CRON_JOB.Seconds + ' ' +
  BILLING_LINE_ITEM_MONTHLY_CRON_JOB.Minutes + ' ' +
  BILLING_LINE_ITEM_MONTHLY_CRON_JOB.Hours + ' ' +
  BILLING_LINE_ITEM_MONTHLY_CRON_JOB.DayOfMonth + ' ' +
  BILLING_LINE_ITEM_MONTHLY_CRON_JOB.Months + ' ' +
  BILLING_LINE_ITEM_MONTHLY_CRON_JOB.DayOfWeek,
  function () {
      start();
  }, null, true);
debug('---------------------Billing line item monthly Cron Job Initiated Successfully------------------------');


async function start() {
    var startTime = DataUtils.getCurrentUtcDateString();
    var updateCronJobResponse, createCronJobResponse;
    var accountsArray = [];

    debug('..............Billing line item monthly Job Start.......... %o', startTime);
    try {
        await connection.startConnectionCronJob();
        //debug('here');
        var getCronJob = await CronJobApi.getCronJobMD({name: Constants.BILLING_LINE_ITEM_MONTHLY_CRON_JOB_NAME});
        debug('get cron job');
        var options = {
            startTime: startTime,
            status: Constants.BILLING_LINE_ITEM_MONTHLY_CRON_JOB_STATUS.PROGRESSING,
            name: Constants.BILLING_LINE_ITEM_MONTHLY_CRON_JOB_NAME
        };

        if (!getCronJob) {
            createCronJobResponse = await CronJobApi.createCronJob(options);
        } else {
            updateCronJobResponse = await CronJobApi.updateCronJob(options);
        }

        try {
            // Get accounts whose status = 0
            var zeroStatusInvoiceAccounts = await BillingApi.getZeroStatusInvoiceAccounts();
            //debug('zero status', zeroStatusInvoiceAccounts);

            // Get all active accounts who is active on last month
            var response = await BillingApi.getAccountsByPlan();
            debug('response', response);

            if (response.length <= 0) {
                var err = new Error(ErrorConfig.MESSAGE.ACCOUNT_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug('err', err);
            } else {
                // Create billingControl record
                debug('API CALLED------------------------------------------------');
                var createResponse = await BillingApi.createBillInvoiceControl({
                    accounts: response.accounts
                });

                _.map(response.accounts, function (account) {
                    accountsArray.push(account);
                });
                _.map(zeroStatusInvoiceAccounts, function (account) {
                    account.isNotCycleCount = true;
                    accountsArray.push(account);
                });
                debug('response===', accountsArray);
                var apiResponse = await buildTask({
                    allAccounts: accountsArray
                    /*billingMonth: billingMonth,
                    billingYear: billingYear*/
                });
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
            status: Constants.BILLING_LINE_ITEM_MONTHLY_CRON_JOB_STATUS.FINISH,
            name: Constants.BILLING_LINE_ITEM_MONTHLY_CRON_JOB_NAME
        };
        updateCronJobResponse = await CronJobApi.updateCronJob(options);
        await connection.closeConnectionCronJob();
        debug('..............Job END........ %o', endTimestamp);
    }
};

var buildTask = function (options) {
    return new Promise(async function (resolve, reject) {
        var allAccounts = options.allAccounts;
        /* var billingMonth = options.billingMonth;
         var billingYear = options.billingYear;*/
        var c = 1;
        await PromiseBluebird.each(allAccounts, async function (account) {
            debug('====start====', c++);
            //var domain = 'http://localhost:3000';
            var domain = 'https://test-be.scopehub.org';
            var url = domain + '/api/billing/cycle';
            var option = {
                account: account,
                apiToken: 'xlK6cQsQRkvKdhIYH9n15yuzIhaLuiug'
            };
            var opt = {
                url: url,
                method: 'POST',
                json: true,
                form: option
            };

            await Request(opt, async function (err, response, body) {
                debug('err', err);
                if (err || response.statusCode >= 400) {
                    err = err || new Error(ErrorConfig.MESSAGE.HTTP_REQUEST_FAILED);
                    err.status = err.status || ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                    //return cb2();
                }
                //debug('Final body ', body);
                debug('====== COMPLETE ============', c);
                //await connection.closeConnectionCronJob();
            });
        });
        debug('return here');
        resolve(true);
        /*PromiseBluebird.all(promises, {concurrency: allAccounts.length}).then(async function (value) {
            debug('value ', value);
            resolve(true);
        });*/
    });
};
