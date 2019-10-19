#!/usr/bin/env node

'use strict';

var debug = require('debug')('scopehub.route.account_marketplace');
var Util = require('util');
var Events = require('../data/events');
var HeaderUtils = require('../lib/header_utils');
var AccountMarketplaceApi = require('../api/account_marketplace');

var AccountMarketplace = {

    createMD: function (req, res, next) {

        var options = {
            mpId: req.body.mpId,
            user: req.user,
            account: req.account,
            sellerId: req.body.sellerId,
            token: req.body.token,
            status: req.body.status,
            accessCredentials: req.body.accessCredentials
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        AccountMarketplaceApi.createMD(options, errorOptions, function (err, accountMarketplace) {
            if (err) {
                Util.log(err);
                return next(err);
            }
            req.data = accountMarketplace;
            next();
        });
    },

    updateMD: function (req, res, next) {

        var options = {
            mpId: req.body.mpId,
            user: req.user,
            account: req.account,
            sellerId: req.body.sellerId,
            token: req.body.token,
            status: req.body.status,
            updatedAt: req.body.updatedAt,
            accessCredentials: req.body.accessCredentials
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_ACCOUNT_MARKETPLACE);
        AccountMarketplaceApi.updateMD(options, auditOptions, errorOptions, function (err, accountMarketplace) {
            if (err) {
                Util.log(err);
                return next(err);
            }
            req.data = accountMarketplace;
            next();
        });
    },

    getMD: function (req, res, next) {

        var options = {
            mpId: req.query.mpId,
            account: req.account
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        AccountMarketplaceApi.getMD(options, errorOptions, function (err, accountMarketplace) {
            if (err) {
                Util.log(err);
                return next(err);
            }
            req.data = accountMarketplace;
            next();
        });
    },

    listByAccountMD: function (req, res, next) {
        var options = {
            account: req.account
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        AccountMarketplaceApi.listByAccountMD(options, errorOptions, function (err, accountMarketplaces) {
            if (err) {
                Util.log(err);
                return next(err);
            }
            req.data = accountMarketplaces;
            next();
        });
    },

    getUnlistedMpsProduct: function (req, res, next) {
        var options = {
            account: req.account,
            productRefId: req.query.productRefId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        AccountMarketplaceApi.getUnlistedMpsProduct(options, errorOptions, function (err, accountMarketplaces) {
            if (err) {
                Util.log(err);
                return next(err);
            }
            req.data = accountMarketplaces;
            next();
        });
    },

    removeMD: function (req, res, next) {

        var options = {
            mpId: req.query.mpId,
            account: req.account
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_ACCOUNT_MARKETPLACE);
        AccountMarketplaceApi.removeMD(options,auditOptions, errorOptions, function (err, accountMarketplace) {
            if (err) {
                Util.log(err);
                return next(err);
            }
            req.data = accountMarketplace;
            next();
        });
    }
};

module.exports = AccountMarketplace;

