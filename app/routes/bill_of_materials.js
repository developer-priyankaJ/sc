#!/usr/bin/env node

'use strict';

var debug = require('debug')('scopehub.route.bill_of_materials');
var Util = require('util');

var BillOfMaterialsApi = require('../api/bill_of_materials');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');
var Events = require('../data/events');
var HeaderUtils = require('../lib/header_utils');

var BillOfMaterials = {

    createMD: function (req, res, next) {
        var user = req.user;
        var accountId = req.user.accountId;
        var options = {
            user: user,
            accountId: accountId,
            productRefId: req.body.productRefId,
            supplyItemId: req.body.supplyItemId,
            quantity: req.body.quantity,
            supplyItemUpdatedAt: req.body.supplyItemUpdatedAt,
            qtyUOM: req.body.qtyUOM
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.CREATE_BILL_OF_MATERIALS);
        BillOfMaterialsApi.createMD(options, auditOptions, errorOptions, function (err, data) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = data;
            next();
        });
    },

    updateMD: function (req, res, next) {
        var options = {
            user: req.user,
            id: req.body.id,
            productRefId: req.body.productRefId,
            supplyItemId: req.body.supplyItemId,
            quantity: req.body.quantity,
            qtyUOM: req.body.qtyUOM,
            supplyItemTimestamp: req.body.supplyItemTimestamp,
            billOfMaterialTimestamp: req.body.billOfMaterialTimestamp,
            accountId: req.user.accountId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_BILL_OF_MATERIALS);
        BillOfMaterialsApi.updateMD(options, auditOptions, errorOptions, function (err, data) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = data;
            next();
        });
    },

    deleteMD: function (req, res, next) {
        var options = {
            id: req.query.id,
            billOfMaterialTimestamp: req.query.billOfMaterialTimestamp
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.DELETE_BILL_OF_MATERIAL);
        BillOfMaterialsApi.deleteMD(options, auditOptions, errorOptions, function (err, data) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = data;
            next();
        });
    },

    getBillOfMaterialMD: function (req, res, next) {
        var productRefId = req.query.productRefId;
        var accountId = req.user.accountId;
        var languageCultureCode = req.user.languageCultureCode;
        var options = {
            productRefId: productRefId,
            languageCultureCode: languageCultureCode,
            accountId: accountId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.GET_BILL_OF_MATERIAL);
        BillOfMaterialsApi.getBillOfMaterialMD(options, auditOptions, errorOptions, function (err, data) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = data;
            next();
        });
    }
};

module.exports = BillOfMaterials;