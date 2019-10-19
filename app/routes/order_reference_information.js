'use strict';

var debug = require('debug')('scopehub.route.order_reference_information');
var Events = require('../data/events');
var path = require('path');
var fs = require('fs');
var base64 = require('file-base64');
var HeaderUtils = require('../lib/header_utils');
var OrderReferenceInformationApi = require('../api/order_reference_information');
var OrderLineItemsApi = require('../api/order_line_items');
//var aws = require('aws-sdk');

var OrderReferenceInformation = {

    updateReplicationSettingMD: function (req, res, next) {
        var user = req.user;
        var account = req.account;

        var auditOptions = {};
        var options = {
            account: account,
            user: user,
            updatedAt: req.body.updatedAt,
            numberOfRecords: req.body.numberOfRecords,
            frequency: req.body.frequency,
            id: req.body.id,
            startDate: req.body.startDate,
            isDisable: req.body.isDisable
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_REPLICATION_SETTING_FOR_ORDER_IMPORT);
        OrderReferenceInformationApi.updateReplicationSettingMD(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            return next();
        });
    },

    getReplicationSettingMD: function (req, res, next) {
        var user = req.user;
        var accountId = user.accountId;

        var auditOptions = {};
        var options = {
            accountId: accountId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.GET_REPLICATION_SETTING);
        OrderReferenceInformationApi.getReplicationSettingMD(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            return next();
        });
    },

    createReplicationSettingMD: function (req, res, next) {
        var user = req.user;
        var account = req.account;

        var auditOptions = {};
        var options = {
            account: account,
            user: user,
            numberOfRecords: req.body.numberOfRecords,
            frequency: req.body.frequency,
            mpId: req.body.mpId,
            startDate: req.body.startDate
            //createdAfter: req.body.createdAfter
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_REPLICATION_SETTING_FOR_ORDER_IMPORT);
        OrderReferenceInformationApi.createReplicationSettingMD(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                debug('err123', err);
                return next(err);
            }
            req.data = response;
            return next();
        });
    },

    importOrdersMD: function (req, res, next) {
        req.body = req.body.options || req.body;
        var options = {
            account: req.body.account
        };
        OrderReferenceInformationApi.importOrdersMD(options, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            return next();
        });
    },

    getOrdersMD: function (req, res, next) {
        debug('Inside getOrdersMD');
        var user = req.user;
        var timestamp = req.query.timestamp;
        var options = {
            accountId: user.accountId,
            timestamp: timestamp
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.GET_ORDERS);
        OrderReferenceInformationApi.getOrdersMD(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            return next();
        });
    },

    searchOrders: function (req, res, next) {
        debug('Inside getOrdersMD');
        var user = req.user;

        var options = {
            accountId: user.accountId,
            sku: req.query.sku,
            buyerName: req.query.buyerName,
            buyerEmail: req.query.buyerEmail,
            mpId: req.query.mpId,
            amazonOrderId: req.query.amazonOrderId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        OrderReferenceInformationApi.searchOrders(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            return next();
        });
    },

    getReplicationHistoryMD: function (req, res, next) {
        var user = req.user;
        var mpId = req.query.mpId;
        var options = {
            accountId: user.accountId,
            mpId: mpId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.GET_REPLICATION_HISTORY);
        OrderReferenceInformationApi.getReplicationHistoryMD(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            return next();
        });
    },

    getOrderByIdMD: function (req, res, next) {
        debug('Inside getOrderMD');
        var id = req.query.id;
        var options = {
            id: id
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.GET_ORDER);
        OrderReferenceInformationApi.getOrderByIdMD(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            return next();
        });
    },

    getItemByIdMD: function (req, res, next) {
        debug('Inside getOrderMD');
        var id = req.query.id;
        var fileName = req.query.fileName;
        var options = {
            id: id,
            fileName: fileName,
            user: req.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.GET_ORDER);
        OrderReferenceInformationApi.getItemByIdMD(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            return next();
        });
    },

    updateUploadLogSteps: function (req, res, next) {
        var uploadLog = req.uploadLog;
        var options = {
            stepsCompleted: req.body.stepsCompleted,
            status: req.body.status,
            fileName: req.body.fileName,
            uploadLog: uploadLog
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        OrderReferenceInformationApi.updateUploadLogSteps(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            return next();
        });
    },

    /* validateFilesMD: function (req, res, next) {
         req.body = req.body.options || req.body;
         var uploadLog = req.body.uploadLog;
         var fileName = req.body.fileName;
         var version = req.body.version;
         var options = {
             fileName: fileName,
             version: version,
             uploadLog: uploadLog
         };
         var errorOptions = HeaderUtils.getErrorLogHeaders(req);
         errorOptions.data = options;
         OrderReferenceInformationApi.validateFilesMD(options, errorOptions, function (err, response) {
             if (err) {
                 debug('err', err);
                 return next();
             }
             req.data = response;
             return next();
         });
     },*/

    /* logicalValidation: function (req, res, next) {
         req.body = req.body.options || req.body;
         var uploadLog = req.body.uploadLog;
         //var fileName = req.body.fileName;
         var options = {
             uploadLog: uploadLog
         };
         var errorOptions = HeaderUtils.getErrorLogHeaders(req);
         errorOptions.data = options;
         OrderReferenceInformationApi.logicalValidation(options, errorOptions, function (err, response) {
             if (err) {
                 debug('err', err);
                 return next();
             }
             req.data = response;
             return next();
         });
     },*/

    getItemsByOrderIdMD: function (req, res, next) {
        debug('Inside getItems');
        var user = req.user;
        var orderRefId = req.query.orderRefId;
        var options = {
            orderRefId: orderRefId,
            user: user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.GET_ITEMS);
        OrderReferenceInformationApi.getItemsByOrderIdMD(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            return next();
        });
    },

    disableReplicationMD: function (req, res, next) {
        debug('Inside disableReplicationMD');
        var user = req.user;
        var accountId = user.accountId;
        var marketplaceId = req.body.marketplaceId;

        var options = {
            accountId: accountId,
            marketplaceId: marketplaceId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, errorOptions, Events.DISABLE_ORDER_REPLICATION);
        OrderReferenceInformationApi.disableReplicationMD(options, auditOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            return next();
        });
    },

    createOrder: function (req, res, next) {
        var user = req.user;
        var account = req.account;

        var options = {
            accountId: account.id,
            user: user,
            sku: req.body.sku,
            skuName: req.body.skuName,
            marketplaceId: req.body.marketplaceId,
            orderId: req.body.orderId,
            orderDeliveryDate: req.body.orderDeliveryDate,
            orderLocation: req.body.orderLocation,
            quantityOrdered: req.body.quantityOrdered
        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.CREATE_ORDERS);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        OrderReferenceInformationApi.createOrder(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            return next();
        });
    },

    editOrder: function (req, res, next) {
        var user = req.user;
        var account = req.account;

        var options = {
            accountId: account.id,
            user: user,
            orderLocation: req.body.orderLocation,
            quantityOrdered: req.body.quantityOrdered,
            id: req.body.id
        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_ORDERS);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        OrderReferenceInformationApi.editOrder(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            return next();
        });
    }
};
module.exports = OrderReferenceInformation;
