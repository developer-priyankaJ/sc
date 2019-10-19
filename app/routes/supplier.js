#!/usr/bin/env node

'use strict';

var debug = require('debug')('scopehub.route.customer');
var Util = require('util');
var SupplierApi = require('../api/supplier');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');
var Events = require('../data/events');
var HeaderUtils = require('../lib/header_utils');

var Supplier = {

    createMD: function (req, res, next) {
        var options = {
            userId: req.user.id,
            accountId: req.user.accountId,
            saveAsLater: req.body.saveAsLater,
            useExisting: req.body.useExisting,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            supplierName: req.body.supplierName,
            supplierCode: req.body.supplierCode,
            supplierId: req.body.supplierId,
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
            companyName: req.body.companyName,
            fax: req.body.fax,
            locationId: req.body.locationId,
            addressLine1: req.body.addressLine1,
            addressLine2: req.body.addressLine2,
            addressLine3: req.body.addressLine3,
            city: req.body.city,
            zipCode: req.body.zipCode,
            state: req.body.state,
            country: req.body.country,
            newLocationId: req.body.newLocationId,
            newLocationName: req.body.newLocationName,
            googleLink: req.body.googleLink
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        SupplierApi.createMD(options, errorOptions, function (err, supplier) {
            if (err) {
                return next(err);
            }
            req.data = supplier;
            next();
        });
    },

    getSupplierByAccountIdMD: function (req, res, next) {
        var accountId = req.user.accountId;
        var options = {
            accountId: accountId,
            isActive: req.query.isActive
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        SupplierApi.getSupplierByAccountIdMD(options, errorOptions, function (err, suppliers) {
            if (err) {
                return next(err);
            }
            req.data = suppliers;
            next();
        });
    },

    searchSuppliers: function (req, res, next) {
        var accountId = req.user.accountId;
        var options = {
            accountId: accountId,
            isActive: req.query.isActive,
            supplierName: req.query.supplierName,
            supplierCode: req.query.supplierCode,
            firstName: req.query.firstName,
            lastName: req.query.lastName,
            email: req.query.email
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        SupplierApi.searchSuppliers(options, errorOptions, function (err, suppliers) {
            if (err) {
                return next(err);
            }
            req.data = suppliers;
            next();
        });
    },

    updateMD: function (req, res, next) {
        var options = {
            userId: req.user.id,
            accountId: req.user.accountId,
            saveAsLater: req.body.saveAsLater,
            useExisting: req.body.useExisting,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            supplierName: req.body.supplierName,
            supplierCode: req.body.supplierCode,
            supplierId: req.body.supplierId,
            id: req.body.id,
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
            companyName: req.body.companyName,
            fax: req.body.fax,
            locationId: req.body.locationId,
            addressLine1: req.body.addressLine1,
            addressLine2: req.body.addressLine2,
            addressLine3: req.body.addressLine3,
            city: req.body.city,
            zipCode: req.body.zipCode,
            state: req.body.state,
            country: req.body.country,
            newLocationId: req.body.newLocationId,
            newLocationName: req.body.newLocationName,
            googleLink: req.body.googleLink,
            updatedAt: req.body.updatedAt
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_SUPPLIER);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        SupplierApi.updateMD(options, auditOptions, errorOptions, function (err, suppliers) {
            if (err) {
                return next(err);
            }
            req.data = suppliers;
            next();
        });
    },

    inviteMD: function (req, res, next) {
        var options = {
            email: req.body.email,
            personalMessage: req.body.personalMessage,
            id: req.body.id,
            updatedAt: req.body.updatedAt,
            user: req.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        SupplierApi.inviteMD(options, errorOptions, function (err, data) {
            if (err) {
                debug(err);
                return next(err);
            }
            req.data = data;
            next();
        });
    },

    removeMD: function (req, res, next) {
        var options = {
            userId: req.user.id,
            ids: req.body.ids,
            accountId: req.user.accountId
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.DELETE_ARCHIEVE_SUPPLIER);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        SupplierApi.removeMD(options, auditOptions, errorOptions, function (err, result) {
            if (err) {
                debug(err);
                return next(err);
            }
            req.data = result;
            next();
        });
    },

    delete: function (req, res, next) {
        var options = {
            userId: req.user.id,
            ids: req.body.ids,
            accountId: req.user.accountId
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.DELETE_SUPPLIER);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        SupplierApi.delete(options, auditOptions, errorOptions, function (err, result) {
            if (err) {
                debug(err);
                return next(err);
            }
            req.data = result;
            next();
        });
    },

    restore: function (req, res, next) {
        var options = {
            userId: req.user.id,
            ids: req.body.ids,
            accountId: req.user.accountId
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.RESTORE_SUPPLIER);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        SupplierApi.restore(options, auditOptions, errorOptions, function (err, result) {
            if (err) {
                debug(err);
                return next(err);
            }
            req.data = result;
            next();
        });
    },

    getByAccountIdAndSupplierIdMD: function (req, res, next) {
        var options = {
            supplierId: req.query.supplierId,
            accountId: req.user.accountId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        SupplierApi.getByAccountIdAndSupplierIdMD(options, errorOptions, function (err, supplier) {
            if (err) {
                return next(err);
            }
            req.data = supplier;
            next();
        });
    },
    getByIdAndAccountIdMD: function (req, res, next) {
        var options = {
            id: req.query.id,
            accountId: req.user.accountId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        SupplierApi.getByIdAndAccountIdMD(options, errorOptions, function (err, supplier) {
            if (err) {
                return next(err);
            }
            req.data = supplier;
            next();
        });
    },

    getSupplierAndCustomerMD: function (req, res, next) {
        var options = {
            accountId: req.user.accountId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        SupplierApi.getSupplierAndCustomerMD(options, errorOptions, function (err, supplier) {
            if (err) {
                return next(err);
            }
            req.data = supplier;
            next();
        });
    },

    reminder: function (req, res, next) {
        var options = {
            id: req.body.id,
            updatedAt: req.body.updatedAt,
            user: req.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        SupplierApi.reminder(options, errorOptions, function (err, supplier) {
            if (err) {
                return next(err);
            }
            req.data = supplier;
            next();
        });
    },

    reSendInvitation: function (req, res, next) {
        var options = {
            id: req.body.id,
            updatedAt: req.body.updatedAt,
            user: req.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        SupplierApi.reSendInvitation(options, errorOptions, function (err, supplier) {
            if (err) {
                return next(err);
            }
            req.data = supplier;
            next();
        });
    },

    cancel: function (req, res, next) {
        var options = {
            id: req.body.id,
            updatedAt: req.body.updatedAt,
            user: req.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        SupplierApi.cancel(options, errorOptions, function (err, supplier) {
            if (err) {
                return next(err);
            }
            req.data = supplier;
            next();
        });
    },

    addInvite: function (req, res, next) {
        var options = {
            userId: req.user.id,
            accountId: req.user.accountId,
            saveAsLater: req.body.saveAsLater,
            useExisting: req.body.useExisting,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            supplierName: req.body.supplierName,
            supplierCode: req.body.supplierCode,
            supplierId: req.body.supplierId,
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
            companyName: req.body.companyName,
            fax: req.body.fax,
            locationId: req.body.locationId,
            addressLine1: req.body.addressLine1,
            addressLine2: req.body.addressLine2,
            addressLine3: req.body.addressLine3,
            city: req.body.city,
            zipCode: req.body.zipCode,
            state: req.body.state,
            country: req.body.country,
            newLocationId: req.body.newLocationId,
            newLocationName: req.body.newLocationName,
            googleLink: req.body.googleLink,
            status: Constants.SUPPLIER_INVITATION_STATUS.OPEN,
            personalMessage: req.body.personalMessage,
            user: req.user,
            addInviteFlag: true
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        SupplierApi.addInvite(options, errorOptions, function (err, data) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = data;
            next();
        });
    }
};


module.exports = Supplier;


