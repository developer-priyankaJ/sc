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

var Replication = Vogels.define('Replication', {

    hashKey: 'id',
    timestamps: true,
    schema: {
        id: Vogels.types.uuid(),
        accountId: Joi.string(),
        marketplaceId: Joi.string(),
        types: Joi.number(),
        orderTimeInterval: Joi.number(),
        createdAfter: Joi.string(),
        startDate: Joi.string(),
        nextReplicationTime: Joi.number(),
        startTime: Joi.string(),
        endTime: Joi.string(),
        numberOfOrders: Joi.number(),
        numberOfItems: Joi.number(),
        status: Joi.string()
    },
    indexes: [{
        hashKey: 'marketplaceId',
        name: 'MarketplaceIndex',
        type: 'global'
    }, {
        hashKey: 'status',
        rangeKey: 'marketplaceId',
        name: 'StatusMarketplaceIdIndex',
        type: 'global'
    }, {
        hashKey: 'status',
        rangeKey: 'nextReplicationTime',
        name: 'StatusNextReplicationTimeIndex',
        type: 'global'
    }, {
        hashKey: 'accountId',
        rangeKey: 'createdAt',
        name: 'CreatedAtAccountIndex',
        type: 'global'
    }]
});

Replication.config({
    tableName: 'Replication'
});

/*Vogels.createTables(function (err) {
    if (err) {
        console.log('Error creating tables: ', err);
    } else {
        console.log(' New Tables has been created For Replication');
    }
});*/

module.exports = Replication;