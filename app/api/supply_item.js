/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.api.supply_item');
var Util = require('util');
var _ = require('lodash');
var workerFarm = require('worker-farm');
var csv = require('fast-csv');
var path = require('path');
var fs = require('fs');
var Async = require('async');
var i18n = require('i18n');
var PromiseBluebird = require('bluebird');

var connection = require('../lib/connection_util');
var DataUtils = require('../lib/data_utils');
var FastCsvUtils = require('../lib/fast_csv_utils');
var Constants = require('../data/constants');
var ErrorConfig = require('../data/error');
var SupplyItemModel = require('../model/supply_item');
var AuditUtils = require('../lib/audit_utils');
var Utils = require('../lib/utils');
var knex = require('../lib/knex_util');
var ErrorUtils = require('../lib/error_utils');
var ProductReferenceApi = require('./product_reference');
var ProductInventoryApi = require('./product_inventory');
var Promise = require('bluebird');
var s3 = require('../model/s3');


var SupplyItemDirName = '..' + path.sep + 'public' + path.sep + 'supplyItems';
SupplyItemDirName = path.resolve(__dirname, SupplyItemDirName);
if (fs.existsSync(SupplyItemDirName) === false) {
    fs.mkdir(SupplyItemDirName);
}

var SupplyItem = {

    getSupplyItem: function (options, cb) {
        var accountIdSKU = options.accountIdSKU;
        if (DataUtils.isUndefined(accountIdSKU)) {
            var err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_ACCOUNT_ID_SKU_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('error', err);
            return cb(err);
        }
        SupplyItemModel.get(accountIdSKU, {
            ConsistentRead: true
        }, function (err, data) {
            if (err) {
                debug('error', err);
                return cb(err);
            }
            var supplyItem = data && data.attrs;
            return cb(null, supplyItem);
        });
    },

    getSignedUrlMD: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var accountId = options.accountId;
            var fileName = options.fileName;
            var opt = {
                Bucket: Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET,
                Key: accountId + '/' + Constants.S3_FOLDER.SUPPLY_ITEM_IMAGES + '/' + fileName,
                Expires: 60 * 60
            };
            s3.getSignedUrl('getObject', opt, function (err, url) {
                if (err) {
                    debug('err', err);
                    err = new Error(ErrorConfig.MESSAGE.GET_SIGN_URL_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
                return resolve(url);
            });
        });
    },

    getMainImageUrl: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var accountId = options.accountId;
            var supplyItemId = options.supplyItemId;
            var thumbnail = '%thumbnail_%';
            var imageResponse, err;
            try {
                var conn = await connection.getConnection();
                imageResponse = await conn.query('select fileName from SupplyImages  where supplyItemId=uuid_to_bin(?) and isMain=1 ' +
                  ' and fileName like ?', [supplyItemId, thumbnail]);
                imageResponse = Utils.filteredResponsePool(imageResponse);
                if (!imageResponse) {
                    return resolve({url: ''});
                    /* err = new Error(ErrorConfig.MESSAGE.PRODUCT_IMAGES_NOT_FOUND);
                     err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                     return reject(err);*/
                }
                var url = await SupplyItem.getSignedUrlMD({
                    accountId: accountId,
                    fileName: imageResponse.fileName
                });
                return resolve({url: url});

            } catch (err) {
                debug('err', err);
                return reject(err);
            }

        });

    },

    getSupplyItemsByIdMD: async function (options, errorOptions, cb) {
        var id = options.id;
        var user = options.user;
        var languageCultureCode = user.languageCultureCode;
        var err;
        if (DataUtils.isUndefined(id)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();

            // GET URL OF MAIN IMAGE OF PRODUCT
            var imageOption = {
                supplyItemId: id,
                accountId: user.accountId
            };
            var imageResponse = await SupplyItem.getMainImageUrl(imageOption);


            var supplyItem = await conn.query('SELECT SI.sku, SI.sellerSKUName, SI.type, ' +

              'SI.classificationCode, SI.classificationSystem, SI.endCustomerProduct, SI.GCID, SI.UPC, SI.EAN, SI.ISBN, ' +
              'SI.JAN, SI.articleNo, SI.modelNumber, SI.countryOfManufacture, SI.barcode,SI.brand,SI.harmonizedCode,SI.mpProductId,' +
              'SI.skuAlias, SI.tags,SI.weightAmount, UNT1.symbol as weightSymbol, SI.lengthAmount,UNT2.symbol as lengthSymbol, ' +
              'SI.volumeAmount, UNT3.symbol as volumeSymbol, SI.heightAmount, UNT4.symbol as heightSymbol, ' +
              'SI.depthUoMScal,SI.heightUoMScal,SI.weightUoMScal,SI.volumeUoMScal,SI.diameterUoMScal,SI.lengthUoMScal,' +
              'SI.depthAmount,UNT5.symbol as depthSymbol, SI.diameterAmount,UNT6.symbol as diameterSymbol, ' +
              'SI.qtyUoMId, UNT7.symbol as qtyUoMSymbol, UCat.categoryId, UCat.name as qtyUoMCategoryName, ' +
              'SI.updatedAt FROM SupplyItems  SI, uomNames UNT1, uomNames UNT2, uomNames UNT3, ' +
              'uomNames UNT4, uomNames UNT5, uomNames UNT6, uomNames UNT7, uomCategory UCat, uomScaling USca WHERE UNT1.uomScalingId = SI.weightUoMScal AND UNT1.languageCultureCode =? ' +
              'AND UNT2.uomScalingId = SI.lengthUoMScal AND UNT2.languageCultureCode = ? AND UNT3.uomScalingId = SI.volumeUoMScal ' +
              'AND UNT3.languageCultureCode = ? AND UNT4.uomScalingId = SI.heightUoMScal AND UNT4.languageCultureCode = ? ' +
              'AND UNT5.uomScalingId = SI.depthUoMScal AND UNT5.languageCultureCode = ? AND UNT6.uomScalingId = SI.diameterUoMScal ' +
              'AND UNT6.languageCultureCode = ? AND UNT7.uomScalingId = SI.qtyUoMId AND UNT7.languageCultureCode = ? ' +
              'AND USca.id = SI.qtyUoMId AND UCat.categoryId = USca.categoryId AND UCat.languageCultureCode = ? ' +
              'AND SI.id=uuid_to_bin(?) AND SI.status=1',
              [languageCultureCode, languageCultureCode, languageCultureCode, languageCultureCode, languageCultureCode, languageCultureCode, languageCultureCode, languageCultureCode, id]);

            supplyItem = Utils.filteredResponsePool(supplyItem);

            if (!supplyItem) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            supplyItem.preSignedUrl = imageResponse.url;
            return cb(null, supplyItem);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    getSupplyItemsByAccountIdMD: async function (options, errorOptions, cb) {
        var accountId = options.accountId;
        var user = options.user;
        var languageCultureCode = user.languageCultureCode;
        var isActive = options.isActive;
        var err;
        if (DataUtils.isUndefined(accountId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
        } else if (DataUtils.isUndefined(isActive)) {
            err = new Error(ErrorConfig.MESSAGE.IS_ACTIVE_FIELD_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            debug('err', err);
            return cb(err);
        }
        try {
            var conn = await connection.getConnection();
            var supplyItems = await conn.query(' SELECT CAST(uuid_from_bin(SI.id) as CHAR) as id , SI.sku, SI.sellerSKUName, SI.type, ' +
              ' SI.classificationCode, SI.classificationSystem, SI.endCustomerProduct, SI.GCID, SI.UPC, SI.EAN, SI.ISBN, ' +
              ' SI.JAN, SI.articleNo, SI.modelNumber, SI.countryOfManufacture, SI.barcode,SI.brand,SI.harmonizedCode,SI.mpProductId, ' +
              ' SI.skuAlias,SI.tags,SI.weightAmount, UNT1.symbol as weightSymbol, SI.lengthAmount, UNT2.symbol as lengthSymbol, ' +
              ' SI.volumeAmount, UNT3.symbol as volumeSymbol,SI.heightAmount, UNT4.symbol as heightSymbol, ' +
              ' SI.depthAmount, UNT5.symbol as depthSymbol, SI.diameterAmount, UNT6.symbol as diameterSymbol, ' +
              ' SI.qtyUoMId, UNT7.symbol as qtyUoMSymbol, UCat.categoryId, UCat.name as qtyUoMCategoryName,SI.mainImage, SI.status, ' +
              ' SI.updatedAt FROM SupplyItems  SI, uomNames UNT1, uomNames UNT2, uomNames UNT3, ' +
              ' uomNames UNT4, uomNames UNT5, uomNames UNT6,uomNames UNT7,uomCategory UCat, uomScaling USca WHERE UNT1.uomScalingId = SI.weightUoMScal AND UNT1.languageCultureCode =? ' +
              ' AND UNT2.uomScalingId = SI.lengthUoMScal AND UNT2.languageCultureCode = ? AND UNT3.uomScalingId = SI.volumeUoMScal ' +
              ' AND UNT3.languageCultureCode = ? AND UNT4.uomScalingId = SI.heightUoMScal AND UNT4.languageCultureCode = ? ' +
              ' AND UNT5.uomScalingId = SI.depthUoMScal AND UNT5.languageCultureCode = ? AND UNT6.uomScalingId = SI.diameterUoMScal ' +
              ' AND UNT6.languageCultureCode = ? AND UNT7.uomScalingId = SI.qtyUoMId AND UNT7.languageCultureCode = ? ' +
              ' AND USca.id = SI.qtyUoMId AND UCat.categoryId = USca.categoryId AND UCat.languageCultureCode = ? ' +
              ' AND SI.accountId=uuid_to_bin(?) AND SI.status= ? order by SI.updatedAt desc limit 10',
              [languageCultureCode, languageCultureCode, languageCultureCode, languageCultureCode,
                  languageCultureCode, languageCultureCode, languageCultureCode, languageCultureCode, accountId, parseInt(isActive)]);
            //supplyItems = Utils.filteredResponsePool(supplyItems);

            if (!supplyItems) {
                supplyItems = [];
            }
            return cb(null, supplyItems);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEMS_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    searchSupplyItemsBySKUMD: async function (options, errorOptions, cb) {
        var query = options.query;
        var accountId = options.user.accountId;
        var err;
        if (DataUtils.isUndefined(accountId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
        }
        if (DataUtils.isUndefined(query)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_SEARCH_QUERY_REQ);
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

            /*var products = await conn.query('select CAST(uuid_from_bin(PR.id) as CHAR) as id , PR.sku,PR.sellerSKUName,PR.qtyUoMId,US.categoryId,' +
              'PR.updatedAt from ProductReferences PR , uomScaling US where lower(PR.sku) like lower(?) and PR.accountId = uuid_to_bin(?) ' +
              ' and PR.qtyUoMId = US.id;', [query, accountId]);*/
            var supplyItems = await conn.query('select CAST(uuid_from_bin(SI.id) as CHAR) as id ,SI.sku, ' +
              'SI.sellerSKUName, SI.qtyUoMId,US.categoryId ,SI.qtyUoMId, SI.updatedAt  from SupplyItems SI , uomScaling US where lower(SI.sku) like lower(?) and ' +
              'SI.accountId = uuid_to_bin(?) and SI.qtyUoMId = US.id and SI.status = ?;', [query, accountId, Constants.SUPPLY_ITEM_STATUS.ACTIVE]);
            debug('supplyItems', supplyItems);

            if (!supplyItems) {
                supplyItems = [];
            }
            return cb(null, supplyItems);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_NOT_FOUND);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    searchSupplyItemsBySellerSKUNameMD: async function (options, errorOptions, cb) {
        var query = options.query;
        var accountId = options.user.accountId;
        var err;
        if (DataUtils.isUndefined(accountId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
        }
        if (DataUtils.isUndefined(query)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_SEARCH_QUERY_REQ);
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

            var supplyItems = await conn.query('select CAST(uuid_from_bin(SI.id) as CHAR) as id ,SI.sku, ' +
              ' SI.sellerSKUName, SI.qtyUoMId,US.categoryId ,SI.qtyUoMId, SI.updatedAt  from SupplyItems SI , uomScaling US ' +
              ' where lower(SI.sellerSKUName) like lower(?) and SI.accountId = uuid_to_bin(?) and SI.qtyUoMId = US.id and SI.status = ?;',
              [query, accountId, Constants.SUPPLY_ITEM_STATUS.ACTIVE]);

            if (!supplyItems) {
                supplyItems = [];
            }
            return cb(null, supplyItems);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_NOT_FOUND);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    removeMD: async function (options, auditOptions, errorOptions, cb) {
        var id = options.id;
        var updatedAt = options.updatedAt;
        var err;

        if (DataUtils.isUndefined(id)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_ID_REQUIRED);
        } else if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_UPDATED_AT_MUST_BE_NUMBER);
        } else if (updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_INVALID_UPDATED_AT);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            debug('err', err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();

            var isDeleted = await conn.query('IF (select 1 from SupplyItems where id=uuid_to_bin(?)) is null then ' +
              'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "SUPPLY_ITEM_NOT_FOUND", MYSQL_ERRNO = 4001;' +
              'ELSEIF (select 1 from SupplyItems where id=uuid_to_bin(?) and updatedAt=?) is null then ' +
              'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "SUPPLY_ITEM_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
              'ELSE delete from SupplyItems where id = uuid_to_bin(?);end if;', [id, id, updatedAt, id]);
            isDeleted = Utils.isAffectedPool(isDeleted);
            if (!isDeleted) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }
            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            } else if (err.errno === 4002) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                return cb(err);
            } else {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_DELETE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
        }
    },

    validateOptionalFields: async function (options, cb) {
        var supplyItemFields = '';
        var supplyItemOptionalValues = [];
        var err;

        try {
            if (!DataUtils.isValidateOptionalField(options.sku)) {
                if (!DataUtils.isString(options.sku)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_SKU_MUST_BE_STRING);
                } else if (options.sku.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_SKU_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    supplyItemFields += 'sku=? ,';
                    supplyItemOptionalValues.push(options.sku);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.classificationCode)) {
                if (!DataUtils.isString(options.classificationCode)) {
                    throw err = new Error(ErrorConfig.MESSAGE.CLASSIFICATION_CODE_MUST_BE_STRING);
                } else if (options.classificationCode.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_CLASSIFICATION_CODE_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    supplyItemFields += 'classificationCode=? ,';
                    supplyItemOptionalValues.push(options.classificationCode);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.classificationSystem)) {
                if (!DataUtils.isString(options.classificationSystem)) {
                    throw err = new Error(ErrorConfig.MESSAGE.CLASSIFICATION_SYSTEM_MUST_BE_STRING);
                } else if (options.classificationSystem.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_CLASSIFICATION_SYSTEM_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    supplyItemFields += 'classificationSystem=? ,';
                    supplyItemOptionalValues.push(options.classificationSystem);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.type)) {
                if (!DataUtils.isString(options.type)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_TYPE_MUST_BE_STRING);
                } else if (options.type.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_TYPE_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    supplyItemFields += 'type=? ,';
                    supplyItemOptionalValues.push(options.type);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.sellerSKUName)) {
                if (!DataUtils.isString(options.sellerSKUName)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_SELLER_SKU_NAME_MUST_BE_STRING);
                } else if (options.sellerSKUName.length > 60) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_SELLER_SKU_NAME_MUST_BE_LESS_THAN_60_CHARACTER);
                } else {
                    supplyItemFields += 'sellerSKUName=? ,';
                    supplyItemOptionalValues.push(options.sellerSKUName);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.GCID)) {
                if (!DataUtils.isString(options.GCID)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_GCID_MUST_BE_STRING);
                } else if (options.GCID.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_GCID_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    supplyItemFields += 'GCID=? ,';
                    supplyItemOptionalValues.push(options.GCID);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.UPC)) {
                if (!DataUtils.isString(options.UPC)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_UPC_MUST_BE_STRING);
                } else if (options.UPC.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_UPC_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    supplyItemFields += 'UPC=? ,';
                    supplyItemOptionalValues.push(options.UPC);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.EAN)) {
                if (!DataUtils.isString(options.EAN)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_EAN_MUST_BE_STRING);
                } else if (options.EAN.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_EAN_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    supplyItemFields += 'EAN=? ,';
                    supplyItemOptionalValues.push(options.EAN);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.ISBN)) {
                if (!DataUtils.isString(options.ISBN)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_ISBN_MUST_BE_STRING);
                } else if (options.ISBN.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_ISBN_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    supplyItemFields += 'ISBN=? ,';
                    supplyItemOptionalValues.push(options.ISBN);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.JAN)) {
                if (!DataUtils.isString(options.JAN)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_JAN_MUST_BE_STRING);
                } else if (options.JAN.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_JAN_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    supplyItemFields += 'JAN=? ,';
                    supplyItemOptionalValues.push(options.JAN);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.articleNo)) {
                if (!DataUtils.isString(options.articleNo)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_ARTICLE_NO_MUST_BE_STRING);
                } else if (options.articleNo.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_ARTICLE_NO_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    supplyItemFields += 'articleNo=? ,';
                    supplyItemOptionalValues.push(options.articleNo);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.modelNumber)) {
                if (!DataUtils.isString(options.modelNumber)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_MODEL_NUMBER_MUST_BE_STRING);
                } else if (options.modelNumber.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_MODEL_NUMBER_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    supplyItemFields += 'modelNumber=? ,';
                    supplyItemOptionalValues.push(options.modelNumber);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.countryOfManufacture)) {
                if (!DataUtils.isString(options.countryOfManufacture)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_COUNTRY_MANUFACTURE_MUST_BE_STRING);
                } else if (options.countryOfManufacture.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_COUNTRY_MANUFACTURE_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    supplyItemFields += 'countryOfManufacture=? ,';
                    supplyItemOptionalValues.push(options.countryOfManufacture);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.barcode)) {
                if (!DataUtils.isString(options.barcode)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_BARCODE_MUST_BE_STRING);
                } else if (options.barcode.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_BARCODE_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    supplyItemFields += 'barcode=? ,';
                    supplyItemOptionalValues.push(options.barcode);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.skuAlias)) {
                if (!DataUtils.isString(options.skuAlias)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_SKU_ALIAS_MUST_BE_STRING);
                } else if (options.skuAlias.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_SKU_ALIAS_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    supplyItemFields += 'skuAlias=? ,';
                    supplyItemOptionalValues.push(options.skuAlias);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.brand)) {
                if (!DataUtils.isString(options.brand)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_BRAND_MUST_BE_STRING);
                } else if (options.brand.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_BRAND_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    supplyItemFields += 'brand=? ,';
                    supplyItemOptionalValues.push(options.brand);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.harmonizedCode)) {
                if (!DataUtils.isString(options.harmonizedCode)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_HARMONINZED_CODE_MUST_BE_STRING);
                } else if (options.harmonizedCode.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_HARMONINZED_CODE_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    supplyItemFields += 'harmonizedCode=? ,';
                    supplyItemOptionalValues.push(options.harmonizedCode);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.mpProductId)) {
                if (!DataUtils.isString(options.mpProductId)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_MP_PRODUCT_ID_MUST_BE_OBJECT);
                } else if (options.mpProductId.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_MP_PRODUCT_ID_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    supplyItemFields += 'mpProductId=? ,';
                    supplyItemOptionalValues.push(options.mpProductId);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.weightAmount)) {
                if (!DataUtils.isNumber(options.weightAmount)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_WEIGHT_AMOUNT_MUST_BE_NUMBER);
                } else if (options.weightAmount.toString().length > 6) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_WEIGHT_AMOUNT_MUST_BE_LESS_THAN_6_DIGIT);
                } else {
                    supplyItemFields += 'weightAmount=? ,';
                    supplyItemOptionalValues.push(options.weightAmount);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.weightUoMScal)) {
                if (!DataUtils.isNumber(options.weightUoMScal)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_WEIGHT_UOM_SCAL_MUST_BE_NUMBER);
                } else if (options.weightUoMScal.toString().length > 11) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_WEIGHT_UOM_SCAL_MUST_BE_LESS_THAN_11_DIGIT);
                } else {
                    supplyItemFields += 'weightUoMScal=? ,';
                    supplyItemOptionalValues.push(options.weightUoMScal);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.heightAmount)) {
                if (!DataUtils.isNumber(options.heightAmount)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_HEIGHT_AMOUNT_MUST_BE_NUMBER);
                } else if (options.heightAmount.toString().length > 6) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_HEIGHT_AMOUNT_MUST_BE_LESS_THAN_6_DIGIT);
                } else {
                    supplyItemFields += 'heightAmount=? ,';
                    supplyItemOptionalValues.push(options.heightAmount);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.heightUoMScal)) {
                if (!DataUtils.isNumber(options.heightUoMScal)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_HEIGHT_UOM_SCAL_MUST_BE_NUMBER);
                } else if (options.heightUoMScal.toString().length > 11) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_HEIGHT_UOM_SCAL_MUST_BE_LESS_THAN_11_DIGIT);
                } else {
                    supplyItemFields += 'heightUoMScal=? ,';
                    supplyItemOptionalValues.push(options.heightUoMScal);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.lengthAmount)) {
                if (!DataUtils.isNumber(options.lengthAmount)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_LENGTH_AMOUNT_MUST_BE_NUMBER);
                } else if (options.lengthAmount.toString().length > 6) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_LENGTH_AMOUNT_MUST_BE_LESS_THAN_6_DIGIT);
                } else {
                    supplyItemFields += 'lengthAmount=? ,';
                    supplyItemOptionalValues.push(options.lengthAmount);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.lengthUoMScal)) {
                if (!DataUtils.isNumber(options.lengthUoMScal)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_LENGTH_UOM_SCAL_MUST_BE_NUMBER);
                } else if (options.lengthUoMScal.toString().length > 11) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_LENGTH_UOM_SCAL_MUST_BE_LESS_THAN_11_DIGIT);
                } else {
                    supplyItemFields += 'lengthUoMScal=? ,';
                    supplyItemOptionalValues.push(options.lengthUoMScal);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.depthAmount)) {
                if (!DataUtils.isNumber(options.depthAmount)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_DEPTH_AMOUNT_MUST_BE_NUMBER);
                } else if (options.depthAmount.toString().length > 6) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_DEPTH_AMOUNT_MUST_BE_LESS_THAN_6_DIGIT);
                } else {
                    supplyItemFields += 'depthAmount=? ,';
                    supplyItemOptionalValues.push(options.depthAmount);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.depthUoMScal)) {
                if (!DataUtils.isNumber(options.depthUoMScal)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_DEPTH_UOM_SCAL_MUST_BE_NUMBER);
                } else if (options.depthUoMScal.toString().length > 11) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_DEPTH_UOM_SCAL_MUST_BE_LESS_THAN_11_DIGIT);
                } else {
                    supplyItemFields += 'depthUoMScal=? ,';
                    supplyItemOptionalValues.push(options.depthUoMScal);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.diameterAmount)) {
                if (!DataUtils.isNumber(options.diameterAmount)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_DIAMETER_AMOUNT_MUST_BE_NUMBER);
                } else if (options.diameterAmount.toString().length > 6) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_DIAMETER_AMOUNT_MUST_BE_LESS_THAN_6_DIGIT);
                } else {
                    supplyItemFields += 'diameterAmount=? ,';
                    supplyItemOptionalValues.push(options.diameterAmount);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.diameterUoMScal)) {
                if (!DataUtils.isNumber(options.diameterUoMScal)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_DIAMETER_UOM_SCAL_MUST_BE_NUMBER);
                } else if (options.diameterUoMScal.toString().length > 11) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_DIAMETER_UOM_SCAL_MUST_BE_LESS_THAN_11_DIGIT);
                } else {
                    supplyItemFields += 'diameterUoMScal=? ,';
                    supplyItemOptionalValues.push(options.diameterUoMScal);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.volumeAmount)) {
                if (!DataUtils.isNumber(options.volumeAmount)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_VOLUME_AMOUNT_MUST_BE_NUMBER);
                } else if (options.volumeAmount.toString().length > 6) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_VOLUME_AMOUNT_MUST_BE_LESS_THAN_6_DIGIT);
                } else {
                    supplyItemFields += 'volumeAmount=? ,';
                    supplyItemOptionalValues.push(options.volumeAmount);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.volumeUoMScal)) {
                if (!DataUtils.isNumber(options.volumeUoMScal)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_VOLUME_UOM_SCAL_MUST_BE_NUMBER);
                } else if (options.volumeUoMScal.toString().length > 11) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_VOLUME_UOM_SCAL_MUST_BE_LESS_THAN_11_DIGIT);
                } else {
                    supplyItemFields += 'volumeUoMScal=? ,';
                    supplyItemOptionalValues.push(options.volumeUoMScal);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.qtyUoMId)) {
                if (!DataUtils.isNumber(options.qtyUoMId)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_QTY_UOM_ID_MUST_BE_NUMBER);
                } else if (options.qtyUoMId.toString().length > 11) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_QTY_UOM_ID_MUST_BE_LESS_THAN_11_DIGIT);
                } else {
                    supplyItemFields += 'qtyUoMId=? ,';
                    supplyItemOptionalValues.push(options.qtyUoMId);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.qtyUoMCategory)) {
                if (!DataUtils.isNumber(options.qtyUoMCategory)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_QTY_UOM_CATEGORY_MUST_BE_NUMBER);
                } else if (options.qtyUoMCategory.toString().length > 11) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_QTY_UOM_CATEGORY_MUST_BE_LESS_THAN_11_DIGIT);
                } else {
                    supplyItemFields += 'qtyUoMCategory=? ,';
                    supplyItemOptionalValues.push(options.qtyUoMCategory);
                }
            }

            if (!DataUtils.isValidateOptionalField(options.endCustomerProduct)) {
                if (!DataUtils.isNumber(options.endCustomerProduct)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_END_CUSTOMER_PRODUCT_MUST_BE_NUMBER);
                } else if (options.endCustomerProduct.toString().length > 11) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_END_CUSTOMER_PRODUCT_MUST_BE_LESS_THAN_11_DIGIT);
                } else {
                    supplyItemFields += 'endCustomerProduct=? ,';
                    supplyItemOptionalValues.push(options.endCustomerProduct);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.tags)) {
                if (!DataUtils.isString(options.tags)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_TAGS_MUST_BE_STRING);
                } else if (options.tags.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_TAGS_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    supplyItemFields += 'tags=? ,';
                    supplyItemOptionalValues.push(options.tags);
                }
            }

            var response = {
                supplyItemFields: supplyItemFields,
                supplyItemOptionalValues: supplyItemOptionalValues
            };
            debug('response', response);
            return cb(null, response);
        } catch (err) {
            debug('err', err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
    },

    createSupplyItemMD: async function (supplyItemOptions, errorOptions, cb) {
        debug('supplyItemOptions----', supplyItemOptions);
        if (_.isEmpty(supplyItemOptions)) {
            return cb();
        }
        var err;
        try {
            var conn = await connection.getConnection();
            var supplyItemStore = await conn.query('If (SELECT 1 FROM SupplyItems WHERE accountId=uuid_to_bin(?) AND sku=?) is null then ' +
              'INSERT into SupplyItems set id=uuid_to_bin(?), accountId=uuid_to_bin(?) ,' + supplyItemOptions.supplyItemFields +
              'createdAt = ?, updatedAt = ?,createdBy=uuid_to_bin(?);end if',
              supplyItemOptions.supplyItemRequiredValues);

            var isRoleAffected = Utils.isAffectedPool(supplyItemStore);

            if (!isRoleAffected) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEMS_ALREADY_EXIST);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                await ErrorUtils.create(errorOptions, supplyItemOptions, err);
                return cb(err);
            }
            return cb(null, Constants.OK_MESSAGE);

        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_CREATE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, supplyItemOptions, err);
            return cb(err);
        }
    },

    createMD: function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var accountId = user.accountId;
        var sku = options.sku;
        var qtyUoMId = options.qtyUoMId;
        var classificationSystem = options.classificationSystem;
        var classificationCode = options.classificationCode;
        var supplyItemFields = '';
        var supplyItemOptionalValues = [];
        var supplyItemRequiredValues = [];
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var createdAt = DataUtils.getEpochMSTimestamp();

        var err;

        if (DataUtils.isUndefined(sku)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_SKU_REQ);
        }
        if (DataUtils.isValidateOptionalField(qtyUoMId)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_QTY_UOM_ID_REQ);
        }
        if (DataUtils.isDefined(classificationSystem) && DataUtils.isUndefined(classificationCode)) {
            err = new Error(ErrorConfig.MESSAGE.CLASSIFICATION_CODE_REQUIRED);
        } else if (DataUtils.isDefined(classificationCode) && DataUtils.isUndefined(classificationSystem)) {
            err = new Error(ErrorConfig.MESSAGE.CLASSIFICATION_SYSTEM_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('err', err);
            return cb(err);
        }
        var generatedId = Utils.generateId();
        supplyItemRequiredValues.push(accountId, sku, generatedId.uuid, accountId);

        SupplyItem.validateOptionalFields(options, async function (err, response) {
            if (err) {
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            supplyItemFields = response.supplyItemFields;
            supplyItemOptionalValues = response.supplyItemOptionalValues;

            supplyItemRequiredValues = _.concat(supplyItemRequiredValues, supplyItemOptionalValues);
            supplyItemRequiredValues.push(createdAt, updatedAt, user.id);

            var supplyItemOptions = {
                supplyItemRequiredValues: supplyItemRequiredValues,
                supplyItemFields: supplyItemFields
            };
            SupplyItem.createSupplyItemMD(supplyItemOptions, errorOptions, function (err, supplyItem) {
                if (err) {
                    debug('err', err);
                    return cb(err);
                }
                return cb(null, {
                    OK: Constants.SUCCESS,
                    id: generatedId.uuid,
                    createdAt: createdAt
                });
            });
        });
    },

    updateSupplyItemMD: async function (supplyItemOptions, errorOptions, cb) {
        debug('supplyItemOptions----', supplyItemOptions);
        if (_.isEmpty(supplyItemOptions)) {
            return cb();
        }
        var err;
        try {
            var conn = await connection.getConnection();

            var supplyItemStore = await conn.query('IF (select 1 from SupplyItems where id=uuid_to_bin(?)) is null then ' +
              'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "SUPPLY_ITEM_NOT_FOUND", MYSQL_ERRNO = 4001;' +
              'ELSEIF (select 1 from SupplyItems where id=uuid_to_bin(?) and updatedAt=?) is null then ' +
              'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "SUPPLY_ITEM_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
              'ELSE update SupplyItems set ' + supplyItemOptions.supplyItemFields + ' updatedAt = ?,updatedBy=uuid_to_bin(?) ' +
              'where id = uuid_to_bin(?);end if;', supplyItemOptions.supplyItemRequiredValues);
            var isRoleAffected = Utils.isAffectedPool(supplyItemStore);

            if (!isRoleAffected) {
                throw err;
            }
            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, supplyItemOptions, err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            } else if (err.errno === 4002) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                return cb(err);
            } else {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
        }
    },

    updateMD: async function (options, auditOptions, errorOptions, cb) {
        var id = options.id;
        var updatedAt = options.updatedAt;
        var qtyUoMId = options.qtyUoMId;
        var qtyUoMCategory = options.qtyUoMCategory;
        var inventoryCount = options.inventoryCount;
        var accountId = options.accountId;
        var user = options.user;
        var userId = user.id;
        var supplyItemFields = '';
        var supplyItemRequiredValues = [];
        var supplyItemOptionalValues = [];
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();
        var err;

        if (DataUtils.isUndefined(id)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_ID_REQUIRED);
        } else if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_INVALID_UPDATED_AT);
        }
        if (err) {
            debug('err', err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            await conn.query('START TRANSACTION;');
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        supplyItemRequiredValues.push(id, id, updatedAt);
        SupplyItem.validateOptionalFields(options, async function (err, response) {
            if (err) {
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            supplyItemFields = response.supplyItemFields;
            supplyItemOptionalValues = response.supplyItemOptionalValues;

            if (supplyItemOptionalValues.length === 0) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_REQUEST);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug('err', err);
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            supplyItemRequiredValues = _.concat(supplyItemRequiredValues, supplyItemOptionalValues);
            supplyItemRequiredValues.push(newUpdatedAt, userId, id);

            var productReferenceOptions = {
                supplyItemRequiredValues: supplyItemRequiredValues,
                supplyItemFields: supplyItemFields
            };
            SupplyItem.updateSupplyItemMD(productReferenceOptions, errorOptions, async function (err, response) {
                if (err) {
                    debug('err', err);
                    await conn.query('ROLLBACK;');
                    return cb(err);
                }

                // If supply has uom or uom category in option
                if (inventoryCount > 0 && (DataUtils.isDefined(qtyUoMId) || DataUtils.isDefined(qtyUoMCategory))) {
                    try {
                        var updateInventoryOption = {
                            supplyItemId: id,
                            accountId: accountId,
                            userId: userId,
                            qtyUoMId: qtyUoMId
                        };
                        var updateInventoryResponse = await SupplyItem.updateSupplyInventoryQTY(updateInventoryOption);
                        debug('updateInventoryResponse', updateInventoryResponse);
                    } catch (err) {
                        debug('err', err);
                        await conn.query('ROLLBACK;');
                        return cb(err);
                    }
                }
                await conn.query('COMMIT;');
                return cb(null, {
                    OK: Constants.SUCCESS,
                    updatedAt: newUpdatedAt
                });

            });
        });
    },

    checkFields: function (options, cb) {
        var files = options.files;
        var supplyItemId = options.supplyItemId;
        var err;

        if (DataUtils.isUndefined(files) || (DataUtils.isArray(files) && files.length <= 0)) {
            err = new Error(ErrorConfig.MESSAGE.FILES_REQUIRED);
        } else if (files.length > 20) {
            err = new Error(ErrorConfig.MESSAGE.FILE_MUST_BE_LESS_THAN_10);
        } else if (DataUtils.isUndefined(supplyItemId)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_ID_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
        return cb(null, Constants.OK_MESSAGE);
    },

    checkTotalImages: async function (options, cb) {
        var supplyItemId = options.supplyItemId;
        var files = options.files;
        var accountId = options.accountId;
        var filesLength = files.length;
        var updatedAt = options.updatedAt;
        var userId = options.userId;
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();
        var err;

        if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(updatedAt) || updatedAt.toString().length > 13) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_INVALID_UPDATED_AT);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('err', err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var totalCount = await conn.query('select count(*) as length from SupplyImages where supplyItemId=uuid_to_bin(?) ' +
              'and accountId=uuid_to_bin(?) and status=1 ; ', [supplyItemId, accountId]);
            totalCount = Utils.filteredResponsePool(totalCount);
            totalCount = parseInt(totalCount.length);
            if (totalCount >= 20 || (totalCount < 20 && (filesLength + totalCount) > 20)) {
                err = new Error(ErrorConfig.MESSAGE.CAN_NOT_UPLOAD_MORE_THAN_10_IMAGES);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
        try {
            var isUpdated = await conn.query('IF (select 1 from SupplyItems where id=uuid_to_bin(?)) is null then ' +
              'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "SUPPLY_ITEM_NOT_FOUND", MYSQL_ERRNO = 4001;' +
              'ELSEIF (select 1 from SupplyItems where id=uuid_to_bin(?) and updatedAt=?) is null then ' +
              'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "SUPPLY_ITEM_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
              'ELSE update SupplyItems set updatedAt =?,updatedBy=uuid_to_bin(?) ' +
              'where id = uuid_to_bin(?);end if;', [supplyItemId, supplyItemId, updatedAt, newUpdatedAt, userId, supplyItemId]);
            isUpdated = Utils.isAffectedPool(isUpdated);
            if (!isUpdated) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            return cb(null, {
                updatedAt: newUpdatedAt,
                OK: Constants.SUCCESS
            });
        } catch (err) {
            debug('err', err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            } else if (err.errno === 4002) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                return cb(err);
            } else {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
        }
    },

    deleteImageRecord: async function (options, cb) {
        var supplyItemId = options.supplyItemId;
        var accountId = options.accountId;
        var userId = options.userId, err;
        var miliSeconds = Constants.MILISECONDS_OF_DAY;


        try {
            var conn = await connection.getConnection();
            var isDeleted = await conn.query('DELETE FROM SupplyImages WHERE supplyItemId = uuid_to_bin(?) AND status=3 ' +
              ' AND accountId = uuid_to_bin(?) and createdAt < ((UNIX_TIMESTAMP() * 1000) - ? ) ;', [supplyItemId, accountId, miliSeconds]);
            isDeleted = Utils.isAffectedPool(isDeleted);
            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
    },

    getSupplyById: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var supplyItemId = options.supplyItemId;
            var accountId = options.accountId;
            var err;

            try {
                var conn = await connection.getConnection();

                var SupplyItem = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id from SupplyItems where id=uuid_to_bin(?) ' +
                  'and accountId=uuid_to_bin(?)', [supplyItemId, accountId]);
                SupplyItem = Utils.filteredResponsePool(SupplyItem);
                if (!SupplyItem) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    throw err;
                }
                return resolve(SupplyItem);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    insertImageLogMD: function (options) {
        return new Promise(async function (resolve, reject) {
            var imageLogs = options.imageLogArray;
            var convertedfilesList, keys, err;
            await Utils.convertObjectToArrayMD(imageLogs, async function (err, response) {
                if (err) {
                    debug('err', err);
                    return reject(err);
                }
                convertedfilesList = response.list;
                keys = response.keys;

                var query = 'insert into SupplyImages (' + keys + ') values';
                var values = ' (uuid_to_bin(?),uuid_to_bin(?),?,?,?,?,?,uuid_to_bin(?)) ';

                await PromiseBluebird.each(imageLogs, function (value) {
                    query = query + values;
                    query = query + ',';
                });

                query = query.replace(/,\s*$/, '');

                try {
                    var conn = await connection.getConnection();
                    var imageLogInserted = await conn.query(query, convertedfilesList);
                    imageLogInserted = Utils.isAffectedPool(imageLogInserted);
                    debug('ImageInserted-----------------------------------------', imageLogInserted);
                    if (!imageLogInserted) {
                        throw err;
                    }
                    return resolve(Constants.OK_MESSAGE);
                } catch (err) {
                    debug('err ', err);
                    err = new Error(ErrorConfig.MESSAGE.SUPPLY_IMAGE_LOG_CREATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
            });
        });
    },

    createImagePreSignedUrl: async function (options, errorOptions, auditOptions, cb) {
        var user = options.user;
        var accountId = user.accountId;
        var files = options.files;
        var supplyItemId = options.supplyItemId;
        var createdAt = DataUtils.getEpochMSTimestamp();
        var updatedAt = options.updatedAt;
        var signatureArray = [];
        var imageLogArray = [], err;

        try {
            var checkOption = {
                files: files
            };
            var checkResponse = await ProductReferenceApi.checkFileNamesMD(checkOption);

            var supplyItem = await SupplyItem.getSupplyById({
                supplyItemId: supplyItemId,
                accountId: accountId
            });

            await PromiseBluebird.each(files, function (file) {
                var opt = {
                    Bucket: Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET,
                    Key: accountId + '/' + Constants.S3_FOLDER.SUPPLY_ITEM_IMAGES + '/' + file.fileName,
                    Expires: 60 * 60,
                    ACL: 'public-read',
                    ContentType: Constants.CONTENT_TYPE.IMAGE_JPEG
                };

                s3.getSignedUrl('putObject', opt, async function (err, url) {
                    if (err) {
                        debug('err', err);
                        err = new Error(ErrorConfig.MESSAGE.CREATE_PRE_SIGNED_URL_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                        await ErrorUtils.create(errorOptions, options, err);
                        return cb(err);
                    }
                    var logOption = {
                        accountId: accountId,
                        supplyItemId: supplyItemId,
                        fileName: file.fileName,
                        size: file.size,
                        type: file.type,
                        status: Constants.IMAGE_UPLOAD_STATUS.PROGRESSING,
                        createdAt: createdAt,
                        createdBy: user.id
                    };
                    imageLogArray.push(logOption);

                    signatureArray.push({
                        preSignedUrl: url,
                        fileName: file.fileName
                    });
                });
            });

            // Insert product images
            var isImageLogInerted = await SupplyItem.insertImageLogMD({imageLogArray: imageLogArray});
            if (!isImageLogInerted) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_IMAGE_LOG_CREATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            AuditUtils.create(auditOptions);
            return cb(null, {
                updatedAt: updatedAt,
                signatures: signatureArray
            });
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    checkAvailableImage: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var supplyItemId = options.supplyItemId, err;
            try {
                var conn = await connection.getConnection();
                var imageCount = await conn.query('select count(*) as totalCount from SupplyImages where supplyItemId=uuid_to_bin(?) ' +
                  'and isMain=?', [supplyItemId, true]);
                imageCount = Utils.filteredResponsePool(imageCount);
                debug('imageCount', imageCount);
                if (DataUtils.isUndefined(imageCount)) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLY_IMAGES_GET_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
                var totalImage = parseInt(imageCount.totalCount);
                return resolve(totalImage);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },


    checkFileStatus: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var err;
            var files = options.files;
            var supplyItemId = options.supplyItemId;
            var updatedAt = options.updatedAt;
            var mainImage = options.mainImage;
            var mainImages = [];
            var thumbnail = 'thumbnail_';
            var thumbnailImage, originalImage;
            var count = 0;

            var imageCount = await SupplyItem.checkAvailableImage({supplyItemId: supplyItemId});

            _.each(files, function (file) {
                if (DataUtils.isUndefined(file.fileName)) {
                    err = new Error(ErrorConfig.MESSAGE.FILE_NAME_REQUIRED);
                } else if (DataUtils.isUndefined(file.status)) {
                    err = new Error(ErrorConfig.MESSAGE.FILE_STATUS_REQUIRED);
                } else if (Constants.FILE_RESPONSE_STATUS.indexOf(file.status) === -1) {
                    err = new Error(ErrorConfig.MESSAGE.INVALID_FILE_STATUS);
                } else if (DataUtils.isUndefined(file.isMain)) {
                    err = new Error(ErrorConfig.MESSAGE.IS_MAIN_REQUIRED);
                } else if (file.isMain) {
                    if (DataUtils.isUndefined(mainImage)) {
                        err = new Error(ErrorConfig.MESSAGE.MAIN_IMAGE_REQUIRED);
                    } else if (DataUtils.isUndefined(updatedAt)) {
                        err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_UPDATED_AT_REQUIRED);
                    } else if (!DataUtils.isValidNumber(updatedAt) || updatedAt.toString().length > 13) {
                        err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_INVALID_UPDATED_AT);
                    }
                    if (err) {
                        return;
                    }
                    mainImages.push(file);
                    count++;
                }
                if (count > 2) {
                    err = new Error(ErrorConfig.MESSAGE.ONLY_ONE_IMAGE_CAN_BE_SET_AS_MAIN);
                    count = 0;
                }
                if (err) {
                    return;
                }
            });
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                reject(err);
            }
            if (count === 1) {
                err = new Error(ErrorConfig.MESSAGE.IS_MAIN_REQUIRED_FOR_THUMBNAIL_AND_ORIGINAL_IMAGE);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return reject(err);
            }
            if (count === 2) {
                _.map(mainImages, function (image) {
                    if (image.fileName.indexOf(thumbnail) !== -1) {
                        thumbnailImage = image;
                    } else {
                        originalImage = image;
                    }
                });
                if (!thumbnailImage || !originalImage) {
                    err = new Error(ErrorConfig.MESSAGE.MAIN_ORIGINAL_AND_THUMBNAIL_IMAGE_MUST_BE_SAME);
                } else if (thumbnailImage && originalImage) {
                    var originailFile = originalImage.fileName.toString().substring(0, originalImage.fileName.toString().lastIndexOf('.'));
                    var thumbnailFile = thumbnailImage.fileName.toString().substring(0, thumbnailImage.fileName.toString().lastIndexOf('.'));
                    if (thumbnailFile.indexOf(originailFile.toString()) === -1) {
                        err = new Error(ErrorConfig.MESSAGE.MAIN_ORIGINAL_AND_THUMBNAIL_IMAGE_MUST_BE_SAME);
                    }
                }
                if (err) {
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }
            }
            if (imageCount >= 1 && count >= 1) {
                err = new Error(ErrorConfig.MESSAGE.MAIN_IMAGE_IS_ALREADY_SET);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return reject(err);
            }
            resolve(Constants.OK_MESSAGE);
        });
    },

    manipulateQuery: function (options) {
        return new Promise(function (resolve, reject) {
            var supplyItemId = options.supplyItemId;
            var deleteFiles = options.deleteFiles;
            var string = '', values = [];

            _.map(deleteFiles, function (file) {
                string += '?,';
                values.push(file);
            });
            string = string.replace(/,\s*$/, ' ');
            values.push(supplyItemId);
            return resolve({
                string: string,
                values: values
            });

        });
    },

    deleteSupplyImageRecord: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var fileNames = options.fileNames;
            var supplyItemId = options.supplyItemId;
            var deleteFiles = [], err;
            try {

                if (!DataUtils.isArray(fileNames)) {
                    deleteFiles.push(fileNames.fileName);
                } else {
                    _.map(fileNames, function (files) {
                        deleteFiles.push(files.fileName);
                    });
                }
                var conn = await connection.getConnection();
                var response = await SupplyItem.manipulateQuery({
                    deleteFiles: deleteFiles,
                    supplyItemId: supplyItemId
                });
                var isDeleted = await conn.query('delete from SupplyImages where fileName in (' + response.string + ') and ' +
                  'supplyItemId=uuid_to_bin(?)', response.values);
                isDeleted = Utils.isAffectedPool(isDeleted);

                debug('isDeleted', isDeleted);

                if (!isDeleted) {
                    debug('err', err);
                    err = new Error(ErrorConfig.MESSAGE.SUPPLY_IMAGE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_IMAGE_DELETE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    buildUpdateSupplyImageQuery: async function (options, cb) {
        var files = options.files;
        var supplyItemId = options.supplyItemId;
        var string = 'update SupplyImages set ';
        var end = 'END, ';
        var where = 'WHERE fileName IN (';
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var update = 'updatedAt=? ';
        var values = [];
        var close = ')';
        var finalResponse;

        try {
            _.each(files[0], function (value, key) {
                if (key === 'fileName') {
                    return;
                }
                string += key + ' = CASE fileName ';

                files.forEach(function (file) {
                    string += 'WHEN ? THEN ? ';
                    values.push(file['fileName'], file[key]);
                });
                string += end;
            });
            //for updatedAt
            string += update;
            values.push(updatedAt);

            string = string.replace(/,\s*$/, ' ');
            string += where;

            files.forEach(function (file) {
                string += '?, ';
                values.push(file['fileName']);
            });
            string = string.replace(/,\s*$/, '');
            string += close;

            string += ' and supplyItemId=uuid_to_bin(?);';
            values.push(supplyItemId);

            finalResponse = {
                string: string,
                values: values
            };
            return cb(null, finalResponse);
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
    },

    updateSupplyByImage: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var mainImage = options.mainImage;
            var supplyItemId = options.supplyItemId;
            var updatedAt = options.updatedAt;
            var newUpdatedAt = DataUtils.getEpochMSTimestamp();
            var userId = options.userId, err;
            try {
                var conn = await connection.getConnection();
                var isUpdated = await conn.query('IF (select 1 from SupplyItems where id=uuid_to_bin(?)) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "SUPPLY_ITEM_NOT_FOUND", MYSQL_ERRNO = 4001;' +
                  'ELSEIF (select 1 from SupplyItems where id=uuid_to_bin(?) and updatedAt=?) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "SUPPLY_ITEM_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
                  'ELSE update SupplyItems set mainImage=?, updatedAt =?,updatedBy=uuid_to_bin(?) ' +
                  'where id = uuid_to_bin(?);end if;', [supplyItemId, supplyItemId, updatedAt, mainImage, newUpdatedAt, userId, supplyItemId]);
                isUpdated = Utils.isAffectedPool(isUpdated);
                if (!isUpdated) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }
                return resolve({
                    updatedAt: newUpdatedAt,
                    OK: Constants.SUCCESS
                });
            } catch (err) {
                debug('err', err);
                if (err.errno === 4001) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                } else if (err.errno === 4002) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    return reject(err);
                } else {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }

            }
        });
    },

    updateImageLogs: async function (options, errorOptions, auditOptions, cb) {
        var user = options.user;
        var accountId = user.accountId;
        var supplyItemId = options.supplyItemId;
        var mainImage = options.mainImage;
        var updatedAt = options.updatedAt;
        var files = options.files, err, string, values;
        var updateFiles = [], deleteFiles = [];

        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
        try {
            var isValid = await SupplyItem.checkFileStatus({
                files: files,
                supplyItemId: supplyItemId,
                mainImage: mainImage,
                updatedAt: updatedAt
            });

            var supplyItem = await SupplyItem.getSupplyById({
                supplyItemId: supplyItemId,
                accountId: accountId
            });

            var fileResponse = await ProductReferenceApi.getDeleteFiles({
                files: files
            });
            updateFiles = fileResponse.updateFiles;
            deleteFiles = fileResponse.deleteFiles;

            /*
            *  DELETION IS TO CLEAN UP INCOMPLETE IMAGE UPLOAD REQUEST,
            *  24 hours is safety buffer to prevent inadvertent deletion of upload requests by other user sessions
            *  working on same account and same product (rare edge case)
            * */

            if (deleteFiles.length >= 1) {
                var deleteOption = {
                    fileNames: deleteFiles,
                    supplyItemId: supplyItemId
                };
                var deleteResponse = await SupplyItem.deleteSupplyImageRecord(deleteOption);
            }
            if (updateFiles.length >= 1) {
                var updateOption = {
                    files: updateFiles,
                    supplyItemId: supplyItemId
                };
                SupplyItem.buildUpdateSupplyImageQuery(updateOption, async function (err, response) {
                    if (err) {
                        debug('err', err);
                        return cb(err);
                    }
                    string = response.string;
                    values = response.values;

                    try {
                        await conn.query('START TRANSACTION;');
                        var isUpdated = await conn.query(string, values);
                        isUpdated = Utils.isAffectedPool(isUpdated);
                        if (!isUpdated) {
                            await conn.query('ROLLBACK;');
                            err = new Error(ErrorConfig.MESSAGE.SUPPLY_IMAGES_NOT_UPDATE);
                            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                            await ErrorUtils.create(errorOptions, options, err);
                            return cb(err);
                        }

                        // UPDATE Supply item BY MAIN IMAGE BASE64 STRING
                        try {
                            if (mainImage) {
                                var updateOption = {
                                    supplyItemId: supplyItemId,
                                    mainImage: mainImage,
                                    userId: user.id,
                                    updatedAt: updatedAt
                                };
                                var updateResponse = await SupplyItem.updateSupplyByImage(updateOption);
                                await conn.query('COMMIT;');
                                return cb(null, {
                                    OK: Constants.SUCCESS_MESSAGE.SUPPLY_IMAGE_LOG_UPDATE_SUCCESS,
                                    updatedAt: updateResponse.updatedAt
                                });
                            }
                        } catch (err) {
                            debug('err', err);
                            await conn.query('ROLLBACK;');
                            return cb(err);
                        }
                        AuditUtils.create(auditOptions);
                        await conn.query('COMMIT;');
                        return cb(null, {
                            OK: Constants.SUCCESS_MESSAGE.SUPPLY_IMAGE_LOG_UPDATE_SUCCESS
                        });
                    } catch (err) {
                        debug('err ', err);
                        await conn.query('ROLLBACK;');
                        err = new Error(ErrorConfig.MESSAGE.SUPPLY_IMAGE_UPDATE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                        await ErrorUtils.create(errorOptions, options, err);
                        return cb(err);
                    }
                });
            } else {
                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.SUPPLY_IMAGE_LOG_UPDATE_SUCCESS
                });
            }
        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK;');
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    getSignedUrl: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var accountId = options.accountId;
            var fileName = options.fileName;
            var opt = {
                Bucket: Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET,
                Key: accountId + '/' + Constants.S3_FOLDER.SUPPLY_ITEM_IMAGES + '/' + fileName,
                Expires: 60 * 60
            };
            s3.getSignedUrl('getObject', opt, function (err, url) {
                if (err) {
                    debug('err', err);
                    err = new Error(ErrorConfig.MESSAGE.GET_SIGN_URL_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
                return resolve(url);
            });
        });
    },

    getImageLogs: async function (options, errorOptions, cb) {
        var user = options.user;
        var accountId = user.accountId;
        var supplyItemId = options.supplyItemId;
        var allImageLogs = [];
        var thumbnail = 'thumbnail_';
        var thumbnailImages = [];
        var originalImages = [];
        var response = [], flag = false, option;
        var err;

        if (DataUtils.isUndefined(supplyItemId)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var supplyResponse = await conn.query('select updatedAt from SupplyItems where accountId=uuid_to_bin(?) and ' +
              'id=uuid_to_bin(?)', [accountId, supplyItemId]);
            supplyResponse = Utils.filteredResponsePool(supplyResponse);
            if (!supplyResponse) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }

            var imageLogs = await conn.query('select fileName,isMain,status from SupplyImages where accountId=uuid_to_bin(?) ' +
              'and supplyItemId=uuid_to_bin(?) and status = 1;', [accountId, supplyItemId]);

            if (!imageLogs) {
                return cb(null, {
                    updatedAt: supplyResponse.updatedAt,
                    files: []
                });
            }
            if (!DataUtils.isArray(imageLogs)) {
                allImageLogs.push(imageLogs);
            } else {
                allImageLogs = imageLogs;
            }
            if (allImageLogs.length > 0) {
                _.map(allImageLogs, async function (image) {
                    if (image.fileName.indexOf(thumbnail) !== -1) {
                        thumbnailImages.push(image);
                    } else {
                        originalImages.push(image);
                    }
                });
            }

            await PromiseBluebird.each(originalImages, async function (originalImage) {
                await PromiseBluebird.each(thumbnailImages, async function (thumbnailImage) {
                    var originailFile = originalImage.fileName.toString().substring(0, originalImage.fileName.toString().lastIndexOf('.'));
                    var thumbnailFile = thumbnailImage.fileName.toString().substring(0, thumbnailImage.fileName.toString().lastIndexOf('.'));
                    var tempFileName = thumbnail + originailFile;
                    //debug('tempFileName', tempFileName);
                    if (thumbnailFile.toString().indexOf(originailFile.toString()) !== -1 && tempFileName.length === thumbnailFile.length) {
                        var url = await SupplyItem.getSignedUrl({
                            accountId: accountId,
                            fileName: thumbnailImage.fileName
                        });
                        var option = {
                            signedUrl: url,
                            fileName: originalImage.fileName,
                            isMain: originalImage.isMain,
                            status: originalImage.status
                        };
                        flag = true;
                        response.push(option);
                    }
                });
                if (!flag) {
                    var url = await SupplyItem.getSignedUrl({
                        accountId: accountId,
                        fileName: originalImage.fileName
                    });
                    option = {
                        signedUrl: url,
                        fileName: originalImage.fileName,
                        status: originalImage.status
                    };
                    response.push(option);
                }
                flag = false;
            });
            return cb(null, {
                updatedAt: supplyResponse.updatedAt,
                files: response
            });
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_IMAGES_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    getOriginalImage: async function (options, errorOptions, cb) {
        var user = options.user;
        var accountId = user.accountId;
        var fileName = options.fileName;
        var supplyItemId = options.supplyItemId;
        var err;

        if (DataUtils.isUndefined(supplyItemId)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_ID_REQUIRED);
        } else if (DataUtils.isUndefined(fileName)) {
            err = new Error(ErrorConfig.MESSAGE.FILE_NAME_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var supplyItem = await SupplyItem.getSupplyById({
                supplyItemId: supplyItemId,
                accountId: accountId
            });

            var url = await SupplyItem.getSignedUrl({
                accountId: accountId,
                fileName: fileName
            });

            return cb(null, {url: url});
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    getImageQuery: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var files = options.files;
            var supplyItemId = options.supplyItemId;
            var query = 'select fileName from SupplyImages where (';
            var condition = ' fileName like ? or fileName like ? or ';
            var values = [], original, thumbnail;

            _.each(files, function (file) {
                original = file.toString().substring(0, file.toString().lastIndexOf('.')) + '.%';
                thumbnail = 'thumbnail_' + file.toString().substring(0, file.toString().lastIndexOf('.')) + '.%';
                query += condition;
                values.push(original, thumbnail);
            });
            query = query.replace(/or\s*$/, ')');
            query += ' and supplyItemId=uuid_to_bin(?)';
            values.push(supplyItemId);
            return resolve({
                query: query,
                values: values
            });
        });
    },

    getTotalImages: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var supplyItemId = options.supplyItemId;
            var accountId = options.accountId;
            var err;
            try {
                var conn = await connection.getConnection();
                var imagesLength = await conn.query('select count(*) as length from SupplyImages where accountId=uuid_to_bin(?) ' +
                  'and supplyItemId=uuid_to_bin(?) and status = 1;', [accountId, supplyItemId]);
                imagesLength = Utils.filteredResponsePool(imagesLength);
                if (!imagesLength) {
                    debug('err', err);
                    err = new Error(ErrorConfig.MESSAGE.SUPPLY_IMAGE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }
                return resolve(imagesLength);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    deleteImageFileOnS3: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var accountId = options.accountId;
            var fileNames = options.fileNames;
            var bucket = Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET;
            var key = accountId + '/' + Constants.S3_FOLDER.SUPPLY_ITEM_IMAGES;
            var deleteArray = [];

            if (!DataUtils.isArray(fileNames)) {
                var deleteKeys = {
                    Key: key + '/' + fileNames.fileName
                };
                deleteArray.push(deleteKeys);
            } else {
                _.map(fileNames, function (file) {
                    var deleteKeys = {
                        Key: key + '/' + file.fileName
                    };
                    deleteArray.push(deleteKeys);
                });
            }

            var deleteParams = {
                Bucket: bucket,
                Delete: {
                    Objects: deleteArray
                }
            };
            s3.deleteObjects(deleteParams, async function (err, response) {
                if (err || !response) {
                    debug('err', err);
                    err = new Error(ErrorConfig.MESSAGE.SUPPLY_IMAGE_DELETE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
                return resolve(response);
            });
        });
    },

    deleteImageRecordAndFile: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var accountId = options.accountId;
            var fileNames = options.fileNames;
            var supplyItemId = options.supplyItemId;
            var err;
            try {
                //Delete record from SupplyImages table
                var deleteRecordOption = {
                    fileNames: fileNames,
                    supplyItemId: supplyItemId
                };
                var deleteRecordResponse = await SupplyItem.deleteSupplyImageRecord(deleteRecordOption);
                if (!deleteRecordResponse) {
                    debug('err ', err);
                    err = new Error(ErrorConfig.MESSAGE.SUPPLY_IMAGE_DELETE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }

                // Delete image files on amazon
                var deleteOption = {
                    accountId: accountId,
                    fileNames: fileNames
                };
                var deleteImageResponse = await SupplyItem.deleteImageFileOnS3(deleteOption);
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    deleteSupplyImageLogs: async function (options, errorOptions, auditOptions, cb) {
        var user = options.user;
        var accountId = user.accountId;
        var supplyItemId = options.supplyItemId;
        var files = options.files;
        var isMain = options.isMain;
        var updatedAt = options.updatedAt;
        var query, values, err;


        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
        try {
            if (DataUtils.isUndefined(files) || (DataUtils.isArray(files) && files.length <= 0)) {
                err = new Error(ErrorConfig.MESSAGE.FILES_REQUIRED);
            } else if (files.length > 10) {
                err = new Error(ErrorConfig.MESSAGE.FILE_MUST_BE_LESS_THAN_10);
            } else if (DataUtils.isUndefined(supplyItemId)) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_ID_REQUIRED);
            } else if (isMain) {
                if (DataUtils.isUndefined(updatedAt)) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_UPDATED_AT_REQUIRED);
                } else if (!DataUtils.isValidNumber(updatedAt) || updatedAt.toString().length > 13) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_INVALID_UPDATED_AT);
                }
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug('err', err);
                return cb(err);
            }


            // Check if supply item is exist or not
            var supplyItem = await SupplyItem.getSupplyById({
                supplyItemId: supplyItemId,
                accountId: accountId
            });

            // get original and thumbnail images from fileName
            var getOption = {
                files: files,
                supplyItemId: supplyItemId
            };
            var queryResponse = await SupplyItem.getImageQuery(getOption);
            query = queryResponse.query;
            values = queryResponse.values;

            var fileNames = await conn.query(query, values);
            if (!fileNames || fileNames.length <= 0) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_IMAGES_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                debug('err ', err);
                return cb(err);
            }

            try {
                await conn.query('START TRANSACTION;');
                if (isMain) {
                    //CHECK LENGTH OF FILES FROM DB AND GET FROM REQUEST
                    var lengthOption = {
                        supplyItemId: supplyItemId,
                        accountId: accountId
                    };
                    var lengthResponse = await SupplyItem.getTotalImages(lengthOption);

                    if ((lengthResponse.length) / 2 !== files.length) {
                        err = new Error(ErrorConfig.MESSAGE.CAN_NOT_DELETE_MAIN_IMAGE);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        await ErrorUtils.create(errorOptions, options, err);
                        debug('err ', err);
                        throw err;
                    }

                    // UPDATE PRODUCT RECORD BY REMOVING VALUE FROM MAIN IMAGE FIELD
                    var updateOption = {
                        supplyItemId: supplyItemId,
                        mainImage: Constants.DEFAULT_MAIN_IMAGE,
                        userId: user.id,
                        updatedAt: updatedAt
                    };
                    var updateResponse = await SupplyItem.updateSupplyByImage(updateOption);
                }

                // DELETE IMAGE RECORD FROM DB AND FILE FROM S3
                var deleteOption = {
                    fileNames: fileNames,
                    supplyItemId: supplyItemId,
                    accountId: accountId
                };
                var deleteResponse = await SupplyItem.deleteImageRecordAndFile(deleteOption);
                await conn.query('COMMIT;');
                AuditUtils.create(auditOptions);
                if (isMain) {
                    return cb(null, {
                        OK: Constants.SUCCESS_MESSAGE.SUPPLY_IMAGE_DELETE_SUCCESS,
                        updatedAt: updateResponse.updatedAt
                    });
                }
                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.SUPPLY_IMAGE_DELETE_SUCCESS
                });
            } catch (err) {
                debug('err', err);
                await conn.query('ROLLBACK;');
                return cb(err);
            }
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
    },

    setMainSupplyImage: async function (options, errorOptions, auditOptions, cb) {
        var user = options.user;
        var accountId = user.accountId;
        var supplyItemId = options.supplyItemId;
        var mainImage = options.mainImage;
        var supplyUpdatedAt = options.updatedAt;
        var fileName = options.fileName, err;
        var updatedAt = DataUtils.getEpochMSTimestamp();

        if (DataUtils.isUndefined(supplyItemId)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_ID_REQUIRED);
        } else if (DataUtils.isUndefined(fileName)) {
            err = new Error(ErrorConfig.MESSAGE.FILE_NAME_REQUIRED);
        } else if (DataUtils.isUndefined(supplyUpdatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(supplyUpdatedAt) || supplyUpdatedAt.toString().length > 13) {
            err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_INVALID_UPDATED_AT);
        }
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
            // set isMain image to false who is already true
            var isUpdatedMain = await conn.query('update SupplyImages set isMain=? , updatedAt=? where ' +
              'supplyItemId=uuid_to_bin(?) and isMain=?', [false, updatedAt, supplyItemId, true]);
            isUpdatedMain = Utils.isAffectedPool(isUpdatedMain);
            if (!isUpdatedMain) {
                await conn.query('ROLLBACK;');
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_IMAGE_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
            var tempFileName = fileName.toString().substring(0, fileName.toString().lastIndexOf('.'));
            // update isMain image to true
            var isUpdated = await conn.query('IF (select 1 from SupplyImages where supplyItemId=uuid_to_bin(?) and fileName=? ) is null then ' +
              'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "SUPPLY_IMAGE_NOT_FOUND", MYSQL_ERRNO = 4001; ' +
              'ELSE update SupplyImages set isMain=? , updatedAt=? where supplyItemId=uuid_to_bin(?) and (fileName like ? or fileName like ?); END IF;',
              [supplyItemId, fileName, true, updatedAt, supplyItemId, tempFileName + '.%', 'thumbnail_' + tempFileName + '.%']);
            isUpdated = Utils.isAffectedPool(isUpdated);
            if (!isUpdated) {
                throw err;
            }
        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK;');
            await ErrorUtils.create(errorOptions, options, err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_IMAGE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            } else {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_IMAGE_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
        }
        // Update product reference
        try {
            var updateOption = {
                supplyItemId: supplyItemId,
                mainImage: mainImage,
                userId: user.id,
                updatedAt: supplyUpdatedAt
            };
            var updateResponse = await SupplyItem.updateSupplyByImage(updateOption);
            await conn.query('COMMIT;');
            return cb(null, {
                OK: Constants.SUCCESS_MESSAGE.SET_MAIN_IMAGE_SUCCESS,
                updatedAt: updateResponse.updatedAt
            });
        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK;');
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    manipulateItemIdQuery: function (options) {
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

    validateSupplyItems: function (options) {
        return new Promise(async function (resolve, reject) {
            var supplyItems = options.supplyItems;
            var err;

            try {
                if (DataUtils.isUndefined(supplyItems)) {
                    err = new Error(ErrorConfig.MESSAGE.ID_REQUIRED);
                } else if (!DataUtils.isArray(supplyItems)) {
                    err = new Error(ErrorConfig.MESSAGE.ID_MUST_BE_ARRAY);
                } else if (supplyItems.length <= 0) {
                    err = new Error(ErrorConfig.MESSAGE.ATLEAST_ONE_ID_REUQIRED);
                }
                if (err) {
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }

                await Promise.each(supplyItems, async function (item) {
                    if (DataUtils.isUndefined(item.id)) {
                        err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_ID_REQUIRED);
                    } else if (DataUtils.isValidateOptionalField(item.updatedAt)) {
                        err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_UPDATED_AT_REQUIRED);
                    } else if (!DataUtils.isValidNumber(item.updatedAt)) {
                        err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_UPDATED_AT_MUST_BE_NUMBER);
                    } else if (item.updatedAt.toString().length !== 13) {
                        err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_INVALID_UPDATED_AT);
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

    updateInventoryBySupplyItemId: function (options) {
        return new Promise(async function (resolve, reject) {
            var supplyItemId = options.supplyItemId;
            var accountId = options.accountId;
            var qtyUoMId = options.qtyUoMId;
            var userId = options.userId;
            var updatedAt = DataUtils.getEpochMSTimestamp();
            var err;

            try {
                var conn = await connection.getConnection();
                var isInventoryUpdated = await conn.query('IF (select 1 from uomScaling where id=?) is null then ' +
                  ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "UNIT_OF_MEASURE_NOT_FOUND", MYSQL_ERRNO = 4001;' +
                  ' ELSE ' +
                  ' update SupplyInventory set qtyOnHand = 0, qtyOnHandUoM=? ,' +
                  ' qtyOnOrder = 0, qtyOnOrderUoM=?, qtyAvailable = 0, qtyAvailableUoM=?, qtyInTransit = 0, qtyInTransitUoM=? ,' +
                  ' updatedAt=? , updatedBy=uuid_to_bin(?) where  supplyItemId = uuid_to_bin(?) and ' +
                  ' accountId = uuid_to_bin(?) and status = 1; END IF;',
                  [qtyUoMId, qtyUoMId, qtyUoMId, qtyUoMId, qtyUoMId, updatedAt, userId, supplyItemId, accountId]);
                isInventoryUpdated = Utils.isAffectedPool(isInventoryUpdated);
                debug('isInventoryUpdated', isInventoryUpdated);
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                if (err.errno === 4001) {
                    err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                } else {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                }
                return reject(err);
            }
        });
    },

    getExistItemIds: function (options) {
        return new Promise(async function (resolve, reject) {
            var supplyItems = options.supplyItems;
            var accountId = options.accountId;
            var status = options.status;
            var successItems = [], conflictItems = [];

            try {
                var conn = await connection.getConnection();

                var response = await SupplyItem.manipulateItemIdQuery({list: supplyItems});
                debug('response', response);

                var itemIds = await conn.query('select  CAST(uuid_from_bin(id) as CHAR) as id from SupplyItems ' +
                  ' where accountId=uuid_to_bin(?) and status = ? and id in (' + response.string + ')', [accountId, status].concat(response.values));

                itemIds = _.map(itemIds, 'id');

                if (itemIds.length > 0) {
                    _.map(supplyItems, function (item) {
                        if (itemIds.indexOf(item.id) === -1) {
                            conflictItems.push(item.id);
                        } else {
                            successItems.push(item);
                        }
                    });
                } else {
                    conflictItems = _.map(supplyItems, 'id');
                }
                var itemsResponse = {
                    successItems: successItems,
                    conflictItems: conflictItems
                };

                return resolve(itemsResponse);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    getSupplyInventoryBySupplyItemId: async function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var supplyItemId = options.supplyItemId;
            var accountId = options.accountId;
            var err;
            if (DataUtils.isUndefined(supplyItemId)) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_ID_REQUIRED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug('error', err);
                return cb(err);
            }
            try {
                var conn = await connection.getConnection();

                var supplyInventories = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id,isRealTimeFrequency ' +
                  'from SupplyInventory where supplyItemId = uuid_to_bin(?) and accountId = uuid_to_bin(?);', [supplyItemId, accountId]);

                /*if (!supplyInventories) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    await ErrorUtils.create(errorOptions, options, err);
                    debug('err', err);
                    return reject(err);
                }*/
                return resolve(supplyInventories);
            } catch (err) {
                debug('error', err);
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                await ErrorUtils.create(errorOptions, options, err);
                return reject(err);
            }
        });
    },

    checkUpdatedAt: function (options) {
        return new Promise(async function (resolve, reject) {
            var supplyItems = options.supplyItems;
            var accountId = options.accountId;
            var status = options.status;
            var string = '', values = [];
            var existItems = [], notExistItems = [];
            var conflict = [], success = [];
            var conflictIds = [];

            try {
                var conn = await connection.getConnection();

                var getExistItemOption = {
                    supplyItems: supplyItems,
                    status: status,
                    accountId: accountId
                };
                var getExistItemResponse = await SupplyItem.getExistItemIds(getExistItemOption);
                existItems = getExistItemResponse.successItems;
                conflict = getExistItemResponse.conflictItems;

                if (existItems.length <= 0) {
                    return resolve({success: success, conflict: conflict});
                }

                await Promise.each(existItems, function (item) {
                    string += ' SELECT CAST(uuid_from_bin(id) as char) as id FROM SupplyItems WHERE (updatedAt != ? AND id = uuid_to_bin(?)) UNION ALL ';
                    values.push(item.updatedAt, item.id);
                });

                string = string.replace(/UNION ALL \s*$/, ' ');

                var response = await conn.query(string, values);
                debug('response', response);

                conflictIds = _.map(response, function (value) {
                    return value.id;
                });

                _.map(existItems, function (item) {
                    if (conflictIds.indexOf(item.id) === -1) {
                        success.push(item.id);
                    } else {
                        conflict.push(item.id);
                    }
                });

                return resolve({success: success, conflict: conflict});
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    updateSupplyInventoryQTY: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var qtyUoMId = options.qtyUoMId;
            var supplyItemId = options.supplyItemId;
            var accountId = options.accountId;
            var userId = options.userId;
            var conditionString, conditionValues;

            try {
                var updateSupplyInventoryOption = {
                    supplyItemId: supplyItemId,
                    accountId: accountId,
                    userId: userId,
                    qtyUoMId: qtyUoMId
                };
                var updateResponse = await SupplyItem.updateInventoryBySupplyItemId(updateSupplyInventoryOption);
                debug('updateResponse', updateResponse);

                // If this product has any real_time sharing
                var getInventoryOption = {
                    supplyItemId: supplyItemId,
                    accountId: accountId
                };
                var supplyInventories = await SupplyItem.getSupplyInventoryBySupplyItemId(getInventoryOption);
                debug('supplyInventories', supplyInventories);

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


    manipulateItemQuery: function (options) {
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

    updateStatusMultipleItems: function (options) {
        return new Promise(async function (resolve, reject) {
            var supplyItems = options.successSupplyItems;
            var accountId = options.accountId;
            var status = options.status;
            var currentDate = DataUtils.getEpochMSTimestamp();
            var err;

            try {
                var conn = await connection.getConnection();
                var queryResponse = await SupplyItem.manipulateItemQuery({list: supplyItems});
                debug('queryResponse', queryResponse);

                var isDeleted = await conn.query('update SupplyItems set status = ?,updatedAt=? ' +
                  'where accountId = uuid_to_bin(?) and id in (' + queryResponse.string + ');',
                  [status, currentDate, accountId].concat(queryResponse.values));

                isDeleted = Utils.isAffectedPool(isDeleted);
                if (!isDeleted) {
                    if (status === Constants.SUPPLY_ITEM_STATUS.IN_ACTIVE) {
                        err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_ARCHIEVED_FAILED);
                    } else {
                        err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_RESTORE_FAILED);
                    }
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                if (status === Constants.SUPPLY_ITEM_STATUS.IN_ACTIVE) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_ARCHIEVED_FAILED);
                } else {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_RESTORE_FAILED);
                }
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    getSupplyItemByUOM: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var accountId = options.accountId;
            var qtyUoMId = options.qtyUoMId;

            try {
                var conn = await connection.getConnection();

                var supplyItems = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id from SupplyItems where ' +
                  'qtyUoMId = ? and accountId = uuid_to_bin(?)', [qtyUoMId, accountId]);
                return resolve(supplyItems);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEMS_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    updateInShareAlert: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var inShareIds = options.inShareIds;
            var shareItemId = options.shareItemId;
            var updatedAt = DataUtils.getEpochMSTimestamp();
            debug('inside update inshare alert');

            try {
                var conn = await connection.getConnection();
                var response = await SupplyItem.manipulateItemQuery({list: inShareIds});
                debug('response', response);

                var updateAlert = await conn.query('UPDATE SharingAlert SET status = ?, updatedAt = ? where ' +
                  ' shareItemId = uuid_to_bin(?) and inShareId in (' + response.string + ')',
                  [options.status, updatedAt, shareItemId].concat(response.values));

                debug('update Alert', updateAlert);

                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.UPDATE_IN_SHARE_ALERT_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    deleteArchieveItems: async function (options, auditOptions, errorOptions, cb) {
        var supplyItems = options.supplyItems;
        var accountId = options.accountId;
        var successSupplyItems, conflictSupplyItems;
        var checkResponses = [];
        var err;

        try {
            //validate request of delete multiple supply Item
            var checkOption = {
                supplyItems: supplyItems
            };
            var checkResponse = await SupplyItem.validateSupplyItems(checkOption);
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
            // check updatedAt of supply items
            var response = await SupplyItem.checkUpdatedAt({
                supplyItems: supplyItems,
                status: Constants.SUPPLY_ITEM_STATUS.ACTIVE,
                accountId: accountId
            });
            debug('response', response);
            successSupplyItems = response.success;
            conflictSupplyItems = response.conflict;

            if (successSupplyItems.length <= 0 && conflictSupplyItems.length > 0) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {success: successSupplyItems, conflict: conflictSupplyItems};
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            } else if (successSupplyItems.length <= 0 && conflictSupplyItems.length <= 0) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {success: successSupplyItems, conflict: conflictSupplyItems};
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }

            // Check if any out share or inshare is exist for each parter , if yes then stop sharing for those partner
            await Promise.each(successSupplyItems, async function (inventory) {
                var checkOptions = {
                    id: inventory,
                    accountId: accountId,
                    userId: options.userId,
                    flag: false
                };
                var checkResponse = await ProductInventoryApi.checkUpdateOutShares(checkOptions);
                if (checkResponse) {
                    checkResponses.push(checkResponse);
                }
                debug('checkResponses', checkResponses);

                if (checkResponse.inShareIds) {
                    // Update inshare alert (status = 0)
                    var updateAlertOptions = {
                        shareItemId: inventory,
                        inShareIds: checkResponse.inShareIds,
                        status: Constants.ALERT_STATUS.IN_ACTIVE
                    };
                    debug('updateAlertOptions', updateAlertOptions);
                    var updateAlertResponse = await SupplyItem.updateInShareAlert(updateAlertOptions);
                    debug('updateAlertResponse', updateAlertResponse);
                }

            });

            // delete Supply Items (status = 0 )
            var deleteOption = {
                successSupplyItems: successSupplyItems,
                status: Constants.SUPPLY_ITEM_STATUS.IN_ACTIVE,
                accountId: accountId
            };
            var deleteResponse = await SupplyItem.updateStatusMultipleItems(deleteOption);
            debug('deleteResponse', deleteResponse);

            // NOTIFY the all inShare partners of the affected outshare
            debug('checkResponse', checkResponses);
            var notifyOption = {
                checkResponses: checkResponses,
                userId: options.userId
            };
            var notifyResponse = await ProductInventoryApi.notifyInSharePartner(notifyOption);

            await conn.query('COMMIT;');
            AuditUtils.create(auditOptions);
            if (successSupplyItems.length > 0 && conflictSupplyItems.length > 0) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {
                    successMsg: Constants.SUCCESS_MESSAGE.SUPPLY_ITEM_ARCHIEVED_SUCCESSFULLY,
                    success: successSupplyItems,
                    conflict: conflictSupplyItems
                };
                debug('err', err);
                return cb(err);
            } else {
                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.SUPPLY_ITEM_ARCHIEVED_SUCCESSFULLY,
                    success: successSupplyItems
                });
            }
        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK;');
            ErrorUtils.create(errorOptions, options, err);
            err = err || new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_ARCHIEVED_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    restoreArchieveItems: async function (options, auditOptions, errorOptions, cb) {
        var supplyItems = options.supplyItems;
        var accountId = options.accountId;
        var successSupplyItems, conflictSupplyItems;
        var err;

        try {
            //validate request of delete multiple supply Item
            var checkOption = {
                supplyItems: supplyItems
            };
            var checkResponse = await SupplyItem.validateSupplyItems(checkOption);
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
            // check updatedAt of supply items
            var response = await SupplyItem.checkUpdatedAt({
                supplyItems: supplyItems,
                status: Constants.SUPPLY_ITEM_STATUS.IN_ACTIVE,
                accountId: accountId
            });
            debug('response', response);
            successSupplyItems = response.success;
            conflictSupplyItems = response.conflict;

            if (successSupplyItems.length <= 0 && conflictSupplyItems.length > 0) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {success: successSupplyItems, conflict: conflictSupplyItems};
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            } else if (successSupplyItems.length <= 0 && conflictSupplyItems.length <= 0) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {success: successSupplyItems, conflict: conflictSupplyItems};
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }

            // restore Supply Items (status = 1)
            var restoreOption = {
                successSupplyItems: successSupplyItems,
                status: Constants.SUPPLY_ITEM_STATUS.ACTIVE,
                accountId: accountId
            };
            var restoreResponse = await SupplyItem.updateStatusMultipleItems(restoreOption);
            debug('restoreResponse', restoreResponse);

            await conn.query('COMMIT;');
            AuditUtils.create(auditOptions);
            if (successSupplyItems.length > 0 && conflictSupplyItems.length > 0) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {
                    successMsg: Constants.SUCCESS_MESSAGE.SUPPLY_ITEM_RESTORED_SUCCESSFULLY,
                    success: successSupplyItems,
                    conflict: conflictSupplyItems
                };
                debug('err', err);
                return cb(err);
            } else {
                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.SUPPLY_ITEM_RESTORED_SUCCESSFULLY,
                    success: successSupplyItems
                });
            }
        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK;');
            ErrorUtils.create(errorOptions, options, err);
            err = err || new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_RESTORE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    deleteMultipleItems: function (options) {
        return new Promise(async function (resolve, reject) {
            var supplyItems = options.successSupplyItems;
            var accountId = options.accountId;
            var err;

            try {
                var conn = await connection.getConnection();

                var queryResponse = await SupplyItem.manipulateItemQuery({list: supplyItems});

                var isDeleted = await conn.query('delete from SupplyItems where accountId = uuid_to_bin(?) and status = 0 ' +
                  ' and id in (' + queryResponse.string + ');',
                  [accountId].concat(queryResponse.values));

                isDeleted = Utils.isAffectedPool(isDeleted);

                if (!isDeleted) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_DELETE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_DELETE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    deleteItems: async function (options, auditOptions, errorOptions, cb) {
        var supplyItems = options.supplyItems;
        var accountId = options.accountId;
        var successSupplyItems, conflictSupplyItems;
        var err;

        try {
            //validate request of delete multiple supply Item
            var checkOption = {
                supplyItems: supplyItems
            };
            var checkResponse = await SupplyItem.validateSupplyItems(checkOption);
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
            // check updatedAt of supply items
            var response = await SupplyItem.checkUpdatedAt({
                supplyItems: supplyItems,
                status: Constants.SUPPLY_ITEM_STATUS.IN_ACTIVE,
                accountId: accountId
            });
            successSupplyItems = response.success;
            conflictSupplyItems = response.conflict;

            if (successSupplyItems.length <= 0 && conflictSupplyItems.length > 0) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {success: successSupplyItems, conflict: conflictSupplyItems};
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            } else if (successSupplyItems.length <= 0 && conflictSupplyItems.length <= 0) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {success: successSupplyItems, conflict: conflictSupplyItems};
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }


            var deleteOptions = {
                successSupplyItems: successSupplyItems,
                accountId: accountId
            };
            var deleteResponse = await SupplyItem.deleteMultipleItems(deleteOptions);
            debug('deleteResponse', deleteResponse);

            await conn.query('COMMIT;');
            AuditUtils.create(auditOptions);
            if (successSupplyItems.length > 0 && conflictSupplyItems.length > 0) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {
                    successMsg: Constants.SUCCESS_MESSAGE.SUPPLY_ITEM_DELETED_SUCCESSFULLY,
                    success: successSupplyItems,
                    conflict: conflictSupplyItems
                };
                debug('err', err);
                return cb(err);
            } else {
                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.SUPPLY_ITEM_DELETED_SUCCESSFULLY,
                    success: successSupplyItems
                });
            }
        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK;');
            ErrorUtils.create(errorOptions, options, err);
            err = err || new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_DELETE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    searchSupplyItems: async function (options, errorOptions, cb) {
        var user = options.user;
        var accountId = user.accountId;
        var languageCultureCode = user.languageCultureCode;
        var sku = options.sku;
        var sellerSKUName = options.sellerSKUName;
        var type = options.type;
        var mpProductId = options.mpProductId;
        var UPC = options.UPC;
        var brand = options.brand;
        var isActive = options.isActive;
        var checkString = '', whereString = '', queryString = '';
        var checkValues = [];
        var queryValues = [languageCultureCode, languageCultureCode, languageCultureCode, languageCultureCode, languageCultureCode,
            languageCultureCode, languageCultureCode, languageCultureCode, accountId, parseInt(isActive)];
        var err;

        if (DataUtils.isUndefined(accountId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
        } else if (DataUtils.isUndefined(isActive)) {
            err = new Error(ErrorConfig.MESSAGE.IS_ACTIVE_FIELD_REQUIRED);
        } else if (DataUtils.isUndefined(sku) && DataUtils.isUndefined(sellerSKUName) && DataUtils.isUndefined(type) &&
          DataUtils.isUndefined(mpProductId) && DataUtils.isUndefined(UPC) && DataUtils.isUndefined(brand)) {
            err = new Error(ErrorConfig.MESSAGE.AT_LEASE_ONE_SEARCH_ATTRIBUTE_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            if (DataUtils.isDefined(sku)) {
                checkString += ' sku like ? and ';
                whereString += ' SI.sku like ? and ';
                checkValues.push('%' + sku + '%');
            }
            if (DataUtils.isDefined(sellerSKUName)) {
                checkString += ' sellerSKUName like ?  and ';
                whereString += ' SI.sellerSKUName like ? and ';
                checkValues.push('%' + sellerSKUName + '%');
            }
            if (DataUtils.isDefined(type)) {
                checkString += ' type like ? and ';
                whereString += ' SI.type like ? and ';
                checkValues.push('%' + type + '%');
            }
            if (DataUtils.isDefined(mpProductId)) {
                checkString += ' mpProductId like ? and ';
                whereString += ' SI.mpProductId like ? and ';
                checkValues.push('%' + mpProductId + '%');
            }
            if (DataUtils.isDefined(UPC)) {
                checkString += ' UPC like ? and ';
                whereString += ' SI.UPC like ? and ';
                checkValues.push('%' + UPC + '%');
            }
            if (DataUtils.isDefined(brand)) {
                checkString += ' brand like ? and ';
                whereString += ' SI.brand like ? and ';
                checkValues.push('%' + brand + '%');
            }
            checkString = checkString.replace(/and\s*$/, '');
            whereString = whereString.replace(/and\s*$/, '');

            var conn = await connection.getConnection();

            queryString = 'IF (select count(id) from SupplyItems where accountId = uuid_to_bin(?) and ' +
              ' status= ? and ' + checkString + ') > ? THEN ' +
              ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "ROW_COUNT_EXCEED_PLEASE_USE_SEARCH_AND_FILTER", MYSQL_ERRNO = 4001; ' +
              ' ELSE SELECT CAST(uuid_from_bin(SI.id) as CHAR) as id , SI.sku, SI.sellerSKUName, SI.type, ' +
              ' SI.classificationCode, SI.classificationSystem, SI.endCustomerProduct, SI.GCID, SI.UPC, SI.EAN, SI.ISBN, ' +
              ' SI.JAN, SI.articleNo, SI.modelNumber, SI.countryOfManufacture, SI.barcode,SI.brand,SI.harmonizedCode,SI.mpProductId, ' +
              ' SI.skuAlias,SI.tags,SI.weightAmount, UNT1.symbol as weightSymbol, SI.lengthAmount, UNT2.symbol as lengthSymbol, ' +
              ' SI.volumeAmount, UNT3.symbol as volumeSymbol,SI.heightAmount, UNT4.symbol as heightSymbol, ' +
              ' SI.depthAmount, UNT5.symbol as depthSymbol, SI.diameterAmount, UNT6.symbol as diameterSymbol, ' +
              ' SI.qtyUoMId, UNT7.symbol as qtyUoMSymbol, UCat.categoryId, UCat.name as qtyUoMCategoryName,SI.mainImage, SI.status, ' +
              ' SI.updatedAt FROM SupplyItems  SI, uomNames UNT1, uomNames UNT2, uomNames UNT3, ' +
              ' uomNames UNT4, uomNames UNT5, uomNames UNT6,uomNames UNT7,uomCategory UCat, uomScaling USca WHERE UNT1.uomScalingId = SI.weightUoMScal AND UNT1.languageCultureCode =? ' +
              ' AND UNT2.uomScalingId = SI.lengthUoMScal AND UNT2.languageCultureCode = ? AND UNT3.uomScalingId = SI.volumeUoMScal ' +
              ' AND UNT3.languageCultureCode = ? AND UNT4.uomScalingId = SI.heightUoMScal AND UNT4.languageCultureCode = ? ' +
              ' AND UNT5.uomScalingId = SI.depthUoMScal AND UNT5.languageCultureCode = ? AND UNT6.uomScalingId = SI.diameterUoMScal ' +
              ' AND UNT6.languageCultureCode = ? AND UNT7.uomScalingId = SI.qtyUoMId AND UNT7.languageCultureCode = ? ' +
              ' AND USca.id = SI.qtyUoMId AND UCat.categoryId = USca.categoryId AND UCat.languageCultureCode = ? ' +
              ' AND SI.accountId=uuid_to_bin(?) AND SI.status= ? AND ' + whereString + '; END IF;';

            debug('queryString', queryString);

            var supplyItems = await conn.query(queryString, [accountId, parseInt(isActive)].concat(checkValues, [Constants.ROW_LIMIT], queryValues, checkValues));
            //debug('supplyItems', supplyItems);
            supplyItems = Utils.filteredResponsePool(supplyItems);

            return cb(null, supplyItems);
        } catch (err) {
            debug('err', err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.ROW_COUNT_EXCEED_PLEASE_USE_SEARCH_AND_FILTER);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    }
};

module.exports = SupplyItem;