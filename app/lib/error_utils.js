'use strict';

var debug = require('debug')('scopehub.lib.error_utils');
var connection = require('../lib/connection_util');
var Util = require('util');
var DataUtils = require('./data_utils');
var Utils = require('./utils');
var fs = require('fs');
var ErrorConfig = require('../data/error');
var noop = function () {
}; //

var ErrorUtils = {
    create: async function (options, data, err) {
        var errorQuery = '';
        var errorValues = [];

        if (!options.err && err) {
            options.err = err;
        }
        if (!options.data && data) {
            options.data = data;
        }

        var errorOptions = {};

        if (DataUtils.isDefined(options.userId)) {
            errorQuery += 'userId = uuid_to_bin(?), ';
            errorValues.push(options.userId);
            //errorOptions.userId = options.userId;
        }
        if (DataUtils.isDefined(options.ipAddress)) {
            errorQuery += 'ipAddress = ?, ';
            errorValues.push(options.ipAddress);
            errorOptions.ipAddress = options.ipAddress;
        }
        if (DataUtils.isDefined(options.url)) {
            errorQuery += 'url = ?, ';
            errorValues.push(options.url);
            errorOptions.url = options.url;
        }
        if (DataUtils.isDefined(options.method)) {
            errorQuery += 'method = ?, ';
            errorValues.push(options.method);
            errorOptions.method = options.method;
        }
        if (DataUtils.isObject(options.queryParams)) {
            errorQuery += 'queryParams = ?, ';
            errorValues.push(options.queryParams);
            errorOptions.queryParams = options.queryParams;
        }

        if (DataUtils.isObject(options.bodyParams)) {
            errorQuery += 'bodyParams = ?, ';
            errorValues.push(options.bodyParams);
            errorOptions.bodyParams = options.bodyParams;
        }

        if (DataUtils.isObject(options.urlParams)) {
            errorQuery += 'urlParams = ?, ';
            errorValues.push(options.urlParams);
            errorOptions.urlParams = options.urlParams;
        }

        if (DataUtils.isObject(options.err)) {
            errorQuery += 'error = ?, ';
            var error = {
                message: options.err.message,
                code: options.err.code,
                status: options.err.status,
                stack: options.err.stack
            };
            errorValues.push(error);
        } else if (DataUtils.isDefined(options.err)) {
            errorQuery += 'error = ?, ';
            errorValues.push(options.err);
            errorOptions.error = options.err;
        }

        /*if (!!options.data) {
            errorOptions.data = options.data;
        } else if (!!data) {
            errorOptions.data = data;
        }*/
        if (options.data) {
            errorQuery += 'data = ?, ';
            errorValues.push(options.data);
            errorOptions.data = options.data;
        } else if (data) {
            errorQuery += 'data = ? , ';
            errorValues.push(data);
            errorOptions.data = data;
        }
        errorQuery = errorQuery.replace(/,\s*$/, ' ');


        if (options.err.code === '2003') {
            var logFile = __dirname + '/../' + new Date().getFullYear() + '-' + new Date().getMonth() + '-' + new Date().getDate() + '.log';
            fs.appendFile(logFile, '[ ' + new Date() + '] ' + JSON.stringify(errorOptions) + '\n');
        } else {
            try {
                var conn = await connection.getConnection();
                var errorLog = await conn.query('insert into error_log set ' + errorQuery + ';', errorValues);
                errorLog = Utils.isAffectedPool(errorLog);

                if (!errorLog) {
                    err = new Error(ErrorConfig.MESSAGE.ERROR_LOG_CREATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }
            } catch (err) {
                console.log(err);
            }
        }
    }
};

module.exports = ErrorUtils;

(function () {
    if (require.main === module) {

    }
}());
