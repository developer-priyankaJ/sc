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

var Permission = Vogels.define('Permission', {
    hashKey: 'id',
    timestamps: true,
    schema: {
        id: Vogels.types.uuid(),
        roleId: Joi.string(),
        dashboard: Joi.object(),
        demand: Joi.object(),
        operation: Joi.object(),
        supply: Joi.object(),
        reference: Joi.object(),
        accountSettings: Joi.object()
    },
    indexes: [{
        hashKey: 'roleId',
        name: 'RoleIdIndex',
        type: 'global'
    }]
});

Permission.config({
    tableName: 'Permission'
});

/*Vogels.createTables(function (err) {
    if (err) {
        console.log('Error creating tables: ', err);
    } else {
        console.log('Tables has been created For Permission');
    }
});*/

module.exports = Permission;
