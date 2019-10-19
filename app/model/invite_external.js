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

var UserInviteExternal = Vogels.define('UserInviteExternal', {
    hashKey: 'id',
    rangeKey: 'contact',
    // add the timestamp attributes (updatedAt, createdAt)
    timestamps: true,

    schema: {
        id: Vogels.types.uuid(),
        contact: Joi.string().email(),
        invitedContactEmail: Joi.string().email(),
        inviteStatus: Joi.string(),
        invitedContactName: Joi.string(),
        inviteMessage: Joi.string()
    },

    indexes: [{
        hashKey: 'invitedContactEmail',
        rangeKey: 'contact',
        name: 'ExternalInvite',
        type: 'global'
    }]

});

UserInviteExternal.config({
    tableName: 'UserInviteExternal'
});

// Vogels.createTables(function(err) {
//     if (err) {
//         console.log('Error creating tables: ', err);
//     } else {
//         console.log('Tables has been created For GroupContacts');
//     }
// });

module.exports = UserInviteExternal;
