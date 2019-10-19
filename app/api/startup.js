/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.api.startup');
var Util = require('util');
var Async = require('async');
var NotificationReferenceApi = require('./notification_reference');
var FirebaseUtils = require('../lib/firebase_utils');

var startup = {
    init: function (options, cb) {
        options = options || {};
        cb = cb || function () {};
        
        Async.seq(
            function (options, cb) {
                NotificationReferenceApi.init(cb);
            },
            function (options, cb) {
                FirebaseUtils.init(cb);
            }
        )(options, function (err) {
            if (err) {
                Util.log('Error while initiating ScopeHub Backend - ' + err);
                process.exit(1);
            }
            Util.log('ScopeHub Backend initiated successfully');
            return cb();
        });
    }
};

process.on('uncaughtException', function (err) {
    console.log('Uncaught Error Caught:', err.stack);
});
module.exports = startup;
