/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.api.product_inventory');
var Util = require('util');
var Async = require('async');
var path = require('path');
var fs = require('fs');
var csv = require('fast-csv');
var _ = require('lodash');
var i18n = require('i18n');
var Request = require('request-promise');
var zlib = require('zlib');

var connection = require('../lib/connection_util');
var DataUtils = require('../lib/data_utils');
var Utils = require('../lib/utils');
var FastCsvUtils = require('../lib/fast_csv_utils');
var ProductInventoryModel = require('../model/product_inventory');
var UnitOfMeasureNameModel = require('../model/unit_of_measure_name');
var OutSharingApi = require('../api/out_sharing');
var ProductReferenceApi = require('../api/product_reference');
var LocationReferenceApi = require('../api/location_reference');
var AuditUtils = require('../lib/audit_utils');
var EmailUtils = require('../lib/email_utils');
var Constants = require('../data/constants');
var ErrorConfig = require('../data/error');
var NotificationReferenceData = require('../data/notification_reference');
var S3Utils = require('../lib/s3_utils');
var knex = require('../lib/knex_util');
var ErrorUtils = require('../lib/error_utils');
var CommonApi = require('./common');
var SupplierApi = require('./supplier');
var CustomerApi = require('./customer');
var SupplyItemApi = require('./supply_item');
var Promise = require('bluebird');
var Decimal = require('decimal.js');

var productInventoryDirName = '..' + path.sep + 'public' + path.sep + 'productInventories';
productInventoryDirName = path.resolve(__dirname, productInventoryDirName);
if (fs.existsSync(productInventoryDirName) === false) {
    fs.mkdir(productInventoryDirName);
}

var ProductInventory = {

    getProductInventory: function (options, cb) {
        var accountIdProductIdLocationId = options.accountIdProductIdLocationId;
        var languageCultureCode = options.languageCultureCode;

        var err;
        if (DataUtils.isUndefined(accountIdProductIdLocationId)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_ID_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('error', err);
            return cb(err);
        }
        ProductInventoryModel.get(accountIdProductIdLocationId, {
            ConsistentRead: true
        }, function (err, data) {
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                debug('error', err);
                return cb(err);
            }
            var productInventory = data && data.attrs;

            var uoMNameId = productInventory.unitOfMeasure + '_' + languageCultureCode;

            UnitOfMeasureNameModel.get(uoMNameId, function (err, unitName) {
                if (err) {
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    debug('error', err);
                    return cb(err);
                }
                var unitName = unitName && unitName.attrs;
                if (DataUtils.isObject(unitName)) {
                    productInventory.unitOfMeasure = {
                        name: unitName.name,
                        symbol: unitName.symbol
                    };
                }
                return cb(null, productInventory);
            });
        });
    },

    getProductInventoryMD: async function (options, errorOptions, cb) {
        var productInventoryId = options.productInventoryId;
        var languageCultureCode = options.languageCultureCode;
        var accountId = options.accountId;

        var err;
        if (DataUtils.isUndefined(productInventoryId)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_ID_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('error', err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();

            var productInventory = await conn.query('select CAST(uuid_from_bin(p.id) as CHAR) as id,CAST(uuid_from_bin(p.accountId) as CHAR) as accountId ,' +
              ' CAST(uuid_from_bin(p.productRefId) as CHAR) as productRefId , p.SKU, PR.qtyUoMId, PR.qtyUoMCategory ,' +
              ' PR.sellerSKUName, p.locationId,LR.locationName, ' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(p.qtyOnHand/CAST(power(10,US1.scalingPrecision) as INTEGER))))) as qtyOnHand,  UN1.symbol as qtyOnHandUOMSymbol, ' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(p.qtyOnOrder/CAST(power(10,US2.scalingPrecision) as INTEGER))))) as qtyOnOrder,  UN2.symbol as qtyOnOrderUOMSymbol, ' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(p.qtyAvailable/CAST(power(10,US3.scalingPrecision) as INTEGER))))) as qtyAvailable,  UN3.symbol as qtyAvailableUOMSymbol, ' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(p.qtyInTransit/CAST(power(10,US4.scalingPrecision) as INTEGER))))) as qtyInTransit,  UN4.symbol as qtyInTransitUOMSymbol, ' +
              ' p.qtyOnHandUOM, p.qtyOnOrderUOM, p.qtyAvailableUOM, p.qtyInTransitUOM, p.notes,p.isRealTimeFrequency,p.updatedAt ' +
              ' from ' +
              ' ProductInventory as p, uomNames UN1, uomNames UN2, uomNames UN3, uomNames UN4, ' +
              ' uomScaling as US1, uomScaling as US2, uomScaling as US3, uomScaling as US4, LocationReference LR, ProductReferences PR ' +
              ' where ' +
              ' p.qtyOnHandUOM = US1.id and ' +
              ' p.qtyOnOrderUOM = US2.id and ' +
              ' p.qtyAvailableUOM = US3.id and ' +
              ' p.qtyInTransitUOM = US4.id and ' +
              ' p.locationId = LR.locationId and ' +
              ' p.productRefId = PR.id and ' +
              ' (UN1.uomScalingId = p.qtyOnHandUoM and UN1.languageCultureCode = ?) and ' +
              ' (UN2.uomScalingId = p.qtyOnOrderUoM and UN2.languageCultureCode = ?) and ' +
              ' (UN3.uomScalingId = p.qtyAvailableUoM and UN3.languageCultureCode = ?) and ' +
              ' (UN4.uomScalingId = p.qtyInTransitUoM  and UN4.languageCultureCode = ?) and ' +
              ' p.id=uuid_to_bin(?) and ' +
              ' LR.accountId=uuid_to_bin(?);', [languageCultureCode, languageCultureCode, languageCultureCode, languageCultureCode, productInventoryId, accountId]);
            productInventory = Utils.filteredResponsePool(productInventory);
            if (!productInventory) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }

            return cb(null, productInventory);
        } catch (err) {
            debug('error', err);
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    getProductInventoryByProductRefIdMD: async function (options, errorOptions, cb) {
        var productRefId = options.productRefId;
        var accountId = options.accountId;
        var languageCultureCode = options.languageCultureCode;
        var err;
        if (DataUtils.isUndefined(productRefId)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('error', err);
            return cb(err);
        }
        try {
            var conn = await connection.getConnection();

            var productInventory = await conn.query('select CAST(uuid_from_bin(PI.id) as CHAR) as id ,PI.locationId,LR.locationName,PI.SKU,' +
              'TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(PI.qtyOnHand/CAST(power(10,US1.scalingPrecision) as INTEGER)))))  as qtyOnHand  , ' +
              'UN1.name as qtyOnHandUOMName, UN1.symbol as qtyOnHandUOMSymbol, ' +
              'TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(PI.qtyOnOrder/CAST(power(10,US2.scalingPrecision) as INTEGER)))))  as qtyOnOrder , ' +
              'UN2.name as qtyOnOrderUOMName, UN2.symbol as qtyOnOrderUOMSymbol, ' +
              'TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(PI.qtyAvailable/CAST(power(10,US3.scalingPrecision) as INTEGER))))) as qtyAvailable , ' +
              'UN3.name as qtyAvailableUOMName, UN3.symbol as qtyAvailableUOMSymbol, ' +
              'TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(PI.qtyInTransit/CAST(power(10,US4.scalingPrecision) as INTEGER))))) as qtyInTransit , ' +
              'UN4.name as qtyInTransitUOMName, UN4.symbol as qtyInTransitUOMSymbol, PI.isRealTimeFrequency, PI.updatedAt ' +
              ' from ' +
              'ProductInventory PI, LocationReference LR ,uomNames UN1, uomNames UN2, uomNames UN3, uomNames UN4, ' +
              'uomScaling US1, uomScaling US2, uomScaling US3, uomScaling US4 ' +
              ' where ' +
              'PI.productRefId = uuid_to_bin(?) and ' +
              'PI.accountId = uuid_to_bin(?) and ' +
              'PI.locationId = LR.locationId and LR.accountId = PI.accountId and ' +
              '(UN1.uomScalingId = PI.qtyOnHandUoM and UN1.languageCultureCode = ?) and ' +
              '(UN2.uomScalingId = PI.qtyOnOrderUoM and UN2.languageCultureCode = ?) and ' +
              '(UN3.uomScalingId = PI.qtyAvailableUoM and UN3.languageCultureCode = ?) and ' +
              '(UN4.uomScalingId = PI.qtyInTransitUoM  and UN4.languageCultureCode = ?) and ' +
              'US1.id = PI.qtyOnHandUOM and ' +
              'US2.id = PI.qtyOnOrderUoM and ' +
              'US3.id = PI.qtyAvailableUoM and ' +
              'US4.id = PI.qtyInTransitUoM', [productRefId, accountId, languageCultureCode, languageCultureCode, languageCultureCode, languageCultureCode]);


            if (!productInventory) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                debug('err', err);
                return cb(err);
            }
            return cb(null, productInventory);
        } catch (err) {
            debug('error', err);
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    updateByAddingOutShares: function (options, auditOptions, cb) {
        var outShares = options.outShares;
        var userId = options.userId;
        var updatedAt = options.updatedAt;
        var err;
        if (!DataUtils.isArray(outShares)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_OUT_SHARES_REQ);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('error', err);
            return cb(err);
        }
        ProductInventory.getProductInventory(options, function (err, productInventory) {
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
            if (!productInventory) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            if (productInventory.updatedAt !== updatedAt) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                return cb(err);
            }
            var productInventoryOptions = {
                accountIdProductIdLocationId: productInventory.accountIdProductIdLocationId,
                updatedBy: userId
            };

            if (productInventory.outShares) {
                var outSharesItems = productInventory.outShares;
            }
            if (!_.isEmpty(outSharesItems)) {
                _.each(outShares, function (outshare) {
                    if (outSharesItems.indexOf(outshare) === -1) {
                        outSharesItems.push(outshare);
                    }
                });
                productInventoryOptions.outShares = outSharesItems;
            } else {
                productInventoryOptions.outShares = outShares;
            }
            auditOptions.metaData = {
                old_productInventory: productInventory
            };
            ProductInventoryModel.update(productInventoryOptions, {
                ReturnValues: 'ALL_NEW'
            }, function (err, productInventory) {
                if (err || !productInventory) {
                    err = err || new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    Util.log(err);
                    return cb(err);
                }
                productInventory = productInventory.attrs;
                auditOptions.metaData.new_productInventory = productInventory;
                AuditUtils.create(auditOptions);
                return cb(null, productInventory);
            });
        });
    },

    updateByRemovingOutShares: function (options, auditOptions, cb) {
        var outShares = options.outShares;
        var userId = options.userId;
        var updatedAt = options.updatedAt;
        var err;
        if (!DataUtils.isArray(outShares)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_OUT_SHARES_REQ);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('error', err);
            return cb(err);
        }
        ProductInventory.getProductInventory(options, function (err, productInventory) {
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
            if (!productInventory) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            if (productInventory.updatedAt !== updatedAt) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                return cb(err);
            }
            var productInventoryOptions = {
                accountIdProductIdLocationId: productInventory.accountIdProductIdLocationId,
                updatedBy: userId
            };

            if (productInventory.outShares) {
                var outSharesItems = productInventory.outShares;
            }
            if (!_.isEmpty(outSharesItems)) {
                _.each(outShares, function (outshare) {
                    var outSharesItemsIndex = outSharesItems.indexOf(outshare);
                    if (outSharesItemsIndex >= 0) {
                        outSharesItems.splice(outSharesItemsIndex, 1);
                    }
                });
                productInventoryOptions.outShares = outSharesItems;
            } else {
                productInventoryOptions.outShares = outShares;
            }
            auditOptions.metaData = {
                old_productInventory: productInventory
            };
            ProductInventoryModel.update(productInventoryOptions, {
                ReturnValues: 'ALL_NEW'
            }, function (err, productInventory) {
                if (err || !productInventory) {
                    err = err || new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    Util.log(err);
                    return cb(err);
                }
                productInventory = productInventory.attrs;
                auditOptions.metaData.new_productInventory = productInventory;
                AuditUtils.create(auditOptions);
                return cb(null, productInventory);
            });
        });
    },

    updateProductInventoryMD: function (options) {
        return new Promise(function (resolve, reject) {
            var updatedAt = options.updatedAt;
            var userId = options.userId;
            var productInventoryId = options.productInventoryId;
            var productInventoryFields = '';
            var productInventoryOptionalValues = [];
            var productInventoryRequiredValues = [];
            var newUpdatedAt = DataUtils.getEpochMSTimestamp();

            productInventoryRequiredValues.push(productInventoryId, productInventoryId, updatedAt);
            ProductInventory.validateOptionalFields(options, async function (err, response) {
                if (err) {
                    debug('err', err);
                    return reject(err);
                }
                productInventoryFields = response.productInventoryFields;
                productInventoryOptionalValues = response.productInventoryOptionalValues;

                if (productInventoryOptionalValues.length <= 0) {
                    err = new Error(ErrorConfig.MESSAGE.INVALID_REQUEST);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }

                productInventoryRequiredValues = _.concat(productInventoryRequiredValues, productInventoryOptionalValues);
                productInventoryRequiredValues.push(userId, newUpdatedAt, productInventoryId);

                try {
                    var conn = await connection.getConnection();

                    var productInventoryUpdated = await conn.query('IF (select 1 from ProductInventory where id=uuid_to_bin(?) and status = 1) is null then ' +
                      'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "PRODUCT_INVENTORY_NOT_FOUND", MYSQL_ERRNO = 4001;' +
                      'ELSEIF (select 1 from ProductInventory where id=uuid_to_bin(?) and updatedAt=?) is null then ' +
                      'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "PRODUCT_INVENTORY_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
                      'ELSE update ProductInventory set ' + productInventoryFields + ' updatedBy=uuid_to_bin(?), updatedAt = ? ' +
                      'where id=uuid_to_bin(?); END IF;', productInventoryRequiredValues);

                    productInventoryUpdated = Utils.isAffectedPool(productInventoryUpdated);

                    if (!productInventoryUpdated) {
                        throw err;
                    }
                    return resolve({
                        OK: Constants.SUCCESS_MESSAGE.PRODUCT_INVENTORY_UPDATED_SUCCESSFULLY,
                        updatedAt: newUpdatedAt
                    });
                } catch (err) {
                    debug('err', err);
                    if (err.errno === 4001) {
                        err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_NOT_FOUND);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        return reject(err);
                    } else if (err.errno === 4002) {
                        err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                        err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                        return reject(err);
                    }
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
            });
        });
    },

    updatePromiseMD: function (options, errorOptions) {
        return new Promise(async function (resolve, reject) {
            var userId = options.userId;
            var accountId = options.accountId;
            var languageCultureCode = options.languageCultureCode;
            var updatedAt = options.updatedAt;
            var productInventoryId = options.productInventoryId;
            var isRealTimeFrequency = options.isRealTimeFrequency;
            var conditionString, conditionValues;

            var err;

            if (DataUtils.isUndefined(productInventoryId)) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_ID_REQ);
            } else if (DataUtils.isUndefined(updatedAt)) {
                err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_REQUIRED);
            } else if (!DataUtils.isValidNumber(updatedAt)) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_UPDATED_AT_MUST_BE_NUMBER);
            } else if (updatedAt.toString().length !== 13) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_UPDATED_AT_INVALID);
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return reject(err);
            }

            if (isRealTimeFrequency) {
                var response = await ProductInventory.getConditionString(options);
                conditionString = response.string;
                conditionValues = response.values;
            }

            var productInventoryOption = {
                productInventoryId: productInventoryId,
                languageCultureCode: languageCultureCode,
                accountId: accountId

            };

            ProductInventory.checkQuantity(options, function (err) {
                if (err) {
                    debug('err', err);
                    return reject(err);
                }
                ProductInventory.getProductInventoryMD(productInventoryOption, errorOptions, function (err, productInventory) {
                    if (err) {
                        debug('err', err);
                        return reject(err);
                    }
                    options.qtyOnHandUOM = options.qtyOnHandUOM ? options.qtyOnHandUOM : productInventory.qtyOnHandUOM;
                    options.qtyOnOrderUOM = options.qtyOnOrderUOM ? options.qtyOnOrderUOM : productInventory.qtyOnOrderUOM;
                    options.qtyAvailableUOM = options.qtyAvailableUOM ? options.qtyAvailableUOM : productInventory.qtyAvailableUOM;
                    options.qtyInTransitUOM = options.qtyInTransitUOM ? options.qtyInTransitUOM : productInventory.qtyInTransitUOM;

                    ProductInventory.validateQuantity(options, async function (err, response) {
                        if (err) {
                            debug('err', err);
                            return reject(err);
                        }
                        options.qtyOnHand = response && response.qtyOnHand ? response.qtyOnHand : undefined;
                        options.qtyOnOrder = response && response.qtyOnOrder ? response.qtyOnOrder : undefined;
                        options.qtyAvailable = response && response.qtyAvailable ? response.qtyAvailable : undefined;
                        options.qtyInTransit = response && response.qtyInTransit ? response.qtyInTransit : undefined;

                        try {
                            var updateResponse = await ProductInventory.updateProductInventoryMD(options);

                            // CHECK FOR REAL_TIME OUT SHARES
                            if (isRealTimeFrequency && conditionValues.length > 0) {
                                // Check if any outshare is exist with item or not

                                var checkOutShareOptions = {
                                    itemId: productInventoryId,
                                    accountId: accountId,
                                    shareItemType: Constants.SHARING_TYPE.productInventory,
                                    conditionString: conditionString,
                                    conditionValues: conditionValues
                                };
                                var realTimeOutShares = await OutSharingApi.checkRealTimeOutShare(checkOutShareOptions);

                                if (realTimeOutShares.length > 0) {
                                    var shareOptions = {
                                        realTimeOutShares: realTimeOutShares,
                                        shareItemId: productInventoryId
                                    };
                                    var apiResponse = ProductInventory.buildTask(shareOptions);

                                    debug('API COMPLTETED', apiResponse);
                                }
                            }

                            return resolve(updateResponse);
                        } catch (err) {
                            debug('err', err);
                            return reject(err);
                        }
                    });
                });
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
            if (options.qtyOnOrder || options.qtyOnOrderUOM) {
                string += 'OSP.sharedDataItems like ? OR ';
                values.push('%4%');
            }
            if (options.qtyAvailable || options.qtyAvailableUOM) {
                string += 'OSP.sharedDataItems like ? OR ';
                values.push('%5%');
            }
            string = string.replace(/OR\s*$/, ' ');
            string += ')';

            return resolve({
                string: string,
                values: values
            });
        });
    },

    /*
    * Check inventory already exist or not
    * */
    checkAlreadyExistInventory: function (options) {
        return new Promise(async function (resolve, reject) {
            var id = options.id;
            var locationId = options.locationId;
            var err;

            try {
                var conn = await connection.getConnection();

                var checkResponse = await conn.query('select 1 from ProductInventory P1,ProductInventory P2 where P1.locationId = ? ' +
                  ' and P1.productRefId = P2.productRefId and P2.id = uuid_to_bin(?);', [locationId, id]);
                checkResponse = Utils.filteredResponsePool(checkResponse);

                if (checkResponse) {
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_ALREADY_EXIST);
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

    updateMD: async function (options, auditOptions, errorOptions, cb) {
        var OutSharingApi = require('../api/out_sharing');
        var userId = options.userId;
        var accountId = options.accountId;
        var languageCultureCode = options.languageCultureCode;
        var updatedAt = options.updatedAt;
        var locationId = options.locationId;
        var productInventoryId = options.productInventoryId;
        var isRealTimeFrequency = options.isRealTimeFrequency;
        var conditionString, conditionValues;

        var err;

        if (DataUtils.isUndefined(productInventoryId)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_ID_REQ);
        } else if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_UPDATED_AT_MUST_BE_NUMBER);
        } else if (updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_UPDATED_AT_INVALID);
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
            var response = await ProductInventory.getConditionString(options);
            conditionString = response.string;
            conditionValues = response.values;
        }

        var productInventoryOption = {
            productInventoryId: productInventoryId,
            languageCultureCode: languageCultureCode,
            accountId: accountId
        };

        ProductInventory.checkQuantity(options, function (err) {
            if (err) {
                debug('err', err);
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            ProductInventory.getProductInventoryMD(productInventoryOption, errorOptions, function (err, productInventory) {
                if (err) {
                    debug('err', err);
                    ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
                options.qtyOnHandUOM = options.qtyOnHandUOM ? options.qtyOnHandUOM : productInventory.qtyOnHandUOM;
                options.qtyOnOrderUOM = options.qtyOnOrderUOM ? options.qtyOnOrderUOM : productInventory.qtyOnOrderUOM;
                options.qtyAvailableUOM = options.qtyAvailableUOM ? options.qtyAvailableUOM : productInventory.qtyAvailableUOM;
                options.qtyInTransitUOM = options.qtyInTransitUOM ? options.qtyInTransitUOM : productInventory.qtyInTransitUOM;

                ProductInventory.validateQuantity(options, async function (err, response) {
                    if (err) {
                        debug('err', err);
                        ErrorUtils.create(errorOptions, options, err);
                        return cb(err);
                    }
                    options.qtyOnHand = response.qtyOnHand;
                    options.qtyOnOrder = response.qtyOnOrder;
                    options.qtyAvailable = response.qtyAvailable;
                    options.qtyInTransit = response.qtyInTransit;

                    try {
                        var updateResponse = await ProductInventory.updateProductInventoryMD(options);
                        if (!options.isMultiple) {
                            AuditUtils.create(auditOptions);
                        }

                        if (isRealTimeFrequency && conditionValues.length > 0) {
                            // Check if any outshare is exist with item or not

                            var checkOutShareOptions = {
                                itemId: productInventoryId,
                                accountId: accountId,
                                shareItemType: Constants.SHARING_TYPE.productInventory,
                                conditionString: conditionString,
                                conditionValues: conditionValues
                            };
                            debug('checkOutShareOptions', checkOutShareOptions);
                            var realTimeOutShares = await OutSharingApi.checkRealTimeOutShare(checkOutShareOptions);

                            debug('realTimeOutShares', realTimeOutShares);
                            if (realTimeOutShares.length > 0) {
                                var shareOptions = {
                                    realTimeOutShares: realTimeOutShares,
                                    shareItemId: productInventoryId
                                };
                                var apiResponse = await ProductInventory.buildTask(shareOptions);

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

    buildTask: function (options) {
        return new Promise(function (resolve, reject) {
            var promises = [];
            var realTimeOutShares = options.realTimeOutShares;
            var shareItemId = options.shareItemId;
            _.each(realTimeOutShares, function (outShare) {
                //var url = 'http://127.0.0.1:3000/api/out-share/shared-data/real-time';
                var url = 'https://test-be.scopehub.org/api/out-share/shared-data/real-time';
                var option = {
                    outShareInstanceId: outShare.id,
                    shareItemId: shareItemId,
                    apiToken: 'xlK6cQsQRkvKdhIYH9n15yuzIhaLuiug'
                };
                var opt = {
                    url: url,
                    method: 'POST',
                    json: true,
                    form: option
                };
                promises.push(Request(opt, function (err, response, body) {
                    debug('err', err);
                    if (err || response.statusCode >= 400) {
                        err = err || new Error(ErrorConfig.MESSAGE.HTTP_REQUEST_FAILED);
                        err.status = err.status || ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                        //return cb2();
                    }
                }));
            });
            Promise.all(promises, {concurrency: realTimeOutShares.length}).then(async function (value) {
                debug('value ', value);
                resolve(true);
            });
        });
    },


    validateProductInventoryMD: async function (productInventories, cb) {
        var err;
        try {
            await Promise.each(productInventories, async function (productInventory) {
                if (DataUtils.isUndefined(productInventory.id)) {
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_ID_REQUIRED);
                } else if (DataUtils.isUndefined(productInventory.updatedAt)) {
                    err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_REQUIRED);
                } else if (!DataUtils.isValidNumber(productInventory.updatedAt)) {
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_UPDATED_AT_MUST_BE_NUMBER);
                } else if (productInventory.updatedAt.toString().length !== 13) {
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_UPDATED_AT_INVALID);
                } else if (DataUtils.isDefined(productInventory.locationId)) {
                    err = new Error(ErrorConfig.MESSAGE.LOCATION_CAN_NOT_BE_UPDATE);
                } else if ((DataUtils.isDefined(productInventory.qtyOnHandUOM) && DataUtils.isUndefined(productInventory.qtyOnHand))
                  || (DataUtils.isDefined(productInventory.qtyOnHand) && DataUtils.isUndefined(productInventory.qtyOnHandUOM))) {
                    err = new Error(ErrorConfig.MESSAGE.QTY_ON_HAND_AND_UOM_BOTH_REQUIRED);
                } else if ((DataUtils.isDefined(productInventory.qtyOnOrderUOM) && DataUtils.isUndefined(productInventory.qtyOnOrder))
                  || (DataUtils.isDefined(productInventory.qtyOnOrder) && DataUtils.isUndefined(productInventory.qtyOnOrderUOM))) {
                    err = new Error(ErrorConfig.MESSAGE.QTY_ON_ORDER_AND_UOM_BOTH_REQUIRED);
                } else if ((DataUtils.isDefined(productInventory.qtyAvailableUOM) && DataUtils.isUndefined(productInventory.qtyAvailable))
                  || (DataUtils.isDefined(productInventory.qtyAvailable) && DataUtils.isUndefined(productInventory.qtyAvailableUOM))) {
                    err = new Error(ErrorConfig.MESSAGE.QTY_ON_AVAILABLE_AND_UOM_BOTH_REQUIRED);
                } else if ((DataUtils.isDefined(productInventory.qtyInTransitUOM) && DataUtils.isUndefined(productInventory.qtyInTransit))
                  || (DataUtils.isDefined(productInventory.qtyInTransit) && DataUtils.isUndefined(productInventory.qtyInTransitUOM))) {
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

    updateInventoriesMD: async function (options, auditOptions, errorOptions, cb) {
        var productInventories = options.productInventories;
        var user = options.user;
        var accountId = user.accountId;
        var err;
        if (_.isEmpty(productInventories)) {
            err = new Error(ErrorConfig.MESSAGE.INVALID_REQUEST);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        var productInventoryResponse = {};
        var successProductInventory = [];
        var failProductInventory = [];

        ProductInventory.validateProductInventoryMD(productInventories, async function (err, response) {
            if (err || !response) {
                debug('err', err);
                return cb(err);
            }
            if (response) {
                await Promise.each(productInventories, async function (productInventory) {
                    productInventory.isMultiple = true;
                    productInventory.userId = user.id;
                    productInventory.languageCultureCode = user.languageCultureCode;
                    productInventory.accountId = accountId;
                    productInventory.userId = user.id;
                    productInventory.productInventoryId = productInventory.id;

                    try {
                        var inventoryResponse = await ProductInventory.updatePromiseMD(productInventory, errorOptions);
                        if (!inventoryResponse) {
                            failProductInventory.push({id: productInventory.id});
                        }
                        if (inventoryResponse) {
                            successProductInventory.push({
                                id: productInventory.id,
                                updatedAt: inventoryResponse.updatedAt
                            });
                        }
                    } catch (err) {
                        failProductInventory.push({
                            id: productInventory.id,
                            updatedAt: productInventory.updatedAt
                        });
                    }
                });
                if (successProductInventory.length !== 0 && failProductInventory.length === 0) {
                    productInventoryResponse.OK = Constants.SUCCESS_MESSAGE.PRODUCT_INVENTORY_UPDATED_SUCCESSFULLY;
                    productInventoryResponse.status = ErrorConfig.STATUS_CODE.SUCCESS;
                    productInventoryResponse.success = successProductInventory;
                    return cb(null, productInventoryResponse);
                } else {
                    productInventoryResponse = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_UPDATE_FAILED);
                    productInventoryResponse.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    productInventoryResponse.data = {
                        success: successProductInventory,
                        conflict: failProductInventory
                    };
                    return cb(productInventoryResponse);
                }

            }
        });
    },

    searchProductBySKUMD: async function (options, errorOptions, cb) {
        var query = options.query;
        var accountId = options.user.accountId;
        var err;

        if (DataUtils.isUndefined(query)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_SEARCH_QUERY_REQ);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            debug('err', err);
            return cb(err);
        }

        try {
            query = '%' + query + '%';
            var conn = await connection.getConnection();
            var products = await conn.query('select CAST(uuid_from_bin(PR.id) as CHAR) as id , PR.sku,PR.sellerSKUName,PR.qtyUoMId,US.categoryId,' +
              ' PR.updatedAt from ProductReferences PR , uomScaling US where lower(PR.sku) like lower(?) and PR.accountId = uuid_to_bin(?) ' +
              ' and PR.qtyUoMId = US.id and PR.status = ?;', [query, accountId, Constants.PRODUCT_INVENTORY_STATUS.ACTIVE]);
            if (!products) {
                products = [];
            }
            return cb(null, products);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    searchProductBySellerSKUNameMD: async function (options, errorOptions, cb) {
        var query = options.query;
        var accountId = options.user.accountId;
        var err;

        if (DataUtils.isUndefined(query)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_SEARCH_QUERY_REQ);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            debug('err', err);
            return cb(err);
        }

        try {
            query = '%' + query + '%';
            var conn = await connection.getConnection();
            var products = await conn.query('select CAST(uuid_from_bin(PR.id) as CHAR) as id , PR.sku,PR.sellerSKUName,PR.qtyUoMId,US.categoryId,' +
              'PR.updatedAt from ProductReferences PR , uomScaling US where lower(PR.sellerSKUName) like lower(?) and PR.accountId = uuid_to_bin(?) ' +
              ' and PR.qtyUoMId = US.id and PR.status = ?;', [query, accountId, Constants.PRODUCT_INVENTORY_STATUS.ACTIVE]);

            if (!products) {
                products = [];
            }
            return cb(null, products);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    removeMD: async function (options, auditOptions, errorOptions, cb) {
        var id = options.id;
        var updatedAt = options.updatedAt;
        var accountId = options.accountId;
        var userId = options.userId;
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();
        var err;

        if (DataUtils.isUndefined(id)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_ID_REQ);
        } else if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_UPDATED_AT_MUST_BE_NUMBER);
        } else if (updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_UPDATED_AT_INVALID);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();

            var isDeleted = await conn.query('IF (select 1 from ProductInventory where id=uuid_to_bin(?) and status = 1) is null then ' +
              'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "PRODUCT_INVENTORY_NOT_FOUND", MYSQL_ERRNO = 4001;' +
              'ELSEIF (select 1 from ProductInventory where id=uuid_to_bin(?) and updatedAt=?) is null then ' +
              'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "PRODUCT_INVENTORY_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
              'ELSE update ProductInventory set status = 0, updatedAt=? , updatedBy=uuid_to_bin(?) where id = uuid_to_bin(?);end if;',
              [id, id, updatedAt, newUpdatedAt, userId, id]);

            isDeleted = Utils.isAffectedPool(isDeleted);
            if (!isDeleted) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }
            return cb(null, {OK: Constants.SUCCESS_MESSAGE.PRODUCT_INVENTORY_ARCHIEVED_SUCCESSFULLY});
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            } else if (err.errno === 4002) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                return cb(err);
            } else {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_DELETE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
        }
    },

    manipulateInventoryIdQuery: function (options) {
        return new Promise(function (resolve, reject) {
            var list = options.list;
            var string = '', values = [];

            _.map(list, function (value) {
                string += 'uuid_to_bin(?),';
                values.push(value.id);
            });
            string = string.replace(/,\s*$/, ' ');
            return resolve({
                string: string,
                values: values
            });
        });
    },

    /*
    * Get inventory id from array which is exist
    * */
    getExistInventoryIds: function (options) {
        return new Promise(async function (resolve, reject) {
            var productInventories = options.productInventories;
            var accountId = options.accountId;
            var status = options.status;
            var successInventories = [], conflictInventories = [];

            try {
                var conn = await connection.getConnection();

                var response = await ProductInventory.manipulateInventoryIdQuery({list: productInventories});
                debug('response', response);

                var inventoryIds = await conn.query('select  CAST(uuid_from_bin(id) as CHAR) as id from    ProductInventory ' +
                  ' where accountId=uuid_to_bin(?) and status = ? and id in (' + response.string + ')', [accountId, status].concat(response.values));
                debug('inventoryIds', inventoryIds);

                inventoryIds = _.map(inventoryIds, 'id');

                if (inventoryIds.length > 0) {
                    _.map(productInventories, function (inventory) {
                        if (inventoryIds.indexOf(inventory.id) === -1) {
                            conflictInventories.push(inventory.id);
                        } else {
                            successInventories.push(inventory);
                        }
                    });
                } else {
                    conflictInventories = _.map(productInventories, 'id');
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
    * check updatedAt for deleted productInventories
    * */
    checkUpdatedAt: function (options) {
        return new Promise(async function (resolve, reject) {
            var productInventories = options.productInventories;
            var accountId = options.accountId;
            var status = options.status;
            var string = '', values = [];
            var existInventories = [], notExistInventories = [];
            var conflict = [], success = [];
            var failed = [];
            var conflictIds = [];

            try {
                var conn = await connection.getConnection();

                var getExistInventoryOption = {
                    productInventories: productInventories,
                    status: status,
                    accountId: accountId
                };
                debug('exist', getExistInventoryOption);
                var getExistInventoryResponse = await ProductInventory.getExistInventoryIds(getExistInventoryOption);
                existInventories = getExistInventoryResponse.successInventories;
                conflict = getExistInventoryResponse.conflictInventories;
                failed = conflict.slice();

                if (existInventories.length <= 0) {
                    return resolve({success: success, conflict: conflict, failed: failed});
                }

                await Promise.each(existInventories, function (inventory) {
                    string += ' SELECT CAST(uuid_from_bin(id) as char) as id FROM ProductInventory WHERE (updatedAt != ? AND id = uuid_to_bin(?)) UNION ALL ';
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
    * validate request of delete multiple product Inventory
    * */
    validateProductInventories: function (options) {
        return new Promise(async function (resolve, reject) {
            var productInventories = options.productInventories;
            var err;

            try {
                if (DataUtils.isUndefined(productInventories)) {
                    err = new Error(ErrorConfig.MESSAGE.ID_REQUIRED);
                } else if (!DataUtils.isArray(productInventories)) {
                    err = new Error(ErrorConfig.MESSAGE.ID_MUST_BE_ARRAY);
                } else if (productInventories.length <= 0) {
                    err = new Error(ErrorConfig.MESSAGE.ATLEAST_ONE_ID_REUQIRED);
                }
                if (err) {
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }

                await Promise.each(productInventories, async function (inventory) {
                    if (DataUtils.isUndefined(inventory.id)) {
                        err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_ID_REQUIRED);
                    } else if (DataUtils.isValidateOptionalField(inventory.updatedAt)) {
                        err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_UPDATED_AT_REQUIRED);
                    } else if (!DataUtils.isValidNumber(inventory.updatedAt)) {
                        err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_UPDATED_AT_MUST_BE_NUMBER);
                    } else if (inventory.updatedAt.toString().length !== 13) {
                        err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_UPDATED_AT_INVALID);
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
    * get outshare with no share Item
    * */
    getOutShareWithNoItems: function (options) {
        return new Promise(async function (resolve, reject) {
            var outShares = options.outShares;
            try {
                var conn = await connection.getConnection();

                var response = await ProductInventory.manipulateOutShareQuery({outShares: outShares});
                var filteredOutShares = await conn.query('select distinct CAST(uuid_from_bin(OS.id) as char) as id from OutShare OS where OS.id in (' + response.string + ') ' +
                  'and OS.id not in (select outShareInstanceId from OutShareItems where status = 1)', response.values);

                return resolve(filteredOutShares);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    manipulateOutShareQuery: function (options) {
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

    /*
    * update OutShareItems and outshare
    */
    updateOutShare: function (options) {
        return new Promise(async function (resolve, reject) {
            var outShares = options.outShares;
            var id = options.id;
            var status = Constants.STATUS.DEACTIVE;
            var userId = options.userId;
            var updatedAt = DataUtils.getEpochMSTimestamp();
            var currentDate = DataUtils.getEpochMSTimestamp();
            var SupplierApi = require('./supplier');
            var err;

            try {
                var conn = await connection.getConnection();

                var response = await ProductInventory.manipulateOutShareQuery({outShares: outShares});
                debug('response', response);

                // Update OutShareItems (child) record
                var isUpdated = await conn.query('update OutShareItems set status = ? , endDate = ? ,updatedAt = ? ' +
                  'where shareItemId =  uuid_to_bin(?)  and outShareInstanceId in (' + response.string + ') and status = 1;'
                  , [status, currentDate, updatedAt, id].concat(response.values));
                isUpdated = Utils.isAffectedPool(isUpdated);

                if (!isUpdated) {
                    err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }

                // Update OutShare who has no item left , status = stop
                var filterdOutShares = await ProductInventory.getOutShareWithNoItems({outShares: outShares});

                if (filterdOutShares.length > 0) {

                    response = await ProductInventory.manipulateOutShareQuery({outShares: filterdOutShares});

                    //update inShare record of that outShares
                    var inShareStatus = Constants.IN_SHARE_STATUS.STOP_BY_OUT_SHARE_PARTNER;


                    var isInshareUpdated = await conn.query('update InShare set status=?,updatedAt=?,updatedBy=uuid_to_bin(?),endDate=? where ' +
                      'outShareInstanceId in (' + response.string + ') and status = 1;', [inShareStatus, updatedAt, userId, currentDate].concat(response.values));
                    isInshareUpdated = Utils.isAffectedPool(isInshareUpdated);

                    // update outshare record
                    var outShareStatus = Constants.OUT_SHARE_STATUS.STOP;

                    var isOutshareUpdated = await conn.query('update OutShare set status=?,updatedAt=?,updatedBy=uuid_to_bin(?),endDate=? where ' +
                      'id in (' + response.string + ')', [outShareStatus, updatedAt, userId, currentDate].concat(response.values));
                    isOutshareUpdated = Utils.isAffectedPool(isOutshareUpdated);

                    // update Sharing Event by stopping it
                    if (outShares.length > 0) {
                        var updateSharingEventOption = {
                            outShares: filterdOutShares,
                            userId: userId
                        };
                        var updateSharingEventsResponse = await SupplierApi.updatesharingEvent(updateSharingEventOption);
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
    * get InShare Partners from outShares
    * */
    getInSharePartners: function (options) {
        return new Promise(async function (resolve, reject) {
            var outShares = options.outShares;
            var partnerIds;
            var err;

            try {
                var conn = await connection.getConnection();
                var response = await ProductInventory.manipulateOutShareQuery({outShares: outShares});

                partnerIds = await conn.query('select CAST(uuid_from_bin(accountId) as CHAR) as accountId,' +
                  ' CAST(uuid_from_bin(id) as CHAR) as inShareId from InShare where ' +
                  ' outshareInstanceId in (' + response.string + ') and status = 1;', response.values);

                return resolve(partnerIds);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.IN_SHARE_PARTNER_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
    * notify inShare partners after delete product inventories
    * */
    notifyInSharePartner: function (options) {
        return new Promise(async function (resolve, reject) {
            var checkResponses = options.checkResponses;
            var userId = options.userId;
            var NotificationApi = require('../api/notification');

            try {
                // notify inShare partners
                var inviterUser = await CustomerApi.getUserById({userId: userId});

                await Promise.each(checkResponses, async function (checkResponse) {
                    var partnerIds = checkResponse.partnerIds;

                    await Promise.each(partnerIds, async function (partnerId) {

                        var authUsers = await CustomerApi.getAuthorizeUser({accountId: partnerId.accountId});

                        var date = new Date();

                        var invitationExpirationDate = date.setDate(date.getDate() + Constants.INVITATION_EXPIRATION_DATE_LIMIT);
                        invitationExpirationDate = new Date(invitationExpirationDate);

                        await Promise.each(authUsers, async function (user) {
                            var inviteeUser = await CustomerApi.getUserById({userId: user.userId});

                            var opt = {
                                languageCultureCode: inviterUser.languageCultureCode,
                                template: Constants.EMAIL_TEMPLATES.REMOVE_SHARE_ITEM,
                                email: inviteeUser.email
                            };

                            var compileOptions = {
                                name: inviteeUser.firstName,
                                friend: inviterUser.email,
                                scopehub_login: ''
                            };

                            try {
                                // SEND EMAIL
                                await EmailUtils.sendEmailPromise(opt, compileOptions);

                                var notificationOption = {
                                    refereId: checkResponse.id, //id of delete supplier
                                    refereType: Constants.NOTIFICATION_REFERE_TYPE.OUT_SHARE,
                                    user_ids: [inviteeUser.id],
                                    topic_id: inviteeUser.id,
                                    notificationExpirationDate: invitationExpirationDate,
                                    paramasDateTime: new Date(),
                                    notification_reference: NotificationReferenceData.REMOVE_SHARE_ITEM,
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
                            } catch (err) {
                                debug('err', err);
                                err = new Error(ErrorConfig.MESSAGE.IN_SHARE_PARTNER_NOTIFY_FAILED);
                                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                                return reject(err);
                            }
                        });
                    });
                });
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
    * filter active outShare
    * */
    filterActiveOutShare: function (options) {
        return new Promise(function (resolve, reject) {
            var outShares = options.outShares;
            var activeOutShares = [];

            _.map(outShares, function (outShare) {
                if (outShare.status === Constants.OUT_SHARE_STATUS.ACTIVE) {
                    activeOutShares.push(outShare);
                }
            });
            return resolve(activeOutShares);
        });
    },

    /*
    * Function for check if deleted product inventory are included in sharing or not
    * */
    checkUpdateOutShares: function (options) {
        return new Promise(async function (resolve, reject) {
            var id = options.id;
            var userId = options.userId;
            var accountId = options.accountId;
            var outShares = [];
            var notifyFlag = false;
            var partnerIds = [];

            try {
                var conn = await connection.getConnection();

                outShares = await conn.query('select CAST(uuid_from_bin(OS.id) as char) as id,OS.status from OutShare OS,OutShareItems OSI ' +
                  ' where OS.accountId=uuid_to_bin(?) and (OS.status = 3 or OS.status = 2 or OS.status = 5) and' +
                  ' OS.id = OSI.outShareInstanceId and OSI.status = 1 and ' +
                  ' OSI.shareItemId  = uuid_to_bin(?)  ;', [accountId, id]);

                // Update outShareItems , outshare, inshare, sharingEvent
                if (outShares.length > 0) {
                    var activeOutShare = await ProductInventory.filterActiveOutShare({outShares: outShares});

                    notifyFlag = true;

                    if (activeOutShare.length > 0) {
                        // Get inShare partners
                        var getPartnersOption = {
                            outShares: activeOutShare
                        };
                        var partnerResponse = await ProductInventory.getInSharePartners(getPartnersOption);

                        debug('partnerResponse', partnerResponse);
                        _.map(partnerResponse, function (partner) {
                            partnerIds.push({accountId: partner.accountId});
                        });
                        var inShareIds = _.map(partnerResponse, 'inShareId');
                        debug('partnerIds', partnerIds);
                        debug('inShareIds', inShareIds);
                    }

                    var updateOutShareOption = {
                        outShares: outShares,
                        userId: userId,
                        id: id
                    };
                    var updateOutShareResponse = await ProductInventory.updateOutShare(updateOutShareOption);
                    debug('here123', updateOutShareResponse);
                }

                return resolve({notifyFlag: notifyFlag, id: id, partnerIds: partnerIds, inShareIds: inShareIds});
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    manipulateInventoryQuery: function (options) {
        return new Promise(function (resolve, reject) {
            var list = options.list;
            var string = '', values = [];

            _.map(list, function (value) {
                string += 'uuid_to_bin(?),';
                values.push(value);
            });
            string = string.replace(/,\s*$/, ' ');
            return resolve({
                string: string,
                values: values
            });
        });
    },

    /*
    * delete multiple product inventories
    * */
    updateStatusMultipleInventories: function (options) {
        return new Promise(async function (resolve, reject) {
            var productInventories = options.productInventories;
            var accountId = options.accountId;
            var status = options.status;
            var currentDate = DataUtils.getEpochMSTimestamp();
            var err;

            try {
                var conn = await connection.getConnection();

                // DELETE MULTIPLE CUSTOMERS
                var queryResponse = await ProductInventory.manipulateInventoryQuery({list: productInventories});
                debug('queryResponse', queryResponse);

                var isDeleted = await conn.query('update ProductInventory set status = ?,updatedAt=? ' +
                  'where accountId = uuid_to_bin(?) and id in (' + queryResponse.string + ');',
                  [status, currentDate, accountId].concat(queryResponse.values));

                isDeleted = Utils.isAffectedPool(isDeleted);

                if (!isDeleted) {
                    if (status === Constants.PRODUCT_INVENTORY_STATUS.IN_ACTIVE) {
                        err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_ARCHIEVED_FAILED);
                    } else {
                        err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_RESTORE_FAILED);
                    }
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                if (status === Constants.PRODUCT_INVENTORY_STATUS.IN_ACTIVE) {
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_ARCHIEVED_FAILED);
                } else {
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_RESTORE_FAILED);
                }
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
    * delete archieved multiple product inventories
    * */
    deleteArchieveMultipleInventories: function (options) {
        return new Promise(async function (resolve, reject) {
            var productInventories = options.productInventories;
            var accountId = options.accountId;
            var err;

            try {
                var conn = await connection.getConnection();

                var queryResponse = await ProductInventory.manipulateInventoryQuery({list: productInventories});
                debug('queryResponse', queryResponse);

                var isDeleted = await conn.query('delete from ProductInventory where accountId = uuid_to_bin(?) and status = 0 ' +
                  ' and id in (' + queryResponse.string + ');',
                  [accountId].concat(queryResponse.values));

                isDeleted = Utils.isAffectedPool(isDeleted);

                if (!isDeleted) {
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_DELETE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_DELETE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    deleteInventories: async function (options, auditOptions, errorOptions, cb) {
        var productInventories = options.productInventories;
        var accountId = options.accountId;
        var userId = options.userId;
        var successProductInventories, conflictProductInventories;
        var checkResponses = [];
        var err;

        try {
            //validate request of delete multiple product Inventory
            var checkOption = {
                productInventories: productInventories
            };
            var checkResponse = await ProductInventory.validateProductInventories(checkOption);
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
            var response = await ProductInventory.checkUpdatedAt({
                productInventories: productInventories,
                status: Constants.PRODUCT_INVENTORY_STATUS.ACTIVE,
                accountId: accountId
            });
            debug('response', response);
            successProductInventories = response.success;
            conflictProductInventories = response.conflict;

            if (successProductInventories.length <= 0 && conflictProductInventories.length > 0) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORIES_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {success: successProductInventories, conflict: conflictProductInventories};
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            } else if (successProductInventories.length <= 0 && conflictProductInventories.length <= 0) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORIES_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {success: successProductInventories, conflict: conflictProductInventories};
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }

            // Check if any out share or inshare is exist for each parter , if yes then stop sharing for those partner
            await Promise.each(successProductInventories, async function (inventory) {
                var checkOptions = {
                    id: inventory,
                    accountId: accountId,
                    userId: userId,
                    flag: false
                };
                var checkResponse = await ProductInventory.checkUpdateOutShares(checkOptions);
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
                productInventories: successProductInventories,
                status: Constants.PRODUCT_INVENTORY_STATUS.IN_ACTIVE,
                accountId: accountId
            };
            var deleteResponse = await ProductInventory.updateStatusMultipleInventories(deleteOption);
            debug('deleteResponse', deleteResponse);

            // NOTIFY the all inShare partners of the affected outshare
            debug('checkResponse', checkResponses);
            var notifyOption = {
                checkResponses: checkResponses,
                userId: userId
            };
            var notifyResponse = await ProductInventory.notifyInSharePartner(notifyOption);

            await conn.query('COMMIT;');
            AuditUtils.create(auditOptions);
            if (successProductInventories.length > 0 && conflictProductInventories.length > 0) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORIES_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {
                    successMsg: Constants.SUCCESS_MESSAGE.PRODUCT_INVENTORY_ARCHIEVED_SUCCESSFULLY,
                    success: successProductInventories,
                    conflict: conflictProductInventories
                };
                debug('err', err);
                return cb(err);
            } else {
                //await conn.query('COMMIT;');
                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.PRODUCT_INVENTORY_ARCHIEVED_SUCCESSFULLY,
                    success: successProductInventories
                });
            }
        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK;');
            ErrorUtils.create(errorOptions, options, err);
            err = err || new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_ARCHIEVED_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    deleteArchieveInventories: async function (options, auditOptions, errorOptions, cb) {
        var productInventories = options.productInventories;
        var accountId = options.accountId;
        var successProductInventories, conflictProductInventories;
        var err;

        try {
            //validate request of delete multiple product Inventory
            var checkOption = {
                productInventories: productInventories
            };
            var checkResponse = await ProductInventory.validateProductInventories(checkOption);
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
            var response = await ProductInventory.checkUpdatedAt({
                productInventories: productInventories,
                status: Constants.PRODUCT_INVENTORY_STATUS.IN_ACTIVE,
                accountId: accountId
            });
            debug('response', response);
            successProductInventories = response.success;
            conflictProductInventories = response.conflict;

            if (successProductInventories.length <= 0 && conflictProductInventories.length > 0) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORIES_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {success: successProductInventories, conflict: conflictProductInventories};
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            } else if (successProductInventories.length <= 0 && conflictProductInventories.length <= 0) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORIES_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {success: successProductInventories, conflict: conflictProductInventories};
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }

            // delete product inventories (status = 0 )
            var deleteOption = {
                productInventories: successProductInventories,
                accountId: accountId
            };
            var deleteResponse = await ProductInventory.deleteArchieveMultipleInventories(deleteOption);
            debug('deleteResponse', deleteResponse);

            await conn.query('COMMIT;');
            AuditUtils.create(auditOptions);
            if (successProductInventories.length > 0 && conflictProductInventories.length > 0) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORIES_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {
                    successMsg: Constants.SUCCESS_MESSAGE.PRODUCT_INVENTORY_DELETED_SUCCESSFULLY,
                    success: successProductInventories,
                    conflict: conflictProductInventories
                };
                debug('err', err);
                return cb(err);
            } else {
                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.PRODUCT_INVENTORY_DELETED_SUCCESSFULLY,
                    success: successProductInventories
                });
            }
        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK;');
            ErrorUtils.create(errorOptions, options, err);
            err = err || new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_DELETE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    restoreArchieveInventories: async function (options, auditOptions, errorOptions, cb) {
        var productInventories = options.productInventories;
        var accountId = options.accountId;
        var successProductInventories, conflictProductInventories;
        var err;

        try {
            //validate request of restore multiple product Inventory
            var checkOption = {
                productInventories: productInventories
            };
            var checkResponse = await ProductInventory.validateProductInventories(checkOption);
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
            var response = await ProductInventory.checkUpdatedAt({
                productInventories: productInventories,
                status: Constants.PRODUCT_INVENTORY_STATUS.IN_ACTIVE,
                accountId: accountId
            });
            successProductInventories = response.success;
            conflictProductInventories = response.conflict;

            if (successProductInventories.length <= 0 && conflictProductInventories.length > 0) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORIES_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {success: successProductInventories, conflict: conflictProductInventories};
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            } else if (successProductInventories.length <= 0 && conflictProductInventories.length <= 0) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORIES_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {success: successProductInventories, conflict: conflictProductInventories};
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }

            // restore product inventories (status = 1 )
            var restoreOption = {
                productInventories: successProductInventories,
                status: Constants.PRODUCT_INVENTORY_STATUS.ACTIVE,
                accountId: accountId
            };
            var restoreResponse = await ProductInventory.updateStatusMultipleInventories(restoreOption);
            debug('restoreResponse', restoreResponse);

            await conn.query('COMMIT;');
            AuditUtils.create(auditOptions);
            if (successProductInventories.length > 0 && conflictProductInventories.length > 0) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORIES_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {
                    successMsg: Constants.SUCCESS_MESSAGE.PRODUCT_INVENTORY_RESTORED_SUCCESSFULLY,
                    success: successProductInventories,
                    conflict: conflictProductInventories
                };
                debug('err', err);
                return cb(err);
            } else {
                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.PRODUCT_INVENTORY_RESTORED_SUCCESSFULLY,
                    success: successProductInventories
                });
            }
        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK;');
            ErrorUtils.create(errorOptions, options, err);
            err = err || new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_RESTORE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    validateOptionalFields: function (options, cb) {
        var err;
        var productInventoryFields = '';
        var productInventoryOptionalValues = [];

        try {
            if (!DataUtils.isValidateOptionalField(options.SKU)) {
                if (!DataUtils.isString(options.SKU)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_MUST_BE_STRING);
                } else if (options.SKU.length > 40) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_SKU_MUST_BE_LESS_THAN_40_CHARACTER);
                } else {
                    productInventoryFields += 'SKU=? ,';
                    productInventoryOptionalValues.push(options.SKU);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.locationId)) {
                if (!DataUtils.isString(options.locationId)) {
                    throw err = new Error(ErrorConfig.MESSAGE.LOCATION_ID_MUST_BE_STRING);
                } else if (options.locationId.length > 40) {
                    throw err = new Error(ErrorConfig.MESSAGE.LOCATION_ID_MUST_BE_LESS_THAN_40_CHARACTER);
                } else {
                    productInventoryFields += 'locationId=? ,';
                    productInventoryOptionalValues.push(options.locationId);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.qtyUOM)) {
                if (!DataUtils.isNumber(options.qtyUOM)) {
                    throw err = new Error(ErrorConfig.MESSAGE.QTY_UOM_MUST_BE_NUMBER);
                } else if (options.qtyUOM.toString().length > 11) {
                    throw err = new Error(ErrorConfig.MESSAGE.QTY_UOM_MUST_BE_LESS_THAN_11_DIGIT);
                } else {
                    productInventoryFields += 'qtyUOM=? ,';
                    productInventoryOptionalValues.push(options.qtyUOM);
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
                    productInventoryFields += 'type=? ,';
                    productInventoryOptionalValues.push(options.type);
                }
            }*/
            if (!DataUtils.isValidateOptionalField(options.qtyOnHand)) {
                if (!DataUtils.isMobile(options.qtyOnHand)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_QTY_ON_HAND_MUST_BE_NUMBER);
                } else if (options.qtyOnHand.toString().length > 20) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_QTY_ON_HAND_MUST_BE_LESS_THAN_20_DIGITS);
                } else {
                    productInventoryFields += 'qtyOnHand=? ,';
                    productInventoryOptionalValues.push(options.qtyOnHand);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.qtyOnHandUOM)) {
                if (!DataUtils.isNumber(options.qtyOnHandUOM)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_QTY_ON_HAND_UOM_MUST_BE_NUMBER);
                } else if (options.qtyOnHandUOM.toString().length > 11) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_QTY_ON_HAND_UOM_MUST_BE_LESS_THAN_11_DIGITS);
                } else {
                    productInventoryFields += 'qtyOnHandUOM=? ,';
                    productInventoryOptionalValues.push(options.qtyOnHandUOM);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.qtyOnOrder)) {
                if (!DataUtils.isMobile(options.qtyOnOrder)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_QTY_ON_ORDER_MUST_BE_NUMBER);
                } else if (options.qtyOnOrder.toString().length > 20) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_QTY_ON_ORDER_MUST_BE_LESS_THAN_20_DIGITS);
                } else {
                    productInventoryFields += 'qtyOnOrder=? ,';
                    productInventoryOptionalValues.push(options.qtyOnOrder);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.qtyOnOrderUOM)) {
                if (!DataUtils.isNumber(options.qtyOnOrderUOM)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_QTY_ON_ORDER_UOM_MUST_BE_NUMBER);
                } else if (options.qtyOnOrderUOM.toString().length > 11) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_QTY_ON_ORDER_UOM_MUST_BE_LESS_THAN_11_DIGITS);
                } else {
                    productInventoryFields += 'qtyOnOrderUOM=? ,';
                    productInventoryOptionalValues.push(options.qtyOnOrderUOM);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.qtyAvailable)) {
                if (!DataUtils.isMobile(options.qtyAvailable)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_QTY_AVAILABLE_MUST_BE_NUMBER);
                } else if (options.qtyAvailable.toString().length > 20) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_QTY_AVAILABLE_MUST_BE_LESS_THAN_20_DIGITS);
                } else {
                    productInventoryFields += 'qtyAvailable=? ,';
                    productInventoryOptionalValues.push(options.qtyAvailable);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.qtyAvailableUOM)) {
                if (!DataUtils.isNumber(options.qtyAvailableUOM)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_QTY_AVAILABLE_UOM_MUST_BE_NUMBER);
                } else if (options.qtyAvailableUOM.toString().length > 11) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_QTY_AVAILABLE_UOM_MUST_BE_LESS_THAN_11_DIGITS);
                } else {
                    productInventoryFields += 'qtyAvailableUOM=? ,';
                    productInventoryOptionalValues.push(options.qtyAvailableUOM);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.qtyInTransit)) {
                if (!DataUtils.isMobile(options.qtyInTransit)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_QTY_IN_TRANSIT_MUST_BE_NUMBER);
                } else if (options.qtyInTransit.toString().length > 20) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_QTY_IN_TRANSIT_MUST_BE_LESS_THAN_20_DIGITS);
                } else {
                    productInventoryFields += 'qtyInTransit=? ,';
                    productInventoryOptionalValues.push(options.qtyInTransit);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.qtyInTransitUOM)) {
                if (!DataUtils.isNumber(options.qtyInTransitUOM)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_QTY_IN_TRANSIT_UOM_MUST_BE_NUMBER);
                } else if (options.qtyInTransitUOM.toString().length > 11) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_QTY_IN_TRANSIT_UOM_MUST_BE_LESS_THAN_11_DIGITS);
                } else {
                    productInventoryFields += 'qtyInTransitUOM=? ,';
                    productInventoryOptionalValues.push(options.qtyInTransitUOM);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.notes)) {
                if (!DataUtils.isString(options.notes)) {
                    throw err = new Error(ErrorConfig.MESSAGE.NOTES_MUST_BE_STRING);
                } else {
                    productInventoryFields += 'notes=? ,';
                    productInventoryOptionalValues.push(options.notes);
                }
            }
            var response = {
                productInventoryFields: productInventoryFields,
                productInventoryOptionalValues: productInventoryOptionalValues
            };
            return cb(null, response);
        } catch (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
    },

    checkQuantity: function (options, cb) {
        var err;
        try {
            if (!DataUtils.isValidateOptionalField(options.qtyOnHand)) {
                if (!DataUtils.isMobile(options.qtyOnHand)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_QTY_ON_HAND_MUST_BE_NUMBER);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.qtyOnOrder)) {
                if (!DataUtils.isMobile(options.qtyOnOrder)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_QTY_ON_ORDER_MUST_BE_NUMBER);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.qtyAvailable)) {
                if (!DataUtils.isMobile(options.qtyAvailable)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_QTY_AVAILABLE_MUST_BE_NUMBER);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.qtyInTransit)) {
                if (!DataUtils.isMobile(options.qtyInTransit)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_QTY_IN_TRANSIT_MUST_BE_NUMBER);
                }
            }
            return cb();
        } catch (err) {
            debug('err', err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
    },

    getProductReferenceMD: async function (options, cb) {
        var accountId = options.accountId;
        var SKU = options.SKU;
        var err;

        try {
            var conn = await connection.getConnection();
            var productReference = await conn.query('select *,CAST(uuid_from_bin(id) as CHAR) as id from ProductReferences where accountId=uuid_to_bin(?) and SKU=?', [accountId, SKU]);
            productReference = Utils.filteredResponsePool(productReference);
            if (!productReference) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }
            return cb(null, productReference);
        } catch (err) {
            debug('err', err);
            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    createProductInventoryMD: function (options, errorOptions, cb) {
        var userId = options.userId;
        var accountId = options.accountId;
        var SKU = options.SKU;
        var locationId = options.locationId;
        var productRefId, generateId = Utils.generateId(), productInventoryFields = '';
        var productInventoryOptionalFields = [];
        var productInventoryRequiredFields = [];
        var createdAt = DataUtils.getEpochMSTimestamp();
        var updatedAt = DataUtils.getEpochMSTimestamp();

        var productOptions = {
            accountId: accountId,
            SKU: SKU
        };

        debug('productOptions', productOptions);
        ProductInventory.getProductReferenceMD(productOptions, async function (err, productReference) {
            if (err) {
                debug('err ', err);
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            productRefId = productReference.id;

            productInventoryRequiredFields.push(accountId, productRefId, locationId, accountId, locationId, generateId.uuid, accountId, productRefId);
            ProductInventory.validateOptionalFields(options, async function (err, response) {
                if (err) {
                    debug('err', err);
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
                productInventoryFields = response.productInventoryFields;
                productInventoryOptionalFields = response.productInventoryOptionalValues;

                productInventoryRequiredFields = _.concat(productInventoryRequiredFields, productInventoryOptionalFields);
                productInventoryRequiredFields.push(createdAt, updatedAt, userId);

                try {
                    var conn = await connection.getConnection();
                    var productInventory = await conn.query('IF (select 1 from ProductInventory where accountId=uuid_to_bin(?) and ' +
                      'productRefId=uuid_to_bin(?) and locationId=?) is not null then ' +
                      'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "PRODUCT_INVENTORY_ALREADY_EXIST", MYSQL_ERRNO = 4001;' +
                      'ELSEIF (select 1 from LocationReference where accountId=uuid_to_bin(?) and locationId=? and status = 1 ) is null then ' +
                      'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "LOCATION_REFERENCE_NOT_FOUND", MYSQL_ERRNO = 4002;' +
                      'ELSE insert into ProductInventory set id=uuid_to_bin(?), accountId=uuid_to_bin(?), productRefId=uuid_to_bin(?),' +
                      '' + productInventoryFields + ' createdAt=?,' +
                      'updatedAt=?,createdBy=uuid_to_bin(?);END IF;', productInventoryRequiredFields);
                    productInventory = Utils.isAffectedPool(productInventory);
                    if (!productInventory) {
                        throw err;
                    }
                    return cb(null, {
                        OK: Constants.SUCCESS_MESSAGE.PRODUCT_INVENTORY_CREATED_SUCCESSFULLY,
                        id: generateId.uuid,
                        createdAt: createdAt
                    });
                } catch (err) {
                    debug('err', err);
                    await ErrorUtils.create(errorOptions, options, err);
                    if (err.errno === 4001) {
                        err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_ALREADY_EXIST);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        return cb(err);
                    } else if (err.errno === 4002) {
                        err = new Error(ErrorConfig.MESSAGE.LOCATION_REFERENCE_NOT_FOUND);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        return cb(err);
                    } else {
                        err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_CREATE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                        return cb(err);
                    }
                }
            });
        });
    },

    manipulateQuery: function (options) {
        return new Promise(function (resolve, reject) {
            var uoms = options.uoms;
            var string = '', values = [];

            _.map(uoms, function (uom) {
                string += '?,';
                values.push(uom);
            });
            string = string.replace(/,\s*$/, ' ');

            return resolve({
                string: string,
                values: values
            });
        });
    },

    validateQuantity: async function (options, cb) {
        var qtyOnHand = options.qtyOnHand;
        var qtyOnHandUOM = options.qtyOnHandUOM;
        var qtyOnOrder = options.qtyOnOrder;
        var qtyOnOrderUOM = options.qtyOnOrderUOM;
        var qtyAvailable = options.qtyAvailable;
        var qtyAvailableUOM = options.qtyAvailableUOM;
        var qtyInTransit = options.qtyInTransit;
        var qtyInTransitUOM = options.qtyInTransitUOM;
        var err;
        var uoms = [];
        var qtyOption = {};

        if (qtyOnHand) {
            qtyOption.QTY_ON_HAND = {
                qty: qtyOnHand,
                uom: qtyOnHandUOM
            };
            uoms.push(qtyOnHandUOM);
        }
        if (qtyOnOrder) {
            qtyOption.QTY_ON_ORDER = {
                qty: qtyOnOrder,
                uom: qtyOnOrderUOM
            };
            uoms.push(qtyOnOrderUOM);
        }
        if (qtyAvailable) {
            qtyOption.QTY_AVAILABLE = {
                qty: qtyAvailable,
                uom: qtyAvailableUOM
            };
            uoms.push(qtyAvailableUOM);
        }
        if (qtyInTransit) {
            qtyOption.QTY_IN_TRANSIT = {
                qty: qtyInTransit,
                uom: qtyInTransitUOM
            };
            uoms.push(qtyInTransitUOM);
        }
        if (uoms.length <= 0) {

            var response = {
                qtyOnHand: qtyOnHand,
                qtyOnOrder: qtyOnOrder,
                qtyAvailable: qtyAvailable,
                qtyInTransit: qtyInTransit
            };

            return cb(null, response);
        }
        try {
            var conn = await connection.getConnection();
            var queryResponse = await ProductInventory.manipulateQuery({uoms: uoms});
            var uomScalings = await conn.query('select id,scalingFactor,categoryId,scalingPrecision,updatedAt from uomScaling where id in (' + queryResponse.string + ')', queryResponse.values);
            if (!uomScalings) {
                debug('err', err);
                throw err;
            }
            try {
                _.each(qtyOption, function (qty, key) {
                    _.map(uomScalings, function (uomScaling) {
                        //debug('qty.uom === uomScaling.id)', qty.uom, uomScaling.id, qty.uom === uomScaling.id);
                        if (qty.uom === uomScaling.id) {
                            var quantity = Decimal(qty.qty);
                            uomScaling.scalingPrecision = parseInt(uomScaling.scalingPrecision);
                            debug('uomScaling.scalingPrecision', uomScaling.scalingPrecision);
                            debug('Constants.QUANTITY_RANGE[uomScaling.scalingPrecision]', Constants.QUANTITY_RANGE[uomScaling.scalingPrecision]);
                            var maxValue = Decimal(Constants.QUANTITY_RANGE[uomScaling.scalingPrecision].MAX_VALUE);

                            if (quantity.greaterThan(maxValue)) {
                                var errorMessages = key + '_OUT_OF_RANGE';
                                err = new Error(ErrorConfig.MESSAGE[errorMessages]);
                                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                                err.key = key;
                                throw err;
                            }
                            if (quantity.toString().indexOf('.') === -1 && uomScaling.scalingPrecision !== 0) {
                                quantity = quantity.mul(Constants.PRECISION[uomScaling.scalingPrecision]);
                                qty.qty = quantity;
                            }
                            if (quantity.toString().indexOf('.') !== -1 && uomScaling.scalingPrecision !== 0) {
                                var a = Decimal(quantity);
                                quantity = quantity.toString().split('.')[1];

                                if (quantity.length > uomScaling.scalingPrecision) {
                                    a = a.toFixed(uomScaling.scalingPrecision);
                                    a = a.toString().replace('.', '');
                                    qty.qty = a;
                                }
                                if (quantity.length < uomScaling.scalingPrecision) {
                                    var zeros = uomScaling.scalingPrecision - quantity.length;
                                    a = Decimal(a).toString().replace('.', '');
                                    qty.qty = Decimal(a).mul(Decimal(Constants.PRECISION[zeros]));
                                }
                                if (quantity.length === uomScaling.scalingPrecision) {
                                    a = a.toString().replace('.', '');
                                    qty.qty = a;
                                }
                            }
                            if (uomScaling.scalingPrecision === 0) {
                                qty.qty = Decimal(qty.qty).toDecimalPlaces(0);
                            }
                        }
                    });
                });
                var response = {
                    qtyOnHand: qtyOption.QTY_ON_HAND ? qtyOption.QTY_ON_HAND.qty.toString() : undefined,
                    qtyOnOrder: qtyOption.QTY_ON_ORDER ? qtyOption.QTY_ON_ORDER.qty.toString() : undefined,
                    qtyAvailable: qtyOption.QTY_AVAILABLE ? qtyOption.QTY_AVAILABLE.qty.toString() : undefined,
                    qtyInTransit: qtyOption.QTY_IN_TRANSIT ? qtyOption.QTY_IN_TRANSIT.qty.toString() : undefined
                };
                return cb(null, response);
            } catch (err) {
                err = err || new Error(ErrorConfig.MESSAGE.INVALID_QTY);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.UOM_SCALING_NOT_FOUND);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    createMD: async function (options, auditOptions, errorOptions, cb) {
        var SKU = options.SKU;
        var locationId = options.locationId;
        var err;

        if (DataUtils.isUndefined(SKU)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_SKU_REQ);
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
        ProductInventory.checkQuantity(options, function (err) {
            if (err) {
                debug('err', err);
                return cb(err);
            }
            ProductInventory.validateQuantity(options, function (err, response) {
                if (err) {
                    debug('err', err);
                    return cb(err);
                }
                options.qtyOnHand = response.qtyOnHand;
                options.qtyOnOrder = response.qtyOnOrder;
                options.qtyAvailable = response.qtyAvailable;
                options.qtyInTransit = response.qtyInTransit;
                ProductInventory.createProductInventoryMD(options, errorOptions, async function (err, response) {
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

    getProductsInventoriesByAccountMD: async function (options, errorOptions, cb) {
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

            var productInventories = await conn.query(' select CAST(uuid_from_bin(p.id) as CHAR) as id ,CAST(uuid_from_bin(p.accountId) as CHAR) as accountId ,' +
              ' CAST(uuid_from_bin(p.productRefId) as CHAR) as productRefId , p.SKU,' +
              ' PR.sellerSKUName, p.locationId, LR.locationName, ' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(p.qtyOnHand/CAST(power(10,US1.scalingPrecision) as INTEGER))))) as qtyOnHand,  UN1.symbol as qtyOnHandUOMSymbol, ' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(p.qtyOnOrder/CAST(power(10,US2.scalingPrecision) as INTEGER))))) as qtyOnOrder, UN2.symbol as qtyOnOrderUOMSymbol, ' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(p.qtyAvailable/CAST(power(10,US3.scalingPrecision) as INTEGER))))) as qtyAvailable, UN3.symbol as qtyAvailableUOMSymbol, ' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(p.qtyInTransit/CAST(power(10,US4.scalingPrecision) as INTEGER))))) as qtyInTransit,  UN4.symbol as qtyInTransitUOMSymbol,' +
              ' p.notes,p.isRealTimeFrequency,p.status,p.updatedAt ' +
              ' from ' +
              ' ProductInventory as p, uomNames UN1, uomNames UN2, uomNames UN3, uomNames UN4,' +
              ' uomScaling as US1, uomScaling as US2, uomScaling as US3, uomScaling as US4 , LocationReference LR, ProductReferences PR ' +
              ' where ' +
              ' p.status = ? and ' +
              ' p.qtyOnHandUOM = US1.id and ' +
              ' p.qtyOnOrderUOM = US2.id and ' +
              ' p.qtyAvailableUOM = US3.id and ' +
              ' p.qtyInTransitUOM = US4.id and ' +
              ' p.locationId = LR.locationId and' +
              ' p.productRefId = PR.id and ' +
              ' (UN1.uomScalingId = p.qtyOnHandUoM and UN1.languageCultureCode = ?) and ' +
              ' (UN2.uomScalingId = p.qtyOnOrderUoM and UN2.languageCultureCode = ?) and ' +
              ' (UN3.uomScalingId = p.qtyAvailableUoM and UN3.languageCultureCode = ?) and ' +
              ' (UN4.uomScalingId = p.qtyInTransitUoM  and UN4.languageCultureCode = ?) and ' +
              ' p.accountId=uuid_to_bin(?) and ' +
              ' LR.accountId=uuid_to_bin(?) order by p.updatedAt desc limit 10',
              [isActive, languageCultureCode, languageCultureCode, languageCultureCode, languageCultureCode, accountId, accountId]);

            //productInventories = Utils.filteredResponsePool(productInventories);

            if (!productInventories) {
                var array = [];
                return cb(null, array);
            }

            return cb(null, productInventories);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    getProductInventoryByQtyUoM: function (options) {
        return new Promise(async function (resolve, reject) {
            var accountId = options.accountId;
            var qtyUoMId = options.qtyUoMId;

            try {
                var conn = await connection.getConnection();
                var productInventories = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id,isRealTimeFrequency ' +
                  'from ProductInventory where accountId= uuid_to_bin(?) and (qtyOnHandUoM = ? && qtyOnHand != 0) ' +
                  'OR (qtyOnOrderUoM = ? && qtyOnOrder != 0) OR (qtyAvailableUoM = ? && qtyAvailable != 0) ',
                  [accountId, qtyUoMId, qtyUoMId, qtyUoMId]);
                return resolve(productInventories);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    getInventoryByIds: function (options) {
        return new Promise(async function (resolve, reject) {
            var productInventoryIds = options.productInventories;
            var accountId = options.accountId;
            var err;

            try {
                var conn = await connection.getConnection();

                var queryResponse = await ProductInventory.manipulateInventoryQuery({list: productInventories});
                debug('queryResponse', queryResponse);

                var productInventories = await conn.query('select CAST(uuid_from_bin(p.id) as CHAR) as id,isRealTimeFrequency,' +
                  'qtyOnHand,qtyOnHandUoM, from ProductInventory where accountId = uuid_to_bin(?) and status = 0 ' +
                  ' and id in (' + queryResponse.string + ');',
                  [accountId].concat(queryResponse.values));

                productInventories = Utils.isAffectedPool(productInventories);

                return resolve(Constants.OK_MESSAGE);
            } catch (err) {

            }
        });
    },

    updateInventoryByQtyUoM: function (options) {
        return new Promise(async function (resolve, reject) {
            var accountId = options.accountId;
            var qtyUoMId = options.qtyUoMId;
            var shareItemType = options.shareItemType;
            var updatedAt, err;
            var tableName;
            var quantities = [
                {
                    QTY: 'qtyOnHand',
                    QTY_UOM: 'qtyOnHandUoM'
                },
                {
                    QTY: 'qtyOnOrder',
                    QTY_UOM: 'qtyOnOrderUoM'
                },
                {
                    QTY: 'qtyAvailable',
                    QTY_UOM: 'qtyAvailableUoM'
                },
                {
                    QTY: 'qtyInTransit',
                    QTY_UOM: 'qtyInTransitUoM'
                }
            ];

            try {
                if (shareItemType === Constants.SHARING_TYPE.productInventory) {
                    tableName = ' ProductInventory ';
                } else if (shareItemType === Constants.SHARING_TYPE.supplyInventory) {
                    tableName = ' SupplyInventory ';
                }
                var conn = await connection.getConnection();
                await Promise.each(quantities, async function (quantity) {
                    updatedAt = DataUtils.getEpochMSTimestamp();
                    var isUpdated = await conn.query('update ' + tableName + ' set ' + quantity.QTY + ' = 0 , updatedAt=? ' +
                      'where ' + quantity.QTY_UOM + '= ? and accountId = uuid_to_bin(?) and ' + quantity.QTY + ' != 0 ;',
                      [updatedAt, qtyUoMId, accountId]);
                    isUpdated = Utils.isAffectedPool(isUpdated);
                    /*if (!isUpdated) {
                        if (shareItemType === Constants.SHARING_TYPE.productInventory) {
                            err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_UPDATE_FAILED);
                        } else if (shareItemType === Constants.SHARING_TYPE.supplyInventory) {
                            err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_UPDATE_FAILED);
                        }
                        throw err;
                    }*/
                });
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                if (shareItemType === Constants.SHARING_TYPE.productInventory) {
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_UPDATE_FAILED);
                } else if (shareItemType === Constants.SHARING_TYPE.supplyInventory) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_UPDATE_FAILED);
                }
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    searchProductsInventories: async function (options, errorOptions, cb) {
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
                whereString += ' p.sku like ? and ';
                checkValues.push('%' + sku + '%');
            }
            if (DataUtils.isDefined(locationId)) {
                checkString += ' locationId like ?  and ';
                whereString += ' p.locationId like ? and ';
                checkValues.push('%' + locationId + '%');
            }
            checkString = checkString.replace(/and\s*$/, '');
            whereString = whereString.replace(/and\s*$/, '');

            var conn = await connection.getConnection();

            queryString = 'IF (select count(id) from ProductInventory where accountId = uuid_to_bin(?) and ' +
              ' status= ? and ' + checkString + ') > ? THEN ' +
              ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "ROW_COUNT_EXCEED_PLEASE_USE_SEARCH_AND_FILTER", MYSQL_ERRNO = 4001; ' +
              ' ELSE select CAST(uuid_from_bin(p.id) as CHAR) as id ,CAST(uuid_from_bin(p.accountId) as CHAR) as accountId ,' +
              ' CAST(uuid_from_bin(p.productRefId) as CHAR) as productRefId , p.SKU,' +
              ' PR.sellerSKUName, p.locationId, LR.locationName, ' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(p.qtyOnHand/CAST(power(10,US1.scalingPrecision) as INTEGER))))) as qtyOnHand,  UN1.symbol as qtyOnHandUOMSymbol, ' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(p.qtyOnOrder/CAST(power(10,US2.scalingPrecision) as INTEGER))))) as qtyOnOrder, UN2.symbol as qtyOnOrderUOMSymbol, ' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(p.qtyAvailable/CAST(power(10,US3.scalingPrecision) as INTEGER))))) as qtyAvailable, UN3.symbol as qtyAvailableUOMSymbol, ' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM(p.qtyInTransit/CAST(power(10,US4.scalingPrecision) as INTEGER))))) as qtyInTransit,  UN4.symbol as qtyInTransitUOMSymbol,' +
              ' p.notes,p.isRealTimeFrequency,p.status,p.updatedAt ' +
              ' from ' +
              ' ProductInventory as p, uomNames UN1, uomNames UN2, uomNames UN3, uomNames UN4,' +
              ' uomScaling as US1, uomScaling as US2, uomScaling as US3, uomScaling as US4 , LocationReference LR, ProductReferences PR ' +
              ' where ' +
              ' p.status = ? and ' +
              ' p.qtyOnHandUOM = US1.id and ' +
              ' p.qtyOnOrderUOM = US2.id and ' +
              ' p.qtyAvailableUOM = US3.id and ' +
              ' p.qtyInTransitUOM = US4.id and ' +
              ' p.locationId = LR.locationId and' +
              ' p.productRefId = PR.id and ' +
              ' (UN1.uomScalingId = p.qtyOnHandUoM and UN1.languageCultureCode = ?) and ' +
              ' (UN2.uomScalingId = p.qtyOnOrderUoM and UN2.languageCultureCode = ?) and ' +
              ' (UN3.uomScalingId = p.qtyAvailableUoM and UN3.languageCultureCode = ?) and ' +
              ' (UN4.uomScalingId = p.qtyInTransitUoM  and UN4.languageCultureCode = ?) and ' +
              ' p.accountId=uuid_to_bin(?) and  LR.accountId=uuid_to_bin(?) and ' + whereString + ' ; ' +
              ' END IF;';

            var productInventories = await conn.query(queryString,
              [accountId, parseInt(isActive)].concat(checkValues, [Constants.ROW_LIMIT], queryValues, checkValues));
            productInventories = Utils.filteredResponsePool(productInventories);

            if (!productInventories) {
                var array = [];
                return cb(null, array);
            }

            return cb(null, productInventories);
        } catch (err) {
            debug('err', err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.ROW_COUNT_EXCEED_PLEASE_USE_SEARCH_AND_FILTER);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    }
};
module.exports = ProductInventory;