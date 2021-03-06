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

var globalInviteState = Vogels.define('globalInviteState', {
    hashKey: 'email',

    // add the timestamp attributes (updatedAt, createdAt)
    timestamps: true,

    schema: {
        inviteFrom: Joi.string().email(),
        inviteTo: Vogels.types.stringSet(),
        inviteToFirstName: Joi.string(),
        inviteToLastName: Joi.string()
    }
});

userInvite.config({
    tableName: 'globalInviteState'
});

module.exports = userInvite;
