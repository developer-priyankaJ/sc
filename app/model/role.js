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
var Role = Vogels.define('Role', {
    hashKey: 'id',
    timestamps: true,

    schema: {
        id: Vogels.types.uuid(),
        title: Joi.string(),
        acls: Joi.array().items(
            Joi.object().keys({
                moduleName: Joi.string(),
                aclId: Joi.string(),
                token: Joi.string(),
                title: Joi.string(),
            })
        ),
        active: Joi.boolean()
    }
});

Role.config({
    tableName: 'Role'
});

/*Vogels.createTables(function (err) {
    if (err) {
        console.log('Error creating tables: ', err);
    } else {
        console.log('Tables has been created For Role');
    }
});*/

module.exports = Role;
