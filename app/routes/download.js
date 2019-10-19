#!/usr/bin/env node

'use strict';

var _ = require('lodash');

var debug = require('debug')('scopehub.route.download');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');
var DataUtils = require('../lib/data_utils');
var Utils = require('../lib/utils');
var Events = require('../data/events');
var ErrorUtils = require('../lib/error_utils');
var HeaderUtils = require('../lib/header_utils');
var AuditUtils = require('../lib/audit_utils');
var DownloadApi = require('../api/download');

var Download = {

    createDownloadLog: async function (req, res, next) {
        var options = {
            user: req.user,
            refereId: req.body.refereId,
            outShareInstanceId: req.body.outShareInstanceId,
            refereShareId: req.body.refereShareId,
            refereShareName: req.body.refereShareName,
            shareItemType: req.body.shareItemType,
            toFilterDate: req.body.toFilterDate,
            fromFilterDate: req.body.fromFilterDate,
            type: req.body.type
        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.CREATE_FILE_LOG_RECORD);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        DownloadApi.createDownloadLog(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.downloadLog = response;
            next();
        });
    },

    getSharedData: async function (req, res, next) {
        var options = {
            user: req.user,
            downloadLog: req.downloadLog,
            outShareInstanceId: req.body.outShareInstanceId,
            type: req.body.type,
            toFilterDate: req.body.toFilterDate,
            fromFilterDate: req.body.fromFilterDate
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        DownloadApi.getSharedData(options, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.sharedData = response;
            next();
        });
    },

    GenerateCSVFile: async function (req, res, next) {
        var options = {
            user: req.user,
            downloadLog: req.downloadLog,
            sharedData: req.sharedData,
            refereShareId: req.body.refereShareId,
            refereShareName: req.body.refereShareName,
            shareItemType: req.body.shareItemType
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        DownloadApi.GenerateCSVFile(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            if (response) {
                req.fileName = response.fileName;
            }
            next();
        });
    },

    UploadFileToS3: async function (req, res, next) {
        var options = {
            user: req.user,
            fileName: req.fileName,
            downloadLog: req.downloadLog
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        DownloadApi.UploadFileToS3(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            next();
        });
    },

    getPreSignedUrlFromS3: async function (req, res, next) {
        var options = {
            user: req.user,
            fileName: req.fileName,
            downloadLog: req.downloadLog
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        DownloadApi.getPreSignedUrlFromS3(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            next();
        });
    }
};

module.exports = Download;