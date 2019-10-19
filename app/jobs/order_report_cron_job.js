/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.jobs.order_report_cron_job');
var _ = require('lodash');
var Async = require('async');
var CronJob = require('cron').CronJob;

var DataUtils = require('../lib/data_utils');
var Constants = require('../data/constants');
var CronJobModel = require('../model/cron_job');
var CronJobApi = require('../api/cron_job');
var AccountModel = require('../model/account');
var OrderModel = require('../model/order');
var ScopehubCore = require('../lib/scope_core');
var MWSConfig = require('../config/mws');
var ErrorConfig = require('../data/error');
var amazonMws = require('amazon-mws')(MWSConfig.ACCESS_KEY_ID, MWSConfig.SECRET_ACCESS_KEY);

var ORDERREPORTCRONJOB = Constants.ORDER_REPORT_CRON_JOB;
/*jshint  -W031 : false */
new CronJob(ORDERREPORTCRONJOB.Seconds + ' ' +
  ORDERREPORTCRONJOB.Minutes + ' ' +
  ORDERREPORTCRONJOB.Hours + ' ' +
  ORDERREPORTCRONJOB.DayOfMonth + ' ' +
  ORDERREPORTCRONJOB.Months + ' ' +
  ORDERREPORTCRONJOB.DayOfWeek,
  function () {
      start();
  }, null, true);
debug('..............Order Report Job Initiated Successfully........');

function start() {
    var startTimestamp = DataUtils.getCurrentUtcDateString();
    debug('..............Order Report Update Job Start........ :%o ', startTimestamp);
    var userId = new Date().getTime();
    var cronJobStore = {};
    var listSellers = [];
    var orderParams = [];
    var platform = 'MWS';
    var startTime = startTimestamp;

    Async.series({

        getCronJob: function (cb) {
            CronJobApi.getCronJob({name: 'OrderReportCronJob'}, function (err, cronJob) {
                if (err) {
                    debug('err :%o ', err);
                    return cb();
                }
                cronJobStore = cronJob;
                return cb();
            });
        },

        getAllSellersAccount: function (cb) {
            AccountModel.scan()
              .loadAll()
              .exec(function (err, data) {
                  var sellersAccount = data.Items;
                  sellersAccount.forEach(function (account) {
                      listSellers.push(account.attrs);
                  });

                  listSellers = _.filter(listSellers, function (value) {
                      return !_.isEmpty(value.marketplaces)
                  });
                  return cb(null, listSellers);
              });
        },

        processGetOrdersReport: function (cb) {
            if (_.isEmpty(listSellers)) {
                return cb();
            }

            Async.forEachOfSeries(listSellers, function (valueSeller, key, cbL2) {

                Async.series({

                    getSellerMarketplaces: function (cbL3) {
                        var marketplaces = [];
                        marketplaces = _.filter(valueSeller.marketplaces[platform]);

                        if (_.isEmpty(marketplaces)) {
                            return cbL3();
                        }

                        Async.forEachOfSeries(marketplaces, function (valueMP, key, cbL4) {
                            if (cronJobStore) {
                                var availableFromDate = cronJobStore.endTime;
                            }

                            var mwsOptions = {
                                accessKeyId: MWSConfig.ACCESS_KEY_ID,
                                secretAccessKey: MWSConfig.SECRET_ACCESS_KEY,
                                authToken: valueMP.token,
                                merchantId: valueMP.sellerId,
                                accountId: valueSeller.id,
                                userId: userId + '',
                                marketplaceId: (valueMP.id || MWSConfig.DEFAULT_MARKETPLACE),
                                availableFromDate: availableFromDate
                            };
                            var data = {
                                'Version': '2009-01-01',
                                'Action': 'GetReportList',
                                'SellerId': mwsOptions.merchantId,
                                'MWSAuthToken': mwsOptions.authToken,
                                'ReportTypeList.Type.1': '_GET_FLAT_FILE_ORDERS_DATA_'
                            };
                            if (mwsOptions.availableFromDate) {
                                data['AvailableFromDate'] = new Date(mwsOptions.availableFromDate)
                            }
                            var shCore = new ScopehubCore(platform, mwsOptions);
                            shCore.logTransaction('GetReportList', {}, 'REQUEST', {}, '', {});

                            amazonMws.reports.search(data, function (err, reportList) {
                                if (err) {
                                    debug('err ', err);
                                    shCore.logTransaction('GetReportList', {}, 'RESPONSE', JSON.stringify(err), err.RequestId, err);
                                    return cbL4();
                                }
                                if (reportList.ReportInfo) {
                                    var reports = reportList.ReportInfo;
                                }
                                shCore.logTransaction('GetReportList', {}, 'RESPONSE', reportList, reportList.ResponseMetadata.RequestId, reportList);
                                if (_.isEmpty(reports)) {
                                    return cbL4();
                                }

                                Async.forEachOfSeries(reports, function (report, key, cbL5) {
                                    shCore.logTransaction('GetReport', {}, 'REQUEST', {}, '', {});
                                    amazonMws.reports.search({
                                        'Version': '2009-01-01',
                                        'Action': 'GetReport',
                                        'SellerId': mwsOptions.merchantId,
                                        'MWSAuthToken': mwsOptions.authToken,
                                        'ReportId': report.ReportId
                                    }, function (err, orderReport) {
                                        if (err) {
                                            shCore.logTransaction('GetReport', {}, 'RESPONSE', JSON.stringify(err), err.RequestId, err);
                                            debug('err ', err);
                                            return cbL5();
                                        }
                                        shCore.logTransaction('GetReport', {}, 'RESPONSE', orderReport, '', orderReport);

                                        orderReport.forEach(function (d) {
                                            orderParams.push({
                                                accountId: mwsOptions.accountId,
                                                sellerId: mwsOptions.merchantId,
                                                marketplaceId: mwsOptions.marketplaceId,
                                                orderId: d['order-id'],
                                                orderItemId: d['order-item-id'],
                                                purchaseDate: d['purchase-date'],
                                                paymentsDate: d['payments-date'],
                                                buyerEmail: d['buyer-email'],
                                                buyerName: d['buyer-name'],
                                                buyerPhoneNumber: d['buyer-phone-number'],
                                                sku: d['sku'],
                                                productName: d['product-name'],
                                                quantityPurchased: d['quantity-purchased'],
                                                currency: d['currency'],
                                                itemPrice: d['item-price'],
                                                itemTax: d['item-tax'],
                                                shippingPrice: d['shipping-price'],
                                                shippingTax: d['shipping-tax'],
                                                shipServiceLevel: d['ship-service-level'],
                                                recipientName: d['recipient-name'],
                                                shipAddress1: d['ship-address-1'],
                                                shipAddress2: d['ship-address-2'],
                                                shipAddress3: d['ship-address-3'],
                                                shipCity: d['ship-city'],
                                                shipState: d['ship-state'],
                                                shipPostalCode: d['ship-postal-code'],
                                                shipCountry: d['ship-country'],
                                                shipPhoneNumber: d['ship-phone-number'],
                                                deliveryStartDate: d['delivery-start-date'],
                                                deliveryEndDate: d['delivery-end-date'],
                                                deliveryTimeZone: d['delivery-time-zone'],
                                                deliveryInstructions: d['delivery-Instructions'],
                                                MPProductId: d.id,
                                                reportId: report.ReportId,
                                                orderItemQtyPrice: d['order-id'] + '_' + d['order-item-id'] + '_' + d['quantity-purchased'] + '_' + d['item-price']
                                            });
                                        });
                                        return cbL5(null, orderReport)
                                    });
                                }, function (err) {
                                    if (!_.isEmpty(err)) {
                                        debug('err:%o', err);
                                        return cbL4(err);
                                    }
                                    return cbL4();
                                })
                            });
                        }, function (err) {
                            if (!_.isEmpty(err)) {
                                debug('err:%o', err);
                                return cbL3(err);
                            }
                            return cbL3();
                        });
                    }
                }, function (err) {
                    if (!_.isEmpty(err)) {
                        debug('err:%o', err);
                        return cbL2(err);
                    }
                    return cbL2();
                });
            }, function (err) {
                if (!_.isEmpty(err)) {
                    debug('err:%o', err);
                    return cb(err);
                }
                return cb();
            });
        },

        addOrders: function (cb) {
            if (_.isEmpty(orderParams)) {
                return cb();
            }
            var params = {
                overwrite: true
            };
            OrderModel.create(orderParams, params, function (err, orders) {
                if (err || !orders) {
                    debug(err || 'Failed to create products: ');
                    err = new Error(ErrorConfig.MESSAGE.ORDER_CREATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                    return cb(err);
                }
                return cb(null, orders);
            });
        }

    }, function () {
        var endTimestamp = DataUtils.getCurrentUtcDateString();
        var cronJob = {
            startTime: startTime,
            endTime: endTimestamp
        };
        if (!_.isEmpty(cronJobStore)) {
            cronJob.name = cronJobStore.name;
        } else {
            cronJob.name = 'OrderReportCronJob';
        }
        var params = {
            overwrite: true
        };
        CronJobModel.create(cronJob, params, function (err, cronJob) {
            if (err) {
                debug('err :%o ', err);
                return err;
            }
            cronJobStore = cronJob;
        });
        debug('..............Job END........ %o', endTimestamp);
    });
}
