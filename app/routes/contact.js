#!/usr/bin/env node

'use strict';

var debug = require('debug')('scopehub.route.contact');
var HeaderUtils = require('../lib/header_utils');
var ContactApi = require('../api/contact');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');
var Events = require('../data/events');
var DataUtils = require('../lib/data_utils');

var Contact = {

    createMD: function (req, res, next) {

        var user = req.user;
        var options = {
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            nickName: req.body.nickName,
            company: req.body.company,
            fax: req.body.fax,
            phone: req.body.phone,
            dialCode: req.body.dialCode,
            phoneCountry: req.body.phoneCountry,
            primaryMobile: req.body.primaryMobile,
            primaryMobileDialCode: req.body.primaryMobileDialCode,
            primaryMobileCountry: req.body.primaryMobileCountry,
            secondaryMobile: req.body.secondaryMobile,
            secondaryMobileDialCode: req.body.secondaryMobileDialCode,
            secondaryMobileCountry: req.body.secondaryMobileCountry,
            personalMessage: req.body.personalMessage,
            notes: req.body.notes,
            createdBy: user.id,
            accountId: user.accountId,
            inviterUser: user,
            inviteeEmail: DataUtils.toLowerCase(req.body.inviteeEmail)
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        ContactApi.createMD(options, errorOptions, function (err, contact) {
            if (err) {
                return next(err);
            }
            req.data = contact;
            next();
        });
    },

    addAndInviteMD: function (req, res, next) {
        var user = req.user;
        var options = {
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            nickName: req.body.nickName,
            company: req.body.company,
            fax: req.body.fax,
            phone: req.body.phone,
            dialCode: req.body.dialCode,
            phoneCountry: req.body.phoneCountry,
            primaryMobile: req.body.primaryMobile,
            primaryMobileDialCode: req.body.primaryMobileDialCode,
            primaryMobileCountry: req.body.primaryMobileCountry,
            secondaryMobile: req.body.secondaryMobile,
            secondaryMobileDialCode: req.body.secondaryMobileDialCode,
            secondaryMobileCountry: req.body.secondaryMobileCountry,
            notes: req.body.notes,
            mobile: req.body.mobile,
            createdBy: user.id,
            inviterUser: user,
            inviteeEmail: DataUtils.toLowerCase(req.body.inviteeEmail),
            accountId: req.body.accountId,
            personalMessage: req.body.personalMessage
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.CREATE_CONTACT);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        ContactApi.addAndInviteMD(options, auditOptions, errorOptions, function (err, contact) {
            if (err) {
                return next(err);
            }
            req.data = contact;
            next();
        });
    },

    inviteMD: function (req, res, next) {
        var user = req.user;
        var options = {
            contactId: req.body.contactId,
            updatedAt: req.body.updatedAt,
            user: user,
            personalMessage: req.body.personalMessage,
            isStartTransaction: true
        };
        var auditOptions = {};
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.INVITE_CONTACT);
        ContactApi.inviteMD(options, auditOptions, errorOptions, function (err, contact) {
            if (err) {
                return next(err);
            }
            req.data = contact;
            next();
        });
    },

    reSendInvitationMD: function (req, res, next) {
        var user = req.user;
        var options = {
            contactId: req.body.contactId,
            updatedAt: req.body.updatedAt,
            user: user

        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.RE_SEND_CONTACT_INVITATION);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        ContactApi.reSendInvitationMD(options, auditOptions, errorOptions, function (err, contact) {
            if (err) {
                return next(err);
            }
            req.data = contact;
            next();
        });
    },

    reminderMD: function (req, res, next) {
        var user = req.user;
        var options = {
            contactId: req.body.contactId,
            updatedAt: req.body.updatedAt,
            user: user
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        ContactApi.reminderMD(options, errorOptions, function (err, contact) {
            if (err) {
                return next(err);
            }
            req.data = contact;
            next();
        });
    },

    contactExist: function (req, res, next) {
        var user = req.user;
        var options = {
            inviterUUID: user.id,
            inviteeUserExists: req.userExist
            //temporaryUser: req.temporaryUser
        };
        ContactApi.contactExist(options, function (err, contact) {
            if (err) {
                return next(err);
            }
            req.contactExist = contact;
            next();
        });
    },

    getContactListMD: function (req, res, next) {

        console.log(req.user.id);
        var options = {
            inviterUUID: req.user.id
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        ContactApi.getContactListMD(options, errorOptions, function (err, contactList) {

            if (err) {
                return next(err);
            }
            req.data = contactList;
            next();
        });
    },

    getContact: function (req, res, next) {
        var options = {
            contactId: req.body.contactId
        };

        ContactApi.getContact(options, function (err, contact) {

            if (err) {
                return next(err);
            }
            req.contact = contact;
            if (contact) {
                req.body.email = contact.inviteeEmail;
            }
            next();
        });
    },

    getContactMD: function (req, res, next) {
        var options = {
            contactId: req.query.contactId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        ContactApi.getContactMD(options, errorOptions, function (err, contact) {

            if (err) {
                return next(err);
            }
            req.data = contact;
            next();
        });
    },

    updateMD: function (req, res, next) {

        var user = req.user;
        var options = {
            userId: user.id,
            contactId: req.body.contactId,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            nickName: req.body.nickName,
            company: req.body.company,
            fax: req.body.fax,
            phone: req.body.phone,
            dialCode: req.body.dialCode,
            phoneCountry: req.body.phoneCountry,
            primaryMobile: req.body.primaryMobile,
            primaryMobileDialCode: req.body.primaryMobileDialCode,
            primaryMobileCountry: req.body.primaryMobileCountry,
            secondaryMobile: req.body.secondaryMobile,
            secondaryMobileDialCode: req.body.secondaryMobileDialCode,
            secondaryMobileCountry: req.body.secondaryMobileCountry,
            personalMessage: req.body.personalMessage,
            notes: req.body.notes,
            updatedAt: req.body.updatedAt
        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_CONTACT);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        ContactApi.updateMD(options, auditOptions, errorOptions, function (err, contact) {
            if (err) {
                return next(err);
            }
            req.data = contact;
            next();
        });
    },

    cancelMD: function (req, res, next) {
        var options = {
            contactId: req.body.contactId,
            updatedAt: req.body.updatedAt,
            user: req.user
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.INVITER_CANCELLED_INVITATION);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        ContactApi.cancelMD(options, auditOptions, errorOptions, function (err, data) {
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
            contactId: req.query.contactId,
            user: req.user,
            updatedAt: req.query.updatedAt
        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.REMOVE_CONTACT);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        ContactApi.removeMD(options, auditOptions, errorOptions, function (err) {
            if (err) {
                debug(err);
                return next(err);
            }
            req.data = Constants.OK_MESSAGE;
            next();
        });
    },

    removeContactsMD: function (req, res, next) {

        var options = {
            contactIds: req.body.contactIds,
            user: req.user
        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.REMOVE_CONTACT);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        ContactApi.removeContactsMD(options, auditOptions, errorOptions, function (err, data) {
            if (err) {
                debug(err);
                return next(err);
            }
            req.data = data;
            next();
        });
    },

    blockContactMD: function (req, res, next) {

        var options = {
            contactId: req.body.contactId,
            updatedAt: req.body.updatedAt,
            user: req.user
        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.BLOCK_CONTACT);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        ContactApi.blockContactMD(options, auditOptions, errorOptions, function (err, data) {
            if (err) {
                debug(err);
                return next(err);
            }
            req.data = data;
            next();
        });
    },

    unBlockContactMD: function (req, res, next) {

        var options = {
            contactId: req.body.contactId,
            updatedAt: req.body.updatedAt,
            user: req.user
        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.BLOCK_CONTACT);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        ContactApi.unBlockContactMD(options, auditOptions, errorOptions, function (err, data) {
            if (err) {
                debug(err);
                return next(err);
            }
            req.data = data;
            next();
        });
    },
};

module.exports = Contact;

(function () {
    if (require.main == module) {
    }
}());