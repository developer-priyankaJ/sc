'use strict';

var debug = require('debug')('scopehub.lib.orders_utils');
var Util = require('util');

var connection = require('../lib/connection_util');
var OrdersModel = require('../model/orders_log');
var knex = require('../lib/knex_util');
var Utils = require('../lib/utils');
var DataUtils = require('../lib/data_utils');
var Constants = require('../data/constants');
var ErrorConfig = require('../data/error');
var _ = require('lodash');

var noop = function () {
}; //

var OrdersUtils = {
    log: function (options, cb) {
        cb = cb || noop;
        var opt = {
            userId: options.userId || 0,
            requestType: options.requestType,
            endpoint: options.endpoint,
            params: options.params,
            response: options.response,
            requestId: options.requestId,
            metaData: options.metaData && JSON.stringify(options.metaData),
            accountId: options.accountId,
            platform: options.platform,
            marketplace: options.marketplace
        };
        OrdersModel.create(opt, function (err, data) {
            if (err) {
                Util.log(err);
                return cb(err);
            }
            return cb(null, data);
        });
    },

    validateOptionalFields: function (options, cb) {
        var orderLogFields = '';
        var orderLogOptinalFields = [];

        if (!DataUtils.isValidateOptionalField(options.userId)) {
            orderLogFields += 'userId=uuid_to_bin(?) ,';
            orderLogOptinalFields.push(options.userId);
        }
        if (!DataUtils.isValidateOptionalField(options.requestType)) {
            orderLogFields += 'requestType=? ,';
            orderLogOptinalFields.push(options.requestType);
        }
        if (!DataUtils.isValidateOptionalField(options.endpoint)) {
            orderLogFields += 'endpoint=? ,';
            orderLogOptinalFields.push(options.endpoint);
        }
        if (!DataUtils.isValidateOptionalField(options.params)) {
            orderLogFields += 'params=? ,';
            orderLogOptinalFields.push(JSON.stringify(options.params));
        }
        if (!DataUtils.isValidateOptionalField(options.requestId)) {
            orderLogFields += 'requestId=? ,';
            orderLogOptinalFields.push(options.requestId);
        }
        if (!DataUtils.isValidateOptionalField(options.metaData)) {
            orderLogFields += 'metaData=? ,';
            orderLogOptinalFields.push(JSON.stringify(options.metaData));
        }
        if (!DataUtils.isValidateOptionalField(options.accountId)) {
            orderLogFields += 'accountId=uuid_to_bin(?) ,';
            orderLogOptinalFields.push(options.accountId);
        }
        if (!DataUtils.isValidateOptionalField(options.platform)) {
            orderLogFields += 'platform=? ,';
            orderLogOptinalFields.push(options.platform);
        }
        if (!DataUtils.isValidateOptionalField(options.marketplace)) {
            orderLogFields += 'marketplaceId=? ,';
            orderLogOptinalFields.push(options.marketplace);
        }
        if (!DataUtils.isValidateOptionalField(options.orderId)) {
            orderLogFields += 'orderId=uuid_to_bin(?) ,';
            orderLogOptinalFields.push(options.orderId);
        }
        var response = {
            orderLogFields: orderLogFields,
            orderLogOptinalFields: orderLogOptinalFields
        };
        return cb(null, response);
    },

    logMD: async function (options, cb) {
        debug('logMD options', options);
        var orderLogFields = '';
        var orderLogOptinalFields = [];
        var orderLogRequiredFields = [];

        OrdersUtils.validateOptionalFields(options, async function (err, response) {
            if (err) {
                debug('err', err);
                return cb(err);
            }
            orderLogFields = response.orderLogFields;
            orderLogOptinalFields = response.orderLogOptinalFields;
            orderLogRequiredFields = _.concat(orderLogRequiredFields, orderLogOptinalFields);

            debug('orderLogFields', orderLogFields);
            debug('orderLogRequiredFields', orderLogRequiredFields);

            try {
                var conn = await connection.getConnection();
                var isInserted = await conn.query('insert into OrdersLog set ' + orderLogFields + ' createdAt=utc_timestamp(3),updatedAt=utc_timestamp(3)'
                  , orderLogRequiredFields);
                debug('isInserted', isInserted);
                isInserted = Utils.isAffectedPool(isInserted);
                debug('isInserted', isInserted);
                debug('isInserted', Utils.filteredResponse(await conn.query('select * from OrdersLog')));
                if (!isInserted) {
                    err = new Error(ErrorConfig.MESSAGE.ORDER_LOG_INSERT_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }
                return cb(null, Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.ORDER_LOG_INSERT_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
        });

    }
};

module.exports = OrdersUtils;

(function () {
    if (require.main === module) {

    }
}());