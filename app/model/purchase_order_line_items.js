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

var PurchaseOrderLineItems = Vogels.define('PurchaseOrderLineItems', {

    hashKey: 'accountIdMarketPlaceIdPurchaseOrderIdPurchaseOrderItemId',
    timestamps: true,
    schema: {
        accountIdMarketPlaceIdPurchaseOrderIdPurchaseOrderItemId: Joi.string(),
        accountIdMarketPlaceIdPurchaseOrderId: Joi.string(),
        purchaseOrderItemId: Joi.string(),
        accountIdSellerSKU: Joi.string(),
        quantityOrdered: Joi.string(),
        title: Joi.string(),
        shippingTax: Joi.object(),
        promotionDiscount: Joi.object(),
        conditionId: Joi.string(),
        sellerSKU: Joi.string(),
        productInfo: Joi.object(),
        giftWrapTax: Joi.object(),
        quantityShipped: Joi.string(),
        shippingPrice: Joi.object(),
        giftWrapPrice: Joi.object(),
        conditionSubtypeId: Joi.string(),
        itemPrice: Joi.object(),
        itemTax: Joi.object(),
        shippingDiscount: Joi.object(),
        isGift: Joi.boolean().allow(''),
        conditionNote: Joi.string().allow('')
    },
    indexes: [{
        hashKey: 'accountIdSellerSKU',
        name: 'AccountIdSellerSKUIndex',
        type: 'global'
    }]
});

PurchaseOrderLineItems.config({
    tableName: 'PurchaseOrderLineItems'
});

/*Vogels.createTables(function (err) {
    if (err) {
        console.log('Error creating tables: ', err);
    } else {
        console.log(' New Tables has been created For PurchaseOrderLineItems');
    }
});*/

module.exports = PurchaseOrderLineItems;