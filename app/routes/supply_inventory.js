#!/usr/bin/env node

'use strict';

var debug = require('debug')('scopehub.route.supply_inventory');
var _ = require('lodash');
var path = require('path');
var fs = require('fs');
var base64 = require('file-base64');
var SupplyInventoryApi = require('../api/supply_inventory');
var HeaderUtils = require('../lib/header_utils');
var Events = require('../data/events');
var Constants = require('../data/constants');

var SupplyInventory = {

    create: function (req, res, next) {
        var accountId = req.user.accountId;
        var userId = req.user.id;
        var options = {
            accountId: accountId,
            userId: userId,
            SKU: req.body.SKU,
            qtyOnHand: req.body.qtyOnHand,
            qtyOnHandUOM: req.body.qtyOnHandUOM,
            qtyOnOrder: req.body.qtyOnOrder,
            qtyOnOrderUOM: req.body.qtyOnOrderUOM,
            qtyAvailable: req.body.qtyAvailable,
            qtyAvailableUOM: req.body.qtyAvailableUOM,
            qtyInTransit: req.body.qtyInTransit,
            qtyInTransitUOM: req.body.qtyInTransitUOM,
            notes: req.body.notes,
            qtyUOM: req.body.qtyUOM,
            locationId: req.body.locationId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.CREATE_SUPPLY_INVENTORY);
        SupplyInventoryApi.create(options, auditOptions, errorOptions, function (err, supplyInventory) {
            if (err) {
                return next(err);
            }
            req.data = supplyInventory;
            next();
        });
    },

    getSupplyInventory: function (req, res, next) {
        var user = req.user;
        var options = {
            accountId: req.user.accountId,
            supplyInventoryId: req.query.supplyInventoryId,
            languageCultureCode: user.languageCultureCode

        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        SupplyInventoryApi.getSupplyInventory(options, errorOptions, function (err, supplyInventory) {
            if (err) {
                return next(err);
            }
            req.data = supplyInventory;
            next();
        });
    },

    remove: function (req, res, next) {
        var accountId = req.user.accountId;
        var userId = req.user.id;
        var options = {
            accountId: accountId,
            userId: userId,
            id: req.query.id,
            updatedAt: req.query.updatedAt
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.REMOVE_SUPPLY_INVENTORY);
        SupplyInventoryApi.remove(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                debug(err);
                return next(err);
            }
            req.data = Constants.OK_MESSAGE;
            next();
        });
    },

    getSupplyInventoryBySupplyItemId: function (req, res, next) {
        var user = req.user;
        var options = {
            accountId: req.user.accountId,
            supplyItemId: req.query.supplyItemId,
            languageCultureCode: user.languageCultureCode
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        SupplyInventoryApi.getSupplyInventoryBySupplyItemId(options, errorOptions, function (err, productInventory) {
            if (err) {
                return next(err);
            }
            req.data = productInventory;
            next();
        });
    },

    update: function (req, res, next) {
        var accountId = req.user.accountId;
        var userId = req.user.id;
        var options = {
            languageCultureCode: req.user.languageCultureCode,
            accountId: accountId,
            userId: userId,
            supplyInventoryId: req.body.id,
            locationId: req.body.locationId,
            type: req.body.type,
            qtyOnHand: req.body.qtyOnHand,
            qtyOnHandUOM: req.body.qtyOnHandUOM,
            qtyOnOrder: req.body.qtyOnOrder,
            qtyOnOrderUOM: req.body.qtyOnOrderUOM,
            qtyAvailable: req.body.qtyAvailable,
            qtyAvailableUOM: req.body.qtyAvailableUOM,
            qtyInTransit: req.body.qtyInTransit,
            qtyInTransitUOM: req.body.qtyInTransitUOM,
            notes: req.body.notes,
            updatedAt: req.body.updatedAt,
            isRealTimeFrequency: req.body.isRealTimeFrequency,
            flag: true
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_SUPPLY_INVENTORY);
        SupplyInventoryApi.update(options, auditOptions, errorOptions, function (err, productInventory) {
            if (err) {
                return next(err);
            }
            req.data = productInventory;
            next();
        });
    },

    getSupplyInventoriesByAccount: function (req, res, next) {
        var options = {
            user: req.user,
            isActive: req.query.isActive
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        SupplyInventoryApi.getSupplyInventoriesByAccount(options, errorOptions, function (err, supplyInventories) {
            if (err) {
                return next(err);
            }
            req.data = supplyInventories;
            next();
        });
    },

    searchSupplyInventories: function (req, res, next) {
        var options = {
            user: req.user,
            isActive: req.query.isActive,
            sku: req.query.sku,
            locationId: req.query.locationId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        SupplyInventoryApi.searchSupplyInventories(options, errorOptions, function (err, supplyInventories) {
            if (err) {
                return next(err);
            }
            req.data = supplyInventories;
            next();
        });
    },

    updateInventories: function (req, res, next) {
        var user = req.user;
        var options = {
            user: user,
            supplyInventories: req.body.supplyInventories
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_SUPPLY_INVENTORY);
        SupplyInventoryApi.updateInventories(options, auditOptions, errorOptions, function (err, supplyInventories) {
            if (err) {
                return next(err);
            }
            req.data = supplyInventories;
            next();
        });
    },

    deleteInventories: function (req, res, next) {
        var user = req.user;
        var options = {
            userId: user.id,
            accountId: user.accountId,
            supplyInventories: req.body.supplyInventories
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.DELETE_SUPPLY_INVENTORY);
        SupplyInventoryApi.deleteInventories(options, auditOptions, errorOptions, function (err, supplyInventories) {
            if (err) {
                return next(err);
            }
            req.data = supplyInventories;
            next();
        });
    },

    deleteArchieveInventories: function (req, res, next) {
        var user = req.user;
        var options = {
            userId: user.id,
            accountId: user.accountId,
            supplyInventories: req.body.supplyInventories
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.DELETE_ARCHIEVE_SUPPLY_INVENTORY);
        SupplyInventoryApi.deleteArchieveInventories(options, auditOptions, errorOptions, function (err, supplyInventories) {
            if (err) {
                return next(err);
            }
            req.data = supplyInventories;
            next();
        });
    },

    restoreArchiveInventories: function (req, res, next) {
        var user = req.user;
        var options = {
            userId: user.id,
            accountId: user.accountId,
            supplyInventories: req.body.supplyInventories
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.RESTORE_ARCHIEVE_SUPPLY_INVENTORY);
        SupplyInventoryApi.restoreArchiveInventories(options, auditOptions, errorOptions, function (err, supplyInventories) {
            if (err) {
                return next(err);
            }
            req.data = supplyInventories;
            next();
        });
    },

};
module.exports = SupplyInventory;

(function () {
    if (require.main == module) {
    }
}());