/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.api.cron_job');
var _ = require('lodash');
var Util = require('util');

var connection = require('../lib/connection_util');
var DataUtils = require('../lib/data_utils');
var Constants = require('../data/constants');
var ErrorConfig = require('../data/error');
var AuditUtils = require('../lib/audit_utils');
var CronJobModel = require('../model/cron_job');
var knex = require('../lib/knex_util');
var ErrorUtils = require('../lib/error_utils');
var Utils = require('../lib/utils');

var CronJob = {

    getCronJob: async function (options, cb) {
        var name = options.name;
        if (DataUtils.isUndefined(name)) {
            var err = new Error(ErrorConfig.MESSAGE.CRON_JOB_NAME_REQ);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('error', err);
            return cb(err);
        }
        try {
            var conn = await connection.getConnection();
            var cronjob = await conn.query('select * from CronJob where name=?', name);
            cronjob = Utils.filteredResponsePool(cronjob);
            return cb(null, cronjob);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.CRON_JOB_NOT_FOUND);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
    },

    /*
    * Get cron job from name
    * */
    getCronJobMD: function (options) {
        return new Promise(async function (resolve, reject) {
            var name = options.name;
            if (DataUtils.isUndefined(name)) {
                var err = new Error(ErrorConfig.MESSAGE.CRON_JOB_NAME_REQ);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug('error', err);
                return reject(err);
            }
            try {
                var conn = await connection.getConnection();
                var cronjob = await conn.query('select * from CronJob where name=?', name);
                cronjob = Utils.filteredResponsePool(cronjob);
                return resolve(cronjob);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.CRON_JOB_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return reject(err);
            }
        });
    },

    /*
    * Create cron job record
    * */
    createCronJob: function (options) {
        return new Promise(async function (resolve, reject) {
            var startTime = options.startTime;
            var status = options.status;
            var name = options.name;
            var err;

            try {
                var conn = await connection.getConnection();
                startTime = new Date(startTime);
                var cronjob = await conn.query('IF (select 1 from CronJob where name=?) is null then ' +
                  'insert into CronJob set startTime=?, status=?, name=?;END IF;', [name, startTime, status, name]);
                debug('cronjob from cron job', cronjob);
                cronjob = Utils.isAffectedPool(cronjob);

                if (!cronjob) {
                    throw err;
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.CRON_JOB_CREATION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    validateOptionalFields: function (options, cb) {
        var err;
        var cronJobFields = '';
        var cronJobOptionalValues = [];

        if (!DataUtils.isValidateOptionalField(options.startTime)) {
            cronJobFields += 'startTime=? ,';
            cronJobOptionalValues.push(new Date(options.startTime));
        }
        if (!DataUtils.isValidateOptionalField(options.endTime)) {
            cronJobFields += 'endTime=? ,';
            cronJobOptionalValues.push(new Date(options.endTime));
        }
        var response = {
            cronJobFields: cronJobFields,
            cronJobOptionalValues: cronJobOptionalValues
        };
        return cb(null, response);
    },

    /*
    * Update cron job record with start time
    * */
    updateCronJob: async function (options) {
        return new Promise(function (resolve, reject) {
            var startTime = options.startTime;
            var status = options.status;
            var name = options.name;
            var cronJobFields = '';
            var cronJobOptionalValues = [];
            var cronJobRequiredValues = [];
            var err;

            try {
                cronJobRequiredValues.push(name);
                CronJob.validateOptionalFields(options, async function (err, response) {
                    if (err) {
                        debug('err', err);
                        return reject(err);
                    }
                    cronJobFields = response.cronJobFields;
                    cronJobOptionalValues = response.cronJobOptionalValues;

                    cronJobRequiredValues = _.concat(cronJobRequiredValues, cronJobOptionalValues);
                    cronJobRequiredValues.push(status, name);
                    var conn = await connection.getConnection();
                    var cronjob = await conn.query('IF (select 1 from CronJob where name=?) is not null then ' +
                      'update CronJob set ' + cronJobFields + ' status=? where name=? ;END IF;', cronJobRequiredValues);
                    debug('cron job', cronjob);
                    cronjob = Utils.isAffectedPool(cronjob);
                   /* if (!cronjob) {
                        debug('err from file', err);
                        throw err;
                    }*/
                    return resolve(Constants.OK_MESSAGE);
                });
            } catch (err) {
                debug('err--', err);
                err = new Error(ErrorConfig.MESSAGE.CRON_JOB_UPDATION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });

    },

    /*
    * Get latest replication
    * */
    getNewReplicationMD: function (cb) {
        return new Promise(async function (resolve, reject) {
            var currentDate = DataUtils.getEpochMSTimestamp();
            var defaultEndDate = Constants.REPLICATION_END_DATE;
            var err;

            try {
                var conn = await connection.getConnection();
                var replication = await conn.query('select CAST(uuid_from_bin(RS.id) as CHAR) as id ,CAST(uuid_from_bin(RS.accountId) as CHAR) as accountId, RS.mpId, ' +
                  'RS.types, RS.orderTimeInterval, RS.createdAfter, RS.startDate, RS.numberOfRecords, RS.nextReplicationTime, RS.status, ' +
                  'RS.updatedAt from ReplicationSetting RS , Marketplaces MP where ' +
                  '(UNIX_TIMESTAMP((from_unixtime(RS.nextReplicationTime/1000) + INTERVAL 2 MINUTE))*1000) <= ? ' +
                  'and RS.mpId = MP.mpId and (RS.endDate = ? OR RS.endDate >= ?) AND RS.startDate <= ? AND RS.status != 3 AND RS.status != 2;',
                  [currentDate, defaultEndDate, currentDate, currentDate]);
                if (!replication) {
                    return resolve([]);
                }
                return resolve(replication);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.REPLICATION_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }

        });
    }

};

module.exports = CronJob;
