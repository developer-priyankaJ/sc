'use strict';

var debug = require('debug')('scopehub.route.unit_of_measure_category');
var Async = require('async');
var _ = require('lodash');
var knex = require('../lib/knex_util');
var PromiseBluebird = require('bluebird');

var connection = require('../lib/connection_util');
var DataUtils = require('../lib/data_utils');
var ErrorConfig = require('../data/error');
var ErrorUtils = require('../lib/error_utils');
var AuditUtils = require('../lib/audit_utils');
var Utils = require('../lib/utils');
var Constants = require('../data/constants');


var UnitOfMeasureCategory = {
    create: async function (options, errorOptions, cb) {
        var userId = options.userId;
        var accountId = options.accountId;
        var name = options.name;
        var comment = options.comment || '';
        var currentTime = DataUtils.getEpochMSTimestamp();
        var err;

        if (DataUtils.isUndefined(accountId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
        }
        if (!err && DataUtils.isValidateOptionalField(name)) {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_NAME_REQUIRED);
        }
        if (!err && !DataUtils.isString(name)) {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_NAME_MUST_BE_STRING);
        }
        if (!err && name === '') {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_NAME_CAN_NOT_BE_EMPTY);
        }
        if (!err && name.length > 60) {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_NAME_LENGTH_OUT_OF_RANGE);
        }
        if (!err && !DataUtils.isValidateOptionalField(comment) && !DataUtils.isString(comment)) {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_COMMENT_MUST_BE_STRING);
        }
        if (!err && !DataUtils.isValidateOptionalField(comment) && comment.length > 140) {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_COMMENT_LENGTH_OUT_OF_RANGE);
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
            await conn.query('START TRANSACTION;');

            var maxCategory = await conn.query('select max(categoryId) as maxCategoryId from uomCategory');
            maxCategory = Utils.filteredResponsePool(maxCategory);

            if (DataUtils.isObject(maxCategory)) {

                var categoryId = (isNaN(maxCategory.maxCategoryId) ? 0 : parseInt(maxCategory.maxCategoryId)) + 1;
                var query = 'If EXISTS (select 1 from uomCategory where (accountId = uuid_to_bin(?) AND name = ?) ' +
                  ' OR (accountId = uuid_to_bin(?) AND name = ?)) then ' +
                  ' SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "UNIT_OF_MEASURE_CATEGORY_CREATE_DUPLICATE" ;' +
                  '' +
                  ' ELSE INSERT into uomCategory (categoryId,name,languageCultureCode,accountId,comment,createdAt,updatedAt,createdBy)' +
                  ' values(?,?,?,uuid_to_bin(?),?,?,?,uuid_to_bin(?)),' +
                  ' (?,?,?,uuid_to_bin(?),?,?,?,uuid_to_bin(?)); end if';

                var params = [Constants.DEFAULT_REFERE_ID, name, accountId, name, categoryId, name, 'en-US',
                    accountId, comment, currentTime, currentTime, userId, categoryId, name, 'de-DE', accountId, comment,
                    currentTime, currentTime, userId];

                debug('query', query);
                debug('params', params);

                var category = await conn.query(query, params);
                var isAffected = Utils.isAffectedPool(category);
                debug('isAffected', isAffected);
                if (!isAffected) {
                    err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_CREATE_DUPLICATE);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
                await conn.query('COMMIT;');

                return cb(null, {
                    categoryId: categoryId,
                    createdAt: currentTime,
                    OK: Constants.SUCCESS_MESSAGE.UNIT_OF_MEASURE_CATEGORY_CREATE_SUCCESS
                });

            } else {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_CREATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
        } catch (err) {
            debug('err', err);
            debug('err', err);
            await conn.query('ROLLBACK');
            await ErrorUtils.create(errorOptions, options, err);
            if (err.errno === 4001) {
                debug('Inside if');
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_CREATE_DUPLICATE);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno) {
                debug('Inside esle');
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_CREATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    update: async function (options, auditOptions, errorOptions, cb) {

        var categoryId = options.categoryId;
        var updatedAt = options.updatedAt;
        var name = options.name;
        var accountId = options.user.accountId;
        var userId = options.user.id;
        var languageCultureCode = options.languageCultureCode;
        var flag = true;
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();
        var err;

        if (DataUtils.isUndefined(accountId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
        } else if (DataUtils.isValidateOptionalField(categoryId)) {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_ID_REQUIRED);
        } else if (!DataUtils.isNumber(categoryId)) {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_ID_MUST_BE_NUMBER);
        } else if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_UPDATED_AT_MUST_BE_NUMBER);
        } else if (updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_UPDATED_AT_INVALID);
        } else if (DataUtils.isValidateOptionalField(languageCultureCode)) {
            err = new Error(ErrorConfig.MESSAGE.LANGUAGE_CULTURE_CODE_REQUIRED);
        } else if (Constants.VALID_LANGUAGE_CULTURE_CODE.indexOf(options.languageCultureCode) === -1) {
            err = new Error(ErrorConfig.MESSAGE.LANGUAGE_CULTURE_CODE_INVALID);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        var updateFields = '',
          updateBindParams = [categoryId, categoryId, Constants.DEFAULT_REFERE_ID, categoryId, languageCultureCode, updatedAt,
              categoryId, languageCultureCode, accountId];

        try {
            var conn = await connection.getConnection();

            // Check if name is already in uomCategory table
            if (DataUtils.isDefined(name)) {
                var uomCategory = await conn.query('select categoryId,languageCultureCode,name from uomCategory where ' +
                  '(accountId = uuid_to_bin(?) AND name = ?)  OR (accountId = uuid_to_bin(?) AND name = ?); ',
                  [Constants.DEFAULT_REFERE_ID, name, accountId, name]);
                //uomCategory = Utils.filteredResponsePool(uomCategory);

                if (DataUtils.isArray(uomCategory) && (uomCategory.length === 1 && uomCategory[0].categoryId === categoryId &&
                    languageCultureCode === uomCategory[0].languageCultureCode)) {
                }
                else if (DataUtils.isArray(uomCategory) && uomCategory.length > 0) {
                    err = new Error(ErrorConfig.MESSAGE.SAME_CATEGORY_NAME_IS_USED_IN_ONE_OF_THE_EXISTING_LANGUAGE_CULTURE_CODE);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return cb(err);
                }
            }

            var result = await UnitOfMeasureCategory.validateOptinalFields(options);
            var values = result.values;

            if (values.length === 0) {
                throw new Error(ErrorConfig.MESSAGE.INVALID_REQUEST);
            }

            updateFields = result.fileds;
            updateBindParams = updateBindParams.concat(result.values);

        } catch (err) {

            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            return cb(err);
        }

        try {

            var query =
              'IF NOT EXISTS (select * from uomCategory where categoryId = ?) ' +
              'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "UNIT_OF_MEASURE_CATEGORY_ID_INVALID";' +
              'ELSEIF EXISTS (select 1 from uomCategory where categoryId = ? and accountId = uuid_to_bin(?)) ' +
              ' THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4002,MESSAGE_TEXT = "CAN_NOT_UPDATE_DEFAULT_UNIT_OF_MEASURE_CATEGORY"; ' +
              'ELSEIF NOT EXISTS (select * from uomCategory where categoryId = ? and languageCultureCode = ? and updatedAt = ?) ' +
              'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4003,MESSAGE_TEXT = "UNIT_OF_MEASURE_CATEGORY_UPDATED_SINCE_YOU_RETRIEVED";' +
              'ELSEIF EXISTS (select * from uomCategory where categoryId = ? and languageCultureCode = ? and accountId = uuid_to_bin(?)) THEN ' +
              'update uomCategory set ' + updateFields + ' updatedBy = uuid_to_bin(?), updatedAt = ? ' +
              'where categoryId = ? and languageCultureCode = ?;  end if';

            updateBindParams.push(userId, newUpdatedAt, categoryId, languageCultureCode);

            var update = await conn.query(query, updateBindParams);
            var isAffected = Utils.isAffectedPool(update);

            if (!isAffected) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            AuditUtils.create(auditOptions);
            return cb(null, {
                categoryId: categoryId,
                updatedAt: newUpdatedAt,
                OK: Constants.SUCCESS_MESSAGE.UNIT_OF_MEASURE_CATEGORY_UPDATE_SUCCESS
            });

        } catch (err) {
            debug('err', err);
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);

            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_ID_INVALID);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno === 4002) {
                err = new Error(ErrorConfig.MESSAGE.CAN_NOT_UPDATE_DEFAULT_UNIT_OF_MEASURE_CATEGORY);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno === 4003) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_UPDATED_SINCE_YOU_RETRIVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
            } else if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    restrictToDeleteDefaultCategory: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var categoryId = options.categoryId;
            var err;
            try {
                var conn = await connection.getConnection();
                var categoryCount = await conn.query('select count(*) as count from uomCategory where categoryId = ? and accountId = uuid_to_bin(?)',
                  [categoryId, Constants.DEFAULT_REFERE_ID]);
                categoryCount = Utils.filteredResponsePool(categoryCount);
                if (categoryCount.count > 0) {
                    err = new Error(ErrorConfig.MESSAGE.CAN_NOT_DELETE_DEFAULT_UNIT_OF_MEASURE_CATEGORY);
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

    delete: async function (options, auditOptions, errorOptions, cb) {
        var categoryId = options.categoryId;
        var accountId = options.accountId;
        var updatedAt = options.updatedAt;
        var err;
        if (DataUtils.isUndefined(categoryId)) {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_ID_REQUIRED);
        } else if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_UPDATED_AT_MUST_BE_NUMBER);
        } else if (updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_UPDATED_AT_INVALID);
        } else if (DataUtils.isUndefined(accountId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            await conn.query('START TRANSACTION');
        } catch (err) {
            debug('err', err);
            return cb(err);
        }


        try {
            // restrict to delete default category
            var response = await UnitOfMeasureCategory.restrictToDeleteDefaultCategory({categoryId: categoryId});
            debug('response', response);
            /*var uomIds = await conn.query('select id from uomScaling where categoryId = ?', categoryId);
            debug('uomIds', uomIds);*/
            /*if (!_.isEmpty(uomid)) {
                uomIds = uomid[0];
            }*/
            /*await PromiseBluebird.each(uomIds, async function (uom) {
                debug('uom', uom);
                var id = uom.id;
                var query1 = 'IF NOT EXISTS (select * from uomScaling us, uomCategory uc where us.id = ? and ' +
                  ' uc.categoryId = us.categoryId and uc.accountId = uuid_to_bin(?)) ' +
                  ' THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "UNIT_OF_MEASURE_ID_INVALID";' +
                  '' +
                  ' ELSEIF EXISTS (select * from ProductReferences where weightUoMScal = ? or heightUoMScal= ? or lengthUoMScal = ? ' +
                  ' or volumeUoMScal = ? or diameterUoMScal = ? or depthUoMScal = ? ) THEN SIGNAL SQLSTATE "45000" SET ' +
                  ' MYSQL_ERRNO = 4002,MESSAGE_TEXT = "UOM_ID_EXIST_IN_PRODUCT_REFERENCE";' +
                  '' +
                  ' ELSEIF EXISTS (select * from SupplyItems where weightUoMScal = ? or heightUoMScal= ? or lengthUoMScal = ? ' +
                  ' or volumeUoMScal = ? or diameterUoMScal = ? or depthUoMScal = ? ) THEN SIGNAL SQLSTATE "45000" SET ' +
                  ' MYSQL_ERRNO = 4003,MESSAGE_TEXT = "UOM_ID_EXIST_IN_SUPPLY_ITEM";' +
                  '' +
                  ' ELSEIF EXISTS (select * from ProductInventory where qtyOnHandUoM = ? or qtyOnOrderUoM= ? or qtyAvailableUoM = ? ' +
                  ' or qtyInTransitUoM = ? ) THEN SIGNAL SQLSTATE "45000" SET ' +
                  ' MYSQL_ERRNO = 4004,MESSAGE_TEXT = "UNIT_OF_MEASURE_USED_BY_PRODUCT_INVENTORY";' +
                  '' +
                  ' ELSEIF EXISTS (select * from SupplyInventory where qtyOnHandUoM = ? or qtyOnOrderUoM= ? or qtyAvailableUoM = ? ' +
                  ' or qtyInTransitUoM = ? ) THEN SIGNAL SQLSTATE "45000" SET ' +
                  ' MYSQL_ERRNO = 4005,MESSAGE_TEXT = "UNIT_OF_MEASURE_USED_BY_SUPPLY_INVENTORY";' +
                  '' +
                  ' ELSE DELETE us , un FROM uomScaling us, uomNames un where us.id = ? and us.id=un.uomScalingId; END IF;';
                var params1 = [id, accountId, id, id, id, id, id, id, id, id, id, id, id, id, id, id, id, id, id, id, id, id, id];
                await conn.query(query1, params1);
            });*/

            var query2 = ' IF EXISTS (select 1 from uomScaling where categoryId = ?) ' +
              ' THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "CATEGORY_HAS_UOM_CAN_NOT_DELETE";' +
              ' ELSEIF NOT EXISTS (select 1 from uomCategory where categoryId= ? and accountId = uuid_to_bin(?) and updatedAt = ? ) ' +
              ' THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4002,MESSAGE_TEXT = "UNIT_OF_MEASURE_CATEGORY_UPDATED_SINCE_YOU_RETRIVED"; ' +
              ' ELSE DELETE from uomCategory where categoryId= ? and accountId = uuid_to_bin(?);END IF; ';

            var params2 = [categoryId, categoryId, accountId, updatedAt, categoryId, accountId];
            var deleteCategoryResponse = await conn.query(query2, params2);
            deleteCategoryResponse = Utils.isAffectedPool(deleteCategoryResponse);
            AuditUtils.create(auditOptions);
            await conn.query('COMMIT;');
            return cb(null, {OK: Constants.SUCCESS_MESSAGE.UNIT_OF_MEASURE_CATEGORY_DELETE_SUCCESS});
        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK;');
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            if (err.errno === 4001) {
                debug('2');
                err = new Error(ErrorConfig.MESSAGE.CATEGORY_HAS_UOM_CAN_NOT_DELETE);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno === 4002) {
                debug('3');
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_UPDATED_SINCE_YOU_RETRIVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
            } else if (err.errno) {
                debug('4');
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_DELETE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            /*if (err.errno === 4001) {
                debug('1');
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_ID_INVALID);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno === 4002) {
                debug('2');
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_REFERENCE_USED_BY_PRODUCT_REFERENCE);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno === 4003) {
                debug('3');
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_USED_BY_SUPPLY_ITEM);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno === 4004) {
                debug('3');
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_USED_BY_PRODUCT_INVENTORY);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno === 4005) {
                debug('3');
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_USED_BY_SUPPLY_INVENTORY);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno === 4006) {
                debug('3');
                err = new Error(ErrorConfig.MESSAGE.CATEGORY_ID_EXISTS_IN_UOM_SCALING);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno === 4007) {
                debug('3');
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_UPDATED_SINCE_YOU_RETRIVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
            } else if (err.errno) {
                debug('4');
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_DELETE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }*/
            return cb(err);
        }
    },

    getUnitOfMeasureCategoryByAccountId: async function (options, errorOptions, cb) {

        var accountId = options.user.accountId;
        var languageCultureCode = options.languageCultureCode;
        var fromUOM = options.fromUOM;
        var uomCategoryQuery;
        var err;

        if (DataUtils.isUndefined(accountId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
        } else if (DataUtils.isValidateOptionalField(languageCultureCode)) {
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
            if (parseInt(fromUOM)) {
                debug('Inside if');
                uomCategoryQuery = 'select categoryId, languageCultureCode, name, comment, createdAt, updatedAt, ' +
                  'CAST(uuid_from_bin(accountId) as CHAR) as accountId from uomCategory ' +
                  'where (accountId = uuid_to_bin("00000000-0000-0000-0000-000000000000")  OR accountId = uuid_to_bin(?)) and languageCultureCode =? ;';
            }
            else {
                debug('Inside else ');
                uomCategoryQuery = 'select categoryId, name from uomCategory where (accountId = uuid_to_bin("00000000-0000-0000-0000-000000000000")  ' +
                  'OR accountId = uuid_to_bin(?)) and languageCultureCode =? and categoryId in (select categoryId from uomScaling);';
            }

            var uomCategoryParams = [accountId, languageCultureCode];
            var uomCategory = await conn.query(uomCategoryQuery, uomCategoryParams);

            //var uomC = [];
            /*if (!_.isEmpty(uomCategory)) {
                uomC = uomCategory[0];
            }*/
            return cb(null, uomCategory || []);

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

    getUnitOfMeasureCategoryByCategoryId: async function (options, errorOptions, cb) {

        var accountId = options.user.accountId;
        var languageCultureCode = options.languageCultureCode;
        var categoryId = options.categoryId;
        var err;

        if (DataUtils.isUndefined(accountId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
        }
        if (!err && DataUtils.isValidateOptionalField(categoryId)) {
            err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_ID_REQUIRED);
        }
        if (!err && DataUtils.isValidateOptionalField(languageCultureCode)) {
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
            var uomCategoryQuery = 'select categoryId, languageCultureCode, name, comment, createdAt, ' +
              'updatedAt, CAST(uuid_from_bin(accountId) as CHAR) as accountId from uomCategory ' +
              'where (accountId = uuid_to_bin("00000000-0000-0000-0000-000000000000")  OR accountId = uuid_to_bin(?)) ' +
              'and languageCultureCode =? and categoryId = ?;';

            var uomCategoryParams = [accountId, languageCultureCode, categoryId];
            var uomCategory = await conn.query(uomCategoryQuery, uomCategoryParams);
            uomCategory = Utils.filteredResponsePool(uomCategory);

            if (!uomCategory) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_ID_INVALID);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }
            return cb(null, uomCategory);

        } catch (err) {

            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);

            if (err.code) {
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },


    validateOptinalFields: function (options) {
        var fileds = '', values = [];
        if (!DataUtils.isValidateOptionalField(options.name)) {
            if (options.name === '') {
                throw new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_NAME_CAN_NOT_BE_EMPTY);
            } else if (!DataUtils.isString(options.name)) {
                throw new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_NAME_MUST_BE_STRING);
            } else if (options.name.length > 60) {
                throw new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_NAME_LENGTH_OUT_OF_RANGE);
            }
            fileds += 'name = ?, ';
            values.push(options.name);
        }

        if (!DataUtils.isValidateOptionalField(options.comment)) {
            if (!DataUtils.isString(options.comment)) {
                throw new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_COMMENT_MUST_BE_STRING);
            } else if (options.comment.length > 140) {
                throw new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_COMMENT_LENGTH_OUT_OF_RANGE);
            }
            fileds += 'comment = ?, ';
            values.push(options.comment);
        }
        return {values: values, fileds: fileds};
    }

};


module.exports = UnitOfMeasureCategory;