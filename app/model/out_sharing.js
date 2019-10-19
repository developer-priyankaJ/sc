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

var OutSharing = Vogels.define('OutSharing', {
    hashKey: 'accountIdProfileId',
    timestamps: true,
    schema: {
        id: Vogels.types.uuid(),
        accountIdProfileId: Joi.string(),
        accountId: Joi.string(),
        profileId: Joi.string(),
        type: Joi.string(),
        dataItems: Joi.array(),
        freqType: Joi.string(),
        freqTime: Joi.string(),
        freqDay: Joi.string(),
        profileName: Joi.string(),
        notes: Joi.string(),
        createdBy: Joi.string(),
        updatedBy: Joi.string(),
        noOfDays: Joi.string()
    },
    indexes: [{
        hashKey: 'accountId',
        name: 'AccountIdIndex',
        type: 'global'
    }]
});

OutSharing.config({
    tableName: 'OutSharing'
});
// Vogels.createTables(function (err) {
//     if (err) {
//         console.log('Error creating tables: ', err);
//     } else {
//         console.log(' New Tables has been created For OutSharing');
//     }
// });
module.exports = OutSharing;
