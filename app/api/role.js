/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.api.role');

var Async = require('async');
var Utils = require('../lib/utils');
var _ = require('lodash');
var uuid = require('uuid');

var connection = require('../lib/connection_util');
var ErrorUtils = require('../lib/error_utils');
var DataUtils = require('../lib/data_utils');
var AuditUtils = require('../lib/audit_utils');
var Constants = require('../data/constants');
var ErrorConfig = require('../data/error');


var Role = {
    createMD: async function (options, errorOptions, cb) {
        var title = options.title;
        var userId = options.user.id;
        var createdAt = DataUtils.getEpochMSTimestamp();
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var err;
        if (DataUtils.isUndefined(title)) {
            err = new Error(ErrorConfig.MESSAGE.ROLE_TITLE_REQUIRED);
        }
        if (!DataUtils.isValidateOptionalField(title)) {
            if (!DataUtils.isString(title)) {
                err = new Error(ErrorConfig.MESSAGE.ROLE_TITLE_MUST_BE_STRING);
            } else if (title.length > 30) {
                err = new Error(ErrorConfig.MESSAGE.ROLE_TITLE_MUST_BE_LESS_THAN_30_CHARACTER);
            }
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug(err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
        var generatedId = Utils.generateId();
        var roleOptions = {
            title: title,
            active: true
        };

        try {
            var conn = await connection.getConnection();
            var role = await conn.query('If (select 1 from Roles where title= ?) is null then ' +
              'INSERT into Roles (id,title,active,createdAt,createdBy,updatedAt) values(uuid_to_bin(?),?,?,?,' +
              'uuid_to_bin(?),?);end if ',
              [roleOptions.title, generatedId.uuid, roleOptions.title, roleOptions.active, createdAt, userId, updatedAt]);

            var isRoleAffected = Utils.isAffectedPool(role);
            if (!isRoleAffected) {
                err = new Error(ErrorConfig.MESSAGE.DUPLICATE_ROLE);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            return cb(null, {OK: Constants.SUCCESS, id: generatedId.uuid, createdAt: createdAt});
        }
        catch (err) {
            err = new Error(ErrorConfig.MESSAGE.CREATE_ROLE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            debug('err ', err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    /*insertUserRoleMD: async function (options, cb) {
        var roleId = options.roleId;
        var userId = options.userId;
        var err;
        if (!roleId) {
            err = new Error(ErrorConfig.MESSAGE.ROLE_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
            return cb(err);
        }
        if (!userId) {
            err = new Error(ErrorConfig.MESSAGE.USER_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
            return cb(err);
        }
        var userRoleOptions = {
            id: uuid(),
            userId: userId,
            roleId: roleId
        };

        try {
            var userRole = await UserRoleModelMD.query().insert(userRoleOptions);
            if (!userRole) {
                err = new Error(ErrorConfig.MESSAGE.CREATE_USER_ROLE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
            return cb(null, userRole);
        }
        catch (err) {
            debug('err ', err);
            return cb(err);
        }
    },*/

    getRoleMD: async function (options, errorOptions, cb) {
        var roleId = options.roleId;
        var err;

        if (DataUtils.isUndefined(roleId)) {
            err = new Error(ErrorConfig.MESSAGE.ROLE_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
        try {
            var conn = await connection.getConnection();
            var role = await conn.query('select CAST(uuid_from_bin(id) as char) as id,title,active,' +
              'updatedAt,title from Roles where id=uuid_to_bin(?)', roleId);
            role = Utils.filteredResponsePool(role);

            if (!role) {
                err = new Error(ErrorConfig.MESSAGE.ROLE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            return cb(null, role);
        } catch (err) {
            err = new Error(ErrorConfig.MESSAGE.ROLE_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    getRolesMD: async function (errorOptions, cb) {
        try {
            var conn = await connection.getConnection();
            var roles = await conn.query('select CAST(uuid_from_bin(id) as char) as id,title,active,' +
              'updatedAt,title from Roles');

            return cb(null, roles);
        } catch (err) {
            err = new Error(ErrorConfig.MESSAGE.ROLE_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, err);
            return cb(err);
        }
    },

    updateRoleMD: async function (options, errorOptions, cb) {
        var title = options.title;
        var userId = options.user.id;
        var roleId = options.roleId;
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();

        var err;
        var roleOptions = {};
        if (DataUtils.isUndefined(roleId)) {
            err = new Error(ErrorConfig.MESSAGE.ROLE_ID_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug(err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
        if (DataUtils.isDefined(title)) {
            roleOptions.title = title;
        }

        try {
            var conn = await connection.getConnection();
            var roleResponse = await conn.query('If (select 1 from Roles where id=uuid_to_bin(?)) is not null then ' +
              'update Roles set title=?,updatedBy=uuid_to_bin(?),updatedAt=? where id=uuid_to_bin(?);end if',
              [roleId, roleOptions.title, userId, newUpdatedAt, roleId]);

            var isAffected = Utils.isAffectedPool(roleResponse);

            if (!isAffected) {
                err = err || new Error(ErrorConfig.MESSAGE.ROLE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                return cb(err);
            }
            roleResponse = {
                OK: Constants.SUCCESS,
                updatedAt: newUpdatedAt
            };
            return cb(null, roleResponse);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.ROLE_UPDATE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
    },

    removeMD: async function (options, errorOptions, cb) {
        var userId = options.user.id;
        var roleId = options.roleId;
        var active = false;
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();
        var err;
        if (DataUtils.isUndefined(roleId)) {
            err = new Error(ErrorConfig.MESSAGE.ROLE_ID_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug(err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var roleResponse = await conn.query('If (select 1 from Roles where id=uuid_to_bin(?)) is not null then ' +
              'update Roles set active=?,updatedBy=uuid_to_bin(?),updatedAt=? where id=uuid_to_bin(?);end if',
              [roleId, active, userId, newUpdatedAt, roleId]);

            var isAffected = Utils.isAffectedPool(roleResponse);
            if (!isAffected) {
                err = err || new Error(ErrorConfig.MESSAGE.ROLE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                return cb(err);
            }
            return cb(null, {OK: Constants.SUCCESS});
        } catch (err) {
            await ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.ROLE_UPDATE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
    }
};

var combine = function (obj1, obj2) {
    var obj3 = {};
    _.each(obj1, function (value, key) {
        obj3[key] = value;
        _.each(value, function (value1, key1) {
            obj3[key][key1] = value1;
            _.each(value1, function (value2, key2) {

                if (value1[key2] === false && obj2[key][key1][key2] === false) {
                    obj3[key][key1][key2] = false;
                } else {
                    obj3[key][key1][key2] = true;
                }
            });
        });
    });
    return obj3;
};

module.exports = Role;
