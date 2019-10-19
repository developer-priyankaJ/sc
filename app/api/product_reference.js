/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.api.product_reference');
var Util = require('util');
var _ = require('lodash');
var PromiseBluebird = require('bluebird');
var workerFarm = require('worker-farm');
var csv = require('fast-csv');
var path = require('path');
var fs = require('fs');
var Async = require('async');
var i18n = require('i18n');
var Promise = require('bluebird');
var uuid = require('uuid');

var connection = require('../lib/connection_util');
var DataUtils = require('../lib/data_utils');
var FastCsvUtils = require('../lib/fast_csv_utils');
var Constants = require('../data/constants');
var ErrorConfig = require('../data/error');
var ProductByMpApi = require('./product_by_mp');
var ProductInventoryApi = require('./product_inventory');
var OutSharingApi = require('./out_sharing');
var CommonApi = require('./common');
var AuditUtils = require('../lib/audit_utils');
var S3Utils = require('../lib/s3_utils');
var Utils = require('../lib/utils');
var ErrorUtils = require('../lib/error_utils');

var s3 = require('../model/s3');

async function createProductReferenceMD(productReferenceOptions, errorOptions, cb) {
    if (_.isEmpty(productReferenceOptions)) {
        return cb();
    }
    var err;
    try {

        var uuid = productReferenceOptions.productRefRequiredValues[2];

        var conn = await connection.getConnection();
        var productReferenceStore = await conn.query('If (SELECT 1 FROM ProductReferences WHERE accountId=uuid_to_bin(?) AND sku=?) is null then ' +
          'INSERT into ProductReferences set id=uuid_to_bin(?), accountId=uuid_to_bin(?) ,' + productReferenceOptions.productRefFields +
          'createdAt = ?, updatedAt = ?,createdBy=uuid_to_bin(?);end if',
          productReferenceOptions.productRefRequiredValues);

        var isRoleAffected = Utils.isAffectedPool(productReferenceStore);

        if (!isRoleAffected) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_SKU_DUPLICATE);
            err.status = ErrorConfig.STATUS_CODE.CONFLICT;
            await ErrorUtils.create(errorOptions, productReferenceOptions, err);
            return cb(err);
        }

        return cb(null, {
            OK: Constants.SUCCESS_MESSAGE.PRODUCT_REFERENCE_CREATE_SUCCESS,
            id: productReferenceOptions.id,
            createdAt: productReferenceOptions.createdAt
        });

    } catch (err) {
        debug('err', err);
        err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_CREATE_FAILED);
        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
        await ErrorUtils.create(errorOptions, productReferenceOptions, err);
        return cb(err);
    }
}

async function updateProductRef(productRefOptions, errorOptions, cb) {
    if (_.isEmpty(productRefOptions)) {
        return cb();
    }

    try {
        var conn = await connection.getConnection();
        var productRef = await conn.query('IF (select 1 from ProductReferences where id=uuid_to_bin(?)) is null then ' +
          'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "PRODUCT_REFERENCE_NOT_FOUND", MYSQL_ERRNO = 4001;' +
          'ELSEIF (select 1 from ProductReferences where id=uuid_to_bin(?) and updatedAt=?) is null then ' +
          'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "PRODUCT_REFERENCE_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
          'ELSE update ProductReferences set ' + productRefOptions.productRefFields + ' updatedAt =?,updatedBy=uuid_to_bin(?) ' +
          'where id = uuid_to_bin(?);end if;', productRefOptions.productRefRequiredValues);
        productRefOptions.isAffected = Utils.isAffectedPool(productRef);

        return cb(null, productRefOptions);
    } catch (err) {
        debug('err', err);
        await ErrorUtils.create(errorOptions, productRefOptions, err);
        return cb(err);
    }
}

var ProductReference = {

    validateOptionalFields: async function (options, cb) {
        var productRefFields = '';
        var productRefOptionalValues = [];
        var err;

        try {
            if (!DataUtils.isValidateOptionalField(options.sku)) {
                if (!DataUtils.isString(options.sku)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_SKU_MUST_BE_STRING);
                } else if (options.sku.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_SKU_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    productRefFields += 'sku=? ,';
                    productRefOptionalValues.push(options.sku);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.classificationCode)) {
                if (!DataUtils.isString(options.classificationCode)) {
                    throw err = new Error(ErrorConfig.MESSAGE.CLASSIFICATION_CODE_MUST_BE_STRING);
                } else if (options.classificationCode.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_CLASSIFICATION_CODE_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    productRefFields += 'classificationCode=? ,';
                    productRefOptionalValues.push(options.classificationCode);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.classificationSystem)) {
                if (!DataUtils.isString(options.classificationSystem)) {
                    throw err = new Error(ErrorConfig.MESSAGE.CLASSIFICATION_SYSTEM_MUST_BE_STRING);
                } else if (options.classificationSystem.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_CLASSIFICATION_SYSTEM_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    productRefFields += 'classificationSystem=? ,';
                    productRefOptionalValues.push(options.classificationSystem);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.type)) {
                if (!DataUtils.isString(options.type)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_TYPE_MUST_BE_STRING);
                } else if (options.type.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_TYPE_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    productRefFields += 'type=? ,';
                    productRefOptionalValues.push(options.type);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.sellerSKUName)) {
                if (!DataUtils.isString(options.sellerSKUName)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_SELLER_SKU_NAME_MUST_BE_STRING);
                } else if (options.sellerSKUName.length > 60) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_SELLER_SKU_NAME_MUST_BE_LESS_THAN_60_CHARACTER);
                } else {
                    productRefFields += 'sellerSKUName=? ,';
                    productRefOptionalValues.push(options.sellerSKUName);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.GCID)) {
                if (!DataUtils.isString(options.GCID)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_GCID_MUST_BE_STRING);
                } else if (options.GCID.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_GCID_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    productRefFields += 'GCID=? ,';
                    productRefOptionalValues.push(options.GCID);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.UPC)) {
                if (!DataUtils.isString(options.UPC)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_UPC_MUST_BE_STRING);
                } else if (options.UPC.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_UPC_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    productRefFields += 'UPC=? ,';
                    productRefOptionalValues.push(options.UPC);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.EAN)) {
                if (!DataUtils.isString(options.EAN)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_EAN_MUST_BE_STRING);
                } else if (options.EAN.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_EAN_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    productRefFields += 'EAN=? ,';
                    productRefOptionalValues.push(options.EAN);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.ISBN)) {
                if (!DataUtils.isString(options.ISBN)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_ISBN_MUST_BE_STRING);
                } else if (options.ISBN.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_ISBN_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    productRefFields += 'ISBN=? ,';
                    productRefOptionalValues.push(options.ISBN);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.JAN)) {
                if (!DataUtils.isString(options.JAN)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_JAN_MUST_BE_STRING);
                } else if (options.JAN.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_JAN_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    productRefFields += 'JAN=? ,';
                    productRefOptionalValues.push(options.JAN);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.articleNo)) {
                if (!DataUtils.isString(options.articleNo)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_ARTICLE_NO_MUST_BE_STRING);
                } else if (options.articleNo.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_ARTICLE_NO_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    productRefFields += 'articleNo=? ,';
                    productRefOptionalValues.push(options.articleNo);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.modelNumber)) {
                if (!DataUtils.isString(options.modelNumber)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_MODEL_NUMBER_MUST_BE_STRING);
                } else if (options.modelNumber.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_MODEL_NUMBER_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    productRefFields += 'modelNumber=? ,';
                    productRefOptionalValues.push(options.modelNumber);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.countryOfManufacture)) {
                if (!DataUtils.isString(options.countryOfManufacture)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_COUNTRY_MANUFACTURE_MUST_BE_STRING);
                } else if (options.countryOfManufacture.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_COUNTRY_MANUFACTURE_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    productRefFields += 'countryOfManufacture=? ,';
                    productRefOptionalValues.push(options.countryOfManufacture);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.barcode)) {
                if (!DataUtils.isString(options.barcode)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_BARCODE_MUST_BE_STRING);
                } else if (options.barcode.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_BARCODE_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    productRefFields += 'barcode=? ,';
                    productRefOptionalValues.push(options.barcode);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.skuAlias)) {
                if (!DataUtils.isString(options.skuAlias)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_SKU_ALIAS_MUST_BE_STRING);
                } else if (options.skuAlias.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_SKU_ALIAS_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    productRefFields += 'skuAlias=? ,';
                    productRefOptionalValues.push(options.skuAlias);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.brand)) {
                if (!DataUtils.isString(options.brand)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_BRAND_MUST_BE_STRING);
                } else if (options.brand.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_BRAND_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    productRefFields += 'brand=? ,';
                    productRefOptionalValues.push(options.brand);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.harmonizedCode)) {
                if (!DataUtils.isString(options.harmonizedCode)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_HARMONINZED_CODE_MUST_BE_STRING);
                } else if (options.harmonizedCode.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_HARMONINZED_CODE_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    productRefFields += 'harmonizedCode=? ,';
                    productRefOptionalValues.push(options.harmonizedCode);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.mpProductId)) {
                if (!DataUtils.isString(options.mpProductId)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_MP_PRODUCT_ID_MUST_BE_STRING);
                } else if (options.mpProductId.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_MP_PRODUCT_ID_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    productRefFields += 'mpProductId=? ,';
                    productRefOptionalValues.push(options.mpProductId);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.weightAmount)) {
                if (!DataUtils.isNumber(options.weightAmount)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_WEIGHT_AMOUNT_MUST_BE_NUMBER);
                } else if (options.weightAmount.toString().length > 6) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_WEIGHT_AMOUNT_MUST_BE_LESS_THAN_6_DIGIT);
                } else {
                    productRefFields += 'weightAmount=? ,';
                    productRefOptionalValues.push(options.weightAmount);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.weightUoMScal)) {
                if (!DataUtils.isNumber(options.weightUoMScal)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_WEIGHT_UOM_SCAL_MUST_BE_NUMBER);
                } else if (options.weightUoMScal.toString().length > 11) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_WEIGHT_UOM_SCAL_MUST_BE_LESS_THAN_11_DIGIT);
                } else {
                    productRefFields += 'weightUoMScal=? ,';
                    productRefOptionalValues.push(options.weightUoMScal);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.heightAmount)) {
                if (!DataUtils.isNumber(options.heightAmount)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_HEIGHT_AMOUNT_MUST_BE_NUMBER);
                } else if (options.heightAmount.toString().length > 6) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_HEIGHT_AMOUNT_MUST_BE_LESS_THAN_6_DIGIT);
                } else {
                    productRefFields += 'heightAmount=? ,';
                    productRefOptionalValues.push(options.heightAmount);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.heightUoMScal)) {
                if (!DataUtils.isNumber(options.heightUoMScal)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_HEIGHT_UOM_SCAL_MUST_BE_NUMBER);
                } else if (options.heightUoMScal.toString().length > 11) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_HEIGHT_UOM_SCAL_MUST_BE_LESS_THAN_11_DIGIT);
                } else {
                    productRefFields += 'heightUoMScal=? ,';
                    productRefOptionalValues.push(options.heightUoMScal);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.lengthAmount)) {
                if (!DataUtils.isNumber(options.lengthAmount)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_LENGTH_AMOUNT_MUST_BE_NUMBER);
                } else if (options.lengthAmount.toString().length > 6) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_LENGTH_AMOUNT_MUST_BE_LESS_THAN_6_DIGIT);
                } else {
                    productRefFields += 'lengthAmount=? ,';
                    productRefOptionalValues.push(options.lengthAmount);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.lengthUoMScal)) {
                if (!DataUtils.isNumber(options.lengthUoMScal)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_LENGTH_UOM_SCAL_MUST_BE_NUMBER);
                } else if (options.lengthUoMScal.toString().length > 11) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_LENGTH_UOM_SCAL_MUST_BE_LESS_THAN_11_DIGIT);
                } else {
                    productRefFields += 'lengthUoMScal=? ,';
                    productRefOptionalValues.push(options.lengthUoMScal);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.depthAmount)) {
                if (!DataUtils.isNumber(options.depthAmount)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_DEPTH_AMOUNT_MUST_BE_NUMBER);
                } else if (options.depthAmount.toString().length > 6) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_DEPTH_AMOUNT_MUST_BE_LESS_THAN_6_DIGIT);
                } else {
                    productRefFields += 'depthAmount=? ,';
                    productRefOptionalValues.push(options.depthAmount);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.depthUoMScal)) {
                if (!DataUtils.isNumber(options.depthUoMScal)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_DEPTH_UOM_SCAL_MUST_BE_NUMBER);
                } else if (options.depthUoMScal.toString().length > 11) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_DEPTH_UOM_SCAL_MUST_BE_LESS_THAN_11_DIGIT);
                } else {
                    productRefFields += 'depthUoMScal=? ,';
                    productRefOptionalValues.push(options.depthUoMScal);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.diameterAmount)) {
                if (!DataUtils.isNumber(options.diameterAmount)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_DIAMETER_AMOUNT_MUST_BE_NUMBER);
                } else if (options.diameterAmount.toString().length > 6) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_DIAMETER_AMOUNT_MUST_BE_LESS_THAN_6_DIGIT);
                } else {
                    productRefFields += 'diameterAmount=? ,';
                    productRefOptionalValues.push(options.diameterAmount);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.diameterUoMScal)) {
                if (!DataUtils.isNumber(options.diameterUoMScal)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_DIAMETER_UOM_SCAL_MUST_BE_NUMBER);
                } else if (options.diameterUoMScal.toString().length > 11) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_DIAMETER_UOM_SCAL_MUST_BE_LESS_THAN_11_DIGIT);
                } else {
                    productRefFields += 'diameterUoMScal=? ,';
                    productRefOptionalValues.push(options.diameterUoMScal);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.volumeAmount)) {
                if (!DataUtils.isNumber(options.volumeAmount)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_VOLUME_AMOUNT_MUST_BE_NUMBER);
                } else if (options.volumeAmount.toString().length > 6) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_VOLUME_AMOUNT_MUST_BE_LESS_THAN_6_DIGIT);
                } else {
                    productRefFields += 'volumeAmount=? ,';
                    productRefOptionalValues.push(options.volumeAmount);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.volumeUoMScal)) {
                if (!DataUtils.isNumber(options.volumeUoMScal)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_VOLUME_UOM_SCAL_MUST_BE_NUMBER);
                } else if (options.volumeUoMScal.toString().length > 11) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_VOLUME_UOM_SCAL_MUST_BE_LESS_THAN_11_DIGIT);
                } else {
                    productRefFields += 'volumeUoMScal=? ,';
                    productRefOptionalValues.push(options.volumeUoMScal);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.qtyUoMId)) {
                if (!DataUtils.isNumber(options.qtyUoMId)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_QTY_UOM_ID_MUST_BE_NUMBER);
                } else if (options.qtyUoMId.toString().length > 11) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_QTY_UOM_ID_MUST_BE_LESS_THAN_11_DIGIT);
                } else {
                    productRefFields += 'qtyUoMId=? ,';
                    productRefOptionalValues.push(options.qtyUoMId);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.qtyUoMCategory)) {
                if (!DataUtils.isNumber(options.qtyUoMCategory)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_QTY_UOM_CATEGORY_MUST_BE_NUMBER);
                } else if (options.qtyUoMCategory.toString().length > 11) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_QTY_UOM_CATEGORY_MUST_BE_LESS_THAN_11_DIGIT);
                } else {
                    productRefFields += 'qtyUoMCategory=? ,';
                    productRefOptionalValues.push(options.qtyUoMCategory);
                }
            }

            if (!DataUtils.isValidateOptionalField(options.endCustomerProduct)) {
                if (!DataUtils.isNumber(options.endCustomerProduct)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_END_CUSTOMER_PRODUCT_MUST_BE_NUMBER);
                } else if (options.endCustomerProduct.toString().length > 11) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_END_CUSTOMER_PRODUCT_MUST_BE_LESS_THAN_11_DIGIT);
                } else {
                    productRefFields += 'endCustomerProduct=? ,';
                    productRefOptionalValues.push(options.endCustomerProduct);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.tags)) {
                if (!DataUtils.isString(options.tags)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_TAGS_MUST_BE_STRING);
                } else if (options.tags.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_TAGS_MUST_BE_LESS_THAN_30_CHARACTER);
                } else {
                    productRefFields += 'tags=? ,';
                    productRefOptionalValues.push(options.tags);
                }
            }

            var response = {
                productRefFields: productRefFields,
                productRefOptionalValues: productRefOptionalValues
            };
            debug('response', response);
            return cb(null, response);
        } catch (err) {
            debug('err', err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
    },

    createMD: async function (options, errorOptions, cb) {

        var createdBy = options.user.id;
        var account = options.account;
        var sku = options.sku;
        var qtyUoMId = options.qtyUoMId;
        var classificationSystem = options.classificationSystem;
        var classificationCode = options.classificationCode;
        var productRefFields = '';
        var productRefRequiredValues = [];
        var productRefOptionalValues = [];
        var createdAt = DataUtils.getEpochMSTimestamp();
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var err;

        if (DataUtils.isValidateOptionalField(sku)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_SKU_REQUIRED);
        } else if (DataUtils.isValidateOptionalField(qtyUoMId)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_QTY_UOM_ID_REQUIRED);
        } else if (DataUtils.isDefined(classificationSystem) && DataUtils.isUndefined(classificationCode)) {
            err = new Error(ErrorConfig.MESSAGE.CLASSIFICATION_CODE_REQUIRED);
        } else if (DataUtils.isDefined(classificationCode) && DataUtils.isUndefined(classificationSystem)) {
            err = new Error(ErrorConfig.MESSAGE.CLASSIFICATION_SYSTEM_REQUIRED);
        }
        if (err) {
            debug('err', err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
        var generatedId = Utils.generateId();
        productRefRequiredValues.push(account.id, sku, generatedId.uuid, account.id);

        ProductReference.validateOptionalFields(options, async function (err, response) {
            if (err) {
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            productRefFields = response.productRefFields;
            productRefOptionalValues = response.productRefOptionalValues;

            productRefRequiredValues = _.concat(productRefRequiredValues, productRefOptionalValues);
            productRefRequiredValues.push(createdAt, updatedAt, createdBy);

            var productReferenceOptions = {
                productRefRequiredValues: productRefRequiredValues,
                productRefFields: productRefFields,
                createdAt: createdAt,
                id: generatedId.uuid
            };

            createProductReferenceMD(productReferenceOptions, errorOptions, function (err, productReference) {
                if (err) {
                    debug('err', err);
                    return cb(err);
                }
                return cb(null, productReference);
            });
        });
    },

    getProductReferenceMD: async function (options, errorOptions, cb) {
        var id = options.id;
        var user = options.user;
        var languageCultureCode = user.languageCultureCode;
        var err;
        if (DataUtils.isUndefined(id)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        try {
            // GET URL OF MAIN IMAGE OF PRODUCT
            var imageOption = {
                productRefId: id,
                accountId: user.accountId
            };
            var imageResponse = await ProductReference.getMainImageUrl(imageOption);

            var conn = await connection.getConnection();
            var productReferenceStore = await conn.query('SELECT PRT.sku, PRT.sellerSKUName, PRT.type, ' +
              'PRT.classificationCode, PRT.classificationSystem, PRT.endCustomerProduct, PRT.GCID, PRT.UPC, PRT.EAN, PRT.ISBN, ' +
              'PRT.JAN, PRT.articleNo, PRT.modelNumber, PRT.countryOfManufacture, PRT.barcode,PRT.brand,PRT.harmonizedCode,PRT.mpProductId,' +
              'PRT.skuAlias, PRT.tags,PRT.weightAmount,PRT.weightUoMScal, UNT1.symbol as weightSymbol, PRT.lengthAmount,PRT.lengthUoMScal,UNT2.symbol as lengthSymbol, ' +
              'PRT.volumeAmount,PRT.volumeUoMScal, UNT3.symbol as volumeSymbol, PRT.heightAmount, PRT.heightUoMScal, UNT4.symbol as heightSymbol, ' +
              'PRT.depthAmount,PRT.depthUoMScal,UNT5.symbol as depthSymbol, PRT.diameterAmount,PRT.diameterUoMScal,UNT6.symbol as diameterSymbol, ' +
              'PRT.qtyUoMId, UNT7.symbol as qtyUoMSymbol, UCat.categoryId, UCat.name as qtyUoMCategoryName, ' +
              'PRT.updatedAt, (select count(*) from ProductInventory where productRefId = uuid_to_bin(?)) as inventoryCount,' +
              '(select GROUP_CONCAT(prodByMp.mpId SEPARATOR ", ") from ProductByMP prodByMp where ' +
              'prodByMp.productRefId =PRT.id) as mpIds, ' +
              '(select GROUP_CONCAT(mp.name SEPARATOR ", ") from Marketplaces mp, ProductByMP prodByMp where ' +
              'mp.mpId = prodByMp.mpId and prodByMp.productRefId =PRT.id) as mpNames ' +
              'FROM ProductReferences  PRT, uomNames UNT1, uomNames UNT2, uomNames UNT3, ' +
              'uomNames UNT4, uomNames UNT5, uomNames UNT6, uomNames UNT7, uomCategory UCat, uomScaling USca ' +
              'WHERE UNT1.uomScalingId = PRT.weightUoMScal AND UNT1.languageCultureCode =? ' +
              'AND UNT2.uomScalingId = PRT.lengthUoMScal AND UNT2.languageCultureCode = ? AND UNT3.uomScalingId = PRT.volumeUoMScal ' +
              'AND UNT3.languageCultureCode = ? AND UNT4.uomScalingId = PRT.heightUoMScal AND UNT4.languageCultureCode = ? ' +
              'AND UNT5.uomScalingId = PRT.depthUoMScal AND UNT5.languageCultureCode = ? AND UNT6.uomScalingId = PRT.diameterUoMScal ' +
              'AND UNT6.languageCultureCode = ? AND UNT7.uomScalingId = PRT.qtyUoMId AND UNT7.languageCultureCode = ? ' +
              'AND USca.id = PRT.qtyUoMId AND UCat.categoryId = USca.categoryId AND UCat.languageCultureCode = ? ' +
              'AND PRT.id=uuid_to_bin(?)',
              [id, languageCultureCode, languageCultureCode, languageCultureCode, languageCultureCode, languageCultureCode,
                  languageCultureCode, languageCultureCode, languageCultureCode, id]);
            productReferenceStore = Utils.filteredResponsePool(productReferenceStore);

            debug('productReferenceStore', productReferenceStore);

            if (!productReferenceStore) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            productReferenceStore.preSignedUrl = imageResponse.url;
            return cb(null, productReferenceStore);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    getProductsByAccountIdMD: async function (options, errorOptions, cb) {
        var accountId = options.accountId;
        var user = options.user;
        var languageCultureCode = user.languageCultureCode;
        if (DataUtils.isUndefined(accountId)) {
            var err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            debug('err', err);
            return cb(err);
        }
        try {
            var conn = await connection.getConnection();
            /* queryString = 'IF (select count(id) from ProductReferences where accountId = uuid_to_bin(?)) > ? THEN ' +
               ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "ROW_COUNT_EXCEED_PLEASE_USE_SEARCH_AND_FILTER", MYSQL_ERRNO = 4001; ' +
               ' ELSE SELECT CAST(uuid_from_bin(PRT.id) as CHAR) as id, PRT.sku,CAST(uuid_from_bin(PRT.createdBy) as CHAR) as createdBy, PRT.sellerSKUName, PRT.type, ' +
               ' PRT.classificationCode, CAST(uuid_from_bin(PRT.accountId) as CHAR) as accountId, PRT.classificationSystem, PRT.endCustomerProduct, PRT.GCID, PRT.UPC, PRT.EAN, PRT.ISBN, ' +
               ' PRT.JAN, PRT.articleNo, PRT.modelNumber, PRT.countryOfManufacture, PRT.barcode,PRT.brand,PRT.harmonizedCode,PRT.mpProductId, ' +
               ' PRT.skuAlias,PRT.tags,PRT.weightAmount,PRT.weightUoMScal, UNT1.symbol as weightSymbol, PRT.lengthAmount,PRT.lengthUoMScal,UNT2.symbol as lengthSymbol, ' +
               ' PRT.volumeAmount,PRT.volumeUoMScal, UNT3.symbol as volumeSymbol, PRT.heightAmount, PRT.heightUoMScal, UNT4.symbol as heightSymbol, ' +
               ' PRT.depthAmount,PRT.depthUoMScal,UNT5.symbol as depthSymbol, PRT.diameterAmount,PRT.diameterUoMScal,UNT6.symbol as diameterSymbol, ' +
               ' PRT.qtyUoMId, UNT7.symbol as qtyUoMSymbol, UCat.categoryId, UCat.name as qtyUoMCategoryName, PRT.mainImage,' +
               ' PRT.updatedAt,(select GROUP_CONCAT(mp.name SEPARATOR ", ") from Marketplaces mp, ProductByMP prodByMp ' +
               ' where mp.mpId = prodByMp.mpId and prodByMp.productRefId =PRT.id) as mpNames ' +
               ' FROM ProductReferences  PRT, uomNames UNT1, uomNames UNT2, uomNames UNT3, ' +
               ' uomNames UNT4, uomNames UNT5, uomNames UNT6,uomNames UNT7,uomCategory UCat, uomScaling USca WHERE UNT1.uomScalingId = PRT.weightUoMScal AND UNT1.languageCultureCode =? ' +
               ' AND UNT2.uomScalingId = PRT.lengthUoMScal AND UNT2.languageCultureCode = ? AND UNT3.uomScalingId = PRT.volumeUoMScal ' +
               ' AND UNT3.languageCultureCode = ? AND UNT4.uomScalingId = PRT.heightUoMScal AND UNT4.languageCultureCode = ? ' +
               ' AND UNT5.uomScalingId = PRT.depthUoMScal AND UNT5.languageCultureCode = ? AND UNT6.uomScalingId = PRT.diameterUoMScal ' +
               ' AND UNT6.languageCultureCode = ? AND UNT7.uomScalingId = PRT.qtyUoMId AND UNT7.languageCultureCode = ? ' +
               ' AND USca.id = PRT.qtyUoMId AND UCat.categoryId = USca.categoryId AND UCat.languageCultureCode = ? ' +
               ' AND PRT.accountId=uuid_to_bin(?) ; END IF;';*/

            var productReferences = await conn.query(' SELECT CAST(uuid_from_bin(PRT.id) as CHAR) as id, PRT.sku,CAST(uuid_from_bin(PRT.createdBy) as CHAR) as createdBy, PRT.sellerSKUName, PRT.type, ' +
              ' PRT.classificationCode, CAST(uuid_from_bin(PRT.accountId) as CHAR) as accountId, PRT.classificationSystem, PRT.endCustomerProduct, PRT.GCID, PRT.UPC, PRT.EAN, PRT.ISBN, ' +
              ' PRT.JAN, PRT.articleNo, PRT.modelNumber, PRT.countryOfManufacture, PRT.barcode,PRT.brand,PRT.harmonizedCode,PRT.mpProductId, ' +
              ' PRT.skuAlias,PRT.tags,PRT.weightAmount,PRT.weightUoMScal, UNT1.symbol as weightSymbol, PRT.lengthAmount,PRT.lengthUoMScal,UNT2.symbol as lengthSymbol, ' +
              ' PRT.volumeAmount,PRT.volumeUoMScal, UNT3.symbol as volumeSymbol, PRT.heightAmount, PRT.heightUoMScal, UNT4.symbol as heightSymbol, ' +
              ' PRT.depthAmount,PRT.depthUoMScal,UNT5.symbol as depthSymbol, PRT.diameterAmount,PRT.diameterUoMScal,UNT6.symbol as diameterSymbol, ' +
              ' PRT.qtyUoMId, UNT7.symbol as qtyUoMSymbol, UCat.categoryId, UCat.name as qtyUoMCategoryName, PRT.mainImage,' +
              ' PRT.updatedAt,(select GROUP_CONCAT(mp.name SEPARATOR ", ") from Marketplaces mp, ProductByMP prodByMp ' +
              ' where mp.mpId = prodByMp.mpId and prodByMp.productRefId =PRT.id) as mpNames ' +
              ' FROM ProductReferences  PRT, uomNames UNT1, uomNames UNT2, uomNames UNT3, ' +
              ' uomNames UNT4, uomNames UNT5, uomNames UNT6,uomNames UNT7,uomCategory UCat, uomScaling USca WHERE UNT1.uomScalingId = PRT.weightUoMScal AND UNT1.languageCultureCode =? ' +
              ' AND UNT2.uomScalingId = PRT.lengthUoMScal AND UNT2.languageCultureCode = ? AND UNT3.uomScalingId = PRT.volumeUoMScal ' +
              ' AND UNT3.languageCultureCode = ? AND UNT4.uomScalingId = PRT.heightUoMScal AND UNT4.languageCultureCode = ? ' +
              ' AND UNT5.uomScalingId = PRT.depthUoMScal AND UNT5.languageCultureCode = ? AND UNT6.uomScalingId = PRT.diameterUoMScal ' +
              ' AND UNT6.languageCultureCode = ? AND UNT7.uomScalingId = PRT.qtyUoMId AND UNT7.languageCultureCode = ? ' +
              ' AND USca.id = PRT.qtyUoMId AND UCat.categoryId = USca.categoryId AND UCat.languageCultureCode = ? ' +
              ' AND PRT.accountId=uuid_to_bin(?) order by PRT.updatedAt desc limit 10',
              [languageCultureCode, languageCultureCode, languageCultureCode, languageCultureCode, languageCultureCode, languageCultureCode, languageCultureCode, languageCultureCode, accountId]);
            //productReferences = Utils.filteredResponsePool(productReferences);

            return cb(null, productReferences);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    updateInventoryByProductRefId: function (options) {
        return new Promise(async function (resolve, reject) {
            var productRefId = options.productRefId;
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
                  ' update ProductInventory set qtyOnHand = 0, qtyOnHandUoM=? ,' +
                  ' qtyOnOrder = 0, qtyOnOrderUoM=?, qtyAvailable = 0, qtyAvailableUoM=?, qtyInTransit = 0, qtyInTransitUoM=? ,' +
                  ' updatedAt=? , updatedBy=uuid_to_bin(?) where  productRefId = uuid_to_bin(?) and accountId = uuid_to_bin(?) and status = 1; END IF;',
                  [qtyUoMId, qtyUoMId, qtyUoMId, qtyUoMId, qtyUoMId, updatedAt, userId, productRefId, accountId]);
                isInventoryUpdated = Utils.isAffectedPool(isInventoryUpdated);
                debug('isInventoryUpdated', isInventoryUpdated);
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                if (err.errno === 4001) {
                    err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                } else {
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                }
                return reject(err);
            }
        });
    },

    getProductInventoryByProductRefId: async function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var productRefId = options.productRefId;
            var accountId = options.accountId;
            var err;
            if (DataUtils.isUndefined(productRefId)) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_ID_REQUIRED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug('error', err);
                return cb(err);
            }
            try {
                var conn = await connection.getConnection();

                var productInventories = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id,isRealTimeFrequency ' +
                  'from ProductInventory where productRefId = uuid_to_bin(?) and accountId = uuid_to_bin(?);', [productRefId, accountId]);

                /*if (!productInventories) {
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    await ErrorUtils.create(errorOptions, options, err);
                    debug('err', err);
                    return reject(err);
                }*/
                return resolve(productInventories);
            } catch (err) {
                debug('error', err);
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                await ErrorUtils.create(errorOptions, options, err);
                return reject(err);
            }
        });
    },

    checkForRealTimeSharing: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var conditionValues = options.conditionValues;
            var conditionString = options.conditionString;
            var shareItemType = options.shareItemType;
            var itemId = options.itemId;
            var ProductInventoryApi = require('./product_inventory');
            var accountId = options.accountId;


            try {
                // Check if any outshare is exist with item or not
                var checkOutShareOptions = {
                    itemId: itemId,
                    accountId: accountId,
                    shareItemType: shareItemType,
                    conditionString: conditionString,
                    conditionValues: conditionValues
                };
                debug('checkOutShareOptions', checkOutShareOptions);
                var realTimeOutShares = await OutSharingApi.checkRealTimeOutShare(checkOutShareOptions);

                debug('realTimeOutShares', realTimeOutShares);
                if (realTimeOutShares.length > 0) {
                    var shareOptions = {
                        realTimeOutShares: realTimeOutShares,
                        shareItemId: itemId
                    };
                    var apiResponse = ProductInventoryApi.buildTask(shareOptions);
                    debug('API COMPLTETED', apiResponse);
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    updateProductInventoryQTY: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var qtyUoMId = options.qtyUoMId;
            var productRefId = options.productRefId;
            var accountId = options.accountId;
            var userId = options.userId;
            var ProductInventoryApi = require('./product_inventory');
            var conditionString, conditionValues;

            try {
                var updateProductInventoryOption = {
                    productRefId: productRefId,
                    accountId: accountId,
                    userId: userId,
                    qtyUoMId: qtyUoMId
                };
                var updateResponse = await ProductReference.updateInventoryByProductRefId(updateProductInventoryOption);
                debug('updateResponse', updateResponse);

                // If this product has any real_time sharing
                var getInventoryOption = {
                    productRefId: productRefId,
                    accountId: accountId
                };
                var productInventories = await ProductReference.getProductInventoryByProductRefId(getInventoryOption);
                debug('productInventories', productInventories);

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
                            var shareResponse = await ProductReference.checkForRealTimeSharing(sharingOption);
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


    updateMD: async function (options, auditOptions, errorOptions, cb) {
        var id = options.id;
        var updatedAt = options.updatedAt;
        var inventoryCount = options.inventoryCount;
        var qtyUoMId = options.qtyUoMId;
        var updatedBy = options.user.id;
        var accountId = options.user.accountId;
        var productRefFields = '';
        var productRefRequiredValues = [];
        var productRefOptionalValues = [];
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();
        var err;

        if (DataUtils.isUndefined(id)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_ID_REQUIRED);
        } else if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_UPDATED_AT_REQUIRED);
        } else if (updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_INVALID_UPDATED_AT);
        }
        if (err) {
            debug('err', err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
        //updatedAt = new Date(updatedAt);
        productRefRequiredValues.push(id, id, updatedAt);

        try {
            var conn = await connection.getConnection();
            await conn.query('START TRANSACTION;');
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        ProductReference.validateOptionalFields(options, async function (err, response) {
            if (err) {
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            productRefFields = response.productRefFields;
            productRefOptionalValues = response.productRefOptionalValues;

            if (productRefOptionalValues.length === 0) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_REQUEST);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug('err', err);
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            productRefRequiredValues = _.concat(productRefRequiredValues, productRefOptionalValues);
            productRefRequiredValues.push(newUpdatedAt, updatedBy, id);

            var productReferenceOptions = {
                productRefRequiredValues: productRefRequiredValues,
                productRefFields: productRefFields
            };

            updateProductRef(productReferenceOptions, errorOptions, async function (err, productReference) {
                if (err) {
                    debug('err', err);
                    await conn.query('ROLLBACK;');
                    if (err.errno === 4001) {
                        err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_NOT_FOUND);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        return cb(err);
                    } else if (err.errno === 4002) {
                        err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                        err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                        return cb(err);
                    } else {
                        err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_UPDATE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                        return cb(err);
                    }
                }
                if (!productReference.isAffected) {
                    await conn.query('ROLLBACK;');
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return cb(err);
                }
                auditOptions.metaData = {
                    productReference: {id: id}
                };

                // If product has uom or uom category in option
                if (inventoryCount > 0 && (DataUtils.isDefined(qtyUoMId) || DataUtils.isDefined(options.qtyUoMCategory))) {
                    try {
                        var updateInventoryOption = {
                            productRefId: id,
                            accountId: accountId,
                            userId: updatedBy,
                            qtyUoMId: qtyUoMId
                        };
                        var updateInventoryResponse = await ProductReference.updateProductInventoryQTY(updateInventoryOption);
                        debug('updateInventoryResponse', updateInventoryResponse);
                    } catch (err) {
                        debug('err', err);
                        await conn.query('ROLLBACK;');
                        return cb(err);
                    }
                }

                AuditUtils.create(auditOptions);
                await conn.query('COMMIT;');
                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.PRODUCT_REFERENCE_UPDATE_SUCCESS,
                    updatedAt: newUpdatedAt
                });
            });
        });
    },

    updateProductsMD: async function (options, auditOptions, errorOptions, cb) {
        var products = options.products;
        var user = options.user;
        var err;
        if (_.isEmpty(products)) {
            err = new Error(ErrorConfig.MESSAGE.INVALID_REQUEST);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        var productResponse = {};
        var productsList = [];
        var updatedProduct = [];

        Async.forEachOfSeries(products, function (product, key, cbL1) {
            var productRefFields = '';
            var productRefRequiredValues = [];
            var productRefOptionalValues = [];
            var failedProduct = false;
            var newUpdatedAt = DataUtils.getEpochMSTimestamp();

            if (DataUtils.isUndefined(product.id)) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_ID_REQUIRED);
            } else if (DataUtils.isUndefined(product.updatedAt)) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_UPDATED_AT_REQUIRED);
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                ErrorUtils.create(errorOptions, options, err);
                return cbL1(err);
            }
            //product.updatedAt = new Date(product.updatedAt);
            product.updatedBy = user.id;
            productRefRequiredValues.push(product.id, product.id, product.updatedAt);

            ProductReference.validateOptionalFields(product, async function (err, response) {
                if (err) {
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
                productRefFields = response.productRefFields;
                productRefOptionalValues = response.productRefOptionalValues;

                if (productRefOptionalValues.length === 0) {
                    err = new Error(ErrorConfig.MESSAGE.INVALID_REQUEST);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    debug('err', err);
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }

                productRefRequiredValues = _.concat(productRefRequiredValues, productRefOptionalValues);
                productRefRequiredValues.push(newUpdatedAt, product.updatedBy, product.id);

                var productReferenceOptions = {
                    productRefRequiredValues: productRefRequiredValues,
                    productRefFields: productRefFields
                };
                updateProductRef(productReferenceOptions, errorOptions, function (err, productReference) {
                    if (err) {
                        if (err.errno === 4001) {
                            failedProduct = true;
                            productResponse.message = ErrorConfig.MESSAGE.PRODUCT_REFERENCE_NOT_FOUND;
                            productResponse.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                            productsList.push({id: product.id});
                            return cbL1(null, productResponse);
                        } else if (err.errno === 4002) {
                            failedProduct = true;
                            productResponse.message = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                            productResponse.status = ErrorConfig.STATUS_CODE.CONFLICT;
                            productsList.push({id: product.id});
                            return cbL1(null, productResponse);
                        } else {
                            failedProduct = true;
                            productResponse.message = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_UPDATE_FAILED);
                            productResponse.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                            productsList.push({id: product.id});
                            return cbL1(null, productResponse);
                        }
                    }
                    if (!productReference.isAffected) {
                        productResponse.message = ErrorConfig.MESSAGE.PRODUCT_REFERENCE_UPDATE_FAILED;
                        productResponse.status = ErrorConfig.STATUS_CODE.CONFLICT;
                        productsList.push({id: product.id});
                        productResponse.failedProducts = productsList;
                        return cbL1(null, productResponse);
                    }
                    productResponse.message = ErrorConfig.MESSAGE.PRODUCT_REFERENCE_UPDATED_SUCCESSFULLY;
                    productResponse.status = ErrorConfig.STATUS_CODE.SUCCESS;
                    updatedProduct.push({id: product.id});
                    productResponse.successProducts = updatedProduct;
                    return cbL1(null, productResponse);
                });
            });
        }, function (err) {
            if (err) {
                return cb(err);
            }
            if (productsList.length !== 0) {
                productResponse.message = ErrorConfig.MESSAGE.PRODUCT_REFERENCE_UPDATE_FAILED;
                productResponse.status = ErrorConfig.STATUS_CODE.CONFLICT;
                productResponse.failedProducts = productsList;
                return cb(null, productResponse);
            }

            return cb(null, productResponse);
        });
    },

    addProductReferencesMD: async function (options, errorOptions, auditOptions, cb) {
        var mpId = options.mpId;
        var userId = options.user.id;
        var products = options.products;
        var account = options.account;
        var responseProductMessage = {};
        var duplicateProducts = [];
        var successProducts = [];
        var productReferenceList = [];
        var productByMPList = [];
        var createdAt = DataUtils.getEpochMSTimestamp();
        var updatedAt = DataUtils.getEpochMSTimestamp();

        var err;
        if (DataUtils.isUndefined(mpId)) {
            err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_ID_REQUIRED);
        }
        if (!DataUtils.isArray(products)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCTS_REQ);
        }

        if (err) {
            debug('err', err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        auditOptions.userId = userId;

        await Promise.each(products, async function (product) {
            if (DataUtils.isValidateOptionalField(product.sku)) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_SKU_REQUIRED);
            } else if (DataUtils.isValidateOptionalField(product.mpProductId)) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_MP_PRODUCT_ID_REQUIRED);
            } else if (DataUtils.isValidateOptionalField(product.packageQuantity)) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_QUANTITY_REQUIRED);
            } else if (DataUtils.isValidateOptionalField(product.averageRetailPrice)) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_PRICE_REQUIRED);
            }
            if (!DataUtils.isValidateOptionalField(product.packageQuantity)) {
                if (!DataUtils.isNumber(product.packageQuantity)) {
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_PACKAGE_QUANTITY_MUST_BE_NUMBER);
                } else if (product.packageQuantity.toString().length > 11) {
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_PACKAGE_QUANTITY_MUST_BE_LESS_THAN_11_DIGIT);
                }
            }

            if (!DataUtils.isValidateOptionalField(product.averageRetailPrice)) {
                if (!DataUtils.isNumber(product.averageRetailPrice)) {
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_AVERAGE_RETAIL_PRICE_MUST_BE_NUMBER);
                } else if (product.averageRetailPrice.toString().length > 11) {
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_AVERAGE_RETAIL_PRICE_MUST_BE_LESS_THAN_11_DIGIT);
                }

            }
            if (err) {
                debug('err', err);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }

            //Get product reference record
            try {
                var conn = await connection.getConnection();
                var productRefResponse = await conn.query('SELECT uuid_from_bin(id) as id from ProductReferences where accountId=uuid_to_bin(?) and sku=?',
                  [product.accountId, product.sku]);
                productRefResponse = Utils.filteredResponsePool(productRefResponse);

            } catch (err) {
                debug('err', err);
                return cb(err);
            }

            if (productRefResponse) {

                try {
                    var conn = await connection.getConnection();
                    var productByMPResponse = await conn.query('SELECT uuid_from_bin(id) as id from ProductByMP where productRefId=uuid_to_bin(?) and mpId=?',
                      [productRefResponse.id, mpId]);
                    productByMPResponse = Utils.filteredResponsePool(productByMPResponse);

                } catch (err) {
                    debug('err', err);
                    return cb(err);
                }
                // If product ref exist then get product by mp record

                //if product by mp record exist then send duplicate
                if (productByMPResponse) {
                    duplicateProducts.push(product.sku);
                    responseProductMessage.message = ErrorConfig.MESSAGE.PRODUCTS_ALREADY_EXIST;
                    responseProductMessage.duplicateProducts = duplicateProducts;
                    responseProductMessage.status = ErrorConfig.STATUS_CODE.CONFLICT;
                } else {
                    //if record not exist then generate value to create records
                    var generatedId = Utils.generateId();
                    productByMPList.push({
                        id: generatedId.uuid,
                        accountId: account.id,
                        mpProductId: product.mpProductId,
                        sku: product.sku,
                        createdBy: userId,
                        mpId: mpId,
                        productRefId: productRefResponse.id,
                        averageRetailPrice: product.averageRetailPrice,
                        packageQuantity: product.packageQuantity
                    });
                }
            } else {
                // if product ref not found then product by mp will also not exist , so generate value to create records
                var generatedId = Utils.generateId();
                var productRefId = generatedId.uuid;
                productReferenceList.push({
                    id: generatedId.uuid,
                    accountId: account.id,
                    mpProductId: product.mpProductId,
                    sku: product.sku,
                    qtyUoMId: Constants.AMAZON_DEFAULT_QTY_UOM_ID.QTY_UOM_ID,
                    createdBy: userId,
                    createdAt: createdAt,
                    updatedAt: updatedAt
                });

                generatedId = Utils.generateId();
                productByMPList.push({
                    id: generatedId.uuid,
                    accountId: account.id,
                    mpProductId: product.mpProductId,
                    sku: product.sku,
                    createdBy: userId,
                    mpId: mpId,
                    productRefId: productRefId,
                    averageRetailPrice: product.averageRetailPrice,
                    packageQuantity: product.packageQuantity
                });
            }
        });

        if (_.isEmpty(productByMPList) && !_.isEmpty(responseProductMessage)) {
            return cb(null, responseProductMessage);
        }

        if (!_.isEmpty(productReferenceList)) {
            var tempValue = [];
            productReferenceList.forEach(function (value) {
                tempValue = tempValue.concat(Object.values(value));
            });

            try {
                var query = 'INSERT into ProductReferences (id,accountId,mpProductId,sku,' +
                  'qtyUoMId,createdBy,createdAt,updatedAt) values';

                var values = ' (uuid_to_bin(?), uuid_to_bin(?),?, ?, ?, uuid_to_bin(?), ?, ?) ';
                productReferenceList.forEach(function (value) {
                    query = query + values;
                    query = query + ',';
                });
                query = query.replace(/,\s*$/, '');
                var conn = await connection.getConnection();
                var productRef = await conn.query(query, tempValue);

                try {
                    options = {
                        productByMPList: productByMPList,
                        responseProductMessage: responseProductMessage,
                        successProducts: successProducts
                    };
                    ProductByMpApi.insertBulkRecords(options, errorOptions, function (err, response) {

                        if (err) {
                            return cb(err);
                        }
                        return cb(null, response);
                    });
                } catch (err) {
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_CREATED_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    await ErrorUtils.create(errorOptions, productByMPList, err);
                    debug('error11', err);
                    return cb(err);
                }
            } catch (err) {
                debug('error12', err);
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_CREATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                await ErrorUtils.create(errorOptions, productReferenceList, err);
                return cb(err);
            }
        } else if (!_.isEmpty(productByMPList)) {
            try {
                options = {
                    productByMPList: productByMPList,
                    responseProductMessage: responseProductMessage,
                    successProducts: successProducts
                };
                ProductByMpApi.insertBulkRecords(options, errorOptions, function (err, response) {

                    if (err) {
                        return cb(err);
                    }
                    return cb(null, response);
                });
            } catch (err) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_CREATED_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                await ErrorUtils.create(errorOptions, productByMPList, err);
                debug('error11', err);
                return cb(err);
            }
        } else {
            return cb();
        }
    },

    buildUpdateProductImageQuery: async function (options, cb) {
        var files = options.files;
        var productRefId = options.productRefId;
        var string = 'update ProductImages set ';
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

            string += ' and productRefId=uuid_to_bin(?);';
            values.push(productRefId);

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

    checkFileStatusMD: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var err;
            var files = options.files;
            var productRefId = options.productRefId;
            var updatedAt = options.updatedAt;
            var mainImage = options.mainImage;
            var mainImages = [];
            var thumbnail = 'thumbnail_';
            var thumbnailImage, originalImage;
            var count = 0;

            var imageCount = await ProductReference.checkAvailableImage({productRefId: productRefId});

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
                        err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_UPDATED_AT_REQUIRED);
                    } else if (!DataUtils.isValidNumber(updatedAt) || updatedAt.toString().length > 13) {
                        err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_INVALID_UPDATED_AT);
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

    getDeleteFiles: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var files = options.files;
            var updateFiles = [], deleteFiles = [];

            try {
                _.map(files, function (file) {
                    if (file.status === 1) {
                        updateFiles.push(file);
                    }
                });
                _.map(files, function (file) {
                    if (file.status === 2) {
                        deleteFiles.push(file);
                    }
                });
                var response = {
                    updateFiles: updateFiles,
                    deleteFiles: deleteFiles
                };
                return resolve(response);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    updateImageLogsMD: async function (options, errorOptions, auditOptions, cb) {
        var user = options.user;
        var accountId = user.accountId;
        var productRefId = options.productRefId;
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
            var isValid = await ProductReference.checkFileStatusMD({
                files: files,
                productRefId: productRefId,
                mainImage: mainImage,
                updatedAt: updatedAt
            });

            var productReference = await ProductReference.getProductById({
                productRefId: productRefId,
                accountId: accountId
            });

            var fileResponse = await ProductReference.getDeleteFiles({
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
                    productRefId: productRefId
                };
                var deleteResponse = await ProductReference.deleteProductImageRecordMD(deleteOption);
            }
            if (updateFiles.length >= 1) {
                var updateOption = {
                    files: updateFiles,
                    productRefId: productRefId
                };
                ProductReference.buildUpdateProductImageQuery(updateOption, async function (err, response) {
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
                            err = new Error(ErrorConfig.MESSAGE.PRODUCT_IMAGES_NOT_UPDATE);
                            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                            await ErrorUtils.create(errorOptions, options, err);
                            return cb(err);
                        }

                        // UPDATE PRODUCT BY MAIN IMAGE BASE64 STRING
                        try {
                            if (mainImage) {
                                var updateOption = {
                                    productRefId: productRefId,
                                    mainImage: mainImage,
                                    userId: user.id,
                                    updatedAt: updatedAt
                                };
                                var updateResponse = await ProductReference.updateProductByImage(updateOption);
                                await conn.query('COMMIT;');
                                return cb(null, {
                                    OK: Constants.SUCCESS_MESSAGE.PRODUCT_IMAGE_LOG_UPDATE_SUCCESS,
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
                            OK: Constants.SUCCESS_MESSAGE.PRODUCT_IMAGE_LOG_UPDATE_SUCCESS
                        });
                    } catch (err) {
                        debug('err ', err);
                        await conn.query('ROLLBACK;');
                        err = new Error(ErrorConfig.MESSAGE.PRODUCT_IMAGE_UPDATE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                        await ErrorUtils.create(errorOptions, options, err);
                        return cb(err);
                    }
                });
            } else {
                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.PRODUCT_IMAGE_LOG_UPDATE_SUCCESS
                });
            }
        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK;');
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    getImageQueryMD: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var files = options.files;
            var productRefId = options.productRefId;
            var query = 'select fileName from ProductImages where (';
            var condition = ' fileName like ? or fileName like ? or ';
            var values = [], original, thumbnail;

            _.each(files, function (file) {
                original = file.toString().substring(0, file.toString().lastIndexOf('.')) + '.%';
                thumbnail = 'thumbnail_' + file.toString().substring(0, file.toString().lastIndexOf('.')) + '.%';
                query += condition;
                values.push(original, thumbnail);
            });
            query = query.replace(/or\s*$/, ')');
            query += ' and productRefId=uuid_to_bin(?)';
            values.push(productRefId);
            return resolve({
                query: query,
                values: values
            });
        });
    },

    deleteImageFileOnS3: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var accountId = options.accountId;
            var fileNames = options.fileNames;
            var bucket = Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET;
            var key = accountId + '/' + Constants.S3_FOLDER.PRODUCT_IMAGES;
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
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_IMAGE_DELETE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
                return resolve(response);
            });
        });
    },

    manipulateQuery: function (options) {
        return new Promise(function (resolve, reject) {
            var productRefId = options.productRefId;
            var deleteFiles = options.deleteFiles;
            var string = '', values = [];

            _.map(deleteFiles, function (file) {
                string += '?,';
                values.push(file);
            });
            string = string.replace(/,\s*$/, ' ');
            values.push(productRefId);
            return resolve({
                string: string,
                values: values
            });

        });
    },

    deleteProductImageRecordMD: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var fileNames = options.fileNames;
            var productRefId = options.productRefId;
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
                var response = await ProductReference.manipulateQuery({
                    deleteFiles: deleteFiles,
                    productRefId: productRefId
                });
                var isDeleted = await conn.query('delete from ProductImages where fileName in (' + response.string + ') and productRefId=uuid_to_bin(?)', response.values);
                isDeleted = Utils.isAffectedPool(isDeleted);

                debug('isDeleted', isDeleted);

                if (!isDeleted) {
                    debug('err', err);
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_IMAGE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_IMAGE_DELETE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    getTotalImages: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var productRefId = options.productRefId;
            var accountId = options.accountId;
            var err;
            try {
                var conn = await connection.getConnection();
                var imagesLength = await conn.query('select count(*) as length from ProductImages where accountId=uuid_to_bin(?) ' +
                  'and productRefId=uuid_to_bin(?) and status = 1;', [accountId, productRefId]);
                imagesLength = Utils.filteredResponsePool(imagesLength);
                if (!imagesLength) {
                    debug('err', err);
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_IMAGE_NOT_FOUND);
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

    deleteProductImageLogsMD: async function (options, errorOptions, auditOptions, cb) {
        var user = options.user;
        var accountId = user.accountId;
        var productRefId = options.productRefId;
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
            //debug('length', files.length > 10);
            if (DataUtils.isUndefined(files) || (DataUtils.isArray(files) && files.length <= 0)) {
                err = new Error(ErrorConfig.MESSAGE.FILES_REQUIRED);
            } else if (files.length > 10) {
                err = new Error(ErrorConfig.MESSAGE.FILE_MUST_BE_LESS_THAN_10);
            } else if (DataUtils.isUndefined(productRefId)) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_ID_REQUIRED);
            } else if (isMain) {
                if (DataUtils.isUndefined(updatedAt)) {
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_UPDATED_AT_REQUIRED);
                } else if (!DataUtils.isValidNumber(updatedAt) || updatedAt.toString().length > 13) {
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_INVALID_UPDATED_AT);
                }
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug('err', err);
                return cb(err);
            }


            // Check if product reference is exist or not
            var productReference = await ProductReference.getProductById({
                productRefId: productRefId,
                accountId: accountId
            });

            // get original and thumbnail images from fileName
            var getOption = {
                files: files,
                productRefId: productRefId
            };
            var queryResponse = await ProductReference.getImageQueryMD(getOption);
            query = queryResponse.query;
            values = queryResponse.values;

            debug('query', query);
            var fileNames = await conn.query(query, values);
            debug('fileNames', fileNames);
            //fileNames = Utils.filteredResponsePool(fileNames);
            if (!fileNames || fileNames.length <= 0) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_IMAGES_NOT_FOUND);
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
                        productRefId: productRefId,
                        accountId: accountId
                    };
                    var lengthResponse = await ProductReference.getTotalImages(lengthOption);

                    if ((lengthResponse.length) / 2 !== files.length) {
                        err = new Error(ErrorConfig.MESSAGE.CAN_NOT_DELETE_MAIN_IMAGE);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        await ErrorUtils.create(errorOptions, options, err);
                        debug('err ', err);
                        throw err;
                    }

                    // UPDATE PRODUCT RECORD BY REMOVING VALUE FROM MAIN IMAGE FIELD
                    var updateOption = {
                        productRefId: productRefId,
                        mainImage: Constants.DEFAULT_MAIN_IMAGE,
                        userId: user.id,
                        updatedAt: updatedAt
                    };
                    var updateResponse = await ProductReference.updateProductByImage(updateOption);
                }

                // DELETE IMAGE RECORD FROM DB AND FILE FROM S3
                var deleteOption = {
                    fileNames: fileNames,
                    productRefId: productRefId,
                    accountId: accountId
                };
                var deleteResponse = await ProductReference.deleteImageRecordAndFile(deleteOption);
                await conn.query('COMMIT;');
                AuditUtils.create(auditOptions);
                if (isMain) {
                    return cb(null, {
                        OK: Constants.SUCCESS_MESSAGE.PRODUCT_IMAGE_DELETE_SUCCESS,
                        updatedAt: updateResponse.updatedAt
                    });
                }
                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.PRODUCT_IMAGE_DELETE_SUCCESS
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

    deleteImageRecordAndFile: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var accountId = options.accountId;
            var fileNames = options.fileNames;
            var productRefId = options.productRefId;
            var err;
            try {
                //Delete record from ProductImages table
                var deleteRecordOption = {
                    fileNames: fileNames,
                    productRefId: productRefId
                };
                var deleteRecordResponse = await ProductReference.deleteProductImageRecordMD(deleteRecordOption);
                if (!deleteRecordResponse) {
                    debug('err ', err);
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_IMAGE_DELETE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }

                // Delete image files on amazon
                var deleteOption = {
                    accountId: accountId,
                    fileNames: fileNames
                };
                var deleteImageResponse = await ProductReference.deleteImageFileOnS3(deleteOption);
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    updateProductByImage: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var mainImage = options.mainImage;
            var productRefId = options.productRefId;
            var updatedAt = options.updatedAt;
            var newUpdatedAt = DataUtils.getEpochMSTimestamp();
            var userId = options.userId, err;
            try {
                var conn = await connection.getConnection();
                var isUpdated = await conn.query('IF (select 1 from ProductReferences where id=uuid_to_bin(?)) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "PRODUCT_REFERENCE_NOT_FOUND", MYSQL_ERRNO = 4001;' +
                  'ELSEIF (select 1 from ProductReferences where id=uuid_to_bin(?) and updatedAt=?) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "PRODUCT_REFERENCE_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
                  'ELSE update ProductReferences set mainImage=?, updatedAt =?,updatedBy=uuid_to_bin(?) ' +
                  'where id = uuid_to_bin(?);end if;', [productRefId, productRefId, updatedAt, mainImage, newUpdatedAt, userId, productRefId]);
                isUpdated = Utils.isAffectedPool(isUpdated);
                if (!isUpdated) {
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_UPDATE_FAILED);
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
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                } else if (err.errno === 4002) {
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    return reject(err);
                } else {
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }

            }
        });
    },

    setMainProductImageMD: async function (options, errorOptions, auditOptions, cb) {
        var user = options.user;
        var accountId = user.accountId;
        var productRefId = options.productRefId;
        var mainImage = options.mainImage;
        var productUpdatedAt = options.updatedAt;
        var fileName = options.fileName, err;
        var updatedAt = DataUtils.getEpochMSTimestamp();

        if (DataUtils.isUndefined(productRefId)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_ID_REQUIRED);
        } else if (DataUtils.isUndefined(fileName)) {
            err = new Error(ErrorConfig.MESSAGE.FILE_NAME_REQUIRED);
        } else if (DataUtils.isUndefined(productUpdatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(productUpdatedAt) || productUpdatedAt.toString().length > 13) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_INVALID_UPDATED_AT);
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
            var isUpdatedMain = await conn.query('update ProductImages set isMain=? , updatedAt=? where productRefId=uuid_to_bin(?) and isMain=?',
              [false, updatedAt, productRefId, true]);
            debug('isUpdatedMain', isUpdatedMain);
            isUpdatedMain = Utils.isAffectedPool(isUpdatedMain);
            debug('isUpdatedMain', isUpdatedMain);
            /*if (!isUpdatedMain) {
                await conn.query('ROLLBACK;');
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_IMAGE_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }*/

            var tempFileName = fileName.toString().substring(0, fileName.toString().lastIndexOf('.'));
            debug('tempFileName', tempFileName);
            // update isMain image to true
            var isUpdated = await conn.query('IF (select 1 from ProductImages where productRefId=uuid_to_bin(?) and fileName=? ) is null then ' +
              'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "PRODUCT_IMAGE_NOT_FOUND", MYSQL_ERRNO = 4001; ' +
              'ELSE update ProductImages set isMain=? , updatedAt=? where productRefId=uuid_to_bin(?) and (fileName like ? or fileName like ?); END IF;',
              [productRefId, fileName, true, updatedAt, productRefId, tempFileName + '.%', 'thumbnail_' + tempFileName + '.%']);
            isUpdated = Utils.isAffectedPool(isUpdated);
            if (!isUpdated) {
                throw err;
            }
        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK;');
            await ErrorUtils.create(errorOptions, options, err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_IMAGE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            } else {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_IMAGE_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
        }
        // Update product reference
        try {
            var updateOption = {
                productRefId: productRefId,
                mainImage: mainImage,
                userId: user.id,
                updatedAt: productUpdatedAt
            };
            var updateResponse = await ProductReference.updateProductByImage(updateOption);
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

    getSignedUrlMD: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var accountId = options.accountId;
            var fileName = options.fileName;
            var opt = {
                Bucket: Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET,
                Key: accountId + '/' + Constants.S3_FOLDER.PRODUCT_IMAGES + '/' + fileName,
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

    getImageLogsMD: async function (options, errorOptions, cb) {
        var user = options.user;
        var accountId = user.accountId;
        var productRefId = options.productRefId;
        var allImageLogs = [];
        var thumbnail = 'thumbnail_';
        var thumbnailImages = [];
        var originalImages = [];
        var response = [], flag = false, option;
        var err;

        if (DataUtils.isUndefined(productRefId)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var productResponse = await conn.query('select updatedAt from ProductReferences where accountId=uuid_to_bin(?) and id=uuid_to_bin(?)', [accountId, productRefId]);
            productResponse = Utils.filteredResponsePool(productResponse);
            if (!productResponse) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }

            var imageLogs = await conn.query('select fileName,status,isMain from ProductImages where accountId=uuid_to_bin(?) ' +
              ' and productRefId=uuid_to_bin(?) and (status = 1 OR status = 3);', [accountId, productRefId]);

            if (!imageLogs) {
                return cb(null, {
                    updatedAt: productResponse.updatedAt,
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
                    if (image.fileName.indexOf(thumbnail) === 0) {
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
                        var url = await ProductReference.getSignedUrlMD({
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
                    var url = await ProductReference.getSignedUrlMD({
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
                updatedAt: productResponse.updatedAt,
                files: response
            });
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_IMAGES_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    checkFieldsMD: function (options, cb) {
        var files = options.files;
        var productRefId = options.productRefId;
        var err;

        if (DataUtils.isUndefined(files) || (DataUtils.isArray(files) && files.length <= 0)) {
            err = new Error(ErrorConfig.MESSAGE.FILES_REQUIRED);
        } else if (files.length > 20) {
            err = new Error(ErrorConfig.MESSAGE.FILE_MUST_BE_LESS_THAN_10);
        } else if (DataUtils.isUndefined(productRefId)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_ID_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
        return cb(null, Constants.OK_MESSAGE);
    },

    deleteImageRecordMD: async function (options, cb) {
        var productRefId = options.productRefId;
        var accountId = options.accountId;
        var userId = options.userId, err;
        var miliSeconds = Constants.MILISECONDS_OF_DAY;


        try {
            var conn = await connection.getConnection();
            var isDeleted = await conn.query('DELETE FROM ProductImages WHERE productRefId = uuid_to_bin(?) AND status=3 ' +
              ' AND accountId = uuid_to_bin(?) and createdAt < ((UNIX_TIMESTAMP() * 1000) - ? ) ;', [productRefId, accountId, miliSeconds]);
            isDeleted = Utils.isAffectedPool(isDeleted);
            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

    },

    checkTotalImagesMD: async function (options, cb) {
        var productRefId = options.productRefId;
        var files = options.files;
        var accountId = options.accountId;
        var filesLength = files.length;
        var updatedAt = options.updatedAt;
        var userId = options.userId;
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();
        var err;

        if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(updatedAt) || updatedAt.toString().length > 13) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_INVALID_UPDATED_AT);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('err', err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var totalCount = await conn.query('select count(*) as length from ProductImages where productRefId=uuid_to_bin(?) ' +
              'and accountId=uuid_to_bin(?) and status=1 ; ', [productRefId, accountId]);
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
            var isUpdated = await conn.query('IF (select 1 from ProductReferences where id=uuid_to_bin(?)) is null then ' +
              'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "PRODUCT_REFERENCE_NOT_FOUND", MYSQL_ERRNO = 4001;' +
              'ELSEIF (select 1 from ProductReferences where id=uuid_to_bin(?) and updatedAt=?) is null then ' +
              'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "PRODUCT_REFERENCE_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
              'ELSE update ProductReferences set updatedAt =?,updatedBy=uuid_to_bin(?) ' +
              'where id = uuid_to_bin(?);end if;', [productRefId, productRefId, updatedAt, newUpdatedAt, userId, productRefId]);
            isUpdated = Utils.isAffectedPool(isUpdated);
            if (!isUpdated) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_UPDATE_FAILED);
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
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            } else if (err.errno === 4002) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                return cb(err);
            } else {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
        }
    },

    checkAvailableImage: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var productRefId = options.productRefId, err;
            try {
                var conn = await connection.getConnection();
                var imageCount = await conn.query('select count(*) as totalCount from ProductImages where productRefId=uuid_to_bin(?) and isMain=?', [productRefId, true]);
                imageCount = Utils.filteredResponsePool(imageCount);
                debug('imageCount', imageCount);
                if (DataUtils.isUndefined(imageCount)) {
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_IMAGES_GET_FAILED);
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

    checkFileNamesMD: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var files = options.files;
            var err;

            _.map(files, function (file) {
                if (DataUtils.isUndefined(file.fileName)) {
                    err = new Error(ErrorConfig.MESSAGE.FILE_NAME_REQUIRED);
                } else if (DataUtils.isUndefined(file.type)) {
                    err = new Error(ErrorConfig.MESSAGE.FILE_TYPE_REQUIRED);
                } else if (DataUtils.isUndefined(file.size)) {
                    err = new Error(ErrorConfig.MESSAGE.FILE_SIZE_REQUIRED);
                }

                if (err) {
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }
            });
            return resolve(Constants.OK_MESSAGE);
        });
    },

    getMainImageUrl: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var accountId = options.accountId;
            var productRefId = options.productRefId;
            var thumbnail = '%thumbnail_%';
            var imageResponse, err;
            try {
                var conn = await connection.getConnection();

                imageResponse = await conn.query('select fileName from ProductImages  where productRefId=uuid_to_bin(?) and isMain=1 and fileName like ?', [productRefId, thumbnail]);
                imageResponse = Utils.filteredResponsePool(imageResponse);
                if (!imageResponse) {
                    return resolve({url: ''});
                    /* err = new Error(ErrorConfig.MESSAGE.PRODUCT_IMAGES_NOT_FOUND);
                     err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                     return reject(err);*/
                }
                var url = await ProductReference.getSignedUrlMD({
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

    createImagePreSignedUrlMD: async function (options, errorOptions, auditOptions, cb) {
        var user = options.user;
        var accountId = user.accountId;
        var files = options.files;
        var productRefId = options.productRefId;
        var createdAt = DataUtils.getEpochMSTimestamp();
        var updatedAt = options.updatedAt;
        var signatureArray = [];
        var thumbnail = 'thumbnail_';
        var imageLogArray = [], err;

        try {
            var checkOption = {
                files: files,
                productRefId: productRefId

            };
            var checkResponse = await ProductReference.checkFileNamesMD(checkOption);

            var productReference = await ProductReference.getProductById({
                productRefId: productRefId,
                accountId: accountId
            });

            await PromiseBluebird.each(files, function (file) {
                /*if (file.fileName.toString().indexOf(thumbnail) !== -1) {
                    file.fileName = [file.fileName.slice(0, thumbnail.length), createdAt + '_', file.fileName.slice(thumbnail.length)].join('');
                } else {
                    file.fileName = createdAt + '_' + file.fileName;
                }*/

                var opt = {
                    Bucket: Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET,
                    Key: accountId + '/' + Constants.S3_FOLDER.PRODUCT_IMAGES + '/' + file.fileName,
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
                        productRefId: productRefId,
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
            var isImageLogInerted = await ProductReference.insertImageLogMD({imageLogArray: imageLogArray});
            if (!isImageLogInerted) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_IMAGE_LOG_CREATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }

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

    getProductById: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var productRefId = options.productRefId;
            var accountId = options.accountId;
            var err;

            try {
                var conn = await connection.getConnection();

                var productReference = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id from ProductReferences where id=uuid_to_bin(?) ' +
                  'and accountId=uuid_to_bin(?)', [productRefId, accountId]);
                productReference = Utils.filteredResponsePool(productReference);
                if (!productReference) {
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    throw err;
                }
                return resolve(productReference);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    getOriginalImageMD: async function (options, errorOptions, cb) {
        var user = options.user;
        var accountId = user.accountId;
        var fileName = options.fileName;
        var productRefId = options.productRefId;
        var err;

        if (DataUtils.isUndefined(productRefId)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_ID_REQUIRED);
        } else if (DataUtils.isUndefined(fileName)) {
            err = new Error(ErrorConfig.MESSAGE.FILE_NAME_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var productReference = await ProductReference.getProductById({
                productRefId: productRefId,
                accountId: accountId
            });

            var url = await ProductReference.getSignedUrlMD({
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

                var query = 'insert into ProductImages (' + keys + ') values';
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
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_IMAGE_LOG_CREATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
            });
        });
    },

    getProductReferenceByUOM: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var accountId = options.accountId;
            var qtyUoMId = options.qtyUoMId;

            try {
                var conn = await connection.getConnection();
                var productReferences = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id from ProductReferences ' +
                  'where qtyUoMId = ? and accountId = uuid_to_bin(?)', [qtyUoMId, accountId]);
                return resolve(productReferences);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    searchProductReference: async function (options, errorOptions, cb) {
        var user = options.user;
        var accountId = user.accountId;
        var languageCultureCode = user.languageCultureCode;
        var sku = options.sku;
        var sellerSKUName = options.sellerSKUName;
        var type = options.type;
        var mpProductId = options.mpProductId;
        var UPC = options.UPC;
        var brand = options.brand;
        var checkString = '', queryString = '';
        var checkValues = [];
        var queryValues = [languageCultureCode, languageCultureCode, languageCultureCode, languageCultureCode, languageCultureCode,
            languageCultureCode, languageCultureCode, languageCultureCode, accountId];
        var err;

        if (DataUtils.isUndefined(sku) && DataUtils.isUndefined(sellerSKUName) && DataUtils.isUndefined(type) &&
          DataUtils.isUndefined(mpProductId) && DataUtils.isUndefined(UPC) && DataUtils.isUndefined(brand)) {
            err = new Error(ErrorConfig.MESSAGE.AT_LEASE_ONE_SEARCH_ATTRIBUTE_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }


        try {
            if (DataUtils.isDefined(sku)) {
                checkString += ' sku like ? and ';
                checkValues.push('%' + sku + '%');
            }
            if (DataUtils.isDefined(sellerSKUName)) {
                checkString += ' sellerSKUName like ?  and ';
                checkValues.push('%' + sellerSKUName + '%');
            }
            if (DataUtils.isDefined(type)) {
                checkString += ' type like ? and ';
                checkValues.push('%' + type + '%');
            }
            if (DataUtils.isDefined(mpProductId)) {
                checkString += ' mpProductId like ? and ';
                checkValues.push('%' + mpProductId + '%');
            }
            if (DataUtils.isDefined(UPC)) {
                checkString += ' UPC like ? and ';
                checkValues.push('%' + UPC + '%');
            }
            if (DataUtils.isDefined(brand)) {
                checkString += ' brand like ? and ';
                checkValues.push('%' + brand + '%');
            }
            checkString = checkString.replace(/and\s*$/, '');
            debug('checkString', checkString);
            debug('checkValues', checkValues);

            var conn = await connection.getConnection();

            queryString = 'IF (select count(id) from ProductReferences where accountId = uuid_to_bin(?) and ' + checkString + ') > ? THEN ' +
              ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "ROW_COUNT_EXCEED_PLEASE_USE_SEARCH_AND_FILTER", MYSQL_ERRNO = 4001; ' +
              ' ELSE SELECT CAST(uuid_from_bin(PRT.id) as CHAR) as id, PRT.sku,CAST(uuid_from_bin(PRT.createdBy) as CHAR) as createdBy, PRT.sellerSKUName, PRT.type, ' +
              ' PRT.classificationCode, CAST(uuid_from_bin(PRT.accountId) as CHAR) as accountId, PRT.classificationSystem, PRT.endCustomerProduct, PRT.GCID, PRT.UPC, PRT.EAN, PRT.ISBN, ' +
              ' PRT.JAN, PRT.articleNo, PRT.modelNumber, PRT.countryOfManufacture, PRT.barcode,PRT.brand,PRT.harmonizedCode,PRT.mpProductId, ' +
              ' PRT.skuAlias,PRT.tags,PRT.weightAmount,PRT.weightUoMScal, UNT1.symbol as weightSymbol, PRT.lengthAmount,PRT.lengthUoMScal,UNT2.symbol as lengthSymbol, ' +
              ' PRT.volumeAmount,PRT.volumeUoMScal, UNT3.symbol as volumeSymbol, PRT.heightAmount, PRT.heightUoMScal, UNT4.symbol as heightSymbol, ' +
              ' PRT.depthAmount,PRT.depthUoMScal,UNT5.symbol as depthSymbol, PRT.diameterAmount,PRT.diameterUoMScal,UNT6.symbol as diameterSymbol, ' +
              ' PRT.qtyUoMId, UNT7.symbol as qtyUoMSymbol, UCat.categoryId, UCat.name as qtyUoMCategoryName, PRT.mainImage,' +
              ' PRT.updatedAt,(select GROUP_CONCAT(mp.name SEPARATOR ", ") from Marketplaces mp, ProductByMP prodByMp ' +
              ' where mp.mpId = prodByMp.mpId and prodByMp.productRefId =PRT.id) as mpNames ' +
              ' FROM ProductReferences  PRT, uomNames UNT1, uomNames UNT2, uomNames UNT3, ' +
              ' uomNames UNT4, uomNames UNT5, uomNames UNT6,uomNames UNT7,uomCategory UCat, uomScaling USca WHERE UNT1.uomScalingId = PRT.weightUoMScal AND UNT1.languageCultureCode =? ' +
              ' AND UNT2.uomScalingId = PRT.lengthUoMScal AND UNT2.languageCultureCode = ? AND UNT3.uomScalingId = PRT.volumeUoMScal ' +
              ' AND UNT3.languageCultureCode = ? AND UNT4.uomScalingId = PRT.heightUoMScal AND UNT4.languageCultureCode = ? ' +
              ' AND UNT5.uomScalingId = PRT.depthUoMScal AND UNT5.languageCultureCode = ? AND UNT6.uomScalingId = PRT.diameterUoMScal ' +
              ' AND UNT6.languageCultureCode = ? AND UNT7.uomScalingId = PRT.qtyUoMId AND UNT7.languageCultureCode = ? ' +
              ' AND USca.id = PRT.qtyUoMId AND UCat.categoryId = USca.categoryId AND UCat.languageCultureCode = ? AND PRT.accountId=uuid_to_bin(?) ' +
              ' AND ' + checkString + '; END IF;';

            var productReferences = await conn.query(queryString, [accountId].concat(checkValues, [Constants.ROW_LIMIT], queryValues, checkValues));
            debug('productReferences', productReferences);
            productReferences = Utils.filteredResponsePool(productReferences);

            return cb(null, productReferences);
        } catch (err) {
            debug('err', err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.ROW_COUNT_EXCEED_PLEASE_USE_SEARCH_AND_FILTER);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    validateProducts: function (options) {
        return new Promise(async function (resolve, reject) {
            var products = options.products;
            var err;

            try {
                if (DataUtils.isUndefined(products)) {
                    err = new Error(ErrorConfig.MESSAGE.ID_REQUIRED);
                } else if (!DataUtils.isArray(products)) {
                    err = new Error(ErrorConfig.MESSAGE.ID_MUST_BE_ARRAY);
                } else if (products.length <= 0) {
                    err = new Error(ErrorConfig.MESSAGE.ATLEAST_ONE_ID_REUQIRED);
                }
                if (err) {
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }

                await Promise.each(products, async function (item) {
                    if (DataUtils.isUndefined(item.id)) {
                        err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_ID_REQUIRED);
                    } else if (DataUtils.isValidateOptionalField(item.updatedAt)) {
                        err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_UPDATED_AT_REQUIRED);
                    } else if (!DataUtils.isValidNumber(item.updatedAt)) {
                        err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_UPDATED_AT_MUST_BE_NUMBER);
                    } else if (item.updatedAt.toString().length !== 13) {
                        err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_INVALID_UPDATED_AT);
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


    getExistItemIds: function (options) {
        return new Promise(async function (resolve, reject) {
            var products = options.products;
            var accountId = options.accountId;
            var status = options.status;
            var successItems = [], conflictItems = [];

            try {
                var conn = await connection.getConnection();

                var response = await ProductReference.manipulateItemIdQuery({list: products});
                debug('response', response);

                var itemIds = await conn.query('select  CAST(uuid_from_bin(id) as CHAR) as id from ProductReferences ' +
                  ' where accountId=uuid_to_bin(?) and status = ? and id in (' + response.string + ')', [accountId, status].concat(response.values));

                itemIds = _.map(itemIds, 'id');

                if (itemIds.length > 0) {
                    _.map(products, function (item) {
                        if (itemIds.indexOf(item.id) === -1) {
                            conflictItems.push(item.id);
                        } else {
                            successItems.push(item);
                        }
                    });
                } else {
                    conflictItems = _.map(products, 'id');
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

    checkUpdatedAt: function (options) {
        return new Promise(async function (resolve, reject) {
            var products = options.products;
            var accountId = options.accountId;
            var status = options.status;
            var string = '', values = [];
            var existItems = [], notExistItems = [];
            var conflict = [], success = [];
            var conflictIds = [];

            try {
                var conn = await connection.getConnection();

                var getExistItemOption = {
                    products: products,
                    status: status,
                    accountId: accountId
                };
                var getExistItemResponse = await ProductReference.getExistItemIds(getExistItemOption);
                existItems = getExistItemResponse.successItems;
                conflict = getExistItemResponse.conflictItems;

                if (existItems.length <= 0) {
                    return resolve({success: success, conflict: conflict});
                }

                await Promise.each(existItems, function (item) {
                    string += ' SELECT CAST(uuid_from_bin(id) as char) as id FROM ProductReferences WHERE (updatedAt != ? AND id = uuid_to_bin(?)) UNION ALL ';
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

    updateInShareAlert: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var inShareIds = options.inShareIds;
            var shareItemId = options.shareItemId;
            var updatedAt = DataUtils.getEpochMSTimestamp();
            debug('inside update inshare alert');

            try {
                var conn = await connection.getConnection();
                var response = await ProductReference.manipulateItemQuery({list: inShareIds});
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

    updateStatusMultipleItems: function (options) {
        return new Promise(async function (resolve, reject) {
            var products = options.successProducts;
            var accountId = options.accountId;
            var status = options.status;
            var currentDate = DataUtils.getEpochMSTimestamp();
            var err;

            try {
                var conn = await connection.getConnection();
                var queryResponse = await ProductReference.manipulateItemQuery({list: products});
                debug('queryResponse', queryResponse);

                var isDeleted = await conn.query('update ProductReferences set status = ?,updatedAt=? ' +
                  'where accountId = uuid_to_bin(?) and id in (' + queryResponse.string + ');',
                  [status, currentDate, accountId].concat(queryResponse.values));

                isDeleted = Utils.isAffectedPool(isDeleted);
                if (!isDeleted) {
                    if (status === Constants.PRODUCT_STATUS.IN_ACTIVE) {
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
                if (status === Constants.PRODUCT_STATUS.IN_ACTIVE) {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_ARCHIEVED_FAILED);
                } else {
                    err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_RESTORE_FAILED);
                }
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    deleteArchieveItems: async function (options, auditOptions, errorOptions, cb) {
        var products = options.products;
        var accountId = options.accountId;
        var successProducts, conflictProducts;
        var ProductInventoryApi = require('./product_inventory');
        var checkResponses = [];
        var err;

        try {
            //validate request of delete multiple product
            var checkOption = {
                products: products
            };
            var checkResponse = await ProductReference.validateProducts(checkOption);
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
            // check updatedAt of products
            var response = await ProductReference.checkUpdatedAt({
                products: products,
                status: Constants.PRODUCT_STATUS.ACTIVE,
                accountId: accountId
            });
            debug('response', response);
            successProducts = response.success;
            conflictProducts = response.conflict;

            if (successProducts.length <= 0 && conflictProducts.length > 0) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {success: successProducts, conflict: conflictProducts};
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            } /*else if (successProducts.length <= 0 && conflictProducts.length <= 0) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {success: successProducts, conflict: conflictProducts};
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }*/

            // Check if any out share or inshare is exist for each parter , if yes then stop sharing for those partner
            await Promise.each(successProducts, async function (inventory) {
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
                    var updateAlertResponse = await ProductReference.updateInShareAlert(updateAlertOptions);
                    debug('updateAlertResponse', updateAlertResponse);
                }

            });

            // delete Supply Items (status = 0 )
            var deleteOption = {
                successProducts: successProducts,
                status: Constants.PRODUCT_STATUS.IN_ACTIVE,
                accountId: accountId
            };
            var deleteResponse = await ProductReference.updateStatusMultipleItems(deleteOption);
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
            if (successProducts.length > 0 && conflictProducts.length > 0) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {
                    successMsg: Constants.SUCCESS_MESSAGE.PRODUCT_ARCHIEVED_SUCCESSFULLY,
                    success: successProducts,
                    conflict: conflictProducts
                };
                debug('err', err);
                return cb(err);
            } else {
                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.PRODUCT_ARCHIEVED_SUCCESSFULLY,
                    success: successProducts
                });
            }
        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK;');
            ErrorUtils.create(errorOptions, options, err);
            err = err || new Error(ErrorConfig.MESSAGE.PRODUCT_ARCHIEVED_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    restoreArchieveItems: async function (options, auditOptions, errorOptions, cb) {
        var products = options.products;
        var accountId = options.accountId;
        var successProducts, conflictProducts;
        var err;

        try {
            //validate request of delete multiple supply Item
            var checkOption = {
                products: products
            };
            var checkResponse = await ProductReference.validateProducts(checkOption);
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
            var response = await ProductReference.checkUpdatedAt({
                products: products,
                status: Constants.PRODUCT_STATUS.IN_ACTIVE,
                accountId: accountId
            });
            debug('response', response);
            successProducts = response.success;
            conflictProducts = response.conflict;

            if (successProducts.length <= 0 && conflictProducts.length > 0) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {success: successProducts, conflict: conflictProducts};
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            } /*else if (successProducts.length <= 0 && conflictProducts.length <= 0) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {success: successProducts, conflict: conflictProducts};
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }*/

            // restore Supply Items (status = 1)
            var restoreOption = {
                successProducts: successProducts,
                status: Constants.PRODUCT_STATUS.ACTIVE,
                accountId: accountId
            };
            var restoreResponse = await ProductReference.updateStatusMultipleItems(restoreOption);
            debug('restoreResponse', restoreResponse);

            await conn.query('COMMIT;');
            AuditUtils.create(auditOptions);
            if (successProducts.length > 0 && conflictProducts.length > 0) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {
                    successMsg: Constants.SUCCESS_MESSAGE.PRODUCT_RESTORED_SUCCESSFULLY,
                    success: successProducts,
                    conflict: conflictProducts
                };
                debug('err', err);
                return cb(err);
            } else {
                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.PRODUCT_RESTORED_SUCCESSFULLY,
                    success: successProducts
                });
            }
        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK;');
            ErrorUtils.create(errorOptions, options, err);
            err = err || new Error(ErrorConfig.MESSAGE.PRODUCT_RESTORED_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    deleteMultipleItems: function (options) {
        return new Promise(async function (resolve, reject) {
            var products = options.successProducts;
            var accountId = options.accountId;
            var err;

            try {
                var conn = await connection.getConnection();

                var queryResponse = await ProductReference.manipulateItemQuery({list: products});

                var isDeleted = await conn.query('delete from ProductReferences where accountId = uuid_to_bin(?) and status = 0 ' +
                  ' and id in (' + queryResponse.string + ');',
                  [accountId].concat(queryResponse.values));

                isDeleted = Utils.isAffectedPool(isDeleted);

                if (!isDeleted) {
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_DELETE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_DELETE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    deleteItems: async function (options, auditOptions, errorOptions, cb) {
        var products = options.products;
        var accountId = options.accountId;
        var successProducts, conflictProducts;
        var err;

        try {
            //validate request of delete multiple supply Item
            var checkOption = {
                products: products
            };
            var checkResponse = await ProductReference.validateProducts(checkOption);
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
            var response = await ProductReference.checkUpdatedAt({
                products: products,
                status: Constants.PRODUCT_STATUS.IN_ACTIVE,
                accountId: accountId
            });
            successProducts = response.success;
            conflictProducts = response.conflict;

            if (successProducts.length <= 0 && conflictProducts.length > 0) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {success: successProducts, conflict: conflictProducts};
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            } /*else if (successProducts.length <= 0 && conflictProducts.length <= 0) {
                err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {success: successProducts, conflict: conflictProducts};
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
*/

            var deleteOptions = {
                successProducts: successProducts,
                accountId: accountId
            };
            var deleteResponse = await ProductReference.deleteMultipleItems(deleteOptions);
            debug('deleteResponse', deleteResponse);

            await conn.query('COMMIT;');
            AuditUtils.create(auditOptions);
            if (successProducts.length > 0 && conflictProducts.length > 0) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {
                    successMsg: Constants.SUCCESS_MESSAGE.PRODUCT_DELETED_SUCCESSFULLY,
                    success: successProducts,
                    conflict: conflictProducts
                };
                debug('err', err);
                return cb(err);
            } else {
                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.PRODUCT_DELETED_SUCCESSFULLY,
                    success: successProducts
                });
            }
        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK;');
            ErrorUtils.create(errorOptions, options, err);
            err = err || new Error(ErrorConfig.MESSAGE.PRODUCT_DELETE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    }
};

module.exports = ProductReference;