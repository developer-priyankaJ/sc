#!/usr/bin/env node

'use strict';

var debug = require('debug')('scopehub.route.group');
var Util = require('util');

var GroupApi = require('../api/group');
var GroupContactsApi = require('../api/group_contact');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');
var Events = require('../data/events');
var HeaderUtils = require('../lib/header_utils');

var Group = {

    create: function (req, res, next) {
        var user = req.user;
        var options = {
            name: req.body.name,
            ownerId: req.body.ownerId,
            contactIds: req.body.contactIds,
            createdBy: user.id
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.CREATE_GROUP);
        GroupApi.create(options, auditOptions, function (err, group) {
            if (err) {
                return next(err);
            }
            req.data = group;
            next();
        });
    },

    update: function (req, res, next) {
        var user = req.user;
        var options = {
            updatedBy: user.id,
            name: req.body.name,
            groupId: req.body.groupId,
            groupNameExist: req.group
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.EDIT_GROUP);
        GroupApi.update(options, auditOptions, function (err, edit) {
            if (err || !edit) {
                return next(err);
            }
            req.data = edit;
            next();
        });
    },

    groupNameExist: function (req, res, next) {
        var options = {
            name: req.body.name
        };
        GroupApi.groupNameExist(options, function (err, group) {
            if (err) {
                return next(err);
            }
            req.group = group;
            next();
        });
    },

    getContact: function (req, res, next) {
        var options = {
            groupId: req.query.groupId
        };
        GroupApi.getContact(options, function (err, group) {
            if (err) {
                return next(err);
            }
            req.data = group;
            next();
        });
    },

    remove: function (req, res, next) {
        var options = {
            groupId: req.query.groupId
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.REMOVE_GROUP);
        GroupApi.remove(options, auditOptions, function (err) {
            if (err) {
                debug(err);
                return next(err);
            }
            req.data = Constants.OK_MESSAGE;
            next();
        });
    },
    getGroupContact: function (req, res, next) {
        var options = {
            groupId: req.query.groupId
        };
        GroupApi.getGroupContact(options, function (err, groupContact) {
            if (err) {
                return next(err);
            }
            req.data = groupContact;
            next();
        });
    },

    getAllGroups: function (req, res, next) {
        var options = {
            ownerId: req.query.ownerId
        };
        GroupApi.getAllGroups(options, function (err, groupContact) {
            if (err) {
                return next(err);
            }
            req.data = groupContact;
            next();
        });
    }
};

module.exports = Group;

(function () {
    if (require.main == module) {
    }
}());