/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.jobs.list_products_status_cron_job');
var _ = require('lodash');
var Async = require('async');
var CronJob = require('cron').CronJob;
var Request = require('request-promise');
var Promise = require('bluebird');
var DataUtils = require('../lib/data_utils');
var connection = require('../lib/connection_util');
var Constants = require('../data/constants');
var CronJobModel = require('../model/cron_job');
var CronJobApi = require('../api/cron_job');
var ProductByMpApi = require('../api/product_by_mp');
var AccountModel = require('../model/account');

var ScopehubCore = require('../lib/scope_core');
var MWSConfig = require('../config/mws');
var ErrorConfig = require('../data/error');
var amazonMws = require('amazon-mws')(MWSConfig.ACCESS_KEY_ID, MWSConfig.SECRET_ACCESS_KEY);

var LIST_PRODUCTS_STATUS_CRON_JOB = Constants.LIST_PRODUCTS_STATUS_CRON_JOB;
/*jshint  -W031 : false */
new CronJob(LIST_PRODUCTS_STATUS_CRON_JOB.Seconds + ' ' +
  LIST_PRODUCTS_STATUS_CRON_JOB.Minutes + ' ' +
  LIST_PRODUCTS_STATUS_CRON_JOB.Hours + ' ' +
  LIST_PRODUCTS_STATUS_CRON_JOB.DayOfMonth + ' ' +
  LIST_PRODUCTS_STATUS_CRON_JOB.Months + ' ' +
  LIST_PRODUCTS_STATUS_CRON_JOB.DayOfWeek,
  function () {
      start();
  }, null, true);
debug('..............List product status Job Initiated Successfully........');

async function start() {
    debug('..............List product status Job Start..........');
    var startTime = DataUtils.getCurrentUtcDateString();

    try {
        await connection.startConnectionCronJob();
        var getCronJob = await CronJobApi.getCronJobMD({name: Constants.LIST_PRODUCTS_STATUS_CRON_JOB_NAME});
        var options = {
            startTime: startTime,
            status: Constants.LIST_PRODUCTS_STATUS_CRON_JOB_STATUS.PROGRESSING,
            name: Constants.LIST_PRODUCTS_STATUS_CRON_JOB_NAME
        };

        if (!getCronJob) {
            var createCronJob = await CronJobApi.createCronJob(options);
        } else {
            var updateCronJob = await CronJobApi.updateCronJob(options);
        }

        options.listingProductStatus = Constants.LIST_PRODUCT_STATUS.PROGRESSING;

        try {
            var productByMpStore = await ProductByMpApi.getListingProduct(options);
            debug('productByMpStore', productByMpStore);
            if (productByMpStore.length <= 0) {
                debug('reject from empty product by mp store');
            } else {
                promise1(productByMpStore);
            }
        }
        catch (err) {
            debug('err promise.map', err);
        }
    }
    catch (err) {
        debug('err from catch block', err);
    }
    finally {
        var endTimestamp = DataUtils.getCurrentUtcDateString();
        var options = {
            endTime: endTimestamp,
            status: Constants.LIST_PRODUCTS_STATUS_CRON_JOB_STATUS.FINISH,
            name: Constants.LIST_PRODUCTS_STATUS_CRON_JOB_NAME
        };
        var updateCronJob = await CronJobApi.updateCronJob(options);
        await connection.closeConnectionCronJob();
        debug('updateCronJob', updateCronJob);
        debug('..............Job END........ %o', endTimestamp);
    }
}

var promise1 = function (productByMpStore) {
    return new Promise(function (resolve, reject) {
        var promises = [];
        _.each(productByMpStore, function (product) {
            //var url = 'https://test-be.scopehub.org/api/order/replication';
            var url = 'http://127.0.0.1:3000/api/product/submitfeed-report';
            var option = {
                product: product,
                apiToken: 'xlK6cQsQRkvKdhIYH9n15yuzIhaLuiug'
            };
            var opt = {
                url: url,
                method: 'GET',
                json: true,
                form: option
            };
            promises.push(Request(opt));
        });
        debug('insdie request promises');
        Promise.all(promises, {concurrency: productByMpStore.length}).then(async function (value) {
            debug('value ', value);
            resolve(true);
        });
    });
};
