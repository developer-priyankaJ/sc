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



var SecurityQuestion = Vogels.define('SecurityQuestion', {
    hashKey: 'id',

    // add the timestamp attributes (updatedAt, createdAt)
    timestamps: true,

    schema: {
        id: Vogels.types.uuid(),
        text: Joi.string(),
        active: Joi.boolean().default(true)
    }
});

SecurityQuestion.config({
    tableName: 'SecurityQuestion'
});

/*Vogels.createTables(function(err) {
    if (err) {
        console.log('Error creating tables: ', err);
    } else {
        console.log('Tables has been created');
    }
});*/
module.exports = SecurityQuestion;
