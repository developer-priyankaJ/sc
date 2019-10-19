#!/usr/bin/env node
'use strict';

var debug = require('debug')('scopehub.route.billing');
var Util = require('util');

var BillingApi = require('../api/billing');
var HeaderUtils = require('../lib/header_utils');
var Events = require('../data/events');
var Constants = require('../data/constants');
var DataUtils = require('../lib/data_utils');
var _ = require('lodash');

var Billing = {

    /*createBillingControl: function (req, res, next) {
        req.body = req.body.options || req.body;
        var account = req.body.account;
        var options = {
            account: account
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        BillingApi.createBillingControl(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next();
            }
            req.billingDate = response.billingDate;
            return next();
        });
    },*/

    updateBillingControl: function (req, res, next) {
        req.body = req.body.options || req.body;
        var account = req.body.account;
        var billingDate = req.body.billingDate;
        var options = {
            account: account,
            billingDate: billingDate,
            billingCompleted: req.billingCompleted
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        BillingApi.updateBillingControl(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next();
            }
            req.data = response;
            return next();
        });
    },

    calculateDailyBill: function (req, res, next) {
        req.body = req.body.options || req.body;
        var account = req.body.account;
        var billingDate = req.body.billingDate;
        var options = {
            account: account,
            billingDate: billingDate,
            accountPlan: req.accountPlan
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        BillingApi.calculateDailyBill(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next();
            }
            req.billingCompleted = 1;
            return next();
        });
    },

    calculateInboudDailyBill: function (req, res, next) {
        req.body = req.body.options || req.body;
        var account = req.body.account;
        var billingDate = req.body.billingDate;
        var options = {
            account: account,
            billingDate: billingDate,
            accountPlan: req.accountPlan
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        BillingApi.calculateInboudDailyBill(options, errorOptions, function (err, accountPlan) {
            if (err) {
                debug('err', err);
                return next();
            }
            return next();
        });
    },

    calculateOutboundDailyBill: function (req, res, next) {
        req.body = req.body.options || req.body;
        var account = req.body.account;
        var billingDate = req.body.billingDate;
        var options = {
            account: account,
            billingDate: billingDate,
            accountPlan: req.accountPlan
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        BillingApi.calculateOutboundDailyBill(options, errorOptions, function (err, accountPlan) {
            if (err) {
                debug('err', err);
                return next();
            }
            return next();
        });
    },

    calculateOutSharingDailyBill: function (req, res, next) {
        req.body = req.body.options || req.body;
        var account = req.body.account;
        var billingDate = req.body.billingDate;
        var options = {
            account: account,
            billingDate: billingDate,
            accountPlan: req.accountPlan
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        BillingApi.calculateOutSharingDailyBill(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next();
            }
            req.billingCompleted = 1;
            return next();
        });
    },

    calculateInSharingDailyBill: function (req, res, next) {
        req.body = req.body.options || req.body;
        var account = req.body.account;
        var billingDate = req.body.billingDate;
        var options = {
            account: account,
            billingDate: billingDate,
            accountPlan: req.accountPlan
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        BillingApi.calculateInSharingDailyBill(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next();
            }
            return next();
        });
    },

    calculateRegisteredUserDailyBill: function (req, res, next) {
        req.body = req.body.options || req.body;
        var account = req.body.account;
        var billingDate = req.body.billingDate;
        var options = {
            account: account,
            billingDate: billingDate
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        BillingApi.calculateRegisteredUserDailyBill(options, errorOptions, function (err, accountPlan) {
            if (err) {
                debug('err', err);
                return next();
            }
            req.accountPlan = accountPlan;
            return next();
        });
    },

    calculateMonthlyBill: function (req, res, next) {
        req.body = req.body.options || req.body;
        var account = req.body.account;

        var options = {
            account: account,
            invoice: req.invoice
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        BillingApi.calculateMonthlyBill(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next();
            }
            req.billingResponse = response.calculateMonthlyBillResponse;
            req.accountOwner = response.accountOwner;
            return next();
        });
    },

    createInvoice: function (req, res, next) {
        req.body = req.body.options || req.body;
        var account = req.body.account;
        var options = {
            account: account
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        BillingApi.createInvoice(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next();
            }
            req.invoice = response;
            return next();
        });
    },

    getAccountById: function (req, res, next) {
        req.body = req.body.options || req.body;
        var account = req.body.account;
        var options = {
            accountId: account.accountId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        BillingApi.getAccountById(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next();
            }
            debug('account response', response);
            req.user = response;
            return next();
        });
    },

    generateBillPDF: function (req, res, next) {
        req.body = req.body.options || req.body;
        var account = req.body.account;
        var options = {
            account: account,
            billingResponse: req.billingResponse,
            accountOwner: req.accountOwner
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        BillingApi.generateBillPDF(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next();
            }
            req.fileName = response.fileName;
            req.invoiceRecord = response.invoiceRecord;
            return next();
        });
    },

    sendEmailToOwner: function (req, res, next) {
        var account = req.body.account;
        var options = {
            account: account,
            accountOwner: req.accountOwner,
            fileName: req.fileName
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        BillingApi.sendEmailToOwner(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next();
            }
            req.data = response;
            return next();
        });
    },

    uploadFileToS3: function (req, res, next) {
        var account = req.body.account;
        var options = {
            accountId: account.accountId,
            s3FileName: req.s3FileName,
            fileName: req.fileName,
            invoiceRecord: req.invoiceRecord
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        BillingApi.uploadFileToS3(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next();
            }
            return next();
        });
    },

    updateInvoice: function (req, res, next) {
        var options = {
            invoice: req.invoice,
            fileName: req.fileName,
            invoiceRecord: req.invoiceRecord
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        BillingApi.updateInvoice(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next();
            }
            req.s3FileName = response.fileName;
            return next();
        });
    },

    updateBillingCycle: function (req, res, next) {
        req.body = req.body.options || req.body;
        var account = req.body.account;
        var options = {
            account: account
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        BillingApi.updateBillingCycle(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next();
            }
            req.billingCompleted = 1;
            req.data = response;
            return next();
        });
    },

    updateBillInvoiceControl: function (req, res, next) {
        req.body = req.body.options || req.body;
        var account = req.body.account;
        //var billingStartDate = req.body.billingCycleStartDate;
        //var billingEndDate = req.body.billingCycleEndDate;
        var options = {
            account: account,
            billingCompleted: req.billingCompleted
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        BillingApi.updateBillInvoiceControl(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next();
            }
            req.data = response;
            return next();
        });
    },

    getMonthlyBill: function (req, res, next) {
        debug('Inside route');
        var user = req.user;
        var options = {
            accountId: user.accountId,
            languageCultureCode: user.languageCultureCode,
            month: req.query.month,
            year: req.query.year
        };
        BillingApi.getMonthlyBill(options, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    getYearlyBill: function (req, res, next) {
        debug('Inside route');
        var user = req.user;
        var options = {
            accountId: user.accountId,
            languageCultureCode: user.languageCultureCode,
            year: req.query.year
        };
        BillingApi.getYearlyBill(options, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    getDailyBill: function (req, res, next) {
        debug('Inside route');
        var user = req.user;
        var options = {
            accountId: user.accountId,
            billingCategory: req.query.billingCategory,
            month: req.query.month,
            year: req.query.year
        };
        BillingApi.getDailyBill(options, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    getBillDetail: function (req, res, next) {
        debug('Inside route');
        var user = req.user;
        var options = {
            accountId: user.accountId,
            billingCategory: req.query.billingCategory,
            billingDate: req.query.billingDate
        };
        BillingApi.getBillDetail(options, function (err, response) {
            if (err) {
                Util.log(err);
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    getUsersBill: function (req, res, next) {
        debug('Inside route');
        var user = req.user;
        var options = {
            accountId: user.accountId,
            billingMonth: req.query.billingMonth
        };
        BillingApi.getUsersBill(options, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    downloadInvoiceUrl: function (req, res, next) {
        debug('Inside route');
        var user = req.user;
        var options = {
            accountId: user.accountId,
            month: req.query.month,
            year: req.query.year
        };
        BillingApi.downloadInvoiceUrl(options, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            next();
        });
    }

    /*getBillHTML: function (req, res, next) {
        var options = {};
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        BillingApi.getBillHTML({}, function (err, response) {
            if (err) {
                debug('err', err);
                return next();
            }
            req.data = response;
            return next();
        });
    }*/
};

module.exports = Billing;

(function () {
    if (require.main == module) {
    }
}());
