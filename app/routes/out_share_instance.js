#!/usr/bin/env node

'use strict';

var debug = require('debug')('scopehub.route.customer');
var OutShareInstanceApi = require('../api/out_share_instance');
var Constants = require('../data/constants');
var Events = require('../data/events');
var HeaderUtils = require('../lib/header_utils');

var OutShareInstance = {

    createMD: function (req, res, next) {
        var options = {
            user: req.user,
            accountId: req.user.accountId,
            userId: req.user.id,
            outShareId: req.body.outShareId,
            outShareName: req.body.outShareName,
            shareItemIds: req.body.shareItemIds,
            shareItemType: req.body.shareItemType,
            sharedDataItems: req.body.sharedDataItems,
            sharingProfileId: req.body.sharingProfileId,
            freqType: req.body.freqType,
            freqTime: req.body.freqTime,
            freqDay: req.body.freqDay,
            notes: req.body.notes,
            noOfDays: req.body.noOfDays,
            status: req.body.status,
            offeredStartDate: req.body.offeredStartDate,
            startDateType: req.body.startDateType,
            accounts: req.body.accounts,
            newProfileId: req.body.newProfileId,
            newProfileName: req.body.newProfileName,
            useExisting: req.body.useExisting,
            saveAsLater: req.body.saveAsLater,
            dataProtectionOption: req.body.dataProtectionOption,
            supplyItemId: req.body.supplyItemId
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        OutShareInstanceApi.createMD(options, errorOptions, function (err, outShareInstance) {
            if (err) {
                return next(err);
            }
            req.data = outShareInstance;
            next();
        });
    },

    updateMD: function (req, res, next) {
        var options = {
            user: req.user,
            id: req.body.id,
            removeShareItems: req.body.removeShareItems,
            addShareItems: req.body.addShareItems,
            removeSharePartners: req.body.removeSharePartners,
            addSharePartners: req.body.addSharePartners,
            status: req.body.status,
            updatedAt: req.body.updatedAt,
            accounts: req.body.accounts,
            useExisting: req.body.useExisting,
            sharingProfileId: req.body.sharingProfileId,
            saveAsLater: req.body.saveAsLater,
            newProfileId: req.body.newProfileId,
            newProfileName: req.body.newProfileName,
            freqType: req.body.freqType,
            freqTime: req.body.freqTime,
            freqDay: req.body.freqDay,
            notes: req.body.notes,
            sharedDataItems: req.body.sharedDataItems,
            shareItemType: req.body.shareItemType,
            noOfDays: req.body.noOfDays,
            offeredStartDate: req.body.offeredStartDate,
            startDateType: req.body.startDateType,
            outShareId: req.body.outShareId,
            outShareName: req.body.outShareName
        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.OUT_SHARE_INSTANCE_UPDATE);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        OutShareInstanceApi.updateMD(options, auditOptions, errorOptions, function (err, outShareInstance) {
            if (err) {
                return next(err);
            }
            req.data = outShareInstance;
            next();
        });
    },

    delete: function (req, res, next) {
        var options = {
            ids: req.body.ids,
            userId: req.user.id,
            accountId: req.user.accountId
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.OUT_SHARE_INSTANCE_DELETE);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        OutShareInstanceApi.delete(options, auditOptions, errorOptions, function (err, outShareInstance) {
            if (err) {
                return next(err);
            }
            req.data = outShareInstance;
            next();
        });
    },

    /*getByItemIdSharingProfileId: function (req, res, next) {
        var options = {
            itemId: req.query.itemId,
            sharingProfileId: req.query.sharingProfileId,
            accountId: req.user.accountId
        };
        OutShareInstanceApi.getByItemIdSharingProfileId(options, function (err, outShareInstance) {
            if (err) {
                return next(err);
            }
            req.data = outShareInstance;
            next();
        });
    },*/

    /*getByAccountId: function (req, res, next) {
        var accountId = req.user.accountId;
        var itemId = req.query.itemId;
        var options = {
            accountId: accountId,
            itemId: itemId
        };
        OutShareInstanceApi.getByAccountId(options, function (err, outShareInstances) {
            if (err) {
                return next(err);
            }
            req.data = outShareInstances;
            next();
        });
    },*/

    getByAccountIdMD: function (req, res, next) {

        var options = {
            accountId: req.user.accountId,
            shareItemReference: req.query.shareItemReference
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        OutShareInstanceApi.getByAccountIdMD(options, errorOptions, function (err, outShareInstances) {
            if (err) {
                return next(err);
            }
            req.data = outShareInstances;
            next();
        });
    },

    searchOutShares: function (req, res, next) {

        var options = {
            accountId: req.user.accountId,
            shareItemReference: req.query.shareItemReference,
            outShareId: req.query.outShareId,
            outShareName: req.query.outShareName
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        OutShareInstanceApi.searchOutShares(options, errorOptions, function (err, outShareInstances) {
            if (err) {
                return next(err);
            }
            req.data = outShareInstances;
            next();
        });
    },

    getByIdAndAccountIdMD: function (req, res, next) {
        var options = {
            accountId: req.user.accountId,
            id: req.query.id,
            shareItemType: req.query.shareItemType
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        OutShareInstanceApi.getByIdAndAccountIdMD(options, errorOptions, function (err, outShareInstances) {
            if (err) {
                return next(err);
            }
            req.data = outShareInstances;
            next();
        });
    },

    getByItemIdsAndProfileIdMD: function (req, res, next) {

        var options = {
            accountId: req.user.accountId,
            shareItemIds: req.body.shareItemIds,
            sharingProfileId: req.body.sharingProfileId
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        OutShareInstanceApi.getByItemIdsAndProfileIdMD(options, errorOptions, function (err, outShareInstances) {
            if (err) {
                return next(err);
            }
            req.data = outShareInstances;
            next();
        });
    },

    searchByPartnerNameMD: function (req, res, next) {
        var query = req.query.query;
        var options = {
            query: query,
            user: req.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        OutShareInstanceApi.searchByPartnerNameMD(options, errorOptions, function (err, references) {
            if (err) {
                return next(err);
            }
            req.data = references;
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
        OutShareInstanceApi.searchProductBySKUMD(options, errorOptions, function (err, references) {
            if (err) {
                return next(err);
            }
            req.data = references;
            next();
        });
    },

    searchProductBySKUDependentDemand: function (req, res, next) {
        var query = req.query.query;
        var supplyItemSKU = req.query.supplyItemSKU;
        var options = {
            query: query,
            supplyItemSKU: supplyItemSKU,
            user: req.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        OutShareInstanceApi.searchProductBySKUDependentDemand(options, errorOptions, function (err, references) {
            if (err) {
                return next(err);
            }
            req.data = references;
            next();
        });
    },

    searchProductBySellerSKUNameDependentDemand: function (req, res, next) {
        var query = req.query.query;
        var supplyItemSKU = req.query.supplyItemSKU;
        var options = {
            query: query,
            supplyItemSKU: supplyItemSKU,
            user: req.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        OutShareInstanceApi.searchProductBySellerSKUNameDependentDemand(options, errorOptions, function (err, references) {
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
        OutShareInstanceApi.searchProductBySellerSKUNameMD(options, errorOptions, function (err, references) {
            if (err) {
                return next(err);
            }
            req.data = references;
            next();
        });
    },

    searchSupplyInventoryBySKU: function (req, res, next) {
        var query = req.query.query;
        var options = {
            query: query,
            user: req.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        OutShareInstanceApi.searchSupplyInventoryBySKU(options, errorOptions, function (err, references) {
            if (err) {
                return next(err);
            }
            req.data = references;
            next();
        });
    },

    searchSupplyInventoryBySellerSKUName: function (req, res, next) {
        var query = req.query.query;
        var options = {
            query: query,
            user: req.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        OutShareInstanceApi.searchSupplyInventoryBySellerSKUName(options, errorOptions, function (err, references) {
            if (err) {
                return next(err);
            }
            req.data = references;
            next();
        });
    },

    getExistingOutShareDetails: function (req, res, next) {
        var options = {
            accountId: req.user.accountId,
            shareItemType: req.body.shareItemType,
            accounts: req.body.accounts,
            shareItemIds: req.body.shareItemIds
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        OutShareInstanceApi.getExistingOutShareDetails(options, errorOptions, function (err, outShareInstances) {
            if (err) {
                return next(err);
            }
            req.data = outShareInstances;
            next();
        });
    },
};

module.exports = OutShareInstance;