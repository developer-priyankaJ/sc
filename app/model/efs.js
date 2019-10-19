'use strict';
/*jslint node: true */

var AWS = require('aws-sdk');
var AwsConfig = require('../config/aws');

var EFS = new AWS.EFS({
    endpoint: 'fs-4bec4483.efs.eu-west-1.amazonaws.com',
    accessKeyId: 'AKIAJ745V5H57GS6NJZA',
    secretAccessKey: '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',
    sslEnabled: true,
    region: 'us-west-2'
});

module.exports = EFS;
