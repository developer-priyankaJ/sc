/* jslint node: true */
'use strict';


var debug = require('debug')('scopehub.api.product_by_mp');
var Util = require('util');
var Async = require('async');
var _ = require('lodash');
var Promise = require('bluebird');
var js2xmlparser = require('js2xmlparser');
var fs = require('fs');
var connection = require('../lib/connection_util');

var EndpointConfig = require('../config/endpoints');
var AccountModel = require('../model/account');
var ProductModel = require('../model/product');
var ProductReferenceModel = require('../model/product_reference');
var DataUtils = require('../lib/data_utils');
var Constants = require('../data/constants');
var Utils = require('../lib/utils');
var ErrorConfig = require('../data/error');
var ErrorUtils = require('../lib/error_utils');
var AuditUtils = require('../lib/audit_utils');
var ScopehubCore = require('../lib/scope_core');
var MWSConfig = require('../config/mws');
var SesUtils = require('../lib/ses_utils');
var NotificationApi = require('../api/notification');
var AccountMarketplaceApi = require('../api/account_marketplace');
var NotificationReferenceData = require('../data/notification_reference');
var SQSUtils = require('../lib/sqs_utils');
var amazonMws = require('amazon-mws')(MWSConfig.ACCESS_KEY_ID, MWSConfig.SECRET_ACCESS_KEY);

var ProductByMp = {

    getAllProductByMpListMD: async function (options, errorOptions, cb) {
        var accountId = options.accountId;
        var mpId = options.mpId;
        if (DataUtils.isUndefined(mpId)) {
            var err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var productByMpList = await conn.query('select CAST(uuid_from_bin(id) as char) as id ,CAST(uuid_from_bin(accountId) as char) as accountId,' +
              'CAST(uuid_from_bin(productRefId) as char) as productRefId, mpProductId,updatedAt,sku,conditionType,averageRetailPrice,packageQuantity ' +
              'from ProductByMP where accountId=uuid_to_bin(?) && mpId=?', [accountId, mpId]);

            return cb(null, productByMpList);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    getProductByMpDetailByASINAndMPMD: async function (options, errorOptions, cb) {
        var mpId = options.mpId;
        var accountId = options.account.id;
        var mpProductId = options.mpProductId;
        var err;
        if (DataUtils.isUndefined(mpProductId)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_MP_PRODUCT_ID_REQUIRED);
        }
        if (DataUtils.isUndefined(mpId)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_MP_ID_REQUIRED);
        }

        if (err) {
            debug('err', err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var accountMarketplace = await conn.query('select sellerId , token from AccountMarketplaces where accountId = uuid_to_bin(?) and mpId = ?', [accountId, mpId]);
            accountMarketplace = Utils.filteredResponsePool(accountMarketplace);
            if (!accountMarketplace) {
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            amazonMws.products.search({
                'Version': '2011-10-01',
                'Action': 'GetMatchingProduct',
                'SellerId': accountMarketplace.sellerId,
                'MWSAuthToken': accountMarketplace.token,
                'MarketplaceId': mpId,
                'ASINList.ASIN.1': mpProductId
            }, function (error, productDetail) {
                if (error) {
                    debug('error', error);
                    if (error.Code === 'InvalidParameterValue') {
                        error = new Error(error.Message);
                        error.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        return cb(error);
                    }
                    if (error.Code === 'InvalidRequest') {
                        error = new Error(error.Message);
                        error.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        return cb(error);
                    }
                    return cb(error);
                }

                if (productDetail.status === 'ClientError') {
                    error = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_PRODUCT_NOT_FOUND_WITH_THIS_ASIN);
                    error.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return cb(error);
                }
                return cb(null, productDetail);
            });
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    getProductByMpDetailById: async function (options, errorOptions, cb) {
        var id = options.id;
        var accountId = options.account.id;

        var err;
        if (DataUtils.isUndefined(id)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_ID_REQUIRED);
        }
        if (err) {
            debug('err', err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var productByMp = await conn.query('select *,CAST(uuid_from_bin(id) as char) as id,CAST(uuid_from_bin(accountId) as char) as accountId,' +
              'CAST(uuid_from_bin(productRefId) as char) as productRefId, CAST(uuid_from_bin(supplierAccountId) as char) as supplierAccountId,' +
              'CAST(uuid_from_bin(supplierProductId) as char) as supplierProductId,CAST(uuid_from_bin(createdBy) as char) as createdBy,' +
              'CAST(uuid_from_bin(updatedBy) as char) as updatedBy from ProductByMP where id = uuid_to_bin(?)', [id]);
            productByMp = Utils.filteredResponsePool(productByMp);
            if (!productByMp) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            return cb(null, productByMp);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    getProductByMpDetailByMpIdProductRefId: async function (options, errorOptions, cb) {

        var mpId = options.mpId;
        var productRefId = options.productRefId;

        var err;
        if (DataUtils.isValidateOptionalField(mpId)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_MP_ID_REQUIRED);
        }
        if (DataUtils.isValidateOptionalField(productRefId)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_PRODUCT_REF_ID_REQUIRED);
        }
        if (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }


        try {
            var conn = await connection.getConnection();
            var productByMp = await conn.query('select averageRetailPrice,packageQuantity,averageCost,wholesalePrice,declaredValue,updatedAt, ' +
              '(select currencyCode from Marketplaces where mpId= prodByMp.mpId) as currencyCode from ProductByMP prodByMp ' +
              'where prodByMp.productRefId = uuid_to_bin(?) and prodByMp.mpId = ?', [productRefId, mpId]);
            productByMp = Utils.filteredResponsePool(productByMp);
            if (!productByMp) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            return cb(null, productByMp);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    getProductByMpDetailByProductRef: async function (options, errorOptions, cb) {
        var productRefId = options.productRefId;
        var err;
        if (DataUtils.isUndefined(productRefId)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_PRODUCT_REF_ID_REQUIRED);
        }
        if (err) {
            debug('err', err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
        try {
            var conn = await connection.getConnection();
            var mpIds = await conn.query('select mpId from ProductByMP where productRefId = uuid_to_bin(?)', productRefId);
            // mpIds = Utils.filteredResponsePool(mpIds);

            var temp = [];
            if (!mpIds) {
                temp = [];
            }
            _.each(mpIds, function (mpId) {
                temp.push(mpId.mpId);
            });
            return cb(null, temp);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    getListingProduct: function (options) {
        return new Promise(async function (resolve, reject) {
            var conn = await  connection.getConnection();
            var productByMpStore = await conn.query('select CAST(uuid_from_bin(prodByMp.id) as char) as id ,prodByMp.postSubmitfeedRequestId,' +
              'prodByMp.quantitySubmitfeedRequestId,prodByMp.priceSubmitfeedRequestId,AccMp.sellerId,' +
              'AccMp.token,AccMp.mpId from ProductByMP as prodByMp,AccountMarketplaces as AccMp ' +
              'where prodByMp.listingStatus = ? AND prodByMp.accountId=AccMp.accountId AND prodByMp.mpId=AccMp.mpId',
              [options.listingProductStatus]);

            // productByMpStore = Utils.filteredResponsePool(productByMpStore);
            //debug('productByMpStore from function', productByMpStore);
            return resolve(productByMpStore);
        });
    },

    updateListProduct: function (options) {
        debug('options', options);
        return new Promise(async function (resolve, reject) {
            var conn = await connection.getConnection();
            var productByMpStore = await conn.query('update ProductByMP set listingStatus = ?,listPostFeedStatus=?,listQuantityFeedStatus=?,' +
              'listPricingFeedStatus=? where id = uuid_to_bin(?)',
              [options.listingStatus, options.listPostFeedStatus, options.listQuantityFeedStatus, options.listPricingFeedStatus, options.id]);
            //debug('productByMpStore ', productByMpStore);
            productByMpStore = Utils.isAffectedPool(productByMpStore);
            debug('productByMpStore ', productByMpStore);
            return resolve(productByMpStore);
        });
    },

    getSubmitfeedReportMD: async function (options, cb) {
        var product = options.product;
        if (_.isEmpty(product)) {
            return cb();
        }

        var submitFeedResult;
        var isFailed = false;
        var listPostFeedStatus;
        var listQuantityFeedStatus;
        var listPricingFeedStatus;
        var listingStatus;
        var isSuccess = false;
        var count = 0;
        var feedSubmissionIds = [];
        feedSubmissionIds.push({
            id: product.postSubmitfeedRequestId,
            post: '_POST_PRODUCT_DATA_'
        }, {
            id: product.quantitySubmitfeedRequestId,
            quantity: '_POST_INVENTORY_AVAILABILITY_DATA_'
        }, {
            id: product.priceSubmitfeedRequestId,
            price: '_POST_PRODUCT_PRICING_DATA_'
        });

        await Promise.each(feedSubmissionIds, async function (feed) {

            count += 1;
            // debug('inside loop feedSubmissionIds', count, feed.id);
            try {

                var submitFeedResult = await amazonMws.feeds.submit({
                    'Version': '2009-01-01',
                    'Action': 'GetFeedSubmissionResult',
                    'SellerId': product.sellerId,
                    'MWSAuthToken': product.token,
                    'FeedSubmissionId': feed.id
                });
                //debug('submitFeedResult', submitFeedResult.AmazonEnvelope.Message.ProcessingReport.DocumentTransactionID);
                var error;
                if (submitFeedResult.status === 'ClientError') {
                    error = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_SUBMITFEED_RESULT_NOT_FOUND);
                    error.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    throw error;
                }
                if (submitFeedResult && submitFeedResult.AmazonEnvelope.Message.ProcessingReport.ProcessingSummary.MessagesWithError != '0') {
                    //isFailed = true;
                    if (feed.post === '_POST_PRODUCT_DATA_') {
                        listPostFeedStatus = Constants.LIST_PRODUCT_STATUS.ERROR;
                    }
                    if (feed.quantity === '_POST_INVENTORY_AVAILABILITY_DATA_') {
                        listQuantityFeedStatus = Constants.LIST_PRODUCT_STATUS.ERROR;
                    }
                    if (feed.price === '_POST_PRODUCT_PRICING_DATA_') {
                        listPricingFeedStatus = Constants.LIST_PRODUCT_STATUS.ERROR;
                    }
                } else if (submitFeedResult && submitFeedResult.AmazonEnvelope.Message.ProcessingReport.ProcessingSummary.MessagesSuccessful != '0') {
                    //isSuccess = true;
                    if (feed.post === '_POST_PRODUCT_DATA_') {
                        listPostFeedStatus = Constants.LIST_PRODUCT_STATUS.SUCCESS;
                    }
                    if (feed.quantity === '_POST_INVENTORY_AVAILABILITY_DATA_') {
                        listQuantityFeedStatus = Constants.LIST_PRODUCT_STATUS.SUCCESS;
                    }
                    if (feed.price === '_POST_PRODUCT_PRICING_DATA_') {
                        listPricingFeedStatus = Constants.LIST_PRODUCT_STATUS.SUCCESS;
                        listPricingFeedStatus = Constants.LIST_PRODUCT_STATUS.SUCCESS;
                    }
                }
                /*if (isFailed && feed.post === '_POST_PRODUCT_DATA_') {
                    listPostFeedStatus = Constants.LIST_PRODUCT_STATUS.ERROR;
                } else {
                    listPostFeedStatus = Constants.LIST_PRODUCT_STATUS.SUCCESS;
                }
                if (isFailed && feed.quantity === '_POST_INVENTORY_AVAILABILITY_DATA_') {
                    debug('isFailed quantity', feed);
                    listQuantityFeedStatus = Constants.LIST_PRODUCT_STATUS.ERROR;
                    debug('listQuantityFeedStatus', listQuantityFeedStatus);
                } else {
                    listQuantityFeedStatus = Constants.LIST_PRODUCT_STATUS.SUCCESS;
                }
                if (isFailed && feed.price === '_POST_PRODUCT_PRICING_DATA_') {
                    debug('isFailed price', feed);
                    listPricingFeedStatus = Constants.LIST_PRODUCT_STATUS.ERROR;
                    debug('listPricingFeedStatus', listPricingFeedStatus);
                } else {
                    listPricingFeedStatus = Constants.LIST_PRODUCT_STATUS.SUCCESS;
                }*/
            } catch (err) {
                debug('error', err);
            }
        });

        if (listPostFeedStatus === Constants.LIST_PRODUCT_STATUS.ERROR || listQuantityFeedStatus === Constants.LIST_PRODUCT_STATUS.ERROR || listPricingFeedStatus === Constants.LIST_PRODUCT_STATUS.ERROR) {
            listingStatus = Constants.LIST_PRODUCT_STATUS.ERROR;
        }
        if (listingStatus === Constants.LIST_PRODUCT_STATUS.ERROR) {
            options = {
                id: product.id,
                listPostFeedStatus: listPostFeedStatus,
                listQuantityFeedStatus: listQuantityFeedStatus,
                listPricingFeedStatus: listPricingFeedStatus,
                listingStatus: listingStatus
            };
            var updateProduct = await ProductByMp.updateListProduct(options);
            return cb(null, updateProduct);
        }
        options = {
            id: product.id,
            listPostFeedStatus: Constants.LIST_PRODUCT_STATUS.SUCCESS,
            listQuantityFeedStatus: Constants.LIST_PRODUCT_STATUS.SUCCESS,
            listPricingFeedStatus: Constants.LIST_PRODUCT_STATUS.SUCCESS,
            listingStatus: Constants.LIST_PRODUCT_STATUS.SUCCESS
        };
        var updateProduct = await ProductByMp.updateListProduct(options);
        return cb(null, updateProduct);
    },

    validateOptionalFields: async function (options, cb) {
        var productByMPFields = '';
        var productByMPOptionalValues = [];
        var err;

        try {
            if (!DataUtils.isValidateOptionalField(options.mpId)) {
                if (!DataUtils.isString(options.mpId)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_MP_ID_MUST_BE_STRING);
                } else if (options.mpId.length > 15) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_MP_ID_MUST_BE_LESS_THAN_15_CHARACTER);
                } else {
                    productByMPFields += 'mpId=? ,';
                    productByMPOptionalValues.push(options.mpId);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.mpProductId)) {
                if (!DataUtils.isString(options.mpProductId)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_MP_PRODUCT_ID_MUST_BE_STRING);
                } else if (options.mpProductId.length > 30) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_MP_PRODUCT_ID_MUST_BE_LESS_THAN_30_CHARACTER);
                }
                else {
                    productByMPFields += 'mpProductId=? ,';
                    productByMPOptionalValues.push(options.mpProductId);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.conditionType)) {
                if (!DataUtils.isString(options.conditionType)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_CONDITION_TYPE_MUST_BE_STRING);
                } else if (options.conditionType.length > 20) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_CONDITION_TYPE_MUST_BE_LESS_THAN_20_CHARACTER);
                }
                else {
                    productByMPFields += 'conditionType=? ,';
                    productByMPOptionalValues.push(options.conditionType);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.packageQuantity)) {
                if (!DataUtils.isNumber(options.packageQuantity)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_PACKAGE_QUANTITY_MUST_BE_NUMBER);
                } else if (options.packageQuantity.toString().length > 11) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_PACKAGE_QUANTITY_MUST_BE_LESS_THAN_11_DIGIT);
                }
                else {
                    productByMPFields += 'packageQuantity=? ,';
                    productByMPOptionalValues.push(options.packageQuantity);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.averageRetailPrice)) {
                var temp = options.averageRetailPrice.toString().split('.');
                if (options.averageRetailPrice === '') {
                    options.averageRetailPrice = '0.00000000';
                }
                if (!DataUtils.isMobile(options.averageRetailPrice)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_AVERAGE_RETAIL_PRICE_MUST_BE_NUMBER);
                } else if (temp[0].length > 16) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_AVERAGE_RETAIL_PRICE_MUST_BE_LESS_THAN_16_DIGIT_BEFORE_DECIMAL);
                } else if (temp[1] && temp[1].length > 8) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_AVERAGE_RETAIL_PRICE_PRECISION_MUST_BE_LESS_THAN_8_DIGIT);
                }
                else {
                    productByMPFields += 'averageRetailPrice=? ,';
                    productByMPOptionalValues.push(options.averageRetailPrice);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.averageCost)) {
                var temp = options.averageCost.toString().split('.');
                if (options.averageCost === '') {
                    options.averageCost = '0.00000000';
                }
                if (!DataUtils.isMobile(options.averageCost)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_AVERAGE_COST_MUST_BE_NUMBER);
                } else if (temp[0].length > 16) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_AVERAGE_COST_MUSET_BE_LESS_THAN_16_DIGIT_BEFORE_DECIMAL);
                } else if (temp[1] && temp[1].length > 8) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_AVERAGE_COST_PRECISION_MUST_BE_LESS_THAN_8_DIGIT);
                } else {
                    productByMPFields += 'averageCost=? ,';
                    productByMPOptionalValues.push(options.averageCost);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.wholesalePrice)) {
                var temp = options.wholesalePrice.toString().split('.');
                if (options.wholesalePrice === '') {
                    options.wholesalePrice = '0.00000000';
                }
                if (!DataUtils.isMobile(options.wholesalePrice)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_WHOLE_SALE_PRICE_MUST_BE_NUMBER);
                } else if (temp[0].length > 16) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_WHOLE_SALE_PRICE_BE_LESS_THAN_16_DIGIT_BEFORE_DECIMAL);
                } else if (temp[1] && temp[1].length > 8) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_WHOLE_SALE_PRICE_PRECISION_MUST_BE_LESS_THAN_8_DIGIT);
                }
                else {
                    productByMPFields += 'wholesalePrice=? ,';
                    productByMPOptionalValues.push(options.wholesalePrice);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.declaredValue)) {
                var temp = options.declaredValue.toString().split('.');
                if (options.declaredValue === '') {
                    options.declaredValue = '0.00000000';
                }
                if (!DataUtils.isMobile(options.declaredValue)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_DECLARED_VALUE_MUST_BE_NUMBER);
                } else if (temp[0].length > 16) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_DECLARED_VALUE_MUST_BE_LESS_THAN_16_DIGIT_BEFORE_DECIMAL);
                } else if (temp[1] && temp[1].length > 8) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_DECLARED_VALUE_PRECISION_MUST_BE_LESS_THAN_8_DIGIT);
                }
                else {
                    productByMPFields += 'declaredValue=? ,';
                    productByMPOptionalValues.push(options.declaredValue);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.productTitle)) {
                if (!DataUtils.isString(options.productTitle)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_PRODUCT_TITLE_MUST_BE_STRING);
                } else if (options.productTitle.length > 60) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_PRODUCT_TITLE_MUST_BE_LESS_THAN_60_CHARACTER);
                }
                else {
                    productByMPFields += 'productTitle=? ,';
                    productByMPOptionalValues.push(options.productTitle);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.description)) {
                if (!DataUtils.isString(options.description)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_DESCRIPTION_MUST_BE_STRING);
                } else if (options.description.length > 140) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_DESCRIPTION_MUST_BE_LESS_THAN_140_CHARACTER);
                }
                else {
                    productByMPFields += 'description=? ,';
                    productByMPOptionalValues.push(options.description);
                }
            }
            var response = {
                productByMPFields: productByMPFields,
                productByMPOptionalValues: productByMPOptionalValues
            };
            return cb(null, response);
        } catch (err) {
            debug('err', err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
    },

    insertBulkRecords: async function (options, errorOptions, cb) {
        var tempValue = [];
        options.productByMPList.forEach(function (value) {
            options.successProducts.push(value.sku);
            tempValue = tempValue.concat(Object.values(value));
        });

        var query = 'INSERT into ProductByMP (id,accountId,mpProductId,sku,' +
          'createdBy,mpId, productRefId,averageRetailPrice,packageQuantity,createdAt,updatedAt) values';
        var values = ' (uuid_to_bin(?), uuid_to_bin(?), ?, ?, uuid_to_bin(?),?,uuid_to_bin(?),?,?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)) ';
        options.productByMPList.forEach(function (value) {
            query = query + values;
            query = query + ',';
        });
        query = query.replace(/,\s*$/, '');

        var conn = await  connection.getConnection();
        var productByMP = await conn.query(query, tempValue);
        var isAffected = Utils.isAffectedPool(productByMP);

        if (!isAffected) {
            throw err;
        }
        options.responseProductMessage.message = ErrorConfig.MESSAGE.PRODUCTS_IMPORTED_SUCCESSFULLY;
        options.responseProductMessage.successProducts = options.successProducts;
        options.responseProductMessage.status = ErrorConfig.STATUS_CODE.SUCCESS;
        return cb(null, options.responseProductMessage);

    },

    createProductByMp: async function (options, errorOptions, cb) {

        var generatedId = options.productByMPRequiredValues[2];
        var err;
        try {
            var conn = await connection.getConnection();
            var productByMP = await conn.query('If (SELECT 1 FROM ProductByMP WHERE productRefId=uuid_to_bin(?) and mpId=?) is null then ' +
              'INSERT into ProductByMP set id=uuid_to_bin(?), accountId=uuid_to_bin(?) ,productRefId=uuid_to_bin(?),sku=?,' + options.productByMPFields +
              'createdAt = ?, updatedAt = ?,postSubmitfeedRequestId=?,' +
              'priceSubmitfeedRequestId=?,quantitySubmitfeedRequestId=?,createdBy=uuid_to_bin(?),listingStatus=?,' +
              'listPostFeedStatus=?, listQuantityFeedStatus=?, listPricingFeedStatus=?;end if',
              options.productByMPRequiredValues);

            var isAffected = Utils.isAffectedPool(productByMP);
            if (!isAffected) {
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_DUPLICATE_PRODUCT_ON_SAME_MARKETPALCE);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            /*  var notificationOption = {
                  user_ids: [user.id],
                  topic_id: user.id,
                  notification_reference: NotificationReferenceData.LIST_PRODUCT_SUBMIT,
                  data: {
                      list_product: {
                          mpId: mpId,
                          sku: product.sku
                      }
                  },
                  meta: {
                      email: user.email
                  },
                  languageCultureCode: user.languageCultureCode
              };

              if (user.firstName) {
                  notificationOption.meta['name'] = user.firstName;
              }
              NotificationApi.create(notificationOption, function (err) {
                  if (err) {
                      debug('error', err);
                  }
                  return cb(null, {id: generatedId.uuid});
              });*/
            return cb(null, {
                OK: Constants.SUCCESS,
                id: generatedId,
                createdAt: options.createdAt
            });
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_CREATED_FAILED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    createMD: async function (options, auditOptions, errorOptions, cb) {

        var product = options.product;
        var accountId = options.account.id;
        var createdBy = options.user.id;
        var createdAt = DataUtils.getEpochMSTimestamp();
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var mpId = options.mpId;
        var mpProductId = options.mpProductId;
        var packageQuantity = options.packageQuantity;
        var conditionType = options.conditionType;
        var averageRetailPrice = options.averageRetailPrice;
        var productByMPStore = {};
        var productByMPResponse;

        var productByMPFields = '';
        var productByMPRequiredValues = [];
        var productByMPOptionalValues = [];

        var err;
        if (!product) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_PRODUCT_REQ);
        } else if (DataUtils.isValidateOptionalField(product.id)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_PRODUCT_REF_ID_REQ);
        } else if (DataUtils.isValidateOptionalField(product.sku)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_PRODUCT_REF_SKU_REQ);
        } else if (DataUtils.isValidateOptionalField(mpId)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_MP_ID_REQUIRED);
        } else if (DataUtils.isValidateOptionalField(mpProductId)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_MP_PRODUCT_ID_REQUIRED);
        } else if (DataUtils.isValidateOptionalField(packageQuantity)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_QUANTITY_REQUIRED);
        } else if (DataUtils.isValidateOptionalField(averageRetailPrice)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_PRICE_REQUIRED);
        }
        if (err) {
            debug('err', err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        var generatedId = Utils.generateId();
        productByMPRequiredValues.push(product.id, mpId, generatedId.uuid, accountId, product.id, product.sku);
        ProductByMp.validateOptionalFields(options, async function (err, response) {
            if (err) {
                debug('err', err);
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            productByMPFields = response.productByMPFields;
            productByMPOptionalValues = response.productByMPOptionalValues;

            productByMPRequiredValues = _.concat(productByMPRequiredValues, productByMPOptionalValues);

            try {
                var conn = await connection.getConnection();
                var accountMarketplace = await conn.query('select sellerId , token from AccountMarketplaces where accountId = uuid_to_bin(?) and mpId = ?', [accountId, mpId]);
                accountMarketplace = Utils.filteredResponsePool(accountMarketplace);

                if (!accountMarketplace) {
                    err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
            } catch (err) {
                debug('err', err);
                return cb(err);
            }
            try {
                var conn = await connection.getConnection();
                var productRef = await conn.query('select 1 from ProductReferences where id = uuid_to_bin(?)', product.id);
                productRef = Utils.filteredResponsePool(productRef);
                if (!productRef) {
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    debug('err', err);
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }

            } catch (err) {
                debug('err', err);
                return cb(err);
            }
            Async.series({
                newProduct: function (cbL2) {
                    var newProduct = js2xmlparser.parse('AmazonEnvelope', {
                        '@': {
                            'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                            'xsi:noNamespaceSchemaLocation': 'amznenvelope.xsd'
                        },
                        'Header': {
                            'DocumentVersion': '1.01',
                            'MerchantIdentifier': accountMarketplace.sellerId
                        },
                        'MessageType': 'Product',
                        'Message': {
                            'MessageID': '1',
                            'OperationType': 'Update',
                            'Product': {
                                'SKU': product.sku,
                                'StandardProductID': {
                                    'Type': 'ASIN',
                                    'Value': mpProductId
                                },
                                'Condition': {
                                    'ConditionType': conditionType
                                }
                            }
                        }
                    });
                    amazonMws.feeds.submit({
                        'Version': '2009-01-01',
                        'Action': 'SubmitFeed',
                        'SellerId': accountMarketplace.sellerId,
                        'MWSAuthToken': accountMarketplace.token,
                        'FeedType': '_POST_PRODUCT_DATA_',
                        'FeedContent': newProduct
                    }, function (error, productDetail) {
                        if (error) {
                            debug('error', error);
                            return cbL2(error);
                        }
                        if (productDetail.status === 'ClientError') {
                            error = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_PRODUCT_NOT_FOUND_WITH_THIS_ASIN);
                            error.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                            return cbL2(error);
                        }
                        productByMPStore.postSubmitfeedRequestId = productDetail.FeedSubmissionInfo.FeedSubmissionId;
                        // debug('newProduct productDetail---', productDetail);
                        return cbL2(null, productDetail);
                    });
                },

                quantityUpdateProduct: function (cbL2) {
                    var quantityUpdateProduct = js2xmlparser.parse('AmazonEnvelope', {
                        '@': {
                            'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                            'xsi:noNamespaceSchemaLocation': 'amznenvelope.xsd'
                        },
                        'Header': {
                            'DocumentVersion': '1.01',
                            'MerchantIdentifier': accountMarketplace.sellerId
                        },
                        'MessageType': 'Inventory',
                        'Message': {
                            'MessageID': '1',
                            'OperationType': 'Update',
                            'Inventory': {
                                'SKU': product.sku,
                                'Quantity': packageQuantity,
                                'FulfillmentLatency': 1
                            }
                        }
                    });
                    amazonMws.feeds.submit({
                        'Version': '2009-01-01',
                        'Action': 'SubmitFeed',
                        'SellerId': accountMarketplace.sellerId,
                        'MWSAuthToken': accountMarketplace.token,
                        'FeedType': '_POST_INVENTORY_AVAILABILITY_DATA_',
                        'FeedContent': quantityUpdateProduct
                    }, function (error, productDetail) {
                        if (error) {
                            debug('error', error);
                            return cbL2(error);
                        }
                        if (productDetail.status === 'ClientError') {
                            error = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_PRODUCT_NOT_FOUND_WITH_THIS_ASIN);
                            error.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                            return cbL2(error);
                        }
                        productByMPStore.quantitySubmitfeedRequestId = productDetail.FeedSubmissionInfo.FeedSubmissionId;
                        //debug('quantityUpdateProduct productDetail', productDetail);
                        return cbL2(null, productDetail);
                    });
                },

                priceUpdateProduct: function (cbL2) {
                    var priceUpdateProduct = js2xmlparser.parse('AmazonEnvelope', {
                        '@': {
                            'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                            'xsi:noNamespaceSchemaLocation': 'amznenvelope.xsd'
                        },
                        'Header': {
                            'DocumentVersion': '1.01',
                            'MerchantIdentifier': accountMarketplace.sellerId
                        },
                        'MessageType': 'Price',
                        'Message': {
                            'MessageID': '1',
                            'OperationType': 'Update',
                            'Price': {
                                'SKU': product.sku,
                                'StandardPrice': {
                                    '@': {
                                        'currency': 'USD'
                                    },
                                    '#': averageRetailPrice
                                }
                            }
                        }
                    });
                    amazonMws.feeds.submit({
                        'Version': '2009-01-01',
                        'Action': 'SubmitFeed',
                        'SellerId': accountMarketplace.sellerId,
                        'MWSAuthToken': accountMarketplace.token,
                        'FeedType': '_POST_PRODUCT_PRICING_DATA_',
                        'FeedContent': priceUpdateProduct
                    }, function (error, productDetail) {
                        if (error) {
                            debug('error', error);
                            return cbL2(error);
                        }
                        //debug('productDetail', productDetail);
                        if (productDetail.status === 'ClientError') {
                            error = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_PRODUCT_NOT_FOUND_WITH_THIS_ASIN);
                            error.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                            return cbL2(error);
                        }
                        productByMPStore.priceSubmitfeedRequestId = productDetail.FeedSubmissionInfo.FeedSubmissionId;
                        //debug('priceUpdateProduct productDetail', productDetail);
                        return cbL2(null, productDetail);
                    });
                },

                createProductByMpRecords: function (cbL2) {
                    var listingStatus = Constants.LIST_PRODUCT_STATUS.PROGRESSING;
                    var listPostFeedStatus = Constants.LIST_PRODUCT_STATUS.PROGRESSING;
                    var listQuantityFeedStatus = Constants.LIST_PRODUCT_STATUS.PROGRESSING;
                    var listPricingFeedStatus = Constants.LIST_PRODUCT_STATUS.PROGRESSING;
                    productByMPRequiredValues.push(createdAt, updatedAt, productByMPStore.postSubmitfeedRequestId, productByMPStore.priceSubmitfeedRequestId,
                      productByMPStore.quantitySubmitfeedRequestId, createdBy, listingStatus, listPostFeedStatus, listQuantityFeedStatus, listPricingFeedStatus);
                    var productByMPOptions = {
                        productByMPRequiredValues: productByMPRequiredValues,
                        productByMPFields: productByMPFields,
                        createdAt: createdAt
                    };

                    ProductByMp.createProductByMp(productByMPOptions, errorOptions, function (err, response) {
                        productByMPResponse = response;
                        if (err) {
                            debug(err);
                            return cbL2(err);
                        }
                        AuditUtils.create(auditOptions);
                        return cbL2();
                    });
                }
            }, function (err) {
                if (err) {
                    debug('err', err);
                    return cb(err);
                }
                return cb(null, productByMPResponse);
            });
        });
    },

    updateMD: async function (options, errorOptions, cb) {
        var productRefId = options.productRefId;
        var mpId = options.mpId;
        var updatedAt = options.updatedAt;
        var updatedBy = options.user.id;
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();
        var productByMPFields = '';
        var productByMPRequiredValues = [];
        var productByMPOptionalValues = [];

        var err;
        if (DataUtils.isValidateOptionalField(mpId)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_MP_ID_REQUIRED);
        } else if (DataUtils.isValidateOptionalField(productRefId)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_PRODUCT_REF_ID_REQUIRED);
        } else if (updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_INVALID_UPDATED_AT);
        }
        if (err) {
            debug('err', err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        productByMPRequiredValues.push(productRefId, mpId, productRefId, mpId, updatedAt);
        ProductByMp.validateOptionalFields(options, async function (err, response) {
            if (err) {
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            productByMPFields = response.productByMPFields;
            productByMPOptionalValues = response.productByMPOptionalValues;

            productByMPRequiredValues = _.concat(productByMPRequiredValues, productByMPOptionalValues);
            productByMPRequiredValues.push(newUpdatedAt, updatedBy, productRefId, mpId);
            try {

                var conn = await connection.getConnection();
                var productRef = await conn.query('IF (select 1 from ProductByMP where productRefId=uuid_to_bin(?) and mpId=?) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "PRODUCT_BY_MP_NOT_FOUND", MYSQL_ERRNO = 4001;' +
                  'ELSEIF (select 1 from ProductByMP where productRefId=uuid_to_bin(?) and mpId=? and updatedAt=?) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "PRODUCT_BY_MP_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
                  'ELSE update ProductByMP set ' + productByMPFields + ' updatedAt = ?,updatedBy=uuid_to_bin(?) ' +
                  'where productRefId=uuid_to_bin(?) and mpId=?;end if;', productByMPRequiredValues);

                productRef.isAffected = Utils.isAffectedPool(productRef);

                return cb(null, {OK: Constants.SUCCESS, updatedAt: newUpdatedAt});
            } catch (err) {
                debug('err', err);
                await ErrorUtils.create(errorOptions, options, err);
                if (err.errno === 4001) {
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return cb(err);
                } else if (err.errno === 4002) {
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    return cb(err);
                }
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
        });
    },

    updateQuantityMD: async function (options, errorOptions, cb) {
        var productRefId = options.productRefId;
        var mpId = options.mpId;
        var sku = options.sku;
        var packageQuantity = options.packageQuantity;
        var accountId = options.account.id;
        var updatedAt = options.updatedAt;
        var updatedBy = options.user.id;
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();
        var productByMPFields = '';
        var productByMPRequiredValues = [];
        var productByMPOptionalValues = [];

        var err;
        if (DataUtils.isValidateOptionalField(mpId)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_MP_ID_REQUIRED);
        } else if (DataUtils.isValidateOptionalField(sku)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_SKU_REQUIRED);
        } else if (DataUtils.isValidateOptionalField(productRefId)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_PRODUCT_REF_ID_REQUIRED);
        } else if (DataUtils.isValidateOptionalField(packageQuantity)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_QUANTITY_REQUIRED);
        } else if (updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_INVALID_UPDATED_AT);
        }
        if (err) {
            debug('err', err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        //  updatedAt = new Date(updatedAt);
        productByMPRequiredValues.push(productRefId, mpId, productRefId, mpId, updatedAt);
        ProductByMp.validateOptionalFields(options, async function (err, response) {
            if (err) {
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            productByMPFields = response.productByMPFields;
            productByMPOptionalValues = response.productByMPOptionalValues;

            /*  if (productByMPOptionalValues.length === 0) {
                  err = new Error(ErrorConfig.MESSAGE.INVALID_REQUEST);
                  err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                  debug('err', err);
                  await ErrorUtils.create(errorOptions, options, err);
                  return cb(err);
              }*/
            productByMPRequiredValues = _.concat(productByMPRequiredValues, productByMPOptionalValues);
            productByMPRequiredValues.push(newUpdatedAt, updatedBy, productRefId, mpId);

            try {
                var conn = await connection.getConnection();
                var accountMarketplace = await conn.query('select sellerId , token from AccountMarketplaces where accountId = uuid_to_bin(?) and mpId = ?', [accountId, mpId]);
                accountMarketplace = Utils.filteredResponsePool(accountMarketplace);
                if (!accountMarketplace) {
                    err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
            } catch (err) {
                debug('err', err);
                return cb(err);
            }
            try {
                var conn = await connection.getConnection();
                var productRef = await conn.query('IF (select 1 from ProductByMP where productRefId=uuid_to_bin(?) and mpId=?) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "PRODUCT_BY_MP_NOT_FOUND", MYSQL_ERRNO = 4001;' +
                  'ELSEIF (select 1 from ProductByMP where productRefId=uuid_to_bin(?) and mpId=? and updatedAt=?) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "PRODUCT_BY_MP_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
                  'ELSE update ProductByMP set ' + productByMPFields + ' updatedAt = ?,updatedBy=uuid_to_bin(?) ' +
                  'where productRefId=uuid_to_bin(?) and mpId=?;end if;', productByMPRequiredValues);

                productRef.isAffected = Utils.isAffectedPool(productRef);

                try {
                    var quantityUpdateProduct = js2xmlparser.parse('AmazonEnvelope', {
                        '@': {
                            'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                            'xsi:noNamespaceSchemaLocation': 'amznenvelope.xsd'
                        },
                        'Header': {
                            'DocumentVersion': '1.01',
                            'MerchantIdentifier': accountMarketplace.sellerId
                        },
                        'MessageType': 'Inventory',
                        'Message': {
                            'MessageID': '1',
                            'OperationType': 'Update',
                            'Inventory': {
                                'SKU': sku,
                                'Quantity': packageQuantity,
                                'FulfillmentLatency': 1
                            }
                        }
                    });
                    var submitQuantityResult = await amazonMws.feeds.submit({
                        'Version': '2009-01-01',
                        'Action': 'SubmitFeed',
                        'SellerId': accountMarketplace.sellerId,
                        'MWSAuthToken': accountMarketplace.token,
                        'FeedType': '_POST_INVENTORY_AVAILABILITY_DATA_',
                        'FeedContent': quantityUpdateProduct
                    });

                    var error;
                    if (submitQuantityResult.status === 'ClientError') {
                        error = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_PRODUCT_NOT_FOUND_WITH_THIS_ASIN);
                        error.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        return cbL2(error);
                    }
                    submitQuantityResult.quantitySubmitfeedRequestId = submitQuantityResult.FeedSubmissionInfo.FeedSubmissionId;
                    //debug('quantityUpdateProduct productDetail', productDetail);
                    return cb(null, {OK: Constants.SUCCESS, updatedAt: newUpdatedAt});

                } catch (err) {
                    if (err.Code === 'InvalidParameterValue') {
                        err = new Error(ErrorConfig.MESSAGE.INVALID_SELLR_ID);
                    }
                    if (err.Code === 'AccessDenied') {
                        err = new Error(ErrorConfig.MESSAGE.AUTH_TOKEN_NOT_VALID_FOR_SELLER_ID_AND_AWS_ACCOUNT_ID);
                    }
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    debug('err %o', err);
                    return cb(err);
                }
            } catch (err) {
                debug('err', err);
                await ErrorUtils.create(errorOptions, options, err);
                if (err.errno === 4001) {
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return cb(err);
                } else if (err.errno === 4002) {
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    return cb(err);
                }
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
        });
    },

    updatePriceMD: async function (options, errorOptions, cb) {
        var productRefId = options.productRefId;
        var mpId = options.mpId;
        var sku = options.sku;
        var averageRetailPrice = options.averageRetailPrice;
        var accountId = options.account.id;
        var updatedAt = options.updatedAt;
        var updatedBy = options.user.id;
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();
        var productByMPFields = '';
        var productByMPRequiredValues = [];
        var productByMPOptionalValues = [];

        var err;
        if (DataUtils.isValidateOptionalField(mpId)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_MP_ID_REQUIRED);
        } else if (DataUtils.isValidateOptionalField(sku)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_SKU_REQUIRED);
        } else if (DataUtils.isValidateOptionalField(productRefId)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_PRODUCT_REF_ID_REQUIRED);
        } else if (DataUtils.isValidateOptionalField(averageRetailPrice)) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_PRICE_REQUIRED);
        } else if (updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_INVALID_UPDATED_AT);
        }
        if (err) {
            debug('err', err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        productByMPRequiredValues.push(productRefId, mpId, productRefId, mpId, updatedAt);
        ProductByMp.validateOptionalFields(options, async function (err, response) {
            if (err) {
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            productByMPFields = response.productByMPFields;
            productByMPOptionalValues = response.productByMPOptionalValues;

            productByMPRequiredValues = _.concat(productByMPRequiredValues, productByMPOptionalValues);
            productByMPRequiredValues.push(newUpdatedAt, updatedBy, productRefId, mpId);

            try {
                var conn = await connection.getConnection();
                var accountMarketplace = await conn.query('select sellerId , token from AccountMarketplaces where accountId = uuid_to_bin(?) and mpId = ?', [accountId, mpId]);
                accountMarketplace = Utils.filteredResponsePool(accountMarketplace);
                if (!accountMarketplace) {
                    err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
            } catch (err) {
                debug('err', err);
                return cb(err);
            }
            try {
                var conn = await connection.getConnection();
                var productRef = await conn.query('IF (select 1 from ProductByMP where productRefId=uuid_to_bin(?) and mpId=?) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "PRODUCT_BY_MP_NOT_FOUND", MYSQL_ERRNO = 4001;' +
                  'ELSEIF (select 1 from ProductByMP where productRefId=uuid_to_bin(?) and mpId=? and updatedAt=?) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "PRODUCT_BY_MP_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
                  'ELSE update ProductByMP set ' + productByMPFields + ' updatedAt = ?,updatedBy=uuid_to_bin(?) ' +
                  'where productRefId=uuid_to_bin(?) and mpId=?;end if;', productByMPRequiredValues);

                productRef.isAffected = Utils.isAffectedPool(productRef);

                try {
                    var priceUpdateProduct = js2xmlparser.parse('AmazonEnvelope', {
                        '@': {
                            'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                            'xsi:noNamespaceSchemaLocation': 'amznenvelope.xsd'
                        },
                        'Header': {
                            'DocumentVersion': '1.01',
                            'MerchantIdentifier': accountMarketplace.sellerId
                        },
                        'MessageType': 'Price',
                        'Message': {
                            'MessageID': '1',
                            'OperationType': 'Update',
                            'Price': {
                                'SKU': sku,
                                'StandardPrice': {
                                    '@': {
                                        'currency': 'USD'
                                    },
                                    '#': averageRetailPrice
                                }
                            }
                        }
                    });
                    var submitPriceResult = await amazonMws.feeds.submit({
                        'Version': '2009-01-01',
                        'Action': 'SubmitFeed',
                        'SellerId': accountMarketplace.sellerId,
                        'MWSAuthToken': accountMarketplace.token,
                        'FeedType': '_POST_PRODUCT_PRICING_DATA_',
                        'FeedContent': priceUpdateProduct
                    });

                    var error;
                    if (submitPriceResult.status === 'ClientError') {
                        error = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_PRODUCT_NOT_FOUND_WITH_THIS_ASIN);
                        error.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        return cbL2(error);
                    }
                    submitPriceResult.quantitySubmitfeedRequestId = submitPriceResult.FeedSubmissionInfo.FeedSubmissionId;
                    //debug('quantityUpdateProduct productDetail', productDetail);
                    return cb(null, {OK: Constants.SUCCESS, updatedAt: newUpdatedAt});

                } catch (err) {
                    if (err.Code === 'InvalidParameterValue') {
                        err = new Error(ErrorConfig.MESSAGE.INVALID_SELLR_ID);
                    }
                    if (err.Code === 'AccessDenied') {
                        err = new Error(ErrorConfig.MESSAGE.AUTH_TOKEN_NOT_VALID_FOR_SELLER_ID_AND_AWS_ACCOUNT_ID);
                    }
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    debug('err %o', err);
                    return cb(err);
                }
            } catch (err) {
                debug('err', err);
                await ErrorUtils.create(errorOptions, options, err);
                if (err.errno === 4001) {
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return cb(err);
                } else if (err.errno === 4002) {
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    return cb(err);
                }
                err = new Error(ErrorConfig.MESSAGE.PRODUCT_BY_MP_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
        });
    },

    validateAuthorizationMD: async function (options, auditOptions, errorOptions, cb) {

        var sellerId = options.sellerId;
        var token = options.token;
        var mpId = options.mpId;
        var accountId = options.account.id;
        var userId = options.user.id;
        var createdAt = DataUtils.getEpochMSTimestamp();
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var err;

        if (DataUtils.isUndefined(sellerId)) {
            err = new Error(ErrorConfig.MESSAGE.SELLER_ID_REQUIRED);
        }
        if (DataUtils.isUndefined(token)) {
            err = new Error(ErrorConfig.MESSAGE.AUTH_TOKEN_REQUIRED);
        }
        if (DataUtils.isUndefined(mpId)) {
            err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_ID_REQUIRED);
        }

        if (err) {
            debug('err', err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
        try {

            var accountMarketplaceFields = '';
            var accountMarketplaceRequiredValues = [];
            var accountMarketplaceOptionalValues = [];
            var accountMarketplaceUpdateValues = [];

            accountMarketplaceRequiredValues.push(mpId, accountId, mpId);

            AccountMarketplaceApi.validateOptionalFields(options, async function (err, response) {
                if (err) {
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
                amazonMws.sellers.search({
                    'Version': '2011-07-01',
                    'Action': 'ListMarketplaceParticipations',
                    'SellerId': sellerId,
                    'MWSAuthToken': token
                }, async function (err, seller) {
                    if (err) {
                        debug('err ---', err);
                        if (err.Code === 'InvalidParameterValue') {
                            err = new Error(ErrorConfig.MESSAGE.INVALID_SELLR_ID);
                        }
                        if (err.Code === 'AccessDenied') {
                            err = new Error(ErrorConfig.MESSAGE.AUTH_TOKEN_NOT_VALID_FOR_SELLER_ID_AND_AWS_ACCOUNT_ID);
                        }
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        await ErrorUtils.create(errorOptions, options, err);
                        return cb(err);
                    }

                    var marketPlaceList = seller.ListMarketplaces.Marketplace;
                    var matchMarketPlace = _.find(marketPlaceList, function (value) {
                        if (value.MarketplaceId === mpId) {
                            return value;
                        }
                    });

                    auditOptions.metaData = {};

                    if (_.isEmpty(matchMarketPlace)) {
                        err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_NOT_MATCH);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        await ErrorUtils.create(errorOptions, options, err);
                        return cb(err);
                    }
                    accountMarketplaceFields = response.accountMarketplaceFields;
                    accountMarketplaceOptionalValues = response.accountMarketplaceOptionalValues;

                    if (accountMarketplaceOptionalValues.length === 0) {
                        err = new Error(ErrorConfig.MESSAGE.INVALID_REQUEST);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        debug('err', err);
                        await ErrorUtils.create(errorOptions, options, err);
                        return cb(err);
                    }
                    accountMarketplaceRequiredValues = _.concat(accountMarketplaceRequiredValues, accountMarketplaceOptionalValues);
                    accountMarketplaceRequiredValues.push(accountId, createdAt, updatedAt, userId);
                    accountMarketplaceUpdateValues.push(mpId, sellerId, token, userId, updatedAt, accountId, mpId);

                    var accMpOpts = accountMarketplaceRequiredValues.concat(accountMarketplaceUpdateValues);

                    try {
                        var conn = await connection.getConnection();
                        var insertResponse = await conn.query('IF (select 1 from Marketplaces where mpId=?) is null then ' +
                          'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "MARKETPLACE_NOT_FOUND_WITH_THIS_MP_ID", MYSQL_ERRNO = 4001; ' +
                          'ELSEIF (SELECT 1 from AccountMarketplaces WHERE accountId =uuid_to_bin(?) and mpId=?) is null then ' +
                          'INSERT into AccountMarketplaces set ' + accountMarketplaceFields +
                          'accountId=uuid_to_bin(?),createdAt = ?, updatedAt = ?,createdBy=uuid_to_bin(?);' +
                          'ELSE UPDATE AccountMarketplaces set ' + accountMarketplaceFields +
                          'updatedBy=uuid_to_bin(?),updatedAt = ? where accountId =uuid_to_bin(?) and mpId=?;end if;',
                          accMpOpts);

                        debug('insertResponse', insertResponse);
                    } catch (err) {
                        debug(err);
                        await ErrorUtils.create(errorOptions, options, err);
                        if (err.code === 4001) {
                            err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_NOT_FOUND_WITH_THIS_MP_ID);
                            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                            return cb(err);
                        } else {
                            err = new Error(ErrorConfig.MESSAGE.SERVER_ERROR);
                            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                            return cb(err);
                        }
                    }

                    amazonMws.reports.search({
                        'Version': '2009-01-01',
                        'Action': 'GetReportList',
                        'SellerId': sellerId,
                        'MWSAuthToken': token,
                        'ReportTypeList.Type.1': '_GET_FLAT_FILE_OPEN_LISTINGS_DATA_'
                    }, function (error, response) {
                        if (error) {
                            debug('error ', error);
                            return cb(err);
                        }
                        if (response && response.ReportInfo && response.ReportInfo[0]) {
                            var reportId = response.ReportInfo[0].ReportId;
                        } else {
                            return cb();
                        }

                        amazonMws.reports.search({
                            'Version': '2009-01-01',
                            'Action': 'GetReport',
                            'SellerId': sellerId,
                            'MWSAuthToken': token,
                            'ReportId': reportId
                        }, function (error, response) {
                            if (error) {
                                console.log('error ', error);
                                return;
                            }
                            var productParams = [];
                            response.data.forEach(function (d) {
                                productParams.push({
                                    accountId: options.account.id,
                                    mpProductId: d.asin,
                                    sku: d.sku,
                                    averageRetailPrice: parseFloat(d.price),
                                    packageQuantity: parseInt(d.quantity)
                                });
                            });
                            var products = {
                                products: productParams
                            };
                            auditOptions.metaData.products = products;
                            AuditUtils.create(auditOptions);
                            debug('products', products);
                            return cb(null, products);
                        });
                    });
                });
            });
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.SELLER_VALIDATE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    }
};

module.exports = ProductByMp;