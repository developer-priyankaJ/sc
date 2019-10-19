'use strict';
/*jslint node: true */

var AWS = require('aws-sdk');
var AwsConfig = require('../config/aws');

var S3 = new AWS.S3({
    endpoint: AwsConfig.s3EndpointEUFrankfurt,
    accessKeyId: AwsConfig.accessKeyId,
    secretAccessKey: AwsConfig.secretAccessKey,
    sslEnabled: true,
    region: AwsConfig.s3RegionEUFrankfurt,
    signatureVersion: 'v4'
});

module.exports = S3;
