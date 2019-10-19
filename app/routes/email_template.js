#!/usr/bin/env node

'use strict';

var debug = require('debug')('scopehub.route.email_template');
var Util = require('util');

var EmailTemplateApi = require('../api/email_template');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');
var Events = require('../data/events');
var HeaderUtils = require('../lib/header_utils');

var EmailTemplate = {

    create: function (req, res, next) {

        var options = {
            name: req.body.name,
            languageCultureCode: req.body.languageCultureCode,
            content: req.body.content,
            bannerColor: req.body.bannerColor,
            bannerText: req.body.bannerText,
            emailSubject: req.body.emailSubject,
            description: req.body.description
        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.CREATE_EMAIL_TEMPLATE);
        EmailTemplateApi.create(options, auditOptions, function (err, emailTemplate) {
            if (err || !emailTemplate) {
                err = err || new Error(ErrorConfig.MESSAGE.EMAIL_TEMPLATE_CREATION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                Util.log(err);
                return next(err);
            }
            next();
        });
    },

    delete: function (req, res, next) {
        var options = {
           name : req.query.name,
           languageCultureCode : req.query.languageCultureCode
        };        
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.REMOVE_EMAIL_TEMPLATE);
        EmailTemplateApi.remove(options, auditOptions, function (err, emailTemplate) {
            if (err) {
               Util.log(err);
                return next(err);
            }
            req.data = emailTemplate;
            next();
        });
    },

    list: function (req, res, next) {
        var options = {
            name: req.body.name,
            languageCultureCode: req.body.languageCultureCode,
            content: req.body.content,
            bannerColor: req.body.bannerColor,
            bannerText: req.body.bannerText,
            emailSubject: req.body.emailSubject,
            description: req.body.description
        };
        
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.LIST_EMAIL_TEMPLATE);
        EmailTemplateApi.list(options, auditOptions, function (err, templates) {
            if (err || !templates) {
                err = err || new Error(ErrorConfig.MESSAGE.EMAIL_TEMPLATE_LIST_FAILED);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                Util.log(err);
                return next(err);
            }
            req.data = templates;
            next();
        });
    },

    edit: function (req, res, next) {
        var options = {
            name: req.body.name,
            languageCultureCode: req.body.languageCultureCode,
            content: req.body.content,
            bannerColor: req.body.bannerColor,
            bannerText: req.body.bannerText,
            emailSubject: req.body.emailSubject,
            description: req.body.description
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_EMAIL_TEMPLATE);
        EmailTemplateApi.edit(options, auditOptions, function (err, template) {
            if (err || !template) {
                err = err || new Error(ErrorConfig.MESSAGE.EMAIL_TEMPLATE_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                Util.log(err);
                return next(err);
            }
            req.data = template;
            next();
        });
    },

    sendJSON: function (req, res, next) {
        res.json(req.data);
    }
};

module.exports = EmailTemplate;

(function () {
    if (require.main == module) {
    }
} ());