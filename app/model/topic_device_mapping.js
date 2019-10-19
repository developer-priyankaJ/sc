/* jslint node: true */

'use strict';

var VogelsConfig = require('../config/vogels');
var AwsConfig = require('../config/aws');

var Vogels = require('vogels');
var Joi = require('joi');

Vogels.AWS.config.update({
    accessKeyId: VogelsConfig.ACCESS_KEY_ID,
    secretAccessKey: VogelsConfig.SECRET_ACCESS_KEY,
    region: VogelsConfig.REGION
});
var options = {
    endpoint: AwsConfig.dynamodbEndpoint
};
var dynamodb = new Vogels.AWS.DynamoDB(options);
Vogels.dynamoDriver(dynamodb);


var TopicDeviceMapping = Vogels.define('TopicDeviceMapping', {
    hashKey: 'topicId',
    timestamps: true,

    schema: {
        topicId: Joi.string().required(),
        deviceIds: Joi.array()
    }
});

TopicDeviceMapping.config({
    tableName: 'TopicDeviceMapping'
});

module.exports = TopicDeviceMapping;
