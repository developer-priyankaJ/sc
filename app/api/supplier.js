/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.api.supplier');
var Util = require('util');
var Async = require('async');
var _ = require('lodash');
var Promise = require('bluebird');
var knex = require('../lib/knex_util');
var connection = require('../lib/connection_util');
var ErrorConfig = require('../data/error');
var DataUtils = require('../lib/data_utils');
var AuditUtils = require('../lib/audit_utils');
var Constants = require('../data/constants');
var SupplierModel = require('../model/supplier');
var UserApi = require('./user');
var AccountApi = require('./account');
var ContactApi = require('./contact');
var CustomerApi = require('./customer');
var EmailUtils = require('../lib/email_utils');
var NotificationReferenceData = require('../data/notification_reference');
var Endpoints = require('../config/endpoints');
var AccountModel = require('../model/account');
var UserModel = require('../model/user');
var OutShareInstanceApi = require('./out_share_instance');
var Utils = require('../lib/utils');
var ErrorUtils = require('../lib/error_utils');


var Supplier = {

    validateOptionalFields: function (options) {
        return new Promise(function (resolve, reject) {
            var supplierFields = '';
            var supplierOptionalValues = [];
            var supplierLocFields = '';
            var supplierLocValues = [];
            var err;

            try {

                if (!err && !DataUtils.isValidateOptionalField(options.firstName)) {
                    if (!DataUtils.isString(options.firstName)) {
                        throw new Error(ErrorConfig.MESSAGE.SUPPLIER_FIRST_NAME_MUST_BE_STRING);
                    } else if (options.firstName.length > 60) {
                        throw new Error(ErrorConfig.MESSAGE.SUPPLIER_FIRST_NAME_MUST_BE_LESS_THAN_60_CHARACTER);
                    } else {
                        supplierFields += 'firstName = ?,';
                        supplierOptionalValues.push(options.firstName);
                    }
                }

                if (!err && !DataUtils.isValidateOptionalField(options.lastName)) {
                    if (!DataUtils.isString(options.lastName)) {
                        throw new Error(ErrorConfig.MESSAGE.SUPPLIER_LAST_NAME_MUST_BE_STRING);
                    } else if (options.lastName.length > 60) {
                        throw new Error(ErrorConfig.MESSAGE.SUPPLIER_LAST_NAME_MUST_BE_LESS_THAN_60_CHARACTER);
                    } else {
                        supplierFields += 'lastName = ?,';
                        supplierOptionalValues.push(options.lastName);
                    }
                }

                if (!err && !DataUtils.isValidateOptionalField(options.email)) {
                    if (!DataUtils.isString(options.email)) {
                        throw new Error(ErrorConfig.MESSAGE.SUPPLIER_EMAIL_MUST_BE_STRING);
                    } else if (options.email.length > 60) {
                        throw new Error(ErrorConfig.MESSAGE.SUPPLIER_EMAIL_MUST_BE_LESS_THAN_254_CHARACTER);
                    } else {
                        supplierFields += 'email = ?,';
                        supplierOptionalValues.push(options.email);
                    }

                }

                if (!err && !DataUtils.isValidateOptionalField(options.supplierName)) {
                    if (!DataUtils.isString(options.supplierName)) {
                        throw new Error(ErrorConfig.MESSAGE.SUPPLIER_NAME_MUST_BE_STRING);
                    } else if (options.supplierName.length > 60) {
                        throw new Error(ErrorConfig.MESSAGE.SUPPLIER_NAME_MUST_BE_LESS_THAN_60_CHARACTER);
                    } else {
                        supplierFields += 'supplierName = ?,';
                        supplierOptionalValues.push(options.supplierName);
                    }
                }

                if (!err && !DataUtils.isValidateOptionalField(options.supplierId)) {
                    if (!DataUtils.isString(options.supplierId)) {
                        throw new Error(ErrorConfig.MESSAGE.SUPPLIER_ID_MUST_BE_STRING);
                    } else if (options.supplierId.length > 40) {
                        throw new Error(ErrorConfig.MESSAGE.SUPPLIER_ID_MUST_BE_LESS_THAN_40_CHARACTER);
                    } else {
                        supplierFields += 'supplierId = ?,';
                        supplierOptionalValues.push(options.supplierId);
                    }
                }
                if (!err && !DataUtils.isValidateOptionalField(options.companyName)) {
                    if (!DataUtils.isString(options.companyName)) {
                        throw new Error(ErrorConfig.MESSAGE.SUPPLIER_COMPANY_NAME_MUST_BE_STRING);
                    } else if (options.companyName.length > 60) {
                        throw new Error(ErrorConfig.MESSAGE.SUPPLIER_COMPANY_NAME_MUST_BE_LESS_THAN_60_CHARACTER);
                    } else {
                        supplierFields += 'companyName = ?,';
                        supplierOptionalValues.push(options.companyName);
                    }
                }

                if (!err && !DataUtils.isValidateOptionalField(options.dialCode)) {
                    if (!DataUtils.isString(options.dialCode)) {
                        throw new Error(ErrorConfig.MESSAGE.DIAL_CODE_MUST_BE_STRING);
                    } else if (options.dialCode.toString().length > 5) {
                        throw new Error(ErrorConfig.MESSAGE.DIAL_CODE_MUST_BE_LESS_THAN_5_CHARACTER);
                    } else {
                        supplierFields += 'dialCode = ?,';
                        supplierOptionalValues.push(options.dialCode);
                    }
                }

                if (!DataUtils.isValidateOptionalField(options.phoneCountry)) {
                    if (!DataUtils.isString(options.phoneCountry)) {
                        throw err = new Error(ErrorConfig.MESSAGE.PHONE_COUNTRY_MUST_BE_STRING);
                    } else if (options.phoneCountry.toString().length > 2) {
                        throw err = new Error(ErrorConfig.MESSAGE.PHONE_COUNTRY_MUST_BE_LESS_THAN_2_CHARACTER);
                    } else {
                        supplierFields += 'phoneCountry=? ,';
                        supplierOptionalValues.push(options.phoneCountry);
                    }
                }

                if (!err && !DataUtils.isValidateOptionalField(options.phone)) {
                    if (!DataUtils.isMobile(options.phone)) {
                        throw new Error(ErrorConfig.MESSAGE.CUSTOMER_PHONE_NUMBER_MUST_BE_VALID_NUMBER);
                    } else if (options.phone.toString().length > 15) {
                        throw new Error(ErrorConfig.MESSAGE.CUSTOMER_PHONE_NUMBER_MUST_BE_LESS_THAN_15_CHARACTER);
                    } else {
                        supplierFields += 'phone = ?,';
                        supplierOptionalValues.push(options.dialCode + '' + options.phone);
                    }
                }

                if (!DataUtils.isValidateOptionalField(options.primaryMobileDialCode)) {
                    if (!DataUtils.isString(options.primaryMobileDialCode)) {
                        throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_DIAL_CODE_MUST_BE_STRING);
                    } else if (options.primaryMobileDialCode.length > 5) {
                        throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_DIAL_CODE_MUST_BE_LESS_THAN_5_CHARACTER);
                    } else {
                        supplierFields += 'primaryMobileDialCode=? ,';
                        supplierOptionalValues.push(options.primaryMobileDialCode);
                    }
                }

                if (!DataUtils.isValidateOptionalField(options.primaryMobileCountry)) {
                    if (!DataUtils.isString(options.primaryMobileCountry)) {
                        throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_COUNTRY_MUST_BE_STRING);
                    } else if (options.primaryMobileCountry.length > 2) {
                        throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_COUNTRY_MUST_BE_LESS_THAN_2_CHARACTER);
                    } else {
                        supplierFields += 'primaryMobileCountry=? ,';
                        supplierOptionalValues.push(options.primaryMobileCountry);
                    }
                }

                if (!DataUtils.isValidateOptionalField(options.primaryMobile)) {
                    if (!DataUtils.isMobile(options.primaryMobile)) {
                        throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_MUST_BE_VALID_NUMBER);
                    } else if (options.primaryMobile.toString().length > 15) {
                        throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_MUST_BE_LESS_THAN_OF_15_DIGIT);
                    } else {
                        supplierFields += 'primaryMobile=? ,';
                        supplierOptionalValues.push(options.primaryMobileDialCode + '' + options.primaryMobile);
                    }
                }

                if (!DataUtils.isValidateOptionalField(options.secondaryMobileDialCode)) {
                    if (!DataUtils.isString(options.secondaryMobileDialCode)) {
                        throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_DIAL_CODE_MUST_BE_STRING);
                    } else if (options.secondaryMobileDialCode.length > 5) {
                        throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_DIAL_CODE_MUST_BE_LESS_THAN_5_CHARACTER);
                    } else {
                        supplierFields += 'secondaryMobileDialCode=? ,';
                        supplierOptionalValues.push(options.secondaryMobileDialCode);
                    }
                }

                if (!DataUtils.isValidateOptionalField(options.secondaryMobileCountry)) {
                    if (!DataUtils.isString(options.secondaryMobileCountry)) {
                        throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_COUNTRY_MUST_BE_STRING);
                    } else if (options.secondaryMobileCountry.length > 2) {
                        throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_COUNTRY_MUST_BE_LESS_THAN_2_CHARACTER);
                    } else {
                        supplierFields += 'secondaryMobileCountry=? ,';
                        supplierOptionalValues.push(options.secondaryMobileCountry);
                    }
                }

                if (!DataUtils.isValidateOptionalField(options.secondaryMobile)) {
                    if (!DataUtils.isMobile(options.secondaryMobile)) {
                        throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_MUST_BE_NUMBER);
                    } else if (options.secondaryMobile.toString().length > 15) {
                        throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_MUST_BE_LESS_THAN_OF_15_DIGIT);
                    } else {
                        supplierFields += 'secondaryMobile=? ,';
                        supplierOptionalValues.push(options.secondaryMobileDialCode + '' + options.secondaryMobile);
                    }
                }

                if (!err && !DataUtils.isValidateOptionalField(options.fax)) {
                    if (!DataUtils.isString(options.fax)) {
                        throw new Error(ErrorConfig.MESSAGE.SUPPLIER_FAX_NUMBER_MUST_BE_STRING);
                    } else if (options.fax.length > 11) {
                        throw new Error(ErrorConfig.MESSAGE.SUPPLIER_FAX_NUMBER_MUST_BE_LESS_THAN_15_CHARACTER);
                    } else {
                        supplierFields += 'fax = ?,';
                        supplierOptionalValues.push(options.fax);
                    }
                }

                if (!err && !DataUtils.isValidateOptionalField(options.addressLine1)) {
                    if (!DataUtils.isString(options.addressLine1)) {
                        throw new Error(ErrorConfig.MESSAGE.SUPPLIER_ADDRESS_BE_STRING);
                    } else if (options.addressLine1.length > 60) {
                        throw new Error(ErrorConfig.MESSAGE.SUPPLIER_ADDRESS_MUST_BE_LESS_THAN_60_CHARACTER);
                    } else {
                        supplierLocFields += 'addressLine1 = ?,';
                        supplierLocValues.push(options.addressLine1);
                    }
                }

                if (!err && !DataUtils.isValidateOptionalField(options.addressLine2)) {
                    if (!DataUtils.isString(options.addressLine2)) {
                        throw new Error(ErrorConfig.MESSAGE.SUPPLIER_ADDRESS_BE_STRING);
                    } else if (options.addressLine2.length > 60) {
                        throw new Error(ErrorConfig.MESSAGE.SUPPLIER_ADDRESS_MUST_BE_LESS_THAN_60_CHARACTER);
                    } else {
                        supplierLocFields += 'addressLine2 = ?,';
                        supplierLocValues.push(options.addressLine2);
                    }
                }

                if (!err && !DataUtils.isValidateOptionalField(options.addressLine3)) {
                    if (!DataUtils.isString(options.addressLine3)) {
                        throw new Error(ErrorConfig.MESSAGE.SUPPLIER_ADDRESS_BE_STRING);
                    } else if (options.addressLine3.length > 60) {
                        throw new Error(ErrorConfig.MESSAGE.SUPPLIER_ADDRESS_MUST_BE_LESS_THAN_60_CHARACTER);
                    } else {
                        supplierLocFields += 'addressLine3 = ?,';
                        supplierLocValues.push(options.addressLine3);
                    }
                }

                if (!err && !DataUtils.isValidateOptionalField(options.city)) {
                    if (!DataUtils.isString(options.city)) {
                        throw new Error(ErrorConfig.MESSAGE.SUPPLIER_CITY_NAME_MUST_BE_STRING);
                    } else if (options.city.length > 60) {
                        throw new Error(ErrorConfig.MESSAGE.SUPPLIER_CITY_NAME_MUST_BE_LESS_THAN_60_CHARACTER);
                    } else {
                        supplierLocFields += 'city = ?,';
                        supplierLocValues.push(options.city);
                    }
                }

                if (!err && !DataUtils.isValidateOptionalField(options.state)) {
                    if (!DataUtils.isString(options.state)) {
                        throw new Error(ErrorConfig.MESSAGE.SUPPLIER_STATE_MUST_BE_STRING);
                    } else if (options.state.length > 60) {
                        throw new Error(ErrorConfig.MESSAGE.SUPPLIER_STATE_MUST_BE_LESS_THAN_60_CHARACTER);
                    } else {
                        supplierLocFields += 'state = ?,';
                        supplierLocValues.push(options.state);
                    }
                }

                if (!err && !DataUtils.isValidateOptionalField(options.country)) {
                    if (!DataUtils.isString(options.country)) {
                        throw new Error(ErrorConfig.MESSAGE.SUPPLIER_COUNTRY_MUST_BE_STRING);
                    } else if (options.country.length > 60) {
                        throw new Error(ErrorConfig.MESSAGE.SUPPLIER_COUNTRY_MUST_BE_LESS_THAN_60_CHARACTER);
                    } else {
                        supplierLocFields += 'country = ?,';
                        supplierLocValues.push(options.country);
                    }
                }

                if (!err && !DataUtils.isValidateOptionalField(options.zipCode)) {
                    if (!DataUtils.isString(options.zipCode)) {
                        throw new Error(ErrorConfig.MESSAGE.SUPPLIER_ZIP_CODE_MUST_BE_STRING);
                    } else if (options.zipCode.length > 10) {
                        throw new Error(ErrorConfig.MESSAGE.SUPPLIER_ZIP_CODE_MUST_BE_LESS_THAN_10_CHARACTER);
                    } else {
                        supplierLocFields += 'zipCode = ?,';
                        supplierLocValues.push(options.zipCode);
                    }
                }

                if (!err && !DataUtils.isValidateOptionalField(options.googleLink)) {
                    if (!DataUtils.isString(options.googleLink)) {
                        throw new Error(ErrorConfig.MESSAGE.SUPPLIER_GOOGLE_LINK_MUST_BE_STRING);
                    } else {
                        supplierFields += 'googleLink = ?,';
                        supplierOptionalValues.push(options.googleLink);
                    }
                }

                if (!err && !DataUtils.isValidateOptionalField(options.status)) {
                    supplierFields += 'status = ?,';
                    supplierOptionalValues.push(options.status);
                }

                var response = {
                    supplierFields: supplierFields,
                    supplierOptionalValues: supplierOptionalValues,
                    supplierLocFields: supplierLocFields,
                    supplierLocValues: supplierLocValues
                };
                return resolve(response);
            } catch (err) {
                debug('err', err);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return reject(err);
            }
        });
    },

    checkForSameAccountSupplier: function (options) {
        return new Promise(async function (resolve, reject) {
            var accountId = options.accountId;
            var email = options.email;
            var err;

            try {
                var conn = await connection.getConnection();
                var response = await conn.query('SELECT 1 FROM users U , Supplier S where ' +
                  'U.accountId = S.suppliersAccountId and U.email = ?  and S.accountId = uuid_to_bin(?)', [email, accountId]);

                if (response.length > 0) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLIER_ALREADY_EXIST_FOR_SAME_ACCOUNT);
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
        var useExisting = options.useExisting;
        var saveAsLater = options.saveAsLater;
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

        if (DataUtils.isUndefined(options.accountId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
        }
        if (DataUtils.isUndefined(options.email)) {
            err = new Error(ErrorConfig.MESSAGE.EMAIL_REQUIRED);
        } else if (DataUtils.isUndefined(options.supplierCode)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLIER_CODE_REQUIRED);
        } else if (!DataUtils.isString(options.supplierCode)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLIER_CODE_MUST_BE_STRING);
        } else if (options.supplierCode.length > 10) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLIER_CODE_MUST_BE_LESS_THAN_10_CHARACTER);
        } else if (DataUtils.isUndefined(options.supplierName)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLIER_NAME_REQUIRED);
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
            //options.phone = dialCode + '' + phone;
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
            //debug('primaryMobile before', primaryMobile);
            //options.primaryMobile = primaryMobileDialCode + '' + primaryMobile;
            //debug('primaryMobile after', primaryMobile);
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
            //options.secondaryMobile = secondaryMobileDialCode + '' + secondaryMobile;
        }

        if (useExisting && DataUtils.isUndefined(options.locationId)) {
            err = new Error(ErrorConfig.MESSAGE.SELECT_ANY_LOCATION_ID);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            return cb(err);
        }

        var response, supplierFields, supplierOptionalValues, supplierLocFields, supplierLocValues;
        var id = Utils.generateId().uuid;
        var currentDate = new Date().getTime();

        try {
            var conn = await connection.getConnection();

            // CHECK IF supplier already exist with same account of given email
            var checkOption = {
                email: options.email,
                accountId: options.accountId
            };
            var checkResponse = await Supplier.checkForSameAccountSupplier(checkOption);
            debug('checkResponse', checkResponse);
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
        if (saveAsLater) {

            if (DataUtils.isValidateOptionalField(options.newLocationId) || options.newLocationId === '') {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_LOCATION_ID_REQUIRED);
            }
            if (!err && !DataUtils.isString(options.newLocationId)) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_LOCATION_ID_MUST_BE_STRING);
            }
            if (!err && options.newLocationId.length > 40) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_LOCATION_ID_MUST_BE_LESS_THAN_40_CHARACTER);
            }
            if (!err && DataUtils.isValidateOptionalField(options.newLocationName) || options.newLocationName === '') {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_LOCATION_NAME_REQUIRED);
            }
            if (!err && !DataUtils.isString(options.newLocationName)) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_LOCATION_NAME_MUST_BE_STRING);
            }
            if (!err && options.newLocationName.length > 60) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_LOCATION_NAME_MUST_BE_LESS_THEN_60_CHARACTER);
            }

            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);
                return cb(err);
            }

            try {
                await conn.query('START TRANSACTION');
                response = await Supplier.validateOptionalFields(options);

                supplierFields = response.supplierFields;
                supplierOptionalValues = response.supplierOptionalValues;
                supplierLocFields = response.supplierLocFields;
                supplierLocValues = response.supplierLocValues;

                var query =
                  'IF EXISTS (SELECT 1 from LocationReference where accountId = uuid_to_bin(?) and locationId = ?)' +
                  'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "DUPLICATE_LOCATION_CREATION";' +
                  'ELSE INSERT into LocationReference SET accountId = uuid_to_bin(?),locationId = ?,locationName = ?,' +
                  'createdBy = uuid_to_bin(?),' + supplierLocFields + 'createdAt = ?,updatedAt = ?;end IF';

                var params = [options.accountId, options.newLocationId, options.accountId, options.newLocationId,
                    options.newLocationName, options.userId].concat(supplierLocValues).concat([currentDate, currentDate]);

                var locationInserted = await conn.query(query, params);

                if (!Utils.isAffectedPool(locationInserted)) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLIER_LOCATION_CREATION_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }

                query =
                  'IF EXISTS(SELECT 1 from Supplier  where supplierCode = ? and accountId = uuid_to_bin(?))' +
                  'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4002,MESSAGE_TEXT = "DUPLICATE_SUPPLIER_CODE";' +
                  'ELSEIF EXISTS (SELECT 1 from Supplier where accountId = uuid_to_bin(?) and supplierCode != ? and email = ?)' +
                  'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4003,MESSAGE_TEXT = "SUPPLIER_EMAIL_ALREADY_EXISTS";' +
                  'ELSE INSERT into Supplier SET id = uuid_to_bin(?),accountId = uuid_to_bin(?),supplierCode = ?,locationId = ?,suppliersAccountId = uuid_to_bin("00000000-0000-0000-0000-000000000000"),' +
                  'createdBy = uuid_to_bin(?),' + supplierFields + 'createdAt = ?,updatedAt = ?;end IF';

                params = [options.supplierCode, options.accountId, options.accountId, options.supplierCode, options.email, id, options.accountId, options.supplierCode,
                    options.newLocationId, options.userId].concat(supplierOptionalValues).concat([currentDate, currentDate]);

                var supplierInserted = await conn.query(query, params);

                if (!Utils.isAffectedPool(supplierInserted)) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLIER_CREATION_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }

                if (!options.addInviteFlag) {
                    await conn.query('COMMIT;');
                }
                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.SUPPLIER_CREATE_SUCCESS,
                    status: Constants.SUPPLIER_INVITATION_STATUS.NO_INVITATION,
                    id: id,
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
                    err = new Error(ErrorConfig.MESSAGE.DUPLICATE_SUPPLIER_CODE);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                } else if (err.errno === 4003) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLIER_EMAIL_ALREADY_EXISTS);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                } else if (err.errno) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLIER_CREATION_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                }
                return cb(err);
            }
        } else {
            try {
                await conn.query('START TRANSACTION');
                response = await Supplier.validateOptionalFields(options);

                supplierFields = response.supplierFields;
                supplierOptionalValues = response.supplierOptionalValues;
                supplierLocFields = response.supplierLocFields;
                supplierLocValues = response.supplierLocValues;

                if (options.locationId) {
                    query =
                      'IF EXISTS (SELECT 1 from Supplier where accountId = uuid_to_bin(?) and supplierCode = ?)' +
                      'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "DUPLICATE_SUPPLIER_CODE";' +
                      'ELSEIF EXISTS (SELECT 1 from Supplier where accountId = uuid_to_bin(?) and supplierCode != ? and email = ?)' +
                      'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4002,MESSAGE_TEXT = "SUPPLIER_EMAIL_ALREADY_EXISTS";' +
                      'ELSEIF NOT EXISTS(SELECT 1 from LocationReference  where accountId = uuid_to_bin(?) and locationId = ? and status = 1)' +
                      'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4003,MESSAGE_TEXT = "SUPPLIER_LOCATION_ID_NOT_BELONG_THIS_USER";' +
                      'ELSE INSERT into Supplier SET id = uuid_to_bin(?),accountId = uuid_to_bin(?),supplierCode = ?,locationId = ?,suppliersAccountId = uuid_to_bin("00000000-0000-0000-0000-000000000000"),' +
                      'createdBy = uuid_to_bin(?),' + supplierFields + 'createdAt = ?,updatedAt = ?;end IF';

                    params = [options.accountId, options.supplierCode, options.accountId, options.supplierCode, options.email, options.accountId, options.locationId, id,
                        options.accountId, options.supplierCode, options.locationId, options.userId].concat(supplierOptionalValues).concat([currentDate, currentDate]);
                    supplierInserted = await conn.query(query, params);

                    if (!Utils.isAffectedPool(supplierInserted)) {
                        err = new Error(
                          ErrorConfig.MESSAGE.SUPPLIER_CREATION_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                        throw err;
                    }
                    if (!options.addInviteFlag) {
                        await conn.query('COMMIT;');
                    }
                    return cb(null, {
                        OK: Constants.SUCCESS_MESSAGE.SUPPLIER_CREATE_SUCCESS,
                        status: Constants.SUPPLIER_INVITATION_STATUS.NO_INVITATION,
                        id: id,
                        updatedAt: currentDate
                    });
                } else {
                    query =
                      'IF EXISTS (SELECT 1 from Supplier where accountId = uuid_to_bin(?) and supplierCode = ?)' +
                      'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "DUPLICATE_SUPPLIER_CODE";' +
                      'ELSEIF EXISTS (SELECT 1 from Supplier where accountId = uuid_to_bin(?) and supplierCode != ? and email = ?)' +
                      'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4002,MESSAGE_TEXT = "SUPPLIER_EMAIL_ALREADY_EXISTS";' +
                      'ELSE INSERT into Supplier SET id = uuid_to_bin(?), accountId = uuid_to_bin(?),supplierCode = ?,suppliersAccountId = uuid_to_bin("00000000-0000-0000-0000-000000000000"),' +
                      'createdBy = uuid_to_bin(?),' + supplierFields + supplierLocFields + 'createdAt = ?,updatedAt = ?;end IF';

                    params = [options.accountId, options.supplierCode, options.accountId, options.supplierCode, options.email,
                        id, options.accountId, options.supplierCode,
                        options.userId].concat(supplierOptionalValues).concat(supplierLocValues).concat([currentDate, currentDate]);

                    supplierInserted = await conn.query(query, params);

                    if (!Utils.isAffectedPool(supplierInserted)) {
                        err = new Error(ErrorConfig.MESSAGE.SUPPLIER_CREATION_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                        throw err;
                    }
                    if (!options.addInviteFlag) {
                        await conn.query('COMMIT;');
                    }
                    return cb(null, {
                        OK: Constants.SUCCESS_MESSAGE.SUPPLIER_CREATE_SUCCESS,
                        status: Constants.SUPPLIER_INVITATION_STATUS.NO_INVITATION,
                        id: id,
                        updatedAt: currentDate
                    });
                }
            } catch (err) {
                debug('err', err);
                await conn.query('ROLLBACK;');
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);

                if (err.errno === 4001) {
                    err = new Error(ErrorConfig.MESSAGE.DUPLICATE_SUPPLIER_CODE);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                } else if (err.errno === 4002) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLIER_EMAIL_ALREADY_EXISTS);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                } else if (err.errno === 4003) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLIER_LOCATION_ID_NOT_BELONG_THIS_USER);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                } else if (err.errno) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLIER_CREATION_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                }
                return cb(err);
            }
        }
    },

    getSupplierByAccountIdMD: async function (options, errorOptions, cb) {
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

            var records = await conn.query('SELECT CAST(uuid_from_bin(id) as char) as id from Supplier ' +
              ' where accountId = uuid_to_bin(?) and isActive = ? order by updatedAt desc limit 10',
              [accountId, isActive]);

            debug('records', records.length);
            if (records.length <= 0) {
                suppliers = [];
                return cb(null, suppliers);
            }

            var response = await Supplier.manipulateQuerySupplier({suppliers: records});
            debug('response', response);

            var emptyLocationSuppliers = await conn.query(' select CAST(uuid_from_bin(id) as char) as id,CAST(uuid_from_bin(accountId) as char) as accountId, ' +
              ' CAST(uuid_from_bin(suppliersAccountId) as char) as suppliersAccountId,' +
              ' locationId, supplierId,supplierName,companyName,firstName,lastName,email,phone,fax,supplierCode,' +
              ' addressLine1,addressLine2,addressLine3,city,zipCode,state,country,googleLink ,' +
              ' status,invitationExpirationDate,isActive,primaryMobile,primaryMobileDialCode,primaryMobileCountry,secondaryMobile,' +
              ' secondaryMobileDialCode,secondaryMobileCountry,updatedAt from Supplier ' +
              ' where accountId = uuid_to_bin(?) and locationId = "" and isActive = ? and id in (' + response.string + ')',
              [accountId, isActive].concat(response.values));
            //emptyLocationSuppliers = Utils.filteredResponsePool(emptyLocationSuppliers);


            var supplierWithLocation = await conn.query('select CAST(uuid_from_bin(S.id) as char) as id,CAST(uuid_from_bin(S.accountId) as char) as accountId,' +
              'CAST(uuid_from_bin(S.suppliersAccountId) as char) as suppliersAccountId,S.supplierId,S.locationId, ' +
              'S.supplierName,S.companyName,S.firstName,S.lastName,S.email,S.phone,S.supplierCode, ' +
              'S.status,S.invitationExpirationDate,S.primaryMobile,S.secondaryMobile,' +
              'LR.googleLink, LR.locationName,LR.addressLine1,LR.addressLine2,LR.addressLine3,LR.city,LR.zipCode,LR.state,LR.country,LR.fax ,' +
              'S.isActive,S.updatedAt from Supplier S, LocationReference LR ' +
              'where LR.locationId = S.locationId and  LR.accountId = uuid_to_bin(?) and ' +
              'S.accountId = uuid_to_bin(?) and S.locationId != "" and S.isActive = ? and id in (' + response.string + '); ',
              [accountId, accountId, isActive].concat(response.values));

            var suppliers = [];
            suppliers = suppliers.concat(emptyLocationSuppliers).concat(supplierWithLocation);

            suppliers = _.sortBy(suppliers, 'updatedAt').reverse();


            /*await Promise.each(suppliers, async function (supplier) {
                var status = Object.keys(Constants.INVITATION_STATUS)[Object.values(Constants.INVITATION_STATUS).indexOf(supplier.status)];
                supplier.status = Constants.PARTNER_INVITATION_ACTION[status];
            });*/
            return cb(null, suppliers);

        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.SUPPLIER_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    getByAccountIdAndSupplierIdMD: async function (options, errorOptions, cb) {
        var accountId = options.accountId;
        var supplierId = options.supplierId;
        var err;
        if (DataUtils.isUndefined(accountId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
        }
        if (DataUtils.isUndefined(supplierId)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLIER_SUPPLIER_ID_REQUIRED);
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
            var supplier = await conn.query('SELECT CAST(uuid_from_bin(id) as char) as id,CAST(uuid_from_bin(accountId) as char) as accountId,' +
              'CAST(uuid_from_bin(suppliersAccountId) as char) as suppliersAccountId,' +
              'locationId, supplierId,supplierName,companyName,firstName,lastName,email,fax,addressLine1,addressLine2, addressLine3, city, zipCode, state, country,' +
              'supplierCode,status,invitationExpirationDate,phone,dialCode,phoneCountry,primaryMobile,primaryMobileDialCode,' +
              'primaryMobileCountry,secondaryMobile,secondaryMobileDialCode, secondaryMobileCountry,updatedAt,googleLink ' +
              'from Supplier where accountId = uuid_to_bin(?) and supplierId = ? and isActive = 1;', [accountId, supplierId]);

            supplier = Utils.filteredResponsePool(supplier);
            if (!supplier) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_SUPPLIER_ID_INVALID);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            if (supplier.locationId) {
                var locationReferenceData = await conn.query('select locationId, locationName, addressLine1, ' +
                  'addressLine2, addressLine3, city, zipCode, state, country, googleLink from LocationReference where accountId=uuid_to_bin(?) and locationId=?', [accountId, supplier.locationId]);
                locationReferenceData = Utils.filteredResponsePool(locationReferenceData);
                if (!locationReferenceData) {
                    debug('err', err);
                    return cb(null, supplier);
                }
                var supplierWithLocation = Object.assign(supplier, locationReferenceData);
                return cb(null, supplierWithLocation);
            }

            /*var status = Object.keys(Constants.INVITATION_STATUS)[Object.values(Constants.INVITATION_STATUS).indexOf(supplier.status)];
            supplier.status = Constants.PARTNER_INVITATION_ACTION[status];*/

            return cb(null, supplier);
        } catch (err) {
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            if (err.code) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_GET_FAILED);
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
            err = new Error(ErrorConfig.MESSAGE.SUPPLIER_ID_REQUIRED);
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
            var supplier = await conn.query('SELECT CAST(uuid_from_bin(id) as char) as id,CAST(uuid_from_bin(accountId) as char) as accountId,' +
              'CAST(uuid_from_bin(suppliersAccountId) as char)as suppliersAccountId,' +
              'locationId, supplierId,supplierName,companyName,firstName,lastName,email,phone,dialcode,phoneCountry,fax,addressLine1,addressLine2, ' +
              'addressLine3, city, zipCode, state, country,primaryMobile,primaryMobileDialCode,primaryMobileCountry,secondaryMobile,' +
              'secondaryMobileDialCode, secondaryMobileCountry,supplierCode,status,invitationExpirationDate,updatedAt,googleLink ' +
              'from Supplier where accountId = uuid_to_bin(?) and id = uuid_to_bin(?) and isActive = 1;', [accountId, id]);
            supplier = Utils.filteredResponsePool(supplier);

            if (!supplier) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_ID_INVALID);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }
            if (supplier.locationId) {
                var locationReferenceData = await conn.query('select locationId, locationName, addressLine1, ' +
                  'addressLine2, addressLine3, city, zipCode, state, country, googleLink from LocationReference where accountId=uuid_to_bin(?) and locationId=?', [accountId, supplier.locationId]);
                locationReferenceData = Utils.filteredResponsePool(locationReferenceData);
                if (!locationReferenceData) {
                    debug('err', err);
                    return cb(null, supplier);
                }
                var supplierWithLocation = Object.assign(supplier, locationReferenceData);
                return cb(null, supplierWithLocation);
            }
            /*var status = Object.keys(Constants.INVITATION_STATUS)[Object.values(Constants.INVITATION_STATUS).indexOf(supplier.status)];
            supplier.status = Constants.PARTNER_INVITATION_ACTION[status];*/
            return cb(null, supplier);
        } catch (err) {
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            if (err.code) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    getSupplierAndCustomerMD: async function (options, errorOptions, cb) {
        var accountId = options.accountId;

        if (DataUtils.isUndefined(accountId)) {
            var err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('err', err);
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            return cb(err);
        }

        try {

            var conn = await connection.getConnection();
            var supplier = await conn.query('SELECT ' +
              'CAST(uuid_from_bin(s.suppliersAccountId) as char) as accountId, ' +
              's.supplierName as partnerName,email ,  ? as type ' +
              'from Supplier s where s.accountId = uuid_to_bin(?) and s.suppliersAccountId != uuid_to_bin(?) and s.isActive = 1;',
              [Constants.PARTNER_TYPES.SUPPLIER, accountId, '00000000-0000-0000-0000-000000000000']);


            var customer = await conn.query('SELECT ' +
              'CAST(uuid_from_bin(s.customersAccountId) as char) as accountId, ' +
              's.customerName as partnerName,email, ? as type ' +
              'from Customers s where s.accountId = uuid_to_bin(?) and s.customersAccountId != uuid_to_bin(?) and s.isActive = 1;',
              [Constants.PARTNER_TYPES.CUSTOMER, accountId, '00000000-0000-0000-0000-000000000000']);


            return cb(null, supplier.concat(customer));

        } catch (err) {
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            if (err.code) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_AND_CUSTOMER_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    getSupplierById: function (options) {
        return new Promise(async function (resolve, reject) {
            var id = options.id;
            var err;
            try {
                var conn = await connection.getConnection();
                var supplier = await conn.query('select * from Supplier where id=uuid_to_bin(?) and isActive = 1;', [id]);
                supplier = Utils.filteredResponsePool(supplier);
                if (!supplier) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLIER_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }
                return resolve(supplier);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_GET_FAILED);
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
        var err, supplier;

        if (DataUtils.isUndefined(options.accountId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
        } else if (DataUtils.isUndefined(options.id)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLIER_ID_REQUIRED);
        } else if (DataUtils.isValidateOptionalField(options.updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLIER_UPDATED_AT_REQUIRED);
        } else if (DataUtils.isDefined(options.email) || options.email === '') {
            err = new Error(ErrorConfig.MESSAGE.CAN_NOT_UPDATE_EMAIL);
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

        var response, supplierFields, supplierOptionalValues, supplierLocFields, supplierLocValues;
        var currentDate = new Date().getTime();
        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        if (saveAsLater) {

            if (DataUtils.isValidateOptionalField(options.newLocationId) || options.newLocationId === '') {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_LOCATION_ID_REQUIRED);
            }

            if (!err && !DataUtils.isString(options.newLocationId)) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_LOCATION_ID_MUST_BE_STRING);
            }
            if (!err && options.newLocationId.length > 40) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_LOCATION_ID_MUST_BE_LESS_THAN_40_CHARACTER);
            }
            if (!err && DataUtils.isValidateOptionalField(options.newLocationName) || options.newLocationName === '') {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_LOCATION_NAME_REQUIRED);
            }
            if (!err && !DataUtils.isString(options.newLocationName)) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_LOCATION_NAME_MUST_BE_STRING);
            }
            if (!err && options.newLocationName.length > 60) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_LOCATION_NAME_MUST_BE_LESS_THEN_60_CHARACTER);
            }

            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);
                return cb(err);
            }

            try {
                await conn.query('START TRANSACTION');
                supplier = await Supplier.getSupplierById({id: options.id});

                options.addressLine1 = options.addressLine1 || supplier.addressLine1;
                options.addressLine2 = options.addressLine2 || supplier.addressLine2;
                options.addressLine3 = options.addressLine3 || supplier.addressLine3;
                options.city = options.city || supplier.city;
                options.zipCode = options.zipCode || supplier.zipCode;
                options.state = options.state || supplier.state;
                options.country = options.country || supplier.country;

                response = await Supplier.validateOptionalFields(options);

                supplierFields = response.supplierFields;
                supplierOptionalValues = response.supplierOptionalValues;
                supplierLocFields = response.supplierLocFields;
                supplierLocValues = response.supplierLocValues;

                if (DataUtils.isDefined(options.supplierId)) {
                    supplierFields += 'supplierId = ?,';
                    supplierOptionalValues.push(options.supplierId);
                }

                var query =
                  'IF EXISTS (SELECT 1 from LocationReference where accountId = uuid_to_bin(?) and locationId = ?)' +
                  'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "DUPLICATE_LOCATION_CREATION";' +
                  'ELSE INSERT into LocationReference SET accountId = uuid_to_bin(?),locationId = ?,locationName = ?,' +
                  'createdBy = uuid_to_bin(?),' + supplierLocFields + 'createdAt = ?,updatedAt = ?;end IF';

                var params = [options.accountId, options.newLocationId, options.accountId, options.newLocationId,
                    options.newLocationName, options.userId].concat(supplierLocValues).concat([currentDate, currentDate]);

                var locationInserted = await conn.query(query, params);


                if (!Utils.isAffectedPool(locationInserted)) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLIER_LOCATION_CREATION_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }

                query =
                  'IF NOT EXISTS(SELECT 1 from Supplier  where id = uuid_to_bin(?) and isActive = 1 )' +
                  'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4002,MESSAGE_TEXT = "SUPPLIER_ID_INVALID";' +
                  'ELSEIF NOT EXISTS (SELECT 1 from Supplier where id = uuid_to_bin(?) and updatedAt = ?)' +
                  'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4003,MESSAGE_TEXT = "SUPPLIER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED";';

                params = [options.id, options.id, options.updatedAt];

                if (DataUtils.isDefined(options.email)) {
                    query += 'ELSEIF EXISTS (SELECT 1 from Supplier where email = ? and accountId = uuid_to_bin(?) and id != uuid_to_bin(?))' +
                      'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4004,MESSAGE_TEXT = "EMAIL_EXIST_WITH_OTHER_SUPPLIER";';

                    params.push(options.email, options.accountId, options.id);
                }

                if (DataUtils.isDefined(options.supplierId)) {
                    query += 'ELSEIF EXISTS (SELECT 1 from Supplier where supplierId = ? and  accountId = uuid_to_bin(?) and id != uuid_to_bin(?))' +
                      'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4005,MESSAGE_TEXT = "SUPPLIER_SUPPLIERID_ALREADY_EXISTS_WITH_OTHER_SUPPLIER";';

                    params.push(options.supplierId, options.accountId, options.id);
                }

                query += 'ELSE UPDATE Supplier SET locationId = ?,locationName=?, updatedBy = uuid_to_bin(?),' + supplierFields + 'updatedAt = ? ' +
                  'where id = uuid_to_bin(?) and updatedAt = ?; end IF';

                params = params.concat([options.newLocationId, options.newLocationName, options.userId]).concat(supplierOptionalValues).concat([currentDate, options.id, updatedAt]);

                var supplierUpdated = await conn.query(query, params);

                if (!Utils.isAffectedPool(supplierUpdated)) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLIER_CREATION_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }

                await conn.query('COMMIT;');
                AuditUtils.create(auditOptions);
                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.SUPPLIER_UPDATE_SUCCESS,
                    id: options.id,
                    updatedAt: currentDate
                });

            } catch (err) {
                debug('err', err);
                await conn.query('ROLLBACK;');
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);

                if (err.errno === 4001) {
                    err = new Error(ErrorConfig.MESSAGE.DUPLICATE_LOCATION_CREATION);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;

                } else if (err.errno === 4002) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLIER_ID_INVALID);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;


                } else if (err.errno === 4003) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLIER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;

                } else if (err.errno === 4004) {
                    err = new Error(ErrorConfig.MESSAGE.EMAIL_EXIST_WITH_OTHER_SUPPLIER);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;

                } else if (err.errno === 4005) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLIER_SUPPLIERID_ALREADY_EXISTS_WITH_OTHER_SUPPLIER);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;

                } else if (err.code) {

                    err = new Error(ErrorConfig.MESSAGE.SUPPLIER_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                }
                return cb(err);
            }
        } else {
            try {
                await conn.query('START TRANSACTION');

                response = await Supplier.validateOptionalFields(options);

                supplierFields = response.supplierFields;
                supplierOptionalValues = response.supplierOptionalValues;
                supplierLocFields = response.supplierLocFields;
                supplierLocValues = response.supplierLocValues;

                if (DataUtils.isDefined(options.supplierId)) {
                    supplierFields += 'supplierId = ?,';
                    supplierOptionalValues.push(options.supplierId);
                }

                if (options.locationId) {
                    query =
                      'IF NOT EXISTS(SELECT 1 from Supplier  where id = uuid_to_bin(?) and isActive = 1)' +
                      'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "SUPPLIER_ID_INVALID";' +
                      'ELSEIF NOT EXISTS (SELECT 1 from Supplier where id = uuid_to_bin(?) and updatedAt = ?)' +
                      'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4002,MESSAGE_TEXT = "SUPPLIER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED";';

                    params = [options.id, options.id, options.updatedAt];

                    if (DataUtils.isDefined(options.email)) {
                        query += 'ELSEIF EXISTS (SELECT 1 from Supplier where email = ? and accountId = uuid_to_bin(?) and id != uuid_to_bin(?))' +
                          'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4003,MESSAGE_TEXT = "EMAIL_EXIST_WITH_OTHER_SUPPLIER";';

                        params.push(options.email, options.accountId, options.id);

                    }

                    if (DataUtils.isDefined(options.supplierId)) {
                        query += 'ELSEIF EXISTS (SELECT 1 from Supplier where supplierId = ? and  accountId = uuid_to_bin(?) and id != uuid_to_bin(?))' +
                          'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4004,MESSAGE_TEXT = "SUPPLIER_ID_ALREADY_EXISTS_WITH_OTHER_ID";';

                        params.push(options.supplierId, options.accountId, options.id);

                    }

                    query += 'ELSE UPDATE Supplier SET locationId = ?, updatedBy = uuid_To_bin(?),addressLine1 = "",addressLine2 = "",addressLine3 = "",city = "",zipCode = "",state = "",' +
                      'country = "",' + supplierFields + 'updatedAt = ? where id = uuid_to_bin(?) and accountId = uuid_to_bin(?);end IF';

                    params = params.concat([options.locationId, options.userId]).concat(supplierOptionalValues).concat([currentDate, options.id, options.accountId]);

                    supplierUpdated = await conn.query(query, params);

                    if (!Utils.isAffectedPool(supplierUpdated)) {
                        err = new Error(ErrorConfig.MESSAGE.SUPPLIER_UPDATE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                        throw err;
                    }

                    await conn.query('COMMIT;');
                    AuditUtils.create(auditOptions);
                    return cb(null, {
                        OK: Constants.SUCCESS_MESSAGE.SUPPLIER_UPDATE_SUCCESS,
                        id: options.id,
                        updatedAt: currentDate
                    });
                } else {
                    query =
                      'IF NOT EXISTS(SELECT 1 from Supplier  where id = uuid_to_bin(?) and isActive=1)' +
                      'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "SUPPLIER_ID_INVALID";' +
                      'ELSEIF NOT EXISTS (SELECT 1 from Supplier where id = uuid_to_bin(?) and updatedAt = ?)' +
                      'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4002,MESSAGE_TEXT = "SUPPLIER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED";';

                    params = [options.id, options.id, options.updatedAt];

                    if (DataUtils.isDefined(options.email)) {
                        query += 'ELSEIF EXISTS (SELECT 1 from Supplier where email = ? and accountId = uuid_to_bin(?) and id != uuid_to_bin(?))' +
                          'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4003,MESSAGE_TEXT = "EMAIL_EXIST_WITH_OTHER_SUPPLIER";';

                        params.push(options.email, options.accountId, options.id);
                    }

                    if (DataUtils.isDefined(options.supplierId)) {
                        query += 'ELSEIF EXISTS (SELECT 1 from Supplier where supplierId = ? and  accountId = uuid_to_bin(?) and id != uuid_to_bin(?))' +
                          'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4004,MESSAGE_TEXT = "SUPPLIER_ID_ALREADY_EXISTS_WITH_OTHER_ID";';
                        params.push(options.supplierId, options.accountId, options.id);
                    }

                    query += 'ELSE UPDATE Supplier SET updatedBy = uuid_To_bin(?),' + supplierFields + supplierLocFields + 'updatedAt = ? ' +
                      'where id = uuid_to_bin(?) and updatedAt = ?;end IF';

                    params = params.concat([options.userId]).concat(supplierOptionalValues).concat(supplierLocValues).concat([currentDate, options.id, updatedAt]);

                    supplierUpdated = await conn.query(query, params);

                    if (!Utils.isAffectedPool(supplierUpdated)) {
                        err = new Error(ErrorConfig.MESSAGE.SUPPLIER_UPDATE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                        throw err;
                    }
                    await conn.query('COMMIT;');
                    AuditUtils.create(auditOptions);
                    return cb(null, {
                        OK: Constants.SUCCESS_MESSAGE.SUPPLIER_UPDATE_SUCCESS,
                        id: options.id,
                        updatedAt: currentDate
                    });
                }
            } catch (err) {
                debug('err', err);
                await conn.query('ROLLBACK;');
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);

                if (err.errno === 4001) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLIER_ID_INVALID);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                } else if (err.errno === 4002) {

                    err = new Error(ErrorConfig.MESSAGE.SUPPLIER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;

                } else if (err.errno === 4003) {

                    err = new Error(ErrorConfig.MESSAGE.EMAIL_EXIST_WITH_OTHER_SUPPLIER);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;

                } else if (err.errno === 4004) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLIER_SUPPLIERID_ALREADY_EXISTS_WITH_OTHER_SUPPLIER);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;

                } else {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLIER_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                }
                return cb(err);
            }
        }
    },

    getPartnerId: function (options) {
        return new Promise(async function (resolve, reject) {
            var id = options.id;
            var flag = options.flag;
            var string, err;

            try {
                var conn = await connection.getConnection();
                if (!flag) {
                    string = 'select CAST(uuid_from_bin(customersAccountId) as char) as partnerId from Customers where ' +
                      'id = uuid_to_bin(?) and isActive = 1;';
                    err = new Error(ErrorConfig.MESSAGE.CUSTOMER_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    err.errno = 4002;
                }
                if (flag) {
                    string = 'select CAST(uuid_from_bin(suppliersAccountId) as char) as partnerId from Supplier where ' +
                      'id = uuid_to_bin(?) and isActive = 1;';
                    err = new Error(ErrorConfig.MESSAGE.SUPPLIER_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    err.errno = 4002;
                }
                var partnerId = await conn.query(string, [id]);
                partnerId = Utils.filteredResponsePool(partnerId);
                if (!partnerId) {
                    return reject(err);
                }
                return resolve(partnerId.partnerId);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    manipulateQuery: function (options) {
        return new Promise(function (resolve, reject) {
            var outShares = options.outShares;
            var string = '', values = [];

            _.map(outShares, function (outShare) {
                string += 'uuid_to_bin(?),';
                values.push(outShare.id);
            });
            string = string.replace(/,\s*$/, ' ');
            return resolve({
                string: string,
                values: values
            });
        });
    },

    manipulateQuerySupplier: function (options) {
        return new Promise(function (resolve, reject) {
            var suppliers = options.suppliers;
            var string = '', values = [];

            _.map(suppliers, function (supplier) {
                string += 'uuid_to_bin(?),';
                values.push(supplier.id);
            });
            string = string.replace(/,\s*$/, ' ');
            return resolve({
                string: string,
                values: values
            });
        });
    },

    /*
    * get outshare with no partner
    * */
    getOutShareWithNoPartner: function (options) {
        return new Promise(async function (resolve, reject) {
            var outShares = options.outShares;
            try {
                var conn = await connection.getConnection();

                var response = await Supplier.manipulateQuery({outShares: outShares});
                var filteredOutShares = await conn.query('select distinct CAST(uuid_from_bin(OS.id) as char) as id from OutShare OS where OS.id in (' + response.string + ') ' +
                  'and OS.id not in (select outShareInstanceId from InShare where status = 1)', response.values);

                return resolve(filteredOutShares);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
    * get outshares with new , pause_by_in_share , pause_by_out_share inshare
    * */
    getOutShareWithNewPauseInShare: function (options) {
        return new Promise(async function (resolve, reject) {
            var outShares = options.outShares;
            try {
                var conn = await connection.getConnection();

                var response = await Supplier.manipulateQuery({outShares: outShares});
                var filteredOutShares = await conn.query('select distinct CAST(uuid_from_bin(OS.id) as char) as id,OS.status from OutShare OS where OS.id in (' + response.string + ') ' +
                  'and OS.id in (select outShareInstanceId from InShare where (status = 0 or status = 4 or status = 5))', response.values);

                return resolve(filteredOutShares);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },


    /*
    * Get outShare with only 1 inshare
    * */
    getOutShareWithOneInshare: function (options) {
        return new Promise(async function (resolve, reject) {
            var outShares = options.outShares;
            var err;

            try {
                var conn = await connection.getConnection();

                var response = await Supplier.manipulateQuery({outShares: outShares});
                var filteredOutShares = await conn.query('select CAST(uuid_from_bin(I.outShareInstanceId) as char) as id,OS.status as status ' +
                  ' from InShare I , OutShare OS where I.outShareInstanceId = OS.id and OS.id in (' + response.string + ') ' +
                  ' group by outShareInstanceId having count(*) = 1;', response.values);
                return resolve(filteredOutShares);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
    * ignore invitationSent outshare and get active outshare from set of outshares
    * */
    ignoreInvitationSentOutShares: function (options) {
        return new Promise(async function (resolve, reject) {
            var outShares = options.outShares;
            var status = Constants.OUT_SHARE_STATUS.INVITATION_SENT;
            var filteredOutShare = [], invitationSentOutShares = [];
            try {
                _.map(outShares, function (outShare) {
                    if (outShare.status === status) {
                        invitationSentOutShares.push(outShare);
                    } else {
                        filteredOutShare.push(outShare);
                    }
                });

                if (invitationSentOutShares.length > 0) {
                    var outShareWithOneInShare = await Supplier.getOutShareWithOneInshare({outShares: invitationSentOutShares});
                    if (outShareWithOneInShare && outShareWithOneInShare.length > 0) {
                        filteredOutShare = filteredOutShare.concat(outShareWithOneInShare);
                    }
                }
                return resolve(filteredOutShare);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
    * ignore invitationSent outshare and get active outshare from set of outshares
    * */
    getActiveOutShares: function (options) {
        return new Promise(async function (resolve, reject) {
            var outShares = options.outShares;
            var status = Constants.OUT_SHARE_STATUS.ACTIVE;
            var filteredOutShare = [], activeOutShares = [];
            try {
                _.map(outShares, function (outShare) {
                    if (outShare.status === status) {
                        activeOutShares.push(outShare);
                    } else {
                        filteredOutShare.push(outShare);
                    }
                });

                return resolve(activeOutShares);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    updateOutShare: function (options) {
        return new Promise(async function (resolve, reject) {
            var outShares = options.outShares;
            var partnerId = options.partnerId;
            var userId = options.userId;
            var updatedAt = DataUtils.getEpochMSTimestamp();
            var currentDate = DataUtils.getEpochMSTimestamp();
            var updateOutShareOption;
            var err;

            try {
                var conn = await connection.getConnection();

                var response = await Supplier.manipulateQuery({outShares: outShares});

                // DELETE OutSharePartners (child) record
                var isDeleted = await conn.query('delete from OutSharePartners where inSharePartnerId=uuid_to_bin(?) and outShareInstanceId in (' + response.string + ')', [partnerId].concat(response.values));
                isDeleted = Utils.isAffectedPool(isDeleted);
                if (!isDeleted) {
                    err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }

                // Update OutShare who has no partner left , status = pause/stop
                var outShareWithNoActiveInShare = await Supplier.getOutShareWithNoPartner({outShares: outShares});

                if (outShareWithNoActiveInShare.length > 0) {

                    //get outshare who has new or pause by inshare or outshare status
                    var checkNewPauseInShareOption = {
                        outShares: outShareWithNoActiveInShare
                    };
                    var outShareWithNewPauseInShare = await Supplier.getOutShareWithNewPauseInShare(checkNewPauseInShareOption);

                    if (outShareWithNewPauseInShare.length > 0) {
                        // Find active outshares status , pause only active outshare , not pause and invitationSent
                        var activeOutShares = await Supplier.getActiveOutShares({outShares: outShareWithNewPauseInShare});

                        if (activeOutShares.length > 0) {
                            updateOutShareOption = {
                                outShares: activeOutShares,
                                userId: userId,
                                status: Constants.OUT_SHARE_STATUS.PAUSED,
                                endDate: DataUtils.getEpochMSTimestamp()
                            };
                        }
                    } else {
                        updateOutShareOption = {
                            outShares: outShareWithNoActiveInShare,
                            userId: userId,
                            status: Constants.OUT_SHARE_STATUS.STOP,
                            endDate: DataUtils.getEpochMSTimestamp()
                        };
                    }
                    if (updateOutShareOption) {
                        var updateOutShareResponse = await Supplier.updateMultipleOutShareStatus(updateOutShareOption);

                        // update Sharing Event by stopping it
                        if (outShares.length > 0) {
                            var updateSharingEventOption = {
                                outShares: updateOutShareOption.outShares,
                                userId: userId
                            };
                            var updateSharingEventsResponse = await Supplier.updatesharingEvent(updateSharingEventOption);
                        }
                    }
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
    * Update status of multiple outshares
    * */
    updateMultipleOutShareStatus: function (options) {
        return new Promise(async function (resolve, reject) {
            var outShares = options.outShares;
            var userId = options.userId;
            var status = options.status;
            var endDate = options.endDate;
            var currentDate = DataUtils.getEpochMSTimestamp();
            var response, err;

            try {
                var conn = await connection.getConnection();

                response = await Supplier.manipulateQuery({outShares: outShares});

                var isUpdated = await conn.query('update OutShare set status=?,endDate=?,updatedAt=?,updatedBy=uuid_to_bin(?),endDate=? where ' +
                  'id in (' + response.string + ')', [status, endDate, currentDate, userId, currentDate].concat(response.values));
                isUpdated = Utils.isAffectedPool(isUpdated);

                debug('isUpdated', isUpdated);
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    manipulateInShareQuery: function (options) {
        return new Promise(function (resolve, reject) {
            var inShares = options.inShares;
            var string = '', values = [];

            _.map(inShares, function (inShare) {
                string += 'uuid_to_bin(?),';
                values.push(inShare.id);
            });
            string = string.replace(/,\s*$/, ' ');
            return resolve({
                string: string,
                values: values
            });
        });
    },

    updatesharingEvent: function (options) {
        return new Promise(async function (resolve, reject) {
            var outShares = options.outShares;
            var status = Constants.SHARING_EVENT_STATUS.DEACTIVE;
            var userId = options.userId;
            var updatedAt = DataUtils.getEpochMSTimestamp();
            var endDate = DataUtils.getEpochMSTimestamp();
            var err;

            try {
                var conn = await connection.getConnection();

                var response = await Supplier.manipulateQuery({outShares: outShares});

                var isUpdated = await conn.query('update SharingEvents set status=?,updatedAt=?,endDate=? where ' +
                  'outShareInstanceId in (' + response.string + ') and status = 1;', [status, updatedAt, endDate].concat(response.values));

                isUpdated = Utils.isAffectedPool(isUpdated);
                debug('isUpdated sharing events', isUpdated);
                /*if (!isUpdated) {
                    err = new Error(ErrorConfig.MESSAGE.SHARING_EVENT_NOT_EXIST);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }*/
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.SHARING_EVENT_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    updateInShare: function (options) {
        return new Promise(async function (resolve, reject) {
            var inShares = options.inShares;
            var status = Constants.IN_SHARE_STATUS.STOP_BY_OUT_SHARE_PARTNER;
            var userId = options.userId;
            var updatedAt = DataUtils.getEpochMSTimestamp();
            var currentDate = DataUtils.getEpochMSTimestamp();
            var err;

            try {
                var conn = await connection.getConnection();

                var response = await Supplier.manipulateInShareQuery({inShares: inShares});

                var isUpdated = await conn.query('update InShare set status=?,updatedAt=?,updatedBy=uuid_to_bin(?),endDate=? where ' +
                  'id in (' + response.string + ')', [status, updatedAt, userId, currentDate].concat(response.values));
                isUpdated = Utils.isAffectedPool(isUpdated);
                debug('isUpdated inshare', isUpdated);
                if (!isUpdated) {
                    err = new Error(ErrorConfig.MESSAGE.IN_SHARE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.IN_SHARE_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    updateInShareAlert: function (options) {
        return new Promise(async function (resolve, reject) {
            var inShares = options.inShares;
            var status = options.status;
            var updatedAt = DataUtils.getEpochMSTimestamp();
            try {
                var conn = await connection.getConnection();

                var response = await Supplier.manipulateInShareQuery({inShares: inShares});
                debug('response', response);

                var updated = await conn.query('UPDATE SharingAlert SET status = ?, updatedAt = ? WHERE' +
                  ' inShareId in (' + response.string + ')', [status, updatedAt].concat(response.values));
                debug('updated', updated);

                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.UPDATE_IN_SHARE_ALERT_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        })
    },


    checkOutShareInShare: function (options) {
        return new Promise(async function (resolve, reject) {
            var id = options.id;
            var userId = options.userId;
            var accountId = options.accountId;
            var flag = options.flag;
            var type;
            var outShares = [], inShares = [];
            var notifyFlag = false;

            try {
                var conn = await connection.getConnection();

                // Get partnerId from the customer or supplier id (if flag = true then supplier else customer)
                var partnerId = await Supplier.getPartnerId({id: id, flag: flag});

                if (!partnerId) {
                    return resolve(Constants.OK_MESSAGE);
                }
                type = flag ? 'supplier' : 'customer';
                outShares = await conn.query('select CAST(uuid_from_bin(OS.id) as char) as id,OS.status from OutShare OS,OutSharePartners OSP  ' +
                  'where OS.accountId=uuid_to_bin(?) and (OS.status = 3 or OS.status = 2 or OS.status = 5) and  OS.id = OSP.outShareInstanceId and ' +
                  'OSP.inSharePartnerId = uuid_to_bin(?) and OSP.type = ? ; ', [accountId, partnerId, type]);

                if (outShares.length > 0) {
                    var response = await Supplier.manipulateQuery({outShares: outShares});

                    // Get the inshare records of this partner
                    inShares = await conn.query('select CAST(uuid_from_bin(id) as char) as id from InShare ' +
                      'where accountId=uuid_to_bin(?) and  outShareInstanceId in (' + response.string + ') and (status = 1 OR status = 0) ', [partnerId].concat(response.values));
                }

                // Update Inshare
                if (inShares.length > 0) {
                    var updateInShareOption = {
                        inShares: inShares,
                        userId: userId
                    };
                    var updateInShareResponse = await Supplier.updateInShare(updateInShareOption);
                    debug('updateInShareResponse', updateInShareResponse);

                    var updateInShareAlertOptions = {
                        inShares: inShares,
                        status: Constants.ALERT_STATUS.IN_ACTIVE
                    };

                    var updateInShareAlertResponse = await Supplier.updateInShareAlert(updateInShareAlertOptions);
                    debug('updateInShareAlertResponse', updateInShareAlertResponse);
                }

                // Update outShare
                if (outShares.length > 0) {
                    var updateOutShareOption = {
                        outShares: outShares,
                        userId: userId,
                        partnerId: partnerId
                    };
                    var updateOutShareResponse = await Supplier.updateOutShare(updateOutShareOption);
                    debug('updateOutShareResponse', updateOutShareResponse);
                    notifyFlag = true;
                }

                return resolve({partnerId: partnerId, notifyFlag: notifyFlag, id: id});
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },
    /*
       * Get existing customers by id
       * */
    getExistSupplierIds: function (options) {
        return new Promise(async function (resolve, reject) {
            var suppliers = options.suppliers;
            var accountId = options.accountId;
            var successSuppliers = [], conflictSuppliers = [];

            try {
                var conn = await connection.getConnection();

                var response = await Supplier.manipulateQuerySupplier({suppliers: suppliers});
                debug('response', response);

                var supplierIds = await conn.query('select  CAST(uuid_from_bin(id) as CHAR) as id from Supplier ' +
                  ' where accountId=uuid_to_bin(?) and id in (' + response.string + ')', [accountId].concat(response.values));

                supplierIds = _.map(supplierIds, 'id');

                if (supplierIds.length > 0) {
                    _.map(suppliers, function (supplier) {
                        if (supplierIds.indexOf(supplier.id) === -1) {
                            conflictSuppliers.push(supplier.id);
                        } else {
                            successSuppliers.push(supplier);
                        }
                    });
                } else {
                    conflictSuppliers = _.map(suppliers, 'id');
                }
                var supplierResponse = {
                    successSuppliers: successSuppliers,
                    conflictSuppliers: conflictSuppliers
                };

                return resolve(supplierResponse);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    checkUpdatedAt: function (options) {
        return new Promise(async function (resolve, reject) {
            var suppliers = options.suppliers;
            var accountId = options.accountId;
            var string = '', values = [];
            var conflict = [], success = [], failed = [];
            var conflictIds = [];
            var existSuppliers = [];

            try {
                var conn = await connection.getConnection();

                var getExistSupplierOption = {
                    suppliers: suppliers,
                    accountId: accountId
                };
                var getExistSupplierResponse = await Supplier.getExistSupplierIds(getExistSupplierOption);
                existSuppliers = getExistSupplierResponse.successSuppliers;
                conflict = getExistSupplierResponse.conflictSuppliers;

                failed = conflict.slice();
                if (existSuppliers.length <= 0) {
                    return resolve({success: success, conflict: conflict, failed: failed});
                }


                await Promise.each(existSuppliers, function (supplier) {
                    string += ' SELECT CAST(uuid_from_bin(id) as char) as id FROM Supplier WHERE (updatedAt != ? AND id = uuid_to_bin(?)) UNION ALL ';
                    values.push(supplier.updatedAt, supplier.id);
                });
                string = string.replace(/UNION ALL \s*$/, ' ');

                var response = await conn.query(string, values);

                conflictIds = _.map(response, function (value) {
                    return value.id;
                });

                _.map(existSuppliers, function (supplier) {
                    if (conflictIds.indexOf(supplier.id) === -1) {
                        success.push(supplier);
                    } else {
                        conflict.push(supplier.id);
                    }
                });

                return resolve({success: success, conflict: conflict, failed: failed});
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
    * update supplier by isActvie = 0
    * */
    deleteArchieveSuppliers: function (options) {
        return new Promise(async function (resolve, reject) {
            var suppliers = options.suppliers;
            var accountId = options.accountId;
            var userId = options.userId;
            var updatedAt = DataUtils.getEpochMSTimestamp();
            var err;
            try {
                var conn = await connection.getConnection();
                var queryResponse = await Supplier.manipulateQuerySupplier({suppliers: suppliers});

                var isUpdated = await conn.query('update Supplier set isActive = 0, updatedAt = ?, updatedBy = uuid_to_bin(?) ' +
                  ' where accountId = uuid_to_bin(?) and id in (' + queryResponse.string + ');',
                  [updatedAt, userId, accountId].concat(queryResponse.values));
                isUpdated = Utils.isAffectedPool(isUpdated);
                debug('isUpdated', isUpdated);

                if (!isUpdated) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLIER_ARCHIEVE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_ARCHIEVE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    restoreSuppliers: function (options) {
        return new Promise(async function (resolve, reject) {
            var suppliers = options.suppliers;
            var accountId = options.accountId;
            var userId = options.userId;
            var updatedAt = DataUtils.getEpochMSTimestamp();
            var err;
            try {
                var conn = await connection.getConnection();
                var queryResponse = await Supplier.manipulateQuerySupplier({suppliers: suppliers});

                var isUpdated = await conn.query('update Supplier set isActive = 1, updatedAt = ?, updatedBy = uuid_to_bin(?) ' +
                  ' where accountId = uuid_to_bin(?) and id in (' + queryResponse.string + ');',
                  [updatedAt, userId, accountId].concat(queryResponse.values));
                isUpdated = Utils.isAffectedPool(isUpdated);
                debug('isUpdated', isUpdated);

                if (!isUpdated) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLIER_RESTORE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_RESTORE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    deleteSuppliers: function (options) {
        return new Promise(async function (resolve, reject) {
            var suppliers = options.suppliers;
            var accountId = options.accountId;
            var err;

            try {
                var conn = await connection.getConnection();
                debug('supplier', suppliers);
                var queryResponse = await Supplier.manipulateQuerySupplier({suppliers: suppliers});
                debug('query', queryResponse);
                var isDeleted = await conn.query('delete from Supplier where accountId = uuid_to_bin(?) and isActive = 0 ' +
                  ' and id in (' + queryResponse.string + ');',
                  [accountId].concat(queryResponse.values));

                isDeleted = Utils.isAffectedPool(isDeleted);

                if (!isDeleted) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLIER_DELETE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err234', err);
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_DELETE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
    * Notify all auth user of deleted supplier
    * */
    notifySuppliers: function (options) {
        return new Promise(async function (resolve, reject) {
            var checkResponses = options.checkResponses;
            var userId = options.userId;
            var NotificationApi = require('../api/notification');

            try {
                await Promise.each(checkResponses, async function (checkResponse) {
                    if (checkResponse.notifyFlag) {
                        var inviterUser = await CustomerApi.getUserById({userId: userId});

                        var authUsers = await CustomerApi.getAuthorizeUser({accountId: checkResponse.partnerId});

                        var date = new Date();

                        var invitationExpirationDate = date.setDate(date.getDate() + Constants.INVITATION_EXPIRATION_DATE_LIMIT);
                        invitationExpirationDate = new Date(invitationExpirationDate);

                        await Promise.each(authUsers, async function (user) {
                            var inviteeUser = await CustomerApi.getUserByIdMD({
                                userId: user.userId,
                                notifyType: Constants.NOTIFICATION_CATEGORY_TYPE.PARTNERS
                            });

                            var opt = {
                                languageCultureCode: inviterUser.languageCultureCode,
                                template: Constants.EMAIL_TEMPLATES.DELETE_SUPPLIER,
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
                                        refereId: checkResponse.id, //id of delete supplier
                                        refereType: Constants.NOTIFICATION_REFERE_TYPE.SUPPLIER,
                                        user_ids: [inviteeUser.id],
                                        topic_id: inviteeUser.id,
                                        notificationExpirationDate: invitationExpirationDate,
                                        paramasDateTime: new Date(),
                                        notification_reference: NotificationReferenceData.SUPPLIER_DELETE,
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
                                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_DELETE_FAILED);
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

    validateSupplier: function (options) {
        return new Promise(async function (resolve, reject) {
            var suppliers = options.suppliers;
            var err;
            try {
                if (DataUtils.isUndefined(suppliers)) {
                    err = new Error(ErrorConfig.MESSAGE.ID_REQUIRED);
                } else if (!DataUtils.isArray(suppliers)) {
                    err = new Error(ErrorConfig.MESSAGE.ID_MUST_BE_ARRAY);
                } else if (suppliers.length <= 0) {
                    err = new Error(ErrorConfig.MESSAGE.ATLEAST_ONE_ID_REUQIRED);
                }
                if (err) {
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }

                await Promise.each(suppliers, async function (supplier) {
                    if (DataUtils.isUndefined(supplier.id)) {
                        err = new Error(ErrorConfig.MESSAGE.SUPPLIER_ID_REQUIRED);
                    } else if (DataUtils.isValidateOptionalField(supplier.updatedAt)) {
                        err = new Error(ErrorConfig.MESSAGE.SUPPLIER_UPDATED_AT_REQUIRED);
                    } else if (!DataUtils.isValidNumber(supplier.updatedAt)) {
                        err = new Error(ErrorConfig.MESSAGE.SUPPLIER_UPDATED_AT_MUST_BE_NUMBER);
                    } else if (supplier.updatedAt.toString().length !== 13) {
                        err = new Error(ErrorConfig.MESSAGE.SUPPLIER_UPDATED_AT_INVALID);
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
        var accountId = options.accountId;
        var suppliers = options.ids;
        var userId = options.userId;
        var successSupplier = [], conflictSupplier = [];
        var checkResponses = [];
        var err;

        try {
            debug('suppliers', suppliers);
            var checkOption = {
                suppliers: suppliers
            };
            var checkResponse = await Supplier.validateSupplier(checkOption);
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
            var response = await Supplier.checkUpdatedAt({suppliers: suppliers, accountId: accountId});
            debug('response', response);
            successSupplier = response.success;
            conflictSupplier = response.conflict;

            if (successSupplier.length <= 0) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {success: successSupplier, conflict: conflictSupplier};
                return cb(err);
            }

            // Check if any out share or inshare is exist for each partner , if yes then stop sharing for this partner

            await Promise.each(successSupplier, async function (supplier) {
                var checkOptions = {
                    id: supplier.id,
                    accountId: accountId,
                    userId: userId,
                    flag: true
                };
                var checkResponse = await Supplier.checkOutShareInShare(checkOptions);
                if (checkResponse) {
                    checkResponses.push(checkResponse);
                }
            });

            // DELETE MULTIPLE SUPPLIERS
            var deleteSuppliersOption = {
                suppliers: successSupplier,
                accountId: accountId,
                userId: userId
            };
            var deleteResponse = await Supplier.deleteArchieveSuppliers(deleteSuppliersOption);
            debug('deleteResponse', deleteResponse);


            // NOTIFY ALL AUTH  USER OF SUPPLIERS
            var notifySupplierOption = {
                checkResponses: checkResponses,
                userId: userId
            };
            var notifyResponse = await Supplier.notifySuppliers(notifySupplierOption);
            debug('notifyResponse', notifyResponse);

            await conn.query('COMMIT;');
            AuditUtils.create(auditOptions);
            if (successSupplier.length > 0 && conflictSupplier.length > 0) {
                debug('Inside if');
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {
                    successMsg: Constants.SUCCESS_MESSAGE.SUPPLIER_ARCHIEVED_SUCCESSFULLY,
                    success: _.map(successSupplier, 'id'),
                    conflict: conflictSupplier
                };
                debug('err', err);
                return cb(err);
            } else {
                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.SUPPLIER_ARCHIEVED_SUCCESSFULLY,
                    success: _.map(successSupplier, 'id')
                });
            }
        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK;');
            ErrorUtils.create(errorOptions, options, err);
            if (err.errno === 4002) {
                return cb(err);
            } else {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_ARCHIEVE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    delete: async function (options, auditOptions, errorOptions, cb) {
        var accountId = options.accountId;
        var suppliers = options.ids;
        var userId = options.userId;
        var successSupplier = [], conflictSupplier = [];
        var checkResponses = [];
        var err;

        try {
            debug('suppliers', suppliers);
            var checkOption = {
                suppliers: suppliers
            };
            var checkResponse = await Supplier.validateSupplier(checkOption);
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
            var response = await Supplier.checkUpdatedAt({suppliers: suppliers, accountId: accountId});
            debug('response', response);
            successSupplier = response.success;
            conflictSupplier = response.conflict;

            if (successSupplier.length <= 0) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {success: successSupplier, conflict: conflictSupplier};
                return cb(err);
            }

            // DELETE MULTIPLE SUPPLIERS
            var deleteSuppliersOption = {
                suppliers: successSupplier,
                accountId: accountId,
                userId: userId
            };
            var deleteResponse = await Supplier.deleteSuppliers(deleteSuppliersOption);
            debug('deleteResponse', deleteResponse);


            await conn.query('COMMIT;');
            AuditUtils.create(auditOptions);
            if (successSupplier.length > 0 && conflictSupplier.length > 0) {
                debug('Inside if');
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {
                    successMsg: Constants.SUCCESS_MESSAGE.SUPPLIER_DELETED_SUCCESSFULLY,
                    success: _.map(successSupplier, 'id'),
                    conflict: conflictSupplier
                };
                debug('err', err);
                return cb(err);
            } else {
                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.SUPPLIER_DELETED_SUCCESSFULLY,
                    success: _.map(successSupplier, 'id')
                });
            }
        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK;');
            ErrorUtils.create(errorOptions, options, err);
            if (err.errno === 4002) {
                return cb(err);
            } else {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_DELETE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    restore: async function (options, auditOptions, errorOptions, cb) {
        var accountId = options.accountId;
        var suppliers = options.ids;
        var userId = options.userId;
        var successSupplier = [], conflictSupplier = [];
        var checkResponses = [];
        var err;

        try {
            debug('suppliers', suppliers);
            var checkOption = {
                suppliers: suppliers
            };
            var checkResponse = await Supplier.validateSupplier(checkOption);
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
            var response = await Supplier.checkUpdatedAt({suppliers: suppliers, accountId: accountId});
            successSupplier = response.success;
            conflictSupplier = response.conflict;

            if (successSupplier.length <= 0) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {success: successSupplier, conflict: conflictSupplier};
                return cb(err);
            }

            // RESTORE MULTIPLE SUPPLIERS
            var restoreSuppliersOption = {
                suppliers: successSupplier,
                accountId: accountId,
                userId: userId
            };
            var restoreResponse = await Supplier.restoreSuppliers(restoreSuppliersOption);
            debug('restoreResponse', restoreResponse);


            await conn.query('COMMIT;');
            AuditUtils.create(auditOptions);
            if (successSupplier.length > 0 && conflictSupplier.length > 0) {
                debug('Inside if');
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {
                    successMsg: Constants.SUCCESS_MESSAGE.SUPPLIER_RESTORED_SUCCESSFULLY,
                    success: _.map(successSupplier, 'id'),
                    conflict: conflictSupplier
                };
                debug('err', err);
                return cb(err);
            } else {
                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.SUPPLIER_RESTORED_SUCCESSFULLY,
                    success: _.map(successSupplier, 'id')
                });
            }
        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK;');
            ErrorUtils.create(errorOptions, options, err);
            if (err.errno === 4002) {
                return cb(err);
            } else {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_RESTORE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    inviteMD: async function (options, errorOptions, cb) {
        var accountId = options.user.accountId;
        var id = options.id;
        var updatedAt = options.updatedAt;
        var email = options.email;
        var flag = options.flag;
        var personalMessage = options.personalMessage || '';
        var inviterUser = options.user;
        var str = '';
        var err;

        if (DataUtils.isUndefined(accountId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
        } else if (DataUtils.isUndefined(id)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLIER_ID_REQUIRED);
        } else if (DataUtils.isValidateOptionalField(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLIER_UPDATED_AT_REQUIRED);
        } else if (DataUtils.isUndefined(email)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLIER_EMAIL_REQUIRED);
        }
        if (err) {
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
        try {
            if (!options.addInviteFlag) {
                await conn.query('START TRANSACTION;');
            }

            var date = new Date();
            var currentDate = date.getTime();

            var params = [id, id, updatedAt, accountId, email, id, email];

            if ((personalMessage && !flag) || !flag) {
                str += 'personalMessage=?,';
                params.push(personalMessage);
            }
            params.push(currentDate, inviterUser.id, id, updatedAt);

            var query =
              'IF NOT EXISTS (SELECT 1 from Supplier where id = uuid_to_bin(?) and isActive=1)' +
              'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "SUPPLIER_ID_INVALID";' +
              'ELSEIF NOT EXISTS (SELECT 1 from Supplier where id = uuid_to_bin(?) and updatedAt = ?)' +
              'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4002,MESSAGE_TEXT = "SUPPLIER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED";' +
              'ELSEIF EXISTS (SELECT 1 from Supplier where accountId = uuid_to_bin(?) and email = ? and  id != uuid_to_bin(?))' +
              'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4003,MESSAGE_TEXT = "EMAIL_EXIST_WITH_OTHER_SUPPLIER";' +
              'ELSE UPDATE Supplier SET email = ?,' + str + ' updatedAt = ?,updatedBy = uuid_to_bin(?)' +
              'where id = uuid_to_bin(?) and updatedAt = ?; end IF';


            var supplierUpdated = await conn.query(query, params);
            debug('supplierUpdated', supplierUpdated);
            if (!Utils.isAffectedPool(supplierUpdated)) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_EMAIL_UPDATE_FALIED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }


            var getSupplier = await conn.query('SELECT CAST(uuid_from_bin(id) as char) as id,CAST(uuid_from_bin(accountId) as char) as accountId,' +
              'locationId,supplierId,supplierCode,supplierName,companyName,firstName,LastName,' +
              'email,phone,fax,updatedAt,googleLink from Supplier where accountId = uuid_to_bin(?) and id = uuid_to_bin(?) and isActive = 1;', [accountId, id]);

            getSupplier = Utils.filteredResponsePool(getSupplier);


            var userExist = await conn.query('select CAST(uuid_from_bin(id) as char) as id,CAST(uuid_from_bin(accountId) as char) as accountId,' +
              'status,flag,postRegComplete,tosStatus,email,languageCultureCode,emailStatus from users where email=?', email);

            var inviteeUserExists = Utils.filteredResponsePool(userExist);

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
                var insertResponse = await conn.query('If NOT EXISTS (select 1 from users where email= ?) THEN ' +
                  'INSERT into users (id,email,languageCultureCode,status,postRegComplete,tosStatus,' +
                  'emailStatus,profileComplete,securityComplete,isAccountActive,' +
                  'isAccountEnabled,createdAt,updatedAt, flag, accountId, authorizeUserStatus)' +
                  'values(uuid_to_bin(?),?,?,?,?,?,?,?,?,?,?,utc_timestamp(3),utc_timestamp(3), ?, uuid_to_bin(?), ?); end if',
                  [email, Utils.generateId().uuid, getSupplier.email, inviterUser.languageCultureCode,
                      Constants.USER_STATUS.TEMPORARY, false, false, false, false, false, false, false, Constants.USER_FLAG.SUPPLIER_INVITATION, account.id, Constants.AUTHORIZE_USER_STATUS.OPEN]);

                var isUserAffected = Utils.isAffectedPool(insertResponse);

                if (isUserAffected) {
                    var userResponse = await conn.query('select CAST(uuid_from_bin(id) as char) as id,CAST(uuid_from_bin(accountId) as char) as accountId,status,flag,postRegComplete,' +
                      'tosStatus,email,languageCultureCode,emailStatus from users where email=?', email);
                    inviteeUserExists = Utils.filteredResponsePool(userResponse);
                } else {
                    var userResponse = await conn.query('select CAST(uuid_from_bin(id) as char) as id,CAST(uuid_from_bin(accountId) as char) as accountId,' +
                      'status,flag,postRegComplete,tosStatus,email,languageCultureCode,emailStatus from users where email=?', email);
                    inviteeUserExists = Utils.filteredResponsePool(userResponse);
                }
            } else {
                var blackList = await Supplier.checkBlackListMD({
                    inviteeUserExists: inviteeUserExists,
                    inviterUser: inviterUser
                });
                if (blackList) {
                    return cb();
                }
            }

            var defaultDate = new Date();
            var supplierInvitationExpirationDate = defaultDate.setDate(defaultDate.getDate() + Constants.CUSTOMER_INVITATION_EXPIRATION_DATE_LIMIT);
            supplierInvitationExpirationDate = new Date(supplierInvitationExpirationDate);

            // SEND NOTIFICATION TO ALL THE AUTHUSER OF CUSTOMERS ACCOUNT
            var authUsers = await CustomerApi.getAuthorizeUser({accountId: inviteeUserExists.accountId});
            if (!authUsers || authUsers.length <= 0) {
                var notificationOptions = {
                    userId: inviteeUserExists.id,
                    inviterUser: inviterUser,
                    id: id,
                    notificationExpirationDate: supplierInvitationExpirationDate
                };
                var notificationResponse = await Supplier.sendNotification(notificationOptions);
            } else {
                await Promise.each(authUsers, async function (inviteeUser) {
                    var notificationOptions = {
                        userId: inviteeUser.userId,
                        inviterUser: inviterUser,
                        id: id,
                        notificationExpirationDate: supplierInvitationExpirationDate
                    };
                    var notificationResponse = await Supplier.sendNotification(notificationOptions);
                });
            }

            // UPDATE SUPPLIER WITH STATUS AND INVITATION EXPIRATION DATE
            var supplierStatusUpdate = await conn.query('UPDATE Supplier SET status = ?,invitationExpirationDate=?, updatedBy = uuid_to_bin(?), updatedAt = ?' +
              ' where id = uuid_to_bin(?)', [Constants.SUPPLIER_INVITATION_STATUS.OPEN, supplierInvitationExpirationDate, inviterUser.id, currentDate, id]);
            if (!Utils.isAffectedPool(supplierStatusUpdate)) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            await conn.query('COMMIT;');
            return cb(null, {
                OK: Constants.SUCCESS_MESSAGE.SUPPLIER_INVITE_SUCCESS,
                status: Constants.SUPPLIER_INVITATION_STATUS.OPEN,
                invitationExpirationDate: supplierInvitationExpirationDate,
                id: id,
                updatedAt: currentDate
            });
        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK;');
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_ID_INVALID);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;

            } else if (err.errno === 4002) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;

            } else if (err.errno === 4003) {
                err = new Error(ErrorConfig.MESSAGE.EMAIL_EXIST_WITH_OTHER_SUPPLIER);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;

            } else {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_INVITE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    sendNotification: function (options) {
        return new Promise(async function (resolve, reject) {
            var userId = options.userId;
            var inviterUser = options.inviterUser;
            var id = options.id;
            var notificationExpirationDate = options.notificationExpirationDate;
            var date = new Date();
            var err;

            var user = await CustomerApi.getUserById({userId: userId});

            var compileOptions = {
                name: user.firstName,
                friend: inviterUser.email,
                scopehub_login: Endpoints.SCOPEHUB_LOGIN_URL
            };
            var opt = {
                languageCultureCode: inviterUser.languageCultureCode,
                template: Constants.EMAIL_TEMPLATES.SUPPLIER_INVITE,
                email: user.email
            };

            if (user.status === Constants.USER_STATUS.ACTIVE || user.status === Constants.USER_STATUS.TEMPORARY) {

                try {
                    //SEND EMAIL
                    debug('opt', opt);
                    debug('compileOptions', compileOptions);
                    await EmailUtils.sendEmailPromise(opt, compileOptions);

                    var NotificationApi = require('../api/notification');
                    var notificationOption = {
                        refereId: id,
                        refereType: Constants.NOTIFICATION_REFERE_TYPE.SUPPLIER,
                        user_ids: [user.id],
                        topic_id: user.id,
                        notificationExpirationDate: notificationExpirationDate,
                        paramasDateTime: new Date(),
                        notification_reference: NotificationReferenceData.SUPPLIER_INVITE,
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
                    return resolve(Constants.OK_MESSAGE);

                } catch (err) {
                    debug('err', err);
                    err = new Error(ErrorConfig.MESSAGE.SUPPLIER_INVITE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }

            } else {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_INVITEE_IS_INACTIVE);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return reject(err);
            }
        });
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
                var conn = await connection.getConnection();
                var query = 'IF EXISTS(select * from blackList where inviteeUUID = uuid_to_bin(?) and inviterEmailDomain = ?)' +
                  'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "DOMAIN_BLOACKED_BY_INVITEE";' +
                  'ELSEIF EXISTS (select * from blackList where inviteeUUID = uuid_to_bin(?) and inviterEmail = ?)' +
                  'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "EMAIL_BLOACKED_BY_INVITEE";' +
                  'ELSEIF EXISTS (select * from blackList where inviteeUUID = uuid_to_bin(?) and inviterUUID = uuid_to_bin(?))' +
                  'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "INVITER_UUID_BLOACKED_BY_INVITEE"; end IF';

                var params = [inviteeUUID, inviterEmailDomain, inviteeUUID, inviterUser.email, inviteeUUID, inviterUUID];
                await conn.query(query, params);
            }
        }
        return false;
    },

    checkForSameAccountSupplierNotification: function (options) {
        return new Promise(async function (resolve, reject) {
            var supplierId = options.supplierId;
            var err;

            try {
                var conn = await connection.getConnection();
                var response = await conn.query('SELECT 1 FROM users U , Supplier S1,Supplier S2 ' +
                  ' where S1.id = uuid_to_bin(?) and S1.email = U.email and U.accountId = S2.suppliersAccountId ' +
                  ' and S2.accountId = S1.accountId; ', [supplierId]);

                if (response.length > 0) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLIER_ALREADY_EXIST_FOR_SAME_ACCOUNT);
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

    acceptDeclineIgnoreSupplierInvitationMD: async function (notification, auditOptions, errorOptions, cb) {
        var id = notification.id;
        var user = notification.user;
        var action = notification.action;
        var inviteeEmail = notification.inviteeEmail;

        var err;
        if (DataUtils.isUndefined(id)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLIER_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug(err);
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var getSupplierQuery = 'SELECT CAST(uuid_from_bin(accountId) as CHAR) as accountId,CAST(uuid_from_bin(suppliersAccountId) as CHAR) as suppliersAccountId ,' +
              'locationId, supplierId,supplierName,companyName,firstName,lastName,email,phone,fax,supplierCode,' +
              'status,updatedAt,googleLink from Supplier where id = uuid_to_bin(?) and isActive = 1;';

            var supplierResult = await conn.query(getSupplierQuery, [id]);
            var supplier = Utils.filteredResponsePool(supplierResult);

            if (!supplier) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            var supplierStatus, notification_reference, template;

            if (action === Constants.INVITATION_STATUS_NOTIFICATION_ACTION.IGNORE) {
                //supplierStatus = Constants.INVITATION_STATUS.IGNORED;
                notification_reference = NotificationReferenceData.SUPPLIER_INVITE_CANCEL;

            } else if (action === Constants.INVITATION_STATUS_NOTIFICATION_ACTION.DECLINE) {

                template = Constants.EMAIL_TEMPLATES.DECLINED_INVITE;
                supplierStatus = Constants.SUPPLIER_INVITATION_STATUS.DECLINED;
                notification_reference = NotificationReferenceData.SUPPLIER_INVITE_DECLINE;

            } else if (action === Constants.INVITATION_STATUS_NOTIFICATION_ACTION.ACCEPT) {

                // CHECK if supplier is already exist of same company or account
                var checkOption = {
                    supplierId: id
                };
                var checkResponse = await Supplier.checkForSameAccountSupplierNotification(checkOption);

                notification_reference = NotificationReferenceData.SUPPLIER_INVITE_ACCEPT;
                template = Constants.EMAIL_TEMPLATES.ACCEPT_INVITE;
                supplierStatus = Constants.SUPPLIER_INVITATION_STATUS.ACCEPTED;

            } else {
                return cb();
            }

            var currentDate = new Date().getTime();
            if (supplierStatus) {
                var supplierUpdate = await conn.query('UPDATE Supplier SET status = ?, suppliersAccountId = uuid_to_bin(?), updatedAt = ?,' +
                  'updatedBy = uuid_to_bin(?) where id = uuid_to_bin(?)', [supplierStatus, user.accountId, currentDate, user.id, id]);

                if (!Utils.isAffectedPool(supplierUpdate)) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLIER_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }

                supplier.status = supplierStatus;
                supplier.suppliersAccountId = user.accountId;
                supplier.updatedAt = currentDate;
            }


            if (action === Constants.INVITATION_STATUS_NOTIFICATION_ACTION.IGNORE) {
                AuditUtils.create(auditOptions);
                return cb(null, supplier);
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
                        refereType: Constants.NOTIFICATION_REFERE_TYPE.SUPPLIER,
                        user_ids: [invitee.id],
                        topic_id: invitee.id,
                        notificationExpirationDate: notificationExpirationDate,
                        paramasDateTime: new Date(),
                        notification_reference: notification_reference,
                        metaEmail: user.email,
                        paramsInviter: user.email + ', ' + (user.firstName ? user.firstName : '') + ' ' + (user.lastName ? user.lastName : ''),
                        paramsInvitee: invitee.email + ', ' + (invitee.firstName ? invitee.firstName : '') + ' ' + (invitee.lastName ? invitee.lastName : ''),
                        languageCultureCode: invitee.languageCultureCode,
                        createdBy: user.id
                    };

                    if (user.firstName) {
                        notificationOption.metaName = user.firstName;
                    }

                    await NotificationApi.createMD(notificationOption);

                    AuditUtils.create(auditOptions);
                    return cb(null, supplier);

                } catch (err) {

                    errorOptions.err = err;
                    await ErrorUtils.create(errorOptions);
                    if (err.errno) {
                        err = new Error(ErrorConfig.MESSAGE.SUPPLIER_UPDATE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    }
                    return cb(err);
                }
            });
        } catch (err) {
            debug('error', err);
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    /*
    * Notify the supplier
    * */
    notifyReminderSupplier: function (options) {
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
                //send Email
                var inviteeUser = await CustomerApi.getUserByIdMD({
                    userId: inviteeUserId,
                    notifyType: Constants.NOTIFICATION_CATEGORY_TYPE.SHARING
                });
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
                        refereType: Constants.NOTIFICATION_REFERE_TYPE.SUPPLIER,
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
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_NOTIFY_FAILED);
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
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_ID_REQUIRED);
            } else if (DataUtils.isUndefined(updatedAt)) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_UPDATED_AT_REQUIRED);
            } else if (!DataUtils.isValidNumber(updatedAt)) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_UPDATED_AT_MUST_BE_NUMBER);
            } else if (updatedAt.toString().length !== 13) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_UPDATED_AT_INVALID);
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return reject(err);
            }
            return resolve(Constants.OK_MESSAGE);
        });
    },

    /*
    * send reminder
    * */
    reminder: async function (options, errorOptions, cb) {
        var id = options.id;
        var updatedAt = options.updatedAt;
        var user = options.user;
        var currentDate = DataUtils.getEpochMSTimestamp();
        var notifyOption, notifyResponse;
        var err;

        try {
            var checkResponse = await Supplier.validateRequest(options);
            debug('checkResponse', checkResponse);

            // Get customer
            var supplier = await Supplier.getSupplierById({id: id});
            debug('supplier', supplier);
            if (supplier.updatedAt !== updatedAt) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                throw err;
            }

            var inviteeUser = await CustomerApi.getUserByEmail({email: supplier.email});
            debug('inviteeUser ', inviteeUser);
            if (!inviteeUser) {
                err = new Error(ErrorConfig.MESSAGE.INVITEE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            if (supplier.status === Constants.SUPPLIER_INVITATION_STATUS.OPEN && currentDate < new Date(supplier.invitationExpirationDate).getTime()) {
                var authUsers = await CustomerApi.getAuthorizeUser({accountId: inviteeUser.accountId});
                debug('authUsers', authUsers);

                var notification = await CustomerApi.getNotification({refereId: id});

                notifyOption = {
                    notification: notification,
                    id: id,
                    inviterUser: user,
                    notificationReference: NotificationReferenceData.SUPPLIER_REMINDER,
                    emailTemplate: Constants.EMAIL_TEMPLATES.SUPPLIER_REMINDER
                };
                debug('notification', notification);
                if (!authUsers || authUsers.length <= 0) {
                    notifyOption.inviteeUserId = inviteeUser.userId;

                    notifyResponse = await Supplier.notifyReminderSupplier(notifyOption);
                } else {
                    await Promise.each(authUsers, async function (inviteeUser) {
                        notifyOption.inviteeUserId = inviteeUser.userId;
                        notifyResponse = await Supplier.notifyReminderSupplier(notifyOption);
                    });
                }
                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.SUPPLIER_SEND_REMINDER_SUCCESS
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
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_REMINDER_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    /*
    * Resend invitation
    * */
    reSendInvitation: async function (options, errorOptions, cb) {
        var id = options.id;
        var updatedAt = options.updatedAt;
        var user = options.user;
        var currentDate = DataUtils.getEpochMSTimestamp();
        var err;

        try {
            var checkResponse = await Supplier.validateRequest(options);
            debug('checkResponse', checkResponse);

            // Get supplier
            var supplier = await Supplier.getSupplierById({id: id});
            debug('supplier', supplier);
            if (supplier.updatedAt !== updatedAt) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                throw err;
            }

            var inviteeUser = await CustomerApi.getUserByEmail({email: supplier.email});
            debug('inviteeUser ', inviteeUser);
            if (!inviteeUser) {
                err = new Error(ErrorConfig.MESSAGE.INVITEE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            if (supplier.status === Constants.SUPPLIER_INVITATION_STATUS.OPEN &&
              currentDate < new Date(supplier.invitationExpirationDate).getTime()) {
                err = new Error(ErrorConfig.MESSAGE.INVITATION_IS_ALREADY_SENT_TO_SUPPLIER);
            } else if (supplier.status === Constants.SUPPLIER_INVITATION_STATUS.ACCEPTED) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_ALREADY_ACCEPTED_INVITATION);
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            // Invite supplier
            var reInviteOption = {
                user: user,
                id: id,
                email: supplier.email,
                flag: 1,
                updatedAt: updatedAt
            };
            await Supplier.inviteMD(reInviteOption, errorOptions, function (err, response) {
                if (err) {
                    debug('err', err);
                    return cb(err);
                }
                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.SUPPLIER_RE_SEND_INVITATION_SUCCESS,
                    status: Constants.SUPPLIER_INVITATION_STATUS.OPEN,
                    invitationExpirationDate: response.invitationExpirationDate,
                    id: id,
                    updatedAt: response.updatedAt
                });
            });
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_RE_SEND_INVITATION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    /*
    * Update suppliers
    * */
    updateSupplier: function (options) {
        return new Promise(async function (resolve, reject) {
            var id = options.id;
            var status = options.status;
            var invitationExpirationDate = options.invitationExpirationDate;
            var user = options.user;
            var newUpdatedAt = DataUtils.getEpochMSTimestamp();
            var err;

            try {
                var conn = await connection.getConnection();
                var isUpdated = await conn.query('update Supplier set status = ? , invitationExpirationDate = ? , updatedAt = ?,' +
                  'updatedBy = uuid_to_bin(?) where id = uuid_to_bin(?)', [status, invitationExpirationDate, newUpdatedAt, user.id, id]);
                isUpdated = Utils.isAffectedPool(isUpdated);
                debug('isUpdated', isUpdated);
                return resolve({
                    OK: Constants.SUCCESS,
                    updatedAt: newUpdatedAt
                });
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_UPDATE_FAILED);
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

    /*
   * Notify the supplier
   * */
    notifyCancelInviteSupplier: function (options) {
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
                var inviteeUser = await CustomerApi.getUserByIdMD({
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
                if (notifyFlag.email === 1) {
                    var date = new Date();
                    var invitationExpirationDate = date.setDate(date.getDate() + Constants.INVITATION_EXPIRATION_DATE_LIMIT);
                    invitationExpirationDate = new Date(invitationExpirationDate);

                    //send notification
                    var notificationOption = {
                        refereId: id, //id of customer record
                        refereType: Constants.NOTIFICATION_REFERE_TYPE.SUPPLIER,
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
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_NOTIFY_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
    * Cancel invitation
    * */
    cancel: async function (options, errorOptions, cb) {
        var id = options.id;
        var updatedAt = options.updatedAt;
        var user = options.user;
        var currentDate = DataUtils.getEpochMSTimestamp();
        var notifyResponse, notifyOption;
        var err;

        try {
            var conn = await connection.getConnection();
            await conn.query('START TRANSACTION;');
        } catch (err) {
            debug('err', err);
            return cb(err);
        }


        try {
            var checkResponse = await Supplier.validateRequest(options);

            // Get supplier
            var supplier = await Supplier.getSupplierById({id: id});
            if (supplier.updatedAt !== updatedAt) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                throw err;
            }

            var inviteeUser = await CustomerApi.getUserByEmail({email: supplier.email});
            if (!inviteeUser) {
                err = new Error(ErrorConfig.MESSAGE.INVITEE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            if (new Date(supplier.invitationExpirationDate).getTime() !== new Date(Constants.DEFAULT_TIMESTAMP).getTime() &&
              currentDate > new Date(supplier.invitationExpirationDate).getTime()) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_INVITATION_ALRAEDY_EXPIRED);
            } else if (supplier.status !== Constants.SUPPLIER_INVITATION_STATUS.OPEN) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_INVITATION_STATUS_NOT_OPEN);
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            // Update notifications by expiring it
            var updateNotificationsOptions = {
                refereId: id,
                invitationExpirationDate: supplier.invitationExpirationDate,
                user: user
            };
            var updateNotificationResponse = await Supplier.updateNotifications(updateNotificationsOptions);

            // SEND NOTIFICATION TO THE ALL AUTH USER OF SUPPLIER
            var authUsers = await CustomerApi.getAuthorizeUser({accountId: inviteeUser.accountId});
            notifyOption = {
                id: id,
                inviterUser: user,
                notificationReference: NotificationReferenceData.SUPPLIER_INVITE_CANCEL,
                emailTemplate: Constants.EMAIL_TEMPLATES.SUPPLIER_INVITE_CANCEL
            };

            if (!authUsers || authUsers.length <= 0) {
                notifyOption.inviteeUserId = inviteeUser.userId;
                notifyResponse = await Supplier.notifyCancelInviteSupplier(notifyOption);
            } else {
                await Promise.each(authUsers, async function (inviteeUser) {
                    notifyOption.inviteeUserId = inviteeUser.userId;
                    notifyResponse = await Supplier.notifyCancelInviteSupplier(notifyOption);
                });
            }

            // Update notifications by expiring it
            var updateSupplierOptions = {
                id: id,
                invitationExpirationDate: new Date(Constants.DEFAULT_TIMESTAMP),
                status: Constants.SUPPLIER_INVITATION_STATUS.NO_INVITATION,
                user: user
            };
            var updateSupplierResponse = await Supplier.updateSupplier(updateSupplierOptions);

            await conn.query('COMMIT;');
            return cb(null, {
                OK: Constants.SUCCESS_MESSAGE.SUPPLIER_CANCEL_INVITATION_SUCCESS,
                status: Constants.SUPPLIER_INVITATION_STATUS.NO_INVITATION,
                updatedAt: updateSupplierResponse.updatedAt
            });
        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK;');
            await ErrorUtils.create(errorOptions, options, err);
            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_CANCEL_INVITATION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    addInvite: async function (options, errorOptions, cb) {
        try {
            await Supplier.createMD(options, errorOptions, async function (err, supplier) {
                if (err) {
                    debug('err', err);
                    throw err;
                }
                debug('create', supplier);

                var inviteOptions = {
                    email: options.email,
                    id: supplier.id,
                    personalMessage: options.personalMessage,
                    updatedAt: supplier.updatedAt,
                    user: options.user,
                    addInviteFlag: options.addInviteFlag
                };
                debug('invite options', inviteOptions);
                await Supplier.inviteMD(inviteOptions, errorOptions, function (err, supplier) {
                    if (err) {
                        debug('err', err);
                        throw err;
                    }
                    debug('invite', supplier);
                    return cb(null, {
                        OK: Constants.SUCCESS_MESSAGE.SUPPLIER_ADD_INVITE_SUCCESS,
                        status: supplier.status,
                        invitationExpirationDate: supplier.invitationExpirationDate,
                        id: supplier.id,
                        updatedAt: supplier.updatedAt
                    });
                });
            });
        } catch (err) {
            debug('error', err);
            return cb(err);
        }
    },

    searchSuppliers: async function (options, errorOptions, cb) {
        var accountId = options.accountId;
        var isActive = options.isActive;
        var supplierName = options.supplierName;
        var supplierCode = options.supplierCode;
        var firstName = options.firstName;
        var lastName = options.lastName;
        var email = options.email;
        var checkString = '', whereString = '';
        var checkValues = [];
        var err;

        if (DataUtils.isUndefined(isActive)) {
            err = new Error(ErrorConfig.MESSAGE.IS_ACTIVE_FIELD_REQUIRED);
        } else if (DataUtils.isUndefined(supplierName) && DataUtils.isUndefined(supplierCode) && DataUtils.isUndefined(firstName)
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
            if (DataUtils.isDefined(supplierName)) {
                checkString += ' supplierName like ? and ';
                whereString += ' S.supplierName like ? and ';
                checkValues.push('%' + supplierName + '%');
            }
            if (DataUtils.isDefined(supplierCode)) {
                checkString += ' supplierCode like ?  and ';
                whereString += ' S.supplierCode like ? and ';
                checkValues.push('%' + supplierCode + '%');
            }
            if (DataUtils.isDefined(firstName)) {
                checkString += ' firstName like ? and ';
                whereString += ' S.firstName like ? and ';
                checkValues.push('%' + firstName + '%');
            }
            if (DataUtils.isDefined(lastName)) {
                checkString += ' lastName like ?  and ';
                whereString += ' S.lastName like ? and ';
                checkValues.push('%' + lastName + '%');
            }
            if (DataUtils.isDefined(email)) {
                checkString += ' email like ?  and ';
                whereString += ' S.email like ? and ';
                checkValues.push('%' + email + '%');
            }
            checkString = checkString.replace(/and\s*$/, '');
            whereString = whereString.replace(/and\s*$/, '');

            var conn = await connection.getConnection();

            var emptyLocationSuppliers = await conn.query('IF (select count(id) from Supplier where accountId = uuid_to_bin(?) and ' +
              ' isActive = ? and ' + checkString + ') > ? THEN ' +
              ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "ROW_COUNT_EXCEED_PLEASE_USE_SEARCH_AND_FILTER", MYSQL_ERRNO = 4001; ' +
              ' ELSE select CAST(uuid_from_bin(id) as char) as id,CAST(uuid_from_bin(accountId) as char) as accountId, ' +
              ' CAST(uuid_from_bin(suppliersAccountId) as char) as suppliersAccountId,' +
              ' locationId, supplierId,supplierName,companyName,firstName,lastName,email,phone,fax,supplierCode,' +
              ' addressLine1,addressLine2,addressLine3,city,zipCode,state,country,googleLink ,' +
              ' status,invitationExpirationDate,isActive,primaryMobile,primaryMobileDialCode,primaryMobileCountry,secondaryMobile,' +
              ' secondaryMobileDialCode,secondaryMobileCountry,updatedAt,createdAt from Supplier ' +
              ' where accountId = uuid_to_bin(?) and locationId = "" and isActive = ? and ' + checkString + ';END IF;',
              [accountId, isActive].concat(checkValues, [Constants.ROW_LIMIT, accountId, isActive], checkValues));
            emptyLocationSuppliers = Utils.filteredResponsePool(emptyLocationSuppliers);


            var supplierWithLocation = await conn.query('select CAST(uuid_from_bin(S.id) as char) as id,CAST(uuid_from_bin(S.accountId) as char) as accountId,' +
              'CAST(uuid_from_bin(S.suppliersAccountId) as char) as suppliersAccountId,S.supplierId,S.locationId, ' +
              'S.supplierName,S.companyName,S.firstName,S.lastName,S.email,S.phone,S.supplierCode, ' +
              'S.status,S.invitationExpirationDate,S.primaryMobile,S.secondaryMobile,' +
              'LR.googleLink, LR.locationName,LR.addressLine1,LR.addressLine2,LR.addressLine3,LR.city,LR.zipCode,LR.state,LR.country,LR.fax ,' +
              'S.isActive,S.updatedAt,S.createdAt from Supplier S, LocationReference LR ' +
              'where LR.locationId = S.locationId and  LR.accountId = uuid_to_bin(?) and ' +
              'S.accountId = uuid_to_bin(?) and S.locationId != "" and S.isActive = ? and ' + whereString + '; ',
              [accountId, accountId, isActive].concat(checkValues));

            var suppliers = [];
            suppliers = suppliers.concat(emptyLocationSuppliers).concat(supplierWithLocation);

            suppliers = _.sortBy(suppliers, 'createdAt').reverse();

            if (suppliers.length > 0) {
                _.map(suppliers, function (supplier) {
                    if (supplier.createdAt) {
                        delete supplier.createdAt;
                    }
                });
            }
            /*await Promise.each(suppliers, async function (supplier) {
                var status = Object.keys(Constants.INVITATION_STATUS)[Object.values(Constants.INVITATION_STATUS).indexOf(supplier.status)];
                supplier.status = Constants.PARTNER_INVITATION_ACTION[status];
            });*/
            return cb(null, suppliers);

        } catch (err) {
            debug('err', err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.ROW_COUNT_EXCEED_PLEASE_USE_SEARCH_AND_FILTER);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else {
                err = new Error(ErrorConfig.MESSAGE.SUPPLIER_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    }

};

module.exports = Supplier;