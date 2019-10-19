'use strict';

var debug = require('debug')('scopehub.api.unit_of_measures');
var Async = require('async');
var _ = require('lodash');
var PromiseBluebird = require('bluebird');

var connection = require('../lib/connection_util');
var DataUtils = require('../lib/data_utils');
var ErrorConfig = require('../data/error');
var AuditUtils = require('../lib/audit_utils');
var Utils = require('../lib/utils');
var ErrorUtils = require('../lib/error_utils');
var Constants = require('../data/constants');
var ProductReferenceApi = require('./product_reference');
var ProductInventoryApi = require('./product_inventory');
var SupplyInventoryApi = require('./supply_inventory');
var SupplyItemApi = require('./supply_item');

var UnitOfMeasures = {

    create: async function (options, errorOptions, cb) {

        var categoryId = options.categoryId;
        var scalingPrecision = options.scalingPrecision;
        var scalingFactor = options.scalingFactor;
        var name = options.name;
        var symbol = options.symbol;
        var comment = options.comment || '';
        var accountId = options.accountId;
        var userId = options.userId;
        var currentTime = DataUtils.getEpochMSTimestamp();
        var err, query;

        if (DataUtils.isValidateOptionalField(categoryId)) {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_ID_REQUIRED);
        } else if (DataUtils.isValidateOptionalField(scalingPrecision)) {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_PRECISION_REQUIRED);
        } else if (DataUtils.isValidateOptionalField(scalingFactor)) {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_SCALING_FACTOR_REQUIRED);
        } else if (DataUtils.isValidateOptionalField(name)) {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_NAME_REQUIRED);
        } else if (DataUtils.isValidateOptionalField(symbol)) {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_SYMBOL_REQUIRED);
        } else if (scalingFactor > Constants.MAX_UOM_SCALING_FACTOR) {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_SCALING_FACTOR_EXCEED_MAXIMUM_VALUE);
        }

        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            return cb(err);
        }

        err = await UnitOfMeasures.validateOptinalFields(options);
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
            await conn.query('START TRANSACTION');

            query = 'select count(*) as count from uomCategory where categoryId = ? and (accountId = uuid_to_bin(?) or ' +
              'accountId = uuid_to_bin("00000000-0000-0000-0000-000000000000"))';
            var bindParams = [categoryId, accountId];

            var isCategoryExist = await conn.query(query, bindParams);
            var categoryCount = Utils.filteredResponsePool(isCategoryExist);

            if (categoryCount.count !== 2) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                errorOptions.data = {
                    categoryId: categoryId,
                    accountId: accountId
                };
                throw err;
            }

            var queryStatment = 'select count(*) as count from uomScaling where categoryId = ? and scalingFactor = 1;';
            var queryParams = [categoryId];

            var scalingOneExist = await conn.query(queryStatment, queryParams);
            var count = Utils.filteredResponsePool(scalingOneExist).count;
            var uomScalingResult;

            if (count === 0 && scalingFactor !== 1) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_SCALAR_FACTOR_SHOULD_BE_1);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
                /*var query = 'if(select count(*) as count from uomScaling us, uomNames un ' +
                  ' where us.categoryId = ? and us.id = un.uomScalingId and un.name = ?) = 0 then ' +
                  ' insert into uomScaling (categoryId, scalingPrecision, scalingFactor, createdAt, createdBy, updatedAt)' +
                  ' values(?,?,?,utc_timestamp(3),uuid_to_bin(?),utc_timestamp(3)); end if;';

                var params = [categoryId, name, categoryId, precision, scalingFactor, userId];
                uomScalingResult = await conn.query(query, params);
                debug('uomScalingResult', uomScalingResult);*/
            } else if (count > 0 && scalingFactor === 1) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_SCALING_FACTOR_ONE_ALLREADY_EXIST_FOR_THIS_CATEGORY);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
                /*var query = 'if(select count(*) as count from uomScaling us, uomNames un ' +
                  ' where us.categoryId = ? and us.id = un.uomScalingId and un.name = ?) = 0 then ' +
                  ' insert into uomScaling (categoryId, scalingPrecision, scalingFactor, createdAt, createdBy, updatedAt)' +
                  ' values(?,?,?,utc_timestamp(3),uuid_to_bin(?),utc_timestamp(3)); end if;';

                var params = [categoryId, name, categoryId, precision, scalingFactor, userId];
                uomScalingResult = await conn.query(query, params);*/
            }

            // Insert record into uomscaling table
            query = 'IF EXISTS (select 1 from uomScaling us, uomNames un ' +
              ' where us.categoryId = ? and us.id = un.uomScalingId and un.name = ? and (us.accountId = uuid_to_bin(?) or us.accountId= uuid_to_bin(?))) ' +
              ' THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "UNIT_OF_MEASURE_EXIST_WITH_SAME_NAME";' +
              ' ' +
              ' ELSEIF EXISTS (select 1 from uomScaling us, uomNames un ' +
              ' where us.categoryId = ? and us.id = un.uomScalingId and un.symbol = ? and (us.accountId = uuid_to_bin(?) or us.accountId= uuid_to_bin(?))) ' +
              ' THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4002,MESSAGE_TEXT = "UNIT_OF_MEASURE_EXIST_WITH_SAME_SYMBOL";' +
              ' ' +
              ' ELSEIF EXISTS (select 1 from uomScaling where categoryId = ? and scalingFactor = ? and scalingPrecision = ? ' +
              ' and (accountId = uuid_to_bin(?) or accountId= uuid_to_bin(?))) ' +
              ' THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4003,MESSAGE_TEXT = "UNIT_OF_MEASURE_EXIST_WITH_SAME_SCALING_FACTOR_AND_PRECISION";' +
              ' ' +
              ' ELSE insert into uomScaling (accountId,categoryId, scalingPrecision, scalingFactor, createdAt, updatedAt, createdBy)' +
              ' values(uuid_to_bin(?),?,?,?,?,?,uuid_to_bin(?)); end if;';

            var params = [categoryId, name, accountId, Constants.DEFAULT_REFERE_ID, categoryId, symbol, accountId, Constants.DEFAULT_REFERE_ID,
                categoryId, scalingFactor, scalingPrecision, accountId, Constants.DEFAULT_REFERE_ID, accountId, categoryId, scalingPrecision, scalingFactor, currentTime, currentTime, userId];
            uomScalingResult = await conn.query(query, params);
            debug('uomScalingResult', uomScalingResult);

            if (!Utils.isAffectedPool(uomScalingResult)) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CREATE_DUPLICATE);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                errorOptions.data = {
                    categoryId: categoryId,
                    name: name
                };
                throw err;
            }

            var getInsertedId = await conn.query('select LAST_INSERT_ID() as id');
            var insertedId = Utils.filteredResponsePool(getInsertedId).id;

            if (!insertedId) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CREATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }

            debug('insertedId', insertedId);

            /*
            * Insert record into uomNames record
            * */
            var uomNamesQuery = 'insert into uomNames' +
              '(uomScalingId, name, languageCultureCode, symbol, comment, createdAt,updatedAt, createdBy) ' +
              ' values(?,?,?,?,?,?,?,uuid_to_bin(?)),' +
              ' (?,?,?,?,?,?,?,uuid_to_bin(?))';

            var uomNameBindParams = [insertedId, name, 'en-US', symbol, comment, currentTime, currentTime, userId,
                insertedId, name, 'de-DE', symbol, comment, currentTime, currentTime, userId];

            var createUomNames = await conn.query(uomNamesQuery, uomNameBindParams);
            var affectedRows = Utils.getAffectedRowsPool(createUomNames);

            if (affectedRows !== 2) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CREATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }

            await conn.query('COMMIT;');
            return cb(null, {
                id: insertedId,
                createdAt: currentTime,
                OK: Constants.SUCCESS_MESSAGE.UNIT_OF_MEASURE_CREATE_SUCCESS
            });
        } catch (err) {
            await conn.query('ROLLBACK;');
            debug('err', err);
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);

            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_EXIST_WITH_SAME_NAME);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno === 4002) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_EXIST_WITH_SAME_SYMBOL);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno === 4003) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_EXIST_WITH_SAME_SCALING_FACTOR_AND_PRECISION);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CREATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    updateProductReference: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var accountId = options.accountId;
            var userId = options.userId;
            var qtyUoMId = options.qtyUoMId;

            try {
                var getProductReferenceOption = {
                    accountId: accountId,
                    qtyUoMId: qtyUoMId
                };
                var productReferences = await ProductReferenceApi.getProductReferenceByUOM(getProductReferenceOption);

                debug('productReferences', productReferences);

                if (DataUtils.isArray(productReferences) && productReferences.length > 0) {
                    await PromiseBluebird.each(productReferences, async function (productReference) {
                        var updateProductInventoryOption = {
                            accountId: accountId,
                            userId: userId,
                            qtyUoMId: qtyUoMId,
                            productRefId: productReference.id
                        };
                        var updateProductInventoryResponse = await ProductReferenceApi.updateProductInventoryQTY(updateProductInventoryOption);
                        debug('updateProductInventoryResponse', updateProductInventoryResponse);
                    });
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    updateSupplyItem: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var accountId = options.accountId;
            var userId = options.userId;
            var qtyUoMId = options.qtyUoMId;

            try {
                var getSupplyItemOption = {
                    accountId: accountId,
                    qtyUoMId: qtyUoMId
                };
                var supplyItems = await SupplyItemApi.getSupplyItemByUOM(getSupplyItemOption);

                if (DataUtils.isArray(supplyItems) && supplyItems.length > 0) {
                    await PromiseBluebird.each(supplyItems, async function (supplyItem) {
                        var updateSupplyInventoryOption = {
                            accountId: accountId,
                            userId: userId,
                            qtyUoMId: qtyUoMId,
                            supplyItemId: supplyItem.id
                        };
                        var updateSupplyInventoryResponse = await SupplyItemApi.updateSupplyInventoryQTY(updateSupplyInventoryOption);
                        debug('updateSupplyInventoryResponse', updateSupplyInventoryResponse);
                    });
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    updateProductInventories: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var accountId = options.accountId;
            var qtyUoMId = options.qtyUoMId;
            var productInventories;

            try {
                // Get productInventories by qtyUoMId and qty != 0
                var getInventoryOption = {
                    accountId: accountId,
                    qtyUoMId: qtyUoMId
                };
                productInventories = await ProductInventoryApi.getProductInventoryByQtyUoM(getInventoryOption);
                debug('productInventories', productInventories);

                // Update product Inventories by qtyUoMId
                var updateOption = {
                    accountId: accountId,
                    qtyUoMId: qtyUoMId,
                    shareItemType: Constants.SHARING_TYPE.productInventory
                };
                var updateInventoryResponse = await ProductInventoryApi.updateInventoryByQtyUoM(updateOption);
                debug('updateInventoryResponse', updateInventoryResponse);


                //If product inventory has realTime sharing then share the record
                if (DataUtils.isArray(productInventories) && productInventories.length > 0) {
                    var inventoryOptions = {
                        qtyOnHand: 0,
                        qtyOnHandUOM: qtyUoMId,
                        qtyOnOrder: 0,
                        qtyOnOrderUOM: qtyUoMId,
                        qtyAvailable: 0,
                        qtyAvailableUOM: qtyUoMId,
                        qtyInTransit: 0,
                        qtyInTransitUOM: qtyUoMId
                    };
                    await PromiseBluebird.each(productInventories, async function (productInventory) {
                        var conditionString, conditionValues;
                        if (productInventory.isRealTimeFrequency) {
                            var response = await ProductInventoryApi.getConditionString(inventoryOptions);
                            conditionString = response.string;
                            conditionValues = response.values;

                            var sharingOption = {
                                conditionString: conditionString,
                                conditionValues: conditionValues,
                                shareItemType: Constants.SHARING_TYPE.productInventory,
                                itemId: productInventory.id,
                                accountId: accountId
                            };
                            var shareResponse = await ProductReferenceApi.checkForRealTimeSharing(sharingOption);
                            debug('shareResponse', shareResponse);
                        }
                    });
                }

                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    updateSupplyInventories: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var accountId = options.accountId;
            var qtyUoMId = options.qtyUoMId;
            var supplyInventories;

            try {
                // Get productInventories by qtyUoMId and qty != 0
                var getInventoryOption = {
                    accountId: accountId,
                    qtyUoMId: qtyUoMId
                };
                supplyInventories = await SupplyInventoryApi.getSupplyInventoryByQtyUoM(getInventoryOption);
                debug('supplyInventories', supplyInventories);

                // Update supply Inventories by qtyUoMId
                var updateOption = {
                    accountId: accountId,
                    qtyUoMId: qtyUoMId,
                    shareItemType: Constants.SHARING_TYPE.supplyInventory
                };
                var updateInventoryResponse = await ProductInventoryApi.updateInventoryByQtyUoM(updateOption);
                debug('updateInventoryResponse', updateInventoryResponse);

                //If product inventory has realTime sharing then share the record
                if (DataUtils.isArray(supplyInventories) && supplyInventories.length > 0) {
                    var inventoryOptions = {
                        qtyOnHand: 0,
                        qtyOnHandUOM: qtyUoMId,
                        qtyOnOrder: 0,
                        qtyOnOrderUOM: qtyUoMId,
                        qtyAvailable: 0,
                        qtyAvailableUOM: qtyUoMId,
                        qtyInTransit: 0,
                        qtyInTransitUOM: qtyUoMId
                    };
                    await PromiseBluebird.each(supplyInventories, async function (supplyInventory) {
                        var conditionString, conditionValues;
                        if (supplyInventory.isRealTimeFrequency) {
                            var response = await ProductInventoryApi.getConditionString(inventoryOptions);
                            conditionString = response.string;
                            conditionValues = response.values;

                            var sharingOption = {
                                conditionString: conditionString,
                                conditionValues: conditionValues,
                                shareItemType: Constants.SHARING_TYPE.supplyInventory,
                                itemId: supplyInventory.id,
                                accountId: accountId
                            };
                            var shareResponse = await ProductReferenceApi.checkForRealTimeSharing(sharingOption);
                            debug('shareResponse', shareResponse);
                        }
                    });
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    checkForNameAndSymbol: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var name = options.name;
            var symbol = options.symbol;
            var scalingFactor = options.scalingFactor;
            var scalingPrecision = options.scalingPrecision;
            var unitOfMeasure = options.unitOfMeasure;
            var accountId = options.accountId;
            var id = options.id;
            var categoryId = options.categoryId;
            var queryString = 'IF EXISTS ';
            var end = ' END IF;';
            var params = [];
            var isName = false;
            var isSymbol = false;

            try {
                if (DataUtils.isDefined(name)) {
                    queryString += ' (select 1 from uomScaling us, uomNames un ' +
                      ' where un.name = ? and us.id = un.uomScalingId and us.categoryId = ? and (us.accountId = uuid_to_bin(?) or us.accountId = uuid_to_bin(?))) ' +
                      ' THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4004,MESSAGE_TEXT = "UNIT_OF_MEASURE_EXIST_WITH_SAME_NAME";';
                    params.push(name, categoryId, accountId, Constants.DEFAULT_REFERE_ID);
                    isName = true;
                }
                if (DataUtils.isDefined(symbol)) {
                    if (isName) {
                        queryString += ' ELSEIF EXISTS ';
                    }
                    queryString += '(select 1 from uomScaling us, uomNames un ' +
                      ' where un.symbol = ? and us.id = un.uomScalingId and us.categoryId = ? and (us.accountId = uuid_to_bin(?) or us.accountId = uuid_to_bin(?))) ' +
                      ' THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4005,MESSAGE_TEXT = "UNIT_OF_MEASURE_EXIST_WITH_SAME_SYMBOL";';
                    params.push(symbol, categoryId, accountId, Constants.DEFAULT_REFERE_ID);
                    isSymbol = true;
                }
                if (DataUtils.isDefined(scalingFactor) || DataUtils.isDefined(scalingPrecision)) {
                    var uomDetail = await UnitOfMeasures.getScalingFactorAndPrecision({
                        scalingFactor: scalingFactor,
                        scalingPrecision: scalingPrecision,
                        unitOfMeasure: unitOfMeasure
                    });
                    if (isName || isSymbol) {
                        queryString += ' ELSEIF EXISTS ';
                    }
                    queryString += ' (select 1 from uomScaling where categoryId = ? and scalingFactor = ? and scalingPrecision = ? ' +
                      ' and (accountId = uuid_to_bin(?) or accountId= uuid_to_bin(?))) ' +
                      ' THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4006,MESSAGE_TEXT = "UNIT_OF_MEASURE_EXIST_WITH_SAME_SCALING_FACTOR_AND_PRECISION";';
                    params.push(categoryId, uomDetail.scalingFactor, uomDetail.scalingPrecision, accountId, Constants.DEFAULT_REFERE_ID);
                }
                queryString += end;
                var conn = await connection.getConnection();
                if (params.length > 0) {
                    var response = await conn.query(queryString, params);
                    debug('response', response);
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    getScalingFactorAndPrecision: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var unitOfMeasure = options.unitOfMeasure;
            var scalingFactor = options.scalingFactor;
            var scalingPrecision = options.scalingPrecision;
            var response = {};
            if (DataUtils.isDefined(scalingFactor)) {
                response.scalingFactor = scalingFactor;
            } else {
                response.scalingFactor = unitOfMeasure.scalingFactor;
            }
            if (DataUtils.isDefined(scalingPrecision)) {
                response.scalingPrecision = scalingPrecision;
            } else {
                response.scalingPrecision = unitOfMeasure.scalingPrecision;
            }
            return resolve(response);
        });
    },

    update: async function (options, auditOptions, errorOptions, cb) {
        var id = options.id;
        var name = options.name;
        var symbol = options.symbol;
        var scalingPrecision = options.scalingPrecision;
        var scalingFactor = options.scalingFactor;
        var comment = options.comment;
        var updatedAt = options.updatedAt;
        var user = options.user;
        var accountId = user.accountId;
        var languageCultureCode = options.languageCultureCode;
        var userId = user.id;
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();
        var err;

        if (DataUtils.isValidateOptionalField(id)) {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_ID_REQUIRED);
        } else if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_UPDATED_AT_MUST_BE_NUMBER);
        } else if (updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_UPDATED_AT_INVALID);
        } else if (DataUtils.isValidateOptionalField(languageCultureCode)) {
            err = new Error(ErrorConfig.MESSAGE.LANGUAGE_CULTURE_CODE_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        err = await UnitOfMeasures.validateOptinalFields(options);

        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        try {
            await conn.query('START TRANSACTION');

            var queryStatment = 'select scalingFactor,scalingPrecision,categoryId from uomScaling where id = ?;';
            var queryParams = [id];
            var result = await conn.query(queryStatment, queryParams);
            var unitOfMeasure = Utils.filteredResponsePool(result);
            debug('unitOfMeasure', unitOfMeasure);

            if (!DataUtils.isObject(unitOfMeasure)) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_ID_INVALID);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            if (scalingFactor && unitOfMeasure.scalingFactor === 1 && scalingFactor !== 1) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_SCALING_FACTOR_CAN_NOT_UPDATE);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }
            if (scalingFactor && scalingFactor === 1 && unitOfMeasure.scalingFactor !== 1) {
                err = new Error(
                  ErrorConfig.MESSAGE.UNIT_OF_MEASURE_SCALING_FACTORE_CAN_NOT_ONE);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            // restrict update dupicate name and symobol and Restrict update if same uom exist with scaling factor and scaling precision
            var checkNameSymbolOption = {
                name: name,
                symbol: symbol,
                accountId: accountId,
                scalingFactor: scalingFactor,
                unitOfMeasure: unitOfMeasure,
                scalingPrecision: scalingPrecision,
                id: id,
                categoryId: unitOfMeasure.categoryId
            };
            var checkNameSymbolResponse = await UnitOfMeasures.checkForNameAndSymbol(checkNameSymbolOption);
            debug('checkNameSymbolResponse', checkNameSymbolResponse);


            var updatableFields = '';
            var columnBindParams = [];

            if (scalingPrecision) {
                updatableFields += ' scalingPrecision = ?,';
                columnBindParams.push(scalingPrecision);
            }
            if (scalingFactor) {
                updatableFields += ' scalingFactor = ?,';
                columnBindParams.push(scalingFactor);
            }

            var query = 'IF EXISTS (select 1 from uomCategory uc , uomScaling us where uc.categoryId = us.categoryId and us.id = ? ' +
              '  and us.isDefault = 1 and uc.accountId= uuid_to_bin(?)) THEN SIGNAL SQLSTATE "45000" SET ' +
              '  MYSQL_ERRNO = 4001,MESSAGE_TEXT = "CAN_NOT_UPDATE_PRE_DEFINED_UNIT_OF_MEASURE";' +
              '' +
              'ELSEIF NOT EXISTS (select * from  uomScaling where id = ? and updatedAt = ?) ' +
              'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4002,MESSAGE_TEXT = "UNIT_OF_MEASURE_UPDATED_SINCE_YOU_RETRIEVED";' +
              'ELSEIF EXISTS(select * from uomScaling where id = ? and isDefault=0 and categoryId in (select categoryId from uomCategory ' +
              'where (accountId = uuid_to_bin(?) or accountId = uuid_to_bin(?)))) then ' +
              'update uomScaling set ' + updatableFields + ' updatedAt = ?, updatedBy = uuid_to_bin(?) ' +
              'where id = ?; end if;';

            var bindParams = [id, Constants.DEFAULT_REFERE_ID, id, updatedAt, id, accountId, Constants.DEFAULT_REFERE_ID].concat(columnBindParams).concat([newUpdatedAt, userId, id]);

            var scalingUpdatedResult = await conn.query(query, bindParams);

            if (!Utils.isAffectedPool(scalingUpdatedResult)) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }

            updatableFields = '';
            columnBindParams = [id, languageCultureCode];
            //columnBindParams = [id, languageCultureCode, name || '', languageCultureCode, id, id];

            if (name) {
                updatableFields += ' name = ?,';
                columnBindParams.push(name);
            }
            if (symbol) {
                updatableFields += ' symbol = ?,';
                columnBindParams.push(symbol);
            }
            if (comment) {
                updatableFields += ' comment = ?,';
                columnBindParams.push(comment);
            }

            query = 'IF NOT EXISTS (select * from uomNames where uomScalingId = ? and languageCultureCode = ? ) ' +
              'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4003,MESSAGE_TEXT = "LANGUAGE_CULTURE_CODE_INVALID";' +
              '' +
              /*'ELSEIF EXISTS (select * from uomNames where name = ? and  languageCultureCode = ? and ' +
              'uomScalingId in (select id from uomScaling where id != ? and ' +
              'categoryId in (select categoryId from uomScaling where id = ?))) ' +
              'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4004,MESSAGE_TEXT = "UNIT_OF_MEASURE_EXIST_WITH_SAME_NAME";' +*/
              '' +
              'ELSE update uomNames set ' + updatableFields + ' updatedAt = ?, updatedBy = uuid_to_bin(?) ' +
              'where uomScalingId = ? and languageCultureCode = ?; end if;';

            columnBindParams = columnBindParams.concat(newUpdatedAt, userId, id, languageCultureCode);
            var namesUpdatedResult = await conn.query(query, columnBindParams);

            if (!Utils.isAffectedPool(namesUpdatedResult)) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            AuditUtils.create(auditOptions);

            // Update Product or Supply or Product Inventory or supply Inventory qty if this uom is used in it
            if (DataUtils.isDefined(scalingFactor) || DataUtils.isDefined(scalingPrecision)) {

                // Update affected Product reference
                var updateEntityOption = {
                    accountId: accountId,
                    userId: userId,
                    qtyUoMId: id
                };
                var updateProductResponse = await UnitOfMeasures.updateProductReference(updateEntityOption);
                debug('updateProductResposne', updateProductResponse);

                // Update affected Supply Item
                var updateSupplyResponse = await UnitOfMeasures.updateSupplyItem(updateEntityOption);
                debug('updateSupplyResposne', updateSupplyResponse);

                // Update affected Product Inventory
                var updateProductInventoryResponse = await UnitOfMeasures.updateProductInventories(updateEntityOption);
                debug('updateProductInventoryResponse', updateProductInventoryResponse);

                // Update affected Supply inventory
                var updateSupplyInventoryResponse = await UnitOfMeasures.updateSupplyInventories(updateEntityOption);
                debug('updateSupplyInventoryResponse', updateSupplyInventoryResponse);
            }

            await conn.query('COMMIT;');
            return cb(null, {
                id: id,
                updatedAt: newUpdatedAt,
                OK: Constants.SUCCESS_MESSAGE.UNIT_OF_MEASURE_UPDATE_SUCCESS
            });
        } catch (err) {
            await conn.query('ROLLBACK;');
            debug('err', err);
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);

            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.CAN_NOT_UPDATE_PRE_DEFINED_UNIT_OF_MEASURE);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno === 4002) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_UPDATED_SINCE_YOU_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
            } else if (err.errno === 4003) {
                err = new Error(ErrorConfig.MESSAGE.LANGUAGE_CULTURE_CODE_INVALID);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno === 4004) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_EXIST_WITH_SAME_NAME);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno === 4005) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_EXIST_WITH_SAME_SYMBOL);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno === 4006) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_EXIST_WITH_SAME_SCALING_FACTOR_AND_PRECISION);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    delete: async function (options, auditOptions, errorOptions, cb) {
        var id = options.id;
        var accountId = options.accountId;
        var updatedAt = options.updatedAt;
        var defaultAccountId = Constants.DEFAULT_REFERE_ID;
        var err;

        if (DataUtils.isUndefined(id)) {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_ID_REQUIRED);
        } else if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_UPDATED_AT_MUST_BE_NUMBER);
        } else if (updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_UPDATED_AT_INVALID);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var query =
              ' IF EXISTS (select 1 from uomCategory uc , uomScaling us where uc.categoryId = us.categoryId and us.id = ? ' +
              ' and us.isDefault = 1 and uc.accountId= uuid_to_bin(?)) THEN SIGNAL SQLSTATE "45000" SET  ' +
              ' MYSQL_ERRNO = 4001,MESSAGE_TEXT = "CAN_NOT_DELETE_PRE_DEFINED_UNIT_OF_MEASURE";' +
              '' +
              ' ELSEIF NOT EXISTS (select * from uomScaling us, uomCategory uc where us.id = ? and uc.categoryId = us.categoryId ' +
              ' and (uc.accountId = uuid_to_bin(?) or uc.accountId = uuid_to_bin(?))) ' +
              ' THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4002,MESSAGE_TEXT = "UNIT_OF_MEASURE_ID_INVALID";' +
              '' +
              ' ELSEIF EXISTS (select * from ProductReferences where weightUoMScal = ? or heightUoMScal= ? or lengthUoMScal = ? ' +
              ' or volumeUoMScal = ?  or diameterUoMScal = ? or depthUoMScal = ? ) THEN SIGNAL SQLSTATE "45000" SET ' +
              ' MYSQL_ERRNO = 4003,MESSAGE_TEXT = "UNIT_OF_MEASURE_REFERENCE_USED_BY_PRODUCT_REFERENCE";' +
              '' +
              ' ELSEIF EXISTS (select * from SupplyItems where weightUoMScal = ? or heightUoMScal= ? or lengthUoMScal = ? ' +
              ' or volumeUoMScal = ? or diameterUoMScal = ? or depthUoMScal = ? ) THEN SIGNAL SQLSTATE "45000" SET ' +
              ' MYSQL_ERRNO = 4004,MESSAGE_TEXT = "UNIT_OF_MEASURE_USED_BY_SUPPLY_ITEM";' +
              '' +
              ' ELSEIF EXISTS (select * from ProductInventory where qtyOnHandUoM = ? or qtyOnOrderUoM= ? or qtyAvailableUoM = ? ' +
              ' or qtyInTransitUoM = ? ) THEN SIGNAL SQLSTATE "45000" SET ' +
              ' MYSQL_ERRNO = 4005,MESSAGE_TEXT = "UNIT_OF_MEASURE_USED_BY_PRODUCT_INVENTORY";' +
              '' +
              ' ELSEIF EXISTS (select * from SupplyInventory where qtyOnHandUoM = ? or qtyOnOrderUoM= ? or qtyAvailableUoM = ? ' +
              ' or qtyInTransitUoM = ? ) THEN SIGNAL SQLSTATE "45000" SET ' +
              ' MYSQL_ERRNO = 4006,MESSAGE_TEXT = "UNIT_OF_MEASURE_USED_BY_SUPPLY_INVENTORY";' +
              '' +
              ' ELSEIF NOT EXISTS (select 1 from uomScaling where id = ? and updatedAt = ?) ' +
              ' THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4007,MESSAGE_TEXT = "UNIT_OF_MEASURE_UPDATED_SINCE_YOU_RETRIEVED";' +
              '' +
              ' ELSEIF EXISTS (SELECT 1 FROM uomScaling us1,uomScaling us2, uomCategory uC WHERE uC.categoryId = us1.categoryId ' +
              ' AND us1.categoryId = us2.categoryId AND us1.scalingFactor=1.000000 AND us2.scalingFactor != 1.000000  AND us1.id = ?) ' +
              ' THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4008,MESSAGE_TEXT = "CAN_NOT_DELETE_DEFAULT_UNIT_OF_MEASURE";' +
              '' +
              ' ELSE delete us , un FROM uomScaling us, uomNames un where us.id = ? and us.id=un.uomScalingId; END IF;';

            var params = [id, defaultAccountId, id, accountId, defaultAccountId, id, id, id, id, id, id, id, id, id, id, id, id, id,
                id, id, id, id, id, id, id, id, updatedAt, id, id];
            var uomScalingResult = await conn.query(query, params);
            debug('uomScalingResult', uomScalingResult);

            AuditUtils.create(auditOptions);
            return cb(null, {OK: Constants.SUCCESS_MESSAGE.UNIT_OF_MEASURE_DELETE_SUCCESS});
        } catch (err) {
            debug('err', err);
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);

            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.CAN_NOT_DELETE_PRE_DEFINED_UNIT_OF_MEASURE);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno === 4002) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_ID_INVALID);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno === 4003) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_REFERENCE_USED_BY_PRODUCT_REFERENCE);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno === 4004) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_USED_BY_SUPPLY_ITEM);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno === 4005) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_USED_BY_PRODUCT_INVENTORY);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno === 4006) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_USED_BY_SUPPLY_INVENTORY);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno === 4007) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_UPDATED_SINCE_YOU_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
            } else if (err.errno === 4008) {
                err = new Error(ErrorConfig.MESSAGE.CAN_NOT_DELETE_DEFAULT_UNIT_OF_MEASURE);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
            } else if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_DELETE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    getUnitOfMeasuresByAccountId: async function (options, errorOptions, cb) {
        var accountId = options.user.accountId;
        var languageCultureCode = options.languageCultureCode;
        var categoryId = options.categoryId;
        var err;

        if (DataUtils.isUndefined(categoryId)) {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_ID_REQUIRED);
        } else if (DataUtils.isUndefined(languageCultureCode)) {
            err = new Error(ErrorConfig.MESSAGE.LANGUAGE_CULTURE_CODE_REQUIRED);
        } else if (Constants.VALID_LANGUAGE_CULTURE_CODE.indexOf(options.languageCultureCode) === -1) {
            err = new Error(ErrorConfig.MESSAGE.LANGUAGE_CULTURE_CODE_INVALID);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('err', err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var category = await conn.query('select 1 from uomCategory where (accountId =uuid_to_bin("00000000-0000-0000-0000-000000000000") ' +
              'and categoryId = ?) or (accountId = uuid_to_bin(?) and categoryId = ?) LIMIT 1', [categoryId, accountId, categoryId]);
            category = Utils.filteredResponsePool(category);

            if (!category) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_ID_INVALID);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            var query = 'select ' +
              'us.id, us.categoryId, us.scalingPrecision, us.scalingFactor,us.isDefault, us.createdAt, us.updatedAt,  ' +
              'un.name, un.languageCultureCode, un.symbol, un.comment from uomScaling us, uomNames un ' +
              'where us.id = un.uomScalingId and (us.accountId = uuid_to_bin(?) or us.accountId = uuid_to_bin(?)) and un.languageCultureCode = ? and us.categoryId = ? ; ';
            var uoms = await conn.query(query, [accountId, Constants.DEFAULT_REFERE_ID, languageCultureCode, categoryId]);

            /*var uoms = [];
            if (!_.isEmpty(findUom)) {
                uoms = findUom[0];
            }*/
            return cb(null, uoms || []);

        } catch (err) {

            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);

            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    getUnitOfMeasuresById: async function (options, errorOptions, cb) {

        var id = options.id;
        var accountId = options.user.accountId;
        var languageCultureCode = options.languageCultureCode;
        var err;

        if (DataUtils.isUndefined(id)) {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_ID_REQUIRED);
        }
        if (!err && DataUtils.isUndefined(languageCultureCode)) {
            err = new Error(ErrorConfig.MESSAGE.LANGUAGE_CULTURE_CODE_REQUIRED);
        }
        if (!err && Constants.VALID_LANGUAGE_CULTURE_CODE.indexOf(options.languageCultureCode) === -1) {
            err = new Error(ErrorConfig.MESSAGE.LANGUAGE_CULTURE_CODE_INVALID);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('err', err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var query = 'select ' +
              'us.id, us.categoryId, us.scalingPrecision, us.scalingFactor,us.isDefault, us.createdAt, us.updatedAt, ' +
              'un.name, un.languageCultureCode, un.symbol, un.comment ' +
              'from uomScaling us, uomNames un ' +
              'where us.id = un.uomScalingId and (us.accountId = uuid_to_bin(?) or us.accountId = uuid_to_bin(?)) and ' +
              'un.languageCultureCode = ? and us.categoryId = (select categoryId from uomScaling where id = ?)  and ' +
              '(select count(*) from uomCategory uc, uomScaling us where (uc.accountId = 0 and uc.categoryId=us.categoryId) ' +
              'or (uc.accountId = uuid_to_bin(?) and uc.categoryId=us.categoryId)) != 0' +
              '; ';

            var uoms = await conn.query(query, [accountId, Constants.DEFAULT_REFERE_ID, languageCultureCode, id, accountId]);
            return cb(null, uoms || []);
        } catch (err) {
            debug('err', err);
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    getUnitOfMeasureById: async function (options, errorOptions, cb) {

        var id = options.id;
        var accountId = options.user.accountId;
        var languageCultureCode = options.languageCultureCode;
        var err;

        if (DataUtils.isUndefined(id)) {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_ID_REQUIRED);
        }
        if (!err && DataUtils.isUndefined(languageCultureCode)) {
            err = new Error(ErrorConfig.MESSAGE.LANGUAGE_CULTURE_CODE_REQUIRED);
        }
        if (!err && Constants.VALID_LANGUAGE_CULTURE_CODE.indexOf(options.languageCultureCode) === -1) {
            err = new Error(ErrorConfig.MESSAGE.LANGUAGE_CULTURE_CODE_INVALID);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var query = 'select ' +
              'us.id,us.categoryId, us.scalingPrecision, us.scalingFactor,us.isDefault, us.createdAt, us.updatedAt, ' +
              'un.name, un.languageCultureCode, un.symbol, un.comment ' +
              'from uomScaling us, uomNames un ' +
              'where us.id = un.uomScalingId and un.languageCultureCode = ? and us.id = ? and ' +
              '(select 1 from uomCategory uc, uomScaling us where (uc.accountId = uuid_to_bin(?) and uc.categoryId=us.categoryId) ' +
              'or (uc.accountId = uuid_to_bin(?) and uc.categoryId=us.categoryId) LIMIT 1) is not null' +
              '; ';

            var findUom = await conn.query(query, [languageCultureCode, id, Constants.DEFAULT_REFERE_ID, accountId]);
            var uoms = Utils.filteredResponsePool(findUom);
            return cb(null, uoms || []);

        } catch (err) {
            debug('err', err);
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    validateOptinalFields: function (options) {
        var err;

        if (!DataUtils.isValidateOptionalField(options.categoryId) && !DataUtils.isNumber(options.categoryId)) {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_ID_MUST_BE_NUMBER);
        }

        if (!err && !DataUtils.isValidateOptionalField(options.id) && !DataUtils.isNumber(options.id)) {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_ID_MUST_BE_NUMBER);
        }

        if (!err && !DataUtils.isValidateOptionalField(options.languageCultureCode)) {
            if (options.languageCultureCode === '') {
                err = new Error(
                  ErrorConfig.MESSAGE.LANGUAGE_CULTURE_CODE_CAN_NOT_BE_EMPTY);
            }
            if (!err && Constants.VALID_LANGUAGE_CULTURE_CODE.indexOf(options.languageCultureCode) === -1) {
                err = new Error(ErrorConfig.MESSAGE.LANGUAGE_CULTURE_CODE_INVALID);
            }
        }

        if (!err && !DataUtils.isValidateOptionalField(options.scalingPrecision)) {
            if (!DataUtils.isNumber(options.scalingPrecision)) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_PRECISION_MUST_BE_NUMBER);
            }
            if (parseInt(options.scalingPrecision) > 6) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_PRECISION_MUST_BE_LESS_THAN_6);
            }
        }

        if (!err && !DataUtils.isValidateOptionalField(options.scalingFactor)) {
            if (!DataUtils.isNumber(options.scalingFactor)) {
                err = new Error(
                  ErrorConfig.MESSAGE.UNIT_OF_MEASURE_SCALING_FACTOR_MUST_BE_NUMBER);
            }
        }

        if (!err && !DataUtils.isValidateOptionalField(options.name)) {
            if (!DataUtils.isString(options.name)) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_NAME_MUST_BE_STRING);
            }
            if (!err && options.name === '') {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_NAME_CAN_NOT_BE_EMPTY);
            }
            if (!err && options.name.length > 60) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_NAME_LENGTH_OUT_OF_RANGE);
            }
        }

        if (!err && !DataUtils.isValidateOptionalField(options.symbol)) {
            if (!DataUtils.isString(options.symbol)) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_SYMBOL_MUST_BE_STRING);
            }
            if (!err && options.symbol === '') {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_SYMBOL_CAN_NOT_BE_EMPTY);
            }
            if (!err && options.symbol.length > 40) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_SYMBOL_LENGTH_OUT_OF_RANGE);
            }
        }

        if (!err && !DataUtils.isValidateOptionalField(options.comment)) {
            if (!DataUtils.isString(options.comment)) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_COMMENT_MUST_BE_STRING);
            }
            if (!err && options.comment.length > 140) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_COMMENT_LENGTH_OUT_OF_RANGE);
            }
        }
        if (err) {
            return err;
        }
    }
};

module.exports = UnitOfMeasures;





