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

var UnitOfMeasureCategory = Vogels.define('UnitOfMeasureCategory', {
    hashKey: 'id',
    timestamps: true,
    schema: {
        id: Joi.string(),
        accountId:Joi.string(),
        name: Joi.string(),
        language: Joi.string(),
        comment: Joi.string()
    },
    indexes: [{
        hashKey: 'accountId',
        name: 'AccountIdIndex',
        type: 'global'
    }]
});

UnitOfMeasureCategory.config({
    tableName: 'UnitOfMeasureCategory'
});


/*
Vogels.createTables(function (err) {
    if (err) {
        console.log('Error creating tables: ', err);
    } else {
        console.log('Tables has been created For Unit Of Measure Category');
    }
});
*/

module.exports = UnitOfMeasureCategory;
