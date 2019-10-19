/* jslint node: true */
'use strict';

var VogelsConfig = require('../config/vogels');
var AwsConfig = require('../config/aws');

var Vogels = require('vogels-promisified');
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

var BillOfMaterials = Vogels.define('BillOfMaterials', {
    hashKey: 'accountId_productId_supplyItemSKU',
    timestamps: true,

    schema: {
        accountId_productId_supplyItemSKU: Joi.string(),
        accountId: Joi.string(),
        productId: Joi.string(),
        supplyItemSKU: Joi.string(),
        quantity: Joi.number(),
        unitOfMeasureId: Joi.string(),
        unitOfMeasureName: Joi.string()
    },
    indexes: [{
        hashKey: 'productId',
        name: 'ProductIdIndex',
        type: 'global'
    }]
});

BillOfMaterials.config({
    tableName: 'BillOfMaterials'
});

/*
Vogels.createTables(function (err) {
    if (err) {
        console.log('Error creating tables: ', err);
    } else {
        console.log(' New Tables has been created For BillOfMaterials');
    }
});
*/


module.exports = BillOfMaterials;