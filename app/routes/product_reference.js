#!/usr/bin/env node

'use strict';
var Util = require('util');
var debug = require('debug')('scopehub.route.product_reference');
var multiparty = require('multiparty');
var path = require('path');
var fs = require('fs');
var base64 = require('file-base64');
var _ = require('lodash');
var ProductReferenceApi = require('../api/product_reference');
var HeaderUtils = require('../lib/header_utils');
var Events = require('../data/events');
var Constants = require('../data/constants');

var ProductReference = {

    createMD: function (req, res, next) {
        var account = req.account;
        var user = req.user;
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
        ProductReferenceApi.createMD(options, errorOptions, function (err, reference) {
            if (err) {
                return next(err);
            }
            req.data = reference;
            return next();
        });
    },

    getProductReferenceMD: function (req, res, next) {
        var options = {
            id: req.query.id,
            user: req.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        ProductReferenceApi.getProductReferenceMD(options, errorOptions, function (err, references) {
            if (err) {
                return next(err);
            }
            req.data = references;
            next();
        });
    },

    getProductsByAccountIdMD: function (req, res, next) {
        var account = req.account;
        var options = {
            accountId: account.id,
            user: req.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        ProductReferenceApi.getProductsByAccountIdMD(options, errorOptions, function (err, references) {
            if (err) {
                return next(err);
            }
            req.data = references;
            next();
        });
    },

    updateMD: function (req, res, next) {
        var user = req.user;
        var account = req.account;
        var options = {
            id: req.body.id,
            account: account,
            user: user,
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
            updatedAt: req.body.updatedAt,
            qtyUoMId: req.body.qtyUoMId,
            qtyUoMCategory: req.body.qtyUoMCategory,
            inventoryCount: req.body.inventoryCount
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_PRODUCT_REFERENCE);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        ProductReferenceApi.updateMD(options, auditOptions, errorOptions, function (err, reference) {
            if (err) {
                return next(err);
            }
            req.data = reference;
            next();
        });
    },

    updateProductsMD: function (req, res, next) {
        var user = req.user;
        var account = req.account;
        var options = {
            products: req.body.products,
            user: user,
            account: account
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_PRODUCT_REFERENCE);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        ProductReferenceApi.updateProductsMD(options, auditOptions, errorOptions, function (err, reference) {
            if (err) {
                return next(err);
            }
            req.data = reference;
            next();
        });
    },

    addProductReferencesMD: function (req, res, next) {

        var options = {
            account: req.account,
            mpId: req.body.mpId,
            user: req.user,
            products: req.body.products
        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.ONBOARD_ADD_PRODUCT_REFERENCES);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        ProductReferenceApi.addProductReferencesMD(options, errorOptions, auditOptions, function (err, products) {
            if (err) {
                return next(err);
            }
            debug('products', products);
            req.data = products;
            next();
        });
    },

    createImagePreSignedUrlMD: function (req, res, next) {
        var user = req.user;
        var options = {
            user: user,
            files: req.body.files,
            productRefId: req.body.productRefId,
            updatedAt: req.updatedAt
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.CREATE_PRODUCT_IMAGE_LOG);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        ProductReferenceApi.createImagePreSignedUrlMD(options, errorOptions, auditOptions, function (err, references) {
            if (err) {
                return next(err);
            }
            req.data = references;
            next();
        });
    },

    getOriginalImageMD: function (req, res, next) {
        var user = req.user;
        var options = {
            user: user,
            fileName: req.query.fileName,
            productRefId: req.query.productRefId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        ProductReferenceApi.getOriginalImageMD(options, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    checkFieldsMD: function (req, res, next) {
        var options = {
            files: req.body.files,
            productRefId: req.body.productRefId
        };
        ProductReferenceApi.checkFieldsMD(options, function (err, response) {
            if (err) {
                return next(err);
            }
            next();
        });
    },

    checkTotalImagesMD: function (req, res, next) {
        var user = req.user;
        var options = {
            accountId: user.accountId,
            productRefId: req.body.productRefId,
            files: req.body.files,
            userId: user.id,
            updatedAt: req.body.updatedAt
        };
        ProductReferenceApi.checkTotalImagesMD(options, function (err, response) {
            if (err) {
                return next(err);
            }
            req.updatedAt = response.updatedAt;
            next();
        });
    },

    deleteImageRecordMD: function (req, res, next) {
        var user = req.user;
        var options = {
            accountId: user.accountId,
            productRefId: req.body.productRefId,
            userId: user.id
        };
        ProductReferenceApi.deleteImageRecordMD(options, function (err, response) {
            if (err) {
                return next(err);
            }
            next();
        });
    },

    getImageLogsMD: function (req, res, next) {
        var user = req.user;
        var options = {
            user: user,
            productRefId: req.query.productRefId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        ProductReferenceApi.getImageLogsMD(options, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    updateImageLogsMD: function (req, res, next) {
        var user = req.user;
        var options = {
            user: user,
            productRefId: req.body.productRefId,
            files: req.body.files,
            mainImage: req.body.mainImage,
            updatedAt: req.body.updatedAt
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_PRODUCT_IMAGE_LOG);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        ProductReferenceApi.updateImageLogsMD(options, errorOptions, auditOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    deleteProductImageLogsMD: function (req, res, next) {
        var user = req.user;
        var options = {
            user: user,
            productRefId: req.body.productRefId,
            files: req.body.files,
            isMain: req.body.isMain,
            updatedAt: req.body.updatedAt
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.DELETE_PRODUCT_IMAGE_LOG);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        ProductReferenceApi.deleteProductImageLogsMD(options, errorOptions, auditOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    setMainProductImageMD: function (req, res, next) {
        var user = req.user;
        var options = {
            user: user,
            productRefId: req.body.productRefId,
            fileName: req.body.fileName,
            mainImage: req.body.mainImage,
            updatedAt: req.body.updatedAt
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.SET_MAIN_PRODUCT_IMAGE);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        ProductReferenceApi.setMainProductImageMD(options, errorOptions, auditOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    searchProductReference: function (req, res, next) {
        var user = req.user;
        var options = {
            user: user,
            sku: req.query.sku,
            sellerSKUName: req.query.sellerSKUName,
            type: req.query.type,
            mpProductId: req.query.mpProductId,
            UPC: req.query.UPC,
            brand: req.query.brand
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        ProductReferenceApi.searchProductReference(options, errorOptions, function (err, reference) {
            if (err) {
                return next(err);
            }
            req.data = reference;
            return next();
        });
    },

    deleteArchieveItems: function (req, res, next) {
        var user = req.user;
        var options = {
            userId: user.id,
            accountId: user.accountId,
            products: req.body.products
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.DELETE_ARCHIEVE_PRODUCT);
        ProductReferenceApi.deleteArchieveItems(options, auditOptions, errorOptions, function (err, products) {
            if (err) {
                return next(err);
            }
            req.data = products;
            next();
        });
    },

    restoreArchieveItems: function (req, res, next) {
        var user = req.user;
        var options = {
            userId: user.id,
            accountId: user.accountId,
            products: req.body.products
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.RESTORE_ARCHIEVE_PRODUCT);
        ProductReferenceApi.restoreArchieveItems(options, auditOptions, errorOptions, function (err, products) {
            if (err) {
                return next(err);
            }
            req.data = products;
            next();
        });
    },

    deleteItems: function (req, res, next) {
        var user = req.user;
        var options = {
            userId: user.id,
            accountId: user.accountId,
            products: req.body.products
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.DELETE_PRODUCT);
        ProductReferenceApi.deleteItems(options, auditOptions, errorOptions, function (err, products) {
            if (err) {
                return next(err);
            }
            req.data = products;
            next();
        });
    },

};

module.exports = ProductReference;
