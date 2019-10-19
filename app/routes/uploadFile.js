'use strict';

var debug = require('debug')('scopehub.route.FileUpload');
var Events = require('../data/events');
var path = require('path');
var fs = require('fs');
var base64 = require('file-base64');
var HeaderUtils = require('../lib/header_utils');
var FileUploadApi = require('../api/uploadFile');
var OrderLineItemsApi = require('../api/order_line_items');
//var aws = require('aws-sdk');

var FileUpload = {

    createLogRecordMD: function (req, res, next) {
        var user = req.user;
        var accountId = user.accountId;
        var options = {
            version: user.account.fileUploadVersion,
            fileUploadPublicKey: user.account.fileUploadPublicKey,
            fileUploadPrivateKey: user.account.fileUploadPrivateKey,
            userId: user.id,
            accountId: accountId,
            type: req.body.type,
            fileName: req.body.fileName,
            isMultipart: req.body.isMultipart,
            size: req.body.size
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.CREATE_FILE_UPLOAD_LOG);
        FileUploadApi.createLogRecordMD(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            return next();
        });
    },

    createPreSignedUrlMD: function (req, res, next) {
        var user = req.user;
        var accountId = user.accountId;
        var options = {
            userId: user.id,
            accountId: accountId,
            type: req.body.type,
            fileName: req.body.fileName,
            size: req.body.size,
            isMultipart: req.body.isMultipart,
            parts: req.body.parts
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.CREATE_PRE_SIGNED_URL);
        FileUploadApi.createPreSignedUrlMD(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            return next();
        });
    },

    getUploadLogMD: function (req, res, next) {
        req.body = req.body.options || req.body;
        var fileName = req.body.fileName;

        var options = {
            fileName: fileName
        };
        FileUploadApi.getUploadLogMD(options, function (err, uploadLog) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.uploadLog = uploadLog;
            return next();
        });
    },

    createErrorLog: function (req, res, next) {
        var options = {
            uploadLog: req.uploadLog,
            errors: req.body.errors
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        FileUploadApi.createErrorLog(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            return next();
        });
    },

    updateUploadLogByCheck: function (req, res, next) {
        var options = {
            uploadLog: req.uploadLog,
            fileName: req.body.fileName,
            operations: req.body.operations,
            isMultipart: req.body.isMultipart,
            partNumber: req.body.partNumber,
            partName: req.body.partName,
            isLastPart: req.body.isLastPart,
            firstLine: req.body.firstLine,
            lastLine: req.body.lastLine,
            numberOfColumns: req.body.numberOfColumns,
            //status: req.body.status,
            //timestamp: req.body.timestamp,
            errors: req.body.errors
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        FileUploadApi.updateUploadLogByCheck(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            return next();
        });
    },

    copyCSVFileMD: function (req, res, next) {
        req.body = req.body.options || req.body;
        var uploadLog = req.body.uploadLog;
        var options = {
            uploadLog: uploadLog,
            accountId: uploadLog.accountId,
            fileName: req.body.fileName,
            isMultipart: req.body.isMultipart
        };
        debug('options', options);
        FileUploadApi.copyCSVFileMD(options, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            return next();
        });
    },

    updateUploadLog: function (req, res, next) {
        var uploadLog = req.uploadLog;
        var options = {
            preSignedUrl: req.body.preSignedUrl,
            status: req.body.status,
            fileName: req.body.fileName,
            uploadLog: uploadLog,
            isMultipart: req.body.isMultipart,
            version: req.body.version,
            IVKey: req.body.IVKey,
            decryptionKey: req.body.decryptionKey,
            errors: req.body.errors,
            parts: req.body.parts
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_UPLOAD_LOG);
        FileUploadApi.updateUploadLog(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            return next();
        });
    },

    updateUploadLogCancel: function (req, res, next) {
        var uploadLog = req.uploadLog;
        var options = {
            fileUploadPublicKey: req.body.fileUploadPublicKey,
            status: req.body.status,
            fileName: req.body.fileName,
            uploadLog: uploadLog,
            isMultipart: req.body.isMultipart,
            errors: req.body.errors,
            parts: req.body.parts
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_UPLOAD_LOG_BY_CANCEL);
        FileUploadApi.updateUploadLogCancel(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            return next();
        });
    },

    getUploadLog: function (req, res, next) {
        var user = req.user;
        var accountId = user.accountId;
        var options = {
            userId: user.id,
            accountId: accountId,
            type: req.query.type
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        FileUploadApi.getUploadLog(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            return next();
        });
    },

    getFileFormat: function (req, res, next) {
        var user = req.user;
        var accountId = user.accountId;
        var options = {
            userId: user.id,
            type: req.query.type,
            version: req.query.version
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        FileUploadApi.getFileFormat(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            return next();
        });
    },

    getValidationErrors: function (req, res, next) {
        var user = req.user;
        var options = {
            uploadLogId: req.query.uploadLogId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        FileUploadApi.getValidationErrors(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            return next();
        });
    },

    loadFile: function (req, res, next) {
        req.body = req.body.options || req.body;
        var uploadLog = req.body.uploadLog;
        //var fileName = req.body.fileName;
        var options = {
            uploadLog: uploadLog
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        FileUploadApi.loadFile(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next();
            }
            req.data = response;
            return next();
        });
    },

    getFilesUrl: function (req, res, next) {
        var user = req.user;
        var accountId = user.accountId;
        var fileName = req.query.fileName;
        var options = {
            accountId: accountId,
            fileName: fileName
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        FileUploadApi.getFilesUrl(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            return next();
        });
    },


};
module.exports = FileUpload;
