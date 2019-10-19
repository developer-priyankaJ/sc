/* jslint node: true */
'use strict';


var debug = require('debug')('scopehub.api.marketplace');
var Util = require('util');
var _ = require('lodash');
var Promise = require('bluebird');
var DataUtils = require('../lib/data_utils');
var Constants = require('../data/constants');
var MarketplaceModel = require('../model/marketplace');
var ProductModel = require('../model/product');
var ScopehubCore = require('../lib/scope_core');
var ErrorConfig = require('../data/error');
var AuditUtils = require('../lib/audit_utils');
var MWSConfig = require('../config/mws');
var Utils = require('../lib/utils');
var connection = require('../lib/connection_util');
var ErrorUtils = require('../lib/error_utils');

var Marketplace = {

    validateOptionalFields: async function (options, cb) {
        var marketplaceFields = '';
        var marketplaceOptionalValues = [];
        var err;

        try {
            if (!DataUtils.isValidateOptionalField(options.mpId)) {
                if (!DataUtils.isString(options.mpId)) {
                    throw err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_MP_ID_MUST_BE_STRING);
                } else if (options.mpId.length > 15) {
                    throw err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_MP_ID_MUST_BE_LESS_THAN_15_CHARACTER);
                } else {
                    marketplaceFields += 'mpId=? ,';
                    marketplaceOptionalValues.push(options.mpId);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.name)) {
                if (!DataUtils.isString(options.name)) {
                    throw err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_NAME_MUST_BE_STRING);
                } else if (options.name.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_NAME_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    marketplaceFields += 'name=? ,';
                    marketplaceOptionalValues.push(options.name);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.region)) {
                if (!DataUtils.isString(options.region)) {
                    throw err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_REGION_MUST_BE_STRING);
                } else if (options.region.length > 15) {
                    throw err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_REGION_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    marketplaceFields += 'region=? ,';
                    marketplaceOptionalValues.push(options.region);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.mpLink)) {
                if (!DataUtils.isString(options.mpLink)) {
                    throw err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_MP_LINK_MUST_BE_STRING);
                } else if (options.mpLink.length > 60) {
                    throw err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_MP_LINK_MUST_BE_LESS_THAN_60_CHARACTER);
                } else {
                    marketplaceFields += 'mpLink=? ,';
                    marketplaceOptionalValues.push(options.mpLink);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.countryCode)) {
                if (!DataUtils.isString(options.countryCode)) {
                    throw err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_COUNTRY_CODE_MUST_BE_STRING);
                } else if (options.countryCode.length > 5) {
                    throw err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_COUNTRY_CODE_MUST_BE_LESS_THAN_5_CHARACTER);
                } else {
                    marketplaceFields += 'countryCode=? ,';
                    marketplaceOptionalValues.push(options.countryCode);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.currencyCode)) {
                if (!DataUtils.isString(options.currencyCode)) {
                    throw err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_CURRENCY_CODE_MUST_BE_STRING);
                } else if (options.currencyCode.length > 3) {
                    throw err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_CURRENCY_CODE_MUST_BE_LESS_THAN_3_CHARACTER);
                } else {
                    marketplaceFields += 'currencyCode=? ,';
                    marketplaceOptionalValues.push(options.currencyCode);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.primaryTimeZone)) {
                if (!DataUtils.isString(options.primaryTimeZone)) {
                    throw err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_PRIMARY_TIME_ZONE_MUST_BE_STRING);
                } else if (options.primaryTimeZone.length > 4) {
                    throw err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_PRIMARY_TIME_ZONE_MUST_BE_LESS_THAN_4_CHARACTER);
                } else {
                    marketplaceFields += 'primaryTimeZone=? ,';
                    marketplaceOptionalValues.push(options.primaryTimeZone);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.imageURL)) {
                marketplaceFields += 'imageURL=? ,';
                marketplaceOptionalValues.push(options.imageURL);
            }

            var response = {
                marketplaceFields: marketplaceFields,
                marketplaceOptionalValues: marketplaceOptionalValues
            };
            return cb(null, response);
        } catch (err) {
            debug('err', err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
    },

    createMD: async function (options, auditOptions, errorOptions, cb) {
        var mpId = options.mpId;
        var name = options.name;
        var region = options.region;
        var countryCode = options.countryCode;
        var currencyCode = options.currencyCode;
        var createdBy = options.user.id;
        var marketplaceFields = '';
        var marketplaceRequiredValues = [];
        var marketplaceOptionalValues = [];
        var createdAt = DataUtils.getEpochMSTimestamp();
        var updatedAt = DataUtils.getEpochMSTimestamp();

        var err;
        if (DataUtils.isValidateOptionalField(mpId)) {
            err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_MP_ID_REQUIRED);
        } else if (DataUtils.isValidateOptionalField(name)) {
            err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_NAME_REQUIRED);
        } else if (DataUtils.isValidateOptionalField(region)) {
            err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_REGION_REQUIRED);
        } else if (DataUtils.isValidateOptionalField(countryCode)) {
            err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_COUNTRY_CODE_REQUIRED);
        } else if (DataUtils.isValidateOptionalField(currencyCode)) {
            err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_CURRENCY_CODE_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug(err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
        marketplaceRequiredValues.push(mpId);

        Marketplace.validateOptionalFields(options, async function (err, response) {
            if (err) {
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            marketplaceFields = response.marketplaceFields;
            marketplaceOptionalValues = response.marketplaceOptionalValues;

            marketplaceRequiredValues = _.concat(marketplaceRequiredValues, marketplaceOptionalValues);
            marketplaceRequiredValues.push(createdAt, updatedAt, createdBy);

            try {
                var conn = await connection.getConnection();
                var marketplace = await conn.query('If (SELECT 1 FROM Marketplaces WHERE mpId=?) is null then ' +
                  'INSERT into Marketplaces set ' + marketplaceFields +
                  'createdAt = ?, updatedAt = ?,createdBy=uuid_to_bin(?);end if',
                  marketplaceRequiredValues);

                var isMarketplaceAffected = Utils.isAffectedPool(marketplace);

                if (!isMarketplaceAffected) {
                    err = new Error(ErrorConfig.MESSAGE.DUPLICATE_MARKETPLACE);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
                AuditUtils.create(auditOptions);
                return cb(null, {
                    OK: Constants.SUCCESS,
                    // id: id,
                    createdAt: createdAt()
                });
            } catch (err) {
                err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_CREATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
        });
    },

    getMarketplace: function (options, cb) {
        var marketplaceId = options.marketplaceId;
        var err;
        if (DataUtils.isUndefined(marketplaceId)) {
            err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_ID_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug(err);
            return cb(err);
        }

        MarketplaceModel.get(marketplaceId, {
            ConsistentRead: true
        }, function (err, data) {
            var marketplace = data && data.attrs;
            return cb(err, marketplace);
        });
    },

    getMarketplaceMD: async function (options, errorOptions, cb) {
        var mpId = options.mpId;
        var err;
        if (DataUtils.isUndefined(mpId)) {
            err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_ID_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug(err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var marketplace = await conn.query('select mpId, name, region, active, imageURL, mpLink,countryCode,currencyCode,' +
              'primaryTimeZone,updatedAt from Marketplaces where mpId=?', mpId);
            marketplace = Utils.filteredResponsePool(marketplace);

            if (!marketplace) {
                err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            return cb(null, marketplace);
        } catch (err) {
            err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    getUnRegisteredMpsAccount: async function (options, errorOptions, cb) {
        var accountId = options.account.id;
        var err;

        try {
            var conn = await connection.getConnection();
            var marketplaces = await conn.query('select Mp.mpId,Mp.name, Mp.region,Mp.active,Mp.imageURL,Mp.mpLink,Mp.countryCode,' +
              'Mp.currencyCode,Mp.primaryTimeZone, Mp.updatedAt ' +
              'from Marketplaces Mp where Mp.mpId not In (select AccMp.mpId from AccountMarketplaces AccMp ' +
              'where accountId = uuid_to_bin(?))', accountId);

            return cb(null, marketplaces);
        } catch (err) {
            err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    getMarketplacesMD: async function (errorOptions, cb) {

        try {
            var conn = await connection.getConnection();
            var marketplaces = await conn.query('select mpId, name, region, active, imageURL, mpLink,countryCode,currencyCode,' +
              'primaryTimeZone, updatedAt from Marketplaces where isDefault = 0');

            if (!marketplaces) {
                marketplaces = [];
            } else if (!_.isArray(marketplaces)) {
                var tempMarketplaces = [];
                tempMarketplaces.push(marketplaces);
                marketplaces = tempMarketplaces;
            }
            return cb(null, marketplaces);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            //await ErrorUtils.create(errorOptions, err);
            return cb(err);
        }
    },

    getMarketplacesDetailsForSellerMD: async function (options, errorOptions, cb) {
        var account = options.account;
        var finalMarketplaces = [];

        try {
            var conn = await connection.getConnection();
            var marketplaces = await conn.query('select mpId, name, region, active, imageURL, mpLink,countryCode,currencyCode,' +
              'primaryTimeZone from Marketplaces where isDefault = 0');

        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, err);
            return cb(err);
        }
        try {
            var conn = await connection.getConnection();
            await Promise.each(marketplaces, async function (mp) {
                var accountMp = await conn.query('select accessCredentials, status,mpId,updatedAt from AccountMarketplaces ' +
                  'where accountId=uuid_to_bin(?) and mpId=?', [account.id, mp.mpId]);
                accountMp = Utils.filteredResponsePool(accountMp);
                if (accountMp) {
                    mp.accessCredentials = accountMp.accessCredentials;
                    mp.status = accountMp.status;
                    mp.updatedAt = accountMp.updatedAt;
                    finalMarketplaces.push(mp);
                } else {
                    mp.accessCredentials = Constants.SELLER_CREDENTIALS.NOT_SET;
                    mp.status = 0;
                    finalMarketplaces.push(mp);
                }
            });

            return cb(null, finalMarketplaces);

        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, err);
            return cb(err);
        }
    },

    updateMarketplaceMD: async function (options, auditOptions, errorOptions, cb) {
        var mpId = options.mpId;
        var updatedAt = options.updatedAt;
        var updatedBy = options.user.id;
        var countryCode = options.countryCode;
        var currencyCode = options.currencyCode;
        var marketplaceFields = '';
        var marketplaceRequiredValues = [];
        var marketplaceOptionalValues = [];
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();
        var err;
        if (DataUtils.isUndefined(mpId)) {
            err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_MP_ID_REQUIRED);
        } else if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_UPDATED_AT_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug(err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
        //updatedAt = new Date(updatedAt);
        marketplaceRequiredValues.push(mpId, mpId, updatedAt);

        Marketplace.validateOptionalFields(options, async function (err, response) {
            if (err) {
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            marketplaceFields = response.marketplaceFields;
            marketplaceOptionalValues = response.marketplaceOptionalValues;

            if (marketplaceOptionalValues.length === 0) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_REQUEST);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug('err', err);
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            marketplaceRequiredValues = _.concat(marketplaceRequiredValues, marketplaceOptionalValues);
            marketplaceRequiredValues.push(newUpdatedAt, updatedBy, mpId);

            try {
                var conn = await connection.getConnection();
                var marketplace = await conn.query('IF (select 1 from Marketplaces where mpId=?) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "MARKETPLACE_NOT_FOUND", MYSQL_ERRNO = 4001;' +
                  'ELSEIF (select 1 from Marketplaces where mpId=? and updatedAt=?) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "MARKETPLACE_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
                  'ELSE update Marketplaces set ' + marketplaceFields + ' updatedAt = ?,updatedBy=uuid_to_bin(?) ' +
                  'where mpId = ?;end if;', marketplaceRequiredValues);

                var isAffected = Utils.isAffectedPool(marketplace);

                if (!isAffected) {
                    err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
                AuditUtils.create(auditOptions);
                return cb(null, {OK: Constants.SUCCESS, updatedAt: newUpdatedAt});
            } catch (err) {
                await ErrorUtils.create(errorOptions, options, err);
                if (err.errno === 4001) {
                    err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return cb(err);
                } else if (err.errno === 4002) {
                    err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    return cb(err);
                } else {
                    err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return cb(err);
                }
            }
        });
    },

    removeMarketplaceMD: async function (options, auditOptions, errorOptions, cb) {
        var mpId = options.mpId;
        var updatedAt = options.updatedAt;
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();
        var err;
        if (DataUtils.isUndefined(mpId)) {
            err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_MP_ID_REQUIRED);
        } else if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_UPDATED_AT_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug(err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var marketplace = await conn.query('IF (select 1 from Marketplaces where mpId=?) is null then ' +
              'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "MARKETPLACE_NOT_FOUND", MYSQL_ERRNO =4001;' +
              'ELSEIF (select 1 from Marketplaces where updatedAt=?) is null then ' +
              'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "MARKETPLACE_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
              'ELSE  update Marketplaces set active=?, updatedBy=uuid_to_bin(?), updatedAt=? WHERE mpId=?;end if',
              [mpId, updatedAt, false, options.user.id, newUpdatedAt, mpId]);

            var isAffected = Utils.isAffectedPool(marketplace);
            if (!isAffected) {
                err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_REMOVE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            AuditUtils.create(auditOptions);
            return cb(null, {OK: Constants.SUCCESS, updatedAt: newUpdatedAt});
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            } else if (err.errno === 4002) {
                err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                return cb(err);
            } else {
                err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_REMOVE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
        }
    }
};

module.exports = Marketplace;
