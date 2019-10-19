#!/usr/bin/env node

'use strict';

var env = process.env.NODE_ENV || 'development';
var connection = require('../lib/connection_util');
var Util = require('util');
/**
 *
 * If we need to pass on additional information about error, as in bulk APIs, set
 * the data property of the Error object. The data property can be anything, like
 * an array to indicate which particular items in a bulk API had errors.
 *
 * @see inventory.js
 *
 **/
module.exports = async function (err, req, res, next) {

    var code = err.status || 500;
    var response = {
        error: err.message || err,
        stack: err.stack ? err.stack.split('\n') : ''
    };

    if (err.data) {
        response.data = err.data;
    }
    if (err.attempts) {
        response.attempts = err.attempts;
    }
    if (err.url) {
        response.url = err.url;
    }

    if (code >= 500) {
        console.log(err.stack);
    }

    /*if (env.toLowerCase() == 'production') {
        if (code == 500) {
            response.error = 'An unexpected error has occured';
        }
        // response.stack = undefined;
    }*/
   // Util.log('req error api url --**', req.url);
    await connection.closeConnectionCronJob();
    res.status(code).json(response);
};
