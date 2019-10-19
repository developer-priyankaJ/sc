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

var Marketplace = Vogels.define('Marketplace', {
    hashKey: 'marketplaceId',
    timestamps: true,

    schema: {
        marketplaceId: Joi.string(),
        marketplaceName: Joi.string(),
        region: Joi.string(),
        active: Joi.boolean(),
        marketplaceLink: Joi.string(),
        imageURL: Joi.array()
    }
});

Marketplace.config({
    tableName: 'Marketplace'
});

module.exports = Marketplace;
