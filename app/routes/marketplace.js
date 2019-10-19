#!/usr/bin/env node

'use strict';

var debug = require('debug')('scopehub.route.marketplace');
var Util = require('util');

var MarketplaceApi = require('../api/marketplace');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');
var HeaderUtils = require('../lib/header_utils');
var Events = require('../data/events');

var Marketplace = {

    createMD: function (req, res, next) {
        var options = {
            mpId: req.body.mpId,
            name: req.body.name,
            region: req.body.region,
            mpLink: req.body.mpLink,
            imageURL: req.body.imageURL,
            countryCode: req.body.countryCode,
            currencyCode: req.body.currencyCode,
            primaryTimeZone: req.body.primaryTimeZone,
            user: req.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.CREATE_MARKETPLACE);
        MarketplaceApi.createMD(options, auditOptions, errorOptions, function (err, marketplace) {
            if (err) {
                return next(err);
            }
            req.data = marketplace;
            next();
        });
    },

    getMarketplace: function (req, res, next) {
        var options = {
            marketplaceId: req.query.marketplaceId
        };
        MarketplaceApi.getMarketplace(options, function (err, marketplace) {
            if (err) {
                return next(err);
            }
            req.data = marketplace;
            next();
        });
    },

    getMarketplaceMD: function (req, res, next) {
        var options = {
            mpId: req.query.mpId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        MarketplaceApi.getMarketplaceMD(options, errorOptions, function (err, marketplace) {
            if (err) {
                return next(err);
            }
            req.data = marketplace;
            next();
        });
    },
    getUnRegisteredMpsAccount: function (req, res, next) {
        var options = {
            account: req.account
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        MarketplaceApi.getUnRegisteredMpsAccount(options, errorOptions, function (err, marketplace) {
            if (err) {
                return next(err);
            }
            req.data = marketplace;
            next();
        });
    },

    updateMarketplaceMD: function (req, res, next) {
        var options = {
            mpId: req.body.mpId,
            name: req.body.name,
            region: req.body.region,
            imageURL: req.body.imageURL,
            mpLink: req.body.mpLink,
            updatedAt: req.body.updatedAt,
            user: req.user,
            countryCode: req.body.countryCode,
            currencyCode: req.body.currencyCode,
            primaryTimeZone: req.body.primaryTimeZone
        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_MARKETPLACE);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        MarketplaceApi.updateMarketplaceMD(options, auditOptions, errorOptions, function (err, marketplace) {
            if (err) {
                return next(err);
            }
            req.data = marketplace;
            next();
        });
    },

    getMarketplacesMD: function (req, res, next) {
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        MarketplaceApi.getMarketplacesMD(errorOptions, function (err, marketplaces) {
            if (err) {
                return next(err);
            }
            req.data = marketplaces;
            next();
        });
    },

    getMarketplacesDetailsForSellerMD: function (req, res, next) {
        var options = {
            account: req.account
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        MarketplaceApi.getMarketplacesDetailsForSellerMD(options, errorOptions, function (err, marketplaces) {
            if (err) {
                return next(err);
            }
            req.data = marketplaces;
            next();
        });
    },

    removeMarketplaceMD: function (req, res, next) {
        var options = {
            mpId: req.body.mpId,
            updatedAt: req.body.updatedAt,
            user: req.user
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.REMOVE_MARKETPLACE);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        MarketplaceApi.removeMarketplaceMD(options, auditOptions, errorOptions, function (err, res) {
            if (err) {
                debug(err);
                return next(err);
            }
            req.data = res;
            next();
        });
    }
};

module.exports = Marketplace;

(function () {
    if (require.main == module) {
    }
}());
