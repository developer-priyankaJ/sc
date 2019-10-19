/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.api.location_reference');
var Util = require('util');
var _ = require('lodash');
var Promise = require('bluebird');

var connection = require('../lib/connection_util');
//var knexfile = require('../knexfile');
//var knex = require('knex')(knexfile);
var Utils = require('../lib/utils');
var ErrorConfig = require('../data/error');
var DataUtils = require('../lib/data_utils');
var AuditUtils = require('../lib/audit_utils');
var ErrorUtils = require('../lib/error_utils');
var Constants = require('../data/constants');
var LocationReferenceModel = require('../model/location_reference');
var Decimal = require('decimal.js');


var LocationReference = {

    validateLatitudeMD: function (latitude, cb) {
        var err;
        var tempLatitude = Decimal(latitude);
        var precision;

        if (tempLatitude.greaterThan(Decimal(Constants.LATITUDE.MAX)) || tempLatitude.lessThan(Decimal(Constants.LATITUDE.MIN))) {
            err = new Error(ErrorConfig.MESSAGE.INVALID_LATITUDE);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
        if (tempLatitude.toString().indexOf('.') !== -1) {
            precision = tempLatitude.toString().split('.')[1];
            if (precision.length > Constants.MAX_PRECISION) {
                tempLatitude = tempLatitude.toDecimalPlaces(Constants.MAX_PRECISION);
                tempLatitude = tempLatitude.toString().replace('.', '');
            } else if (precision.length < Constants.MAX_PRECISION) {
                var zeros = Constants.MAX_PRECISION - precision.length;
                tempLatitude = tempLatitude.toString().replace('.', '');
                tempLatitude = Decimal(tempLatitude).mul(Decimal(Constants.PRECISION[zeros]));
            } else if (precision.length === Constants.MAX_PRECISION) {
                tempLatitude = tempLatitude.toString().replace('.', '');
            }
            latitude = tempLatitude;
        } else if (tempLatitude.toString().indexOf('.') === -1) {
            tempLatitude = Decimal(tempLatitude).mul(Decimal(Constants.PRECISION[Constants.MAX_PRECISION]));
            latitude = tempLatitude;
        }
        return cb(null, latitude.toString());
    },

    validateLongitudeMD: function (longitude, cb) {
        var err;
        var tempLongitude = Decimal(longitude);
        var precision;
        if (tempLongitude.greaterThan(Decimal(Constants.LONGITUDE.MAX)) || tempLongitude.lessThan(Decimal(Constants.LONGITUDE.MIN))) {
            err = new Error(ErrorConfig.MESSAGE.INVALID_LONGITUDE);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
        if (tempLongitude.toString().indexOf('.') !== -1) {
            precision = tempLongitude.toString().split('.')[1];
            if (precision.length > Constants.MAX_PRECISION) {
                tempLongitude = tempLongitude.toDecimalPlaces(Constants.MAX_PRECISION);
                tempLongitude = tempLongitude.toString().replace('.', '');
            } else if (precision.length < Constants.MAX_PRECISION) {
                var zeros = Constants.MAX_PRECISION - precision.length;
                tempLongitude = tempLongitude.toString().replace('.', '');
                tempLongitude = Decimal(tempLongitude).mul(Decimal(Constants.PRECISION[zeros]));
            } else if (precision.length === Constants.MAX_PRECISION) {
                tempLongitude = tempLongitude.toString().replace('.', '');
            }
            longitude = tempLongitude;
        } else if (tempLongitude.toString().indexOf('.') === -1) {
            tempLongitude = Decimal(tempLongitude).mul(Decimal(Constants.PRECISION[Constants.MAX_PRECISION]));
            longitude = tempLongitude;
        }
        return cb(null, longitude.toString());
    },

    validateOptionalFields: function (options, cb) {
        var err;
        var locationFields = '';
        var locationOptionalValues = [];

        try {
            if (!DataUtils.isValidateOptionalField(options.locationCode)) {
                if (!DataUtils.isString(options.locationCode)) {
                    throw err = new Error(ErrorConfig.MESSAGE.LOCATION_CODE_MUST_BE_STRING);
                } else if (options.locationCode.length > 10) {
                    throw err = new Error(ErrorConfig.MESSAGE.LOCATION_CODE_MUST_BE_LESS_THEN_10_CHARACTER);
                } else {
                    locationFields += 'locationCode=? ,';
                    locationOptionalValues.push(options.locationCode);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.locationName)) {
                if (!DataUtils.isString(options.locationName)) {
                    throw err = new Error(ErrorConfig.MESSAGE.LOCATION_NAME_MUST_BE_STRING);
                } else if (options.locationName.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.LOCATION_NAME_MUST_BE_LESS_THEN_60_CHARACTER);
                } else {
                    locationFields += 'locationName=? ,';
                    locationOptionalValues.push(options.locationName);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.additionalLocationCode)) {
                if (!DataUtils.isString(options.additionalLocationCode)) {
                    throw err = new Error(ErrorConfig.MESSAGE.ADDITIONAL_LOCATION_CODE_MUST_BE_STRING);
                } else if (options.additionalLocationCode.length > 20) {
                    throw err = new Error(ErrorConfig.MESSAGE.ADDITIONAL_LOCATION_CODE_MUST_BE_LESS_THEN_20_CHARACTER);
                } else {
                    locationFields += 'additionalLocationCode=? ,';
                    locationOptionalValues.push(options.additionalLocationCode);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.additionalLocationName)) {
                if (!DataUtils.isString(options.additionalLocationName)) {
                    throw err = new Error(ErrorConfig.MESSAGE.ADDITIONAL_LOCATION_NAME_MUST_BE_STRING);
                } else if (options.additionalLocationName.length > 40) {
                    throw err = new Error(ErrorConfig.MESSAGE.ADDITIONAL_LOCATION_NAME_MUST_BE_LESS_THEN_40_CHARACTER);
                } else {
                    locationFields += 'additionalLocationName=? ,';
                    locationOptionalValues.push(options.additionalLocationName);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.googleLocationId)) {
                if (!DataUtils.isString(options.googleLocationId)) {
                    throw err = new Error(ErrorConfig.MESSAGE.GOOGLE_LOCATION_ID_MUST_BE_STRING);
                } else if (options.googleLocationId.length > 255) {
                    throw err = new Error(ErrorConfig.MESSAGE.GOOGLE_LOCATION_ID_MUST_BE_LESS_THEN_255_CHARACTER);
                } else {
                    locationFields += 'googleLocationId=? ,';
                    locationOptionalValues.push(options.googleLocationId);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.googleLocationName)) {
                if (!DataUtils.isString(options.googleLocationName)) {
                    throw err = new Error(ErrorConfig.MESSAGE.GOOGLE_LOCATION_NAME_MUST_BE_STRING);
                } else if (options.googleLocationName.length > 60) {
                    throw err = new Error(ErrorConfig.MESSAGE.GOOGLE_LOCATION_NAME_MUST_BE_LESS_THEN_60_CHARACTER);
                } else {
                    locationFields += 'googleLocationName=? ,';
                    locationOptionalValues.push(options.googleLocationName);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.googleFormattedAddress)) {
                if (!DataUtils.isString(options.googleFormattedAddress)) {
                    throw err = new Error(ErrorConfig.MESSAGE.GOOGLE_FORMATTED_ADDRESS_MUST_BE_STRING);
                } else {
                    locationFields += 'googleFormattedAddress=? ,';
                    locationOptionalValues.push(options.googleFormattedAddress);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.email)) {
                if (!DataUtils.isValidEmail(options.email) && options.email !== '') {
                    throw err = new Error(ErrorConfig.MESSAGE.EMAIL_INVALID);
                } else if (options.email.length > 254) {
                    throw err = new Error(ErrorConfig.MESSAGE.EMAIL_MUST_BE_LESS_THAN_254_CHARACTER);
                } else {
                    locationFields += 'email=? ,';
                    locationOptionalValues.push(options.email);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.dialCode)) {
                if (!DataUtils.isString(options.dialCode)) {
                    throw err = new Error(ErrorConfig.MESSAGE.DIAL_CODE_MUST_BE_STRING);
                } else if (options.dialCode.toString().length > 5) {
                    throw err = new Error(ErrorConfig.MESSAGE.DIAL_CODE_MUST_BE_LESS_THAN_5_CHARACTER);
                } else {
                    locationFields += 'dialCode=? ,';
                    locationOptionalValues.push(options.dialCode);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.phoneCountry)) {
                if (!DataUtils.isString(options.phoneCountry)) {
                    throw err = new Error(ErrorConfig.MESSAGE.COUNTRY_MUST_BE_STRING);
                } else if (options.phoneCountry.toString().length > 2) {
                    throw err = new Error(ErrorConfig.MESSAGE.COUNTRY_MUST_BE_LESS_THAN_2_CHARACTER);
                } else {
                    locationFields += 'phoneCountry=? ,';
                    locationOptionalValues.push(options.phoneCountry);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.phone)) {
                if (!DataUtils.isMobile(options.phone)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PHONE_1_MUST_BE_VALID_NUMBER);
                } else if (options.phone.toString().length > 15) {
                    throw err = new Error(ErrorConfig.MESSAGE.PHONE_1_MUST_BE_LESS_THAN_15_CHARACTER);
                } else {
                    locationFields += 'phone=? ,';
                    locationOptionalValues.push(options.dialCode.concat(options.phone));
                }
            }

            if (!DataUtils.isValidateOptionalField(options.primaryMobileDialCode)) {
                if (!DataUtils.isString(options.primaryMobileDialCode)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_DIAL_CODE_MUST_BE_STRING);
                } else if (options.primaryMobileDialCode.toString().length > 5) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_DIAL_CODE_MUST_BE_LESS_THAN_5_CHARACTER);
                } else {
                    locationFields += 'primaryMobileDialCode=? ,';
                    locationOptionalValues.push(options.primaryMobileDialCode);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.primaryMobileCountry)) {
                if (!DataUtils.isString(options.primaryMobileCountry)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_COUNTRY_MUST_BE_STRING);
                } else if (options.primaryMobileCountry.toString().length > 2) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_COUNTRY_MUST_BE_LESS_THAN_2_CHARACTER);
                } else {
                    locationFields += 'primaryMobileCountry=? ,';
                    locationOptionalValues.push(options.primaryMobileCountry);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.primaryMobile)) {
                if (!DataUtils.isMobile(options.primaryMobile)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_MUST_BE_VALID_NUMBER);
                } else if (options.primaryMobile.toString().length > 15) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_MUST_BE_LESS_THAN_OF_15_DIGIT);
                } else {
                    locationFields += 'primaryMobile=? ,';
                    locationOptionalValues.push(options.primaryMobileDialCode.concat(options.primaryMobile));
                }
            }

            if (!DataUtils.isValidateOptionalField(options.secondaryMobileDialCode)) {
                if (!DataUtils.isString(options.secondaryMobileDialCode)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_DIAL_CODE_MUST_BE_STRING);
                } else if (options.secondaryMobileDialCode.toString().length > 5) {
                    throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_DIAL_CODE_MUST_BE_LESS_THAN_5_CHARACTER);
                } else {
                    locationFields += 'secondaryMobileDialCode=? ,';
                    locationOptionalValues.push(options.secondaryMobileDialCode);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.secondaryMobileCountry)) {
                if (!DataUtils.isString(options.secondaryMobileCountry)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_COUNTRY_MUST_BE_STRING);
                } else if (options.secondaryMobileCountry.toString().length > 2) {
                    throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_COUNTRY_MUST_BE_LESS_THAN_2_CHARACTER);
                } else {
                    locationFields += 'secondaryMobileCountry=? ,';
                    locationOptionalValues.push(options.secondaryMobileCountry);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.secondaryMobile)) {
                if (!DataUtils.isMobile(options.secondaryMobile)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_MUST_BE_VALID_NUMBER);
                } else if (options.secondaryMobile.toString().length > 15) {
                    throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_MUST_BE_LESS_THAN_OF_15_DIGIT);
                } else {
                    locationFields += 'secondaryMobile=? ,';
                    locationOptionalValues.push(options.secondaryMobileDialCode.concat(options.secondaryMobile));
                }
            }

            if (!DataUtils.isValidateOptionalField(options.extension)) {
                if (!DataUtils.isMobile(options.extension)) {
                    throw err = new Error(ErrorConfig.MESSAGE.EXTENSION_MUST_BE_VALID_NUMBER);
                } else if (options.extension.toString().length > 10) {
                    throw err = new Error(ErrorConfig.MESSAGE.EXTENSION_MUST_BE_LESS_THAN_10_CHARACTER);
                } else {
                    locationFields += 'extension=? ,';
                    locationOptionalValues.push(options.extension);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.fax)) {
                if (!DataUtils.isMobile(options.fax)) {
                    throw err = new Error(ErrorConfig.MESSAGE.FAX_1_MUST_BE_VALID_NUMBER);
                } else if (options.fax.toString().length > 15) {
                    throw err = new Error(ErrorConfig.MESSAGE.FAX_1_MUST_BE_LESS_THAN_15_CHARACTER);
                } else {
                    locationFields += 'fax=? ,';
                    locationOptionalValues.push(options.fax);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.addressLine1)) {
                if (!DataUtils.isString(options.addressLine1)) {
                    throw err = new Error(ErrorConfig.MESSAGE.ADDRESS_LINE_1_MUST_BE_STRING);
                } else if (options.addressLine1.length > 60) {
                    throw err = new Error(ErrorConfig.MESSAGE.ADDRESS_LINE_1_MUST_BE_LESS_THAN_60_CHARACTER);
                } else {
                    locationFields += 'addressLine1=? ,';
                    locationOptionalValues.push(options.addressLine1);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.addressLine2)) {
                if (!DataUtils.isString(options.addressLine2)) {
                    throw err = new Error(ErrorConfig.MESSAGE.ADDRESS_LINE_2_MUST_BE_STRING);
                } else if (options.addressLine2.length > 60) {
                    throw err = new Error(ErrorConfig.MESSAGE.ADDRESS_LINE_2_MUST_BE_LESS_THAN_60_CHARACTER);
                } else {
                    locationFields += 'addressLine2=? ,';
                    locationOptionalValues.push(options.addressLine2);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.addressLine3)) {
                if (!DataUtils.isString(options.addressLine3)) {
                    throw err = new Error(ErrorConfig.MESSAGE.ADDRESS_LINE_3_MUST_BE_STRING);
                } else if (options.addressLine3.length > 60) {
                    throw err = new Error(ErrorConfig.MESSAGE.ADDRESS_LINE_3_MUST_BE_LESS_THAN_60_CHARACTER);
                } else {
                    locationFields += 'addressLine3=? ,';
                    locationOptionalValues.push(options.addressLine3);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.city)) {
                if (!DataUtils.isString(options.city)) {
                    throw err = new Error(ErrorConfig.MESSAGE.CITY_MUST_BE_STRING);
                } else if (options.city.length > 60) {
                    throw err = new Error(ErrorConfig.MESSAGE.CITY_MUST_BE_LESS_THAN_60_CHARACTER);
                } else {
                    locationFields += 'city=? ,';
                    locationOptionalValues.push(options.city);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.zipCode)) {
                if (!DataUtils.isMobile(options.zipCode)) {
                    throw err = new Error(ErrorConfig.MESSAGE.ZIP_CODE_MUST_BE_VALID_NUMBER);
                } else if (options.zipCode.toString().length > 10) {
                    throw err = new Error(ErrorConfig.MESSAGE.ZIP_CODE_MUST_BE_LESS_THAN_10_DIGIT);
                } else {
                    locationFields += 'zipCode=? ,';
                    locationOptionalValues.push(options.zipCode);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.state)) {
                if (!DataUtils.isString(options.state)) {
                    throw err = new Error(ErrorConfig.MESSAGE.STATE_MUST_BE_STRING);
                } else if (options.state.length > 60) {
                    throw err = new Error(ErrorConfig.MESSAGE.STATE_MUST_BE_LESS_THAN_60_CHARACTER);
                } else {
                    locationFields += 'state=? ,';
                    locationOptionalValues.push(options.state);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.country)) {
                if (!DataUtils.isString(options.country)) {
                    throw err = new Error(ErrorConfig.MESSAGE.COUNTRY_MUST_BE_STRING);
                } else if (options.country.length > 2) {
                    throw err = new Error(ErrorConfig.MESSAGE.COUNTRY_MUST_BE_LESS_THAN_2_CHARACTER);
                } else {
                    locationFields += 'country=? ,';
                    locationOptionalValues.push(options.country);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.latitude)) {
                if (!DataUtils.isMobile(options.latitude)) {
                    throw err = new Error(ErrorConfig.MESSAGE.LATITUDE_MUST_BE_NUMBER);
                } else {
                    LocationReference.validateLatitudeMD(options.latitude, function (err, latitude) {
                        if (err) {
                            debug('err', err);
                            throw err;
                        }
                        debug('latitude', latitude);
                        options.latitude = latitude;
                        locationFields += 'latitude=? ,';
                        locationOptionalValues.push(options.latitude);
                    });
                }
            }
            if (!DataUtils.isValidateOptionalField(options.longitude)) {
                if (!DataUtils.isMobile(options.longitude)) {
                    throw err = new Error(ErrorConfig.MESSAGE.LONGITUDE_MUST_BE_NUMBER);
                } else {
                    LocationReference.validateLongitudeMD(options.longitude, function (err, longitude) {
                        if (err) {
                            debug('err', err);
                            throw err;
                        }
                        options.longitude = longitude;
                        locationFields += 'longitude=? ,';
                        locationOptionalValues.push(options.longitude);
                    });
                }
            }
            if (!DataUtils.isValidateOptionalField(options.googleLink)) {
                if (!DataUtils.isString(options.googleLink)) {
                    throw err = new Error(ErrorConfig.MESSAGE.GOOGLE_LINK_MUST_BE_STRING);
                } else {
                    locationFields += 'googleLink=? ,';
                    locationOptionalValues.push(options.googleLink);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.comment)) {
                if (!DataUtils.isString(options.comment)) {
                    throw err = new Error(ErrorConfig.MESSAGE.COMMENT_MUST_BE_STRING);
                } else {
                    locationFields += 'comment=? ,';
                    locationOptionalValues.push(options.comment);
                }
            }
            var response = {
                locationFields: locationFields,
                locationOptionalValues: locationOptionalValues
            };

            return cb(null, response);
        } catch (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
    },

    getUpdatedAtMD: async function (options, cb) {
        var updatedAt, err;
        var accountId = options.accountId;
        var locationId = options.locationId;
        try {
            var conn = await connection.getConnection();
            updatedAt = await conn.query('select updatedAt from LocationReference where accountId=uuid_to_bin(?) and locationId=? and status = 1;', [accountId, locationId]);
            updatedAt = Utils.filteredResponsePool(updatedAt);
            if (!updatedAt) {
                err = new Error(ErrorConfig.MESSAGE.LOCATION_REFERENCE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            return cb(null, updatedAt);
        } catch (err) {
            err = new Error(ErrorConfig.MESSAGE.GET_LOCATION_REFERENCE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    createMD: async function (options, auditOptions, errorOptions, cb) {
        var err;
        var user = options.user;
        var accountId = user.accountId;
        var userId = user.id;
        var locationId = options.locationId;
        var locationName = options.locationName;
        var phone = options.phone;
        var dialCode = options.dialCode;
        var phoneCountry = options.phoneCountry;
        var primaryMobile = options.primaryMobile;
        var primaryMobileDialCode = options.primaryMobileDialCode;
        var primaryMobileCountry = options.primaryMobileCountry;
        var secondaryMobile = options.secondaryMobile;
        var secondaryMobileDialCode = options.secondaryMobileDialCode;
        var secondaryMobileCountry = options.secondaryMobileCountry;
        var locationFields = '';
        var locationOptionalValues = [];
        var locationRequiredValues = [];
        var createdAt = DataUtils.getEpochMSTimestamp();
        var updatedAt = DataUtils.getEpochMSTimestamp();

        if (DataUtils.isUndefined(locationId)) {
            err = new Error(ErrorConfig.MESSAGE.LOCATION_ID_REQUIRED);
        } else if (!DataUtils.isString(locationId)) {
            err = new Error(ErrorConfig.MESSAGE.LOCATION_ID_MUST_BE_STRING);
        } else if (locationId.length > 40) {
            err = new Error(ErrorConfig.MESSAGE.LOCATION_ID_MUST_BE_LESS_THAN_40_CHARACTER);
        } else if (DataUtils.isUndefined(locationName)) {
            err = new Error(ErrorConfig.MESSAGE.LOCATION_NAME_REQUIRED);
        } else if (!DataUtils.isString(locationName)) {
            err = new Error(ErrorConfig.MESSAGE.LOCATION_NAME_MUST_BE_STRING);
        } else if (locationName.length > 60) {
            err = new Error(ErrorConfig.MESSAGE.LOCATION_NAME_MUST_BE_LESS_THAN_60_CHARACTER);
        }
        if (err) {
            debug('err', err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        if (DataUtils.isDefined(phone) || DataUtils.isDefined(dialCode) || DataUtils.isDefined(phoneCountry)) {
            if (!DataUtils.isDefined(phone)) {
                err = new Error(ErrorConfig.MESSAGE.PHONE_REQUIRED);
            } else if (!DataUtils.isDefined(dialCode)) {
                err = new Error(ErrorConfig.MESSAGE.PHONE_DIALCODE_REQUIRED);
            } else if (!DataUtils.isDefined(phoneCountry)) {
                err = new Error(ErrorConfig.MESSAGE.PHONE_COUNTRY_REQUIRED);
            }
            if (err) {
                debug('err', err);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
        }
        if (DataUtils.isDefined(primaryMobile) || DataUtils.isDefined(primaryMobileCountry) || DataUtils.isDefined(primaryMobileDialCode)) {
            if (!DataUtils.isDefined(primaryMobile)) {
                err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_REQUIRED);
            } else if (!DataUtils.isDefined(primaryMobileDialCode)) {
                err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_DIAL_CODE_REQUIRED);
            } else if (!DataUtils.isDefined(primaryMobileCountry)) {
                err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_COUNTRY_REQUIRED);
            }
            if (err) {
                debug('err', err);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
        }
        if (DataUtils.isDefined(secondaryMobile) || DataUtils.isDefined(secondaryMobileCountry) || DataUtils.isDefined(secondaryMobileDialCode)) {
            if (!DataUtils.isDefined(secondaryMobile)) {
                err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_REQUIRED);
            } else if (!DataUtils.isDefined(secondaryMobileDialCode)) {
                err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_DIAL_CODE_REQUIRED);
            } else if (!DataUtils.isDefined(secondaryMobileCountry)) {
                err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_COUNTRY_REQUIRED);
            }
            if (err) {
                debug('err', err);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
        }


        locationRequiredValues.push(accountId, locationId, accountId, locationName, accountId, locationId);
        LocationReference.validateOptionalFields(options, async function (err, response) {
            if (err) {
                debug('err', err);
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }

            locationFields = response.locationFields;
            locationOptionalValues = response.locationOptionalValues;

            locationRequiredValues = _.concat(locationRequiredValues, locationOptionalValues);
            locationRequiredValues.push(userId, createdAt, updatedAt);

            try {
                var conn = await connection.getConnection();

                var locationReference = await conn.query('IF (select 1 from LocationReference where accountId=uuid_to_bin(?) and locationId=?) is not null then ' +
                  ' SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "LOCATION_EXIST_WITH_SAME_LOCATION_ID"; ' +
                  ' ELSEIF exists (select 1 from LocationReference where accountId=uuid_to_bin(?) and locationName=?) then ' +
                  ' SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4002,MESSAGE_TEXT = "LOCATION_EXIST_WITH_SAME_LOCATION_NAME";' +
                  ' ELSE insert into LocationReference set  accountId=uuid_to_bin(?), locationId=?, ' + locationFields + ' createdBy=uuid_to_bin(?),' +
                  ' createdAt=?, updatedAt=?;END IF;', locationRequiredValues);

                locationReference = Utils.isAffectedPool(locationReference);

                if (!locationReference) {
                    err = new Error(ErrorConfig.MESSAGE.DUPLICATE_LOCATION_CREATION);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
                delete options.user;
                auditOptions.metaData = {
                    locationReference: options
                };

                AuditUtils.create(auditOptions);
                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.LOCATION_REFERENCE_CREATE_SUCCESS,
                    locationId: locationId,
                    createdAt: createdAt
                });
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
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
        });
    },

    getLocationReferenceByAccountIdMD: async function (options, errorOptions, cb) {
        var accountId = options.accountId;
        var isActive = options.isActive;
        var err;

        try {

            if (DataUtils.isUndefined(isActive)) {
                err = new Error(ErrorConfig.MESSAGE.IS_ACTIVE_FIELD_REQUIRED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }

            var conn = await connection.getConnection();

            var locationReferences = await conn.query('select CAST(uuid_from_bin(accountId) as CHAR) as accountId ,locationId, locationCode, ' +
              ' locationName, additionalLocationCode, additionalLocationName, googleLocationId, googleLocationName,googleFormattedAddress,  email, ' +
              ' phone,dialCode,phoneCountry, primaryMobile,primaryMobileDialCode,primaryMobileCountry, secondaryMobile, secondaryMobileDialCode,secondaryMobileCountry,' +
              ' extension, fax,  addressLine1, addressLine2, addressLine3, city, zipCode, state, country,' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (latitude / CAST(power(10,16) as INTEGER))))) as latitude, ' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (longitude / CAST(power(10,16) as INTEGER))))) as longitude, ' +
              ' googleLink, comment,status, updatedAt, createdAt from LocationReference where accountId = uuid_to_bin(?) and status = ? ' +
              ' order by updatedAt desc limit 10',
              [accountId, isActive]);
            // locationReferences = Utils.filteredResponsePool(locationReferences);

            if (!locationReferences) {
                var array = [];
                return cb(null, array);
            }
            /*if (!DataUtils.isArray(locationReference)) {
                var array = [];
                array.push(locationReference);
                return cb(null, array);
            }*/
            return cb(null, locationReferences);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.GET_LOCATION_REFERENCE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    getLocationReferenceDetailByAccountIdMD: async function (options, errorOptions, cb) {
        var accountId = options.accountId;
        var err;

        try {
            var conn = await connection.getConnection();
            var locationReference = await conn.query('select locationId, locationName  from LocationReference ' +
              'where accountId = uuid_to_bin(?) and status = 1;', accountId);
            if (!locationReference) {
                var array = [];
                return cb(null, array);
            }
            return cb(null, locationReference);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.LOCATION_REFERENCE_NOT_FOUND);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    getByAccountIdLocationIdMD: async function (options, errorOptions, cb) {
        var accountId = options.accountId;
        var locationId = options.locationId;
        var err;
        if (DataUtils.isUndefined(locationId)) {
            err = new Error(ErrorConfig.MESSAGE.LOCATION_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
        try {
            var conn = await connection.getConnection();
            //TRIM(TRAILING "0" FROM (longitude / CAST(power(10,16) as INTEGER))) as longitude
            var locationReference = await conn.query('select CAST(uuid_from_bin(accountId) as CHAR) as accountId,locationId, locationCode, ' +
              ' locationName, additionalLocationCode, additionalLocationName, googleLocationId, googleLocationName,googleFormattedAddress, email, ' +
              ' phone, dialCode,phoneCountry, primaryMobile, primaryMobileDialCode, primaryMobileCountry, secondaryMobile, secondaryMobileDialCode,' +
              ' secondaryMobileCountry,extension, fax,  addressLine1, addressLine2, addressLine3, city, zipCode, state, country,' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (latitude / CAST(power(10,16) as INTEGER))))) as latitude, ' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (longitude / CAST(power(10,16) as INTEGER))))) as longitude, ' +
              ' googleLink, comment, updatedAt from LocationReference where accountId = uuid_to_bin(?) and locationId = ? and status = 1;', [accountId, locationId]);
            locationReference = Utils.filteredResponsePool(locationReference);
            if (!locationReference) {
                err = new Error(ErrorConfig.MESSAGE.LOCATION_REFERENCE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            return cb(null, locationReference);
        } catch (err) {
            debug('err', err);
            ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.LOCATION_REFERENCE_NOT_FOUND);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
    },

    updateMD: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var accountId = user.accountId;
        var locationId = options.locationId;
        var locationName = options.locationName;
        var updatedAt = options.updatedAt;
        var phone = options.phone;
        var dialCode = options.dialCode;
        var phoneCountry = options.phoneCountry;
        var primaryMobile = options.primaryMobile;
        var primaryMobileDialCode = options.primaryMobileDialCode;
        var primaryMobileCountry = options.primaryMobileCountry;
        var secondaryMobile = options.secondaryMobile;
        var secondaryMobileDialCode = options.secondaryMobileDialCode;
        var secondaryMobileCountry = options.secondaryMobileCountry;
        var userId = user.id;
        var locationFields = '';
        var locationOptionalValues = [];
        var locationRequiredValues = [];
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();
        var locationNameCheck = '', locationCheckValues = [];
        var err;

        if (DataUtils.isUndefined(locationId)) {
            err = new Error(ErrorConfig.MESSAGE.LOCATION_ID_REQUIRED);
        } else if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_MUST_BE_NUMBER);
        } else if (updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_IS_INVALID);
        }
        if (err) {
            debug('err', err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        if (DataUtils.isDefined(phone) || DataUtils.isDefined(dialCode) || DataUtils.isDefined(phoneCountry)) {
            if (!DataUtils.isDefined(phone)) {
                err = new Error(ErrorConfig.MESSAGE.PHONE_REQUIRED);
            } else if (!DataUtils.isDefined(dialCode)) {
                err = new Error(ErrorConfig.MESSAGE.PHONE_DIALCODE_REQUIRED);
            } else if (!DataUtils.isDefined(phoneCountry)) {
                err = new Error(ErrorConfig.MESSAGE.PHONE_COUNTRY_REQUIRED);
            }
            if (err) {
                debug('err', err);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
        }
        if (DataUtils.isDefined(primaryMobile) || DataUtils.isDefined(primaryMobileCountry) || DataUtils.isDefined(primaryMobileDialCode)) {
            if (!DataUtils.isDefined(primaryMobile)) {
                err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_REQUIRED);
            } else if (!DataUtils.isDefined(primaryMobileDialCode)) {
                err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_DIAL_CODE_REQUIRED);
            } else if (!DataUtils.isDefined(primaryMobileCountry)) {
                err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_COUNTRY_REQUIRED);
            }
            if (err) {
                debug('err', err);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
        }
        if (DataUtils.isDefined(secondaryMobile) || DataUtils.isDefined(secondaryMobileCountry) || DataUtils.isDefined(secondaryMobileDialCode)) {
            if (!DataUtils.isDefined(secondaryMobile)) {
                err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_REQUIRED);
            } else if (!DataUtils.isDefined(secondaryMobileDialCode)) {
                err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_DIAL_CODE_REQUIRED);
            } else if (!DataUtils.isDefined(secondaryMobileCountry)) {
                err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_COUNTRY_REQUIRED);
            }
            if (err) {
                debug('err', err);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
        }

        locationRequiredValues.push(accountId, locationId);
        LocationReference.validateOptionalFields(options, async function (err, response) {
            if (err) {
                debug('err', err);
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }

            locationFields = response.locationFields;
            locationOptionalValues = response.locationOptionalValues;

            if (locationOptionalValues.length <= 0) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_REQUEST);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }

            // This will check if location exist with same locationName or not
            if (DataUtils.isDefined(locationName)) {
                locationNameCheck = ' ELSEIF exists (select 1 from LocationReference where accountId=uuid_to_bin(?) and locationId!=? and locationName=?) then ' +
                  ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "LOCATION_EXIST_WITH_SAME_LOCATION_NAME", MYSQL_ERRNO = 4002; ';
                locationRequiredValues.push(accountId, locationId, locationName);
            }
            locationRequiredValues.push(accountId, locationId, updatedAt);
            locationRequiredValues = _.concat(locationRequiredValues, locationOptionalValues);
            locationRequiredValues.push(userId, newUpdatedAt, accountId, locationId);

            try {
                var conn = await connection.getConnection();
                var locationReference = await conn.query('IF (select 1 from LocationReference where accountId=uuid_to_bin(?) and locationId=? and status = 1 ) is null then ' +
                  ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "LOCATION_REFERENCE_NOT_FOUND", MYSQL_ERRNO = 4001;' +
                  ' ' + locationNameCheck + ' ' +
                  ' ELSEIF (select 1 from LocationReference where accountId=uuid_to_bin(?) and locationId=? and updatedAt=?) is null then ' +
                  ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "LOCATION_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4003;' +
                  ' ELSE update LocationReference set ' + locationFields + ' updatedBy=uuid_to_bin(?), updatedAt=? ' +
                  ' where accountId=uuid_to_bin(?) and locationId=?;end IF;', locationRequiredValues);
                locationReference = Utils.isAffectedPool(locationReference);
                if (!locationReference) {
                    err = new Error(ErrorConfig.MESSAGE.LOCATION_REFERENCE_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }
                delete options.user;
                auditOptions.metaData = {
                    newLocationReference: options
                };

                AuditUtils.create(auditOptions);
                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.LOCATION_REFERENCE_UPDATE_SUCCESS,
                    updatedAt: newUpdatedAt
                });
            } catch (err) {
                debug('err', err);
                ErrorUtils.create(errorOptions, options, err);
                if (err.errno === 4001) {
                    err = new Error(ErrorConfig.MESSAGE.LOCATION_REFERENCE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return cb(err);
                } else if (err.errno === 4002) {
                    err = new Error(ErrorConfig.MESSAGE.LOCATION_EXIST_WITH_SAME_LOCATION_NAME);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return cb(err);
                } else if (err.errno === 4003) {
                    err = new Error(ErrorConfig.MESSAGE.LOCATION_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    return cb(err);
                } else {
                    err = new Error(ErrorConfig.MESSAGE.LOCATION_REFERENCE_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return cb(err);
                }
            }
        });
    },

    removeMD: async function (options, auditOptions, errorOptions, cb) {
        var err;
        var accountId = options.accountId;
        var locationId = options.locationId;
        var updatedAt = options.updatedAt;
        var userId = options.userId;
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();

        var locationIds = [];
        if (DataUtils.isUndefined(locationId)) {
            err = new Error(ErrorConfig.MESSAGE.LOCATION_ID_REQUIRED);
        } else if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_MUST_BE_NUMBER);
        } else if (updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_IS_INVALID);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        locationIds.push(locationId);
        var option = {
            accountId: accountId,
            locationIds: locationIds
        };
        LocationReference.checkingLocationId(option, async function (err, response) {
            if (err) {
                debug('err', err);
                return cb(err);
            }
            if (response.length > 0) {
                err = new Error(ErrorConfig.MESSAGE.CAN_NOT_DELETE_LOCATION_REFERENCE);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }

            try {
                var conn = await connection.getConnection();

                var isDeleted = await conn.query('IF (select 1 from LocationReference where accountId=uuid_to_bin(?) and locationId=? and status = 1) is null then ' +
                  ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "LOCATION_REFERENCE_NOT_FOUND", MYSQL_ERRNO = 4001;' +
                  ' ELSEIF (select 1 from LocationReference where accountId=uuid_to_bin(?) and locationId=? and updatedAt=?) is null then ' +
                  ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "LOCATION_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
                  ' ELSE update LocationReference set status= 0,updatedAt = ?, updatedBy = uuid_to_bin(?) ' +
                  ' where accountId=uuid_to_bin(?) and locationId=?;end if;',
                  [accountId, locationId, accountId, locationId, updatedAt, newUpdatedAt, userId, accountId, locationId]);

                isDeleted = Utils.isAffectedPool(isDeleted);
                if (!isDeleted) {
                    err = new Error(ErrorConfig.MESSAGE.LOCATION_REFERENCE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return cb(err);
                }
                AuditUtils.create(auditOptions);
                return cb(null, {
                    OK: Constants.LOCATION_REFERENCE_DELETED_SUCCESSFULLY
                });
            } catch (err) {
                debug('err', err);
                ErrorUtils.create(errorOptions, options, err);
                if (err.errno === 4001) {
                    err = new Error(ErrorConfig.MESSAGE.LOCATION_REFERENCE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return cb(err);
                } else if (err.errno === 4002) {
                    err = new Error(ErrorConfig.MESSAGE.LOCATION_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    return cb(err);
                } else {
                    err = new Error(ErrorConfig.MESSAGE.LOCATION_REFERENCE_DELETE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return cb(err);
                }
            }
        });
    },

    manipulateQuery: function (options) {
        return new Promise(function (resolve, reject) {
            var string = '';
            var acccountId = options.accountId;
            var locationIds = options.locationIds;
            var ids = [1, 2, 3, 4, 5];
            var values = [];

            _.map(locationIds, function (location) {
                string += '?,';
            });
            string = string.replace(/,\s*$/, ' ');

            _.map(ids, function (id) {
                values.push(acccountId);
                _.map(locationIds, function (location) {
                    values.push(location);
                });
            });
            return resolve({
                string: string,
                values: values
            });
        });
    },

    manipulateIds: function (options) {
        return new Promise(function (resolve, reject) {
            var string = '';
            var acccountId = options.accountId;
            var locationIds = options.locationIds;
            var ids = [1, 2, 3, 4, 5];
            var values = [];

            _.map(locationIds, function (location) {
                string += '?,';
                values.push(location);
            });
            string = string.replace(/,\s*$/, ' ');

            /*_.map(ids, function (id) {
                values.push(acccountId);
                _.map(locationIds, function (location) {

                });
            });*/
            return resolve({
                string: string,
                values: values
            });
        });
    },

    checkingLocationId: async function (options, cb) {
        var locationIds = options.locationIds;
        var accountId = options.accountId;

        try {
            var conn = await connection.getConnection();

            var response = await LocationReference.manipulateQuery(options);

            var usedLocations = await conn.query('select U.locationId from users U where  (U.accountId=uuid_to_bin(?) and U.locationId in (' + response.string + '))' +
              '  union ' +
              ' select A.locationId from accounts A where  (A.id=uuid_to_bin(?) and A.locationId in (' + response.string + '))' +
              '  union ' +
              ' select C.locationId from Customers C where  (C.accountId=uuid_to_bin(?) and C.locationId in (' + response.string + '))' +
              '  union ' +
              ' select S.locationId from Supplier S where (S.accountId=uuid_to_bin(?) and S.locationId in (' + response.string + '))' +
              '  union ' +
              ' select P.locationId from ProductInventory P where  (P.accountId=uuid_to_bin(?) and P.locationId in (' + response.string + '))',
              response.values);

            if (DataUtils.isArray(usedLocations)) {
                usedLocations = _.map(usedLocations, 'locationId');
            } else if (!usedLocations) {
                usedLocations = [];
            } else {
                usedLocations = Object.values(usedLocations);
            }
            return cb(null, usedLocations);
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
    },

    checkUpdatedAt: function (options) {
        return new Promise(async function (resolve, reject) {
            var locations = options.locations;
            var accountId = options.accountId;
            var string = '', values = [];
            var conflict = [], success = [];
            var conflictIds = [];

            try {
                var conn = await connection.getConnection();

                var c = 1;
                await Promise.each(locations, function (location) {
                    string += ' SELECT locationId FROM LocationReference WHERE (updatedAt != ? AND accountId=uuid_to_bin(?) AND locationId = ?) UNION ALL ';
                    values.push(location.updatedAt, accountId, location.locationId);
                });
                string = string.replace(/UNION ALL \s*$/, ' ');

                var response = await conn.query(string, values);

                conflictIds = _.map(response, function (value) {
                    return value.locationId;
                });

                _.map(locations, function (location) {
                    if (conflictIds.indexOf(location.locationId) === -1) {
                        success.push(location.locationId);
                    } else {
                        conflict.push(location.locationId);
                    }
                });

                return resolve({success: success, conflict: conflict});
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    removeMultipleMD: async function (options, auditOptions, errorOptions, cb) {
        var err;
        var accountId = options.accountId;
        var userId = options.userId;
        var locationIds = options.locationIds;
        var currenctDate = DataUtils.getEpochMSTimestamp();
        var locationResponse = {};
        var successlocations = [], conflictlocations = [], warning = [], failed = [];

        try {

            if (DataUtils.isValidateOptionalField(locationIds)) {
                err = new Error(ErrorConfig.MESSAGE.LOCATION_IDS_REQUIRED);
            } else if (!DataUtils.isArray(locationIds)) {
                err = new Error(ErrorConfig.MESSAGE.LOCATION_IDS_MUST_BE_ARRAY);
            } else if (locationIds.length <= 0) {
                err = new Error(ErrorConfig.MESSAGE.AT_LEAST_ONE_LOCATION_ID_REQUIRED);
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }

            await Promise.each(locationIds, async function (location) {
                if (DataUtils.isUndefined(location.locationId)) {
                    err = new Error(ErrorConfig.MESSAGE.LOCATION_ID_REQUIRED);
                } else if (DataUtils.isValidateOptionalField(location.updatedAt)) {
                    err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_REQUIRED);
                } else if (!DataUtils.isValidNumber(location.updatedAt)) {
                    err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_MUST_BE_NUMBER);
                } else if (location.updatedAt.toString().length !== 13) {
                    err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_IS_INVALID);
                }
                if (err) {
                    throw err;
                }
            });
        } catch (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
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
            //Get location who is not exist
            var ids = _.map(locationIds, 'locationId');
            var response = await LocationReference.manipulateIds({
                accountId: accountId,
                locationIds: ids
            });
            var locationReferences = await conn.query('select locationId ' +
              'from LocationReference where accountId=uuid_to_bin(?) and status = 1 and locationId in (' + response.string + ');', [accountId].concat(response.values));
            locationReferences = _.map(locationReferences, 'locationId');

            failed = _.difference(ids, locationReferences);

            var filterLocations = [];
            _.map(locationIds, function (location) {
                if (failed.indexOf(location.locationId) === -1) {
                    filterLocations.push(location);
                }
            });

            // CHECK UPDATED AT
            var response = await LocationReference.checkUpdatedAt({locations: filterLocations, accountId: accountId});
            successlocations = response.success;
            conflictlocations = response.conflict;

            // Check if any location is used anywhere or not
            var checkLocationOptions = {
                locationIds: successlocations,
                accountId: accountId
            };

            LocationReference.checkingLocationId(checkLocationOptions, async function (err, checkResponse) {
                if (err) {
                    debug('err', err);
                    await conn.query('rollback;');
                    return cb(err);
                }
                var unUsedLocation = _.difference(successlocations, checkResponse);
                warning = checkResponse;

                /*if (unUsedLocation.length === 0) {
                    await conn.query('rollback;');
                    err = new Error(ErrorConfig.MESSAGE.CAN_NOT_DELETE_LOCATION_REFERENCE);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return cb(err);
                }*/


                // DELETE LOCATIONS
                if (unUsedLocation.length > 0) {
                    var response = await LocationReference.manipulateQuery({
                        accountId: accountId,
                        locationIds: unUsedLocation
                    });
                    var locationReference = await conn.query('update LocationReference set status = 0 , updatedAt = ?, updatedBy = uuid_to_bin(?) ' +
                      ' where accountId=uuid_to_bin(?) and locationId in (' + response.string + ');', [currenctDate, userId].concat(response.values));
                    locationReference = Utils.isAffectedPool(locationReference);
                }

                AuditUtils.create(auditOptions);

                if (unUsedLocation.length === locationIds.length) {
                    locationResponse.OK = ErrorConfig.MESSAGE.LOCATION_REFERENCE_DELETED_SUCCESSFULLY;
                    locationResponse.success = unUsedLocation;
                }
                /*else if (usedLocation.length === locationIds.length) {
                    debug('Inside else if')
                    locationResponse.conflict = usedLocation;
                    err = new Error(ErrorConfig.MESSAGE.LOCATION_REFERENCE_DELETE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    err.data = locationResponse;
                    return cb(err);
                    //return cb(null, locationResponse);
                }*/
                else {
                    if (unUsedLocation.length > 0) {
                        locationResponse.success = unUsedLocation;
                        locationResponse.successMsg = Constants.LOCATION_REFERENCE_DELETED_SUCCESSFULLY;
                    }
                    if (conflictlocations.length > 0) {
                        locationResponse.conflict = conflictlocations;
                        locationResponse.conflictMsg = ErrorConfig.MESSAGE.LOCATION_REFERENCE_HAS_SYNC_CONFLICT;
                    }
                    if (warning.length > 0) {
                        locationResponse.warning = warning;
                        locationResponse.warningMsg = ErrorConfig.MESSAGE.LOCATION_REFERENCE_ARE_IN_USE;
                    }
                    if (failed.length > 0) {
                        locationResponse.failedMsg = ErrorConfig.MESSAGE.LOCATION_REFERENCE_NOT_FOUND;
                        locationResponse.failed = failed;
                    }
                    err = new Error(ErrorConfig.MESSAGE.LOCATION_DELETE_ERROR);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    err.data = locationResponse;
                    await conn.query('commit;');
                    return cb(err);
                }
                await conn.query('commit;');
                return cb(null, locationResponse);
            });
        } catch (err) {
            debug('err', err);
            await conn.query('rollback;');
            ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.LOCATION_REFERENCE_DELETE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    searchLocationReferences: async function (options, errorOptions, cb) {
        var accountId = options.accountId;
        var isActive = options.isActive;
        var locationId = options.locationId;
        var locationName = options.locationName;
        var state = options.state;
        var email = options.email;
        var additionalLocationCode = options.additionalLocationCode;
        var additionalLocationName = options.additionalLocationName;
        var checkString = '';
        var checkValues = [];
        var err;

        if (DataUtils.isUndefined(isActive)) {
            err = new Error(ErrorConfig.MESSAGE.IS_ACTIVE_FIELD_REQUIRED);
        } else if (DataUtils.isUndefined(locationId) && DataUtils.isUndefined(locationName) && DataUtils.isUndefined(state)
          && DataUtils.isUndefined(email) && DataUtils.isUndefined(additionalLocationCode) && DataUtils.isUndefined(additionalLocationName)) {
            err = new Error(ErrorConfig.MESSAGE.AT_LEASE_ONE_SEARCH_ATTRIBUTE_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            if (DataUtils.isDefined(locationId)) {
                checkString += ' locationId like ? and ';
                checkValues.push('%' + locationId + '%');
            }
            if (DataUtils.isDefined(locationName)) {
                checkString += ' locationName like ?  and ';
                checkValues.push('%' + locationName + '%');
            }
            if (DataUtils.isDefined(state)) {
                checkString += ' state like ? and ';
                checkValues.push('%' + state + '%');
            }
            if (DataUtils.isDefined(email)) {
                checkString += ' email like ?  and ';
                checkValues.push('%' + email + '%');
            }
            if (DataUtils.isDefined(additionalLocationCode)) {
                checkString += ' additionalLocationCode like ?  and ';
                checkValues.push('%' + additionalLocationCode + '%');
            }
            if (DataUtils.isDefined(additionalLocationName)) {
                checkString += ' additionalLocationName like ?  and ';
                checkValues.push('%' + additionalLocationName + '%');
            }
            checkString = checkString.replace(/and\s*$/, '');

            var conn = await connection.getConnection();

            var locationReferences = await conn.query('IF (select count(locationId) from LocationReference where accountId = uuid_to_bin(?) and ' +
              ' status = ? and ' + checkString + ') > ? THEN ' +
              ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "ROW_COUNT_EXCEED_PLEASE_USE_SEARCH_AND_FILTER", MYSQL_ERRNO = 4001; ' +
              ' ELSE select CAST(uuid_from_bin(accountId) as CHAR) as accountId ,locationId, locationCode, ' +
              ' locationName, additionalLocationCode, additionalLocationName, googleLocationId, googleLocationName,googleFormattedAddress,  email, ' +
              ' phone,dialCode,phoneCountry, primaryMobile,primaryMobileDialCode,primaryMobileCountry, secondaryMobile, secondaryMobileDialCode,secondaryMobileCountry,' +
              ' extension, fax,  addressLine1, addressLine2, addressLine3, city, zipCode, state, country,' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (latitude / CAST(power(10,16) as INTEGER))))) as latitude, ' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (longitude / CAST(power(10,16) as INTEGER))))) as longitude, ' +
              ' googleLink, comment,status, updatedAt from LocationReference where accountId = uuid_to_bin(?) and status = ? ' +
              ' and ' + checkString + ';END IF;',
              [accountId, isActive].concat(checkValues, [Constants.ROW_LIMIT, accountId, isActive], checkValues));
            locationReferences = Utils.filteredResponsePool(locationReferences);

            if (!locationReferences) {
                var array = [];
                return cb(null, array);
            }
            /*if (!DataUtils.isArray(locationReference)) {
                var array = [];
                array.push(locationReference);
                return cb(null, array);
            }*/
            return cb(null, locationReferences);
        } catch (err) {
            debug('err', err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.ROW_COUNT_EXCEED_PLEASE_USE_SEARCH_AND_FILTER);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else {
                err = new Error(ErrorConfig.MESSAGE.GET_LOCATION_REFERENCE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    }
};

module.exports = LocationReference;