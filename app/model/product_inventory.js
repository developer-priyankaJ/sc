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


var ProductInventoy = Vogels.define('ProductInventoy', {

    hashKey: 'accountIdProductIdLocationId',
    // add the timestamp attributes (updatedAt, createdAt)
    timestamps: true,
    schema: {
        accountIdProductIdLocationId: Joi.string(),
        accountId: Joi.string(),
        accountIdSKU: Joi.string(),
        SKU: Joi.string(),
        type: Joi.string(), // FBM, FBA or custom
        locationId: Joi.string(),
        qtyOnHand: Joi.number(),
        qtyOnOrder: Joi.number(),
        qtyAvailable: Joi.number(),
        qtyInTransit: Joi.number(),
        notes: Joi.string(),
        outShares: Joi.array(),
        createdBy: Joi.string(),
        updatedBy: Joi.string(),
        unitOfMeasure: Joi.string()
    },
    indexes: [{
        hashKey: 'accountId',
        name: 'AccountIdIndex',
        type: 'global'
    }]
});

ProductInventoy.config({
    tableName: 'ProductInventoy'
});
/*
Vogels.createTables(function (err) {
    if (err) {
        console.log('Error creating tables: ', err);
    } else {
        console.log(' New Tables has been created For ProductInventoy');
    }
});*/
module.exports = ProductInventoy;