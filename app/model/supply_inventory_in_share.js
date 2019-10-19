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

var SupplyInventoryInShare = Vogels.define('SupplyInventoryInShare', {
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
        qtyAvailable: Joi.string(),
        qtyOnHand: Joi.string(),
        qtyOnOrder: Joi.string(),
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

SupplyInventoryInShare.config({
    tableName: 'SupplyInventoryInShare'
});

/*Vogels.createTables(function (err) {
    if (err) {
        console.log('Error creating tables: ', err);
    } else {
        console.log(' New Tables has been created For SupplyInventoryInShare');
    }
});*/


module.exports = SupplyInventoryInShare;