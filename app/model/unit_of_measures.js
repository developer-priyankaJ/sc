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

var UnitOfMeasures = Vogels.define('UnitOfMeasures', {
    hashKey: 'id',
    timestamps: true,
    schema: {
        id: Vogels.types.uuid(),
        accountId:Joi.string(),
        catId:Joi.string(),
        precision: Joi.number(),
        scalingFactor: Joi.number(),
    },
    indexes: [{
        hashKey: 'accountId',
        name: 'AccountIdIndex',
        type: 'global'
    }]
});

UnitOfMeasures.config({
    tableName: 'UnitOfMeasures'
});

/*
Vogels.createTables(function (err) {
    if (err) {
        console.log('Error creating tables: ', err);
    } else {
        console.log('Tables has been created For Unit Of Measure');
    }
});*/

module.exports = UnitOfMeasures;

























module.exports = UnitOfMeasures;