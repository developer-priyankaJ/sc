#!/usr/bin/env node

'use strict';

var debug = require('debug')('scopehub.routes.location_reference');
var LocationReferenceApi = require('../api/location_reference');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');
var Events = require('../data/events');
var HeaderUtils = require('../lib/header_utils');

var LocationReference = {

    createMD: function (req, res, next) {
        var options = {
            locationId: req.body.locationId,
            locationCode: req.body.locationCode,
            locationName: req.body.locationName,
            additionalLocationCode: req.body.additionalLocationCode,
            additionalLocationName: req.body.additionalLocationName,
            googleLocationId: req.body.googleLocationId,
            googleLocationName: req.body.googleLocationName,
            googleFormattedAddress: req.body.googleFormattedAddress,
            email: req.body.email,
            phone: req.body.phone,
            dialCode: req.body.dialCode,
            phoneCountry: req.body.phoneCountry,
            primaryMobile: req.body.primaryMobile,
            primaryMobileDialCode: req.body.primaryMobileDialCode,
            primaryMobileCountry: req.body.primaryMobileCountry,
            secondaryMobile: req.body.secondaryMobile,
            secondaryMobileDialCode: req.body.secondaryMobileDialCode,
            secondaryMobileCountry: req.body.secondaryMobileCountry,
            extension: req.body.extension,
            fax: req.body.fax,
            addressLine1: req.body.addressLine1,
            addressLine2: req.body.addressLine2,
            addressLine3: req.body.addressLine3,
            city: req.body.city,
            zipCode: req.body.zipCode,
            state: req.body.state,
            country: req.body.country,
            latitude: req.body.latitude,
            longitude: req.body.longitude,
            googleLink: req.body.googleLink,
            comment: req.body.comment,
            user: req.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.CREATE_LOCATION_REFERENCE);
        LocationReferenceApi.createMD(options, auditOptions, errorOptions, function (err, locationReference) {
            if (err) {
                return next(err);
            }
            req.data = locationReference;
            next();
        });
    },

    getLocationReferenceByAccountIdMD: function (req, res, next) {
        var accountId = req.user.accountId;
        var options = {
            accountId: accountId,
            isActive: req.query.isActive
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        LocationReferenceApi.getLocationReferenceByAccountIdMD(options, errorOptions, function (err, locationReferences) {
            if (err) {
                return next(err);
            }
            req.data = locationReferences;
            next();
        });
    },

    searchLocationReferences: function (req, res, next) {
        var accountId = req.user.accountId;
        var options = {
            accountId: accountId,
            isActive: req.query.isActive,
            locationId: req.query.locationId,
            locationName: req.query.locationName,
            state: req.query.state,
            email: req.query.email,
            additionalLocationCode: req.query.additionalLocationCode,
            additionalLocationName: req.query.additionalLocationName
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        LocationReferenceApi.searchLocationReferences(options, errorOptions, function (err, locationReferences) {
            if (err) {
                return next(err);
            }
            req.data = locationReferences;
            next();
        });
    },

    getLocationReferenceDetailByAccountIdMD: function (req, res, next) {
        var accountId = req.user.accountId;
        var options = {
            accountId: accountId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        LocationReferenceApi.getLocationReferenceDetailByAccountIdMD(options, errorOptions, function (err, locationReferences) {
            if (err) {
                return next(err);
            }
            req.data = locationReferences;
            next();
        });
    },

    getByAccountIdLocationIdMD: function (req, res, next) {
        var user = req.user;
        var options = {
            locationId: req.query.locationId,
            accountId: user.accountId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        LocationReferenceApi.getByAccountIdLocationIdMD(options, errorOptions, function (err, locationReferences) {
            if (err) {
                return next(err);
            }
            req.data = locationReferences;
            next();
        });
    },

    updateMD: function (req, res, next) {
        var options = {
            locationId: req.body.locationId,
            locationCode: req.body.locationCode,
            locationName: req.body.locationName,
            additionalLocationCode: req.body.additionalLocationCode,
            additionalLocationName: req.body.additionalLocationName,
            googleLocationId: req.body.googleLocationId,
            googleLocationName: req.body.googleLocationName,
            googleFormattedAddress: req.body.googleFormattedAddress,
            email: req.body.email,
            phone: req.body.phone,
            dialCode: req.body.dialCode,
            phoneCountry: req.body.phoneCountry,
            primaryMobile: req.body.primaryMobile,
            primaryMobileDialCode: req.body.primaryMobileDialCode,
            primaryMobileCountry: req.body.primaryMobileCountry,
            secondaryMobile: req.body.secondaryMobile,
            secondaryMobileDialCode: req.body.secondaryMobileDialCode,
            secondaryMobileCountry: req.body.secondaryMobileCountry,
            extension: req.body.extension,
            fax: req.body.fax,
            addressLine1: req.body.addressLine1,
            addressLine2: req.body.addressLine2,
            addressLine3: req.body.addressLine3,
            city: req.body.city,
            zipCode: req.body.zipCode,
            state: req.body.state,
            country: req.body.country,
            latitude: req.body.latitude,
            longitude: req.body.longitude,
            googleLink: req.body.googleLink,
            comment: req.body.comment,
            updatedAt: req.body.updatedAt,
            user: req.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_LOCATION_REFERENCE);
        LocationReferenceApi.updateMD(options, auditOptions, errorOptions, function (err, locationReference) {
            if (err) {
                return next(err);
            }
            req.data = locationReference;
            next();
        });
    },

    removeMD: function (req, res, next) {
        var options = {
            locationId: req.query.locationId,
            accountId: req.user.accountId,
            userId: req.user.id,
            updatedAt: req.query.updatedAt
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.DELETE_LOCATION_REFERENCE);
        LocationReferenceApi.removeMD(options, auditOptions, errorOptions, function (err, locationReference) {
            if (err) {
                debug(err);
                return next(err);
            }
            req.data = locationReference;
            next();
        });
    },

    removeMultipleMD: function (req, res, next) {
        var options = {
            locationIds: req.body.locationIds,
            accountId: req.user.accountId,
            userId: req.user.id
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.DELETE_MULTIPLE_LOCATION_REFERENCE);
        LocationReferenceApi.removeMultipleMD(options, auditOptions, errorOptions, function (err, locationReference) {
            if (err) {
                debug(err);
                return next(err);
            }
            req.data = locationReference;
            next();
        });
    }
};


module.exports = LocationReference;


