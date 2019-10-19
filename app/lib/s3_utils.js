'use strict';
/*jslint node: true */

var debug = require('debug')('scopehub.s3_utils');
var Util = require('util');
var S3 = require('../model/s3');
var Constants = require('../data/constants');
var Path = require('path');
var DataUtils = require('./data_utils');

var s3utils = {};

s3utils.getObject = function (path, bucket, cb) {
    var params = {
        Bucket: bucket,
        Key: path
    };
    return S3.getObject(params, cb);
};

s3utils.putObject = function (buffer, objectName, type, destination, bucket, metadata, cb) {
    var key = destination ? destination + '/' + objectName : objectName;
    var params = {
        Bucket: bucket,
        Body: buffer,
        ContentType: type,
        Key: key
    };

    if (typeof (metadata) === 'function') {
        cb = metadata;
        metadata = null;
    }

    if (metadata) {
        if (metadata.acl) {
            params.ACL = metadata.acl;
            delete metadata.acl;
        }
        params.Metadata = metadata;
    }
    S3.putObject(params, function (err, data) {
        cb(err, data);
    });
};

s3utils.upload = function (buffer, objectName, type, destination, bucket, metadata, cb) {
    var key = destination ? destination + '/' + objectName : objectName;
    var params = {
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: type
    };

    S3.upload(params, function (err, data) {
        cb(err, data);
    });
};

s3utils.s3ObjectExists = function s3ObjectExists(options, cb) {
    var params = {
        Bucket: options.bucket || Constants.SCOPEHUB_TWILIO_BUCKET,
        Key: options.key
    };

    S3.headObject(params, function (err) {
        if (err) {
            return cb(null, false);
        } else {
            // successful response
            return cb(null, true);
        }
    });
};

s3utils.getUrlforS3Key = function (options) {
    if (!options.key && !options.urlType && !options.bucket) {
        return cb(null, null);
    }
    return Constants.URL_TYPES[options.urlType].endpoint + '/' + options.bucket + '/' + options.key.toString();
};

s3utils.getSignedUrl = function (options, cb) {
    var err;
    if (!options || !options.key) {
        Util.log('Invalid s3 object key name');
        err = new Error('Invalid s3 object key name');
        return cb(err);
    }
    if (['putObject', 'getObject'].indexOf(options.requestType) === -1) {
        Util.log('Invalid request type for signing url');
        err = new Error('Invalid request type for signing url');
        return cb(err);
    }
    var destination = options.destination;
    var params = {
        Bucket: options.bucket, // Private payout object
        Key: destination ? destination + '/' + options.key : options.key,
        Expires: options.expires || 30, //in secs,
    };
    S3.getSignedUrl(options.requestType, params, function (err, url) {
        if (err) {
            Util.log('Error generating signed URL for object ' + params.Key + '  ' + (err.message || err));
        }
        return cb(err, url);
    });
};


module.exports = s3utils;

(function () {

    if (require.main === module) {
        var fs = require('fs');
        var metadata = {
            acl: 'public-read'
        };
        fs.readFile('app.js', function (err, buffer) {
            s3utils.putObject(buffer, 'app.js', 'text/javascript', null, Constants.SCOPEHUB_TWILIO_BUCKET, metadata, console.log);
        });

        //var existKey = {
        //    key: 'address.png'
        //};
        //
        //s3utils.s3ObjectExists(existKey, function (err, data) {
        //    console.log(err, data);
        //});
        //
        //var options = {
        //    key: 'address.png',
        //    urlType: 'SYSTEM'
        //};
        //
        //s3utils.getUrlforS3Key(options, function (err, res) {
        //    console.log(err, res);
        //});
    }
}());