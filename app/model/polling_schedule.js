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

var PollingSchedule = Vogels.define('PollingSchedule', {
    hashKey: 'id',
    // add the timestamp attributes (updatedAt, createdAt)
    timestamps: true,

    schema: {
        id: Vogels.types.uuid(),
        accountId: Joi.string(),
        marketplaceId: Joi.string(),
        refreshInterval: Joi.number(), // time in minutes
        entities: Vogels.types.stringSet(),
        sqsMessageId: Joi.string(),
        isVisibilityTimeoutSet: Joi.boolean(),
        active: Joi.boolean()
    },
    indexes: [{
        hashKey: 'accountId',
        rangeKey: 'createdAt',
        name: 'AccountIdIndex',
        type: 'global'
    }, {
        hashKey: 'sqsMessageId',
        name: 'SQSMessageIdIndex',
        type: 'global'
    }]
});

PollingSchedule.config({
    tableName: 'PollingSchedule'
});

module.exports = PollingSchedule;
