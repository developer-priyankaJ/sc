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

var Group = Vogels.define('Group', {
    hashKey: 'id',
    timestamps: true,

    schema: {
        id: Vogels.types.uuid(),
        ownerId: Joi.string().required(),
        name: Joi.string().required(),
        createdBy: Joi.string(),
        updatedBy: Joi.string()
    },
    indexes: [{
        hashKey: 'ownerId',
        rangeKey: 'name',
        name: 'OwnerGroupNameIndex',
        type: 'global'
    },{
        hashKey: 'name',
        name: 'GroupNameIndex',
        type: 'global'
    }]
});

Group.config({
    tableName: 'Group'
});

/*Vogels.createTables(function (err) {
    if (err) {
        console.log('Error creating tables: ', err);
    } else {
        console.log(' New Tables has been created For Group');
    }
});*/


module.exports = Group;