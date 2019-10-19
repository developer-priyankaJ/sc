/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.api.customer');
var Util = require('util');
var Async = require('async');
var _ = require('lodash');
var knex = require('../lib/knex_util');
var Promise = require('bluebird');
var connection = require('../lib/connection_util');
var ErrorConfig = require('../data/error');
var connection = require('../lib/connection_util');
var DataUtils = require('../lib/data_utils');
var AuditUtils = require('../lib/audit_utils');
var Constants = require('../data/constants');
var CustomerModel = require('../model/customer');
var NotificationReferenceData = require('../data/notification_reference');
var Endpoints = require('../config/endpoints');
var SupplierApi = require('./supplier');
var EmailUtils = require('../lib/email_utils');
var Utils = require('../lib/utils');
var ErrorUtils = require('../lib/error_utils');

var Customer = {

    validateOptionalFields: function (options) {
        return new Promise(function (resolve, reject) {
            var customerFields = '';
            var customerOptionalValues = [];
            var customerLocFields = '';
            var customerLocValues = [];
            var err;

            try {

                if (!err && !DataUtils.isValidateOptionalField(options.firstName)) {
                    if (!DataUtils.isString(options.firstName)) {

                        throw new Error(ErrorConfig.MESSAGE.CUSTOMER_FIRST_NAME_MUST_BE_STRING);

                    } else if (options.firstName.length > 60) {
                        throw new Error(ErrorConfig.MESSAGE.CUSTOMER_FIRST_NAME_MUST_BE_LESS_THAN_60_CHARACTER);
                    } else {
                        customerFields += 'firstName = ?,';
                        customerOptionalValues.push(options.firstName);
                    }
                }

                if (!err && !DataUtils.isValidateOptionalField(options.lastName)) {
                    if (!DataUtils.isString(options.lastName)) {

                        throw new Error(ErrorConfig.MESSAGE.CUSTOMER_LAST_NAME_MUST_BE_STRING);

                    } else if (options.lastName.length > 60) {
                        throw new Error(ErrorConfig.MESSAGE.CUSTOMER_LAST_NAME_MUST_BE_LESS_THAN_60_CHARACTER);
                    } else {
                        customerFields += 'lastName = ?,';
                        customerOptionalValues.push(options.lastName);
                    }
                }

                if (!err && !DataUtils.isValidateOptionalField(options.email)) {
                    if (!DataUtils.isString(options.email)) {

                        throw new Error(ErrorConfig.MESSAGE.CUSTOMER_EMAIL_MUST_BE_STRING);

                    } else if (options.email.length > 60) {
                        throw new Error(ErrorConfig.MESSAGE.CUSTOMER_EMAIL_MUST_BE_LESS_THAN_254_CHARACTER);
                    } else {
                        customerFields += 'email = ?,';
                        customerOptionalValues.push(options.email);
                    }
                }

                if (!err && !DataUtils.isValidateOptionalField(options.customerName)) {
                    if (!DataUtils.isString(options.customerName)) {
                        throw new Error(ErrorConfig.MESSAGE.CUSTOMER_NAME_MUST_BE_STRING);
                    } else if (options.customerName.length > 60) {
                        throw new Error(ErrorConfig.MESSAGE.CUSTOMER_NAME_MUST_BE_LESS_THAN_60_CHARACTER);
                    } else {
                        customerFields += 'customerName = ?,';
                        customerOptionalValues.push(options.customerName);
                    }
                }

                if (!err && !DataUtils.isValidateOptionalField(options.customerId)) {
                    if (!DataUtils.isString(options.customerId)) {
                        throw new Error(ErrorConfig.MESSAGE.CUSTOMER_ID_MUST_BE_STRING);
                    } else if (options.customerId.length > 40) {
                        throw new Error(ErrorConfig.MESSAGE.CUSTOMER_ID_MUST_BE_LESS_THAN_40_CHARACTER);
                    } else {
                        customerFields += 'customerId = ?,';
                        customerOptionalValues.push(options.customerId);
                    }
                }

                if (!err && !DataUtils.isValidateOptionalField(options.companyName)) {
                    if (!DataUtils.isString(options.companyName)) {
                        throw new Error(ErrorConfig.MESSAGE.CUSTOMER_COMPANY_NAME_MUST_BE_STRING);
                    } else if (options.companyName.length > 60) {
                        throw new Error(ErrorConfig.MESSAGE.CUSTOMER_COMPANY_NAME_MUST_BE_LESS_THAN_60_CHARACTER);
                    } else {
                        customerFields += 'companyName = ?,';
                        customerOptionalValues.push(options.companyName);
                    }
                }

                if (!err && !DataUtils.isValidateOptionalField(options.dialCode)) {
                    if (!DataUtils.isString(options.dialCode)) {
                        throw new Error(ErrorConfig.MESSAGE.DIAL_CODE_MUST_BE_STRING);
                    } else if (options.dialCode.toString().length > 5) {
                        throw new Error(ErrorConfig.MESSAGE.DIAL_CODE_MUST_BE_LESS_THAN_5_CHARACTER);
                    } else {
                        customerFields += 'dialCode = ?,';
                        customerOptionalValues.push(options.dialCode);
                    }
                }

                if (!DataUtils.isValidateOptionalField(options.phoneCountry)) {
                    if (!DataUtils.isString(options.phoneCountry)) {
                        throw err = new Error(ErrorConfig.MESSAGE.PHONE_COUNTRY_MUST_BE_STRING);
                    } else if (options.phoneCountry.toString().length > 2) {
                        throw err = new Error(ErrorConfig.MESSAGE.PHONE_COUNTRY_MUST_BE_LESS_THAN_2_CHARACTER);
                    } else {
                        customerFields += 'phoneCountry=? ,';
                        customerOptionalValues.push(options.phoneCountry);
                    }
                }

                if (!err && !DataUtils.isValidateOptionalField(options.phone)) {
                    if (!DataUtils.isMobile(options.phone)) {
                        throw new Error(ErrorConfig.MESSAGE.CUSTOMER_PHONE_NUMBER_MUST_BE_VALID_NUMBER);
                    } else if (options.phone.toString().length > 15) {
                        throw new Error(ErrorConfig.MESSAGE.CUSTOMER_PHONE_NUMBER_MUST_BE_LESS_THAN_15_CHARACTER);
                    } else {
                        customerFields += 'phone = ?,';
                        customerOptionalValues.push(options.dialCode + '' + options.phone);
                    }
                }

                if (!DataUtils.isValidateOptionalField(options.primaryMobileDialCode)) {
                    if (!DataUtils.isString(options.primaryMobileDialCode)) {
                        throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_DIAL_CODE_MUST_BE_STRING);
                    } else if (options.primaryMobileDialCode.length > 5) {
                        throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_DIAL_CODE_MUST_BE_LESS_THAN_5_CHARACTER);
                    } else {
                        customerFields += 'primaryMobileDialCode=? ,';
                        customerOptionalValues.push(options.primaryMobileDialCode);
                    }
                }

                if (!DataUtils.isValidateOptionalField(options.primaryMobileCountry)) {
                    if (!DataUtils.isString(options.primaryMobileCountry)) {
                        throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_COUNTRY_MUST_BE_STRING);
                    } else if (options.primaryMobileCountry.length > 2) {
                        throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_COUNTRY_MUST_BE_LESS_THAN_2_CHARACTER);
                    } else {
                        customerFields += 'primaryMobileCountry=? ,';
                        customerOptionalValues.push(options.primaryMobileCountry);
                    }
                }

                if (!DataUtils.isValidateOptionalField(options.primaryMobile)) {
                    if (!DataUtils.isMobile(options.primaryMobile)) {
                        throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_MUST_BE_VALID_NUMBER);
                    } else if (options.primaryMobile.toString().length > 15) {
                        throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_MUST_BE_LESS_THAN_OF_15_DIGIT);
                    } else {
                        customerFields += 'primaryMobile=? ,';
                        customerOptionalValues.push(options.primaryMobileDialCode + '' + options.primaryMobile);
                    }
                }

                if (!DataUtils.isValidateOptionalField(options.secondaryMobileDialCode)) {
                    if (!DataUtils.isString(options.secondaryMobileDialCode)) {
                        throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_DIAL_CODE_MUST_BE_STRING);
                    } else if (options.secondaryMobileDialCode.length > 5) {
                        throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_DIAL_CODE_MUST_BE_LESS_THAN_5_CHARACTER);
                    } else {
                        customerFields += 'secondaryMobileDialCode=? ,';
                        customerOptionalValues.push(options.secondaryMobileDialCode);
                    }
                }

                if (!DataUtils.isValidateOptionalField(options.secondaryMobileCountry)) {
                    if (!DataUtils.isString(options.secondaryMobileCountry)) {
                        throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_COUNTRY_MUST_BE_STRING);
                    } else if (options.secondaryMobileCountry.length > 2) {
                        throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_COUNTRY_MUST_BE_LESS_THAN_2_CHARACTER);
                    } else {
                        customerFields += 'secondaryMobileCountry=? ,';
                        customerOptionalValues.push(options.secondaryMobileCountry);
                    }
                }

                if (!DataUtils.isValidateOptionalField(options.secondaryMobile)) {
                    if (!DataUtils.isMobile(options.secondaryMobile)) {
                        throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_MUST_BE_NUMBER);
                    } else if (options.secondaryMobile.toString().length > 15) {
                        throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_MUST_BE_LESS_THAN_OF_15_DIGIT);
                    } else {
                        customerFields += 'secondaryMobile=? ,';
                        customerOptionalValues.push(options.secondaryMobileDialCode + '' + options.secondaryMobile);
                    }
                }

                if (!err && !DataUtils.isValidateOptionalField(options.fax)) {
                    if (!DataUtils.isString(options.fax)) {
                        throw new Error(ErrorConfig.MESSAGE.CUSTOMER_FAX_NUMBER_MUST_BE_STRING);
                    } else if (options.fax.length > 11) {
                        throw new Error(ErrorConfig.MESSAGE.CUSTOMER_FAX_NUMBER_MUST_BE_LESS_THAN_15_CHARACTER);
                    } else {
                        customerFields += 'fax = ?,';
                        customerOptionalValues.push(options.fax);
                    }
                }

                if (!err && !DataUtils.isValidateOptionalField(options.invitationExpirationDate)) {
                    customerFields += 'invitationExpirationDate = ?,';
                    customerOptionalValues.push(options.invitationExpirationDate);
                }

                if (!err && !DataUtils.isValidateOptionalField(options.status)) {
                    customerFields += 'status = ?,';
                    customerOptionalValues.push(options.status);
                }

                if (!err && !DataUtils.isValidateOptionalField(options.googleLink)) {
                    if (!DataUtils.isString(options.googleLink)) {
                        throw new Error(ErrorConfig.MESSAGE.CUSTOMER_GOOGLE_LINK_MUST_BE_STRING);
                    } else {
                        customerFields += 'googleLink = ?,';
                        customerOptionalValues.push(options.googleLink);
                    }
                }

                if (!err && !DataUtils.isValidateOptionalField(options.addressLine1)) {
                    if (!DataUtils.isString(options.addressLine1)) {
                        throw new Error(ErrorConfig.MESSAGE.CUSTOMER_ADDRESS_BE_STRING);
                    } else if (options.addressLine1.length > 60) {
                        throw new Error(ErrorConfig.MESSAGE.CUSTOMER_ADDRESS_MUST_BE_LESS_THAN_60_CHARACTER);
                    } else {
                        customerLocFields += 'addressLine1 = ?,';
                        customerLocValues.push(options.addressLine1);
                    }
                }

                if (!err && !DataUtils.isValidateOptionalField(options.addressLine2)) {
                    if (!DataUtils.isString(options.addressLine2)) {
                        throw new Error(ErrorConfig.MESSAGE.CUSTOMER_ADDRESS_BE_STRING);
                    } else if (options.addressLine2.length > 60) {
                        throw new Error(ErrorConfig.MESSAGE.CUSTOMER_ADDRESS_MUST_BE_LESS_THAN_60_CHARACTER);
                    } else {
                        customerLocFields += 'addressLine2 = ?,';
                        customerLocValues.push(options.addressLine2);
                    }
                }

                if (!err && !DataUtils.isValidateOptionalField(options.addressLine3)) {
                    if (!DataUtils.isString(options.addressLine3)) {
                        throw new Error(ErrorConfig.MESSAGE.CUSTOMER_ADDRESS_BE_STRING);
                    } else if (options.addressLine3.length > 60) {
                        throw new Error(ErrorConfig.MESSAGE.CUSTOMER_ADDRESS_MUST_BE_LESS_THAN_60_CHARACTER);
                    } else {
                        customerLocFields += 'addressLine3 = ?,';
                        customerLocValues.push(options.addressLine3);
                    }
                }

                if (!err && !DataUtils.isValidateOptionalField(options.city)) {
                    if (!DataUtils.isString(options.city)) {
                        throw Error(ErrorConfig.MESSAGE.CUSTOMER_CITY_NAME_MUST_BE_STRING);
                    } else if (options.city.length > 60) {
                        throw new Error(ErrorConfig.MESSAGE.CUSTOMER_CITY_NAME_MUST_BE_LESS_THAN_60_CHARACTER);
                    } else {
                        customerLocFields += 'city = ?,';
                        customerLocValues.push(options.city);
                    }
                }

                if (!err && !DataUtils.isValidateOptionalField(options.state)) {
                    if (!DataUtils.isString(options.state)) {
                        throw Error(ErrorConfig.MESSAGE.CUSTOMER_STATE_MUST_BE_STRING);
                    } else if (options.state.length > 60) {
                        throw new Error(ErrorConfig.MESSAGE.CUSTOMER_STATE_MUST_BE_LESS_THAN_60_CHARACTER);
                    } else {
                        customerLocFields += 'state = ?,';
                        customerLocValues.push(options.state);
                    }
                }

                if (!err && !DataUtils.isValidateOptionalField(options.country)) {
                    if (!DataUtils.isString(options.country)) {
                        throw new Error(ErrorConfig.MESSAGE.CUSTOMER_COUNTRY_MUST_BE_STRING);
                    } else if (options.country.length > 60) {
                        throw new Error(ErrorConfig.MESSAGE.CUSTOMER_COUNTRY_MUST_BE_LESS_THAN_60_CHARACTER);
                    } else {
                        customerLocFields += 'country = ?,';
                        customerLocValues.push(options.country);
                    }
                }

                if (!err && !DataUtils.isValidateOptionalField(options.zipCode)) {
                    if (!DataUtils.isString(options.zipCode)) {
                        throw new Error(ErrorConfig.MESSAGE.CUSTOMER_ZIP_CODE_MUST_BE_STRING);
                    } else if (options.zipCode.length > 10) {
                        throw new Error(ErrorConfig.MESSAGE.CUSTOMER_ZIP_CODE_MUST_BE_LESS_THAN_10_CHARACTER);
                    } else {
                        customerLocFields += 'zipCode = ?,';
                        customerLocValues.push(options.zipCode);
                    }
                }

                var response = {
                    customerFields: customerFields,
                    customerOptionalValues: customerOptionalValues,
                    customerLocFields: customerLocFields,
                    customerLocValues: customerLocValues
                };

                return resolve(response);
            } catch (err) {
                debug('err', err);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return reject(err);
            }
        });
    },

    checkForSameAccountCustomer: function (options) {
        return new Promise(async function (resolve, reject) {
            var accountId = options.accountId;
            var email = options.email;
            var err;

            try {
                var conn = await connection.getConnection();
                var response = await conn.query('SELECT 1 FROM users U , Customers C where ' +
                  'U.accountId = C.customersAccountId and U.email = ?  and C.accountId = uuid_to_bin(?)', [email, accountId]);

                if (response.length > 0) {
                    err = new Error(ErrorConfig.MESSAGE.CUSTOMER_ALREADY_EXIST_FOR_SAME_ACCOUNT);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    createMD: async function (options, errorOptions, cb) {
        var saveAsLater = options.saveAsLater;
        var useExisting = options.useExisting;
        var phone = options.phone;
        var dialCode = options.dialCode;
        var phoneCountry = options.phoneCountry;
        var primaryMobile = options.primaryMobile;
        var primaryMobileDialCode = options.primaryMobileDialCode;
        var primaryMobileCountry = options.primaryMobileCountry;
        var secondaryMobile = options.secondaryMobile;
        var secondaryMobileDialCode = options.secondaryMobileDialCode;
        var secondaryMobileCountry = options.secondaryMobileCountry;
        var err;

        if (DataUtils.isUndefined(options.email)) {
            err = new Error(ErrorConfig.MESSAGE.EMAIL_REQUIRED);
        } else if (!DataUtils.isValidEmail(options.email)) {
            err = new Error(ErrorConfig.MESSAGE.CUSTOMER_EMAIL_IS_NOT_VALID);
        } else if (DataUtils.isUndefined(options.firstName)) {
            err = new Error(ErrorConfig.MESSAGE.CUSTOMER_FIRST_NAME_REQUIRED);
        } else if (DataUtils.isUndefined(options.lastName)) {
            err = new Error(ErrorConfig.MESSAGE.CUSTOMER_LAST_NAME_REQUIRED);
        } else if (DataUtils.isUndefined(options.customerCode)) {
            err = new Error(ErrorConfig.MESSAGE.CUSTOMER_CODE_REQUIRED);
        } else if (!DataUtils.isString(options.customerCode)) {
            err = new Error(ErrorConfig.MESSAGE.CUSTOMER_CODE_MUST_BE_STRING);
        } else if (options.customerCode.length > 10) {
            err = new Error(ErrorConfig.MESSAGE.CUSTOMER_CODE_MUST_BE_LESS_THAN_10_CHARACTER);
        } else if (DataUtils.isUndefined(options.customerName)) {
            err = new Error(ErrorConfig.MESSAGE.CUSTOMER_NAME_REQUIRED);
        }
        if (err) {
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
        if (DataUtils.isDefined(phone) || DataUtils.isDefined(dialCode) || DataUtils.isDefined(phoneCountry)) {
            if (DataUtils.isUndefined(phone)) {
                err = new Error(ErrorConfig.MESSAGE.PHONE_NUMBER_REQUIRED);
            } else if (DataUtils.isUndefined(dialCode)) {
                err = new Error(ErrorConfig.MESSAGE.DIAL_CODE_REQUIRED);
            } else if (DataUtils.isUndefined(phoneCountry)) {
                err = new Error(ErrorConfig.MESSAGE.PHONE_COUNTRY_REQUIRED);
            }
            if (err) {
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
        }
        if (DataUtils.isDefined(primaryMobile) || DataUtils.isDefined(primaryMobileDialCode) || DataUtils.isDefined(primaryMobileCountry)) {
            debug('Insid eif ');
            if (DataUtils.isUndefined(primaryMobile)) {
                err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_REQUIRED);
            } else if (DataUtils.isUndefined(primaryMobileDialCode)) {
                err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_DIAL_CODE_REQUIRED);
            } else if (DataUtils.isUndefined(primaryMobileCountry)) {
                err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_COUNTRY_REQUIRED);
            }
            if (err) {
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
        }
        if (DataUtils.isDefined(secondaryMobile) || DataUtils.isDefined(secondaryMobileDialCode) || DataUtils.isDefined(secondaryMobileCountry)) {
            if (DataUtils.isUndefined(secondaryMobile)) {
                err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_REQUIRED);
            } else if (DataUtils.isUndefined(secondaryMobileDialCode)) {
                err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_DIAL_CODE_REQUIRED);
            } else if (DataUtils.isUndefined(secondaryMobileCountry)) {
                err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_COUNTRY_REQUIRED);
            }
            if (err) {
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
        }


        if (useExisting) {
            if (DataUtils.isUndefined(options.locationId)) {
                err = new Error(ErrorConfig.MESSAGE.SELECT_ANY_LOCATION_ID);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);
                return cb(err);
            }
        }

        var response, customerFields, customerOptionalValues, customerLocFields, customerLocValues;
        var id = Utils.generateId().uuid;
        var currentDate = new Date().getTime();

        try {
            var conn = await connection.getConnection();

            // CHECK IF supplier already exist with same account of given email
            var checkOption = {
                email: options.email,
                accountId: options.accountId
            };
            var checkResponse = await Customer.checkForSameAccountCustomer(checkOption);
            debug('checkResponse', checkResponse);
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        if (saveAsLater) {
            if (DataUtils.isValidateOptionalField(options.newLocationId) || options.newLocationId === '') {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_LOCATION_ID_REQUIRED);
            }
            if (!err && !DataUtils.isString(options.newLocationId)) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_NEW_LOCATION_ID_MUST_BE_STRING);
            }
            if (!err && options.newLocationId.length > 40) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_NEW_LOCATION_ID_MUST_BE_LESS_THAN_40_CHARACTER);
            }
            if (!err && DataUtils.isValidateOptionalField(options.newLocationName) || options.newLocationName === '') {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_LOCATION_NAME_REQUIRED);
            }
            if (!err && !DataUtils.isString(options.newLocationName)) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_NEW_LOCATION_NAME_MUST_BE_STRING);
            }
            if (!err && options.newLocationName.length > 60) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_NEW_LOCATION_NAME_MUST_BE_LESS_THEN_60_CHARACTER);
            }

            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);
                return cb(err);
            }

            try {
                await conn.query('START TRANSACTION');

                response = await Customer.validateOptionalFields(options);

                customerFields = response.customerFields;
                customerOptionalValues = response.customerOptionalValues;
                customerLocFields = response.customerLocFields;
                customerLocValues = response.customerLocValues;

                var query =
                  'IF EXISTS (SELECT 1 from LocationReference where accountId = uuid_to_bin(?) and locationId = ?)' +
                  'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "DUPLICATE_LOCATION_CREATION";' +
                  'ELSE INSERT into LocationReference SET accountId = uuid_to_bin(?),locationId = ?,locationName = ?,' +
                  'createdBy = uuid_to_bin(?),' + customerLocFields + 'createdAt = ?,updatedAt = ?;end IF';

                var params = [options.accountId, options.newLocationId, options.accountId, options.newLocationId, options.newLocationName, options.userId].concat(customerLocValues).concat([currentDate, currentDate]);

                var locationInserted = await conn.query(query, params);

                var isAffected = Utils.isAffectedPool(locationInserted);

                if (!isAffected) {
                    err = new Error(ErrorConfig.MESSAGE.DUPLICATE_LOCATION_CREATION);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }

                query =
                  'IF EXISTS(SELECT 1 from Customers  where customerCode = ? and accountId = uuid_to_bin(?))' +
                  'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4002,MESSAGE_TEXT = "DUPLICATE_CUSTOMER_CODE";' +
                  'ELSEIF EXISTS (SELECT 1 from Customers where accountId = uuid_to_bin(?) and customerCode != ? and email = ?)' +
                  'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4003,MESSAGE_TEXT = "CUSTOMER_EMAIL_ALREADY_EXISTS";' +
                  'ELSE INSERT into Customers SET id = uuid_to_bin(?),accountId = uuid_to_bin(?),customerCode = ?,locationId = ?,' +
                  'customersAccountId = uuid_to_bin("00000000-0000-0000-0000-000000000000"),' +
                  'createdBy = uuid_to_bin(?),' + customerFields + 'createdAt = ?,updatedAt = ?;end IF';

                params = [options.customerCode, options.accountId, options.accountId, options.customerCode, options.email, id,
                    options.accountId, options.customerCode, options.newLocationId, options.userId].concat(customerOptionalValues).concat([currentDate, currentDate]);

                var customerInserted = await conn.query(query, params);

                var isAffected = Utils.isAffectedPool(customerInserted);

                if (!isAffected) {
                    err = new Error(ErrorConfig.MESSAGE.DUPLICATE_CUSTOMER_CREATION);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
                if (!options.addInviteFlag) {
                    await conn.query('COMMIT;');
                }

                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.CUSTOMER_CREATE_SUCCESS,
                    id: id,
                    updatedAt: currentDate
                });

            } catch (err) {
                debug('inside error', err);
                await conn.query('ROLLBACK;');
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);

                if (err.errno === 4001) {
                    err = new Error(ErrorConfig.MESSAGE.DUPLICATE_LOCATION_CREATION);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                } else if (err.errno === 4002) {
                    err = new Error(ErrorConfig.MESSAGE.DUPLICATE_CUSTOMER_CODE);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                } else if (err.errno === 4003) {
                    err = new Error(ErrorConfig.MESSAGE.CUSTOMER_EMAIL_ALREADY_EXISTS);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                } else if (err.errno) {
                    err = new Error(ErrorConfig.MESSAGE.CUSTOMER_CREATION_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                }
                debug('return from here');
                return cb(err);
            }

        } else {

            try {
                await conn.query('START TRANSACTION');
                response = await Customer.validateOptionalFields(options);

                customerFields = response.customerFields;
                customerOptionalValues = response.customerOptionalValues;
                customerLocFields = response.customerLocFields;
                customerLocValues = response.customerLocValues;

                if (options.locationId) {
                    query =
                      'IF EXISTS (SELECT 1 from Customers where accountId = uuid_to_bin(?) and customerCode = ?)' +
                      'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "DUPLICATE_CUSTOMER_CODE";' +
                      'ELSEIF EXISTS (SELECT 1 from Customers where accountId = uuid_to_bin(?) and customerCode != ? and email = ?)' +
                      'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4002,MESSAGE_TEXT = "CUSTOMER_EMAIL_ALREADY_EXISTS";' +
                      'ELSEIF NOT EXISTS(SELECT 1 from LocationReference  where accountId = uuid_to_bin(?) and locationId = ? and status = 1)' +
                      'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4003,MESSAGE_TEXT = "CUSTOMER_LOCATION_ID_NOT_BELONG_THIS_USER";' +
                      'ELSE INSERT into Customers SET id = uuid_to_bin(?),accountId = uuid_to_bin(?),customerCode = ?,locationId = ?,customersAccountId = uuid_to_bin("00000000-0000-0000-0000-000000000000"),' +
                      'createdBy = uuid_to_bin(?),' + customerFields + 'createdAt = ?,updatedAt = ?;end IF;';

                    params = [options.accountId, options.customerCode, options.accountId, options.customerCode, options.email,
                        options.accountId, options.locationId, id, options.accountId, options.customerCode,
                        options.locationId, options.userId].concat(customerOptionalValues).concat([currentDate, currentDate]);

                    customerInserted = await conn.query(query, params);

                    var isAffected = Utils.isAffectedPool(customerInserted);

                    if (!isAffected) {
                        err = new Error(ErrorConfig.MESSAGE.CUSTOMER_CREATION_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                        await ErrorUtils.create(errorOptions, options, err);
                        throw err;
                    }

                    if (!options.addInviteFlag) {
                        await conn.query('COMMIT;');
                    }
                    return cb(null, {
                        OK: Constants.SUCCESS_MESSAGE.CUSTOMER_CREATE_SUCCESS,
                        status: Constants.CUSTOMER_INVITATION_STATUS.NO_INVITATION,
                        id: id,
                        updatedAt: currentDate
                    });

                } else {

                    query =
                      'IF EXISTS (SELECT 1 from Customers where accountId = uuid_to_bin(?) and customerCode = ?)' +
                      'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "DUPLICATE_CUSTOMER_CODE";' +
                      'ELSEIF EXISTS (SELECT 1 from Customers where accountId = uuid_to_bin(?) and customerCode != ? and email = ?)' +
                      'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4002,MESSAGE_TEXT = "CUSTOMER_EMAIL_ALREADY_EXISTS";' +
                      'ELSE INSERT into Customers SET id = uuid_to_bin(?),accountId = uuid_to_bin(?),customerCode = ?,customersAccountId = uuid_to_bin("00000000-0000-0000-0000-000000000000"),' +
                      'createdBy = uuid_to_bin(?),' + customerFields + customerLocFields + 'createdAt = ?,updatedAt = ?;end IF';

                    params = [options.accountId, options.customerCode, options.accountId, options.customerCode, options.email, id,
                        options.accountId, options.customerCode, options.userId].concat(customerOptionalValues).concat(customerLocValues).concat([currentDate, currentDate]);
                    customerInserted = await conn.query(query, params);
                    if (!Utils.isAffectedPool(customerInserted)) {
                        err = new Error(ErrorConfig.MESSAGE.CUSTOMER_CREATION_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                        throw err;
                    }
                    if (!options.addInviteFlag) {
                        await conn.query('COMMIT;');
                    }
                    return cb(null, {
                        OK: Constants.SUCCESS_MESSAGE.CUSTOMER_CREATE_SUCCESS,
                        status: Constants.CUSTOMER_INVITATION_STATUS.NO_INVITATION,
                        id: id,
                        updatedAt: currentDate
                    });
                }
            } catch (err) {
                debug('Error', err);
                await conn.query('ROLLBACK;');
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);
                debug('err', err);
                if (err.errno === 4001) {
                    err = new Error(ErrorConfig.MESSAGE.DUPLICATE_CUSTOMER_CODE);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                } else if (err.errno === 4002) {

                    err = new Error(ErrorConfig.MESSAGE.CUSTOMER_EMAIL_ALREADY_EXISTS);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;

                } else if (err.errno === 4003) {

                    err = new Error(ErrorConfig.MESSAGE.CUSTOMER_LOCATION_ID_NOT_BELONG_THIS_USER);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;

                } else if (err.errno) {
                    err = new Error(ErrorConfig.MESSAGE.CUSTOMER_CREATION_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                }
                return cb(err);
            }
        }
    },

    getCustomersByAccountIdMD: async function (options, errorOptions, cb) {
        var accountId = options.accountId;
        var isActive = options.isActive;
        var err;

        if (DataUtils.isUndefined(accountId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
        } else if (DataUtils.isUndefined(isActive)) {
            err = new Error(ErrorConfig.MESSAGE.IS_ACTIVE_FIELD_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('err', err);
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();

            var records = await conn.query('SELECT CAST(uuid_from_bin(id) as char) as id from Customers ' +
              ' where accountId = uuid_to_bin(?) and isActive = ? order by updatedAt desc limit 10',
              [accountId, isActive]);

            debug('records', records.length);
            if (records.length <= 0) {
                customers = [];
                return cb(null, customers);
            }

            var response = await Customer.manipulateQuery({customers: records});
            debug('response', response);

            var emptyLocationCustomers = await conn.query('SELECT CAST(uuid_from_bin(id) as char) as id,CAST(uuid_from_bin(accountId) as char) as accountId,' +
              ' CAST(uuid_from_bin(customersAccountId) as char) as customersAccountId,' +
              ' locationId,locationName, customerId,customerName,companyName,firstName,lastName,email,phone,primaryMobile,' +
              ' secondaryMobile,fax,customerCode,addressLine1,addressLine2,addressLine3,city,zipCode,state,country,googleLink ,' +
              ' recordType,status,invitationExpirationDate,isActive, updatedAt from Customers ' +
              ' where accountId = uuid_to_bin(?) and locationId = "" and isActive = ? and id in (' + response.string + ')',
              [accountId, isActive].concat(response.values));
            //emptyLocationCustomers = Utils.filteredResponsePool(emptyLocationCustomers);

            var customerWithLocation = await conn.query('select CAST(uuid_from_bin(C.id) as char) as id,CAST(uuid_from_bin(C.accountId) as char) as accountId,' +
              'CAST(uuid_from_bin(C.customersAccountId) as char) as customersAccountId,C.customerId,C.locationId, ' +
              'C.customerName,C.companyName,C.firstName,C.lastName,C.email,C.phone,C.primaryMobile,C.secondaryMobile,C.customerCode, ' +
              'C.status,C.invitationExpirationDate,LR.googleLink, ' +
              'LR.locationName,LR.addressLine1,LR.addressLine2,LR.addressLine3,LR.city,LR.zipCode,LR.state,LR.country,LR.fax,' +
              'C.isActive,C.updatedAt from Customers C, LocationReference LR ' +
              'where LR.locationId = C.locationId and  LR.accountId = uuid_to_bin(?) and ' +
              'C.accountId = uuid_to_bin(?) and C.locationId != "" and C.isActive = ? and C.id in (' + response.string + ');',
              [accountId, accountId, isActive].concat(response.values));

            var customers = [];
            customers = customers.concat(emptyLocationCustomers).concat(customerWithLocation);

            //customers = _.sortBy(customers, 'updatedAt').reverse().splice(0, 10);
            customers = _.sortBy(customers, 'updatedAt').reverse();

            return cb(null, customers);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.CUSTOMER_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    getByAccountIdAndCustomerIdMD: async function (options, errorOptions, cb) {
        var accountId = options.accountId;
        var customerId = options.customerId;
        var err;

        if (DataUtils.isUndefined(accountId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
        }
        if (DataUtils.isUndefined(customerId)) {
            err = new Error(ErrorConfig.MESSAGE.CUSTOMER_CUSTOMER_ID_REQUIRED);
        }

        if (err) {
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('err', err);
            return cb(err);
        }
        try {
            var conn = await connection.getConnection();
            var customer = await conn.query('SELECT CAST(uuid_from_bin(id) as char) as id,CAST(uuid_from_bin(accountId) as char) as accountId,' +
              'CAST(uuid_from_bin(customersAccountId) as char) as customersAccountId,' +
              'locationId, customerId,customerName,companyName,firstName,lastName,email,phone,dialCode,fax,customerCode,' +
              'addressLine1,addressLine2, addressLine3, city, zipCode, state, country, googleLink,' +
              'recordType,status,invitationExpirationDate,updatedAt from Customers where accountId = uuid_to_bin(?) and ' +
              'customerId = ? and isActive = 1;', [accountId, customerId]);
            customer = Utils.filteredResponsePool(customer);
            if (!customer) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_CUSTOMER_ID_INVALID);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            if (customer.locationId) {
                var locationReferenceData = await conn.query('select locationId, locationName, addressLine1, ' +
                  'addressLine2, addressLine3, city, zipCode, state, country, googleLink from LocationReference where accountId=uuid_to_bin(?) and locationId=?', [accountId, customer.locationId]);
                locationReferenceData = Utils.filteredResponsePool(locationReferenceData);
                if (!locationReferenceData) {
                    debug('err', err);
                    return cb(null, customer);
                }
                var customerWithLocation = Object.assign(customer, locationReferenceData);
                return cb(null, customerWithLocation);
            }

            return cb(null, customer);
        } catch (err) {
            debug('err', err);
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            if (err.code) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    getByIdAndAccountIdMD: async function (options, errorOptions, cb) {
        var accountId = options.accountId;
        var id = options.id;
        var err;

        if (DataUtils.isUndefined(accountId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
        }
        if (DataUtils.isUndefined(id)) {
            err = new Error(ErrorConfig.MESSAGE.CUSTOMER_ID_REQUIRED);
        }

        if (err) {
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('err', err);
            return cb(err);
        }
        try {
            var conn = await connection.getConnection();
            var customer = await conn.query('SELECT CAST(uuid_from_bin(id) as char) as id,CAST(uuid_from_bin(accountId) as char) as accountId,' +
              ' CAST(uuid_from_bin(customersAccountId) as char) as customersAccountId, locationId, customerId, customerName,' +
              ' companyName, firstName, lastName, email, dialCode, phone,phoneCountry, primaryMobileDialCode, primaryMobile,primaryMobileCountry,' +
              ' secondaryMobileDialCode, secondaryMobile,secondaryMobileCountry, fax, customerCode, addressLine1, addressLine2, addressLine3, city, zipCode, ' +
              ' state, country, googleLink, recordType, status, invitationExpirationDate, updatedAt from Customers where ' +
              ' accountId = uuid_to_bin(?) and id = uuid_to_bin(?) and isActive = 1', [accountId, id]);

            customer = Utils.filteredResponsePool(customer);
            if (!customer) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_ID_INVALID);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            if (customer.locationId) {
                var locationReferenceData = await conn.query('select locationId, locationName, addressLine1, ' +
                  'addressLine2, addressLine3, city, zipCode, state, country, googleLink from LocationReference where ' +
                  'accountId=uuid_to_bin(?) and locationId=?', [accountId, customer.locationId]);
                locationReferenceData = Utils.filteredResponsePool(locationReferenceData);
                if (!locationReferenceData) {
                    debug('err', err);
                    return cb(null, customer);
                }
                var customerWithLocation = Object.assign(customer, locationReferenceData);
                return cb(null, customerWithLocation);
            }

            return cb(null, customer);
        } catch (err) {
            debug('err', err);
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            if (err.code) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    /*
    * Get customer by id
    * */
    getCustomerById: function (options) {
        return new Promise(async function (resolve, reject) {
            var id = options.id;
            var err;
            try {
                var conn = await connection.getConnection();
                var customer = await conn.query('select * from Customers ' +
                  ' where id=uuid_to_bin(?) and isActive = 1;', [id]);
                customer = Utils.filteredResponsePool(customer);
                if (!customer) {
                    err = new Error(ErrorConfig.MESSAGE.CUSTOMER_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }
                return resolve(customer);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    updateMD: async function (options, auditOptions, errorOptions, cb) {
        var updatedAt = options.updatedAt;
        var saveAsLater = options.saveAsLater;
        var useExisting = options.useExisting;
        var phone = options.phone;
        var dialCode = options.dialCode;
        var phoneCountry = options.phoneCountry;
        var primaryMobile = options.primaryMobile;
        var primaryMobileDialCode = options.primaryMobileDialCode;
        var primaryMobileCountry = options.primaryMobileCountry;
        var secondaryMobile = options.secondaryMobile;
        var secondaryMobileDialCode = options.secondaryMobileDialCode;
        var secondaryMobileCountry = options.secondaryMobileCountry;
        var err, customer;

        if (DataUtils.isUndefined(options.accountId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
        } else if (DataUtils.isUndefined(options.id)) {
            err = new Error(ErrorConfig.MESSAGE.CUSTOMER_ID_REQUIRED);
        } else if (DataUtils.isValidateOptionalField(options.updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.CUSTOMER_UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.CUSTOMER_UPDATED_AT_MUST_BE_NUMBER);
        } else if (updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.CUSTOMER_UPDATED_AT_INVALID);
        } else if (DataUtils.isDefined(options.email) || options.email === '') {
            err = new Error(ErrorConfig.MESSAGE.CAN_NOT_UPDATE_EMAIL);
        } else if (!DataUtils.isValidateOptionalField(options.firstName) && options.firstName === '') {
            err = new Error(ErrorConfig.MESSAGE.CUSTOMER_FIRST_NAME_CAN_NOT_EMPTY);
        } else if (!DataUtils.isValidateOptionalField(options.lastName) && options.lastName === '') {
            err = new Error(ErrorConfig.MESSAGE.CUSTOMER_LAST_NAME_CAN_NOT_EMPTY);
        } else if (!DataUtils.isValidateOptionalField(options.companyName) && options.companyName === '') {
            err = new Error(ErrorConfig.MESSAGE.CUSTOMER_COMPANY_NAME_CAN_NOT_EMPTY);
        } else if (!DataUtils.isValidateOptionalField(options.customerId)) {
            err = new Error(ErrorConfig.MESSAGE.INVALID_REQUEST);
        }
        if (err) {
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
        if (DataUtils.isDefined(phone) || DataUtils.isDefined(dialCode) || DataUtils.isDefined(phoneCountry)) {
            if (DataUtils.isUndefined(phone)) {
                err = new Error(ErrorConfig.MESSAGE.PHONE_NUMBER_REQUIRED);
            } else if (DataUtils.isUndefined(dialCode)) {
                err = new Error(ErrorConfig.MESSAGE.DIAL_CODE_REQUIRED);
            } else if (DataUtils.isUndefined(phoneCountry)) {
                err = new Error(ErrorConfig.MESSAGE.PHONE_COUNTRY_REQUIRED);
            }
            if (err) {
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
        }
        if (DataUtils.isDefined(primaryMobile) || DataUtils.isDefined(primaryMobileDialCode) || DataUtils.isDefined(primaryMobileCountry)) {
            debug('Insid eif ');
            if (DataUtils.isUndefined(primaryMobile)) {
                err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_REQUIRED);
            } else if (DataUtils.isUndefined(primaryMobileDialCode)) {
                err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_DIAL_CODE_REQUIRED);
            } else if (DataUtils.isUndefined(primaryMobileCountry)) {
                err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_COUNTRY_REQUIRED);
            }
            if (err) {
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
        }
        if (DataUtils.isDefined(secondaryMobile) || DataUtils.isDefined(secondaryMobileDialCode) || DataUtils.isDefined(secondaryMobileCountry)) {
            if (DataUtils.isUndefined(secondaryMobile)) {
                err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_REQUIRED);
            } else if (DataUtils.isUndefined(secondaryMobileDialCode)) {
                err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_DIAL_CODE_REQUIRED);
            } else if (DataUtils.isUndefined(secondaryMobileCountry)) {
                err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_COUNTRY_REQUIRED);
            }
            if (err) {
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
        }

        if (useExisting && DataUtils.isUndefined(options.locationId)) {
            err = new Error(ErrorConfig.MESSAGE.SELECT_ANY_LOCATION_ID);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        var response, customerFields, customerOptionalValues, customerLocFields, customerLocValues;
        var currentDate = new Date().getTime();

        if (saveAsLater) {

            if (DataUtils.isUndefined(options.newLocationId)) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_LOCATION_ID_REQUIRED);
            }
            if (!err && !DataUtils.isString(options.newLocationId)) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_NEW_LOCATION_ID_MUST_BE_STRING);
            }
            if (!err && options.newLocationId.length > 40) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_NEW_LOCATION_ID_MUST_BE_LESS_THAN_40_CHARACTER);
            }
            if (!err && DataUtils.isUndefined(options.newLocationName)) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_LOCATION_NAME_REQUIRED);
            }
            if (!err && !DataUtils.isString(options.newLocationName)) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_NEW_LOCATION_NAME_MUST_BE_STRING);
            }
            if (!err && options.newLocationName.length > 60) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_NEW_LOCATION_NAME_MUST_BE_LESS_THEN_60_CHARACTER);
            }

            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);
                return cb(err);
            }

            try {
                await conn.query('START TRANSACTION');
                customer = await Customer.getCustomerById({id: options.id});

                options.addressLine1 = options.addressLine1 || customer.addressLine1;
                options.addressLine2 = options.addressLine2 || customer.addressLine2;
                options.addressLine3 = options.addressLine3 || customer.addressLine3;
                options.city = options.city || customer.city;
                options.zipCode = options.zipCode || customer.zipCode;
                options.state = options.state || customer.state;
                options.country = options.country || customer.country;

                response = await Customer.validateOptionalFields(options);

                customerFields = response.customerFields;
                customerOptionalValues = response.customerOptionalValues;
                customerLocFields = response.customerLocFields;
                customerLocValues = response.customerLocValues;

                if (DataUtils.isDefined(options.customerId)) {
                    customerFields += 'customerId = ?,';
                    customerOptionalValues.push(options.customerId);

                }

                var query =
                  'IF EXISTS (SELECT 1 from LocationReference where accountId = uuid_to_bin(?) and locationId = ?)' +
                  'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "DUPLICATE_LOCATION_CREATION";' +
                  'ELSE INSERT into LocationReference SET accountId = uuid_to_bin(?),locationId = ?,locationName = ?,' +
                  'createdBy = uuid_to_bin(?),' + customerLocFields + 'createdAt = ?,updatedAt = ?;end IF';

                var params = [options.accountId, options.newLocationId, options.accountId, options.newLocationId,
                    options.newLocationName, options.userId].concat(customerLocValues).concat([currentDate, currentDate]);

                var locationInserted = await conn.query(query, params);


                if (!Utils.isAffectedPool(locationInserted)) {
                    err = new Error(ErrorConfig.MESSAGE.CUSTOMER_LOCATION_CREATION_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }

                query =
                  'IF NOT EXISTS(SELECT 1 from Customers  where id = uuid_to_bin(?) and isActive = 1)' +
                  'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4002,MESSAGE_TEXT = "CUSTOMER_ID_INVALID";' +
                  'ELSEIF NOT EXISTS (SELECT 1 from Customers where id = uuid_to_bin(?) and updatedAt = ?)' +
                  'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4003,MESSAGE_TEXT = "CUSTOMER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED";';

                params = [options.id, options.id, options.updatedAt];

                if (DataUtils.isDefined(options.email)) {
                    query += 'ELSEIF EXISTS (SELECT 1 from Customers where email = ? and accountId = uuid_to_bin(?) and id != uuid_to_bin(?))' +
                      'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4004,MESSAGE_TEXT = "EMAIL_EXIST_WITH_OTHER_CUSTOMER";';

                    params.push(options.email, options.accountId, options.id);
                }

                if (DataUtils.isDefined(options.customerId)) {
                    query += 'ELSEIF EXISTS (SELECT 1 from Customers where customerId = ? and  accountId = uuid_to_bin(?) and id != uuid_to_bin(?))' +
                      'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4005,MESSAGE_TEXT = "CUSTOMER_CUSTOMERID_ALREADY_EXISTS_WITH_OTHER_CUSTOMER";';

                    params.push(options.customerId, options.accountId, options.id);
                }

                query += 'ELSE UPDATE Customers SET locationId = ?,locationName=?,updatedBy = uuid_to_bin(?),' + customerFields + 'updatedAt = ? ' +
                  'where id = uuid_to_bin(?) and updatedAt = ?;end IF';

                params = params.concat([options.newLocationId, options.newLocationName, options.userId]).concat(customerOptionalValues).concat([currentDate, options.id, updatedAt]);

                var customerUpdated = await conn.query(query, params);

                if (!Utils.isAffectedPool(customerUpdated)) {
                    err = new Error(ErrorConfig.MESSAGE.CUSTOMER_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }

                await conn.query('COMMIT;');
                AuditUtils.create(auditOptions);
                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.CUSTOMER_UPDATE_SUCCESS,
                    id: options.id,
                    updatedAt: currentDate
                });

            } catch (err) {

                await conn.query('ROLLBACK;');
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);

                if (err.errno === 4001) {

                    err = new Error(ErrorConfig.MESSAGE.DUPLICATE_LOCATION_CREATION);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;

                } else if (err.errno === 4002) {
                    err = new Error(ErrorConfig.MESSAGE.CUSTOMER_ID_INVALID);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;


                } else if (err.errno === 4003) {
                    err = new Error(ErrorConfig.MESSAGE.CUSTOMER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;

                } else if (err.errno === 4004) {
                    err = new Error(ErrorConfig.MESSAGE.EMAIL_EXIST_WITH_OTHER_CUSTOMER);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;

                } else if (err.errno === 4005) {
                    err = new Error(ErrorConfig.MESSAGE.CUSTOMER_CUSTOMERID_ALREADY_EXISTS_WITH_OTHER_CUSTOMER);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;

                } else if (err.errno) {

                    err = new Error(ErrorConfig.MESSAGE.CUSTOMER_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                }
                return cb(err);
            }

        } else {
            try {
                await conn.query('START TRANSACTION');
                response = await Customer.validateOptionalFields(options);

                customerFields = response.customerFields;
                customerOptionalValues = response.customerOptionalValues;
                customerLocFields = response.customerLocFields;
                customerLocValues = response.customerLocValues;

                if (DataUtils.isDefined(options.customerId)) {
                    customerFields += 'customerId = ?,';
                    customerOptionalValues.push(options.customerId);
                }

                if (options.locationId) {

                    query =
                      'IF NOT EXISTS(SELECT 1 from Customers  where id = uuid_to_bin(?) and isActive = 1)' +
                      'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "CUSTOMER_ID_INVALID";' +
                      'ELSEIF NOT EXISTS (SELECT 1 from Customers where id = uuid_to_bin(?) and updatedAt = ?)' +
                      'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4002,MESSAGE_TEXT = "CUSTOMER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED";';

                    params = [options.id, options.id, options.updatedAt];

                    if (DataUtils.isDefined(options.email)) {
                        query += 'ELSEIF EXISTS (SELECT 1 from Customers where email = ? and accountId = uuid_to_bin(?) and id != uuid_to_bin(?))' +
                          'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4003,MESSAGE_TEXT = "EMAIL_EXIST_WITH_OTHER_CUSTOMER";';

                        params.push(options.email, options.accountId, options.id);
                    }

                    if (DataUtils.isDefined(options.customerId)) {
                        query += 'ELSEIF EXISTS (SELECT 1 from Customers where customerId = ? and  accountId = uuid_to_bin(?) and id != uuid_to_bin(?))' +
                          'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4004,MESSAGE_TEXT = "CUSTOMER_CUSTOMERID_ALREADY_EXISTS_WITH_OTHER_CUSTOMER";';

                        params.push(options.customerId, options.accountId, options.id);
                    }

                    query += 'ELSE UPDATE Customers SET locationId = ?,updatedBy = uuid_To_bin(?),addressLine1 = "",addressLine2 = "",addressLine3 = "",city = "",zipCode = "",state = "",' +
                      'country = "",' + customerFields + 'updatedAt = ? where id = uuid_to_bin(?) and updatedAt = ?;end IF';

                    params = params.concat([options.locationId, options.userId]).concat(customerOptionalValues).concat([currentDate, options.id, updatedAt]);

                    customerUpdated = await conn.query(query, params);

                    if (!Utils.isAffectedPool(customerUpdated)) {
                        err = new Error(ErrorConfig.MESSAGE.CUSTOMER_UPDATE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                        throw err;
                    }

                    await conn.query('COMMIT;');
                    AuditUtils.create(auditOptions);
                    return cb(null, {
                        OK: Constants.SUCCESS_MESSAGE.CUSTOMER_UPDATE_SUCCESS,
                        id: options.id,
                        updatedAt: currentDate
                    });

                } else {

                    query =
                      'IF NOT EXISTS(SELECT 1 from Customers  where id = uuid_to_bin(?) and isActive = 1)' +
                      'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "CUSTOMER_ID_INVALID";' +
                      'ELSEIF NOT EXISTS (SELECT 1 from Customers where id = uuid_to_bin(?) and updatedAt = ?)' +
                      'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4002,MESSAGE_TEXT = "CUSTOMER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED";';

                    params = [options.id, options.id, options.updatedAt];

                    if (DataUtils.isDefined(options.email)) {
                        query += 'ELSEIF EXISTS (SELECT 1 from Customers where email = ? and accountId = uuid_to_bin(?) and id != uuid_to_bin(?))' +
                          'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4003,MESSAGE_TEXT = "EMAIL_EXIST_WITH_OTHER_CUSTOMER";';

                        params.push(options.email, options.accountId, options.id);
                    }

                    if (DataUtils.isDefined(options.customerId)) {
                        query += 'ELSEIF EXISTS (SELECT 1 from Customers where customerId = ? and  accountId = uuid_to_bin(?) and id != uuid_to_bin(?))' +
                          'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4004,MESSAGE_TEXT = "CUSTOMER_CUSTOMERID_ALREADY_EXISTS_WITH_OTHER_CUSTOMER";';

                        params.push(options.customerId, options.accountId, options.id);
                    }

                    query += 'ELSE UPDATE Customers SET updatedBy = uuid_To_bin(?),' + customerFields + customerLocFields + 'updatedAt = ? ' +
                      'where id = uuid_to_bin(?) and updatedAt = ?;end IF';

                    /*query += 'ELSE UPDATE Customers SET locationId = "",updatedBy = uuid_To_bin(?),' + customerFields + customerLocFields + 'updatedAt = ? ' +
                      'where id = uuid_to_bin(?) and updatedAt = ?;end IF';*/

                    params = params.concat([options.userId]).concat(customerOptionalValues).concat(customerLocValues).concat([currentDate, options.id, updatedAt]);

                    customerUpdated = await conn.query(query, params);
                    if (!Utils.isAffectedPool(customerUpdated)) {
                        err = new Error(ErrorConfig.MESSAGE.CUSTOMER_UPDATE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                        throw err;
                    }
                    await conn.query('COMMIT;');
                    AuditUtils.create(auditOptions);
                    return cb(null, {
                        OK: Constants.SUCCESS_MESSAGE.CUSTOMER_UPDATE_SUCCESS,
                        id: options.id,
                        updatedAt: currentDate
                    });
                }
            } catch (err) {

                await conn.query('ROLLBACK;');
                debug('err', err);
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);

                if (err.errno === 4001) {
                    err = new Error(ErrorConfig.MESSAGE.CUSTOMER_ID_INVALID);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                } else if (err.errno === 4002) {
                    err = new Error(ErrorConfig.MESSAGE.CUSTOMER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                } else if (err.errno === 4003) {
                    err = new Error(ErrorConfig.MESSAGE.EMAIL_EXIST_WITH_OTHER_CUSTOMER);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                } else if (err.errno === 4004) {
                    err = new Error(ErrorConfig.MESSAGE.CUSTOMER_CUSTOMERID_ALREADY_EXISTS_WITH_OTHER_CUSTOMER);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                } else if (err.errno) {
                    err = new Error(ErrorConfig.MESSAGE.CUSTOMER_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                }
                return cb(err);
            }
        }
    },
    /*
    * Get existing customers by id
    * */
    getExistCustomerIds: function (options) {
        return new Promise(async function (resolve, reject) {
            var customers = options.customers;
            var accountId = options.accountId;
            var successCustomers = [], conflictCustomers = [];

            try {
                var conn = await connection.getConnection();

                var response = await Customer.manipulateQuery({customers: customers});
                debug('response', response);

                var customerIds = await conn.query('select  CAST(uuid_from_bin(id) as CHAR) as id from Customers ' +
                  ' where accountId=uuid_to_bin(?) and id in (' + response.string + ')', [accountId].concat(response.values));

                customerIds = _.map(customerIds, 'id');

                if (customerIds.length > 0) {
                    _.map(customers, function (customer) {
                        if (customerIds.indexOf(customer.id) === -1) {
                            conflictCustomers.push(customer.id);
                        } else {
                            successCustomers.push(customer);
                        }
                    });
                } else {
                    conflictCustomers = _.map(customers, 'id');
                }
                var customerResponse = {
                    successCustomers: successCustomers,
                    conflictCustomers: conflictCustomers
                };
                debug('customerresponse', customerResponse);
                return resolve(customerResponse);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },
    /*
    * check updatedAt field of customers
    * */
    checkUpdatedAt: function (options) {
        return new Promise(async function (resolve, reject) {
            var customers = options.customers;
            var accountId = options.accountId;
            var string = '', values = [];
            var conflict = [], success = [], failed = [];
            var conflictIds = [];
            var existCustomers = [];

            try {
                var conn = await connection.getConnection();
                var getExistCustomerOption = {
                    customers: customers,
                    accountId: accountId
                };
                var getExistCustomerResponse = await Customer.getExistCustomerIds(getExistCustomerOption);
                existCustomers = getExistCustomerResponse.successCustomers;
                conflict = getExistCustomerResponse.conflictCustomers;
                failed = conflict.slice();
                debug('exist', getExistCustomerResponse);
                if (existCustomers.length <= 0) {
                    return resolve({success: success, conflict: conflict, failed: failed});
                }


                await Promise.each(existCustomers, function (customer) {
                    string += ' SELECT CAST(uuid_from_bin(id) as char) as id FROM Customers WHERE (updatedAt != ? AND id = uuid_to_bin(?)) UNION ALL ';
                    values.push(customer.updatedAt, customer.id);
                });
                string = string.replace(/UNION ALL \s*$/, ' ');

                var response = await conn.query(string, values);

                conflictIds = _.map(response, function (value) {
                    return value.id;
                });

                _.map(existCustomers, function (customer) {
                    if (conflictIds.indexOf(customer.id) === -1) {
                        success.push(customer);
                    } else {
                        conflict.push(customer.id);
                    }
                });
                debug('success', success, 'conflict', conflict);
                return resolve({success: success, conflict: conflict, failed: failed});
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    manipulateQuery: function (options) {
        return new Promise(function (resolve, reject) {
            var customers = options.customers;
            var string = '', values = [];

            _.map(customers, function (customer) {
                string += 'uuid_to_bin(?),';
                values.push(customer.id);
            });
            string = string.replace(/,\s*$/, ' ');
            return resolve({
                string: string,
                values: values
            });
        });
    },

    /*
    * update customers with isActive=false
    * */
    updateCustomers: function (options) {
        return new Promise(async function (resolve, reject) {
            var customers = options.customers;
            var accountId = options.accountId;
            var userId = options.userId;
            var updatedAt = DataUtils.getEpochMSTimestamp();
            var err;

            try {
                var conn = await connection.getConnection();

                var queryResponse = await Customer.manipulateQuery({customers: customers});

                var isUpdated = await conn.query('update Customers set isActive = 0, updatedAt = ?, updatedBy=uuid_to_bin(?) ' +
                  ' where accountId = uuid_to_bin(?) and id in (' + queryResponse.string + ');',
                  [updatedAt, userId, accountId].concat(queryResponse.values));
                isUpdated = Utils.isAffectedPool(isUpdated);
                debug('isUpdated', isUpdated);
                if (!isUpdated) {
                    err = new Error(ErrorConfig.MESSAGE.CUSTOMER_ARCHIEVE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_ARCHIEVE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    updateRestoreCustomers: function (options) {
        return new Promise(async function (resolve, reject) {
            var customers = options.customers;
            var accountId = options.accountId;
            var userId = options.userId;
            var updatedAt = DataUtils.getEpochMSTimestamp();
            var err;

            try {
                var conn = await connection.getConnection();

                var queryResponse = await Customer.manipulateQuery({customers: customers});

                var isUpdated = await conn.query('update Customers set isActive = 1, updatedAt = ?, updatedBy=uuid_to_bin(?) ' +
                  ' where accountId = uuid_to_bin(?) and id in (' + queryResponse.string + ');',
                  [updatedAt, userId, accountId].concat(queryResponse.values));
                isUpdated = Utils.isAffectedPool(isUpdated);
                debug('isUpdated', isUpdated);

                if (!isUpdated) {
                    err = new Error(ErrorConfig.MESSAGE.CUSTOMER_RESTORE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_RESTORE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    deleteCustomer: function (options) {
        return new Promise(async function (resolve, reject) {
            var customers = options.customers;
            var accountId = options.accountId;
            var err;

            try {
                var conn = await connection.getConnection();

                var queryResponse = await Customer.manipulateQuery({customers: customers});

                var isDeleted = await conn.query('delete from Customers where accountId = uuid_to_bin(?) and isActive = 0 ' +

                  ' and id in (' + queryResponse.string + ');',
                  [accountId].concat(queryResponse.values));

                isDeleted = Utils.isAffectedPool(isDeleted);

                if (!isDeleted) {
                    err = new Error(ErrorConfig.MESSAGE.CUSTOMER_DELETE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_DELETE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
    * Notify to the auth user of deleted customers
    * */
    notifyCustomers: function (options) {
        return new Promise(async function (resolve, reject) {
            var checkResponses = options.checkResponses;
            var userId = options.userId;

            try {
                await Promise.each(checkResponses, async function (checkResponse) {
                    if (checkResponse.notifyFlag) {
                        var NotificationApi = require('../api/notification');

                        var inviterUser = await Customer.getUserById({userId: userId});

                        var authUsers = await Customer.getAuthorizeUser({accountId: checkResponse.partnerId});

                        var date = new Date();

                        var invitationExpirationDate = date.setDate(date.getDate() + Constants.INVITATION_EXPIRATION_DATE_LIMIT);
                        invitationExpirationDate = new Date(invitationExpirationDate);

                        await Promise.each(authUsers, async function (user) {
                            var inviteeUser = await Customer.getUserByIdMD({
                                userId: user.userId,
                                notifyType: Constants.NOTIFICATION_CATEGORY_TYPE.PARTNERS
                            });

                            var opt = {
                                languageCultureCode: inviterUser.languageCultureCode,
                                template: Constants.EMAIL_TEMPLATES.DELETE_CUSTOMER,
                                email: inviteeUser.email
                            };

                            var compileOptions = {
                                name: inviteeUser.firstName,
                                friend: inviterUser.email,
                                scopehub_login: ''
                            };

                            try {
                                var notifyFlag = JSON.parse(inviteeUser.notifyFlag);
                                // SEND EMAIL
                                if (notifyFlag.email === 1) {
                                    await EmailUtils.sendEmailPromise(opt, compileOptions);
                                }
                                if (notifyFlag.notification === 1) {
                                    var notificationOption = {
                                        refereId: checkResponse.id, //id of delete customer
                                        refereType: Constants.NOTIFICATION_REFERE_TYPE.CUSTOMER,
                                        user_ids: [inviteeUser.id],
                                        topic_id: inviteeUser.id,
                                        notificationExpirationDate: invitationExpirationDate,
                                        paramasDateTime: new Date(),
                                        notification_reference: NotificationReferenceData.CUSTOMER_DELETE,
                                        metaEmail: inviterUser.email,
                                        paramsInviter: inviterUser.email + ', ' + (inviterUser.firstName ? inviterUser.firstName : '') + ' ' + (inviterUser.lastName ? inviterUser.lastName : ''),
                                        paramsInvitee: inviteeUser.email + ', ' + (inviteeUser.firstName ? inviteeUser.firstName : '') + ' ' + (inviteeUser.lastName ? inviteeUser.lastName : ''),
                                        languageCultureCode: inviteeUser.languageCultureCode,
                                        createdBy: inviterUser.id,
                                        type: Constants.DEFAULT_NOTIFICATION_TYPE
                                    };
                                    if (inviterUser.firstName) {
                                        notificationOption.metaName = inviterUser.firstName;
                                    }
                                    await NotificationApi.createMD(notificationOption);
                                }
                            } catch (err) {
                                debug('err', err);
                                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_DELETE_FAILED);
                                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                                return reject(err);
                            }
                        });
                    }
                });
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    validateCustomers: function (options) {
        return new Promise(async function (resolve, reject) {
            var customers = options.customers;
            var err;
            try {
                if (DataUtils.isUndefined(customers)) {
                    err = new Error(ErrorConfig.MESSAGE.ID_REQUIRED);
                } else if (!DataUtils.isArray(customers)) {
                    err = new Error(ErrorConfig.MESSAGE.ID_MUST_BE_ARRAY);
                } else if (customers.length <= 0) {
                    err = new Error(ErrorConfig.MESSAGE.ATLEAST_ONE_ID_REUQIRED);
                }
                if (err) {
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }

                await Promise.each(customers, async function (customer) {
                    if (DataUtils.isUndefined(customer.id)) {
                        err = new Error(ErrorConfig.MESSAGE.CUSTOMER_ID_REQUIRED);
                    } else if (DataUtils.isValidateOptionalField(customer.updatedAt)) {
                        err = new Error(ErrorConfig.MESSAGE.CUSTOMER_UPDATED_AT_REQUIRED);
                    } else if (!DataUtils.isValidNumber(customer.updatedAt)) {
                        err = new Error(ErrorConfig.MESSAGE.CUSTOMER_UPDATED_AT_MUST_BE_NUMBER);
                    } else if (customer.updatedAt.toString().length !== 13) {
                        err = new Error(ErrorConfig.MESSAGE.CUSTOMER_UPDATED_AT_INVALID);
                    }
                    if (err) {
                        throw err;
                    }
                });
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return reject(err);
            }
        });
    },

    removeMD: async function (options, auditOptions, errorOptions, cb) {
        var customers = options.ids;
        var accountId = options.accountId;
        var userId = options.userId;
        var SupplierApi = require('./supplier');
        var successCustomer = [], conflictCustomer = [];
        var checkResponses = [];
        var err;

        try {
            debug('customers', customers);
            var checkOption = {
                customers: customers
            };
            var checkResponse = await Customer.validateCustomers(checkOption);
            debug('checkResponse', checkResponse);

        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            await conn.query('START TRANSACTION;');
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        try {
            // CHECK UPDATED AT
            var response = await Customer.checkUpdatedAt({customers: customers, accountId: accountId});
            successCustomer = response.success;
            conflictCustomer = response.conflict;

            if (successCustomer.length <= 0) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMERS_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {success: successCustomer, conflict: conflictCustomer};
                return cb(err);
            }

            // Check if any out share or inshare is exist for each parter , if yes then stop sharing for those partner

            await Promise.each(successCustomer, async function (customer) {
                var checkOptions = {
                    id: customer.id,
                    accountId: accountId,
                    userId: userId,
                    flag: false
                };
                var checkResponse = await SupplierApi.checkOutShareInShare(checkOptions);
                if (checkResponse) {
                    checkResponses.push(checkResponse);
                }
            });

            // DELETE MULTIPLE CUSTOMERS
            var deleteCustomersOption = {
                customers: successCustomer,
                accountId: accountId,
                userId: userId
            };
            var deleteResponse = await Customer.updateCustomers(deleteCustomersOption);
            debug('deleteResponse', deleteResponse);

            // NOTIFY ALL AUTH  USER OF CUSTOMERS
            var notifyOption = {
                checkResponses: checkResponses,
                userId: userId
            };
            var notifyResposne = await Customer.notifyCustomers(notifyOption);
            debug('notifyResposne', notifyResposne);

            debug('COMMIT');
            await conn.query('COMMIT;');
            AuditUtils.create(auditOptions);
            if (successCustomer.length > 0 && conflictCustomer.length > 0) {
                debug('inside if');
                err = new Error(ErrorConfig.MESSAGE.CUSTOMERS_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {
                    successMsg: Constants.SUCCESS_MESSAGE.CUSTOMERS_ARCHIEVED_SUCCESSFULLY,
                    success: _.map(successCustomer, 'id'),
                    conflict: conflictCustomer
                };
                debug('err');
                return cb(err);
            } else {
                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.CUSTOMERS_ARCHIEVED_SUCCESSFULLY,
                    success: _.map(successCustomer, 'id')
                });
            }
        } catch (err) {
            debug('err', err);
            debug('ROLLBACK');
            await conn.query('ROLLBACK;');
            ErrorUtils.create(errorOptions, options, err);
            if (err.errno === 4002) {
                return cb(err);
            } else {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_ARCHIEVE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    restore: async function (options, auditOptions, errorOptions, cb) {
        var customers = options.ids;
        var accountId = options.accountId;
        var userId = options.userId;
        var successCustomer = [], conflictCustomer = [];
        var err;

        try {
            debug('customers', customers);
            var checkOption = {
                customers: customers
            };
            var checkResponse = await Customer.validateCustomers(checkOption);
            debug('checkResponse', checkResponse);

        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            await conn.query('START TRANSACTION;');
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        try {
            // CHECK UPDATED AT
            var response = await Customer.checkUpdatedAt({customers: customers, accountId: accountId});
            successCustomer = response.success;
            conflictCustomer = response.conflict;

            if (successCustomer.length <= 0) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMERS_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {success: successCustomer, conflict: conflictCustomer};
                return cb(err);
            }

            // RESTORE MULTIPLE CUSTOMERS
            var restoreCustomersOption = {
                customers: successCustomer,
                accountId: accountId,
                userId: userId
            };
            var restoreResponse = await Customer.updateRestoreCustomers(restoreCustomersOption);
            debug('restoreResponse', restoreResponse);

            debug('COMMIT');
            await conn.query('COMMIT;');
            AuditUtils.create(auditOptions);
            if (successCustomer.length > 0 && conflictCustomer.length > 0) {
                debug('inside if');
                err = new Error(ErrorConfig.MESSAGE.CUSTOMERS_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {
                    successMsg: Constants.SUCCESS_MESSAGE.CUSTOMERS_RESTORED_SUCCESSFULLY,
                    success: _.map(successCustomer, 'id'),
                    conflict: conflictCustomer
                };
                debug('err');
                return cb(err);
            } else {
                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.CUSTOMERS_RESTORED_SUCCESSFULLY,
                    success: _.map(successCustomer, 'id')
                });
            }
        } catch (err) {
            debug('err', err);
            debug('ROLLBACK');
            await conn.query('ROLLBACK;');
            ErrorUtils.create(errorOptions, options, err);
            if (err.errno === 4002) {
                return cb(err);
            } else {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_RESTORE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    delete: async function (options, auditOptions, errorOptions, cb) {
        var customers = options.ids;
        var accountId = options.accountId;
        var userId = options.userId;
        var successCustomer = [], conflictCustomer = [];
        var err;

        try {
            debug('customers', customers);
            var checkOption = {
                customers: customers
            };
            var checkResponse = await Customer.validateCustomers(checkOption);
            debug('checkResponse', checkResponse);

        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            await conn.query('START TRANSACTION;');
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        try {
            // CHECK UPDATED AT
            var response = await Customer.checkUpdatedAt({customers: customers, accountId: accountId});
            successCustomer = response.success;
            conflictCustomer = response.conflict;

            if (successCustomer.length <= 0) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMERS_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {success: successCustomer, conflict: conflictCustomer};
                return cb(err);
            }

            // DELETE MULTIPLE CUSTOMERS
            var deleteCustomersOption = {
                customers: successCustomer,
                accountId: accountId,
                userId: userId
            };
            var deleteResponse = await Customer.deleteCustomer(deleteCustomersOption);
            debug('deleteResponse', deleteResponse);

            debug('COMMIT');
            await conn.query('COMMIT;');
            AuditUtils.create(auditOptions);
            if (successCustomer.length > 0 && conflictCustomer.length > 0) {
                debug('inside if');
                err = new Error(ErrorConfig.MESSAGE.CUSTOMERS_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {
                    successMsg: Constants.SUCCESS_MESSAGE.CUSTOMERS_DELETED_SUCCESSFULLY,
                    success: _.map(successCustomer, 'id'),
                    conflict: conflictCustomer
                };
                debug('err');
                return cb(err);
            } else {
                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.CUSTOMERS_DELETED_SUCCESSFULLY,
                    success: _.map(successCustomer, 'id')
                });
            }
        } catch (err) {
            debug('err', err);
            debug('ROLLBACK');
            await conn.query('ROLLBACK;');
            ErrorUtils.create(errorOptions, options, err);
            if (err.errno === 4002) {
                return cb(err);
            } else {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_DELETE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    getCustomersByAccountIdCustomerIds: function (options, cb) {
        var accountIdCustomersIds = options.accountIdCustomersIds;
        var accountId = options.accountId;
        var err;
        if (DataUtils.isUndefined(accountId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
        }
        if (!DataUtils.isArray(accountIdCustomersIds)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_CUSTOMERS_IDS_INVALID);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        if (accountIdCustomersIds.length === 0) {
            return cb(null, []);
        }
        CustomerModel.query(accountId)
          .usingIndex(Constants.CUSTOMER_ACCOUNT_INDEX)
          .filter('accountIdCustomerId').in(accountIdCustomersIds)
          .exec(function (err, data) {
              if (err) {
                  err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                  return cb(err);
              }
              var customersList = _.map(data.Items, 'attrs');
              return cb(null, customersList);
          });
    },

    getAuthorizeUser: function (options) {
        return new Promise(async function (resolve, reject) {
            var accountId = options.accountId;
            var err;

            try {
                var conn = await connection.getConnection();

                var account = await conn.query('SELECT CAST(uuid_from_bin(id) as char) as id, companyName, email,' +
                  ' status from accounts where id = uuid_to_bin(?) and status = "active"', [accountId]);

                account = Utils.filteredResponsePool(account);
                debug('account', account);

                /*if (!account) {
                    err = new Error(ErrorConfig.MESSAGE.ACCOUNT_DISABLED);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    throw err;
                }*/

                var query = 'select CAST(uuid_from_bin(userId) as char) as userId ,CAST(uuid_from_bin(roleId) as char) as roleId from user_roles ' +
                  'where userId in (select id from users where accountId = uuid_to_bin(?)) and ' +
                  'roleId in (select id from Roles where title in ("account admin", "account owner"))';
                var authUsers = await conn.query(query, [accountId]);

                return resolve(authUsers);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    getUserById: function (options) {
        return new Promise(async function (resolve, reject) {
            var userId = options.userId;
            debug('userId', userId);
            var err;
            try {
                var conn = await connection.getConnection();

                var user = await conn.query('select CAST(uuid_from_bin(id) as char) as id,status,flag,postRegComplete,firstName,lastName,' +
                  'tosStatus, email,languageCultureCode from users where id = uuid_to_bin(?) and (status = ? or status = ?)',
                  [userId, Constants.USER_STATUS.ACTIVE, Constants.USER_STATUS.TEMPORARY]);
                user = Utils.filteredResponsePool(user);
                if (!user) {
                    err = new Error(ErrorConfig.MESSAGE.USER_NOT_EXISTS);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }
                return resolve(user);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.USER_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    getUserByIdMD: function (options) {
        return new Promise(async function (resolve, reject) {
            var userId = options.userId;
            var notifyType = options.notifyType;
            debug('userId', userId);
            var err;
            try {
                var conn = await connection.getConnection();

                var user = await conn.query('select CAST(uuid_from_bin(U.id) as char) as id,U.status,U.flag,U.postRegComplete,' +
                  ' U.firstName,U.lastName,U.tosStatus, U.email,U.languageCultureCode,UP.flag as notifyFlag from users U,userPreferences UP ' +
                  ' where U.id = uuid_to_bin(?) and (U.status = ? or U.status = ?) and UP.userId = U.id and UP.type = ?;',
                  [userId, Constants.USER_STATUS.ACTIVE, Constants.USER_STATUS.TEMPORARY, notifyType]);
                user = Utils.filteredResponsePool(user);
                if (!user) {
                    err = new Error(ErrorConfig.MESSAGE.USER_NOT_EXISTS);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }
                return resolve(user);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.USER_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },


    sendNotification: function (options) {
        return new Promise(async function (resolve, reject) {
            debug('options', options);
            var userId = options.userId;
            var inviterUser = options.inviterUser;
            var id = options.id;
            var notificationExpirationDate = options.notificationExpirationDate;
            var date = new Date();
            var err;

            var user = await Customer.getUserById({userId: userId});
            var compileOptions = {
                name: user.firstName,
                friend: inviterUser.email,
                scopehub_login: Endpoints.SCOPEHUB_LOGIN_URL
            };
            var opt = {
                languageCultureCode: inviterUser.languageCultureCode,
                template: Constants.EMAIL_TEMPLATES.CUSTOMER_INVITE,
                email: user.email
            };

            if (user.status === Constants.USER_STATUS.ACTIVE || user.status === Constants.USER_STATUS.TEMPORARY) {

                /*EmailUtils.sendEmailMD(opt, compileOptions, async function (err) {

                    if (err) {
                        return reject(err);
                    }*/
                try {
                    await EmailUtils.sendEmailPromise(opt, compileOptions);

                    debug('user', user);
                    var NotificationApi = require('../api/notification');
                    var notificationOption = {
                        refereId: id,
                        refereType: Constants.NOTIFICATION_REFERE_TYPE.CUSTOMER,
                        user_ids: [user.id],
                        topic_id: user.id,
                        notificationExpirationDate: notificationExpirationDate,
                        paramasDateTime: new Date(),
                        notification_reference: NotificationReferenceData.CUSTOMER_INVITE,
                        metaEmail: inviterUser.email,
                        paramsInviter: inviterUser.email + ', ' + (inviterUser.firstName ? inviterUser.firstName : '') + ' ' + (inviterUser.lastName ? inviterUser.lastName : ''),
                        paramsInvitee: user.email + ', ' + (user.firstName ? user.firstName : '') + ' ' + (user.lastName ? user.lastName : ''),
                        languageCultureCode: user.languageCultureCode,
                        createdBy: inviterUser.id,
                        type: Constants.DEFAULT_NOTIFICATION_TYPE

                    };
                    if (inviterUser.firstName) {
                        notificationOption.metaName = inviterUser.firstName;
                    }
                    await NotificationApi.createMD(notificationOption);
                    return resolve({
                        OK: Constants.SUCCESS,
                        notificationExpirationDate: notificationExpirationDate
                    });
                } catch (err) {
                    debug('err', err);
                    err = new Error(ErrorConfig.MESSAGE.CUSTOMER_INVITE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
                /*});*/
            } else {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_INVITEE_IS_INACTIVE);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return reject(err);
            }
        });
    },


    inviteMD: async function (options, errorOptions, cb) {
        var accountId = options.user.accountId;
        var id = options.id;
        var updatedAt = options.updatedAt;
        var personalMessage = options.personalMessage || '';
        var email = options.email;
        var flag = options.flag;
        var inviterUser = options.user;
        var str = '';


        var err;

        if (DataUtils.isUndefined(accountId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
        } else if (DataUtils.isUndefined(id)) {
            err = new Error(ErrorConfig.MESSAGE.CUSTOMER_ID_REQUIRED);
        } else if (DataUtils.isUndefined(email)) {
            err = new Error(ErrorConfig.MESSAGE.CUSTOMER_EMAIL_REQUIRED);
        } else if (DataUtils.isValidateOptionalField(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.CUSTOMER_UPDATED_AT_REQUIRED);
        }

        if (err) {
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('err', err);
            return cb(err);
        }
        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        try {
            if (!options.addInviteFlag) {
                await conn.query('START TRANSACTION;');
            }

            var date = new Date();
            var currentDate = date.getTime();
            var params = [accountId, id, id, updatedAt, accountId, email, id, email];

            if ((personalMessage && !flag) || !flag) {
                str += 'personalMessage=?,';
                params.push(personalMessage);
            }
            params.push(currentDate, inviterUser.id, id, updatedAt);

            var query =
              'IF NOT EXISTS (SELECT 1 from Customers where accountId = uuid_to_bin(?) and id = uuid_to_bin(?) and isActive = 1)' +
              'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "CUSTOMER_ID_INVALID";' +
              'ELSEIF NOT EXISTS (SELECT 1 from Customers where id = uuid_to_bin(?) and updatedAt = ?)' +
              'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4002,MESSAGE_TEXT = "CUSTOMER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED";' +
              'ELSEIF EXISTS (SELECT 1 from Customers where accountId = uuid_to_bin(?) and email = ? and  id != uuid_to_bin(?))' +
              'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4003,MESSAGE_TEXT = "EMAIL_EXIST_WITH_OTHER_CUSTOMER";' +
              'ELSE UPDATE Customers SET email = ?,' + str + ' updatedAt = ?,updatedBy = uuid_to_bin(?)' +
              'where id = uuid_to_bin(?) and updatedAt = ?; end IF';

            var customerUpdated = await conn.query(query, params);
            if (!Utils.isAffectedPool(customerUpdated)) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_EMAIL_UPDATE_FALIED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            var getCustomerQuery = 'SELECT CAST(uuid_from_bin(id) as char) as id,CAST(uuid_from_bin(accountId) as char) as accountId,locationId,customerId,customerCode,customerName,companyName,firstName,lastName,' +
              'email,phone,fax,status,updatedAt,googleLink from Customers where accountId = uuid_to_bin(?) and id = uuid_to_bin(?) and isActive = 1;';
            var getCustomer = await conn.query(getCustomerQuery, [accountId, id]);
            getCustomer = Utils.filteredResponsePool(getCustomer);

            var userExist = await conn.query('select CAST(uuid_from_bin(id) as char) as id,CAST(uuid_from_bin(accountId) as char) as accountId,' +
              'status,flag,postRegComplete,tosStatus,email,languageCultureCode,emailStatus from users where email=?', email);

            var inviteeUserExists = Utils.filteredResponsePool(userExist);
            debug('invitee', inviteeUserExists);
            if (!inviteeUserExists) {

                var generatedId = Utils.generateId().uuid;

                var status = Constants.ACCOUNT_STATUS.TEMPORARY;
                var account = await conn.query('INSERT into accounts (id,status,createdAt,createdBy,updatedAt) values ' +
                  '(uuid_to_bin(?),?,utc_timestamp(3),uuid_to_bin(?),utc_timestamp(3))', [generatedId, status, inviterUser.id]);

                var isAccountAffected = Utils.isAffectedPool(account);
                if (!isAccountAffected) {
                    err = new Error(ErrorConfig.MESSAGE.ACCOUNT_CREATION_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }
                account = {};
                account.id = generatedId;
                debug('array', [email, Utils.generateId().uuid, getCustomer.firstName || '', getCustomer.lastName || '', email, inviterUser.languageCultureCode,
                    Constants.USER_STATUS.TEMPORARY, false, false, false, false, false, false, false, Constants.USER_FLAG.CUSTOMER_INVITATION, account.id, Constants.AUTHORIZE_USER_STATUS.OPEN]);
                var insertResponse = await conn.query('If NOT EXISTS (select 1 from users where email= ?) THEN ' +
                  'INSERT into users (id,firstName,lastName,email,languageCultureCode,status,postRegComplete,tosStatus,' +
                  'emailStatus,profileComplete,securityComplete,isAccountActive,' +
                  'isAccountEnabled,createdAt,updatedAt, flag, accountId, authorizeUserStatus)' +
                  'values(uuid_to_bin(?),?,?,?,?,?,?,?,?,?,?,?,?,utc_timestamp(3),utc_timestamp(3), ?, uuid_to_bin(?), ?); end if',
                  [email, Utils.generateId().uuid, getCustomer.firstName, getCustomer.lastName, email, inviterUser.languageCultureCode,
                      Constants.USER_STATUS.TEMPORARY, false, false, false, false, false, false, false, Constants.USER_FLAG.CUSTOMER_INVITATION, account.id, Constants.AUTHORIZE_USER_STATUS.OPEN]);

                var isUserAffected = Utils.isAffectedPool(insertResponse);
                debug('isUserAffected', isUserAffected);

                var userResponse = await conn.query('select CAST(uuid_from_bin(id) as char) as id,CAST(uuid_from_bin(accountId) as char) as accountId,' +
                  'status,flag,postRegComplete,tosStatus,email,languageCultureCode,emailStatus from users where email=?', email);
                inviteeUserExists = Utils.filteredResponsePool(userResponse);

                /*// if (isUserAffected) {
                //     var userResponse = await conn.query('select CAST(uuid_from_bin(id) as char) as id,CAST(uuid_from_bin(accountId) as char) as accountId,' +
                //       'status,flag,postRegComplete,tosStatus,email,languageCultureCode,emailStatus from users where email=?', email);
                //     inviteeUserExists = Utils.filteredResponsePool(userResponse);
                // } else {
                //     var userResponse = await conn.query('select CAST(uuid_from_bin(id) as char),CAST(uuid_from_bin(accountId) as char) as accountId,' +
                //       'status,flag,postRegComplete,tosStatus,email,languageCultureCode,emailStatus from users where email=?', email);
                //     inviteeUserExists = Utils.filteredResponsePool(userResponse);
                // }*/
            } else {
                var blackList = await Customer.checkBlackListMD({
                    inviteeUserExists: inviteeUserExists,
                    inviterUser: inviterUser
                });
                if (blackList) {
                    return cb();
                }
            }

            // UPDATE CUSTOMER WITH STATUS AND INVITATION EXPIRATION DATE
            var defaultDate = new Date();
            var customerInvitationExpirationDate = defaultDate.setDate(defaultDate.getDate() + Constants.CUSTOMER_INVITATION_EXPIRATION_DATE_LIMIT);
            customerInvitationExpirationDate = new Date(customerInvitationExpirationDate);


            // SEND NOTIFICATION TO ALL THE AUTHUSER OF CUSTOMERS ACCOUNT
            debug('inviteeUserExists', inviteeUserExists);
            var authUsers = await Customer.getAuthorizeUser({accountId: inviteeUserExists.accountId});

            if (!authUsers || authUsers.length <= 0) {
                var notificationOptions = {
                    userId: inviteeUserExists.id,
                    inviterUser: inviterUser,
                    id: id,
                    notificationExpirationDate: customerInvitationExpirationDate
                };
                var notificationResponse = await Customer.sendNotification(notificationOptions);
            } else {
                await Promise.each(authUsers, async function (inviteeUser) {
                    var notificationOptions = {
                        userId: inviteeUser.userId,
                        inviterUser: inviterUser,
                        id: id,
                        notificationExpirationDate: customerInvitationExpirationDate
                    };
                    var notificationResponse = await Customer.sendNotification(notificationOptions);
                });
            }

            var customerStatusUpdate = await conn.query('UPDATE Customers SET status = ?, invitationExpirationDate=?, updatedBy = uuid_to_bin(?), updatedAt = ?' +
              ' where id = uuid_to_bin(?)', [Constants.CUSTOMER_INVITATION_STATUS.OPEN, customerInvitationExpirationDate, inviterUser.id, currentDate, id]);

            if (!Utils.isAffectedPool(customerStatusUpdate)) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }

            await conn.query('COMMIT;');
            return cb(null, {
                OK: Constants.SUCCESS_MESSAGE.CUSTOMER_INVITE_SUCCESS,
                status: Constants.CUSTOMER_INVITATION_STATUS.OPEN,
                invitationExpirationDate: customerInvitationExpirationDate,
                id: id,
                updatedAt: currentDate
            });

        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK;');
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);

            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_ID_INVALID);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;

            } else if (err.errno === 4002) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;

            } else if (err.errno === 4003) {
                err = new Error(ErrorConfig.MESSAGE.EMAIL_EXIST_WITH_OTHER_CUSTOMER);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;

            } else if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_INVITE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    checkBlackListMD: async function (options) {
        var inviteeUserExists = options.inviteeUserExists;
        var inviterUser = options.inviterUser;
        var inviterUUID = inviterUser.id;

        if (inviteeUserExists) {
            var inviteeUUID = inviteeUserExists.id;
            var domain = (inviterUser.email).split('@');
            var inviterEmailDomain = domain[1];
            if (DataUtils.isDefined(inviterEmailDomain)) {

                var query = 'IF EXISTS(select * from blackList where inviteeUUID = uuid_to_bin(?) and inviterEmailDomain = ?)' +
                  'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "DOMAIN_BLOACKED_BY_INVITEE";' +
                  'ELSEIF EXISTS (select * from blackList where inviteeUUID = uuid_to_bin(?) and inviterEmail = ?)' +
                  'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "EMAIL_BLOACKED_BY_INVITEE";' +
                  'ELSEIF EXISTS (select * from blackList where inviteeUUID = uuid_to_bin(?) and inviterUUID = uuid_to_bin(?))' +
                  'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "INVITER_UUID_BLOACKED_BY_INVITEE"; end IF';

                var params = [inviteeUUID, inviterEmailDomain, inviteeUUID, inviterUser.email, inviteeUUID, inviterUUID];
                var conn = await connection.getConnection();
                await conn.query(query, params);
            }
        }
        return false;
    },

    checkForSameAccountCustomerNotification: function (options) {
        return new Promise(async function (resolve, reject) {
            var customerId = options.customerId;
            var err;

            try {
                var conn = await connection.getConnection();
                var response = await conn.query('SELECT 1 FROM users U , Customers C1, Customers C2 ' +
                  ' where C1.id = uuid_to_bin(?) and C1.email = U.email and U.accountId = C2.customersAccountId ' +
                  ' and C2.accountId = C1.accountId; ', [customerId]);

                if (response.length > 0) {
                    err = new Error(ErrorConfig.MESSAGE.CUSTOMER_ALREADY_EXIST_FOR_SAME_ACCOUNT);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    err.isExist = true;
                    return reject(err);
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },


    acceptDeclineIgnoreCustomerInvitationMD: async function (notification, auditOptions, errorOptions, cb) {

        var id = notification.id;
        var user = notification.user;
        var action = notification.action;
        var inviteeEmail = notification.inviteeEmail;

        var err;
        if (DataUtils.isUndefined(id)) {
            err = new Error(ErrorConfig.MESSAGE.CUSTOMER_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug(err);
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var getCustomerQuery = 'SELECT CAST(uuid_from_bin(id) as CHAR) as id,CAST(uuid_from_bin(accountId) as CHAR) as accountId,' +
              'CAST(uuid_from_bin(customersAccountId) as CHAR) as customersAccountId , locationId, customerId,customerName,' +
              'companyName,firstName,lastName,email,phone,fax,customerCode,' +
              'status,updatedAt,googleLink from Customers where id = uuid_to_bin(?) and isActive = 1;';

            var customerResult = await conn.query(getCustomerQuery, [id]);
            var customer = Utils.filteredResponsePool(customerResult);

            if (!customer) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            var customerStatus, notification_reference, template;

            if (action === Constants.INVITATION_STATUS_NOTIFICATION_ACTION.IGNORE) {

                //customerStatus = Constants.INVITATION_STATUS.IGNORED;
                notification_reference = NotificationReferenceData.CUSTOMER_INVITE_CANCEL;

            } else if (action === Constants.INVITATION_STATUS_NOTIFICATION_ACTION.DECLINE) {
                template = Constants.EMAIL_TEMPLATES.DECLINED_INVITE;
                customerStatus = Constants.CUSTOMER_INVITATION_STATUS.DECLINED;
                notification_reference = NotificationReferenceData.CUSTOMER_INVITE_DECLINE;

            } else if (action === Constants.INVITATION_STATUS_NOTIFICATION_ACTION.ACCEPT) {

                // CHECK if supplier is already exist of same company or account
                var checkOption = {
                    customerId: id
                };
                var checkResponse = await Customer.checkForSameAccountCustomerNotification(checkOption);

                notification_reference = NotificationReferenceData.CUSTOMER_INVITE_ACCEPT;
                template = Constants.EMAIL_TEMPLATES.ACCEPT_INVITE;
                customerStatus = Constants.CUSTOMER_INVITATION_STATUS.ACCEPTED;
            } else {
                return cb();
            }

            var currentDate = new Date().getTime();
            if (customerStatus) {
                var customerUpdate = await conn.query('UPDATE Customers SET status = ?, customersAccountId = uuid_to_bin(?), updatedAt = ?,' +
                  'updatedBy = uuid_to_bin(?) where id = uuid_to_bin(?)', [customerStatus, user.accountId, currentDate, user.id, id]);

                if (!Utils.isAffectedPool(customerUpdate)) {
                    err = new Error(ErrorConfig.MESSAGE.CUSTOMER_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }

                customer.status = customerStatus;
                customer.updatedAt = currentDate;
            }

            if (action === Constants.INVITATION_STATUS_NOTIFICATION_ACTION.IGNORE) {
                AuditUtils.create(auditOptions);
                return cb(null, customer);
            }


            var invitee = await conn.query('select firstName,lastName,email,languageCultureCode,CAST(uuid_from_bin(id) as CHAR) as id from users ' +
              'where email = ?;', [inviteeEmail]);
            invitee = Utils.filteredResponsePool(invitee);

            if (!invitee) {
                err = new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }

            var opt = {
                languageCultureCode: invitee.languageCultureCode,
                template: template,
                email: invitee.email
            };
            var compileOptions = {
                name: invitee.firstName,
                friend_name: user.firstName,
                user_email: user.email,
                scopehub_login: Endpoints.SCOPEHUB_LOGIN_URL
            };

            EmailUtils.sendEmailMD(opt, compileOptions, async function (err) {

                if (err) {
                    errorOptions.err = err;
                    await ErrorUtils.create(errorOptions);
                    debug('error', err);
                }
                if (DataUtils.isUndefined(user.firstName)) {
                    user.firstName = '';
                }
                if (DataUtils.isUndefined(user.lastName)) {
                    user.lastName = '';
                }

                try {

                    var NotificationApi = require('../api/notification');
                    var date = new Date();
                    var notificationExpirationDate = date.setDate(date.getDate() + Constants.INVITATION_EXPIRATION_DATE_LIMIT);
                    notificationExpirationDate = new Date(notificationExpirationDate);

                    var notificationOption = {
                        refereId: id,
                        refereType: Constants.NOTIFICATION_REFERE_TYPE.CUSTOMER,
                        user_ids: [invitee.id],
                        topic_id: invitee.id,
                        notificationExpirationDate: notificationExpirationDate,
                        paramasDateTime: new Date(),
                        notification_reference: notification_reference,
                        metaEmail: user.email,
                        paramsInviter: user.email + ', ' + (user.firstName ? user.firstName : '') + ' ' + (user.lastName ? user.lastName : ''),
                        paramsInvitee: invitee.email + ', ' + (invitee.firstName ? invitee.firstName : '') + ' ' + (invitee.lastName ? invitee.lastName : ''),
                        languageCultureCode: invitee.languageCultureCode,
                        createdBy: user.id,
                        type: Constants.DEFAULT_NOTIFICATION_TYPE
                    };


                    if (user.firstName) {
                        notificationOption.metaName = user.firstName;
                    }

                    await NotificationApi.createMD(notificationOption);
                    AuditUtils.create(auditOptions);
                    return cb(null, customer);

                } catch (err) {

                    errorOptions.err = err;
                    await ErrorUtils.create(errorOptions);
                    if (err.errno) {
                        err = new Error(ErrorConfig.MESSAGE.CUSTOMER_UPDATE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    }
                    return cb(err);
                }
            });
        } catch (err) {
            debug('err', err);
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    getCustomerByAccountIdEmail: function (options, cb) {
        return new Promise(async function (resolve, reject) {
            var accountId = options.accountId;
            var email = options.email;
            var err;

            try {
                var conn = await connection.getConnection();
                var customer = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id ,CAST(uuid_from_bin(accountId) as CHAR) as accountId ,' +
                  'customerId,customerName,firstName,lastName,email,customerCode,status,updatedAt from Customers where ' +
                  'accountId=uuid_to_bin(?) and email=? and isActive = 1;', [accountId, email]);
                customer = Utils.filteredResponsePool(customer);
                return resolve(customer);
            } catch (err) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
    * validate reminder request
    * */
    validateRequest: function (options) {
        return new Promise(function (resolve, reject) {
            var id = options.id;
            var updatedAt = options.updatedAt;
            var err;

            if (DataUtils.isUndefined(id)) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_ID_REQUIRED);
            } else if (DataUtils.isUndefined(updatedAt)) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_UPDATED_AT_REQUIRED);
            } else if (!DataUtils.isValidNumber(updatedAt)) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_UPDATED_AT_MUST_BE_NUMBER);
            } else if (updatedAt.toString().length !== 13) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_UPDATED_AT_INVALID);
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return reject(err);
            }
            return resolve(Constants.OK_MESSAGE);
        });
    },

    /*
    * Get notification from refereId
    * */
    getNotification: function (options) {
        return new Promise(async function (resolve, reject) {
            var refereId = options.refereId;
            debug('refereId', refereId);
            var err;

            try {
                var conn = await connection.getConnection();

                var notification = await conn.query('select CAST(uuid_from_bin(id) as char) as id,paramasDateTime from Notifications where refereId = uuid_to_bin(?) ' +
                  'order by createdAt DESC LIMIT 1;', [refereId]);
                notification = Utils.filteredResponsePool(notification);
                if (!notification) {
                    err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }

                return resolve(notification);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
    * Get user by email
    * */
    getUserByEmail: function (options) {
        return new Promise(async function (resolve, reject) {
            var email = options.email;
            var err;

            try {
                var conn = await connection.getConnection();

                var user = await conn.query('select CAST(uuid_from_bin(id) as char) as userId,CAST(uuid_from_bin(accountId) as char) as accountId,' +
                  'firstName,lastName,email,languageCultureCode  from users where email = ?;', [email]);
                user = Utils.filteredResponsePool(user);

                return resolve(user);
            } catch (err) {
                err = new Error(ErrorConfig.MESSAGE.USER_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
    * Notify the customer
    * */
    notifyReminderCustomer: function (options) {
        return new Promise(async function (resolve, reject) {
            var inviteeUserId = options.inviteeUserId;
            var inviterUser = options.inviterUser;
            var id = options.id;
            var notificationReference = options.notificationReference;
            var emailTemplate = options.emailTemplate;
            var notification = options.notification;
            var NotificationApi = require('./notification');
            var err;

            try {
                var inviteeUser = await Customer.getUserByIdMD({
                    userId: inviteeUserId,
                    notifyType: Constants.NOTIFICATION_CATEGORY_TYPE.PARTNERS
                });
                //send Email

                var notifyFlag = JSON.parse(inviteeUser.notifyFlag);
                if (notifyFlag.email === 1) {
                    var opt = {
                        languageCultureCode: inviteeUser.languageCultureCode,
                        template: emailTemplate,
                        email: inviteeUser.email
                    };

                    var compileOptions = {
                        name: inviteeUser.firstName,
                        friend: inviterUser.email,
                        inviteDate: notification.paramasDateTime
                    };
                    await EmailUtils.sendEmailPromise(opt, compileOptions);
                }
                if (notifyFlag.notification === 1) {
                    var date = new Date();
                    var invitationExpirationDate = date.setDate(date.getDate() + Constants.INVITATION_EXPIRATION_DATE_LIMIT);
                    invitationExpirationDate = new Date(invitationExpirationDate);

                    //send notification
                    var notificationOption = {
                        refereId: id, //id of customer record
                        refereType: Constants.NOTIFICATION_REFERE_TYPE.CUSTOMER,
                        user_ids: [inviteeUser.id],
                        topic_id: inviteeUser.id,
                        notificationExpirationDate: invitationExpirationDate,
                        paramasDateTime: notification.paramasDateTime,
                        notification_reference: notificationReference,
                        metaEmail: inviterUser.email,
                        paramsInviter: inviterUser.email + ', ' + (inviterUser.firstName ? inviterUser.firstName : '') + ' ' + (inviterUser.lastName ? inviterUser.lastName : ''),
                        paramsInvitee: inviteeUser.email + ', ' + (inviteeUser.firstName ? inviteeUser.firstName : '') + ' ' + (inviteeUser.lastName ? inviteeUser.lastName : ''),
                        languageCultureCode: inviteeUser.languageCultureCode,
                        createdBy: inviterUser.id,
                        type: Constants.DEFAULT_NOTIFICATION_TYPE
                    };
                    if (inviterUser.firstName) {
                        notificationOption.metaName = inviterUser.firstName;
                    }
                    await NotificationApi.createMD(notificationOption);
                }

                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_NOTIFY_FAILED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return reject(err);
            }
        });
    },

    reminder: async function (options, errorOptions, cb) {
        var id = options.id;
        var updatedAt = options.updatedAt;
        var user = options.user;
        var currentDate = DataUtils.getEpochMSTimestamp();
        var notifyOption, notifyResponse;
        var err;

        try {
            var checkResponse = await Customer.validateRequest(options);

            // Get customer
            var customer = await Customer.getCustomerById({id: id});
            if (customer.updatedAt !== updatedAt) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                throw err;
            }

            var inviteeUser = await Customer.getUserByEmail({email: customer.email});
            if (!inviteeUser) {
                err = new Error(ErrorConfig.MESSAGE.INVITEE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            if (customer.status === Constants.CUSTOMER_INVITATION_STATUS.OPEN && currentDate < new Date(customer.invitationExpirationDate).getTime()) {
                var authUsers = await Customer.getAuthorizeUser({accountId: inviteeUser.accountId});

                var notification = await Customer.getNotification({refereId: id});

                notifyOption = {
                    notification: notification,
                    id: id,
                    inviterUser: user,
                    notificationReference: NotificationReferenceData.CUSTOMER_REMINDER,
                    emailTemplate: Constants.EMAIL_TEMPLATES.CUSTOMER_REMINDER
                };

                if (!authUsers || authUsers.length <= 0) {
                    notifyOption.inviteeUserId = inviteeUser.userId;
                    notifyResponse = await Customer.notifyReminderCustomer(notifyOption);
                } else {
                    await Promise.each(authUsers, async function (inviteeUser) {
                        notifyOption.inviteeUserId = inviteeUser.userId;
                        notifyResponse = await Customer.notifyReminderCustomer(notifyOption);
                    });
                }
                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.CUSTOMER_SEND_REMINDER_SUCCESS
                });
            } else {
                err = new Error(ErrorConfig.MESSAGE.CAN_NOT_SEND_REMINDER);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_REMINDER_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    reSendInvitation: async function (options, errorOptions, cb) {
        var id = options.id;
        var updatedAt = options.updatedAt;
        var user = options.user;
        var currentDate = DataUtils.getEpochMSTimestamp();
        var err;

        try {
            var checkResponse = await Customer.validateRequest(options);

            // Get customer
            var customer = await Customer.getCustomerById({id: id});

            if (customer.updatedAt !== updatedAt) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            var inviteeUser = await Customer.getUserByEmail({email: customer.email});
            if (!inviteeUser) {
                err = new Error(ErrorConfig.MESSAGE.INVITEE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            if (customer.status === Constants.CUSTOMER_INVITATION_STATUS.OPEN &&
              currentDate < new Date(customer.invitationExpirationDate).getTime()) {
                err = new Error(ErrorConfig.MESSAGE.INVITATION_IS_ALREADY_SENT_TO_CUSTOMER);
            } else if (customer.status === Constants.CUSTOMER_INVITATION_STATUS.ACCEPTED) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_ALREADY_ACCEPTED_INVITATION);
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            // Invite customer
            var reInviteOption = {
                user: user,
                id: id,
                email: customer.email,
                flag: 1,
                updatedAt: updatedAt
            };
            await Customer.inviteMD(reInviteOption, errorOptions, function (err, response) {
                if (err) {
                    debug('err', err);
                    return cb(err);
                }
                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.CUSTOMER_RE_SEND_INVITATION_SUCCESS,
                    status: Constants.CUSTOMER_INVITATION_STATUS.OPEN,
                    invitationExpirationDate: response.invitationExpirationDate,
                    id: id,
                    updatedAt: response.updatedAt
                });
            });
        } catch (err) {
            debug('err', err);
            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_RE_SEND_INVITATION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    /*
    * Notify the customer
    * */
    notifyCancelInviteCustomer: function (options) {
        return new Promise(async function (resolve, reject) {
            var inviteeUserId = options.inviteeUserId;
            var inviterUser = options.inviterUser;
            var id = options.id;
            var notificationReference = options.notificationReference;
            var emailTemplate = options.emailTemplate;
            var NotificationApi = require('./notification');
            var err;

            try {
                //send Email
                var inviteeUser = await Customer.getUserByIdMD({
                    userId: inviteeUserId,
                    notifyType: Constants.NOTIFICATION_CATEGORY_TYPE.PARTNERS
                });
                var opt = {
                    languageCultureCode: inviteeUser.languageCultureCode,
                    template: emailTemplate,
                    email: inviteeUser.email
                };

                var compileOptions = {
                    name: inviteeUser.firstName,
                    friend: inviterUser.email,
                    scopehub_login: ''
                };
                var notifyFlag = JSON.parse(inviteeUser.notifyFlag);
                if (notifyFlag.email === 1) {
                    await EmailUtils.sendEmailPromise(opt, compileOptions);
                }
                if (notifyFlag.notification === 1) {
                    var date = new Date();
                    var invitationExpirationDate = date.setDate(date.getDate() + Constants.INVITATION_EXPIRATION_DATE_LIMIT);
                    invitationExpirationDate = new Date(invitationExpirationDate);

                    //send notification
                    var notificationOption = {
                        refereId: id, //id of customer record
                        refereType: Constants.NOTIFICATION_REFERE_TYPE.CUSTOMER,
                        user_ids: [inviteeUser.id],
                        topic_id: inviteeUser.id,
                        notificationExpirationDate: invitationExpirationDate,
                        paramasDateTime: new Date(),
                        notification_reference: notificationReference,
                        metaEmail: inviterUser.email,
                        paramsInviter: inviterUser.email + ', ' + (inviterUser.firstName ? inviterUser.firstName : '') + ' ' + (inviterUser.lastName ? inviterUser.lastName : ''),
                        paramsInvitee: inviteeUser.email + ', ' + (inviteeUser.firstName ? inviteeUser.firstName : '') + ' ' + (inviteeUser.lastName ? inviteeUser.lastName : ''),
                        languageCultureCode: inviteeUser.languageCultureCode,
                        createdBy: inviterUser.id,
                        type: Constants.DEFAULT_NOTIFICATION_TYPE
                    };
                    if (inviterUser.firstName) {
                        notificationOption.metaName = inviterUser.firstName;
                    }
                    await NotificationApi.createMD(notificationOption);
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_NOTIFY_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
    * Update customer
    * */
    updateCustomer: function (options) {
        return new Promise(async function (resolve, reject) {
            var id = options.id;
            var status = options.status;
            var invitationExpirationDate = options.invitationExpirationDate;
            var user = options.user;
            var newUpdatedAt = DataUtils.getEpochMSTimestamp();
            var err;

            try {
                var conn = await connection.getConnection();
                var isUpdated = await conn.query('update Customers set status = ? , invitationExpirationDate = ? , updatedAt = ?,' +
                  'updatedBy = uuid_to_bin(?) where id = uuid_to_bin(?)', [status, invitationExpirationDate, newUpdatedAt, user.id, id]);
                isUpdated = Utils.isAffectedPool(isUpdated);
                debug('isUpdated', isUpdated);
                return resolve({
                    OK: Constants.SUCCESS,
                    updatedAt: newUpdatedAt
                });
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
    * Update suppliers
    * */
    updateNotifications: function (options) {
        return new Promise(async function (resolve, reject) {
            var refereId = options.refereId;
            var invitationExpirationDate = options.invitationExpirationDate;
            var user = options.user;
            var currentDate = DataUtils.getEpochMSTimestamp();
            var newNotificationExpirationDate = new Date();
            var err;

            try {
                var conn = await connection.getConnection();

                var isUpdated = await conn.query('update Notifications set notificationExpirationDate = ?, updatedAt = ?,' +
                  'updatedBy = uuid_to_bin(?) WHERE refereId = uuid_to_bin(?) and notificationExpirationDate = ? ; ',
                  [newNotificationExpirationDate, currentDate, user.id, refereId, invitationExpirationDate]);
                isUpdated = Utils.isAffectedPool(isUpdated);
                debug('isUpdated', isUpdated);
                return resolve({
                    OK: Constants.SUCCESS
                });
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    cancel: async function (options, errorOptions, cb) {
        var id = options.id;
        var updatedAt = options.updatedAt;
        var user = options.user;
        var currentDate = DataUtils.getEpochMSTimestamp();
        var notifyOption, notifyResponse;
        var err;

        try {
            var conn = await connection.getConnection();
            await conn.query('START TRANSACTION;');
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        try {
            var checkResponse = await Customer.validateRequest(options);

            // Get customer
            var customer = await Customer.getCustomerById({id: id});

            if (customer.updatedAt !== updatedAt) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            var inviteeUser = await Customer.getUserByEmail({email: customer.email});
            if (!inviteeUser) {
                err = new Error(ErrorConfig.MESSAGE.INVITEE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            if (new Date(customer.invitationExpirationDate).getTime() !== new Date(Constants.DEFAULT_TIMESTAMP).getTime() &&
              currentDate > new Date(customer.invitationExpirationDate).getTime()) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_INVITATION_ALRAEDY_EXPIRED);
            } else if (customer.status !== Constants.SUPPLIER_INVITATION_STATUS.OPEN) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_INVITATION_STATUS_NOT_OPEN);
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            // Update notifications by expiring it
            var updateNotificationsOptions = {
                refereId: id,
                invitationExpirationDate: customer.invitationExpirationDate,
                user: user
            };
            var updateNotificationResponse = await Customer.updateNotifications(updateNotificationsOptions);
            debug('updateNotificationResponse', updateNotificationResponse);

            // SEND NOTIFICATION TO THE ALL AUTH USER OF SUPPLIER
            var authUsers = await Customer.getAuthorizeUser({accountId: inviteeUser.accountId});
            debug('authUsers', authUsers);
            notifyOption = {
                id: id,
                inviterUser: user,
                notificationReference: NotificationReferenceData.CUSTOMER_INVITE_CANCEL,
                emailTemplate: Constants.EMAIL_TEMPLATES.CUSTOMER_INVITE_CANCEL
            };

            if (!authUsers || authUsers.length <= 0) {
                notifyOption.inviteeUserId = inviteeUser.userId;
                notifyResponse = await Customer.notifyCancelInviteCustomer(notifyOption);
            } else {
                await Promise.each(authUsers, async function (inviteeUser) {
                    notifyOption.inviteeUserId = inviteeUser.userId;
                    notifyResponse = await Customer.notifyCancelInviteCustomer(notifyOption);
                });
            }

            // Update customer with status
            var updateCustomerOptions = {
                id: id,
                invitationExpirationDate: new Date(Constants.DEFAULT_TIMESTAMP),
                status: Constants.CUSTOMER_INVITATION_STATUS.NO_INVITATION,
                user: user
            };
            var updateCustomerResponse = await Customer.updateCustomer(updateCustomerOptions);

            await conn.query('COMMIT;');
            return cb(null, {
                OK: Constants.SUCCESS_MESSAGE.CUSTOMER_CANCEL_INVITATION_SUCCESS,
                status: Constants.CUSTOMER_INVITATION_STATUS.NO_INVITATION,
                updatedAt: updateCustomerResponse.updatedAt
            });
        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK;');
            await ErrorUtils.create(errorOptions, options, err);
            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_INVITE_CANCEL_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    addInvite: async function (options, errorOptions, cb) {
        try {
            await Customer.createMD(options, errorOptions, async function (err, customer) {
                if (err) {
                    debug('err', err);
                    throw err;
                }
                debug('create', customer);

                var inviteOptions = {
                    email: options.email,
                    id: customer.id,
                    personalMessage: options.personalMessage,
                    updatedAt: customer.updatedAt,
                    user: options.user,
                    addInviteFlag: options.addInviteFlag
                };
                debug('invite options', inviteOptions);
                await Customer.inviteMD(inviteOptions, errorOptions, function (err, customer) {
                    if (err) {
                        debug('err', err);
                        throw err;
                    }
                    debug('invite', customer);
                    return cb(null, {
                        OK: Constants.SUCCESS_MESSAGE.CUSTOMER_ADD_INVITE_SUCCESS,
                        status: customer.status,
                        invitationExpirationDate: customer.invitationExpirationDate,
                        id: customer.id,
                        updatedAt: customer.updatedAt
                    });
                });
            });
        } catch (err) {
            debug('error', err);
            return cb(err);
        }
    },

    searchCustomers: async function (options, errorOptions, cb) {
        var accountId = options.accountId;
        var isActive = options.isActive;
        var customerName = options.customerName;
        var customerCode = options.customerCode;
        var firstName = options.firstName;
        var lastName = options.lastName;
        var email = options.email;
        var checkString = '', whereString = '';
        var checkValues = [];
        var err;

        if (DataUtils.isUndefined(isActive)) {
            err = new Error(ErrorConfig.MESSAGE.IS_ACTIVE_FIELD_REQUIRED);
        } else if (DataUtils.isUndefined(customerName) && DataUtils.isUndefined(customerCode) && DataUtils.isUndefined(firstName)
          && DataUtils.isUndefined(lastName) && DataUtils.isUndefined(email)) {
            err = new Error(ErrorConfig.MESSAGE.AT_LEASE_ONE_SEARCH_ATTRIBUTE_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        try {
            if (DataUtils.isDefined(customerName)) {
                checkString += ' customerName like ? and ';
                whereString += ' C.customerName like ? and ';
                checkValues.push('%' + customerName + '%');
            }
            if (DataUtils.isDefined(customerCode)) {
                checkString += ' customerCode like ?  and ';
                whereString += ' C.customerCode like ? and ';
                checkValues.push('%' + customerCode + '%');
            }
            if (DataUtils.isDefined(firstName)) {
                checkString += ' firstName like ? and ';
                whereString += ' C.firstName like ? and ';
                checkValues.push('%' + firstName + '%');
            }
            if (DataUtils.isDefined(lastName)) {
                checkString += ' lastName like ?  and ';
                whereString += ' C.lastName like ? and ';
                checkValues.push('%' + lastName + '%');
            }
            if (DataUtils.isDefined(email)) {
                checkString += ' email like ?  and ';
                whereString += ' C.email like ? and ';
                checkValues.push('%' + email + '%');
            }
            checkString = checkString.replace(/and\s*$/, '');
            whereString = whereString.replace(/and\s*$/, '');


            var conn = await connection.getConnection();
            var emptyLocationCustomers = await conn.query('IF (select count(id) from Customers where accountId = uuid_to_bin(?) and ' +
              ' isActive = ? and ' + checkString + ') > ? THEN ' +
              ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "ROW_COUNT_EXCEED_PLEASE_USE_SEARCH_AND_FILTER", MYSQL_ERRNO = 4001; ' +
              ' ELSE SELECT CAST(uuid_from_bin(id) as char) as id,CAST(uuid_from_bin(accountId) as char) as accountId,' +
              ' CAST(uuid_from_bin(customersAccountId) as char) as customersAccountId,' +
              ' locationId,locationName, customerId,customerName,companyName,firstName,lastName,email,phone,primaryMobile,' +
              ' secondaryMobile,fax,customerCode,addressLine1,addressLine2,addressLine3,city,zipCode,state,country,googleLink ,' +
              ' recordType,status,invitationExpirationDate,isActive, updatedAt,createdAt from Customers ' +
              ' where accountId = uuid_to_bin(?) and locationId = "" and isActive = ? and ' + checkString + ' ; END IF;',
              [accountId, isActive].concat(checkValues, [Constants.ROW_LIMIT, accountId, isActive], checkValues));
            emptyLocationCustomers = Utils.filteredResponsePool(emptyLocationCustomers);

            var customerWithLocation = await conn.query('select CAST(uuid_from_bin(C.id) as char) as id,CAST(uuid_from_bin(C.accountId) as char) as accountId,' +
              'CAST(uuid_from_bin(C.customersAccountId) as char) as customersAccountId,C.customerId,C.locationId, ' +
              'C.customerName,C.companyName,C.firstName,C.lastName,C.email,C.phone,C.primaryMobile,C.secondaryMobile,C.customerCode, ' +
              'C.status,C.invitationExpirationDate,LR.googleLink, ' +
              'LR.locationName,LR.addressLine1,LR.addressLine2,LR.addressLine3,LR.city,LR.zipCode,LR.state,LR.country,LR.fax,' +
              'C.isActive,C.updatedAt,C.createdAt from Customers C, LocationReference LR ' +
              'where LR.locationId = C.locationId and  LR.accountId = uuid_to_bin(?) and ' +
              'C.accountId = uuid_to_bin(?) and C.locationId != "" and C.isActive = ? and ' + whereString + ';',
              [accountId, accountId, isActive].concat(checkValues));

            var customers = [];
            customers = customers.concat(emptyLocationCustomers).concat(customerWithLocation);

            customers = _.sortBy(customers, 'createdAt').reverse();

            if (customers.length > 0) {
                _.map(customers, function (customer) {
                    if (customer.createdAt) {
                        delete customer.createdAt;
                    }
                });
            }
            return cb(null, customers);
        } catch (err) {
            debug('err', err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.ROW_COUNT_EXCEED_PLEASE_USE_SEARCH_AND_FILTER);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else {
                err = new Error(ErrorConfig.MESSAGE.CUSTOMER_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    }
};

module.exports = Customer;