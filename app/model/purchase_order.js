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

var PurchaseOrders = Vogels.define('PurchaseOrder', {

    hashKey: 'accountIdMarketPlaceIdPurchaseOrderId',
    timestamps: true,
    schema: {
        accountIdMarketPlaceIdPurchaseOrderId: Joi.string(),
        accountId: Joi.string(),
        latestShipDate: Joi.string(),
        purchaseOrderType: Joi.string(),
        purchaseDate: Joi.string(),
        purchaseOrderId: Joi.string(),
        supplierEmail: Joi.string(),
        isReplacementOrder: Joi.boolean(),
        lastUpdateDate: Joi.string(),
        numberOfItemsShipped: Joi.string(),
        shipServiceLevel: Joi.string(),
        purchaseOrderStatus: Joi.string(),
        salesChannel: Joi.string(),
        shippedByAmazonTFM: Joi.boolean(),
        isBusinessOrder: Joi.boolean(),
        latestDeliveryDate: Joi.string(),
        numberOfItemsUnshipped: Joi.string(),
        paymentMethodDetails: Joi.object(),
        supplierName: Joi.string(),
        earliestDeliveryDate: Joi.string(),
        purchaseOrderTotal: Joi.object(),
        isPremiumOrder: Joi.boolean(),
        earliestShipDate: Joi.string(),
        fulfillmentChannel: Joi.string(),
        paymentMethod: Joi.string(),
        shippingAddress: Joi.object(),
        isPrime: Joi.boolean(),
        shipmentServiceLevelCategory: Joi.string(),
        sellerOrderId: Joi.string()
    }
});

PurchaseOrders.config({
    tableName: 'PurchaseOrders'
});

/*
Vogels.createTables(function (err) {
    if (err) {
        console.log('Error creating tables: ', err);
    } else {
        console.log(' New Tables has been created For PurchaseOrders');
    }
});
*/

module.exports = PurchaseOrders;