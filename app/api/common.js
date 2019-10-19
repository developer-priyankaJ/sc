#!/usr/bin/env node

'use strict';

var _ = require('lodash');
var request = require('request-promise');

var debug = require('debug')('scopehub.api.common');
var reCaptchaConfig = require('../config/recaptcha');
var endpointConfig = require('../config/endpoints');
var ErrorConfig = require('../data/error');
var DataUtils = require('../lib/data_utils');
var ErrorUtils = require('../lib/error_utils');
var Utils = require('../lib/utils');
var Promise = require('bluebird');
var Constants = require('../data/constants');
var knex = require('../lib/knex_util');
var Async = require('async');
var changeCase = require('change-case');

var connection = require('../lib/connection_util');

var Common = {

    startTransaction: async function () {
        try {
            var conn = await connection.getConnection();
            await conn.query('START TRANSACTION;');
        } catch (err) {
            debug('err', err);
        }
    },

    rollback: async function () {
        try {
            var conn = await connection.getConnection();
            await conn.query('ROLLBACK;');
        } catch (err) {
            debug('err', err);
        }
    },

    commit: async function () {
        try {
            var conn = await connection.getConnection();
            await conn.query('COMMIT;');
        } catch (err) {
            debug('err', err);
        }
    },

    checkInvalidField: async function (options, cb) {
        var body = options.body;
        var tableFields = options.fields;
        var fieldKeys = [];
        fieldKeys = Object.keys(body);
        var err;
        try {
            await Promise.each(fieldKeys, async function (value) {
                if (tableFields.indexOf(value) === -1) {
                    debug('value', value);
                    err = new Error(ErrorConfig.MESSAGE.INVALID_REQUEST);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    throw err;
                }
            });
            return cb();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
    },

    validateLocRefOptionalFields: async function (options, cb) {
        var locationRefFields = '';
        var locationRefOptionalValues = [];
        var err;

        try {
            /*if (!DataUtils.isValidateOptionalField(options.companyName)) {
                if (!DataUtils.isString(options.companyName)) {
                    throw err = new Error(ErrorConfig.MESSAGE.COMPANY_NAME_MUST_BE_STRING);
                }
                else if (options.companyName.length > 120) {
                    throw err = new Error(ErrorConfig.MESSAGE.COMPANY_NAME_MUST_BE_LESS_THAN_120_CHARACTER);
                }
                else {
                    accountFields += 'companyName=? ,';
                    accountOptionalValues.push(options.companyName);
                }
            }*/
            if (!DataUtils.isValidateOptionalField(options.addressLine1)) {
                if (!DataUtils.isString(options.addressLine1)) {
                    throw err = new Error(ErrorConfig.MESSAGE.ADDRESS_LINE_1_MUST_BE_STRING);
                } else if (options.addressLine1.length > 60) {
                    throw err = new Error(ErrorConfig.MESSAGE.ADDRESS_LINE_1_MUST_BE_LESS_THAN_60_CHARACTER);
                } else {
                    locationRefFields += 'addressLine1=? ,';
                    locationRefOptionalValues.push(options.addressLine1);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.addressLine2)) {
                if (!DataUtils.isString(options.addressLine2)) {
                    throw err = new Error(ErrorConfig.MESSAGE.ADDRESS_LINE_2_MUST_BE_STRING);
                } else if (options.addressLine2.length > 60) {
                    throw err = new Error(ErrorConfig.MESSAGE.ADDRESS_LINE_2_MUST_BE_LESS_THAN_60_CHARACTER);
                } else {
                    locationRefFields += 'addressLine2=? ,';
                    locationRefOptionalValues.push(options.addressLine2);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.addressLine3)) {
                if (!DataUtils.isString(options.addressLine3)) {
                    throw err = new Error(ErrorConfig.MESSAGE.ADDRESS_LINE_3_MUST_BE_STRING);
                } else if (options.addressLine3.length > 60) {
                    throw err = new Error(ErrorConfig.MESSAGE.ADDRESS_LINE_3_MUST_BE_LESS_THAN_60_CHARACTER);
                } else {
                    locationRefFields += 'addressLine3=? ,';
                    locationRefOptionalValues.push(options.addressLine3);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.dialCode)) {
                if (!DataUtils.isString(options.dialCode)) {
                    throw err = new Error(ErrorConfig.MESSAGE.DIAL_CODE_MUST_BE_STRING);
                } else if (options.dialCode.toString().length > 5) {
                    throw err = new Error(ErrorConfig.MESSAGE.DIAL_CODE_MUST_BE_LESS_THAN_5_CHARACTER);
                } else {
                    locationRefFields += 'dialCode=? ,';
                    locationRefOptionalValues.push(options.dialCode);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.phoneCountry)) {
                if (!DataUtils.isString(options.phoneCountry)) {
                    throw err = new Error(ErrorConfig.MESSAGE.COUNTRY_MUST_BE_STRING);
                } else if (options.phoneCountry.toString().length > 2) {
                    throw err = new Error(ErrorConfig.MESSAGE.COUNTRY_MUST_BE_LESS_THAN_2_CHARACTER);
                } else {
                    locationRefFields += 'phoneCountry=? ,';
                    locationRefOptionalValues.push(options.phoneCountry);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.phone)) {
                if (!DataUtils.isMobile(options.phone)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PHONE_1_MUST_BE_VALID_NUMBER);
                } else if (options.phone.toString().length > 15) {
                    throw err = new Error(ErrorConfig.MESSAGE.PHONE_1_MUST_BE_LESS_THAN_15_CHARACTER);
                } else {
                    locationRefFields += 'phone=? ,';
                    locationRefOptionalValues.push(options.dialCode.concat(options.phone));
                }
            }

            if (!DataUtils.isValidateOptionalField(options.primaryMobileDialCode)) {
                if (!DataUtils.isString(options.primaryMobileDialCode)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_DIAL_CODE_MUST_BE_STRING);
                } else if (options.primaryMobileDialCode.toString().length > 5) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_DIAL_CODE_MUST_BE_LESS_THAN_5_CHARACTER);
                } else {
                    locationRefFields += 'primaryMobileDialCode=? ,';
                    locationRefOptionalValues.push(options.primaryMobileDialCode);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.primaryMobileCountry)) {
                if (!DataUtils.isString(options.primaryMobileCountry)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_COUNTRY_MUST_BE_STRING);
                } else if (options.primaryMobileCountry.toString().length > 2) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_COUNTRY_MUST_BE_LESS_THAN_2_CHARACTER);
                } else {
                    locationRefFields += 'primaryMobileCountry=? ,';
                    locationRefOptionalValues.push(options.primaryMobileCountry);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.primaryMobile)) {
                if (!DataUtils.isMobile(options.primaryMobile)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_MUST_BE_VALID_NUMBER);
                } else if (options.primaryMobile.toString().length > 15) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_MUST_BE_LESS_THAN_OF_15_DIGIT);
                } else {
                    locationRefFields += 'primaryMobile=? ,';
                    locationRefOptionalValues.push(options.primaryMobileDialCode.concat(options.primaryMobile));
                }
            }

            if (!DataUtils.isValidateOptionalField(options.secondaryMobileDialCode)) {
                if (!DataUtils.isString(options.secondaryMobileDialCode)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_DIAL_CODE_MUST_BE_STRING);
                } else if (options.secondaryMobileDialCode.toString().length > 5) {
                    throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_DIAL_CODE_MUST_BE_LESS_THAN_5_CHARACTER);
                } else {
                    locationRefFields += 'secondaryMobileDialCode=? ,';
                    locationRefOptionalValues.push(options.secondaryMobileDialCode);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.secondaryMobileCountry)) {
                if (!DataUtils.isString(options.secondaryMobileCountry)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_COUNTRY_MUST_BE_STRING);
                } else if (options.secondaryMobileCountry.toString().length > 2) {
                    throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_COUNTRY_MUST_BE_LESS_THAN_2_CHARACTER);
                } else {
                    locationRefFields += 'secondaryMobileCountry=? ,';
                    locationRefOptionalValues.push(options.secondaryMobileCountry);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.secondaryMobile)) {
                if (!DataUtils.isMobile(options.secondaryMobile)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_MUST_BE_VALID_NUMBER);
                } else if (options.secondaryMobile.toString().length > 15) {
                    throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_MUST_BE_LESS_THAN_OF_15_DIGIT);
                } else {
                    locationRefFields += 'secondaryMobile=? ,';
                    locationRefOptionalValues.push(options.secondaryMobile.concat(options.secondaryMobile));
                }
            }
            if (!DataUtils.isValidateOptionalField(options.fax)) {
                if (!DataUtils.isMobile(options.fax)) {
                    throw err = new Error(ErrorConfig.MESSAGE.FAX_1_MUST_BE_VALID_NUMBER);
                } else if (options.fax.toString().length > 15) {
                    throw err = new Error(ErrorConfig.MESSAGE.FAX_1_MUST_BE_LESS_THAN_15_CHARACTER);
                } else {
                    locationRefFields += 'fax=? ,';
                    locationRefOptionalValues.push(options.fax);
                }
            }
            /*if (!DataUtils.isValidateOptionalField(options.email)) {
                if (!DataUtils.isValidEmail(options.email)) {
                    throw err = new Error(ErrorConfig.MESSAGE.INVALID_EMAIL);
                }
                else if (options.email.length > 254) {
                    throw err = new Error(ErrorConfig.MESSAGE.EMAIL_MUST_BE_LESS_THAN_254_CHARACTER);
                }
                else {
                    accountFields += 'email=? ,';
                    accountOptionalValues.push(options.email);
                }
            }*/
            if (!DataUtils.isValidateOptionalField(options.city)) {
                if (!DataUtils.isString(options.city)) {
                    throw err = new Error(ErrorConfig.MESSAGE.CITY_MUST_BE_STRING);
                } else if (options.city.length > 254) {
                    throw err = new Error(ErrorConfig.MESSAGE.CITY_MUST_BE_LESS_THAN_60_CHARACTER);
                } else {
                    locationRefFields += 'city=? ,';
                    locationRefOptionalValues.push(options.city);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.zipCode)) {
                if (!DataUtils.isMobile(options.zipCode)) {
                    throw err = new Error(ErrorConfig.MESSAGE.ZIP_CODE_MUST_BE_VALID_NUMBER);
                } else if (options.zipCode.toString().length > 10) {
                    throw err = new Error(ErrorConfig.MESSAGE.ZIP_CODE_MUST_BE_LESS_THAN_10_DIGIT);
                } else {
                    locationRefFields += 'zipCode=? ,';
                    locationRefOptionalValues.push(options.zipCode);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.state)) {
                if (!DataUtils.isString(options.state)) {
                    throw err = new Error(ErrorConfig.MESSAGE.STATE_MUST_BE_STRING);
                } else if (options.state.length > 60) {
                    throw err = new Error(ErrorConfig.MESSAGE.STATE_MUST_BE_LESS_THAN_60_CHARACTER);
                } else {
                    locationRefFields += 'state=? ,';
                    locationRefOptionalValues.push(options.state);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.country)) {
                if (!DataUtils.isString(options.country)) {
                    throw err = new Error(ErrorConfig.MESSAGE.COUNTRY_MUST_BE_STRING);
                } else if (options.country.length > 2) {
                    throw err = new Error(ErrorConfig.MESSAGE.COUNTRY_MUST_BE_LESS_THAN_2_CHARACTER);
                } else {
                    locationRefFields += 'country=? ,';
                    locationRefOptionalValues.push(options.country);
                }
            }

            var response = {
                locationRefFields: locationRefFields,
                locationRefOptionalValues: locationRefOptionalValues
            };
            return cb(null, response);
        } catch (err) {
            debug('err', err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
    },

    createLocationReferenceMD: function (options, errorOptions, cb) {
        var locationRefFields = '';
        var locationRefOptionalValues = [];
        var locationRefRequiredValues = [];
        var locationId = options.locationId;
        var accountId = options.accountId;
        var locationName = options.locationName;
        var userId = options.userId;
        var currentTime = DataUtils.getEpochMSTimestamp();

        locationRefRequiredValues.push(accountId, locationId, accountId, locationName, accountId, locationId, locationName);
        Common.validateLocRefOptionalFields(options, async function (err, response) {
            if (err) {
                debug('err', err);
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            locationRefFields = response.locationRefFields;
            locationRefOptionalValues = response.locationRefOptionalValues;

            locationRefRequiredValues = _.concat(locationRefRequiredValues, locationRefOptionalValues);

            locationRefRequiredValues.push(userId, currentTime, currentTime);

            try {
                var conn = await connection.getConnection();

                var locationReference = await conn.query('IF (select 1 from LocationReference where accountId=uuid_to_bin(?) and locationId=?) is not null then ' +
                  ' SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "LOCATION_EXIST_WITH_SAME_LOCATION_ID"; ' +
                  ' ELSEIF exists (select 1 from LocationReference where accountId=uuid_to_bin(?) and locationName=?) then ' +
                  ' SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4002,MESSAGE_TEXT = "LOCATION_EXIST_WITH_SAME_LOCATION_NAME"; ' +
                  ' ELSE insert into LocationReference set accountId=uuid_to_bin(?), locationId=?, locationName=?, ' + locationRefFields + ' createdBy=uuid_to_bin(?), ' +
                  ' createdAt=?, updatedAt=? ; END IF;', locationRefRequiredValues);

                locationReference = Utils.isAffectedPool(locationReference);

                if (!locationReference) {
                    debug('err', err);
                    err = new Error(ErrorConfig.MESSAGE.DUPLICATE_LOCATION_CREATION);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    return cb(err);
                }
                return cb(null, {OK: 'Location reference created successfully...!!!'});
            } catch (err) {
                debug('err', err);
                if (err.errno === 4001) {
                    err = new Error(ErrorConfig.MESSAGE.LOCATION_EXIST_WITH_SAME_LOCATION_ID);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                } else if (err.errno === 4002) {
                    err = new Error(ErrorConfig.MESSAGE.LOCATION_EXIST_WITH_SAME_LOCATION_NAME);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                } else {
                    err = new Error(ErrorConfig.MESSAGE.LOCATION_CREATION_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                }
                return cb(err);
            }
        });
    },

    getLocationReferenceById: async function (options, cb) {
        var err;
        var accountId = options.accountId;
        var locationId = options.locationId;

        try {
            var conn = await connection.getConnection();
            var locationReference = await conn.query('select locationId,locationName,addressLine1,addressLine2,addressLine3,' +
              'city,state,zipcode,country from LocationReference where accountId = uuid_to_bin(?) and locationId=? and status = 1;', [accountId, locationId]);
            locationReference = Utils.filteredResponsePool(locationReference);
            if (!locationReference) {
                throw err;
            }
            return cb(null, locationReference);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.LOCATION_REFERENCE_NOT_FOUND);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }

    },

    getDefaultLocationReference: async function (options, cb) {
        var err;
        var locationId = options.locationId;

        try {
            var conn = await connection.getConnection();
            var locationReference = await conn.query('select locationId,locationName,' +
              'addressLine1,addressLine2,addressLine3,city,state,zipcode,country from LocationReference  where locationId = ? ;', [locationId]);
            locationReference = Utils.filteredResponsePool(locationReference);
            if (!locationReference) {
                throw err;
            }
            return cb(null, locationReference);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.LOCATION_REFERENCE_NOT_FOUND);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    updateErrorReference: async function (options, cb) {
        var errors = ErrorConfig.MESSAGE;
        /*var errors = {
            LOGIN_INCORRECT: 'LOGIN_INCORRECT',
            SIGNUP_INCORRECT: 'SIGNUP_INCORRECT',
            SESSION_INVALID: 'SESSION_INVALID',
            INVALID_CODE: 'INVALID_CODE',
            FIRST_NAME_REQ: 'FIRST_NAME_REQ',
            LAST_NAME_REQ: 'LAST_NAME_REQ',
            EMAIL_REQ: 'EMAIL_REQ',
            OWNER_UUID_REQ: 'OWNER_UUID_REQ',
            PASSWORD_REQ: 'PASSWORD_REQ',
            PASSWORD_INVALID: 'PASSWORD_INVALID',
            EMAIL_UNIQUE: 'EMAIL_UNIQUE',
            EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
            EMAIL_INVALID: 'EMAIL_INVALID'
        };*/
        var singleError = [];
        var c = 1;
        var err;

        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        _.each(errors, async function (desc, key) {
            var description = changeCase.lowerCase(desc);
            description = description.replace('_', ' ');

            var en = {
                meta: key,
                description: description,
                languageCultureCode: 'en-US'
            };
            var de = {
                meta: key,
                description: description,
                languageCultureCode: 'de-DE'
            };
            singleError.push(en, de);
            _.each(singleError, async function (value) {
                try {
                    if (value.meta === 'VERIFICATION_CODE_INVALID') {
                        value.description = 'time(s) you have tried,the code is invalid.Please check the code again  or get new code';
                    }
                    if (value.meta === 'USER_BLOCKED_DUE_TO_EXCEED_LIMIT_FOR_CONFIRM_VERIFICATION_CODE') {
                        value.description = 'time(s) you have tried,the code is invalid.Please get new code.';
                    }
                    if (value.meta === 'USER_BLOCKED_DUE_TO_EXCEED_LIMIT_FOR_RESEND') {
                        value.description = 'time(s) you have tried,the code is invalid.You cannot get a new code and the account is blocked.';
                    }
                    var insertErrorReference = await conn.query('IF (select 1 from ErrorReference where meta = ? and languageCultureCode = ?) is not null THEN ' +
                      'update ErrorReference set meta = ?,description = ?,languageCultureCode = ? where meta = ? and languageCultureCode = ?;' +
                      'ELSE insert into ErrorReference set meta=?, description=? ,languageCultureCode = ?; END IF;',
                      [value.meta, value.languageCultureCode, value.meta, value.description, value.languageCultureCode, value.meta, value.languageCultureCode,
                          value.meta, value.description, value.languageCultureCode]);
                    insertErrorReference = Utils.isAffectedPool(insertErrorReference);
                    debug('insertErrorReference', c++, insertErrorReference);
                } catch (err) {
                    debug('err', err);
                    err = new Error(ErrorConfig.MESSAGE.ERROR_REFERENCE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return cb(err);
                }
            });
            singleError = [];
        });
        return cb(null, {Ok: 'Error Reference Updated Successfully...!!!'});
    },

    getErrorReference: async function (options, cb) {
        var languageCultureCode = options.languageCultureCode;
        var length = ErrorConfig.MESSAGE;
        debug('length 123', Object.keys(length).length);
        var err;
        try {
            var conn = await connection.getConnection();

            var errorReference = await conn.query('select meta,description from ErrorReference where languageCultureCode=?', languageCultureCode);
            if (!errorReference) {
                throw err;
            }
            debug('length', errorReference.length);
            return cb(null, errorReference);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.ERROR_REFERENCE_NOT_FOUND);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    manipulateQuery: function (options) {
        return new Promise(function (resolve, reject) {
            var errors = options.errors;
            var languageCultureCode = options.languageCultureCode;
            var string = '', values = [];

            _.map(errors, function (error) {
                string += '?,';
                values.push(error);
            });
            string = string.replace(/,\s*$/, ' ');
            values.push(languageCultureCode);

            return resolve({
                string: string,
                values: values
            });
        });
    },

    getErrorReferenceForLogin: async function (options, cb) {
        var languageCultureCode = options.languageCultureCode;
        var errors = ['INVALID_REQUEST', 'EMAIL_REQ', 'EMAIL_MUST_BE_LESS_THAN_254_CHARACTER', 'PASSWORD_REQ', 'USER_SIGNUP_FAILED',
            'CAPTCHA_REQUIRED', 'LANGUAGE_OPTION_INVALID', 'PASSWORD_AND_CONFIRM_NOT_MATCH', 'USER_EXISTS', 'USER_EXISTS_POST_REG_INCOMPLETE',
            'ACCOUNT_CREATION_FAILED', 'LOGIN_INCORRECT', 'EMAIL_INVALID', 'ACCOUNT_DISABLED', 'POST_REG_COMPLETE', 'ACCEPT_TOS_FAILED',
            'USER_UPDATE_FAILED', 'USER_WITH_THIS_EMAIL_IS_ALREADY_EXIST', 'CURRENT_EMAIL_REQUIRED', 'CURRENT_EMAIL_IS_INCORRECT',
            'COMPLETE_PREVIOUS_POST_REG_STEPS', 'CODE_EXPIRES_DUE_TO_TIME_LIMIT', 'CODE_VERIFICATION_ATTEMPT_EXCEEDED', 'VERIFICATION_CODE_INVALID',
            'VERIFY_EMAIL_CONFIRM_FAILED', 'VERIFY_EMAIL_INITIATE_FAILED', 'USER_NOT_FOUND', 'RESET_REPETITIVE_REQUEST', 'ACCOUNT_CLOSED',
            'ERROR_REFERENCE_NOT_FOUND', 'USER_BLOCKED_DUE_TO_EXCEED_LIMIT_FOR_RESEND', 'USER_BLOCKED_DUE_TO_EXCEED_LIMIT_FOR_CONFIRM_VERIFICATION_CODE',
            'USER_BLOCKED_DUE_TO_EXCEED_LIMIT_FOR_LOGIN_ATTEMPT_TRY_AGAIN_LATER'];
        var err;
        try {
            var conn = await connection.getConnection();
            var response = await Common.manipulateQuery({
                errors: errors,
                languageCultureCode: languageCultureCode
            });

            var errorReference = await conn.query('select meta,description from ErrorReference where meta in (' + response.string + ') and languageCultureCode=?', response.values);
            if (!errorReference) {
                throw err;
            }
            return cb(null, errorReference);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.ERROR_REFERENCE_NOT_FOUND);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    /*
    * VERIFY RECAPTCHA
    * */
    verifyRecaptcha: async function (options, auditOptions, cb) {
        var captcha = options.captcha;
        var captchaSecretKey = reCaptchaConfig.secretKey;
        var ipAddress = auditOptions.ipAddress;
        var flag = options.flag;
        var minimumCaptchaScore = Constants.MINIMUM_CAPTCHA_SCORE;
        var error;

        try {
            if (flag === Constants.RE_CAPTCHA_FLAG.SIGNUP) {
                error = new Error(ErrorConfig.MESSAGE.USER_SIGNUP_FAILED);
            } else if (flag === Constants.RE_CAPTCHA_FLAG.RESET_PASSWORD) {
                error = new Error(ErrorConfig.MESSAGE.USER_RESET_PASSWORD_INITIATE_FAILED);
            } else if (flag === Constants.RE_CAPTCHA_FLAG.CONTACT_REQUEST) {
                error = new Error(ErrorConfig.MESSAGE.CONTACT_REQUEST_FAILED);
            }
            var captchaVerificationUrl = endpointConfig.RECAPTCHA_VERIFY_URL + '?secret=' + captchaSecretKey +
              '&response=' + captcha + '';
            if (DataUtils.isDefined(ipAddress)) {
                captchaVerificationUrl += '&remoteip=' + ipAddress;
            }
            await request(captchaVerificationUrl, async function (err, response, body) {
                body = JSON.parse(body);
                if (err || !body.success) {
                    err = err || error;
                    err.status = err.status || ErrorConfig.STATUS_CODE.UNAUTHORIZED;
                    return cb(err);
                }
                var score = body.score;
                if (!score || score < minimumCaptchaScore) {
                    err = err || error;
                    err.status = err.status || ErrorConfig.STATUS_CODE.UNAUTHORIZED;
                    return cb(err);
                }
                debug('====== COMPLETE ============');
                return cb(null, Constants.OK_MESSAGE);
            });
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
    }


};

module.exports = Common;
