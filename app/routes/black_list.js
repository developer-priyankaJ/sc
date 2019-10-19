#!/usr/bin/env node

'use strict';

var debug = require('debug')('scopehub.route.black_list');
var Util = require('util');
var DataUtils = require('../lib/data_utils');
var BlackListApi = require('../api/black_list');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');
var Events = require('../data/events');
var HeaderUtils = require('../lib/header_utils');

var BlackList = {

    createBlackListMD: function (req, res, next) {
        var options = {
            account: req.user.accountId,
            user: req.user,
            email: DataUtils.toLowerCase(req.body.email),
            domain: req.body.domain,
            subDomain: req.body.subDomain,
            reasonCode: req.body.reasonCode,
            restrictionType: req.body.restrictionType,
            notes: req.body.notes
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.CREATE_COUNTRY_REFERENCE);
        BlackListApi.createBlackListMD(options, errorOptions, function (err, blackList) {
            if (err) {
                return next(err);
            }
            req.data = blackList;
            next();
        });
    },

    updateMD: function (req, res, next) {
        var options = {
            id: req.body.id,
            account: req.user.accountId,
            user: req.user,
            email: DataUtils.toLowerCase(req.body.email),
            domain: req.body.domain,
            subDomain: req.body.subDomain,
            reasonCode: req.body.reasonCode,
            restrictionType: req.body.restrictionType,
            notes: req.body.notes
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        BlackListApi.updateMD(options, errorOptions, function (err, blackList) {
            if (err) {
                return next(err);
            }
            req.data = blackList;
            next();
        });
    },

    checkBlackListMD: function (req, res, next) {
        var options = {
            email: DataUtils.toLowerCase(req.body.email),
            domain: req.body.domain,
            subDomain: req.body.subDomain
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        BlackListApi.checkBlackListMD(options, errorOptions, function (err, blackList) {
            if (err) {
                return next(err);
            }
            req.data = blackList;
            next();
        });
    },

    validateBlackListMD: function (req, res, next) {
        var options = {
            blackList: req.blackList
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        BlackListApi.validateBlackListMD(options, errorOptions, function (err, blackList) {
            if (err) {
                return next(err);
            }
            req.data = blackList;
            next();
        });
    },

    getAllBlackListMD: function (req, res, next) {

        BlackListApi.getAllBlackListMD(function (err, blackList) {
            if (err) {
                return next(err);
            }
            req.data = blackList;
            next();
        });
    },

    removeBlackListMD: function (req, res, next) {
        var options = {
            blackListId: req.query.blackListId
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.REMOVE_CONTACT_FROM_BLACK_LIST);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        BlackListApi.removeBlackListMD(options, auditOptions, errorOptions, function (err,response) {
            if (err) {
                return next(err);
            }
            req.data = Constants.OK_MESSAGE;
            next();
        });
    }
};

module.exports = BlackList;

(function () {
    if (require.main == module) {
    }
}());