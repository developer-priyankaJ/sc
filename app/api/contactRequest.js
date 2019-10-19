/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.api.ContactRequest');
var Util = require('util');
var PromiseBluebird = require('bluebird');
var _ = require('lodash');
var moment = require('moment');
var request = require('request-promise');

var reCaptchaConfig = require('../config/recaptcha');
var endpointConfig = require('../config/endpoints');
var awsConfig = require('../config/aws');
var DataUtils = require('../lib/data_utils');
var Utils = require('../lib/utils');
var AuditUtils = require('../lib/audit_utils');
var EmailUtils = require('../lib/email_utils');
var connection = require('../lib/connection_util');
var ErrorUtils = require('../lib/error_utils');
var Constants = require('../data/constants');
var ErrorConfig = require('../data/error');


var ContactRequest = {

    /**
     * Verify Recaptcha
     */
    verifyRecaptcha: async function (options, auditOptions, cb) {
        var captcha = options.captcha;
        var captchaSecretKey = reCaptchaConfig.secretKey;
        var ipAddress = auditOptions.ipAddress;
        var flag = options.flag;
        var minimumCaptchaScore = Constants.MINIMUM_CAPTCHA_SCORE;
        var error;

        try {
            if (flag === Constants.RE_CAPTCHA_FLAG.CONTACT_REQUEST) {
                error = new Error(ErrorConfig.MESSAGE.CONTACT_REQUEST_FAILED);
            }

            var captchaVerificationUrl = endpointConfig.RECAPTCHA_VERIFY_URL + '?secret=' + captchaSecretKey +
              '&response=' + captcha + '';
            if (DataUtils.isDefined(ipAddress)) {
                captchaVerificationUrl += '&remoteip=' + ipAddress;
            }
            await request(captchaVerificationUrl, async function (err, response, body) {
                body = JSON.parse(body);
                if (err || !body.success) {
                    err = err || error;
                    err.status = err.status || ErrorConfig.STATUS_CODE.UNAUTHORIZED;
                    return cb(null, {isError: true, err: err});
                }
                var score = body.score;
                if (!score || score < minimumCaptchaScore) {
                    err = err || error;
                    err.status = err.status || ErrorConfig.STATUS_CODE.UNAUTHORIZED;
                    return cb(null, {isError: true, err: err});
                }
                debug('====== COMPLETE ============');
                return cb(null, {isError: false});
            });
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
    },

    /*
    * Validate support request
    * */
    validateContactsRequest: async function (options, cb) {
        var firstName = options.firstName;
        var lastName = options.lastName;
        var email = options.email;
        var captcha = options.captcha;
        var updateInterest = options.updateInterest;
        var betaInterest = options.betaInterest;
        var err;
        if (DataUtils.isUndefined(firstName)) {
            err = new Error(ErrorConfig.MESSAGE.FIRST_NAME_REQ);
        } else if (DataUtils.isUndefined(lastName)) {
            err = new Error(ErrorConfig.MESSAGE.LAST_NAME_REQ);
        } else if (DataUtils.isUndefined(email)) {
            err = new Error(ErrorConfig.MESSAGE.EMAIL_REQUIRED);
        } else if (DataUtils.isUndefined(updateInterest) && DataUtils.isUndefined(betaInterest)) {
            err = new Error(ErrorConfig.MESSAGE.SELECT_AT_LEAST_ONE_INTEREST);
        } else if (DataUtils.isUndefined(captcha)) {
            err = new Error(ErrorConfig.MESSAGE.CAPTCHA_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
        return cb(null, Constants.OK_MESSAGE);
    },

    getSupportRequestObject: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var auditOptions = options.auditOptions;
            var updateInterest = options.updateInterest;
            var betaInterest = options.betaInterest;
            var userAgent = auditOptions.userAgent;
            var IPAddress = auditOptions.ipAddress;
            var localDeviceTimezone = options.localDeviceTimezone || auditOptions.localDeviceTimezone;
            var localDeviceDateTime = options.localDeviceDateTime || auditOptions.localDeviceDateTime;
            var deviceType = auditOptions.deviceType;
            var string = '';
            var values = [];

            if (DataUtils.isDefined(IPAddress)) {
                string += 'IPAddress=?,';
                values.push(IPAddress);
            }
            if (DataUtils.isDefined(localDeviceTimezone)) {
                string += 'localDeviceTimezone=?,';
                values.push(localDeviceTimezone);
            }
            if (DataUtils.isDefined(localDeviceDateTime)) {
                string += 'localDeviceDateTime=?,';
                values.push(new Date(localDeviceDateTime));
            }
            if (DataUtils.isDefined(deviceType)) {
                string += 'deviceType=?,';
                values.push(deviceType);
            }
            if (DataUtils.isDefined(userAgent.browser)) {
                string += 'browser=?,';
                values.push(userAgent.browser);
            }
            if (DataUtils.isDefined(userAgent.version)) {
                string += 'version=?,';
                values.push(userAgent.version);
            }
            if (DataUtils.isDefined(userAgent.os)) {
                string += 'os=?,';
                values.push(userAgent.os);
            }
            if (DataUtils.isDefined(userAgent.platform)) {
                string += 'platform=?,';
                values.push(userAgent.platform);
            }
            if (DataUtils.isDefined(userAgent.source)) {
                string += 'source=?,';
                values.push(userAgent.source);
            }
            if (DataUtils.isDefined(updateInterest)) {
                string += 'updateInterest=?,';
                values.push(updateInterest);
            }
            if (DataUtils.isDefined(betaInterest)) {
                string += 'betaInterest=?,';
                values.push(betaInterest);
            }

            var supportObject = {
                IPAddress: IPAddress,
                platform: userAgent.platform,
                deviceType: deviceType
            };

            var response = {
                string: string,
                values: values,
                supportObject: supportObject
            };
            return resolve(response);
        });
    },

    /*
    * Generate 6 digit random number
    * */
    generateRequestId: function () {
        return new PromiseBluebird(function (resolve, reject) {
            var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
            var length = 6;
            var result = '';
            _.times(length, function () {
                var a = chars[Math.floor(Math.random() * chars.length)];
                debug('a', a);
                result += a;
            });
            return resolve(result);
        });
    },

    /*
    * Create contact records
    * */
    createContact: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var id = Utils.generateId().uuid;
            var firstName = options.firstName;
            var lastName = options.lastName || '';
            var email = options.email;
            var type = options.type;
            var currentTime = DataUtils.getEpochMSTimestamp();
            var err;

            try {
                var conn = await connection.getConnectionAdmin();
                var isInserted = await conn.query('IF (select 1 from Contacts where email = ?) is null then ' +
                  ' insert into Contacts set id = uuid_to_bin(?),firstName=?,lastName=?,email=?,type=?,createdAt=?,' +
                  ' updatedAt=?;end if;'
                  , [email, id, firstName, lastName, email, type, currentTime, currentTime]);
                isInserted = Utils.isAffectedPool(isInserted);
                if (!isInserted) {
                    return resolve({});
                }
                /*if (!isInserted) {
                    debug('err', err);
                    err = new Error(ErrorConfig.MESSAGE.CONTACTS_CREATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }*/
                return resolve({
                    id: id
                });
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.CONTACTS_CREATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
    * Get contact by email
    * */
    getContact: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var email = options.email;
            var err;
            try {
                var conn = await connection.getConnectionAdmin();
                var contact = await conn.query('select cast(uuid_from_bin(id) as CHAR) as id from Contacts where email=?', [email]);
                contact = Utils.filteredResponsePool(contact);
                return resolve(contact);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /**
     * Check already exist requests
     */
    getExistRequest: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var email = options.email;
            var err;
            try {
                var conn = await connection.getConnectionAdmin();
                var existRequest = await conn.query('SELECT * FROM Contacts C, ContactRequest CR WHERE C.id = CR.contactId ' +
                  ' AND C.email= ? AND CR.status = ? ', [email, Constants.RE_CAPTCHA_STATUS.OK]);
                //existRequest = Utils.filteredResponsePool(existRequest);
                return resolve(existRequest);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
    * Create contacts request
    * */
    createContactRequest: async function (options, auditOptions, errorOptions, cb) {
        var firstName = options.firstName;
        var lastName = options.lastName;
        var email = options.email;
        var updateInterest = options.updateInterest;
        var betaInterest = options.betaInterest;
        var localDeviceDateTime = options.localDeviceDateTime;
        var localDeviceTimezone = options.localDeviceTimezone;
        var id = Utils.generateId().uuid;
        var currentTime = DataUtils.getEpochMSTimestamp();
        var type = options.type || Constants.CUSTOMER_TYPE.DEFAULT;
        var supportObject = {}, contactId;
        var success = [];
        var captcha = options.captcha;
        var sendResponse = {};
        var err;
        var error = {};

        try {
            var conn = await connection.startConnectionAdmin();
            await conn.query('START TRANSACTION');
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
        try {
            var existRequest = await ContactRequest.getExistRequest({
                email: email
            });

            debug('existRequest', existRequest);

            var supportRequestOptions = {
                auditOptions: auditOptions,
                localDeviceDateTime: localDeviceDateTime,
                localDeviceTimezone: localDeviceTimezone
            };
            if (existRequest && !captcha.isError) {
                //if (existRequest) {
                if (updateInterest && betaInterest) {
                    var findUpdateInterest = _.find(existRequest, ['updateInterest', 1]);
                    var findBetaInterest = _.find(existRequest, ['betaInterest', 1]);
                } else if (updateInterest) {
                    findUpdateInterest = _.find(existRequest, ['updateInterest', 1]);
                } else if (betaInterest) {
                    findBetaInterest = _.find(existRequest, ['betaInterest', 1]);
                }
                debug('update ', findUpdateInterest, 'beta', findBetaInterest);
                if (findUpdateInterest && findBetaInterest) {
                    err = new Error(ErrorConfig.MESSAGE.YOU_ALREADY_SUBSCRIBED_UPDATE_BETA);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return cb(err);
                }
                if (!findUpdateInterest && !findBetaInterest && updateInterest && betaInterest) {
                    var done = 1;
                    supportRequestOptions.updateInterest = updateInterest;
                    supportRequestOptions.betaInterest = betaInterest;
                    success.push(Constants.SUCCESS_MESSAGE.SUBSCRIBED_SUCCESS_UPDATE_BETA);
                    sendResponse.status = ErrorConfig.STATUS_CODE.SUCCESS;
                }
                if (!done && updateInterest) {
                    if (!findUpdateInterest) {
                        success.push({success: Constants.SUCCESS_MESSAGE.SUBSCRIBED_SUCCESS_UPDATE});
                        supportRequestOptions.updateInterest = updateInterest;
                    } else {
                        err = new Error(ErrorConfig.MESSAGE.YOU_ALREADY_SUBSCRIBED_UPDATE);
                        error.message = ErrorConfig.MESSAGE.YOU_ALREADY_SUBSCRIBED_UPDATE;
                        err.status = error.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    }
                }

                if (!done && betaInterest) {
                    if (!findBetaInterest) {
                        success.push({success: Constants.SUCCESS_MESSAGE.SUBSCRIBED_SUCCESS_BETA});
                        supportRequestOptions.betaInterest = betaInterest;
                    } else {
                        err = new Error(ErrorConfig.MESSAGE.YOU_ALREADY_SUBSCRIBED_BETA);
                        error.message = ErrorConfig.MESSAGE.YOU_ALREADY_SUBSCRIBED_BETA;
                        err.status = error.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    }
                }
                if (success.length === 0) {
                    return cb(err);
                } else if (success.length === 1 && err) {
                    sendResponse.data = success[0];
                    sendResponse.error = error;
                } else {
                    sendResponse.data = success[0];
                    sendResponse.status = ErrorConfig.STATUS_CODE.SUCCESS;
                }
            } else {
                supportRequestOptions.updateInterest = updateInterest;
                supportRequestOptions.betaInterest = betaInterest;
            }

            var response = await ContactRequest.getSupportRequestObject(supportRequestOptions);
            supportObject = response.supportObject;

            //GET requestId
            var requestId = await ContactRequest.generateRequestId();

            //INSERT CONTACT
            var insertContactObject = {
                firstName: firstName,
                lastName: lastName,
                email: email,
                type: type
            };
            var contactResponse = await ContactRequest.createContact(insertContactObject);
            debug('insertContactResponse', contactResponse);

            if (contactResponse && DataUtils.isUndefined(contactResponse.id)) {
                var contact = await ContactRequest.getContact({email: email});
                contactId = contact.id;
            } else {
                contactId = contactResponse.id;
            }

            if (captcha.isError) {
                response.string += 'status=?,statusReasonCode=?,';
                response.values.push(Constants.RE_CAPTCHA_STATUS.FAILED, Constants.RE_CAPTCHA_REASON_CODE);
            }
            // INSERT CONTACT REQUEST
            var isInserted = await conn.query('Insert into ContactRequest set id=uuid_to_bin(?),contactId=uuid_to_bin(?),' +
              'requestId=?,requestDate=?,' + response.string + 'createdAt=?,updatedAt=?;',
              [id, contactId, requestId, currentTime].concat(response.values).concat(currentTime, currentTime));
            isInserted = Utils.isAffectedPool(isInserted);
            if (!isInserted) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_REQUEST_CREATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
            await conn.query('COMMIT');
            await connection.closeConnectionAdmin();

            // If captcha failed then insert into DB but not sent the e-mail
            if (captcha.isError) {
                err = captcha.err;
                err.status = captcha.err.status;
                return cb(err);
            }

            return cb(null, {
                requestId: requestId,
                email: email,
                IPAddress: supportObject.IPAddress,
                platform: supportObject.platform,
                deviceType: supportObject.deviceType,
                updatedAt: currentTime,
                data: sendResponse
            });
        } catch (err) {
            debug('err', err);
            await conn.query('START ROLLBACK');
            err = new Error(ErrorConfig.MESSAGE.CONTACT_REQUEST_CREATE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    //SEND EMAIL TO SUPPORT
    sendEmailToSupport: async function (options, errorOptions, cb) {
        var firstName = options.firstName;
        var requestData = options.requestData;
        var requestId = requestData.requestId;
        var email = requestData.email;
        var IPAddress = requestData.IPAddress;
        var platform = requestData.platform;
        var deviceType = requestData.deviceType;
        var err;


        try {
            debug('email', email);
            var opt = {
                languageCultureCode: 'en-US',
                template: Constants.EMAIL_TEMPLATES.SUPPORT_REQUEST,
                email: awsConfig.SUPPORT_EMAIL
            };
            var compileOptions = {
                name: firstName,
                requestId: requestId,
                requestEmail: email,
                IPAddress: IPAddress,
                deviceType: deviceType,
                platform: platform
            };
            var response = await EmailUtils.sendEmailPromise(opt, compileOptions);
            debug('response', response);
            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

    }
};

module.exports = ContactRequest;
