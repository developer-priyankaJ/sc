#!/usr/bin/env node

'use strict';

var debug = require('debug')('scopehub.route.customer');
var OutSharingApi = require('../api/out_sharing');
var Constants = require('../data/constants');
var Events = require('../data/events');
var HeaderUtils = require('../lib/header_utils');

var OutSharing = {

    getByAccountIdAndProfileIdMD: function (req, res, next) {
        var accountId = req.user.accountId;
        var options = {
            id: req.query.id,
            accountId: accountId
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        OutSharingApi.getByAccountIdAndProfileIdMD(options, errorOptions, function (err, outSharing) {
            if (err) {
                return next(err);
            }
            req.data = outSharing;
            next();
        });
    },
    getByAccountIdMD: function (req, res, next) {
        var accountId = req.user.accountId;
        var options = {
            accountId: accountId,
            type: req.query.type

        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        OutSharingApi.getByAccountIdMD(options, errorOptions, function (err, outSharing) {
            if (err) {
                return next(err);
            }
            req.data = outSharing;
            next();
        });
    },

    getDataItemsMD: function (req, res, next) {
        var options = {
            languageCultureCode: req.query.languageCultureCode,
            type: req.query.type

        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        OutSharingApi.getDataItemsMD(options, errorOptions, function (err, outSharing) {
            if (err) {
                return next(err);
            }
            req.data = outSharing;
            next();
        });
    },

    createSharedData: function (req, res, next) {
        //var user = req.user;
        req.body = req.body.options || req.body;
        var shareEvent = req.body.shareEvent;
        var options = {
            //accountId: user.accountId,
            //languageCultureCode: user.languageCultureCode,
            shareEvent: shareEvent
        };

        OutSharingApi.createSharedData(options, function (err, response) {
            if (err) {
                return next();
            }
            req.data = response;
            next();
        });
    },

    createRealTimeSharedData: function (req, res, next) {
        //var user = req.user;
        req.body = req.body.options || req.body;
        var outShareInstanceId = req.body.outShareInstanceId;
        var shareItemId = req.body.shareItemId;
        var orderRefIds = req.body.orderRefIds;
        var dependentDemands = req.body.dependentDemands;
        var options = {
            outShareInstanceId: outShareInstanceId,
            shareItemId: shareItemId,
            orderRefIds: orderRefIds,
            dependentDemands: dependentDemands
        };

        OutSharingApi.createRealTimeSharedData(options, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    getSharedDataByOutShareId: function (req, res, next) {
        var user = req.user;
        var options = {
            accountId: user.accountId,
            languageCultureCode: user.languageCultureCode,
            outShareInstanceId: req.query.outShareInstanceId,
            shareItemType: req.query.shareItemType
        };

        OutSharingApi.getSharedDataByOutShareId(options, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    getSharedDataForOutShare: function (req, res, next) {
        var user = req.user;
        var options = {
            accountId: user.accountId,
            languageCultureCode: user.languageCultureCode,
            outShareInstanceId: req.query.outShareInstanceId,
            shareItemType: req.query.shareItemType
        };

        OutSharingApi.getSharedDataForOutShare(options, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    getSharingErrorLogByOutShareId: function (req, res, next) {
        var user = req.user;
        var options = {
            accountId: user.accountId,
            outShareInstanceId: req.query.outShareInstanceId
        };

        OutSharingApi.getSharingErrorLogByOutShareId(options, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    checkOutShares: function (req, res, next) {
        var user = req.user;
        var options = {
            accountId: user.accountId,
            ids: req.body.ids,
            supplier: req.body.supplier
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        OutSharingApi.checkOutShares(options, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    checkOutSharesByShareItems: function (req, res, next) {
        var user = req.user;
        var options = {
            accountId: user.accountId,
            ids: req.body.ids,
            shareItemType: req.body.shareItemType
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        OutSharingApi.checkOutSharesByShareItems(options, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    getSharedDataForDownload: function (req, res, next) {
        var user = req.user;
        var options = {
            accountId: user.accountId,
            languageCultureCode: user.languageCultureCode,
            outShareInstanceId: req.query.outShareInstanceId,
            toFilterDate: req.query.toFilterDate,
            fromFilterDate: req.query.fromFilterDate,
            fromOutShare: req.query.fromOutShare
        };
        OutSharingApi.getSharedDataForDownload(options, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

};


module.exports = OutSharing;

