#!/usr/bin/env node

'use strict';

var debug = require('debug')('scopehub.route.role_permission');

var RoleApi = require('../api/role');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');
var HeaderUtils = require('../lib/header_utils');
var Events = require('../data/events');

var Role = {
    createMD: function (req, res, next) {
        var options = {
            title: req.body.title,
            user: req.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        RoleApi.createMD(options, errorOptions, function (err, role) {
            if (err) {
                return next(err);
            }
            req.data = role;
            next();
        });
    },
    /*insertUserRoleMD: function (req, res, next) {
        var options = {
            user_id: req.body.user_id,
            role_id: req.body.role_id,
        };
        RoleApi.insertUserRoleMD(options, function (err, createUserRole) {
            if (err) {
                return next(err);
            }
            req.data = createUserRole;
            next();
        });
    },*/

    getRoleMD: function (req, res, next) {
        var options = {
            roleId: req.query.roleId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        RoleApi.getRoleMD(options, errorOptions, function (err, role) {
            if (err) {
                return next(err);
            }
            req.data = role;
            next();
        });
    },

    updateRoleMD: function (req, res, next) {
        var options = {
            roleId: req.body.roleId,
            title: req.body.title,
            user: req.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        RoleApi.updateRoleMD(options, errorOptions, function (err, role) {
            if (err) {
                return next(err);
            }
            req.data = role;
            next();
        });
    },

    getRolesMD: function (req, res, next) {
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        RoleApi.getRolesMD(errorOptions, function (err, roles) {
            if (err) {
                return next(err);
            }
            req.data = roles;
            next();
        });
    },

    removeMD: function (req, res, next) {
        var options = {
            roleId: req.query.roleId,
            user: req.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        RoleApi.removeMD(options, errorOptions, function (err) {
            if (err) {
                debug(err);
                return next(err);
            }
            req.data = Constants.OK_MESSAGE;
            next();
        });
    }
};

module.exports = Role;

(function () {
    if (require.main == module) {
    }
}());
