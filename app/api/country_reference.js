/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.api.country_reference');
var _ = require('lodash');
var Util = require('util');
var Promise = require('bluebird');

var DataUtils = require('../lib/data_utils');
var Constants = require('../data/constants');
var ErrorConfig = require('../data/error');
var CountryReferenceModel = require('../model/country_reference');
var AuditUtils = require('../lib/audit_utils');
var connection = require('../lib/connection_util');
var Utils = require('../lib/utils');
var ErrorUtils = require('../lib/error_utils');


var CountryReference = {

    validateOptionalFields: async function (options, cb) {
        var countryRefFields = '';
        var countryRefOptionalValues = [];
        var err;

        try {
            if (!DataUtils.isValidateOptionalField(options.countryCode)) {
                if (!DataUtils.isString(options.countryCode)) {
                    throw err = new Error(ErrorConfig.MESSAGE.COUNTRY_REFERENCE_COUNTRY_CODE_MUST_BE_STRING);
                } else if (options.countryCode.length > 2) {
                    throw err = new Error(ErrorConfig.MESSAGE.COUNTRY_REFERENCE_COUNTRY_CODE_MUST_BE_LESS_THAN_2_CHARACTER);
                } else {
                    countryRefFields += 'countryCode=? ,';
                    countryRefOptionalValues.push(options.countryCode);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.countryName)) {
                if (!DataUtils.isString(options.countryName)) {
                    throw err = new Error(ErrorConfig.MESSAGE.COUNTRY_REFERENCE_COUNTRY_NAME_MUST_BE_STRING);
                } else if (options.countryName.length > 60) {
                    throw err = new Error(ErrorConfig.MESSAGE.COUNTRY_REFERENCE_COUNTRY_NAME_MUST_BE_LESS_THAN_60_CHARACTER);
                }
                else {
                    countryRefFields += 'countryName=? ,';
                    countryRefOptionalValues.push(options.countryName);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.currencyCode)) {
                if (!DataUtils.isString(options.currencyCode)) {
                    throw err = new Error(ErrorConfig.MESSAGE.COUNTRY_REFERENCE_CURRENCY_CODE_MUST_BE_STRING);
                } else if (options.currencyCode.length > 3) {
                    throw err = new Error(ErrorConfig.MESSAGE.COUNTRY_REFERENCE_CURRENCY_CODE_MUST_BE_LESS_THAN_3_CHARACTER);
                }
                else {
                    countryRefFields += 'currencyCode=? ,';
                    countryRefOptionalValues.push(options.currencyCode);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.currencyName)) {
                if (!DataUtils.isString(options.currencyName)) {
                    throw err = new Error(ErrorConfig.MESSAGE.COUNTRY_REFERENCE_CURRENCY_NAME_MUST_BE_STRING);
                } else if (options.currencyName.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.COUNTRY_REFERENCE_CURRENCY_NAME_MUST_BE_LESS_THAN_30_CHARACTER);
                }
                else {
                    countryRefFields += 'currencyName=? ,';
                    countryRefOptionalValues.push(options.currencyName);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.languageCulturalCode)) {
                if (!DataUtils.isString(options.languageCulturalCode)) {
                    throw err = new Error(ErrorConfig.MESSAGE.COUNTRY_REFERENCE_LANGUAGE_CULTURAL_CODE_MUST_BE_STRING);
                } else if (options.languageCulturalCode.length > 8) {
                    throw err = new Error(ErrorConfig.MESSAGE.COUNTRY_REFERENCE_LANGUAGE_CULTURAL_CODE_MUST_BE_LESS_THAN_8_CHARACTER);
                }
                else {
                    countryRefFields += 'languageCulturalCode=? ,';
                    countryRefOptionalValues.push(options.languageCulturalCode);
                }
            }

            var response = {
                countryRefFields: countryRefFields,
                countryRefOptionalValues: countryRefOptionalValues
            };
            return cb(null, response);
        } catch (err) {
            debug('err', err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
    },

    createMD: async function (options, auditOptions, errorOptions, cb) {
        var countryCode = options.countryCode;
        var countryName = options.countryName;
        var currencyCode = options.currencyCode;
        var currencyName = options.currencyName;
        var languageCulturalCode = options.languageCulturalCode;
        var createdBy = options.user.id;
        var countryRefFields = '';
        var countryRefRequiredValues = [];
        var countryRefOptionalValues = [];
        var createdAt = DataUtils.getEpochMSTimestamp();
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var err;
        if (DataUtils.isValidateOptionalField(countryCode)) {
            err = new Error(ErrorConfig.MESSAGE.COUNTRY_REFERENCE_COUNTRY_CODE_REQUIRED);
        } else if (DataUtils.isValidateOptionalField(countryName)) {
            err = new Error(ErrorConfig.MESSAGE.COUNTRY_REFERENCE_COUNTRY_NAME_REQUIRED);
        } else if (DataUtils.isValidateOptionalField(currencyCode)) {
            err = new Error(ErrorConfig.MESSAGE.COUNTRY_REFERENCE_CURRENCY_CODE_REQUIRED);
        } else if (DataUtils.isValidateOptionalField(currencyName)) {
            err = new Error(ErrorConfig.MESSAGE.COUNTRY_REFERENCE_CURRENCY_NAME_REQUIRED);
        } else if (DataUtils.isValidateOptionalField(languageCulturalCode)) {
            err = new Error(ErrorConfig.MESSAGE.COUNTRY_REFERENCE_LANGUAGE_CULTURAL_CODE_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug(err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
        countryRefRequiredValues.push(countryCode, languageCulturalCode);
        CountryReference.validateOptionalFields(options, async function (err, response) {
            if (err) {
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }

            countryRefFields = response.countryRefFields;
            countryRefOptionalValues = response.countryRefOptionalValues;

            countryRefRequiredValues = _.concat(countryRefRequiredValues, countryRefOptionalValues);
            countryRefRequiredValues.push(createdAt, updatedAt, createdBy);

            try {
                var conn = await connection.getConnection();
                var countryRef = await conn.query('If (SELECT 1 FROM CountryReference WHERE countryCode=? and languageCulturalCode=?) is null then ' +
                  'INSERT into CountryReference set ' + countryRefFields +
                  'createdAt = ?, updatedAt = ?,createdBy=uuid_to_bin(?);end if',
                  countryRefRequiredValues);

                var isAffected = Utils.isAffectedPool(countryRef);

                if (!isAffected) {
                    err = new Error(ErrorConfig.MESSAGE.DUPLICATE_COUNTRY);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
                AuditUtils.create(auditOptions);
                return cb(null, {
                    OK: Constants.SUCCESS,
                    createdAt: createdAt
                });
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.COUNTRY_REFERENCE_CREATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
        });
    },

    getCountryReferenceMD: async function (options, errorOptions, cb) {
        var id = options.id;
        if (DataUtils.isUndefined(id)) {
            var err = new Error(ErrorConfig.MESSAGE.COUNTRY_REFERENCE_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('error', err);
            return cb(err);
        }
        try {
            var conn = await connection.getConnection();
            var countryRef = await conn.query('select countryCode, countryName, currencyCode, currencyName,' +
              ' languageCulturalCode,updatedAt from CountryReference where id=?', id);
            countryRef = Utils.filteredResponsePool(countryRef);
            if (!countryRef) {
                err = new Error(ErrorConfig.MESSAGE.COUNTRY_REFERENCE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            return cb(null, countryRef);
        } catch (err) {
            err = new Error(ErrorConfig.MESSAGE.COUNTRY_REFERENCE_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    getAllMD: async function (errorOptions, cb) {
        try {
            var conn = await connection.getConnection();
            var countryRefs = await conn.query('select id,countryCode, countryName, currencyCode, currencyName,languageCulturalCode,updatedAt from CountryReference');

            debug('countryRefs', countryRefs);
            return cb(null, countryRefs);
        } catch (err) {
            err = new Error(ErrorConfig.MESSAGE.COUNTRY_REFERENCE_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, err);
            return cb(err);
        }
    },

    updateMD: async function (options, auditOptions, errorOptions, cb) {
        var updatedAt = options.updatedAt;
        var id = options.id;
        var updatedBy = options.user.id;
        var countryRefFields = '';
        var countryRefRequiredValues = [];
        var countryRefOptionalValues = [];
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();
        var err;
        if (DataUtils.isValidateOptionalField(id)) {
            err = new Error(ErrorConfig.MESSAGE.COUNTRY_REFERENCE_ID_REQUIRED);
        } else if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.COUNTRY_REFERENCE_UPDATED_AT_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug(err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        countryRefRequiredValues.push(id, id, updatedAt);

        CountryReference.validateOptionalFields(options, async function (err, response) {
            if (err) {
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            countryRefFields = response.countryRefFields;
            countryRefOptionalValues = response.countryRefOptionalValues;

            if (countryRefOptionalValues.length === 0) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_REQUEST);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug('err', err);
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            countryRefRequiredValues = _.concat(countryRefRequiredValues, countryRefOptionalValues);
            countryRefRequiredValues.push(newUpdatedAt, updatedBy, id);

            try {
                var conn = await connection.getConnection();
                var countryRef = await conn.query('IF (select 1 from CountryReference where id=?) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "COUNTRY_REFERENCE_NOT_FOUND", MYSQL_ERRNO = 4001;' +
                  'ELSEIF (select 1 from CountryReference where id=? and updatedAt=?) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "COUNTRY_REFERENCE_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
                  'ELSE update CountryReference set ' + countryRefFields + ' updatedAt = ?,updatedBy=uuid_to_bin(?) ' +
                  'where id = ?;end if;', countryRefRequiredValues);

                debug('countryRef', countryRef);
                var isAffected = Utils.isAffectedPool(countryRef);

                if (!isAffected) {
                    err = new Error(ErrorConfig.MESSAGE.COUNTRY_REFERENCE_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
                AuditUtils.create(auditOptions);
                return cb(null, {
                    OK: Constants.SUCCESS,
                    updatedAt: newUpdatedAt
                });
            } catch (err) {
                debug('err', err);
                await ErrorUtils.create(errorOptions, options, err);
                if (err.errno === 4001) {
                    err = new Error(ErrorConfig.MESSAGE.COUNTRY_REFERENCE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return cb(err);
                } else if (err.errno === 4002) {
                    err = new Error(ErrorConfig.MESSAGE.COUNTRY_REFERENCE_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    return cb(err);
                } else {
                    err = new Error(ErrorConfig.MESSAGE.COUNTRY_REFERENCE_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return cb(err);
                }
            }
        });
    },

    removeMD: async function (options, auditOptions, errorOptions, cb) {
        var id = options.id;
        var err;
        if (DataUtils.isValidateOptionalField(id)) {
            err = new Error(ErrorConfig.MESSAGE.COUNTRY_REFERENCE_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug(err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var countryRef = await conn.query('IF (select 1 from CountryReference where id=?) is null then ' +
              'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "COUNTRY_REFERENCE_NOT_FOUND", MYSQL_ERRNO = 4001;' +
              'ELSE DELETE from CountryReference where id = ?;end if;', [id, id]);

            var isAffected = Utils.isAffectedPool(countryRef);

            if (!isAffected) {
                err = new Error(ErrorConfig.MESSAGE.COUNTRY_REFERENCE_REMOVE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            AuditUtils.create(auditOptions);
            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            await ErrorUtils.create(errorOptions, options, err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.COUNTRY_REFERENCE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            } else {
                err = new Error(ErrorConfig.MESSAGE.COUNTRY_REFERENCE_REMOVE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
        }
    }
};

module.exports = CountryReference;
