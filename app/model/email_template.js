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
var EmailTemplate = Vogels.define('EmailTemplate', {
    hashKey: 'name',
    rangeKey: 'languageCultureCode',

    schema: {
        name: Joi.string().required(),
        languageCultureCode: Joi.string().required(),
        content: Joi.string().required(),
        bannerColor: Joi.string().required(),
        bannerText: Joi.string().required(),
        emailSubject: Joi.string().required(),
        description: Joi.string().required()
    }
});

EmailTemplate.config({
    tableName: 'EmailTemplate'
});

module.exports = EmailTemplate;
