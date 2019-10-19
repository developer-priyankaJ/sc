#!/usr/bin/env node

'use strict';

var debug = require('debug')('scopehub.route.group_contacts');
var Util = require('util');

var GroupContactApi = require('../api/group_contact');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');
var Events = require('../data/events');
var HeaderUtils = require('../lib/header_utils');

var GroupContact = {

    add: function (req, res, next) {
        var user = req.user;
        var options = {
            groupId: req.body.groupId,
            contactIds: req.body.contactIds,
            createdBy: user.id
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.ADD_GROUP_CONTACT);
        GroupContactApi.add(options, auditOptions, function (err, groupContact) {
            if (err) {
                return next(err);
            }
            req.data = groupContact;
            next();
        });
    },

    getAllGroups: function (req, res, next) {
        var options = {
            contactId: req.query.contactId
        };
        GroupContactApi.getAllGroups(options, function (err, groups) {
            if (err) {
                return next(err);
            }
            req.data = groups;
            next();
        });
    },

    getAllGroupsByUser: function (req, res, next) {
        var options = {
            userId: req.query.userId
        };
        GroupContactApi.getAllGroupsByUser(options, function (err, groups) {
            if (err) {
                return next(err);
            }
            req.data = groups;
            next();
        });
    },

    leaveGroup: function (req, res, next) {
        var options = {
            userId: req.body.userId,
            group: req.body.group
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.LEAVE_FROM_GROUP);
        GroupContactApi.leaveGroup(options, auditOptions, function (err) {
            if (err) {
                return next(err);
            }
            req.data = Constants.OK_MESSAGE;
            next();
        });
    },

    delete: function (req, res, next) {
        var options = {
            groupId: req.body.groupId,
            contactIds: req.body.contactIds
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.DELETE_GROUP_CONTACT);
        GroupContactApi.delete(options, auditOptions, function (err) {
            if (err) {
                return next(err);
            }
            req.data = Constants.OK_MESSAGE;
            next();
        });
    }
};

module.exports = GroupContact;

(function () {
    if (require.main == module) {
    }
}());