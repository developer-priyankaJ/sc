/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.api.Billing');
var Util = require('util');
var PromiseBluebird = require('bluebird');
var _ = require('lodash');
var moment = require('moment');
var pdf = require('html-pdf');
var path = require('path');
var fs = require('fs');

var DataUtils = require('../lib/data_utils');
var Utils = require('../lib/utils');
var AuditUtils = require('../lib/audit_utils');
var EmailUtils = require('../lib/email_utils');
var connection = require('../lib/connection_util');
var ErrorUtils = require('../lib/error_utils');
var S3Utils = require('../lib/s3_utils');
var Constants = require('../data/constants');
var ErrorConfig = require('../data/error');
var UserApi = require('../api/user');
var AccountApi = require('../api/account');
var PlanApi = require('../api/plan');
var s3 = require('../model/s3');


var Billing = {

    /*
    * Get all active accounts
    * */
    getAccounts: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var status = Constants.ACCOUNT_STATUS.ACTIVE;
            try {
                var conn = await connection.getConnection();

                var accounts = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id ' +
                  ' from accounts where status= ? ', [status]);

                accounts = [
                    {id: '236c9b39-9fd9-4774-8456-64b0bc5d1d32'},
                    {id: '4e2c7f4a-7669-465a-ac71-72da3df89717'},
                    {id: '3ac64a4b-6eca-4d91-931f-8f9bb57d8cbf'},
                    {id: '5ac64431-838a-4887-9eb1-9c1b75aca77d'}
                ];

                return resolve(accounts);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }

        });
    },

    getZeroStatusAccounts: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var status = Constants.BILLING_CONTROL_STATUS.NOT_COMPLETE;
            try {
                var conn = await connection.getConnection();

                var accounts = await conn.query('SELECT CAST(uuid_from_bin(accountId) as CHAR) as id, billingDate' +
                  ' FROM BillingControl WHERE STATUS = ?', [status]);
                return resolve(accounts);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }

        });
    },

    getRemainingRecordAccount: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var conn = await connection.getConnection();

                var accounts = await conn.query('SELECT CAST(uuid_from_bin(B.accountId) as CHAR) as accountId,MAX(B.billingDate) as lastDate,' +
                  ' DATEDIFF(NOW(),MAX(B.billingDate)) AS DateDifference FROM BillingControl B, AccountPlans AP, PlanReference PR ' +
                  ' WHERE AP.accountId = B.accountId AND AP.planReferenceId = PR.id AND PR.NAME != 0 AND PR.NAME != 1 ' +
                  ' GROUP BY B.accountId  HAVING DateDifference > 2');

                return resolve(accounts);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }

        });
    },

    getRemainingBillInvoiceDailyAccounts: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var conn = await connection.getConnection();

                var accounts = await conn.query('SELECT CAST(uuid_from_bin(AP.accountId) as CHAR) as accountId,AP.billingCycleStartDate,' +
                  ' AP.billingCycleEndDate,TIMESTAMPDIFF(DAY ,FROM_UNIXTIME(AP.billingCycleEndDate/1000,\'%Y-%m-%d\'),NOW()) AS dateDifference, ' +
                  ' AP.billCycleCount,PR.name FROM AccountPlans AP, PlanReference PR WHERE AP.planReferenceId = PR.id AND AP.effectiveToDate = 0' +
                  ' AND PR.NAME IN (2,4,6) HAVING dateDifference > AP.billCycleCount');

                return resolve(accounts);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }

        });
    },

    getRemainingBillInvoiceMonthlyAccounts: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var conn = await connection.getConnection();

                var accounts = await conn.query('SELECT CAST(uuid_from_bin(AP.accountId) as CHAR) as accountId,AP.billingCycleStartDate,' +
                  ' AP.billingCycleEndDate,TIMESTAMPDIFF(MONTH ,FROM_UNIXTIME(AP.billingCycleEndDate/1000,\'%Y-%m-%d\'),NOW()) AS dateDifference, ' +
                  ' AP.billCycleCount,PR.name FROM AccountPlans AP, PlanReference PR WHERE AP.planReferenceId = PR.id AND AP.effectiveToDate = 0' +
                  ' AND PR.NAME IN (2,5,7) HAVING dateDifference > AP.billCycleCount');

                return resolve(accounts);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }

        });
    },

    generateRecordsForInvoice: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var accounts = options.accounts;
                var add = options.add;
                var invoiceAccounts = [];
                _.map(accounts, function (account) {
                    debug('account======', account);
                    var startDate = account.billingCycleStartDate;
                    var endDate = account.billingCycleEndDate;
                    _.times(parseInt(account.dateDifference / account.billCycleCount), function () {
                        var details = {
                            accountId: account.accountId,
                            billingCycleStartDate: startDate,
                            billingCycleEndDate: endDate,
                            name: account.name,
                            billCycleCount: account.billCycleCount
                        };
                        startDate = endDate + 1;
                        endDate = moment(endDate).add(account.billCycleCount, add).valueOf();
                        invoiceAccounts.push(details);
                    });
                });
                var responseBillInvoice = await Billing.createBillInvoiceControl({accounts: invoiceAccounts});

                //debug('response', responseBillInvoice);
                return resolve(invoiceAccounts);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.CREATE_BILLING_CONTROL_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }

        });
    },

    getRemainingNewAccount: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var conn = await connection.getConnection();

                var accounts = await conn.query('SELECT CAST(uuid_from_bin(accountId) as CHAR) as accountId,FROM_UNIXTIME(AP.effectiveFromDate/1000,\'%Y-%m-%d\') as lastDate,' +
                  ' DATEDIFF(NOW(),FROM_UNIXTIME(AP.effectiveFromDate/1000,\'%Y-%m-%d\')) AS DateDifference FROM AccountPlans AP, PlanReference PR ' +
                  ' WHERE AP.planReferenceId  = PR.id AND PR.NAME != 0 and PR.NAME !=1 AND AP.effectiveToDate = 0 ' +
                  ' AND AP.accountId NOT IN (SELECT B.accountId FROM BillingControl B, AccountPlans AP, PlanReference PR ' +
                  ' WHERE AP.accountId = B.accountId AND AP.planReferenceId = PR.id AND PR.NAME != 0 and PR.NAME !=1 GROUP BY accountId ) HAVING DateDifference > 1');

                return resolve(accounts);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }

        });
    },

    filterAccounts: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var accounts = options.accounts;
            var filteredAccounts = [];
            var currentTime = options.currentTime;
            var date = moment.unix(currentTime / 1000).format('YYYY-MM-DD');
            debug('date', date);


            _.map(accounts, function (account) {
                debug('moment.unix(account.billingCycleEndDate / 1000).format(\'YYYY-MM-DD\')', moment.unix(account.billingCycleEndDate / 1000).format('YYYY-MM-DD'));
                debug('condition', moment.unix(account.billingCycleEndDate / 1000).format('YYYY-MM-DD') <= date);
                if (moment.unix(account.billingCycleEndDate / 1000).format('YYYY-MM-DD') === date) {
                    debug('Inside if===1=23');
                    filteredAccounts.push(account);
                }
            });
            return resolve(filteredAccounts);
        });
    },

    getZeroStatusInvoiceAccounts: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var status = Constants.BILLING_CONTROL_STATUS.NOT_COMPLETE;
            try {
                var conn = await connection.getConnection();

                var accounts = await conn.query('SELECT CAST(uuid_from_bin(accountId) as CHAR) as accountId, ' +
                  ' billingStartDate as billingCycleStartDate,billingEndDate as billingCycleEndDate' +
                  ' FROM BillInvoiceControl WHERE STATUS = ?', [status]);

                return resolve(accounts);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }

        });
    },


    /*
    * Get accounts from accountPlan table who is not in free plan
    * */
    getAccountsByPlan: function () {
        return new PromiseBluebird(async function (resolve, reject) {
            var currentTime = DataUtils.getEpochMSTimestamp();
            var currentDate = new Date();
            currentDate.setMonth(currentDate.getMonth() - 1);
            var month = (currentDate.getMonth()) + 1;
            var year = currentDate.getFullYear();

            try {
                var conn = await connection.getConnection();

                var accounts = await conn.query('select CAST(uuid_from_bin(AP.accountId) as CHAR) as accountId,' +
                  ' CAST(uuid_from_bin(AP.planReferenceId) as CHAR) as planReferenceId,AP.billingCycleStartDate,AP.billingCycleEndDate,' +
                  ' AP.billCycleCount,PR.name ' +
                  ' from AccountPlans AP,PlanReference PR where ' +
                  ' AP.planReferenceId = PR.id and PR.name != ? and PR.name != ? and ' +
                  ' AP.effectiveToDate = 0', [Constants.SUB_SCRIPTION_PLANS.FREE_DAILY, Constants.SUB_SCRIPTION_PLANS.FREE_MONTHLY]);

                /*var accounts = await conn.query('select CAST(uuid_from_bin(accountId) as CHAR) as accountId ' +
                  'from BillingLineItemTotal where month(billingDate)= ? group by  accountId', month);*/

                //remove those contact which is billingCycleEndDate is not match
                var filteredAccounts = await Billing.filterAccounts({accounts: accounts, currentTime: currentTime});

                /*let tempAccounts = [
                    {
                        accountId: '4e2c7f4a-7669-465a-ac71-72da3df89717',
                        billingCycleStartDate: 1553644801000,
                        billingCycleEndDate: 1553817600000,
                        planReferenceId: '404c8227-4a48-11e9-90ae-06a85cad4c86',
                        name: 2,
                        billCycleCount: 2
                    }, {
                        accountId: '3ac64a4b-6eca-4d91-931f-8f9bb57d8cbf',
                        billingCycleStartDate: 1553644801000,
                        billingCycleEndDate: 1553817600000,
                        planReferenceId: '404c8227-4a48-11e9-90ae-06a85cad4c86',
                        name: 2,
                        billCycleCount: 2
                    }, {
                        accountId: '236c9b39-9fd9-4774-8456-64b0bc5d1d32',
                        planReferenceId: '404c8227-4a48-11e9-90ae-06a85cad4c86',
                        billingCycleStartDate: 1553644800001,
                        billingCycleEndDate: 1553797800000,
                        billCycleCount: 2,
                        name: 2
                    }
                ];*/

                var response = {
                    accounts: filteredAccounts
                };
                return resolve(response);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }

        });
    },

    /*
    * Get success and fail(all parts upload to s3 done) file upload logs
    * */
    getFileUploads: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var accountId = options.accountId;
            var billingDate = options.billingDate;
            var status = Constants.UPLOAD_STATUS.COPY_TEMP_DATA_TO_ORIGINAL_SUCCESS;
            var dateFormat = '%Y-%m-%d';

            try {
                var conn = await connection.getConnection();
                var fileUploads = await conn.query('Select id,fileName,fileSize from UploadLog where ' +
                  ' DATE_FORMAT(FROM_UNIXTIME(startTime/1000), ?) = ? ' +
                  ' and accountId = uuid_to_bin(?) and status > 3 ;', [dateFormat, billingDate, accountId]);
                if (DataUtils.isArray(fileUploads) && fileUploads.length <= 0) {
                    debug('Inside if');
                    return resolve([]);
                }
                return resolve(fileUploads);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.UPLOAD_LOG_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /**
     * Get file download logs
     */
    getFileDownloads: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var accountId = options.accountId;
            var billingDate = options.billingDate;
            var dateFormat = '%Y-%m-%d';

            try {
                var conn = await connection.getConnection();
                var fileDownloads = await conn.query('Select CAST(uuid_from_bin(id) as CHAR) as id,fileName,fileSize from ' +
                  ' downloadLog where DATE_FORMAT(FROM_UNIXTIME(startTime/1000), ?) = ? ' +
                  ' and accountId = uuid_to_bin(?) ', [dateFormat, billingDate, accountId]);
                if (DataUtils.isArray(fileDownloads) && fileDownloads.length <= 0) {
                    debug('Inside if');
                    return resolve([]);
                }
                return resolve(fileDownloads);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.DOWNLOAD_LOG_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
    * Get fail(not s3 upload fail) file upload logs
    * */
    getFailFileUploads: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var accountId = options.accountId;
            var billingDate = options.billingDate;
            var status = Constants.UPLOAD_STATUS.S3_UPLOAD_FAILED;
            var dateFormat = '%Y-%m-%d';

            try {
                var conn = await connection.getConnection();
                var failFileUploads = await conn.query('Select UL.id,UL.fileName,UL.fileSize,sum(UP.partSize) fileSizePart ' +
                  ' from UploadLog  UL , UploadPart UP where ' +
                  ' DATE_FORMAT(FROM_UNIXTIME(UL.startTime/1000), ?) = ? and UL.isMultipart = 1 ' +
                  ' and UL.accountId = uuid_to_bin(?) and UL.status = ? and ' +
                  ' UP.fileName = UL.fileName and UP.status = 1 group by UL.id;', [dateFormat, billingDate, accountId, status]);
                if (DataUtils.isArray(failFileUploads) && failFileUploads.length <= 0) {
                    debug('Inside if');
                    return resolve([]);
                }
                return resolve(failFileUploads);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.UPLOAD_LOG_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
    * Get Billing Rates
    * */
    getBillingRate: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var accountId = options.accountId;
            var billingCategory = options.billingCategory;
            var planReferenceId = options.planReferenceId;
            var defaultId = Constants.DEFAULT_REFERE_ID;
            var currentTime = DataUtils.getEpochMSTimestamp();
            var queryString = 'Select CAST(uuid_from_bin(BR.id) as CHAR) as id,BR.accountId,BR.rate,BR.countryCurrencyCode,' +
              ' CAST(uuid_from_bin(BR.billingReferenceId) as CHAR) as billingReferenceId  from BillingRates BR, BillingItemReference BIR where ' +
              ' BR.accountId = uuid_to_bin(?) and BR.planReferenceId = uuid_to_bin(?) and (BR.effectiveToDate = 0 OR ? between BR.effectiveFromDate and BR.effectiveToDate) ' +
              ' and BR.billingReferenceId = BIR.id and BIR.name = ? ;';

            /*var queryString = ' Select id,accountId,rate,currencyUoM,billingCategory from BillingRates where ' +
              ' accountId = uuid_to_bin(?)  and billingCategory=? and ? between effectiveFromDate and effectiveToDate ; ';*/

            try {
                var conn = await connection.getConnection();
                var billingRate = await conn.query('IF EXISTS (select 1 from BillingRates BR, BillingItemReference BIR where ' +
                  ' BR.accountId = uuid_to_bin(?) and BR.planReferenceId = uuid_to_bin(?) and (BR.effectiveToDate = 0 OR ? between BR.effectiveFromDate and BR.effectiveToDate) and ' +
                  ' BR.billingReferenceId = BIR.id and BIR.name = ? ) THEN ' + queryString + ' ELSE ' + queryString + ' END IF; ',
                  [accountId, planReferenceId, currentTime, billingCategory, accountId, planReferenceId, currentTime, billingCategory,
                      defaultId, planReferenceId, currentTime, billingCategory]);
                billingRate = Utils.filteredResponsePool(billingRate);
                return resolve(billingRate[0]);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.GET_BILLING_RATES_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    calculateAmountInBound: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var billingRate = options.billingRate;
            var size = options.size;
            debug('options', options);
            size = (size / (1024 * 1024));
            debug('size', size);
            var amount = billingRate * size;
            return resolve({amount: amount, size: size});
        });
    },

    /*
    * Insert multiple BLI detail records
    * */
    insertBLIDetails: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var list = options.list;
            var convertedList, keys, err;
            await Utils.convertObjectToArrayMD(list, async function (err, response) {
                if (err) {
                    debug('err', err);
                    return reject(err);
                }
                convertedList = response.list;
                keys = response.keys;

                var query = 'insert into BillingItemDetail (' + keys + ') values';

                var values = ' (uuid_to_bin(?),uuid_to_bin(?),?,?,?,?,?,?) ';

                await PromiseBluebird.each(list, function (value) {
                    query = query + values;
                    query = query + ',';
                });

                query = query.replace(/,\s*$/, '');

                try {
                    var conn = await connection.getConnection();
                    var bliDetailInsterted = await conn.query(query, convertedList);
                    bliDetailInsterted = Utils.isAffectedPool(bliDetailInsterted);

                    debug('bliDetailInsterted ----------------------------------', bliDetailInsterted);
                    if (!bliDetailInsterted) {
                        throw err;
                    }
                    return resolve(Constants.OK_MESSAGE);
                } catch (err) {
                    debug('err', err);
                    err = new Error(ErrorConfig.MESSAGE.BILLING_LINE_ITEM_DETAIL_CREATION_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
            });
        });
    },

    /*
    * Insert BLI Total record
    * */
    insertBLITotal: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var accountId = options.accountId;
            var rateId = options.rateId;
            var totalSize = options.totalSize;
            var totalAmount = options.totalAmount;
            var billingReferenceId = options.billingReferenceId;
            var billingDate = options.billingDate;
            var currentTime = DataUtils.getEpochMSTimestamp();

            try {
                var conn = await connection.getConnection();
                var insertResponse = await conn.query('Insert into BillingItemDailyTotal (accountId,rateId,billingReferenceId,totalSize,totalAmount,' +
                  'billingDate,createdAt,updatedAt) values (uuid_to_bin(?),uuid_to_bin(?),uuid_to_bin(?),?,?,?,?,?) ',
                  [accountId, rateId, billingReferenceId, totalSize, totalAmount, billingDate, currentTime, currentTime]);
                insertResponse = Utils.isAffectedPool(insertResponse);
                if (!insertResponse) {
                    throw err;
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.BILLING_LINE_ITEM_TOTAL_CREATION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
    * Calculate amount for Inbound 
    * */
    calculateInboundAmount: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var accountId = options.accountId;
            var accountPlan = options.accountPlan;
            var billingDate = options.billingDate;
            //var billingDate = new Date('2019-02-25T12:56:30.771Z');
            var billingCategory = options.billingCategory;
            var billingRate;
            var BLIDetailList = [];
            var totalAmount = 0, totalSize = 0, fileUploads;

            try {
                // Get rates of accounts
                billingRate = await Billing.getBillingRate({
                    accountId: accountId,
                    billingCategory: billingCategory,
                    planReferenceId: accountPlan.planReferenceId
                });

                debug('1', billingRate);
                // Get file uploads who successfully upload to s3
                var getUploadOption = {
                    accountId: accountId,
                    billingDate: billingDate
                };
                var fileSuccessUploads = await Billing.getFileUploads(getUploadOption);
                debug('fileSuccessUploads', fileSuccessUploads.length);


                // Get file uploads who fail to upload on s3
                var getFailUploadOption = {
                    accountId: accountId,
                    billingDate: billingDate
                };
                var failFileUploads = await Billing.getFailFileUploads(getFailUploadOption);
                debug('failFileUploads', failFileUploads.length);

                fileUploads = fileSuccessUploads.concat(failFileUploads);


                // Calculate amount for each file upload
                debug('2');
                var c = 0;
                if (fileUploads.length > 0) {
                    await PromiseBluebird.each(fileUploads, async function (fileUpload) {
                        debug('c++', c++);
                        var currentTime = DataUtils.getEpochMSTimestamp();
                        // calculate amount
                        var calculateResponse = await Billing.calculateAmountInBound({
                            billingRate: billingRate.rate,
                            size: fileUpload.fileSize
                        });
                        totalAmount += calculateResponse.amount;
                        totalSize += calculateResponse.size;

                        var BLIDetailOption = {
                            accountId: accountId,
                            billingReferenceId: billingRate.billingReferenceId,
                            sourceId: fileUpload.id,
                            billingDate: billingDate,
                            size: fileUpload.fileSize,
                            amount: calculateResponse.amount,
                            createdAt: currentTime,
                            updatedAt: currentTime
                        };
                        BLIDetailList.push(BLIDetailOption);
                    });

                    debug('3', BLIDetailList.length);
                    // Create BLI detail record (multiple insert)
                    var createBLIDetailOption = {
                        list: BLIDetailList
                    };
                    var createBLIDetailResponse = await Billing.insertBLIDetails(createBLIDetailOption);
                    debug('createBLIDetailResponse', createBLIDetailResponse);
                }

                // Create BLI total record (single insert)
                debug('4');
                if (fileUploads.length <= 0) {
                    totalAmount = 0;
                    totalSize = 0;
                }
                var createBLITotalOption = {
                    accountId: accountId,
                    rateId: billingRate.id,
                    billingReferenceId: billingRate.billingReferenceId,
                    totalAmount: totalAmount,
                    totalSize: totalSize,
                    billingDate: billingDate
                };
                debug('createBLITotalOption', createBLITotalOption);
                var createBLITotalResponse = await Billing.insertBLITotal(createBLITotalOption);
                debug('5', createBLITotalResponse);
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    calculateInboudDailyBill: async function (options, errorOptions, cb) {
        var account = options.account;
        var accountPlan = options.accountPlan;
        var billingDate = options.billingDate;
        var accountId = account.id;
        try {
            //Calculate for Inbound category
            var calculateInboundAmountOption = {
                accountId: accountId,
                accountPlan: accountPlan,
                billingDate: billingDate,
                billingCategory: Constants.BILLING_LINE_ITEM.IN_BOUND_DATA_TRANSFER
            };
            debug('calculateInboundAmountOption', calculateInboundAmountOption);
            var calculateInboundAmountResponse = await Billing.calculateInboundAmount(calculateInboundAmountOption);

            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
    },

    calculateOutboundDailyBill: async function (options, errorOptions, cb) {
        debug('inside out bound');
        var account = options.account;
        var accountPlan = options.accountPlan;
        var billingDate = options.billingDate;
        var billingCategory = Constants.BILLING_LINE_ITEM.OUT_BOUND_DATA_TRANSFER;
        var accountId = account.id;
        var totalAmount = 0, totalSize = 0;
        var BLIDetailList = [];
        try {

            // Calculate Billing rate
            var billingRate = await Billing.getBillingRate({
                accountId: accountId,
                billingCategory: billingCategory,
                planReferenceId: accountPlan.planReferenceId
            });

            debug('1', billingRate);

            // Get file downloads
            var getDownloadOption = {
                accountId: accountId,
                billingDate: billingDate
            };
            var fileDownloads = await Billing.getFileDownloads(getDownloadOption);
            debug('fileSuccessDownloads', fileDownloads.length);

            if (fileDownloads.length > 0) {
                await PromiseBluebird.each(fileDownloads, async function (fileDownload) {
                    var currentTime = DataUtils.getEpochMSTimestamp();
                    // calculate amount
                    var calculateResponse = await Billing.calculateAmountInBound({
                        billingRate: billingRate.rate,
                        size: fileDownload.fileSize
                    });
                    totalAmount += calculateResponse.amount;
                    totalSize += calculateResponse.size;

                    var BLIDetailOption = {
                        accountId: accountId,
                        billingReferenceId: billingRate.billingReferenceId,
                        sourceId: fileDownload.id,
                        billingDate: billingDate,
                        size: fileDownload.fileSize,
                        amount: calculateResponse.amount,
                        createdAt: currentTime,
                        updatedAt: currentTime
                    };
                    BLIDetailList.push(BLIDetailOption);
                });

                debug('3', BLIDetailList);
                // Create BLI detail record (multiple insert)
                var createBLIDetailOption = {
                    list: BLIDetailList
                };
                var createBLIDetailResponse = await Billing.insertBLIDetails(createBLIDetailOption);
                debug('createBLIDetailResponse', createBLIDetailResponse);
            }

            // Create BLI total record (single insert)
            debug('4');
            if (fileDownloads.length <= 0) {
                totalAmount = 0;
                totalSize = 0;
            }
            var createBLITotalOption = {
                accountId: accountId,
                rateId: billingRate.id,
                billingReferenceId: billingRate.billingReferenceId,
                totalAmount: totalAmount,
                totalSize: totalSize,
                billingDate: billingDate
            };
            debug('createBLITotalOption', createBLITotalOption);
            var createBLITotalResponse = await Billing.insertBLITotal(createBLITotalOption);
            debug('5', createBLITotalResponse);

            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
    },

    getOutSharedDataPoints: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var billingDate = options.billingDate;
            var accountId = options.accountId;
            var defaultFormat = Constants.DEFAULT_FORMAT;

            try {
                var conn = await connection.getConnection();

                var dataPoints = await conn.query('select count(*) as points,CAST(uuid_from_bin(outShareInstanceId) as CHAR) as outShareInstanceId' +
                  ' from SharedData where ' +
                  'accountId = uuid_to_bin(?) and inSharePartnerId != uuid_to_bin(?) ' +
                  'and from_unixtime(effectiveSharedDateTime/1000,?) = ? group by outShareInstanceId',
                  [accountId, Constants.DEFAULT_REFERE_ID, defaultFormat, billingDate]);
                if (!dataPoints || !DataUtils.isArray(dataPoints) || dataPoints.length <= 0) {
                    return resolve([]);
                }
                return resolve(dataPoints);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.DATA_POINT_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    calculateAmountShare: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var size = options.size;
            var billingRate = options.billingRate;
            var amount;
            amount = size * billingRate;
            return resolve({amount: amount, size: size});
        });
    },

    calculateShareTransferAmount: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var dataPoints = options.dataPoints;
            var billingDate = options.billingDate;
            var accountId = options.accountId;
            var billingRate = options.billingRate;
            var isInShare = options.isInShare;
            var BLIDetailList = [];
            var totalAmount = 0;
            var totalSize = 0;

            await PromiseBluebird.each(dataPoints, async function (dataPoint) {
                var currentTime = DataUtils.getEpochMSTimestamp();
                // calculate amount
                var calculateResponse = await Billing.calculateAmountShare({
                    billingRate: billingRate.rate,
                    size: dataPoint.points
                });
                totalAmount += calculateResponse.amount;
                totalSize += calculateResponse.size;

                var BLIDetailOption = {
                    accountId: accountId,
                    billingReferenceId: billingRate.billingReferenceId,
                    sourceId: dataPoint.outShareInstanceId,
                    billingDate: billingDate,
                    size: calculateResponse.size,
                    amount: calculateResponse.amount,
                    createdAt: currentTime,
                    updatedAt: currentTime
                };
                if (isInShare) {
                    BLIDetailOption.sourceId = dataPoint.inShareId;
                }
                BLIDetailList.push(BLIDetailOption);
            });
            var response = {
                BLIDetailList: BLIDetailList,
                totalAmount: totalAmount,
                totalSize: totalSize
            };
            return resolve(response);
        });
    },

    calculateOutSharingDailyBill: async function (options, errorOptions, cb) {
        var account = options.account;
        var accountPlan = options.accountPlan;
        var billingDate = options.billingDate;
        var accountId = account.id;
        var billingCategory = Constants.BILLING_LINE_ITEM.OUT_SHARING_DATA_TRANSFER;
        var BLIDetailList = [], totalAmount, totalSize;
        try {
            // Get sharing Data point by billing date
            var getSharedDataPointOption = {
                accountId: accountId,
                billingDate: billingDate
            };
            var dataPoints = await Billing.getOutSharedDataPoints(getSharedDataPointOption);
            debug('dataPoints', dataPoints);

            //Get billing Rates of accounts
            var getBillingRateOption = {
                accountId: accountId,
                billingCategory: billingCategory,
                planReferenceId: accountPlan.planReferenceId
            };
            debug('getBillingRateOption', getBillingRateOption);
            var billingRate = await Billing.getBillingRate(getBillingRateOption);
            debug('billingRate', billingRate);

            // calculate amount
            var calculateOption = {
                dataPoints: dataPoints,
                accountId: accountId,
                billingDate: billingDate,
                billingRate: billingRate
            };
            var calculateResponse = await Billing.calculateShareTransferAmount(calculateOption);
            debug('calculateResponse', calculateResponse);
            if (calculateResponse) {
                BLIDetailList = calculateResponse.BLIDetailList;
                totalAmount = calculateResponse.totalAmount;
                totalSize = calculateResponse.totalSize;
            }

            // insert into BLIdetail table
            if (DataUtils.isArray(BLIDetailList) && BLIDetailList.length > 0) {
                var createBLIDetailOption = {
                    list: BLIDetailList
                };
                var createBLIDetailResponse = await Billing.insertBLIDetails(createBLIDetailOption);
                debug('createBLIDetailResponse', createBLIDetailResponse);
            }

            // insert into BLITotal table
            if (BLIDetailList.length <= 0) {
                totalAmount = 0;
                totalSize = 0;
            }
            var createBLITotalOption = {
                accountId: accountId,
                rateId: billingRate.id,
                billingReferenceId: billingRate.billingReferenceId,
                totalAmount: totalAmount,
                totalSize: totalSize,
                billingDate: billingDate
            };
            debug('createBLITotalOption', createBLITotalOption);
            var createBLITotalResponse = await Billing.insertBLITotal(createBLITotalOption);
            debug('5', createBLITotalResponse);

            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
    },

    getInSharedDataPoints: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var billingDate = options.billingDate;
            var accountId = options.accountId;
            var defaultFormat = Constants.DEFAULT_FORMAT;

            try {
                var conn = await connection.getConnection();

                var dataPoints = await conn.query('select count(*) as points,CAST(uuid_from_bin(outShareInstanceId) as CHAR) ' +
                  ' as outShareInstanceId, CAST(uuid_from_bin(inShareId) as CHAR) as inShareId ' +
                  ' from SharedData where  inSharePartnerId = uuid_to_bin(?) ' +
                  ' and from_unixtime(effectiveSharedDateTime/1000,?) = ? group by inShareId ',
                  [accountId, defaultFormat, billingDate]);
                if (!dataPoints || !DataUtils.isArray(dataPoints) || dataPoints.length <= 0) {
                    debug('Inside if');
                    return resolve([]);
                }
                return resolve(dataPoints);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.DATA_POINT_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    calculateInSharingDailyBill: async function (options, errorOptions, cb) {
        debug('Insie calculateInSharingDailyBill');
        var account = options.account;
        var accountPlan = options.accountPlan;
        var billingDate = options.billingDate;
        var accountId = account.id;
        var billingCategory = Constants.BILLING_LINE_ITEM.IN_SHARING_DATA_TRANSFER;
        var BLIDetailList = [], totalAmount, totalSize;
        try {
            // Get sharing Data point by billing date
            var getInSharedDataPointOption = {
                accountId: accountId,
                billingDate: billingDate
            };
            var dataPoints = await Billing.getInSharedDataPoints(getInSharedDataPointOption);
            debug(' insharing dataPoints', dataPoints);

            //Get billing Rates of accounts
            var getBillingRateOption = {
                accountId: accountId,
                billingCategory: billingCategory,
                planReferenceId: accountPlan.planReferenceId
            };
            debug('getBillingRateOption', getBillingRateOption);
            var billingRate = await Billing.getBillingRate(getBillingRateOption);
            debug('billingRate', billingRate);

            // calculate amount
            var calculateOption = {
                dataPoints: dataPoints,
                accountId: accountId,
                billingDate: billingDate,
                billingRate: billingRate,
                isInShare: 1
            };
            var calculateResponse = await Billing.calculateShareTransferAmount(calculateOption);
            debug('calculateResponse', calculateResponse);
            if (calculateResponse) {
                BLIDetailList = calculateResponse.BLIDetailList;
                totalAmount = calculateResponse.totalAmount;
                totalSize = calculateResponse.totalSize;
            }

            // insert into BLIdetail table
            if (DataUtils.isArray(BLIDetailList) && BLIDetailList.length > 0) {
                var createBLIDetailOption = {
                    list: BLIDetailList
                };
                var createBLIDetailResponse = await Billing.insertBLIDetails(createBLIDetailOption);
                debug('createBLIDetailResponse', createBLIDetailResponse);
            }

            // insert into BLITotal table
            if (BLIDetailList.length <= 0) {
                totalAmount = 0;
                totalSize = 0;
            }
            var createBLITotalOption = {
                accountId: accountId,
                rateId: billingRate.id,
                billingReferenceId: billingRate.billingReferenceId,
                totalAmount: totalAmount,
                totalSize: totalSize,
                billingDate: billingDate
            };
            debug('createBLITotalOption', createBLITotalOption);
            var createBLITotalResponse = await Billing.insertBLITotal(createBLITotalOption);
            debug('5', createBLITotalResponse);

            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
    },

    calculateDailyBill: async function (options, errorOptions, cb) {
        var account = options.account;
        var accountPlan = options.accountPlan;
        var billingDate = options.billingDate;
        var accountId = account.id;
        var billingCategories = Object.values(Constants.BILLING_LINE_ITEM);

        try {
            await PromiseBluebird.each(billingCategories, async function (billingCategory) {
                if (billingCategory === 3) {

                    //Get billing Rates of accounts
                    var getBillingRateOption = {
                        accountId: accountId,
                        billingCategory: billingCategory,
                        planReferenceId: accountPlan.planReferenceId
                    };
                    //debug('getBillingRateOption', getBillingRateOption);
                    var billingRate = await Billing.getBillingRate(getBillingRateOption);
                    //debug('billingRate', billingRate);

                    // Get rates of accounts
                    /*var billingRate = await Billing.getBillingRate({
                        accountId: accountId,
                        billingCategory: billingCategory
                    });*/
                    var billingItemReference = await Billing.getBillRefereceByname({name: billingCategory});

                    var createBLITotalOption = {
                        accountId: accountId,
                        rateId: billingRate.id,
                        billingReferenceId: billingItemReference.id,
                        totalAmount: 0,
                        totalSize: 0,
                        billingCategory: billingCategory,
                        billingDate: billingDate
                    };
                    debug('createBLITotalOption', createBLITotalOption);
                    var createBLITotalResponse = await Billing.insertBLITotal(createBLITotalOption);
                    debug('createBLITotalResponse', createBLITotalResponse);
                }
            });

            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
    },

    calculateUserAmount: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var numberOfUsers = options.numberOfUsers || 0;
            var rate = options.rate;
            var totalDayOfMonth = options.totalDayOfMonth;
            var totalAmount;

            if (parseInt(numberOfUsers) === 0) {
                debug('Inside if');
                return resolve(0);
            }
            totalAmount = (parseInt(numberOfUsers) * rate) / parseInt(totalDayOfMonth);
            return resolve({amount: totalAmount, size: numberOfUsers});
        });
    },

    getBillRefereceByname: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var name = options.name;
            var currentDate = DataUtils.getEpochMSTimestamp();

            try {
                var conn = await connection.getConnection();
                var billReference = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id,name from BillingItemReference' +
                  '  where name = ? and (effectiveToDate = 0 OR ? between effectiveFromDate and effectiveToDate);', [name, currentDate]);
                billReference = Utils.filteredResponsePool(billReference);
                return resolve(billReference);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.BILLING_ITEM_REFERENCE_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    getAccountPlanByAccountId: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var accountId = options.accountId;
            var currentTime = DataUtils.getEpochMSTimestamp();
            var err;
            try {
                var conn = await connection.getConnection();
                debug(' [accountId, currentTime]', [accountId, currentTime]);
                var accountPlan = await conn.query('select CAST(uuid_from_bin(planReferenceId) as CHAR) as planReferenceId from AccountPlans ' +
                  ' where accountId = uuid_to_bin(?) and (effectiveToDate = 0 OR ? between effectiveFromDate and effectiveToDate);', [accountId, currentTime]);
                accountPlan = Utils.filteredResponsePool(accountPlan);

                return resolve(accountPlan);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_PLAN_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    calculateRegisteredUserDailyBill: async function (options, errorOptions, cb) {
        var account = options.account;
        var billingDate = options.billingDate;
        var accountId = account.id;
        var billingCategory = Constants.BILLING_LINE_ITEM.REGISTERD_USER_CHARGES;
        var totalAmount = 0, totalSize = 0;
        var BLIDetailList = [];

        try {
            // Get current plans of account
            var getPlanOption = {
                accountId: accountId
            };
            var accountPlan = await Billing.getAccountPlanByAccountId(getPlanOption);
            debug('accountPlan', accountPlan);


            //Get billing Rates of accounts
            var getBillingRateOption = {
                accountId: accountId,
                billingCategory: billingCategory,
                planReferenceId: accountPlan.planReferenceId
            };
            debug('getBillingRateOption', getBillingRateOption);
            var billingRate = await Billing.getBillingRate(getBillingRateOption);
            debug('billingRate', billingRate);

            // Get users
            var getUserOptions = {
                accountId: accountId,
                billingDate: billingDate
            };
            debug('getUserOptions', getUserOptions);
            var users = await Billing.getActiveUserByAccount(getUserOptions);
            debug('users', users.length);

            var c = 0;
            var totalDayOfMonth = moment(billingDate).daysInMonth();
            if (users.length > 0) {
                await PromiseBluebird.each(users, async function (user) {
                    debug('c++', c++);
                    var currentTime = DataUtils.getEpochMSTimestamp();

                    // Calculate user total amount
                    var calculateOption = {
                        numberOfUsers: 1,
                        totalDayOfMonth: totalDayOfMonth,
                        rate: billingRate.rate
                    };
                    debug('calculateOption', calculateOption);
                    var calculateResponse = await Billing.calculateUserAmount(calculateOption);
                    debug('calculateResponse', calculateResponse);

                    totalAmount += calculateResponse.amount;
                    totalSize += calculateResponse.size;

                    var BLIDetailOption = {
                        accountId: accountId,
                        billingReferenceId: billingRate.billingReferenceId,
                        sourceId: user.id,
                        billingDate: billingDate,
                        size: calculateResponse.size,
                        amount: calculateResponse.amount,
                        createdAt: currentTime,
                        updatedAt: currentTime
                    };
                    BLIDetailList.push(BLIDetailOption);
                });

                debug('3', BLIDetailList.length);
                // Create BLI detail record (multiple insert)
                var createBLIDetailOption = {
                    list: BLIDetailList
                };
                var createBLIDetailResponse = await Billing.insertBLIDetails(createBLIDetailOption);
                debug('createBLIDetailResponse', createBLIDetailResponse);
            }

            //Insert billing daily total record
            var createBLITotalOption = {
                accountId: accountId,
                billingReferenceId: billingRate.billingReferenceId,
                rateId: billingRate.id,
                totalAmount: totalAmount,
                totalSize: totalSize,
                billingDate: billingDate
            };
            debug('createBLITotalOption', createBLITotalOption);
            var createBLITotalResponse = await Billing.insertBLITotal(createBLITotalOption);
            debug('createBLITotalResponse', createBLITotalResponse);

            return cb(null, accountPlan);
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
    },

    /*
    * Insert multiple BLI detail records
    * */
    insertBillingControl: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var list = options.list;
            var convertedList, keys, err;
            await Utils.convertObjectToArrayMD(list, async function (err, response) {
                if (err) {
                    debug('err', err);
                    return reject(err);
                }
                convertedList = response.list;
                keys = response.keys;

                var query = 'insert into BillingControl (' + keys + ') values';

                var values = ' (uuid_to_bin(?),?,?,?,?) ';

                await PromiseBluebird.each(list, function (value) {
                    query = query + values;
                    query = query + ',';
                });

                query = query.replace(/,\s*$/, '');

                try {
                    var conn = await connection.getConnection();
                    var billingControleInsterted = await conn.query(query, convertedList);
                    billingControleInsterted = Utils.isAffectedPool(billingControleInsterted);

                    debug('billingControleInsterted----------------------------------', billingControleInsterted);
                    if (!billingControleInsterted) {
                        throw err;
                    }
                    return resolve(Constants.OK_MESSAGE);
                } catch (err) {
                    debug('err', err);
                    err = new Error(ErrorConfig.MESSAGE.CREATE_BILLING_CONTROL_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
            });
        });
    },

    /*
    * Create billing control record
    * */
    createBillingControl: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var accounts = options.accounts;
            var status = Constants.BILLING_CONTROL_STATUS.NOT_COMPLETE;
            var billingDate = new Date();
            billingDate.setDate(billingDate.getDate() - 1);
            billingDate = moment(billingDate).format('YYYY-MM-DD');
            var billingControlList = [];
            var err;
            debug('billing Date after', billingDate);

            try {
                await PromiseBluebird.each(accounts, function (account) {
                    if (account.isDate) {
                        var billingDate1 = account.billingDate;
                    }
                    var createBillingControlOption = {
                        // accountId: account.id,
                        accountId: account.account.id,
                        //billingDate: billingDate,
                        billingDate: billingDate1 || billingDate,
                        status: status,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        updatedAt: DataUtils.getEpochMSTimestamp()
                    };
                    billingControlList.push(createBillingControlOption);
                });
                if (billingControlList.length > 0) {
                    var createResponse = await Billing.insertBillingControl({list: billingControlList});
                    debug('createResponse', createResponse);
                }
                /*var conn = await connection.getConnection();
                var isInserted = await conn.query('If (select 1 from BillingControl where accountId = uuid_to_bin(?) and billingDate = ?) is null then ' +
                  ' Insert into BillingControl (accountId,billingDate,status,createdAt,updatedAt) values ' +
                  '(uuid_to_bin(?),?,?,?,?); end if;', [accountId, billingDate, accountId, billingDate, status, currentTime, currentTime]);
                isInserted = Utils.isAffectedPool(isInserted);*/
                /*if (!isInserted) {
                    err = new Error(ErrorConfig.MESSAGE.CREATE_BILLING_CONTROL_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }*/
                return resolve({
                    billingDate: billingDate
                });
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.CREATE_BILLING_CONTROL_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                await ErrorUtils.create(errorOptions, options, err);
                return reject(err);
            }
        });
    },

    insertBillInvoiceControl: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var list = options.list;
            var convertedList, keys, err;
            await Utils.convertObjectToArrayMD(list, async function (err, response) {
                if (err) {
                    debug('err', err);
                    return reject(err);
                }
                convertedList = response.list;
                keys = response.keys;

                var query = 'insert into BillInvoiceControl (' + keys + ') values';

                var values = ' (uuid_to_bin(?),?,?,?,?,?) ';

                await PromiseBluebird.each(list, function (value) {
                    query = query + values;
                    query = query + ',';
                });

                query = query.replace(/,\s*$/, '');

                try {
                    var conn = await connection.getConnection();
                    var billingControleInsterted = await conn.query(query, convertedList);
                    billingControleInsterted = Utils.isAffectedPool(billingControleInsterted);

                    debug('billingControleInsterted----------------------------------', billingControleInsterted);
                    if (!billingControleInsterted) {
                        throw err;
                    }
                    return resolve(Constants.OK_MESSAGE);
                } catch (err) {
                    debug('err', err);
                    err = new Error(ErrorConfig.MESSAGE.CREATE_BILLING_CONTROL_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
            });
        });
    },

    createBillInvoiceControl: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var accounts = options.accounts;
            var status = Constants.BILLING_CONTROL_STATUS.NOT_COMPLETE;
            var billingControlList = [];
            var err;

            try {
                await PromiseBluebird.each(accounts, function (account) {
                    var createBillingControlOption = {
                        accountId: account.accountId,
                        billingStartDate: account.billingCycleStartDate,
                        billingEndDate: account.billingCycleEndDate,
                        status: status,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        updatedAt: DataUtils.getEpochMSTimestamp()
                    };
                    billingControlList.push(createBillingControlOption);
                });
                if (billingControlList.length > 0) {
                    var createResponse = await Billing.insertBillInvoiceControl({list: billingControlList});
                    debug('createResponse', createResponse);
                }
                /*return resolve({
                    billingDate: createResponse
                });*/
                return resolve(createResponse);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.CREATE_BILLING_CONTROL_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                await ErrorUtils.create(errorOptions, options, err);
                return reject(err);
            }
        });
    },

    /*
    * update billing control record
    * */
    updateBillingControl: async function (options, errorOptions, cb) {
        var account = options.account;
        var billingDate = options.billingDate;
        var billingCompleted = options.billingCompleted;
        var accountId = account.id;
        var currentTime = DataUtils.getEpochMSTimestamp();
        var status = Constants.BILLING_CONTROL_STATUS.COMPLETE;
        var err;

        if (!billingCompleted) {
            return cb(null, {});
        }
        if (DataUtils.isUndefined(accountId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var isUpdated = await conn.query('update BillingControl set status = ?,updatedAt=? where accountId = uuid_to_bin(?) ' +
              ' and billingDate = ? ;', [status, currentTime, accountId, billingDate]);
            isUpdated = Utils.isAffectedPool(isUpdated);
            if (!isUpdated) {
                err = new Error(ErrorConfig.MESSAGE.UPDATE_BILLING_CONTROL_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            return cb(null, {
                OK: Constants.SUCCESS_MESSAGE.BILLING_CONTROL_UPDATE_SUCCESS
            });
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.UPDATE_BILLING_CONTROL_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    getAccountById: function (options, errorOptions, cb) {
        var accountId = options.accountId;

        AccountApi.getAccountByIdMD(accountId, async function (err, account) {
            if (err) {
                debug('err', err);
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            return cb(null, {account: account, accountId: accountId});
        });

    },

    getActiveUserByAccount: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var accountId = options.accountId;
            var billingDate = options.billingDate;
            var err;

            try {
                var conn = await connection.getConnection();
                var users = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id from users where ' +
                  ' accountId = uuid_to_bin(?) and postRegComplete = 1 and  ' +
                  ' ((status = ?) ' +
                  ' or (date(FROM_UNIXTIME(createdAt/1000)) = ? and status != ? and status != ? ) ' +
                  ' or (date(FROM_UNIXTIME(updatedAt/1000)) = ? and status != ? and status != ? ))',
                  [accountId, Constants.USER_STATUS.ACTIVE, billingDate, Constants.USER_STATUS.ACTIVE, Constants.USER_STATUS.TEMPORARY,
                      billingDate, Constants.USER_STATUS.ACTIVE, Constants.USER_STATUS.TEMPORARY]);
                //debug('users', users);

                return resolve(users);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    calculateUsersAmount: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var totalUsers = options.totalUsers;
            var billingRate = options.billingRate;
            var totalAmount = totalUsers * billingRate;
            return resolve({totalAmount: totalAmount, totalSize: totalUsers});
        });
    },

    createInvoice: async function (options, errorOptions, cb) {
        var account = options.account;
        var accountId = account.accountId;
        var invoiceId = Utils.generateId().uuid;
        var currnetTime = DataUtils.getEpochMSTimestamp();

        try {
            var invoiceNumber = Constants.INVOICE_PREFIX + Math.floor((Math.random() * 99999999) + 1);
            var invoiceOption = {
                id: invoiceId,
                accountId: accountId,
                invoiceNumber: invoiceNumber,
                invoiceGenerationTime: currnetTime,
                invoicePeriodStart: account.billingCycleStartDate,
                invoicePeriodEnd: parseInt(account.billingCycleEndDate) - 1
            };
            var invoiceResponse = await Billing.createInvoiceRecord(invoiceOption);
            debug('invoiceResponse', invoiceResponse);

            return cb(null, invoiceOption);
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
    },

    calculateMonthlyBill: async function (options, errorOptions, cb) {
        var account = options.account;
        var invoice = options.invoice;
        var accountId = account.accountId;
        var accountOwner;

        try {
            // Get accountowner detail
            debug('accountId', accountId);
            accountOwner = await UserApi.getOwnerByAccountIdPromise(accountId);
            debug('accountOwner', accountOwner);

            var calculateMonthlyBillOption = {
                accountId: accountId,
                invoice: invoice,
                account: account
            };
            debug('calculateMonthlyBillOption', calculateMonthlyBillOption);
            var calculateMonthlyBillResponse = await Billing.calculateMonthlyBillByAccount(calculateMonthlyBillOption);
            debug('calculateMonthlyBillResponse', calculateMonthlyBillResponse);
            //var monthlyTotalList = calculateMonthlyBillResponse.monthlyTotalList;

            return cb(null, {calculateMonthlyBillResponse: calculateMonthlyBillResponse, accountOwner: accountOwner});
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    /*
    * Get total from BLITotal by billinb cycle (start and end)
    * */
    getTotalByBillingCycle: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var accountId = options.accountId;
            var account = options.account;
            var billingCycleStartDate = account.billingCycleStartDate;
            var billingCycleEndDate = account.billingCycleEndDate;
            var defaultFormat = Constants.DEFAULT_FORMAT;
            debug('options', options);

            try {
                var conn = await connection.getConnection();

                var BillingPerCycle = await conn.query('select CAST(uuid_from_bin(B.rateId) as CHAR) as billingRateId,' +
                  ' CAST(uuid_from_bin(B.billingReferenceId) as CHAR) as billingReferenceId,sum(B.totalSize) as totalSize,' +
                  ' sum(B.totalAmount) as totalAmount,BR.countryCurrencyCode,BIR.name as billingCategory from BillingItemDailyTotal B, ' +
                  ' BillingRates BR, BillingItemReference BIR where  B.accountId= uuid_to_bin(?) and BR.id = B.rateId and ' +
                  ' BIR.id = B.billingReferenceId and cast(B.billingDate as date) between cast(from_unixtime((?/1000),?) as date) and' +
                  ' cast(date_sub(from_unixtime((?/1000),?), interval 1 day) as date) group by B.billingReferenceId',
                  [accountId, billingCycleStartDate, defaultFormat, billingCycleEndDate, defaultFormat]);

                if (DataUtils.isUndefined(BillingPerCycle) || (DataUtils.isArray(BillingPerCycle) && BillingPerCycle.length <= 0)) {
                    BillingPerCycle = [];
                }
                return resolve(BillingPerCycle);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.MONTHLY_BILL_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                //await ErrorUtils.create(errorOptions, options, err);
                return reject(err);
            }
        });
    },

    /*
    * Insert multiple monthly billing total
    * */
    insertInvoiceBillingTotal: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var list = options.list;
            var convertedList, keys, err;
            await Utils.convertObjectToArrayMD(list, async function (err, response) {
                if (err) {
                    debug('err', err);
                    return reject(err);
                }
                convertedList = response.list;
                keys = response.keys;

                var query = 'insert into BillingItemInvoiceTotal (' + keys + ') values';

                var values = ' (uuid_to_bin(?),uuid_to_bin(?),uuid_to_bin(?),uuid_to_bin(?),?,?,?,?) ';

                await PromiseBluebird.each(list, function (value) {
                    query = query + values;
                    query = query + ',';
                });

                query = query.replace(/,\s*$/, '');

                try {
                    debug('convertedList', convertedList);
                    var conn = await connection.getConnection();
                    var billingInvoiceTotalInsterted = await conn.query(query, convertedList);
                    billingInvoiceTotalInsterted = Utils.isAffectedPool(billingInvoiceTotalInsterted);

                    debug('billingInvoiceTotalInsterted----------------------------------', billingInvoiceTotalInsterted);
                    if (!billingInvoiceTotalInsterted) {
                        throw err;
                    }
                    return resolve(Constants.OK_MESSAGE);
                } catch (err) {
                    debug('err', err);
                    err = new Error(ErrorConfig.MESSAGE.CREATE_BILLING_INVOICE_TOTAL_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
            });
        });
    },

    /*
    * Get max number of users in billingCycle
    * */
    getMaxNumberOfUsersInCycle: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var account = options.account;
            var accountId = account.accountId;
            var billingCycleStartDate = account.billingCycleStartDate;
            var billingCycleEndDate = account.billingCycleEndDate;
            var defaultFormat = Constants.DEFAULT_FORMAT;
            var registeredUserCategory = Constants.BILLING_LINE_ITEM.REGISTERD_USER_CHARGES;
            var err;

            try {
                var conn = await connection.getConnection();

                var response = await conn.query('select max(B.totalSize) as totalSize from BillingItemDailyTotal B,' +
                  ' BillingRates BR, BillingItemReference BIR where  B.accountId= uuid_to_bin(?) and BR.id = B.rateId and ' +
                  ' BIR.id = B.billingReferenceId and BIR.name = ? and cast(B.billingDate as date) between cast(from_unixtime((?/1000),?) as date) and ' +
                  ' cast(date_sub(from_unixtime((?/1000),?),interval 1 day) as date) ',
                  [accountId, registeredUserCategory, billingCycleStartDate, defaultFormat, billingCycleEndDate, defaultFormat]);
                response = Utils.filteredResponsePool(response);
                if (!response) {
                    throw err;
                }
                return resolve(response.totalSize);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.MAX_USER_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },


    /*
    * Get the object with required data in pdf file
    * */
    getFilterResponse: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var bill = options.bill;
            var maxUsers = options.maxUsers;
            var response = {};

            if (bill.billingCategory === Constants.BILLING_LINE_ITEM.REGISTERD_USER_CHARGES) {
                debug('1');
                response.registeredUser = maxUsers + ' ' + Constants.USERS + ' ' + Constants.USER_TEXT;
                response.registeredUserCharge = bill.countryCurrencyCode + ' ' + bill.totalAmount;
            } else if (bill.billingCategory === Constants.BILLING_LINE_ITEM.IN_BOUND_DATA_TRANSFER) {
                debug('2');
                response.inBoundData = bill.totalSize + ' ' + Constants.MB;
                response.inBoundDataCharge = bill.countryCurrencyCode + ' ' + bill.totalAmount;
            } else if (bill.billingCategory === Constants.BILLING_LINE_ITEM.OUT_BOUND_DATA_TRANSFER) {
                debug('3');
                response.outBoundData = bill.totalSize + ' ' + Constants.MB;
                response.outBoundDataCharge = bill.countryCurrencyCode + ' ' + bill.totalAmount;
            } else if (bill.billingCategory === Constants.BILLING_LINE_ITEM.IN_SHARING_DATA_TRANSFER) {
                debug('4');
                response.inShareData = bill.totalSize + ' ' + Constants.DATA_POINTS;
                response.inShareDataCharge = bill.countryCurrencyCode + ' ' + bill.totalAmount;
            } else if (bill.billingCategory === Constants.BILLING_LINE_ITEM.OUT_SHARING_DATA_TRANSFER) {
                debug('5');
                response.outShareData = bill.totalSize + ' ' + Constants.DATA_POINTS;
                response.outShareDataCharge = bill.countryCurrencyCode + ' ' + bill.totalAmount;
            }
            return resolve(response);
        });
    },

    //Calculate monthly total and insert record
    calculateMonthlyBillByAccount: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var accountId = options.accountId;
            var account = options.account;
            var invoice = options.invoice;
            var billTotalList = [];
            var responseObject = {};
            var totalAmount = 0, totalAmountUoM, totalAmountCurrencyCode;

            try {
                // Get total of all billingCategory by billing cycle
                var getMonthlyTotalOption = {
                    accountId: accountId,
                    account: account
                };
                var BillTotals = await Billing.getTotalByBillingCycle(getMonthlyTotalOption);
                debug('BillTotals', BillTotals);

                // Get max users to show in invoice
                var maxUsers = await Billing.getMaxNumberOfUsersInCycle({account: account});

                await PromiseBluebird.each(BillTotals, async function (billTotal) {
                    var currentTime = DataUtils.getEpochMSTimestamp();
                    var id = Utils.generateId().uuid;
                    var monthlyTotalOption = {
                        id: id,
                        invoiceId: invoice.id,
                        billingReferenceId: billTotal.billingReferenceId,
                        billingRateId: billTotal.billingRateId,
                        totalAmount: billTotal.totalAmount,
                        totalSize: billTotal.totalSize,
                        createdAt: currentTime,
                        updatedAt: currentTime
                    };
                    billTotalList.push(monthlyTotalOption);
                    totalAmount += billTotal.totalAmount;
                    totalAmountCurrencyCode = billTotal.countryCurrencyCode;
                    var filteredResponse = await Billing.getFilterResponse({bill: billTotal, maxUsers: maxUsers});
                    debug('filteredResponse', filteredResponse);
                    responseObject = Object.assign(responseObject, filteredResponse);
                });
                responseObject.totalCharge = totalAmount;
                responseObject.totalChargeWithCurrency = totalAmountCurrencyCode + ' ' + totalAmount;
                debug('responseObject', responseObject);

                //Insert bill invoice total into BillingItemInvoiceTotal table (multiple insert)
                if (billTotalList.length > 0) {
                    var insertResponse = await Billing.insertInvoiceBillingTotal({list: billTotalList});
                    debug('insertResponse', insertResponse);
                }

                return resolve(responseObject);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    generateBillPDF: async function (options, errorOptions, cb) {
        var account = options.account;
        var billingResponse = options.billingResponse;
        var accountOwner = options.accountOwner;

        try {

            //Get html and generate pdf
            var generatePDFOption = {
                accountOwner: accountOwner,
                accountId: account.accountId,
                billingResponse: billingResponse
            };
            var generatePDFResponse = await Billing.getBillHTMLAndGeneratePDF(generatePDFOption);
            debug('generatePDFResponse', generatePDFResponse);

            return cb(null, {
                //accountOwner: accountOwner,
                fileName: generatePDFResponse.fileName,
                invoiceRecord: generatePDFResponse.invoiceRecord
            });
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    sendEmailToOwner: async function (options, errorOptions, cb) {
        var accountOwner = options.accountOwner;
        var fileName = options.fileName;
        var account = options.account;
        var accountId = account.accountId;
        var destination = Constants.PDF_DESTINATION;

        try {
            var opt = {
                languageCultureCode: accountOwner.languageCultureCode,
                template: Constants.EMAIL_TEMPLATES.BILLING_EMAIL,
                email: accountOwner.email,
                attachments: [{
                    fileName: fileName,
                    path: destination + fileName
                }]
            };
            var compileOptions = {
                name: accountOwner.firstName,
                month: moment().format('MMMM')
            };
            var response = await EmailUtils.sendEmailPromise(opt, compileOptions);
            debug('response', response);

            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    getBillHTMLAndGeneratePDF: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var accountId = options.accountId;
            var accountOwner = options.accountOwner;
            var billingResponse = options.billingResponse;
            var issueDate = moment().format('DD MMM YYYY');
            try {
                var opt = {
                    languageCultureCode: accountOwner.languageCultureCode,
                    template: Constants.EMAIL_TEMPLATES.BILLING_PDF
                };
                var address = accountOwner.addressLine1 + ', ' + accountOwner.addressLine1 + '\n ' + accountOwner.city + ', ' +
                  accountOwner.state + ', ' + accountOwner.country;

                var compileOptions = {
                    invoiceNumber: Constants.INVOICE_PREFIX + Math.floor((Math.random() * 99999999) + 1),
                    invoiceDate: issueDate,
                    accountOwner: accountOwner.firstName + ' ' + accountOwner.lastName,
                    address: address,
                    registeredUser: billingResponse.registeredUser,
                    registeredUserCharge: billingResponse.registeredUserCharge,
                    inBoundData: billingResponse.inBoundData,
                    inBoundDataCharge: billingResponse.inBoundDataCharge,
                    outBoundData: billingResponse.outBoundData,
                    outBoundDataCharge: billingResponse.outBoundDataCharge,
                    inShareData: billingResponse.inShareData,
                    inShareDataCharge: billingResponse.inShareDataCharge,
                    outShareData: billingResponse.outShareData,
                    outShareDataCharge: billingResponse.outShareDataCharge,
                    totalData: Constants.TOTAL_SIZE,
                    totalCharge: billingResponse.totalChargeWithCurrency
                };
                var fileName = compileOptions.invoiceNumber + '_' + compileOptions.accountOwner + '.pdf';

                //build invoice option
                var invoiceRecord = {
                    invoiceNumber: compileOptions.invoiceNumber,
                    totalAmount: billingResponse.totalCharge
                };

                // SEND EMAIL
                var HTMLResponse = await EmailUtils.getBillingHTML(opt, compileOptions);

                //generate pdf
                var generatePDFOption = {
                    html: HTMLResponse.html,
                    title: fileName
                };
                var generatePDFResponse = await Billing.generatePDF(generatePDFOption);

                return resolve({fileName: generatePDFOption.title, invoiceRecord: invoiceRecord});
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.PDF_GENERATION_IS_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    generatePDF: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var html = options.html;
            var title = options.title;
            var destination = '/mnt/db_csv/PDF/';
            destination = path.resolve(__dirname, destination);
            var pdfOptions = {format: 'A4'};

            pdf.create(html, pdfOptions).toFile(destination + '/' + title, function (err, response) {
                if (err) {
                    debug('err', err);
                    return reject(err);
                }
                debug('res', response);
                return resolve(response);
            });
        });
    },

    uploadFileToS3: function (options, errorOptions, cb) {
        debug('options', options);
        var fileName = options.fileName;
        var s3FileName = options.s3FileName;
        var accountId = options.accountId;
        var type = Constants.CONTENT_TYPE.APPLICATION_PDF;
        var destination = accountId + '/' + Constants.S3_FOLDER.BILLING_PDF;
        var filePath = Constants.PDF_DESTINATION + '/' + fileName;


        try {
            /*
            * read pdf file
            * */
            fs.readFile(filePath, async function (err, data) {
                if (err) {
                    debug('err', err);
                    err = new Error(ErrorConfig.MESSAGE.FILE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
                debug('file Data', data);
                var buffer = new Buffer(data, 'binary');
                /*
                * Upload pdf to s3 bucket
                * */
                S3Utils.putObject(buffer, s3FileName, type, destination, Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET, '', async function (err, file) {
                    if (err) {
                        debug('err', err);
                        err = new Error(ErrorConfig.MESSAGE.UPLOAD_PDF_FILE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                        await ErrorUtils.create(errorOptions, options, err);
                        return cb(err);
                    }

                    /*
                    * remove file from EFS
                    * */
                    /*if (fs.existsSync(filePath) === true) {
                        fs.unlinkSync(filePath);
                    }*/

                    return cb(null, Constants.OK_MESSAGE);
                });
            });
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
    },

    updateInvoice: async function (options, errorOptions, cb) {
        var invoice = options.invoice;
        var invoiceId = invoice.id;
        var accountId = invoice.accountId;
        var invoiceRecord = options.invoiceRecord;
        var invoiceNumber = invoiceRecord.invoiceNumber;
        var totalAmount = invoiceRecord.totalAmount;
        var fileName = options.fileName;
        var currentTime = DataUtils.getEpochMSTimestamp();
        fileName = currentTime + '_' + fileName;
        var fileLocation = 'https://s3.console.aws.amazon.com/s3/object/' + Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET + '/' + accountId + '/' + Constants.S3_FOLDER.BILLING_PDF;
        var err;

        try {
            invoiceRecord.fileName = fileName;
            invoiceRecord.fileLocation = fileLocation;
            var conn = await connection.getConnection();
            var invoiceUpdated = await conn.query('Update BillInvoice set fileName=?,fileLocation=?,invoiceNumber=?,totalAmount=?,' +
              ' updatedAt=? where id = uuid_to_bin(?)', [fileName, fileLocation, invoiceNumber, totalAmount, currentTime, invoiceId]);
            invoiceUpdated = Utils.isAffectedPool(invoiceUpdated);
            debug('invoiceUpdated', invoiceUpdated);
            return cb(null, {fileName: fileName});
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.BILL_INVOICE_UPDATE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    updateBillingCycle: async function (options, errorOptions, cb) {
        var account = options.account;
        var accountId = account.accountId;
        var billCycleCount = account.billCycleCount;
        var planType = account.name;
        var billingCycleStartDate = account.billingCycleStartDate;
        var billingCycleEndDate = account.billingCycleEndDate;
        var currentTime = DataUtils.getEpochMSTimestamp();
        var err;

        try {
            var conn = await connection.getConnection();

            if (account.isNotCycleCount) {
                return cb(null, Constants.OK_MESSAGE);
            }
            var calculateOption = {
                planType: planType,
                billingCycleStartDate: billingCycleStartDate,
                billingCycleEndDate: billingCycleEndDate,
                fromCycle: 1,
                billCycleCount: billCycleCount
            };
            var response = await PlanApi.calculateBillingCycleEndDate(calculateOption);
            debug('response', response);

            var billCycleUpdated = await conn.query('Update AccountPlans set billingCycleStartDate=? ,billingCycleEndDate=?,' +
              ' updatedAt=? where accountId = uuid_to_bin(?) and effectiveToDate = 0 ',
              [response.billingCycleStartDate, response.billingCycleEndDate, currentTime, accountId]);
            billCycleUpdated = Utils.isAffectedPool(billCycleUpdated);
            debug('invoiceUpdated', billCycleUpdated);
            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.BILLING_CYCLE_UPDATE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    updateBillInvoiceControl: async function (options, errorOptions, cb) {
        var account = options.account;
        var billingStartDate = account.billingCycleStartDate;
        var billingEndDate = account.billingCycleEndDate;
        var billingCompleted = options.billingCompleted;
        var accountId = account.accountId;
        var currentTime = DataUtils.getEpochMSTimestamp();
        var status = Constants.BILLING_CONTROL_STATUS.COMPLETE;
        var err;

        if (!billingCompleted) {
            return cb(null, {});
        }
        if (DataUtils.isUndefined(accountId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var isUpdated = await conn.query('update BillInvoiceControl set status = ?,updatedAt=? where accountId = uuid_to_bin(?) ' +
              ' and billingStartDate = ? and billingEndDate = ? ;', [status, currentTime, accountId, billingStartDate, billingEndDate]);
            isUpdated = Utils.isAffectedPool(isUpdated);
            if (!isUpdated) {
                err = new Error(ErrorConfig.MESSAGE.UPDATE_BILLING_CONTROL_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            return cb(null, {
                OK: Constants.SUCCESS_MESSAGE.BILLING_CONTROL_UPDATE_SUCCESS
            });
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.UPDATE_BILLING_CONTROL_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    createInvoiceRecord: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var id = options.id;
            var accountId = options.accountId;
            var invoiceNumber = options.invoiceNumber;
            var invoiceGenerationTime = options.invoiceGenerationTime;
            var invoicePeriodStart = options.invoicePeriodStart;
            var invoicePeriodEnd = options.invoicePeriodEnd;
            var currentTime = DataUtils.getEpochMSTimestamp();

            try {
                var conn = await connection.getConnection();
                var isInserted = await conn.query('insert into BillInvoice (id,accountId,invoiceNumber,invoiceGenerationTime,' +
                  'invoicePeriodStart,invoicePeriodEnd,createdAt,updatedAt) values (uuid_to_bin(?),uuid_to_bin(?),?,?,?,?,?,?);',
                  [id, accountId, invoiceNumber, invoiceGenerationTime, invoicePeriodStart, invoicePeriodEnd, currentTime, currentTime]);
                isInserted = Utils.isAffectedPool(isInserted);
                debug('inInserted', isInserted);


                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.BILL_INVOICE_CREATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    getMonthlyBill: async function (options, cb) {
        debug('Inside api', options);
        var accountId = options.accountId;
        var month = options.month;
        var year = options.year;
        var err;

        try {
            if (DataUtils.isUndefined(month)) {
                err = new Error(ErrorConfig.MESSAGE.BILLING_MONTH_REQUIRED);
            } else if (DataUtils.isUndefined(year)) {
                err = new Error(ErrorConfig.MESSAGE.BILLING_YEAR_REQUIRED);
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }

            var conn = await connection.getConnection();

            var userResponse = await conn.query('select BIR.name as billingCategory,max(B.totalSize) as totalMaxUser' +
              ' from BillingItemDailyTotal B, BillingRates BR, BillingItemReference BIR where  B.accountId= uuid_to_bin(?) and ' +
              ' BR.id = B.rateId and BIR.id = B.billingReferenceId and month(B.billingDate) = ? and year(B.billingDate)=? ' +
              ' and BIR.name = ?', [accountId, month, year, Constants.BILLING_LINE_ITEM.REGISTERD_USER_CHARGES]);
            userResponse = Utils.filteredResponsePool(userResponse);

            var monthlyBilling = await conn.query('select BIR.name as billingCategory,sum(B.totalSize) as totalSize,' +
              ' sum(B.totalAmount) as totalAmount,BR.countryCurrencyCode from BillingItemDailyTotal B, ' +
              ' BillingRates BR, BillingItemReference BIR where  B.accountId= uuid_to_bin(?) and BR.id = B.rateId and ' +
              ' BIR.id = B.billingReferenceId and month(B.billingDate) = ? and year(B.billingDate)=? ' +
              ' group by B.billingReferenceId ',
              [accountId, month, year]);
            if (DataUtils.isUndefined(monthlyBilling) || (DataUtils.isArray(monthlyBilling) && monthlyBilling.length <= 0)) {
                return cb(null, []);
            }
            var daysInMonth = moment(year + '-' + month, 'YYYY-MM').daysInMonth();
            _.map(monthlyBilling, function (bill) {
                if (bill.billingCategory === Constants.BILLING_LINE_ITEM.REGISTERD_USER_CHARGES) {
                    /*var tempSize;
                    tempSize = bill.totalSize / parseInt(daysInMonth);*/
                    bill.totalSize = userResponse.totalMaxUser;
                }
            });

            return cb(null, monthlyBilling);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.BILLING_DETAIL_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    getYearlyBill: async function (options, cb) {
        var accountId = options.accountId;
        var year = options.year;
        var err;

        try {
            if (DataUtils.isUndefined(year)) {
                err = new Error(ErrorConfig.MESSAGE.BILLING_YEAR_REQUIRED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }

            var conn = await connection.getConnection();

            var yealyBilling = await conn.query('select sum(BIDT.totalAmount) as totalAmount,month(BIDT.billingDate) as month ,' +
              ' BR.countryCurrencyCode from BillingItemDailyTotal BIDT, BillingRates BR ' +
              ' where BIDT.accountId = uuid_to_bin(?) and year(BIDT.billingDate) = ? and BR.id = BIDT.rateId' +
              ' group by month(BIDT.billingDate)',
              [accountId, year]);
            if (DataUtils.isUndefined(yealyBilling) || (DataUtils.isArray(yealyBilling) && yealyBilling.length <= 0)) {
                yealyBilling = [];
            }
            return cb(null, yealyBilling);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.BILLING_DETAIL_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    getDailyBill: async function (options, cb) {
        var accountId = options.accountId;
        var month = options.month;
        var year = options.year;
        var billingCategory = options.billingCategory;
        var dateFormat = '%Y-%m-%d';
        var err;

        try {
            if (DataUtils.isUndefined(month)) {
                err = new Error(ErrorConfig.MESSAGE.BILLING_MONTH_REQUIRED);
            } else if (DataUtils.isUndefined(billingCategory)) {
                err = new Error(ErrorConfig.MESSAGE.BILLING_CATEGORY_REQUIRED);
            } else if (DataUtils.isUndefined(year)) {
                err = new Error(ErrorConfig.MESSAGE.BILLING_YEAR_REQUIRED);
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }

            var conn = await connection.getConnection();
            var monthlyBilling = await conn.query('select BIR.name as billingCategory,BT.totalAmount,BT.totalSize, ' +
              ' Date_format(BT.billingDate,?) as billingDate , BR.countryCurrencyCode ' +
              ' from BillingItemDailyTotal BT,BillingRates BR,BillingItemReference BIR where ' +
              ' BT.accountId = uuid_to_bin(?) and BT.billingReferenceId = BIR.id and BIR.name = ? ' +
              ' and month(BT.billingDate) = ? and year(BT.billingDate) = ? and BR.id = BT.rateId ' +
              ' group by BT.billingReferenceId,BT.billingDate ',
              [dateFormat, accountId, billingCategory, month, year]);
            if (DataUtils.isUndefined(monthlyBilling) || (DataUtils.isArray(monthlyBilling) && monthlyBilling.length <= 0)) {
                monthlyBilling = [];
            }
            return cb(null, monthlyBilling);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.BILLING_DETAIL_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    getQueryDetail: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var billingCategory = parseInt(options.billingCategory);
            var fields = '', tables = '', condition = '', groupBy = '';
            var dateFormat = '';
            var values = [];
            if (billingCategory === Constants.BILLING_LINE_ITEM.IN_BOUND_DATA_TRANSFER) {
                fields += ' UL.fileName,(BD.size/(1024*1024)) as size,BD.amount,Date_format(BD.billingDate,?) as billingDate , ';
                tables += ' UploadLog UL, ';
                condition += ' UL.id = BD.sourceId and ';
                groupBy = '';
                dateFormat = '%Y %M %d';
                values.push(dateFormat);

            } else if (billingCategory === Constants.BILLING_LINE_ITEM.OUT_BOUND_DATA_TRANSFER) {

            } else if (billingCategory === Constants.BILLING_LINE_ITEM.IN_SHARING_DATA_TRANSFER) {
                fields += ' INS.inShareId,INS.inShareName,BD.id,sum(BD.size) as size,sum(BD.amount) AS amount,Date_format(BD.billingDate,?) as billingDate , ';
                tables += ' InShare INS, ';
                condition += ' INS.id = uuid_to_bin(BD.sourceId) and ';
                groupBy = ' GROUP BY BD.sourceId ';
                dateFormat = '%Y %M %d';
                values.push(dateFormat);
            } else if (billingCategory === Constants.BILLING_LINE_ITEM.OUT_SHARING_DATA_TRANSFER) {
                fields += ' OS.outShareId,OS.outShareName,sum(BD.size) as size,sum(BD.amount) AS amount,Date_format(BD.billingDate,?) as billingDate ,';
                tables += ' OutShare OS, ';
                condition += ' OS.id = uuid_to_bin(BD.sourceId) and  ';
                groupBy = ' GROUP BY BD.sourceId ';
                dateFormat = '%Y %M %d';
                values.push(dateFormat);
            }
            var response = {
                fields: fields,
                tables: tables,
                condition: condition,
                groupBy: groupBy,
                dateFormat: dateFormat
            };
            return resolve(response);
        });
    },

    getBillDetail: async function (options, cb) {
        var accountId = options.accountId;
        var billingCategory = options.billingCategory;
        var billingDate = options.billingDate;
        var dateFormat = '%Y-%m-%d';
        var fields = '', tables = '', condition = '', groupBy = '';
        var err;

        try {
            if (DataUtils.isUndefined(billingDate)) {
                err = new Error(ErrorConfig.MESSAGE.BILLING_DATE_REQUIRED);
            } else if (DataUtils.isUndefined(billingCategory)) {
                err = new Error(ErrorConfig.MESSAGE.BILLING_CATEGORY_REQUIRED);
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }

            var conn = await connection.getConnection();

            var response = await Billing.getQueryDetail({
                billingCategory: billingCategory
            });
            fields = response.fields;
            tables = response.tables;
            condition = response.condition;
            groupBy = response.groupBy;
            dateFormat = response.dateFormat;

            var billingDetail = await conn.query('select ' + fields + ' BR.countryCurrencyCode , BR.rate ' +
              ' from ' + tables + 'BillingItemDetail BD,BillingItemReference BIR,BillingRates BR , BillingItemDailyTotal BIDT ' +
              ' where BD.accountId = uuid_to_bin(?) and ' +
              ' BD.billingReferenceId = BIR.id and BIR.name = ? and ' +
              ' BD.billingDate = ? and ' + condition + ' BR.id = BIDT.rateId and BIDT.accountId = BD.accountId and ' +
              ' BIDT.billingDate = BD.billingDate and BIDT.billingReferenceId = BD.billingReferenceId ' + groupBy,
              [dateFormat, accountId, billingCategory, billingDate]);
            if (DataUtils.isUndefined(billingDetail) || (DataUtils.isArray(billingDetail) && billingDetail.length <= 0)) {
                billingDetail = [];
            }
            return cb(null, billingDetail);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.BILLING_DETAIL_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    getUsersBill: async function (options, cb) {
        var accountId = options.accountId;
        var billingMonth = options.billingMonth;
        var dateFormat = '%Y %M %d';
        var err;

        try {
            if (DataUtils.isUndefined(billingMonth)) {
                err = new Error(ErrorConfig.MESSAGE.BILLING_MONTH_REQUIRED);
            } else if (parseInt(billingMonth) > 12) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_BILLING_MONTH);
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }

            var conn = await connection.getConnection();
            var billingUsersDetail = await conn.query('select BD.sourceId,U.firstName,U.lastName,U.email,' +
              ' Date_format(from_unixtime(U.postRegCompleteDate/1000),?) as fromDate,BD.size,sum(BD.amount) AS amount,' +
              ' BR.countryCurrencyCode , BR.rate from BillingItemDetail BD,users U,BillingItemReference BIR,BillingRates BR , ' +
              ' BillingItemDailyTotal BIDT where BD.accountId = uuid_to_bin(?) and ' +
              ' BD.billingReferenceId = BIR.id and BIR.NAME = ? AND ' +
              ' month(BD.billingDate) = ? and U.id = uuid_to_bin(BD.sourceId) and ' +
              ' BR.id = BIDT.rateId and BIDT.accountId = BD.accountId AND ' +
              ' BIDT.billingDate = BD.billingDate and BIDT.billingReferenceId = BD.billingReferenceId GROUP BY BD.sourceId',
              [dateFormat, accountId, Constants.BILLING_LINE_ITEM.REGISTERD_USER_CHARGES, billingMonth]);
            if (DataUtils.isUndefined(billingUsersDetail) || (DataUtils.isArray(billingUsersDetail) && billingUsersDetail.length <= 0)) {
                billingUsersDetail = [];
            }
            return cb(null, billingUsersDetail);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.BILLING_DETAIL_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    /**
     * Generate signed url for image
     */
    generateSignedUrl: function (options) {
        return new Promise(function (resolve, reject) {
            s3.getSignedUrl(options.type, options.storeOption, async function (err, url) {
                if (err) {
                    debug('err', err);
                    err = new Error(ErrorConfig.MESSAGE.CREATE_PRE_SIGNED_URL_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
                return resolve(url);
            });
        });
    },

    downloadInvoiceUrl: async function (options, cb) {
        var accountId = options.accountId;
        var month = options.month;
        var year = options.year;
        var err;

        try {
            if (DataUtils.isUndefined(month)) {
                err = new Error(ErrorConfig.MESSAGE.BILLING_MONTH_REQUIRED);
            } else if (parseInt(month) > 12) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_BILLING_MONTH);
            } else if (DataUtils.isUndefined(year)) {
                err = new Error(ErrorConfig.MESSAGE.BILLING_YEAR_REQUIRED);
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }

            var conn = await connection.getConnection();
            var fileDetails = await conn.query('SELECT fileName FROM BillInvoice WHERE ' +
              ' FROM_UNIXTIME(invoiceGenerationTime/1000, \'%Y\') = ? AND FROM_UNIXTIME(invoiceGenerationTime/1000, \'%m\') = ?' +
              ' AND accountId= uuid_to_Bin(?)', [parseInt(year), parseInt(month), accountId]);
            debug('fileDetails', fileDetails);

            var storeOption = {
                Bucket: Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET,
                Expires: 7 * 24 * 60 * 60
            };

            await PromiseBluebird.each(fileDetails, async function (fileDetail) {
                storeOption.Key = accountId + '/' + Constants.S3_FOLDER.BILLING_PDF + '/' + fileDetail.fileName;
                var url = await Billing.generateSignedUrl({
                    storeOption: storeOption,
                    type: 'getObject'
                });
                debug('url', url);
                fileDetail.url = url;
            });
            return cb(null, fileDetails);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.GET_BILL_INVOICE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },


    validateSubscriptionPlan: function (options) {
        var err;
        if (DataUtils.isUndefined(options.accountId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
        } else if (DataUtils.isUndefined(options.type)) {
            err = new Error(ErrorConfig.MESSAGE.SUBSCRIPTION_PLAN_TYPE_REQUIRED);
        } else if (DataUtils.isUndefined(options.actionDate)) {
            err = new Error(ErrorConfig.MESSAGE.SUBSCRIPTION_PLAN_ACTION_DATE_REQUIRED);
        } else if (DataUtils.isUndefined(options.actionType)) {
            err = new Error(ErrorConfig.MESSAGE.SUBSCRIPTION_PLAN_ACTION_TYPE_REQUIRED);
        }
        return err;
    },

    createSubscriptionPlan: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var accountId = options.accountId;
            var userId = options.userId;
            var type = options.type;
            var actionDate = options.actionDate;
            var actionType = options.actionType;
            var id = Utils.generateId().uuid;
            var currentTime = DataUtils.getEpochMSTimestamp();

            try {
                // validate the request
                var err = Billing.validateSubscriptionPlan(options);
                if (err) {
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }
                // insert record in billing cycle table
                var conn = await connection.getConnection();

                var isInserted = await conn.query('insert into SubscriptionPlan (id,accountId,type,actionDate,actionType,' +
                  'createdAt,updatedAt,createdBy) values (uuid_to_bin(?),uuid_to_bin(?),?,?,?,?,?,uuid_to_bin(?))',
                  [id, accountId, type, actionDate, actionType, currentTime, currentTime, userId]);
                isInserted = Utils.isAffectedPool(isInserted);

                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                if (err.errno) {
                    err = new Error(ErrorConfig.MESSAGE.SUBSCRIPTION_PLAN_CREATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                }
                return reject(err);
            }
        });
    }
};

module.exports = Billing;
