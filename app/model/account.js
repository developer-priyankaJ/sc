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

var Account = Vogels.define('Account', {

    hashKey: 'id',
    // add the timestamp attributes (updatedAt, createdAt)
    timestamps: true,

    schema: {
        id: Vogels.types.uuid(),
        companyName: Joi.string(),
        contactName: Joi.string(),
        address: Joi.string(),
        mailingAddress: Joi.string(),
        phones: Vogels.types.stringSet(),
        fax: Vogels.types.stringSet(),
        email: Joi.string(),
        ownerUUID: Joi.string(),
        type: Joi.string(),                   // NGO, Educational or Others
        isMultiUser: Joi.boolean(),
        active: Joi.boolean(),
        marketplaces: Joi.object(),
        city: Joi.string(),
        streetAddress1: Joi.string(),
        streetAddress2: Joi.string(),
        comment: Joi.string(),
        createdBy: Joi.string(),
        updatedBy: Joi.string(),
        firstName: Joi.string(),
        lastName: Joi.string(),
        authToken: Joi.string(),
        orderTimeInterval: Joi.number()
    },

    indexes: [{
        hashKey: 'authToken',
        name: 'AuthTokenIndex',
        type: 'global'
    }, {
        hashKey: 'id',
        rangeKey: 'orderTimeInterval',
        name: 'AccountIdOrderTimeIntervalIndex',
        type: 'global'
    }]
});

Account.config({
    tableName: 'Account'
});
/*Vogels.createTables(function (err) {
    if (err) {
        console.log('Error creating tables: ', err);
    } else {
        console.log('Tables has been created For Accounts');
    }
});*/

module.exports = Account;