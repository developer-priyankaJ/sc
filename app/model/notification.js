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


var Notification = Vogels.define('Notification', {
    hashKey: 'id',
    timestamps: true,

    schema: {
        id: Vogels.types.uuid(),
        notificationReferenceId: Joi.number().required(),
        topicId: Joi.string().required(),
        userData: Joi.object(),
        params: Joi.object(),
        type: Joi.string().required(),
        timestamp: Joi.number(),
        meta: Joi.object(),
        snoozeNextUtcTime: Joi.number(),
        contactId: Joi.string(),
        notificationExpirationDate: Joi.number(),
        partnerId: Joi.string(),
        dataShareId: Joi.string()
    },

    indexes: [{
        hashKey: 'topicId',
        rangeKey: 'timestamp',
        name: 'TopicTimestampIndex',
        type: 'global'
    }, {
        hashKey: 'topicId',
        rangeKey: 'snoozeNextUtcTime',
        name: 'TopicSnoozeNextUtcTimeIndex',
        type: 'global'
    }, {
        hashKey: 'contactId',
        name: 'ContactIdIndex',
        type: 'global'
    }]
});

Notification.config({
    tableName: 'Notification'
});
/*Vogels.createTables(function(err) {
 if (err) {
 console.log('Error creating tables: ', err);
 } else {
 console.log(' New Tables has been created For Notification');
 }
 });*/
module.exports = Notification;
