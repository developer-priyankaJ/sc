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

var Customer = Vogels.define('Customer', {
    hashKey: 'accountIdCustomerId',
    timestamps: true,
    schema: {
        accountIdCustomerId: Joi.string(),
        accountId: Joi.string(),
        customerId: Joi.string(),
        customerCode: Joi.string(),
        customerName: Joi.string(),
        companyName: Joi.string(),
        firstName: Joi.string(),
        lastName: Joi.string(),
        email: Joi.string(),
        phone: Joi.string(),
        fax: Joi.string(),
        streetAddress1: Joi.string(),
        streetAddress2: Joi.string(),
        city: Joi.string(),
        postalCode: Joi.string(),
        countryCode: Joi.string(),
        latitude: Joi.number(),
        longitude: Joi.number(),
        googleLink: Joi.string(),
        createdBy: Joi.string(),
        updatedBy: Joi.string(),
        recordType: Joi.string()
    },
    indexes: [{
        hashKey: 'accountId',
        name: 'AccountIdIndex',
        type: 'global'
    }]
});

Customer.config({
    tableName: 'Customer'
});
/*Vogels.createTables(function (err) {
    if (err) {
        console.log('Error creating tables: ', err);
    } else {
        console.log(' New Tables has been created For Customer');
    }
});*/
module.exports = Customer;
