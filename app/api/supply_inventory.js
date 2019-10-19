/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.api.supply_inventory');
var Util = require('util');
var Async = require('async');
var path = require('path');
var fs = require('fs');
var csv = require('fast-csv');
var _ = require('lodash');
var i18n = require('i18n');
var Promise = require('bluebird');

var DataUtils = require('../lib/data_utils');
var FastCsvUtils = require('../lib/fast_csv_utils');
var SupplyInventoryModel = require('../model/supply_inventory');
var SupplyItemApi = require('../api/supply_item');
var ProductReferenceApi = require('../api/product_reference');
var LocationReferenceApi = require('../api/location_reference');
var ProductInventoryApi = require('../api/product_inventory');
var OutSharingApi = require('../api/out_sharing');
var AuditUtils = require('../lib/audit_utils');
var ErrorUtils = require('../lib/error_utils');
var Utils = require('../lib/utils');
var Constants = require('../data/constants');
var ErrorConfig = require('../data/error');
var S3Utils = require('../lib/s3_utils');
var UnitOfMeasureNameModel = require('../model/unit_of_measure_name');
var connection = require('../lib/connection_util');

var SupplyInventory = {

    checkQuantity: function (options, cb) {
        var err;
        try {
            if (!DataUtils.isValidateOptionalField(options.qtyOnHand)) {
                if (!DataUtils.isMobile(options.qtyOnHand)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_QTY_ON_HAND_MUST_BE_NUMBER);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.qtyOnOrder)) {
                if (!DataUtils.isMobile(options.qtyOnOrder)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_QTY_ON_ORDER_MUST_BE_NUMBER);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.qtyAvailable)) {
                if (!DataUtils.isMobile(options.qtyAvailable)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_QTY_AVAILABLE_MUST_BE_NUMBER);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.qtyInTransit)) {
                if (!DataUtils.isMobile(options.qtyInTransit)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_QTY_IN_TRANSIT_MUST_BE_NUMBER);
                }
            }
            return cb();
        } catch (err) {
            debug('err', err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
    },

    create: async function (options, auditOptions, errorOptions, cb) {
        var SKU = options.SKU;
        var locationId = options.locationId;
        var err;

        if (DataUtils.isUndefined(SKU)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_SKU_REQ);
        } else if (DataUtils.isUndefined(locationId)) {
            err = new Error(ErrorConfig.MESSAGE.LOCATION_ID_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            debug('err', err);
            return cb(err);
        }

        debug('options', options);
        SupplyInventory.checkQuantity(options, function (err) {
            if (err) {
                debug('err', err);
                return cb(err);
            }
            ProductInventoryApi.validateQuantity(options, function (err, response) {
                if (err) {
                    debug('err', err);
                    return cb(err);
                }
                options.qtyOnHand = response.qtyOnHand;
                options.qtyOnOrder = response.qtyOnOrder;
                options.qtyAvailable = response.qtyAvailable;
                options.qtyInTransit = response.qtyInTransit;
                SupplyInventory.createSupplyInventory(options, errorOptions, async function (err, response) {
                    if (err) {
                        debug('err', err);
                        return cb(err);
                    }
                    AuditUtils.create(auditOptions);
                    return cb(null, response);
                });
            });
        });
    },

    getSupplyItem: async function (options, cb) {
        var accountId = options.accountId;
        var SKU = options.SKU;
        var err;

        try {
            var conn = await connection.getConnection();
            var supplyItem = await conn.query('select *,CAST(uuid_from_bin(id) as CHAR) as id from SupplyItems where ' +
              'accountId=uuid_to_bin(?) and SKU=?', [accountId, SKU]);
            supplyItem = Utils.filteredResponsePool(supplyItem);
            if (!supplyItem) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }
            return cb(null, supplyItem);
        } catch (err) {
            debug('err', err);
            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    validateOptionalFields: function (options, cb) {
        var err;
        var supplyInventoryFields = '';
        var supplyInventoryOptionalValues = [];

        try {
            if (!DataUtils.isValidateOptionalField(options.SKU)) {
                if (!DataUtils.isString(options.SKU)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_MUST_BE_STRING);
                } else if (options.SKU.length > 40) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_SKU_MUST_BE_LESS_THAN_40_CHARACTER);
                } else {
                    supplyInventoryFields += 'SKU=? ,';
                    supplyInventoryOptionalValues.push(options.SKU);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.locationId)) {
                if (!DataUtils.isString(options.locationId)) {
                    throw err = new Error(ErrorConfig.MESSAGE.LOCATION_ID_MUST_BE_STRING);
                } else if (options.locationId.length > 40) {
                    throw err = new Error(ErrorConfig.MESSAGE.LOCATION_ID_MUST_BE_LESS_THAN_40_CHARACTER);
                } else {
                    supplyInventoryFields += 'locationId=? ,';
                    supplyInventoryOptionalValues.push(options.locationId);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.qtyUOM)) {
                if (!DataUtils.isNumber(options.qtyUOM)) {
                    throw err = new Error(ErrorConfig.MESSAGE.QTY_UOM_MUST_BE_NUMBER);
                } else if (options.qtyUOM.toString().length > 11) {
                    throw err = new Error(ErrorConfig.MESSAGE.QTY_UOM_MUST_BE_LESS_THAN_11_DIGIT);
                } else {
                    supplyInventoryFields += 'qtyUOM=? ,';
                    supplyInventoryOptionalValues.push(options.qtyUOM);
                }
            }
            /*
            if (!DataUtils.isValidateOptionalField(options.type)) {
                if (!DataUtils.isString(options.type)) {
                    throw err = new Error(ErrorConfig.MESSAGE.TYPE_MUST_BE_STRING);
                }
                else if (options.type.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.TYPE_MUST_BE_LESS_THAN_30_CHARACTER);
                }
                else {
                    supplyInventoryFields += 'type=? ,';
                    productInventoryOptionalValues.push(options.type);
                }
            }*/
            if (!DataUtils.isValidateOptionalField(options.qtyOnHand)) {
                if (!DataUtils.isMobile(options.qtyOnHand)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_QTY_ON_HAND_MUST_BE_NUMBER);
                } else if (options.qtyOnHand.toString().length > 20) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_QTY_ON_HAND_MUST_BE_LESS_THAN_20_DIGITS);
                } else {
                    supplyInventoryFields += 'qtyOnHand=? ,';
                    supplyInventoryOptionalValues.push(options.qtyOnHand);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.qtyOnHandUOM)) {
                if (!DataUtils.isNumber(options.qtyOnHandUOM)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_QTY_ON_HAND_UOM_MUST_BE_NUMBER);
                } else if (options.qtyOnHandUOM.toString().length > 11) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_QTY_ON_HAND_UOM_MUST_BE_LESS_THAN_11_DIGITS);
                } else {
                    supplyInventoryFields += 'qtyOnHandUOM=? ,';
                    supplyInventoryOptionalValues.push(options.qtyOnHandUOM);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.qtyOnOrder)) {
                if (!DataUtils.isMobile(options.qtyOnOrder)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_QTY_ON_ORDER_MUST_BE_NUMBER);
                } else if (options.qtyOnOrder.toString().length > 20) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_QTY_ON_ORDER_MUST_BE_LESS_THAN_20_DIGITS);
                } else {
                    supplyInventoryFields += 'qtyOnOrder=? ,';
                    supplyInventoryOptionalValues.push(options.qtyOnOrder);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.qtyOnOrderUOM)) {
                if (!DataUtils.isNumber(options.qtyOnOrderUOM)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_QTY_ON_ORDER_UOM_MUST_BE_NUMBER);
                } else if (options.qtyOnOrderUOM.toString().length > 11) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_QTY_ON_ORDER_UOM_MUST_BE_LESS_THAN_11_DIGITS);
                } else {
                    supplyInventoryFields += 'qtyOnOrderUOM=? ,';
                    supplyInventoryOptionalValues.push(options.qtyOnOrderUOM);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.qtyAvailable)) {
                if (!DataUtils.isMobile(options.qtyAvailable)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_QTY_AVAILABLE_MUST_BE_NUMBER);
                } else if (options.qtyAvailable.toString().length > 20) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_QTY_AVAILABLE_MUST_BE_LESS_THAN_20_DIGITS);
                } else {
                    supplyInventoryFields += 'qtyAvailable=? ,';
                    supplyInventoryOptionalValues.push(options.qtyAvailable);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.qtyAvailableUOM)) {
                if (!DataUtils.isNumber(options.qtyAvailableUOM)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_QTY_AVAILABLE_UOM_MUST_BE_NUMBER);
                } else if (options.qtyAvailableUOM.toString().length > 11) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_QTY_AVAILABLE_UOM_MUST_BE_LESS_THAN_11_DIGITS);
                } else {
                    supplyInventoryFields += 'qtyAvailableUOM=? ,';
                    supplyInventoryOptionalValues.push(options.qtyAvailableUOM);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.qtyInTransit)) {
                if (!DataUtils.isMobile(options.qtyInTransit)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_QTY_IN_TRANSIT_MUST_BE_NUMBER);
                } else if (options.qtyInTransit.toString().length > 20) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_QTY_IN_TRANSIT_MUST_BE_LESS_THAN_20_DIGITS);
                } else {
                    supplyInventoryFields += 'qtyInTransit=? ,';
                    supplyInventoryOptionalValues.push(options.qtyInTransit);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.qtyInTransitUOM)) {
                if (!DataUtils.isNumber(options.qtyInTransitUOM)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_QTY_IN_TRANSIT_UOM_MUST_BE_NUMBER);
                } else if (options.qtyInTransitUOM.toString().length > 11) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_QTY_IN_TRANSIT_UOM_MUST_BE_LESS_THAN_11_DIGITS);
                } else {
                    supplyInventoryFields += 'qtyInTransitUOM=? ,';
                    supplyInventoryOptionalValues.push(options.qtyInTransitUOM);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.notes)) {
                if (!DataUtils.isString(options.notes)) {
                    throw err = new Error(ErrorConfig.MESSAGE.NOTES_MUST_BE_STRING);
                } else {
                    supplyInventoryFields += 'notes=? ,';
                    supplyInventoryOptionalValues.push(options.notes);
                }
            }
            var response = {
                supplyInventoryFields: supplyInventoryFields,
                supplyInventoryOptionalValues: supplyInventoryOptionalValues
            };
            return cb(null, response);
        } catch (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
    },

    createSupplyInventory: function (options, errorOptions, cb) {
        var userId = options.userId;
        var accountId = options.accountId;
        var SKU = options.SKU;
        var locationId = options.locationId;
        var supplyItemId, generateId = Utils.generateId(), supplyInventoryFields = '';
        var supplyInventoryOptionalFields = [];
        var supplyInventoryRequiredFields = [];
        var createdAt = DataUtils.getEpochMSTimestamp();
        var updatedAt = DataUtils.getEpochMSTimestamp();

        var supplyOptions = {
            accountId: accountId,
            SKU: SKU
        };

        SupplyInventory.getSupplyItem(supplyOptions, async function (err, supplyItem) {
            if (err) {
                debug('err ', err);
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            supplyItemId = supplyItem.id;
            debug('supplyItemId', supplyItemId);

            supplyInventoryRequiredFields.push(accountId, supplyItemId, locationId, accountId, locationId, generateId.uuid, accountId, supplyItemId);
            SupplyInventory.validateOptionalFields(options, async function (err, response) {
                if (err) {
                    debug('err', err);
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
                supplyInventoryFields = response.supplyInventoryFields;
                supplyInventoryOptionalFields = response.supplyInventoryOptionalValues;

                supplyInventoryRequiredFields = _.concat(supplyInventoryRequiredFields, supplyInventoryOptionalFields);
                supplyInventoryRequiredFields.push(createdAt, updatedAt, userId);

                debug('supplyInventoryFields', supplyInventoryFields);
                debug('supplyInventoryRequiredFields', supplyInventoryRequiredFields);

                try {
                    var conn = await connection.getConnection();
                    var supplyInventory = await conn.query('IF (select 1 from SupplyInventory where accountId=uuid_to_bin(?) and ' +
                      'supplyItemId=uuid_to_bin(?) and locationId=?) is not null then ' +
                      'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "SUPPLY_INVENTORY_ALREADY_EXIST", MYSQL_ERRNO = 4001;' +
                      'ELSEIF (select 1 from LocationReference where accountId=uuid_to_bin(?) and locationId=? and status = 1 ) is null then ' +
                      'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "LOCATION_REFERENCE_NOT_FOUND", MYSQL_ERRNO = 4002;' +
                      'ELSE insert into SupplyInventory set id=uuid_to_bin(?), accountId=uuid_to_bin(?), supplyItemId=uuid_to_bin(?),' +
                      '' + supplyInventoryFields + ' createdAt=?,' +
                      'updatedAt=?,createdBy=uuid_to_bin(?);END IF;', supplyInventoryRequiredFields);
                    supplyInventory = Utils.isAffectedPool(supplyInventory);
                    if (!supplyInventory) {
                        throw err;
                    }
                    return cb(null, {
                        OK: Constants.SUCCESS_MESSAGE.SUPPLY_INVENTORY_CREATED_SUCCESSFULLY,
                        id: generateId.uuid,
                        createdAt: createdAt
                    });
                } catch (err) {
                    debug('err', err);
                    await ErrorUtils.create(errorOptions, options, err);
                    if (err.errno === 4001) {
                        err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_ALREADY_EXIST);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        return cb(err);
                    } else if (err.errno === 4002) {
                        err = new Error(ErrorConfig.MESSAGE.LOCATION_REFERENCE_NOT_FOUND);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        return cb(err);
                    } else {
                        err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_CREATE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;

                        return cb(err);
                    }
                }
            });
        });
    },

    getSupplyInventory: async function (options, errorOptions, cb) {
        var supplyInventoryId = options.supplyInventoryId;
        var languageCultureCode = options.languageCultureCode;
        var accountId = options.accountId;
        var err;

        if (DataUtils.isUndefined(supplyInventoryId)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('error', err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();

            var supplyInventory = await conn.query('select CAST(uuid_from_bin(s.id) as CHAR) as id,CAST(uuid_from_bin(s.accountId) as CHAR) as accountId ,' +
              ' CAST(uuid_from_bin(s.supplyItemId) as CHAR) as supplyItemId , s.SKU,SI.qtyUoMId,SI.qtyUoMCategory,' +
              ' SI.sellerSKUName, s.locationId,LR.locationName, ' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(s.qtyOnHand/CAST(power(10,US1.scalingPrecision) as INTEGER))))) as qtyOnHand,  UN1.symbol as qtyOnHandUOMSymbol, ' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(s.qtyOnOrder/CAST(power(10,US2.scalingPrecision) as INTEGER))))) as qtyOnOrder,  UN2.symbol as qtyOnOrderUOMSymbol, ' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(s.qtyAvailable/CAST(power(10,US3.scalingPrecision) as INTEGER))))) as qtyAvailable,  UN3.symbol as qtyAvailableUOMSymbol, ' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(s.qtyInTransit/CAST(power(10,US4.scalingPrecision) as INTEGER))))) as qtyInTransit,  UN4.symbol as qtyInTransitUOMSymbol, ' +
              ' s.qtyOnHandUOM, s.qtyOnOrderUOM, s.qtyAvailableUOM, s.qtyInTransitUOM, s.notes,s.isRealTimeFrequency,s.updatedAt ' +
              ' from ' +
              ' SupplyInventory as s, uomNames UN1, uomNames UN2, uomNames UN3, uomNames UN4, ' +
              ' uomScaling as US1, uomScaling as US2, uomScaling as US3, uomScaling as US4, LocationReference LR, SupplyItems SI ' +
              ' where ' +
              ' s.status = 1 and ' +
              ' s.qtyOnHandUOM = US1.id and ' +
              ' s.qtyOnOrderUOM = US2.id and ' +
              ' s.qtyAvailableUOM = US3.id and ' +
              ' s.qtyInTransitUOM = US4.id and ' +
              ' s.locationId = LR.locationId and ' +
              ' s.supplyItemId = SI.id and ' +
              ' (UN1.uomScalingId = s.qtyOnHandUoM and UN1.languageCultureCode = ?) and ' +
              ' (UN2.uomScalingId = s.qtyOnOrderUoM and UN2.languageCultureCode = ?) and ' +
              ' (UN3.uomScalingId = s.qtyAvailableUoM and UN3.languageCultureCode = ?) and ' +
              ' (UN4.uomScalingId = s.qtyInTransitUoM  and UN4.languageCultureCode = ?) and ' +
              ' s.id=uuid_to_bin(?) and ' +
              ' LR.accountId=uuid_to_bin(?);', [languageCultureCode, languageCultureCode, languageCultureCode, languageCultureCode, supplyInventoryId, accountId]);

            supplyInventory = Utils.filteredResponsePool(supplyInventory);
            if (!supplyInventory) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            return cb(null, supplyInventory);
        } catch (err) {
            debug('error', err);
            await ErrorUtils.create(errorOptions, options, err);
            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    remove: async function (options, auditOptions, errorOptions, cb) {
        var id = options.id;
        var updatedAt = options.updatedAt;
        var accountId = options.accountId;
        var userId = options.userId;
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();
        var err;

        if (DataUtils.isUndefined(id)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_ID_REQUIRED);
        } else if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_UPDATED_AT_MUST_BE_NUMBER);
        } else if (updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_UPDATED_AT_INVALID);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();

            var isDeleted = await conn.query('IF (select 1 from SupplyInventory where id=uuid_to_bin(?) and status = 1) is null then ' +
              'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "SUPPLY_INVENTORY_NOT_FOUND", MYSQL_ERRNO = 4001;' +
              'ELSEIF (select 1 from SupplyInventory where id=uuid_to_bin(?) and updatedAt=?) is null then ' +
              'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "SUPPLY_INVENTORY_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
              'ELSE update SupplyInventory set status = 0, updatedAt=? , updatedBy=uuid_to_bin(?) where id = uuid_to_bin(?);end if;',
              [id, id, updatedAt, newUpdatedAt, userId, id]);

            isDeleted = Utils.isAffectedPool(isDeleted);
            if (!isDeleted) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }
            return cb(null, {OK: Constants.SUCCESS_MESSAGE.SUPPLY_INVENTORY_ARCHIEVED_SUCCESSFULLY});
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            } else if (err.errno === 4002) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                return cb(err);
            } else {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_DELETE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
        }
    },

    getSupplyInventoryBySupplyItemId: async function (options, errorOptions, cb) {
        var supplyItemId = options.supplyItemId;
        var accountId = options.accountId;
        var languageCultureCode = options.languageCultureCode;
        var err;
        if (DataUtils.isUndefined(supplyItemId)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('error', err);
            return cb(err);
        }
        try {
            var conn = await connection.getConnection();

            var supplyInventory = await conn.query('select CAST(uuid_from_bin(SI.id) as CHAR) as id ,SI.locationId,LR.locationName,SI.SKU,' +
              'TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(SI.qtyOnHand/CAST(power(10,US1.scalingPrecision) as INTEGER)))))  as qtyOnHand  , ' +
              'UN1.name as qtyOnHandUOMName, UN1.symbol as qtyOnHandUOMSymbol, ' +
              'TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(SI.qtyOnOrder/CAST(power(10,US2.scalingPrecision) as INTEGER)))))  as qtyOnOrder , ' +
              'UN2.name as qtyOnOrderUOMName, UN2.symbol as qtyOnOrderUOMSymbol, ' +
              'TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(SI.qtyAvailable/CAST(power(10,US3.scalingPrecision) as INTEGER))))) as qtyAvailable , ' +
              'UN3.name as qtyAvailableUOMName, UN3.symbol as qtyAvailableUOMSymbol, ' +
              'TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(SI.qtyInTransit/CAST(power(10,US4.scalingPrecision) as INTEGER))))) as qtyInTransit , ' +
              'UN4.name as qtyInTransitUOMName, UN4.symbol as qtyInTransitUOMSymbol, SI.isRealTimeFrequency, SI.updatedAt ' +
              ' from ' +
              'SupplyInventory SI, LocationReference LR ,uomNames UN1, uomNames UN2, uomNames UN3, uomNames UN4, ' +
              'uomScaling US1, uomScaling US2, uomScaling US3, uomScaling US4 ' +
              ' where ' +
              'SI.status = 1 and ' +
              'SI.supplyItemId = uuid_to_bin(?) and ' +
              'SI.accountId = uuid_to_bin(?) and ' +
              'SI.locationId = LR.locationId and ' +
              '(UN1.uomScalingId = SI.qtyOnHandUoM and UN1.languageCultureCode = ?) and ' +
              '(UN2.uomScalingId = SI.qtyOnOrderUoM and UN2.languageCultureCode = ?) and ' +
              '(UN3.uomScalingId = SI.qtyAvailableUoM and UN3.languageCultureCode = ?) and ' +
              '(UN4.uomScalingId = SI.qtyInTransitUoM  and UN4.languageCultureCode = ?) and ' +
              'US1.id = SI.qtyOnHandUOM and ' +
              'US2.id = SI.qtyOnOrderUoM and ' +
              'US3.id = SI.qtyAvailableUoM and ' +
              'US4.id = SI.qtyInTransitUoM', [supplyItemId, accountId, languageCultureCode, languageCultureCode, languageCultureCode, languageCultureCode]);


            if (!supplyInventory) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                debug('err', err);
                return cb(err);
            }
            return cb(null, supplyInventory);
        } catch (err) {
            debug('error', err);
            await ErrorUtils.create(errorOptions, options, err);
            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    /*
    * Check supply inventory already exist or not
    * */
    checkAlreadyExistInventory: function (options) {
        return new Promise(async function (resolve, reject) {
            var id = options.id;
            var locationId = options.locationId;
            var err;

            try {
                var conn = await connection.getConnection();

                var checkResponse = await conn.query('select 1 from SupplyInventory S1,SupplyInventory S2 where S1.locationId = ? ' +
                  ' and S1.supplyItemId = S2.supplyItemId and S2.id = uuid_to_bin(?);', [locationId, id]);
                checkResponse = Utils.filteredResponsePool(checkResponse);

                if (checkResponse) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_ALREADY_EXIST);
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

    updateSupplyInventory: function (options) {
        return new Promise(function (resolve, reject) {
            var updatedAt = options.updatedAt;
            var userId = options.userId;
            var supplyInventoryId = options.supplyInventoryId;
            var supplyInventoryFields = '';
            var supplyInventoryOptionalValues = [];
            var supplyInventoryRequiredValues = [];
            var newUpdatedAt = DataUtils.getEpochMSTimestamp();

            supplyInventoryRequiredValues.push(supplyInventoryId, supplyInventoryId, updatedAt);
            SupplyInventory.validateOptionalFields(options, async function (err, response) {
                if (err) {
                    debug('err', err);
                    return reject(err);
                }
                supplyInventoryFields = response.supplyInventoryFields;
                supplyInventoryOptionalValues = response.supplyInventoryOptionalValues;

                if (supplyInventoryOptionalValues.length <= 0) {
                    err = new Error(ErrorConfig.MESSAGE.INVALID_REQUEST);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }

                supplyInventoryRequiredValues = _.concat(supplyInventoryRequiredValues, supplyInventoryOptionalValues);
                supplyInventoryRequiredValues.push(userId, newUpdatedAt, supplyInventoryId);

                try {
                    var conn = await connection.getConnection();

                    var supplyInventoryUpdated = await conn.query('IF (select 1 from SupplyInventory where id=uuid_to_bin(?) and status = 1) is null then ' +
                      'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "SUPPLY_INVENTORY_NOT_FOUND", MYSQL_ERRNO = 4001;' +
                      'ELSEIF (select 1 from SupplyInventory where id=uuid_to_bin(?) and updatedAt=?) is null then ' +
                      'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "SUPPLY_INVENTORY_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
                      'ELSE update SupplyInventory set ' + supplyInventoryFields + ' updatedBy=uuid_to_bin(?), updatedAt = ? ' +
                      'where id=uuid_to_bin(?); END IF;', supplyInventoryRequiredValues);

                    supplyInventoryUpdated = Utils.isAffectedPool(supplyInventoryUpdated);

                    if (!supplyInventoryUpdated) {
                        throw err;
                    }
                    return resolve({
                        OK: Constants.SUCCESS_MESSAGE.SUPPLY_INVENTORY_UPDATED_SUCCESSFULLY,
                        updatedAt: newUpdatedAt
                    });
                } catch (err) {
                    debug('err', err);
                    if (err.errno === 4001) {
                        err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_NOT_FOUND);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        return reject(err);
                    } else if (err.errno === 4002) {
                        err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                        err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                        return reject(err);
                    }
                    err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
            });
        });
    },

    /*
    * Get condition string according the qty changes
    * */
    getConditionString: function (options) {
        return new Promise(function (resolve, reject) {
            var string = '( ';
            var values = [];
            if (options.qtyOnHand || options.qtyOnHandUOM) {
                string += 'OSP.sharedDataItems like ? OR ';
                values.push('%1%');
            }
            if (options.qtyInTransit || options.qtyInTransitUOM) {
                string += 'OSP.sharedDataItems like ? OR ';
                values.push('%2%');
            }
            if (options.qtyOnOrder || options.qtyOnOrderUOM) {
                string += 'OSP.sharedDataItems like ? OR ';
                values.push('%4%');
            }
            string = string.replace(/OR\s*$/, ' ');
            string += ')';

            return resolve({
                string: string,
                values: values
            });
        });
    },

    update: async function (options, auditOptions, errorOptions, cb) {
        var OutSharingApi = require('../api/out_sharing');
        var userId = options.userId;
        var accountId = options.accountId;
        var languageCultureCode = options.languageCultureCode;
        var updatedAt = options.updatedAt;
        var locationId = options.locationId;
        var supplyInventoryId = options.supplyInventoryId;
        var isRealTimeFrequency = options.isRealTimeFrequency;
        var flag = options.flag;
        var conditionString, conditionValues;

        var err;

        if (DataUtils.isUndefined(supplyInventoryId)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_ID_REQUIRED);
        } else if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_UPDATED_AT_MUST_BE_NUMBER);
        } else if (updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_UPDATED_AT_INVALID);
        } else if (DataUtils.isDefined(locationId)) {
            err = new Error(ErrorConfig.MESSAGE.LOCATION_CAN_NOT_BE_UPDATE);
        } else if ((DataUtils.isDefined(options.qtyOnHandUOM) && DataUtils.isUndefined(options.qtyOnHand))
          || (DataUtils.isDefined(options.qtyOnHand) && DataUtils.isUndefined(options.qtyOnHandUOM))) {
            err = new Error(ErrorConfig.MESSAGE.QTY_ON_HAND_AND_UOM_BOTH_REQUIRED);
        } else if ((DataUtils.isDefined(options.qtyOnOrderUOM) && DataUtils.isUndefined(options.qtyOnOrder))
          || (DataUtils.isDefined(options.qtyOnOrder) && DataUtils.isUndefined(options.qtyOnOrderUOM))) {
            err = new Error(ErrorConfig.MESSAGE.QTY_ON_ORDER_AND_UOM_BOTH_REQUIRED);
        } else if ((DataUtils.isDefined(options.qtyAvailableUOM) && DataUtils.isUndefined(options.qtyAvailable))
          || (DataUtils.isDefined(options.qtyAvailable) && DataUtils.isUndefined(options.qtyAvailableUOM))) {
            err = new Error(ErrorConfig.MESSAGE.QTY_ON_AVAILABLE_AND_UOM_BOTH_REQUIRED);
        } else if ((DataUtils.isDefined(options.qtyInTransitUOM) && DataUtils.isUndefined(options.qtyInTransit))
          || (DataUtils.isDefined(options.qtyInTransit) && DataUtils.isUndefined(options.qtyInTransitUOM))) {
            err = new Error(ErrorConfig.MESSAGE.QTY_ON_TRANSIT_AND_UOM_BOTH_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        if (isRealTimeFrequency) {
            var response = await SupplyInventory.getConditionString(options);
            conditionString = response.string;
            conditionValues = response.values;
        }

        var supplyInventoryOption = {
            supplyInventoryId: supplyInventoryId,
            languageCultureCode: languageCultureCode,
            accountId: accountId
        };

        SupplyInventory.checkQuantity(options, function (err) {
            if (err) {
                debug('err', err);
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            SupplyInventory.getSupplyInventory(supplyInventoryOption, errorOptions, function (err, supplyInventory) {
                if (err) {
                    debug('err', err);
                    ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
                options.qtyOnHandUOM = options.qtyOnHandUOM ? options.qtyOnHandUOM : supplyInventory.qtyOnHandUOM;
                options.qtyOnOrderUOM = options.qtyOnOrderUOM ? options.qtyOnOrderUOM : supplyInventory.qtyOnOrderUOM;
                options.qtyAvailableUOM = options.qtyAvailableUOM ? options.qtyAvailableUOM : supplyInventory.qtyAvailableUOM;
                options.qtyInTransitUOM = options.qtyInTransitUOM ? options.qtyInTransitUOM : supplyInventory.qtyInTransitUOM;

                debug('hefjkf');
                ProductInventoryApi.validateQuantity(options, async function (err, response) {
                    if (err) {
                        debug('err1234', err);
                        ErrorUtils.create(errorOptions, options, err);
                        return cb(err);
                    }
                    options.qtyOnHand = response.qtyOnHand;
                    options.qtyOnOrder = response.qtyOnOrder;
                    options.qtyAvailable = response.qtyAvailable;
                    options.qtyInTransit = response.qtyInTransit;

                    try {
                        var updateResponse = await SupplyInventory.updateSupplyInventory(options);
                        if (!options.isMultiple) {
                            AuditUtils.create(auditOptions);
                        }

                        if (isRealTimeFrequency && conditionValues.length > 0) {
                            // Check if any outshare is exist with item or not

                            var checkOutShareOptions = {
                                itemId: supplyInventoryId,
                                accountId: accountId,
                                shareItemType: Constants.SHARING_TYPE.supplyInventory,
                                conditionString: conditionString,
                                conditionValues: conditionValues
                            };
                            debug('checkOutShareOptions', checkOutShareOptions);
                            var realTimeOutShares = await OutSharingApi.checkRealTimeOutShare(checkOutShareOptions);

                            debug('realTimeOutShares', realTimeOutShares);
                            if (realTimeOutShares.length > 0) {
                                var shareOptions = {
                                    realTimeOutShares: realTimeOutShares,
                                    shareItemId: supplyInventoryId
                                };
                                var apiResponse = ProductInventoryApi.buildTask(shareOptions);

                                debug('API COMPLTETED', apiResponse);
                            }
                        }
                        return cb(null, updateResponse);
                    } catch (err) {
                        debug('err', err);
                        ErrorUtils.create(errorOptions, options, err);
                        return cb(err);
                    }
                });
            });
        });
    },

    getSupplyInventoriesByAccount: async function (options, errorOptions, cb) {
        var user = options.user;
        var accountId = user.accountId;
        var isActive = options.isActive;
        var languageCultureCode = user.languageCultureCode;
        var err;

        if (DataUtils.isUndefined(isActive)) {
            err = new Error(ErrorConfig.MESSAGE.IS_ACTIVE_FIELD_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();

            var supplyInventories = await conn.query(' select CAST(uuid_from_bin(s.id) as CHAR) as id ,CAST(uuid_from_bin(s.accountId) as CHAR) as accountId ,' +
              ' CAST(uuid_from_bin(s.supplyItemId) as CHAR) as supplyItemId , s.SKU,' +
              ' SI.sellerSKUName, s.locationId, LR.locationName, ' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(s.qtyOnHand/CAST(power(10,US1.scalingPrecision) as INTEGER))))) as qtyOnHand, ' +
              ' UN1.symbol as qtyOnHandUOMSymbol, ' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(s.qtyOnOrder/CAST(power(10,US2.scalingPrecision) as INTEGER))))) as qtyOnOrder, ' +
              ' UN2.symbol as qtyOnOrderUOMSymbol, ' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(s.qtyAvailable/CAST(power(10,US3.scalingPrecision) as INTEGER))))) as qtyAvailable, ' +
              ' UN3.symbol as qtyAvailableUOMSymbol, ' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(s.qtyInTransit/CAST(power(10,US4.scalingPrecision) as INTEGER))))) as qtyInTransit, ' +
              ' UN4.symbol as qtyInTransitUOMSymbol,' +
              ' s.notes,s.isRealTimeFrequency,s.status,s.updatedAt ' +
              ' from ' +
              ' SupplyInventory as s, uomNames UN1, uomNames UN2, uomNames UN3, uomNames UN4,' +
              ' uomScaling as US1, uomScaling as US2, uomScaling as US3, uomScaling as US4 , LocationReference LR, SupplyItems SI ' +
              ' where ' +
              ' s.status = ? and ' +
              ' s.qtyOnHandUOM = US1.id and ' +
              ' s.qtyOnOrderUOM = US2.id and ' +
              ' s.qtyAvailableUOM = US3.id and ' +
              ' s.qtyInTransitUOM = US4.id and ' +
              ' s.locationId = LR.locationId and' +
              ' s.supplyItemId = SI.id and ' +
              ' (UN1.uomScalingId = s.qtyOnHandUoM and UN1.languageCultureCode = ?) and ' +
              ' (UN2.uomScalingId = s.qtyOnOrderUoM and UN2.languageCultureCode = ?) and ' +
              ' (UN3.uomScalingId = s.qtyAvailableUoM and UN3.languageCultureCode = ?) and ' +
              ' (UN4.uomScalingId = s.qtyInTransitUoM  and UN4.languageCultureCode = ?) and ' +
              ' s.accountId=uuid_to_bin(?) and ' +
              ' LR.accountId=uuid_to_bin(?) order by s.updatedAt desc limit 10',
              [isActive, languageCultureCode, languageCultureCode, languageCultureCode, languageCultureCode, accountId, accountId]);
            //supplyInventories = Utils.filteredResponsePool(supplyInventories);

            if (!supplyInventories) {
                var array = [];
                return cb(null, array);
            }

            return cb(null, supplyInventories);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    validateSupplyInventory: async function (supplyInventories, cb) {
        var err;
        try {
            await Promise.each(supplyInventories, async function (supplyInventory) {
                if (DataUtils.isUndefined(supplyInventory.id)) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_ID_REQUIRED);
                } else if (DataUtils.isUndefined(supplyInventory.updatedAt)) {
                    err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_REQUIRED);
                } else if (!DataUtils.isValidNumber(supplyInventory.updatedAt)) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_UPDATED_AT_MUST_BE_NUMBER);
                } else if (supplyInventory.updatedAt.toString().length !== 13) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_UPDATED_AT_INVALID);
                } else if (DataUtils.isDefined(supplyInventory.locationId)) {
                    err = new Error(ErrorConfig.MESSAGE.LOCATION_CAN_NOT_BE_UPDATE);
                } else if ((DataUtils.isDefined(supplyInventory.qtyOnHandUOM) && DataUtils.isUndefined(supplyInventory.qtyOnHand))
                  || (DataUtils.isDefined(supplyInventory.qtyOnHand) && DataUtils.isUndefined(supplyInventory.qtyOnHandUOM))) {
                    err = new Error(ErrorConfig.MESSAGE.QTY_ON_HAND_AND_UOM_BOTH_REQUIRED);
                } else if ((DataUtils.isDefined(supplyInventory.qtyOnOrderUOM) && DataUtils.isUndefined(supplyInventory.qtyOnOrder))
                  || (DataUtils.isDefined(supplyInventory.qtyOnOrder) && DataUtils.isUndefined(supplyInventory.qtyOnOrderUOM))) {
                    err = new Error(ErrorConfig.MESSAGE.QTY_ON_ORDER_AND_UOM_BOTH_REQUIRED);
                } else if ((DataUtils.isDefined(supplyInventory.qtyAvailableUOM) && DataUtils.isUndefined(supplyInventory.qtyAvailable))
                  || (DataUtils.isDefined(supplyInventory.qtyAvailable) && DataUtils.isUndefined(supplyInventory.qtyAvailableUOM))) {
                    err = new Error(ErrorConfig.MESSAGE.QTY_ON_AVAILABLE_AND_UOM_BOTH_REQUIRED);
                } else if ((DataUtils.isDefined(supplyInventory.qtyInTransitUOM) && DataUtils.isUndefined(supplyInventory.qtyInTransit))
                  || (DataUtils.isDefined(supplyInventory.qtyInTransit) && DataUtils.isUndefined(supplyInventory.qtyInTransitUOM))) {
                    err = new Error(ErrorConfig.MESSAGE.QTY_ON_TRANSIT_AND_UOM_BOTH_REQUIRED);
                }
                if (err) {
                    throw err;
                }
            });
            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
    },

    updatePromise: function (options, auditOptions, errorOptions) {
        return new Promise(async function (resolve, reject) {
            SupplyInventory.update(options, auditOptions, errorOptions, function (err, response) {
                if (err) {
                    debug('err', err);
                    return reject(err);
                }
                return resolve(response);
            });
        });
    },

    updateInventories: async function (options, auditOptions, errorOptions, cb) {
        var supplyInventories = options.supplyInventories;
        var user = options.user;
        var accountId = user.accountId;
        var err;
        if (_.isEmpty(supplyInventories)) {
            err = new Error(ErrorConfig.MESSAGE.INVALID_REQUEST);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        var supplyInventoryResponse = {};
        var successSupplyInventory = [];
        var failSupplyInventory = [];

        SupplyInventory.validateSupplyInventory(supplyInventories, async function (err, response) {
            if (err || !response) {
                debug('err', err);
                return cb(err);
            }
            if (response) {
                await Promise.each(supplyInventories, async function (supplyInventory) {
                    supplyInventory.isMultiple = true;
                    supplyInventory.userId = user.id;
                    supplyInventory.languageCultureCode = user.languageCultureCode;
                    supplyInventory.accountId = accountId;
                    supplyInventory.userId = user.id;
                    supplyInventory.supplyInventoryId = supplyInventory.id;

                    try {
                        debug('1');
                        var inventoryResponse = await SupplyInventory.updatePromise(supplyInventory, auditOptions, errorOptions);
                        if (!inventoryResponse) {
                            failSupplyInventory.push({id: supplyInventory.id});
                        }
                        if (inventoryResponse) {
                            successSupplyInventory.push({
                                id: supplyInventory.id,
                                updatedAt: inventoryResponse.updatedAt
                            });
                        }
                    } catch (err) {
                        debug('2');
                        debug('err', err);
                        failSupplyInventory.push({
                            id: supplyInventory.id,
                            updatedAt: supplyInventory.updatedAt
                        });
                    }
                });
                if (successSupplyInventory.length !== 0 && failSupplyInventory.length === 0) {
                    supplyInventoryResponse.OK = Constants.SUCCESS_MESSAGE.SUPPLY_INVENTORY_UPDATED_SUCCESSFULLY;
                    supplyInventoryResponse.status = ErrorConfig.STATUS_CODE.SUCCESS;
                    supplyInventoryResponse.success = successSupplyInventory;
                    return cb(null, supplyInventoryResponse);
                } else {
                    supplyInventoryResponse = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_UPDATE_FAILED);
                    supplyInventoryResponse.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    supplyInventoryResponse.data = {
                        success: successSupplyInventory,
                        conflict: failSupplyInventory
                    };
                    return cb(supplyInventoryResponse);
                }
            }
        });
    },

    /*
    * validate request of delete multiple supply Inventory
    * */
    validateSupplyInventories: function (options) {
        return new Promise(async function (resolve, reject) {
            var supplyInventories = options.supplyInventories;
            var err;

            try {
                if (DataUtils.isUndefined(supplyInventories)) {
                    err = new Error(ErrorConfig.MESSAGE.ID_REQUIRED);
                } else if (!DataUtils.isArray(supplyInventories)) {
                    err = new Error(ErrorConfig.MESSAGE.ID_MUST_BE_ARRAY);
                } else if (supplyInventories.length <= 0) {
                    err = new Error(ErrorConfig.MESSAGE.ATLEAST_ONE_ID_REUQIRED);
                }
                if (err) {
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }

                await Promise.each(supplyInventories, async function (inventory) {
                    if (DataUtils.isUndefined(inventory.id)) {
                        err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_ID_REQUIRED);
                    } else if (DataUtils.isValidateOptionalField(inventory.updatedAt)) {
                        err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_UPDATED_AT_REQUIRED);
                    } else if (!DataUtils.isValidNumber(inventory.updatedAt)) {
                        err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_UPDATED_AT_MUST_BE_NUMBER);
                    } else if (inventory.updatedAt.toString().length !== 13) {
                        err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_UPDATED_AT_INVALID);
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

    /*
    * Get inventory id from array which is exist
    * */
    getExistInventoryIds: function (options) {
        return new Promise(async function (resolve, reject) {
            var supplyInventories = options.supplyInventories;
            var accountId = options.accountId;
            var status = options.status;
            var successInventories = [], conflictInventories = [];

            try {
                var conn = await connection.getConnection();

                var response = await ProductInventoryApi.manipulateInventoryIdQuery({list: supplyInventories});
                debug('response', response);

                var inventoryIds = await conn.query('select  CAST(uuid_from_bin(id) as CHAR) as id from SupplyInventory ' +
                  ' where accountId=uuid_to_bin(?) and status = ? and id in (' + response.string + ')', [accountId, status].concat(response.values));
                debug('inventoryIds', inventoryIds);

                inventoryIds = _.map(inventoryIds, 'id');

                if (inventoryIds.length > 0) {
                    _.map(supplyInventories, function (inventory) {
                        if (inventoryIds.indexOf(inventory.id) === -1) {
                            conflictInventories.push(inventory.id);
                        } else {
                            successInventories.push(inventory);
                        }
                    });
                } else {
                    conflictInventories = _.map(supplyInventories, 'id');
                }
                var inventoriesResponse = {
                    successInventories: successInventories,
                    conflictInventories: conflictInventories
                };

                return resolve(inventoriesResponse);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
    * check updatedAt for deleted supplyInventories
    * */
    checkUpdatedAt: function (options) {
        return new Promise(async function (resolve, reject) {
            var supplyInventories = options.supplyInventories;
            var accountId = options.accountId;
            var status = options.status;
            var string = '', values = [];
            var existInventories = [], notExistInventories = [];
            var conflict = [], success = [], failed = [];
            var conflictIds = [];

            try {
                var conn = await connection.getConnection();

                var getExistInventoryOption = {
                    supplyInventories: supplyInventories,
                    status: status,
                    accountId: accountId
                };
                var getExistInventoryResponse = await SupplyInventory.getExistInventoryIds(getExistInventoryOption);
                existInventories = getExistInventoryResponse.successInventories;
                conflict = getExistInventoryResponse.conflictInventories;
                failed = conflict.slice();

                if (existInventories.length <= 0) {
                    return resolve({success: success, conflict: conflict, failed: failed});
                }

                await Promise.each(existInventories, function (inventory) {
                    string += ' SELECT CAST(uuid_from_bin(id) as char) as id FROM SupplyInventory WHERE (updatedAt != ? AND id = uuid_to_bin(?)) UNION ALL ';
                    values.push(inventory.updatedAt, inventory.id);
                });
                string = string.replace(/UNION ALL \s*$/, ' ');

                var response = await conn.query(string, values);

                conflictIds = _.map(response, function (value) {
                    return value.id;
                });

                _.map(existInventories, function (inventory) {
                    if (conflictIds.indexOf(inventory.id) === -1) {
                        success.push(inventory.id);
                    } else {
                        conflict.push(inventory.id);
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
    * delete multiple supply inventories
    * */
    updateStatusMultipleInventories: function (options) {
        return new Promise(async function (resolve, reject) {
            var supplyInventories = options.supplyInventories;
            var accountId = options.accountId;
            var status = options.status;
            var currentDate = DataUtils.getEpochMSTimestamp();
            var err;

            try {
                var conn = await connection.getConnection();

                var queryResponse = await ProductInventoryApi.manipulateInventoryQuery({list: supplyInventories});
                debug('queryResponse', queryResponse);

                var isDeleted = await conn.query('update SupplyInventory set status = ?,updatedAt=? ' +
                  'where accountId = uuid_to_bin(?) and id in (' + queryResponse.string + ');',
                  [status, currentDate, accountId].concat(queryResponse.values));

                isDeleted = Utils.isAffectedPool(isDeleted);

                if (!isDeleted) {
                    if (status === Constants.SUPPLY_INVENTORY_STATUS.IN_ACTIVE) {
                        err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_ARCHIEVE_FAILED);
                    } else {
                        err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_RESTORE_FAILED);
                    }
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                if (status === Constants.SUPPLY_INVENTORY_STATUS.IN_ACTIVE) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_ARCHIEVE_FAILED);
                } else {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_RESTORE_FAILED);
                }
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    deleteInventories: async function (options, auditOptions, errorOptions, cb) {
        var supplyInventories = options.supplyInventories;
        var accountId = options.accountId;
        var userId = options.userId;
        var successSupplyInventories, conflictSupplyInventories;
        var checkResponses = [];
        var err;

        try {
            //validate request of delete multiple supply Inventory
            debug('supplyInventories', supplyInventories);
            var checkOption = {
                supplyInventories: supplyInventories
            };
            var checkResponse = await SupplyInventory.validateSupplyInventories(checkOption);
            debug('checkResponse', checkResponse);

        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        //START TRANSACTION
        try {
            var conn = await connection.getConnection();
            await conn.query('START TRANSACTION;');
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        try {
            // check updatedAt of product inventories
            var response = await SupplyInventory.checkUpdatedAt({
                supplyInventories: supplyInventories,
                status: Constants.SUPPLY_INVENTORY_STATUS.ACTIVE,
                accountId: accountId
            });
            debug('response', response);
            successSupplyInventories = response.success;
            conflictSupplyInventories = response.conflict;

            if (successSupplyInventories.length <= 0 && conflictSupplyInventories.length > 0) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORIES_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {success: successSupplyInventories, conflict: conflictSupplyInventories};
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            } else if (successSupplyInventories.length <= 0 && conflictSupplyInventories.length <= 0) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORIES_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {success: successSupplyInventories, conflict: conflictSupplyInventories};
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }

            // Check if any out share or inshare is exist for each parter , if yes then stop sharing for those partner
            await Promise.each(successSupplyInventories, async function (inventory) {
                var checkOptions = {
                    id: inventory,
                    accountId: accountId,
                    userId: userId,
                    flag: false
                };
                var checkResponse = await ProductInventoryApi.checkUpdateOutShares(checkOptions);
                if (checkResponse) {
                    checkResponses.push(checkResponse);
                }

                if (checkResponse.inShareIds) {
                    // Update InShare Alert (status = 0)
                    var updateAlertOptions = {
                        shareItemId: inventory,
                        inShareIds: checkResponse.inShareIds,
                        status: Constants.ALERT_STATUS.IN_ACTIVE
                    };
                    debug('updateAlertOptions', updateAlertOptions);
                    var updateAlertResponse = await SupplyItemApi.updateInShareAlert(updateAlertOptions);
                    debug('updateAlertResponse', updateAlertResponse);
                }

            });

            // delete product inventories (status = 0 )
            var deleteOption = {
                supplyInventories: successSupplyInventories,
                status: Constants.PRODUCT_INVENTORY_STATUS.IN_ACTIVE,
                accountId: accountId
            };
            var deleteResponse = await SupplyInventory.updateStatusMultipleInventories(deleteOption);
            debug('deleteResponse', deleteResponse);

            // NOTIFY the all inShare partners of the affected outshare
            debug('checkResponse', checkResponses);
            var notifyOption = {
                checkResponses: checkResponses,
                userId: userId
            };
            var notifyResponse = await ProductInventoryApi.notifyInSharePartner(notifyOption);

            await conn.query('COMMIT;');
            AuditUtils.create(auditOptions);
            if (successSupplyInventories.length > 0 && conflictSupplyInventories.length > 0) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORIES_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {
                    successMsg: Constants.SUCCESS_MESSAGE.SUPPLY_INVENTORY_ARCHIEVED_SUCCESSFULLY,
                    success: successSupplyInventories,
                    conflict: conflictSupplyInventories
                };
                debug('err', err);
                return cb(err);
            } else {
                //await conn.query('COMMIT;');
                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.SUPPLY_INVENTORY_ARCHIEVED_SUCCESSFULLY,
                    success: successSupplyInventories
                });
            }
        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK;');
            ErrorUtils.create(errorOptions, options, err);
            err = err || new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_ARCHIEVE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    /*
    * delete archived multiple supply inventories
    * */
    deleteArchivedMultipleInventories: function (options) {
        return new Promise(async function (resolve, reject) {
            var supplyInventories = options.supplyInventories;
            var accountId = options.accountId;
            var err;

            try {
                var conn = await connection.getConnection();

                var queryResponse = await ProductInventoryApi.manipulateInventoryQuery({list: supplyInventories});
                debug('queryResponse', queryResponse);

                var isDeleted = await conn.query('delete from SupplyInventory where accountId = uuid_to_bin(?) and status = 0 ' +
                  ' and id in (' + queryResponse.string + ');',
                  [accountId].concat(queryResponse.values));

                isDeleted = Utils.isAffectedPool(isDeleted);

                if (!isDeleted) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_DELETE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_DELETE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    deleteArchieveInventories: async function (options, auditOptions, errorOptions, cb) {
        var supplyInventories = options.supplyInventories;
        var accountId = options.accountId;
        var successSupplyInventories, conflictSupplyInventories;
        var err;

        try {
            //validate request of delete multiple product Inventory
            var checkOption = {
                supplyInventories: supplyInventories
            };
            var checkResponse = await SupplyInventory.validateSupplyInventories(checkOption);
            debug('checkResponse', checkResponse);

        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        //START TRANSACTION
        try {
            var conn = await connection.getConnection();
            await conn.query('START TRANSACTION;');
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        try {
            // check updatedAt of supply inventories
            var response = await SupplyInventory.checkUpdatedAt({
                supplyInventories: supplyInventories,
                status: Constants.SUPPLY_INVENTORY_STATUS.IN_ACTIVE,
                accountId: accountId
            });
            debug('response', response);
            successSupplyInventories = response.success;
            conflictSupplyInventories = response.conflict;

            if (successSupplyInventories.length <= 0 && conflictSupplyInventories.length > 0) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORIES_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {success: successSupplyInventories, conflict: conflictSupplyInventories};
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            } else if (successSupplyInventories.length <= 0 && conflictSupplyInventories.length <= 0) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORIES_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {success: successSupplyInventories, conflict: conflictSupplyInventories};
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }

            // delete supply inventories (status = 0 )
            var deleteOption = {
                supplyInventories: successSupplyInventories,
                accountId: accountId
            };
            var deleteResponse = await SupplyInventory.deleteArchivedMultipleInventories(deleteOption);
            debug('deleteResponse', deleteResponse);

            await conn.query('COMMIT;');
            AuditUtils.create(auditOptions);
            if (successSupplyInventories.length > 0 && conflictSupplyInventories.length > 0) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORIES_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {
                    successMsg: Constants.SUCCESS_MESSAGE.SUPPLY_INVENTORY_DELETED_SUCCESSFULLY,
                    success: successSupplyInventories,
                    conflict: conflictSupplyInventories
                };
                debug('err', err);
                return cb(err);
            } else {
                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.SUPPLY_INVENTORY_DELETED_SUCCESSFULLY,
                    success: successSupplyInventories
                });
            }
        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK;');
            ErrorUtils.create(errorOptions, options, err);
            err = err || new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_DELETE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    restoreArchiveInventories: async function (options, auditOptions, errorOptions, cb) {
        var supplyInventories = options.supplyInventories;
        var accountId = options.accountId;
        var successSupplyInventories, conflictSupplyInventories;
        var err;

        try {
            //validate request of restore multiple supply Inventory
            var checkOption = {
                supplyInventories: supplyInventories
            };
            var checkResponse = await SupplyInventory.validateSupplyInventories(checkOption);
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        //START TRANSACTION
        try {
            var conn = await connection.getConnection();
            await conn.query('START TRANSACTION;');
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        try {
            // check updatedAt of supply inventories
            var response = await SupplyInventory.checkUpdatedAt({
                supplyInventories: supplyInventories,
                status: Constants.SUPPLY_INVENTORY_STATUS.IN_ACTIVE,
                accountId: accountId
            });
            successSupplyInventories = response.success;
            conflictSupplyInventories = response.conflict;

            if (successSupplyInventories.length <= 0 && conflictSupplyInventories.length > 0) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORIES_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {success: successSupplyInventories, conflict: conflictSupplyInventories};
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            } else if (successSupplyInventories.length <= 0 && conflictSupplyInventories.length <= 0) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORIES_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {success: successSupplyInventories, conflict: conflictSupplyInventories};
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }

            // restore supply inventories (status = 1 )
            var restoreOption = {
                supplyInventories: successSupplyInventories,
                status: Constants.SUPPLY_INVENTORY_STATUS.ACTIVE,
                accountId: accountId
            };
            var restoreResponse = await SupplyInventory.updateStatusMultipleInventories(restoreOption);
            debug('restoreResponse', restoreResponse);

            await conn.query('COMMIT;');
            AuditUtils.create(auditOptions);
            if (successSupplyInventories.length > 0 && conflictSupplyInventories.length > 0) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORIES_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {
                    successMsg: Constants.SUCCESS_MESSAGE.SUPPLY_INVENTORY_RESTORED_SUCCESSFULLY,
                    success: successSupplyInventories,
                    conflict: conflictSupplyInventories
                };
                debug('err', err);
                return cb(err);
            } else {
                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.SUPPLY_INVENTORY_RESTORED_SUCCESSFULLY,
                    success: successSupplyInventories
                });
            }
        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK;');
            ErrorUtils.create(errorOptions, options, err);
            err = err || new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_RESTORE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    getSupplyInventoryByQtyUoM: function (options) {
        return new Promise(async function (resolve, reject) {
            var accountId = options.accountId;
            var qtyUoMId = options.qtyUoMId;

            try {
                var conn = await connection.getConnection();
                var supplyInventories = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id,isRealTimeFrequency ' +
                  'from SupplyInventory where accountId= uuid_to_bin(?) and (qtyOnHandUoM = ? && qtyOnHand != 0) ' +
                  'OR (qtyOnOrderUoM = ? && qtyOnOrder != 0) OR (qtyAvailableUoM = ? && qtyAvailable != 0) ',
                  [accountId, qtyUoMId, qtyUoMId, qtyUoMId]);
                return resolve(supplyInventories);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    searchSupplyInventories: async function (options, errorOptions, cb) {
        var user = options.user;
        var accountId = user.accountId;
        var isActive = options.isActive;
        var sku = options.sku;
        var locationId = options.locationId;
        var languageCultureCode = user.languageCultureCode;
        var checkString = '', whereString = '', queryString = '';
        var checkValues = [];
        var queryValues = [isActive, languageCultureCode, languageCultureCode, languageCultureCode, languageCultureCode, accountId, accountId];
        var err;

        if (DataUtils.isUndefined(isActive)) {
            err = new Error(ErrorConfig.MESSAGE.IS_ACTIVE_FIELD_REQUIRED);
        } else if (DataUtils.isUndefined(sku) && DataUtils.isUndefined(locationId)) {
            err = new Error(ErrorConfig.MESSAGE.AT_LEASE_ONE_SEARCH_ATTRIBUTE_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            if (DataUtils.isDefined(sku)) {
                checkString += ' sku like ? and ';
                whereString += ' s.sku like ? and ';
                checkValues.push('%' + sku + '%');
            }
            if (DataUtils.isDefined(locationId)) {
                checkString += ' locationId like ?  and ';
                whereString += ' s.locationId like ? and ';
                checkValues.push('%' + locationId + '%');
            }
            checkString = checkString.replace(/and\s*$/, '');
            whereString = whereString.replace(/and\s*$/, '');

            var conn = await connection.getConnection();

            queryString = 'IF (select count(id) from SupplyInventory where accountId = uuid_to_bin(?) and ' +
              ' status= ? and ' + checkString + ') > ? THEN ' +
              ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "ROW_COUNT_EXCEED_PLEASE_USE_SEARCH_AND_FILTER", MYSQL_ERRNO = 4001; ' +
              ' ELSE select CAST(uuid_from_bin(s.id) as CHAR) as id ,CAST(uuid_from_bin(s.accountId) as CHAR) as accountId ,' +
              ' CAST(uuid_from_bin(s.supplyItemId) as CHAR) as supplyItemId , s.SKU,' +
              ' SI.sellerSKUName, s.locationId, LR.locationName, ' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(s.qtyOnHand/CAST(power(10,US1.scalingPrecision) as INTEGER))))) as qtyOnHand, ' +
              ' UN1.symbol as qtyOnHandUOMSymbol, ' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(s.qtyOnOrder/CAST(power(10,US2.scalingPrecision) as INTEGER))))) as qtyOnOrder, ' +
              ' UN2.symbol as qtyOnOrderUOMSymbol, ' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(s.qtyAvailable/CAST(power(10,US3.scalingPrecision) as INTEGER))))) as qtyAvailable, ' +
              ' UN3.symbol as qtyAvailableUOMSymbol, ' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(s.qtyInTransit/CAST(power(10,US4.scalingPrecision) as INTEGER))))) as qtyInTransit, ' +
              ' UN4.symbol as qtyInTransitUOMSymbol,' +
              ' s.notes,s.isRealTimeFrequency,s.status,s.updatedAt ' +
              ' from ' +
              ' SupplyInventory as s, uomNames UN1, uomNames UN2, uomNames UN3, uomNames UN4,' +
              ' uomScaling as US1, uomScaling as US2, uomScaling as US3, uomScaling as US4 , LocationReference LR, SupplyItems SI ' +
              ' where ' +
              ' s.status = ? and ' +
              ' s.qtyOnHandUOM = US1.id and ' +
              ' s.qtyOnOrderUOM = US2.id and ' +
              ' s.qtyAvailableUOM = US3.id and ' +
              ' s.qtyInTransitUOM = US4.id and ' +
              ' s.locationId = LR.locationId and' +
              ' s.supplyItemId = SI.id and ' +
              ' (UN1.uomScalingId = s.qtyOnHandUoM and UN1.languageCultureCode = ?) and ' +
              ' (UN2.uomScalingId = s.qtyOnOrderUoM and UN2.languageCultureCode = ?) and ' +
              ' (UN3.uomScalingId = s.qtyAvailableUoM and UN3.languageCultureCode = ?) and ' +
              ' (UN4.uomScalingId = s.qtyInTransitUoM  and UN4.languageCultureCode = ?) and ' +
              ' s.accountId=uuid_to_bin(?) and ' +
              ' LR.accountId=uuid_to_bin(?) and ' + whereString + '; END IF;';

            debug('queryString', queryString);
            var supplyInventories = await conn.query(queryString,
              [accountId, parseInt(isActive)].concat(checkValues, [Constants.ROW_LIMIT], queryValues, checkValues));
            supplyInventories = Utils.filteredResponsePool(supplyInventories);

            if (!supplyInventories) {
                var array = [];
                return cb(null, array);
            }

            return cb(null, supplyInventories);
        } catch (err) {
            debug('err', err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.ROW_COUNT_EXCEED_PLEASE_USE_SEARCH_AND_FILTER);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    }
};
module.exports = SupplyInventory;