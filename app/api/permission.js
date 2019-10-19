'use strict';

var debug = require('debug')('scopehub.api.permission');
var _ = require('lodash');
var DataUtils = require('../lib/data_utils');
var ErrorConfig = require('../data/error');
var PermissionModel = require('../model/permission');
var RoleModel = require('../model/role');
var Constants = require('../data/constants');
var AuditUtils = require('../lib/audit_utils');


var Permission = {
    create: function (options, auditOptions, cb) {
        var roleId = options.roleId;
        var dashboard = options.dashboard;
        var demand = options.demand;
        var operation = options.operation;
        var supply = options.supply;
        var reference = options.reference;
        var accountSettings = options.accountSettings;
        var params = {overwrite: false};
        var err;

        if (DataUtils.isUndefined(roleId)) {
            err = new Error(ErrorConfig.MESSAGE.ROLE_ID_REQUIRED);
        } else if (!dashboard) {
            err = new Error(ErrorConfig.MESSAGE.PERMISSION_FOR_DASHBOARD_REQUIRED);
        } else if (!demand) {
            err = new Error(ErrorConfig.MESSAGE.PERMISSION_FOR_DEMAND_REQUIRED);
        } else if (!operation) {
            err = new Error(ErrorConfig.MESSAGE.PERMISSION_FOR_OPERATION_REQUIRED);
        } else if (!supply) {
            err = new Error(ErrorConfig.MESSAGE.PERMISSION_FOR_SUPPLY_REQUIRED);
        } else if (!reference) {
            err = new Error(ErrorConfig.MESSAGE.PERMISSION_FOR_REFERENCE_REQUIRED);
        } else if (!accountSettings) {
            err = new Error(ErrorConfig.MESSAGE.PERMISSION_FOR_ACCOUNT_SETTINGS_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        RoleModel.get(roleId, function (err, role) {
            if (err || !role) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.ROLE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
            role = role && role.attrs;

            var permissionOption = {
                roleId: roleId || role.id,
                dashboard: dashboard,
                demand: demand,
                operation: operation,
                supply: supply,
                reference: reference,
                accountSettings: accountSettings
            };
            PermissionModel.create(permissionOption, params, function (err, permission) {
                if (err || !permission) {
                    debug('err', err);
                    err = new Error(ErrorConfig.MESSAGE.PERMISSION_CREATION_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return cb(err);
                }
                permission = permission && permission.attrs;
                AuditUtils.create(auditOptions);
                return cb(null, permission);
            });
        });

    }
};

module.exports = Permission;
