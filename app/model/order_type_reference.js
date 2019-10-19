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

var OrderTypeReference = Vogels.define('OrderTypeReference', {
    hashKey: 'id',
    timestamps: true,
    schema: {
        id: Joi.string(),
        type: Joi.array()
    }
});

OrderTypeReference.config({
    tableName: 'OrderTypeReference'
});
/*
Vogels.createTables(function (err) {
    if (err) {
        console.log('Error creating tables: ', err);
    } else {
        console.log(' New Tables has been created For OrderTypeReference');
    }
});*/


module.exports = OrderTypeReference;