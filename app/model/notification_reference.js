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


var NotificationReference = Vogels.define('NotificationReference', {
    hashKey: 'id',
    rangeKey: 'languageCultureCode',
    timestamps: true,

    schema: {
        id: Joi.number().required(),
        meta: Joi.string().required(),
        description: Joi.string().required(),
        actions: Joi.object(),
        category: Joi.string().required(),
        categoryId: Joi.number().required(),
        subCategory: Joi.string(),
        defaultType: Joi.string().required(),
        languageCultureCode: Joi.string().required(),
        active: Joi.boolean()
    },

    indexes: [{
        hashKey: 'meta',
        name: 'MetaIndex',
        type: 'global'
    }]
});

NotificationReference.config({
    tableName: 'NotificationReference'
});

module.exports = NotificationReference;