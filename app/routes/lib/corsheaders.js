'use strict';

//var allowedHosts = ['https://test-be.scopehub.org'];
var allowedHosts = ['https://share.scopehub.org', 'http://localhost:4200'];
var i18n = require('i18n');

module.exports = function (req, res, next) {
    console.log('Inside host', req.headers.origin);
    if (allowedHosts.indexOf(req.headers.origin) > -1) {
        console.log('Inside if');
        res.header('Access-Control-Allow-Origin', req.headers.origin);
        //res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Credentials', true);
        res.header('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS,PUT,PATCH');
        res.header('Access-Control-Allow-Headers', 'Content-Type, localDeviceTimezone, localDeviceDateTime, languageCultureCode, accept-language, language');
    }
    // i18n language configured from here
    if (req.headers['language'] === undefined) {
        req.headers['language'] = 'en';
    }
    i18n.setLocale(req.headers['language']);

    next();
};
