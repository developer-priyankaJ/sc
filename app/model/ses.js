'use strict';
/*jslint node: true */

var AWS = require('aws-sdk');
var AwsConfig = require('../config/aws');

var SES = new AWS.SES({
    accessKeyId: AwsConfig.accessKeyId,
    secretAccessKey: AwsConfig.secretAccessKey,
    region: AwsConfig.REGION
});

module.exports = SES;