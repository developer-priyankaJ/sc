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

var GroupContacts = Vogels.define('GroupContacts', {
    hashKey: 'id',
    timestamps: true,

    schema: {
        id: Vogels.types.uuid(),
        groupId: Joi.string(),
        contactId: Joi.string(),
        createdBy: Joi.string(),
        updatedBy: Joi.string(),
        memberStartDate: Joi.number(),
        memberEndDate: Joi.number()
    },
    indexes: [{
        hashKey: 'groupId',
        name: 'GroupIndex',
        type: 'global'
    }, {
        hashKey: 'groupId',
        rangeKey: 'memberEndDate',
        name: 'GroupMemberEndDateIndex',
        type: 'global'
    }, {
        hashKey: 'contactId',
        rangeKey: 'groupId',
        name: 'ContactGroupIndex',
        type: 'global'
    }]
});

GroupContacts.config({
    tableName: 'GroupContacts'
});


/*Vogels.createTables(function (err) {
 if (err) {
 console.log('Error creating tables: ', err);
 } else {
 console.log(' New Tables has been created For GroupContacts');
 }
 });*/

module.exports = GroupContacts;
