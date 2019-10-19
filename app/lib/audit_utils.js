'use strict';

var debug = require('debug')('scopehub.lib.audit_utils');
var Util = require('util');

var connection = require('../lib/connection_util');
var DataUtils = require('../lib/data_utils');
var ErrorUtils = require('../lib/error_utils');
var Constants = require('../data/constants');
var AuditModel = require('../model/audit_log');
var ErrorConfig = require('../data/error');
//var knexfile = require('../knexfile');
//var knex = require('knex')(knexfile);
var Utils = require('./utils');

var noop = function () {
}; //

var AuditUtils = {
    create: async function (options, cb) {
        cb = cb || noop;
        var err;
        var userAgent = options.userAgent;
        var auditOptions = '';
        var auditValues = [];


        if (DataUtils.isDefined(options.userId)) {
            auditOptions += 'userId=uuid_to_bin(?) ,';
            auditValues.push(options.userId);
        }
        if (DataUtils.isDefined(options.accountId)) {
            auditOptions += 'accountId=uuid_to_bin(?) ,';
            auditValues.push(options.accountId);
        }
        if (DataUtils.isDefined(options.eventId.toString())) {
            auditOptions += 'eventId=? ,';
            auditValues.push(options.eventId);
        }
        if (DataUtils.isDefined(options.ipAddress)) {
            auditOptions += 'ipAddress=? ,';
            auditValues.push(options.ipAddress);
        }
        if (DataUtils.isDefined(options.localDeviceTimezone)) {
            auditOptions += 'localDeviceTimezone=? ,';
            auditValues.push(options.localDeviceTimezone);
        }
        if (DataUtils.isDefined(options.localDeviceDateTime)) {
            auditOptions += 'localDeviceDateTime=? ,';
            auditValues.push(options.localDeviceDateTime);
        }
        if (DataUtils.isDefined(options.languageCultureCode)) {
            auditOptions += 'languageCultureCode=? ,';
            auditValues.push(options.languageCultureCode);
        }
        if (options.metaData) {
            auditOptions += 'metaData=? ,';
            auditValues.push(JSON.stringify(options.metaData));
        }

        Object.keys(userAgent).forEach(function (key) {
            var value = userAgent[key];
            var type = typeof(value);
            if ((type === 'string' || type === 'boolean') && value) {
                auditOptions += key + '=? ,';
                auditValues.push(value);
                //opt[key] = value;
            } else if (type === 'object' && Object.keys(value).length > 0) {
                auditOptions += key + '=? ,';
                auditValues.push(value);
                //opt[key] = value;
            }
        });

        try {
            var conn = await connection.getConnection();
            var auditLog = await conn.query('insert into AuditLog set ' + auditOptions + ' createdAt=utc_timestamp(3)', auditValues);
            auditLog = Utils.isAffectedPool(auditLog);

            if (!auditLog) {
                err = new Error(ErrorConfig.MESSAGE.AUDIT_LOG_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            return cb();
        } catch (err) {
            Util.log(err);
            return cb(err);
        }
        /*AuditModel.create(opt, function (err, data) {
            if (err) {
                Util.log(err);
                return cb(err);
            }
            return cb();
        });*/
    }
};

module.exports = AuditUtils;

(function () {
    if (require.main === module) {

    }
}());
