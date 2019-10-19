/* jslint node: true */
'use strict';


var debug = require('debug')('scopehub.api.notification_reference');
var Util = require('util');
var _ = require('lodash');
//var knexfile = require('../knexfile');
//var knex = require('knex')(knexfile);

var connection = require('../lib/connection_util');
var DataUtils = require('../lib/data_utils');
var Constants = require('../data/constants');
var NotificationReferenceModel = require('../model/notification_reference');
var ErrorConfig = require('../data/error');
var ErrorUtils = require('../lib/error_utils');
var AuditUtils = require('../lib/audit_utils');
var Utils = require('../lib/utils');
var ErrorUtils = require('../lib/error_utils');
var notificationReferences = [];

var noop = function () {
}; // do nothing.

var NotificationReference = {
    init: function (cb) {
        notificationReferences = [];
        NotificationReferenceModel.scan()
          .loadAll()
          .exec(function (err, data) {
              var references = data && data.Items ? data.Items : [];
              references.forEach(function (reference) {
                  notificationReferences.push(reference.attrs);
              });
              return cb(null, []);
          });
    },

    initMD: async function () {
        return new Promise(async function (resolve, reject) {
            try {
                var conn = await connection.getConnection();

                notificationReferences = [];
                var notiref = await conn.query('SELECT id, meta, description, actionIgnore, actionDecline, actionAccept, category, categoryId, subCategory, defaultType, languageCultureCode, active, `type`, paramasInviter, paramasInvitee, paramasDateTime, paramasError, paramasOtherDataName, paramasUser, paramasOtherData FROM ScopehubAppDB.NotificationReference');
                //notificationReferences = Utils.filteredResponse(notiref);
                return resolve(notiref);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    createMD: async function (options, errorOptions, cb) {

        var id = options.id;
        var meta = options.meta;
        var description = options.description;
        var actionIgnore = options.actionIgnore;
        var actionDecline = options.actionDecline;
        var actionAccept = options.actionAccept;
        var category = options.category;
        var categoryId = options.categoryId;
        var subCategory = options.subCategory;
        var defaultType = options.defaultType;
        var paramasInviter = options.paramasInviter;
        var paramasInvitee = options.paramasInvitee;
        var paramasDateTime = options.paramasDateTime;
        var paramasError = options.paramasError;
        var paramasOtherDataName = options.paramasOtherDataName;
        var paramasUser = options.paramasUser;
        var paramasOtherData = options.paramasOtherData;
        var type = options.type;
        var languageCultureCode = options.languageCultureCode;
        var err;

        if (isNaN(id) || id <= 0) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_REFERENCE_ID_INVALID);
        }
        if (!err && !DataUtils.isString(categoryId)) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_REFERENCE_CATEGORY_ID_MUST_BE_STRING);
        }
        if (!err && DataUtils.isUndefined(meta)) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_REFERENCE_META_REQUIRED);
        }
        if (!err && DataUtils.isUndefined(description)) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_REFERENCE_DESCRIPTION_REQUIRED);
        }
        if (!err && !actionIgnore) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_REFERENCE_ACTIONS_IGNORE_REQUIRED);
        }
        if (!err && !actionDecline) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_REFERENCE_ACTIONS_DECLINE_REQUIRED);
        }
        if (!err && !actionAccept) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_REFERENCE_ACTIONS_ACCEPT_REQUIRED);
        }
        if (!err && DataUtils.isUndefined(languageCultureCode)) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_REFERENCE_LANGUAGE_CULTURE_CODE_REQUIRED);
        }
        if (!err && DataUtils.isUndefined(defaultType)) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_REFERENCE_DEFAULT_TYPE_INVALID);
        }
        if (!err && DataUtils.isUndefined(category)) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_REFERENCE_CATEGORY_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug(err);
            return cb(err);
        }

        var Fields = '';
        var columnBindParams = [id, languageCultureCode];
        var value = '';

        if (DataUtils.isDefined(subCategory)) {
            Fields += ' subCategory,';
            value += '?,';
            columnBindParams.push(subCategory);
        }
        if (DataUtils.isDefined(paramasInviter)) {
            Fields += ' paramasInviter,';
            value += '?,';
            columnBindParams.push(paramasInviter);
        }
        if (DataUtils.isDefined(paramasInvitee)) {
            Fields += ' paramasInvitee,';
            value += '?,';
            columnBindParams.push(paramasInvitee);
        }
        if (DataUtils.isDefined(paramasDateTime)) {
            Fields += ' paramasDateTime,';
            value += '?,';
            columnBindParams.push(paramasDateTime);
        }
        if (DataUtils.isDefined(paramasError)) {
            Fields += ' paramasError,';
            value += '?,';
            columnBindParams.push(paramasError);
        }
        if (DataUtils.isDefined(paramasOtherDataName)) {
            Fields += ' paramasOtherDataName,';
            value += '?,';
            columnBindParams.push(paramasOtherDataName);
        }
        if (DataUtils.isDefined(paramasUser)) {
            Fields += ' paramasUser,';
            value += '?,';
            columnBindParams.push(paramasUser);
        }
        if (DataUtils.isDefined(paramasOtherData)) {
            Fields += ' paramasOtherData,';
            value += '?,';
            columnBindParams.push(paramasOtherData);
        }
        if (DataUtils.isDefined(type)) {
            Fields += ' type,';
            value += '?,';
            columnBindParams.push(type);
        }
        if (DataUtils.isDefined(actionIgnore)) {
            Fields += 'actionIgnore,';
            value += '?,';
            columnBindParams.push(actionIgnore);
        }
        if (DataUtils.isDefined(actionDecline)) {
            Fields += ' actionDecline,';
            value += '?,';
            columnBindParams.push(actionDecline);
        }
        if (DataUtils.isDefined(actionAccept)) {
            Fields += ' actionAccept,';
            value += '?,';
            columnBindParams.push(actionAccept);
        }
        if (DataUtils.isDefined(meta)) {
            Fields += ' meta,';
            value += '?,';
            columnBindParams.push(meta);
        }
        if (DataUtils.isDefined(description)) {
            Fields += ' description,';
            value += '?,';
            columnBindParams.push(description);
        }
        if (DataUtils.isDefined(category)) {
            Fields += ' category,';
            value += '?,';
            columnBindParams.push(category);
        }
        if (DataUtils.isDefined(categoryId)) {
            Fields += ' categoryId,';
            value += '?,';
            columnBindParams.push(categoryId);
        }
        if (DataUtils.isDefined(defaultType)) {
            Fields += ' defaultType,';
            value += '?,';
            columnBindParams.push(defaultType);
        }

        try {
            var conn = await connection.getConnection();
            var query = 'IF EXISTS (select * from NotificationReference where id = ? and languageCultureCode = ?) ' +
              'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "NOTIFICATION_REFERENCE_ID_EXISTS";' +
              'ELSE insert into NotificationReference (' + Fields + 'id,languageCultureCode,active,createdAt,updatedAt)' +
              'values(' + value + '?,?,?,utc_timestamp(3),utc_timestamp(3));end IF';

            var params = columnBindParams.concat([id, languageCultureCode, '1']);
            await conn.query(query, params);
            return cb(null, {id: id});

        } catch (err) {

            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);

            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_REFERENCE_ID_EXISTS);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno) {
                err = err || new Error(ErrorConfig.MESSAGE.NOTIFICATION_REFERENCE_CREATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    get: function (options, cb) {
        var id = Number(options.id);
        var languageCultureCode = options.languageCultureCode;
        var err;
        if (isNaN(id) || id <= 0) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_REFERENCE_ID_INVALID);
        } else if (DataUtils.isUndefined(languageCultureCode)) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_REFERENCE_LANGUAGE_CULTURE_CODE_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug(err);
            return cb(err);
        }

        NotificationReferenceModel.get(id, languageCultureCode, {
            ConsistentRead: true
        }, function (err, data) {
            var reference = data && data.attrs;
            return cb(err, reference);
        });
    },

    getMD: async function (options) {
        var id = Number(options.id);
        var languageCultureCode = options.languageCultureCode;
        var err;
        if (isNaN(id) || id <= 0) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_REFERENCE_ID_INVALID);
        } else if (DataUtils.isUndefined(languageCultureCode)) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_REFERENCE_LANGUAGE_CULTURE_CODE_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug(err);
            throw err;
        }
        var conn = await connection.getConnection();
        var notiRef = await conn.query('SELECT * from NotificationReference WHERE id = ? AND languageCultureCode = ?', [id, languageCultureCode]);
        return Utils.filteredResponsePool(notiRef);
    },

    getLanguageCultureCodeNotificationsMD: async function (options, errorOptions, cb) {

        var languageCultureCode = options.languageCultureCode;

        if (Constants.VALID_LANGUAGE_CULTURE_CODE.indexOf(languageCultureCode) === -1) {
            var err = new Error(ErrorConfig.MESSAGE.LANGUAGE_CULTURE_CODE_INVALID);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var notiRef = await conn.query('select * from NotificationReference where languageCultureCode = ?', [languageCultureCode]);

            var notiRefs = [];
            /*if (!_.isEmpty(notiRef)) {
                notiRefs = notiRef[0];
            }*/
            return cb(null, notiRef || []);

        } catch (err) {

            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);

            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_REFERENCE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            }
            return cb(err);
        }
    },

    getAll: function () {
        return notificationReferences;
    },

    updateMD: async function (options, auditOptions, errorOptions, cb) {

        var user = options.user;
        var id = options.id;
        var meta = options.meta;
        var description = options.description;
        var actionIgnore = options.actionIgnore;
        var actionDecline = options.actionDecline;
        var actionAccept = options.actionAccept;
        var category = options.category;
        var categoryId = options.categoryId;
        var subCategory = options.subCategory;
        var defaultType = options.defaultType;
        var paramasInviter = options.paramasInviter;
        var paramasInvitee = options.paramasInvitee;
        var paramasDateTime = options.paramasDateTime;
        var paramasError = options.paramasError;
        var paramasOtherDataName = options.paramasOtherDataName;
        var paramasUser = options.paramasUser;
        var paramasOtherData = options.paramasOtherData;
        var type = options.type;
        var updatedAt = options.updatedAt;
        var languageCultureCode = options.languageCultureCode;
        var err;

        if (DataUtils.isUndefined(id)) {
            err = new Error(
              ErrorConfig.MESSAGE.NOTIFICATION_REFERENCE_ID_REQUIRED);
        }
        if (DataUtils.isUndefined(languageCultureCode)) {
            err = new Error(
              ErrorConfig.MESSAGE.LANGUAGE_CULTURE_CODE_REQUIRED);
        }
        if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(
              ErrorConfig.MESSAGE.NOTIFICATION_REFERENCE_UPDATED_AT_REQUIRED);
        }
        if (Constants.VALID_LANGUAGE_CULTURE_CODE.indexOf(languageCultureCode) === -1) {
            err = new Error(ErrorConfig.MESSAGE.LANGUAGE_CULTURE_CODE_INVALID);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        var fields = '';
        var fieldsParams = [id, languageCultureCode, id, languageCultureCode, new Date(updatedAt)];


        if (DataUtils.isDefined(meta)) {
            fieldsParams.push(meta);
            fields += 'meta = ?,';
        }
        if (DataUtils.isDefined(description)) {
            fieldsParams.push(description);
            fields += 'description = ?,';
        }
        if (DataUtils.isDefined(category)) {
            fieldsParams.push(category);
            fields += 'category = ?,';
        }
        if (DataUtils.isDefined(categoryId)) {
            fieldsParams.push(categoryId);
            fields += 'categoryId = ?,';
        }
        if (DataUtils.isDefined(subCategory)) {
            fieldsParams.push(subCategory);
            fields += 'subCategory = ?,';
        }
        if (actionIgnore) {
            fieldsParams.push(actionIgnore);
            fields += 'actionIgnore = ?,';
        }
        if (actionDecline) {
            fieldsParams.push(actionDecline);
            fields += 'actionDecline = ?,';
        }
        if (actionAccept) {
            fieldsParams.push(actionAccept);
            fields += 'actionAccept = ?,';
        }
        if (DataUtils.isDefined(defaultType)) {
            fieldsParams.push(defaultType);
            fields += 'defaultType = ?,';
        }
        if (DataUtils.isDefined(paramasInviter)) {
            fields += ' paramasInviter = ?,';
            fieldsParams.push(paramasInviter);
        }
        if (DataUtils.isDefined(paramasInvitee)) {
            fields += ' paramasInvitee = ?,';
            fieldsParams.push(paramasInvitee);
        }
        if (DataUtils.isDefined(paramasDateTime)) {
            fields += ' paramasDateTime = ?,';
            fieldsParams.push(paramasDateTime);
        }
        if (DataUtils.isDefined(paramasError)) {
            fields += ' paramasError = ?,';
            fieldsParams.push(paramasError);
        }
        if (DataUtils.isDefined(paramasOtherDataName)) {
            fields += ' paramasOtherDataName = ?,';
            fieldsParams.push(paramasOtherDataName);
        }
        if (DataUtils.isDefined(paramasUser)) {
            fields += ' paramasUser = ?,';
            fieldsParams.push(paramasUser);
        }
        if (DataUtils.isDefined(paramasOtherData)) {
            fields += ' paramasOtherData = ?,';
            fieldsParams.push(paramasOtherData);
        }
        fieldsParams.push(id, languageCultureCode);
        try {////SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "LOCATION_REFERENCE_NOT_FOUND", MYSQL_ERRNO = 4001;
            var conn = await connection.getConnection();
            var query = 'IF (select 1 from NotificationReference where id = ? and languageCultureCode = ?) is null then ' +
              ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "NOTIFICATION_REFERENCE_ID_INVALID", MYSQL_ERRNO = 4001;' +
              ' ELSEIF (select 1 from NotificationReference where id = ? and languageCultureCode = ? and updatedAt = ?) is null then ' +
              ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "NOTIFICATION_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
              ' ELSE update NotificationReference set ' + fields + ' updatedAt=utc_timestamp(3) ' +
              ' where id = ? and languageCultureCode = ?;end IF;';
            /*var query = 'IF NOT EXISTS (select * from NotificationReference where id = ? and languageCultureCode = ?) ' +
              ' THEN SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "NOTIFICATION_REFERENCE_ID_INVALID",MYSQL_ERRNO = 4001; ' +
              ' ELSEIF NOT EXISTS (select * from NotificationReference where where id = ? and languageCultureCode = ? and updatedAt = ?) ' +
              ' THEN SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "NOTIFICATION_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED",MYSQL_ERRNO = 4002;' +
              ' ELSE update NotificationReference set ' + fields + ' updatedBy = uuid_to_bin(?), updatedAt = utc_timestamp(3) ' +
              ' where id = ? and languageCultureCode = ?;  end if';*/

            debug('query', query);
            debug('fieldsParams', fieldsParams);

            await conn.query(query, fieldsParams);
            AuditUtils.create(auditOptions);
            return cb(null, {OK: 'success'});

        } catch (err) {

            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            debug('err', err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_REFERENCE_ID_INVALID);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno === 4002) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno) {
                err = err || new Error(ErrorConfig.MESSAGE.NOTIFICATION_REFERENCE_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    removeMD: async function (options, auditOptions, errorOptions, cb) {

        var id = options.id;
        var languageCultureCode = options.languageCultureCode;
        var err;

        if (DataUtils.isUndefined(id)) {
            err = new Error(
              ErrorConfig.MESSAGE.NOTIFICATION_REFERENCE_ID_REQUIRED);
        }
        if (DataUtils.isUndefined(languageCultureCode)) {
            err = new Error(
              ErrorConfig.MESSAGE.LANGUAGE_CULTURE_CODE_REQUIRED);
        }
        if (Constants.VALID_LANGUAGE_CULTURE_CODE.indexOf(languageCultureCode) === -1) {
            err = new Error(ErrorConfig.MESSAGE.LANGUAGE_CULTURE_CODE_INVALID);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var query = 'IF NOT EXISTS (select * from NotificationReference where id = ? and languageCultureCode = ?) ' +
              'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "NOTIFICATION_REFERENCE_ID_INVALID";' +
              'ELSE update NotificationReference set active = 0 where id = ? and languageCultureCode = ?; end IF';
            var params = [id, languageCultureCode, id, languageCultureCode];

            var deleted = await conn.query(query, params);
            AuditUtils.create(auditOptions);
            return cb(null, {OK: 'success'});
        } catch (err) {

            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);

            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_REFERENCE_ID_INVALID);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.code) {
                err = err || new Error(ErrorConfig.MESSAGE.NOTIFICATION_REFERENCE_DELETE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    }
};

module.exports = NotificationReference;
