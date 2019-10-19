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

var OrderLineItems = Vogels.define('OrderLineItems', {

    hashKey: 'accountIdMarketPlaceIdOrderIdOrderItemId',
    timestamps: true,
    schema: {
        accountIdMarketPlaceIdOrderIdOrderItemId: Joi.string(),
        accountIdMarketPlaceIdOrderId: Joi.string(),
        accountIdSellerSKU: Joi.string(),
        quantityOrdered: Joi.string(),
        title: Joi.string(),
        shippingTax: Joi.object(),
        promotionDiscount: Joi.object(),
        conditionId: Joi.string(),
        ASIN: Joi.string(),
        sellerSKU: Joi.string(),
        orderItemId: Joi.string(),
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
        conditionNote: Joi.string().allow(''),
        status: Joi.string(),
        createdBy: Joi.string(),
        recordType: Joi.string(),
        unitOfMeasure: Joi.string(),
        orderType: Joi.string()
    },
    indexes: [{
        hashKey: 'accountIdMarketPlaceIdOrderId',
        name: 'AccountIdMarketPlaceIdOrderIdIndex',
        type: 'global'
    }, {
        hashKey: 'accountIdSellerSKU',
        name: 'AccountIdSellerSKU',
        type: 'global'
    }]
});

OrderLineItems.config({
    tableName: 'OrderLineItems'
});
/*

Vogels.createTables(function (err) {
    if (err) {
        console.log('Error creating tables: ', err);
    } else {
        console.log(' New Tables has been created For OrderLineItems');
    }
});
*/

module.exports = OrderLineItems;