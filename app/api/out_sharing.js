/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.api.out_sharing');
var Util = require('util');
var _ = require('lodash');
var Promise = require('bluebird');
var moment = require('moment');
var sjcl = require('sjcl');
var crypto = require('crypto');
var jsonToCsv = require('json2csv').parse;
var zlib = require('zlib');
var fs = require('fs');
var connection = require('../lib/connection_util');

var ErrorConfig = require('../data/error');
var DataUtils = require('../lib/data_utils');
var AuditUtils = require('../lib/audit_utils');
var ErrorUtils = require('../lib/error_utils');
var S3Utils = require('../lib/s3_utils');
var Constants = require('../data/constants');
var Supplier = require('./../api/supplier');

var Utils = require('../lib/utils');
var ProductInventory = require('./../api/product_inventory');
var SupplyInventory = require('./../api/supply_inventory');
var Customer = require('./../api/customer');


var OutSharing = {
    getDataItemsMD: async function (options, errorOptions, cb) {
        var languageCultureCode = options.languageCultureCode;
        var type = options.type;
        var err;

        if (DataUtils.isUndefined(type)) {
            err = new Error(ErrorConfig.MESSAGE.OUT_SHARING_PROFILE_TYPE_REQUIRED);
        }

        if (!err && DataUtils.isUndefined(languageCultureCode)) {
            err = new Error(ErrorConfig.MESSAGE.LANGUAGE_CULTURE_CODE_REQUIRED);
        }

        if (!err && Constants.OUT_SHARE_TYPE.indexOf(type) === -1) {
            err = new Error(ErrorConfig.MESSAGE.OUT_SHARING_PROFILE_TYPE_INVALID);
        }

        if (!err && Constants.VALID_LANGUAGE_CULTURE_CODE.indexOf(languageCultureCode) === -1) {
            err = new Error(ErrorConfig.MESSAGE.LANGUAGE_CULTURE_CODE_INVALID);
        }

        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            type = Constants.SHARING_TYPE[type];
            if (!type) {
                err = new Error(ErrorConfig.MESSAGE.OUT_SHARING_PROFILE_TYPE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }
            var dataItems = await conn.query('select dsr.dataItemId, dsr.languageCultureCode,dsr.dataItemShortName,' +
              'dsr.dataItemLongName from DSIbyType dst, DSIreference dsr where sharingType = ? and dsr.languageCultureCode = ? ' +
              'and dst.dataItemId = dsr.dataItemId', [type, languageCultureCode]);

            return cb(null, dataItems);
        } catch (err) {

            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);

            if (err.code) {
                err = new Error(ErrorConfig.MESSAGE.SHARING_DATA_ITEM_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    getByAccountIdAndProfileIdMD: async function (options, errorOptions, cb) {
        var accountId = options.accountId;
        var id = options.id;
        var err;

        if (DataUtils.isUndefined(accountId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
        }

        if (!err && DataUtils.isUndefined(id)) {
            err = new Error(ErrorConfig.MESSAGE.OUT_SHARING_PROFILE_ID_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var outSharingProfile = await conn.query('select CAST(uuid_from_bin(id) as char) as id,' +
              'CAST(uuid_from_bin(accountId) as char) as accountId,' +
              'profileId,type,freqType,freqTime,freqDay,sharedDataItems,profileName,createdAt,updatedAt ' +
              'from OutSharingProfile where accountId = uuid_to_bin(?) and id = uuid_to_bin(?) ', [accountId, id]);

            outSharingProfile = Utils.filteredResponsePool(outSharingProfile);

            if (!outSharingProfile) {
                err = new Error(ErrorConfig.MESSAGE.OUT_SHARING_PROFILE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }
            outSharingProfile.type = Object.keys(Constants.SHARING_TYPE)[Object.values(Constants.SHARING_TYPE).indexOf(outSharingProfile.type)];
            outSharingProfile.sharedDataItems = outSharingProfile.sharedDataItems.split(',');
            return cb(null, outSharingProfile);

        } catch (err) {

            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);

            if (err.code) {
                err = new Error(ErrorConfig.MESSAGE.OUT_SHARING_PROFILE_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    getByAccountIdMD: async function (options, errorOptions, cb) {
        var accountId = options.accountId;
        var type = options.type;

        var err;

        if (DataUtils.isUndefined(accountId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            if (DataUtils.isDefined(type)) {

                if (!err && Constants.OUT_SHARE_TYPE.indexOf(type) === -1) {
                    err = new Error(ErrorConfig.MESSAGE.OUT_SHARING_PROFILE_TYPE_INVALID);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    throw err;
                }

                type = Constants.SHARING_TYPE[type];

                var outSharingProfiles = await conn.query('select CAST(uuid_from_bin(id) as char) as id,' +
                  'CAST(uuid_from_bin(accountId) as char) as accountId,' +
                  'profileId,type,freqType,freqTime,freqDay,sharedDataItems,profileName,createdAt,updatedAt ' +
                  'from OutSharingProfile where accountId = uuid_to_bin(?) and type = ? ', [accountId, type]);

            } else {
                var outSharingProfiles = await conn.query('select CAST(uuid_from_bin(id) as char) as id,' +
                  'CAST(uuid_from_bin(accountId) as char) as accountId,' +
                  'profileId,type,freqType,freqTime,freqDay,sharedDataItems,profileName,createdAt,updatedAt ' +
                  'from OutSharingProfile where accountId = uuid_to_bin(?) ', [accountId]);
            }

            await Promise.each(outSharingProfiles, function (outSharingProfile) {

                outSharingProfile.type = Object.keys(Constants.SHARING_TYPE)[Object.values(Constants.SHARING_TYPE).indexOf(outSharingProfile.type)];
                outSharingProfile.sharedDataItems = outSharingProfile.sharedDataItems.split(',');

            });

            return cb(null, outSharingProfiles);

        } catch (err) {

            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);

            if (err.code) {
                err = new Error(ErrorConfig.MESSAGE.OUT_SHARING_PROFILE_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    /*
    * Create outShare profile Record
    * */
    createMD: async function (options) {

        var saveAsLater = options.saveAsLater;
        var profileId = '';
        var profileName = '';
        var noOfDays = 0;
        var isUseable = 0;
        var err;

        if (DataUtils.isUndefined(options.accountId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
        }

        if (saveAsLater) {
            if (DataUtils.isUndefined(options.newProfileId)) {
                err = new Error(ErrorConfig.MESSAGE.NEW_OUT_SHARING_PROFILE_ID_REQUIRED);
            } else if (DataUtils.isUndefined(options.newProfileName)) {
                err = new Error(ErrorConfig.MESSAGE.NEW_OUT_SHARING_PROFILE_NAME_REQUIRED);
            } else {
                profileId = options.newProfileId;
                profileName = options.newProfileName;
                isUseable = '1';
            }
        }

        if (!err && !DataUtils.isArray(options.sharedDataItems)) {
            err = new Error(ErrorConfig.MESSAGE.OUT_SHARING_PROFILE_DATA_ITEMS_REQUIRED);
        }

        if (!err && !options.sharedDataItems.length) {
            err = new Error(ErrorConfig.MESSAGE.OUT_SHARING_PROFILE_DATA_ITEMS_REQUIRED);
        }

        if (!err && DataUtils.isUndefined(options.freqType)) {
            err = new Error(ErrorConfig.MESSAGE.OUT_SHARING_PROFILE_FREQ_TYPE_REQUIRED);
        }

        var isValidFreqType = Object.keys(Constants.OUT_SHARE_FREQ_TYPE).some(function (k) {
            return Constants.OUT_SHARE_FREQ_TYPE[k] === options.freqType;
        });

        if (!err && !isValidFreqType) {
            err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_FREQ_TYPE_INVALID);
        }

        if (!err && (options.freqType.toLowerCase() === Constants.OUT_SHARE_FREQ_TYPE.MONTHLY ||
          options.freqType.toLowerCase() === Constants.OUT_SHARE_FREQ_TYPE.WEEKLY)) {

            if (!err && DataUtils.isUndefined(options.freqDay)) {
                err = new Error(ErrorConfig.MESSAGE.OUT_SHARING_PROFILE_FREQ_DAY_REQUIRED);
            } else if (!err && !DataUtils.isString(options.freqDay)) {
                err = new Error(ErrorConfig.MESSAGE.OUT_SHARING_PROFILE_FREQ_DAY_MUST_BE_STRING);
            }

        }

        if (!err && DataUtils.isUndefined(options.freqTime) && (options.freqType.toLowerCase() === Constants.OUT_SHARE_FREQ_TYPE.MONTHLY ||
          options.freqType.toLowerCase() === Constants.OUT_SHARE_FREQ_TYPE.WEEKLY || options.freqType.toLowerCase() === Constants.OUT_SHARE_FREQ_TYPE.DAILY)) {
            err = new Error(ErrorConfig.MESSAGE.OUT_SHARING_FREQ_TIME_REQUIRED);
        }

        /*if (!err && Constants.OUT_SHARE_PROFILE_TYPE.PRODUCT_ORDERS === options.type) {
            if (!err && DataUtils.isValidateOptionalField(options.noOfDays)) {
                err = new Error(ErrorConfig.MESSAGE.OUT_SHARING_PROFILE_NO_OF_DAYS_REQUIRED);
            } else if (!err && !DataUtils.isNumber(options.noOfDays)) {
                err = new Error(ErrorConfig.MESSAGE.OUT_SHARING_PROFILE_NO_OF_DAYS_MUST_BE_NUMBER);
            } else {
                noOfDays = options.noOfDays;
            }
        }

        if (!err && Constants.OUT_SHARE_PROFILE_TYPE.PURCHASE_ORDERS === options.type && DataUtils.isUndefined(options.noOfDays)) {
            err = new Error(ErrorConfig.MESSAGE.OUT_SHARING_PROFILE_NO_OF_DAYS_REQUIRED);
        }*/

        try {

            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            var id = Utils.generateId().uuid;
            var type = Constants.SHARING_TYPE[options.type];
            var currentDate = new Date().getTime();
            var sharedDataItems = options.sharedDataItems.join(',');
            var optinalFeilds = '';
            var optionalValues = [];

            if (options.freqTime) {
                optinalFeilds += 'freqTime = ?,';
                optionalValues.push(options.freqTime);
            }

            if (options.freqDay) {
                optinalFeilds += 'freqDay = ?,';
                optionalValues.push(options.freqDay);
            }

            if (options.notes) {
                optinalFeilds += 'notes = ?,';
                optionalValues.push(options.notes);
            }

            var conn = await connection.getConnection();

            if (saveAsLater) {
                var query = 'IF EXISTS (SELECT 1 from OutSharingProfile where accountId = uuid_to_bin(?) and profileId = ?)' +
                  'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4006,MESSAGE_TEXT = "DUPLICATE_OUT_SHARING_PROFILE_CREATION";' +
                  'ELSE INSERT into OutSharingProfile SET id = uuid_to_bin(?), accountId = uuid_to_bin(?), profileId = ?,type = ?,' +
                  'sharedDataItems = ?,freqType = ?,createdAt = ?,noOfDays = ?,' +
                  'createdBy = uuid_to_bin(?),isUseable = ?,profileName = ?,' + optinalFeilds + 'updatedAt = ?;end IF';

                var params = [options.accountId, options.newProfileId, id, options.accountId, profileId, type,
                    sharedDataItems, options.freqType, currentDate, noOfDays, options.userId, isUseable, profileName].concat(optionalValues).concat([currentDate]);

            } else {

                query = 'INSERT into OutSharingProfile SET id = uuid_to_bin(?), accountId = uuid_to_bin(?), profileId = ?,type = ?,' +
                  'sharedDataItems = ?,freqType = ?,createdAt = ?,noOfDays = ?,' +
                  'createdBy = uuid_to_bin(?),isUseable = ?,' + optinalFeilds + 'updatedAt = ?;';

                var params = [id, options.accountId, profileId, type, sharedDataItems,
                    options.freqType, currentDate, noOfDays, options.userId, isUseable].concat(optionalValues).concat([currentDate]);

            }

            var isCreated = await conn.query(query, params);

            if (!Utils.isAffectedPool(isCreated)) {
                err = new Error(ErrorConfig.MESSAGE.OUT_SHARING_PROFILE_CREATION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            return id;
        } catch (err) {

            if (err.errno === 4006) {
                err = new Error(ErrorConfig.MESSAGE.DUPLICATE_OUT_SHARING_PROFILE_CREATION);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.code) {
                err = new Error(ErrorConfig.MESSAGE.OUT_SHARING_PROFILE_CREATION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            throw err;
        }
    },

    /*getByAccountIdAndProfileId: async function (options, errorOptions, cb) {
        var accountIdProfileId = options.accountIdProfileId;
        var err;
        if (DataUtils.isUndefined(options.accountIdProfileId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_PROFILE_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
        }
        if (err) {
            await ErrorUtils.create(errorOptions, accountIdProfileId, err);
            return cb(err);
        }

        try {
            var outShare = await OutShareModel.findByAccountIdAndProfileId(accountIdProfileId);
            if (outShare.length === 0) {
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_PROFILE_ID_INVALID);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, accountIdProfileId, err);
                return cb(err);
            }
            return cb(null, outShare);
        } catch (err) {
            await ErrorUtils.create(errorOptions, accountIdProfileId, err);
            return cb(err);
        }
    },*/

    /*
    * Get OutShare and profile data by id
    * */
    getOutShareById: function (options) {
        return new Promise(async function (resolve, reject) {
            var outShareInstanceId = options.outShareInstanceId;
            var err;

            try {
                var conn = await connection.getConnection();

                var outShareInstance = await conn.query('SELECT CAST(uuid_from_bin(OS.accountId) as char) as accountId,' +
                  ' AC.languageCultureCode,CAST(uuid_from_bin(OS.id) as char) as id,' +
                  ' OS.shareItemType,OS.status,OS.outShareId,OS.dataProtectionOption,' +
                  ' OSP.sharedDataItems,OSP.profileId,OSP.freqType,OSP.freqTime,OSP.freqDay ' +
                  ' from OutShare OS,OutSharingProfile OSP, accounts AC  ' +
                  ' where OS.id = uuid_to_bin(?) and OSP.id = OS.sharingProfileId and AC.id = OS.accountId;', [outShareInstanceId]);
                outShareInstance = Utils.filteredResponsePool(outShareInstance);

                if (!outShareInstance) {
                    err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }
                return resolve(outShareInstance);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
    * Get shareItems by outShareInstanceId
    * */
    getShareItemsByOutShareId: function (options) {
        return new Promise(async function (resolve, reject) {
            var outShareInstanceId = options.outShareInstanceId;
            var err;

            try {
                var conn = await connection.getConnection();

                var shareItems = await conn.query('select CAST(uuid_from_bin(shareItemId) as char) as shareItemId from OutShareItems ' +
                  'where outShareInstanceId=uuid_to_bin(?) and status = 1;', [outShareInstanceId]);

                if (shareItems.length <= 0) {
                    err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_NOT_HAVE_ANY_SHARE_ITEM);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }
                return resolve(shareItems);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.SHARE_ITEM_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
    * Get inSharePartners by outShareInstanceId
    * */
    getInSharePartnersByOutShareId: function (options) {
        return new Promise(async function (resolve, reject) {
            var outShareInstanceId = options.outShareInstanceId;
            var sharingEventId = options.sharingEventId;
            var effectiveTimeStamp = options.effectiveTimeStamp;
            var meta = options.meta;

            var inSharePartners = [];
            var err;

            try {
                var conn = await connection.getConnection();

                inSharePartners = await conn.query('select CAST(uuid_from_bin(OSP.inSharePartnerId) as char) as inSharePartnerId , ' +
                  ' CAST(uuid_from_bin(I.id) as char) as inShareId, AC.languageCultureCode,I.dataDeliveryOption,I.inShareId as inSharingId,I.inShareName ' +
                  ' from OutSharePartners OSP , accounts AC , InShare I ' +
                  ' where OSP.outShareInstanceId=uuid_to_bin(?) and AC.id = OSP.inSharePartnerId and ' +
                  ' I.outShareInstanceId = uuid_to_bin(?) and I.accountId = OSP.inSharePartnerId and I.status = 1;', [outShareInstanceId, outShareInstanceId]);
                //inSharePartners = await conn.query('select CAST(uuid_from_bin(inSharePartnerId) as char) as inSharePartnerId from OutSharePartners where outShareInstanceId=uuid_to_bin(?)', [outShareInstanceId]);

                if (inSharePartners.length <= 0) {

                    var sharingErrorLogOption = {
                        outShareInstanceId: outShareInstanceId,
                        sharingEventId: sharingEventId,
                        inShareId: Constants.DEFAULT_REFERE_ID,
                        failReasonCode: Constants.DATA_SHARING_FAIL_REASON_CODE.OUT_SHARE_NOT_HAVE_ANY_IN_SHARE_PARTNER.CODE,
                        errorMessage: Constants.DATA_SHARING_FAIL_REASON_CODE.OUT_SHARE_NOT_HAVE_ANY_IN_SHARE_PARTNER.MESSAGE,
                        meta: meta,
                        effectiveTimeStamp: effectiveTimeStamp,
                        createdAt: DataUtils.getEpochMSTimestamp()
                    };
                    var sharingErrorLogResponse = await OutSharing.createSharingErrorLog({
                        sharingErrorLogList: [sharingErrorLogOption]
                    });
                    /*err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_NOT_HAVE_ANY_IN_SHARE_PARTNER);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);*/
                }
                return resolve(inSharePartners);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.IN_SHARE_PARTNER_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
    * build query for getting shareItems
    * */
    manipulateGetShareItemQuery: function (options) {
        return new Promise(function (resolve, reject) {
            var shareItemIds = options.shareItemIds;
            var string = '', values = [];

            _.map(shareItemIds, function (shareItemId) {
                string += 'uuid_to_bin(?),';
                values.push(shareItemId.shareItemId);
            });
            string = string.replace(/,\s*$/, ' ');
            return resolve({
                string: string,
                values: values
            });
        });
    },

    /*
    * build query for getting orders
    * */
    manipulateGetOrderQuery: function (options) {
        return new Promise(function (resolve, reject) {
            var list = options.list;
            var string = '', values = [];

            _.map(list, function (item) {
                string += ' OLI.orderRefId = uuid_to_bin(?) OR ';
                values.push(item);
            });
            string = string.replace(/OR\s*$/, ' ');
            return resolve({
                string: string,
                values: values
            });
        });
    },

    /*
    * Get productInventory by ids
    * */
    getProductInventoryByID: function (options) {
        return new Promise(async function (resolve, reject) {
            var shareItemIds = options.shareItemIds;
            var partner = options.partner;
            var outShareInstance = options.outShareInstance;
            var meta = options.meta;
            var effectiveTimeStamp = options.effectiveTimeStamp;
            var sharingEventId = options.sharingEventId;
            var languageCultureCode = partner.languageCultureCode;
            var outSharePartnersLcc = outShareInstance.languageCultureCode;
            var productInventories = [];
            var err;

            try {
                var conn = await connection.getConnection();

                var response = await OutSharing.manipulateGetShareItemQuery({shareItemIds: shareItemIds});

                productInventories = await conn.query('select CAST(uuid_from_bin(p.id) as char) as id ,' +
                  ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(p.qtyOnHand/CAST(power(10,US1.scalingPrecision) as INTEGER))))) as qtyOnHand,' +
                  ' UN1.name as qtyOnHandUOMName, UN1.symbol as qtyOnHandUOMSymbol,US1.scalingFactor as qtyOnHandUoMScalingFactor, ' +
                  ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(p.qtyOnOrder/CAST(power(10,US2.scalingPrecision) as INTEGER))))) as qtyOnOrder, ' +
                  ' UN2.name as qtyOnOrderUOMName, UN2.symbol as qtyOnOrderUOMSymbol,US2.scalingFactor as qtyOnOrderUoMScalingFactor, ' +
                  ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(p.qtyAvailable/CAST(power(10,US3.scalingPrecision) as INTEGER))))) as qtyAvailable, ' +
                  ' UN3.name as qtyAvailableUOMName, UN3.symbol as qtyAvailableUOMSymbol,US3.scalingFactor as qtyAvailableUoMScalingFactor, ' +
                  ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(p.qtyInTransit/CAST(power(10,US4.scalingPrecision) as INTEGER))))) as qtyInTransit, ' +
                  ' UN4.name as qtyInTransitUOMName, UN4.symbol as qtyInTransitUOMSymbol, ' +
                  ' p.qtyOnHandUOM, p.qtyOnOrderUOM, p.qtyAvailableUOM, p.qtyInTransitUOM,PR.sku,PR.sellerSKUName ' +
                  ' from ' +
                  ' ProductInventory as p,ProductReferences PR, uomNames UN1, uomNames UN2, uomNames UN3, uomNames UN4, ' +
                  ' uomScaling as US1, uomScaling as US2, uomScaling as US3, uomScaling as US4' +
                  ' where ' +
                  ' PR.id = p.productRefId and ' +
                  ' p.qtyOnHandUOM = US1.id and ' +
                  ' p.qtyOnOrderUOM = US2.id and ' +
                  ' p.qtyAvailableUOM = US3.id and ' +
                  ' p.qtyInTransitUOM = US4.id and ' +
                  ' (UN1.uomScalingId = p.qtyOnHandUoM and case  when exists (select 1 from uomNames  where uomScalingId = UN1.uomScalingId and languageCultureCode= ? ) then UN1.languageCultureCode = ? ' +
                  ' else UN1.languageCultureCode = ? ' +
                  ' end) and ' +
                  ' (UN2.uomScalingId = p.qtyOnOrderUoM and case  when exists (select 1 from uomNames  where uomScalingId = UN2.uomScalingId and languageCultureCode= ? ) then UN2.languageCultureCode = ? ' +
                  ' else UN2.languageCultureCode = ?' +
                  ' end) and ' +
                  ' (UN3.uomScalingId = p.qtyAvailableUoM and case  when exists (select 1 from uomNames  where uomScalingId = UN3.uomScalingId and languageCultureCode= ? ) then UN3.languageCultureCode = ? ' +
                  ' else UN3.languageCultureCode = ? ' +
                  ' end) and ' +
                  ' (UN4.uomScalingId = p.qtyInTransitUoM  and case  when exists (select 1 from uomNames  where uomScalingId = UN4.uomScalingId and languageCultureCode= ? ) then UN4.languageCultureCode = ? ' +
                  ' else UN4.languageCultureCode = ? ' +
                  ' end) and ' +
                  ' p.id in (' + response.string + ')', [languageCultureCode, languageCultureCode, outSharePartnersLcc,
                    languageCultureCode, languageCultureCode, outSharePartnersLcc,
                    languageCultureCode, languageCultureCode, outSharePartnersLcc,
                    languageCultureCode, languageCultureCode, outSharePartnersLcc].concat(response.values));

                if (productInventories && (productInventories.length <= 0 || shareItemIds.length !== productInventories.length)) {
                    // store sharing error log
                    var sharingErrorLogOption = {
                        outShareInstanceId: outShareInstance.id,
                        sharingEventId: sharingEventId,
                        inShareId: Constants.DEFAULT_REFERE_ID,
                        failReasonCode: Constants.DATA_SHARING_FAIL_REASON_CODE.SHARE_ITEM_NOT_FOUND.CODE,
                        errorMessage: Constants.DATA_SHARING_FAIL_REASON_CODE.SHARE_ITEM_NOT_FOUND.MESSAGE,
                        meta: meta,
                        effectiveTimeStamp: effectiveTimeStamp,
                        createdAt: DataUtils.getEpochMSTimestamp()
                    };
                    var sharingErrorLogResponse = await OutSharing.createSharingErrorLog({
                        sharingErrorLogList: [sharingErrorLogOption]
                    });
                    debug('sharingErrorLogResponse', sharingErrorLogResponse);
                    /*err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);*/
                }
                return resolve(productInventories);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
    * Get supplyInventory by ids
    * */
    getSupplyInventoryByID: function (options) {
        return new Promise(async function (resolve, reject) {
            var shareItemIds = options.shareItemIds;
            var partner = options.partner;
            var outShareInstance = options.outShareInstance;
            var meta = options.meta;
            var effectiveTimeStamp = options.effectiveTimeStamp;
            var sharingEventId = options.sharingEventId;
            var languageCultureCode = partner.languageCultureCode;
            var outSharePartnersLcc = outShareInstance.languageCultureCode;
            var supplyInventories = [];
            var err;

            try {
                var conn = await connection.getConnection();

                var response = await OutSharing.manipulateGetShareItemQuery({shareItemIds: shareItemIds});

                supplyInventories = await conn.query('select CAST(uuid_from_bin(s.id) as char) as id ,' +
                  ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(s.qtyOnHand/CAST(power(10,US1.scalingPrecision) as INTEGER))))) as qtyOnHand,' +
                  ' s.qtyOnHandUoM, UN1.name as qtyOnHandUOMName, UN1.symbol as qtyOnHandUOMSymbol,US1.scalingFactor as qtyOnHandUoMScalingFactor, ' +
                  ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(s.qtyOnOrder/CAST(power(10,US2.scalingPrecision) as INTEGER))))) as qtyOnOrder, ' +
                  ' s.qtyOnOrderUoM, UN2.name as qtyOnOrderUOMName, UN2.symbol as qtyOnOrderUOMSymbol,US2.scalingFactor as qtyOnOrderUoMScalingFactor, ' +
                  ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(s.qtyAvailable/CAST(power(10,US3.scalingPrecision) as INTEGER))))) as qtyAvailable, ' +
                  ' s.qtyAvailableUoM, UN3.name as qtyAvailableUOMName, UN3.symbol as qtyAvailableUOMSymbol,US3.scalingFactor as qtyAvailableUoMScalingFactor, ' +
                  ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(s.qtyInTransit/CAST(power(10,US4.scalingPrecision) as INTEGER))))) as qtyInTransit, ' +
                  ' s.qtyInTransitUOM, UN4.name as qtyInTransitUOMName, UN4.symbol as qtyInTransitUOMSymbol,SIT.sku,SIT.sellerSKUName ' +
                  ' from ' +
                  ' SupplyInventory as s,SupplyItems SIT, uomNames UN1, uomNames UN2, uomNames UN3, uomNames UN4, ' +
                  ' uomScaling as US1, uomScaling as US2, uomScaling as US3, uomScaling as US4' +
                  ' where ' +
                  ' SIT.id = s.supplyItemId and ' +
                  ' s.qtyOnHandUOM = US1.id and ' +
                  ' s.qtyOnOrderUOM = US2.id and ' +
                  ' s.qtyAvailableUOM = US3.id and ' +
                  ' s.qtyInTransitUOM = US4.id and ' +
                  ' (UN1.uomScalingId = s.qtyOnHandUoM and case  when exists (select 1 from uomNames  where uomScalingId = UN1.uomScalingId and languageCultureCode= ? ) then UN1.languageCultureCode = ? ' +
                  ' else UN1.languageCultureCode = ? ' +
                  ' end) and ' +
                  ' (UN2.uomScalingId = s.qtyOnOrderUoM and case  when exists (select 1 from uomNames  where uomScalingId = UN2.uomScalingId and languageCultureCode= ? ) then UN2.languageCultureCode = ? ' +
                  ' else UN2.languageCultureCode = ?' +
                  ' end) and ' +
                  ' (UN3.uomScalingId = s.qtyAvailableUoM and case  when exists (select 1 from uomNames  where uomScalingId = UN3.uomScalingId and languageCultureCode= ? ) then UN3.languageCultureCode = ? ' +
                  ' else UN3.languageCultureCode = ? ' +
                  ' end) and ' +
                  ' (UN4.uomScalingId = s.qtyInTransitUoM  and case  when exists (select 1 from uomNames  where uomScalingId = UN4.uomScalingId and languageCultureCode= ? ) then UN4.languageCultureCode = ? ' +
                  ' else UN4.languageCultureCode = ? ' +
                  ' end) and ' +
                  ' s.id in (' + response.string + ')', [languageCultureCode, languageCultureCode, outSharePartnersLcc,
                    languageCultureCode, languageCultureCode, outSharePartnersLcc,
                    languageCultureCode, languageCultureCode, outSharePartnersLcc,
                    languageCultureCode, languageCultureCode, outSharePartnersLcc].concat(response.values));

                if (supplyInventories && (supplyInventories.length <= 0 || shareItemIds.length !== supplyInventories.length)) {
                    // store sharing error log
                    var sharingErrorLogOption = {
                        outShareInstanceId: outShareInstance.id,
                        sharingEventId: sharingEventId,
                        inShareId: Constants.DEFAULT_REFERE_ID,
                        failReasonCode: Constants.DATA_SHARING_FAIL_REASON_CODE.SHARE_ITEM_NOT_FOUND.CODE,
                        errorMessage: Constants.DATA_SHARING_FAIL_REASON_CODE.SHARE_ITEM_NOT_FOUND.MESSAGE,
                        meta: meta,
                        effectiveTimeStamp: effectiveTimeStamp,
                        createdAt: DataUtils.getEpochMSTimestamp()
                    };
                    var sharingErrorLogResponse = await OutSharing.createSharingErrorLog({
                        sharingErrorLogList: [sharingErrorLogOption]
                    });
                    debug('sharingErrorLogResponse', sharingErrorLogResponse);
                    /*err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);*/
                }
                return resolve(supplyInventories);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
    * Get Orders from the products
    * */
    getOrdersFromProductRefId: function (options) {
        return new Promise(async function (resolve, reject) {
            var shareItemIds = options.shareItemIds;
            var partner = options.partner;
            var outShareInstance = options.outShareInstance;
            var meta = options.meta;
            var effectiveTimeStamp = options.effectiveTimeStamp;
            var sharingEventId = options.sharingEventId;
            var languageCultureCode = partner.languageCultureCode;
            var outSharePartnersLcc = outShareInstance.languageCultureCode;
            var isRealTime = options.isRealTime;
            var orderRefIds = options.orderRefIds;
            var orders = [];
            var err;

            try {
                var conn = await connection.getConnection();

                var response = await OutSharing.manipulateGetShareItemQuery({shareItemIds: shareItemIds});
                debug('response', response);

                if (isRealTime) {
                    var orderQueryResponse = await OutSharing.manipulateGetOrderQuery({list: orderRefIds});
                    orders = await conn.query('SELECT CAST(uuid_from_bin(PR.id) as char) as id,PR.sku,PR.sellerSKUName,' +
                      ' ORI.amazonOrderId,ORI.purchaseDate,OLI.quantityOrdered,OLI.UOMScalId,UN.symbol,UN.name,US.scalingFactor  ' +
                      ' FROM OrderReferenceInformation ORI,OrderLineItems OLI,ProductReferences PR,uomNames UN,uomScaling US  WHERE ' +
                      ' PR.id in (' + response.string + ') AND OLI.productRefId = PR.id AND (' + orderQueryResponse.string + ') AND ' +
                      ' ORI.id = OLI.orderRefId ' +
                      ' AND US.id = OLI.UOMScalId AND ' +
                      ' (UN.uomScalingId = US.id and case  when exists (select 1 from uomNames  where uomScalingId = UN.uomScalingId and languageCultureCode= ? ) then ' +
                      ' UN.languageCultureCode = ? else UN.languageCultureCode = ? END) ',
                      [].concat(response.values).concat(orderQueryResponse.values).concat(languageCultureCode, languageCultureCode, outSharePartnersLcc));
                } else {
                    orders = await conn.query('WITH sharedData AS (' +
                      'SELECT ifnull(MAX(effectiveSharedDateTime),0) AS effectiveSharedDateTime FROM SharedData WHERE outShareInstanceId = uuid_to_bin(?)' +
                      ')' +
                      'SELECT CAST(uuid_from_bin(PR.id) as char) as id,PR.sku,PR.sellerSKUName,' +
                      ' ORI.amazonOrderId,ORI.purchaseDate,OLI.quantityOrdered,OLI.UOMScalId,UN.symbol,UN.name,US.scalingFactor  ' +
                      ' FROM OutShare OS,OrderReferenceInformation ORI,OrderLineItems OLI,ProductReferences PR,uomNames UN,uomScaling US,sharedData SD ' +
                      ' WHERE ' +
                      ' OS.id = uuid_to_bin(?) AND PR.id in (' + response.string + ') AND OLI.productRefId = PR.id AND ORI.id = OLI.orderRefId AND ' +
                      ' ORI.updatedAt > SD.effectiveSharedDateTime AND ORI.updatedAt > OS.actualSharingDate AND US.id = OLI.UOMScalId AND ' +
                      ' (UN.uomScalingId = US.id and case  when exists (select 1 from uomNames  where uomScalingId = UN.uomScalingId and languageCultureCode= ? ) then ' +
                      ' UN.languageCultureCode = ? else UN.languageCultureCode = ? END) ',
                      [outShareInstance.id, outShareInstance.id].concat(response.values).concat(languageCultureCode, languageCultureCode, outSharePartnersLcc));
                }

                if (orders && (orders.length <= 0)) {
                    // store sharing error log
                    var sharingErrorLogOption = {
                        outShareInstanceId: outShareInstance.id,
                        sharingEventId: sharingEventId,
                        inShareId: Constants.DEFAULT_REFERE_ID,
                        failReasonCode: Constants.DATA_SHARING_FAIL_REASON_CODE.SHARE_ITEM_NOT_FOUND.CODE,
                        errorMessage: Constants.DATA_SHARING_FAIL_REASON_CODE.SHARE_ITEM_NOT_FOUND.MESSAGE,
                        meta: meta,
                        effectiveTimeStamp: effectiveTimeStamp,
                        createdAt: DataUtils.getEpochMSTimestamp()
                    };
                    var sharingErrorLogResponse = await OutSharing.createSharingErrorLog({
                        sharingErrorLogList: [sharingErrorLogOption]
                    });
                    debug('sharingErrorLogResponse', sharingErrorLogResponse);
                }
                return resolve(orders);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
    * Get dependent demand Orders from the products
    * */
    getOrdersDependentDemand: function (options) {
        return new Promise(async function (resolve, reject) {
            var shareItemIds = options.shareItemIds;
            var partner = options.partner;
            var outShareInstance = options.outShareInstance;
            var meta = options.meta;
            var effectiveTimeStamp = options.effectiveTimeStamp;
            var sharingEventId = options.sharingEventId;
            var isRealTime = options.isRealTime;
            var dependentDemands = options.dependentDemands;
            var languageCultureCode = partner.languageCultureCode;
            var outSharePartnersLcc = outShareInstance.languageCultureCode;
            var orders = [];

            try {
                var conn = await connection.getConnection();

                var response = await OutSharing.manipulateGetShareItemQuery({shareItemIds: shareItemIds});
                debug('response', response);
                debug('dependentDemands', dependentDemands);

                if (isRealTime) {
                    var c = 0;
                    var orderResponse = [];
                    await Promise.each(dependentDemands, async function (dependentDemand) {
                        debug('count =========>', c++);
                        var orderQueryResponse = await OutSharing.manipulateGetOrderQuery({list: dependentDemand.orderRefIds});

                        orders = await conn.query('SELECT CAST(uuid_from_bin(PR.id) as char) as productRefId,' +
                          ' CAST(uuid_from_bin(SIT.id) as char) as id, PR.sku AS productRefSKU,' +
                          ' PR.sellerSKUName AS productRefSellerSKUName, ORI.amazonOrderId, ORI.purchaseDate, OLI.UOMScalId,' +
                          ' UN.symbol, UN.name, US.scalingFactor, SIT.sku AS supplyItemSKU,SIT.sellerSKUName AS supplyItemSellerSKUName,' +
                          ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(BIT.quantity/CAST(power(10,6) as INTEGER))))) * OLI.quantityOrdered AS quantityOrdered ' +
                          ' FROM OrderReferenceInformation ORI,OrderLineItems OLI,ProductReferences PR,uomNames UN,uomScaling US,' +
                          ' SupplyItems SIT,BillOfMaterial BIT ' +
                          ' WHERE ' +
                          ' BIT.id = uuid_to_bin(?) AND PR.id = uuid_to_bin(?) AND SIT.id = uuid_to_bin(?) AND ' +
                          ' OLI.productRefId = PR.id AND (' + orderQueryResponse.string + ') AND ORI.id = OLI.orderRefId ' +
                          ' AND US.id = OLI.UOMScalId AND (UN.uomScalingId = US.id and case when exists (select 1 from uomNames  WHERE ' +
                          ' uomScalingId = UN.uomScalingId and languageCultureCode = ? ) then ' +
                          ' UN.languageCultureCode = ? else UN.languageCultureCode = ? END)',
                          [dependentDemand.bomId, dependentDemand.productRefId, dependentDemand.supplyItemId].concat(orderQueryResponse.values).concat(languageCultureCode, languageCultureCode, outSharePartnersLcc));
                        if (orders && DataUtils.isArray(orders)) {
                            orderResponse = orderResponse.concat(orders);
                        }
                        /*orders = await conn.query('SELECT CAST(uuid_from_bin(DD.id) as char) as id,PR.sku AS productRefSKU,' +
                          ' PR.sellerSKUName AS productRefSellerSKUName, ORI.amazonOrderId, ORI.purchaseDate, OLI.UOMScalId,' +
                          ' UN.symbol, UN.name, US.scalingFactor, SIT.sku AS supplyItemSKU,SIT.sellerSKUName AS supplyItemSellerSKUName,' +
                          ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(BIT.quantity/CAST(power(10,6) as INTEGER))))) * OLI.quantityOrdered AS quantityOrdered ' +
                          ' FROM OrderReferenceInformation ORI,OrderLineItems OLI,ProductReferences PR,uomNames UN,uomScaling US,' +
                          ' SupplyItems SIT,DependentDemands DD,BillOfMaterial BIT ' +
                          ' WHERE ' +
                          ' DD.id in (' + response.string + ') AND PR.id = DD.productRefId AND SIT.id = DD.supplyItemId AND ' +
                          ' OLI.productRefId = PR.id AND (' + orderQueryResponse.string + ') AND ORI.id = OLI.orderRefId  AND US.id = OLI.UOMScalId ' +
                          ' AND BIT.productRefId = DD.productRefId AND BIT.supplyItemId = DD.supplyItemId AND BIT.effectiveToDateTime=? AND ' +
                          ' (UN.uomScalingId = US.id and case  when exists (select 1 from uomNames  where ' +
                          ' uomScalingId = UN.uomScalingId and languageCultureCode= ? ) then ' +
                          ' UN.languageCultureCode = ? else UN.languageCultureCode = ? END)',
                          [].concat(response.values).concat(orderQueryResponse.values).concat(Constants.DEFAULT_DATE, languageCultureCode, languageCultureCode, outSharePartnersLcc));*/
                    });
                    orders = orderResponse;

                } else {
                    orders = await conn.query('WITH sharedData AS (' +
                      ' SELECT ifnull(MAX(effectiveSharedDateTime),0) AS effectiveSharedDateTime FROM SharedData WHERE outShareInstanceId = uuid_to_bin(?)' +
                      ' )' +
                      ' SELECT CAST(uuid_from_bin(BOM.supplyItemId) as char) as id,PR.sku AS productRefSKU,' +
                      ' PR.sellerSKUName AS productRefSellerSKUName,ORI.amazonOrderId, ORI.purchaseDate,SIT.sku AS supplyItemSKU,SIT.sellerSKUName AS supplyItemSellerSKUName, ' +
                      ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(BOM.quantity/CAST(power(10,6) as INTEGER))))) * OLI.quantityOrdered AS quantityOrdered,' +
                      ' OLI.UOMScalId,UN.symbol,UN.name,US.scalingFactor ' +
                      ' FROM OutShare OS, OutShareItems OSI, BillOfMaterial BOM,OrderReferenceInformation ORI, OrderLineItems ' +
                      ' OLI,ProductReferences PR,SupplyItems SIT,sharedData SD,uomNames UN,uomScaling US WHERE ' +
                      ' OS.id = uuid_to_bin(?) AND OSI.outShareInstanceId = OS.id AND BOM.supplyItemId = OSI.shareItemId AND ' +
                      ' PR.id = BOM.productRefId AND SIT.id = BOM.supplyItemId AND' +
                      ' BOM.effectiveToDateTime = 0 AND OLI.productRefId = BOM.productRefId AND OLI.orderRefId = ORI.id AND ' +
                      ' ORI.updatedAt > SD.effectiveSharedDateTime AND ORI.updatedAt > OS.actualSharingDate AND US.id = OLI.UOMScalId AND ' +
                      ' (UN.uomScalingId = US.id and case  when exists (select 1 from uomNames  where uomScalingId = UN.uomScalingId ' +
                      ' and languageCultureCode= ? ) then UN.languageCultureCode = ? else UN.languageCultureCode = ? END) ',
                      [outShareInstance.id, outShareInstance.id, languageCultureCode, languageCultureCode, outSharePartnersLcc]);
                }
                /*orders = await conn.query('SELECT CAST(uuid_from_bin(PR.id) as char) as id,PR.sku,PR.sellerSKUName,' +
                  ' ORI.amazonOrderId,ORI.purchaseDate,OLI.quantityOrdered,OLI.UOMScalId,UN.symbol,UN.name,US.scalingFactor  ' +
                  ' FROM OrderReferenceInformation ORI,OrderLineItems OLI,ProductReferences PR,uomNames UN,uomScaling US  WHERE ' +
                  ' PR.id in (' + response.string + ') AND OLI.productRefId = PR.id AND ORI.id = OLI.orderRefId ' +
                  ' AND US.id = OLI.UOMScalId AND ' +
                  ' (UN.uomScalingId = US.id and case  when exists (select 1 from uomNames  where uomScalingId = UN.uomScalingId and languageCultureCode= ? ) then ' +
                  ' UN.languageCultureCode = ? else UN.languageCultureCode = ? END) ',
                  [].concat(response.values).concat(languageCultureCode, languageCultureCode, outSharePartnersLcc));*/

                if (orders && (orders.length <= 0)) {
                    // store sharing error log
                    var sharingErrorLogOption = {
                        outShareInstanceId: outShareInstance.id,
                        sharingEventId: sharingEventId,
                        inShareId: Constants.DEFAULT_REFERE_ID,
                        failReasonCode: Constants.DATA_SHARING_FAIL_REASON_CODE.SHARE_ITEM_NOT_FOUND.CODE,
                        errorMessage: Constants.DATA_SHARING_FAIL_REASON_CODE.SHARE_ITEM_NOT_FOUND.MESSAGE,
                        meta: meta,
                        effectiveTimeStamp: effectiveTimeStamp,
                        createdAt: DataUtils.getEpochMSTimestamp()
                    };
                    var sharingErrorLogResponse = await OutSharing.createSharingErrorLog({
                        sharingErrorLogList: [sharingErrorLogOption]
                    });
                    debug('sharingErrorLogResponse', sharingErrorLogResponse);
                }
                return resolve(orders);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
    * Get products from the supplyItemId
    * */

    /*
    * Call getShareItems by itemIds function accoring to shareItemType
    * */
    getShareItemDetail: function (options) {
        return new Promise(async function (resolve, reject) {
            var shareItemIds = options.shareItemIds;
            var partner = options.partner;
            var shareItemType = options.shareItemType;
            var outShareInstance = options.outShareInstance;
            var meta = options.meta;
            var effectiveTimeStamp = options.effectiveTimeStamp;
            var sharingEventId = options.sharingEventId;
            var isRealTime = options.isRealTime;
            var orderRefIds = options.orderRefIds;
            var dependentDemands = options.dependentDemands;
            var shareItems = [];

            try {

                if (shareItemType === Constants.SHARING_TYPE.productInventory) {
                    shareItems = await OutSharing.getProductInventoryByID({
                        shareItemIds: shareItemIds,
                        outShareInstance: outShareInstance,
                        partner: partner,
                        sharingEventId: sharingEventId,
                        effectiveTimeStamp: effectiveTimeStamp,
                        meta: meta
                    });
                } else if (shareItemType === Constants.SHARING_TYPE.supplyInventory) {
                    shareItems = await OutSharing.getSupplyInventoryByID({
                        shareItemIds: shareItemIds,
                        outShareInstance: outShareInstance,
                        partner: partner,
                        sharingEventId: sharingEventId,
                        effectiveTimeStamp: effectiveTimeStamp,
                        meta: meta
                    });
                } else if (shareItemType === Constants.SHARING_TYPE.productOrder) {
                    debug('Inside the product order if');
                    shareItems = await OutSharing.getOrdersFromProductRefId({
                        shareItemIds: shareItemIds,
                        outShareInstance: outShareInstance,
                        partner: partner,
                        sharingEventId: sharingEventId,
                        effectiveTimeStamp: effectiveTimeStamp,
                        meta: meta,
                        orderRefIds: orderRefIds,
                        isRealTime: isRealTime
                    });
                } else if (shareItemType === Constants.SHARING_TYPE.dependentDemand) {
                    debug('Inside the product order if');
                    shareItems = await OutSharing.getOrdersDependentDemand({
                        shareItemIds: shareItemIds,
                        outShareInstance: outShareInstance,
                        partner: partner,
                        sharingEventId: sharingEventId,
                        effectiveTimeStamp: effectiveTimeStamp,
                        meta: meta,
                        dependentDemands: dependentDemands,
                        isRealTime: isRealTime
                    });
                }

                return resolve(shareItems);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.SHARE_ITEM_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
    * Get default (SF = 1) of category by uom Id
    * */
    getDefaultUoM: function (options) {
        return new Promise(async function (resolve, reject) {
            debug('options', options);
            var uomId = options.uomId;
            var languageCultureCode = options.languageCultureCode;

            try {
                var conn = await connection.getConnection();
                var defaultUoM = await conn.query('SELECT US2.id,US2.scalingFactor,UN.symbol,UN.name FROM uomScaling US1,' +
                  ' uomScaling US2,uomNames UN WHERE US1.id = ? AND US2.categoryId = US1.categoryId AND US2.scalingFactor = 1 ' +
                  ' AND UN.uomScalingId = US2.id AND UN.languageCultureCode = ? ', [uomId, languageCultureCode]);
                defaultUoM = Utils.filteredResponsePool(defaultUoM);
                return resolve(defaultUoM);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
    * get object of sharedItem according to shareItem
    * */
    getObjectForSharedItem: function (options) {
        return new Promise(async function (resolve, reject) {
            var shareItemType = options.shareItemType;
            var shareItem = options.shareItem;
            var partner = options.partner;
            var languageCultureCode = partner.languageCultureCode;
            var sharedDataItems = options.sharedDataItems;
            var shareItemObject = {}, defaultUoM;
            var sharedDataItemsArray = sharedDataItems.split(',');
            var uomId;
            debug('shareItem', shareItem);

            if (shareItemType === Constants.SHARING_TYPE.productInventory) {
                if (sharedDataItemsArray.indexOf('1') !== -1) {
                    shareItemObject.qtyOnHand = shareItem.qtyOnHand;
                    //shareItemObject.qtyOnHandUoM = shareItem.qtyOnHandUoM;
                    shareItemObject.qtyOnHandUOMName = shareItem.qtyOnHandUOMName;
                    shareItemObject.qtyOnHandUOMSymbol = shareItem.qtyOnHandUOMSymbol;
                    shareItemObject.qtyOnHandUoMScalingFactor = shareItem.qtyOnHandUoMScalingFactor;
                    uomId = shareItem.qtyOnHandUOM;
                } else {
                    shareItemObject.qtyOnHand = 0;
                    //shareItemObject.qtyOnHandUoM = 0;
                    shareItemObject.qtyOnHandUOMName = '';
                    shareItemObject.qtyOnHandUOMSymbol = '';
                    shareItemObject.qtyOnHandUoMScalingFactor = 0;
                }
                if (sharedDataItemsArray.indexOf('4') !== -1) {
                    shareItemObject.qtyOnOrder = shareItem.qtyOnOrder;
                    //shareItemObject.qtyOnOrderUoM = shareItem.qtyOnOrderUoM;
                    shareItemObject.qtyOnOrderUOMName = shareItem.qtyOnOrderUOMName;
                    shareItemObject.qtyOnOrderUOMSymbol = shareItem.qtyOnOrderUOMSymbol;
                    shareItemObject.qtyOnOrderUoMScalingFactor = shareItem.qtyOnOrderUoMScalingFactor;
                    uomId = shareItem.qtyOnOrderUOM;
                } else {
                    shareItemObject.qtyOnOrder = 0;
                    //shareItemObject.qtyOnOrderUoM = 0;
                    shareItemObject.qtyOnOrderUOMName = '';
                    shareItemObject.qtyOnOrderUOMSymbol = '';
                    shareItemObject.qtyOnOrderUoMScalingFactor = 0;
                }
                if (sharedDataItemsArray.indexOf('5') !== -1) {
                    shareItemObject.qtyAvailable = shareItem.qtyAvailable;
                    //shareItemObject.qtyAvailableUoM = shareItem.qtyAvailableUoM;
                    shareItemObject.qtyAvailableUOMName = shareItem.qtyAvailableUOMName;
                    shareItemObject.qtyAvailableUOMSymbol = shareItem.qtyAvailableUOMSymbol;
                    shareItemObject.qtyAvailableUoMScalingFactor = shareItem.qtyAvailableUoMScalingFactor;
                    uomId = shareItem.qtyAvailableUOM;
                } else {
                    shareItemObject.qtyAvailable = 0;
                    //shareItemObject.qtyAvailableUoM = 0;
                    shareItemObject.qtyAvailableUOMName = '';
                    shareItemObject.qtyAvailableUOMSymbol = '';
                    shareItemObject.qtyAvailableUoMScalingFactor = 0;
                }
            } else if (shareItemType === Constants.SHARING_TYPE.supplyInventory) {
                if (sharedDataItemsArray.indexOf('1') !== -1) {
                    debug('Inside 123');
                    shareItemObject.qtyOnHand = shareItem.qtyOnHand;
                    //shareItemObject.qtyOnHandUoM = shareItem.qtyOnHandUoM;
                    shareItemObject.qtyOnHandUOMName = shareItem.qtyOnHandUOMName;
                    shareItemObject.qtyOnHandUOMSymbol = shareItem.qtyOnHandUOMSymbol;
                    shareItemObject.qtyOnHandUoMScalingFactor = shareItem.qtyOnHandUoMScalingFactor;
                    uomId = shareItem.qtyOnHandUoM;
                } else {

                    shareItemObject.qtyOnHand = 0;
                    //shareItemObject.qtyOnHandUoM = 0;
                    shareItemObject.qtyOnHandUOMName = '';
                    shareItemObject.qtyOnHandUOMSymbol = '';
                    shareItemObject.qtyOnHandUoMScalingFactor = 0;
                }
                if (sharedDataItemsArray.indexOf('2') !== -1) {
                    shareItemObject.qtyInTransit = shareItem.qtyInTransit;
                    //shareItemObject.qtyOnOrderUoM = shareItem.qtyOnOrderUoM;
                    shareItemObject.qtyInTransitUOMName = shareItem.qtyInTransitUOMName;
                    shareItemObject.qtyInTransitUOMSymbol = shareItem.qtyInTransitUOMSymbol;
                    shareItemObject.qtyInTransitUoMScalingFactor = shareItem.qtyInTransitUoMScalingFactor;
                    uomId = shareItem.qtyInTransitUOM;
                } else {
                    shareItemObject.qtyInTransit = 0;
                    //shareItemObject.qtyOnOrderUoM = shareItem.qtyOnOrderUoM;
                    shareItemObject.qtyInTransitUOMName = '';
                    shareItemObject.qtyInTransitUOMSymbol = '';
                    shareItemObject.qtyInTransitUoMScalingFactor = 0;
                }
                if (sharedDataItemsArray.indexOf('4') !== -1) {
                    shareItemObject.qtyOnOrder = shareItem.qtyOnOrder;
                    //shareItemObject.qtyOnOrderUoM = shareItem.qtyOnOrderUoM;
                    shareItemObject.qtyOnOrderUOMName = shareItem.qtyOnOrderUOMName;
                    shareItemObject.qtyOnOrderUOMSymbol = shareItem.qtyOnOrderUOMSymbol;
                    shareItemObject.qtyOnOrderUoMScalingFactor = shareItem.qtyOnOrderUoMScalingFactor;
                    uomId = shareItem.qtyOnOrderUoM;
                } else {
                    shareItemObject.qtyOnOrder = 0;
                    //shareItemObject.qtyOnOrderUoM = 0;
                    shareItemObject.qtyOnOrderUOMName = '';
                    shareItemObject.qtyOnOrderUOMSymbol = '';
                    shareItemObject.qtyOnOrderUoMScalingFactor = 0;
                }
            } else if (shareItemType === Constants.SHARING_TYPE.productOrder) {
                if (sharedDataItemsArray.indexOf('3') !== -1) {
                    debug('Inside 123');
                    shareItemObject.quantityOrdered = shareItem.quantityOrdered;
                    shareItemObject.quantityOrderedUoMSymbol = shareItem.symbol;
                    shareItemObject.quantityOrderedUoMName = shareItem.name;
                    shareItemObject.quantityOrderedUoMScalingFactor = shareItem.scalingFactor;
                    uomId = shareItem.UOMScalId;
                } else {
                    shareItemObject.quantityOrdered = 0;
                    shareItemObject.quantityOrderedUoMSymbol = '';
                    shareItemObject.quantityOrderedUoMName = '';
                    shareItemObject.quantityOrderedUoMScalingFactor = 0;
                }
                if (sharedDataItemsArray.indexOf('6') !== -1) {
                    shareItemObject.orderId = shareItem.amazonOrderId;
                    uomId = shareItem.UOMScalId;
                } else {
                    shareItemObject.orderId = '';
                }
                if (sharedDataItemsArray.indexOf('7') !== -1) {
                    shareItemObject.orderTime = shareItem.purchaseDate;
                    uomId = shareItem.UOMScalId;
                } else {
                    shareItemObject.orderTime = 0;
                }
            } else if (shareItemType === Constants.SHARING_TYPE.dependentDemand) {
                if (sharedDataItemsArray.indexOf('3') !== -1) {
                    debug('Inside 123');
                    shareItemObject.quantityOrdered = shareItem.quantityOrdered;
                    shareItemObject.quantityOrderedUoMSymbol = shareItem.symbol;
                    shareItemObject.quantityOrderedUoMName = shareItem.name;
                    shareItemObject.quantityOrderedUoMScalingFactor = shareItem.scalingFactor;
                    uomId = shareItem.UOMScalId;
                } else {
                    shareItemObject.quantityOrdered = 0;
                    shareItemObject.quantityOrderedUoMSymbol = '';
                    shareItemObject.quantityOrderedUoMName = '';
                    shareItemObject.quantityOrderedUoMScalingFactor = 0;
                }
                if (sharedDataItemsArray.indexOf('6') !== -1) {
                    shareItemObject.orderId = shareItem.amazonOrderId;
                    uomId = shareItem.UOMScalId;
                } else {
                    shareItemObject.orderId = '';
                }
                if (sharedDataItemsArray.indexOf('7') !== -1) {
                    shareItemObject.orderTime = shareItem.purchaseDate;
                    uomId = shareItem.UOMScalId;
                } else {
                    shareItemObject.orderTime = 0;
                }
            }

            // get default uom
            defaultUoM = await OutSharing.getDefaultUoM({
                uomId: uomId,
                languageCultureCode: languageCultureCode
            });

            shareItemObject.defaultUOMName = defaultUoM.name;
            shareItemObject.defaultUOMSymbol = defaultUoM.symbol;
            shareItemObject.defaultUoMScalingFactor = defaultUoM.scalingFactor;
            return resolve(shareItemObject);
        });
    },

    /*
    * Create multiple shared data record for productInventory
    * */
    createProductInventoryShareData: function (options) {
        return new Promise(async function (resolve, reject) {
            var sharedDataList = options.sharedDataList;
            var outShareInstanceId = options.outShareInstanceId;
            var meta = options.meta;
            var sharingEventId = options.sharingEventId;
            var query, values;

            var convertedsharedDataList, keys, err;
            await Utils.convertObjectToArrayMD(sharedDataList, async function (err, response) {
                if (err) {
                    debug('err', err);
                    return reject(err);
                }
                convertedsharedDataList = response.list;
                keys = response.keys;

                query = 'insert into SharedData (' + keys + ') values';
                values = ' (uuid_to_bin(?), uuid_to_bin(?),uuid_to_bin(?),uuid_to_bin(?),uuid_to_bin(?),uuid_to_bin(?),?,?,?,?,?,?) ';

                await Promise.each(sharedDataList, function (value) {
                    query = query + values;
                    query = query + ',';
                });

                query = query.replace(/,\s*$/, '');

                try {
                    var conn = await connection.getConnection();
                    var sharedDataInserted = await conn.query(query, convertedsharedDataList);
                    sharedDataInserted = Utils.isAffectedPool(sharedDataInserted);
                    debug('SharedDataInserted-----------------------------------------', sharedDataInserted);
                    if (!sharedDataInserted) {
                        // store sharing error log
                        var sharingErrorLogOption = {
                            outShareInstanceId: outShareInstanceId,
                            sharingEventId: sharingEventId,
                            inShareId: Constants.DEFAULT_REFERE_ID,
                            failReasonCode: Constants.DATA_SHARING_FAIL_REASON_CODE.SHARED_DATA_CREATE_FAILED.CODE,
                            errorMessage: Constants.DATA_SHARING_FAIL_REASON_CODE.SHARED_DATA_CREATE_FAILED.MESSAGE,
                            meta: meta,
                            createdAt: DataUtils.getEpochMSTimestamp()
                        };
                        var sharingErrorLogResponse = await OutSharing.createSharingErrorLog({
                            sharingErrorLogList: [sharingErrorLogOption]
                        });
                        //debug('sharingErrorLogResponse', sharingErrorLogResponse);
                        throw err;
                    }
                    return resolve(Constants.OK_MESSAGE);
                } catch (err) {
                    debug('err ', err);
                    err = new Error(ErrorConfig.MESSAGE.CREATE_SHARED_DATA_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
            });
        });
    },

    /*
    * call function for create share data according to shareItemType
    * */
    createShareDataRecords: function (options) {
        return new Promise(async function (resolve, reject) {
            var shareItemType = options.shareItemType;
            var sharedDataList = options.sharedDataList;
            var sharingEventId = options.sharingEventId;
            var outShareInstanceId = options.outShareInstanceId;
            var meta = options.meta;
            var response;

            try {
                if (shareItemType === Constants.SHARING_TYPE.productInventory || shareItemType === Constants.SHARING_TYPE.supplyInventory ||
                  shareItemType === Constants.SHARING_TYPE.productOrder || shareItemType === Constants.SHARING_TYPE.dependentDemand) {
                    response = await OutSharing.createProductInventoryShareData({
                        sharedDataList: sharedDataList,
                        outShareInstanceId: outShareInstanceId,
                        meta: meta,
                        sharingEventId: sharingEventId
                    });
                }
                return resolve(response);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.CREATE_SHARED_DATA_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }

        });
    },

    /*
    * build query string for get public key query
    * */
    manipulateGetPublicKeyQuery: function (options) {
        return new Promise(function (resolve, reject) {
            var inSharePartners = options.inSharePartners;
            var string = '', values = [];

            _.map(inSharePartners, function (inSharePartner) {
                string += 'uuid_to_bin(?),';
                values.push(inSharePartner.inSharePartnerId);
            });
            string = string.replace(/,\s*$/, ' ');
            return resolve({
                string: string,
                values: values
            });
        });
    },

    /*
    * Get public key from accounts table by partnerId or accountId
    * */
    getPartnerKeys: function (options) {
        return new Promise(async function (resolve, reject) {
            var inSharePartners = options.inSharePartners;
            var outShareInstanceId = options.outShareInstanceId;
            var meta = options.meta;
            var sharingEventId = options.sharingEventId;
            var effectiveTimeStamp = options.effectiveTimeStamp;
            var tempArray, partners;

            try {
                var conn = await connection.getConnection();

                var queryResponse = await OutSharing.manipulateGetPublicKeyQuery({inSharePartners: inSharePartners});

                partners = await conn.query('select CAST(uuid_from_bin(id) as char) as inSharePartnerId,publicKey,languageCultureCode from accounts where encryptionStatus = 1 and ' +
                  'id in (' + queryResponse.string + ')', queryResponse.values);


                if (partners.length <= 0 || inSharePartners.length !== partners.length) {
                    var sharingErrorLogOption = {
                        outShareInstanceId: outShareInstanceId,
                        sharingEventId: sharingEventId,
                        inShareId: Constants.DEFAULT_REFERE_ID,
                        failReasonCode: Constants.DATA_SHARING_FAIL_REASON_CODE.SHARE_PARTNER_NOT_FOUND.CODE,
                        errorMessage: Constants.DATA_SHARING_FAIL_REASON_CODE.SHARE_PARTNER_NOT_FOUND.MESSAGE,
                        meta: meta,
                        effectiveTimeStamp: effectiveTimeStamp,
                        createdAt: DataUtils.getEpochMSTimestamp()
                    };
                    var sharingErrorLogResponse = await OutSharing.createSharingErrorLog({
                        sharingErrorLogList: [sharingErrorLogOption]
                    });
                }
                /*if (encryptionPartner.length > 0) {
                    debug('Inside if');
                    tempArray = _.map(encryptionPartner, function (inSharePartner) {
                        return inSharePartner.inSharePartnerId;
                    });
                    debug('tempArray', tempArray);
                    _.map(inSharePartners, function (inSharePartner) {
                        if (tempArray.indexOf(inSharePartner.inSharePartnerId) === -1) {
                            debug('inside innner if', inSharePartner.inSharePartnerId);
                            unEncryptionPartner.push({
                                inSharePartnerId: inSharePartner.inSharePartnerId
                            });
                        }
                    });
                } else {
                    debug('Inside else');
                    unEncryptionPartner = inSharePartners;
                }*/

                return resolve(partners);

            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.PUBLIC_KEY_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
    * check if outshare partner  has encryption or not
    * */
    getOutSharePartnerWithNoEncryption: function (options) {
        return new Promise(async function (resolve, reject) {
            var outSharePartnerId = options.outSharePartnerId;
            var partners;

            try {
                var conn = await connection.getConnection();

                partners = await conn.query('SELECT CAST(uuid_from_bin(id) as char) as outSharePartnerId  ' +
                  'FROM accounts  WHERE encryptionStatus = 0 and id = uuid_to_bin(?) ', [outSharePartnerId]);
                //debug('partners', partners);

                return resolve(partners);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.IN_PARTNER_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
    * Get public key from accounts table by partnerId or accountId
    * */
    getPartnerWithNoEncryptionSetup: function (options) {
        return new Promise(async function (resolve, reject) {
            var inSharePartners = options.partners;
            var outShareInstanceId = options.outShareInstanceId;
            var partners;

            try {
                var conn = await connection.getConnection();

                var queryResponse = await OutSharing.manipulateGetPublicKeyQuery({inSharePartners: inSharePartners});
                //debug('queryResposne', queryResponse);

                partners = await conn.query('SELECT CAST(uuid_from_bin(I.accountId) as char) as inSharePartnerId  ,CAST(uuid_from_bin(I.id) as char) as inShareId ' +
                  'FROM accounts A, InShare I WHERE A.encryptionStatus = 0 and A.id = I.accountId  and ' +
                  'I.outShareInstanceId = uuid_to_bin(?) and I.accountId IN (' + queryResponse.string + ')', [outShareInstanceId].concat(queryResponse.values));

                //debug('partners', partners);

                return resolve(partners);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.IN_PARTNER_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    generateKey: function (options) {
        return new Promise(function (resolve, reject) {
            var length = options.length;
            var text = '';
            var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            _.times(length, function () {
                text += possible.charAt(Math.floor(Math.random() * possible.length));
            });
            return resolve(text);
        });
    },

    encryptStringWithRsaPublicKey: function (options) {
        return new Promise(function (resolve, reject) {
            try {
                var publicKey = options.publicKey;
                debug('public key', publicKey);
                var buffer = Buffer.from(options.toEncrypt);
                debug(buffer);
                var encrypted = crypto.publicEncrypt(publicKey, buffer);
                debug('encrypted', encrypted);
                var data = encrypted.toString('base64');
                return resolve(data);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
    * Give partners according to data protection options
    * */
    encryptData: function (options) {
        return new Promise(async function (resolve, reject) {
            var data = options.data;
            var publicKey = options.publicKey;
            var outShareInstanceId = options.outShareInstanceId;
            var meta = options.meta;
            var effectiveTimeStamp = options.effectiveTimeStamp;
            var sharingEventId = options.sharingEventId;
            var inShareId = options.inShareId;
            var encryptedData;
            var mode = Constants.DEFAULT_ENCRYPTION_MODE;
            var err;

            try {
                var password = await OutSharing.generateKey({length: 16});
                debug('password', password);

                var ciphertext = sjcl.encrypt(password, JSON.stringify(data), {mode: mode});
                debug('ciphertext', ciphertext);

                var encryptionOptions = {
                    toEncrypt: password,
                    publicKey: publicKey
                };

                var encryptedPassword = await OutSharing.encryptStringWithRsaPublicKey(encryptionOptions);

                // Parse JSON data
                var encData = JSON.parse(ciphertext);
                encData.pw = encryptedPassword;
                // Append password to encrypted Object
                var dataToBeStored = JSON.stringify(encData);

                debug('data', dataToBeStored);

                /*const options = {
                    message: openpgp.message.fromText(JSON.stringify(data)),
                    publicKeys: (await openpgp.key.readArmored(publicKey)).keys
                };
                var encryptedData = await openpgp.encrypt(options);*/
                if (!dataToBeStored) {
                    // STORE SHARING ERROR LOG
                    var sharingErrorLogOption = {
                        outShareInstanceId: outShareInstanceId,
                        sharingEventId: sharingEventId,
                        inShareId: inShareId || '',
                        failReasonCode: Constants.DATA_SHARING_FAIL_REASON_CODE.ENCRYPTION_FAILED.CODE,
                        errorMessage: Constants.DATA_SHARING_FAIL_REASON_CODE.ENCRYPTION_FAILED.MESSAGE,
                        meta: meta,
                        effectiveTimeStamp: effectiveTimeStamp,
                        createdAt: DataUtils.getEpochMSTimestamp()
                    };
                    var sharingErrorLogResponse = await OutSharing.createSharingErrorLog({
                        sharingErrorLogList: [sharingErrorLogOption]
                    });
                    //debug('sharingErrorLogResponse', sharingErrorLogResponse);

                    err = new Error(ErrorConfig.MESSAGE.ENCRYPTION_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
                encryptedData = dataToBeStored;

                return resolve(encryptedData);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.ENCRYPTION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
    * Generate hash from of the actual data object
    * */
    generateHash: function (options) {
        return new Promise(async function (resolve, reject) {
            var data = options.data;
            var meta = options.meta;
            var effectiveTimeStamp = options.effectiveTimeStamp;
            var sharingEventId = options.sharingEventId;
            var outShareInstanceId = options.outShareInstanceId;
            var partner = options.partner;

            try {
                const hash = crypto.createHash('sha256');
                data = JSON.stringify(data);
                var generatedhash = hash.update(data, 'utf-8').digest('hex');

                if (!generatedhash) {
                    // STORE SHARING ERROR LOG
                    var sharingErrorLogOption = {
                        outShareInstanceId: outShareInstanceId,
                        sharingEventId: sharingEventId,
                        inShareId: partner.inShareId,
                        failReasonCode: Constants.DATA_SHARING_FAIL_REASON_CODE.HASH_GENERATE_FAILED.CODE,
                        errorMessage: Constants.DATA_SHARING_FAIL_REASON_CODE.HASH_GENERATE_FAILED.MESSAGE,
                        meta: meta,
                        effectiveTimeStamp: effectiveTimeStamp,
                        createdAt: DataUtils.getEpochMSTimestamp()
                    };
                    var sharingErrorLogResponse = await OutSharing.createSharingErrorLog({
                        sharingErrorLogList: [sharingErrorLogOption]
                    });
                    //debug('sharingErrorLogResponse', sharingErrorLogResponse);
                }
                return resolve(generatedhash);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.HASH_GENERATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
    * Create sharing error log record
    * */
    createSharingErrorLog: function (options) {
        return new Promise(async function (resolve, reject) {
            var sharingErrorLogList = options.sharingErrorLogList;
            var query, values;

            var convertedsharingErrorLogList, keys, err;
            await Utils.convertObjectToArrayMD(sharingErrorLogList, async function (err, response) {
                if (err) {
                    debug('err', err);
                    return reject(err);
                }
                convertedsharingErrorLogList = response.list;
                keys = response.keys;

                query = 'insert into SharingErrorLog (' + keys + ') values';
                values = ' (uuid_to_bin(?), uuid_to_bin(?),uuid_to_bin(?),?,?,?,?,?) ';


                await Promise.each(sharingErrorLogList, function (value) {
                    query = query + values;
                    query = query + ',';
                });

                query = query.replace(/,\s*$/, '');

                //debug('query', query);
                //debug('convertedsharingErrorLogList', convertedsharingErrorLogList);

                try {
                    var conn = await connection.getConnection();
                    var sharingErrorLogInserted = await conn.query(query, convertedsharingErrorLogList);
                    sharingErrorLogInserted = Utils.isAffectedPool(sharingErrorLogInserted);
                    //debug('sharingErrorLogInserted-----------------------------------------', sharingErrorLogInserted);
                    if (!sharingErrorLogInserted) {
                        throw err;
                    }
                    return resolve(Constants.OK_MESSAGE);
                } catch (err) {
                    debug('err ', err);
                    err = new Error(ErrorConfig.MESSAGE.CREATE_SHARED_ERROR_LOG_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
            });
        });
    },

    /*
    * remove or filter partner who dont have encryption setup
    * */
    filterPartner: function (options) {
        return new Promise(function (resolve, reject) {
            var inSharePartners = options.inSharePartners;
            var partnerWithNoEnctyptionSetup = options.partnerWithNoEnctyptionSetup;
            var tempPartner, partnerWithEncryptionSetup = [];

            try {
                tempPartner = _.map(partnerWithNoEnctyptionSetup, 'inSharePartnerId');
                _.map(inSharePartners, function (partner) {
                    if (tempPartner.indexOf(partner.inSharePartnerId) === -1) {
                        partnerWithEncryptionSetup.push(partner);
                    }
                });
                debug('partnerWithEncryptionSetup', partnerWithEncryptionSetup);
                return resolve(partnerWithEncryptionSetup);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
    * Create error log and filter inshare partner records
    * */
    createErrorLogFilterPartner: function (options) {
        return new Promise(async function (resolve, reject) {
            var partnerWithNoEnctyptionSetup = options.partnerWithNoEnctyptionSetup;
            var outShareInstanceId = options.outShareInstanceId;
            var meta = options.meta;
            var sharingEventId = options.sharingEventId;
            var effectiveTimeStamp = options.effectiveTimeStamp;
            var inSharePartners = options.inSharePartners;
            var sharingErrorLogList = [], sharingErrorLogOption;

            try {
                await Promise.each(partnerWithNoEnctyptionSetup, async function (partner) {
                    sharingErrorLogOption = {
                        outShareInstanceId: outShareInstanceId,
                        inShareId: partner.inShareId,
                        sharingEventId: sharingEventId,
                        failReasonCode: Constants.DATA_SHARING_FAIL_REASON_CODE.IN_SHARE_PARTNER_NOT_HAS_ENCRYPTION_SETUP.CODE,
                        errorMessage: Constants.DATA_SHARING_FAIL_REASON_CODE.IN_SHARE_PARTNER_NOT_HAS_ENCRYPTION_SETUP.MESSAGE,
                        meta: meta,
                        effectiveTimeStamp: effectiveTimeStamp,
                        createdAt: DataUtils.getEpochMSTimestamp()
                    };
                    sharingErrorLogList.push(sharingErrorLogOption);
                });

                if (sharingErrorLogList.length > 0) {
                    var createSharingErrorLogResponse = await OutSharing.createSharingErrorLog({sharingErrorLogList: sharingErrorLogList});
                    //debug('createSharingErrorLogResponse', createSharingErrorLogResponse);
                }

                // remove partner which not have encryption set up  (filter)
                var filterOption = {
                    inSharePartners: inSharePartners,
                    partnerWithNoEnctyptionSetup: partnerWithNoEnctyptionSetup
                };
                inSharePartners = await OutSharing.filterPartner(filterOption);

                return resolve(inSharePartners);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
    * get last partner from partner array
    * */
    getLastPartner: function (options) {
        var inSharePartners = options.inSharePartners;
        var lastPartner = inSharePartners[inSharePartners.length - 1];
        //debug('lastPartner', lastPartner);
        return lastPartner;
    },

    /*
    * check if outShare partner has encryption setup or not
    * */
    checkEncryptionSetUpForOutSharePartner: function (options) {
        return new Promise(async function (resolve, reject) {
            var outShareInstance = options.outShareInstance;
            var meta = options.meta;
            var sharingEventId = options.sharingEventId;
            var effectiveTimeStamp = options.effectiveTimeStamp;
            var flag = true;
            var outSharePartner, sharingErrorLogOption, sharingErrorLogResponse;
            var outSharePartnerWithKey, response;

            try {
                var outSharePartnerWithNoEnctyptionSetup = await OutSharing.getOutSharePartnerWithNoEncryption({
                    outSharePartnerId: outShareInstance.accountId
                });
                if (outSharePartnerWithNoEnctyptionSetup.length > 0) {
                    sharingErrorLogOption = {
                        outShareInstanceId: outShareInstance.id,
                        sharingEventId: sharingEventId,
                        inShareId: Constants.DEFAULT_REFERE_ID,
                        failReasonCode: Constants.DATA_SHARING_FAIL_REASON_CODE.OUT_SHARE_PARTNER_NOT_HAS_ENCRYPTION_SETUP.CODE,
                        errorMessage: Constants.DATA_SHARING_FAIL_REASON_CODE.OUT_SHARE_PARTNER_NOT_HAS_ENCRYPTION_SETUP.MESSAGE,
                        meta: meta,
                        effectiveTimeStamp: effectiveTimeStamp,
                        createdAt: DataUtils.getEpochMSTimestamp()
                    };
                    sharingErrorLogResponse = await OutSharing.createSharingErrorLog({
                        sharingErrorLogList: [sharingErrorLogOption]
                    });
                    flag = false;
                    response = {
                        flag: flag
                    };
                    return resolve(response);
                } else {
                    outSharePartner = {
                        inSharePartnerId: outShareInstance.accountId
                    };
                    outSharePartnerWithKey = await OutSharing.getPartnerKeys({
                        inSharePartners: [outSharePartner],
                        outShareInstanceId: outShareInstance.id,
                        sharingEventId: sharingEventId,
                        meta: meta,
                        effectiveTimeStamp: effectiveTimeStamp
                    });
                }
                response = {
                    flag: flag,
                    outSharePartner: outSharePartnerWithKey[0]
                };
                return resolve(response);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
    * merge pubilc key and inShare record
    * */
    mergeKeyWithInShare: function (options) {
        var inSharePartners = options.inSharePartners;
        var inSharePartnersWithKey = options.inSharePartnersWithKey;

        _.map(inSharePartners, function (partner) {
            _.map(inSharePartnersWithKey, function (partnerWithKey) {
                if (partner.inSharePartnerId === partnerWithKey.inSharePartnerId) {
                    partner = Object.assign(partner, partnerWithKey);
                }
            });
        });
        return inSharePartners;
    },

    /*
    * GENERATE CSV FILE FOR SHARED DATA AND STORE TO EFS
    * */
    generateCSVFile: function (options) {
        return new Promise(async function (resolve, reject) {
            var sharedData = options.sharedData;
            var isEncrypted = options.isEncrypted;
            var refereShareId = options.refereShareId;
            var refereShareName = options.refereShareName;
            var shareItemType = options.shareItemType;
            var shareCsvId = options.shareCsvId;
            var accountId = options.accountId;
            var fields;
            var currentTime = DataUtils.getEpochMSTimestamp();
            var fileName = refereShareId + '_' + refereShareName + '_' + currentTime + '.csv';
            var destination = Constants.CSV_DESTINATION;
            var s3FileLocation = 'https://s3.console.aws.amazon.com/s3/object/' + Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET + '/' + accountId + '/' + Constants.S3_FOLDER.SHARED_DATA_CSV;
            var csvString = '', updateLogOption, updateResponse, fileSize;

            try {
                if (isEncrypted) {
                    if (shareItemType === Constants.SHARING_TYPE.productInventory) {
                        fields = Constants.CSV_ENCRYPTED_SHARED_DATA_FIELDS.PRODUCT_INVENTORY;
                    } else if (shareItemType === Constants.SHARING_TYPE.supplyInventory) {
                        fields = Constants.CSV_ENCRYPTED_SHARED_DATA_FIELDS.SUPPLY_INVENTORY;
                    } else if (shareItemType === Constants.SHARING_TYPE.productOrder) {
                        fields = Constants.CSV_ENCRYPTED_SHARED_DATA_FIELDS.PRODUCT_ORDER;
                    } else if (shareItemType === Constants.SHARING_TYPE.dependentDemand) {
                        fields = Constants.CSV_ENCRYPTED_SHARED_DATA_FIELDS.DEPENDENT_DEMAND;
                    }
                } else {
                    if (shareItemType === Constants.SHARING_TYPE.productInventory) {
                        fields = Constants.CSV_UNENCRYPTED_SHARED_DATA_FIELDS.PRODUCT_INVENTORY;
                    } else if (shareItemType === Constants.SHARING_TYPE.supplyInventory) {
                        fields = Constants.CSV_UNENCRYPTED_SHARED_DATA_FIELDS.SUPPLY_INVENTORY;
                    } else if (shareItemType === Constants.SHARING_TYPE.productOrder) {
                        fields = Constants.CSV_UNENCRYPTED_SHARED_DATA_FIELDS.PRODUCT_ORDER;
                    } else if (shareItemType === Constants.SHARING_TYPE.dependentDemand) {
                        debug('It should be inside this condition');
                        fields = Constants.CSV_UNENCRYPTED_SHARED_DATA_FIELDS.DEPENDENT_DEMAND;
                    }
                }
                //build csv string from json
                debug('sharedData', sharedData);
                debug('fields', fields);

                csvString = jsonToCsv(sharedData, {fields, header: true});
                debug('csvString', csvString);

                //Create file
                await fs.writeFileSync(destination + fileName, csvString);

                //Get filesize
                if (fs.existsSync(destination + fileName) === true) {
                    var fileState = fs.statSync(destination + fileName);
                    fileSize = fileState.size;
                }

                updateLogOption = {
                    id: shareCsvId,
                    fileName: fileName,
                    fileSize: fileSize,
                    s3FileLocation: s3FileLocation,
                    effectiveSharedDateTime: currentTime,
                    status: Constants.SHARED_CSV_LOG_STATUS.FILE_GENERATE_SUCCESS
                };
                updateResponse = await OutSharing.updateSharedCsvRecord(updateLogOption);
                debug('updateResponse', updateResponse);

                return resolve({
                    fileName: fileName
                });
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.CSV_FILE_GENERATE_FAIL);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;

                updateLogOption = {
                    id: shareCsvId,
                    status: Constants.SHARED_CSV_LOG_STATUS.FILE_GENERATE_FAIL
                };
                updateResponse = await OutSharing.updateSharedCsvRecord(updateLogOption);
                debug('updateResponse', updateResponse);

                return reject(err);
            }
        });
    },

    /*
    * UPLOAD CSV FILE TO S3 BUCKET
    * */
    uploadFileToS3: async function (options) {
        return new Promise(async function (resolve, reject) {
            var fileName = options.fileName;
            var accountId = options.accountId;
            var shareCsvId = options.shareCsvId;
            var destination = Constants.CSV_DESTINATION;
            var type = Constants.CONTENT_TYPE.TEXT_CSV;
            var s3Destination = accountId + '/' + Constants.S3_FOLDER.SHARED_DATA_CSV;
            var updateLogOption, updateResponse;
            try {
                /*
                * read pdf file
                * */
                fs.readFile(destination + fileName, async function (err, data) {
                    if (err) {
                        debug('err', err);
                        err = new Error(ErrorConfig.MESSAGE.FILE_NOT_FOUND);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;

                        updateLogOption = {
                            id: shareCsvId,
                            status: Constants.SHARED_CSV_LOG_STATUS.UPLOAD_TO_S3_FAIL
                        };
                        updateResponse = await OutSharing.updateSharedCsvRecord(updateLogOption);
                        debug('updateResponse', updateResponse);

                        return reject(err);
                    }
                    var buffer = new Buffer(data, 'binary');

                    /*
                    * Upload pdf to s3 bucket
                    * */
                    debug('s3Destination', s3Destination);
                    S3Utils.putObject(buffer, fileName, type, s3Destination, Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET, '', async function (err, file) {
                        if (err) {
                            debug('err', err);
                            err = new Error(ErrorConfig.MESSAGE.UPLOAD_CSV_FILE_FAILED);
                            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;

                            updateLogOption = {
                                id: shareCsvId,
                                status: Constants.SHARED_CSV_LOG_STATUS.UPLOAD_TO_S3_FAIL
                            };
                            updateResponse = await OutSharing.updateSharedCsvRecord(updateLogOption);
                            debug('updateResponse', updateResponse);

                            return reject(err);
                        }
                        debug('file', file);

                        /*
                        * remove file from EFS
                        * */
                        if (fs.existsSync(destination + fileName) === true) {
                            fs.unlinkSync(destination + fileName);
                        }

                        //UPDATE STATUS OF LOG RECORD
                        updateLogOption = {
                            id: shareCsvId,
                            status: Constants.SHARED_CSV_LOG_STATUS.UPLOAD_TO_S3_SUCCESS
                        };
                        updateResponse = await OutSharing.updateSharedCsvRecord(updateLogOption);
                        debug('updateResponse', updateResponse);

                        return resolve(Constants.OK_MESSAGE);
                    });
                });
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.UPLOAD_CSV_FILE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;

                updateLogOption = {
                    id: shareCsvId,
                    status: Constants.SHARED_CSV_LOG_STATUS.UPLOAD_TO_S3_FAIL
                };
                updateResponse = await OutSharing.updateSharedCsvRecord(updateLogOption);
                debug('updateResponse', updateResponse);

                return reject(err);
            }
        });
    },

    /*
    * CREATE CSV SHARED DATA RECORD
    * */
    createSharedCsvRecord: function (options) {
        return new Promise(async function (resolve, reject) {
            var outShareInstanceId = options.outShareInstanceId;
            var inSharePartnerId = options.inSharePartnerId;
            var inShareId = options.inShareId;
            var id = Utils.generateId().uuid;
            var currentTime = DataUtils.getEpochMSTimestamp();

            try {
                var conn = await connection.getConnection();
                var insertResponse = await conn.query('Insert into SharedCSVFiles set id = uuid_to_bin(?), ' +
                  'outShareInstanceId= uuid_to_bin(?),inSharePartnerId = uuid_to_bin(?),inShareId = uuid_to_bin(?),' +
                  'createdAt=?,updatedAt=?;', [id, outShareInstanceId, inSharePartnerId, inShareId, currentTime, currentTime]);
                insertResponse = Utils.isAffectedPool(insertResponse);
                return resolve({id: id});
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
    * validate Shared CSV object
    * */
    validateSharedCsvFields: function (options) {
        return new Promise(function (resolve, reject) {
            var sharedCsvFields = '';
            var sharedCsvValues = [];

            if (DataUtils.isDefined(options.fileName)) {
                sharedCsvFields += 'fileName=? ,';
                sharedCsvValues.push(options.fileName);
            }
            if (DataUtils.isDefined(options.fileSize)) {
                sharedCsvFields += 'fileSize=? ,';
                sharedCsvValues.push(options.fileSize);
            }
            if (DataUtils.isDefined(options.status)) {
                sharedCsvFields += 'status=? ,';
                sharedCsvValues.push(options.status);
            }
            if (DataUtils.isDefined(options.s3FileLocation)) {
                sharedCsvFields += 's3FileLocation=? ,';
                sharedCsvValues.push(options.s3FileLocation);
            }
            if (DataUtils.isDefined(options.effectiveSharedDateTime)) {
                sharedCsvFields += 'effectiveSharedDateTime=? ,';
                sharedCsvValues.push(options.effectiveSharedDateTime);
            }
            var response = {
                sharedCsvFields: sharedCsvFields,
                sharedCsvValues: sharedCsvValues
            };
            return resolve(response);
        });
    },

    /*
    * Update the Shared CSV record
    * */
    updateSharedCsvRecord: function (options) {
        return new Promise(async function (resolve, reject) {
            var id = options.id;
            var sharedCsvFields = '', sharedCsvValues = [];
            var currentTime = DataUtils.getEpochMSTimestamp();

            try {
                var response = await OutSharing.validateSharedCsvFields(options);
                sharedCsvFields = response.sharedCsvFields;
                sharedCsvValues = response.sharedCsvValues;
                sharedCsvValues.push(currentTime, id);
                var conn = await connection.getConnection();

                var UpdateResponse = await conn.query(' update SharedCSVFiles set ' + sharedCsvFields + ' ' +
                  'updatedAt = ? where id=uuid_to_bin(?); ', sharedCsvValues);
                UpdateResponse = Utils.isAffectedPool(UpdateResponse);
                debug('UpdateResponse', UpdateResponse);
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.UPDATE_SHARED_CSV_LOG_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
    * ACTUAL SHARING FUNCTION
    * */
    createSharedData: async function (options, cb) {
        var shareEvent = options.shareEvent;
        debug('shareEvent', shareEvent);
        var outShareInstance, shareItemIds, inSharePartners, err;
        var sharedDataList = [];
        var createSharedDataOption, isCreated;
        var generatedHash, lastPartner, outSharePartner;
        var flag = true;

        try {
            // GET OUTSHARE INSTANCE
            debug('step 1');
            var outShareInstaceOption = {
                outShareInstanceId: shareEvent.outShareInstanceId
            };
            outShareInstance = await OutSharing.getOutShareById(outShareInstaceOption);


            // GET SHARE ITEMS By OUT_SHARE_INSTANCE_ID
            debug('step 2');
            var shareItemIdsOption = {
                outShareInstanceId: shareEvent.outShareInstanceId
            };
            shareItemIds = await OutSharing.getShareItemsByOutShareId(shareItemIdsOption);


            // GET IN_SHARE_PARTNER_IDs BY OUT_SHARE_INSTANCE_ID
            debug('step 3');
            var inSharePartnerIdsOption = {
                outShareInstanceId: shareEvent.outShareInstanceId,
                sharingEventId: shareEvent.id,
                meta: shareEvent,
                effectiveTimeStamp: shareEvent.nextSharingDate
            };
            inSharePartners = await OutSharing.getInSharePartnersByOutShareId(inSharePartnerIdsOption);

            /*
            * if(){
            *    for UNENCRYPTED data protection type
            * }
            * else{
            *    for ENCRYPTED data protection type
            * }
            * */
            if (outShareInstance.dataProtectionOption === Constants.SHARING_DATA_PROTECTION_OPTION.ENCRYPTED_ONLY ||
              outShareInstance.dataProtectionOption === Constants.SHARING_DATA_PROTECTION_OPTION.ENCRYPTED_AND_SECURED) {

                // Check if outshare partner dont have encryption set up , if have then get keys
                var outSharePartnerCheckOption = {
                    outShareInstance: outShareInstance,
                    meta: shareEvent,
                    effectiveTimeStamp: shareEvent.nextSharingDate,
                    sharingEventId: shareEvent.id
                };
                var outSharePartnerCheckResponse = await OutSharing.checkEncryptionSetUpForOutSharePartner(outSharePartnerCheckOption);
                flag = outSharePartnerCheckResponse.flag;
                outSharePartner = outSharePartnerCheckResponse.outSharePartner;


                // Check if any inshare partner dont have encryption set up
                var partnerWithNoEnctyptionSetup = await OutSharing.getPartnerWithNoEncryptionSetup({
                    partners: inSharePartners,
                    outShareInstanceId: shareEvent.outShareInstanceId
                });

                // create error log for those partner who dont have encryption setup and filter inShare partners
                if (partnerWithNoEnctyptionSetup && partnerWithNoEnctyptionSetup.length > 0) {
                    var createFilterOption = {
                        inSharePartners: inSharePartners,
                        outShareInstanceId: shareEvent.outShareInstanceId,
                        meta: shareEvent,
                        effectiveTimeStamp: shareEvent.nextSharingDate,
                        sharingEventId: shareEvent.id,
                        partnerWithNoEnctyptionSetup: partnerWithNoEnctyptionSetup
                    };
                    inSharePartners = await OutSharing.createErrorLogFilterPartner(createFilterOption);
                }


                // GET public and private keys
                if (inSharePartners.length > 0) {
                    var inSharePartnersWithKey = await OutSharing.getPartnerKeys({
                        inSharePartners: inSharePartners,
                        outShareInstanceId: outShareInstance.id,
                        meta: shareEvent,
                        effectiveTimeStamp: shareEvent.nextSharingDate,
                        sharingEventId: shareEvent.id
                    });

                    // Merge with
                    inSharePartners = OutSharing.mergeKeyWithInShare({
                        inSharePartners: inSharePartners,
                        inSharePartnersWithKey: inSharePartnersWithKey
                    });
                }
            }

            if (inSharePartners.length > 0) {
                lastPartner = OutSharing.getLastPartner({inSharePartners: inSharePartners});
            }

            var shareItems = [];
            debug('inSharePartners', inSharePartners.length);

            var c = 0;
            await Promise.each(inSharePartners, async function (partner) {
                debug('count', c++);
                var csvObjectList = [], csvGenerateFlag = false, csvGenerateObject = {}, sharedObjectForCSV = {};
                var isEncrypted = false, shareCsvId;

                // GET share items from shareItems Ids and also UOM name and symbol as per partners LCC
                var shareItemOption = {
                    shareItemType: outShareInstance.shareItemType,
                    outShareInstance: outShareInstance,
                    partner: partner,
                    shareItemIds: shareItemIds,
                    meta: shareEvent,
                    effectiveTimeStamp: shareEvent.nextSharingDate,
                    sharingEventId: shareEvent.id
                };
                debug('shareItemOption', shareItemOption);
                shareItems = await OutSharing.getShareItemDetail(shareItemOption);
                debug('shareItem ', shareItems);

                // CREATE A SHARED_CSV_FILE RECORD
                if (parseInt(partner.dataDeliveryOption) === Constants.DATA_DELIVERY_OPTION.FILES_ONLY ||
                  parseInt(partner.dataDeliveryOption) === Constants.DATA_DELIVERY_OPTION.ONLINE_AND_FILES) {
                    var createSharedCsvOption = {
                        outShareInstanceId: outShareInstance.id,
                        inSharePartnerId: partner.inSharePartnerId,
                        inShareId: partner.inShareId
                    };
                    var createResponse = await OutSharing.createSharedCsvRecord(createSharedCsvOption);
                    if (createResponse) {
                        shareCsvId = createResponse.id;
                    }
                    debug('createResponse', createResponse);
                }

                await Promise.each(shareItems, async function (shareItem) {
                    var effectiveSharedDateTime = shareEvent.nextSharingDate;
                    var getSharedItemObjectOptions, sharedItemObject, encryptedDataString;

                    var commonsharedDataObject = {
                        id: Utils.generateId().uuid,
                        accountId: outShareInstance.accountId,
                        outShareInstanceId: shareEvent.outShareInstanceId,
                        shareItemId: shareItem.id,
                        inSharePartnerId: partner.inSharePartnerId,
                        inShareId: partner.inShareId,
                        effectiveSharedDateTime: effectiveSharedDateTime,
                        frequency: outShareInstance.freqType,
                        hash: '',
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        updatedAt: DataUtils.getEpochMSTimestamp()
                    };

                    getSharedItemObjectOptions = {
                        shareItem: shareItem,
                        shareItemType: outShareInstance.shareItemType,
                        partner: partner,
                        sharedDataItems: outShareInstance.sharedDataItems
                    };
                    sharedItemObject = await OutSharing.getObjectForSharedItem(getSharedItemObjectOptions);

                    // CONVERT OBJECT INTO CSV STRING
                    sharedItemObject.effectiveSharedDateTime = effectiveSharedDateTime;
                    var convertedObject = await OutSharing.convertObjectToCSV({
                        sharedItemObject: sharedItemObject,
                        shareItemType: outShareInstance.shareItemType
                    });

                    //Object for generate CSV file
                    if (parseInt(partner.dataDeliveryOption) === Constants.DATA_DELIVERY_OPTION.FILES_ONLY ||
                      parseInt(partner.dataDeliveryOption) === Constants.DATA_DELIVERY_OPTION.ONLINE_AND_FILES) {

                        // ADD extraa field which is not in shared record but need to add in csv file
                        if (outShareInstance.shareItemType === Constants.SHARING_TYPE.productInventory) {
                            csvGenerateObject = {};
                        } else if (outShareInstance.shareItemType === Constants.SHARING_TYPE.supplyInventory) {
                            csvGenerateObject = {};
                        } else if (outShareInstance.shareItemType === Constants.SHARING_TYPE.productOrder) {
                            csvGenerateObject = {
                                sku: shareItem.sku,
                                sellerSKUName: shareItem.sellerSKUName
                            };
                        } else if (outShareInstance.shareItemType === Constants.SHARING_TYPE.dependentDemand) {
                            csvGenerateObject = {
                                productRefSKU: shareItem.productRefSKU,
                                productRefSellerSKUName: shareItem.productRefSellerSKUName,
                                supplyItemSKU: shareItem.supplyItemSKU,
                                supplyItemSellerSKUName: shareItem.supplyItemSellerSKUName
                            };
                        }
                        sharedObjectForCSV = Utils.convertMutable(sharedItemObject);
                        csvGenerateFlag = true;
                    }

                    if (outShareInstance.dataProtectionOption === Constants.SHARING_DATA_PROTECTION_OPTION.UNENCRYPTED ||
                      outShareInstance.dataProtectionOption === Constants.SHARING_DATA_PROTECTION_OPTION.ENCRYPTED_IF_SETUP_BY_PARTNER) {

                        /*// COMPRESS THE CSV STRING
                        var compressedData = await OutSharing.compressData({data: convertedObject.data});
                        debug('compressedData ', compressedData);*/

                        //assign csv object with unencrypted string (for generating file)
                        if (csvGenerateFlag) {
                            csvGenerateObject = Object.assign(csvGenerateObject, sharedObjectForCSV);
                            csvObjectList.push(csvGenerateObject);
                        }

                        var sharedData = Object.assign(commonsharedDataObject, convertedObject);
                        sharedDataList.push(sharedData);

                        if (lastPartner.inSharePartnerId === partner.inSharePartnerId) {
                            debug('Inside if');
                            var newSharedData = Utils.convertMutable(sharedData);
                            newSharedData.id = Utils.generateId().uuid;
                            newSharedData.inSharePartnerId = Constants.DEFAULT_REFERE_ID;
                            newSharedData.inShareId = Constants.DEFAULT_REFERE_ID;
                            sharedDataList.push(newSharedData);
                        }
                    } else {
                        isEncrypted = true;
                        // ENCRYPT DATA
                        var encryptionObject = {
                            data: convertedObject,
                            publicKey: partner.publicKey,
                            meta: shareEvent,
                            effectiveTimeStamp: shareEvent.nextSharingDate,
                            outShareInstanceId: outShareInstance.id,
                            inShareId: partner.inShareId,
                            sharingEventId: shareEvent.id
                        };
                        encryptedDataString = await OutSharing.encryptData(encryptionObject);
                        commonsharedDataObject.data = encryptedDataString;

                        //assign csv object with encrypted string (for generating file)
                        if (csvGenerateFlag) {
                            csvGenerateObject.data = encryptedDataString;
                            csvObjectList.push(csvGenerateObject);
                        }

                        //GENERATE HASH
                        if (outShareInstance.dataProtectionOption === Constants.SHARING_DATA_PROTECTION_OPTION.ENCRYPTED_AND_SECURED) {
                            generatedHash = await OutSharing.generateHash({
                                data: sharedItemObject,
                                outShareInstanceId: outShareInstance.id,
                                sharingEventId: shareEvent.id,
                                meta: shareEvent,
                                effectiveTimeStamp: shareEvent.nextSharingDate
                            });
                            commonsharedDataObject.hash = generatedHash;
                        }
                        sharedDataList.push(commonsharedDataObject);

                        // This is for outshare partners
                        if (lastPartner.inSharePartnerId === partner.inSharePartnerId && flag) {
                            debug('Inside if also');
                            var outShareEncryptionObject = {
                                data: convertedObject,
                                publicKey: outSharePartner.publicKey,
                                meta: shareEvent,
                                effectiveTimeStamp: shareEvent.nextSharingDate,
                                sharingEventId: shareEvent.id,
                                outShareInstanceId: outShareInstance.id,
                                inShareId: Constants.DEFAULT_REFERE_ID
                            };
                            encryptedDataString = await OutSharing.encryptData(outShareEncryptionObject);
                            var newCommonsharedDataObject = Utils.convertMutable(commonsharedDataObject);
                            newCommonsharedDataObject.data = encryptedDataString;
                            newCommonsharedDataObject.inSharePartnerId = Constants.DEFAULT_REFERE_ID;
                            newCommonsharedDataObject.id = Utils.generateId().uuid;

                            //GENERATE HASH
                            if (outShareInstance.dataProtectionOption === Constants.SHARING_DATA_PROTECTION_OPTION.ENCRYPTED_AND_SECURED) {
                                generatedHash = await OutSharing.generateHash({
                                    data: sharedItemObject,
                                    outShareInstanceId: outShareInstance.id,
                                    meta: shareEvent,
                                    effectiveTimeStamp: shareEvent.nextSharingDate,
                                    sharingEventId: shareEvent.id
                                });
                                newCommonsharedDataObject.hash = generatedHash;
                            }
                            sharedDataList.push(newCommonsharedDataObject);
                        }
                    }
                });

                // IF partner has csv generate setting then create and upload csv file
                if (csvObjectList.length > 0) {
                    // GENERATE CSV FILE FOR PARTNER AND STORE IT INTO S3 BUCKET
                    var csvOption = {
                        sharedData: csvObjectList,
                        shareItemType: outShareInstance.shareItemType,
                        accountId: partner.inSharePartnerId,
                        refereShareId: partner.inSharingId,
                        refereShareName: partner.inShareName,
                        isEncrypted: isEncrypted,
                        shareCsvId: shareCsvId
                    };
                    debug('csvOption', csvOption);
                    var csvResponse = await OutSharing.generateCSVFile(csvOption);

                    //UPLOAD CSV FILE TO S# BUCKET
                    if (csvResponse) {
                        var fileName = csvResponse.fileName;
                        var uploadOption = {
                            fileName: fileName,
                            accountId: partner.inSharePartnerId,
                            shareCsvId: shareCsvId
                        };
                        debug('uploadOption', uploadOption);
                        var uploadResponse = await OutSharing.uploadFileToS3(uploadOption);
                        debug('uploadResponse', uploadResponse);
                    }
                }
            });

            debug('sharedDataList', sharedDataList);

            // Create multiple SharedData records for uncrypted in one query
            if (sharedDataList.length > 0) {
                createSharedDataOption = {
                    shareItemType: outShareInstance.shareItemType,
                    sharedDataList: sharedDataList,
                    outShareInstanceId: outShareInstance.id,
                    meta: shareEvent,
                    effectiveTimeStamp: shareEvent.nextSharingDate,
                    sharingEventId: shareEvent.id
                };
                isCreated = await OutSharing.createShareDataRecords(createSharedDataOption);
            }

            // Update Sharing Event record by computing nextSharingDate
            var nextSharingDate = await OutSharing.computeNextSharingDate({
                nextSharingDate: shareEvent.nextSharingDate,
                frequency: shareEvent.frequency,
                freqDay: outShareInstance.freqDay,
                freqTime: outShareInstance.freqTime
            });

            var updateShareEventOption = {
                id: shareEvent.id,
                nextSharingDate: nextSharingDate
            };
            var isUpdated = await OutSharing.updateSharingEvent(updateShareEventOption);
            //debug('isUpdated ', isUpdated);

            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err 12345', err);
            err = new Error(ErrorConfig.MESSAGE.CREATE_SHARED_DATA_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    /*
    * Get orders from the productRefIds
    * */

    /*
    * Calculate next sharing date from previous date and sharingType
    * */
    computeNextSharingDate: function (options) {
        return new Promise(function (resolve, reject) {
            var date = parseInt(options.nextSharingDate);
            var frequency = options.frequency;
            var freqDay = options.freqDay;
            var nextSharingDate = new Date(date);

            if (frequency === Constants.OUT_SHARE_FREQ_TYPE.EVERY_15_MIN) {
                nextSharingDate = moment(date).add(15, 'minutes').valueOf();
            } else if (frequency === Constants.OUT_SHARE_FREQ_TYPE.HOURLY) {
                nextSharingDate = moment(date).add(1, 'hours').valueOf();
            } else if (frequency === Constants.OUT_SHARE_FREQ_TYPE.DAILY) {
                nextSharingDate = moment(date).add(1, 'days').valueOf();
            } else if (frequency === Constants.OUT_SHARE_FREQ_TYPE.WEEKLY) {
                nextSharingDate = moment(date).add(7, 'days').valueOf();
            } else if (frequency === Constants.OUT_SHARE_FREQ_TYPE.MONTHLY) {
                var day = moment(date).get('date');
                var hours = moment(date).get('hour');
                var minutes = moment(date).get('minute');

                if (freqDay === 'EOM') {
                    nextSharingDate = moment(date).add(1, 'months').clone().endOf('month').hours(hours).minute(minutes).valueOf();
                } else {
                    nextSharingDate = moment(date).add(1, 'months').clone().valueOf();
                    var tempDay = moment(nextSharingDate).get('date');
                    if (day !== tempDay) {
                        nextSharingDate = moment(nextSharingDate).add(1, 'months').clone().date(day).valueOf();
                    }
                }
            }
            return resolve(nextSharingDate);
        });
    },

    /*
    * Update Sharing event
    * */
    updateSharingEvent: function (options) {
        return new Promise(async function (resolve, reject) {
            debug('options', options);
            var id = options.id;
            var updatedAt = DataUtils.getEpochMSTimestamp();
            var values = [updatedAt, id];
            var err;

            try {
                var response = await OutSharing.validateSharingEvent(options);
                values = _.concat(response.values, values);

                var conn = await connection.getConnection();

                var isUpdated = await conn.query('update SharingEvents set ' + response.fields + ' updatedAt=? ' +
                  'where id=uuid_to_bin(?);', values);
                isUpdated = Utils.isAffectedPool(isUpdated);

                if (!isUpdated) {
                    debug('err', err);
                    err = new Error(ErrorConfig.MESSAGE.SHARING_EVENT_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.SHARING_EVENT_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }

        });
    },

    /*
    * Validate sharingEvent fields and build query string
    * */
    validateSharingEvent: function (options) {
        return new Promise(function (resolve, reject) {
            var fields = '';
            var values = [];

            if (DataUtils.isDefined(options.nextSharingDate)) {
                fields += 'nextSharingDate=?,';
                values.push(options.nextSharingDate);
            }
            if (DataUtils.isDefined(options.endDate)) {
                fields += 'endDate=?,';
                values.push(options.endDate);
            }
            if (DataUtils.isDefined(options.status)) {
                fields += 'status=?,';
                values.push(options.status);
            }
            if (DataUtils.isDefined(options.frequency)) {
                fields += 'frequency=?,';
                values.push(options.frequency);
            }
            return resolve({fields: fields, values: values});
        });
    },

    /*
    * Get active sharing event (used in cron job)
    * */
    getActiveSharingEvent: function () {
        return new Promise(async function (resolve, reject) {
            try {
                var conn = await connection.getConnection();

                var sharingEvents = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id ,CAST(uuid_from_bin(outShareInstanceId) as CHAR) as outShareInstanceId,' +
                  'nextSharingDate,frequency,updatedAt from SharingEvents where status = 1 and nextSharingDate <= ROUND(UNIX_TIMESTAMP(CURTIME(4)) * 1000)');
                if (!sharingEvents) {
                    return resolve([]);
                }
                return resolve(sharingEvents);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.GET_SHARING_EVENT_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
    * Get outShare detail from outShareId
    * */
    getSharedDataByOutShareId: async function (options, cb) {
        var outShareInstanceId = options.outShareInstanceId;
        var shareItemType = options.shareItemType;
        var accountId = options.accountId;
        var sharedData, err;
        var query = '', values = [];

        if (DataUtils.isUndefined(outShareInstanceId)) {
            err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ID_REQUIRED);
        } else if (DataUtils.isUndefined(shareItemType)) {
            err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ITEM_TYPE_REQUIRED);
        } else if (Object.values(Constants.OUT_SHARE_PROFILE_TYPE).indexOf(shareItemType) === -1) {
            err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_SHARE_ITEM_TYPE_INVALID);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            if (shareItemType === Constants.OUT_SHARE_PROFILE_TYPE.PRODUCT_INVENTORY) {
                query = 'SELECT CAST(uuid_from_bin(PIS.id) AS CHAR) AS id, CAST(uuid_from_bin(PIS.accountId) AS CHAR) AS accountId,' +
                  ' CAST(uuid_from_bin(PIS.outShareInstanceId) AS CHAR) AS outShareInstanceId, CAST(uuid_from_bin(PIS.inSharePartnerId) AS CHAR) AS inSharePartnerId,' +
                  ' CAST(uuid_from_bin(PIS.shareItemId) AS CHAR) AS shareItemId,PIS.effectiveSharedDateTime,PIS.frequency, PIS.data,PIS.hash, PR.sku,PI.locationId, PIS.updatedAt ' +
                  ' FROM SharedData PIS, ProductInventory PI, ProductReferences PR WHERE ' +
                  ' outShareInstanceId = uuid_to_bin(?) AND inSharePartnerId=uuid_to_bin(?) AND ' +
                  ' PI.id = PIS.shareItemId AND PR.id = PI.productRefId ';
                values.push(outShareInstanceId, accountId);
            } else if (shareItemType === Constants.OUT_SHARE_PROFILE_TYPE.SUPPLY_INVENTORY) {
                query = ' SELECT CAST(uuid_from_bin(PIS.id) AS CHAR) AS id, CAST(uuid_from_bin(PIS.accountId) AS CHAR) AS accountId,' +
                  ' CAST(uuid_from_bin(PIS.outShareInstanceId) AS CHAR) AS outShareInstanceId, CAST(uuid_from_bin(PIS.inSharePartnerId) AS CHAR) AS inSharePartnerId,' +
                  ' CAST(uuid_from_bin(PIS.shareItemId) AS CHAR) AS shareItemId,PIS.effectiveSharedDateTime,PIS.frequency, PIS.data,PIS.hash, SIT.sku,SI.locationId, PIS.updatedAt ' +
                  ' FROM SharedData PIS, SupplyInventory SI, SupplyItems SIT WHERE ' +
                  ' PIS.outShareInstanceId = uuid_to_bin(?) AND PIS.inSharePartnerId=uuid_to_bin(?) AND ' +
                  ' SI.id = PIS.shareItemId AND SIT.id = SI.supplyItemId ';
                values.push(outShareInstanceId, accountId);
            } else if (shareItemType === Constants.OUT_SHARE_PROFILE_TYPE.PRODUCT_ORDERS) {
                query = ' SELECT CAST(uuid_from_bin(PIS.id) AS CHAR) AS id, CAST(uuid_from_bin(PIS.accountId) AS CHAR) AS accountId, ' +
                  ' CAST(uuid_from_bin(PIS.outShareInstanceId) AS CHAR) AS outShareInstanceId, CAST(uuid_from_bin(PIS.inSharePartnerId) AS CHAR) AS inSharePartnerId, ' +
                  ' CAST(uuid_from_bin(PIS.shareItemId) AS CHAR) AS shareItemId,PIS.effectiveSharedDateTime,PIS.frequency, ' +
                  ' PIS.data,PIS.HASH, PR.sku,PR.sellerSKUName,PIS.updatedAt FROM SharedData PIS, ProductReferences PR ' +
                  ' WHERE PIS.outShareInstanceId = uuid_to_bin(?) AND PIS.inSharePartnerId=uuid_to_bin(?) AND PR.id = PIS.shareItemId ';
                values.push(outShareInstanceId, accountId);
            } else if (shareItemType === Constants.OUT_SHARE_PROFILE_TYPE.DEPENDENT_DEMAND) {
                query = ' SELECT CAST(uuid_from_bin(PIS.id) AS CHAR) AS id, CAST(uuid_from_bin(PIS.accountId) AS CHAR) AS accountId, ' +
                  ' CAST(uuid_from_bin(PIS.outShareInstanceId) AS CHAR) AS outShareInstanceId, CAST(uuid_from_bin(PIS.inSharePartnerId) AS CHAR) AS inSharePartnerId, ' +
                  ' CAST(uuid_from_bin(PIS.shareItemId) AS CHAR) AS shareItemId,PIS.effectiveSharedDateTime,PIS.frequency, ' +
                  ' PIS.data,PIS.HASH, S.sku as supplyItemSKU,S.sellerSKUName as supplyItemSellerSKUName, PIS.updatedAt FROM SharedData PIS, ' +
                  ' SupplyItems S ' +
                  ' WHERE PIS.outShareInstanceId = uuid_to_bin(?) AND PIS.inSharePartnerId=uuid_to_bin(?) AND S.id = PIS.shareItemId ';
                values.push(outShareInstanceId, accountId);
            }

            var conn = await connection.getConnection();

            sharedData = await conn.query(query, values);

            /*sharedData = await conn.query(' SELECT CAST(uuid_from_bin(PIS.id) AS CHAR) AS id, CAST(uuid_from_bin(PIS.accountId) AS CHAR) AS accountId,' +
              ' CAST(uuid_from_bin(PIS.outShareInstanceId) AS CHAR) AS outShareInstanceId, CAST(uuid_from_bin(PIS.inSharePartnerId) AS CHAR) AS inSharePartnerId,' +
              ' CAST(uuid_from_bin(PIS.shareItemId) AS CHAR) AS shareItemId,PIS.effectiveSharedDateTime,PIS.frequency, PIS.data,PIS.hash, PR.sku,PI.locationId, PIS.updatedAt ' +
              ' FROM SharedData PIS, ProductInventory PI, ProductReferences PR WHERE ' +
              ' outShareInstanceId = uuid_to_bin(?) AND inSharePartnerId=uuid_to_bin(?) AND ' +
              ' PI.id = PIS.shareItemId AND PR.id = PI.productRefId;', [outShareInstanceId, accountId]);*/

            return cb(null, sharedData);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.GET_SHARED_DATA_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    /*
    * Get outShare detail from outShareId (for shared by me screen)
    * */
    getSharedDataForOutShare: async function (options, cb) {
        var outShareInstanceId = options.outShareInstanceId;
        var shareItemType = options.shareItemType;
        var accountId = options.accountId;
        var sharedData, err;
        var query = '', values = [];

        if (DataUtils.isUndefined(outShareInstanceId)) {
            err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ID_REQUIRED);
        } else if (DataUtils.isUndefined(shareItemType)) {
            err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ITEM_TYPE_REQUIRED);
        } else if (Object.values(Constants.OUT_SHARE_PROFILE_TYPE).indexOf(shareItemType) === -1) {
            err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_SHARE_ITEM_TYPE_INVALID);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            if (shareItemType === Constants.OUT_SHARE_PROFILE_TYPE.PRODUCT_INVENTORY) {
                query = 'SELECT CAST(uuid_from_bin(PIS.id) AS CHAR) AS id, CAST(uuid_from_bin(PIS.accountId) AS CHAR) AS accountId,' +
                  ' CAST(uuid_from_bin(PIS.outShareInstanceId) AS CHAR) AS outShareInstanceId, CAST(uuid_from_bin(PIS.inSharePartnerId) AS CHAR) AS inSharePartnerId,' +
                  ' CAST(uuid_from_bin(PIS.shareItemId) AS CHAR) AS shareItemId,PIS.effectiveSharedDateTime,PIS.frequency, PIS.data,PIS.hash, PR.sku,PI.locationId, PIS.updatedAt ' +
                  ' FROM SharedData PIS, ProductInventory PI, ProductReferences PR WHERE ' +
                  ' PIS.outShareInstanceId = uuid_to_bin(?) AND PIS.accountId = uuid_to_bin(?) AND PIS.inSharePartnerId=uuid_to_bin(?) AND ' +
                  ' PI.id = PIS.shareItemId AND PR.id = PI.productRefId ';
                values.push(outShareInstanceId, accountId, Constants.DEFAULT_REFERE_ID);
            } else if (shareItemType === Constants.OUT_SHARE_PROFILE_TYPE.SUPPLY_INVENTORY) {
                query = ' SELECT CAST(uuid_from_bin(PIS.id) AS CHAR) AS id, CAST(uuid_from_bin(PIS.accountId) AS CHAR) AS accountId, ' +
                  ' CAST(uuid_from_bin(PIS.outShareInstanceId) AS CHAR) AS outShareInstanceId, CAST(uuid_from_bin(PIS.inSharePartnerId) AS CHAR) AS inSharePartnerId, ' +
                  ' CAST(uuid_from_bin(PIS.shareItemId) AS CHAR) AS shareItemId,PIS.effectiveSharedDateTime,PIS.frequency, PIS.data,PIS.HASH, SIT.sku,SI.locationId, PIS.updatedAt  ' +
                  ' FROM SharedData PIS, SupplyInventory SI, SupplyItems SIT WHERE  ' +
                  ' PIS.outShareInstanceId = uuid_to_bin(?) AND PIS.accountId = uuid_to_bin(?) AND PIS.inSharePartnerId=uuid_to_bin(?) AND ' +
                  ' SI.id = PIS.shareItemId AND SIT.id = SI.supplyItemId ';
                values.push(outShareInstanceId, accountId, Constants.DEFAULT_REFERE_ID);
            } else if (shareItemType === Constants.OUT_SHARE_PROFILE_TYPE.PRODUCT_ORDERS) {
                query = ' SELECT CAST(uuid_from_bin(PIS.id) AS CHAR) AS id, CAST(uuid_from_bin(PIS.accountId) AS CHAR) AS accountId, ' +
                  ' CAST(uuid_from_bin(PIS.outShareInstanceId) AS CHAR) AS outShareInstanceId, CAST(uuid_from_bin(PIS.inSharePartnerId) AS CHAR) AS inSharePartnerId, ' +
                  ' CAST(uuid_from_bin(PIS.shareItemId) AS CHAR) AS shareItemId,PIS.effectiveSharedDateTime,PIS.frequency, ' +
                  ' PIS.data,PIS.HASH, PR.sku,PR.sellerSKUName,PIS.updatedAt FROM SharedData PIS, ProductReferences PR ' +
                  ' WHERE PIS.outShareInstanceId = uuid_to_bin(?) AND PIS.accountId = uuid_to_bin(?) AND PIS.inSharePartnerId=uuid_to_bin(?) AND PR.id = PIS.shareItemId ';
                values.push(outShareInstanceId, accountId, Constants.DEFAULT_REFERE_ID);
            } else if (shareItemType === Constants.OUT_SHARE_PROFILE_TYPE.DEPENDENT_DEMAND) {
                query = ' SELECT CAST(uuid_from_bin(PIS.id) AS CHAR) AS id, CAST(uuid_from_bin(PIS.accountId) AS CHAR) AS accountId, ' +
                  ' CAST(uuid_from_bin(PIS.outShareInstanceId) AS CHAR) AS outShareInstanceId, CAST(uuid_from_bin(PIS.inSharePartnerId) AS CHAR) AS inSharePartnerId, ' +
                  ' CAST(uuid_from_bin(PIS.shareItemId) AS CHAR) AS shareItemId,PIS.effectiveSharedDateTime,PIS.frequency, ' +
                  ' PIS.data,PIS.HASH, S.sku as supplyItemSKU,S.sellerSKUName as supplyItemSellerSKUName, PIS.updatedAt FROM SharedData PIS, ' +
                  ' SupplyItems S ' +
                  ' WHERE PIS.outShareInstanceId = uuid_to_bin(?) AND PIS.accountId = uuid_to_bin(?) AND PIS.inSharePartnerId=uuid_to_bin(?) AND S.id = PIS.shareItemId ';
                values.push(outShareInstanceId, accountId, Constants.DEFAULT_REFERE_ID);
            }
            var conn = await connection.getConnection();

            sharedData = await conn.query(query, values);

            /*sharedData = await conn.query(' SELECT CAST(uuid_from_bin(PIS.id) AS CHAR) AS id, CAST(uuid_from_bin(PIS.accountId) AS CHAR) AS accountId,' +
              ' CAST(uuid_from_bin(PIS.outShareInstanceId) AS CHAR) AS outShareInstanceId, CAST(uuid_from_bin(PIS.inSharePartnerId) AS CHAR) AS inSharePartnerId,' +
              ' CAST(uuid_from_bin(PIS.shareItemId) AS CHAR) AS shareItemId,PIS.effectiveSharedDateTime,PIS.frequency, PIS.data,PIS.hash, PR.sku,PI.locationId, PIS.updatedAt ' +
              ' FROM SharedData PIS, ProductInventory PI, ProductReferences PR WHERE ' +
              ' outShareInstanceId = uuid_to_bin(?) AND inSharePartnerId=uuid_to_bin(?) AND ' +
              ' PI.id = PIS.shareItemId AND PR.id = PI.productRefId;', [outShareInstanceId, Constants.DEFAULT_REFERE_ID]);*/

            return cb(null, sharedData);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.GET_SHARED_DATA_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    /*
    * Get partnerId from customer id or supplier id
    * */
    getPartnerId: function (options) {
        return new Promise(async function (resolve, reject) {
            var id = options.id;
            var flag = options.flag;
            var string, err;

            try {
                var conn = await connection.getConnection();
                if (!flag) {
                    string = 'select CAST(uuid_from_bin(customersAccountId) as char) as partnerId from Customers where ' +
                      'id = uuid_to_bin(?) and isActive = 1 ;';
                }
                if (flag) {
                    string = 'select CAST(uuid_from_bin(suppliersAccountId) as char) as partnerId from Supplier where ' +
                      'id = uuid_to_bin(?) and isActive = 1 ;';
                }
                var partnerId = await conn.query(string, [id]);
                partnerId = Utils.filteredResponsePool(partnerId);
                return resolve(partnerId);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
    * Check any outShare is exist or not from partnerId
    * */
    checkOutShareInshare: function (options) {
        return new Promise(async function (resolve, reject) {
            var ids = options.ids;
            var flag = options.supplier;
            var accountId = options.accountId;
            var conflict = options.conflict;
            var outShares = [], inShares = [];
            var warning = [], success = [], failed = options.failed;
            var type;
            var err;

            try {
                var conn = await connection.getConnection();

                await Promise.each(ids, async function (id) {
                    // Get partnerId from the customer or supplier id (if flag = true then supplier else customer)
                    var partner = await OutSharing.getPartnerId({id: id, flag: flag});
                    if (!partner) {
                        failed.push(id);
                    } else {
                        var partnerId = partner.partnerId;

                        var queryString = 'select CAST(uuid_from_bin(OS.id) as char) as id from OutShare OS,OutSharePartners OSP ' +
                          ' where OS.accountId=uuid_to_bin(?) and (OS.status = 3 or OS.status = 2 or OS.status = 5) and OS.id = OSP.outShareInstanceId and ' +
                          ' OSP.inSharePartnerId = uuid_to_bin(?) and OSP.type = ? ;';

                        type = flag ? 'supplier' : 'customer';

                        outShares = await conn.query(queryString, [accountId, partnerId, type]);

                        debug('outShares', outShares);

                        if (outShares.length > 0) {
                            warning.push(id);
                        } else {
                            success.push(id);
                        }
                    }
                });
                var data = {
                    warning: warning,
                    success: success,
                    conflict: conflict,
                    failed: failed
                };
                if (conflict.length > 0 && failed.length > 0) {
                    if (flag) {
                        data.failedMsg = ErrorConfig.MESSAGE.SUPPLIER_NOT_FOUND;
                    } else {
                        data.failedMsg = ErrorConfig.MESSAGE.CUSTOMER_NOT_FOUND;
                    }
                }
                if (conflict.length > 0) {
                    if (flag) {
                        err = new Error(ErrorConfig.MESSAGE.SUPPLIER_HAS_SYNC_CONFLICT);
                    } else {
                        err = new Error(ErrorConfig.MESSAGE.CUSTOMERS_HAS_SYNC_CONFLICT);
                    }

                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    err.data = data;
                    return reject(err);
                } else if (failed.length > 0) {
                    if (flag) {
                        err = new Error(ErrorConfig.MESSAGE.SUPPLIER_NOT_FOUND);
                    } else {
                        err = new Error(ErrorConfig.MESSAGE.CUSTOMER_NOT_FOUND);
                    }

                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    err.data = data;
                    return reject(err);
                }
                return resolve(data);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
    * get shareItem by id
    * */
    getShareItem: function (options) {
        return new Promise(async function (resolve, reject) {
            var id = options.id;
            var shareItemType = options.shareItemType;
            var tableName = '';
            var shareItem;
            var err;

            try {
                if (shareItemType === Constants.OUT_SHARE_INSTANCE_ITEM_TYPE.PRODUCT_INVENTORY) {
                    tableName += ' ProductInventory ';
                } else if (shareItemType === Constants.OUT_SHARE_INSTANCE_ITEM_TYPE.SUPPLY_INVENTORY) {
                    tableName += ' SupplyInventory ';
                } else if (shareItemType === Constants.OUT_SHARE_INSTANCE_ITEM_TYPE.PRODUCT_ORDER) {
                    tableName += ' OrderReferenceInformation ';
                } else if (shareItemType === Constants.OUT_SHARE_INSTANCE_ITEM_TYPE.DEPENDENT_DEMAND) {
                    tableName += ' ProductInventory ';
                }
                var conn = await connection.getConnection();
                debug('select id from ' + tableName + ' where id = uuid_to_bin(?) and status = 1;');
                shareItem = await conn.query('select id from ' + tableName + ' where id = uuid_to_bin(?) and status = 1;', [id]);
                shareItem = Utils.filteredResponsePool(shareItem);
                return resolve(shareItem);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.SHARE_ITEM_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },


    /*
    * Check any outShare is exist or not from shareItemId
    * */
    checkOutSharesByItems: function (options) {
        return new Promise(async function (resolve, reject) {
            var ids = options.ids;
            var shareItemType = options.shareItemType;
            var shareItemTypeValue = Constants.SHARING_TYPE[shareItemType];
            var accountId = options.accountId;
            var outShares = [];
            var warning = [], success = [], failed = options.failed;
            var conflict = options.conflict;
            var err;

            try {
                var conn = await connection.getConnection();

                await Promise.each(ids, async function (id) {
                    // Get partnerId from the customer or supplier id (if flag = true then supplier else customer)
                    var shareItem = await OutSharing.getShareItem({id: id, shareItemType: shareItemType});
                    if (!shareItem) {
                        failed.push(id);
                    } else {
                        outShares = await conn.query('select CAST(uuid_from_bin(OS.id) as char) as id from OutShare OS,OutShareItems OSI  ' +
                          ' where OS.accountId=uuid_to_bin(?) and (OS.status = 3 or OS.status = 2 or OS.status = 5) and ' +
                          ' OS.id = OSI.outShareInstanceId and OS.shareItemType = ? and ' +
                          ' OSI.shareItemId = uuid_to_bin(?) ; ', [accountId, shareItemTypeValue, id]);

                        if (outShares.length > 0) {
                            warning.push(id);
                        } else {
                            success.push(id);
                        }
                    }
                });
                var data = {
                    failed: failed,
                    success: success,
                    warning: warning,
                    conflict: conflict
                };
                debug('data', conflict.length > 0 && failed.length > 0);
                if (conflict.length > 0 && failed.length > 0) {
                    if (shareItemType === Constants.OUT_SHARE_INSTANCE_ITEM_TYPE.PRODUCT_INVENTORY) {
                        data.failedMsg = ErrorConfig.MESSAGE.PRODUCT_INVENTORY_NOT_FOUND;
                    } else if (shareItemType === Constants.OUT_SHARE_INSTANCE_ITEM_TYPE.SUPPLY_INVENTORY) {
                        data.failedMsg = ErrorConfig.MESSAGE.MESSAGE.SUPPLY_INVENTORY_NOT_FOUND;
                    }
                }
                if (conflict.length > 0) {
                    if (shareItemType === Constants.OUT_SHARE_INSTANCE_ITEM_TYPE.PRODUCT_INVENTORY) {
                        err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORIES_HAS_SYNC_CONFLICT);
                    } else if (shareItemType === Constants.OUT_SHARE_INSTANCE_ITEM_TYPE.SUPPLY_INVENTORY) {
                        err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORIES_HAS_SYNC_CONFLICT);
                    } else if (shareItemType === Constants.OUT_SHARE_INSTANCE_ITEM_TYPE.PRODUCT_ORDER) {
                        //err = new Error(ErrorConfig.MESSAGE.ORDER_NOT_FOUND);
                    } else if (shareItemType === Constants.OUT_SHARE_INSTANCE_ITEM_TYPE.DEPENDENT_DEMAND) {
                        // err = new Error(ErrorConfig.MESSAGE.ORDER_NOT_FOUND);
                    }
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    err.data = data;
                    return reject(err);
                } else if (failed.length > 0) {
                    if (shareItemType === Constants.OUT_SHARE_INSTANCE_ITEM_TYPE.PRODUCT_INVENTORY) {
                        err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_NOT_FOUND);
                    } else if (shareItemType === Constants.OUT_SHARE_INSTANCE_ITEM_TYPE.SUPPLY_INVENTORY) {
                        err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_NOT_FOUND);
                    } else if (shareItemType === Constants.OUT_SHARE_INSTANCE_ITEM_TYPE.PRODUCT_ORDER) {
                        //err = new Error(ErrorConfig.MESSAGE.ORDER_NOT_FOUND);
                    } else if (shareItemType === Constants.OUT_SHARE_INSTANCE_ITEM_TYPE.DEPENDENT_DEMAND) {
                        // err = new Error(ErrorConfig.MESSAGE.ORDER_NOT_FOUND);
                    }
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    err.data = data;
                    return reject(err);
                }
                return resolve(data);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
    * validation for checkOutShare api
    * */
    checkOutShares: async function (options, errorOptions, cb) {
        var ids = options.ids;
        var supplier = options.supplier;
        var accountId = options.accountId;
        var err;
        try {
            if (supplier) {
                var Supplier = require('./../api/supplier');
                var checkOption = {
                    suppliers: ids
                };
                checkResponse = await Supplier.validateSupplier(checkOption);
                debug('checkResponse', checkResponse);
                var response = await Supplier.checkUpdatedAt({
                    suppliers: ids,
                    accountId: accountId
                });
            } else {
                checkOption = {
                    customers: ids
                };
                checkResponse = await Customer.validateCustomers(checkOption);
                debug('checkResponse', checkResponse);
                response = await Customer.checkUpdatedAt({
                    customers: ids,
                    accountId: accountId
                });
            }
            var success = response.success;
            var conflict = response.conflict;
            var failed = response.failed;
            if (failed.length > 0) {
                _.each(failed, function (value) {
                    if (conflict.indexOf(value) !== -1) {
                        conflict.splice(conflict.indexOf(value), 1);
                    }
                });
            }

            var checkOptions = {
                ids: _.map(success, 'id'),
                accountId: accountId,
                supplier: supplier,
                conflict: conflict,
                failed: failed
            };
            debug('check option', checkOptions);
            var checkResponse = await OutSharing.checkOutShareInshare(checkOptions);

            return cb(null, checkResponse);
        } catch (err) {
            debug('err', err);
            if (err.errno === 4002) {
                return cb(err);
            } else {
                //err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_CHECK_FAILED);
                //err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }

        }
    },

    /*
    * function for check OutShare is exist of not by given shareItems
    * */
    checkOutSharesByShareItems: async function (options, errorOptions, cb) {
        var ids = options.ids;
        var shareItemType = options.shareItemType;
        var accountId = options.accountId;
        var err;

        if (DataUtils.isUndefined(shareItemType)) {
            err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_SHARE_ITEM_TYPE_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            if (shareItemType === Constants.OUT_SHARE_INSTANCE_ITEM_TYPE.PRODUCT_INVENTORY) {
                debug('inside product inventory');
                var checkOption = {
                    productInventories: ids
                };
                var validateResponse = await ProductInventory.validateProductInventories(checkOption);
                var response = await ProductInventory.checkUpdatedAt({
                    productInventories: ids,
                    status: Constants.PRODUCT_INVENTORY_STATUS.ACTIVE,
                    accountId: accountId
                });

            } else if (shareItemType === Constants.OUT_SHARE_INSTANCE_ITEM_TYPE.SUPPLY_INVENTORY) {
                checkOption = {
                    supplyInventories: ids
                };
                checkResponse = await SupplyInventory.validateSupplyInventories(checkOption);
                debug('checkResponse', checkResponse);
                response = await SupplyInventory.checkUpdatedAt({
                    supplyInventories: ids,
                    status: Constants.SUPPLY_INVENTORY_STATUS.ACTIVE,
                    accountId: accountId
                });
            } else if (shareItemType === Constants.OUT_SHARE_INSTANCE_ITEM_TYPE.PRODUCT_ORDER) {
            } else if (shareItemType === Constants.OUT_SHARE_INSTANCE_ITEM_TYPE.DEPENDENT_DEMAND) {
            }

            var success = response.success;
            var conflict = response.conflict;
            var failed = response.failed;
            if (failed.length > 0) {
                _.each(failed, function (value) {
                    if (conflict.indexOf(value) !== -1) {
                        conflict.splice(conflict.indexOf(value), 1);
                    }
                });
            }

            var checkOptions = {
                ids: success,
                shareItemType: shareItemType,
                accountId: accountId,
                conflict: conflict,
                failed: failed
            };
            var checkResponse = await OutSharing.checkOutSharesByItems(checkOptions);

            return cb(null, checkResponse);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            if (err.errno === 4002) {
                return cb(err);
            } else {
                //err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_CHECK_FAILED);
                //err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
        }
    },

    /*
    * Convert json object or shared data to Comma separate string (CSV string)
    * */
    convertObjectToCSV: function (options) {
        return new Promise(function (resolve, reject) {
            var sharedItemObject = options.sharedItemObject;
            var shareItemType = options.shareItemType;
            var fields;

            try {
                /*const fields = ['qtyOnHand', 'qtyOnHandUoM', 'qtyOnHandUOMSymbol', 'qtyOnHandUOMName', 'qtyOnHandUoMScalingFactor',
                    'qtyOnOrder', 'qtyOnOrderUoM', 'qtyOnOrderUOMSymbol', 'qtyOnOrderUOMName', 'qtyOnOrderUoMScalingFactor',
                    'qtyAvailable', 'qtyAvailableUoM', 'qtyAvailableUOMSymbol', 'qtyAvailableUOMName', 'qtyAvailableUoMScalingFactor',
                    'effectiveSharedDateTime'];*/
                if (shareItemType === Constants.SHARING_TYPE.productInventory) {
                    fields = Constants.SHARED_DATA_FIELDS.PRODUCT_INVENTORY;
                } else if (shareItemType === Constants.SHARING_TYPE.supplyInventory) {
                    fields = Constants.SHARED_DATA_FIELDS.SUPPLY_INVENTORY;
                } else if (shareItemType === Constants.SHARING_TYPE.productOrder) {
                    fields = Constants.SHARED_DATA_FIELDS.PRODUCT_ORDER;
                } else if (shareItemType === Constants.SHARING_TYPE.dependentDemand) {
                    fields = Constants.SHARED_DATA_FIELDS.DEPENDENT_DEMAND;
                }

                var csvString = jsonToCsv(sharedItemObject, {fields, header: false});

                debug('csvString ', csvString);
                return resolve({data: csvString});
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
     * Get outShare detail from outShareId (for shared by me screen)
     * */
    getSharedDataForDownload: async function (options, cb) {
        var outShareInstanceId = options.outShareInstanceId;
        var toFilterDate = options.toFilterDate;
        var fromFilterDate = options.fromFilterDate;
        var fromOutShare = options.fromOutShare;
        var accountId = options.accountId;
        var sharedData, err;


        if (DataUtils.isUndefined(outShareInstanceId)) {
            err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ID_REQUIRED);
        } else if (DataUtils.isUndefined(fromFilterDate)) {
            err = new Error(ErrorConfig.MESSAGE.FROM_FILTER_DATE_REQUIRED);
        } else if (DataUtils.isUndefined(toFilterDate)) {
            err = new Error(ErrorConfig.MESSAGE.TO_FILTER_DATE_REQUIRED);
        } else if (DataUtils.isUndefined(fromOutShare)) {
            err = new Error(ErrorConfig.MESSAGE.FROM_OUT_SHARE_FLAG_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            if (parseInt(fromOutShare)) {
                accountId = Constants.DEFAULT_REFERE_ID;
            }

            sharedData = await conn.query('SELECT CAST(uuid_from_bin(PIS.id) AS CHAR) AS id, CAST(uuid_from_bin(PIS.accountId) AS CHAR) AS accountId,' +
              ' CAST(uuid_from_bin(PIS.outShareInstanceId) AS CHAR) AS outShareInstanceId, CAST(uuid_from_bin(PIS.inSharePartnerId) AS CHAR) AS inSharePartnerId,' +
              ' CAST(uuid_from_bin(PIS.shareItemId) AS CHAR) AS shareItemId,PIS.effectiveSharedDateTime,PIS.frequency, PIS.data,PIS.hash, PR.sku,PI.locationId, PIS.updatedAt ' +
              ' FROM SharedData PIS, ProductInventory PI, ProductReferences PR WHERE ' +
              ' PIS.outShareInstanceId = uuid_to_bin(?) AND PIS.inSharePartnerId=uuid_to_bin(?) AND ' +
              ' PIS.effectiveSharedDateTime BETWEEN ? AND ? AND PI.id = PIS.shareItemId AND PR.id = PI.productRefId ' +
              ' UNION ALL ' +
              ' SELECT CAST(uuid_from_bin(PIS.id) AS CHAR) AS id, CAST(uuid_from_bin(PIS.accountId) AS CHAR) AS accountId, ' +
              ' CAST(uuid_from_bin(PIS.outShareInstanceId) AS CHAR) AS outShareInstanceId, CAST(uuid_from_bin(PIS.inSharePartnerId) AS CHAR) AS inSharePartnerId, ' +
              ' CAST(uuid_from_bin(PIS.shareItemId) AS CHAR) AS shareItemId,PIS.effectiveSharedDateTime,PIS.frequency, PIS.data,PIS.HASH, SIT.sku,SI.locationId, PIS.updatedAt  ' +
              ' FROM SharedData PIS, SupplyInventory SI, SupplyItems SIT WHERE  ' +
              ' PIS.outShareInstanceId = uuid_to_bin(?) AND PIS.inSharePartnerId=uuid_to_bin(?) AND ' +
              ' PIS.effectiveSharedDateTime BETWEEN ? AND ? AND SI.id = PIS.shareItemId AND SIT.id = SI.supplyItemId;',
              [outShareInstanceId, accountId, fromFilterDate, toFilterDate, outShareInstanceId, accountId, fromFilterDate, toFilterDate]);

            if (!sharedData || !DataUtils.isArray(sharedData)) {
                return cb(null, []);
            }
            return cb(null, sharedData);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.GET_SHARED_DATA_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    /*
    * Compress CSV string data
    * */
    compressData: function (options) {
        return new Promise(function (resolve, reject) {
            var data = options.data;
            let input = JSON.stringify(data);
            zlib.deflate(input, (err, buffer) => {
                if (err) {
                    debug('err', err);
                    return reject(err);
                }
                // console.log(buffer.toString('base64'));
                var response = buffer.toString('base64');
                return resolve(response);
            });
        });
    },

    /*
    * De-compress of compressed data or base64 string
    * */
    deCompressData: function (options) {
        return new Promise(function (resolve, reject) {
            var data = options.data;

            const buffer = Buffer.from(data, 'base64');
            zlib.unzip(buffer, (err, buffer) => {
                if (err) {
                    debug('err', err);
                    return reject(err);
                }
                debug('buffer', buffer.toString());
                return resolve(buffer.toString());
            });
        });
    },


    /*
    * Create shared data record for real_time outshare
    * */
    createRealTimeSharedData: async function (options, cb) {
        var outShareInstanceId = options.outShareInstanceId;
        var shareItemId = options.shareItemId;
        var orderRefIds = options.orderRefIds;
        var dependentDemands = options.dependentDemands;
        var outShareInstance, inSharePartners;
        var currentDate = DataUtils.getEpochMSTimestamp();
        var sharedDataList = [];
        var createSharedDataOption, isCreated, lastPartner, generatedHash;
        var outSharePartner, flag = true;

        try {

            // GET OUTSHARE INSTANCE
            debug('step 1');
            var outShareInstaceOption = {
                outShareInstanceId: outShareInstanceId
            };
            outShareInstance = await OutSharing.getOutShareById(outShareInstaceOption);


            // GET IN_SHARE_PARTNER_IDs BY OUT_SHARE_INSTANCE_ID
            debug('step 2');
            var inSharePartnerIdsOption = {
                outShareInstanceId: outShareInstanceId,
                sharingEventId: Constants.DEFAULT_REFERE_ID,
                meta: {
                    shareItemId: shareItemId,
                    frequency: Constants.OUT_SHARE_FREQ_TYPE.REAL_TIME,
                    outShareInstanceId: outShareInstanceId
                },
                effectiveTimeStamp: currentDate
            };
            inSharePartners = await OutSharing.getInSharePartnersByOutShareId(inSharePartnerIdsOption);

            /*
            * if(){
            *    for UNENCRYPTED data protection type
            * }
            * else{
            *    for ENCRYPTED data protection type
            * }
            * */
            debug('step 4');
            if (outShareInstance.dataProtectionOption === Constants.SHARING_DATA_PROTECTION_OPTION.ENCRYPTED_ONLY ||
              outShareInstance.dataProtectionOption === Constants.SHARING_DATA_PROTECTION_OPTION.ENCRYPTED_AND_SECURED) {

                // Check if outshare partner dont have encryption set up , if have then get keys
                var outSharePartnerCheckOption = {
                    outShareInstance: outShareInstance,
                    sharingEventId: Constants.DEFAULT_REFERE_ID,
                    meta: {
                        shareItemId: shareItemId,
                        frequency: Constants.OUT_SHARE_FREQ_TYPE.REAL_TIME,
                        outShareInstanceId: outShareInstanceId
                    },
                    effectiveTimeStamp: currentDate
                };
                var outSharePartnerCheckResponse = await OutSharing.checkEncryptionSetUpForOutSharePartner(outSharePartnerCheckOption);
                flag = outSharePartnerCheckResponse.flag;
                outSharePartner = outSharePartnerCheckResponse.outSharePartner;


                // Check if any inshare partner dont have encryption set up
                var partnerWithNoEnctyptionSetup = await OutSharing.getPartnerWithNoEncryptionSetup({
                    partners: inSharePartners,
                    outShareInstanceId: outShareInstanceId
                });

                // create error log for those partner who dont have encryption setup and filter inShare partners
                if (partnerWithNoEnctyptionSetup && partnerWithNoEnctyptionSetup.length > 0) {
                    var createFilterOption = {
                        inSharePartners: inSharePartners,
                        outShareInstanceId: outShareInstanceId,
                        sharingEventId: Constants.DEFAULT_REFERE_ID,
                        meta: {
                            shareItemId: shareItemId,
                            frequency: Constants.OUT_SHARE_FREQ_TYPE.REAL_TIME,
                            outShareInstanceId: outShareInstanceId
                        },
                        effectiveTimeStamp: currentDate,
                        partnerWithNoEnctyptionSetup: partnerWithNoEnctyptionSetup
                    };
                    inSharePartners = await OutSharing.createErrorLogFilterPartner(createFilterOption);
                }


                // GET public and private keys
                if (inSharePartners.length > 0) {
                    var inSharePartnersWithKey = await OutSharing.getPartnerKeys({
                        inSharePartners: inSharePartners,
                        outShareInstanceId: outShareInstance.id,
                        sharingEventId: Constants.DEFAULT_REFERE_ID,
                        meta: {
                            shareItemId: shareItemId,
                            frequency: Constants.OUT_SHARE_FREQ_TYPE.REAL_TIME,
                            outShareInstanceId: outShareInstanceId
                        },
                        effectiveTimeStamp: currentDate
                    });

                    // Merge with
                    inSharePartners = OutSharing.mergeKeyWithInShare({
                        inSharePartners: inSharePartners,
                        inSharePartnersWithKey: inSharePartnersWithKey
                    });
                }
            }

            //get last partner
            if (inSharePartners.length > 0) {
                lastPartner = OutSharing.getLastPartner({inSharePartners: inSharePartners});
            }


            var shareItems = [];
            debug('inSharePartners', inSharePartners.length);
            var c = 0;
            await Promise.each(inSharePartners, async function (partner) {
                debug('count', c++);
                var csvObjectList = [], shareCsvId;
                var csvGenerateObject = {}, sharedObjectForCSV = {}, csvGenerateFlag = false;
                var isEncrypted = false;

                /*
                * GETTING ALL ITEMS as per sharing type FROM ITEM IDs and also get UOM name and symbol as per partners LCC
                * */
                var shareItemOption = {
                    shareItemType: outShareInstance.shareItemType,
                    partner: partner,
                    outShareInstance: outShareInstance,
                    isRealTime: 1,
                    orderRefIds: orderRefIds,
                    dependentDemands: dependentDemands,
                    shareItemIds: [{
                        shareItemId: shareItemId
                    }],
                    meta: {
                        shareItemId: shareItemId,
                        frequency: Constants.OUT_SHARE_FREQ_TYPE.REAL_TIME,
                        outShareInstanceId: outShareInstanceId
                    },
                    effectiveTimeStamp: currentDate,
                    sharingEventId: Constants.DEFAULT_REFERE_ID
                };
                debug('shareItemOption', shareItemOption);
                shareItems = await OutSharing.getShareItemDetail(shareItemOption);
                //var shareItem = shareItems[0];
                debug('shareItems', shareItems.length);
                await Promise.each(shareItems, async function (shareItem) {
                    /*
                    *  BUILD A SHARED DATA OBJECT
                    * */
                    var generatedId = Utils.generateId();
                    var effectiveSharedDateTime = currentDate;
                    var getSharedItemObjectOptions, sharedItemObject, encryptedDataString;

                    var commonsharedDataObject = {
                        id: generatedId.uuid,
                        accountId: outShareInstance.accountId,
                        outShareInstanceId: outShareInstanceId,
                        shareItemId: shareItem.id,
                        inSharePartnerId: partner.inSharePartnerId,
                        inShareId: partner.inShareId,
                        effectiveSharedDateTime: effectiveSharedDateTime,
                        frequency: outShareInstance.freqType,
                        hash: '',
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        updatedAt: DataUtils.getEpochMSTimestamp()
                    };

                    getSharedItemObjectOptions = {
                        shareItem: shareItem,
                        shareItemType: outShareInstance.shareItemType,
                        partner: partner,
                        sharedDataItems: outShareInstance.sharedDataItems
                    };
                    sharedItemObject = await OutSharing.getObjectForSharedItem(getSharedItemObjectOptions);

                    debug('sharedItemObject', sharedItemObject);

                    /*
                    *  CONVERT OBJECT INTO CSV STRING
                    * */
                    sharedItemObject.effectiveSharedDateTime = effectiveSharedDateTime;
                    var convertedObject = await OutSharing.convertObjectToCSV({
                        sharedItemObject: sharedItemObject,
                        shareItemType: outShareInstance.shareItemType
                    });
                    debug('convertedObject', convertedObject);

                    //CREATE A SHARED_CSV_FILE RECORD and Object for generate CSV file
                    if (parseInt(partner.dataDeliveryOption) === Constants.DATA_DELIVERY_OPTION.FILES_ONLY ||
                      parseInt(partner.dataDeliveryOption) === Constants.DATA_DELIVERY_OPTION.ONLINE_AND_FILES) {
                        var createSharedCsvOption = {
                            outShareInstanceId: outShareInstance.id,
                            inSharePartnerId: partner.inSharePartnerId,
                            inShareId: partner.inShareId
                        };
                        var createResponse = await OutSharing.createSharedCsvRecord(createSharedCsvOption);
                        if (createResponse) {
                            shareCsvId = createResponse.id;
                        }
                        debug('createResponse', createResponse);

                        // ADD extraa field which is not in shared record but need to add in csv file
                        if (outShareInstance.shareItemType === Constants.SHARING_TYPE.productInventory) {
                            csvGenerateObject = {};
                        } else if (outShareInstance.shareItemType === Constants.SHARING_TYPE.supplyInventory) {
                            csvGenerateObject = {};
                        } else if (outShareInstance.shareItemType === Constants.SHARING_TYPE.productOrder) {
                            csvGenerateObject = {
                                sku: shareItem.sku,
                                sellerSKUName: shareItem.sellerSKUName
                            };
                        } else if (outShareInstance.shareItemType === Constants.SHARING_TYPE.dependentDemand) {
                            csvGenerateObject = {
                                productRefSKU: shareItem.productRefSKU,
                                productRefSellerSKUName: shareItem.productRefSellerSKUName,
                                supplyItemSKU: shareItem.supplyItemSKU,
                                supplyItemSellerSKUName: shareItem.supplyItemSellerSKUName
                            };
                        }
                        sharedObjectForCSV = Utils.convertMutable(sharedItemObject);
                        csvGenerateFlag = true;
                    }

                    if (outShareInstance.dataProtectionOption === Constants.SHARING_DATA_PROTECTION_OPTION.UNENCRYPTED ||
                      outShareInstance.dataProtectionOption === Constants.SHARING_DATA_PROTECTION_OPTION.ENCRYPTED_IF_SETUP_BY_PARTNER) {

                        /*// COMPRESS THE CSV STRING
                        var compressedData = await OutSharing.compressData({data: convertedObject.data});*/

                        //assign csv object with unencrypted string (for generating file)
                        if (csvGenerateFlag) {
                            debug('sharedObjectForCSV', sharedObjectForCSV);
                            csvGenerateObject = Object.assign(csvGenerateObject, sharedObjectForCSV);
                            debug('csvGenerateObject', csvGenerateObject);
                            csvObjectList.push(csvGenerateObject);
                        }

                        var sharedData = Object.assign(commonsharedDataObject, convertedObject);
                        sharedDataList.push(sharedData);

                        if (lastPartner.inSharePartnerId === partner.inSharePartnerId) {
                            debug('Inside lastPartner.inSharePartnerId === partner.inSharePartnerId');
                            var newSharedData = Utils.convertMutable(sharedData);
                            newSharedData.id = Utils.generateId().uuid;
                            newSharedData.inSharePartnerId = Constants.DEFAULT_REFERE_ID;
                            newSharedData.inShareId = Constants.DEFAULT_REFERE_ID;
                            sharedDataList.push(newSharedData);
                        }
                    } else {
                        isEncrypted = true;
                        // ENCRYPT DATA
                        var encryptionObject = {
                            data: convertedObject,
                            publicKey: partner.publicKey,
                            meta: {
                                shareItemId: shareItemId,
                                frequency: Constants.OUT_SHARE_FREQ_TYPE.REAL_TIME,
                                outShareInstanceId: outShareInstanceId
                            },
                            outShareInstanceId: outShareInstance.id,
                            inShareId: partner.inShareId,
                            effectiveTimeStamp: currentDate,
                            sharingEventId: Constants.DEFAULT_REFERE_ID
                        };
                        encryptedDataString = await OutSharing.encryptData(encryptionObject);
                        commonsharedDataObject.data = encryptedDataString;

                        //GENERATE HASH
                        if (outShareInstance.dataProtectionOption === Constants.SHARING_DATA_PROTECTION_OPTION.ENCRYPTED_AND_SECURED) {
                            generatedHash = await OutSharing.generateHash({
                                data: sharedItemObject,
                                outShareInstanceId: outShareInstance.id,
                                sharingEventId: Constants.DEFAULT_REFERE_ID,
                                meta: {
                                    shareItemId: shareItemId,
                                    frequency: Constants.OUT_SHARE_FREQ_TYPE.REAL_TIME,
                                    outShareInstanceId: outShareInstanceId
                                },
                                effectiveTimeStamp: currentDate
                            });
                            commonsharedDataObject.hash = generatedHash;
                        }
                        sharedDataList.push(commonsharedDataObject);

                        //assign csv object with encrypted string (for generating file)
                        if (csvGenerateFlag) {
                            csvGenerateObject.data = encryptedDataString;
                            csvObjectList.push(csvGenerateObject);
                        }

                        debug('flag', flag);
                        if (lastPartner.inSharePartnerId === partner.inSharePartnerId && flag) {
                            debug('lastPartner.inSharePartnerId === partner.inSharePartnerId && flag');
                            var outShareEncryptionObject = {
                                data: convertedObject,
                                publicKey: outSharePartner.publicKey,
                                sharingEventId: Constants.DEFAULT_REFERE_ID,
                                meta: {
                                    shareItemId: shareItemId,
                                    frequency: Constants.OUT_SHARE_FREQ_TYPE.REAL_TIME,
                                    outShareInstanceId: outShareInstanceId
                                },
                                effectiveTimeStamp: currentDate,
                                outShareInstanceId: outShareInstance.id,
                                inShareId: Constants.DEFAULT_REFERE_ID
                            };
                            encryptedDataString = await OutSharing.encryptData(outShareEncryptionObject);
                            var newCommonsharedDataObject = Utils.convertMutable(commonsharedDataObject);
                            newCommonsharedDataObject.data = encryptedDataString;
                            newCommonsharedDataObject.inSharePartnerId = Constants.DEFAULT_REFERE_ID;
                            newCommonsharedDataObject.id = Utils.generateId().uuid;

                            //GENERATE HASH
                            if (outShareInstance.dataProtectionOption === Constants.SHARING_DATA_PROTECTION_OPTION.ENCRYPTED_AND_SECURED) {
                                generatedHash = await OutSharing.generateHash({
                                    data: sharedItemObject,
                                    outShareInstanceId: outShareInstance.id,
                                    sharingEventId: Constants.DEFAULT_REFERE_ID,
                                    meta: {
                                        shareItemId: shareItemId,
                                        frequency: Constants.OUT_SHARE_FREQ_TYPE.REAL_TIME,
                                        outShareInstanceId: outShareInstanceId
                                    },
                                    effectiveTimeStamp: currentDate
                                });
                                newCommonsharedDataObject.hash = generatedHash;
                            }
                            sharedDataList.push(newCommonsharedDataObject);
                        }
                    }
                });

                // IF partner has csv generate setting then create and upload csv file
                debug('csvObjectList', csvObjectList);
                if (csvObjectList.length > 0) {
                    // GENERATE CSV FILE FOR PARTNER AND STORE IT INTO S3 BUCKET
                    var csvOption = {
                        sharedData: csvObjectList,
                        shareItemType: outShareInstance.shareItemType,
                        accountId: partner.inSharePartnerId,
                        refereShareId: partner.inSharingId,
                        refereShareName: partner.inShareName,
                        isEncrypted: isEncrypted,
                        shareCsvId: shareCsvId
                    };
                    var csvResponse = await OutSharing.generateCSVFile(csvOption);

                    //UPLOAD CSV FILE TO S3 BUCKET
                    if (csvResponse) {
                        var fileName = csvResponse.fileName;
                        var uploadOption = {
                            fileName: fileName,
                            accountId: partner.inSharePartnerId,
                            shareCsvId: shareCsvId
                        };
                        var uploadResponse = await OutSharing.uploadFileToS3(uploadOption);
                    }
                }
            });

            debug('sharedDataList', sharedDataList);

            // Create multiple SharedData records for unecrypted in one query
            if (sharedDataList.length > 0) {
                createSharedDataOption = {
                    shareItemType: outShareInstance.shareItemType,
                    sharedDataList: sharedDataList,
                    outShareInstanceId: outShareInstance.id,
                    sharingEventId: Constants.DEFAULT_REFERE_ID,
                    meta: {
                        shareItemId: shareItemId,
                        frequency: Constants.OUT_SHARE_FREQ_TYPE.REAL_TIME,
                        outShareInstanceId: outShareInstanceId
                    },
                    effectiveTimeStamp: currentDate
                };
                isCreated = await OutSharing.createShareDataRecords(createSharedDataOption);
            }

            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.CREATE_SHARED_DATA_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb();
        }
    },

    /*
    * Function for checking if any real_time outshare is exist or not by itemId
    * */
    checkRealTimeOutShare: function (options) {
        return new Promise(async function (resolve, reject) {
            debug('options', options);
            var itemId = options.itemId;
            var accountId = options.accountId;
            var shareItemType = options.shareItemType;
            var frequencyType = Constants.OUT_SHARE_FREQ_TYPE.REAL_TIME;
            var conditionString = options.conditionString;
            var conditionValues = options.conditionValues;
            var outShares = [], err;

            try {
                var conn = await connection.getConnection();
                debug();

                outShares = await conn.query('select CAST(uuid_from_bin(OS.id) as CHAR) as id from OutShare OS,OutShareItems OSI,OutSharingProfile OSP ' +
                  ' where ' +
                  ' OS.accountId=uuid_to_bin(?) and OS.id = OSI.outShareInstanceId and OS.sharingProfileId = OSP.id and ' +
                  ' OS.shareItemType=? and OSI.shareItemId = uuid_to_bin(?) and OS.status = 3 and OSP.freqType = ? ' +
                  ' and ' + conditionString + '', [accountId, shareItemType, itemId, frequencyType].concat(conditionValues));

                debug('outShares', outShares);

                return resolve(outShares);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
    * Function for getting sharing error log by outShareId
    * */
    getSharingErrorLogByOutShareId: async function (options, cb) {
        var outShareInstanceId = options.outShareInstanceId;
        var sharingErrorLogs, err;

        if (DataUtils.isUndefined(outShareInstanceId)) {
            err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }

        try {

            var conn = await connection.getConnection();

            sharingErrorLogs = await conn.query('select t1.id,CAST(uuid_from_bin(t1.outShareInstanceId) as CHAR) as outShareInstanceId,' +
              ' CAST(uuid_from_bin(t1.inShareId) as CHAR) as inShareId,t1.failReasonCode,t1.errorMessage,t1.outShareName,' +
              ' t1.partnerName,t1.frequency, t1.effectiveTimeStamp, t1.createdAt   from ' +
              ' (SELECT ESL.id as id,ESL.outShareInstanceId as outShareInstanceId ,ESL.inShareId as inShareId,ESL.failReasonCode as failReasonCode,' +
              ' ESL.errorMessage as errorMessage, OS.outShareName as outShareName,  Supp.supplierName as partnerName, ' +
              ' JSON_UNQUOTE(json_extract(meta , \'$.frequency\')) as frequency, ESL.effectiveTimeStamp, ESL.createdAt ' +
              ' FROM Supplier Supp,OutSharePartners OSPart, InShare I , SharingErrorLog ESL, OutShare OS ' +
              ' WHERE  ESL.outShareInstanceId = uuid_to_bin(?) and OS.id = ESL.outShareInstanceId ' +
              ' and OSPart.outShareInstanceId = ESL.outShareInstanceId ' +
              ' and I.id = ESL.inShareId and OSPart.inSharePartnerId = I.accountId and ' +
              ' Supp.accountId = OS.accountId and Supp.suppliersAccountId = OSPart.inSharePartnerId AND OSPart.type = ? ' +
              ' union ' +
              ' SELECT ESL.id as id,ESL.outShareInstanceId as outShareInstanceId ,ESL.inShareId as inShareId,ESL.failReasonCode as failReasonCode,' +
              ' ESL.errorMessage as errorMessage, OS.outShareName as outShareName,C.customerName as partnerName ,' +
              ' JSON_UNQUOTE(json_extract(meta , \'$.frequency\')) as frequency, ESL.effectiveTimeStamp, ESL.createdAt ' +
              ' FROM Customers C,OutSharePartners OSPart, InShare I , SharingErrorLog ESL, OutShare OS' +
              ' WHERE  ESL.outShareInstanceId = uuid_to_bin(?) and OS.id = ESL.outShareInstanceId ' +
              ' and OSPart.outShareInstanceId = ESL.outShareInstanceId ' +
              ' and I.id = ESL.inShareId and OSPart.inSharePartnerId = I.accountId and ' +
              ' C.accountId = OS.accountId and C.customersAccountId = OSPart.inSharePartnerId AND OSPart.type= ? ' +
              ' union ' +
              ' SELECT ESL.id as id,ESL.outShareInstanceId as outShareInstanceId ,ESL.inShareId as inShareId,ESL.failReasonCode as failReasonCode,' +
              ' ESL.errorMessage as errorMessage,OS.outShareName as outShareName,\'\' as partnerName,' +
              ' JSON_UNQUOTE(json_extract(meta , \'$.frequency\')) as frequency,ESL.effectiveTimeStamp, ESL.createdAt ' +
              ' FROM SharingErrorLog ESL, OutShare OS ' +
              ' WHERE  ESL.outShareInstanceId = uuid_to_bin(?) and ' +
              ' ESL.inShareId = uuid_to_bin(?) ' +
              ' and OS.id = ESL.outShareInstanceId)t1 ' +
              ' order by t1.effectiveTimeStamp',
              [outShareInstanceId, Constants.OUT_SHARE_INSTANCE_PARTNER_TYPE.SUPPLIER, outShareInstanceId,
                  Constants.OUT_SHARE_INSTANCE_PARTNER_TYPE.CUSTOMER, outShareInstanceId, Constants.DEFAULT_REFERE_ID]);

            return cb(null, sharingErrorLogs);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.GET_SHARING_ERROR_LOG_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    }

};

module.exports = OutSharing;

