#!/usr/bin/env node

'use strict';

var debug = require('debug')('scopehub.route.country_reference');
var HeaderUtils = require('../lib/header_utils');
var CountryReferenceApi = require('../api/country_reference');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');
var Events = require('../data/events');

var CountryReference = {

    createMD: function (req, res, next) {
        var options = {
            countryCode: req.body.countryCode,
            countryName: req.body.countryName,
            languageCulturalCode: req.body.languageCulturalCode,
            currencyCode: req.body.currencyCode,
            currencyName: req.body.currencyName,
            user: req.user
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.CREATE_COUNTRY_REFERENCE);
        CountryReferenceApi.createMD(options, auditOptions, errorOptions, function (err, reference) {
            if (err) {
                return next(err);
            }
            req.data = reference;
            return next();
        });
    },

    getCountryReferenceMD: function (req, res, next) {
        var options = {
            id: req.query.id
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        CountryReferenceApi.getCountryReferenceMD(options, errorOptions, function (err, reference) {
            if (err) {
                return next(err);
            }
            req.data = reference;
            next();
        });
    },

    getAllMD: function (req, res, next) {
        debug('inside all');
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        CountryReferenceApi.getAllMD(errorOptions, function (err, references) {
            if (err) {
                return next(err);
            }
            req.data = references;
            next();
        });
    },

    updateMD: function (req, res, next) {

        var options = {
            id: req.body.id,
            countryCode: req.body.countryCode,
            countryName: req.body.countryName,
            languageCulturalCode: req.body.languageCulturalCode,
            currencyCode: req.body.currencyCode,
            currencyName: req.body.currencyName,
            updatedAt: req.body.updatedAt,
            user: req.user
        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_COUNTRY_REFERENCE);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        CountryReferenceApi.updateMD(options, auditOptions, errorOptions, function (err, reference) {
            if (err) {
                return next(err);
            }
            req.data = reference;
            next();
        });
    },

    removeMD: function (req, res, next) {
        var options = {
            id: req.query.id
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.REMOVE_COUNTRY_REFERENCE);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        CountryReferenceApi.removeMD(options, auditOptions, errorOptions, function (err) {
            if (err) {
                debug(err);
                return next(err);
            }
            req.data = Constants.OK_MESSAGE;
            next();
        });
    }

};

module.exports = CountryReference;
