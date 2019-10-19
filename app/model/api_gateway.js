'use strict';
/*jslint node: true */

var AWS = require('aws-sdk');
var AwsConfig = require('../config/aws');

var ApiGateway = new AWS.APIGateway({
    accessKeyId: AwsConfig.accessKeyId,
    secretAccessKey: AwsConfig.secretAccessKey,
    region: AwsConfig.REGION
});

module.exports = ApiGateway;