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

var CronJob = Vogels.define('CronJob', {
    hashKey: 'name',
    timestamps: true,

    schema: {
        id: Vogels.types.uuid(),
        name: Joi.string(),
        startTime: Joi.string(),
        endTime: Joi.string(),
        status: Joi.string().allow('')
    }
});

CronJob.config({
    tableName: 'CronJob'
});

/*Vogels.createTables(function (err) {
    if (err) {
        console.log('Error creating tables: ', err);
    } else {
        console.log(' New Tables has been created For CronJob');
    }
});*/


module.exports = CronJob;