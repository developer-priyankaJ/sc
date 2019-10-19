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
var Document = Vogels.define('Document', {
    hashKey: 'name',
    rangeKey: 'language',

    schema: {
        name: Joi.string().required(),
        language: Joi.string().required(),
        content: Joi.string().required()
    }
});

Document.config({
    tableName: 'Document'
});

module.exports = Document;
