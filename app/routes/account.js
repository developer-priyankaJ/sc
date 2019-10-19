#!/usr/bin/env node
'use strict';

var debug = require('debug')('scopehub.route.account');
var Util = require('util');

var AccountApi = require('../api/account');
var HeaderUtils = require('../lib/header_utils');
var Events = require('../data/events');
var Constants = require('../data/constants');
var Success = require('../data/success');
var DataUtils = require('../lib/data_utils');
var _ = require('lodash');

var Account = {
    createS3AccountMD: function (req, res, next) {
        var options = {
            user: req.user
        };
        AccountApi.createS3AccountMD(options, function (err, user) {
            if (err) {
                Util.log(err);
                return next(err);
            }
            req.user = user;
            next();
        });
    },

    createAccountMD: function (req, res, next) {
        var userExist = req.userExist;
        if (userExist) {
            req.body.accountId = userExist.accountId;
            return next();
        }
        var options = {
            user: req.body.user,
            planType: req.body.planType,
            languageCultureCode: req.body.languageCultureCode,
            accountName: req.body.accountName,
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        AccountApi.createAccountMD(options, errorOptions, function (err, account) {
            if (err) {
                Util.log(err);
                return next(err);
            }
            req.body.accountId = account.id;
            next();
        });
    },

    getAccount: function (req, res, next) {
        var options = {
            accountId: req.user.accountId
        };
        AccountApi.getAccount(options, function (err, account) {
            if (err) {
                Util.log(err);
                return next(err);
            }
            req.data = account;
            next();
        });
    },

    deleteAccountMD: function (req, res, next) {
        var options = {
            user: req.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        AccountApi.deleteAccountMD(options, errorOptions, function (err, user) {
            if (err) {
                return next(err);
            }
            req.data = Constants.OK_MESSAGE;
            return next();
        });
    },

    inviteUser: function (req, res, next) {
        var options = {
            user: req.user,
            email: DataUtils.toLowerCase(req.body.email)
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.ACCOUNT_INVITE_USER);
        AccountApi.inviteUser(options, auditOptions, function (err) {
            if (err) {
                Util.log(err);
                return next(err);
            }
            req.data = {
                message: Success.MESSAGE.ACCOUNT_USER_INVITED_SUCCESS
            };
            next();
        });
    },

    getUsers: function (req, res, next) {
        var options = {
            user: req.user
        };
        AccountApi.getUsers(options, function (err, users) {
            if (err) {
                return next(err);
            }
            req.data = users;
            return next();
        });
    },

    upgradeAccount: function (req, res, next) {
        var options = {
            user: req.user
        };
        AccountApi.upgradeAccount(options, function (err, account) {
            if (err) {
                return next(err);
            }
            req.data = account;
            return next();
        });
    },

    downgradeAccount: function (req, res, next) {
        var options = {
            user: req.user
        };
        AccountApi.downgradeAccount(options, function (err, account) {
            if (err) {
                return next(err);
            }
            req.data = account;
            return next();
        });
    },

    getAccountMD: function (req, res, next) {
        var options = {
            accountId: req.user.accountId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        AccountApi.getAccountMD(options, errorOptions, function (err, account) {
            if (err) {
                Util.log(err);
                return next(err);
            }
            req.data = account;
            next();
        });
    },

    updateAccountMD: function (req, res, next) {
        var options = {
            user: req.user,
            accountId: req.user.accountId,
            companyName: req.body.companyName,
            addressLine1: req.body.addressLine1,
            addressLine2: req.body.addressLine2,
            addressLine3: req.body.addressLine3,
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
            city: req.body.city,
            state: req.body.state,
            zipCode: req.body.zipCode,
            country: req.body.country,
            email: DataUtils.toLowerCase(req.body.email),
            saveAsLater: req.body.saveAsLater,
            useExisting: req.body.useExisting,
            newLocationId: req.body.newLocationId,
            newLocationName: req.body.newLocationName,
            locationId: req.body.locationId,
            locationName: req.body.locationName,
            updatedAt: req.body.updatedAt,
            accountName: req.body.accountName,
            accountDescription: req.body.accountDescription,
        };
        // Adding the userId
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.ACCOUNT_UPDATED);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        AccountApi.updateAccountMD(options, auditOptions, errorOptions, function (err, account) {
            if (err) {
                Util.log(err);
                return next(err);
            }
            req.session.user.account = account;
            req.data = {
                updatedAt: account.updatedAt,
                OK: Constants.SUCCESS_MESSAGE.UPDATE_ACCOUNT_SUCCESS
            };
            next();
        });
    },

    deactivateAccountMD: function (req, res, next) {
        var options = {
            user: req.user,
            accountId: req.user.accountId
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.ACCOUNT_DEACTIVATED);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        AccountApi.deactivateAccountMD(options, auditOptions, errorOptions, function (err, data) {
            if (err) {
                Util.log(err);
                return next(err);
            }
            req.data = data;
            req.user.isAccountEnabled = false;
            req.user.isAccountActive = false;
            next();
        });
    },

    closeAccountMD: function (req, res, next) {
        var options = {
            user: req.user,
            accountId: req.user.accountId
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.CLOSE_ACCOUNT);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        AccountApi.closeAccountMD(options, auditOptions, errorOptions, function (err, data) {
            if (err) {
                Util.log(err);
                return next(err);
            }
            req.data = data;
            req.user.status = Constants.USER_STATUS.CLOSED;
            next();
        });
    },

    activateAccountMD: function (req, res, next) {
        var options = {
            user: req.user,
            accountId: req.user.accountId,
            companyName: req.body.companyName,
            addressLine1: req.body.addressLine1,
            addressLine2: req.body.addressLine2,
            addressLine3: req.body.addressLine3,
            phone1: req.body.phone1,
            phone2: req.body.phone2,
            phone3: req.body.phone3,
            fax1: req.body.fax1,
            fax2: req.body.fax2,
            fax3: req.body.fax3,
            city: req.body.city,
            state: req.body.state,
            zipCode: req.body.zipCode,
            country: req.body.country,
            updatedAt: req.body.updatedAt,
            email: DataUtils.toLowerCase(req.body.email)
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.ACCOUNT_ACTIVATE_FIRST_TIME);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        AccountApi.activateAccountMD(options, auditOptions, errorOptions, function (err, account) {
            if (err) {
                Util.log(err);
                return next(err);
            }
            req.data = account;
            req.user.isAccountActive = true;
            req.user.isAccountEnabled = true;
            next();
        });
    },
    updateEncryptionKeys: function (req, res, next) {
        var options = {
            user: req.user,
            accountId: req.user.accountId,
            publicKey: req.body.publicKey,
            privateKey: req.body.privateKey,
            encryptionStatus: req.body.encryptionStatus,
            updatedAt: req.body.updatedAt,
            addKeys: req.body.addKeys
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.ADDED_ENCRYPTION_KEYS_IN_ACCOUNT);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        AccountApi.updateEncryptionKeys(options, auditOptions, errorOptions, function (err, account) {
            if (err) {
                Util.log(err);
                return next(err);
            }
            req.data = account;
            next();
        });
    },

    reactivateAccountMD: function (req, res, next) {
        var options = {
            user: req.user,
            accountId: req.user.accountId
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.ACCOUNT_REACTIVATE);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        AccountApi.reactivateAccountMD(options, auditOptions, errorOptions, function (err, account) {
            if (err) {
                Util.log(err);
                return next(err);
            }
            req.data = account;
            req.user.isAccountEnabled = true;
            next();
        });
    }

};

module.exports = Account;

(function () {
    if (require.main == module) {
    }
}());
