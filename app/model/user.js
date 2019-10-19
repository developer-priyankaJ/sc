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
var User = Vogels.define('User', {

    hashKey: 'id',
    // add the timestamp attributes (updatedAt, createdAt)
    timestamps: true,

    schema: {
        id: Vogels.types.uuid(),
        email: Joi.string().email().required(),
        firstName: Joi.string(),
        middleName: Joi.string(),
        lastName: Joi.string(),
        roles: Joi.array(),
        dateOfBirth: Joi.date().format('MM/DD/YYYY'),
        password: Joi.string(),
        phone: Joi.string(),
        captcha: Joi.string(),
        securityQuestions: Joi.array().unique(function (a, b) {
            return a.description = b.description;
        }).items(Joi.object().keys({
            description: Joi.string().required(),
            answer: Joi.string().required()
        })),
        verificationOption: Joi.any().valid('verifyFromPhone', 'verifyFromUnauthorized', 'never'),
        languageCultureCode: Joi.string().default('en-US'),
        isAdmin: Joi.boolean(),
        isReferral: Joi.boolean(),
        status: Joi.string().required(),
        statusReasonCode: Joi.number(),
        lastResetPassword: Joi.number(),
        lastPasswordChanged: Joi.number(),
        lastResetPasswordDeviceTime: Joi.string(),
        postRegComplete: Joi.boolean(), // Post-Registration
        profileComplete: Joi.boolean(),
        securityComplete: Joi.boolean(),
        postRegSteps: {
            tos: {
                status: Joi.boolean().default(false),
                utcDateTime: Joi.string(),
                localDeviceDateTime: Joi.string()
            },
            email: {
                status: Joi.boolean().default(false),
                utcDateTime: Joi.string(),
                localDeviceDateTime: Joi.string()
            }
        },
        accountId: Joi.string(),
        company: Joi.string(),
        accountRoles: Vogels.types.stringSet(),
        accountPermissions: Vogels.types.stringSet(),
        isAccountActive: Joi.boolean(),  // This defines whether the user has initialised account attributes or not
        isAccountEnabled: Joi.boolean(),  // This defines the current status of the account
        fixedLine: Joi.string(),
        phoneDialCode: Joi.string(),
        phoneCountry: Joi.string(),
        secondaryMobileNumber: Joi.string(),
        secondaryMobileDialCode: Joi.string(),
        secondaryMobileCountry: Joi.string(),
        addressLine1: Joi.string(),
        addressLine2: Joi.string(),
        addressLine3: Joi.string(),
        city: Joi.string(),
        zipCode: Joi.string(),
        state: Joi.string(),
        country: Joi.string(),
        useForTwoFactor: Joi.boolean(),
        flag: Joi.string(),
        authorizeUserStatus: Joi.string(),
    },
    indexes: [{
        hashKey: 'email',
        name: 'EmailIndex',
        type: 'global'
    }, {
        hashKey: 'accountId',
        name: 'AccountIdIndex',
        type: 'global'
    }]
});

User.config({
    tableName: 'User'
});

/*Vogels.createTables(function (err) {
    if (err) {
        console.log('Error creating tables: ', err);
    } else {
        console.log(' New Tables has been created For User');
    }
});*/

module.exports = User;
