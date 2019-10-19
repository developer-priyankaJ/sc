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

var UnitOfMeasure = Vogels.define('UnitOfMeasure', {
    hashKey: 'categoryIdCultureCodeScalingFactor',
    timestamps: true,
    schema: {
        categoryIdCultureCodeScalingFactor: Joi.string(),
        name: Joi.string(),
        symbol: Joi.string(),
        category: Joi.string(),
        precision: Joi.number(),
        scalingFactor: Joi.number(),
        languageCultureCode: Joi.string()
    }
});

UnitOfMeasure.config({
    tableName: 'UnitOfMeasure'
});

/*Vogels.createTables(function (err) {
    if (err) {
        console.log('Error creating tables: ', err);
    } else {
        console.log('Tables has been created For Unit Of Measure');
    }
});*/

module.exports = UnitOfMeasure;
