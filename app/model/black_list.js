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

var BlackList = Vogels.define('BlackList', {
    hashKey: 'id',
    timestamps: true,

    schema: {
        id: Vogels.types.uuid(),
        inviteeUUID: Joi.string().required(),
        inviterUUID: Joi.string(),
        inviterEmail: Joi.string(),
        inviterEmailDomain: Joi.string()
    },
    indexes: [{
        hashKey: 'inviteeUUID',
        name: 'InviteeUUIDIndex',
        type: 'global'
    }, {
        hashKey: 'inviteeUUID',
        rangeKey: 'inviterEmail',
        name: 'InviteeUUIDEmailIndex',
        type: 'global'
    }, {
        hashKey: 'inviteeUUID',
        rangeKey: 'inviterEmailDomain',
        name: 'InviteeUUIDEmailDomainIndex',
        type: 'global'
    }, {
        hashKey: 'inviteeUUID',
        rangeKey: 'inviterUUID',
        name: 'InviteeUUIDInviterUUIDIndex',
        type: 'global'
    }]
});

BlackList.config({
    tableName: 'BlackList'
});

/*Vogels.createTables(function (err) {
 if (err) {
 console.log('Error creating tables: ', err);
 } else {
 console.log(' New Tables has been created For BlackList');
 }
 });*/


module.exports = BlackList;