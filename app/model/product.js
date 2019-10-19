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


var Product = Vogels.define('ProductByMP', {
    hashKey: 'id',
    timestamps: true,

    schema: {
        id: Vogels.types.uuid(),
        sellerId: Joi.string(),
        accountId: Joi.string(),
        accountIdSKU: Joi.string(),
        sku: Joi.string(),
        MPProductId: Joi.object(),
        barcode: Joi.string(),
        MPCategoryId1: Joi.string(),
        MPCategoryId2: Joi.string(),
        MPCategoryId3: Joi.string(),
        MPRank1: Joi.string(),
        MPRank2: Joi.string(),
        MPRank3: Joi.string(),
        brand: Joi.string(),
        harmonizedCode: Joi.string(),
        countryOfManufacture: Joi.string(),
        averageRetailPrice: Joi.number(),
        retailPriceUoM: Joi.string(),
        averageCost: Joi.number(),
        costUoM: Joi.string(),
        wholesalePrice: Joi.number(),
        wholesalePriceUom: Joi.string(),
        declaredValue: Joi.number(),
        declaredValueUoM: Joi.string(),
        supplierAccountId: Joi.string(),
        supplierProductId: Joi.string(),
        supplierSKU: Joi.string(),
        supplierSKUName: Joi.string(),
        supplierProductBarcode: Joi.string(),
        createdBy: Joi.string(),
        updatedBy: Joi.string(),
        imageUrl: Joi.string(),
        imageHeight: Joi.number(),
        imageHeightUoM: Joi.string(),
        imageWidth: Joi.number(),
        imageWidthUoM: Joi.string(),
        productTitle: Joi.string(),
        packageQuantity: Joi.number(),
        marketplaceId: Joi.string(),
        description: Joi.string(),
        sellerProductMPId: Joi.string(),
        postSubmitfeedRequestId: Joi.string(),
        quantitySubmitfeedRequestId: Joi.string(),
        priceSubmitfeedRequestId: Joi.string(),
        unitOfMeasure: Joi.string(),
        classificationCode: Joi.string(),
        classificationSystem: Joi.string()
    },

    indexes: [{
        hashKey: 'accountId',
        name: 'AccountProductIndex',
        type: 'global'
    }, {
        hashKey: 'accountId',
        rangeKey: 'marketplaceId',
        name: 'AccountMarketplaceIndex',
        type: 'global'
    }, {
        hashKey: 'sellerProductMPId',
        name: 'SellerProductMPIdIndex',
        type: 'global'
    }, {
        hashKey: 'accountIdSKU',
        name: 'AccountIdSKUIndex',
        type: 'global'
    }]
});

Product.config({
    tableName: 'ProductByMP'
});

/*
 Vogels.createTables(function (err) {
 if (err) {
 console.log('Error creating tables: ', err);
 } else {
 console.log(' New Tables has been created For ProductByMP');
 }
 });*/
module.exports = Product;