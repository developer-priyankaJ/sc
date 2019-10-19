/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.api.black_list');
var Async = require('async');
var Util = require('util');
var knex = require('../lib/knex_util');

var connection = require('../lib/connection_util');
var ErrorUtils = require('../lib/error_utils');
var Utils = require('../lib/utils');
var Constants = require('../data/constants');
var AuditUtils = require('../lib/audit_utils');
var DataUtils = require('../lib/data_utils');
var BlackListModel = require('../model/black_list');
var ErrorConfig = require('../data/error');
var _ = require('lodash');

var BlackList = {
    createBlackListMD: async function (options, errorOptions, cb) {
        var accountId = options.user.accountId;
        var email = options.email;
        var domain = options.domain;
        var subDomain = options.subDomain;
        var reasonCode = options.reasonCode;
        var restrictionType = options.restrictionType;
        var notes = options.notes;
        var createdAt = DataUtils.getEpochMSTimestamp();
        var updatedAt = createdAt;

        var blackListFields = '';
        var blackListRequiredValues = [];
        var blackListOptionalValues = [];
        var blackList;
        var err;

        if (DataUtils.isUndefined(email) && DataUtils.isUndefined(domain) && DataUtils.isUndefined(subDomain)) {
            err = new Error(ErrorConfig.MESSAGE.AT_LEAST_ONE_FIELD_IS_REQUIRED_FROM_EMAIL_DOMAIN_SUBDOMAIN);
        } else if (DataUtils.isDefined(email) && DataUtils.isDefined(domain) || DataUtils.isDefined(email) && DataUtils.isDefined(subDomain)) {
            err = new Error(ErrorConfig.MESSAGE.ONLY_ALLOW_EITHER_EMAIL_OR_DOMAIN_SUBDOMAIN);
        }

        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('error', err);
            return cb(err);
        }
        BlackList.validateOptionalFields(options, async function (err, response) {
            if (err) {
                debug('err', err);
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            blackListFields = response.blackListFields;
            blackListOptionalValues = response.blackListOptionalValues;
            if (email) {
                blackListRequiredValues.push(email, accountId);
            }
            if (domain && subDomain) {
                blackListRequiredValues.push(domain, subDomain, accountId);
            } else if (domain) {
                blackListRequiredValues.push(domain, accountId);
            } else if (subDomain) {
                blackListRequiredValues.push(subDomain, accountId);
            }

            blackListRequiredValues = _.concat(blackListRequiredValues, blackListOptionalValues);
            blackListRequiredValues.push(createdAt, updatedAt);

            try {
                var conn = await connection.getConnection();
                if (email) {
                    blackList = await conn.query('If (SELECT 1 FROM BlackList WHERE email=?) is null then ' +
                      'INSERT into BlackList set accountId = uuid_to_bin(?),'
                      + blackListFields + 'createdAt =?, updatedAt = ?;end if',
                      blackListRequiredValues);

                    blackList = Utils.isAffectedPool(blackList);

                    if (!blackList) {
                        err = new Error(ErrorConfig.MESSAGE.DUPLICATE_BLACK_LIST_EMAIL);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        await ErrorUtils.create(errorOptions, options, err);
                        return cb(err);
                    }
                }

                if (domain && subDomain) {
                    blackList = await conn.query('IF (select 1 from BlackList where domain=? or subDomain=?) is null then ' +
                      'INSERT into BlackList set accountId = uuid_to_bin(?),' + blackListFields + 'createdAt =?, updatedAt = ?;end if',
                      blackListRequiredValues);
                    blackList = Utils.isAffectedPool(blackList);
                    if (!blackList) {
                        err = new Error(ErrorConfig.MESSAGE.DUPLICATE_BLACK_LIST_DOMAIN_SUB_DOMAIN);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        await ErrorUtils.create(errorOptions, options, err);
                        return cb(err);
                    }
                } else if (domain) {
                    blackList = await conn.query('If (SELECT 1 FROM BlackList WHERE domain=?) is null then ' +
                      'INSERT into BlackList set accountId = uuid_to_bin(?),'
                      + blackListFields + 'createdAt =?, updatedAt = ?;end if',
                      blackListRequiredValues);

                    blackList = Utils.isAffectedPool(blackList);

                    if (!blackList) {
                        err = new Error(ErrorConfig.MESSAGE.DUPLICATE_BLACK_LIST_DOMAIN);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        await ErrorUtils.create(errorOptions, options, err);
                        return cb(err);
                    }
                } else if (subDomain) {
                    blackList = await conn.query('If (SELECT 1 FROM BlackList WHERE subDomain=?) is null then ' +
                      'INSERT into BlackList set accountId = uuid_to_bin(?),'
                      + blackListFields + 'createdAt =?, updatedAt = ?;end if',
                      blackListRequiredValues);

                    blackList = Utils.isAffectedPool(blackList);

                    if (!blackList) {
                        err = new Error(ErrorConfig.MESSAGE.DUPLICATE_BLACK_LIST_SUB_DOMAIN);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        await ErrorUtils.create(errorOptions, options, err);
                        return cb(err);
                    }
                }
                return cb(null, {OK: Constants.SUCCESS, createdAt: createdAt});
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.BLACKLIST_CREATED_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
        });
    },

    updateMD: async function (options, errorOptions, cb) {
        var id = options.id;
        var accountId = options.user.accountId;
        var email = options.email;
        var domain = options.domain;
        var subDomain = options.subDomain;
        var reasonCode = options.reasonCode;
        var restrictionType = options.restrictionType;
        var notes = options.notes;
        var updatedAt = DataUtils.getEpochMSTimestamp();

        var blackListFields = '';
        var blackListRequiredValues = [];
        var blackListOptionalValues = [];
        var blackList;
        var err;

        if (DataUtils.isUndefined(id)) {
            err = new Error(ErrorConfig.MESSAGE.BLACK_LIST_ID_REQ);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('error', err);
            return cb(err);
        }
        BlackList.validateOptionalFields(options, async function (err, response) {
            if (err) {
                debug('err', err);
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            blackListFields = response.blackListFields;
            blackListOptionalValues = response.blackListOptionalValues;
            blackListRequiredValues.push(id);
            blackListRequiredValues = _.concat(blackListRequiredValues, blackListOptionalValues);
            blackListRequiredValues.push(updatedAt, id);

            try {
                var conn = await connection.getConnection();
                var blackList = await conn.query('IF (select 1 from BlackList where id=?) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "BLACK_LIST_RECORD_NOT_FOUND", MYSQL_ERRNO = 4001;' +
                  'ELSE update BlackList set ' + blackListFields + ' updatedAt = ? ' +
                  'where id=?;end if;', blackListRequiredValues);

                blackList.isAffected = Utils.isAffectedPool(blackList);

                return cb(null, {OK: Constants.SUCCESS, updatedAt: updatedAt});
            } catch (err) {
                debug('err', err);
                await ErrorUtils.create(errorOptions, options, err);
                if (err.code == '4001') {
                    err = new Error(ErrorConfig.MESSAGE.BLACK_LIST_RECORD_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return cb(err);
                }
                err = new Error(ErrorConfig.MESSAGE.BLACKLIST_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
        });
    },

    checkBlackListMD: async function (options, errorOptions, cb) {

        var blackList;
        var email = options.email;
        var domain = (options.email).split('@');
        domain = domain[1];
        var tempSubDomain = domain.split('.');
        if (tempSubDomain.length > 2) {
            var subDomain = domain;
            domain = tempSubDomain.slice(-2);
            domain = domain.join('.');

            var allSubDomain = '*.' + domain;
        }


        try {
            var conn = await connection.getConnection();
            if (domain) {
                await conn.query('IF (SELECT 1 FROM BlackList WHERE domain=?) is not null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "DOMAIN_IS_IN_BLACKLIST", MYSQL_ERRNO = 4002;' +
                  'end if;', [domain]);
            }
            if (subDomain) {
                await conn.query('IF (SELECT 1 FROM BlackList WHERE subDomain=?) is not null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "SUB_DOMAIN_IS_IN_BLACKLIST", MYSQL_ERRNO = 4003;' +
                  'end if;', [subDomain]);
            }
            if (allSubDomain) {
                await conn.query('IF (SELECT 1 FROM BlackList WHERE subDomain=?) is not null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "ALL_SUB_DOMAIN_IS_IN_BLACKLIST", MYSQL_ERRNO = 4004;' +
                  'end if;', [allSubDomain]);
            }
            if (email) {
                await conn.query('IF (SELECT 1 FROM BlackList WHERE email=?) is not null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "EMAIL_IS_IN_BLACKLIST", MYSQL_ERRNO = 4001;' +
                  'end if;', [email]);
            }
            return cb(null, {OK: Constants.SUCCESS});
        } catch (err) {
            debug('err', err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.EMAIL_IS_IN_BLACKLIST);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                return cb(err);
            } else if (err.errno === 4002) {
                err = new Error(ErrorConfig.MESSAGE.DOMAIN_IS_IN_BLACKLIST);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                return cb(err);
            } else if (err.errno === 4003) {
                err = new Error(ErrorConfig.MESSAGE.SUB_DOMAIN_IS_IN_BLACKLIST);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                return cb(err);
            } else if (err.errno === 4004) {
                err = new Error(ErrorConfig.MESSAGE.ALL_SUB_DOMAIN_IS_IN_BLACKLIST);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                return cb(err);
            }
            err = new Error(ErrorConfig.MESSAGE.CHECK_BLACKLIST_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },
    validateBlackListMD: async function (options, errorOptions, cb) {

        var blackList = options.blackList;
        var err;
        if (blackList) {
            err = new Error(ErrorConfig.MESSAGE.EMAIL_IS_IN_BLACKLIST);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
        return cb(null, {OK: Constants.SUCCESS});
    },

    validateOptionalFields: async function (options, cb) {
        var blackListFields = '';
        var blackListOptionalValues = [];
        var err;

        try {
            if (!DataUtils.isValidateOptionalField(options.email)) {
                if (!DataUtils.isString(options.email)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_MP_ID_MUST_BE_STRING);
                } else if (options.email.length > 254) {
                    throw err = new Error(ErrorConfig.MESSAGE.EMAIL_MUST_BE_LESS_THAN_254_CHARACTER);
                } else {
                    blackListFields += 'email=? ,';
                    blackListOptionalValues.push(options.email);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.domain)) {
                if (!DataUtils.isString(options.domain)) {
                    throw err = new Error(ErrorConfig.MESSAGE.DOMAIN_MUST_BE_STRING);
                } else if (options.domain.length > 254) {
                    throw err = new Error(ErrorConfig.MESSAGE.DOMAIN_MUST_BE_LESS_THAN_254_CHARACTER);
                }
                else {
                    blackListFields += 'domain=? ,';
                    blackListOptionalValues.push(options.domain);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.subDomain)) {
                if (!DataUtils.isString(options.subDomain)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUB_DOMAIN_MUST_BE_STRING);
                } else if (options.subDomain.length > 254) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUB_DOMAIN_MUST_BE_LESS_THAN_254_CHARACTER);
                }
                else {
                    blackListFields += 'subDomain=? ,';
                    blackListOptionalValues.push(options.subDomain);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.reasonCode)) {
                if (!DataUtils.isString(options.reasonCode)) {
                    throw err = new Error(ErrorConfig.MESSAGE.REASON_CODE_MUST_BE_STRING);
                } else if (options.reasonCode.length > 60) {
                    throw err = new Error(ErrorConfig.MESSAGE.REASON_CODE_MUST_BE_LESS_THAN_60_CHARACTER);
                }
                else {
                    blackListFields += 'reasonCode=? ,';
                    blackListOptionalValues.push(options.reasonCode);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.restrictionType)) {
                if (!DataUtils.isString(options.restrictionType)) {
                    throw err = new Error(ErrorConfig.MESSAGE.RESTRICTION_TYPE_MUST_BE_STRING);
                } else if (options.restrictionType.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.RESTRICTION_TYPE_MUST_BE_LESS_THAN_30_CHARACTER);
                }
                else {
                    blackListFields += 'restrictionType=? ,';
                    blackListOptionalValues.push(options.restrictionType);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.notes)) {
                if (!DataUtils.isString(options.notes)) {
                    throw err = new Error(ErrorConfig.MESSAGE.NOTES_MUST_BE_STRING);
                } else if (options.notes.length > 254) {
                    throw err = new Error(ErrorConfig.MESSAGE.NOTES_MUST_BE_LESS_THAN_120_CHARACTER);
                }
                else {
                    blackListFields += 'notes=? ,';
                    blackListOptionalValues.push(options.notes);
                }
            }
            var response = {
                blackListFields: blackListFields,
                blackListOptionalValues: blackListOptionalValues
            };
            return cb(null, response);
        } catch (err) {
            debug('err', err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
    },

    getAllBlackListMD: async function (cb) {
        try {
            var conn = await connection.getConnection();
            var getBlackList = await conn.query('SELECT *, CAST(uuid_from_bin(accountId) as char) as accountId from BlackList');

            return cb(null, getBlackList);
        } catch (err) {
            err = new Error(ErrorConfig.MESSAGE.BLACK_LIST_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }

    },

    removeBlackListMD: async function (options, auditOptions, errorOptions, cb) {
        var err;

        if (DataUtils.isUndefined(options.blackListId)) {
            err = new Error(ErrorConfig.MESSAGE.BLACK_LIST_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
        try {
            var conn = await connection.getConnection();
            var isDeleted = await conn.query('IF NOT EXISTS(SELECT 1 from BlackList where id = ?)' +
              'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "BLACK_LIST_RECORD_NOT_FOUND";' +
              'ELSE DELETE from BlackList where id = ?; end IF', [options.blackListId, options.blackListId]);

            if (!Utils.isAffectedPool(isDeleted)) {
                err = new Error(ErrorConfig.MESSAGE.BLACK_LIST_RECORD_DELETE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            AuditUtils.create(auditOptions);
            return cb(null, {OK: 'success'});

        } catch (err) {
            await ErrorUtils.create(errorOptions, options, err);
            if (err.errno == '4001') {
                err = new Error(ErrorConfig.MESSAGE.BLACK_LIST_RECORD_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            err = new Error(ErrorConfig.MESSAGE.BLACK_LIST_RECORD_DELETE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    }
};

module.exports = BlackList;
