#!/usr/bin/env node
'use strict';

var debug = require('debug')('scopehub.route.ContactRequest');
var Util = require('util');

var ContactRequestApi = require('../api/contactRequest');
var HeaderUtils = require('../lib/header_utils');
var Events = require('../data/events');
var Constants = require('../data/constants');
var DataUtils = require('../lib/data_utils');
var _ = require('lodash');

var ContactRequest = {

    validateContactsRequest: function (req, res, next) {
        var body = req.body;
        var options = {
            firstName: body.firstName,
            lastName: body.lastName,
            updateInterest: body.updateInterest,
            betaInterest: body.betaInterest,
            captcha: body['g-recaptcha-response'],
            email: body.email
        };
        ContactRequestApi.validateContactsRequest(options, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.flag = Constants.RE_CAPTCHA_FLAG.CONTACT_REQUEST;
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
        ContactRequestApi.verifyRecaptcha(options, auditOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.captcha = response;
            return next();
        });
    },

    createContactRequest: function (req, res, next) {
        var body = req.body;
        var options = {
            firstName: body.firstName,
            lastName: body.lastName,
            type: body.type,
            email: body.email,
            updateInterest: body.updateInterest,
            betaInterest: body.betaInterest,
            localDeviceTimezone: body.localDeviceTimezone,
            localDeviceDateTime: body.localDeviceDateTime,
            captcha: req.captcha
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.CREATE_CONTACT_REQUEST);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        ContactRequestApi.createContactRequest(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            debug('response', response);
            req.requestData = response;
            req.data = req.requestData.data;
            return next();
        });
    },

    sendEmailToSupport: function (req, res, next) {
        var body = req.body;
        var options = {
            firstName: body.firstName,
            requestData: req.requestData
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        ContactRequestApi.sendEmailToSupport(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            debug('response', response);
            req.data = req.requestData.data;
            return next();
        });
    }
};

module.exports = ContactRequest;
