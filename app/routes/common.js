#!/usr/bin/env node
'use strict';

var Util = require('util');
var debug = require('debug')('scopehub.route.common');

var Constants = require('../data/constants');
var CommonAPI = require('../api/common');
var S3Utils = require('../lib/s3_utils');
var HeaderUtils = require('../lib/header_utils');
var Events = require('../data/events');
var multer = require('multer');
var multerS3 = require('multer-s3');
var s3 = require('../model/s3');
var DataUtils = require('../lib/data_utils');
var ErrorConfig = require('../data/error');

var Common = {
    sendJSON: function (req, res, next) {
        //Util.log('req success api url ****', req.url);
        res.json(req.data);
    },

    getSignedUrl: function (req, res, next) {
        var userId = req.params.userId;
        var object = userId + '/' + req.params.s3key;
        if (!object) {
            Util.log('Invalid request URL');
            res.status(404).send('The file URL is invalid');
        }
        var opts = {
            key: object,
            bucket: Constants.SCOPEHUB_SES_EMAIL_BUCKET,
            expires: 5,
            requestType: 'getObject'
        };
        S3Utils.getSignedUrl(opts, function (err, url) {
            if (err) {
                Util.log(err);
                res.status(404).send('The file URL is invalid');
            }
            res.redirect(302, url);
        });
    },

    checkInvalidField: function (fields) {
        return function (req, res, next) {
            var options = {
                body: req.body,
                fields: fields
            };
            CommonAPI.checkInvalidField(options, function (err, response) {
                if (err) {
                    debug('err', err);
                    return next(err);
                }
                return next();
            });
        };
    },

    updateErrorReference: function (req, res, next) {
        var user = req.user;
        var options = {
            languageCultureCode: user.languageCultureCode
        };
        CommonAPI.updateErrorReference(options, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            return next();
        });
    },
    getErrorReference: function (req, res, next) {
        var user = req.user;
        var options = {
            languageCultureCode: user.languageCultureCode
        };
        CommonAPI.getErrorReference(options, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            return next();
        });
    },
    getErrorReferenceForLogin: function (req, res, next) {
        var options = {
            languageCultureCode: req.query.languageCultureCode
        };
        CommonAPI.getErrorReferenceForLogin(options, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            return next();
        });
    },

    verifyRecaptcha: function (req, res, next) {
        var body = req.body;
        var flag = req.flag;
        if (!flag) {
            return next();
        }
        var options = {
            captcha: body['g-recaptcha-response'],
            flag: flag
        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.ACCOUNT_INVITE_USER);
        CommonAPI.verifyRecaptcha(options, auditOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            return next();
        });
    }

};

module.exports = Common;

(function () {
    if (require.main == module) {
    }
}());