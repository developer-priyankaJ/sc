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

//  We must have an extra field called 'active' - to activate/deactivate user in future - DONE
// Also keep all the keys of the table starting with upper case letter - as per DynamoDb convention- DONE
var MeasurementReference = Vogels.define('MeasurementReference', {
    hashKey: 'id',
    timestamps: true,

    schema: {
        id: Vogels.types.uuid(),
        measureId: Joi.number().required(),
        shortName: Joi.string().required(),
        longName: Joi.string().required(),
        scalingFactor: Joi.string().required(),
        createdBy: Joi.string(),
        updatedBy: Joi.string()
    },
    indexes: [{
        hashKey: 'measureId',
        rangeKey: 'shortName',
        name: 'shortNameIndex',
        type: 'global'
    }]
});

MeasurementReference.config({
    tableName: 'MeasurementReference'
});

/*Vogels.createTables(function (err) {
    if (err) {
        console.log('Error creating tables: ', err);
    } else {
        console.log(' New Tables has been created For MeasurementReference');
    }
});*/
module.exports = MeasurementReference;
