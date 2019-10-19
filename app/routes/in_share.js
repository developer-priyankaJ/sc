'use strict';

var debug = require('debug')('scopehub.route.customer');
var OutShareInstanceApi = require('../api/out_share_instance');
var Constants = require('../data/constants');
var Events = require('../data/events');
var HeaderUtils = require('../lib/header_utils');
var inShareApi = require('../api/in_share');
var DataUtils = require('../lib/data_utils');

var InShare = {

    createMD: function (req, res, next) {

        var options = {
            accountId: req.user.accountId,
            outShareIds: [{id: req.body.outShareId, updatedAt: req.body.updatedAt}],
            user: req.user
        };


        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        inShareApi.createMD(options, errorOptions, function (err, inShares) {
            if (err) {
                return next(err);
            }
            req.data = inShares;
            next();
        });
    },

    createInternalMD: function (req, res, next) {

        debug('interval route');
        var options = {
            accountId: req.body.accountId,
            outShareIds: req.body.outShareIds,
            user: req.body.user
        };
        //next(null, true);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        inShareApi.createMD(options, errorOptions, function (err, inShares) {
            if (err) {
                return next(err);
            }
            return next();
        });

    },


    getByAccountId: function (req, res, next) {
        var accountId = req.user.accountId;
        var options = {
            accountId: accountId
        };
        inShareApi.getByAccountId(options, function (err, inShares) {
            if (err) {
                return next(err);
            }
            req.data = inShares;
            next();
        });
    },

    getByAccountIdMD: function (req, res, next) {

        var options = {
            accountId: req.user.accountId
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        inShareApi.getByAccountIdMD(options, errorOptions, function (err, inShares) {
            if (err) {
                return next(err);
            }
            req.data = inShares;
            next();
        });
    },

    searchInShares: function (req, res, next) {

        var options = {
            accountId: req.user.accountId,
            inShareId: req.query.inShareId,
            inShareName: req.query.inShareName
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        inShareApi.searchInShares(options, errorOptions, function (err, inShares) {
            if (err) {
                return next(err);
            }
            req.data = inShares;
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

        inShareApi.getByIdAndAccountIdMD(options, errorOptions, function (err, inShares) {
            if (err) {
                return next(err);
            }
            req.data = inShares;
            next();
        });
    },

    updateActionMD: function (req, res, next) {

        var options = {
            user: req.user,
            accountId: req.user.accountId,
            id: req.body.id,
            action: req.body.action,
            dataDeliveryOption: req.body.dataDeliveryOption,
            inShareId: req.body.inShareId,
            inShareName: req.body.inShareName,
            updatedAt: req.body.updatedAt,
            notes: req.body.notes
        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.IN_SHARE_UPDATE);

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        inShareApi.updateActionMD(options, auditOptions, errorOptions, function (err, inShares) {
            if (err) {
                return next(err);
            }
            req.data = inShares;
            next();
        });
    },
    update: function (req, res, next) {

        var options = {
            user: req.user,
            accountId: req.user.accountId,
            id: req.body.id,
            status: req.body.status,
            inShareName: req.body.inShareName,
            updatedAt: req.body.updatedAt,
            notes: req.body.notes
        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.IN_SHARE_UPDATE);

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        inShareApi.update(options, auditOptions, errorOptions, function (err, inShares) {
            if (err) {
                return next(err);
            }
            req.data = inShares;
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
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.IN_SHARE_DELETE);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        inShareApi.deleteInShare(options, auditOptions, errorOptions, function (err, outShareInstance) {
            if (err) {
                return next(err);
            }
            req.data = outShareInstance;
            next();
        });
    },

    expiredRemindInShare: function (req, res, next) {
        //var user = req.user;
        req.body = req.body.options || req.body;
        var expiredRemindInShares = req.body.expiredRemindInShares;
        var options = {
            //accountId: user.accountId,
            //languageCultureCode: user.languageCultureCode,
            expiredRemindInShares: expiredRemindInShares
        };

        inShareApi.expiredRemindInShare(options, function (err, response) {
            if (err) {
                return next();
            }
            req.data = response;
            next();
        });
    },

    getErrorLogByInShareId: function (req, res, next) {

        var options = {
            inShareId: req.query.inShareId
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        inShareApi.getErrorLogByInShareId(options, errorOptions, function (err, inShares) {
            if (err) {
                return next(err);
            }
            req.data = inShares;
            next();
        });
    },

    createInShareAlert: function (req, res, next) {
        var options = {
            user: req.user,
            inShareId: req.body.inShareId,
            alertId: req.body.alertId,
            alertName: req.body.alertName,
            shareItemId: req.body.shareItemId,
            sharedDataItem: req.body.sharedDataItem,
            shareItemType: req.body.shareItemType,
            alertType: req.body.alertType,
            averageType: req.body.averageType,
            averageValue: req.body.averageValue,
            frequencyType: req.body.frequencyType,
            checkTime: req.body.checkTime,
            startDate: req.body.startDate,
            operationType: req.body.operationType,
            recipients: req.body.recipients // Users,contacts or named groups
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.CREATE_IN_SHARE_ALERT);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        inShareApi.createInShareAlert(options, auditOptions, errorOptions, function (err, inShares) {
            if (err) {
                return next(err);
            }
            req.data = inShares;
            next();
        });
    },

    getInSharesByMapItem: function (req, res, next) {
        var options = {
            user: req.user,
            mapItemId: req.body.mapItemId,
            mapItemType: req.body.mapItemType
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        inShareApi.getInSharesByMapItem(options, errorOptions, function (err, inShares) {
            if (err) {
                return next(err);
            }
            req.data = inShares;
            next();
        });
    },

    updateInShareAlert: function (req, res, next) {
        var options = {
            user: req.user,
            id: req.body.id,
            inShareId: req.body.inShareId,
            alertId: req.body.alertId,
            alertName: req.body.alertName,
            shareItemId: req.body.shareItemId,
            sharedDataItem: req.body.sharedDataItem,
            alertType: req.body.alertType,
            averageType: req.body.averageType,
            averageValue: req.body.averageValue,
            frequencyType: req.body.frequencyType,
            startDate: req.body.startDate,
            operationType: req.body.operationType,
            checkTime: req.body.checkTime,
            updatedAt: req.body.updatedAt
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_IN_SHARE_ALERT);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        inShareApi.updateInShareAlert(options, auditOptions, errorOptions, function (err, inShares) {
            if (err) {
                return next(err);
            }
            req.data = inShares;
            next();
        });
    },

    getInShareAlert: function (req, res, next) {
        var options = {
            accountId: req.user.accountId,
            userId: req.user.id,
            inShareId: req.query.inShareId,
            shareItemType: req.query.shareItemType
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        inShareApi.getInShareAlert(options, errorOptions, function (err, inShares) {
            if (err) {
                return next(err);
            }
            req.data = inShares;
            next();
        });
    },

    getInShareAlertByItemType: function (req, res, next) {
        var options = {
            accountId: req.user.accountId,
            userId: req.user.id,
            shareItemType: req.query.shareItemType
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        inShareApi.getInShareAlertByItemType(options, errorOptions, function (err, inShares) {
            if (err) {
                return next(err);
            }
            req.data = inShares;
            next();
        });
    },

    deleteInShareAlert: function (req, res, next) {
        var options = {
            accountId: req.user.accountId,
            userId: req.user.id,
            id: req.query.id,
            updatedAt: req.query.updatedAt
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.DELETE_IN_SHARE_ALERT);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        inShareApi.deleteInShareAlert(options, auditOptions, errorOptions, function (err, inShares) {
            if (err) {
                return next(err);
            }
            req.data = inShares;
            next();
        });
    },

    checkAndRaiseAlert: function (req, res, next) {
        req.body = req.body.options || req.body;
        var options = {
            sharingAlert: req.body.sharingAlert
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        inShareApi.checkAndRaiseAlert(options, errorOptions, function (err, inShares) {
            if (err) {
                return next(err);
            }
            req.data = inShares;
            next();
        });
    },

    getRaisedAlertCount: function (req, res, next) {
        var options = {
            accountId: req.user.accountId,
            userId: req.user.id
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        inShareApi.getRaisedAlertCount(options, errorOptions, function (err, inShares) {
            if (err) {
                return next(err);
            }
            req.data = inShares;
            next();
        });
    },

    updateAsReadAlert: function (req, res, next) {
        var options = {
            accountId: req.user.accountId,
            userId: req.user.id,
            shareItemType: req.body.shareItemType
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        inShareApi.updateAsReadAlert(options, errorOptions, function (err, inShares) {
            if (err) {
                return next(err);
            }
            req.data = inShares;
            next();
        });
    },

    updateAsReadAlertByIds: function (req, res, next) {
        var options = {
            accountId: req.user.accountId,
            userId: req.user.id,
            alertIds: req.body.alertIds
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        inShareApi.updateAsReadAlertByIds(options, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    validateMapShareItems: function (req, res, next) {
        var options = {
            mappingIds: req.body.mappingIds,
            inShareId: req.body.inShareId,
            mapItemType: req.body.mapItemType
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        inShareApi.validateMapShareItems(options, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    mapShareItems: function (req, res, next) {
        var options = {
            accountId: req.user.accountId,
            userId: req.user.id,
            mappingIds: req.body.mappingIds,
            inShareId: req.body.inShareId,
            mapItemType: req.body.mapItemType
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        inShareApi.mapShareItems(options, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    getMappedShareItems: function (req, res, next) {
        var options = {
            accountId: req.user.accountId,
            userId: req.user.id,
            mapItemType: req.query.mapItemType,
            mapItemId: req.query.mapItemId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        inShareApi.getMappedShareItems(options, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    updateMappedShareItems: function (req, res, next) {
        var options = {
            accountId: req.user.accountId,
            userId: req.user.id,
            id: req.body.id,
            updatedAt: req.body.updatedAt,
            mapItemId: req.body.mapItemId,
            shareItemId: req.body.shareItemId,
            inShareId: req.body.inShareId,
            isDelete: req.body.isDelete
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        inShareApi.updateMappedShareItems(options, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    getOutSharePartners: function (req, res, next) {
        var options = {
            accountId: req.user.accountId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        inShareApi.getOutSharePartners(options, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    getShareItemsByOutSharePartners: function (req, res, next) {
        var options = {
            accountId: req.user.accountId,
            partnerUserId: req.query.partnerUserId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        inShareApi.getShareItemsByOutSharePartners(options, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    }
};

module.exports = InShare;