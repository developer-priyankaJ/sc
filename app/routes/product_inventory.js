#!/usr/bin/env node

'use strict';

var debug = require('debug')('scopehub.route.product_inventory');
var multiparty = require('multiparty');
var _ = require('lodash');
var path = require('path');
var fs = require('fs');
var base64 = require('file-base64');
var ProductInventoryApi = require('../api/product_inventory');
var HeaderUtils = require('../lib/header_utils');
var Events = require('../data/events');
var Constants = require('../data/constants');

var ProductInventory = {

    removeMD: function (req, res, next) {
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
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.REMOVE_PRODUCT_INVENTORY);
        ProductInventoryApi.removeMD(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                debug(err);
                return next(err);
            }
            req.data = Constants.OK_MESSAGE;
            next();
        });
    },

    getProductsInventoriesByAccountMD: function (req, res, next) {
        var options = {
            user: req.user,
            isActive: req.query.isActive
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        ProductInventoryApi.getProductsInventoriesByAccountMD(options, errorOptions, function (err, productInventories) {
            if (err) {
                return next(err);
            }
            req.data = productInventories;
            next();
        });
    },

    searchProductsInventories: function (req, res, next) {
        var options = {
            user: req.user,
            isActive: req.query.isActive,
            sku: req.query.sku,
            locationId: req.query.locationId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        ProductInventoryApi.searchProductsInventories(options, errorOptions, function (err, productInventories) {
            if (err) {
                return next(err);
            }
            req.data = productInventories;
            next();
        });
    },

    getProductInventoryMD: function (req, res, next) {
        var user = req.user;
        var options = {
            accountId: req.user.accountId,
            productInventoryId: req.query.productInventoryId,
            languageCultureCode: user.languageCultureCode

        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        ProductInventoryApi.getProductInventoryMD(options, errorOptions, function (err, productInventory) {
            if (err) {
                return next(err);
            }
            req.data = productInventory;
            next();
        });
    },

    getProductInventoryByProductRefIdMD: function (req, res, next) {
        var user = req.user;
        var options = {
            accountId: req.user.accountId,
            productRefId: req.query.productRefId,
            languageCultureCode: user.languageCultureCode
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        ProductInventoryApi.getProductInventoryByProductRefIdMD(options, errorOptions, function (err, productInventory) {
            if (err) {
                return next(err);
            }
            req.data = productInventory;
            next();
        });
    },

    updateByAddingOutShares: function (req, res, next) {
        var accountId = req.user.accountId;
        var userId = req.user.id;
        var options = {
            accountId: accountId,
            userId: userId,
            outShares: req.body.outShares,
            updatedAt: req.body.updatedAt,
            accountIdProductIdLocationId: req.body.accountIdProductIdLocationId
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_OUT_SHARES_PRODUCT_INVENTORY);
        ProductInventoryApi.updateByAddingOutShares(options, auditOptions, function (err, productInventory) {
            if (err) {
                return next(err);
            }
            req.data = productInventory;
            next();
        });
    },

    updateByRemovingOutShares: function (req, res, next) {
        var accountId = req.user.accountId;
        var userId = req.user.id;
        var options = {
            accountId: accountId,
            userId: userId,
            outShares: req.body.outShares,
            updatedAt: req.body.updatedAt,
            accountIdProductIdLocationId: req.body.accountIdProductIdLocationId
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_OUT_SHARES_PRODUCT_INVENTORY);
        ProductInventoryApi.updateByRemovingOutShares(options, auditOptions, function (err, productInventory) {
            if (err) {
                return next(err);
            }
            req.data = productInventory;
            next();
        });
    },

    updateMD: function (req, res, next) {
        var accountId = req.user.accountId;
        var userId = req.user.id;
        var options = {
            languageCultureCode: req.user.languageCultureCode,
            accountId: accountId,
            userId: userId,
            productInventoryId: req.body.id,
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
            isRealTimeFrequency: req.body.isRealTimeFrequency
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_PRODUCT_INVENTORY);
        ProductInventoryApi.updateMD(options, auditOptions, errorOptions, function (err, productInventory) {
            if (err) {
                return next(err);
            }
            req.data = productInventory;
            next();
        });
    },

    updateInventoriesMD: function (req, res, next) {
        var user = req.user;
        var options = {
            user: user,
            productInventories: req.body.productInventories
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_PRODUCT_INVENTORY);
        ProductInventoryApi.updateInventoriesMD(options, auditOptions, errorOptions, function (err, productInventories) {
            if (err) {
                return next(err);
            }
            req.data = productInventories;
            next();
        });
    },

    deleteInventories: function (req, res, next) {
        var user = req.user;
        var options = {
            userId: user.id,
            accountId: user.accountId,
            productInventories: req.body.productInventories
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.DELETE_PRODUCT_INVENTORY);
        ProductInventoryApi.deleteInventories(options, auditOptions, errorOptions, function (err, productInventories) {
            if (err) {
                return next(err);
            }
            req.data = productInventories;
            next();
        });
    },

    deleteArchieveInventories: function (req, res, next) {
        var user = req.user;
        var options = {
            userId: user.id,
            accountId: user.accountId,
            productInventories: req.body.productInventories
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.DELETE_ARCHIEVE_PRODUCT_INVENTORY);
        ProductInventoryApi.deleteArchieveInventories(options, auditOptions, errorOptions, function (err, productInventories) {
            if (err) {
                return next(err);
            }
            req.data = productInventories;
            next();
        });
    },

    restoreArchieveInventories: function (req, res, next) {
        var user = req.user;
        var options = {
            userId: user.id,
            accountId: user.accountId,
            productInventories: req.body.productInventories
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.RESTORE_ARCHIEVE_PRODUCT_INVENTORY);
        ProductInventoryApi.restoreArchieveInventories(options, auditOptions, errorOptions, function (err, productInventories) {
            if (err) {
                return next(err);
            }
            req.data = productInventories;
            next();
        });
    },

    searchProductBySKUMD: function (req, res, next) {
        var query = req.query.query;
        var options = {
            query: query,
            user: req.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        ProductInventoryApi.searchProductBySKUMD(options, errorOptions, function (err, references) {
            if (err) {
                return next(err);
            }
            req.data = references;
            next();
        });
    },

    searchProductBySellerSKUNameMD: function (req, res, next) {
        var query = req.query.query;
        var options = {
            query: query,
            user: req.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        ProductInventoryApi.searchProductBySellerSKUNameMD(options, errorOptions, function (err, references) {
            if (err) {
                return next(err);
            }
            req.data = references;
            next();
        });
    },

    createMD: function (req, res, next) {
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
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.CREATE_PRODUCT_INVENTORY);
        ProductInventoryApi.createMD(options, auditOptions, errorOptions, function (err, productInventory) {
            if (err) {
                return next(err);
            }
            req.data = productInventory;
            next();
        });
    }
};
module.exports = ProductInventory;

(function () {
    if (require.main == module) {
    }
}());