'use strict';
/*jslint node: true */

var AWS = require('aws-sdk');
var AwsConfig = require('../config/aws');

var S3 = new AWS.S3({
    endpoint: AwsConfig.s3EndpointEU,
    accessKeyId: AwsConfig.accessKeyId,
    secretAccessKey: AwsConfig.secretAccessKey,
    sslEnabled: true,
    region: 'eu-west-1',
    signatureVersion: 'v4'
});

module.exports = S3;
