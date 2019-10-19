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
var Contact = Vogels.define('Contact', {
    hashKey: 'id',
    timestamps: true,

    schema: {
        id: Vogels.types.uuid(),
        inviterUUID: Joi.string(),
        inviteeUUID: Joi.string(),
        invitationUTCTime: Joi.string(),
        actionUTCTime: Joi.string(),
        firstName: Joi.string(),
        lastName: Joi.string(),
        nickName: Joi.string(),
        company: Joi.string(),
        fax: Joi.string(),
        phone: Joi.string(),
        personalMessage: Joi.string(),
        notes: Joi.string(),
        status: Joi.string(),
        invitationExpirationDate: Joi.number(),
        createdBy: Joi.string(),
        inviteeEmail: Joi.string(),
        isActive: Joi.boolean()
    },
    indexes: [{
        hashKey: 'inviterUUID',
        name: 'InviterUUIDIndex',
        type: 'global'
    }, {
        hashKey: 'inviteeUUID',
        rangeKey: 'inviterUUID',
        name: 'InviteeUUIDIndex',
        type: 'global'
    }, {
        hashKey: 'inviterUUID',
        rangeKey: 'inviteeEmail',
        name: 'InviterUUIDInviteeEmailIndex',
        type: 'global'
    }, {
        hashKey: 'status',
        name: 'StatusIndex',
        type: 'global'
    }]
});

Contact.config({
    tableName: 'Contact'
});
/*Vogels.createTables(function (err) {
 if (err) {
 console.log('Error creating tables: ', err);
 } else {
 console.log(' New Tables has been created For Contact');
 }
 });*/
module.exports = Contact;
