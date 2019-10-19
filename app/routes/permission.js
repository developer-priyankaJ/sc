#!/usr/bin/env node

'use strict';

var debug = require('debug')('scopehub.route.permission');
var Permissions = require('../data/permissions');
var PermissionApi = require('../api/permission');
var Constants = require('../data/constants');
var Events = require('../data/events');
var HeaderUtils = require('../lib/header_utils');

var Permission = {
    list: function (req, res, next) {
        req.data = Permissions;
        next();
    },

    create: function (req, res, next) {
        debug('Inside create');
        var options = {
            roleId: req.body.roleId,
            dashboard: req.body.dashboard,
            demand: req.body.demand,
            operation: req.body.operation,
            supply: req.body.supply,
            reference: req.body.reference,
            accountSettings: req.body.accountSettings
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.CREATE_PERMISSION);
        PermissionApi.create(options, auditOptions, function (err, permission) {
            if (err) {
                return next(err);
            }
            req.data = permission;
            next();
        });
    }
};

module.exports = Permission;

(function () {
    if (require.main == module) {
    }
}());
