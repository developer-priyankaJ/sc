'use strict';

var debug = require('debug')('scopehub.api.in_sharing');
var Util = require('util');
var _ = require('lodash');
var Async = require('async');
var connection = require('../lib/connection_util');
var Promise = require('bluebird');
var moment = require('moment');

var ErrorUtils = require('../lib/error_utils');
var Utils = require('../lib/utils');
var ErrorConfig = require('../data/error');
var DataUtils = require('../lib/data_utils');
var AuditUtils = require('../lib/audit_utils');
var Constants = require('../data/constants');
var InShareModel = require('../model/in_share');
var OutShareInstanceApi = require('./out_share_instance');
var UserModel = require('../model/user');
var NotificationReferenceData = require('../data/notification_reference');
var ProductInventoryApi = require('./product_inventory');
var OutSharaingApi = require('./out_sharing');
var Customer = require('./customer');
var EmailUtils = require('../lib/email_utils');
var TwilioUtils = require('../lib/twilio_utils');
var Endpoints = require('../config/endpoints');
var TwilioConfig = require('../config/twilio');

var InShare = {

    createMD: async function (options, errorOptions, cb) {

        var accountId = options.accountId;
        var user = options.user;
        var outSharing = options.outShareIds;
        var failedOutShare = [];
        var successOutShare = [];
        var successInShareAccounts = [];
        var currentDate = new Date().getTime();
        var errors = [];
        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        try {
            var outShareInstanceId = outSharing.id;

            //await conn.query('START TRANSACTION;');
            var outShare = await conn.query('select *,updatedAt,' +
              'CAST(uuid_from_bin(accountId) as char) as accountId,status from OutShare where id = uuid_to_bin(?)', [outShareInstanceId]);
            outShare = Utils.filteredResponsePool(outShare);

            var outSharePartners = await conn.query('select *,CAST(uuid_from_bin(id) as char) as id,' +
              'CAST(uuid_from_bin(inSharePartnerId) as char) as inSharePartnerId,updatedAt,' +
              'CAST(uuid_from_bin(outShareInstanceId) as char) as outShareInstanceId from OutSharePartners where outShareInstanceId = uuid_to_bin(?)', [outShareInstanceId]);

            var status = Object.keys(Constants.OUT_SHARE_STATUS)[Object.values(Constants.OUT_SHARE_STATUS).indexOf(outShare.status)];
            status = Constants.OUT_SHARE_STATUS_ACTION[status];

            if (!outShare) {
                debug('Inside if');
                failedOutShare.push({
                    id: outShareInstanceId,
                    status: status,
                    updatedAt: outSharing.updatedAt
                });
                errors[outShareInstanceId] = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ID_INVALID);
            } else if (outShare.accountId !== accountId) {
                debug('Inside else  if 1');
                failedOutShare.push({
                    id: outShareInstanceId,
                    status: status,
                    updatedAt: outSharing.updatedAt
                });
                errors[outShareInstanceId] = new Error(ErrorConfig.MESSAGE.OUT_SHARE_NOT_ASSOCIATED_WITH_OUT_SHARE_PARTNER);
            } else if (outShare.status === Constants.OUT_SHARE_STATUS.INVITATION_SENT) {
                debug('Inside else  if 2');
                failedOutShare.push({
                    id: outShareInstanceId,
                    status: status,
                    updatedAt: outSharing.updatedAt
                });
                errors[outShareInstanceId] = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INVITE_ALREADY_SENT);
            } else if (parseInt(outSharing.updatedAt) !== outShare.updatedAt) {
                debug('Inside else  if 3');
                failedOutShare.push({
                    id: outShareInstanceId,
                    status: status,
                    updatedAt: outSharing.updatedAt
                });
                errors[outShareInstanceId] = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
            } else {
                await Promise.each(outSharePartners, async function (partnerAccount) {
                    try {
                        var partnerAccountId = partnerAccount.inSharePartnerId;
                        var id = Utils.generateId().uuid;

                        var inshareValues = [partnerAccountId, id, outShareInstanceId, partnerAccountId, Constants.IN_SHARE_STATUS.NEW,
                            currentDate, currentDate, options.user.id, currentDate, currentDate, currentDate];
                        debug('inshare value', inshareValues);
                        var createInShare = await conn.query('' +
                          'IF NOT EXISTS(select 1 from accounts where id = uuid_to_bin(?) and status = "active") ' +
                          'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4004,MESSAGE_TEXT = "IN_SHARE_PARTNER_NOT_AVAILABLE"; ' +
                          ' ELSE INSERT into InShare SET id = uuid_to_bin(?),' +
                          'outShareInstanceId = uuid_to_bin(?),accountId = uuid_to_bin(?),status = ?,' +
                          'inShareId = ?,inShareName = ?,createdBy = uuid_to_bin(?),' +
                          'reminderDate=?,createdAt = ?,updatedAt = ?;' +
                          'END IF;', inshareValues);

                        if (!Utils.isAffectedPool(createInShare)) {
                            try {
                                var outSharePart = await conn.query('update OutSharePartners set status = ?,updatedAt = ? ' +
                                  'where id = uuid_to_bin(?)', [Constants.OUT_SHARE_PARTNER_STATUS.FAIL, currentDate, partnerAccount.id]);
                            } catch (err) {
                                debug('err', err);
                                throw err;
                            }
                        } else {
                            if (successInShareAccounts.indexOf(partnerAccountId) === -1) {
                                var partners = {
                                    partnerAccountId: partnerAccountId,
                                    inShareId: id
                                };
                                successInShareAccounts.push(partners);
                            }
                            try {
                                var outSharePart = await conn.query('update OutSharePartners set status = ?,updatedAt = ? ' +
                                  'where id = uuid_to_bin(?)', [Constants.OUT_SHARE_PARTNER_STATUS.OK, currentDate, partnerAccount.id]);

                            } catch (err) {
                                debug('err', err);
                                throw err;
                            }
                        }
                    } catch (err) {
                        errorOptions.err = err;
                        try {
                            var update = await conn.query('update OutSharePartners set status = ?,updatedAt = ? ' +
                              'where id = uuid_to_bin(?)', [Constants.OUT_SHARE_PARTNER_STATUS.FAIL, currentDate, partnerAccount.id]);
                        } catch (err) {
                            debug('err', err);
                        }
                        await conn.query('ROLLBACK;');
                        await ErrorUtils.create(errorOptions);
                        throw err;
                    }
                });

                try {
                    await conn.query('update OutShare set status = ?,updatedAt = ?,updatedBy = uuid_to_bin(?) ' +
                      'where id = uuid_to_bin(?)', [Constants.OUT_SHARE_STATUS.INVITATION_SENT, currentDate, user.id, outShareInstanceId]);

                    await conn.query('COMMIT;');
                    successOutShare.push({
                        id: outShareInstanceId,
                        status: Constants.OUT_SHARE_STATUS_ACTION.INVITATION_SENT,
                        updatedAt: currentDate
                    });

                } catch (err) {
                    await conn.query('ROLLBACK;');

                    await conn.query('update OutShare set status = ?,updatedAt = ?,updatedBy = uuid_to_bin(?) ' +
                      'where id = uuid_to_bin(?)', [Constants.OUT_SHARE_STATUS.NO_INVITATION_SENT, currentDate, user.id, outShareInstanceId]);

                    errorOptions.err = err;
                    await ErrorUtils.create(errorOptions);

                    errors[outShareInstanceId] = new Error(ErrorConfig.MESSAGE.IN_SHARE_CREATION_FAILED);
                    failedOutShare.push({
                        id: outShareInstanceId,
                        status: Constants.OUT_SHARE_STATUS_ACTION.NO_INVITATION_SENT,
                        updatedAt: currentDate
                    });
                    throw err;
                }
            }
            if (errors[outShareInstanceId]) {
                errorOptions.err = errors[outShareInstanceId];
                await ErrorUtils.create(errorOptions);
            }
        } catch (err) {
            await conn.query('ROLLBACK;');
            if (err.errno === 4004) {
                err = new Error(ErrorConfig.MESSAGE.IN_SHARE_PARTNER_NOT_AVAILABLE);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            }

            return cb(err);
        }
        Util.log('successInShareAccounts.length', successInShareAccounts);
        var i = 1;
        Async.eachSeries(successInShareAccounts, function (partner, callback) {
            debug('count', i++);
            InShare.sendNotifications({
                accountId: partner.partnerAccountId,
                user: options.user,
                inShareId: partner.inShareId,
                shareItemType: Constants.OUT_SHARE_PROFILE_TYPES[parseInt(outShare.shareItemType)]
            }, function (err, result) {
                if (err) {
                    debug('err', err);
                    return callback(err);
                }
                return callback();
            });
        }, async function (err) {

            if (failedOutShare.length > 0) {
                err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                if (successOutShare.length > 0) {
                    err.data = {
                        successMsg: Constants.SUCCESS_MESSAGE.OUT_SHARE_UPDATE_SUCCESS,
                        success: successOutShare,
                        conflict: failedOutShare
                    };
                } else {
                    err.data = {
                        success: successOutShare,
                        conflict: failedOutShare
                    };
                }

                return cb(err);
            }
            var response = {
                OK: Constants.SUCCESS_MESSAGE.OUT_SHARE_UPDATE_SUCCESS,
                success: successOutShare
            };
            await connection.closeConnectionCronJob();
            return cb(null, response);
        });
    },

    sendNotifications: async function (notificationOptions, cb) {

        var accountId = notificationOptions.accountId;
        var user = notificationOptions.user;
        var shareItemType = notificationOptions.shareItemType;
        var date = new Date();
        var err;

        try {
            var conn = await connection.getConnection();

            var account = await conn.query('SELECT CAST(uuid_from_bin(id) as char) as id, companyName, email,' +
              ' status from accounts where id = uuid_to_bin(?) and status = "active"', [accountId]);

            account = Utils.filteredResponsePool(account);

            if (!account) {
                return cb(null, null);
            }

            debug('account from send notification', account);
            var query = 'select *,CAST(uuid_from_bin(id) as char) as id , ' +
              'CAST(uuid_from_bin(userId) as char) as userId ,CAST(uuid_from_bin(roleId) as char) as roleId from user_roles ' +
              'where userId in (select  id from users where accountId = uuid_to_bin(?)) and ' +
              'roleId in (select id from Roles where title in ("account admin", "account owner"))';

            var userIds = await conn.query(query, [notificationOptions.accountId]);

            Async.eachSeries(userIds, function (userId, calb) {
                var ownerUUID = userId.userId;
                InShare.getUser({ownerUUID: ownerUUID}, async function (err, accountOwner) {
                    debug('err', err);
                    if (err) {
                        debug('inside 1');
                        return calb();
                    }
                    if (!accountOwner) {
                        debug('inside 2');
                        return calb();
                    }

                    var opt = {
                        languageCultureCode: accountOwner.languageCultureCode,
                        template: Constants.EMAIL_TEMPLATES.IN_SHARE_INVITE,
                        email: accountOwner.email
                    };

                    var compileOptions = {
                        name: accountOwner.firstName,
                        user_email: user.email,
                        scopehub_login: ''
                    };

                    var invitationExpirationDate = date.setDate(date.getDate() + Constants.CONTACT_INVITATION_EXPIRATION_DATE_LIMIT);
                    invitationExpirationDate = new Date(invitationExpirationDate);

                    /*EmailUtils.sendEmailMD(opt, compileOptions, async function (err) {
                        if (err) {
                            debug('err', err);
                            return calb(err);
                        }*/

                    try {
                        var NotificationApi = require('../api/notification');

                        var notificationSendOption = {
                            refereId: notificationOptions.inShareId,
                            refereType: Constants.NOTIFICATION_REFERE_TYPE.IN_SHARE,
                            user_ids: [accountOwner.id],
                            topic_id: accountOwner.id,
                            notificationExpirationDate: invitationExpirationDate,
                            paramasDateTime: new Date(),
                            notification_reference: NotificationReferenceData.DATA_SHARE,
                            metaEmail: user.email,
                            paramsInviter: user.email + ', ' + (user.firstName ? user.firstName : '') + ' ' + (user.lastName ? user.lastName : ''),
                            paramsInvitee: accountOwner.email + ', ' + (accountOwner.firstName ? accountOwner.firstName : '') + ' ' + (accountOwner.lastName ? accountOwner.lastName : ''),
                            paramasOtherData: shareItemType,
                            languageCultureCode: accountOwner.languageCultureCode,
                            createdBy: user.id
                        };
                        if (user.firstName) {
                            notificationSendOption.metaName = user.firstName;
                        }

                        await NotificationApi.createMD(notificationSendOption);
                        return calb();
                    } catch (err) {
                        debug('err-----', err);
                        if (err.code) {
                            err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_NOTIFICATION_CREATION_FAILED);
                            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                        }
                        return calb(err);
                    }
                    //});
                });

            }, async function (err) {
                if (err) {
                    debug('err', err);
                    return cb(err);
                }
                debug('Inside return 1');
                return cb(null, account);
            });

        } catch (err) {
            debug('err last', err);
            if (err.code) {
                err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_NOTIFICATION_CREATION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            }
            return cb(err);
        }
    },

    getQueryForAllProfile: function (options) {
        return new Promise(function (resolve, reject) {
            var profileType = options.profileType;
            try {
                var response;
                var fields = '';
                var tables = '';
                var condition = '';
                var responseFields = '';
                var shareItemTypeValue;
                var values = [];

                if (profileType === Constants.OUT_SHARE_PROFILE_TYPE.PRODUCT_INVENTORY) {
                    fields = 'group_concat(PR.sku separator ?) as sku,group_concat(PR.sellerSKUName separator ?) as sellerSKUName,group_concat(PI.locationId separator ?) as locationId,' +
                      'group_concat(LR.locationName separator ?) as locationName,';
                    tables = ' ProductInventory PI,ProductReferences PR,LocationReference LR, ';
                    condition = ' PI.id = OSI.shareItemId and PR.id = PI.productRefId and LR.locationId = PI.locationId and LR.accountId = OS.accountId  ';
                    responseFields = ' SID.sku,SID.sellerSKUName,SID.locationId,SID.locationName, ';
                    shareItemTypeValue = Constants.SHARING_TYPE.productInventory;
                    values.push(Constants.STRING_SEPARATOR, Constants.STRING_SEPARATOR, Constants.STRING_SEPARATOR, Constants.STRING_SEPARATOR);

                } else if (profileType === Constants.OUT_SHARE_PROFILE_TYPE.SUPPLY_INVENTORY) {
                    debug('supplyInventory');
                    fields = 'group_concat(SIR.sku separator ?) as sku,group_concat(SIR.sellerSKUName separator ?) as sellerSKUName,group_concat(SI.locationId separator ?) as locationId,' +
                      'group_concat(LR.locationName separator ?) as locationName,';
                    tables = ' SupplyInventory SI,SupplyItems SIR,LocationReference LR, ';
                    condition = ' SI.id = OSI.shareItemId and SIR.id = SI.supplyItemId and LR.locationId = SI.locationId and LR.accountId = OS.accountId ';
                    responseFields = ' SID.sku,SID.sellerSKUName,SID.locationId,SID.locationName, ';
                    shareItemTypeValue = Constants.SHARING_TYPE.supplyInventory;
                    values.push(Constants.STRING_SEPARATOR, Constants.STRING_SEPARATOR, Constants.STRING_SEPARATOR, Constants.STRING_SEPARATOR);

                } else if (profileType === Constants.OUT_SHARE_PROFILE_TYPE.PRODUCT_ORDERS) {
                    debug('productOrder');
                    fields = 'group_concat(PR.sku separator ?) as sku,group_concat(PR.sellerSKUName separator ?) as sellerSKUName,';
                    tables = ' ProductReferences PR, ';
                    condition = ' PR.id = OSI.shareItemId ';
                    responseFields = ' SID.sku,SID.sellerSKUName, ';
                    shareItemTypeValue = Constants.SHARING_TYPE.productOrder;
                    values.push(Constants.STRING_SEPARATOR, Constants.STRING_SEPARATOR);
                } else if (profileType === Constants.OUT_SHARE_PROFILE_TYPE.DEPENDENT_DEMAND) {
                    debug('dependent demand');
                    fields = ' GROUP_CONCAT(SIT.sku separator ?) as sku,GROUP_CONCAT(SIT.sellerSKUName separator ?) as sellerSKUName, ';
                    tables = ' SupplyItems SIT, ';
                    condition = ' SIT.id = OSI.shareItemId ';
                    responseFields = ' SID.sku,SID.sellerSKUName, ';
                    shareItemTypeValue = Constants.SHARING_TYPE.dependentDemand;
                    values.push(Constants.STRING_SEPARATOR, Constants.STRING_SEPARATOR);
                }
                response = {
                    fields: fields,
                    tables: tables,
                    condition: condition,
                    responseFields: responseFields,
                    shareItemTypeValue: shareItemTypeValue,
                    values: values
                };
                return resolve(response);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    getInShareData: function (options) {
        return new Promise(async function (resolve, reject) {
            debug('options', options.values);
            var accountId = options.accountId;
            var fields = options.fields;
            var responseFields = options.responseFields;
            var tables = options.tables;
            var condition = options.condition;
            var values = options.values;
            var shareItemTypeValue = options.shareItemTypeValue;
            var searchCondition = options.searchCondition;
            var searchValue = options.searchValue;
            var queryValues = [];
            var inShareString = '';
            var inShareValues = [];

            try {
                var conn = await connection.getConnection();

                if (DataUtils.isDefined(options.inShareQuery)) {
                    inShareString += ' and IS1.id IN (' + options.inShareQuery.string + ')';
                    inShareValues = inShareValues.concat(options.inShareQuery.values);
                }

                queryValues = values.concat([accountId], searchValue, inShareValues, [accountId], shareItemTypeValue, searchValue);

                var getInshares = await conn.query('with ShareItemDetail as ' +
                  '( select ' + fields + ' IS1.id as id' +
                  ' from ' + tables + ' OutShareItems OSI, OutShare OS, InShare IS1 where ' +
                  ' OSI.outShareInstanceId= OS.id and IS1.accountId = uuid_to_bin(?) and IS1.outShareInstanceId = OS.id and ' +
                  ' OSI.status = 1 and ' + condition + ' ' + searchCondition + inShareString + ' group by IS1.id )' +
                  ' ' +
                  ' SELECT CAST(uuid_from_bin(IS1.id) as char) as id,CAST(uuid_from_bin(IS1.outShareInstanceId) as char) as outShareInstanceId,' +
                  ' CAST(uuid_from_bin(IS1.accountId) as char) as accountId,IS1.status,IS1.inShareId,IS1.inShareName,IS1.acceptedDate,' +
                  ' IS1.endDate,IS1.notes,OS.dataProtectionOption,OSP.sharedDataItems,OSP.freqType,OSP.freqDay,OSP.freqTime,OS.shareItemType,OS.offeredStartDate,' +
                  ' ' + responseFields + ' concat_ws(", ", U.email, U.firstName) as partner,IS1.updatedAt,IS1.createdAt,' +
                  ' OS.startDateType,OS.offeredStartDate,OS.actualSharingDate from ' +
                  ' InShare IS1 , OutShare OS , ShareItemDetail SID , OutSharingProfile OSP , users U' +
                  ' where ' +
                  ' IS1.accountId = uuid_to_bin(?) and IS1.outShareInstanceId = OS.id and OS.shareItemType = ? ' +
                  ' and IS1.id = SID.id and OSP.id = OS.sharingProfileId and OS.createdBy = U.id ' + searchCondition + ' ' +
                  inShareString + ' group by IS1.id ORDER BY IS1.updatedAt DESC ',
                  queryValues.concat(inShareValues));

                if (getInshares.length <= 0) {
                    return resolve([]);
                }


                var sku, sellerSKUName, locationId, locationName, sharedDataItems;
                var productReferenceSKU, productReferenceSellerSKUName, supplyItemSKU, supplyItemSellerSKUName,
                  supplyItemId;
                _.map(getInshares, function (inShare) {
                    var startDateType = Object.keys(Constants.OUT_SHARE_START_DATE)[Object.values(Constants.OUT_SHARE_START_DATE).indexOf(inShare.startDateType)];
                    inShare.startDateType = Constants.OUT_SHARE_START_DATE_TYPE[startDateType];

                    sku = inShare.sku;
                    if (sku) {
                        inShare.sku = sku.split(Constants.STRING_SEPARATOR);
                    }

                    sellerSKUName = inShare.sellerSKUName;
                    if (sellerSKUName) {
                        inShare.sellerSKUName = sellerSKUName.split(Constants.STRING_SEPARATOR);
                    }
                    productReferenceSKU = inShare.productReferenceSKU;
                    if (productReferenceSKU) {
                        inShare.productReferenceSKU = productReferenceSKU.split(Constants.STRING_SEPARATOR);
                    }
                    productReferenceSellerSKUName = inShare.productReferenceSellerSKUName;
                    if (productReferenceSellerSKUName) {
                        inShare.productReferenceSellerSKUName = productReferenceSellerSKUName.split(Constants.STRING_SEPARATOR);
                    }
                    supplyItemSKU = inShare.supplyItemSKU;
                    if (supplyItemSKU) {
                        inShare.supplyItemSKU = supplyItemSKU.split(Constants.STRING_SEPARATOR);
                    }
                    supplyItemSellerSKUName = inShare.supplyItemSellerSKUName;
                    if (supplyItemSellerSKUName) {
                        inShare.supplyItemSellerSKUName = supplyItemSellerSKUName.split(Constants.STRING_SEPARATOR);
                    }
                    supplyItemId = inShare.supplyItemId;
                    if (supplyItemId) {
                        inShare.supplyItemId = supplyItemId;
                    }
                    locationId = inShare.locationId;
                    if (locationId) {
                        inShare.locationId = locationId.split(Constants.STRING_SEPARATOR);
                    }

                    locationName = inShare.locationName;
                    if (locationName) {
                        inShare.locationName = locationName.split(Constants.STRING_SEPARATOR);
                    }

                    sharedDataItems = inShare.sharedDataItems;
                    inShare.sharedDataItems = _.map(sharedDataItems.split(','), function (item) {
                        return parseInt(item);
                    });
                    inShare.shareItemType = Constants.OUT_SHARE_PROFILE_TYPES[inShare.shareItemType];
                });

                return resolve(getInshares);
            } catch (err) {
                debug('err', err);
                if (err.code) {
                    err = new Error(ErrorConfig.MESSAGE.IN_SHARE_GET_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                }
                return reject(err);
            }
        });
    },

    getInShareWithoutItemPartners: function (options) {
        return new Promise(async function (resolve, reject) {
            var accountId = options.accountId;
            var searchCondition = options.searchCondition;
            var searchValue = options.searchValue;
            var inShareQuery = options.inShareQuery;
            var inShareString = '', inShareValues = [];

            try {
                var conn = await connection.getConnection();

                if (inShareQuery) {
                    inShareString += ' and IS1.id IN (' + inShareQuery.string + ') ';
                    inShareValues = inShareValues.concat(inShareQuery.values);
                }

                var inShares = await conn.query('SELECT CAST(uuid_from_bin(IS1.id) AS CHAR) AS id ,CAST(uuid_from_bin(IS1.outShareInstanceId) AS CHAR) AS outShareInstanceId,' +
                  ' IS1.status, OS.shareItemType  FROM' +
                  ' OutShare OS, InShare IS1 WHERE IS1.accountId = uuid_to_bin(?) AND' +
                  ' IS1.outShareInstanceId = OS.id AND' +
                  ' IS1.outShareInstanceId NOT IN (SELECT outShareInstanceId FROM OutShareItems WHERE STATUS = 1)   ' + searchCondition + ' ' +
                  ' ' + inShareString + ' ',
                  [accountId].concat(searchValue).concat(inShareValues));

                if (!inShares || !DataUtils.isArray(inShares)) {
                    return resolve([]);
                }
                return resolve(inShares);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    manipulateInShareQuery: function (options) {
        return new Promise(function (resolve, reject) {
            var outShares = options.outShares;
            var string = '', values = [];

            _.map(outShares, function (outShare) {
                string += 'uuid_to_bin(?),';
                values.push(outShare.outShareInstanceId);
            });
            string = string.replace(/,\s*$/, ' ');
            return resolve({
                string: string,
                values: values
            });
        });
    },

    getInShareWithoutItems: function (options) {
        return new Promise(async function (resolve, reject) {
            var outShares = options.outShares;
            var accountId = options.accountId;
            var values = [];
            var defaultString = Constants.DEFAULT_CHARACTER;
            var err;

            try {
                var conn = await connection.getConnection();

                var response = await InShare.manipulateInShareQuery({
                    outShares: outShares
                });

                debug('response', response);
                values = [].concat(response.values);

                var inShareWithoutItems = await conn.query(' SELECT CAST(uuid_from_bin(IS1.id) as char) as id,' +
                  ' CAST(uuid_from_bin(IS1.outShareInstanceId) as char) as outShareInstanceId,' +
                  ' CAST(uuid_from_bin(IS1.accountId) as char) as accountId,IS1.status,IS1.inShareId,IS1.inShareName,IS1.acceptedDate,' +
                  ' IS1.endDate,IS1.notes,OS.dataProtectionOption,OSP.sharedDataItems,OSP.freqType,OSP.freqDay,OSP.freqTime,OS.shareItemType,OS.offeredStartDate,' +
                  ' concat_ws(", ", U.email, U.firstName) as partner,? as sku, ? as sellerSKUName,? as locationId, ? as locationName,' +
                  ' IS1.updatedAt,IS1.createdAt,' +
                  ' OS.startDateType,OS.offeredStartDate,OS.actualSharingDate from ' +
                  ' InShare IS1 , OutShare OS , OutSharingProfile OSP , users U' +
                  ' where ' +
                  ' IS1.accountId = uuid_to_bin(?) and IS1.outShareInstanceId = OS.id' +
                  ' and OSP.id = OS.sharingProfileId and OS.createdBy = U.id ' +
                  ' and IS1.outShareInstanceId in (' + response.string + ') group by IS1.id' +
                  ' ORDER BY IS1.updatedAt DESC', [defaultString, defaultString, defaultString, defaultString, accountId].concat(response.values));

                debug('outShareWithoutItems123', inShareWithoutItems.length);
                if (!inShareWithoutItems || !DataUtils.isArray(inShareWithoutItems)) {
                    return resolve([]);
                }

                var sku, sellerSKUName, locationId, locationName, sharedDataItems;
                _.map(inShareWithoutItems, function (inShare) {
                    var startDateType = Object.keys(Constants.OUT_SHARE_START_DATE)[Object.values(Constants.OUT_SHARE_START_DATE).indexOf(inShare.startDateType)];
                    inShare.startDateType = Constants.OUT_SHARE_START_DATE_TYPE[startDateType];

                    sku = inShare.sku;
                    if (sku === defaultString) {
                        inShare.sku = [];
                    }
                    sellerSKUName = inShare.sellerSKUName;
                    if (sellerSKUName === defaultString) {
                        inShare.sellerSKUName = [];
                    }

                    locationId = inShare.locationId;
                    if (locationId === defaultString) {
                        inShare.locationId = [];
                    }

                    locationName = inShare.locationName;
                    if (locationName === defaultString) {
                        inShare.locationName = [];
                    }

                    sharedDataItems = inShare.sharedDataItems;
                    inShare.sharedDataItems = _.map(sharedDataItems.split(','), function (item) {
                        return parseInt(item);
                    });
                    inShare.shareItemType = Constants.OUT_SHARE_PROFILE_TYPES[inShare.shareItemType];
                });
                return resolve(inShareWithoutItems);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    getByAccountIdMD: async function (options, errorOptions, cb) {
        var accountId = options.accountId;
        var searchCondition = '', searchValue = [];
        var err;
        var itemMissingInShares = [], partnerMissingInShares = [], duplicateInShares = [];
        var inShares = [];
        if (DataUtils.isUndefined(accountId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var records = await conn.query('SELECT CAST(uuid_from_bin(id) as CHAR) as id from InShare ' +
              'where accountId = uuid_to_bin(?)  order by updatedAt desc limit 10 ', [accountId]);

            debug('records', records.length);
            if (records.length <= 0) {
                return cb(null, inShares);
            }

            var inShareQuery = await InShare.manipulateQuery({inShares: records});
            //debug('inShareQuery', inShareQuery);
            var profileTypes = Object.values(Constants.OUT_SHARE_PROFILE_TYPE);

            // Get InShare with no item and partner
            var inShareWithNoItemPartner = await InShare.getInShareWithoutItemPartners({
                accountId: accountId,
                searchCondition: searchCondition,
                searchValue: searchValue,
                inShareQuery: inShareQuery
            });
            debug('InShareWithNoItemPartner', inShareWithNoItemPartner);

            if (inShareWithNoItemPartner.length > 0) {

                var getOption = {
                    accountId: accountId,
                    outShares: inShareWithNoItemPartner
                };
                var inShareWithoutItems = await InShare.getInShareWithoutItems(getOption);

                inShares = inShares.concat(inShareWithoutItems);
            }

            await Promise.each(profileTypes, async function (profileType) {
                debug('profileType', profileType);
                var response = await InShare.getQueryForAllProfile({profileType: profileType});
                response.accountId = accountId;

                if (response.fields && response.tables && response.condition && response.values) {
                    var getInShareOption = {
                        accountId: accountId,
                        fields: response.fields,
                        tables: response.tables,
                        condition: response.condition,
                        values: response.values,
                        shareItemTypeValue: response.shareItemTypeValue,
                        responseFields: response.responseFields,
                        searchCondition: searchCondition,
                        searchValue: searchValue,
                        inShareQuery: inShareQuery
                    };

                    var inShareResponse = await InShare.getInShareData(getInShareOption);

                    inShares = inShares.concat(inShareResponse);
                    debug('inShareResponse==================', inShares.length);
                }
            });
            inShares = _.orderBy(inShares, ['updatedAt'], ['desc']);
            return cb(null, inShares);
        } catch (err) {
            debug('err', err);
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            return cb(err);
        }
    },

    searchInShares: async function (options, errorOptions, cb) {
        var accountId = options.accountId;
        var inShareId = options.inShareId;
        var inShareName = options.inShareName;
        var searchCondition = '', searchValue = [];
        var err;
        var inShares = [];
        if (DataUtils.isUndefined(accountId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
        } else if (DataUtils.isUndefined(inShareId) && DataUtils.isUndefined(inShareName)) {
            err = new Error(ErrorConfig.MESSAGE.AT_LEASE_ONE_SEARCH_ATTRIBUTE_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            if (DataUtils.isDefined(inShareId)) {
                searchCondition += ' AND IS1.inShareId like ? ';
                searchValue.push('%' + inShareId + '%');
            } else if (DataUtils.isDefined(inShareName)) {
                searchCondition += ' AND IS1.inShareName like ? ';
                searchValue.push('%' + inShareName + '%');
            }

            var profileTypes = Object.values(Constants.OUT_SHARE_PROFILE_TYPE);

            var inShareWithNoItemPartner = await InShare.getInShareWithoutItemPartners({
                accountId: accountId,
                searchCondition: searchCondition,
                searchValue: searchValue
            });
            debug('InShareWithNoItemPartner', inShareWithNoItemPartner.length);

            if (inShareWithNoItemPartner.length > 0) {

                var getOption = {
                    accountId: accountId,
                    outShares: inShareWithNoItemPartner
                };
                var inShareWithoutItems = await InShare.getInShareWithoutItems(getOption);

                inShares = inShares.concat(inShareWithoutItems);
            }
            debug('inShares', inShares);
            await Promise.each(profileTypes, async function (profileType) {
                debug('profileType', profileType);
                var response = await InShare.getQueryForAllProfile({profileType: profileType});
                response.accountId = accountId;

                if (response.fields && response.tables && response.condition && response.values) {
                    var getInShareOption = {
                        accountId: accountId,
                        fields: response.fields,
                        tables: response.tables,
                        condition: response.condition,
                        values: response.values,
                        shareItemTypeValue: response.shareItemTypeValue,
                        responseFields: response.responseFields,
                        searchCondition: searchCondition,
                        searchValue: searchValue
                    };
                    var inShareResponse = await InShare.getInShareData(getInShareOption);
                    inShares = inShares.concat(inShareResponse);
                }
            });
            inShares = _.orderBy(inShares, ['updatedAt'], ['desc']);
            return cb(null, inShares);
        } catch (err) {
            debug('err', err);
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            return cb(err);
        }
    },

    getQueryForShareItemType: function (options) {
        return new Promise(function (resolve, reject) {
            var shareItemType = options.shareItemType;
            var groupQuery = '', groupQuery1 = '';
            var tables = '';
            var condition = '';
            var outerFields = '';
            var values = [], values1 = [];
            try {
                if (shareItemType === Constants.OUT_SHARE_PROFILE_TYPE.PRODUCT_INVENTORY) {
                    groupQuery = ' group_concat(PR.sku separator ?) as sku,group_concat(PR.sellerSKUName separator ?) as sellerSKUName,' +
                      ' group_concat(PI.locationId separator ?) as locationId,group_concat(LR.locationName separator ?) as locationName,';
                    tables = 'ProductInventory PI,ProductReferences PR,LocationReference LR, ';
                    condition = ' PI.id = OSI.shareItemId and PR.id = PI.productRefId and LR.locationId = PI.locationId and LR.accountId = OS.accountId and ';
                    outerFields = ' PD.sku,PD.sellerSKUName,PD.locationId,PD.locationName, ';
                    groupQuery1 = '? as sku,? as sellerSKUName,? as locationId,? as locationName,';
                    values1.push(Constants.DEFAULT_CHARACTER, Constants.DEFAULT_CHARACTER, Constants.DEFAULT_CHARACTER, Constants.DEFAULT_CHARACTER);
                    values.push(Constants.STRING_SEPARATOR, Constants.STRING_SEPARATOR, Constants.STRING_SEPARATOR, Constants.STRING_SEPARATOR);
                } else if (shareItemType === Constants.OUT_SHARE_PROFILE_TYPE.SUPPLY_INVENTORY) {
                    groupQuery = ' GROUP_CONCAT(SIN.sku separator ?) as sku,GROUP_CONCAT(SI.sellerSKUName separator ?) as sellerSKUName, ' +
                      ' GROUP_CONCAT(SIN.locationId separator ?) as locationId,GROUP_CONCAT(LR.locationName separator ?) as locationName, ';
                    tables = ' SupplyInventory SIN,SupplyItems SI,LocationReference LR, ';
                    condition = ' SIN.id = OSI.shareItemId and SIN.supplyItemId = SI.id and SIN.locationId = LR.locationId and LR.accountId = OS.accountId and ';
                    outerFields = ' PD.sku,PD.sellerSKUName,PD.locationId,PD.locationName, ';
                    groupQuery1 = '? as sku,? as sellerSKUName,? as locationId,? as locationName,';
                    values1.push(Constants.DEFAULT_CHARACTER, Constants.DEFAULT_CHARACTER, Constants.DEFAULT_CHARACTER, Constants.DEFAULT_CHARACTER);
                    values.push(Constants.STRING_SEPARATOR, Constants.STRING_SEPARATOR, Constants.STRING_SEPARATOR, Constants.STRING_SEPARATOR);
                } else if (shareItemType === Constants.OUT_SHARE_PROFILE_TYPE.PRODUCT_ORDERS) {
                    groupQuery = ' GROUP_CONCAT(PR.sku separator ?) as sku,GROUP_CONCAT(PR.sellerSKUName separator ?) as sellerSKUName, ';
                    tables = ' ProductReferences PR , ';
                    condition = ' PR.id = OSI.shareItemId and ';
                    outerFields = ' PD.sku,PD.sellerSKUName, ';
                    groupQuery1 = '? as sku,? as sellerSKUName,';
                    values.push(Constants.STRING_SEPARATOR, Constants.STRING_SEPARATOR);
                    values1.push(Constants.DEFAULT_CHARACTER, Constants.DEFAULT_CHARACTER);
                } else if (shareItemType === Constants.OUT_SHARE_PROFILE_TYPE.DEPENDENT_DEMAND) {
                    groupQuery = ' GROUP_CONCAT(SIT.sku separator ?) as sku,GROUP_CONCAT(SIT.sellerSKUName separator ?) as sellerSKUName, ';
                    tables = ' SupplyItems SIT, ';
                    condition = ' SIT.id = OSI.shareItemId and ';
                    outerFields = ' PD.sku,PD.sellerSKUName, ';
                    groupQuery1 = '? as sku,? as sellerSKUName,';
                    values1.push(Constants.DEFAULT_CHARACTER, Constants.DEFAULT_CHARACTER);
                    values.push(Constants.STRING_SEPARATOR, Constants.STRING_SEPARATOR);
                }
                var response = {
                    groupQuery: groupQuery,
                    groupQuery1: groupQuery1,
                    tables: tables,
                    condition: condition,
                    values: values,
                    values1: values1,
                    outerFields: outerFields
                };
                return resolve(response);

            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },


    getByIdAndAccountIdMD: async function (options, errorOptions, cb) {
        var accountId = options.accountId;
        var shareItemType = options.shareItemType;
        var err;
        if (DataUtils.isUndefined(accountId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
        } else if (DataUtils.isUndefined(options.id)) {
            err = new Error(ErrorConfig.MESSAGE.IN_SHARE_ID_REQUIRED);
        } else if (DataUtils.isUndefined(shareItemType)) {
            err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ITEM_TYPE_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {

            var response = await InShare.getQueryForShareItemType({shareItemType: shareItemType});
            var groupQuery = response.groupQuery;
            var groupQuery1 = response.groupQuery1;
            var tables = response.tables;
            var condition = response.condition;
            var outerFields = response.outerFields;
            var values = response.values;
            var values1 = response.values1;
            var defaultCharacter = Constants.DEFAULT_CHARACTER;


            var conn = await connection.getConnection();

            var getInshare = await conn.query('with ProductDetail as ' +
              '( select ' + groupQuery + ' IS1.id as id,group_concat(CAST(uuid_from_bin(OSI.shareItemId) as char)) as shareItemId ' +
              ' from ' + tables + ' OutShareItems OSI, OutShare OS, InShare IS1 where ' +
              ' OSI.outShareInstanceId= OS.id  and ' + condition + ' OSI.status = 1 and IS1.accountId = uuid_to_bin(?) and ' +
              ' IS1.id = uuid_to_bin(?) and IS1.outShareInstanceId = OS.id group by IS1.id ' +
              ' UNION' +
              ' select ' + groupQuery1 + ' IS1.id as id,? as shareItemId' +
              ' from  OutShareItems OSI, OutShare OS, InShare IS1 where ' +
              ' OSI.outShareInstanceId= OS.id  and IS1.accountId = uuid_to_bin(?) and IS1.id = uuid_to_bin(?) and' +
              ' IS1.outShareInstanceId = OS.id group by IS1.id ) ' +
              ' ' +
              ' SELECT CAST(uuid_from_bin(IS1.id) as char) as id,CAST(uuid_from_bin(IS1.outShareInstanceId) as char) as outShareInstanceId,' +
              ' CAST(uuid_from_bin(IS1.accountId) as char) as accountId,IS1.status,IS1.inShareId,IS1.inShareName,IS1.acceptedDate,' +
              ' IS1.endDate,IS1.notes,OS.dataProtectionOption,OSP.sharedDataItems,OSP.freqType,OSP.freqDay,OSP.freqTime,OS.shareItemType,' +
              ' OS.offeredStartDate,PD.shareItemId,' + outerFields + ' ' +
              ' concat_ws(", ", U.email, U.firstName) as partner,OS.startDateType, IS1.updatedAt from ' +
              ' InShare IS1 , OutShare OS , ProductDetail PD , OutSharingProfile OSP , users U' +
              ' where ' +
              ' IS1.id = uuid_to_bin(?) and IS1.outShareInstanceId = OS.id ' +
              ' and OSP.id = OS.sharingProfileId and OS.createdBy = U.id ',
              [].concat(values).concat([accountId, options.id], values1, [defaultCharacter, accountId, options.id, options.id]));

            getInshare = Utils.filteredResponsePool(getInshare);

            debug('inshare', getInshare);

            if (!getInshare) {
                err = new Error(ErrorConfig.MESSAGE.IN_SHARE_ID_INVALID);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }
            //var status = Object.keys(Constants.IN_SHARE_STATUS)[Object.values(Constants.IN_SHARE_STATUS).indexOf(getInshare.status)];
            //getInshare.status = Constants.IN_SHARE_STATUS_NOTIFICATION_ACTION[status];
            debug('getInshare', getInshare);
            var sku, sellerSKUName, locationId, locationName, shareItemId;
            sku = getInshare.sku;
            if (sku === defaultCharacter) {
                getInshare.sku = [];
            } else {
                getInshare.sku = getInshare.sku.split(Constants.STRING_SEPARATOR);
            }

            sellerSKUName = getInshare.sellerSKUName;
            if (sellerSKUName === defaultCharacter) {
                getInshare.sellerSKUName = [];
            } else {
                getInshare.sellerSKUName = getInshare.sellerSKUName.split(Constants.STRING_SEPARATOR);
            }

            if (DataUtils.isDefined(getInshare.locationId)) {
                locationId = getInshare.locationId;
                if (locationId === defaultCharacter) {
                    getInshare.locationId = [];
                } else {
                    getInshare.locationId = getInshare.locationId.split(Constants.STRING_SEPARATOR);
                }
            }

            if (DataUtils.isDefined(getInshare.locationName)) {
                locationName = getInshare.locationName;
                if (locationName === defaultCharacter) {
                    getInshare.locationName = [];
                } else {
                    getInshare.locationName = getInshare.locationName.split(Constants.STRING_SEPARATOR);
                }
            }

            shareItemId = getInshare.shareItemId;
            if (shareItemId === defaultCharacter) {
                getInshare.shareItemId = [];
            } else {
                getInshare.shareItemId = getInshare.shareItemId.split(',');
            }

            getInshare.sharedDataItems = _.map(getInshare.sharedDataItems.split(','), function (item) {
                return parseInt(item);
            });
            getInshare.shareItemType = Constants.OUT_SHARE_PROFILE_TYPES[getInshare.shareItemType];

            var startDateType = Object.keys(Constants.OUT_SHARE_START_DATE)[Object.values(Constants.OUT_SHARE_START_DATE).indexOf(getInshare.startDateType)];
            getInshare.startDateType = Constants.OUT_SHARE_START_DATE_TYPE[startDateType];


            return cb(null, getInshare);

        } catch (err) {
            console.log(err);
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);

            if (err.code) {
                err = new Error(ErrorConfig.MESSAGE.IN_SHARE_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    getByAccountId: function (options, cb) {
        var accountId = options.accountId;
        var err;
        if (DataUtils.isUndefined(accountId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        InShareModel.query(accountId)
          .usingIndex(Constants.IN_SHARE_ACCOUNT_INDEX)
          .exec(function (err, data) {
              if (err) {
                  err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                  return cb(err);
              }
              var inShares = _.map(data.Items, 'attrs');

              return cb(null, inShares);
          });
    },

    validateOptinalFields: function (options) {
        var fields = '';
        var fieldParams = [];
        var err;
        return new Promise(function (resolve, reject) {
            try {
                if (!DataUtils.isValidateOptionalField(options.inShareId)) {
                    if (!DataUtils.isString(options.inShareId)) {
                        throw err = new Error(ErrorConfig.MESSAGE.IN_SHARE_INSHARE_ID_MUST_BE_STRING);
                    } else if (!err && options.inShareId.length > 60) {
                        throw err = new Error(ErrorConfig.MESSAGE.IN_SHARE_INSHARE_ID_MUST_BE_LESS_THAN_60_CHARACTER);
                    } else {
                        fields += 'inShareId = ?,';
                        fieldParams.push(options.inShareId);
                    }
                }
                if (!DataUtils.isValidateOptionalField(options.inShareName)) {
                    if (!DataUtils.isString(options.inShareName)) {
                        throw err = new Error(ErrorConfig.MESSAGE.IN_SHARE_INSHARE_NAME_MUST_BE_STRING);
                    } else if (!err && options.inShareName.length > 60) {
                        throw err = new Error(ErrorConfig.MESSAGE.IN_SHARE_INSHARE_NAME_MUST_BE_LESS_THAN_60_CHARACTER);
                    } else {
                        fields += 'inShareName = ?,';
                        fieldParams.push(options.inShareName);
                    }
                }
                if (!DataUtils.isValidateOptionalField(options.notes)) {
                    if (!DataUtils.isString(options.notes)) {
                        throw err = new Error(ErrorConfig.MESSAGE.IN_SHARE_INSHARE_NAME_MUST_BE_STRING);
                    } else if (!err && options.notes.length > 60) {
                        throw err = new Error(ErrorConfig.MESSAGE.IN_SHARE_INSHARE_NOTES_MUST_BE_LESS_THAN_60_CHARACTER);
                    } else {
                        fields += 'notes = ?,';
                        fieldParams.push(options.notes);
                    }
                }
                if (!DataUtils.isValidateOptionalField(options.status)) {
                    fields += 'status = ?,';
                    fieldParams.push(options.status);
                }

                return resolve({fields: fields, fieldParams: fieldParams});
            } catch (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return reject(err);
            }
        });
    },

    updateInShareAlertRecord: function (options) {
        return new Promise(async function (resolve, reject) {
            var inShareId = options.inShareId;
            var status = options.status;
            var userId = options.userId;
            var updatedAt = DataUtils.getEpochMSTimestamp();
            var err;

            try {
                var conn = await connection.getConnection();

                var isUpdated = await conn.query('UPDATE SharingAlert SET status = ?, updatedAt = ?, updatedBy = uuid_to_bin(?)' +
                  'WHERE inShareId = uuid_to_bin(?) and status = ?', [status, updatedAt, userId, inShareId, Constants.ALERT_STATUS.ACTIVE]);

                isUpdated = Utils.isAffectedPool(isUpdated);
                debug('isUpdated sharing alerts', isUpdated);

                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.UPDATE_IN_SHARE_ALERT_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    update: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var status, err;
        var currentDate = DataUtils.getEpochMSTimestamp();
        var updateOutShareOption, newUpdatedAt, newStatus;
        var OutShareInstance = require('./out_share_instance');
        var SupplierApi = require('./supplier');

        if (DataUtils.isUndefined(options.accountId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
        } else if (DataUtils.isUndefined(options.id)) {
            err = new Error(ErrorConfig.MESSAGE.IN_SHARE_ID_REQUIRED);
        } else if (DataUtils.isValidateOptionalField(options.updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.IN_SHARE_UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(options.updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_MUST_BE_NUMBER);
        } else if (options.updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_INVALID);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            await conn.query('START TRANSACTION');

            var getInshare = await conn.query('SELECT id,updatedAt,status,CAST(uuid_from_bin(outShareInstanceId) as CHAR) as outShareInstanceId' +
              ' from InShare where id = uuid_to_bin(?)', options.id);
            var getInshareDetails = Utils.filteredResponsePool(getInshare);

            if (!getInshareDetails) {
                err = new Error(ErrorConfig.MESSAGE.IN_SHARE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }
            if (getInshareDetails.updatedAt !== options.updatedAt) {
                err = new Error(ErrorConfig.MESSAGE.IN_SHARE_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                throw err;
            }

            if (getInshareDetails.status === Constants.IN_SHARE_STATUS.STOP_BY_IN_SHARE) {
                options.recordStatus = Constants.IN_SHARE_STATUS.STOP_BY_IN_SHARE;
            }
            var optionalFields = await InShare.validateOptinalFields(options);

            var fields = optionalFields.fields;
            var fieldParams = optionalFields.fieldParams;

            var query = 'update InShare set updatedBy = uuid_to_bin(?),' + fields + ' updatedAt = ? where id = uuid_to_bin(?) AND updatedAt = ?';
            var params = [user.id].concat(fieldParams).concat(currentDate, options.id, options.updatedAt);
            var isInShareUpdated = await conn.query(query, params);

            if (!Utils.isAffectedPool(isInShareUpdated)) {
                err = new Error(ErrorConfig.MESSAGE.IN_SHARE_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }
            if (options.recordStatus) {
                options.status = options.recordStatus;
            }

            if (options.status === Constants.IN_SHARE_STATUS.STOP_BY_IN_SHARE) {
                var outShareInstanceId = getInshareDetails.outShareInstanceId;
                var removeSharePartners = [{accountId: options.accountId}];
                var deleteOption = {
                    outShareInstanceId: outShareInstanceId,
                    removeSharePartners: removeSharePartners
                };
                var deleteResponse = await OutShareInstance.removeOutSharePartnerRecord(deleteOption);
                debug('delete response', deleteResponse);

                var getOutShareOption = {
                    outShareInstanceId: outShareInstanceId,
                    updatedAt: options.updatedAt,
                    checkFlag: true
                };
                var outShare = await OutShareInstance.getOutShareInstance(getOutShareOption);
                debug('outShare', outShare);

                var checkActiveInShareOption = {
                    outShares: [{
                        id: outShareInstanceId
                    }]
                };
                var outShareWithNoActiveInShare = await SupplierApi.getOutShareWithNoPartner(checkActiveInShareOption);

                if (outShareWithNoActiveInShare.length > 0) {

                    var checkNewPauseInShareOption = {
                        outShares: [{
                            id: outShareInstanceId
                        }]
                    };
                    var outShareWithNewPauseInShare = await SupplierApi.getOutShareWithNewPauseInShare(checkNewPauseInShareOption);

                    if (outShareWithNewPauseInShare.length > 0) {
                        if (outShare.status === Constants.OUT_SHARE_STATUS.ACTIVE) {
                            updateOutShareOption = {
                                outShareInstanceId: outShareInstanceId,
                                userId: user.id,
                                status: Constants.OUT_SHARE_STATUS.PAUSED,
                                endDate: DataUtils.getEpochMSTimestamp()
                            };
                        }
                    } else {
                        updateOutShareOption = {
                            outShareInstanceId: outShareInstanceId,
                            userId: user.id,
                            status: Constants.OUT_SHARE_STATUS.STOP,
                            endDate: DataUtils.getEpochMSTimestamp()
                        };
                    }
                    //Update outShare with status stop/pause
                    if (updateOutShareOption) {
                        var updateResponse = await OutShareInstance.updateOutShareInstance(updateOutShareOption);
                        newUpdatedAt = updateResponse.updatedAt;
                        newStatus = updateResponse.status;
                        debug('updateResponse ', updateResponse);

                        // Stop sharing Events if exist
                        var updateSharingEventOption = {
                            outShares: [{
                                id: outShareInstanceId
                            }],
                            userId: user.id
                        };
                        debug('updateSharingEventOption ', updateSharingEventOption);
                        var udpateSharingResponse = await SupplierApi.updatesharingEvent(updateSharingEventOption);
                        debug('udpateSharingResponse', udpateSharingResponse);
                    }
                }

                // stop(in active) alert for inshare
                var updateInShareAlertOptions = {
                    inShareId: options.id,
                    userId: user.id,
                    status: Constants.ALERT_STATUS.IN_ACTIVE
                };
                var updateInShareAlertResponse = await InShare.updateInShareAlertRecord(updateInShareAlertOptions);
                debug('updateInShareAlertResponse', updateInShareAlertResponse);
            }
            await conn.query('COMMIT');
            var response = {
                OK: Constants.SUCCESS_MESSAGE.IN_SHARE_UPDATE_SUCCESS,
                id: options.id,
                updatedAt: currentDate,
                status: options.status
            };
            return cb(null, response);
        } catch (err) {
            return cb(err);
        }
    },

    updateActionMD: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var dataDeliveryOption = options.dataDeliveryOption;
        var updateOutShareStatus;
        var status, err;

        if (DataUtils.isUndefined(options.accountId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
        } else if (DataUtils.isUndefined(options.id)) {
            err = new Error(ErrorConfig.MESSAGE.IN_SHARE_ID_REQUIRED);
        } else if (DataUtils.isUndefined(options.action)) {
            err = new Error(ErrorConfig.MESSAGE.IN_SHARE_ACTION_REQUIRED);
        } else if (DataUtils.isDefined(dataDeliveryOption) && Object.values(Constants.DATA_DELIVERY_OPTION).indexOf(dataDeliveryOption) === -1) {
            err = new Error(ErrorConfig.MESSAGE.INVALID_DATA_DELIVERY_OPTION);
        } else if (!options.notificationAction) {
            if (DataUtils.isValidateOptionalField(options.updatedAt)) {
                err = new Error(ErrorConfig.MESSAGE.IN_SHARE_UPDATED_AT_REQUIRED);
            }
        }
        /*
                if (!err && !options.notificationAction && options.action === Constants.IN_SHARE_STATUS_NOTIFICATION_ACTION.ACCEPTED) {
                    if (!err && DataUtils.isUndefined(options.inShareId)) {
                        err = new Error(ErrorConfig.MESSAGE.IN_SHARE_INSHARE_ID_REQUIRED);
                    }
                    if (!err && DataUtils.isUndefined(options.inShareName)) {
                        err = new Error(ErrorConfig.MESSAGE.IN_SHARE_INSHARE_NAME_REQUIRED);
                    }
                }*/

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
            console.log('1');
            debug('1');
            var template, notification_reference, response, fields, fieldParams, inShareStatus;
            var currentDate = DataUtils.getEpochMSTimestamp();

            var optionalFields = await InShare.validateOptinalFields(options);
            fields = optionalFields.fields;
            fieldParams = optionalFields.fieldParams;

            var getInshare = await conn.query('SELECT CAST(uuid_from_bin(ins.id) as char) as id,' +
              'CAST(uuid_from_bin(ins.outShareInstanceId) as char) as outShareInstanceId,ins.dataDeliveryOption,' +
              'ins.updatedAt,ins.status as inShareStatus, CAST(uuid_from_bin(osi.accountId) as char) as accountId,' +
              ' osi.status as outShareInstanceStatus, osi.startDateType as startDateType ' +
              'from OutShare osi,InShare ins where ins.id = uuid_to_bin(?) and ins.outShareInstanceId = osi.id', [options.id]);

            var getInshareDetails = Utils.filteredResponsePool(getInshare);
            debug('2');
            if (!getInshareDetails) {
                err = new Error(ErrorConfig.MESSAGE.IN_SHARE_ID_INVALID);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            if (!options.notificationAction && getInshareDetails.updatedAt !== options.updatedAt) {
                err = new Error(ErrorConfig.MESSAGE.IN_SHARE_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                throw err;
            }
            /*
                        if (options.notificationAction) {
                            fields = 'inShareId = ?,inShareName = ?,';
                            fieldParams = [currentDate, currentDate];
                        }*/
            debug('3');

            var inSStatus = Object.keys(Constants.IN_SHARE_STATUS)[Object.values(Constants.IN_SHARE_STATUS).indexOf(getInshareDetails.inShareStatus)];
            inSStatus = Constants.IN_SHARE_STATUS_NOTIFICATION_ACTION[inSStatus];

            debug('4', inSStatus);
            debug('4', options.action);
            if (options.action === inSStatus) {

                var query = 'update InShare set updatedBy = uuid_to_bin(?),' + fields + ' updatedAt = ? where id = uuid_to_bin(?)';
                var params = [user.id].concat(fieldParams).concat(currentDate, options.id);
                var isInShareUpdated = await conn.query(query, params);

                if (!Utils.isAffectedPool(isInShareUpdated)) {
                    err = new Error(ErrorConfig.MESSAGE.IN_SHARE_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    throw err;
                }
                debug('5');

                response = {
                    OK: Constants.SUCCESS_MESSAGE.IN_SHARE_UPDATE_SUCCESS,
                    id: options.id,
                    updatedAt: currentDate
                };
                debug('6');
                await conn.query('COMMIT');
                return cb(null, response);
            }

            //updated inShare status accept and send email and notification
            debug('7', options.action);
            if (options.action === Constants.IN_SHARE_STATUS_NOTIFICATION_ACTION.ACCEPTED) {
                debug('8');
                template = Constants.EMAIL_TEMPLATES.ACCEPT_INVITE;
                notification_reference = NotificationReferenceData.DATA_SHARE_ACCEPT;
                status = Constants.IN_SHARE_STATUS.ACTIVE;
                //  inShareStatus = Constants.IN_SHARE_STATUS_NOTIFICATION_ACTION.ACTIVE;

                // check that outShare status is expired then inshare status is expired

                if (getInshareDetails.outShareInstanceStatus === Constants.OUT_SHARE_STATUS.EXPIRED) {
                    debug('9');
                    status = Constants.IN_SHARE_STATUS.EXPIRED;
                    // inShareStatus = Constants.IN_SHARE_STATUS_NOTIFICATION_ACTION.EXPIRED;
                }

                // check that outShare status is paused then inshare status is paused by outShare
                if (getInshareDetails.outShareInstanceStatus === Constants.OUT_SHARE_STATUS.PAUSED) {
                    debug('10');
                    status = Constants.IN_SHARE_STATUS.PAUSED_BY_OUT_SHARE_PARTNER;
                    //  inShareStatus = Constants.IN_SHARE_STATUS_NOTIFICATION_ACTION.PAUSED_BY_OUT_SHARE_PARTNER;
                }

                // check that outShare status is Active then inshare status is active
                if (getInshareDetails.outShareInstanceStatus === Constants.OUT_SHARE_STATUS.ACTIVE) {
                    debug('11');
                    status = Constants.IN_SHARE_STATUS.ACTIVE;
                    // inShareStatus = Constants.IN_SHARE_STATUS_NOTIFICATION_ACTION.ACTIVE;
                }

                // select data delivery option (1,2,3)
                fields += 'dataDeliveryOption=?,';
                if (DataUtils.isDefined(dataDeliveryOption)) {
                    fieldParams.push(dataDeliveryOption);
                } else {
                    fieldParams.push(Constants.DATA_DELIVERY_OPTION.ONLINE_ONLY);
                }

                // check that outShare status is new and startDateType is asap then oushare status
                // is active and inshare status is active, update the Actual sharing date

                debug('12');
                debug('getInshareDetails.outShareInstanceStatus', getInshareDetails.outShareInstanceStatus);
                if ((getInshareDetails.outShareInstanceStatus === Constants.OUT_SHARE_STATUS.INVITATION_SENT ||
                  getInshareDetails.outShareInstanceStatus === Constants.OUT_SHARE_STATUS.PAUSED) &&
                  getInshareDetails.startDateType === Constants.OUT_SHARE_START_DATE.ASAP ||
                  getInshareDetails.startDateType === Constants.OUT_SHARE_START_DATE.ASAP_AFTER) {
                    debug('13');
                    var outShareDetails = await conn.query('select CAST(uuid_from_bin(OSP.id) as char) as id,CAST(uuid_from_bin(OS.id) ' +
                      'as char) as outShareInstanceId,OS.acceptedDate, OSP.freqType ,OSP.freqTime,' +
                      'OSP.freqDay,OS.startDateType, OS.offeredStartDate from OutShare OS,OutSharingProfile OSP where ' +
                      'OS.id = uuid_to_bin(?) and OSP.id = OS.sharingProfileId', getInshareDetails.outShareInstanceId);

                    outShareDetails = Utils.filteredResponsePool(outShareDetails);
                    var actualSharingDate = await InShare.getFrequencyDateTime(outShareDetails);
                    debug('14');
                    if (!actualSharingDate) {
                        err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_UPDATE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        throw err;
                    }

                    status = Constants.IN_SHARE_STATUS.ACTIVE;
                    // inShareStatus = Constants.IN_SHARE_STATUS_NOTIFICATION_ACTION.ACTIVE;

                    debug('15');
                    // Update outshare with status = active (even if outshare is paused or open)
                    updateOutShareStatus = await conn.query('update OutShare set status = ?,updatedAt = ?,' +
                      'updatedBy = uuid_to_bin(?) where id = uuid_to_bin(?)',
                      [Constants.OUT_SHARE_STATUS.ACTIVE, currentDate, user.id, getInshareDetails.outShareInstanceId]);

                    if (!Utils.isAffectedPool(updateOutShareStatus)) {
                        err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_UPDATE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        throw err;
                    }

                    debug('16');
                    if (outShareDetails.acceptedDate === 0) {
                        debug('17');
                        updateOutShareStatus = await conn.query('update OutShare set actualSharingDate=?,acceptedDate=?,updatedAt = ?,' +
                          'updatedBy = uuid_to_bin(?) where id = uuid_to_bin(?)',
                          [actualSharingDate, currentDate, currentDate, user.id, getInshareDetails.outShareInstanceId]);

                        if (!Utils.isAffectedPool(updateOutShareStatus)) {
                            err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_UPDATE_FAILED);
                            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                            throw err;
                        }
                    }

                    debug('18');
                    if (outShareDetails.freqType !== Constants.OUT_SHARE_FREQ_TYPE.REAL_TIME) {
                        var sharingEventsId = Utils.generateId().uuid;
                        var paramValues = [sharingEventsId, outShareDetails.outShareInstanceId, currentDate, actualSharingDate,
                            Constants.STATUS.ACTIVE, outShareDetails.freqType, currentDate, currentDate];

                        var sharingEvents = await conn.query('INSERT into SharingEvents SET id = uuid_to_bin(?),outShareInstanceId=uuid_to_bin(?),' +
                          'startDate=?,nextSharingDate=?,status=?,frequency=?,createdAt=?,updatedAt=?', paramValues);

                        if (!Utils.isAffectedPool(sharingEvents)) {
                            err = new Error(ErrorConfig.MESSAGE.SHARING_EVENTS_CREATE_FAILED);
                            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                            throw err;
                        }
                        debug('19');
                    }
                } else if (getInshareDetails.outShareInstanceStatus === Constants.OUT_SHARE_STATUS.INVITATION_SENT &&
                  getInshareDetails.startDateType === Constants.OUT_SHARE_START_DATE.PAUSE) {
                    status = Constants.IN_SHARE_STATUS.ACTIVE;
                    debug('20');
                    updateOutShareStatus = await conn.query('update OutShare set status = ?,actualSharingDate=?,acceptedDate=?,updatedAt = ?,' +
                      'updatedBy = uuid_to_bin(?) where id = uuid_to_bin(?)',
                      [Constants.OUT_SHARE_STATUS.PAUSED, Constants.DEFAULT_DATE, currentDate, currentDate, user.id, getInshareDetails.outShareInstanceId]);

                    if (!Utils.isAffectedPool(updateOutShareStatus)) {
                        err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_UPDATE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        throw err;
                    }
                }
                //updated inShare status Decline and send email and notification
            } else if (options.action === Constants.IN_SHARE_STATUS_NOTIFICATION_ACTION.DECLINED) {
                debug('21');
                status = Constants.IN_SHARE_STATUS.DECLINED;
                template = Constants.EMAIL_TEMPLATES.DECLINED_INVITE;
                notification_reference = NotificationReferenceData.DATA_SHARE_DECLINE;
            } else if (options.action === Constants.INVITATION_STATUS_NOTIFICATION_ACTION.IGNORE) {
                response = {
                    OK: Constants.SUCCESS_MESSAGE.IN_SHARE_UPDATE_SUCCESS,
                    id: options.id
                };
                await conn.query('COMMIT');
                return cb(null, response);
            } else {
                debug('22');
                throw new Error(ErrorConfig.MESSAGE.IN_SHARE_STATUS_INVALID);
            }
            try {
                debug('23');
                var query = '', params = [];
                if (DataUtils.isDefined(options.inShareId)) {
                    debug('24');
                    query = 'IF (select 1 from InShare where inShareId=? and id != uuid_to_bin(?)) is not null then ' +
                      'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "DUPLICATE_IN_SHARE_ID", MYSQL_ERRNO =4001;' +
                      'Else update InShare set status = ?,' + fields + 'acceptedDate =?, updatedAt = ?,updatedBy = uuid_to_bin(?) ' +
                      'where id = uuid_to_bin(?);end if;';
                    params = [fieldParams[0]].concat([options.id]).concat([status]).concat(fieldParams).concat(currentDate, currentDate, user.id, options.id);

                } else {
                    debug('25');
                    query = 'update InShare set status = ?,' + fields + 'acceptedDate =?, updatedAt = ?,updatedBy = uuid_to_bin(?) ' +
                      'where id = uuid_to_bin(?)';
                    params = [status].concat(fieldParams).concat(currentDate, currentDate, user.id, options.id);
                }
                var isInShareUpdated = await conn.query(query, params);

                if (!Utils.isAffectedPool(isInShareUpdated)) {
                    err = new Error(ErrorConfig.MESSAGE.IN_SHARE_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    throw err;
                }
                debug('26');
                response = {
                    OK: Constants.SUCCESS_MESSAGE.IN_SHARE_UPDATE_SUCCESS,
                    id: options.id,
                    status: status,
                    updatedAt: currentDate
                };
                debug('27');
                await conn.query('COMMIT');
            } catch (err) {
                if (err.errno === 4001) {
                    err = new Error(ErrorConfig.MESSAGE.DUPLICATE_INSHARE_ID);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return cb(err);
                }
                return cb(err);
            }
            debug('28');

            var account = await conn.query('SELECT CAST(uuid_from_bin(id) as char) as id, companyName, email,' +
              ' status from accounts where id = uuid_to_bin(?) and status = "active"', [getInshareDetails.accountId]);

            account = Utils.filteredResponsePool(account);

            if (!account) {
                return cb(null, null);
            }

            debug('29');
            var getUserQuery = 'select *,uuid_from_bin(id) as id , ' +
              'uuid_from_bin(userId) as userId ,uuid_from_bin(roleId) as roleId from user_roles ' +
              'where userId in (select  id from users where accountId = uuid_to_bin(?)) and ' +
              'roleId in (select id from Roles where title in ("account admin", "account owner"))';

            var accountOwners = await conn.query(getUserQuery, [getInshareDetails.accountId]);
            debug('30');

            await conn.query('START TRANSACTION');

            Async.eachSeries(accountOwners, function (accountOwner, calb) {
                debug('31');
                var ownerUUID = accountOwner.userId;

                InShare.getUser({ownerUUID: ownerUUID}, async function (err, accountOwner) {

                    if (err) {
                        return calb(err);
                    }

                    if (!accountOwner) {
                        err = new Error(ErrorConfig.MESSAGE.USER_NOT_EXISTS);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        return calb(err);
                    }
                    var opt = {
                        languageCultureCode: accountOwner.languageCultureCode,
                        template: template,
                        email: accountOwner.email
                    };
                    var compileOptions = {
                        name: accountOwner.firstName,
                        friend_name: user.firstName,
                        user_email: user.email,
                        scopehub_login: Endpoints.SCOPEHUB_LOGIN_URL
                    };

                    EmailUtils.sendEmailMD(opt, compileOptions, async function (err) {

                        if (err) {
                            //await conn.query('ROLLBACK;');
                            return calb(err);
                        }
                        if (DataUtils.isUndefined(user.firstName)) {
                            user.firstName = '';
                        }
                        if (DataUtils.isUndefined(user.lastName)) {
                            user.lastName = '';
                        }

                        try {
                            var NotificationApi = require('../api/notification');
                            var notificationOption = {
                                refereId: getInshareDetails.outShareInstanceId,
                                refereType: Constants.NOTIFICATION_REFERE_TYPE.IN_SHARE,
                                user_ids: [accountOwner.id],
                                topic_id: accountOwner.id,
                                notificationExpirationDate: new Date(Constants.DEFAULT_TIMESTAMP),
                                paramasDateTime: new Date(),
                                notification_reference: notification_reference,
                                metaEmail: user.email,
                                paramsInviter: user.email + ', ' + (user.firstName ? user.firstName : '') + ' ' + (user.lastName ? user.lastName : ''),
                                paramsInvitee: accountOwner.email + ', ' + (accountOwner.firstName ? accountOwner.firstName : '') + ' ' + (accountOwner.lastName ? accountOwner.lastName : ''),
                                languageCultureCode: accountOwner.languageCultureCode,
                                createdBy: user.id,
                                type: options.type || Constants.DEFAULT_NOTIFICATION_TYPE
                            };

                            if (user.firstName) {
                                notificationOption.metaName = user.firstName;
                            }
                            await NotificationApi.createMD(notificationOption);
                            AuditUtils.create(auditOptions);
                            return calb();

                        } catch (err) {

                            errorOptions.err = err;
                            await ErrorUtils.create(errorOptions);

                            // if (err.code) {
                            //     err = new Error(ErrorConfig.MESSAGE.IN_SHARE_NOTFICATION_CREATION_FAILED);
                            //     err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                            // }
                            return calb();
                        }
                    });
                });

            }, async function (err) {

                if (err) {
                    errorOptions.err = err;
                    await ErrorUtils.create(errorOptions);
                    //await conn.query('ROLLBACK;');
                    // err = new Error(ErrorConfig.MESSAGE.IN_SHARE_UPDATE_FAILED);
                    // err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    // return cb(err);
                }
                debug('32');
                await conn.query('COMMIT');
                return cb(null, response);
            });
        } catch (err) {
            debug('err', err);

            await conn.query('ROLLBACK;');
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);

            if (err.code) {
                err = new Error(ErrorConfig.MESSAGE.IN_SHARE_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    //Calculate Actual sharing date based of frequency and startDateType
    getFrequencyDateTime: function (outShareDetails) {
        return new Promise(function (resolve, reject) {
              var actualSharingDate, freqTime, freqHour, freqHourTime, freqDay, hours, minutes, subHour, addDate, subDate,
                date, daysInMonth;
              /*
               outShareDetails.startDateType = 2;
               outShareDetails.offeredStartDate = 1546367410000;
               outShareDetails.freqType = 'monthly';
               outShareDetails.freqTime = '11 pm';
               outShareDetails.freqDay = '1';*/

              if (outShareDetails.startDateType === Constants.OUT_SHARE_START_DATE.ASAP_AFTER
                && outShareDetails.offeredStartDate >= (moment().valueOf())) {
                  if (outShareDetails.freqType === Constants.OUT_SHARE_FREQ_TYPE.REAL_TIME) {
                      actualSharingDate = outShareDetails.offeredStartDate;
                      return resolve(actualSharingDate);
                  }
              } else {
                  if (outShareDetails.freqType === Constants.OUT_SHARE_FREQ_TYPE.REAL_TIME) {
                      actualSharingDate = moment().valueOf();
                      return resolve(actualSharingDate);
                  }
              }

              if (outShareDetails.startDateType === Constants.OUT_SHARE_START_DATE.ASAP_AFTER
                && outShareDetails.offeredStartDate >= (moment().valueOf())) {
                  if (outShareDetails.freqType === Constants.OUT_SHARE_FREQ_TYPE.EVERY_15_MIN) {
                      actualSharingDate = moment(outShareDetails.offeredStartDate).add(15, 'minute').valueOf();
                      return resolve(actualSharingDate);
                  }
              } else {
                  if (outShareDetails.freqType === Constants.OUT_SHARE_FREQ_TYPE.EVERY_15_MIN) {
                      actualSharingDate = moment().add(15, 'minute').valueOf();
                      return resolve(actualSharingDate);
                  }
              }

              if (outShareDetails.startDateType === Constants.OUT_SHARE_START_DATE.ASAP_AFTER
                && outShareDetails.offeredStartDate >= (moment().valueOf())) {
                  if (outShareDetails.freqType === Constants.OUT_SHARE_FREQ_TYPE.HOURLY) {
                      actualSharingDate = moment(outShareDetails.offeredStartDate).add(1, 'hours').valueOf();
                      debug('1 hour actualSharingDate', actualSharingDate);
                      return resolve(actualSharingDate);
                  }
              } else {
                  if (outShareDetails.freqType === Constants.OUT_SHARE_FREQ_TYPE.HOURLY) {
                      actualSharingDate = moment().add(1, 'hours').valueOf();
                      debug('1 hour actualSharingDate', actualSharingDate);
                      return resolve(actualSharingDate);
                  }
              }

              if ((outShareDetails.freqType === Constants.OUT_SHARE_FREQ_TYPE.DAILY)
                || (outShareDetails.freqType === Constants.OUT_SHARE_FREQ_TYPE.MONTHLY)
                || (outShareDetails.freqType === Constants.OUT_SHARE_FREQ_TYPE.WEEKLY)) {
                  freqTime = outShareDetails.freqTime;
                  freqTime = freqTime.split(' ');
                  freqHour = parseInt(freqTime[0]);
                  freqHourTime = freqTime[1];
                  if (freqHour === 12 && freqHourTime === 'pm') {
                      freqHour = 12;
                  } else if (freqHour === 12 && freqHourTime === 'am') {
                      freqHour = 0;
                  } else if (freqHourTime === 'pm') {
                      freqHour = freqHour + 12;
                  }
                  subHour = 0;
                  hours = moment().get('hour');
                  minutes = moment().get('minute');
              }

              if (outShareDetails.startDateType === Constants.OUT_SHARE_START_DATE.ASAP_AFTER
                && outShareDetails.offeredStartDate >= (moment().valueOf())) {
                  if (outShareDetails.freqType === Constants.OUT_SHARE_FREQ_TYPE.DAILY) {
                      actualSharingDate = ((moment(outShareDetails.offeredStartDate)).add(freqHour, 'hour')).valueOf();
                      return resolve(actualSharingDate);
                  }
              } else {
                  if (outShareDetails.freqType === Constants.OUT_SHARE_FREQ_TYPE.DAILY) {
                      if (hours < freqHour) {
                          subHour = freqHour - hours;
                      } else {
                          subHour = 24 - (hours - freqHour);
                      }
                      actualSharingDate = ((moment().subtract(minutes, 'minutes')).add(subHour, 'hour')).valueOf();
                      return resolve(actualSharingDate);
                  }
              }

              if (outShareDetails.startDateType === Constants.OUT_SHARE_START_DATE.ASAP_AFTER
                && outShareDetails.offeredStartDate >= (moment().valueOf())) {
                  if (outShareDetails.freqType === Constants.OUT_SHARE_FREQ_TYPE.WEEKLY) {
                      freqDay = outShareDetails.freqDay;
                      freqDay = DataUtils.getDays(freqDay);
                      var currentDay = (moment(outShareDetails.offeredStartDate).weekday()) + 1;
                      var addDay;
                      if (currentDay === freqDay) {
                          debug('freqHour', freqHour);
                          actualSharingDate = (moment(outShareDetails.offeredStartDate).add(freqHour, 'hour')).valueOf();
                          debug('current weekly actualDate', actualSharingDate);
                          return resolve(actualSharingDate);
                      } else if (currentDay < freqDay) {
                          addDay = freqDay - currentDay;
                      } else {
                          addDay = (7 - currentDay) + freqDay;
                      }
                      debug('addDay', addDay);
                      debug('freqHour', freqHour);
                      actualSharingDate = (moment(outShareDetails.offeredStartDate).add(addDay, 'day')).valueOf();
                      debug('actualSharingDate', actualSharingDate);
                      actualSharingDate = ((moment(actualSharingDate)).add(freqHour, 'hour')).valueOf();
                      debug('1 weekly actualDate', actualSharingDate);
                      return resolve(actualSharingDate);
                  }
              } else {
                  if (outShareDetails.freqType === Constants.OUT_SHARE_FREQ_TYPE.WEEKLY) {
                      freqDay = outShareDetails.freqDay;
                      freqDay = DataUtils.getDays(freqDay);
                      var currentDay = (moment().weekday()) + 1;
                      var addDay;
                      if (currentDay === freqDay) {
                          if (hours < freqHour) {
                              subHour = freqHour - hours;
                              actualSharingDate = ((moment().subtract(minutes, 'minutes')).add(subHour, 'hour')).valueOf();
                          } else {
                              addDay = 6;
                              actualSharingDate = (moment().add(addDay, 'day')).valueOf();
                              subHour = 24 - (hours - freqHour);
                              actualSharingDate = ((moment(actualSharingDate).subtract(minutes, 'minutes')).add(subHour, 'hour')).valueOf();
                          }
                          return resolve(actualSharingDate);
                      } else if (currentDay < freqDay) {
                          addDay = freqDay - currentDay;
                      } else {
                          addDay = 6;
                      }
                      if (hours < freqHour) {
                          subHour = freqHour - hours;
                      } else {
                          addDay = addDay - 1;
                          subHour = 24 - (hours - freqHour);
                      }
                      actualSharingDate = (moment().add(addDay, 'day')).valueOf();
                      actualSharingDate = ((moment(actualSharingDate).subtract(minutes, 'minutes')).add(subHour, 'hour')).valueOf();
                      debug('2 weekly actualDate', actualSharingDate);
                      return resolve(actualSharingDate);
                  }
              }

              if (outShareDetails.startDateType === Constants.OUT_SHARE_START_DATE.ASAP_AFTER
                && outShareDetails.offeredStartDate >= (moment().valueOf())) {
                  if (outShareDetails.freqType === Constants.OUT_SHARE_FREQ_TYPE.MONTHLY) {
                      date = moment(outShareDetails.offeredStartDate).get('date');
                      daysInMonth = moment(outShareDetails.offeredStartDate).daysInMonth();

                      // calculate last date of the month
                      if (outShareDetails.freqDay === Constants.FREQ_MONTHLY.END_OF_MONTH) {
                          addDate = daysInMonth - date;
                          actualSharingDate = (moment(outShareDetails.offeredStartDate).add(addDate, 'day')).valueOf();
                          actualSharingDate = (moment(actualSharingDate).add(freqHour, 'hour')).valueOf();
                          debug('actualSharingDate from end month', actualSharingDate);
                          return resolve(actualSharingDate);
                      }
                      freqDay = outShareDetails.freqDay;
                      freqDay = parseInt(freqDay);

                      // if freq day is not available in the month then skip this month and add next month for that date
                      if (daysInMonth < freqDay) {
                          addDate = freqDay - date;
                          actualSharingDate = (moment(outShareDetails.offeredStartDate).add(1, 'month')).valueOf();
                          actualSharingDate = (moment(actualSharingDate).add(addDate, 'day')).valueOf();
                          actualSharingDate = (moment(actualSharingDate).add(freqHour, 'hour')).valueOf();
                          debug('--skip actualSharingDate', actualSharingDate);
                          return resolve(actualSharingDate);
                      }

                      // if offered date is same as freqday
                      if (date === freqDay) {
                          actualSharingDate = (moment(outShareDetails.offeredStartDate).add(freqHour, 'hour')).valueOf();
                          debug('--same date actualSharingDate', actualSharingDate);
                          return resolve(actualSharingDate);
                      }

                      if (date < freqDay) {
                          subDate = (freqDay - date);
                          actualSharingDate = (moment(outShareDetails.offeredStartDate).add(subDate, 'day')).valueOf();
                          actualSharingDate = (moment(actualSharingDate).add(freqHour, 'hour')).valueOf();
                      } else {
                          addDate = ((daysInMonth - date) + freqDay);
                          actualSharingDate = (moment(outShareDetails.offeredStartDate).add(addDate, 'day')).valueOf();
                          actualSharingDate = (moment(actualSharingDate).add(freqHour, 'hour')).valueOf();
                      }

                      debug('1 actualSharingDate', actualSharingDate);
                      return resolve(actualSharingDate);
                  }
              } else {
                  if (outShareDetails.freqType === Constants.OUT_SHARE_FREQ_TYPE.MONTHLY) {
                      date = moment().get('date');
                      daysInMonth = moment().daysInMonth();

                      // calculate last date of the month
                      if (outShareDetails.freqDay === Constants.FREQ_MONTHLY.END_OF_MONTH) {
                          subDate = (freqDay - date);
                          if (hours < freqHour) {
                              subHour = freqHour - hours;
                          } else {
                              subDate = subDate - 1;
                              subHour = 24 - (hours - freqHour);
                          }
                          addDate = daysInMonth - date;
                          actualSharingDate = (moment().add(addDate, 'day')).valueOf();
                          actualSharingDate = (moment(actualSharingDate).subtract(minutes, 'minutes').add(subHour, 'hour')).valueOf();
                          debug('2 actualSharingDate from end month', actualSharingDate);
                          return resolve(actualSharingDate);
                      }
                      freqDay = outShareDetails.freqDay;
                      freqDay = parseInt(freqDay);

                      // if freq day is not available in the month then skip this month and add next month for that date
                      if (daysInMonth < freqDay) {
                          addDate = freqDay - date;
                          if (hours < freqHour) {
                              subHour = freqHour - hours;
                          } else {
                              subDate = subDate - 1;
                              subHour = 24 - (hours - freqHour);
                          }
                          actualSharingDate = (moment().add(1, 'month')).valueOf();
                          actualSharingDate = (moment(actualSharingDate).add(addDate, 'day')).valueOf();
                          actualSharingDate = (moment(actualSharingDate).subtract(minutes, 'minutes').add(freqHour, 'hour')).valueOf();
                          debug('--skip actualSharingDate', actualSharingDate);
                          return resolve(actualSharingDate);
                      }

                      // if current date is same as freqday
                      if (date === freqDay) {
                          if (hours < freqHour) {
                              subHour = freqHour - hours;
                              actualSharingDate = ((moment().subtract(minutes, 'minutes')).add(subHour, 'hour')).valueOf();
                          } else {
                              addDate = ((daysInMonth - date) + freqDay);
                              addDate = addDate - 1;
                              actualSharingDate = (moment().add(addDate, 'day')).valueOf();
                              subHour = 24 - (hours - freqHour);
                              actualSharingDate = ((moment(actualSharingDate).subtract(minutes, 'minutes')).add(subHour, 'hour')).valueOf();
                          }
                          debug('current date', actualSharingDate);
                          return resolve(actualSharingDate);
                      }

                      if (date < freqDay) {
                          subDate = (freqDay - date);
                          if (hours < freqHour) {
                              subHour = freqHour - hours;
                          } else {
                              subDate = subDate - 1;
                              subHour = 24 - (hours - freqHour);
                          }
                          actualSharingDate = (moment().add(subDate, 'day')).valueOf();
                          actualSharingDate = ((moment(actualSharingDate).subtract(minutes, 'minutes')).add(subHour, 'hour')).valueOf();
                      } else {
                          addDate = ((daysInMonth - date) + freqDay);
                          if (hours < freqHour) {
                              subHour = freqHour - hours;
                          } else {
                              addDate = addDate - 1;
                              subHour = 24 - (hours - freqHour);
                          }
                          actualSharingDate = (moment().add(addDate, 'day')).valueOf();
                          actualSharingDate = ((moment(actualSharingDate).subtract(minutes, 'minutes')).add(subHour, 'hour')).valueOf();
                      }
                      debug('2 actualSharingDate', actualSharingDate);
                      return resolve(actualSharingDate);
                  }
              }
          }
        );
    },

    getUser: async function (options, cb) {
        var userId = options.ownerUUID;

        try {
            var conn = await connection.getConnection();

            var accountOwner = await conn.query('select CAST(uuid_from_bin(id) as char) as id,status,flag,postRegComplete,firstName,lastName,' +
              'tosStatus, email,languageCultureCode from users where id = uuid_to_bin(?) and (status = "active" or status = "temporary") ', [userId]);

            accountOwner = Utils.filteredResponsePool(accountOwner);

            debug('accountOwner', accountOwner);

            return cb(null, accountOwner);
        } catch (err) {
            err = new Error(ErrorConfig.MESSAGE.USER_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    getInShares: function () {
        return new Promise(async function (resolve, reject) {
            var expiredDate = moment().subtract(30, 'days').valueOf();
            var reminderDate = moment().subtract(15, 'days').valueOf();
            debug('expiredDate', expiredDate, reminderDate);
            try {
                var conn = await connection.getConnection();
                var newExpiredInShare = await conn.query('select CAST(uuid_from_bin(id) as char) as id ' +
                  'from InShare where createdAt < ? and status =?', [expiredDate, Constants.IN_SHARE_STATUS.NEW]);

                var newRemindInShare = await conn.query('select CAST(uuid_from_bin(id) as char) as id,' +
                  'CAST(uuid_from_bin(accountId) as char) as accountId,CAST(uuid_from_bin(createdBy) as char) as createdBy,' +
                  'CAST(uuid_from_bin(outShareInstanceId) as char) as outShareInstanceId ' +
                  'from InShare where createdAt < ? and status =? and reminderDate = createdAt', [reminderDate, Constants.IN_SHARE_STATUS.NEW]);

                var result = {
                    newExpiredInShare: newExpiredInShare,
                    newRemindInShare: newRemindInShare
                };
                debug('result', result);
                return resolve(result);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.IN_SHARE_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },
    manipulateQuery: function (options) {
        return new Promise(function (resolve, reject) {
            var inShares = options.inShares;
            var string = '', values = [];

            _.map(inShares, function (inShare) {
                if (inShare.id) {
                    string += 'uuid_to_bin(?),';
                    values.push(inShare.id);
                }
            });
            string = string.replace(/,\s*$/, ' ');
            return resolve({
                string: string,
                values: values
            });
        });
    },
    /*
        * Get InShare by id
        * */
    getInShareById: function (options) {
        return new Promise(async function (resolve, reject) {
            var id = options.id;
            var err;
            try {
                var conn = await connection.getConnection();
                var inShare = await conn.query('select * from InShare ' +
                  'where id=uuid_to_bin(?)', [id]);
                inShare = Utils.filteredResponsePool(inShare);
                if (!inShare) {
                    err = new Error(ErrorConfig.MESSAGE.IN_SHARE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }
                return resolve(inShare);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.IN_SHARE_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
   * Get user by email
   * */
    getUserByEmail: function (options) {
        return new Promise(async function (resolve, reject) {
            var email = options.email;
            var err;

            try {
                var conn = await connection.getConnection();

                var user = await conn.query('select CAST(uuid_from_bin(id) as char) as userId,' +
                  'CAST(uuid_from_bin(id) as char) as id,CAST(uuid_from_bin(accountId) as char) as accountId,' +
                  'firstName,lastName,email,languageCultureCode  from users where email = ?;', [email]);
                user = Utils.filteredResponsePool(user);

                return resolve(user);
            } catch (err) {
                err = new Error(ErrorConfig.MESSAGE.USER_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    expiredRemindInShare: async function (options, cb) {
        if (DataUtils.isUndefined(options.expiredRemindInShares)) {
            return cb();
        }
        try {
            var conn = await connection.getConnection();
            var tempExpired = [];
            var tempReminder = [];
            var fields = '';
            var fieldsValue = [];
            var fieldsStatus = [];
            var notifyOption, notifyResponse;

            //Update Expired inshare records
            var currentDate = DataUtils.getEpochMSTimestamp();
            var string = '', values = [];

            try {
                var response = await InShare.manipulateQuery({inShares: options.expiredRemindInShares.newExpiredInShare});
                if (response.values.length > 0) {
                    var updateExpiredInShare = await conn.query('Update InShare set status = ' + Constants.IN_SHARE_STATUS.EXPIRED + ' where id in (' +
                      response.string + ') ', response.values);
                }
                debug('updateExpiredInShare', updateExpiredInShare);
            } catch (err) {
                debug('Err from expired update', err);
            }

            //Send reminder to inShares
            _.map(options.expiredRemindInShares.newRemindInShare, async function (value) {
                if (value.id) {
                    tempReminder.push({
                        id: value.id,
                        outShareInstanceId: value.outShareInstanceId,
                        accountId: value.accountId
                    });
                }
            });
            debug('tempReminder', tempReminder);

            await Promise.each(tempReminder, async function (inShare) {
                try {
                    var err;
                    var updateReminderInShare = await conn.query('Update InShare set reminderDate = ? where id = uuid_to_bin(?)',
                      [currentDate, inShare.id]);

                    debug('updateReminderInShare', updateReminderInShare);
                    // Get inShare
                    var getInShare = await conn.query('SELECT CAST(uuid_from_bin(InS.id) AS CHAR) AS id,(' +
                      'SELECT email FROM users ' +
                      'WHERE id = InS.createdBy) AS inviterEmail,(SELECT CONCAT_WS(",",t1.s1,t2.c1) ' +
                      'FROM (SELECT GROUP_CONCAT(Supp.email) AS s1 ' +
                      'FROM Supplier Supp,OutSharePartners OSPart,OutShare OS,InShare InS ' +
                      'WHERE OS.id = uuid_to_bin(?) and InS.id = uuid_to_bin(?) and ' +
                      'OSPart.outShareInstanceId = OS.id AND Supp.accountId = OS.accountId and OSPart.inSharePartnerId = InS.accountId and ' +
                      'Supp.suppliersAccountId = OSPart.inSharePartnerId AND OSPart.type="supplier")t1,' +
                      '(SELECT GROUP_CONCAT(C.email) AS c1 ' +
                      'FROM Customers C,OutSharePartners OSPart,OutShare OS, InShare InS ' +
                      'WHERE OS.id = uuid_to_bin(?) and InS.id = uuid_to_bin(?) and ' +
                      'OSPart.outShareInstanceId = OS.id and OSPart.inSharePartnerId = InS.accountId and C.accountId =OS.accountId and ' +
                      'C.customersAccountId = OSPart.inSharePartnerId AND OSPart.type="customer")t2) AS inviteeEmail ' +
                      'FROM InShare InS WHERE InS.id = uuid_to_bin(?) AND InS.outShareInstanceId = uuid_to_bin(?) ',
                      [inShare.outShareInstanceId, inShare.id,
                          inShare.outShareInstanceId, inShare.id, inShare.id, inShare.outShareInstanceId]);

                    getInShare = Utils.filteredResponsePool(getInShare);

                    var inviteeUser = await InShare.getUserByEmail({email: getInShare.inviteeEmail});
                    if (!inviteeUser) {
                        err = new Error(ErrorConfig.MESSAGE.INVITEE_NOT_FOUND);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        throw err;
                    }

                    var inviterUser = await InShare.getUserByEmail({email: getInShare.inviterEmail});
                    if (!inviterUser) {
                        err = new Error(ErrorConfig.MESSAGE.INVITER_NOT_FOUND);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        throw err;
                    }

                    var authUsers = await Customer.getAuthorizeUser({accountId: inviteeUser.accountId});

                    var notification = await Customer.getNotification({refereId: inShare.id});

                    notifyOption = {
                        notification: notification,
                        id: inShare.id,
                        inviterUser: inviterUser,
                        notificationReference: NotificationReferenceData.IN_SHARE_REMINDER,
                        emailTemplate: Constants.EMAIL_TEMPLATES.IN_SHARE_REMINDER
                    };

                    if (!authUsers || authUsers.length <= 0) {
                        notifyOption.inviteeUserId = inviteeUser.userId;
                        notifyResponse = await Customer.notifyReminderCustomer(notifyOption);
                    } else {
                        await Promise.each(authUsers, async function (inviteeUser) {
                            notifyOption.inviteeUserId = inviteeUser.userId;
                            notifyResponse = await Customer.notifyReminderCustomer(notifyOption);
                        });
                    }
                    return cb(null, Constants.OK_MESSAGE);

                } catch (err) {
                    debug('err', err);
                    await ErrorUtils.create(options, err);
                    if (err.errno) {
                        err = new Error(ErrorConfig.MESSAGE.IN_SHARE_REMINDER_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    }
                    return cb(err);
                }
            });
        } catch (err) {
            debug('err', err);
        }

    },

    /*
    * Notify the In Share partner
    * */
    notifyReminderInShare: function (options) {
        return new Promise(async function (resolve, reject) {
            var inviteeUserId = options.inviteeUserId;
            var inviterUser = options.inviterUser;
            var id = options.id;
            var notificationReference = options.notificationReference;
            var emailTemplate = options.emailTemplate;
            var notification = options.notification;
            var NotificationApi = require('./notification');
            var err;

            try {
                var inviteeUser = await Customer.getUserByIdMD({
                    userId: inviteeUserId,
                    notifyType: Constants.NOTIFICATION_CATEGORY_TYPE.SHARING
                });
                //send Email
                var opt = {
                    languageCultureCode: inviteeUser.languageCultureCode,
                    template: emailTemplate,
                    email: inviteeUser.email
                };

                var compileOptions = {
                    name: inviteeUser.firstName,
                    friend: inviterUser.email,
                    inviteDate: notification.paramasDateTime
                };
                var notifyFlag = JSON.parse(inviteeUser.notifyFlag);
                if (notifyFlag.email === 1) {
                    await EmailUtils.sendEmailPromise(opt, compileOptions);
                }

                if (notifyFlag.notification === 1) {
                    var date = new Date();
                    var invitationExpirationDate = date.setDate(date.getDate() + Constants.INVITATION_EXPIRATION_DATE_LIMIT);
                    invitationExpirationDate = new Date(invitationExpirationDate);

                    //send notification
                    var notificationOption = {
                        refereId: id, //id of customer record
                        refereType: Constants.NOTIFICATION_REFERE_TYPE.IN_SHARE,
                        user_ids: [inviteeUser.id],
                        topic_id: inviteeUser.id,
                        notificationExpirationDate: invitationExpirationDate,
                        paramasDateTime: notification.paramasDateTime,
                        notification_reference: notificationReference,
                        metaEmail: inviterUser.email,
                        paramsInviter: inviterUser.email + ', ' + (inviterUser.firstName ? inviterUser.firstName : '') + ' ' + (inviterUser.lastName ? inviterUser.lastName : ''),
                        paramsInvitee: inviteeUser.email + ', ' + (inviteeUser.firstName ? inviteeUser.firstName : '') + ' ' + (inviteeUser.lastName ? inviteeUser.lastName : ''),
                        languageCultureCode: inviteeUser.languageCultureCode,
                        createdBy: inviterUser.id,
                        type: Constants.DEFAULT_NOTIFICATION_TYPE
                    };
                    if (inviterUser.firstName) {
                        notificationOption.metaName = inviterUser.firstName;
                    }
                    await NotificationApi.createMD(notificationOption);
                }

                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.IN_SHARE_PARTNER_NOTIFY_FAILED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return reject(err);
            }
        });
    },

    deleteInShare: async function (options, auditOptions, errorOptions, cb) {
        var OutShareApi = require('./out_share_instance');
        var inShares = options.ids;
        var accountId = options.accountId;
        var userId = options.userId;
        var successInShares = [], conflictInShares = [];
        var checkResponses = [];
        var err;

        try {
            if (DataUtils.isUndefined(inShares)) {
                err = new Error(ErrorConfig.MESSAGE.ID_REQUIRED);
            } else if (!DataUtils.isArray(inShares)) {
                err = new Error(ErrorConfig.MESSAGE.ID_MUST_BE_ARRAY);
            } else if (inShares.length <= 0) {
                err = new Error(ErrorConfig.MESSAGE.ATLEAST_ONE_ID_REUQIRED);
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }

            await Promise.each(inShares, async function (inShare) {

                if (DataUtils.isUndefined(inShare.id)) {
                    err = new Error(ErrorConfig.MESSAGE.IN_SHARE_ID_REQUIRED);
                } else if (DataUtils.isValidateOptionalField(inShare.updatedAt)) {
                    err = new Error(ErrorConfig.MESSAGE.IN_SHARE_UPDATED_AT_REQUIRED);
                } else if (!DataUtils.isValidNumber(inShare.updatedAt)) {
                    err = new Error(ErrorConfig.MESSAGE.IN_SHARE_UPDATED_AT_MUST_BE_NUMBER);
                } else if (inShare.updatedAt.toString().length !== 13) {
                    err = new Error(ErrorConfig.MESSAGE.IN_SHARE_UPDATED_AT_INVALID);
                }
                if (err) {
                    throw err;
                }
            });

        } catch (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            await conn.query('START TRANSACTION;');
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        try {
            // CHECK UPDATED AT
            var response = await InShare.checkUpdatedAt({inShares: inShares});
            successInShares = response.success;
            conflictInShares = response.conflict;

            debug('successInShares', successInShares);
            if (successInShares.length <= 0) {
                err = new Error(ErrorConfig.MESSAGE.IN_SHARE_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {success: successInShares, conflict: conflictInShares};
                return cb(err);
            }

            // Check and update in share record with stop, remove out share child partners

            await Promise.each(successInShares, async function (outShare) {
                var checkOptions = {
                    id: outShare,
                    accountId: accountId,
                    userId: userId
                };
                var checkResponse = await InShare.checkInShare(checkOptions);
                if (checkResponse) {
                    checkResponses.push(checkResponse);
                }
                debug('checkResponses', checkResponses);
            });
            await Promise.each(checkResponses, async function (inShare) {
                debug('inShare', inShare);
                //NOTIFY ALL AUTHORIZE USER OF THIS PARTNER
                if (inShare.outShares && inShare.outShares.length > 0) {
                    var notifyOptions = {
                        sharePartners: inShare.outShares,
                        outShareInstanceId: inShare.id,
                        notificationReference: NotificationReferenceData.REMOVE_IN_SHARE,
                        emailTemplate: Constants.EMAIL_TEMPLATES.REMOVE_IN_SHARE,
                        userId: userId
                    };
                    var notifyResponse = await OutShareApi.notifyPartnersForAddRemoveShareItems(notifyOptions);
                }
            });

            await conn.query('COMMIT;');
            AuditUtils.create(auditOptions);
            debug('here1', successInShares.length);
            if (successInShares.length > 0 && conflictInShares.length > 0) {
                err = new Error(ErrorConfig.MESSAGE.IN_SHARE_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                err.data = {
                    successMsg: Constants.SUCCESS_MESSAGE.IN_SHARE_DELETED_SUCCESSFULLY,
                    success: successInShares,
                    conflict: conflictInShares
                };
                debug('err');
                return cb(err);
            } else {
                var success = {
                    OK: Constants.SUCCESS_MESSAGE.IN_SHARE_DELETE_SUCCESS,
                    success: successInShares
                };
                debug('success', success);
                return cb(null, success);
            }
        } catch (err) {
            debug('err', err);
            debug('ROLLBACK');
            await conn.query('ROLLBACK;');
            ErrorUtils.create(errorOptions, options, err);
            if (err.errno === 4002) {
                return cb(err);
            } else {
                err = new Error(ErrorConfig.MESSAGE.IN_SHARE_DELETE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    checkInShare: function (options) {
        return new Promise(async function (resolve, reject) {
            var Supplier = require('./supplier');
            var OutShare = require('./out_share_instance');
            var id = options.id;
            var userId = options.userId;
            var accountId = options.accountId;
            var outShares = [], inShare;
            var updatedAt = DataUtils.getEpochMSTimestamp();
            var currentDate = DataUtils.getEpochMSTimestamp();
            var notifyFlag = false;
            var err;

            try {
                var conn = await connection.getConnection();

                // Get in share
                inShare = await conn.query('select CAST(uuid_from_bin(id) as char) as id,' +
                  'CAST(uuid_from_bin(outShareInstanceId) as char) as outShareInstanceId, ' +
                  'CAST(uuid_from_bin(accountId) as char) as accountId from InShare ' +
                  'where id = uuid_to_bin(?);', [id]);

                inShare = Utils.filteredResponsePool(inShare);

                if (!inShare) {
                    err = new Error(ErrorConfig.MESSAGE.IN_SHARE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }
                debug('inShares', inShare);

                // Update InShare
                var status = Constants.IN_SHARE_STATUS.STOP_BY_IN_SHARE;
                var isUpdated = await conn.query('update InShare set status=?,updatedAt=?,updatedBy=uuid_to_bin(?),endDate=? where ' +
                  'id =uuid_to_bin(?)', [status, updatedAt, userId, currentDate, id]);
                isUpdated = Utils.isAffectedPool(isUpdated);

                if (!isUpdated) {
                    err = new Error(ErrorConfig.MESSAGE.IN_SHARE_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }

                // update OutShare
                outShares = await conn.query('select CAST(uuid_from_bin(id) as char) as id,' +
                  'CAST(uuid_from_bin(accountId) as char) as accountId from OutShare ' +
                  'where id = uuid_to_bin(?) ; ', [inShare.outShareInstanceId]);

                if (outShares) {
                    var updateOutShareOption = {
                        outShares: outShares,
                        userId: userId,
                        inShare: inShare
                    };
                    var updateOutShareResponse = await InShare.updateOutShare(updateOutShareOption);
                    debug('updateOutShareResponse', updateOutShareResponse);
                    notifyFlag = true;
                }
                return resolve({outShares: outShares, id: id});
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    updateOutShare: function (options) {
        return new Promise(async function (resolve, reject) {
            var Supplier = require('./supplier');
            var outShares = options.outShares;
            var inShare = options.inShare;
            var userId = options.userId;
            var updatedAt = DataUtils.getEpochMSTimestamp();
            var currentDate = DataUtils.getEpochMSTimestamp();
            var updateOutShareOption;
            var err;

            try {
                var conn = await connection.getConnection();

                // Remove child partners
                var partnerRemoved = await conn.query('delete from OutSharePartners where outShareInstanceId ' +
                  '=uuid_to_bin(?) and inSharePartnerId = uuid_to_bin(?)', [inShare.outShareInstanceId, inShare.accountId]);
                partnerRemoved = Utils.isAffectedPool(partnerRemoved);

                debug('partnerRemoved', partnerRemoved);

                if (!partnerRemoved) {
                    err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }

                // Update OutShare who has no partner left , status = pause/stop
                var outShareWithNoActiveInShare = await Supplier.getOutShareWithNoPartner({outShares: outShares});

                if (outShareWithNoActiveInShare.length > 0) {

                    //get outshare who has new or pause by inshare or outshare status
                    var checkNewPauseInShareOption = {
                        outShares: outShareWithNoActiveInShare
                    };
                    var outShareWithNewPauseInShare = await Supplier.getOutShareWithNewPauseInShare(checkNewPauseInShareOption);

                    debug('outShareWithNewPauseInShare', outShareWithNewPauseInShare.length);
                    if (outShareWithNewPauseInShare.length > 0) {
                        // Find active outshares status , pause only active outshare , not pause and invitationSent
                        var activeOutShares = await Supplier.getActiveOutShares({outShares: outShareWithNewPauseInShare});

                        debug('activeOutShares', activeOutShares);
                        if (activeOutShares.length > 0) {
                            updateOutShareOption = {
                                outShares: activeOutShares,
                                userId: userId,
                                status: Constants.OUT_SHARE_STATUS.PAUSED,
                                endDate: DataUtils.getEpochMSTimestamp()
                            };
                        }
                    } else {
                        updateOutShareOption = {
                            outShares: outShareWithNoActiveInShare,
                            userId: userId,
                            status: Constants.OUT_SHARE_STATUS.STOP,
                            endDate: DataUtils.getEpochMSTimestamp()
                        };
                    }
                    if (updateOutShareOption) {
                        debug('updateOutShareOption ----', updateOutShareOption);
                        var updateOutShareResponse = await Supplier.updateMultipleOutShareStatus(updateOutShareOption);
                        debug('updateOutShareResponse', updateOutShareResponse);
                        // update Sharing Event by stopping it
                        if (outShares.length > 0) {
                            var updateSharingEventOption = {
                                outShares: updateOutShareOption.outShares,
                                userId: userId
                            };
                            var updateSharingEventsResponse = await Supplier.updatesharingEvent(updateSharingEventOption);
                            debug('updateSharingEventsResponse', updateSharingEventsResponse);
                        }
                    }
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    checkUpdatedAt: function (options) {
        return new Promise(async function (resolve, reject) {
            var inShares = options.inShares;
            var string = '', values = [];
            var conflict = [], success = [];
            var conflictIds = [];

            try {
                var conn = await connection.getConnection();

                await Promise.each(inShares, function (inShare) {
                    string += ' SELECT CAST(uuid_from_bin(id) as char) as id FROM InShare WHERE ' +
                      '(updatedAt != ? AND id = uuid_to_bin(?)) UNION ALL ';
                    values.push(inShare.updatedAt, inShare.id);
                });

                string = string.replace(/UNION ALL \s*$/, ' ');
                var response = await conn.query(string, values);

                conflictIds = _.map(response, function (value) {
                    return value.id;
                });

                debug('conflictIds', conflictIds);
                _.map(inShares, function (inShare) {
                    if (conflictIds.indexOf(inShare.id) === -1) {
                        success.push(inShare.id);
                    } else {
                        debug('inside conflict', inShare);
                        conflict.push(inShare.id);
                    }
                });

                return resolve({success: success, conflict: conflict});
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
    * get sharingErrorLog by inShareId
    * */
    getErrorLogByInShareId: async function (options, errorOptions, cb) {
        var inShareId = options.inShareId;
        var err, sharingErrorLog;

        if (DataUtils.isUndefined(inShareId)) {
            err = new Error(ErrorConfig.MESSAGE.IN_SHARE_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();

            sharingErrorLog = await conn.query('select SEL.id,CAST(uuid_from_bin(SEL.outShareInstanceId) as char) as outShareInstanceId ,' +
              ' CAST(uuid_from_bin(SEL.inShareId) as char) as inShareId, ' +
              ' SEL.failReasonCode,SEL.errorMessage, JSON_UNQUOTE(json_extract(meta , "$.frequency")) as frequency,OS.outShareName ,' +
              ' SEL.effectiveTimeStamp,SEL.createdAt ' +
              ' from SharingErrorLog SEL , OutShare OS where ' +
              ' SEL.inShareId = uuid_to_bin(?) and OS.id = SEL.outShareInstanceId', [inShareId]);

            return cb(null, sharingErrorLog);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.GET_SHARING_ERROR_LOG_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    /*
    * validate create inShare alert request
    * */
    validateInShareAlert: function (options) {
        return new Promise(function (resolve, reject) {
            var alertTypes = Constants.ALERT_TYPES;
            var averageTypes = Constants.ALERT_AVERAGE_TYPE;
            var frequencyTypes = Constants.ALERT_FREQUENCY_TYPE;
            var sharedDataItem = Constants.SHARED_DATA_ITEMS;
            var recipients = options.recipients;
            var currentTime = DataUtils.getEpochMSTimestamp();
            var err;

            if (DataUtils.isUndefined(options.alertId)) {
                err = new Error(ErrorConfig.MESSAGE.ALERT_ID_REQUIRED);
            } else if (DataUtils.isUndefined(options.alertName)) {
                err = new Error(ErrorConfig.MESSAGE.ALERT_NAME_REQUIRED);
            } else if (DataUtils.isUndefined(options.inShareId)) {
                err = new Error(ErrorConfig.MESSAGE.IN_SHARE_ID_REQUIRED);
            } else if (DataUtils.isUndefined(options.shareItemId)) {
                err = new Error(ErrorConfig.MESSAGE.SHARE_ITEM_ID_REQUIRED);
            } else if (DataUtils.isUndefined(options.sharedDataItem)) {
                err = new Error(ErrorConfig.MESSAGE.SHARED_DATA_ITEM_REQUIRED);
            } else if (DataUtils.isUndefined(options.shareItemType)) {
                err = new Error(ErrorConfig.MESSAGE.SHARE_ITEM_TYPE_REQUIRED);
            } else if (Object.values(Constants.SHARING_TYPE).indexOf(options.shareItemType) === -1) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_SHARE_ITEM_TYPE);
            } else if (Object.values(sharedDataItem).indexOf(options.sharedDataItem) === -1) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_SHARED_DATA_ITEMS);
            } else if (DataUtils.isUndefined(options.operationType)) {
                err = new Error(ErrorConfig.MESSAGE.ALERT_OPERATION_TYPE_REQUIRED);
            } else if (Object.values(Constants.ALERT_OPERATION_TYPE).indexOf(options.operationType) === -1) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_ALERT_OPERATION_TYPE);
            } else if (DataUtils.isUndefined(options.alertType)) {
                err = new Error(ErrorConfig.MESSAGE.ALERT_TYPE_REQUIRED);
            } else if (Object.values(alertTypes).indexOf(parseInt(options.alertType)) === -1) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_ALERT_TYPE);
            } else if (DataUtils.isUndefined(options.averageType)) {
                err = new Error(ErrorConfig.MESSAGE.AVERAGE_TYPE_REQUIRED);
            } else if (Object.values(averageTypes).indexOf(parseInt(options.averageType)) === -1) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_AVERAGE_TYPE);
            } else if (DataUtils.isUndefined(options.averageValue)) {
                err = new Error(ErrorConfig.MESSAGE.AVERAGE_VALUE_REQUIRED);
            } else if (DataUtils.isUndefined(options.frequencyType)) {
                err = new Error(ErrorConfig.MESSAGE.FREQUENCY_TYPE_REQUIRED);
            } else if (Object.values(frequencyTypes).indexOf(parseInt(options.frequencyType)) === -1) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_FREQUENCY_TYPE);
            } else if (DataUtils.isUndefined(options.startDate)) {
                err = new Error(ErrorConfig.MESSAGE.START_DATE_REQUIRED);
            } else if (DataUtils.isUndefined(options.checkTime)) {
                err = new Error(ErrorConfig.MESSAGE.CHECK_TIME_REQUIRED);
            } else if (!DataUtils.isValidNumber(options.startDate)) {
                err = new Error(ErrorConfig.MESSAGE.START_DATE_MUST_BE_NUMBER);
            } else if (options.startDate.toString().length !== 13) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_START_DATE);
            } else if (DataUtils.isUndefined(recipients)) {
                err = new Error(ErrorConfig.MESSAGE.SHARING_ALERT_RECIPIENT_REQUIRED);
            } else if (!DataUtils.isArray(recipients)) {
                err = new Error(ErrorConfig.MESSAGE.SHARING_ALERT_RECIPIENT_MUST_BE_ARRAY);
            } else if (recipients.length < 1) {
                err = new Error(ErrorConfig.MESSAGE.AT_LEAST_ONE_SHARING_ALERT_RECIPIENT_REQUIRED);
            } else {
                _.map(recipients, function (recipient) {
                    if (DataUtils.isUndefined(recipient.id)) {
                        err = new Error(ErrorConfig.MESSAGE.RECIPIENT_ID_REQUIRED);
                    } else if (DataUtils.isUndefined(recipient.type)) {
                        err = new Error(ErrorConfig.MESSAGE.RECIPIENT_TYPE_REQUIRED);
                    }
                    if (err) {
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        return reject(err);
                    }
                });
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return reject(err);
            }
            return resolve(Constants.OK_MESSAGE);
        });
    },

    /*
    * Calculate Next alert Date (startDate + freq_type) 
    * */
    calculateNextAlertDate: function (options) {
        return new Promise(function (resolve, reject) {
            var startDate = parseInt(options.startDate);
            var frequencyType = parseInt(options.frequencyType);
            var skipFlag = options.skipFlag;
            var currentTime = DataUtils.getEpochMSTimestamp();
            var nextAlertDate, flag = false;


            if (!skipFlag) {
                var startDateHour = moment.utc(startDate).hours();
                var startDateMinute = moment.utc(startDate).minutes();
                var currentHour = moment.utc(currentTime).hours();
                var currentMinute = moment.utc(currentTime).hours();

                // If startDateHour > currentHour then we need to check for alert today itself , so nextAlertDate = startDate
                if (startDateHour > currentHour) {
                    nextAlertDate = startDate;
                    flag = true;
                } else if (startDateHour === currentHour) {
                    if (startDateMinute > currentMinute) {
                        nextAlertDate = startDate;
                        flag = true;
                    }
                }
            }
            if (!flag) {
                if (frequencyType === Constants.ALERT_FREQUENCY_TYPE.EVERY_24_HOUR) {
                    nextAlertDate = moment(startDate).add(24, 'hours').valueOf();
                } else if (frequencyType === Constants.ALERT_FREQUENCY_TYPE.EVERY_18_HOUR) {
                    nextAlertDate = moment(startDate).add(18, 'hours').valueOf();
                } else if (frequencyType === Constants.ALERT_FREQUENCY_TYPE.EVERY_12_HOUR) {
                    nextAlertDate = moment(startDate).add(12, 'hours').valueOf();
                } else if (frequencyType === Constants.ALERT_FREQUENCY_TYPE.EVERY_6_HOUR) {
                    nextAlertDate = moment(startDate).add(6, 'hours').valueOf();
                } else if (frequencyType === Constants.ALERT_FREQUENCY_TYPE.EVERY_3_HOUR) {
                    nextAlertDate = moment(startDate).add(3, 'hours').valueOf();
                } else if (frequencyType === Constants.ALERT_FREQUENCY_TYPE.EVERY_1_HOUR) {
                    nextAlertDate = moment(startDate).add(1, 'hours').valueOf();
                }
            }
            return resolve(nextAlertDate);
        });
    },

    /*
    * insert inShare alert record in SharingAlert table
    * */
    insertInShareAlertRecord: function (options) {
        return new Promise(async function (resolve, reject) {
            var generatedId = Utils.generateId();
            var currentTime = DataUtils.getEpochMSTimestamp();
            var err;
            try {
                var conn = await connection.getConnection();

                var isInserted = await conn.query('IF (SELECT 1 FROM SharingAlert WHERE accountId = uuid_to_bin(?) AND ' +
                  ' inShareId = uuid_to_bin(?) AND shareItemId = uuid_to_bin(?) and sharedDataItem= ? and status = ?) is not null then ' +
                  ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "IN_SHARE_ALERT_ARE_ALREADY_EXIST_FOR_THIS_SETUP",MYSQL_ERRNO = 4001; ' +
                  ' ELSEIF (SELECT 1 FROM InShare where id = uuid_to_bin(?) AND status = ?) is null then ' +
                  ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "IN_SHARE_IS_NOT_ACTIVE",MYSQL_ERRNO = 4002;' +
                  ' ELSE insert into SharingAlert set id=uuid_to_bin(?), accountId=uuid_to_bin(?),alertId=?,alertName=?,' +
                  ' inShareId=uuid_to_bin(?),shareItemId=uuid_to_bin(?),shareItemType=?, sharedDataItem=?, alertType=?, ' +
                  ' averageType=?, averageValue=?,operationType=?, frequencyType=?, startDate=?,checkTime=?,nextAlertDate=?, status=?, ' +
                  ' createdAt=?, updatedAt=?, createdBy=uuid_to_bin(?);END IF;', [options.accountId, options.inShareId,
                    options.shareItemId, options.sharedDataItem, Constants.ALERT_STATUS.ACTIVE, options.inShareId, Constants.IN_SHARE_STATUS.ACTIVE,
                    generatedId.uuid, options.accountId, options.alertId, options.alertName, options.inShareId, options.shareItemId, options.shareItemType, options.sharedDataItem, options.alertType,
                    options.averageType, options.averageValue, options.operationType, options.frequencyType, options.startDate, options.checkTime, options.nextAlertDate,
                    Constants.ALERT_STATUS.ACTIVE, currentTime, currentTime, options.userId]);
                isInserted = Utils.isAffectedPool(isInserted);
                if (!isInserted) {
                    throw err;
                }
                return resolve({
                    OK: Constants.SUCCESS_MESSAGE.IN_SHARE_ALERT_CREATED_SUCCESSFULLY,
                    id: generatedId.uuid,
                    updatedAt: currentTime
                });
            } catch (err) {
                debug('err', err);
                if (err.errno === 4001) {
                    err = new Error(ErrorConfig.MESSAGE.IN_SHARE_ALERT_ARE_ALREADY_EXIST_FOR_THIS_SETUP);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                } else if (err.errno === 4002) {
                    err = new Error(ErrorConfig.MESSAGE.IN_SHARE_IS_NOT_ACTIVE);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                } else {
                    err = new Error(ErrorConfig.MESSAGE.IN_SHARE_ALERT_CREATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                }
                return reject(err);
            }
        });
    },

    /*
    * insert multiple sharing alert recipient records
    * */
    createSharingAlertRecipient: function (options) {
        return new Promise(async function (resolve, reject) {
            var alertRecipientList = options.alertRecipientList;
            var convertedRecipientList, keys, err;
            var currentTime = DataUtils.getEpochMSTimestamp();

            await Utils.convertObjectToArrayMD(alertRecipientList, async function (err, response) {
                if (err) {
                    debug('err', err);
                    return reject(err);
                }
                convertedRecipientList = response.list;
                keys = response.keys;
                debug;

                var query = 'insert into SharingAlertRecipient (' + keys + ') values';

                var values = ' (uuid_to_bin(?), uuid_to_bin(?),uuid_to_bin(?), uuid_to_bin(?),?,?,?,?) ';

                await Promise.each(alertRecipientList, function (value) {
                    query = query + values;
                    query = query + ',';
                });

                query = query.replace(/,\s*$/, '');

                try {
                    var conn = await connection.getConnection();
                    var alertRecipientInserted = await conn.query(query, convertedRecipientList);
                    alertRecipientInserted = Utils.isAffectedPool(alertRecipientInserted);
                    debug('alertRecipientInserted-----------------------------------------', alertRecipientInserted);
                    if (!alertRecipientInserted) {
                        throw err;
                    }
                    return resolve(Constants.OK_MESSAGE);
                } catch (err) {
                    debug('err ', err);
                    err = new Error(ErrorConfig.MESSAGE.SHARING_ALERT_RECIPIENT_CREATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
            });
        });
    },

    /*
    *
    * */
    getInSharesByMapItem: async function (options, errorOptions, cb) {
        var userId = options.userId;
        var mapItemType = options.mapItemType;
        var mapItemId = options.mapItemId;
        var err;

        if (DataUtils.isUndefined(mapItemType)) {
            err = new Error(ErrorConfig.MESSAGE.MAP_ITEM_TYPE_REQUIRED);
        } else if (DataUtils.isUndefined(mapItemId)) {
            err = new Error(ErrorConfig.MESSAGE.MAP_ITEM_ID_REQUIRED);
        }
        if (err) {
            debug('err', err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();


        } catch (err) {
            debug('err', err);
            return cb(err);
        }
    },

    /*
    * CREATE IN_SHARE ALERTS
    * */
    createInShareAlert: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var inShareId = options.inShareId;
        var alertId = options.alertId;
        var alertName = options.alertName;
        var startDate = options.startDate;
        var frequencyType = options.frequencyType;
        var shareItemId = options.shareItemId;
        var sharedDataItem = options.sharedDataItem;
        var shareItemType = options.shareItemType;
        var alertType = options.alertType;
        var averageType = options.averageType;
        var averageValue = options.averageValue;
        var recipients = options.recipients;
        var checkTime = options.checkTime;
        var operationType = options.operationType;
        var accountId = user.accountId;

        try {
            var conn = await connection.getConnection();

            // VALIDATE REQUEST
            var validateResponse = await InShare.validateInShareAlert(options);
            debug('validateResponse ', validateResponse);

            // CALCULATE NEXT ALERT CHECK DATE BASED ON FREQ_TYPE AND START DATE
            var nextAlertDate = await InShare.calculateNextAlertDate({
                frequencyType: frequencyType,
                startDate: startDate
            });
            debug('nextAlertDate', nextAlertDate);

            //START TRANSACTION
            try {
                await conn.query('START TRANSACTION');
            } catch (err) {
                debug('err', err);
                return cb(err);
            }

            // INSERT IN_SHARE ALERT RECORD
            var createAlertOption = {
                userId: user.id,
                accountId: accountId,
                alertId: alertId,
                alertName: alertName,
                inShareId: inShareId,
                shareItemId: shareItemId,
                sharedDataItem: sharedDataItem,
                shareItemType: shareItemType,
                alertType: alertType,
                averageType: averageType,
                averageValue: averageValue,
                frequencyType: frequencyType,
                startDate: startDate,
                checkTime: checkTime,
                operationType: operationType,
                nextAlertDate: nextAlertDate
            };
            var insertResponse = await InShare.insertInShareAlertRecord(createAlertOption);
            debug('insertResponse', insertResponse);

            //INSERT ALERT RECIPIENTS
            var alertRecipientList = [];
            //Add login user also because we need to notify them
            recipients.push({
                id: user.id,
                type: Constants.ALERT_RECIPIENT_TYPE.USERS
            });
            _.map(recipients, function (recipient) {
                var currentTime = DataUtils.getEpochMSTimestamp();
                var recipientObject = {
                    id: Utils.generateId().uuid,
                    alertId: insertResponse.id,
                    recipientId: recipient.id,
                    createdBy: user.id,
                    type: recipient.type,
                    status: Constants.ALERT_RECIPIENT_STATUS.ACTIVE,
                    createdAt: currentTime,
                    updatedAt: currentTime
                };
                alertRecipientList.push(recipientObject);
            });
            var alertRecipientResponse = await InShare.createSharingAlertRecipient({alertRecipientList: alertRecipientList});
            debug('alertRecipientResponse', alertRecipientResponse);

            // Create audit log
            await AuditUtils.create(auditOptions);
            await conn.query('COMMIT;');
            return cb(null, insertResponse);
        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK');
            ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    /*
    * validate Optional fields
    * */
    validateOptionalAlertFields: function (options) {
        return new Promise(async function (resolve, reject) {
            try {
                var alertOptionalFields = '';
                var alertOptionalValues = [];
                if (DataUtils.isDefined(options.alertId)) {
                    alertOptionalFields += ' alertId = ? ,';
                    alertOptionalValues.push(options.alertId);
                }
                if (DataUtils.isDefined(options.alertName)) {
                    alertOptionalFields += ' alertName = ? ,';
                    alertOptionalValues.push(options.alertName);
                }
                if (DataUtils.isDefined(options.averageType)) {
                    alertOptionalFields += ' averageType = ? ,';
                    alertOptionalValues.push(options.averageType);
                }
                if (DataUtils.isDefined(options.averageValue)) {
                    alertOptionalFields += ' averageValue = ? ,';
                    alertOptionalValues.push(options.averageValue);
                }
                if (DataUtils.isDefined(options.frequencyType)) {
                    alertOptionalFields += ' frequencyType = ? ,';
                    alertOptionalValues.push(options.frequencyType);
                }
                if (DataUtils.isDefined(options.checkTime)) {
                    alertOptionalFields += ' checkTime = ? ,';
                    alertOptionalValues.push(options.checkTime);
                }
                if (DataUtils.isDefined(options.status)) {
                    alertOptionalFields += ' status = ? ,';
                    alertOptionalValues.push(options.status);
                }
                if (DataUtils.isDefined(options.operationType)) {
                    alertOptionalFields += ' operationType = ? ,';
                    alertOptionalValues.push(options.operationType);
                }
                // This condition is from job api (alert check)
                if (DataUtils.isDefined(options.nextAlertDate)) {
                    alertOptionalFields += ' nextAlertDate = ? ,';
                    alertOptionalValues.push(options.nextAlertDate);
                }
                // This condition is from update api
                if (DataUtils.isDefined(options.startDate)) {
                    alertOptionalFields += ' nextAlertDate = ? ,';

                    var nextAlertDate = await InShare.calculateNextAlertDate({
                        frequencyType: options.frequencyType,
                        startDate: options.startDate
                    });
                    debug('nextAlertDate', nextAlertDate);
                    alertOptionalValues.push(nextAlertDate);
                }
                var response = {
                    alertOptionalFields: alertOptionalFields,
                    alertOptionalValues: alertOptionalValues
                };
                return resolve(response);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
    * UPDATE IN_SHARE ALERTS
    * */
    updateInShareAlert: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var id = options.id;
        var accountId = user.accountId;
        var startDate = options.startDate;
        var frequencyType = options.frequencyType;
        var averageType = options.averageType;
        var averageValue = options.averageValue;
        var updatedAt = options.updatedAt;
        var alertOptionalFields, alertOptionalValues;
        var currentTime = DataUtils.getEpochMSTimestamp();
        var status = Constants.ALERT_STATUS.ACTIVE;
        var err;

        if (DataUtils.isUndefined(id)) {
            err = new Error(ErrorConfig.MESSAGE.IN_SHARE_ALERT_ID_REQUIRED);
        } else if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_MUST_BE_NUMBER);
        } else if (updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_INVALID);
        } else if (DataUtils.isDefined(averageType) && Object.values(Constants.ALERT_AVERAGE_TYPE).indexOf(parseInt(averageType)) === -1) {
            err = new Error(ErrorConfig.MESSAGE.INVALID_AVERAGE_TYPE);
        } else if (DataUtils.isDefined(frequencyType) && Object.values(Constants.ALERT_FREQUENCY_TYPE).indexOf(parseInt(frequencyType)) === -1) {
            err = new Error(ErrorConfig.MESSAGE.INVALID_FREQUENCY_TYPE);
        } else if (DataUtils.isDefined(startDate) && DataUtils.isUndefined(frequencyType)) {
            err = new Error(ErrorConfig.MESSAGE.FREQUENCY_TYPE_REQUIRED);
        } else if (DataUtils.isDefined(startDate)) {
            if (!DataUtils.isValidNumber(startDate)) {
                err = new Error(ErrorConfig.MESSAGE.START_DATE_MUST_BE_NUMBER);
            } else if (startDate.toString().length !== 13) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_START_DATE);
            }
        }
        debug('ere', err);
        if (err) {
            debug('inside if');
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
        debug('outShaid if');

        try {
            var conn = await connection.getConnection();
            var validateResponse = await InShare.validateOptionalAlertFields(options);
            debug('validateResponse', validateResponse);
            alertOptionalFields = validateResponse.alertOptionalFields;
            alertOptionalValues = validateResponse.alertOptionalValues;

            var updateResponse = await conn.query('' +
              ' IF (SELECT 1 from SharingAlert where accountId=uuid_to_bin(?) and id=uuid_to_bin(?) and status=?) is null then ' +
              ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "IN_SHARE_ALERT_NOT_EXIST",MYSQL_ERRNO = 4001; ' +
              ' ELSEIF (SELECT 1 from SharingAlert where accountId=uuid_to_bin(?) and id=uuid_to_bin(?) and status=? ' +
              ' and updatedAt=? ) is null then ' +
              ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "IN_SHARE_ALERT_UPDATED_SINCE_YOU_LAST_RETRIEVE",MYSQL_ERRNO = 4002; ' +
              ' ELSE Update SharingAlert set ' + alertOptionalFields + ' updatedAt=?,updatedBy=uuid_to_bin(?) ' +
              ' where id = uuid_to_bin(?);END IF;', [accountId, id, status, accountId, id, status, updatedAt].concat(alertOptionalValues).concat([currentTime, user.id, id]));
            updateResponse = Utils.isAffectedPool(updateResponse);
            if (!updateResponse) {
                throw err;
            }
            return cb(null, {
                OK: Constants.SUCCESS_MESSAGE.IN_SHARE_ALERT_UPDATED_SUCCESSFULLY,
                updatedAt: currentTime
            });
        } catch (err) {
            debug('err', err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.IN_SHARE_ALERT_NOT_EXIST);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno === 4002) {
                err = new Error(ErrorConfig.MESSAGE.IN_SHARE_ALERT_UPDATED_SINCE_YOU_LAST_RETRIEVE);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
            } else {
                err = new Error(ErrorConfig.MESSAGE.UPDATE_IN_SHARE_ALERT_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    /*
    * Update inShare by status=0 or by nextSharingAlert
    * */
    updateInShareAlertRecords: function (options) {
        return new Promise(async function (resolve, reject) {
            var inShareId = options.inShareId;
            var userId = options.userId;
            var updatedAt = DataUtils.getEpochMSTimestamp();
            var alertOptionalFields, alertOptionalValues;
            var err;

            try {
                var conn = await connection.getConnection();
                var validateResponse = await InShare.validateOptionalAlertFields(options);
                debug('validateResponse', validateResponse);
                alertOptionalFields = validateResponse.alertOptionalFields;
                alertOptionalValues = validateResponse.alertOptionalValues;

                var isUpdated = await conn.query('UPDATE SharingAlert SET ' + alertOptionalFields + ' updatedAt = ?, ' +
                  ' updatedBy = uuid_to_bin(?) WHERE inShareId = uuid_to_bin(?) and status = ?',
                  [].concat(alertOptionalValues).concat([updatedAt, userId, inShareId, Constants.ALERT_STATUS.ACTIVE]));

                isUpdated = Utils.isAffectedPool(isUpdated);
                debug('isUpdated sharing alerts', isUpdated);

                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.UPDATE_IN_SHARE_ALERT_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
    * Give query component according to share Item type
    * */
    getQueryForAlertShareItemType: function (options) {
        return new Promise(function (resolve, reject) {
            var shareItemType = options.shareItemType;
            var tables = '';
            var condition = '', condition2 = '';
            var columns1 = '', columns2 = '', columns3 = '';
            var values = [];
            try {
                if (shareItemType === Constants.OUT_SHARE_PROFILE_TYPE.PRODUCT_INVENTORY) {
                    columns1 = ' ,t1.SKU,t1.locationId,t1.locationName ';
                    columns2 = ' ,PI.SKU,PI.locationId,LR.locationName ';
                    columns3 = ' ,PI.SKU,PI.locationId,LR.locationName ';
                    tables = ' ,ProductInventory PI,LocationReference LR ';
                    condition = ' AND PI.accountId = OS.accountId AND PI.id = SA.shareItemId AND LR.accountId = OS.accountId and LR.locationId = PI.locationId ';

                } else if (shareItemType === Constants.OUT_SHARE_PROFILE_TYPE.SUPPLY_INVENTORY) {
                    columns1 = ' ,t1.SKU,t1.locationId,t1.locationName ';
                    columns2 = ' ,SI.SKU,SI.locationId,LR.locationName ';
                    columns3 = ' ,SI.SKU,SI.locationId,LR.locationName ';
                    tables = ' ,SupplyInventory SI,LocationReference LR ';
                    condition = ' AND SI.accountId = OS.accountId AND SI.id = SA.shareItemId AND LR.accountId = OS.accountId and LR.locationId = SI.locationId ';

                } else if (shareItemType === Constants.OUT_SHARE_PROFILE_TYPE.PRODUCT_ORDERS) {

                    columns1 = ' ,t1.sku as SKU,t1.sellerSKUName ';
                    columns2 = ' ,PR.sku as SKU,PR.sellerSKUName ';
                    columns3 = ' ,PR.sku as SKU,PR.sellerSKUName ';
                    tables = ' ,ProductReferences PR ';
                    condition = ' AND PR.accountId = OS.accountId AND PR.id = SA.shareItemId ';

                } else if (shareItemType === Constants.OUT_SHARE_PROFILE_TYPE.DEPENDENT_DEMAND) {
                    columns1 = ' ,t1.sku as SKU,t1.sellerSKUName ';
                    columns2 = ' ,SI.sku as SKU,SI.sellerSKUName ';
                    columns3 = ' ,SI.sku as SKU,SI.sellerSKUName ';
                    tables = ' ,SupplyItems SI ';
                    condition = ' AND SI.accountId = OS.accountId AND SI.id = SA.shareItemId ';
                }
                var response = {
                    columns1: columns1,
                    columns2: columns2,
                    columns3: columns3,
                    tables: tables,
                    condition: condition
                };
                return resolve(response);

            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
    * GET IN_SHARE ALERTS
    * */
    getInShareAlert: async function (options, errorOptions, cb) {
        var accountId = options.accountId;
        var userId = options.userId;
        var inShareId = options.inShareId;
        var shareItemType = options.shareItemType;
        var err;

        if (DataUtils.isUndefined(inShareId)) {
            err = new Error(ErrorConfig.MESSAGE.IN_SHARE_ID_REQUIRED);
        } else if (DataUtils.isUndefined(shareItemType)) {
            err = new Error(ErrorConfig.MESSAGE.SHARE_ITEM_TYPE_REQUIRED);
        } else if (Object.values(Constants.OUT_SHARE_INSTANCE_ITEM_TYPE).indexOf(shareItemType) === -1) {
            err = new Error(ErrorConfig.MESSAGE.INVALID_SHARE_ITEM_TYPE);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var response = await InShare.getQueryForAlertShareItemType({shareItemType: shareItemType});
            var columns1 = response.columns1;
            var columns2 = response.columns2;
            var columns3 = response.columns3;
            var tables = response.tables;
            var condition = response.condition;

            var conn = await connection.getConnection();
            var inShareAlerts = await conn.query('WITH recipient AS( SELECT t1.id,t1.inShareRecordId,t1.sharedDataItem,t1.frequencyType,' +
              ' t1.shareItemId,t1.alertType,t1.averageType,t1.averageValue,t1.operationType,t1.inShareId,t1.shareItemType,t1.alertId,t1.alertName,t1.inShareName,t1.checkTime,t1.startDate,' +
              ' t1.updatedAt,group_concat(t1.NAME) AS name,t1.nextAlertDate ' + columns1 + ' FROM ( ' +
              ' SELECT CAST(uuid_from_bin(SA.id) as CHAR) as id,CAST(uuid_from_bin(SA.inShareId) as CHAR) as inShareRecordId,' +
              ' CAST(uuid_from_bin(SA.shareItemId) as CHAR) as shareItemId,SA.shareItemType,SA.alertId,SA.alertName,SA.alertType,SA.averageType,' +
              ' SA.averageValue,SA.operationType,SA.frequencyType,ISH.inShareId,ISH.inShareName ,SA.sharedDataItem,SA.checkTime,SA.startDate, SA.updatedAt, ' +
              ' group_concat(concat(U.firstName,? , U.lastName))  AS name,SA.nextAlertDate ' + columns2 + ' ' +
              ' FROM SharingAlert SA,InShare ISH,OutShare OS,SharingAlertRecipient SAR,users U ' + tables + ' ' +
              ' WHERE SA.accountId = uuid_to_bin(?) AND SA.inShareId = uuid_to_bin(?) AND SA.STATUS=? AND ISH.id = SA.inShareId AND ' +
              ' OS.id = ISH.outShareInstanceId AND SAR.alertId = SA.id AND SAR.TYPE = ? AND U.id = SAR.recipientId  ' +
              ' ' + condition + ' ' +
              ' GROUP BY SA.id ' +
              ' union ' +
              ' SELECT CAST(uuid_from_bin(SA.id) as CHAR) as id,CAST(uuid_from_bin(SA.inShareId) as CHAR) as inShareRecordId,' +
              ' CAST(uuid_from_bin(SA.shareItemId) as CHAR) as shareItemId,SA.shareItemType,SA.alertId,SA.alertName,SA.sharedDataItem,' +
              ' SA.alertType,SA.averageType,SA.averageValue,SA.operationType,SA.frequencyType,ISH.inShareId,ISH.inShareName ,SA.checkTime,SA.startDate, ' +
              ' SA.updatedAt,group_concat(concat(C.firstName,? , C.lastName))  AS name,SA.nextAlertDate ' + columns3 + ' ' +
              ' FROM SharingAlert SA,InShare ISH,OutShare OS,SharingAlertRecipient SAR,contacts C ' + tables + ' ' +
              ' WHERE SA.accountId = uuid_to_bin(?)  AND SA.inShareId = uuid_to_bin(?) AND SA.STATUS=? AND ISH.id = SA.inShareId AND ' +
              ' OS.id = ISH.outShareInstanceId AND SAR.alertId = SA.id AND SAR.TYPE = ? AND C.inviteeUUID = SAR.recipientId ' +
              ' AND C.inviterUUID = uuid_to_bin(?) ' + condition + ' ' +
              ' GROUP BY SA.id ' +
              ' union ' +
              ' SELECT CAST(uuid_from_bin(SA.id) as CHAR) as id,CAST(uuid_from_bin(SA.inShareId) as CHAR) as inShareRecordId,' +
              ' CAST(uuid_from_bin(SA.shareItemId) as CHAR) as shareItemId,SA.shareItemType,SA.alertId,SA.alertName,SA.sharedDataItem,' +
              ' SA.alertType,SA.averageType,SA.averageValue,SA.operationType,SA.frequencyType,ISH.inShareId,ISH.inShareName ,SA.checkTime,SA.startDate, ' +
              ' SA.updatedAt,G.name AS name,SA.nextAlertDate ' + columns3 + ' ' +
              ' FROM SharingAlert SA,InShare ISH,OutShare OS,SharingAlertRecipient SAR,groups G ' + tables + ' ' +
              ' WHERE SA.accountId = uuid_to_bin(?)  AND SA.inShareId = uuid_to_bin(?) AND SA.STATUS=? AND ISH.id = SA.inShareId AND ' +
              ' OS.id = ISH.outShareInstanceId AND SAR.alertId = SA.id AND SAR.TYPE = ? AND G.id = SAR.recipientId ' +
              ' ' + condition + ' GROUP BY SA.id )t1 GROUP BY t1.id ) ' +
              ' SELECT * FROM recipient;', [' ', accountId, inShareId, Constants.ALERT_STATUS.ACTIVE, Constants.ALERT_RECIPIENT_TYPE.USERS,
                ' ', accountId, inShareId, Constants.ALERT_STATUS.ACTIVE, Constants.ALERT_RECIPIENT_TYPE.CONTACTS, userId,
                accountId, inShareId, Constants.ALERT_STATUS.ACTIVE, Constants.ALERT_RECIPIENT_TYPE.GROUPS]);

            /*var inShareAlerts = await conn.query('SELECT CAST(uuid_from_bin(SA.id) as CHAR) as id,' +
              ' CAST(uuid_from_bin(SA.inShareId) as CHAR) as inShareId,CAST(uuid_from_bin(SA.shareItemId) as CHAR) as shareItemId,' +
              ' SA.sharedDataItem,SA.alertType,SA.averageType,SA.averageValue,SA.frequencyType, ISH.inShareId,ISH.inShareName,' +
              ' PI.SKU,PI.locationId,SA.updatedAt ' +
              ' FROM SharingAlert SA,InShare ISH,OutShare OS,ProductInventory PI WHERE SA.accountId = uuid_to_bin(?)  AND ' +
              ' SA.inShareId = uuid_to_bin(?) AND SA.status=? AND ISH.id = SA.inShareId AND OS.id = ISH.outShareInstanceId AND ' +
              ' PI.accountId = OS.accountId AND PI.id = SA.shareItemId ', [accountId, inShareId, Constants.ALERT_STATUS.ACTIVE]);*/
            if (!inShareAlerts || inShareAlerts.length < 1) {
                inShareAlerts = [];
            }
            return cb(null, inShareAlerts);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.GET_IN_SHARE_ALERT_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    /*
    * GET IN_SHARE ALERTS
    * */
    getInShareAlertByItemType: async function (options, errorOptions, cb) {
        var accountId = options.accountId;
        var userId = options.userId;
        var shareItemType = options.shareItemType;
        var err;

        if (DataUtils.isUndefined(shareItemType)) {
            err = new Error(ErrorConfig.MESSAGE.SHARE_ITEM_TYPE_REQUIRED);
        } else if (Object.values(Constants.OUT_SHARE_INSTANCE_ITEM_TYPE).indexOf(shareItemType) === -1) {
            err = new Error(ErrorConfig.MESSAGE.INVALID_SHARE_ITEM_TYPE);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var response = await InShare.getQueryForAlertShareItemType({shareItemType: shareItemType});
            debug('response', response);
            var columns1 = response.columns1;
            var columns2 = response.columns2;
            var columns3 = response.columns3;
            var tables = response.tables;
            var condition = response.condition;

            var conn = await connection.getConnection();
            var inShareAlerts = await conn.query('WITH recipient AS( SELECT t1.id,t1.inShareRecordId,t1.sharedDataItem,t1.frequencyType,' +
              ' t1.shareItemId,t1.alertType,t1.averageType,t1.averageValue,t1.operationType,t1.inShareId,t1.shareItemType,t1.alertId,' +
              ' t1.alertName,t1.inShareName,t1.checkTime,t1.startDate,t1.updatedAt,group_concat(t1.NAME) AS name,' +
              ' t1.nextAlertDate ' + columns1 + ' FROM ( ' +
              ' SELECT CAST(uuid_from_bin(SA.id) as CHAR) as id,CAST(uuid_from_bin(SA.inShareId) as CHAR) as inShareRecordId,' +
              ' CAST(uuid_from_bin(SA.shareItemId) as CHAR) as shareItemId,SA.shareItemType,SA.alertId,SA.alertName,SA.alertType,SA.averageType,' +
              ' SA.averageValue,SA.operationType,SA.frequencyType,ISH.inShareId,ISH.inShareName ,SA.sharedDataItem,SA.checkTime,SA.startDate, SA.updatedAt, ' +
              ' group_concat(concat(U.firstName,? , U.lastName))  AS name,SA.nextAlertDate ' + columns2 + ' ' +
              ' FROM SharingAlert SA,SharingRaisedAlert SRA,InShare ISH,OutShare OS,SharingAlertRecipient SAR,users U ' + tables + ' ' +
              ' WHERE SA.id = SRA.alertId AND SRA.isRead = ? AND SRA.recipientId = uuid_to_bin(?) ' +
              ' AND SA.STATUS=? AND ISH.id = SA.inShareId AND ' +
              ' OS.id = ISH.outShareInstanceId AND SAR.alertId = SA.id AND SAR.TYPE = ? AND U.id = SAR.recipientId ' +
              ' ' + condition + ' ' +
              ' GROUP BY SA.id ' +
              ' union ' +
              ' SELECT CAST(uuid_from_bin(SA.id) as CHAR) as id,CAST(uuid_from_bin(SA.inShareId) as CHAR) as inShareRecordId,' +
              ' CAST(uuid_from_bin(SA.shareItemId) as CHAR) as shareItemId,SA.shareItemType,SA.alertId,SA.alertName,SA.sharedDataItem,' +
              ' SA.alertType,SA.averageType,SA.averageValue,SA.operationType,SA.frequencyType,ISH.inShareId,ISH.inShareName ,SA.checkTime,SA.startDate, ' +
              ' SA.updatedAt,group_concat(concat(C.firstName,? , C.lastName))  AS name,SA.nextAlertDate ' + columns3 + ' ' +
              ' FROM SharingAlert SA,SharingRaisedAlert SRA,InShare ISH,OutShare OS,SharingAlertRecipient SAR,contacts C ' + tables + ' ' +
              ' WHERE SA.id = SRA.alertId AND SRA.isRead = ? AND SRA.recipientId = uuid_to_bin(?) ' +
              ' AND SA.STATUS=? AND ISH.id = SA.inShareId AND OS.id = ISH.outShareInstanceId AND SAR.alertId = SA.id AND SAR.TYPE = ? ' +
              ' AND C.inviteeUUID = SAR.recipientId AND C.inviterUUID = SA.createdBy ' + condition + ' ' +
              ' GROUP BY SA.id ' +
              ' union ' +
              ' SELECT CAST(uuid_from_bin(SA.id) AS CHAR) AS id, CAST(uuid_from_bin(SA.inShareId) AS CHAR) AS inShareRecordId, CAST(uuid_from_bin(SA.shareItemId) AS CHAR) AS shareItemId,' +
              ' SA.shareItemType,SA.alertId,SA.alertName,SA.sharedDataItem, SA.alertType,SA.averageType,SA.averageValue,SA.operationType,SA.frequencyType,ISH.inShareId,ISH.inShareName,' +
              ' SA.checkTime,SA.startDate, SA.updatedAt, G.name AS name,SA.nextAlertDate ' + columns3 + ' ' +
              ' FROM SharingAlert SA,SharingRaisedAlert SRA,InShare ISH,OutShare OS,SharingAlertRecipient SAR,groups G ' + tables + ' ' +
              ' WHERE SA.id = SRA.alertId AND SRA.isRead = ? AND SRA.recipientId = uuid_to_bin(?) AND SA.STATUS=? AND ISH.id = SA.inShareId ' +
              ' AND OS.id = ISH.outShareInstanceId AND SAR.alertId = SA.id AND SAR.TYPE = ?  AND G.id = SAR.recipientId ' + condition + ' ' +
              ' GROUP BY SA.id )t1 GROUP BY t1.id ) ' +
              ' SELECT * FROM recipient;', [' ', Constants.RAISED_ALERT_READ_STATUS.UN_READ, userId, Constants.ALERT_STATUS.ACTIVE, Constants.ALERT_RECIPIENT_TYPE.USERS,
                ' ', Constants.RAISED_ALERT_READ_STATUS.UN_READ, userId, Constants.ALERT_STATUS.ACTIVE, Constants.ALERT_RECIPIENT_TYPE.CONTACTS,
                Constants.RAISED_ALERT_READ_STATUS.UN_READ, userId, Constants.ALERT_STATUS.ACTIVE, Constants.ALERT_RECIPIENT_TYPE.GROUPS]);

            /*var inShareAlerts = await conn.query('SELECT CAST(uuid_from_bin(SA.id) as CHAR) as id,' +
              ' CAST(uuid_from_bin(SA.inShareId) as CHAR) as inShareId,CAST(uuid_from_bin(SA.shareItemId) as CHAR) as shareItemId,' +
              ' SA.sharedDataItem,SA.alertType,SA.averageType,SA.averageValue,SA.frequencyType, ISH.inShareId,ISH.inShareName,' +
              ' PI.SKU,PI.locationId,SA.updatedAt ' +
              ' FROM SharingAlert SA,InShare ISH,OutShare OS,ProductInventory PI WHERE SA.accountId = uuid_to_bin(?)  AND ' +
              ' SA.inShareId = uuid_to_bin(?) AND SA.status=? AND ISH.id = SA.inShareId AND OS.id = ISH.outShareInstanceId AND ' +
              ' PI.accountId = OS.accountId AND PI.id = SA.shareItemId ', [accountId, inShareId, Constants.ALERT_STATUS.ACTIVE]);*/
            if (!inShareAlerts || inShareAlerts.length < 1) {
                inShareAlerts = [];
            }
            return cb(null, inShareAlerts);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.GET_IN_SHARE_ALERT_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    /*
    * Update the recipient by update with status = in_active
    * */
    deleteAlertRecipient: function (options) {
        return new Promise(async function (resolve, reject) {
            var id = options.id;
            var accountId = options.accountId;
            var userId = options.userId;
            var currentTime = DataUtils.getEpochMSTimestamp();

            try {
                var conn = await connection.getConnection();
                var updateResponse = await conn.query('update SharingAlertRecipient set status=?,updatedAt=?,updatedBy=uuid_to_bin(?) where ' +
                  'alertId=uuid_to_bin(?)', [Constants.ALERT_RECIPIENT_STATUS.IN_ACTIVE, currentTime, userId, id]);
                updateResponse = Utils.isAffectedPool(updateResponse);
                if (!updateResponse) {
                    throw err;
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.DELETE_IN_SHARE_ALERT_RECIPIENT_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
    * DELETE IN_SHARE ALERT API
    * */
    deleteInShareAlert: async function (options, auditOptions, errorOptions, cb) {
        var accountId = options.accountId;
        var userId = options.userId;
        var id = options.id;
        var updatedAt = options.updatedAt;
        var currentTime = DataUtils.getEpochMSTimestamp();
        var err;

        if (DataUtils.isUndefined(id)) {
            err = new Error(ErrorConfig.MESSAGE.IN_SHARE_ALERT_ID_REQUIRED);
        } else if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_MUST_BE_NUMBER);
        } else if (updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_INVALID);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var deleteResponse = await conn.query('' +
              ' IF (SELECT 1 from SharingAlert where accountId=uuid_to_bin(?) and id=uuid_to_bin(?) and status=?) is null then ' +
              ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "IN_SHARE_ALERT_NOT_EXIST",MYSQL_ERRNO = 4001; ' +
              ' ELSEIF (SELECT 1 from SharingAlert where accountId=uuid_to_bin(?) and id=uuid_to_bin(?) and status=? ' +
              ' and updatedAt=? ) is null then ' +
              ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "IN_SHARE_ALERT_UPDATED_SINCE_YOU_LAST_RETRIEVE",MYSQL_ERRNO = 4002; ' +
              ' ELSE update SharingAlert set status = ?, updatedAt=?, updatedBy=uuid_to_bin(?) where accountId=uuid_to_bin(?) ' +
              ' and id=uuid_to_bin(?);END IF;', [accountId, id, Constants.ALERT_STATUS.ACTIVE, accountId, id, Constants.ALERT_STATUS.ACTIVE,
                updatedAt, Constants.ALERT_STATUS.IN_ACTIVE, currentTime, userId, accountId, id]);
            deleteResponse = Utils.isAffectedPool(deleteResponse);
            if (!deleteResponse) {
                throw err;
            }

            // update the sharing alert recipient
            var updateRecipientOption = {
                id: id,
                userId: userId
            };
            var updateRecipientResponse = await InShare.deleteAlertRecipient(updateRecipientOption);
            debug('updateRecipientResponse', updateRecipientResponse);
            // Create audit log
            await AuditUtils.create(auditOptions);

            return cb(null, {
                OK: Constants.SUCCESS_MESSAGE.IN_SHARE_ALERT_DELETED_SUCCESSFULLY
            });
        } catch (err) {
            debug('err', err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.IN_SHARE_ALERT_NOT_EXIST);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno === 4002) {
                err = new Error(ErrorConfig.MESSAGE.IN_SHARE_ALERT_UPDATED_SINCE_YOU_LAST_RETRIEVE);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
            } else {
                err = new Error(ErrorConfig.MESSAGE.DELETE_IN_SHARE_ALERT_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    /*
    * GET IN_SHARE ALERTS where nextAlertTime <= currentTime (calling from cron job)
    * */
    getInShareAlerts: function (options) {
        return new Promise(async function (resolve, reject) {
            var currentTime = DataUtils.getEpochMSTimestamp();
            var status = Constants.ALERT_STATUS.ACTIVE;

            try {
                var conn = await connection.getConnection();
                var sharingAlert = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id,CAST(uuid_from_bin(accountId) as CHAR) as accountId,' +
                  ' CAST(uuid_from_bin(inShareId) as CHAR) as inShareId,CAST(uuid_from_bin(shareItemId) as CHAR) as shareItemId,' +
                  ' sharedDataItem,shareItemType,alertName,alertType,averageType,averageValue,operationType,frequencyType,nextAlertDate,status,' +
                  ' CAST(uuid_from_bin(createdBy) as CHAR) as userId from SharingAlert where status = ? AND nextAlertDate <= ?',
                  [status, currentTime]);
                if (!sharingAlert) {
                    sharingAlert = [];
                }
                return resolve(sharingAlert);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.GET_IN_SHARE_ALERT_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
    * Get Data protection options form inShareId
    * */
    getDataProtectionOption: function (options) {
        return new Promise(async function (resolve, reject) {
            var inShareId = options.inShareId;
            var err;
            try {
                var conn = await connection.getConnection();
                var outShare = await conn.query('SELECT OS.dataProtectionOption FROM InShare ISH,OutShare OS ' +
                  ' WHERE ISH.id = uuid_to_bin(?) AND OS.id = ISH.outShareInstanceId ;', [inShareId]);
                outShare = Utils.filteredResponsePool(outShare);
                return resolve(outShare);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
    * Check and raise the sharing alert
    * */
    checkAndRaiseAlert: async function (options, errorOptions, cb) {
        var sharingAlert = options.sharingAlert;
        var id = sharingAlert.id;
        var accountId = sharingAlert.accountId;
        var userId = sharingAlert.userId;
        var averageType = sharingAlert.averageType;
        var alertName = sharingAlert.alertName;
        var inShareId = sharingAlert.inShareId;
        var shareItemId = sharingAlert.shareItemId;
        var shareItemType = sharingAlert.shareItemType;
        var sharedDataItem = sharingAlert.sharedDataItem;
        var nextAlertDate = sharingAlert.nextAlertDate;
        var frequencyType = sharingAlert.frequencyType;
        var operationType = parseInt(sharingAlert.operationType);
        var averageValue = parseInt(sharingAlert.averageValue);
        debug('averageValue', averageValue);
        var raisedAlertsList = [], sharedQuantity = 0, sharedQuantityUoM = '';
        var index, raiseAlert = false, message = '', isCheck = true;

        try {

            /*
            * Get DataProtectionOption , if inShare is encrypted then we don't do checking for this
            * */
            var getDataProtectionOption = {
                inShareId: inShareId
            };
            var outShare = await InShare.getDataProtectionOption(getDataProtectionOption);
            if (outShare && outShare.dataProtectionOption !== Constants.SHARING_DATA_PROTECTION_OPTION.UNENCRYPTED) {
                return cb(null, Constants.OK_MESSAGE);
            }

            /*
            * FIND AVERAGE IF TYPE IS MOVING
            * */
            if (averageType === Constants.ALERT_AVERAGE_TYPE.MOVING) {
                debug('Inside if averageType===========================');
                var findAverageValueOption = {
                    averageValue: averageValue,
                    inShareId: inShareId,
                    shareItemType: shareItemType,
                    sharedDataItem: sharedDataItem
                };
                var averageResponse = await InShare.findMovingAverage(findAverageValueOption);
                debug('averageResponse', averageResponse);
                averageValue = parseInt(averageResponse.average);
                isCheck = averageResponse.isCheck;
                debug('averageValue', averageValue);
            }

            /*
            * IF SHARED_DATA_ITEM < AVERAGE OF LAST SHARED RECORD THEN RAISE ALERT
            * */
            var getLastRecordOption = {
                inShareId: inShareId,
                shareItemId: shareItemId
            };
            debug('getLastRecordOption', getLastRecordOption);
            var lastSharedRecord = await InShare.getLastSharedRecord(getLastRecordOption);
            debug('lastSharedRecord', lastSharedRecord);

            if ((lastSharedRecord && DataUtils.isDefined(lastSharedRecord.data)) || !isCheck) {
                var sharedData = lastSharedRecord.data.toString().split(',');
                debug('sharedData', sharedData);

                // Get index of sharedDataItems
                var getIndexOption = {
                    shareItemType: shareItemType,
                    sharedDataItem: sharedDataItem
                };
                debug('getIndexOption', getIndexOption);
                index = InShare.getIndexOfSharedDataItem(getIndexOption);
                debug('index', index);

                // compare the average and quantity
                debug('sharedData[index]', sharedData[index]);
                debug('sharedData[index]', parseInt(sharedData[index]).toString() === 'NaN');
                if (parseInt(sharedData[index]).toString() === 'NaN') {
                    debug('inside if');
                    sharedQuantity = parseInt(sharedData[index].toString().substr(1).slice(0, -1));
                } else {
                    debug('inside else');
                    sharedQuantity = parseInt(sharedData[index]);
                }
                sharedQuantityUoM = sharedData[index + 1].toString().substr(1).slice(0, -1);

                debug('sharedQuantity', sharedQuantity);
                debug('sharedQuantityUoM', sharedQuantityUoM);
                debug('averageValue', averageValue);

                // RAISE ALERT shared qty is falls below X
                if ((operationType === Constants.ALERT_OPERATION_TYPE.LESS_THAN) && (sharedQuantity < averageValue)) {
                    debug('BELOW X');
                    message = 'less';
                    raiseAlert = true;
                }
                // RAISE ALERT shared qty is increase above X
                if ((operationType === Constants.ALERT_OPERATION_TYPE.GREATER_THAN) && (sharedQuantity > averageValue)) {
                    debug('ABOVE X');
                    message = 'greater';
                    raiseAlert = true;
                }

                if (raiseAlert) {
                    /*
                    * GET ALL RECIPIENT
                    * */
                    var getAllRecipientOption = {
                        alertId: id
                    };
                    debug('getAllRecipientOption', getAllRecipientOption);
                    var recipients = await InShare.getAllRecipients(getAllRecipientOption);
                    debug('recipients', recipients);

                    if (recipients.length > 0) {
                        /*
                       * CREATE ALERT RECORD
                       * */
                        await Promise.each(recipients, function (recipient) {
                            var generatedId = Utils.generateId();
                            var currentTime = DataUtils.getEpochMSTimestamp();
                            var sharingRaisedAlert = {
                                id: generatedId.uuid,
                                recipientId: recipient.id,
                                alertId: id,
                                shareItemType: shareItemType,
                                createdAt: currentTime,
                                updatedAt: currentTime
                            };
                            raisedAlertsList.push(sharingRaisedAlert);
                        });
                        var createRaisedAlertOption = {
                            raisedAlertsList: raisedAlertsList
                        };
                        var createRaisedAlertResponse = await InShare.createSharingRaisedAlert(createRaisedAlertOption);
                        debug('createRaisedAlertResponse', createRaisedAlertResponse);

                        /*
                        * NOTIFY RECIPIENTS
                        * */
                        var notifyRecipientOption = {
                            recipients: recipients,
                            userId: userId,
                            alertId: id,
                            message: message,
                            shareItemType: shareItemType,
                            alertName: alertName,
                            averageValue: averageValue,
                            sharedQuantity: sharedQuantity,
                            sharedQuantityUoM: sharedQuantityUoM
                        };
                        var notifyRecipientResponse = await InShare.notifyRecipients(notifyRecipientOption);
                        debug('notifyRecipientResponse', notifyRecipientResponse);
                    }
                }
            }

            /*
            * UPDATE nextAlertDate
            * */
            // Find nextAlertDate
            var newNextAlertDate = await InShare.calculateNextAlertDate({
                frequencyType: frequencyType,
                startDate: nextAlertDate,
                skipFlag: true
            });

            var updateAlertOption = {
                nextAlertDate: newNextAlertDate,
                userId: userId,
                inShareId: inShareId
            };
            var updateAlertResponse = await InShare.updateInShareAlertRecords(updateAlertOption);
            debug('updateAlertResponse', updateAlertResponse);

            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err', err);
            ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.SHARING_ALERT_CHECK_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    /*
    * insert multiple sharing Raised Alert
    * */
    createSharingRaisedAlert: function (options) {
        return new Promise(async function (resolve, reject) {
            var raisedAlertsList = options.raisedAlertsList;
            var convertedRaisedAlertList, keys, err;
            var currentTime = DataUtils.getEpochMSTimestamp();

            await Utils.convertObjectToArrayMD(raisedAlertsList, async function (err, response) {
                if (err) {
                    debug('err', err);
                    return reject(err);
                }
                convertedRaisedAlertList = response.list;
                keys = response.keys;


                var query = 'insert into SharingRaisedAlert (' + keys + ') values';

                var values = ' (uuid_to_bin(?), uuid_to_bin(?),uuid_to_bin(?),?,?,?) ';

                await Promise.each(raisedAlertsList, function (value) {
                    query = query + values;
                    query = query + ',';
                });

                query = query.replace(/,\s*$/, '');

                try {
                    var conn = await connection.getConnection();
                    var RaisedAlertInserted = await conn.query(query, convertedRaisedAlertList);
                    RaisedAlertInserted = Utils.isAffectedPool(RaisedAlertInserted);
                    debug('RaisedAlertInserted-----------------------------------------', RaisedAlertInserted);
                    if (!RaisedAlertInserted) {
                        throw err;
                    }
                    return resolve(Constants.OK_MESSAGE);
                } catch (err) {
                    debug('err ', err);
                    err = new Error(ErrorConfig.MESSAGE.SHARED_RAISED_ALERT_CREATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
            });
        });
    },

    /*
    * Send alert on call
    * */
    sendSharingAlertSMS: function (options) {
        return new Promise(function (resolve, reject) {
            var mobile = options.mobile;
            var message = options.message;
            var err;

            try {
                TwilioUtils.sendSMS(mobile, TwilioConfig.FROM, message, function (err) {
                    if (err) {
                        debug('err', err);
                        err = new Error(ErrorConfig.MESSAGE.SMS_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        return reject(err);
                    }
                    return resolve(Constants.OK_MESSAGE);
                });
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.SMS_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
    * Send notification / sms / email to the recipients
    * */
    notifyRecipients: function (options) {
        return new Promise(async function (resolve, reject) {
            var recipients = options.recipients;
            var shareItemType = parseInt(options.shareItemType);
            var alertName = options.alertName;
            var message = options.message;
            var averageValue = options.averageValue;
            var sharedQuantity = options.sharedQuantity;
            var sharedQuantityUoM = options.sharedQuantityUoM;
            var userId = options.userId;
            var alertId = options.alertId;

            try {
                // Get all recipients firstName,lastName,email,mobileNumber
                var getRecipientsDetailOption = {
                    recipients: recipients
                };
                var recipientsResponse = await InShare.getSharingAlertNotificationPreference(getRecipientsDetailOption);

                // Get inviter
                var inviter = await Customer.getUserById({userId: userId});

                await Promise.each(recipientsResponse, async function (recipient) {
                    var sharingAlertFlag = JSON.parse(recipient.sharingAlertFlag);

                    // Send notification
                    if (sharingAlertFlag.notification === 1) {
                        var NotificationApi = require('../api/notification');
                        var notificationRefereType;
                        var date = new Date();
                        var notificationExpirationDate = date.setDate(date.getDate() + Constants.INVITATION_EXPIRATION_DATE_LIMIT);
                        notificationExpirationDate = new Date(notificationExpirationDate);
                        if (shareItemType === Constants.SHARING_TYPE.productInventory) {
                            notificationRefereType = Constants.NOTIFICATION_REFERE_TYPE.PRODUCT_INVENTORY_SHARING_ALERT;
                        } else if (shareItemType === Constants.SHARING_TYPE.supplyInventory) {
                            notificationRefereType = Constants.NOTIFICATION_REFERE_TYPE.SUPLLY_INVENTORY_SHARING_ALERT;
                        } else if (shareItemType === Constants.SHARING_TYPE.productOrder) {
                            notificationRefereType = Constants.NOTIFICATION_REFERE_TYPE.PRODUCT_ORDER_SHARING_ALERT;
                        } else if (shareItemType === Constants.SHARING_TYPE.dependentDemand) {
                            notificationRefereType = Constants.NOTIFICATION_REFERE_TYPE.DEPENDENT_DEMAND_SHARING_ALERT;
                        }

                        var notificationOption = {
                            refereId: alertId,
                            user_ids: [recipient.id],
                            topic_id: userId,
                            refereType: notificationRefereType,
                            notification_reference: NotificationReferenceData.SHARING_ALERT,
                            notificationExpirationDate: notificationExpirationDate,
                            paramasDateTime: new Date(),
                            paramsAlertName: alertName,
                            paramsAverageValue: averageValue,
                            paramsAverageValueUoM: sharedQuantityUoM,
                            paramsThreshold: sharedQuantity,
                            paramsThresholdUoM: sharedQuantityUoM,
                            paramsOperationType: message,
                            paramsInviter: inviter.email + ', ' +
                              (inviter.firstName ? inviter.firstName : '') + ' ' +
                              (inviter.lastName ? inviter.lastName : ''),
                            paramsInvitee: recipient.email + ', ' +
                              (recipient.firstName ? recipient.firstName : '') + ' ' +
                              (recipient.lastName ? recipient.lastName : ''),
                            metaEmail: 'support@scopehub.org',
                            languageCultureCode: recipient.languageCultureCode,
                            createdBy: userId,
                            type: Constants.DEFAULT_NOTIFICATION_TYPE
                        };
                        debug('notificationOption', notificationOption);
                        await NotificationApi.createMD(notificationOption);
                    }

                    // Send Email
                    if (sharingAlertFlag.email === 1) {
                        var opt = {
                            languageCultureCode: recipient.languageCultureCode,
                            template: Constants.EMAIL_TEMPLATES.SHARING_ALERT,
                            email: recipient.email
                        };

                        var compileOptions = {
                            name: recipient.firstName,
                            alertName: alertName,
                            threshold: sharedQuantity,
                            thresholdUoM: sharedQuantityUoM,
                            averageValue: averageValue,
                            averageValueUoM: sharedQuantityUoM,
                            operationType: message
                        };
                        debug('opt', opt);
                        debug('compileOptions', compileOptions);
                        await EmailUtils.sendEmailPromise(opt, compileOptions);
                    }

                    // Send sms on mobile
                    if (sharingAlertFlag.sms === 1) {
                        var mobile = recipient.primaryMobile;
                        if (mobile && mobile.length > 10) {
                            var sendSMSOption = {
                                mobile: mobile,
                                message: alertName + ' Alert - Shared Quantity ' + sharedQuantity + ' ' + sharedQuantityUoM +
                                  ' is ' + message + ' than alert average ' + averageValue + ' ' + sharedQuantityUoM + '.'
                            };
                            var sendSMSResponse = await InShare.sendSharingAlertSMS(sendSMSOption);
                            debug('sendSMSResponse', sendSMSResponse);
                        }
                    }
                });

                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.RECIPIENT_NOTIFY_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }

        });
    },

    /*
    * query for in () purpose
    * */
    manipulateQueryRecipients: function (options) {
        return new Promise(function (resolve, reject) {
            var recipients = options.recipients;
            var string = '', values = [];

            _.map(recipients, function (recipient) {
                if (recipient.id) {
                    string += 'uuid_to_bin(?),';
                    values.push(recipient.id);
                }
            });
            string = string.replace(/,\s*$/, ' ');
            return resolve({
                string: string,
                values: values
            });
        });
    },

    /*
    * Get Notification Preference for sharing alerts
    * */
    getSharingAlertNotificationPreference: function (options) {
        return new Promise(async function (resolve, reject) {
            var recipients = options.recipients;
            var type = Constants.NOTIFICATION_CATEGORY_TYPE.SHARING_ALERTS;
            var err;
            try {
                var conn = await connection.getConnection();
                var response = await InShare.manipulateQueryRecipients({recipients: recipients});
                var recipientsResponse = await conn.query('SELECT CAST(uuid_from_bin(U.id) as CHAR) as id,U.firstName,U.lastName,' +
                  ' U.email,UP.flag as sharingAlertFlag,U.primaryMobile,U.languageCultureCode FROM users U,userPreferences UP ' +
                  ' WHERE U.status = ? and U.id IN (' + response.string + ') and UP.userId = U.id and UP.type = ?;',
                  [Constants.USER_STATUS.ACTIVE].concat(response.values, [type]));
                debug('recipientsResponse', recipientsResponse);
                if (!recipientsResponse) {
                    recipientsResponse = [];
                }
                return resolve(recipientsResponse);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.GET_ALERT_RECIPIENT_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
    * Get index of sharedDataItems from shared data csv string
    * */
    getIndexOfSharedDataItem: function (options) {
        var shareItemType = parseInt(options.shareItemType);
        var sharedDataItem = parseInt(options.sharedDataItem);
        debug('shareItemType', shareItemType);
        debug('sharedDataItem', sharedDataItem);
        var index;
        if (shareItemType === Constants.SHARING_TYPE.productInventory) {
            debug('Inside shareItemType === Constants.SHARING_TYPE.productInventory');
            if (sharedDataItem === Constants.SHARED_DATA_ITEMS.QTY_ON_HAND) {
                index = Object.values(Constants.SHARED_DATA_FIELDS.PRODUCT_INVENTORY).indexOf('qtyOnHand');
            } else if (sharedDataItem === Constants.SHARED_DATA_ITEMS.QTY_ON_ORDER) {
                index = Object.values(Constants.SHARED_DATA_FIELDS.PRODUCT_INVENTORY).indexOf('qtyOnOrder');
            } else if (sharedDataItem === Constants.SHARED_DATA_ITEMS.QTY_AVAILABLE) {
                index = Object.values(Constants.SHARED_DATA_FIELDS.PRODUCT_INVENTORY).indexOf('qtyAvailable');
            }
        } else if (shareItemType === Constants.SHARING_TYPE.supplyInventory) {
            if (sharedDataItem === Constants.SHARED_DATA_ITEMS.QTY_ON_HAND) {
                index = Object.values(Constants.SHARED_DATA_FIELDS.SUPPLY_INVENTORY).indexOf('qtyOnHand');
            } else if (sharedDataItem === Constants.SHARED_DATA_ITEMS.QTY_IN_TRANSIT) {
                index = Object.values(Constants.SHARED_DATA_FIELDS.SUPPLY_INVENTORY).indexOf('qtyInTransit');
            } else if (sharedDataItem === Constants.SHARED_DATA_ITEMS.QTY_ON_ORDER) {
                index = Object.values(Constants.SHARED_DATA_FIELDS.SUPPLY_INVENTORY).indexOf('qtyOnOrder');
            }
        } else if (shareItemType === Constants.SHARING_TYPE.productOrder) {
            if (sharedDataItem === Constants.SHARED_DATA_ITEMS.ORDER_QUANTITY) {
                index = Object.values(Constants.SHARED_DATA_FIELDS.PRODUCT_ORDER).indexOf('quantityOrdered');
            }
        } else if (shareItemType === Constants.SHARING_TYPE.dependentDemand) {
            if (sharedDataItem === Constants.SHARED_DATA_ITEMS.ORDER_QUANTITY) {
                index = Object.values(Constants.SHARED_DATA_FIELDS.DEPENDENT_DEMAND).indexOf('quantityOrdered');
            }
        }
        return index;
    },

    /*
    * Find the average of type moving
    * */
    findMovingAverage: function (options) {
        return new Promise(async function (resolve, reject) {
            debug('Inside hte findMovingAverage ======');
            var averageValue = parseInt(options.averageValue);
            var inShareId = options.inShareId;
            var shareItemType = options.shareItemType;
            var sharedDataItem = options.sharedDataItem;
            var currentTime = DataUtils.getEpochMSTimestamp();
            var totalQuantity = 0, index;

            try {
                // Deduct averageValue(day) from currentTime
                var newEffectiveFromDate = moment(currentTime).subtract(averageValue, 'days').valueOf();

                // GET shared record of last averageValue days (if averageValue is 50 then get shared data of last 50 days)
                var conn = await connection.getConnection();
                var sharedRecords = await conn.query('SELECT data FROM SharedData SD,InShare ISH WHERE ' +
                  'ISH.id = uuid_to_bin(?) AND SD.outShareInstanceId = ISH.outShareInstanceId AND ' +
                  'SD.inSharePartnerId = ISH.accountId AND SD.effectiveSharedDateTime >= ? ', [inShareId, newEffectiveFromDate]);
                debug('sharedRecords', sharedRecords);
                debug('sharedRecords', sharedRecords.length);

                if (sharedRecords.length < 1) {
                    return resolve({isCheck: false});
                }

                // convert csv data string into array
                _.map(sharedRecords, function (sharedRecord) {
                    sharedRecord.data = sharedRecord.data.toString().split(',');
                });
                debug('sharedRecords', sharedRecords);

                // Get index of sharedDataItems
                var getIndexOption = {
                    shareItemType: shareItemType,
                    sharedDataItem: sharedDataItem
                };
                index = InShare.getIndexOfSharedDataItem(getIndexOption);
                debug('index', index);

                debug('sharedRecords', sharedRecords.length);
                _.map(sharedRecords, function (sharedRecord) {
                    debug('sharedRecord inside map', sharedRecord);
                    debug('sharedRecord[index]', sharedRecord.data[index]);
                    totalQuantity += parseInt(sharedRecord.data[index].toString().substr(1).slice(0, -1));
                });
                debug('totalQuantity ', totalQuantity);
                var average = totalQuantity / sharedRecords.length;
                debug('average', average);

                return resolve({
                    average: average,
                    index: index
                });
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.FIND_MOVING_AVERAGE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
    * Get Last Shared record to check the quantity is below average or not 
    * */
    getLastSharedRecord: function (options) {
        return new Promise(async function (resolve, reject) {
            var inShareId = options.inShareId;
            var shareItemId = options.shareItemId;
            var err;

            try {
                var conn = await connection.getConnection();
                var lastSharedRecord = await conn.query('WITH LastSharedRecord AS ( ' +
                  ' SELECT max(SD1.effectiveSharedDateTime) AS maxEffectiveSharedDateTime FROM SharedData SD1,InShare ISH WHERE ' +
                  ' ISH.id = uuid_to_bin(?) AND SD1.outShareInstanceId = ISH.outShareInstanceId AND SD1.inSharePartnerId = ISH.accountId ' +
                  ' AND SD1.shareItemId = uuid_to_bin(?)) ' +
                  ' SELECT CAST(uuid_from_bin(SD.id) as CHAR) as id,SD.effectiveSharedDateTime,SD.data FROM SharedData SD,InShare ISH ,LastSharedRecord LSR' +
                  ' WHERE ISH.id = uuid_to_bin(?) AND SD.outShareInstanceId = ISH.outShareInstanceId AND SD.inSharePartnerId = ISH.accountId AND ' +
                  ' SD.shareItemId = uuid_to_bin(?) AND SD.effectiveSharedDateTime = LSR.maxEffectiveSharedDateTime;',
                  [inShareId, shareItemId, inShareId, shareItemId]);
                debug('lastSharedRecord', lastSharedRecord);
                lastSharedRecord = Utils.filteredResponsePool(lastSharedRecord);
                return resolve(lastSharedRecord);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.GET_SHARED_DATA_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
    * Get all recipient by alertId
    * */
    getAllRecipients: function (options) {
        return new Promise(async function (resolve, reject) {
            var alertId = options.alertId;
            var err;

            try {
                var conn = await connection.getConnection();

                var recipients = await conn.query('IF exists (SELECT 1 FROM SharingRaisedAlert WHERE alertId = uuid_to_bin(?)) then' +
                  ' SELECT CAST(uuid_from_bin(SAR.recipientId) as CHAR) AS id, COUNT(CASE WHEN SRA.isRead = 0 THEN 1 END) AS cnt ' +
                  ' FROM SharingAlertRecipient SAR,SharingRaisedAlert SRA ' +
                  ' WHERE SAR.alertId = uuid_to_bin(?) AND (SAR.TYPE = ? OR SAR.TYPE = ?) AND SAR.STATUS = ? AND SRA.alertId = SAR.alertId AND ' +
                  ' SRA.recipientId = SAR.recipientId GROUP BY id HAVING cnt = 0 ' +
                  ' UNION' +
                  ' SELECT CAST(uuid_from_bin(GM.memberId) AS CHAR) AS id, COUNT(CASE WHEN SRA.isRead = 0 THEN 1 END) AS cnt' +
                  ' FROM SharingAlertRecipient SAR,SharingRaisedAlert SRA,groupMembers GM,groups G' +
                  ' WHERE SAR.alertId = uuid_to_bin(?) AND SRA.alertId = SAR.alertId AND SRA.recipientId = GM.memberId AND SAR.TYPE = ? AND ' +
                  ' SAR.STATUS = ? AND GM.groupId = SAR.recipientId AND GM.STATUS = ? AND G.id = GM.groupId AND G.isActive = ? ' +
                  ' GROUP BY id HAVING cnt = 0; ' +
                  ' ELSE ' +
                  ' SELECT CAST(uuid_from_bin(recipientId) as CHAR) AS id FROM SharingAlertRecipient WHERE alertId = uuid_to_bin(?) ' +
                  ' AND (TYPE = ? OR TYPE = ?) AND STATUS = ? ' +
                  ' UNION ' +
                  ' SELECT CAST(uuid_from_bin(GM.memberId) as CHAR) AS id FROM SharingAlertRecipient SAR,groupMembers GM,groups G ' +
                  ' WHERE SAR.alertId = uuid_to_bin(?) AND SAR.TYPE = ? AND SAR.STATUS = ? AND GM.groupId = SAR.recipientId ' +
                  ' AND GM.STATUS = ? AND G.id = GM.groupId AND G.isActive = ?;' +
                  ' END IF;',
                  /*var recipients = await conn.query('SELECT uuid_from_bin(SAR.recipientId) AS id,COUNT(case when SRA.isRead = 0 then 1 END) AS cnt ' +
                  ' FROM SharingAlertRecipient SAR,SharingRaisedAlert SRA WHERE SAR.alertId = uuid_to_bin(?) AND (SAR.TYPE = ? OR SAR.TYPE = ?) ' +
                  ' AND SAR.STATUS = ? AND SRA.alertId = SAR.alertId AND SRA.recipientId = SAR.recipientId GROUP BY id HAVING cnt = 0 ' +
                  ' UNION ' +
                  ' SELECT uuid_from_bin(GM.memberId) AS id,COUNT(case when SRA.isRead = 0 then 1 END) AS cnt ' +
                  ' FROM SharingAlertRecipient SAR,SharingRaisedAlert SRA ,groupMembers GM,groups G ' +
                  ' WHERE SAR.alertId = uuid_to_bin(?) AND SRA.alertId = SAR.alertId AND SRA.recipientId = GM.memberId AND ' +
                  ' SAR.TYPE = ? AND SAR.STATUS = ? AND GM.groupId = SAR.recipientId AND GM.STATUS = ? AND ' +
                  ' G.id = GM.groupId AND  G.isActive = ? GROUP BY id HAVING cnt = 0',*/
                  [alertId, alertId, Constants.ALERT_RECIPIENT_TYPE.USERS, Constants.ALERT_RECIPIENT_TYPE.CONTACTS, Constants.ALERT_STATUS.ACTIVE,
                      alertId, Constants.ALERT_RECIPIENT_TYPE.GROUPS, Constants.ALERT_RECIPIENT_STATUS.ACTIVE, Constants.GROUP_MEMBER_STATUS.ACTIVE,
                      Constants.GROUP_STATUS.ACTIVE, alertId, Constants.ALERT_RECIPIENT_TYPE.USERS, Constants.ALERT_RECIPIENT_TYPE.CONTACTS,
                      Constants.ALERT_STATUS.ACTIVE, alertId, Constants.ALERT_RECIPIENT_TYPE.GROUPS, Constants.ALERT_RECIPIENT_STATUS.ACTIVE,
                      Constants.GROUP_MEMBER_STATUS.ACTIVE, Constants.GROUP_STATUS.ACTIVE]);

                /*var recipients = await conn.query('SELECT uuid_from_bin(recipientId) AS id FROM SharingAlertRecipient ' +
                  ' WHERE alertId = uuid_to_bin(?) AND (TYPE = ? OR TYPE = ?) AND STATUS = ? ' +
                  ' UNION ' +
                  ' SELECT uuid_from_bin(GM.memberId) AS id FROM SharingAlertRecipient SAR,groupMembers GM,groups G ' +
                  ' WHERE SAR.alertId = uuid_to_bin(?) AND SAR.type = ? AND SAR.status = ? AND GM.groupId = SAR.recipientId AND GM.STATUS = ? AND ' +
                  ' G.id = GM.groupId AND  G.isActive = ?',*/

                if (!recipients) {
                    recipients = [];
                }
                debug('recipients', recipients[0]);
                return resolve(recipients[0]);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.GET_ALERT_RECIPIENT_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }

        });
    },

    /*
    * Get Raised alert for login user
    * */
    getRaisedAlertCount: async function (options, errorOptions, cb) {
        var userId = options.userId;
        var response = [];
        var err;

        try {
            var conn = await connection.getConnection();
            var getRaisedAlerts = await conn.query('SELECT COUNT(1) AS count,shareItemType from SharingRaisedAlert ' +
              ' where recipientId = uuid_to_bin(?) AND isRead = ? group by shareITemType;',
              [userId, Constants.RAISED_ALERT_READ_STATUS.UN_READ]);
            if (!getRaisedAlerts || getRaisedAlerts.length === 0) {
                response = [
                    {
                        count: 0,
                        shareItemType: 1
                    },
                    {
                        count: 0,
                        shareItemType: 2
                    },
                    {
                        count: 0,
                        shareItemType: 3
                    },
                    {
                        count: 0,
                        shareItemType: 4
                    }
                ];
                return cb(null, response);
            }
            response = response.concat(getRaisedAlerts);
            if (getRaisedAlerts.length < Object.values(Constants.SHARING_TYPE).length) {
                debug('Inside if');
                var shareItemTypes = _.map(getRaisedAlerts, 'shareItemType');
                if (shareItemTypes.indexOf(Constants.SHARING_TYPE.productInventory) === -1) {
                    response.push({
                        shareItemType: 1,
                        count: 0
                    });
                }
                if (shareItemTypes.indexOf(Constants.SHARING_TYPE.supplyInventory) === -1) {
                    response.push({
                        shareItemType: 2,
                        count: 0
                    });
                }
                if (shareItemTypes.indexOf(Constants.SHARING_TYPE.productOrder) === -1) {
                    response.push({
                        shareItemType: 3,
                        count: 0
                    });
                }
                if (shareItemTypes.indexOf(Constants.SHARING_TYPE.dependentDemand) === -1) {
                    response.push({
                        shareItemType: 4,
                        count: 0
                    });
                }
            }
            return cb(null, response);
        } catch (err) {
            debug('err', err);
            ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.GET_RAISED_ALERT_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    /*
    * Update Raised alert as read
    * */
    updateAsReadAlert: async function (options, errorOptions, cb) {
        var accountId = options.accountId;
        var userId = options.userId;
        var shareItemType = options.shareItemType;
        var currentTime = DataUtils.getEpochMSTimestamp();
        var err;

        if (DataUtils.isUndefined(shareItemType)) {
            err = new Error(ErrorConfig.MESSAGE.SHARE_ITEM_TYPE_REQUIRED);
        } else if (Object.values(Constants.SHARING_TYPE).indexOf(shareItemType) === -1) {
            err = new Error(ErrorConfig.MESSAGE.INVALID_SHARE_ITEM_TYPE);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
        try {
            var conn = await connection.getConnection();

            var isUpdate = await conn.query('UPDATE SharingRaisedAlert set isRead=?, updatedAt=? where ' +
              ' recipientId = uuid_to_bin(?) and shareItemType = ? and isRead=?;', [Constants.RAISED_ALERT_READ_STATUS.READ,
                currentTime, userId, shareItemType, Constants.RAISED_ALERT_READ_STATUS.UN_READ]);
            isUpdate = Utils.isAffectedPool(isUpdate);
            debug('isUpdate', isUpdate);
            /*if (!isUpdate) {
                throw err;
            }*/
            return cb(null, {OK: Constants.SUCCESS_MESSAGE.ALERT_MARK_AS_READ_SUCCESSFULLY});
        } catch (err) {
            debug('err', err);
            ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.UPDATE_RAISED_ALERT_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },


    manipulateAlertQuery: function (options) {
        return new Promise(function (resolve, reject) {
            var alertIds = options.alertIds;
            var string = '', values = [];

            _.map(alertIds, function (alert) {
                if (alert) {
                    string += 'uuid_to_bin(?),';
                    values.push(alert);
                }
            });
            string = string.replace(/,\s*$/, ' ');
            return resolve({
                string: string,
                values: values
            });
        });
    },

    /*
    * Update multiple Raised alert as read
    * */
    updateAsReadAlertByIds: async function (options, errorOptions, cb) {
        var userId = options.userId;
        var alertIds = options.alertIds;
        var currentTime = DataUtils.getEpochMSTimestamp();
        var err;

        if (DataUtils.isUndefined(alertIds)) {
            err = new Error(ErrorConfig.MESSAGE.ALERT_IDS_REQUIRED);
        } else if (!DataUtils.isArray(alertIds)) {
            err = new Error(ErrorConfig.MESSAGE.ALERT_IDS_MUST_BE_ARRAY);
        } else if (alertIds.length < 1) {
            err = new Error(ErrorConfig.MESSAGE.ATLEAST_ONE_ALERT_ID_REUQIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
        try {
            var conn = await connection.getConnection();
            var response = await InShare.manipulateAlertQuery({alertIds: alertIds});

            var isUpdate = await conn.query('UPDATE SharingRaisedAlert set isRead=?, updatedAt=? where ' +
              ' recipientId = uuid_to_bin(?) and isRead=? and alertId in (' + response.string + ') ;',
              [Constants.RAISED_ALERT_READ_STATUS.READ, currentTime, userId,
                  Constants.RAISED_ALERT_READ_STATUS.UN_READ].concat(response.values));
            isUpdate = Utils.isAffectedPool(isUpdate);
            return cb(null, {OK: Constants.SUCCESS_MESSAGE.ALERT_MARK_AS_READ_SUCCESSFULLY});
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.UPDATE_RAISED_ALERT_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    /*
    * Validate api request for mapping of shareItems
    * */
    validateMapShareItems: function (options, errorOptions, cb) {
        var mappingIds = options.mappingIds;
        var mapItemType = options.mapItemType;
        var inShareId = options.inShareId;
        var err;

        try {
            if (DataUtils.isUndefined(mapItemType)) {
                err = new Error(ErrorConfig.MESSAGE.MAP_ITEM_TYPE_REQUIRED);
            } else if (Object.values(Constants.MAP_ITEM_TYPES).indexOf(mapItemType) === -1) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_MAP_ITEM_TYPE);
            } else if (DataUtils.isUndefined(inShareId)) {
                err = new Error(ErrorConfig.MESSAGE.IN_SHARE_ID_REQUIRED);
            } else if (DataUtils.isUndefined(mappingIds)) {
                err = new Error(ErrorConfig.MESSAGE.MAPPING_IDS_REQUIRED);
            } else if (!DataUtils.isArray(mappingIds)) {
                err = new Error(ErrorConfig.MESSAGE.MAPPING_IDS_MUST_BE_ARRAY);
            } else if (mappingIds.length < 1) {
                err = new Error(ErrorConfig.MESSAGE.ATLEAST_ONE_MAPPING_ID_REUQIRED);
            } else if (mappingIds.length > 0) {
                _.map(mappingIds, function (mapping) {
                    if (DataUtils.isUndefined(mapping.shareItemId)) {
                        err = new Error(ErrorConfig.MESSAGE.SHARE_ITEM_ID_REQUIRED);
                    } else if (DataUtils.isUndefined(mapping.mapItemId)) {
                        err = new Error(ErrorConfig.MESSAGE.MAP_ITEM_ID_REQUIRED);
                    }
                    if (err) {
                        throw err;
                    }
                });
            }
            if (err) {
                throw err;
            }
            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err', err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
    },

    /*
    * insert multiple map share item record
    * */
    insertMultipleMapShareItem: function (options) {
        return new Promise(async function (resolve, reject) {
            var mappindIdsList = options.mappindIdsList;
            var convertedMappingIdList, keys, err;
            await Utils.convertObjectToArrayMD(mappindIdsList, async function (err, response) {
                if (err) {
                    debug('err', err);
                    return reject(err);
                }
                convertedMappingIdList = response.list;
                keys = response.keys;

                var query = 'insert into ShareItemMapping (' + keys + ') values';

                var values = ' (uuid_to_bin(?),uuid_to_bin(?),uuid_to_bin(?),uuid_to_bin(?),uuid_to_bin(?),?,?,?,?,uuid_to_bin(?))';

                await Promise.each(mappindIdsList, function (value) {
                    query = query + values;
                    query = query + ',';
                });

                query = query.replace(/,\s*$/, '');

                try {
                    var conn = await connection.getConnection();
                    var mapRecordInserted = await conn.query(query, convertedMappingIdList);
                    mapRecordInserted = Utils.isAffectedPool(mapRecordInserted);
                    debug('orderInserted-----------------------------------------', mapRecordInserted);
                    if (!mapRecordInserted) {
                        throw err;
                    }
                    return resolve(Constants.OK_MESSAGE);
                } catch (err) {
                    debug('err ', err);
                    err = new Error(ErrorConfig.MESSAGE.SHARE_ITEM_MAP_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
            });
        });
    },

    /*
    * Map share Items with inshare partners supply or product
    * */
    mapShareItems: async function (options, errorOptions, cb) {
        var userId = options.userId;
        var accountId = options.accountId;
        var mappingIds = options.mappingIds;
        var mapItemType = options.mapItemType;
        var inShareId = options.inShareId;
        var currentTime = DataUtils.getEpochMSTimestamp();
        var err, mappindIdsList = [];

        try {
            _.map(mappingIds, function (map) {
                var generatedId = Utils.generateId();
                var option = {
                    id: generatedId.uuid,
                    accountId: accountId,
                    inShareId: inShareId,
                    shareItemId: map.shareItemId,
                    mapItemId: map.mapItemId,
                    mapItemType: mapItemType,
                    status: 1,
                    createdAt: currentTime,
                    updatedAt: currentTime,
                    createdBy: userId
                };
                mappindIdsList.push(option);
            });

            /*
            * Insert Multiple shareItem mapping
            * */
            var response = await InShare.insertMultipleMapShareItem({mappindIdsList: mappindIdsList});
            debug('response', response);

            return cb(null, {OK: Constants.SUCCESS_MESSAGE.CREATE_SHARE_ITEM_MAPPING_SUCCESS});
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.SHARE_ITEM_MAP_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    /*
    * Get condition based on the
    * */
    getConditionByMapItemType: function (options) {
        return new Promise(function (resolve, reject) {
            var mapItemType = options.mapItemType;
            var columns = '', tables = '', conditions = '';
            /*
            * if mapItemType is products then share items is supply items
            * else if mapItemType is supplyItems then share items is products
            * */
            if (mapItemType === Constants.MAP_ITEM_TYPES.PRODUCTS) {
                columns += ' SIT.sku,SIT.sellerSKUName,';
                tables += ' SupplyItems SIT ,SupplyInventory SIN,';
                conditions += ' SIN.id = SIM.shareItemId AND SIT.id = SIN.supplyItemId AND ';
            } else if (mapItemType === Constants.MAP_ITEM_TYPES.SUPPLY_ITEM) {
                columns += ' PR.sku,PR.sellerSKUName,';
                tables += ' ProductReferences PR ,ProductInventory PIN,';
                conditions += ' PIN.id = SIM.shareItemId AND PR.id = PIN.productRefId AND ';
            }
            return resolve({
                columns: columns,
                tables: tables,
                conditions: conditions
            });
        });
    },

    /*
    * Get mapped share Items with partners
    * */
    getMappedItems: function (options) {
        return new Promise(async function (resolve, reject) {
            var mapItemType = options.mapItemType;
            var mapItemId = options.mapItemId;

            try {
                var response = await InShare.getConditionByMapItemType({mapItemType: mapItemType});
                debug('response', response);
                var conn = await connection.getConnection();
                var mapItems = await conn.query('SELECT CAST(uuid_from_bin(SIM.id) as CHAR) as id,' +
                  ' CAST(uuid_from_bin(SIM.inShareId) as CHAR) as inShareId,CAST(uuid_from_bin(SIM.mapItemType) as CHAR) as mapItemType,' +
                  ' CAST(uuid_from_bin(SIM.mapItemId) as CHAR) as mapItemId,CAST(uuid_from_bin(SIM.shareItemId) as CHAR) as shareItemId,' +
                  ' ' + response.columns + 'concat_ws(", ", U.email, U.firstName) as partner,SIM.updatedAt ' +
                  ' FROM ShareItemMapping SIM , ' + response.tables + ' InShare ISH , OutShare OS, users U WHERE ' +
                  ' SIM.mapItemId = uuid_to_bin(?) AND SIM.mapItemType=? AND SIM.STATUS = ? AND ' + response.conditions + ' ISH.id = SIM.inShareId ' +
                  ' AND OS.id = ISH.outShareInstanceId AND U.id = OS.createdBy;',
                  [mapItemId, mapItemType, Constants.SHARE_ITEM_MAP_STATUS.ACTIVE]);
                if (!mapItems) {
                    mapItems = [];
                }
                return resolve(mapItems);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.GET_MAPPED_SHARE_ITEM_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
    * Get Mapped share Items
    * */
    getMappedShareItems: async function (options, errorOptions, cb) {
        var mapItemType = parseInt(options.mapItemType);
        var mapItemId = options.mapItemId;
        var err;

        if (DataUtils.isUndefined(mapItemType)) {
            err = new Error(ErrorConfig.MESSAGE.MAP_ITEM_TYPE_REQUIRED);
        } else if (DataUtils.isUndefined(mapItemId)) {
            err = new Error(ErrorConfig.MESSAGE.MAP_ITEM_ID_REQUIRED);
        }
        if (err) {
            debug('err', err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var mapItems = await InShare.getMappedItems({mapItemType: mapItemType, mapItemId: mapItemId});
            return cb(null, mapItems);
        } catch (err) {
            debug('err', err);
            ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    /*
    * Validate the mapping
    * */
    validateMappingFields: function (options) {
        var mappingFields = '';
        var mappingOptionalValues = [];

        if (DataUtils.isDefined(options.status)) {
            mappingFields += 'status=? ,';
            mappingOptionalValues.push(options.status);
        }
        if (DataUtils.isDefined(options.mapItemId)) {
            mappingFields += 'mapItemId=uuid_to_bin(?) ,';
            mappingOptionalValues.push(options.mapItemId);
        }
        if (DataUtils.isDefined(options.shareItemId)) {
            mappingFields += 'shareItemId=uuid_to_bin(?) ,';
            mappingOptionalValues.push(options.shareItemId);
        }
        if (DataUtils.isDefined(options.inShareId)) {
            mappingFields += 'inShareId=uuid_to_bin(?) ,';
            mappingOptionalValues.push(options.inShareId);
        }
        return {
            mappingFields: mappingFields,
            mappingOptionalValues: mappingOptionalValues
        };
    },

    /*
    * Get Mapped share Items
    * */
    updateMappedShareItems: async function (options, errorOptions, cb) {
        var userId = options.userId;
        var id = options.id;
        var updatedAt = options.updatedAt;
        var isDelete = options.isDelete;
        var currentDate = DataUtils.getEpochMSTimestamp();
        var mappingFields = '', mappingOptionalValues = [];
        var err;

        if (DataUtils.isUndefined(id)) {
            err = new Error(ErrorConfig.MESSAGE.MAP_ID_REQUIRED);
        } else if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_MUST_BE_NUMBER);
        } else if (updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_INVALID);
        }
        if (err) {
            debug('err', err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            if (isDelete) {
                options.status = Constants.SHARE_ITEM_MAP_STATUS.IN_ACTIVE;
            }
            var response = InShare.validateMappingFields(options);
            mappingFields = response.mappingFields;
            mappingOptionalValues = response.mappingOptionalValues;

            var conn = await connection.getConnection();
            var deleteResponse = await conn.query('IF (select 1 from ShareItemMapping where id=uuid_to_bin(?)) is null then ' +
              ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "MAPPING_NOT_FOUND", MYSQL_ERRNO = 4001; ' +
              ' ELSEIF (select 1 from ShareItemMapping where id=uuid_to_bin(?) and updatedAt=?) is null then ' +
              ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "MAPPING_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002; ' +
              ' ELSE update ShareItemMapping set ' + mappingFields + ' updatedAt = ?,updatedBy = uuid_to_bin(?) where ' +
              ' id=uuid_to_bin(?);END IF;',
              [id, id, updatedAt].concat(mappingOptionalValues, [currentDate, userId, id]));
            deleteResponse = Utils.isAffectedPool(deleteResponse);
            if (!deleteResponse) {
                throw err;
            }
            if (isDelete) {
                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.DELETE_SHARE_ITEM_MAPPING_SUCCESS
                });
            }
            return cb(null, {
                OK: Constants.SUCCESS_MESSAGE.UPDATE_SHARE_ITEM_MAPPING_SUCCESS,
                updatedAt: currentDate
            });
        } catch (err) {
            debug('err', err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.MAPPING_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno === 4002) {
                err = new Error(ErrorConfig.MESSAGE.MAPPING_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
            } else {
                err = new Error(ErrorConfig.MESSAGE.DELETE_MAPPING_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    /*
    * Get Partners(outSharePartners) who shares item with me
    * */
    getOutSharePartners: async function (options, errorOptions, cb) {
        var accountId = options.accountId;
        var err;

        try {
            var conn = await connection.getConnection();
            var partners = await conn.query('SELECT  U.email,U.firstName,CAST(uuid_from_bin(U.id) as CHAR) as partnerUserId' +
              ' FROM InShare INS,OutShare OS,users U WHERE INS.accountId = uuid_to_bin(?) AND ' +
              ' INS.status = ? AND OS.id = INS.outShareInstanceId AND U.id = OS.createdBy group by U.email ;', [accountId, Constants.IN_SHARE_STATUS.ACTIVE]);
            if (!partners) {
                partners = [];
            }
            return cb(null, partners);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.GET_OUT_SHARE_PARTNER_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    /*
    * Get condition based on the
    * */
    getConditionByShareItemType: function (options) {
        return new Promise(function (resolve, reject) {
            var shareItemType = options.shareItemType;
            var columns = '', tables = '', conditions = '';

            if (shareItemType === Constants.SHARING_TYPE.productInventory) {
                columns += ' CAST(uuid_from_bin(PIN.id) as CHAR) as shareItemId,PR.sku,PR.sellerSKUName,LR.locationId,LR.locationName ';
                tables += ' ProductReferences PR , ProductInventory PIN,LocationReference LR, ';
                conditions += ' PIN.id = OSI.shareItemId AND PR.id = PIN.productRefId AND LR.locationId = PIN.locationId ' +
                  ' AND LR.accountId = PIN.accountId ';
            } else if (shareItemType === Constants.SHARING_TYPE.supplyInventory) {
                columns += ' CAST(uuid_from_bin(SIN.id) as CHAR) as shareItemId,SI.sku,SI.sellerSKUName,LR.locationId,LR.locationName ';
                tables += ' SupplyItems SI ,SupplyInventory SIN,LocationReference LR, ';
                conditions += ' SIN.id = OSI.shareItemId AND SI.id = SIN.supplyItemId AND LR.locationId = SIN.locationId ' +
                  ' AND LR.accountId = SIN.accountId';
            } else if (shareItemType === Constants.SHARING_TYPE.productOrder) {
                columns += ' CAST(uuid_from_bin(PR.id) as CHAR) as shareItemId,PR.sku,PR.sellerSKUName ';
                tables += ' ProductReferences PR, ';
                conditions += ' PR.id = OSI.shareItemId ';
            } else if (shareItemType === Constants.SHARING_TYPE.dependentDemand) {
                columns += ' CAST(uuid_from_bin(SI.id) as CHAR) as shareItemId,SI.sku,SI.sellerSKUName ';
                tables += ' SupplyItems SI, ';
                conditions += ' SI.id = OSI.shareItemId ';
            }
            return resolve({
                columns: columns,
                tables: tables,
                conditions: conditions
            });
        });
    },

    /*
    * Get Partners(outSharePartners) who shares item with me
    * */
    getShareItemsByOutSharePartners: async function (options, errorOptions, cb) {
        var accountId = options.accountId;
        var partnerUserId = options.partnerUserId;
        var shareItemList = [];
        var tables = '', columns = '', conditions = '';
        var err;

        if (DataUtils.isUndefined(partnerUserId)) {
            err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_PARTNER_USER_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var shareItemTypes = Object.values(Constants.SHARING_TYPE);
            await Promise.each(shareItemTypes, async function (shareItemType) {
                var response = await InShare.getConditionByShareItemType({shareItemType: shareItemType});
                tables = response.tables;
                columns = response.columns;
                conditions = response.conditions;

                var shareItems = await conn.query('SELECT CAST(uuid_from_bin(INS.id) as CHAR) as inShareId,' +
                  ' ' + columns + ' ' +
                  ' FROM InShare INS,OutShare OS, users U ,' + tables + 'OutShareItems OSI ' +
                  ' WHERE INS.accountId = uuid_to_bin(?) AND INS.STATUS = ? AND U.id = uuid_to_bin(?) AND ' +
                  ' OS.accountId = U.accountId AND OS.id = INS.outShareInstanceId  AND OS.shareItemType = ? ' +
                  ' AND OSI.outShareInstanceId = OS.id AND OSI.STATUS = ? AND  ' + conditions + '',
                  [accountId, Constants.IN_SHARE_STATUS.ACTIVE, partnerUserId, shareItemType, Constants.STATUS.ACTIVE]);

                if (!shareItems) {
                    shareItems = [];
                }
                shareItemList = shareItemList.concat(shareItems);
            });
            return cb(null, shareItemList);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.GET_OUT_SHARE_ITEMS_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    }
};

module.exports = InShare;

