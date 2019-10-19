/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.api.bill_of_materials');
var Async = require('async');
var Util = require('util');

var connection = require('../lib/connection_util');
var Constants = require('../data/constants');
var AuditUtils = require('../lib/audit_utils');
var DataUtils = require('../lib/data_utils');
var ErrorConfig = require('../data/error');
var _ = require('lodash');
var Promise = require('bluebird');
var Utils = require('../lib/utils');
var knex = require('../lib/knex_util');
var ErrorUtils = require('../lib/error_utils');

var BillOfMaterials = {

    /*
    * Get supply item by accountid and sku
    * */
    getSupplyItemByaccoutIdSKU: async function (options, cb) {
        var accountId = options.accountId;
        var supplyItemId = options.supplyItemId;
        var err;
        if (!accountId || !supplyItemId) {
            return cb();
        }
        try {
            var conn = await connection.getConnection();
            var supplyItem = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id, CAST(uuid_from_bin(accountId) as CHAR) as accountId, sku,' +
              'sellerSKUName, type, updatedAt  from SupplyItems where id = uuid_to_bin(?) and accountId = uuid_to_bin(?) ', [supplyItemId, accountId]);
            supplyItem = Utils.filteredResponsePool(supplyItem);
            if (!supplyItem) {
                throw err;
            }
            return cb(null, supplyItem);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_NOT_FOUND);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
    },

    /*
    * Validate and populate quantity
    * */

    validateQuantityMD: function (quantity, cb) {
        var err;
        var tempQuantity = quantity;
        var precision;
        if (tempQuantity > Constants.MAX_SUPPLY_ITEM_QANTITY) {
            err = new Error(ErrorConfig.MESSAGE.INVALID_SUPPLY_ITEM_QUANTITY);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
        if (tempQuantity.toString().indexOf('.') !== -1) {
            debug('inside if');
            precision = tempQuantity.toString().split('.')[1];
            if (precision.length > Constants.MAX_SUPPLY_ITEM_PRECISION) {
                tempQuantity = tempQuantity.toFixed(Constants.MAX_SUPPLY_ITEM_PRECISION);
                tempQuantity = tempQuantity.toString().replace('.', '');
            }
            else if (precision.length < Constants.MAX_SUPPLY_ITEM_PRECISION) {
                var zeros = Constants.MAX_SUPPLY_ITEM_PRECISION - precision.length;
                tempQuantity = tempQuantity.toString().replace('.', '');
                tempQuantity = tempQuantity * (Constants.PRECISION[zeros]);
            }
            else if (precision.length === Constants.MAX_SUPPLY_ITEM_PRECISION) {
                tempQuantity = tempQuantity.toString().replace('.', '');
            }
            quantity = tempQuantity;
        }
        else if (tempQuantity.toString().indexOf('.') === -1) {
            debug('inside else');
            tempQuantity = tempQuantity * Constants.PRECISION[Constants.MAX_SUPPLY_ITEM_PRECISION];
            quantity = tempQuantity;
        }
        return cb(null, quantity);
    },

    /*
    * Validate BOM fields
    * */
    validateOptionalFields: function (options, cb) {
        var err;
        var billOfMaterialFields = '';
        var billOfMaterialOptionalValues = [];

        try {
            if (!DataUtils.isValidateOptionalField(options.quantity)) {
                if (!DataUtils.isMobile(options.quantity)) {
                    throw err = new Error(ErrorConfig.MESSAGE.QUANTITY_MUST_BE_IN_NUMBER);
                }
                else {
                    BillOfMaterials.validateQuantityMD(options.quantity, function (err, quantity) {
                        if (err) {
                            debug('err', err);
                            throw err;
                        }
                        billOfMaterialFields += 'quantity=? ,';
                        billOfMaterialOptionalValues.push(quantity);
                    });
                }
            }
            if (!DataUtils.isValidateOptionalField(options.productRefId)) {
                billOfMaterialFields += 'productRefId=? ,';
                billOfMaterialOptionalValues.push(options.productRefId);
            }
            if (!DataUtils.isValidateOptionalField(options.supplyItemSKU)) {
                if (!DataUtils.isNumber(options.supplyItemSKU)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_SKU_MUST_BE_STRING);
                }
                else if (options.supplyItemSKU.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_SKU_MUST_BE_LESS_THAN_30_CHARACTER);
                }
                billOfMaterialFields += 'supplyItemSKU=? ,';
                billOfMaterialOptionalValues.push(options.supplyItemSKU);
            }
            if (!DataUtils.isValidateOptionalField(options.qtyUOM)) {
                if (!DataUtils.isNumber(options.qtyUOM)) {
                    throw err = new Error(ErrorConfig.MESSAGE.QTY_UOM_MUST_BE_NUMBER);
                }
                else if (options.qtyUOM.toString().length > 11) {
                    throw err = new Error(ErrorConfig.MESSAGE.QTY_UOM_MUST_BE_LESS_THAN_11_DIGIT);
                }
                billOfMaterialFields += 'qtyUOM=? ,';
                billOfMaterialOptionalValues.push(options.qtyUOM);
            }
            var response = {
                billOfMaterialFields: billOfMaterialFields,
                billOfMaterialOptionalValues: billOfMaterialOptionalValues
            };
            return cb(null, response);
        }
        catch (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
    },

    /*
    * Create BOM
    * */
    createBillOfMaterialMD: function (options, errorOptions, cb) {
        var user = options.user;
        var accountId = user.accountId;
        var productRefId = options.productRefId;
        var supplyItemId = options.supplyItemId;
        var generatedId = Utils.generateId();
        var qtyUOM = options.qtyUOM;
        var createdAt = DataUtils.getEpochMSTimestamp();
        var updatedAt = DataUtils.getEpochMSTimestamp();

        BillOfMaterials.validateQuantityMD(options.quantity, async function (err, quantity) {
            if (err) {
                debug('err', err);
                return cb(err);
            }
            debug('quantity', quantity);
            options.quantity = quantity;
            debug('');
            try {
                var conn = await connection.getConnection();
                var isCreated = await conn.query('IF (select 1 from BillOfMaterial where accountId=uuid_to_bin(?) and ' +
                  ' productRefId = uuid_to_bin(?) and supplyItemId=uuid_to_bin(?) and effectiveToDateTime=?) is null then ' +
                  ' insert into BillOfMaterial set id=uuid_to_bin(?), accountId=uuid_to_bin(?), productRefId = uuid_to_bin(?), ' +
                  ' supplyItemId=uuid_to_bin(?),quantity=?, qtyUOM=?, createdAt=?, updatedAt=?, ' +
                  ' createdBy=uuid_to_bin(?);END IF', [accountId, productRefId, supplyItemId, Constants.DEFAULT_DATE, generatedId.uuid,
                    accountId, productRefId, supplyItemId, options.quantity, qtyUOM, createdAt, updatedAt, user.id]);
                isCreated = Utils.isAffectedPool(isCreated);
                if (!isCreated) {
                    debug('err', err);
                    err = new Error(ErrorConfig.MESSAGE.BILL_OF_MATERIAL_ALREADY_EXIST);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    await ErrorUtils.create(errorOptions, options, err);
                    debug('err', err);
                    return cb(err);
                }
                return cb(null, {
                    OK: Constants.SUCCESS,
                    id: generatedId.uuid,
                    createdAt: createdAt
                });
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.BILL_OF_MATERIAL_CREATION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
        });
    },

    createMD: async function (options, auditOptions, errorOptions, cb) {
        var productRefId = options.productRefId;
        var supplyItemId = options.supplyItemId;
        var quantity = options.quantity;
        var supplyItemUpdatedAt = options.supplyItemUpdatedAt;
        var accountId = options.accountId;
        var qtyUOM = options.qtyUOM;
        var err;


        if (DataUtils.isUndefined(productRefId)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_ID_REQUIRED);
        } else if (DataUtils.isValidateOptionalField(qtyUOM)) {
            err = new Error(ErrorConfig.MESSAGE.QTY_UOM_REQUIRED);
        } else if (DataUtils.isUndefined(supplyItemId)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_ID_REQUIRED);
        } else if (DataUtils.isUndefined(quantity)) {
            err = new Error(ErrorConfig.MESSAGE.QUANTITY_REQUIRED);
        } else if (!DataUtils.isMobile(quantity)) {
            err = new Error(ErrorConfig.MESSAGE.QUANTITY_MUST_BE_IN_NUMBER);
        } else if (DataUtils.isUndefined(supplyItemUpdatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(supplyItemUpdatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_UPDATED_AT_MUST_BE_NUMBER);
        } else if (supplyItemUpdatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_INVALID_UPDATED_AT);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            debug('err', err);
            return cb(err);
        }

        var supplyItemOption = {
            accountId: accountId,
            supplyItemId: supplyItemId
        };
        BillOfMaterials.getSupplyItemByaccoutIdSKU(supplyItemOption, async function (err, supplyItem) {
            if (err) {
                debug('err', err);
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            var supplyItemTimestamp = parseInt(supplyItem.updatedAt);
            supplyItemUpdatedAt = parseInt(supplyItemUpdatedAt);

            if (supplyItemUpdatedAt !== supplyItemTimestamp) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                return cb(err);
            }
            BillOfMaterials.createBillOfMaterialMD(options, errorOptions, async function (err, response) {
                if (err) {
                    debug('err', err);
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
                return cb(null, response);
            });
        });
    },

    getBillOfMaterialByIdMD: async function (option, cb) {
        var id = option.id;
        var err;

        try {
            var conn = await connection.getConnection();
            var billOfMaterial = await conn.query('select CAST(uuid_from_bin(B.id) as CHAR) as id ,' +
              ' CAST(uuid_from_bin(B.productRefId) as CHAR) as productRefId , CAST(uuid_from_bin(B.accountId) as CHAR) as accountId, ' +
              ' CAST(uuid_from_bin(B.supplyItemId) as CHAR) as supplyItemId , B.qtyUOM, ' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (B.quantity / CAST(power(10,6) as INTEGER))))) as quantity,' +
              ' B.updatedAt from BillOfMaterial B,SupplyItems S where B.id=uuid_to_bin(?) and S.id = B.supplyItemId ;', id);
            billOfMaterial = Utils.filteredResponsePool(billOfMaterial);
            if (!billOfMaterial) {
                throw err;
            }
            return cb(null, billOfMaterial);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.BILL_OF_MATERIAL_NOT_FOUND);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    updateBillOfMaterialMD: async function (options, errorOptions, cb) {
        var err;
        var user = options.user;
        var billOfMaterialFields = '';
        var billOfMaterialOptionalValues = [];
        var billOfMaterialRequiredValues = [];
        var id = options.id;
        var updatedAt = options.billOfMaterialTimestamp;
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();

        billOfMaterialRequiredValues.push(id, id, updatedAt);
        BillOfMaterials.validateOptionalFields(options, async function (err, response) {
            if (err) {
                debug('err', err);
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }

            billOfMaterialFields = response.billOfMaterialFields;
            billOfMaterialOptionalValues = response.billOfMaterialOptionalValues;

            billOfMaterialRequiredValues = _.concat(billOfMaterialRequiredValues, billOfMaterialOptionalValues);
            billOfMaterialRequiredValues.push(newUpdatedAt, user.id, newUpdatedAt, user.accountId, id);

            try {
                var conn = await connection.getConnection();
                var isUpdated = await conn.query('IF (select 1 from BillOfMaterial where id=uuid_to_bin(?) ) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "BILL_OF_MATERIAL_NOT_FOUND", MYSQL_ERRNO = 4001;' +
                  'ELSEIF (select 1 from BillOfMaterial where id=uuid_to_bin(?) and updatedAt=?) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "BILL_OF_MATERIAL_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
                  'ELSE update BillOfMaterial set ' + billOfMaterialFields + ' effectiveToDateTime=?, updatedBy=uuid_to_bin(?), updatedAt=?' +
                  ' where accountId=uuid_to_bin(?) and id=uuid_to_bin(?);end IF;', billOfMaterialRequiredValues);
                isUpdated = Utils.isAffectedPool(isUpdated);
                if (!isUpdated) {
                    err = new Error(ErrorConfig.MESSAGE.BILL_OF_MATERIAL_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return cb(err);
                }
                return cb(null, {
                    OK: Constants.SUCCESS,
                    billOfMaterialTimestamp: newUpdatedAt
                });
            } catch (err) {
                debug('err', err);
                await ErrorUtils.create(errorOptions, options, err);
                if (err.errno === 4001) {
                    err = new Error(ErrorConfig.MESSAGE.BILL_OF_MATERIAL_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return cb(err);
                } else if (err.errno === 4002) {
                    err = new Error(ErrorConfig.MESSAGE.BILL_OF_MATERIAL_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    return cb(err);
                } else {
                    err = new Error(ErrorConfig.MESSAGE.BILL_OF_MATERIAL_UPDATION_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return cb(err);
                }
            }
        });
    },

    updateMD: async function (options, auditOptions, errorOptions, cb) {
        var id = options.id;
        var user = options.user;
        var supplyItemId = options.supplyItemId;
        var accountId = options.accountId;
        var supplyItemTimestamp = options.supplyItemTimestamp;
        var billOfMaterialTimestamp = options.billOfMaterialTimestamp;
        var err;


        if (DataUtils.isUndefined(id)) {
            err = new Error(ErrorConfig.MESSAGE.BILL_OF_MATERIAL_ID_REQUIRED);
        } else if (DataUtils.isUndefined(supplyItemTimestamp)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(supplyItemTimestamp)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_UPDATED_AT_MUST_BE_NUMBER);
        } else if (supplyItemTimestamp.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_INVALID_UPDATED_AT);
        } else if (DataUtils.isUndefined(billOfMaterialTimestamp)) {
            err = new Error(ErrorConfig.MESSAGE.BILL_OF_MATERIAL_UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(billOfMaterialTimestamp)) {
            err = new Error(ErrorConfig.MESSAGE.BILL_OF_MATERIAL_UPDATED_AT_MUST_BE_NUMBER);
        } else if (billOfMaterialTimestamp.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.BILL_OF_MATERIAL_UPDATED_AT_INVALID);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        BillOfMaterials.getBillOfMaterialByIdMD({id: id}, async function (err, billOfMaterial) {
            if (err) {
                debug('err', err);
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            var supplyItemOption = {
                accountId: accountId || billOfMaterial.accountId,
                supplyItemId: supplyItemId || billOfMaterial.supplyItemId
            };
            BillOfMaterials.getSupplyItemByaccoutIdSKU(supplyItemOption, async function (err, supplyItem) {
                if (err) {
                    debug('err', err);
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
                var supplyItemUpdatedAt = parseInt(supplyItem.updatedAt);
                supplyItemTimestamp = parseInt(supplyItemTimestamp);

                if (supplyItemTimestamp !== supplyItemUpdatedAt) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    return cb(err);
                }
                try {
                    var conn = await connection.getConnection();
                    await conn.query('START TRANSACTION;');
                } catch (err) {
                    debug('err', err);
                    return cb(err);
                }
                BillOfMaterials.updateBillOfMaterialMD(options, errorOptions, async function (err, updateResponse) {
                    if (err) {
                        debug('err', err);
                        await conn.query('ROLLBACK;');
                        await ErrorUtils.create(errorOptions, options, err);
                        return cb(err);
                    }
                    // CREATE NEW BOM
                    var createBOMOption = {
                        user: user,
                        productRefId: billOfMaterial.productRefId,
                        supplyItemId: options.supplyItemId || billOfMaterial.supplyItemId,
                        quantity: options.quantity || billOfMaterial.quantity,
                        qtyUOM: options.qtyUOM || billOfMaterial.qtyUOM
                    };
                    BillOfMaterials.createBillOfMaterialMD(createBOMOption, errorOptions, async function (err, createResponse) {
                        if (err) {
                            debug('err', err);
                            await conn.query('ROLLBACK;');
                            await ErrorUtils.create(errorOptions, options, err);
                            return cb(err);
                        }
                        AuditUtils.create(auditOptions);
                        await conn.query('COMMIT;');
                        return cb(null, createResponse);
                    });
                });
            });
        });
    },

    getBillOfMaterialMD: async function (options, auditOptions, errorOptions, cb) {
        var err;
        var productRefId = options.productRefId;
        var accountId = options.accountId;
        var languageCultureCode = options.languageCultureCode;
        if (DataUtils.isUndefined(productRefId)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        try {
            //TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (longitude / CAST(power(10,16) as INTEGER))))) as longitude
            var conn = await connection.getConnection();
            var billOfMaterial = await conn.query('select CAST(uuid_from_bin(B.id) as CHAR) as id ,' +
              ' CAST(uuid_from_bin(B.productRefId) as CHAR) as productRefId, CAST(uuid_from_bin(B.accountId) as CHAR) as accountId, ' +
              ' CAST(uuid_from_bin(B.supplyItemId) as CHAR) as supplyItemId,S.sku as supplyItemSKU, UN.name, UN.symbol, B.qtyUOM,' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (B.quantity / CAST(power(10,6) as INTEGER))))) as quantity ,' +
              ' B.updatedAt as billOfMaterialUpdatedAt, S.sellerSKUName, S.updatedat as supplyItemUpdatedAt ' +
              ' from BillOfMaterial B, SupplyItems S,  uomNames UN ' +
              ' where B.productRefId=uuid_to_bin(?) and B.effectiveToDateTime=? and B.accountId = S.accountId and B.supplyItemId = S.id and B.qtyUOM = UN.uomScalingId ' +
              ' and UN.languageCultureCode = ?', [productRefId, Constants.DEFAULT_DATE, languageCultureCode]);

            if (!billOfMaterial) {
                billOfMaterial = [];
            }
            return cb(null, billOfMaterial);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.BILL_OF_MATERIAL_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    deleteMD: async function (options, auditOptions, errorOptions, cb) {
        var err;
        var id = options.id;
        var billOfMaterialTimestamp = options.billOfMaterialTimestamp;
        var currentDate = DataUtils.getEpochMSTimestamp();

        if (DataUtils.isUndefined(id)) {
            err = new Error(ErrorConfig.MESSAGE.BILL_OF_MATERIAL_ID_REQUIRED);
        } else if (DataUtils.isUndefined(billOfMaterialTimestamp)) {
            err = new Error(ErrorConfig.MESSAGE.BILL_OF_MATERIAL_UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(billOfMaterialTimestamp)) {
            err = new Error(ErrorConfig.MESSAGE.BILL_OF_MATERIAL_UPDATED_AT_MUST_BE_NUMBER);
        } else if (billOfMaterialTimestamp.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.BILL_OF_MATERIAL_UPDATED_AT_INVALID);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('err', err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var isDeleted = await conn.query('IF (select 1 from BillOfMaterial where id=uuid_to_bin(?)) is null then ' +
              'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "BILL_OF_MATERIAL_NOT_FOUND", MYSQL_ERRNO = 4001;' +
              'ELSEIF (select 1 from BillOfMaterial where id=uuid_to_bin(?) and updatedAt=?) is null then ' +
              'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "BILL_OF_MATERIAL_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
              'ELSE update BillOfMaterial set effectiveToDateTime=? where id = uuid_to_bin(?);end if;',
              [id, id, billOfMaterialTimestamp, currentDate, id]);
            isDeleted = Utils.isAffectedPool(isDeleted);
            if (!isDeleted) {
                err = new Error(ErrorConfig.MESSAGE.BILL_OF_MATERIAL_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                debug('err', err);
                throw err;
            }
            AuditUtils.create(auditOptions);
            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.BILL_OF_MATERIAL_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            } else if (err.errno === 4002) {
                err = new Error(ErrorConfig.MESSAGE.BILL_OF_MATERIAL_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                return cb(err);
            } else {
                err = new Error(ErrorConfig.MESSAGE.BILL_OF_MATERIAL_DELETION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
        }
    }
};


module.exports = BillOfMaterials;
