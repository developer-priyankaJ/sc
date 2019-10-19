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

var AuditLog = Vogels.define('AuditLog', {
    hashKey: 'id',
    timestamps: true,

    schema: {
        id: Vogels.types.uuid(),
        accountId: Joi.string(),
        eventId: Joi.number().required(),
        userId: Joi.string(),
        ipAddress: Joi.string(),
        localDeviceTimezone: Joi.string(),
        localDeviceDateTime: Joi.string(),
        languageCultureCode: Joi.string(),
        metaData: Joi.string(),
        // Below are the parameters from express-useragent
        isAuthoritative: Joi.boolean(),
        isMobile: Joi.boolean(),
        isTablet: Joi.boolean(),
        isiPad: Joi.boolean(),
        isiPod: Joi.boolean(),
        isiPhone: Joi.boolean(),
        isAndroid: Joi.boolean(),
        isBlackberry: Joi.boolean(),
        isOpera: Joi.boolean(),
        isIE: Joi.boolean(),
        isEdge: Joi.boolean(),
        isIECompatibilityMode: Joi.boolean(),
        isSafari: Joi.boolean(),
        isFirefox: Joi.boolean(),
        isWebkit: Joi.boolean(),
        isChrome: Joi.boolean(),
        isKonqueror: Joi.boolean(),
        isOmniWeb: Joi.boolean(),
        isSeaMonkey: Joi.boolean(),
        isFlock: Joi.boolean(),
        isAmaya: Joi.boolean(),
        isPhantomJS: Joi.boolean(),
        isEpiphany: Joi.boolean(),
        isDesktop: Joi.boolean(),
        isWindows: Joi.boolean(),
        isLinux: Joi.boolean(),
        isLinux64: Joi.boolean(),
        isMac: Joi.boolean(),
        isChromeOS: Joi.boolean(),
        isBada: Joi.boolean(),
        isSamsung: Joi.boolean(),
        isRaspberry: Joi.boolean(),
        isBot: Joi.boolean(),
        isCurl: Joi.boolean(),
        isAndroidTablet: Joi.boolean(),
        isWinJs: Joi.boolean(),
        isKindleFire: Joi.boolean(),
        isSilk: Joi.boolean(),
        isCaptive: Joi.boolean(),
        isSmartTV: Joi.boolean(),
        isUC: Joi.boolean(),
        isFacebook: Joi.boolean(),
        silkAccelerated: Joi.boolean(),
        browser: Joi.string(),
        version: Joi.string(),
        os: Joi.string(),
        platform: Joi.string(),
        geoIp: Joi.string(),
        source: Joi.string()
    },

    indexes: [{
        hashKey: 'userId',
        name: 'UserIdIndex',
        type: 'global'
    }, {
        hashKey:'accountId',
        rangeKey:'eventId',
        name:'AccountIdEventIdIndex',
        type:'global'
    }]
});

AuditLog.config({
    tableName: 'AuditLog'
});

/*Vogels.createTables(function (err) {
    if (err) {
        console.log('Error creating tables: ', err);
    } else {
        console.log(' New Tables has been created For audit Logs');
    }
});*/

module.exports = AuditLog;
