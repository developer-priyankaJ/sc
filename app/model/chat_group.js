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

var ChatGroup = Vogels.define('ChatGroup', {
    hashKey: 'id',
    timestamps: true,

    schema: {
        id: Vogels.types.uuid(),
        sender: Joi.string().required(),
        receiver: Joi.string().required(),
        contactId: Joi.string().required(),
        createdBy: Joi.string(),
        updatedBy: Joi.string()
    },
    indexes: [{
        hashKey: 'sender',
        rangeKey: 'receiver',
        name: 'SenderReceiverIndex',
        type: 'global'
    }, {
        hashKey: 'sender',
        name: 'SenderIndex',
        type: 'global'
    }, {
        hashKey: 'receiver',
        name: 'ReceiverIndex',
        type: 'global'
    }]
});

ChatGroup.config({
    tableName: 'ChatGroup'
});
/*

 Vogels.createTables(function (err) {
 if (err) {
 console.log('Error creating tables: ', err);
 } else {
 console.log(' New Tables has been created For ChatGroup');
 }
 });
 */


module.exports = ChatGroup;