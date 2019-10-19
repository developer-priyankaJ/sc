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


var SupplyItem = Vogels.define('SupplyItem', {
    hashKey: 'accountIdSKU',
    timestamps: true,

    schema: {
        id: Vogels.types.uuid(),
        unitOfMeasure:Joi.string(),
        accountIdSKU: Joi.string(),
        accountId: Joi.string().required(),
        sku: Joi.string(),
        sellerSKUName: Joi.string(),
        MPProductId: Joi.object(),
        marketplaceId: Joi.array(),
        GCID: Joi.string(),
        UPC: Joi.string(),
        EAN: Joi.string(),
        ISBN: Joi.string(),
        JAN: Joi.string(),
        articleNo: Joi.string(),
        modelNumber: Joi.string(),
        type: Joi.string(),
        tags: Joi.string(),
        countryOfManufacture: Joi.string(),
        weightAmount: Joi.number(),
        weightUoM: Joi.string(),
        heightAmount: Joi.number(),
        heightUoM: Joi.string(),
        lengthAmount: Joi.number(),
        lenghtUoM: Joi.string(),
        depthAmount: Joi.number(),
        depthUoM: Joi.string(),
        diameterAmount: Joi.number(),
        diameterUoM: Joi.string(),
        volumeAmount: Joi.number(),
        volumeUoM: Joi.string(),
        createdBy: Joi.string(),
        updatedBy: Joi.string(),
        classificationSystem: Joi.string(),
        classificationCode: Joi.string()
    },

    indexes: [{
        hashKey: 'accountId',
        name: 'AccountIdIndex',
        type: 'global'
    }, {
        hashKey: 'sku',
        name: 'SKUIndex',
        type: 'global'
    },]
});

SupplyItem.config({
    tableName: 'SupplyItem'
});
/*Vogels.createTables(function (err) {
    if (err) {
        console.log('Error creating tables: ', err);
    } else {
        console.log(' New Tables has been created For SupplyItem');
    }
});*/
module.exports = SupplyItem;