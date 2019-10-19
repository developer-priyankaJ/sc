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

var OrdersLog = Vogels.define('OrdersLog', {
    hashKey: 'id',
    timestamps: true,

    schema: {
        id: Vogels.types.uuid(),
        requestType: Joi.string().required(), // Request or api response
        endpoint: Joi.string().required(),
        params: Joi.string(),
        response: Joi.string(),
        requestId: Joi.string(),
        userId: Joi.string(),
        accountId: Joi.string(),
        platform: Joi.string(),
        marketplace: Joi.string(),
        metaData: Joi.string()
    }
});

OrdersLog.config({
    tableName: 'OrdersLog'
});

/*
Vogels.createTables(function (err) {
    if (err) {
        console.log('Error creating tables: ', err);
    } else {
        console.log(' New Tables has been created For Orders log');
    }
});
*/

module.exports = OrdersLog;

