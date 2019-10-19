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

var MarketplaceLog = Vogels.define('MarketplaceLog', {
    hashKey: 'id',
    timestamps: true,

    schema: {
        id: Vogels.types.uuid(),
        requestType: Joi.string().required(), // Request or api response
        endpoint: Joi.string().required(),
        params: Joi.string(),
        response: Joi.string(),
        requestId: Joi.string(),
        userId: Joi.string(),
        accountId: Joi.string(),
        platform: Joi.string(),
        marketplace: Joi.string(),
        metaData: Joi.string()
    },

    indexes: [{
        hashKey: 'userId',
        name: 'UserIdIndex',
        type: 'global'
    },
    {
        hashKey: 'accountId',
        name: 'accountIdLogIndex',
        type: 'global'
    },
    {
        hashKey: 'platform',
        name: 'platformLogIndex',
        type: 'global'
    },
    {
        hashKey: 'requestId',
        name: 'requestIdILogndex',
        type: 'global'
    }]
});

MarketplaceLog.config({
    tableName: 'MarketplaceLog'
});

/*Vogels.createTables(function(err) {
 if (err) {
 console.log('Error creating tables: ', err);
 } else {
 console.log(' New Tables has been created For logs');
 }
 });*/

module.exports = MarketplaceLog;
