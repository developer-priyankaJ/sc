#!/usr/bin/env node

'use strict';

var debug = require('debug')('scopehub.route.product_by_mp');
var Util = require('util');

var ProductByMpApi = require('../api/product_by_mp');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');
var HeaderUtils = require('../lib/header_utils');
var Events = require('../data/events');

var ProductByMp = {

    getAllProductByMpListMD: function (req, res, next) {
        var account = req.account;
        var options = {
            accountId: account.id,
            userId: req.user.id,
            mpId: req.query.mpId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        ProductByMpApi.getAllProductByMpListMD(options, errorOptions, function (err, products) {
            if (err) {
                return next(err);
            }
            req.data = products;
            next();
        });
    },

    validateAuthorizationMD: function (req, res, next) {
        var options = {
            account: req.account,
            user: req.user,
            mpId: req.query.mpId,
            sellerId: req.query.sellerId,
            token: req.query.token
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_MARKETPLACE_ACCOUNT);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        ProductByMpApi.validateAuthorizationMD(options, auditOptions, errorOptions, function (err, products) {
            if (err) {
                return next(err);
            }
            req.data = products;
            next();
        });
    },

    getProductByMpDetailByASINAndMPMD: function (req, res, next) {
        var account = req.account;
        var user = req.user;
        var options = {
            account: account,
            user: user,
            mpId: req.query.mpId,
            mpProductId: req.query.mpProductId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        ProductByMpApi.getProductByMpDetailByASINAndMPMD(options, errorOptions, function (err, products) {
            if (err) {
                return next(err);
            }
            req.data = products;
            next();
        });
    },

    // Copy products into different marketplaces
    getProductByMpDetailById: function (req, res, next) {
        var account = req.account;
        var user = req.user;
        var options = {
            account: account,
            user: user,
            id: req.query.id
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        ProductByMpApi.getProductByMpDetailById(options, errorOptions, function (err, products) {
            if (err) {
                return next(err);
            }
            req.data = products;
            next();
        });
    },

    getProductByMpDetailByMpIdProductRefId: function (req, res, next) {
        var account = req.account;
        var user = req.user;
        var options = {
            mpId: req.query.mpId,
            productRefId: req.query.productRefId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        ProductByMpApi.getProductByMpDetailByMpIdProductRefId(options, errorOptions, function (err, products) {
            if (err) {
                return next(err);
            }
            req.data = products;
            next();
        });
    },

    getProductByMpDetailByProductRef: function (req, res, next) {
        var account = req.account;
        var user = req.user;
        var options = {
            account: account,
            user: user,
            productRefId: req.query.productRefId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        ProductByMpApi.getProductByMpDetailByProductRef(options, errorOptions, function (err, products) {
            if (err) {
                return next(err);
            }
            req.data = products;
            next();
        });
    },

    getSubmitfeedReportMD: function (req, res, next) {
        req.body = req.body.options || req.body;
        // debug('req.body.productByMpStore', req.body.productByMpStore);
        var options = {
            user: req.body.user,
            product: req.body.product
        };

        ProductByMpApi.getSubmitfeedReportMD(options, function (err, products) {
            if (err) {
                return next(err);
            }
            req.data = products;
            next();
        });
    },

    createMD: function (req, res, next) {
        var account = req.account;
        var user = req.user;
        var options = {
            account: account,
            user: user,
            product: req.body.product,
            mpProductId: req.body.mpProductId,
            mpId: req.body.mpId,
            packageQuantity: req.body.packageQuantity,
            averageRetailPrice: req.body.averageRetailPrice,
            conditionType: req.body.conditionType
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.CREATE_PRODUCT_BY_MP);
        ProductByMpApi.createMD(options, auditOptions, errorOptions, function (err, product) {
            if (err) {
                return next(err);
            }
            req.data = product;
            next();
        });
    },

    updateMD: function (req, res, next) {
        var account = req.account;
        var user = req.user;
        var options = {
            account: account,
            user: user,
            updatedAt: req.body.updatedAt,
            productRefId: req.body.productRefId,
            mpId: req.body.mpId,
            packageQuantity: req.body.packageQuantity,
            averageRetailPrice: req.body.averageRetailPrice,
            conditionType: req.body.conditionType,
            averageCost: req.body.averageCost,
            wholesalePrice: req.body.wholesalePrice,
            declaredValue: req.body.declaredValue,
            productTitle: req.body.productTitle,
            description: req.body.description
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        ProductByMpApi.updateMD(options, errorOptions, function (err, product) {
            if (err) {
                return next(err);
            }
            req.data = product;
            next();
        });
    },

    updateQuantityMD: function (req, res, next) {
        var account = req.account;
        var user = req.user;
        var options = {
            account: account,
            user: user,
            updatedAt: req.body.updatedAt,
            productRefId: req.body.productRefId,
            mpId: req.body.mpId,
            sku: req.body.sku,
            packageQuantity: req.body.packageQuantity
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        ProductByMpApi.updateQuantityMD(options, errorOptions, function (err, product) {
            if (err) {
                return next(err);
            }
            req.data = product;
            next();
        });
    },
    updatePriceMD: function (req, res, next) {
        var account = req.account;
        var user = req.user;
        var options = {
            account: account,
            user: user,
            updatedAt: req.body.updatedAt,
            productRefId: req.body.productRefId,
            mpId: req.body.mpId,
            sku: req.body.sku,
            averageRetailPrice: req.body.averageRetailPrice
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        ProductByMpApi.updatePriceMD(options, errorOptions, function (err, product) {
            if (err) {
                return next(err);
            }
            req.data = product;
            next();
        });
    }
};

module.exports = ProductByMp;


