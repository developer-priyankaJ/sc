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

var InShare = Vogels.define('InShare', {
    hashKey: 'itemIdSharingProfileIdPartnerId',
    timestamps: true,
    schema: {
        itemIdSharingProfileIdPartnerId: Joi.string(),
        itemType: Joi.string(),
        accountId: Joi.string(),
        status: Joi.string(),
        createdBy: Joi.string(),
        updatedBy: Joi.string(),
        inShareId: Joi.string(),
        inShareName: Joi.string(),
        partner: Joi.string(),
        contact: Joi.string(),
        receivedDate: Joi.string(),
        activeDate: Joi.string(),
        itemId: Joi.string(),
        itemIdSharingProfileId: Joi.string(),
        type: Joi.string(),
        notes: Joi.string(),
        history: Joi.array(),
        startDate: Joi.string()
    },
    indexes: [{
        hashKey: 'accountId',
        name: 'AccountIdIndex',
        type: 'global'
    }, {
        hashKey: 'itemIdSharingProfileId',
        name: 'ItemIdSharingProfileIdIndex',
        type: 'global'
    }]
});

InShare.config({
    tableName: 'InShare'
});
/*Vogels.createTables(function (err) {
    if (err) {
        console.log('Error creating tables: ', err);
    } else {
        console.log(' New Tables has been created For InShare');
    }
});*/
module.exports = InShare;
