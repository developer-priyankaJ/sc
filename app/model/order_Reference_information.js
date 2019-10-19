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

var OrderReferenceInformation = Vogels.define('OrderReferenceInformation', {

    hashKey: 'accountIdMarketPlaceIdOrderId',
    timestamps: true,
    schema: {
        accountIdMarketPlaceIdOrderId: Joi.string(),
        accountId: Joi.string(),
        timestamp: Joi.number(),
        latestShipDate: Joi.string(),
        orderType: Joi.string(),
        purchaseDate: Joi.string(),
        amazonOrderId: Joi.string(),
        buyerEmail: Joi.string(),
        isReplacementOrder: Joi.boolean(),
        lastUpdateDate: Joi.string(),
        numberOfItemsShipped: Joi.string(),
        shipServiceLevel: Joi.string(),
        orderStatus: Joi.string(),
        salesChannel: Joi.string(),
        shippedByAmazonTFM: Joi.boolean(),
        isBusinessOrder: Joi.boolean(),
        latestDeliveryDate: Joi.string(),
        numberOfItemsUnshipped: Joi.string(),
        paymentMethodDetails: Joi.object(),
        buyerName: Joi.string(),
        earliestDeliveryDate: Joi.string(),
        orderTotal: Joi.object(),
        isPremiumOrder: Joi.boolean(),
        earliestShipDate: Joi.string(),
        marketplaceId: Joi.string(),
        fulfillmentChannel: Joi.string(),
        paymentMethod: Joi.string(),
        shippingAddress: Joi.object(),
        isPrime: Joi.boolean(),
        shipmentServiceLevelCategory: Joi.string(),
        sellerOrderId: Joi.string(),
        status: Joi.string(),
        createdBy: Joi.string(),
        recordType: Joi.string(),
        history: Joi.array()
    },
    indexes: [{
        hashKey: 'accountId',
        rangeKey: 'timestamp',
        name: 'AccountIdTimestampIndex',
        type: 'global'
    }]
});

OrderReferenceInformation.config({
    tableName: 'OrderReferenceInformation'
});
/*
Vogels.createTables(function (err) {
    if (err) {
        console.log('Error creating tables: ', err);
    } else {
        console.log(' New Tables has been created For OrderReferenceInformation');
    }
});*/

module.exports = OrderReferenceInformation;