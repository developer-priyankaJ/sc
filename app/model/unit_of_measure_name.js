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

var UnitOfMeasureName = Vogels.define('UnitOfMeasureName', {
    hashKey: 'id',
    timestamps: true,
    schema: {
        id: Joi.string(),
        name: Joi.string(),
        symbol: Joi.string(),
        comment:Joi.string(),
    }
});

UnitOfMeasureName.config({
    tableName: 'UnitOfMeasureName'
});


/*Vogels.createTables(function (err) {
    if (err) {
        console.log('Error creating tables: ', err);
    } else {
        console.log('Tables has been created For Unit Of Measure Name');
    }
});*/

module.exports = UnitOfMeasureName;





















