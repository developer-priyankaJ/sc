#!/usr/bin/env node

'use strict';
var Util = require('util');
var debug = require('debug')('scopehub.route.supply_item');
var multiparty = require('multiparty');
var path = require('path');
var fs = require('fs');
var base64 = require('file-base64');
var _ = require('lodash');
var SupplyItemApi = require('../api/supply_item');
var HeaderUtils = require('../lib/header_utils');
var Events = require('../data/events');
var Constants = require('../data/constants');

var SupplyItem = {

    searchSupplyItemsBySKUMD: function (req, res, next) {
        var query = req.query.query;
        var options = {
            query: query,
            user: req.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        SupplyItemApi.searchSupplyItemsBySKUMD(options, errorOptions, function (err, references) {
            if (err) {
                return next(err);
            }
            req.data = references;
            next();
        });
    },

    searchSupplyItemsBySellerSKUNameMD: function (req, res, next) {
        var query = req.query.query;
        var options = {
            query: query,
            user: req.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        SupplyItemApi.searchSupplyItemsBySellerSKUNameMD(options, errorOptions, function (err, references) {
            if (err) {
                return next(err);
            }
            req.data = references;
            next();
        });
    },

    getSupplyItemsByAccountIdMD: function (req, res, next) {
        var account = req.account;
        var user = req.user;
        var options = {
            accountId: account.id,
            user: user,
            isActive: req.query.isActive
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        SupplyItemApi.getSupplyItemsByAccountIdMD(options, errorOptions, function (err, references) {
            if (err) {
                return next(err);
            }
            req.data = references;
            next();
        });
    },

    getSupplyItemsByIdMD: function (req, res, next) {
        var user = req.user;
        var options = {
            id: req.query.id,
            user: user

        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        SupplyItemApi.getSupplyItemsByIdMD(options, errorOptions, function (err, references) {
            if (err) {
                return next(err);
            }
            req.data = references;
            next();
        });
    },

    searchSupplyItems: function (req, res, next) {
        var user = req.user;
        var options = {
            user:user,
            sku:req.query.sku,
            sellerSKUName:req.query.sellerSKUName,
            type:req.query.type,
            mpProductId:req.query.mpProductId,
            UPC:req.query.UPC,
            brand:req.query.brand,
            isActive: req.query.isActive
        }
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        SupplyItemApi.searchSupplyItems(options, errorOptions, function (err, references) {
            if (err) {
                return next(err);
            }
            req.data = references;
            next();
        });
    },

    removeMD: function (req, res, next) {
        var options = {
            id: req.query.id,
            updatedAt: req.query.updatedAt,
            user: req.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.REMOVE_SUPPLY_ITEM);
        SupplyItemApi.removeMD(options, auditOptions, errorOptions, function (err) {
            if (err) {
                debug(err);
                return next(err);
            }
            req.data = Constants.OK_MESSAGE;
            next();
        });
    },

    createMD: function (req, res, next) {
        var user = req.user;
        var account = user.account;
        var options = {
            account: account,
            user: user,
            sku: req.body.sku,
            type: req.body.type,
            sellerSKUName: req.body.sellerSKUName,
            GCID: req.body.GCID,
            UPC: req.body.UPC,
            EAN: req.body.EAN,
            ISBN: req.body.ISBN,
            JAN: req.body.JAN,
            articleNo: req.body.articleNo,
            modelNumber: req.body.modelNumber,
            countryOfManufacture: req.body.countryOfManufacture,
            weightAmount: req.body.weightAmount,
            weightUoMScal: req.body.weightUoMScal,
            heightAmount: req.body.heightAmount,
            heightUoMScal: req.body.heightUoMScal,
            lengthAmount: req.body.lengthAmount,
            lengthUoMScal: req.body.lengthUoMScal,
            depthAmount: req.body.depthAmount,
            depthUoMScal: req.body.depthUoMScal,
            diameterAmount: req.body.diameterAmount,
            diameterUoMScal: req.body.diameterUoMScal,
            volumeAmount: req.body.volumeAmount,
            volumeUoMScal: req.body.volumeUoMScal,
            endCustomerProduct: req.body.endCustomerProduct,
            classificationSystem: req.body.classificationSystem,
            classificationCode: req.body.classificationCode,
            barcode: req.body.barcode,
            brand: req.body.brand,
            harmonizedCode: req.body.harmonizedCode,
            mpProductId: req.body.mpProductId,
            skuAlias: req.body.skuAlias,
            tags: req.body.tags,
            qtyUoMId: req.body.qtyUoMId,
            qtyUoMCategory: req.body.qtyUoMCategory
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.CREATE_SUPPLY_ITEM);
        SupplyItemApi.createMD(options, auditOptions, errorOptions, function (err, supplyItem) {
            if (err) {
                debug(err);
                return next(err);
            }
            req.data = supplyItem;
            next();
        });
    },

    updateMD: function (req, res, next) {
        var user = req.user;
        var account = user.account;
        var options = {
            account: account,
            user: user,
            id: req.body.id,
            type: req.body.type,
            sellerSKUName: req.body.sellerSKUName,
            GCID: req.body.GCID,
            UPC: req.body.UPC,
            EAN: req.body.EAN,
            ISBN: req.body.ISBN,
            JAN: req.body.JAN,
            articleNo: req.body.articleNo,
            modelNumber: req.body.modelNumber,
            countryOfManufacture: req.body.countryOfManufacture,
            weightAmount: req.body.weightAmount,
            weightUoMScal: req.body.weightUoMScal,
            heightAmount: req.body.heightAmount,
            heightUoMScal: req.body.heightUoMScal,
            lengthAmount: req.body.lengthAmount,
            lengthUoMScal: req.body.lengthUoMScal,
            depthAmount: req.body.depthAmount,
            depthUoMScal: req.body.depthUoMScal,
            diameterAmount: req.body.diameterAmount,
            diameterUoMScal: req.body.diameterUoMScal,
            volumeAmount: req.body.volumeAmount,
            volumeUoMScal: req.body.volumeUoMScal,
            endCustomerProduct: req.body.endCustomerProduct,
            classificationSystem: req.body.classificationSystem,
            classificationCode: req.body.classificationCode,
            barcode: req.body.barcode,
            brand: req.body.brand,
            harmonizedCode: req.body.harmonizedCode,
            mpProductId: req.body.mpProductId,
            skuAlias: req.body.skuAlias,
            tags: req.body.tags,
            qtyUoMId: req.body.qtyUoMId,
            qtyUoMCategory: req.body.qtyUoMCategory,
            inventoryCount: req.body.inventoryCount,
            updatedAt: req.body.updatedAt
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_SUPPLY_ITEM);
        SupplyItemApi.updateMD(options, auditOptions, errorOptions, function (err, supplyItem) {
            if (err) {
                debug(err);
                return next(err);
            }
            req.data = supplyItem;
            next();
        });
    },

    checkFields: function (req, res, next) {
        var options = {
            files: req.body.files,
            supplyItemId: req.body.supplyItemId
        };
        SupplyItemApi.checkFields(options, function (err, response) {
            if (err) {
                return next(err);
            }
            next();
        });
    },

    checkTotalImages: function (req, res, next) {
        var user = req.user;
        var options = {
            accountId: user.accountId,
            supplyItemId: req.body.supplyItemId,
            files: req.body.files,
            userId: user.id,
            updatedAt: req.body.updatedAt
        };
        SupplyItemApi.checkTotalImages(options, function (err, response) {
            if (err) {
                return next(err);
            }
            req.updatedAt = response.updatedAt;
            next();
        });
    },

    deleteImageRecord: function (req, res, next) {
        var user = req.user;
        var options = {
            accountId: user.accountId,
            supplyItemId: req.body.supplyItemId,
            userId: user.id
        };
        SupplyItemApi.deleteImageRecord(options, function (err, response) {
            if (err) {
                return next(err);
            }
            next();
        });
    },

    createImagePreSignedUrl: function (req, res, next) {
        var user = req.user;
        var options = {
            user: user,
            files: req.body.files,
            supplyItemId: req.body.supplyItemId,
            updatedAt: req.updatedAt
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.CREATE_SUPPLY_IMAGE_LOG);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        SupplyItemApi.createImagePreSignedUrl(options, errorOptions, auditOptions, function (err, references) {
            if (err) {
                return next(err);
            }
            req.data = references;
            next();
        });
    },

    updateImageLogs: function (req, res, next) {
        var user = req.user;
        var options = {
            user: user,
            supplyItemId: req.body.supplyItemId,
            files: req.body.files,
            mainImage: req.body.mainImage,
            updatedAt: req.body.updatedAt
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_SUPPLY_IMAGE_LOG);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        SupplyItemApi.updateImageLogs(options, errorOptions, auditOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    getImageLogs: function (req, res, next) {
        var user = req.user;
        var options = {
            user: user,
            supplyItemId: req.query.supplyItemId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        SupplyItemApi.getImageLogs(options, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    getOriginalImage: function (req, res, next) {
        var user = req.user;
        var options = {
            user: user,
            fileName: req.query.fileName,
            supplyItemId: req.query.supplyItemId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        SupplyItemApi.getOriginalImage(options, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    deleteSupplyImageLogs: function (req, res, next) {
        var user = req.user;
        var options = {
            user: user,
            supplyItemId: req.body.supplyItemId,
            files: req.body.files,
            isMain: req.body.isMain,
            updatedAt: req.body.updatedAt
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.DELETE_SUPPLY_IMAGE_LOG);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        SupplyItemApi.deleteSupplyImageLogs(options, errorOptions, auditOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    setMainSupplyImage: function (req, res, next) {
        var user = req.user;
        var options = {
            user: user,
            supplyItemId: req.body.supplyItemId,
            fileName: req.body.fileName,
            mainImage: req.body.mainImage,
            updatedAt: req.body.updatedAt
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.SET_MAIN_SUPPLY_IMAGE);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        SupplyItemApi.setMainSupplyImage(options, errorOptions, auditOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    deleteArchieveItems: function (req, res, next) {
        var user = req.user;
        var options = {
            userId: user.id,
            accountId: user.accountId,
            supplyItems: req.body.supplyItems
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.DELETE_ARCHIEVE_SUPPLY_ITEM);
        SupplyItemApi.deleteArchieveItems(options, auditOptions, errorOptions, function (err, supplyItems) {
            if (err) {
                return next(err);
            }
            req.data = supplyItems;
            next();
        });
    },

    restoreArchieveItems: function (req, res, next) {
        var user = req.user;
        var options = {
            userId: user.id,
            accountId: user.accountId,
            supplyItems: req.body.supplyItems
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.RESTORE_ARCHIEVE_SUPPLY_ITEM);
        SupplyItemApi.restoreArchieveItems(options, auditOptions, errorOptions, function (err, supplyItems) {
            if (err) {
                return next(err);
            }
            req.data = supplyItems;
            next();
        });
    },

    deleteItems: function (req, res, next) {
        var user = req.user;
        var options = {
            userId: user.id,
            accountId: user.accountId,
            supplyItems: req.body.supplyItems
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.DELETE_SUPPLY_ITEM);
        SupplyItemApi.deleteItems(options, auditOptions, errorOptions, function (err, supplyItems) {
            if (err) {
                return next(err);
            }
            req.data = supplyItems;
            next();
        });
    },

};

module.exports = SupplyItem;

(function () {
    if (require.main == module) {
    }
}());