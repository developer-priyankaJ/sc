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

var OutShareInstance = Vogels.define('OutShareInstance', {
    hashKey: 'itemIdSharingProfileId',
    timestamps: true,
    schema: {
        itemIdSharingProfileId: Joi.string(),
        itemId: Joi.string(),
        itemType: Joi.string(),
        accountId: Joi.string(),
        sharingProfileId: Joi.string(),
        subscribers: Joi.array(),
        status: Joi.string(),
        startDate: Joi.string(),
        createdBy: Joi.string(),
        updatedBy: Joi.string(),
        customers: Joi.array(),
        history: Joi.array(),
        outShareId: Joi.string(),
        outShareName: Joi.string(),
        startDateType: Joi.string(),
        sharingDate: Joi.string()
    },
    indexes: [{
        hashKey: 'accountId',
        name: 'AccountIdIndex',
        type: 'global'
    }]
});

OutShareInstance.config({
    tableName: 'OutShareInstance'
});
/*Vogels.createTables(function (err) {
    if (err) {
        console.log('Error creating tables: ', err);
    } else {
        console.log(' New Tables has been created For OutShareInstance');
    }
});*/
module.exports = OutShareInstance;
