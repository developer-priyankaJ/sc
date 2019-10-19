#!/usr/bin/env node

'use strict';

var debug = require('debug')('scopehub.route.customer');
var Util = require('util');
var CustomerApi = require('../api/customer');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');
var Events = require('../data/events');
var HeaderUtils = require('../lib/header_utils');


var Customer = {

    createMD: function (req, res, next) {
        var options = {
            userId: req.user.id,
            accountId: req.user.accountId,
            saveAsLater: req.body.saveAsLater,
            useExisting: req.body.useExisting,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
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
            customerId: req.body.customerId,
            locationId: req.body.locationId,
            customerCode: req.body.customerCode,
            customerName: req.body.customerName,
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

        CustomerApi.createMD(options, errorOptions, function (err, customer) {
            if (err) {
                return next(err);
            }
            req.data = customer;
            next();
        });
    },

    getCustomersByAccountIdMD: function (req, res, next) {
        var accountId = req.user.accountId;
        var options = {
            accountId: accountId,
            isActive: req.query.isActive
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        CustomerApi.getCustomersByAccountIdMD(options, errorOptions, function (err, customers) {
            if (err) {
                return next(err);
            }
            req.data = customers;
            next();
        });
    },

    searchCustomers: function (req, res, next) {
        var accountId = req.user.accountId;
        var options = {
            accountId: accountId,
            isActive: req.query.isActive,
            customerName: req.query.customerName,
            customerCode: req.query.customerCode,
            firstName: req.query.firstName,
            lastName: req.query.lastName,
            email: req.query.email
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        CustomerApi.searchCustomers(options, errorOptions, function (err, customers) {
            if (err) {
                return next(err);
            }
            req.data = customers;
            next();
        });
    },

    getByAccountIdAndCustomerIdMD: function (req, res, next) {
        var options = {
            accountId: req.user.accountId,
            customerId: req.query.customerId
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        CustomerApi.getByAccountIdAndCustomerIdMD(options, errorOptions, function (err, customer) {
            if (err) {
                return next(err);
            }
            req.data = customer;
            next();
        });
    },

    getByIdAndAccountIdMD: function (req, res, next) {
        var options = {
            accountId: req.user.accountId,
            id: req.query.id
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        CustomerApi.getByIdAndAccountIdMD(options, errorOptions, function (err, customer) {
            if (err) {
                return next(err);
            }
            req.data = customer;
            next();
        });
    },

    updateMD: function (req, res, next) {
        var options = {
            id: req.body.id,
            updatedAt: req.body.updatedAt,
            saveAsLater: req.body.saveAsLater,
            useExisting: req.body.useExisting,
            locationId: req.body.locationId,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
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
            accountId: req.user.accountId,
            customerId: req.body.customerId,
            customerLocationId: req.body.locationId,
            customerCode: req.body.customerCode,
            customerName: req.body.customerName,
            userId: req.user.id,
            newLocationId: req.body.newLocationId,
            newLocationName: req.body.newLocationName,
            addressLine1: req.body.addressLine1,
            addressLine2: req.body.addressLine2,
            addressLine3: req.body.addressLine3,
            city: req.body.city,
            zipCode: req.body.zipCode,
            state: req.body.state,
            googleLink: req.body.googleLink,
            country: req.body.country
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_CUSTOMER);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        CustomerApi.updateMD(options, auditOptions, errorOptions, function (err, customer) {
            if (err) {
                return next(err);
            }
            req.data = customer;
            next();
        });
    },

    removeMD: function (req, res, next) {
        var options = {
            ids: req.body.ids,
            userId: req.user.id,
            accountId: req.user.accountId
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.DELETE_ARCHIEVE_CUSTOMER);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        CustomerApi.removeMD(options, auditOptions, errorOptions, function (err, result) {
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
            ids: req.body.ids,
            userId: req.user.id,
            accountId: req.user.accountId
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.RESTORE_CUSTOMER);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        CustomerApi.restore(options, auditOptions, errorOptions, function (err, result) {
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
            ids: req.body.ids,
            userId: req.user.id,
            accountId: req.user.accountId
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.DELETE_CUSTOMER);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        CustomerApi.delete(options, auditOptions, errorOptions, function (err, result) {
            if (err) {
                debug(err);
                return next(err);
            }
            req.data = result;
            next();
        });
    },


    inviteMD: function (req, res, next) {
        var options = {
            email: req.body.email,
            id: req.body.id,
            personalMessage: req.body.personalMessage,
            updatedAt: req.body.updatedAt,
            user: req.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        CustomerApi.inviteMD(options, errorOptions, function (err, data) {
            if (err) {
                debug(err);
                return next(err);
            }
            req.data = data;
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
        CustomerApi.reminder(options, errorOptions, function (err, data) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = data;
            next();
        });
    },

    reSendInvitation: function (req, res, next) {
        var options = {
            id: req.body.id,
            updatedAt: req.body.updatedAt,
            flag: 1,
            user: req.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        CustomerApi.reSendInvitation(options, errorOptions, function (err, data) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = data;
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
        CustomerApi.cancel(options, errorOptions, function (err, data) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = data;
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
            customerId: req.body.customerId,
            locationId: req.body.locationId,
            customerCode: req.body.customerCode,
            customerName: req.body.customerName,
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
            status: Constants.CUSTOMER_INVITATION_STATUS.OPEN,
            personalMessage: req.body.personalMessage,
            user: req.user,
            addInviteFlag: true
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        CustomerApi.addInvite(options, errorOptions, function (err, data) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = data;
            next();
        });
    }
};

module.exports = Customer;


