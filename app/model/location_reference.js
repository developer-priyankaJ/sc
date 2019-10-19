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

var LocationReference = Vogels.define('location_reference', {
    hashKey: 'accountIdLocationId',
    timestamps: true,
    schema: {
        accountIdLocationId: Joi.string(),
        accountId: Joi.string(),
        locationId: Joi.string(),
        locationCode: Joi.string(),
        locationName: Joi.string(),
        companyName: Joi.string(),
        contactFirstName: Joi.string(),
        contactLastName: Joi.string(),
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
        googleLink : Joi.string(),
        createdBy: Joi.string(),
        updatedBy: Joi.string()
    },
    indexes: [{
        hashKey: 'accountId',
        name: 'AccountIdIndex',
        type: 'global'
    }]
});

LocationReference.config({
    tableName: 'LocationReference'
});
// Vogels.createTables(function (err) {
//     if (err) {
//         console.log('Error creating tables: ', err);
//     } else {
//         console.log(' New Tables has been created For LocationReference');
//     }
// });
module.exports = LocationReference;
