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
var UserEmail = Vogels.define('UserEmail', {

    hashKey: 'id',
    // add the timestamp attributes (updatedAt, createdAt)
    timestamps: true,

    schema: {
        id: Vogels.types.uuid(),
        accountId: Joi.string(),
        userId: Joi.string(),
        timestamp: Joi.number(),
        subject: Joi.string(),
        sender: Joi.string(),
        s3url: Joi.string()
    }
});

UserEmail.config({
    tableName: 'UserEmail'
});


module.exports = UserEmail;
