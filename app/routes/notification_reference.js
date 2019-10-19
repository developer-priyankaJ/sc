#!/usr/bin/env node

'use strict';

var debug = require('debug')('scopehub.route.notification_reference');
var Util = require('util');

var NotificationReferenceApi = require('../api/notification_reference');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');
var HeaderUtils = require('../lib/header_utils');
var AuditUtils = require('../lib/audit_utils');
var Events = require('../data/events');

var NotificationReference = {
    createMD: function (req, res, next) {

        var options = {
            id: req.body.id,
            meta: req.body.meta,
            description: req.body.description,
            actionIgnore: req.body.actionIgnore,
            actionDecline: req.body.actionDecline,
            actionAccept: req.body.actionAccept,
            category: req.body.category,
            categoryId: req.body.categoryId,
            defaultType: req.body.defaultType,
            subCategory: req.body.subCategory,
            languageCultureCode: req.body.languageCultureCode,
            paramasInviter: req.body.paramasInviter,
            paramasInvitee: req.body.paramasInvitee,
            paramasDateTime: req.body.paramasDateTime,
            paramasError: req.body.paramasError,
            paramasOtherDataName: req.body.paramasOtherDataName,
            paramasUser: req.body.paramasUser,
            paramasOtherData: req.body.paramasOtherData,
            type: req.body.type
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        NotificationReferenceApi.createMD(options, errorOptions, function (err, reference) {
            if (err) {
                return next(err);
            }
            req.data = reference;
            return next();
        });
    },

    getLanguageCultureCodeNotificationsMD: function (req, res, next) {

        var options = {
            languageCultureCode: req.query.languageCultureCode
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        NotificationReferenceApi.getLanguageCultureCodeNotificationsMD(options, errorOptions, function (err, notificationReferences) {
            if (err) {
                return next(err);
            }
            req.data = notificationReferences;
            return next();
        });
    },

    getAll: function (req, res, next) {
        req.data = NotificationReferenceApi.getAll();
        return next();
    },

    updateMD: function (req, res, next) {

        var options = {
            id: req.body.id,
            meta: req.body.meta,
            description: req.body.description,
            actionIgnore: req.body.actionIgnore,
            actionDecline: req.body.actionDecline,
            actionAccept: req.body.actionAccept,
            category: req.body.category,
            categoryId: req.body.categoryId,
            defaultType: req.body.defaultType,
            subCategory: req.body.subCategory,
            languageCultureCode: req.body.languageCultureCode,
            paramasInviter: req.body.paramasInviter,
            paramasInvitee: req.body.paramasInvitee,
            paramasDateTime: req.body.paramasDateTime,
            paramasError: req.body.paramasError,
            paramasOtherDataName: req.body.paramasOtherDataName,
            paramasUser: req.body.paramasUser,
            paramasOtherData: req.body.paramasOtherData,
            type: req.body.type,
            updatedAt: req.body.updatedAt,
            user: req.user
        };

        var auditOptions = {};
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_NOTIFICATION_REFERENCE);

        NotificationReferenceApi.updateMD(options, auditOptions, errorOptions, function (err, reference) {
            if (err) {
                return next(err);
            }
            req.data = reference;
            next();
        });
    },

    removeMD: function (req, res, next) {

        var options = {
            id: req.query.id,
            languageCultureCode: req.query.languageCultureCode
        };

        var auditOptions = {};
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.REMOVE_NOTIFICATION_REFERENCE);

        NotificationReferenceApi.removeMD(options, auditOptions, errorOptions, function (err) {
            if (err) {
                debug(err);
                return next(err);
            }
            req.data = Constants.OK_MESSAGE;
            next();
        });
    }
};

module.exports = NotificationReference;

(function () {
    if (require.main == module) {
    }
}());
