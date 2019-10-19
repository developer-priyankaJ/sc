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

var ProductOrderInShare = Vogels.define('ProductOrderInShare', {
    hashKey: 'id',
    rangeKey : 'createdAt',
    timestamps: true,

    schema: {
        id: Vogels.types.uuid(),
        itemIdSharingProfileIdPartnerId: Joi.string(),
        itemIdSharingProfileId: Joi.string(),
        itemId: Joi.string(),
        accountId: Joi.string(),
        sharingProfileId: Joi.string(),
        partnerAccountId: Joi.string(),
        productUpdatedAt: Joi.string(),
        orderPending: Joi.string(),
        orderShipped: Joi.string(),
        totalOrder: Joi.string(),
        noOfDays: Joi.number(),
        types: Joi.array(),
        unitOfMeasure: Joi.string()
    },
    indexes: [{
        hashKey: 'accountId',
        name: 'AccountIdIndex',
        rangeKey : 'createdAt',
        type: 'global'
    }]
});

ProductOrderInShare.config({
    tableName: 'ProductOrderInShare'
});

/*Vogels.createTables(function (err) {
    if (err) {
        console.log('Error creating tables: ', err);
    } else {
        console.log(' New Tables has been created For ProductOrderInShare');
    }
});*/


module.exports = ProductOrderInShare;