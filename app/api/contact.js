/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.api.contact');
var Util = require('util');
var _ = require('lodash');
var Async = require('async');
var knex = require('../lib/knex_util');
var Promise = require('bluebird');

var connection = require('../lib/connection_util');
var Constants = require('../data/constants');
var ContactModel = require('../model/contact');
var UserModel = require('../model/user');
var ErrorConfig = require('../data/error');
var DataUtils = require('../lib/data_utils');
var EmailUtils = require('../lib/email_utils');
var NotificationApi = require('../api/notification');
var NotificationReferenceData = require('../data/notification_reference');
var NotificationModel = require('../model/notification');
var AuditUtils = require('../lib/audit_utils');
var Endpoints = require('../config/endpoints');
var BlackListModel = require('../model/black_list');
var Utils = require('../lib/utils');
var ErrorUtils = require('../lib/error_utils');
var AccountApi = require('./account');
var NotificationReferenceApi = require('../api/notification_reference');
var FirebaseUtils = require('../lib/firebase_utils');
var ChatApi = require('../api/chat');

function updateContact(contactOptions, user, auditOptions, cb) {

    ContactModel.update(contactOptions, {
        ReturnValues: 'ALL_NEW'
    }, function (err, contact) {
        if (err || !contact) {
            err = err || new Error(ErrorConfig.MESSAGE.CONTACT_UPDATE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
            Util.log(err);
            return cb(err);
        }
        contact = contact.attrs;
        auditOptions.metaData.new_contact = contact;
        AuditUtils.create(auditOptions);

        var languageCultureCode = user.languageCultureCode;
        var opt = {
            languageCultureCode: languageCultureCode,
            template: Constants.EMAIL_TEMPLATES.INVITE_SENT,
            email: user.email
        };
        var compileOptions = {
            name: user.firstName,
            friend: user.inviterUser.email,
            scopehub_login: Endpoints.SCOPEHUB_LOGIN_URL
        };
        if (user.status === Constants.USER_STATUS.ACTIVE || user.status === Constants.USER_STATUS.TEMPORARY) {
            EmailUtils.sendEmail(opt, compileOptions, function (err) {
                if (err) {
                    return cb(err);
                }

                if (DataUtils.isUndefined(user.inviterUser.firstName)) {
                    user.inviterUser.firstName = '';
                }
                if (DataUtils.isUndefined(user.inviterUser.lastName)) {
                    user.inviterUser.lastName = '';
                }
                var notificationOption = {
                    contactId: contact.id,
                    user_ids: [user.id],
                    topic_id: user.id,
                    notificationExpirationDate: contact.invitationExpirationDate,
                    notification_reference: NotificationReferenceData.CONTACT_INVITE,
                    data: {
                        contact: {
                            inviter: user.inviterUser.email + ', ' + user.inviterUser.firstName + ' ' + user.inviterUser.lastName
                        }
                    },
                    meta: {
                        email: user.inviterUser.email
                    },
                    languageCultureCode: user.languageCultureCode
                };

                if (user.inviterUser.firstName) {
                    notificationOption.meta['name'] = user.inviterUser.firstName;
                }
                NotificationApi = require('../api/notification');
                NotificationApi.create(notificationOption, function (err) {
                    if (err) {
                        debug('err', err);
                    }
                    return cb(null, contact);
                });
            });
        } else {
            return cb(null, contact);
        }
    });
}

function reInviteContact(options, auditOptions, cb) {
    var date = new Date();
    var inviteeUserExists = options.inviteeUserExists;
    var invitationExpirationDate = date.setDate(date.getDate() + Constants.CONTACT_INVITATION_EXPIRATION_DATE_LIMIT);
    inviteeUserExists.inviterUser = options.inviterUser;

    var contactOptions = {
        id: options.id,
        status: Constants.CONTACT_STATUS.OPEN,
        invitationExpirationDate: invitationExpirationDate
    };

    ContactModel.update(contactOptions, {
        ReturnValues: 'ALL_NEW'
    }, function (err, contact) {
        if (err || !contact) {
            err = err || new Error(ErrorConfig.MESSAGE.CONTACT_UPDATE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
            Util.log(err);
            return cb(err);
        }
        contact = contact.attrs;
        auditOptions.metaData.new_contact = contact;
        AuditUtils.create(auditOptions);

        var languageCultureCode = inviteeUserExists.languageCultureCode;
        var opt = {
            languageCultureCode: languageCultureCode,
            template: Constants.EMAIL_TEMPLATES.INVITE_SENT,
            email: inviteeUserExists.email
        };
        var compileOptions = {
            name: inviteeUserExists.firstName,
            friend: inviteeUserExists.inviterUser.email,
            scopehub_login: Endpoints.SCOPEHUB_LOGIN_URL
        };
        if (DataUtils.isUndefined(inviteeUserExists.inviterUser.firstName)) {
            inviteeUserExists.inviterUser.firstName = '';
        }
        if (DataUtils.isUndefined(inviteeUserExists.inviterUser.lastName)) {
            inviteeUserExists.inviterUser.lastName = '';
        }
        var notificationOption = {
            contactId: contact.id,
            user_ids: [inviteeUserExists.id],
            topic_id: inviteeUserExists.id,
            notificationExpirationDate: contact.invitationExpirationDate,
            notification_reference: NotificationReferenceData.CONTACT_INVITE,
            data: {
                contact: {
                    inviter: inviteeUserExists.inviterUser.email + ', ' + inviteeUserExists.inviterUser.firstName + ' ' + inviteeUserExists.inviterUser.lastName
                }
            },
            meta: {
                email: inviteeUserExists.inviterUser.email
            },
            languageCultureCode: inviteeUserExists.languageCultureCode
        };
        if (inviteeUserExists.inviterUser.firstName) {
            notificationOption.meta['name'] = inviteeUserExists.inviterUser.firstName;
        }
        if (inviteeUserExists.status === Constants.USER_STATUS.ACTIVE || inviteeUserExists.status === Constants.USER_STATUS.TEMPORARY) {
            EmailUtils.sendEmail(opt, compileOptions, function (err) {
                if (err) {
                    return cb(err);
                }

                NotificationApi = require('../api/notification');
                NotificationApi.create(notificationOption, function (err) {
                    if (err) {
                        debug('err', err);
                    }
                    return cb(null, contact);
                });
            });
        } else {
            return cb(null, contact);
        }
    });
}

async function reInviteContactMD(options, errorOptions, cb) {

    var date = new Date();
    var invitationExpirationDate = date.setDate(date.getDate() + Constants.CONTACT_INVITATION_EXPIRATION_DATE_LIMIT);
    invitationExpirationDate = new Date(invitationExpirationDate);
    var inviterUser = options.inviterUser;
    var contactId = options.contactId;
    var inviteeUserExists = options.inviteeUserExists;
    var currentDate = date.getTime();
    var err;

    try {
        var conn = await connection.getConnection();
        var getQuery = 'select uuid_from_bin(contactId) as contactId, isActive,' +
          'invitationExpirationDate,status,updatedAt from contacts where contactId = uuid_to_bin(?)';

        var contact = await conn.query(getQuery, [contactId]);
        contact = Utils.filteredResponsePool(contact);

        if (inviteeUserExists.status === Constants.USER_STATUS.ACTIVE || inviteeUserExists.status === Constants.USER_STATUS.TEMPORARY) {

            var updateContact = await conn.query('UPDATE contacts SET status = ?,invitationExpirationDate = ?,updatedAt = ? WHERE contactId = uuid_to_bin(?);',
              [Constants.CONTACT_STATUS.OPEN, invitationExpirationDate, currentDate, contactId]);
            if (!updateContact) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                throw err;
            }
            contact.invitationExpirationDate = invitationExpirationDate;
            contact.status = Constants.CONTACT_STATUS.OPEN;
            contact.updatedAt = currentDate;

            var opt = {
                languageCultureCode: inviterUser.languageCultureCode,
                template: Constants.EMAIL_TEMPLATES.INVITE_SENT,
                email: inviteeUserExists.email
            };

            var compileOptions = {
                name: inviteeUserExists.firstName,
                friend: inviterUser.email,
                scopehub_login: Endpoints.SCOPEHUB_LOGIN_URL
            };

            if (DataUtils.isUndefined(inviterUser.firstName)) {
                inviterUser.firstName = '';
            }
            if (DataUtils.isUndefined(inviterUser.lastName)) {
                inviterUser.lastName = '';
            }

            EmailUtils.sendEmailMD(opt, compileOptions, async function (err) {
                if (err) {
                    errorOptions.err = err;
                    await ErrorUtils.create(errorOptions);
                    return cb(err);
                }

                NotificationApi = require('../api/notification');
                var notificationOption = {
                    refereId: contactId,
                    refereType: Constants.NOTIFICATION_REFERE_TYPE.CONTACT,
                    user_ids: [inviteeUserExists.id],
                    topic_id: inviteeUserExists.id,
                    notificationExpirationDate: invitationExpirationDate,
                    notification_reference: NotificationReferenceData.CONTACT_INVITE,
                    paramasDateTime: new Date(),
                    metaEmail: inviterUser.email,
                    paramsInviter: inviterUser.email + ', ' +
                    (inviterUser.firstName ? inviterUser.firstName : '') + ' ' +
                    (inviterUser.lastName ? inviterUser.lastName : ''),
                    paramsInvitee: inviteeUserExists.email + ', ' +
                    (inviteeUserExists.firstName
                      ? inviteeUserExists.firstName
                      : '') + ' ' +
                    (inviteeUserExists.lastName ? inviteeUserExists.lastName : ''),
                    languageCultureCode: inviteeUserExists.languageCultureCode,
                    createdBy: inviterUser.id
                };

                if (inviterUser.firstName) {
                    notificationOption.metaName = inviterUser.firstName;
                }

                await NotificationApi.createMD(notificationOption);

                return cb(null, contact);
            });

        } else {
            return cb(null, contact);
        }
    } catch (err) {

        errorOptions.err = err;
        await ErrorUtils.create(errorOptions);
        if (err.code) {
            err = new Error(
              ErrorConfig.MESSAGE.CONTACT_RE_INVITATION_SENDING_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
        }
        return cb(err);
    }
}

var Contact = {

    createMD: async function (options, errorOptions, cb) {
        var generatedId = Utils.generateId();
        var contactId = generatedId.uuid;
        var inviterUUID = options.inviterUser.id;
        var createdBy = options.createdBy;
        var inviteeEmail = options.inviteeEmail;
        var phone = options.phone;
        var dialCode = options.dialCode;
        var phoneCountry = options.phoneCountry;
        var primaryMobile = options.primaryMobile;
        var primaryMobileDialCode = options.primaryMobileDialCode;
        var primaryMobileCountry = options.primaryMobileCountry;
        var secondaryMobile = options.secondaryMobile;
        var secondaryMobileDialCode = options.secondaryMobileDialCode;
        var secondaryMobileCountry = options.secondaryMobileCountry;

        var err;

        if (DataUtils.isUndefined(options.inviteeEmail)) {
            err = new Error(ErrorConfig.MESSAGE.CONTACT_INVITEE_EMAIL_REQUIRED);
        }

        if (!err && DataUtils.isInvalidEmail(options.inviteeEmail)) {
            err = new Error(ErrorConfig.MESSAGE.CONTACT_INVITEE_EMAIL_REQUIRED);
        }

        if (!err && DataUtils.isUndefined(options.firstName)) {
            err = new Error(ErrorConfig.MESSAGE.CONTACT_FIRST_NAME_REQUIRED);
        }
        if (!err && DataUtils.isUndefined(options.lastName)) {
            err = new Error(ErrorConfig.MESSAGE.CONTACT_LAST_NAME_REQUIRED);
        }

        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('err', err);
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            return cb(err);
        }

        if (DataUtils.isDefined(phone) || DataUtils.isDefined(dialCode) || DataUtils.isDefined(phoneCountry)) {
            if (DataUtils.isUndefined(phone)) {
                err = new Error(ErrorConfig.MESSAGE.PHONE_NUMBER_REQUIRED);
            } else if (DataUtils.isUndefined(dialCode)) {
                err = new Error(ErrorConfig.MESSAGE.DIAL_CODE_REQUIRED);
            } else if (DataUtils.isUndefined(phoneCountry)) {
                err = new Error(ErrorConfig.MESSAGE.PHONE_COUNTRY_REQUIRED);
            }
            if (err) {
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
        }
        if (DataUtils.isDefined(primaryMobile) || DataUtils.isDefined(primaryMobileDialCode) || DataUtils.isDefined(primaryMobileCountry)) {
            if (DataUtils.isUndefined(primaryMobile)) {
                err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_REQUIRED);
            } else if (DataUtils.isUndefined(primaryMobileDialCode)) {
                err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_DIAL_CODE_REQUIRED);
            } else if (DataUtils.isUndefined(primaryMobileCountry)) {
                err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_COUNTRY_REQUIRED);
            }
            if (err) {
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
        }
        if (DataUtils.isDefined(secondaryMobile) || DataUtils.isDefined(secondaryMobileDialCode) || DataUtils.isDefined(secondaryMobileCountry)) {
            if (DataUtils.isUndefined(secondaryMobile)) {
                err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_REQUIRED);
            } else if (DataUtils.isUndefined(secondaryMobileDialCode)) {
                err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_DIAL_CODE_REQUIRED);
            } else if (DataUtils.isUndefined(secondaryMobileCountry)) {
                err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_COUNTRY_REQUIRED);
            }
            if (err) {
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
        }

        try {
            var contactOptions = await Contact.validateOptinalFields(options);
            var status = Constants.CONTACT_STATUS.NO_INVITATION;
            var currentDate = new Date().getTime();

            if (options.inviterUser.email === options.inviteeEmail) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_INVITER_EMAIL_AND_INVITEE_EMAIL_IS_SAME_NOT_ALLOW_TO_CREATE_CONTACT);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            var query =
              'IF EXISTS (select * from contacts where inviterUUID = uuid_to_bin(?) and inviteeEmail = ?) ' +
              'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "CONTACT_ALREADY_EXIST";' +
              'ELSE INSERT into contacts SET contactId = uuid_to_bin(?),inviterUUID = uuid_to_bin(?),status = ?,userActive = 1,' +
              'createdBy = uuid_to_bin(?),createdAt = ?,updatedAt = ?,invitationExpirationDate = ?,' + contactOptions.contactFields + 'isActive = 1;end IF';

            var params = [inviterUUID, inviteeEmail, contactId, inviterUUID, status, createdBy, currentDate, currentDate, new Date(Constants.DEFAULT_TIMESTAMP)].concat(contactOptions.contactFieldsValues);
            var conn = await connection.getConnection();
            var contact = await conn.query(query, params);
            if (!Utils.isAffectedPool(contact)) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_CREATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }

            var response = {
                OK: Constants.SUCCESS_MESSAGE.SAVE_CONTACT_SUCCESS,
                status: status,
                invitationExpirationDate: Constants.DEFAULT_TIMESTAMP,
                contactId: contactId,
                updatedAt: currentDate
            };
            return cb(null, response);

        } catch (err) {

            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            debug('err', err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_ALREADY_EXIST);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_CREATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    addAndInviteMD: async function (options, auditOptions, errorOptions, cb) {
        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        try {
            await conn.query('START TRANSACTION;');

            Contact.createMD(options, errorOptions, async function (err, contact) {
                if (err) {
                    debug('err', err);
                    await conn.query('ROLLBACK;');
                    return cb(err);
                }
                var contactOptions = {
                    contactId: contact.contactId,
                    updatedAt: contact.updatedAt,
                    personalMessage: options.personalMessage,
                    user: options.inviterUser
                };
                Contact.inviteMD(contactOptions, auditOptions, errorOptions, async function (err, inviteContact) {
                    if (err) {
                        debug('err', err);
                        await conn.query('ROLLBACK;');
                        return cb(err);
                    }
                    if (!inviteContact) {

                        err = new Error(ErrorConfig.MESSAGE.CONTACT_INVITE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        await conn.query('ROLLBACK;');
                        return cb(err);
                    }

                    await conn.query('COMMIT;');
                    inviteContact.OK = Constants.SUCCESS_MESSAGE.ADD_AND_INVITE_CONTACT_SUCCESS;
                    return cb(null, inviteContact);
                });
            });
        } catch (err) {
            await conn.query('ROLLBACK;');
            return cb(err);
        }
    },

    inviteMD: async function (options, auditOptions, errorOptions, cb) {
        var date = new Date();
        var contactId = options.contactId;
        var updatedAt = options.updatedAt;
        var personalMessage = options.personalMessage;
        var user = options.user;
        var currentDate = date.getTime();
        var err;


        if (DataUtils.isUndefined(contactId)) {
            err = new Error(ErrorConfig.MESSAGE.CONTACT_ID_REQUIRED);

        }
        if (!err && DataUtils.isValidateOptionalField(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.CONTACT_UPDATED_AT_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            if (options.isStartTransaction) {
                await conn.query('START TRANSACTION');
            }

            await conn.query('IF NOT EXISTS(SELECT 1 from contacts where contactId = uuid_to_bin(?))' +
              'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "CONTACT_ID_INVALID";' +
              'ELSEIF NOT EXISTS(SELECT 1 from contacts where contactId = uuid_to_bin(?) and updatedAt = ?)' +
              'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4002,MESSAGE_TEXT = "CONTACT_UPDATED_SINCE_YOU_RETRIEVED"; end IF', [contactId, contactId, updatedAt]);

            var contact = await conn.query('select userActive,inviteeEmail, CAST(uuid_from_bin(contactId) as CHAR) as contactId,' +
              'status,invitationExpirationDate, updatedAt from contacts where contactId = uuid_to_bin(?)', [contactId]);
            contact = Utils.filteredResponsePool(contact);

            if (!contact) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            if (user.email === contact.inviteeEmail) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_INVITER_CAN_NOT_INVITE_ITSELF);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            if (options.isReInvite === 'true') {

                if (contact.userActive !== 1) {
                    err = new Error(ErrorConfig.MESSAGE.CONTACT_INVITEE_UNAVAILABLE);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    throw err;
                }

                if (contact.status === Constants.CONTACT_STATUS.OPEN && new Date(contact.invitationExpirationDate).getTime() > currentDate) {

                    err = new Error(ErrorConfig.MESSAGE.CONTACT_HAS_ALREADY_SENT_INVITATION);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    throw err;

                }
                if (contact.status === Constants.CONTACT_STATUS.ACCEPTED) {

                    err = new Error(ErrorConfig.MESSAGE.INVITEE_ALREADY_ACCEPTED_INVITATION);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    throw err;

                }

            } else {
                if (contact.status === Constants.CONTACT_STATUS.OPEN) {

                    err = new Error(ErrorConfig.MESSAGE.CONTACT_HAS_ALREADY_SENT_INVITATION);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    throw err;
                }
            }

            var email = contact.inviteeEmail;

            var userExist = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id, CAST(uuid_from_bin(accountId) as CHAR) as accountId,isAccountEnabled,isAccountActive,' +
              'status,flag,postRegComplete,tosStatus,email,languageCultureCode,emailStatus from users where email=?', email);

            var inviteeUserExists = Utils.filteredResponsePool(userExist);

            if (!inviteeUserExists) {

                var generatedId = Utils.generateId();
                var id = generatedId.uuid;
                var status = Constants.ACCOUNT_STATUS.TEMPORARY;

                var account = await conn.query('insert into accounts (id,status,createdAt,createdBy,updatedAt) values ' +
                  '(uuid_to_bin(?),?,utc_timestamp(3),uuid_to_bin(?),utc_timestamp(3))', [id, status, user.id]);

                var isAccountAffected = Utils.isAffectedPool(account);
                if (!isAccountAffected) {
                    err = new Error(ErrorConfig.MESSAGE.ACCOUNT_CREATION_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }

                account = {};
                account.id = id;
                var insertResponse = await conn.query('If NOT EXISTS (select 1 from users where email= ?) THEN ' +
                  'INSERT into users (id,email,languageCultureCode,status,postRegComplete,tosStatus,' +
                  'emailStatus,profileComplete,securityComplete,isAccountActive,' +
                  'isAccountEnabled,createdAt,updatedAt, flag, accountId, authorizeUserStatus)' +
                  'values(uuid_to_bin(?),?,?,?,?,?,?,?,?,?,?,utc_timestamp(3),utc_timestamp(3), ?, uuid_to_bin(?), ?); end if',
                  [email, Utils.generateId().uuid, contact.inviteeEmail, user.languageCultureCode,
                      Constants.USER_STATUS.TEMPORARY, false, false, false, false, false, false, false, Constants.USER_FLAG.CONTACT_INVITATION, account.id, Constants.AUTHORIZE_USER_STATUS.OPEN]);

                var isUserAffected = Utils.isAffectedPool(insertResponse);

                if (isUserAffected) {
                    var userResponse = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id,status,flag,postRegComplete,' +
                      'tosStatus,email,languageCultureCode,emailStatus from users where email=?', email);
                    inviteeUserExists = Utils.filteredResponsePool(userResponse);
                } else {
                    var userResponse = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id,CAST(uuid_from_bin(accountId) as CHAR) as accountId,' +
                      'status,flag,postRegComplete,tosStatus,email,languageCultureCode,emailStatus from users where email=?', email);
                    inviteeUserExists = Utils.filteredResponsePool(userResponse);
                }

            } else {

                if (inviteeUserExists.status === Constants.USER_STATUS.ACTIVE) {
                    if (!inviteeUserExists.isAccountEnabled || !inviteeUserExists.isAccountActive) {

                        await conn.query('update contacts set updatedAt = ?, userActive = 0 where contactId = uuid_to_bin(?)', [currentDate, contactId]);
                        if (options.isStartTransaction) {
                            await conn.query('COMMIT;');
                        }

                        err = new Error(ErrorConfig.MESSAGE.CONTACT_INVITEE_UNAVAILABLE);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        errorOptions.err = err;
                        await ErrorUtils.create(errorOptions);
                        return cb(err);
                    }
                } else if (inviteeUserExists.status !== Constants.USER_STATUS.TEMPORARY) {
                    await conn.query('update contacts set updatedAt = ?, userActive = 0 where contactId = uuid_to_bin(?)', [currentDate, contactId]);

                    if (options.isStartTransaction) {
                        await conn.query('COMMIT;');
                    }

                    err = new Error(ErrorConfig.MESSAGE.CONTACT_INVITEE_UNAVAILABLE);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    errorOptions.err = err;
                    await ErrorUtils.create(errorOptions);
                    return cb(err);
                }

                var blackList = await Contact.checkBlackListMD({
                    inviteeUserExists: inviteeUserExists,
                    inviterUser: user
                });
                if (blackList) {
                    return cb();
                }
            }

            var invitationExpirationDate = date.setDate(date.getDate() + Constants.CONTACT_INVITATION_EXPIRATION_DATE_LIMIT);
            invitationExpirationDate = new Date(invitationExpirationDate);

            personalMessage = DataUtils.isDefined(personalMessage) ? personalMessage : '';


            var query = 'update contacts set inviteeUUID = uuid_to_bin(?), invitationUTCTime = utc_timestamp(3), ' +
              'invitationExpirationDate = ?, status = ?, isActive = ?, personalMessage = ?, updatedAt = ?, updatedBy = uuid_to_bin(?) ' +
              'where contactId = uuid_to_bin(?)';

            var params = [inviteeUserExists.id, invitationExpirationDate,
                Constants.CONTACT_STATUS.OPEN, true, personalMessage, currentDate, user.id, contact.contactId];

            var updateContact = await conn.query(query, params);

            var isUpdateContact = Utils.isAffectedPool(updateContact);
            if (!isUpdateContact) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                throw err;
            }

            var languageCultureCode = inviteeUserExists.languageCultureCode;
            var opt = {
                languageCultureCode: languageCultureCode,
                template: Constants.EMAIL_TEMPLATES.INVITE_SENT,
                email: inviteeUserExists.email
            };
            var compileOptions = {
                name: inviteeUserExists.firstName || '',
                friend: user.email,
                scopehub_login: Endpoints.SCOPEHUB_LOGIN_URL
            };

            EmailUtils.sendEmailMD(opt, compileOptions, async function (err) {
                if (err) {
                    if (options.isStartTransaction) {
                        await conn.query('ROLLBACK;');
                    }

                    errorOptions.err = err;
                    await ErrorUtils.create(errorOptions);
                    return cb(err);
                }
                try {
                    var notificationOption = {
                        refereId: contactId,
                        refereType: Constants.NOTIFICATION_REFERE_TYPE.CONTACT,
                        user_ids: [inviteeUserExists.id],
                        topic_id: inviteeUserExists.id,
                        notificationExpirationDate: invitationExpirationDate,
                        paramasDateTime: new Date(),
                        notification_reference: NotificationReferenceData.CONTACT_INVITE,
                        metaEmail: user.email,
                        paramsInviter: user.email + ', ' + (user.firstName ? user.firstName : '') + ' ' + (user.lastName ? user.lastName : ''),
                        paramsInvitee: inviteeUserExists.email + ', ' + (inviteeUserExists.firstName ? inviteeUserExists.firstName : '') + ' ' + (inviteeUserExists.lastName ? inviteeUserExists.lastName : ''),
                        languageCultureCode: inviteeUserExists.languageCultureCode,
                        createdBy: user.id,
                        type: Constants.DEFAULT_NOTIFICATION_TYPE
                    };
                    if (user.firstName) {
                        notificationOption.metaName = user.firstName;
                    }

                    NotificationApi = require('../api/notification');
                    await NotificationApi.createMD(notificationOption);


                    contact.status = Constants.CONTACT_STATUS.OPEN;
                    contact.invitationExpirationDate = invitationExpirationDate;
                    contact.updatedAt = currentDate;
                    contact.OK = Constants.SUCCESS_MESSAGE.INVITE_CONTACT_SUCCESS;

                    AuditUtils.create(auditOptions);

                    //here update user contactInvitaionDate = currentDate;
                    await conn.query('update users set contactInvitationDate = ?, updatedAt = ? where id = uuid_to_bin(?)', [currentDate, currentDate, inviteeUserExists.id]);
                    if (options.isStartTransaction) {
                        await conn.query('COMMIT;');
                    }

                    return cb(null, contact);
                } catch (err) {

                    if (options.isStartTransaction) {
                        await conn.query('ROLLBACK;');
                    }
                    errorOptions.err = err;
                    await ErrorUtils.create(errorOptions);
                    err = new Error(ErrorConfig.MESSAGE.CONTACT_INVITE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return cb(err);
                }
            });

        } catch (err) {
            console.log(err);
            if (options.isStartTransaction) {
                await conn.query('ROLLBACK;');
            }
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);

            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_ID_INVALID);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno === 4002) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_UPDATED_SINCE_YOU_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
            } else if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_INVITE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    reSendInvitationMD: function (options, auditOptions, errorOptions, cb) {

        options.isReInvite = 'true';
        options.isStartTransaction = true;
        Contact.inviteMD(options, auditOptions, errorOptions, async function (err, result) {
            if (err) {

                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);
                return cb(err);
            }

            result.OK = Constants.SUCCESS_MESSAGE.RESEND_CONTACT_INVITE_SUCCESS;
            return cb(null, result);

        });
    },

    reminderMD: async function (options, errorOptions, cb) {
        var contactId = options.contactId;
        var updatedAt = options.updatedAt;
        var user = options.user;
        var err;

        if (DataUtils.isUndefined(contactId)) {
            err = new Error(ErrorConfig.MESSAGE.CONTACT_ID_REQUIRED);
        }

        if (!err && DataUtils.isValidateOptionalField(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.CONTACT_UPDATED_AT_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        try {
            await conn.query('START TRANSACTION;');

            await conn.query('IF NOT EXISTS(SELECT 1 from contacts where contactId = uuid_to_bin(?))' +
              'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "CONTACT_ID_INVALID";' +
              'ELSEIF NOT EXISTS(SELECT 1 from contacts where contactId = uuid_to_bin(?) and updatedAt = ?)' +
              'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4002,MESSAGE_TEXT = "CONTACT_UPDATED_SINCE_YOU_RETRIEVED"; end IF', [contactId, contactId, updatedAt]);

            var contact = await conn.query('select CAST(uuid_from_bin(contactId) as CHAR) as contactId,userActive,firstName,lastName, inviteeEmail,actionUTCTime,isActive,' +
              'fax,phone,company,notes,invitationExpirationDate,status,invitationUTCTime,CAST(uuid_from_bin(inviterUUID) as CHAR) as inviterUUID, ' +
              'CAST(uuid_from_bin(inviteeUUID) as CHAR) as inviteeUUID,' +
              'createdAt,updatedAt from contacts where contactId = uuid_to_bin(?) and updatedAt = ?', [contactId, updatedAt]);
            contact = Utils.filteredResponsePool(contact);

            if (contact.userActive !== 1) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_INVITEE_UNAVAILABLE);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            var userExist = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id,CAST(uuid_from_bin(accountId) as CHAR) as accountId,' +
              'status,email,languageCultureCode from users where email = ? ', [contact.inviteeEmail]);
            var inviteeUserExists = Utils.filteredResponsePool(userExist);

            if (!inviteeUserExists) {
                err = new Error(ErrorConfig.MESSAGE.INVITEE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            var blackList = await Contact.checkBlackListMD({
                inviteeUserExists: inviteeUserExists,
                inviterUser: user
            });
            if (blackList) {
                return cb();
            }
            var currentDate = new Date().getTime();

            if (contact.status === Constants.CONTACT_STATUS.OPEN && currentDate < new Date(contact.invitationExpirationDate).getTime()) {
                var opt = {
                    languageCultureCode: user.languageCultureCode,
                    template: Constants.EMAIL_TEMPLATES.INVITE_SENT,
                    email: inviteeUserExists.email
                };
                var compileOptions = {
                    name: inviteeUserExists.firstName,
                    friend: inviteeUserExists.email,
                    scopehub_login: Endpoints.SCOPEHUB_LOGIN_URL
                };
                if (DataUtils.isUndefined(user.firstName)) {
                    user.firstName = '';
                }
                if (DataUtils.isUndefined(user.lastName)) {
                    user.lastName = '';
                }

                try {

                    if (inviteeUserExists.status === Constants.USER_STATUS.ACTIVE || inviteeUserExists.status === Constants.USER_STATUS.TEMPORARY) {
                        EmailUtils.sendEmailMD(opt, compileOptions, async function (err) {
                            if (err) {
                                await conn.query('ROLLBACK;');
                                errorOptions.err = err;
                                await ErrorUtils.create(errorOptions);
                                return cb(err);
                            }

                            var notification = await conn.query('select paramasDateTime from Notifications where refereId = uuid_to_bin(?) order by createdAt DESC LIMIT 1', [contactId]);
                            notification = Utils.filteredResponsePool(notification);
                            debug('notification ', notification);

                            NotificationApi = require('../api/notification');
                            var notificationOption = {
                                refereId: contactId,
                                refereType: Constants.NOTIFICATION_REFERE_TYPE.CONTACT,
                                user_ids: [inviteeUserExists.id],
                                topic_id: inviteeUserExists.id,
                                notificationExpirationDate: contact.invitationExpirationDate,
                                paramasDateTime: notification.paramasDateTime,
                                notification_reference: NotificationReferenceData.CONTACT_INVITE_REMINDER,
                                metaEmail: user.email,
                                paramsInviter: user.email + ', ' + (user.firstName ? user.firstName : '') + ' ' + (user.lastName ? user.lastName : ''),
                                paramsInvitee: inviteeUserExists.email + ', ' + (inviteeUserExists.firstName ? inviteeUserExists.firstName : '') + ' ' + (inviteeUserExists.lastName ? inviteeUserExists.lastName : ''),
                                languageCultureCode: inviteeUserExists.languageCultureCode,
                                createdBy: user.id
                            };

                            if (user.firstName) {
                                notificationOption.metaName = user.firstName;
                            }

                            await NotificationApi.createMD(notificationOption);
                            await conn.query('COMMIT;');
                            return cb(null, {
                                OK: Constants.SUCCESS_MESSAGE.CONTACT_REMINDER_SUCCESS,
                                updatedAt: updatedAt
                            });
                        });
                    } else {
                        await conn.query('COMMIT;');
                        return cb(null, {OK: Constants.SUCCESS_MESSAGE.CONTACT_REMINDER_SUCCESS, updatedAt: updatedAt});
                    }

                } catch (err) {

                    await conn.query('ROLLBACK;');
                    errorOptions.err = err;
                    await ErrorUtils.create(errorOptions);
                    if (err.errno) {
                        err = new Error(ErrorConfig.MESSAGE.CONTACT_REMINDER_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    }
                    return cb(err);
                }
            } else if (contact.status === Constants.CONTACT_STATUS.OPEN && currentDate > new Date(contact.invitationExpirationDate).getTime()) {
                err = new Error(ErrorConfig.MESSAGE.INVITATION_IS_EXPIRED_AND_USER_CAN_RE_SEND_INVITATION);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            } else {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_STATUS_HAS_CHANGED_RMINDER_CAN_NO_LONGER_BE_DONE);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }
        } catch (err) {

            await conn.query('ROLLBACK;');
            debug('err', err);
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_ID_INVALID);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno === 4002) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_UPDATED_SINCE_YOU_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
            } else if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_REMINDER_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }

    },

    checkBlackListMD: async function (options) {
        var inviteeUserExists = options.inviteeUserExists;
        var inviterUser = options.inviterUser;
        var inviterUUID = inviterUser.id;

        if (inviteeUserExists) {
            var inviteeUUID = inviteeUserExists.id;
            var domain = (inviterUser.email).split('@');
            var inviterEmailDomain = domain[1];
            if (DataUtils.isDefined(inviterEmailDomain)) {
                var conn = await connection.getConnection();
                var query = 'IF EXISTS(select * from blackList where inviteeUUID = uuid_to_bin(?) and inviterEmailDomain = ?)' +
                  'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "DOMAIN_BLOACKED_BY_INVITEE";' +
                  'ELSEIF EXISTS (select * from blackList where inviteeUUID = uuid_to_bin(?) and inviterEmail = ?)' +
                  'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "EMAIL_BLOACKED_BY_INVITEE";' +
                  'ELSEIF EXISTS (select * from blackList where inviteeUUID = uuid_to_bin(?) and inviterUUID = uuid_to_bin(?))' +
                  'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "INVITER_UUID_BLOACKED_BY_INVITEE"; end IF';

                var params = [inviteeUUID, inviterEmailDomain, inviteeUUID, inviterUser.email, inviteeUUID, inviterUUID];
                await conn.query(query, params);
            }
        }
        return false;
    },

    contactExist: function (options, cb) {
        var inviterUUID = options.inviterUUID;
        var inviteeUserExists = options.inviteeUserExists;
        //var temporaryUser = options.temporaryUser;
        var inviteeUUID;
        /*if (temporaryUser) {
         inviteeUUID = temporaryUser.id;
         } else */
        if (inviteeUserExists) {
            inviteeUUID = inviteeUserExists.id;
        } else {
            return cb();
        }
        ContactModel
          .query(inviteeUUID)
          .usingIndex(Constants.CONTACT_INVITEE_UUID_INDEX).where(Constants.CONTACT_INVITER_UUID).equals(inviterUUID)
          .exec(function (err, data) {
              if (err || !data || !data.Items) {
                  return cb(err);
              }
              var contacts = (_.map(data.Items, 'attrs'));
              var contactExist = contacts[0];
              return cb(null, contactExist);
          });
    },

    getContactListMD: async function (options, errorOptions, cb) {

        var inviterUUID = options.inviterUUID;

        if (DataUtils.isUndefined(inviterUUID)) {
            var err = new Error(ErrorConfig.MESSAGE.CONTACT_INVITER_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('error', err);
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var query = 'select CAST(uuid_from_bin(inviterUUID) as CHAR) as inviterUUID, CAST(uuid_from_bin(contactId) as CHAR) as contactId,' +
              'CAST(uuid_from_bin(inviteeUUID) as CHAR) as inviteeUUID,userActive,firstName,lastName,inviteeEmail,status,isActive,' +
              'invitationExpirationDate,invitationUTCTime,updatedAt from contacts where inviterUUID = uuid_to_bin(?);';
            /* var query = 'select CAST(uuid_from_bin(c.inviterUUID) as CHAR) as inviterUUID, CAST(uuid_from_bin(c.contactId) as CHAR) as contactId,' +
               'CAST(uuid_from_bin(c.inviteeUUID) as CHAR) as inviteeUUID,c.userActive,c.firstName,c.lastName,c.inviteeEmail,' +
               'c.status,c.isActive,c.invitationExpirationDate,c.invitationUTCTime,c.updatedAt,c.isChat, ' +
               '(select count(*) from chatMessage cM where isRead=0 and c.contactId = cM.contactId and cM.senderId=uuid_to_bin(?)) as count ' +
               'from contacts c where c.inviterUUID = uuid_to_bin(?);';*/
            var params = [inviterUUID, inviterUUID];
            debug('query', query);
            var result = await conn.query(query, params);
            /*if (!_.isEmpty(result)) {
                contact = result[0];
            }*/
            return cb(null, result || []);

        } catch (err) {
            debug('err', err);
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);

            if (err.code) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    getContact: function (options, cb) {
        var contactId = options.contactId;
        var err;
        if (DataUtils.isUndefined(contactId)) {
            err = new Error(ErrorConfig.MESSAGE.CONTACT_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
            debug('error', err);
            return cb(err);
        }
        ContactModel.get(contactId, {
            ConsistentRead: true
        }, function (err, contact) {
            if (err || !contact) {
                err = err || new Error(ErrorConfig.MESSAGE.CONTACT_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug('err', err);
                return cb(err);
            }
            contact = contact.attrs;
            return cb(err, contact);
        });
    },

    getContactMD: async function (options, errorOptions, cb) {
        var contactId = options.contactId;
        var err;

        if (DataUtils.isUndefined(contactId)) {
            err = new Error(ErrorConfig.MESSAGE.CONTACT_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('error', err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var query = 'select CAST(uuid_from_bin(inviterUUID) as CHAR) as inviterUUID, CAST(uuid_from_bin(contactId) as CHAR) as contactId,' +
              ' CAST(uuid_from_bin(inviteeUUID) as CHAR) as inviteeUUID,userActive,firstName,lastName,nickName,company,fax,phone,dialCode,phoneCountry,' +
              'primaryMobile,primaryMobileDialCode,primaryMobileCountry,secondaryMobile,secondaryMobileDialCode,secondaryMobileCountry,notes,' +
              'personalMessage,inviteeEmail,status,isActive,invitationExpirationDate,invitationUTCTime,actionUTCTime,createdAt,updatedAt ' +
              'from contacts where contactId = uuid_to_bin(?);';


            var getContact = await conn.query(query, [contactId]);
            getContact = Utils.filteredResponsePool(getContact);

            if (!getContact) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_ID_INVALID);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            return cb(null, getContact);
        } catch (err) {
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    updateMD: async function (options, auditOptions, errorOptions, cb) {

        var userId = options.userId;
        var contactId = options.contactId;
        var updatedAt = options.updatedAt;
        var phone = options.phone;
        var dialCode = options.dialCode;
        var phoneCountry = options.phoneCountry;
        var primaryMobile = options.primaryMobile;
        var primaryMobileDialCode = options.primaryMobileDialCode;
        var primaryMobileCountry = options.primaryMobileCountry;
        var secondaryMobile = options.secondaryMobile;
        var secondaryMobileDialCode = options.secondaryMobileDialCode;
        var secondaryMobileCountry = options.secondaryMobileCountry;


        var err;

        if (DataUtils.isValidateOptionalField(options.contactId)) {
            err = new Error(ErrorConfig.MESSAGE.CONTACT_ID_REQUIRED);
        }
        if (!err && !DataUtils.isString(options.contactId)) {
            err = new Error(ErrorConfig.MESSAGE.CONTACT_ID_MUST_BE_STRING);
        }
        if (!err && options.contactId === '') {
            err = new Error(ErrorConfig.MESSAGE.CONTACT_ID_CAN_NOT_EMPTY);
        }
        if (!err && DataUtils.isValidateOptionalField(options.updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            return cb(err);
        }

        if (DataUtils.isDefined(phone) || DataUtils.isDefined(dialCode) || DataUtils.isDefined(phoneCountry)) {
            if (DataUtils.isUndefined(phone)) {
                err = new Error(ErrorConfig.MESSAGE.PHONE_NUMBER_REQUIRED);
            } else if (DataUtils.isUndefined(dialCode)) {
                err = new Error(ErrorConfig.MESSAGE.DIAL_CODE_REQUIRED);
            } else if (DataUtils.isUndefined(phoneCountry)) {
                err = new Error(ErrorConfig.MESSAGE.PHONE_COUNTRY_REQUIRED);
            }
            if (err) {
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
        }
        if (DataUtils.isDefined(primaryMobile) || DataUtils.isDefined(primaryMobileDialCode) || DataUtils.isDefined(primaryMobileCountry)) {
            debug('Insid eif ');
            if (DataUtils.isUndefined(primaryMobile)) {
                err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_REQUIRED);
            } else if (DataUtils.isUndefined(primaryMobileDialCode)) {
                err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_DIAL_CODE_REQUIRED);
            } else if (DataUtils.isUndefined(primaryMobileCountry)) {
                err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_COUNTRY_REQUIRED);
            }
            if (err) {
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
        }
        if (DataUtils.isDefined(secondaryMobile) || DataUtils.isDefined(secondaryMobileDialCode) || DataUtils.isDefined(secondaryMobileCountry)) {
            if (DataUtils.isUndefined(secondaryMobile)) {
                err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_REQUIRED);
            } else if (DataUtils.isUndefined(secondaryMobileDialCode)) {
                err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_DIAL_CODE_REQUIRED);
            } else if (DataUtils.isUndefined(secondaryMobileCountry)) {
                err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_COUNTRY_REQUIRED);
            }
            if (err) {
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
        }

        try {
            var conn = await connection.getConnection();
            var contactOptions = await Contact.validateOptinalFields(options);
            var currentDate = new Date().getTime();

            var query = 'IF NOT EXISTS (select 1 from contacts where contactId = uuid_to_bin(?)) ' +
              'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "CONTACT_ID_INVALID";' +
              'ELSEIF NOT EXISTS (select 1 from contacts where contactId = uuid_to_bin(?) and updatedAt = ?) ' +
              'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4002,MESSAGE_TEXT = "CONTACT_UPDATED_SINCE_YOU_RETRIEVED";' +
              'ELSE update contacts set ' + contactOptions.contactFields + ' updatedAt = ?, updatedBy = uuid_to_bin(?) ' +
              'where contactId = uuid_to_bin(?); end if';

            var params = [contactId, contactId, updatedAt].concat(contactOptions.contactFieldsValues).concat([currentDate, userId, contactId]);
            var isUpdated = await conn.query(query, params);

            if (!Utils.isAffectedPool(isUpdated)) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }

            AuditUtils.create(auditOptions);
            return cb(null, {
                OK: Constants.SUCCESS_MESSAGE.UPDATE_CONTACT_SUCCESS,
                updatedAt: currentDate,
                contactId: contactId
            });

        } catch (err) {
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);

            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_ID_INVALID);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno === 4002) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_UPDATED_SINCE_YOU_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
            } else if (err.code) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    cancelMD: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var contactId = options.contactId;
        var updatedAt = options.updatedAt;
        var err;

        if (DataUtils.isUndefined(options.contactId)) {
            err = new Error(ErrorConfig.MESSAGE.CONTACT_ID_REQUIRED);

        }
        if (!err && DataUtils.isValidateOptionalField(options.updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.CONTACT_UPDATED_AT_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        try {
            await conn.query('START TRANSACTION;');

            await conn.query('IF NOT EXISTS(SELECT 1 from contacts where contactId = uuid_to_bin(?))' +
              'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "CONTACT_ID_INVALID";' +
              'ELSEIF NOT EXISTS(SELECT 1 from contacts where contactId = uuid_to_bin(?) and updatedAt = ?)' +
              'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4002,MESSAGE_TEXT = "CONTACT_UPDATED_SINCE_YOU_RETRIEVED"; end IF', [contactId, contactId, updatedAt]);


            var getContact = await conn.query('select invitationExpirationDate,status,CAST(uuid_from_bin(contactId) as CHAR) as contactId,' +
              'CAST(uuid_from_bin(inviteeUUID) as CHAR) as inviteeUUID, CAST(uuid_from_bin(inviterUUID) as CHAR) as inviterUUID from contacts where contactId = uuid_to_bin(?);', [contactId]);

            getContact = Utils.filteredResponsePool(getContact);

            if (!getContact) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }


            var userExist = await conn.query('select status,firstName,lastName,email,languageCultureCode, CAST(uuid_from_bin(id) as CHAR) as id from  users where id = uuid_to_bin(?);', [getContact.inviteeUUID]);
            var invitee = Utils.filteredResponsePool(userExist);

            if (!invitee) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_INVITEE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }
            var opt = {
                languageCultureCode: user.languageCultureCode,
                template: Constants.EMAIL_TEMPLATES.DECLINED_INVITE,
                email: invitee.email
            };
            var compileOptions = {
                name: invitee.firstName,
                user_email: user.email,
                scopehub_login: ''
            };
            var currentDate = new Date().getTime();

            if (currentDate > new Date(getContact.invitationExpirationDate).getTime()) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_INVITE_ALRAEDY_EXPIRED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            if (getContact.status !== Constants.CONTACT_STATUS.OPEN) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_INVITE_STATUS_NOT_OPEN);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            var notificationExpirationDate = new Date();
            debug('notificationExpirationDate', notificationExpirationDate);
            if (getContact.status === Constants.CONTACT_STATUS.OPEN && currentDate < new Date(getContact.invitationExpirationDate).getTime()) {
                var notification = await conn.query('IF EXISTS(select 1 from Notifications where refereId = uuid_to_bin(?) and notificationExpirationDate = ?)' +
                  'THEN UPDATE Notifications SET notificationExpirationDate = ?, updatedAt = ?,updatedBy = uuid_to_bin(?)' +
                  'WHERE refereId = uuid_to_bin(?);end IF',
                  [contactId, getContact.invitationExpirationDate, notificationExpirationDate, currentDate, user.id, contactId]);
                if (!Utils.isAffectedPool(notification)) {
                    err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    throw err;
                }

                EmailUtils.sendEmailMD(opt, compileOptions, async function (err) {
                    if (err) {

                        await conn.query('ROLLBACK;');
                        errorOptions.err = err;
                        await ErrorUtils.create(errorOptions);
                        return cb(err);
                    }
                    if (DataUtils.isUndefined(user.firstName)) {
                        user.firstName = '';
                    }
                    if (DataUtils.isUndefined(user.lastName)) {
                        user.lastName = '';
                    }
                    try {
                        NotificationApi = require('../api/notification');
                        var notificationOption = {
                            refereId: contactId,
                            refereType: Constants.NOTIFICATION_REFERE_TYPE.CONTACT,
                            user_ids: [invitee.id],
                            topic_id: invitee.id,
                            notificationExpirationDate: notificationExpirationDate,
                            paramasDateTime: new Date(),
                            notification_reference: NotificationReferenceData.CONTACT_INVITE_CANCEL,
                            metaEmail: user.email,
                            paramsInviter: user.email + ',' + (user.firstName ? user.firstName : '') + ' ' + (user.lastName ? user.lastName : ''),
                            paramsInvitee: invitee.email + ', ' + (invitee.firstName ? invitee.firstName : '') + ' ' + (invitee.lastName ? invitee.lastName : ''),
                            languageCultureCode: invitee.languageCultureCode,
                            createdBy: user.id
                        };

                        if (user.firstName) {
                            notificationOption.metaName = user.firstName;
                        }

                        await NotificationApi.createMD(notificationOption);
                        var contactUpdated = await conn.query('UPDATE contacts SET status = ?, invitationExpirationDate = ?, updatedAt = ?, updatedBy = uuid_to_bin(?)' +
                          'WHERE contactId = uuid_to_bin(?)', [Constants.CONTACT_STATUS.NO_INVITATION, notificationExpirationDate, currentDate, user.id, contactId]);
                        if (!Utils.isAffectedPool(contactUpdated)) {
                            err = new Error(ErrorConfig.MESSAGE.CONTACT_UPDATE_FAILED);
                            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                            throw err;
                        }

                        getContact.status = Constants.CONTACT_STATUS.NO_INVITATION;
                        getContact.invitationExpirationDate = notificationExpirationDate;
                        getContact.updatedAt = currentDate;
                        getContact.OK = Constants.SUCCESS_MESSAGE.CANCEL_CONTACT_SUCCESS;

                        AuditUtils.create(auditOptions);
                        delete getContact.inviterUUID;
                        delete getContact.inviteeUUID;
                        await conn.query('COMMIT;');
                        return cb(null, getContact);

                    } catch (err) {
                        await conn.query('ROLLBACK;');
                        errorOptions.err = err;
                        await ErrorUtils.create(errorOptions);
                        if (err.errno) {
                            err = new Error(ErrorConfig.MESSAGE.CONTACT_CANCEL_FAILED);
                            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                        }
                        return cb(err);
                    }
                });
            } else {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_CANCEL_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
        } catch (err) {
            await conn.query('ROLLBACK;');
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_ID_INVALID);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno === 4002) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_UPDATED_SINCE_YOU_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
            } else if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_CANCEL_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }

    },

    removeMD: async function (options, auditOptions, errorOptions, cb) {

        var user = options.user;
        var contactId = options.contactId;
        var updatedAt = options.updatedAt;
        var err;

        if (DataUtils.isUndefined(contactId)) {
            err = new Error(ErrorConfig.MESSAGE.CONTACT_ID_REQUIRED);
        }
        if (!err && DataUtils.isValidateOptionalField(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.CONTACT_UPDATED_AT_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        try {
            await conn.query('START TRANSACTION;');

            var query = 'select invitationExpirationDate,status,CAST(uuid_from_bin(inviteeUUID) as CHAR) as inviteeUUID, CAST(uuid_from_bin(inviterUUID) as CHAR) as inviterUUID,' +
              'inviteeEmail,updatedAt from contacts where contactId = uuid_to_bin(?);';

            var contactResult = await conn.query(query, [contactId]);
            var contact = Utils.filteredResponsePool(contactResult);
            debug('contact', contact);
            debug('updatedAt', updatedAt);

            if (!contact) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            if (contact.inviterUUID !== user.id) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_INVITER_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            if (contact.updatedAt !== parseInt(updatedAt)) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_UPDATED_SINCE_YOU_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            var currentDate = new Date().getTime();

            if (contact.status === Constants.CONTACT_STATUS.ACCEPTED || contact.status === Constants.CONTACT_STATUS.OPEN && currentDate < contact.invitationExpirationDate) {
                var invitee = await conn.query('select firstName,lastName,email,languageCultureCode,CAST(uuid_from_bin(id) as CHAR) as id from users where id = uuid_to_bin(?);',
                  [contact.inviteeUUID]);
                invitee = Utils.filteredResponsePool(invitee);

                if (!invitee) {
                    return cb();
                }

                var opt = {
                    languageCultureCode: invitee.languageCultureCode,
                    template: Constants.EMAIL_TEMPLATES.DECLINED_INVITE,
                    email: invitee.email
                };
                var compileOptions = {
                    name: invitee.firstName,
                    user_email: user.email,
                    scopehub_login: ''
                };

                EmailUtils.sendEmailMD(opt, compileOptions, async function (err) {

                    if (err) {
                        await conn.query('ROLLBACK;');
                        errorOptions.err = err;
                        await ErrorUtils.create(errorOptions);
                        return cb(err);
                    }
                    if (DataUtils.isUndefined(user.firstName)) {
                        user.firstName = '';
                    }
                    if (DataUtils.isUndefined(user.lastName)) {
                        user.lastName = '';
                    }
                    try {

                        var updateNotification;

                        if (contact.status === Constants.CONTACT_STATUS.ACCEPTED) {

                            var updateContact = await conn.query('update contacts set status = ?,isActive = 0,updatedAt = ? where inviterUUID = uuid_to_bin(?) and inviteeUUID = uuid_to_bin(?)',
                              [Constants.CONTACT_STATUS.STOPPED, currentDate, contact.inviteeUUID, contact.inviterUUID]);

                            if (!Utils.isAffectedPool(updateContact)) {
                                err = new Error(ErrorConfig.MESSAGE.CONTACT_INVITEE_NOT_FOUND);
                                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                                throw err;
                            }
                        }

                        if (contact.status === Constants.CONTACT_STATUS.OPEN && currentDate < contact.invitationExpirationDate) {
                            updateNotification = await conn.query('UPDATE Notifications SET notificationExpirationDate = utc_timestamp(3), updatedAt = ? WHERE ' +
                              'refereId = uuid_to_bin(?) and notificationReferenceId = ? and notificationExpirationDate = ?', [currentDate, contactId, 1, contact.invitationExpirationDate]);

                            if (!Utils.isAffectedPool(updateNotification)) {
                                err = new Error(ErrorConfig.MESSAGE.CONTACT_DELETE_FAILED);
                                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                                throw err;
                            }
                        }


                        NotificationApi = require('../api/notification');
                        var notificationOption = {
                            refereId: contactId,
                            refereType: Constants.NOTIFICATION_REFERE_TYPE.CONTACT,
                            notificationExpirationDate: contact.invitationExpirationDate,
                            notification_reference: NotificationReferenceData.CONTACT_INVITE_REMOVE,
                            metaEmail: user.email,
                            paramasDateTime: new Date(),
                            paramsInviter: user.email + ', ' + (user.firstName ? user.firstName : '') + ' ' + (user.lastName ? user.lastName : ''),
                            paramsInvitee: invitee.email + ', ' + (invitee.firstName ? invitee.firstName : '') + ' ' + (invitee.lastName ? invitee.lastName : ''),
                            createdBy: user.id,
                            languageCultureCode: invitee.languageCultureCode,
                            user_ids: [invitee.id],
                            type: Constants.DEFAULT_NOTIFICATION_TYPE
                        };
                        if (user.firstName) {
                            notificationOption.metaName = user.firstName;
                        }

                        await NotificationApi.createMD(notificationOption);


                        await conn.query('delete from contacts where contactId = uuid_to_bin(?)', [contactId]);
                        var updateOptions = {
                            inviterUUID: contact.inviterUUID,
                            inviteeUUID: contact.inviteeUUID,
                            updatedAt: updatedAt
                        };
                        debug('update123', updateOptions);
                        var updated = await ChatApi.updateChatMessageStatus(updateOptions);

                        await conn.query('COMMIT;');
                        AuditUtils.create(auditOptions);

                        return cb(null, {OK: Constants.SUCCESS_MESSAGE.REMOVE_CONTACT_SUCCESS});
                    } catch (err) {
                        console.log(err);
                        await conn.query('ROLLBACK;');
                        errorOptions.err = err;
                        await ErrorUtils.create(errorOptions);
                        if (err.code) {
                            err = new Error(ErrorConfig.MESSAGE.CONTACT_DELETE_FAILED);
                            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                        }
                        return cb(err);
                    }
                });

            } else {
                await conn.query('delete from contacts where contactId = uuid_to_bin(?)', [contactId]);

                var updateOptions = {
                    inviterUUID: contact.inviterUUID,
                    inviteeUUID: contact.inviteeUUID,
                    updatedAt: updatedAt
                };
                debug('update123', updateOptions);
                var updated = await ChatApi.updateChatMessageStatus(updateOptions);
                await conn.query('COMMIT;');
                return cb(null, {OK: Constants.SUCCESS_MESSAGE.REMOVE_CONTACT_SUCCESS});
            }

        } catch (err) {
            console.log(err);
            await conn.query('ROLLBACK;');
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_DELETE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    removeContactsMD: async function (options, auditOptions, errorOptions, cb) {

        var user = options.user;
        var contactIds = options.contactIds;
        var response;
        var deleteSuccess = [];
        var deleteConflict = [];
        var err;

        if (!contactIds || !contactIds.length) {
            err = new Error(ErrorConfig.MESSAGE.CONTACT_IDS_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            return cb(err);
        }

        try {

            await Promise.each(contactIds, async function (contact) {
                if (DataUtils.isUndefined(contact.contactId)) {
                    err = new Error(ErrorConfig.MESSAGE.CONTACT_ID_REQUIRED);
                }
                if (!err && DataUtils.isValidateOptionalField(contact.updatedAt)) {
                    err = new Error(ErrorConfig.MESSAGE.CONTACT_UPDATED_AT_REQUIRED);
                }
                if (err) {
                    throw err;
                }
            });
        } catch (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        Async.eachSeries(contactIds, function (contact, cbL1) {

            var contactOptions = {
                user: user,
                contactId: contact.contactId,
                updatedAt: contact.updatedAt
            };
            Contact.removeMD(contactOptions, auditOptions, errorOptions, async function (err, response) {

                if (err) {
                    errorOptions.err = err;
                    await ErrorUtils.create(errorOptions);
                    deleteConflict.push(contact.contactId);
                    return cbL1(null);
                }
                deleteSuccess.push(contact.contactId);
                return cbL1();
            });

        }, function (err) {
            if (err) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_DELETE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }

            if (deleteConflict.length > 0) {
                err = new Error(ErrorConfig.MESSAGE.CONTACTS_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                if (deleteSuccess.length > 0) {
                    err.data = {
                        successMsg: 'CONTACT_DELETED_SUCCESSFULLY',
                        success: deleteSuccess,
                        conflict: deleteConflict
                    };
                } else {
                    err.data = {
                        success: deleteSuccess,
                        conflict: deleteConflict
                    };
                }
                return cb(err);
            }

            response = {
                OK: Constants.SUCCESS_MESSAGE.REMOVE_CONTACT_SUCCESS,
                success: deleteSuccess
            };
            return cb(null, response);
        });

    },

    acceptDeclineIgnoreInvitationMD: async function (notification, auditOptions, errorOptions, cb) {

        var contactId = notification.contactId;
        var user = notification.user;
        var action = notification.action;
        var inviteeEmail = notification.inviteeEmail;
        var currentDate = new Date().getTime();
        var err;
        if (DataUtils.isUndefined(contactId)) {
            err = new Error(ErrorConfig.MESSAGE.CONTACT_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug(err);
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var getContactQuery = 'select CAST(uuid_from_bin(contactId) as CHAR) as contactId,CAST(uuid_from_bin(inviteeUUID) as CHAR) as inviteeUUID,' +
              ' CAST(uuid_from_bin(inviterUUID) as CHAR) as inviterUUID,userActive,firstName,lastName,nickName,inviteeEmail,' +
              'isActive,fax,phone,company,personalMessage,notes,status,invitationUTCTime,invitationExpirationDate,createdAt,' +
              'updatedAt from contacts where contactId = uuid_to_bin(?);';

            var contactResult = await conn.query(getContactQuery, [contactId]);
            var contact = Utils.filteredResponsePool(contactResult);

            if (!contact) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            var contactStatus;
            var notification_reference;
            var template;

            if (action === Constants.CONTACT_INVITATION_NOTIFICATION_ACTION.IGNORE) {

                //contactStatus = Constants.CONTACT_STATUS.IGNORED;
                notification_reference = NotificationReferenceData.CONTACT_INVITE_CANCEL;

            } else if (action === Constants.CONTACT_INVITATION_NOTIFICATION_ACTION.DECLINE) {

                template = Constants.EMAIL_TEMPLATES.DECLINED_INVITE;
                contactStatus = Constants.CONTACT_STATUS.DECLINED;
                notification_reference = NotificationReferenceData.CONTACT_INVITE_DECLINE;

            } else if (action === Constants.CONTACT_INVITATION_NOTIFICATION_ACTION.ACCEPT) {

                notification_reference = NotificationReferenceData.CONTACT_INVITE_ACCEPT;
                template = Constants.EMAIL_TEMPLATES.ACCEPT_INVITE;
                contactStatus = Constants.CONTACT_STATUS.ACCEPTED;

            } else {
                return cb();
            }

            if (contactStatus) {
                var contactUpdate = await conn.query('UPDATE contacts SET status = ?, actionUTCTime = utc_timestamp(3), updatedAt = ?,' +
                  'updatedBy = uuid_to_bin(?) where contactId = uuid_to_bin(?)', [contactStatus, currentDate, user.id, contactId]);
                debug('contactUpdate ', contactUpdate);
                if (!Utils.isAffectedPool(contactUpdate)) {
                    err = new Error(ErrorConfig.MESSAGE.CONTACT_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                    throw err;
                }
                contact.status = contactStatus;
                contact.updatedAt = currentDate;
            }

            if (action === Constants.CONTACT_INVITATION_NOTIFICATION_ACTION.IGNORE) {
                AuditUtils.create(auditOptions);
                return cb(null, contact);
            }

            if (action === Constants.CONTACT_INVITATION_NOTIFICATION_ACTION.ACCEPT) {

                var generatedId = Utils.generateId();
                contactId = generatedId.uuid;
                var inviterUUID = contact.inviteeUUID;
                var inviteeUUID = contact.inviterUUID;
                var userActive = 1;

                if (contact.userActive !== 1) {
                    contactStatus = Constants.CONTACT_STATUS.USER_UNAVAILABLE;
                    userActive = 0;
                }

                var query = 'IF EXISTS (SELECT 1 from contacts WHERE inviterUUID = uuid_to_bin(?) and inviteeUUID = uuid_to_bin(?))' +
                  'THEN UPDATE contacts SET status = ?, actionUTCTime = utc_timestamp(3), updatedAt = ?,userActive = ?,' +
                  'updatedBy = uuid_to_bin(?) WHERE inviterUUID = uuid_to_bin(?) and inviteeUUID = uuid_to_bin(?);' +
                  'ELSE INSERT INTO contacts SET contactId = uuid_to_bin(?),inviterUUID = uuid_to_bin(?),inviteeUUID = uuid_to_bin(?),status = ?,' +
                  'firstName = (select firstName from users where id = uuid_to_bin(?)),lastName =(select lastName from users where id = uuid_to_bin(?)),' +
                  'inviteeEmail = (select email from users where id = uuid_to_bin(?)), actionUTCTime = utc_timestamp(3), createdAt = ?,userActive = ?,' +
                  'isActive = true,updatedAt = ?, invitationUTCTime = utc_timestamp(3),invitationExpirationDate = ?,createdBy = uuid_to_bin(?); end IF';

                var params = [inviterUUID, inviteeUUID, contactStatus, currentDate, userActive, user.id, inviterUUID, inviteeUUID, contactId, inviterUUID, inviteeUUID, contactStatus,
                    inviteeUUID, inviteeUUID, inviteeUUID, currentDate, userActive, currentDate, new Date(Constants.DEFAULT_TIMESTAMP), inviterUUID];

                contactUpdate = await conn.query(query, params);

                if (!Utils.isAffectedPool(contactUpdate)) {
                    err = new Error(ErrorConfig.MESSAGE.CONTACT_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    throw err;
                }

            }

            var invitee = await conn.query('select firstName,lastName,email,languageCultureCode,CAST(uuid_from_bin(id) as CHAR) as id from users where email = ?;', [inviteeEmail]);
            invitee = Utils.filteredResponsePool(invitee);

            if (!invitee) {
                err = new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }

            var opt = {
                languageCultureCode: invitee.languageCultureCode,
                template: template,
                email: invitee.email
            };
            var compileOptions = {
                name: invitee.firstName,
                friend_name: user.firstName,
                user_email: user.email,
                scopehub_login: Endpoints.SCOPEHUB_LOGIN_URL
            };

            EmailUtils.sendEmailMD(opt, compileOptions, async function (err) {

                if (err) {
                    await conn.query('ROLLBACK;');
                    errorOptions.err = err;
                    await ErrorUtils.create(errorOptions);
                    throw err;
                }
                if (DataUtils.isUndefined(user.firstName)) {
                    user.firstName = '';
                }
                if (DataUtils.isUndefined(user.lastName)) {
                    user.lastName = '';
                }

                try {

                    NotificationApi = require('../api/notification');
                    var notificationOption = {
                        refereId: contactId,
                        refereType: Constants.NOTIFICATION_REFERE_TYPE.CONTACT,
                        user_ids: [invitee.id],
                        topic_id: invitee.id,
                        notificationExpirationDate: contact.invitationExpirationDate,
                        paramasDateTime: new Date(),
                        notification_reference: notification_reference,
                        metaEmail: user.email,
                        paramsInviter: user.email + ', ' + (user.firstName ? user.firstName : '') + ' ' + (user.lastName ? user.lastName : ''),
                        paramsInvitee: invitee.email + ', ' + (invitee.firstName ? invitee.firstName : '') + ' ' + (invitee.lastName ? invitee.lastName : ''),
                        languageCultureCode: invitee.languageCultureCode,
                        createdBy: user.id,
                        type: Constants.DEFAULT_NOTIFICATION_TYPE
                    };

                    if (user.firstName) {
                        notificationOption.metaName = user.firstName;
                    }

                    await NotificationApi.createMD(notificationOption);

                    AuditUtils.create(auditOptions);
                    return cb(null, contact);

                } catch (err) {
                    debug('err', err);
                    errorOptions.err = err;
                    await ErrorUtils.create(errorOptions);
                    if (err.errno) {
                        err = new Error(ErrorConfig.MESSAGE.CONTACT_UPDATE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    }
                    return cb(err);
                }
            });
        } catch (err) {
            debug('err', err);
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);

            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    blockContactMD: async function (options, auditOptions, errorOptions, cb) {
        var err;

        if (DataUtils.isUndefined(options.contactId)) {
            err = new Error(ErrorConfig.MESSAGE.CONTACT_ID_REQUIRED);
        }
        if (!err && DataUtils.isValidateOptionalField(options.updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.CONTACT_UPDATED_AT_REQUIRED);
        }

        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        try {
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            await conn.query('START TRANSACTION;');

            var getContact = await conn.query('select CAST(uuid_from_bin(contactId) as CHAR) as contactId,CAST(uuid_from_bin(inviteeUUID) as CHAR) as inviteeUUID,' +
              'CAST(uuid_from_bin(inviterUUID) as CHAR) as inviterUUID,' +
              'firstName,lastName,nickName,inviteeEmail,isActive,fax,phone,company,personalMessage,notes,status,invitationUTCTime,invitationExpirationDate,createdAt,' +
              'updatedAt from contacts where contactId = uuid_to_bin(?);', [options.contactId]);

            getContact = Utils.filteredResponsePool(getContact);
            debug('getContact', getContact);

            if (!getContact) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            if (getContact.updatedAt !== options.updatedAt) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_UPDATED_SINCE_YOU_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            if (getContact.status === Constants.CONTACT_STATUS.BLOCKED) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_ALREADY_BLOCKED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            if (getContact.status === Constants.CONTACT_STATUS.ACCEPTED) {

                var currentDate = new Date().getTime();
                var inviteeUUID = getContact.inviterUUID;
                var inviterUUID = getContact.inviteeUUID;

                var inviteeBlock = await conn.query('UPDATE contacts SET status = ?,updatedAt = ? ' +
                  'where inviteeUUID = uuid_to_bin(?) and inviterUUID = uuid_to_bin(?);',
                  [Constants.CONTACT_STATUS.BLOCKED_BY_PARTNER, currentDate, inviteeUUID, inviterUUID]);
                debug('inviteeBlock', [Constants.CONTACT_STATUS.BLOCKED_BY_PARTNER, currentDate, inviteeUUID, inviterUUID]);
                debug('inviteeBlock', inviteeBlock);
                if (!Utils.isAffectedPool(inviteeBlock)) {
                    err = new Error(ErrorConfig.MESSAGE.CONTACT_INVITEE_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    throw err;
                }

                debug('12345', [Constants.CONTACT_STATUS.BLOCKED, currentDate, options.contactId, options.updatedAt]);

                var inviterBlock = await conn.query('UPDATE contacts SET status = ?,updatedAt = ? ' +
                  'where contactId = uuid_to_bin(?) and updatedAt = ?;',
                  [Constants.CONTACT_STATUS.BLOCKED, currentDate, options.contactId, options.updatedAt]);

                if (!Utils.isAffectedPool(inviterBlock)) {
                    err = new Error(ErrorConfig.MESSAGE.CONTACT_INVITER_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    throw err;
                }

                await conn.query('COMMIT;');
                AuditUtils.create(auditOptions);
                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.CONTACT_BLOCK_SUCCESS,
                    status: Constants.CONTACT_STATUS.BLOCKED,
                    contactId: options.contactId,
                    updatedAt: currentDate
                });

            } else {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_STATUS_IS_NOT_ACCEPTED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }
        } catch (err) {

            await conn.query('ROLLBACK;');
            console.log(err);
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);

            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_BLOCK_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }

    },

    unBlockContactMD: async function (options, auditOptions, errorOptions, cb) {
        var err;

        if (DataUtils.isUndefined(options.contactId)) {
            err = new Error(ErrorConfig.MESSAGE.CONTACT_ID_REQUIRED);
        }
        if (!err && DataUtils.isValidateOptionalField(options.updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.CONTACT_UPDATED_AT_REQUIRED);
        }
        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
        try {
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            await conn.query('START TRANSACTION;');

            var getContact = await conn.query('select CAST(uuid_from_bin(contactId) as CHAR) as contactId,CAST(uuid_from_bin(inviterUUID) as CHAR) as inviterUUID,' +
              'CAST(uuid_from_bin(inviteeUUID) as CHAR) as inviteeUUID,status,updatedAt from contacts ' +
              'where contactId = uuid_to_bin(?);', [options.contactId]);

            getContact = Utils.filteredResponsePool(getContact);

            if (!getContact) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            if (getContact.updatedAt !== options.updatedAt) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_UPDATED_SINCE_YOU_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            if (getContact.status === Constants.CONTACT_STATUS.BLOCKED) {

                var currentDate = new Date().getTime();
                var inviteeUUID = getContact.inviterUUID;
                var inviterUUID = getContact.inviteeUUID;

                var inviteeBlock = await conn.query('UPDATE contacts SET status = ?,updatedAt = ? ' +
                  'where inviteeUUID = uuid_to_bin(?) and inviterUUID = uuid_to_bin(?);',
                  [Constants.CONTACT_STATUS.NO_INVITATION, currentDate, inviteeUUID, inviterUUID]);

                if (!Utils.isAffectedPool(inviteeBlock)) {
                    err = new Error(ErrorConfig.MESSAGE.CONTACT_INVITEE_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    throw err;
                }

                var inviterBlock = await conn.query('UPDATE contacts SET status = ?,updatedAt = ? ' +
                  'where contactId = uuid_to_bin(?) and updatedAt = ?;',
                  [Constants.CONTACT_STATUS.NO_INVITATION, currentDate, options.contactId, options.updatedAt]);

                if (!Utils.isAffectedPool(inviterBlock)) {
                    err = new Error(ErrorConfig.MESSAGE.CONTACT_INVITER_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    throw err;
                }

                await conn.query('COMMIT;');
                AuditUtils.create(auditOptions);

                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.CONTACT_UNBLOCK_SUCCESS,
                    status: Constants.CONTACT_STATUS.NO_INVITATION,
                    contactId: options.contactId,
                    updatedAt: currentDate
                });

            } else {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_IS_ALREADY_UNBLOCK);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }
        } catch (err) {
            await conn.query('ROLLBACK;');
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);

            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_UNBLOCK_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    acceptInvitation: function (notification, auditOptions, cb) {

        var contactId = notification.contactId;
        var currentDate = new Date().getTime();
        var err;
        if (DataUtils.isUndefined(contactId)) {
            err = new Error(ErrorConfig.MESSAGE.CONTACT_ID_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug(err);
            return cb(err);
        }

        Contact.getContact(notification, function (err, contact) {
            if (err || !contact) {
                err = err || new Error(ErrorConfig.MESSAGE.CONTACT_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            var contactOptions = {
                id: contact.id,
                status: Constants.CONTACT_STATUS.ACCEPTED,
                actionUTCTime: DataUtils.getCurrentUtcDateString()
            };
            auditOptions.metaData = {
                old_contact: contact
            };

            ContactModel.update(contactOptions, function (err, contact) {
                if (err || !contact) {
                    err = err || new Error(ErrorConfig.MESSAGE.CONTACT_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                    return cb(err);
                }
                contact = contact.attrs;
                auditOptions.metaData.new_contact = contact;
                AuditUtils.create(auditOptions);

                var languageCultureCode = notification.user.languageCultureCode;
                var inviterId = contact.inviterUUID;

                UserModel.get(inviterId, function (err, inviter) {
                    if (err || !inviter) {
                        err = err || new Error(ErrorConfig.MESSAGE.INVITER_NOT_FOUND);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        return cb(err);
                    }
                    inviter = inviter && inviter.attrs;
                    var opt = {
                        languageCultureCode: languageCultureCode,
                        template: Constants.EMAIL_TEMPLATES.ACCEPT_INVITE,
                        email: inviter.email
                    };
                    var compileOptions = {
                        name: inviter.firstName,
                        friend_name: notification.user.firstName,
                        user_email: notification.user.email,
                        scopehub_login: Endpoints.SCOPEHUB_LOGIN_URL
                    };

                    EmailUtils.sendEmail(opt, compileOptions, function (err) {
                        if (err) {
                            return cb(err);
                        }
                        if (DataUtils.isUndefined(notification.user.firstName)) {
                            notification.user.firstName = '';
                        }
                        if (DataUtils.isUndefined(notification.user.lastName)) {
                            notification.user.lastName = '';
                        }
                        var notificationOption = {
                            contactId: contact.id,
                            user_ids: [inviter.id],
                            topic_id: inviter.id,
                            notification_reference: NotificationReferenceData.CONTACT_INVITE_ACCEPT,
                            data: {
                                contact: {
                                    invitee: notification.user.email + ', ' + notification.user.firstName + ' ' + notification.user.lastName,
                                    acceptance_datetime: currentDate
                                }
                            },
                            meta: {
                                email: notification.user.email
                            },
                            languageCultureCode: inviter.languageCultureCode
                        };
                        if (notification.user.firstName) {
                            notificationOption.metaName = notification.user.firstName;
                        }

                        NotificationApi = require('../api/notification');
                        NotificationApi.create(notificationOption, function (err) {
                            if (err) {
                                debug('error', err);
                            } else {
                                var contactOption = {
                                    inviterUUID: contact.inviteeUUID,
                                    inviteeUUID: contact.inviterUUID,
                                    invitationUTCTime: contact.actionUTCTime,
                                    actionUTCTime: contact.actionUTCTime,
                                    firstName: inviter.firstName,
                                    lastName: inviter.lastName,
                                    inviteeEmail: inviter.email,
                                    createdBy: notification.user.id,
                                    status: Constants.CONTACT_STATUS.ACCEPTED,
                                    isActive: true
                                };
                                var params = {overwrite: false};

                                ContactModel
                                  .query(contactOption.inviterUUID)
                                  .usingIndex(Constants.CONTACT_INVITER_UUID_INVITEE_EMAIL_INDEX).where(Constants.CONTACT_INVITEE_EMAIL).equals(contactOption.inviteeEmail)
                                  .exec(function (err, data) {
                                      if (err) {
                                          return cb(err);
                                      }
                                      if (!_.isEmpty(data) && !_.isEmpty(data.Items)) {
                                          var inviteeContact = (_.map(data.Items, 'attrs'));
                                          inviteeContact = inviteeContact[0];
                                          auditOptions.metaData = {
                                              old_contact: inviteeContact
                                          };
                                          var inviteeContactOptions = {
                                              id: inviteeContact.id,
                                              status: Constants.CONTACT_STATUS.ACCEPTED,
                                              invitationUTCTime: contact.actionUTCTime,
                                              actionUTCTime: contact.actionUTCTime,
                                              isActive: true,
                                              inviterUUID: contact.inviteeUUID,
                                              inviteeUUID: contact.inviterUUID
                                          };
                                          ContactModel.update(inviteeContactOptions, {
                                              ReturnValues: 'ALL_NEW'
                                          }, function (err, inviteeContact) {
                                              if (err || !inviteeContact) {
                                                  err = err || new Error(ErrorConfig.MESSAGE.CONTACT_UPDATE_FAILED);
                                                  err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                                                  Util.log(err);
                                                  return cb(err);
                                              }
                                              inviteeContact = inviteeContact.attrs;
                                              auditOptions.metaData.new_contact = inviteeContact;
                                              AuditUtils.create(auditOptions);
                                              return cb(null, inviteeContact);
                                          });
                                      } else {
                                          ContactModel.create(contactOption, params, function (err, inviteeContact) {
                                              if (err || !inviteeContact) {
                                                  debug(err || 'Failed to create contact');
                                                  err = new Error(ErrorConfig.MESSAGE.CONTACT_CREATE_FAILED);
                                                  err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                                                  return cb(err);
                                              }
                                              inviteeContact = inviteeContact.attrs;
                                              auditOptions.metaData = {
                                                  inviteeContact: inviteeContact
                                              };
                                              AuditUtils.create(auditOptions);
                                              return cb(null, inviteeContact);
                                          });
                                      }
                                  });
                            }
                        });
                    });
                });
            });
        });
    },

    declineInvitation: function (notification, auditOptions, cb) {
        var contactId = notification.contactId;
        var currentDate = new Date().getTime();
        var err;
        if (DataUtils.isUndefined(contactId)) {
            err = new Error(ErrorConfig.MESSAGE.CONTACT_ID_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug(err);
            return cb(err);
        }

        Contact.getContact(notification, function (err, contact) {
            if (err || !contact) {
                err = err || new Error(ErrorConfig.MESSAGE.CONTACT_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }

            var contactOptions = {
                id: contact.id,
                status: Constants.CONTACT_STATUS.DECLINED,
                actionUTCTime: DataUtils.getCurrentUtcDateString()
            };
            auditOptions.metaData = {
                old_contact: contact
            };

            ContactModel.update(contactOptions, function (err, contact) {
                if (err || !contact) {
                    err = err || new Error(ErrorConfig.MESSAGE.CONTACT_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                    return cb(err);
                }
                contact = contact.attrs;
                auditOptions.metaData.new_contact = contact;
                AuditUtils.create(auditOptions);

                var languageCultureCode = notification.user.languageCultureCode;
                var inviterId = contact.inviterUUID;

                UserModel.get(inviterId, function (err, inviter) {
                    if (err || !inviter) {
                        err = err || new Error(ErrorConfig.MESSAGE.INVITER_NOT_FOUND);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        return cb(err);
                    }
                    inviter = inviter && inviter.attrs;

                    var opt = {
                        languageCultureCode: languageCultureCode,
                        template: Constants.EMAIL_TEMPLATES.DECLINED_INVITE,
                        email: inviter.email
                    };
                    var compileOptions = {
                        name: inviter.firstName,
                        user_email: notification.user.email,
                        scopehub_login: ''
                    };

                    EmailUtils.sendEmail(opt, compileOptions, function (err) {
                        if (err) {
                            return cb(err);
                        }
                        if (DataUtils.isUndefined(notification.user.firstName)) {
                            notification.user.firstName = '';
                        }
                        if (DataUtils.isUndefined(notification.user.lastName)) {
                            notification.user.lastName = '';
                        }
                        var notificationOption = {
                            contactId: contact.id,
                            user_ids: [inviter.id],
                            topic_id: inviter.id,
                            notification_reference: NotificationReferenceData.CONTACT_INVITE_DECLINE,
                            data: {
                                contact: {
                                    invitee: notification.user.email + ', ' + notification.user.firstName + ' ' + notification.user.lastName,
                                    decline_datetime: currentDate
                                }
                            },
                            meta: {
                                email: notification.user.email
                            },
                            languageCultureCode: inviter.languageCultureCode
                        };
                        if (notification.user.firstName) {
                            notificationOption.meta['name'] = notification.user.firstName;
                        }
                        NotificationApi = require('../api/notification');
                        NotificationApi.create(notificationOption, function (err) {
                            if (err) {
                                debug('error', err);
                            }
                            return cb(null, contact);
                        });
                    });
                });
            });
        });
    },

    ignoreInvitation: function (notification, auditOptions, cb) {
        var contactId = notification.contactId;
        var err;
        if (DataUtils.isUndefined(contactId)) {
            err = new Error(ErrorConfig.MESSAGE.CONTACT_ID_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug(err);
            return cb(err);
        }

        Contact.getContact(notification, function (err, contact) {
            if (err || !contact) {
                err = err || new Error(ErrorConfig.MESSAGE.CONTACT_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            var contactOptions = {
                id: contact.id,
                status: Constants.CONTACT_STATUS.IGNORED,
                actionUTCTime: DataUtils.getCurrentUtcDateString()
            };
            auditOptions.metaData = {
                old_contact: contact
            };
            ContactModel.update(contactOptions, function (err, contact) {
                if (err || !contact) {
                    err = err || new Error(ErrorConfig.MESSAGE.CONTACT_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                    return cb(err);
                }
                contact = contact.attrs;
                auditOptions.metaData.new_contact = contact;
                AuditUtils.create(auditOptions);
                return cb(null, contact);
            });
        });
    },

    validateOptinalFields: function (options) {
        var contactFields = '';
        var contactFieldsValues = [];
        var err;

        if (!err && !DataUtils.isValidateOptionalField(options.firstName)) {
            if (!DataUtils.isString(options.firstName)) {
                throw new Error(ErrorConfig.MESSAGE.CONTACT_FIRST_NAME_MUST_BE_STRING);
            } else if (options.firstName === '') {
                throw new Error(ErrorConfig.MESSAGE.CONTACT_FIRST_NAME_CAN_NOT_EMPTY);
            } else if (!err && options.firstName.length > 60) {
                throw new Error(ErrorConfig.MESSAGE.CONTACT_FIRST_NAME_LENGTH_SHOULD_BE_LESS_THAN_60);
            } else {
                contactFields += ' firstName = ?,';
                contactFieldsValues.push(options.firstName);
            }
        }
        if (!err && !DataUtils.isValidateOptionalField(options.lastName)) {
            if (!DataUtils.isString(options.lastName)) {
                throw new Error(ErrorConfig.MESSAGE.CONTACT_LAST_NAME_MUST_BE_STRING);
            } else if (options.lastName === '') {
                throw new Error(ErrorConfig.MESSAGE.CONTACT_LAST_NAME_CAN_NOT_EMPTY);
            } else if (!err && options.lastName.length > 60) {
                throw new Error(ErrorConfig.MESSAGE.CONTACT_LAST_NAME_LENGTH_SHOULD_BE_LESS_THAN_60);
            } else {
                contactFields += ' lastName = ?,';
                contactFieldsValues.push(options.lastName);
            }
        }

        if (!err && !DataUtils.isValidateOptionalField(options.nickName)) {
            if (!DataUtils.isString(options.nickName)) {
                throw new Error(ErrorConfig.MESSAGE.CONTACT_NICK_NAME_MUST_BE_STRING);
            } else if (!err && options.nickName.length > 60) {
                throw new Error(ErrorConfig.MESSAGE.CONTACT_NICK_NAME_LENGTH_SHOULD_BE_LESS_THAN_60);
            } else {
                contactFields += ' nickName = ?,';
                contactFieldsValues.push(options.nickName);
            }
        }

        if (!err && !DataUtils.isValidateOptionalField(options.company)) {
            if (!DataUtils.isString(options.company)) {
                throw new Error(ErrorConfig.MESSAGE.CONTACT_COMPANY_NAME_MUST_BE_STRING);
            } else if (!err && options.company.length > 60) {
                throw new Error(ErrorConfig.MESSAGE.CONTACT_COMPANY_NAME_LENGTH_SHOULD_BE_LESS_THAN_60);
            } else {
                contactFields += ' company = ?,';
                contactFieldsValues.push(options.company);
            }
        }
        if (!err && !DataUtils.isValidateOptionalField(options.personalMessage)) {
            if (!DataUtils.isString(options.personalMessage)) {
                throw new Error(ErrorConfig.MESSAGE.CONTACT_PERSONAL_MESSAGE_MUST_BE_STRING);
            } else {
                contactFields += ' personalMessage = ?,';
                contactFieldsValues.push(options.personalMessage);
            }
        }
        if (!err && !DataUtils.isValidateOptionalField(options.notes)) {
            if (!err && !DataUtils.isString(options.notes)) {
                throw new Error(ErrorConfig.MESSAGE.CONTACT_NOTES_MUST_BE_STRING);
            } else {
                contactFields += ' notes = ?,';
                contactFieldsValues.push(options.notes);
            }
        }

        if (!err && !DataUtils.isValidateOptionalField(options.inviteeEmail)) {
            if (!err && !DataUtils.isString(options.inviteeEmail)) {
                throw new Error(ErrorConfig.MESSAGE.CONTACT_INVITEE_EMAIL_MUST_BE_STRING);
            } else if (!err && options.inviteeEmail.length > 60) {
                throw new Error(ErrorConfig.MESSAGE.CONTACT_INVITEE_EMAIL_LENGTH_SHOULD_BE_LESS_THAN_60);
            } else {
                contactFields += ' inviteeEmail = ?,';
                contactFieldsValues.push(options.inviteeEmail);
            }
        }
        if (!err && !DataUtils.isValidateOptionalField(options.fax)) {
            if (!err && !DataUtils.isMobile(options.fax)) {
                throw new Error(ErrorConfig.MESSAGE.CONTACT_FAX_MUST_BE_NUMBER);
            } else if (options.fax.toString().length > 15) {
                throw new Error(ErrorConfig.MESSAGE.CONTACT_FAX_NUMBER_LESS_THAN_15_CHARACTER);
            } else {
                contactFields += ' fax = ?,';
                contactFieldsValues.push(options.fax);
            }
        }
        if (!err && !DataUtils.isValidateOptionalField(options.dialCode)) {
            if (!DataUtils.isString(options.dialCode)) {
                throw new Error(ErrorConfig.MESSAGE.DIAL_CODE_MUST_BE_STRING);
            } else if (options.dialCode.toString().length > 5) {
                throw new Error(ErrorConfig.MESSAGE.DIAL_CODE_MUST_BE_LESS_THAN_5_CHARACTER);
            } else {
                contactFields += 'dialCode = ?,';
                contactFieldsValues.push(options.dialCode);
            }
        }

        if (!DataUtils.isValidateOptionalField(options.phoneCountry)) {
            if (!DataUtils.isString(options.phoneCountry)) {
                throw  new Error(ErrorConfig.MESSAGE.PHONE_COUNTRY_MUST_BE_STRING);
            } else if (options.phoneCountry.toString().length > 2) {
                throw new Error(ErrorConfig.MESSAGE.PHONE_COUNTRY_MUST_BE_LESS_THAN_2_CHARACTER);
            } else {
                contactFields += 'phoneCountry=? ,';
                contactFieldsValues.push(options.phoneCountry);
            }
        }

        if (!err && !DataUtils.isValidateOptionalField(options.phone)) {
            if (!DataUtils.isMobile(options.phone)) {
                throw new Error(ErrorConfig.MESSAGE.CONTACT_PHONE_NUMBER_MUST_BE_NUMBER);
            } else if (options.phone.toString().length > 15) {
                throw new Error(ErrorConfig.MESSAGE.CONTACT_PHONE_NUMBER_LESS_THAN_15_CHARACTER);
            } else {
                contactFields += 'phone = ?,';
                contactFieldsValues.push(options.dialCode + '' + options.phone);
            }
        }

        if (!DataUtils.isValidateOptionalField(options.primaryMobileDialCode)) {
            if (!DataUtils.isString(options.primaryMobileDialCode)) {
                throw new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_DIAL_CODE_MUST_BE_STRING);
            } else if (options.primaryMobileDialCode.length > 5) {
                throw  new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_DIAL_CODE_MUST_BE_LESS_THAN_5_CHARACTER);
            } else {
                contactFields += 'primaryMobileDialCode=? ,';
                contactFieldsValues.push(options.primaryMobileDialCode);
            }
        }

        if (!DataUtils.isValidateOptionalField(options.primaryMobileCountry)) {
            if (!DataUtils.isString(options.primaryMobileCountry)) {
                throw new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_COUNTRY_MUST_BE_STRING);
            } else if (options.primaryMobileCountry.length > 2) {
                throw new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_COUNTRY_MUST_BE_LESS_THAN_2_CHARACTER);
            } else {
                contactFields += 'primaryMobileCountry=? ,';
                contactFieldsValues.push(options.primaryMobileCountry);
            }
        }

        if (!DataUtils.isValidateOptionalField(options.primaryMobile)) {
            if (!DataUtils.isMobile(options.primaryMobile)) {
                throw new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_MUST_BE_VALID_NUMBER);
            } else if (options.primaryMobile.toString().length > 15) {
                throw new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_MUST_BE_LESS_THAN_OF_15_DIGIT);
            } else {
                contactFields += 'primaryMobile=? ,';
                contactFieldsValues.push(options.primaryMobileDialCode + '' + options.primaryMobile);
            }
        }

        if (!DataUtils.isValidateOptionalField(options.secondaryMobileDialCode)) {
            if (!DataUtils.isString(options.secondaryMobileDialCode)) {
                throw  new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_DIAL_CODE_MUST_BE_STRING);
            } else if (options.secondaryMobileDialCode.length > 5) {
                throw new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_DIAL_CODE_MUST_BE_LESS_THAN_5_CHARACTER);
            } else {
                contactFields += 'secondaryMobileDialCode=? ,';
                contactFieldsValues.push(options.secondaryMobileDialCode);
            }
        }

        if (!DataUtils.isValidateOptionalField(options.secondaryMobileCountry)) {
            if (!DataUtils.isString(options.secondaryMobileCountry)) {
                throw new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_COUNTRY_MUST_BE_STRING);
            } else if (options.secondaryMobileCountry.length > 2) {
                throw new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_COUNTRY_MUST_BE_LESS_THAN_2_CHARACTER);
            } else {
                contactFields += 'secondaryMobileCountry=? ,';
                contactFieldsValues.push(options.secondaryMobileCountry);
            }
        }

        if (!DataUtils.isValidateOptionalField(options.secondaryMobile)) {
            if (!DataUtils.isMobile(options.secondaryMobile)) {
                throw new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_MUST_BE_NUMBER);
            } else if (options.secondaryMobile.toString().length > 15) {
                throw new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_MUST_BE_LESS_THAN_OF_15_DIGIT);
            } else {
                contactFields += 'secondaryMobile=? ,';
                contactFieldsValues.push(options.secondaryMobileDialCode + '' + options.secondaryMobile);
            }
        }

        var response = {
            contactFields: contactFields,
            contactFieldsValues: contactFieldsValues
        };
        return response;
    }
};

module.exports = Contact;