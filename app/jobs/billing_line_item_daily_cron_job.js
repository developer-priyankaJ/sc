var debug = require('debug')('scopehub.jobs.billing_line_item_daily_cron_job');
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
var moment = require('moment');

var BILLING_LINE_ITEM_DAILY_CRON_JOB = Constants.BILLING_LINE_ITEM_DAILY_CRON_JOB;

new CronJob(BILLING_LINE_ITEM_DAILY_CRON_JOB.Seconds + ' ' +
  BILLING_LINE_ITEM_DAILY_CRON_JOB.Minutes + ' ' +
  BILLING_LINE_ITEM_DAILY_CRON_JOB.Hours + ' ' +
  BILLING_LINE_ITEM_DAILY_CRON_JOB.DayOfMonth + ' ' +
  BILLING_LINE_ITEM_DAILY_CRON_JOB.Months + ' ' +
  BILLING_LINE_ITEM_DAILY_CRON_JOB.DayOfWeek,
  function () {
      start();
  }, null, true);
debug('---------------------Billing line item daily Cron Job Initiated Successfully------------------------');


async function start() {
    var startTime = DataUtils.getCurrentUtcDateString();
    var updateCronJobResponse, createCronJobResponse;
    var accountsArray = [];
    var createRecord = [];
    debug('..............Billing line item daily Job Start.......... %o', startTime);
    try {
        await connection.startConnectionCronJob();
        //debug('here');
        var getCronJob = await CronJobApi.getCronJobMD({name: Constants.BILLING_LINE_ITEM_DAILY_CRON_JOB_NAME});
        var options = {
            startTime: startTime,
            status: Constants.BILLING_LINE_ITEM_DAILY_CRON_JOB_STATUS.PROGRESSING,
            name: Constants.BILLING_LINE_ITEM_DAILY_CRON_JOB_NAME
        };

        if (!getCronJob) {
            createCronJobResponse = await CronJobApi.createCronJob(options);
        } else {
            updateCronJobResponse = await CronJobApi.updateCronJob(options);
        }

        /* try {
             // Get all active accounts who is active on last month
             var allAccounts = await BillingApi.getAccounts();
             debug('allAccounts', allAccounts);

             if (allAccounts.length <= 0) {
                 var err = new Error(ErrorConfig.MESSAGE.ACCOUNT_NOT_FOUND);
                 err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                 debug('err', err);
             } else {
                 // Create billingControl record
                 var createResponse = await BillingApi.createBillingControl({
                     accounts: allAccounts
                 });
                 debug('createResponse', createResponse);
                 _.map(allAccounts, function (account) {
                     var details = {
                         account: account,
                         billingDate: createResponse.billingDate
                     };
                     accountsArray.push(details);
                 });

                 debug('API CALLED------------------------------------------------');
                 var apiResponse = await buildTask({allAccounts: accountsArray});
             }
         } catch (err) {
             debug('err from inner catch block', err);
         }*/
        try {
            // Get accounts whose status is zero
            var zeroStatusAccounts = await BillingApi.getZeroStatusAccounts();
            //debug('zeroStatusAccounts', zeroStatusAccounts);

            _.map(zeroStatusAccounts, function (account) {
                var details = {
                    account: {id: account.id},
                    billingDate: moment(account.billingDate).format('YYYY-MM-DD')
                };
                accountsArray.push(details);
            });
            // Get all active accounts who is active
            var allAccounts = await BillingApi.getAccounts();
            //debug('allAccounts', allAccounts);

            _.map(allAccounts, function (account) {
                createRecord.push({account: {id: account.id}});
            });

            // Get remaining records accounts
            var remainingRecordAccount = await BillingApi.getRemainingRecordAccount();
            // debug('remainingRecordAccount', remainingRecordAccount);

            _.map(remainingRecordAccount, function (account) {
                var lastDate = account.lastDate;
                lastDate = moment(lastDate).add(1, 'd').format('YYYY-MM-DD');
                _.times(account.DateDifference - 2, function () {
                    var details = {
                        account: {id: account.accountId},
                        billingDate: lastDate,
                        isDate: true
                    };
                    accountsArray.push(details);
                    createRecord.push(details);
                });
            });

            // Get remaining new accounts
            var remainingNewAccount = await BillingApi.getRemainingNewAccount();
            // debug('remainingNewAccount', remainingNewAccount);

            _.map(remainingNewAccount, function (account) {
                var lastDate = account.lastDate;
                _.times(account.DateDifference - 1, function () {
                    var details = {
                        account: {id: account.accountId},
                        billingDate: lastDate,
                        isDate: true
                    };
                    accountsArray.push(details);
                    createRecord.push(details);
                    lastDate = moment(lastDate).add(1, 'd').format('YYYY-MM-DD');
                });
            });

            // debug('allAccounts====', allAccounts);
            // debug('create recored========', createRecord);

            // Get accounts for remaining daily bill invoice
            var remainingBillInvoiceDailyAccounts = await BillingApi.getRemainingBillInvoiceDailyAccounts();
            //debug('billInvoiceDailyAccounts', billInvoiceDailyAccounts);

            // Generate record for invoice control
            var generateRecordsForDailyInvoice = await BillingApi.generateRecordsForInvoice({
                accounts: remainingBillInvoiceDailyAccounts,
                add: 'd'
            });
            //debug('records=============', generateRecordsForDailyInvoice);
            // Get accounts for remaining monthly bill invoice
            var remainingBillInvoiceMonthlyAccounts = await BillingApi.getRemainingBillInvoiceMonthlyAccounts();
            //debug('billInvoiceDailyAccounts', billInvoiceDailyAccounts);

            // Generate record for invoice control
            var generateRecordsForMonthlyInvoice = await BillingApi.generateRecordsForInvoice({
                accounts: remainingBillInvoiceMonthlyAccounts,
                add: 'M'
            });
            //debug('records---------------------', generateRecordsForMonthlyInvoice);

            var totalRemainInvoiceAccounts = generateRecordsForDailyInvoice.concat(generateRecordsForMonthlyInvoice);
            //debug('all========================================', totalRemainInvoiceAccounts);

            if (allAccounts.length <= 0) {
                var err = new Error(ErrorConfig.MESSAGE.ACCOUNT_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug('err', err);
            } else {
                // Create billingControl record
                var createResponse = await BillingApi.createBillingControl({
                    accounts: createRecord
                });
               // debug('createResponse', createResponse);

                _.map(allAccounts, function (account) {
                    var details = {
                        account: account,
                        billingDate: createResponse.billingDate
                    };
                    accountsArray.push(details);
                });

               // debug('total account', accountsArray);

                debug('API CALLED------------------------------------------------', accountsArray);

                var apiResponse = await buildTask({allAccounts: accountsArray});
            }
            if (totalRemainInvoiceAccounts.length > 0) {
                var apiMonthlyResponse = await buildTaskInvoice({
                    allAccounts: totalRemainInvoiceAccounts
                });
            }
        } catch (err) {
            debug('err from inner catch block', err);
        }
    } catch (err) {
        debug('err from catch block', err);
    } finally {
        debug('Inside finally');
        var endTimestamp = DataUtils.getCurrentUtcDateString();
        options = {
            endTime: endTimestamp,
            status: Constants.BILLING_LINE_ITEM_DAILY_CRON_JOB_STATUS.FINISH,
            name: Constants.BILLING_LINE_ITEM_DAILY_CRON_JOB_NAME
        };
        debug('1');
        updateCronJobResponse = await CronJobApi.updateCronJob(options);
        debug('2');
        await connection.closeConnectionCronJob();
        debug('3');
        debug('..............Job END........ %o', endTimestamp);
    }
};

var buildTask = function (options) {
    return new Promise(async function (resolve, reject) {
        /* var promises = [];
         var allAccounts = options.allAccounts;
         var billingDate = options.billingDate;*/
        var allAccounts = options.allAccounts;
        var c = 1;
        await PromiseBluebird.each(allAccounts, async function (option) {
            debug('====start====', c++);
            //var domain = 'http://localhost:3000';
            var domain = 'https://test-be.scopehub.org';
            var url = domain + '/api/billing/daily';
            option.apiToken = 'xlK6cQsQRkvKdhIYH9n15yuzIhaLuiug';
            /*var option = {
                account: account,
                billingDate: billingDate,
                apiToken: 'xlK6cQsQRkvKdhIYH9n15yuzIhaLuiug'
            };*/
            var opt = {
                url: url,
                method: 'POST',
                json: true,
                form: option
            };
            debug('result---', option);
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

var buildTaskInvoice = function (options) {
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



