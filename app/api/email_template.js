/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.api.email_template');
var Util = require('util');

var DataUtils = require('../lib/data_utils');
var Constants = require('../data/constants');
var EmailTemplateModel = require('../model/email_template');
var ErrorConfig = require('../data/error');
var _ = require('lodash');

var AuditUtils = require('../lib/audit_utils');

var EmailTemplate = {
    create: function (options, auditOptions, cb) {
        var name = options.name;
        var languageCultureCode = options.languageCultureCode;
        var content = options.content;
        var bannerColor = options.bannerColor;
        var bannerText = options.bannerText;
        var emailSubject = options.emailSubject;
        var description = options.description;

        var err;
        if (DataUtils.isUndefined(name)) {
            err = new Error(ErrorConfig.MESSAGE.EMAIL_TEMPLATE_NAME_REQUIRED);
        }
        else if (DataUtils.isUndefined(languageCultureCode)) {
            err = new Error(ErrorConfig.MESSAGE.EMAIL_TEMPLATE_LANG_CULTURE_REQUIRED);
        }
        else if (DataUtils.isUndefined(content)) {
            err = new Error(ErrorConfig.MESSAGE.EMAIL_TEMPLATE_CONTENT_REQUIRED);
        }
        else if (DataUtils.isUndefined(bannerColor)) {
            err = new Error(ErrorConfig.MESSAGE.EMAIL_TEMPLATE_BANNER_COLOR_REQUIRED);
        }
        else if (DataUtils.isUndefined(bannerText)) {
            err = new Error(ErrorConfig.MESSAGE.EMAIL_TEMPLATE_BANNER_TEXT_REQUIRED);
        }
        else if (DataUtils.isUndefined(emailSubject)) {
            err = new Error(ErrorConfig.MESSAGE.EMAIL_TEMPLATE_SUBJECT_REQUIRED);
        }
        else if (DataUtils.isUndefined(description)) {
            err = new Error(ErrorConfig.MESSAGE.EMAIL_TEMPLATE_DESCRIPTION_REQUIRED);
        }

        var language = languageCultureCode && languageCultureCode.substr(0, 2);
        if (Constants.LANGUAGE_OPTIONS.indexOf(language) < 0) {
            err = new Error(ErrorConfig.MESSAGE.LANGUAGE_OPTION_INVALID);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug(err);
            Util.log(err);
            return cb(err);
        }

        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        var emailTemplateObj = {
            name: name,
            languageCultureCode: languageCultureCode,
            content: content,
            bannerColor: bannerColor,
            bannerText: bannerText,
            emailSubject: emailSubject,
            description: description
        };

        var params = {};
        params.overwrite = false;

        EmailTemplateModel.create(emailTemplateObj, params, function (error, emailTemplate) {
            if (error) {
                err = new Error(error.toString());
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug(err);
                return cb(err);
            } else {
                AuditUtils.create(auditOptions);
                return cb(null, emailTemplate);
            }
        });
    },

    list: function (options, auditOptions, cb) {
        var err;
        AuditUtils.create(auditOptions);

        EmailTemplateModel.scan()
            .loadAll()
            .exec(cb);
    },

    remove: function (options, auditOptions, cb) {
        var name = options.name;
        var languageCultureCode = options.languageCultureCode;
        AuditUtils.create(auditOptions);

        EmailTemplateModel.
            destroy({
                name: name,
                languageCultureCode: languageCultureCode
            }, cb);

    },

    edit: function (options, auditOptions, cb) {
        var id = options.id;
        var name = options.name;
        var languageCultureCode = options.languageCultureCode;
        var content = options.content;
        var bannerColor = options.bannerColor;
        var bannerText = options.bannerText;
        var emailSubject = options.emailSubject;
        var description = options.description;

        var err;
        if (DataUtils.isUndefined(name)) {
            err = new Error(ErrorConfig.MESSAGE.EMAIL_TEMPLATE_NAME);
        }
        else if (DataUtils.isUndefined(languageCultureCode)) {
            err = new Error(ErrorConfig.MESSAGE.EMAIL_TEMPLATE_LANG_CULTURE);
        }
        else if (DataUtils.isUndefined(content)) {
            err = new Error(ErrorConfig.MESSAGE.EMAIL_TEMPLATE_CONTENT);
        }
        else if (DataUtils.isUndefined(bannerColor)) {
            err = new Error(ErrorConfig.MESSAGE.EMAIL_TEMPLATE_BANNER_COLOR);
        }
        else if (DataUtils.isUndefined(bannerText)) {
            err = new Error(ErrorConfig.MESSAGE.EMAIL_TEMPLATE_BANNER_TEXT);
        }
        else if (DataUtils.isUndefined(emailSubject)) {
            err = new Error(ErrorConfig.MESSAGE.EMAIL_TEMPLATE_SUBJECT);
        }
        else if (DataUtils.isUndefined(description)) {
            err = new Error(ErrorConfig.MESSAGE.EMAIL_TEMPLATE_DESCRIPTION);
        }

        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        var emailTemplateObj = {
            name: name,
            languageCultureCode: languageCultureCode,
            content: content,
            bannerColor: bannerColor,
            bannerText: bannerText,
            emailSubject: emailSubject,
            description: description
        };

        var params = {};
        params.overwrite = false;

        auditOptions.metaData = emailTemplateObj;
        AuditUtils.create(auditOptions);

        EmailTemplateModel.
            update(emailTemplateObj, { ReturnValues: 'ALL_NEW' }, cb);
    }
};

module.exports = EmailTemplate;