/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.api.order_type_reference');
var Async = require('async');
var Util = require('util');

var Constants = require('../data/constants');
var AuditUtils = require('../lib/audit_utils');
var DataUtils = require('../lib/data_utils');
var OrderTypeReferenceModel = require('../model/order_type_reference');
var ErrorConfig = require('../data/error');
var _ = require('lodash');

var OrderTypeReference = {
    create: async function (options, cb) {
        var type = options.type;
        var err;
        var orderTypeReferenceOptions = {
            type: type
        };
        try {
            var response = await OrderTypeReferenceModel.createAsync(orderTypeReferenceOptions);
            if (!response) {
                throw err;
            }
            response = response && response.attrs;
            return cb(null, response);
        }
        catch (err) {
            err = new Error(ErrorConfig.MESSAGE.ORDER_TYPE_REFERENCE_CREATION_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

};


module.exports = OrderTypeReference;
