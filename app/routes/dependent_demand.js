#!/usr/bin/env node

'use strict';

var debug = require('debug')('scopehub.route.dependent_demand');
var Util = require('util');

var DependentDemandApi = require('../api/dependent_demand');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');
var Events = require('../data/events');
var HeaderUtils = require('../lib/header_utils');

var DependentDemand = {

    /*create: function (req, res, next) {
        var user = req.user;
        var accountId = req.user.accountId;
        var options = {
            user: user,
            accountId: accountId,
            productRefId: req.body.productRefId,
            supplyItemId: req.body.supplyItemId,
            dependentDemandId: req.body.dependentDemandId,
            dependentDemandName: req.body.dependentDemandName
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.CREATE_DEPENDENT_DEMAND);
        DependentDemandApi.create(options, auditOptions, errorOptions, function (err, data) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = data;
            next();
        });
    },

    getDependentDemand: function (req, res, next) {
        var user = req.user;
        var accountId = req.user.accountId;
        var options = {
            user: user,
            accountId: accountId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        DependentDemandApi.getDependentDemand(options, errorOptions, function (err, data) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = data;
            next();
        });
    },

    updateDependentDemand: function (req, res, next) {
        var user = req.user;
        var accountId = req.user.accountId;
        var options = {
            user: user,
            accountId: accountId,
            id: req.body.id,
            dependentDemandName: req.body.dependentDemandName,
            updatedAt: req.body.updatedAt
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_DEPENDENT_DEMAND);
        DependentDemandApi.updateDependentDemand(options, auditOptions, errorOptions, function (err, data) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = data;
            next();
        });
    },

    deleteDependentDemand: function (req, res, next) {
        var user = req.user;
        var accountId = req.user.accountId;
        var options = {
            user: user,
            accountId: accountId,
            id: req.query.id,
            updatedAt: req.query.updatedAt
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.DELETE_DEPENDENT_DEMAND);
        DependentDemandApi.deleteDependentDemand(options, auditOptions, errorOptions, function (err, data) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = data;
            next();
        });
    },

    searchSupplyItemByProductRefId: function (req, res, next) {
        var user = req.user;
        var accountId = req.user.accountId;
        var options = {
            user: user,
            accountId: accountId,
            productRefId: req.query.productRefId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        DependentDemandApi.searchSupplyItemByProductRefId(options, errorOptions, function (err, data) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = data;
            next();
        });
    }*/
};

module.exports = DependentDemand;