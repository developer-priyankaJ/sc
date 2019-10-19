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

var DependentDemand = {

    /*
    * Get supply item by accountid and sku
    * */
    /*create: async function (options, auditOptions, errorOptions, cb) {
        var productRefId = options.productRefId;
        var supplyItemId = options.supplyItemId;
        var dependentDemandId = options.dependentDemandId;
        var dependentDemandName = options.dependentDemandName;
        var accountId = options.accountId;
        var err;

        if (DataUtils.isUndefined(productRefId)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_ID_REQUIRED);
        } else if (DataUtils.isUndefined(supplyItemId)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_ID_REQUIRED);
        } else if (DataUtils.isUndefined(dependentDemandId)) {
            err = new Error(ErrorConfig.MESSAGE.DEPENDENT_DEMAND_ID_REQUIRED);
        } else if (DataUtils.isUndefined(dependentDemandName)) {
            err = new Error(ErrorConfig.MESSAGE.DEPENDENT_DEMAND_NAME_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            debug('err', err);
            return cb(err);
        }
        try {
            //CREATE DEPENDENT DEMAND
            var createResponse = await DependentDemand.createDependentDemand(options, errorOptions);
            debug('createResponse', createResponse);

            AuditUtils.create(auditOptions);
            return cb(null, createResponse);
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
    },

    /!*
    * Create dependent demand
    * *!/
    createDependentDemand: function (options, errorOptions, cb) {
        return new Promise(async function (resolve, reject) {
            var user = options.user;
            var accountId = user.accountId;
            var productRefId = options.productRefId;
            var supplyItemId = options.supplyItemId;
            var dependentDemandId = options.dependentDemandId;
            var dependentDemandName = options.dependentDemandName;
            var generatedId = Utils.generateId();
            var createdAt = DataUtils.getEpochMSTimestamp();
            var updatedAt = DataUtils.getEpochMSTimestamp();
            var err;

            try {
                var conn = await connection.getConnection();
                var isCreated = await conn.query(' IF (select 1 from BillOfMaterial where accountId = uuid_to_bin(?) and ' +
                  ' productRefId = uuid_to_bin(?) and supplyItemId = uuid_to_bin(?) and effectiveToDateTime=? ) is null then ' +
                  ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "BILL_OF_MATERIAL_NOT_FOUND", MYSQL_ERRNO = 4001; ' +
                  ' ELSEIF (select 1 from DependentDemands where accountId=uuid_to_bin(?) and dependentDemandId = ?) is not null then ' +
                  ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "DEPENDENT_DEMAND_ID_DEPLICATE", MYSQL_ERRNO = 4002;' +
                  ' ELSEIF (select 1 from DependentDemands where accountId=uuid_to_bin(?) and ' +
                  ' productRefId = uuid_to_bin(?) and supplyItemId=uuid_to_bin(?) and status = 1) is not null then ' +
                  ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "DEPENDENT_DEMAND_IS_ALREADY_EXIST", MYSQL_ERRNO = 4003;' +
                  ' ELSE insert into DependentDemands set id=uuid_to_bin(?), accountId=uuid_to_bin(?), productRefId = uuid_to_bin(?), ' +
                  ' supplyItemId=uuid_to_bin(?),dependentDemandId=?,dependentDemandName=?,createdAt=?, updatedAt=?, createdBy=uuid_to_bin(?);END IF',
                  [accountId, productRefId, supplyItemId, Constants.DEFAULT_DATE, accountId, dependentDemandId, accountId,
                      productRefId, supplyItemId, generatedId.uuid, accountId, productRefId, supplyItemId, dependentDemandId,
                      dependentDemandName, createdAt, updatedAt, user.id]);
                isCreated = Utils.isAffectedPool(isCreated);
                if (!isCreated) {
                    err = new Error(ErrorConfig.MESSAGE.DEPENDENT_DEMAND_CREATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    await ErrorUtils.create(errorOptions, options, err);
                    return reject(err);
                }
                return resolve({
                    OK: Constants.SUCCESS_MESSAGE.DEPENDENT_DEMAND_CREATED_SUCCESSFULLY,
                    id: generatedId.uuid,
                    createdAt: createdAt
                });
            } catch (err) {
                debug('err', err);
                if (err.errno === 4001) {
                    err = new Error(ErrorConfig.MESSAGE.BILL_OF_MATERIAL_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                } else if (err.errno === 4002) {
                    err = new Error(ErrorConfig.MESSAGE.DEPENDENT_DEMAND_ID_DEPLICATE);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                } else if (err.errno === 4003) {
                    err = new Error(ErrorConfig.MESSAGE.DEPENDENT_DEMAND_IS_ALREADY_EXIST);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                } else {
                    err = new Error(ErrorConfig.MESSAGE.DEPENDENT_DEMAND_CREATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                }
                await ErrorUtils.create(errorOptions, options, err);
                return reject(err);
            }
        });
    },

    getDependentDemand: async function (options, errorOptions, cb) {
        var accountId = options.accountId;
        var user = options.user;
        var languageCultureCode = user.languageCultureCode;
        debug('');
        var err;

        try {
            var conn = await connection.getConnection();
            var dependentDemands = await conn.query('select CAST(uuid_from_bin(D.id) as CHAR) as id,' +
              ' CAST(uuid_from_bin(D.accountId) as CHAR) as accountId,CAST(uuid_from_bin(D.productRefId) as CHAR) as productRefId,' +
              ' CAST(uuid_from_bin(D.supplyItemId) as CHAR) as supplyItemId,D.dependentDemandId,D.dependentDemandName,P.sku as productRefSKU,P.sellerSKUName as productRefSellerSKUName,' +
              ' P.qtyUoMId AS productUoMId,' +
              ' UN1.NAME AS productUoMName,UN1.symbol AS productUoMSymbol,S.sku as supplyItemSKU,S.sellerSKUName as supplyItemSellerSKUName,' +
              ' S.qtyUoMId AS supplyUoMId,UN2.NAME AS supplyUoMName,UN2.symbol AS supplyUoMSymbol,' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (BOM.quantity / CAST(power(10,6) as INTEGER))))) as BOMQuantity,BOM.qtyUOM AS BOMUoMId,D.updatedAt ' +
              ' from ' +
              ' DependentDemands D,ProductReferences P,SupplyItems S,BillOfMaterial BOM , uomNames UN1,uomNames UN2 ' +
              ' where D.accountId=uuid_to_bin(?) and P.id = D.productRefId and S.id = D.supplyItemId and D.STATUS = ? AND ' +
              ' BOM.productRefId = D.productRefId AND BOM.supplyItemId = D.supplyItemId AND BOM.effectiveToDateTime = 0 AND ' +
              ' UN1.uomScalingId = P.qtyUoMId AND UN1.languageCultureCode = ? AND ' +
              ' UN2.uomScalingId = S.qtyUoMId AND UN2.languageCultureCode = ? ',
              [accountId, Constants.DEPENDENT_DEMAND_STATUS.ACTIVE, languageCultureCode, languageCultureCode]);
            if (!dependentDemands) {
                return cb(null, []);
            }
            return cb(null, dependentDemands);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.DEPENDENT_DEMAND_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    validateDependentDemandFields: function (options) {
        return new Promise(function (resolve, reject) {
            var fields = '', values = [];
            if (DataUtils.isDefined(options.dependentDemandName)) {
                fields += ' dependentDemandName=?, ';
                values.push(options.dependentDemandName);
            }
            return resolve({
                fields: fields,
                values: values
            });
        });
    },

    updateDependentDemand: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var accountId = options.accountId;
        var userId = user.id;
        var id = options.id;
        var updatedAt = options.updatedAt;
        var currentTime = DataUtils.getEpochMSTimestamp();
        var err;

        if (DataUtils.isUndefined(id)) {
            err = new Error(ErrorConfig.MESSAGE.DEPENDENT_DEMAND_ID_REQUIRED);
        } else if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.DEPENDENT_DEMAND_UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_MUST_BE_NUMBER);
        } else if (updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.DEPENDENT_DEMAND_INVALID_UPDATED_AT);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        try {
            var response = await DependentDemand.validateDependentDemandFields(options);
            var conn = await connection.getConnection();
            var isUpdated = await conn.query('IF (select 1 from DependentDemands where accountId = uuid_to_bin(?) and ' +
              ' id = uuid_to_bin(?)) is null then ' +
              ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "DEPENDENT_DEMAND_NOT_FOUND", MYSQL_ERRNO = 4001; ' +
              ' ELSEIF (select 1 from DependentDemands where accountId = uuid_to_bin(?) and id = uuid_to_bin(?) ' +
              ' and updatedAt=?) is null then ' +
              ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "DEPENDENT_DEMAND_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVE", MYSQL_ERRNO = 4002;' +
              ' ELSE UPDATE DependentDemands set ' + response.fields + ' updatedAt=?,updatedBy=uuid_to_bin(?)' +
              ' where id = uuid_to_bin(?) ; END IF;', [accountId, id, accountId, id, updatedAt].concat(response.values).concat(currentTime, userId, id));
            isUpdated = Utils.isAffectedPool(isUpdated);
            if (!isUpdated) {
                throw err;
            }
            return cb(null, {
                OK: Constants.SUCCESS_MESSAGE.DEPENDENT_DEMAND_UPDATED_SUCCESSFULLY,
                updatedAt: currentTime
            });
        } catch (err) {
            debug('err', err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.DEPENDENT_DEMAND_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno === 4002) {
                err = new Error(ErrorConfig.MESSAGE.DEPENDENT_DEMAND_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVE);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
            } else {
                err = new Error(ErrorConfig.MESSAGE.DEPENDENT_DEMAND_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    deleteDependentDemand: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var userId = user.id;
        var id = options.id;
        var updatedAt = options.updatedAt;
        var accountId = options.accountId;
        var currentTime = DataUtils.getEpochMSTimestamp();
        var err;

        if (DataUtils.isUndefined(id)) {
            err = new Error(ErrorConfig.MESSAGE.DEPENDENT_DEMAND_ID_REQUIRED);
        } else if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.DEPENDENT_DEMAND_UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.DEPENDENT_DEMAND_UPDATED_AT_MUST_BE_NUMBER);
        } else if (updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.DEPENDENT_DEMAND_INVALID_UPDATED_AT);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var isDelete = await conn.query('IF (select 1 from DependentDemands where accountId=uuid_to_bin(?) and ' +
              ' id=uuid_to_bin(?)) is null then ' +
              ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "DEPENDENT_DEMAND_NOT_FOUND", MYSQL_ERRNO = 4001; ' +
              ' ELSEIF (select 1 from DependentDemands where accountId = uuid_to_bin(?) and id=uuid_to_bin(?) and updatedAt = ?) is null then ' +
              ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "DEPENDENT_DEMAND_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVE", MYSQL_ERRNO = 4002; ' +
              ' ELSE update DependentDemands set status = ? ,updatedAt=? ,updatedBy=uuid_to_bin(?) where accountId = uuid_to_bin(?) ' +
              ' and id = uuid_to_bin(?); ' +
              ' END IF;', [accountId, id, accountId, id, updatedAt, Constants.DEPENDENT_DEMAND_STATUS.IN_ACTIVE, currentTime, userId, accountId, id]);
            if (!isDelete) {
                throw  err;
            }
            return cb(null, {
                OK: Constants.SUCCESS_MESSAGE.DEPENDENT_DEMAND_DELETED_SUCCESSFULLY
            });
        } catch (err) {
            debug('err', err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.DEPENDENT_DEMAND_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno === 4002) {
                err = new Error(ErrorConfig.MESSAGE.DEPENDENT_DEMAND_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVE);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
            } else {
                err = new Error(ErrorConfig.MESSAGE.DEPENDENT_DEMAND_DELETE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    /!*
    * Get supply items whose BOM is created by productRefId
    * *!/
    searchSupplyItemByProductRefId: async function (options, errorOptions, cb) {
        var productRefId = options.productRefId;
        var accountId = options.accountId;
        var err;

        if (DataUtils.isUndefined(productRefId)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var supplyItems = await conn.query('SELECT CAST(uuid_from_bin(S.id) as CHAR) as supplyItemId,S.sku,S.sellerSKUName' +
              ' FROM SupplyItems S, BillOfMaterial B WHERE B.accountId = uuid_to_bin(?) AND B.productRefId = uuid_to_bin(?) ' +
              ' AND S.id = B.supplyItemId AND S.accountId = B.accountId AND B.effectiveToDateTime = 0;', [accountId, productRefId]);
            if (!supplyItems) {
                return cb(null, []);
            }
            return cb(null, supplyItems);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    }*/
};


module.exports = DependentDemand;
