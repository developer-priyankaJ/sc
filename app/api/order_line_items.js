'use strict';


var debug = require('debug')('scopehub.api.order_line_items');
var Async = require('async');
var _ = require('lodash');
var MWSConfig = require('../config/mws');
var amazonMws = require('amazon-mws')(MWSConfig.ACCESS_KEY_ID, MWSConfig.SECRET_ACCESS_KEY);
var ScopehubCore = require('../lib/scope_core');
var csv = require('fast-csv');
var path = require('path');
var fs = require('fs');
var i18n = require('i18n');

var DataUtils = require('../lib/data_utils');
var connection = require('../lib/connection_util');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');
var AuditUtils = require('../lib/audit_utils');
var ErrorUtils = require('../lib/error_utils');
var Utils = require('../lib/utils');
var CommonApi = require('../api/common');

var OrderLineItems = {

    getAllOrderLineItem: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user, err;

        try {
            var conn = await connection.getConnection();
            var items = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id,CAST(uuid_from_bin(accountId) as CHAR) as accountId,' +
              ' CAST(uuid_from_bin(orderRefId) as CHAR) as orderRefId,' +
              ' amazonOrderId, orderItemId, UOMScalId, quantityOrdered, title, shippingTaxCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (shippingTaxAmount / CAST(power(10,8) as INTEGER))))) as shippingTaxAmount, promotionDiscountCurrencyCode, ' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (promotionDiscountAmount / CAST(power(10,8) as INTEGER))))) as promotionDiscountAmount, ' +
              ' conditionId, mpProductId, sellerSKU, numberOfItems, giftWrapTaxCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (giftWrapTaxAmount / CAST(power(10,8) as INTEGER))))) as giftWrapTaxAmount, ' +
              ' quantityShipped, shippingPriceCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (shippingPriceAmount / CAST(power(10,8) as INTEGER))))) as shippingPriceAmount, ' +
              ' giftWrapPriceCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (giftWrapPriceAmount / CAST(power(10,8) as INTEGER))))) as giftWrapPriceAmount , ' +
              ' conditionSubtypeId, itemPriceCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (itemPriceAmount / CAST(power(10,8) as INTEGER))))) as itemPriceAmount , ' +
              ' itemTaxCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (itemTaxAmount / CAST(power(10,8) as INTEGER))))) as itemTaxAmount, ' +
              ' shippingDiscountCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (shippingDiscountAmount / CAST(power(10,8) as INTEGER))))) as shippingDiscountAmount, ' +
              ' giftMessageText, isGift, priceDestination, conditionNote, recordType, CAST(uuid_from_bin(orderType) as CHAR) as orderType, scheduledDeliveryStartDate, scheduledDeliveryEndDate, ' +
              ' CODFeeCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (CODFeeAmount / CAST(power(10,8) as INTEGER))))) as CODFeeAmount, ' +
              ' CODFeeDiscountCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (CODFeeDiscountAmount / CAST(power(10,8) as INTEGER))))) as CODFeeDiscountAmount, updatedAt from OrderLineItems ' +
              ' where accountId=uuid_to_bin(?) order by updatedAt desc limit 10;', [user.accountId]);

            AuditUtils.create(auditOptions);
            return cb(null, items || []);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.GET_ITEMS_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }

    },

    searchOrderLineItem: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user, err;
        var sellerSKU = options.sellerSKU;
        var title = options.title;
        var amazonOrderId = options.amazonOrderId;
        var checkString = '';
        var checkValues = [];

        try {

            if (DataUtils.isUndefined(sellerSKU) && DataUtils.isUndefined(amazonOrderId) && DataUtils.isUndefined(title)) {
                err = new Error(ErrorConfig.MESSAGE.AT_LEASE_ONE_SEARCH_ATTRIBUTE_REQUIRED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }

            if (DataUtils.isDefined(sellerSKU)) {
                checkString += ' and sellerSKU like ? ';
                checkValues.push('%' + sellerSKU + '%');
            }
            if (DataUtils.isDefined(amazonOrderId)) {
                checkString += ' and amazonOrderId like ? ';
                checkValues.push('%' + amazonOrderId + '%');
            }
            if (DataUtils.isDefined(title)) {
                checkString += ' and title like ? ';
                checkValues.push('%' + title + '%');
            }

            var conn = await connection.getConnection();
            var items = await conn.query('IF (select count(1) from OrderLineItems where ' +
              ' accountId = uuid_to_bin(?)' + checkString + ') > ? THEN ' +
              ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "ROW_COUNT_EXCEED_PLEASE_USE_SEARCH_AND_FILTER", MYSQL_ERRNO = 4001; ' +
              ' ELSE' +
              ' select CAST(uuid_from_bin(id) as CHAR) as id,CAST(uuid_from_bin(accountId) as CHAR) as accountId,' +
              ' CAST(uuid_from_bin(orderRefId) as CHAR) as orderRefId,' +
              ' amazonOrderId, orderItemId, UOMScalId, quantityOrdered, title, shippingTaxCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (shippingTaxAmount / CAST(power(10,8) as INTEGER))))) as shippingTaxAmount, promotionDiscountCurrencyCode, ' +
              ' TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (promotionDiscountAmount / CAST(power(10,8) as INTEGER))))) as promotionDiscountAmount, ' +
              ' conditionId, mpProductId, sellerSKU, numberOfItems, giftWrapTaxCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (giftWrapTaxAmount / CAST(power(10,8) as INTEGER))))) as giftWrapTaxAmount, ' +
              ' quantityShipped, shippingPriceCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (shippingPriceAmount / CAST(power(10,8) as INTEGER))))) as shippingPriceAmount, ' +
              ' giftWrapPriceCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (giftWrapPriceAmount / CAST(power(10,8) as INTEGER))))) as giftWrapPriceAmount , ' +
              ' conditionSubtypeId, itemPriceCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (itemPriceAmount / CAST(power(10,8) as INTEGER))))) as itemPriceAmount , ' +
              ' itemTaxCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (itemTaxAmount / CAST(power(10,8) as INTEGER))))) as itemTaxAmount, ' +
              ' shippingDiscountCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (shippingDiscountAmount / CAST(power(10,8) as INTEGER))))) as shippingDiscountAmount, ' +
              ' giftMessageText, isGift, priceDestination, conditionNote, recordType, CAST(uuid_from_bin(orderType) as CHAR) as orderType, scheduledDeliveryStartDate, scheduledDeliveryEndDate, ' +
              ' CODFeeCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (CODFeeAmount / CAST(power(10,8) as INTEGER))))) as CODFeeAmount, ' +
              ' CODFeeDiscountCurrencyCode, TRIM(TRAILING "." FROM(TRIM(TRAILING "0" FROM (CODFeeDiscountAmount / CAST(power(10,8) as INTEGER))))) as CODFeeDiscountAmount, updatedAt from OrderLineItems ' +
              ' where accountId=uuid_to_bin(?)' + checkString + ' order by updatedAt;  END IF; ',
              [user.accountId].concat(checkValues).concat([Constants.ROW_LIMIT,user.accountId]).concat(checkValues));

            AuditUtils.create(auditOptions);
            return cb(null, items || []);
        } catch (err) {
            debug('err', err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.ROW_COUNT_EXCEED_PLEASE_USE_SEARCH_AND_FILTER);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else {
                err = new Error(ErrorConfig.MESSAGE.SEARCH_ITEM_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

    },
};

module.exports = OrderLineItems;
