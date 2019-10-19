/* jslint node: true */
'use strict';


var debug = require('debug')('scopehub.api.notification');
var Util = require('util');
var Async = require('async');
var Promise = require('bluebird');
var _ = require('lodash');
var connection = require('../lib/connection_util');

var ContactApi = require('../api/contact');
var SupplierApi = require('../api/supplier');
var CustomerApi = require('../api/customer');
var InShareApi = require('./in_share');
var DataUtils = require('../lib/data_utils');
var Constants = require('../data/constants');
var ErrorConfig = require('../data/error');
var ErrorUtils = require('../lib/error_utils');
var AuditUtils = require('../lib/audit_utils');
var FirebaseUtils = require('../lib/firebase_utils');
var NotificationReferenceData = require('../data/notification_reference');
var TopicDeviceMappingModel = require('../model/topic_device_mapping');
var NotificationReferenceApi = require('../api/notification_reference');
var NOTIFICATION_ATTRIBUTES = ['id', 'notificationReferenceId', 'userData', 'createdAt', 'timestamp', 'params', 'type',
    'meta', 'notificationExpirationDate', 'updatedAt', 'snoozeNextUtcTime'];
var Utils = require('../lib/utils');
var regex = /{(.*?)}/g;
var noop = function () {
}; //

var Notification = {

    /*create: function (options, cb) {
        cb = cb || noop;
        var userIds = options.user_ids;
        var timestamp = (new Date()).getTime();
        var data = options.data;
        var type = options.type || Constants.DEFAULT_NOTIFICATION_TYPE;
        var meta = options.meta;
        var contactId = options.contactId;
        var languageCultureCode = options.languageCultureCode;
        var notificationExpirationDate = options.notificationExpirationDate;

        var userData = {};
        userIds.forEach(function (userId) {
            userData[userId] = {
                read: {
                    value: false
                },
                snooze: {
                    value: false,
                    count: 0
                },
                archive: {
                    value: false
                },
                action: {
                    value: null
                }
            };
        });
        var notificationReferences = NotificationReferenceApi.getAll();
        var notificationReference;
        notificationReferences.some(function (reference) {
            if (reference.meta === options.notification_reference) {
                notificationReference = reference;
                return true;
            }
        });

        if (!notificationReference) {
            var err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_REFERENCE_NOT_FOUND);
            err.status = 417;
            return cb(err);
        }

        var params = {};
        if (notificationReference.description) {
            var text = notificationReference.description;
            var matches = notificationReference.description.match(regex) || [];
            matches.forEach(function (match) {
                match = match.substr(1, match.length - 2);
                var split = match.split('.');
                var parent = split[0];
                var child = split[1];
                if (!child) {
                    params[match] = data[parent];
                } else {
                    params[match] = data[parent] && data[parent][child];
                }
            });
        }

        var notificationOptions = {
            notificationReferenceId: notificationReference.id,
            topicId: options.topic_id,
            userData: userData,
            params: params,
            type: type,
            timestamp: timestamp,
            meta: meta,
            contactId: contactId,
            notificationExpirationDate: notificationExpirationDate,
            partnerId: options.partnerId,
            dataShareId: options.dataShareId
        };
        NotificationModel.create(notificationOptions, function (err, notification) {
            if (err) {
                return cb(err);
            }
            notification = notification.attrs;
            var opt = {
                topicId: options.topic_id
            };
            Notification.getDeviceIds(opt, function (err, deviceIds) {
                if (err) {
                    return cb(err);
                }
                if (!deviceIds || !deviceIds.length) {
                    return cb();
                } else {
                    var devices = [];
                    _.each(deviceIds, function (device) {
                        devices.push(device.deviceId);
                    });
                    opt = {
                        deviceIds: devices,
                        data: notification
                    };
                    if (languageCultureCode) {
                        opt.languageCultureCode = languageCultureCode;
                    } else {
                        opt.languageCultureCode = Constants.DEFAULT_LANGUAGE_CULTURE_CODE;
                    }
                    FirebaseUtils.sendNotification(opt, cb);
                }
            });
        });
    },*/

    createMD: function (options) {
        return new Promise(async function (resolve, reject) {
            var userIds = options.user_ids;
            var type = options.type || Constants.DEFAULT_NOTIFICATION_TYPE;
            var metaEmail = options.metaEmail;
            var metaName = options.metaName;
            var refereId = options.refereId;
            var refereType = options.refereType;
            var languageCultureCode = options.languageCultureCode;
            var paramsInviter = options.paramsInviter;
            var paramsInvitee = options.paramsInvitee;
            var paramasDateTime = options.paramasDateTime;
            var paramsAlertName = options.paramsAlertName || '';
            var paramsAverageValue = options.paramsAverageValue || '';
            var paramsAverageValueUoM = options.paramsAverageValueUoM || '';
            var paramsThreshold = options.paramsThreshold || '';
            var paramsThresholdUoM = options.paramsThresholdUoM || '';
            var paramsOperationType = options.paramsOperationType || '';
            var paramasOtherData = options.paramasOtherData || '';
            var createdBy = options.createdBy;
            var notificationExpirationDate = options.notificationExpirationDate;
            var notificationReference;
            var currentDate = new Date().getTime();

            try {
                var notificationReferences = await NotificationReferenceApi.initMD();

                var conn = await connection.getConnection();
                await Promise.each(notificationReferences, async function (value) {
                    if (value.meta === options.notification_reference) {
                        notificationReference = value;
                    }
                });
                if (!notificationReference) {
                    var err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_REFERENCE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                    throw err;
                }
                var fields = '';
                var values = [];
                if (DataUtils.isDefined(metaName)) {
                    fields = 'metaName = ?,';
                    values.push(metaName);
                }
                await Promise.each(userIds, async function (userId) {

                    var generatedId = Utils.generateId();
                    var id = generatedId.uuid;
                    debug('id', id);

                    paramsInviter = paramsInviter.trim();
                    paramsInvitee = paramsInvitee.trim();

                    var query = 'INSERT INTO Notifications SET id = uuid_to_bin(?),notificationReferenceId = ?,type = ?,' +
                      'userId = uuid_to_bin(?),timestamp = utc_timestamp(3), refereId = uuid_to_bin(?),metaEmail = ?,paramasInviter = ?,' +
                      'paramasInvitee = ?,paramasDateTime = ?,paramsAlertName=?,paramsAverageValue=?,paramsAverageValueUoM=?,' +
                      'paramsThreshold=?,paramsThresholdUoM=?,paramsOperationType=?,paramasOtherData=?,createdBy = uuid_to_bin(?),notificationExpirationDate = ?,' +
                      'refereType = ?,' + fields + 'createdAt = ?,updatedAt = ?';

                    var params = [id, notificationReference.id, type, userId, refereId, metaEmail, paramsInviter, paramsInvitee,
                        paramasDateTime, paramsAlertName, paramsAverageValue, paramsAverageValueUoM, paramsThreshold, paramsThresholdUoM,
                        paramsOperationType, paramasOtherData, createdBy, notificationExpirationDate, refereType].concat(values).concat([currentDate, currentDate]);
                    debug('params', params);
                    var notification = await conn.query(query, params);

                    if (!Utils.isAffectedPool(notification)) {
                        var err = new Error(
                          ErrorConfig.MESSAGE.NOTIFICATION_CREATE_FAILED);
                        throw err;
                    }
                    console.log({id: id, updatedAt: currentDate});

                    var notification = await conn.query('SELECT CAST(uuid_from_bin(id) as CHAR) as id, notificationReferenceId, type, ' +
                      'CAST(uuid_from_bin(userId) as CHAR) as userId, timestamp, CAST(uuid_from_bin(refereId) as CHAR) as refereId,' +
                      'metaEmail, paramasInviter, paramasInvitee,paramsAlertName,paramsAverageValue,paramsAverageValueUoM,' +
                      'paramsThreshold,paramsThresholdUoM,paramsOperationType,paramasOtherData,updatedAt from Notifications WHERE id = uuid_to_bin(?)', [id]);
                    notification = Utils.filteredResponsePool(notification);
                    debug('n4', notification);
                    var deviceIds = await Notification.getDeviceIdsMD({userId: userId});

                    var devices = [];
                    _.each(deviceIds, function (device) {
                        devices.push(device.deviceId);
                    });

                    var opt = {
                        deviceIds: devices,
                        data: notification
                    };

                    if (languageCultureCode) {
                        opt.languageCultureCode = languageCultureCode;
                    } else {
                        opt.languageCultureCode = Constants.DEFAULT_LANGUAGE_CULTURE_CODE;
                    }

                    if (devices.length > 0) {
                        try {
                            await FirebaseUtils.sendNotificationMD(opt);
                            return resolve();
                        } catch (e) {
                            debug(e);
                        }
                    }
                    return resolve();
                });
            } catch (err) {
                debug('err', err);
                reject(err);
            }
        });
    },

    sendNotification: function (options, cb) {
        cb = cb || noop;
        var notification = options.notification;
        var opt = {
            topicId: notification.topicId
        };

        Notification.getDeviceIds(opt, function (err, deviceIds) {
            if (err) {
                return cb(err);
            }
            if (!deviceIds || !deviceIds.length) {
                return cb();
            } else {
                var devices = [];
                _.each(deviceIds, function (device) {
                    devices.push(device.deviceId);
                });
                opt = {
                    deviceIds: devices,
                    data: options.notification
                };
                FirebaseUtils.sendNotification(opt, cb);
            }
        });
    },

    /*getNotifications: function (options, cb) {
        var topicIds = options.topicIds;
        var getMostRecent = options.getMostRecent;
        var startTimestamp = Number(options.timestamp);
        var date;

        var endTimestamp;
        if (!startTimestamp) {
            var err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_TIMESTAMP_REQ);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
        var notifications = [];
        if (getMostRecent == 'true') {
            startTimestamp = startTimestamp - 1;
            Async.eachLimit(topicIds, 5, function (topicId, callback) {
                NotificationModel
                  .query(topicId)
                  .usingIndex(Constants.NOTIFICATION_TOPIC_TIMESTAMP_INDEX)
                  .where('timestamp')
                  .lte(startTimestamp)
                  .descending()
                  .limit(Constants.GET_NOTIFICATIONS.DEFAULT_LIMIT)
                  .attributes(NOTIFICATION_ATTRIBUTES)
                  .exec(function (err, data) {
                      if (err) {
                          return callback(err);
                      }
                      var items = _.map(data.Items, 'attrs');
                      if (items) {
                          notifications = _.concat(notifications, items);
                          //notifications.push.apply(notifications, items);
                      }
                      return callback();
                  });
            }, function (err) {
                return cb(err, notifications);
            });
        } else {
            date = new Date(startTimestamp);
            startTimestamp = date.setDate(date.getDate() - Constants.NOTIFICATION_MAX_NO_OF_DAYS);
            endTimestamp = Number(options.timestamp) - 1;
            startTimestamp = startTimestamp - 1;

            Async.eachLimit(topicIds, 5, function (topicId, callback) {
                NotificationModel
                  .query(topicId)
                  .usingIndex(Constants.NOTIFICATION_TOPIC_TIMESTAMP_INDEX)
                  .where('timestamp')
                  .between(startTimestamp, endTimestamp)
                  .descending()
                  .limit(Constants.GET_NOTIFICATIONS.DEFAULT_LIMIT)
                  .attributes(NOTIFICATION_ATTRIBUTES)
                  .exec(function (err, data) {
                      if (err) {
                          return callback(err);
                      }
                      var items = _.map(data.Items, 'attrs');
                      if (items) {
                          notifications = _.concat(notifications, items);
                          // notifications.push.apply(notifications, items);
                      }
                      return callback();
                  });
            }, function (err) {
                return cb(err, notifications);
            });
        }

    },*/

    getNotificationsMD: async function (options, errorOptions, cb) {
        var getMostRecent = options.getMostRecent;
        var startTimestamp = options.timestamp;
        var count = options.count;
        var userId = options.userId;
        var date, err;

        var endTimestamp;
        if (!startTimestamp) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_TIMESTAMP_REQ);
        } else if (DataUtils.isDefined(getMostRecent) && DataUtils.isUndefined(count)) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_COUNT_REQ);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            return cb(err);
        }
        var resultNotification = [];
        var query, params, notifications;
        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
        try {
            if (getMostRecent === 'true') {
                debug('Inside getMostRecent === true');

                if (count < Constants.GET_NOTIFICATIONS.DEFAULT_LIMIT) {
                    count = Constants.GET_NOTIFICATIONS.DEFAULT_LIMIT;
                }
                /*var query = 'SELECT CAST(uuid_from_bin(id) as CHAR) as id, CAST(uuid_from_bin(userId) as CHAR) as userId, notificationReferenceId, type, timestamp, ' +
                  'CAST(uuid_from_bin(refereId) as CHAR) as refereId, refereType, snoozeCount, snoozeIsSnoozeComplete, snoozeValue, snoozeNextUtcTime, snoozeLastUtcTime,' +
                  'archiveValue, archiveUndoUtcTime, archiveUtcTime, readValue, readUtcTime, actionValue, actionUtcTime, metaName, metaEmail, ' +
                  'paramasInviter, paramasInvitee, paramasDateTime,paramsAlertName,paramsAverageValue,paramsAverageValueUoM,paramsThreshold,' +
                  'paramsThresholdUoM,paramsOperationType,paramasError, paramasOtherDataName, paramasUser, paramasOtherData, updatedAt, notificationExpirationDate ' +
                  'FROM Notifications where ' +
                  'userId = uuid_to_bin(?) and timestamp < ? and archiveValue != 1 and  snoozeValue != 1 and snoozeIsSnoozeComplete != 1 and actionValue = "" ' +
                  'ORDER BY timestamp DESC LIMIT ' + Constants.GET_NOTIFICATIONS.DEFAULT_LIMIT;*/

                query = 'SELECT CAST(uuid_from_bin(id) as CHAR) as id, CAST(uuid_from_bin(userId) as CHAR) as userId, notificationReferenceId, type, timestamp, ' +
                  'CAST(uuid_from_bin(refereId) as CHAR) as refereId, refereType, snoozeCount, snoozeIsSnoozeComplete, snoozeValue, snoozeNextUtcTime, snoozeLastUtcTime,' +
                  'archiveValue, archiveUndoUtcTime, archiveUtcTime, readValue, readUtcTime, actionValue, actionUtcTime, metaName, metaEmail, ' +
                  'paramasInviter, paramasInvitee, paramasDateTime,paramsAlertName,paramsAverageValue,paramsAverageValueUoM,paramsThreshold,' +
                  'paramsThresholdUoM,paramsOperationType,paramasError, paramasOtherDataName, paramasUser, paramasOtherData, updatedAt,createdAt, notificationExpirationDate ' +
                  'FROM Notifications where ' +
                  'userId = uuid_to_bin(?) and timestamp < ? and archiveValue != 1 and (snoozeValue = 0 OR (snoozeValue = 1 and snoozeIsSnoozeComplete = 1)) ' +
                  'ORDER BY timestamp DESC LIMIT ' + count;
                params = [userId, startTimestamp];
                notifications = await conn.query(query, params);
                resultNotification = notifications;
                //debug('resultNotification', resultNotification);
            } else {

                endTimestamp = startTimestamp;
                date = new Date(endTimestamp);
                endTimestamp = date.setDate(date.getDate()) - 1;
                endTimestamp = new Date(endTimestamp);

                date = new Date(startTimestamp);
                startTimestamp = date.setDate(date.getDate() - Constants.NOTIFICATION_MAX_NO_OF_DAYS);
                startTimestamp = startTimestamp - 1;
                startTimestamp = new Date(startTimestamp);

                query = 'SELECT CAST(uuid_from_bin(id) as CHAR) as id, CAST(uuid_from_bin(userId) as CHAR) as userId, notificationReferenceId, type, timestamp, ' +
                  'CAST(uuid_from_bin(refereId) as CHAR) as refereId, refereType, snoozeCount, snoozeIsSnoozeComplete, snoozeValue, snoozeNextUtcTime, snoozeLastUtcTime,' +
                  'archiveValue, archiveUndoUtcTime, archiveUtcTime, readValue, readUtcTime, actionValue, actionUtcTime, metaName, metaEmail, ' +
                  'paramasInviter, paramasInvitee, paramasDateTime,paramsAlertName,paramsAverageValue,paramsAverageValueUoM,paramsThreshold,' +
                  'paramsThresholdUoM,paramsOperationType, paramasError, paramasOtherDataName, paramasUser, paramasOtherData, updatedAt,createdAt, notificationExpirationDate ' +
                  'FROM Notifications where ' +
                  'userId = uuid_to_bin(?) and archiveValue != 1 and  snoozeValue != 1 and snoozeIsSnoozeComplete != 1 and timestamp between ? and ? ' +
                  'ORDER BY timestamp DESC LIMIT ' + Constants.GET_NOTIFICATIONS.DEFAULT_LIMIT;
                params = [userId, startTimestamp, endTimestamp];

                notifications = await conn.query(query, params);
                resultNotification = notifications;
            }

            await Promise.each(resultNotification, async function (value) {
                if (value.snoozeNextUtcTime && value.snoozeNextUtcTime.toISOString() !== Constants.DEFAULT_TIMESTAMP) {

                    var nextUtcTime = new Date(value.snoozeNextUtcTime).getTime();
                    var currentTime = new Date().getTime();
                    if (nextUtcTime <= currentTime) {
                        value.snoozeLastUtcTime = value.snoozeNextUtcTime;
                    }
                }
            });

            if (getMostRecent !== 'true' && resultNotification.length === 0) {
                var oldNotification = await conn.query('SELECT * FROM Notifications WHERE userId = uuid_to_bin(?) ORDER BY timestamp ASC LIMIT 1', [userId]);
                oldNotification = Utils.filteredResponsePool(oldNotification);
                if (new Date(oldNotification.timestamp).getTime() <= new Date(options.timestamp).getTime()) {
                    var data = {lastTimestamp: startTimestamp};
                    return cb(null, data);
                }
            }
            return cb(null, resultNotification);
        } catch (err) {
            console.log('err', err);
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);

            if (err.code) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    getArchiveNotificationsMD: async function (options, errorOptions, cb) {
        var getMostRecent = options.getMostRecent;
        var startTimestamp = options.timestamp;
        var userId = options.userId;
        var date;
        var endTimestamp;
        if (!startTimestamp) {
            var err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_TIMESTAMP_REQ);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            return cb(err);
        }

        var resultNotification = [];
        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
        try {
            await conn.query('START TRANSACTION;');

            if (getMostRecent === 'true') {

                var query = 'SELECT CAST(uuid_from_bin(id) as CHAR) as id, CAST(uuid_from_bin(userId) as CHAR) as userId, notificationReferenceId, type, timestamp, ' +
                  'CAST(uuid_from_bin(refereId) as CHAR) as refereId, refereType, snoozeCount, snoozeIsSnoozeComplete, snoozeValue, snoozeNextUtcTime, snoozeLastUtcTime,' +
                  'archiveValue, archiveUndoUtcTime, archiveUtcTime, readValue, readUtcTime, actionValue, actionUtcTime, metaName, metaEmail, ' +
                  'paramasInviter, paramasInvitee, paramasDateTime, paramasError, paramasOtherDataName, paramasUser, paramasOtherData, updatedAt,createdAt, notificationExpirationDate ' +
                  'FROM Notifications where ' +
                  'userId = uuid_to_bin(?) and timestamp < ? and archiveValue = 1 ' +
                  'ORDER BY timestamp DESC LIMIT ' + Constants.GET_NOTIFICATIONS.DEFAULT_LIMIT;

                var params = [userId, startTimestamp];

                var notifications = await conn.query(query, params);
                resultNotification = notifications;

            } else {

                endTimestamp = startTimestamp;
                date = new Date(endTimestamp);
                endTimestamp = date.setDate(date.getDate()) - 1;
                endTimestamp = new Date(endTimestamp);

                date = new Date(startTimestamp);
                startTimestamp = date.setDate(date.getDate() - Constants.NOTIFICATION_MAX_NO_OF_DAYS);
                startTimestamp = startTimestamp - 1;
                startTimestamp = new Date(startTimestamp);

                var query = 'SELECT CAST(uuid_from_bin(id) as CHAR) as id, CAST(uuid_from_bin(userId) as CHAR) as userId, notificationReferenceId, type, timestamp, ' +
                  'CAST(uuid_from_bin(refereId) as CHAR) as refereId, refereType, snoozeCount, snoozeIsSnoozeComplete, snoozeValue, snoozeNextUtcTime, snoozeLastUtcTime,' +
                  'archiveValue, archiveUndoUtcTime, archiveUtcTime, readValue, readUtcTime, actionValue, actionUtcTime, metaName, metaEmail, ' +
                  'paramasInviter, paramasInvitee, paramasDateTime, paramasError, paramasOtherDataName, paramasUser, paramasOtherData, updatedAt,createdAt, notificationExpirationDate ' +
                  'FROM Notifications where userId = uuid_to_bin(?) and archiveValue = 1 and timestamp between ? and ? ' +
                  'ORDER BY timestamp DESC LIMIT ' + Constants.GET_NOTIFICATIONS.DEFAULT_LIMIT;

                var params = [userId, startTimestamp, endTimestamp];
                var notifications = await conn.query(query, params);
                resultNotification = notifications;
                console.log(resultNotification);
            }

            await Promise.each(resultNotification, async function (value) {
                if (value.snoozeNextUtcTime && value.snoozeNextUtcTime.toISOString() !== Constants.DEFAULT_TIMESTAMP) {
                    var nextUtcTime = new Date(value.snoozeNextUtcTime).getTime();
                    var currentTime = new Date().getTime();
                    if (nextUtcTime <= currentTime) {
                        value.snoozeLastUtcTime = value.snoozeNextUtcTime;
                    }
                }
            });

            if (getMostRecent !== 'true' && resultNotification.length === 0) {

                var oldNotification = await conn.query('SELECT * FROM Notifications WHERE userId = uuid_to_bin(?) ORDER BY timestamp ASC LIMIT 1', [userId]);
                oldNotification = Utils.filteredResponsePool(oldNotification);
                if (new Date(oldNotification.timestamp).getTime() <= new Date(options.timestamp).getTime()) {
                    var data = {lastTimestamp: startTimestamp};
                    return cb(null, data);
                }
            }
            await conn.query('COMMIT;');
            return cb(null, resultNotification);
        } catch (err) {
            await conn.query('ROLLBACK;');
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);

            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    getSnoozeNotificationsMD: async function (options, errorOptions, cb) {
        var userId = options.userId;
        var startTimestamp = options.snoozeNextUtcTime;
        var getMostRecent = options.getMostRecent;
        var date;
        var endTimestamp, defaultLimit;

        if (!startTimestamp) {
            var err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_SNOOZE_NEXT_UTC_TIME_REQ);
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

        var resultNotification = [];
        try {

            if (getMostRecent === 'true') {

                debug('startTimestamp before', startTimestamp);
                date = new Date(startTimestamp);
                debug('date', date);
                debug('date', date.getDate());
                startTimestamp = new Date(date.setDate(date.getDate()) + 1);
                debug('startTimestamp after', startTimestamp);
                defaultLimit = Constants.GET_NOTIFICATIONS.DEFAULT_LIMIT + 1;

                /*var query = 'SELECT CAST(uuid_from_bin(id) as CHAR) as id, CAST(uuid_from_bin(userId) as CHAR) as userId, notificationReferenceId, type, timestamp, ' +
                  'CAST(uuid_from_bin(refereId) as CHAR) as refereId, refereType, snoozeCount, snoozeIsSnoozeComplete, snoozeValue, snoozeNextUtcTime, snoozeLastUtcTime,' +
                  'archiveValue, archiveUndoUtcTime, archiveUtcTime, readValue, readUtcTime, actionValue, actionUtcTime, metaName, metaEmail, ' +
                  'paramasInviter, paramasInvitee, paramasDateTime, paramasError, paramasOtherDataName, paramasUser, paramasOtherData, updatedAt, notificationExpirationDate ' +
                  'FROM Notifications where ' +
                  'userId = uuid_to_bin(?) and snoozeNextUtcTime >= ? and (snoozeValue = 1 or snoozeIsSnoozeComplete = 1) ' +
                  'ORDER BY snoozeNextUtcTime DESC LIMIT ' + defaultLimit;*/

                var query = 'SELECT CAST(uuid_from_bin(id) as CHAR) as id, CAST(uuid_from_bin(userId) as CHAR) as userId, notificationReferenceId, type, timestamp, ' +
                  ' CAST(uuid_from_bin(refereId) as CHAR) as refereId, refereType, snoozeCount, snoozeIsSnoozeComplete, snoozeValue, snoozeNextUtcTime, snoozeLastUtcTime,' +
                  ' archiveValue, archiveUndoUtcTime, archiveUtcTime, readValue, readUtcTime, actionValue, actionUtcTime, metaName, metaEmail, ' +
                  ' paramasInviter, paramasInvitee, paramasDateTime, paramasError, paramasOtherDataName, paramasUser, paramasOtherData, updatedAt,createdAt, notificationExpirationDate ' +
                  ' FROM Notifications where userId = uuid_to_bin(?) and snoozeNextUtcTime >= ? and snoozeValue = 1 and snoozeIsSnoozeComplete = 0 ' +
                  ' ORDER BY snoozeNextUtcTime DESC LIMIT ' + defaultLimit;
                var params = [userId, startTimestamp];

                var notifications = await conn.query(query, params);
                debug('notifications ', notifications.length);
                resultNotification = notifications;
                debug('resultNotification', resultNotification.length);

                if (resultNotification.length > 0 && resultNotification.length < Constants.GET_NOTIFICATIONS.DEFAULT_LIMIT) {
                    var limit = 50 - resultNotification.length + 1;

                    query = 'SELECT CAST(uuid_from_bin(id) as CHAR) as id, CAST(uuid_from_bin(userId) as CHAR) as userId, notificationReferenceId, type, timestamp, ' +
                      ' CAST(uuid_from_bin(refereId) as CHAR) as refereId, refereType, snoozeCount, snoozeIsSnoozeComplete, snoozeValue, snoozeNextUtcTime, snoozeLastUtcTime,' +
                      ' archiveValue, archiveUndoUtcTime, archiveUtcTime, readValue, readUtcTime, actionValue, actionUtcTime, metaName, metaEmail, ' +
                      ' paramasInviter, paramasInvitee, paramasDateTime, paramasError, paramasOtherDataName, paramasUser, paramasOtherData, updatedAt,createdAt, notificationExpirationDate ' +
                      ' FROM Notifications where userId = uuid_to_bin(?) and snoozeNextUtcTime < ? and snoozeValue = 1 and snoozeIsSnoozeComplete = 0 ' +
                      ' ORDER BY snoozeNextUtcTime DESC LIMIT ' + limit;
                    params = [userId, startTimestamp];

                    notifications = await conn.query(query, params);
                    debug('notifications ', notifications.length);
                    //notifications = otifications);

                    resultNotification = resultNotification.concat(notifications);
                    debug('resultNotification', resultNotification.length);
                }
            } else {

                debug('startTimestamp', startTimestamp);
                endTimestamp = startTimestamp;
                date = new Date(endTimestamp);
                endTimestamp = date.setDate(date.getDate()) + 1;
                endTimestamp = new Date(endTimestamp);
                debug('endTimestamp', endTimestamp);

                date = new Date(startTimestamp);
                startTimestamp = date.setDate(date.getDate() - Constants.NOTIFICATION_MAX_NO_OF_DAYS);
                startTimestamp = startTimestamp - 1;
                startTimestamp = new Date(startTimestamp);
                debug('startTimestamp after', startTimestamp);
                defaultLimit = Constants.GET_NOTIFICATIONS.DEFAULT_LIMIT + 1;


                var query = 'SELECT CAST(uuid_from_bin(id) as CHAR) as id, CAST(uuid_from_bin(userId) as CHAR) as userId, notificationReferenceId, type, timestamp, ' +
                  ' CAST(uuid_from_bin(refereId) as CHAR) as refereId, refereType, snoozeCount, snoozeIsSnoozeComplete, snoozeValue, snoozeNextUtcTime, snoozeLastUtcTime,' +
                  ' archiveValue, archiveUndoUtcTime, archiveUtcTime, readValue, readUtcTime, actionValue, actionUtcTime, metaName, metaEmail, ' +
                  ' paramasInviter, paramasInvitee, paramasDateTime, paramasError, paramasOtherDataName, paramasUser, paramasOtherData, updatedAt,createdAt, notificationExpirationDate ' +
                  ' FROM Notifications where userId = uuid_to_bin(?) and snoozeValue = 1 and snoozeIsSnoozeComplete = 0 and snoozeNextUtcTime BETWEEN ? AND ?' +
                  ' ORDER BY snoozeNextUtcTime DESC LIMIT ' + defaultLimit;
                var params = [userId, startTimestamp, endTimestamp];

                var notifications = await conn.query(query, params);
                debug('notifications ', notifications.length);

                resultNotification = notifications;
                debug('resultNotification', resultNotification.length);
            }

            await Promise.each(resultNotification, async function (value) {
                if (value.snoozeNextUtcTime && value.snoozeNextUtcTime.toISOString() !== Constants.DEFAULT_TIMESTAMP) {
                    var nextUtcTime = new Date(value.snoozeNextUtcTime).getTime();
                    var currentTime = new Date().getTime();
                    if (nextUtcTime <= currentTime) {
                        value.snoozeLastUtcTime = value.snoozeNextUtcTime;
                    }
                }
            });

            var nextSnoozTimeStamp, lastNotification, oldNotification;

            if (getMostRecent === 'true') {
                if (resultNotification.length === Constants.GET_NOTIFICATIONS.DEFAULT_LIMIT + 1) {
                    debug('Inside if');

                    lastNotification = resultNotification.pop();
                    debug('lastNotification', lastNotification);

                    return cb(null, {
                        notifications: resultNotification,
                        lastTimestamp: lastNotification.snoozeNextUtcTime
                    });

                } else {
                    debug('Inside else');

                    nextSnoozTimeStamp = resultNotification.length > 0 ? resultNotification[resultNotification.length - 1].snoozeNextUtcTime : startTimestamp;

                    debug('nextSnoozTimeStamp', nextSnoozTimeStamp);

                    oldNotification = await conn.query('SELECT snoozeNextUtcTime FROM Notifications WHERE userId = uuid_to_bin(?) ' +
                      ' and snoozeNextUtcTime < ? and snoozeValue = 1 and snoozeIsSnoozeComplete = 0 ' +
                      ' ORDER BY snoozeNextUtcTime DESC LIMIT 1', [userId, nextSnoozTimeStamp]);
                    //oldNotification = await conn.query('SELECT snoozeNextUtcTime FROM Notifications WHERE userId = uuid_to_bin(?) and snoozeNextUtcTime < ? and (snoozeValue = 1 or snoozeIsSnoozeComplete = 1) ORDER BY snoozeNextUtcTime DESC LIMIT 1', [userId, nextSnoozTimeStamp]);
                    oldNotification = Utils.filteredResponsePool(oldNotification);
                    debug('oldNotification', oldNotification);

                    if (oldNotification) {
                        return cb(null, {
                            notifications: resultNotification,
                            lastTimestamp: oldNotification.snoozeNextUtcTime
                        });
                    } else {
                        return cb(null, {notifications: resultNotification});
                    }
                }
            } else {

                if (resultNotification.length === Constants.GET_NOTIFICATIONS.DEFAULT_LIMIT + 1) {

                    lastNotification = resultNotification.pop();
                    return cb(null, {
                        notifications: resultNotification,
                        lastTimestamp: lastNotification.snoozeNextUtcTime
                    });

                } else {

                    nextSnoozTimeStamp = resultNotification.length > 0 ? resultNotification[resultNotification.length - 1].snoozeNextUtcTime : startTimestamp;

                    //oldNotification = await conn.query('SELECT * FROM Notifications WHERE userId = uuid_to_bin(?) and snoozeNextUtcTime < ? and snoozeValue = 1 and snoozeIsSnoozeComplete = 0 ORDER BY snoozeNextUtcTime DESC LIMIT 1', [userId, nextSnoozTimeStamp]);
                    oldNotification = await conn.query('SELECT * FROM Notifications WHERE userId = uuid_to_bin(?) and ' +
                      ' snoozeNextUtcTime < ? and snoozeValue = 1 and snoozeIsSnoozeComplete = 0 ORDER BY snoozeNextUtcTime ' +
                      ' DESC LIMIT 1', [userId, nextSnoozTimeStamp]);
                    oldNotification = Utils.filteredResponsePool(oldNotification);

                    if (oldNotification) {
                        return cb(null, {
                            notifications: resultNotification,
                            lastTimestamp: oldNotification.snoozeNextUtcTime
                        });
                    } else {
                        return cb(null, {notifications: resultNotification});
                    }
                }
            }
            return cb(null, resultNotification);
        } catch (err) {
            console.log(err);
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);

            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    /*getNotification: function (options, cb) {
        var notificationId = options.notificationId;
        if (!notificationId) {
            var err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        NotificationModel.get(notificationId, {
            ConsistentRead: true
        }, function (err, data) {
            if (err || !data || !data.attrs) {
                err = err || new Error(ErrorConfig.MESSAGE.NOTIFICATION_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
            var notification = data && data.attrs;
            return cb(null, notification);
        });
    },*/

    validateNotificationIds: async function (options, cb) {
        var notificationIds = options.notificationIds;
        var userId = options.userId;
        var err;

        if (DataUtils.isUndefined(notificationIds)) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_IDS_REQUIRED);
        } else if (!DataUtils.isArray(notificationIds)) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_IDS_MUST_BE_ARRAY);
        } else if (notificationIds.length === 0) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_IDS_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
        try {

            await Promise.each(notificationIds, async function (notification) {
                if (DataUtils.isUndefined(notification.notificationId)) {
                    err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_ID_REQUIRED);
                }
                if (!err && DataUtils.isValidateOptionalField(notification.updatedAt)) {
                    err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_UPDATED_AT_REQUIRED);
                }
                if (err) {
                    throw err;
                }
            });
            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
    },

    markAllReadMD: async function (options, auditOptions, errorOptions, cb) {
        var err;
        var notificationIds = options.notificationIds;
        var userId = options.userId;
        var notificationSuccessList = [], notificationConflictList = [];
        debug('userId,', userId);

        try {
            var conn = await connection.getConnection();
            await conn.query('START TRANSACTION');
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        try {
            await Promise.each(notificationIds, async function (value) {
                var notificationId = value.notificationId;
                debug('notificationId', notificationId);
                var updatedAt = value.updatedAt;
                var currentDate = new Date().getTime();
                debug('updatedAt', updatedAt);

                var query = 'UPDATE Notifications SET readValue = true,readUtcTime = utc_timestamp(3),updatedAt = ?,' +
                  ' updatedBy = uuid_to_bin(?) where id = uuid_to_bin(?) and userId = uuid_to_bin(?) and updatedAt = ? ';
                var params = [currentDate, userId, notificationId, userId, updatedAt];

                var updateNotification = await conn.query(query, params);
                debug('Utils.isAffectedPool(updateNotification)', Utils.isAffectedPool(updateNotification));

                if (Utils.isAffectedPool(updateNotification)) {
                    notificationSuccessList.push({
                        notificationId: notificationId,
                        updatedAt: currentDate
                    });
                } else {
                    notificationConflictList.push({
                        notificationId: notificationId,
                        updatedAt: updatedAt
                    });
                }
            });
            /*var params = [currentDate, userId, userId];

            var updateNotification = await conn.query(query, params);
            updateNotification = Utils.isAffectedPool(updateNotification);
            debug('updateNotification', updateNotification);*/
            await conn.query('COMMIT;');
            if (notificationConflictList.length > 0) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_HAS_SYNC_CONFLICT);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                if (notificationSuccessList.length > 0) {
                    err.data = {
                        successMsg: Constants.SUCCESS_MESSAGE.NOTIFICATION_MARK_READ_SUCCESS,
                        success: notificationSuccessList,
                        conflict: notificationConflictList

                    };
                } else {
                    err.data = {
                        success: notificationSuccessList,
                        conflict: notificationConflictList
                    };
                }
                return cb(err);
            }
            var response = {
                OK: Constants.SUCCESS_MESSAGE.NOTIFICATION_MARK_READ_SUCCESS,
                success: notificationSuccessList
            };
            auditOptions.notificationIds = notificationIds;
            AuditUtils.create(auditOptions);
            return cb(err, response);
            /*return cb(null, {
                OK: Constants.SUCCESS_MESSAGE.NOTIFICATION_MARK_READ_SUCCESS
            });*/
        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK;');
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    undoAllReadMD: async function (options, auditOptions, errorOptions, cb) {
        var notificationIds = options.notificationIds;
        var userId = options.userId;
        var err;
        /*if (!notificationIds || !notificationIds.length) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_IDS_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
        try {

            await Promise.each(notificationIds, async function (notification) {

                if (DataUtils.isUndefined(notification.notificationId)) {
                    err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_ID_REQUIRED);
                }

                if (!err && DataUtils.isValidateOptionalField(notification.updatedAt)) {
                    err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_UPDATED_AT_REQUIRED);
                }

                if (err) {
                    throw err;
                }
            });
        } catch (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }*/

        var notificationConflictList = [];
        var notificationSuccessList = [];
        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        try {
            await conn.query('START TRANSACTION');

            await Promise.each(notificationIds, async function (value) {
                var notificationId = value.notificationId;
                var updatedAt = value.updatedAt;
                var currentDate = new Date().getTime();

                var query = 'UPDATE Notifications SET readValue = false,snoozeIsSnoozeComplete = true,' +
                  'updatedAt = ?,updatedBy = uuid_to_bin(?) WHERE id = uuid_to_bin(?) and updatedAt = ? and userId = uuid_to_bin(?)';

                var params = [currentDate, userId, notificationId, updatedAt, userId];

                var updateNotification = await conn.query(query, params);

                if (Utils.isAffectedPool(updateNotification)) {

                    notificationSuccessList.push({
                        notificationId: notificationId,
                        updatedAt: currentDate
                    });

                } else {
                    notificationConflictList.push({
                        notificationId: notificationId,
                        updatedAt: updatedAt
                    });
                }
            });

            await conn.query('COMMIT;');
            AuditUtils.create(auditOptions);

        } catch (err) {

            await conn.query('ROLLBACK;');
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            if (err.code) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }

        if (notificationConflictList.length > 0) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_HAS_SYNC_CONFLICT);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            if (notificationSuccessList.length > 0) {
                err.data = {
                    successMsg: Constants.SUCCESS_MESSAGE.NOTIFICATION_MARK_UNREAD_SUCCESS,
                    success: notificationSuccessList,
                    conflict: notificationConflictList

                };
            } else {
                err.data = {
                    success: notificationSuccessList,
                    conflict: notificationConflictList
                };
            }
            return cb(err);
        }
        var response = {
            OK: Constants.SUCCESS_MESSAGE.NOTIFICATION_MARK_UNREAD_SUCCESS,
            success: notificationSuccessList
        };

        auditOptions.notificationIds = notificationIds;
        AuditUtils.create(auditOptions);
        return cb(err, response);
    },

    manipulateQuery: function (options) {
        return new Promise(function (resolve, reject) {
            var notificationIds = options.notificationIds;
            var string = '', values = [];

            _.map(notificationIds, function (notificationId) {
                if (notificationId) {
                    string += 'uuid_to_bin(?),';
                    values.push(notificationId);
                }
            });
            string = string.replace(/,\s*$/, ' ');
            return resolve({
                string: string,
                values: values
            });
        });
    },

    getAllNotificationsMD: async function (options, errorOptions, cb) {
        var notificationIds = options.notificationIds;

        if (!notificationIds || !notificationIds.length) {
            var err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_IDS_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            return cb(err);
        }
        try {
            var conn = await connection.getConnection();
            var response = await Notification.manipulateQuery({notificationIds: notificationIds});
            debug('response', response.values);

            var notificationList = await conn.query('SELECT CAST(uuid_from_bin(id) as CHAR) as id,CAST(uuid_from_bin(userId) as CHAR) as userId,' +
              'CAST(uuid_from_bin(refereId) as CHAR) as refereId,notificationReferenceId,type,refereType,timestamp,snoozeCount,' +
              'snoozeIsSnoozeComplete,snoozeValue,snoozeNextUtcTime,snoozeLastUtcTime,archiveValue,' +
              'archiveUndoUtcTime,archiveUtcTime,readValue,readUtcTime,actionValue,actionUtcTime,metaName,metaEmail,' +
              'paramasInviter,paramasInvitee,paramasDateTime,paramsAlertName,paramsAverageValue,paramsAverageValueUoM,' +
              'paramsThreshold,paramsThresholdUoM,paramsOperationType,paramasError,paramasOtherDataName,paramasUser,' +
              'paramasOtherData,notificationExpirationDate,createdAt,updatedAt from Notifications where id in (' + response.string + ') ;',
              response.values);
            if (!notificationList) {
                notificationList = [];
            }
            return cb(err, notificationList);
        } catch (err) {
            debug('err', err);
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    markReadMD: async function (options, auditOptions, errorOptions, cb) {
        var userId = options.userId;
        var updatedAt = options.updatedAt;
        var notificationId = options.notificationId;
        var err;


        if (DataUtils.isUndefined(notificationId)) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_ID_REQUIRED);
        }

        if (!err && DataUtils.isValidateOptionalField(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_UPDATED_AT_REQUIRED);
        }

        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('err', err);
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
            var notification = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id,readValue,snoozeNextUtcTime,' +
              'snoozeLastUtcTime,snoozeValue,snoozeIsSnoozeComplete,snoozeCount from ' +
              'Notifications where id = uuid_to_bin(?) and userId = uuid_to_bin(?)', [notificationId, userId]);

            notification = Utils.filteredResponsePool(notification);

            if (!notification) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            var currentUtcTime = new Date().getTime();

            if (notification.snoozeNextUtcTime && notification.snoozeNextUtcTime.toISOString() !== Constants.DEFAULT_TIMESTAMP) {

                var snoozeNextUtcTime = notification.snoozeNextUtcTime.getTime();
                if (snoozeNextUtcTime <= currentUtcTime) {

                    notification.snoozeLastUtcTime = notification.snoozeNextUtcTime;
                    notification.snoozeValue = false;
                    notification.snoozeIsSnoozeComplete = true;
                    notification.snoozeCount = 0;
                }
            }

            var query = 'IF NOT EXISTS (select * from Notifications where id = uuid_to_bin(?) and userId = uuid_to_bin(?) and updatedAt = ?)' +
              'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "NOTIFICATION_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED";' +
              'ELSE UPDATE Notifications SET snoozeLastUtcTime = ?, snoozeValue = ?,snoozeIsSnoozeComplete = ?,snoozeCount = ?,' +
              'readValue = true,readUtcTime = utc_timestamp(3),updatedAt = ?, updatedBy = uuid_to_bin(?) WHERE id = uuid_to_bin(?) and updatedAt = ? and userId = uuid_to_bin(?);end IF';

            var params = [notificationId, userId, updatedAt, notification.snoozeLastUtcTime, notification.snoozeValue, notification.snoozeIsSnoozeComplete, notification.snoozeCount, currentUtcTime, userId, notificationId, updatedAt, userId];

            var updated = await conn.query(query, params);

            if (!Utils.isAffectedPool(updated)) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            AuditUtils.create(auditOptions);
            await conn.query('COMMIT;');
            return cb(null, {
                OK: Constants.SUCCESS_MESSAGE.NOTIFICATION_MARK_READ_SUCCESS,
                notificationId: notificationId,
                updatedAt: currentUtcTime
            });

        } catch (err) {
            console.log(err);
            await conn.query('ROLLBACK;');
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
            } else if (err.code) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    markUnReadMD: async function (options, auditOptions, errorOptions, cb) {
        var userId = options.userId;
        var updatedAt = options.updatedAt;
        var notificationId = options.notificationId;
        var currentDate = new Date().getTime();
        var err;

        if (DataUtils.isUndefined(notificationId)) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_ID_REQUIRED);
        }

        if (!err && DataUtils.isValidateOptionalField(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_UPDATED_AT_REQUIRED);
        }

        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('err', err);
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
            var query = '' +
              'IF NOT EXISTS(select 1 from Notifications where id = uuid_to_bin(?) and userId = uuid_to_bin(?))' +
              'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "NOTIFICATION_NOT_FOUND";' +
              'ELSEIF NOT EXISTS(select 1 from Notifications where id = uuid_to_bin(?) and userId = uuid_to_bin(?) and updatedAt = ?)' +
              'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4002,MESSAGE_TEXT = "NOTIFICATION_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED";' +
              'ELSE UPDATE Notifications SET snoozeIsSnoozeComplete = true,timestamp=UTC_TIMESTAMP(3),readValue = false, updatedAt = ?, updatedBy = uuid_to_bin(?) ' +
              'WHERE id = uuid_to_bin(?) and updatedAt = ? and userId = uuid_to_bin(?); end IF';

            var params = [notificationId, userId, notificationId, userId, updatedAt, currentDate, userId, notificationId, updatedAt, userId];

            await conn.query(query, params);

            AuditUtils.create(auditOptions);
            await conn.query('COMMIT;');

            return cb(null, {
                OK: Constants.SUCCESS_MESSAGE.NOTIFICATION_MARK_UNREAD_SUCCESS,
                notificationId: notificationId,
                updatedAt: currentDate
            });

        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK;');
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno === 4002) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
            } else if (err.errno === 4003) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_ALREADY_UNREAD);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    markAllArchivedMD: async function (options, auditOptions, errorOptions, cb) {
        var notificationIds = options.notificationIds;
        var userId = options.userId;
        var languageCultureCode = options.user.languageCultureCode;
        var err;

        if (!notificationIds || !notificationIds.length) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_IDS_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            return cb(err);
        }
        try {
            await Promise.each(notificationIds, async function (notification) {
                if (DataUtils.isUndefined(notification.notificationId)) {
                    err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_ID_REQUIRED);
                }
                if (!err && DataUtils.isValidateOptionalField(notification.updatedAt)) {
                    err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_UPDATED_AT_REQUIRED);
                }
                if (err) {
                    throw err;
                }
            });
        } catch (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        var notificationConflictList = [];
        var notificationSuccessList = [];
        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }


        try {
            await conn.query('START TRANSACTION');

            await Promise.each(notificationIds, async function (value) {
                var notificationId = value.notificationId;
                var updatedAt = value.updatedAt;
                var currentDate = new Date().getTime();

                /*var query = 'UPDATE Notifications SET  archiveValue = true, archiveUtcTime = utc_timestamp(3), ' +
                  'actionValue  = case when actionValue = ? then ? ELSE actionValue END , updatedAt = ?,' +
                  'updatedBy = uuid_to_bin(?) where id = uuid_to_bin(?) and userId = uuid_to_bin(?) and updatedAt = ?;';
                var params = ['', Constants.NOTIFICATION_ACTION.IGNORE, currentDate, userId, notificationId, userId, updatedAt];*/

                var query = 'UPDATE Notifications N, NotificationReference NR ' +
                  ' SET archiveValue = true, archiveUtcTime = utc_timestamp(3),' +
                  ' N.actionValue = case when ( N.actionValue = ? AND  NR.actionIgnore != 1 AND NR.actionDecline !=1 AND NR.actionAccept != 1) then N.actionValue ELSE ? END,' +
                  ' N.updatedAt = ?, N.updatedBy = uuid_to_bin(?) ' +
                  ' WHERE N.notificationReferenceId = NR.id AND NR.languageCultureCode = ?' +
                  ' AND N.userId = uuid_to_bin(?) ' +
                  ' AND N.id = uuid_to_bin(?) and N.updatedAt = ?;';
                var params = ['', Constants.NOTIFICATION_ACTION.IGNORE, currentDate, userId, languageCultureCode, userId, notificationId, updatedAt];


                var updateNotification = await conn.query(query, params);

                if (Utils.isAffectedPool(updateNotification)) {
                    notificationSuccessList.push({
                        notificationId: notificationId,
                        updatedAt: currentDate
                    });
                } else {
                    notificationConflictList.push({
                        notificationId: notificationId,
                        updatedAt: updatedAt
                    });
                }
            });
            await conn.query('COMMIT;');
            AuditUtils.create(auditOptions);
        } catch (err) {
            console.log(err);
            await conn.query('ROLLBACK;');
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }

        if (notificationConflictList.length > 0) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_HAS_SYNC_CONFLICT);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;

            if (notificationSuccessList.length > 0) {
                err.data = {
                    successMsg: Constants.SUCCESS_MESSAGE.NOTIFICATION_MARK_ARCHIVE_SUCCESS,
                    success: notificationSuccessList,
                    conflict: notificationConflictList
                };
            } else {
                err.data = {
                    success: notificationSuccessList,
                    conflict: notificationConflictList
                };
            }

            return cb(err);
        }

        var response = {
            OK: Constants.SUCCESS_MESSAGE.NOTIFICATION_MARK_ARCHIVE_SUCCESS,
            success: notificationSuccessList
        };

        auditOptions.notificationIds = notificationIds;
        AuditUtils.create(auditOptions);
        return cb(err, response);
    },

    undoAllArchivedMD: async function (options, auditOptions, errorOptions, cb) {

        var notificationIds = options.notificationIds;
        var userId = options.userId;

        if (!notificationIds || !notificationIds.length) {
            var err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_IDS_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            return cb(err);
        }
        try {

            await Promise.each(notificationIds, async function (notification) {
                if (DataUtils.isUndefined(notification.notificationId)) {
                    err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_ID_REQUIRED);
                }
                if (!err && DataUtils.isValidateOptionalField(notification.updatedAt)) {
                    err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_UPDATED_AT_REQUIRED);
                }
                if (err) {
                    throw err;
                }
            });
        } catch (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        var notificationConflictList = [];
        var notificationSuccessList = [];

        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        try {
            await conn.query('START TRANSACTION');

            await Promise.each(notificationIds, async function (value) {
                var notificationId = value.notificationId;
                var updatedAt = value.updatedAt;
                var currentDate = new Date().getTime();

                var query = 'UPDATE Notifications SET archiveValue = false, archiveUtcTime = ?, archiveUndoUtcTime = utc_timestamp(3), ' +
                  'updatedAt = ?, updatedBy = uuid_to_bin(?) where id = uuid_to_bin(?) and userId = uuid_to_bin(?) and updatedAt = ?;';

                var params = [new Date(Constants.DEFAULT_TIMESTAMP), currentDate, userId, notificationId, userId, updatedAt];

                var updateNotification = await conn.query(query, params);

                if (Utils.isAffectedPool(updateNotification)) {

                    notificationSuccessList.push({
                        notificationId: notificationId,
                        updatedAt: currentDate
                    });

                } else {
                    notificationConflictList.push({
                        notificationId: notificationId,
                        updatedAt: updatedAt
                    });
                }
            });

            await conn.query('COMMIT;');
            AuditUtils.create(auditOptions);

        } catch (err) {

            await conn.query('ROLLBACK;');
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            if (err.code) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }

        if (notificationConflictList.length > 0) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_HAS_SYNC_CONFLICT);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;

            if (notificationSuccessList.length > 0) {
                err.data = {
                    successMsg: Constants.SUCCESS_MESSAGE.NOTIFICATION_UNDO_ARCHIVE_SUCCESS,
                    success: notificationSuccessList,
                    conflict: notificationConflictList
                };
            } else {
                err.data = {
                    success: notificationSuccessList,
                    conflict: notificationConflictList
                };
            }
            return cb(err);
        }

        var response = {
            OK: Constants.SUCCESS_MESSAGE.NOTIFICATION_UNDO_ARCHIVE_SUCCESS,
            success: notificationSuccessList
        };

        auditOptions.notificationIds = notificationIds;
        AuditUtils.create(auditOptions);
        return cb(err, response);
    },

    /*markArchived: function (options, auditOptions, cb) {

        var userId = options.userId;
        var updatedAt = options.updatedAt;

        Notification.getNotification(options, function (err, notification) {
            if (err) {
                return cb(err);
            }
            if (notification.updatedAt !== updatedAt) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                return cb(err);
            }
            var userData = notification.userData;
            if (!userData || !notification.userData[userId]) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_DOES_NOT_BELONG_TO_USER);
            } else if (userData[userId].archive.value) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_ALREADY_ARCHIVED);
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }

            userData[userId].archive.value = true;
            userData[userId].archive.utcTime = DataUtils.getCurrentUtcDateString();
            var notificationOptions = {
                id: notification.id,
                userData: userData
            };
            NotificationModel.update(notificationOptions, function (err, notification) {
                if (err) {
                    err = err || new Error(ErrorConfig.MESSAGE.NOTIFICATION_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    Util.log(err);
                    return cb(err);
                }
                notification = notification.attrs;
                // Insert Audit Log
                auditOptions.metaData = {
                    notification: notification
                };
                AuditUtils.create(auditOptions);
                return cb(null, notification);
            });
        });
    },*/

    markActionMD: async function (options, auditOptions, errorOptions, cb) {
        var notificationId = options.notificationId;
        var userId = options.userId;
        var user = options.user;
        var action = options.action;
        var updatedAt = options.updatedAt;
        var currentDate = new Date().getTime();
        var err;


        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
        try {
            await conn.query('START TRANSACTION;');

            var notificationsQuery = 'SELECT CAST(uuid_from_bin(id) as CHAR) as id ,CAST(uuid_from_bin(userId) as CHAR) as userId,' +
              'CAST(uuid_from_bin(refereId) as CHAR) as refereId,notificationReferenceId,archiveValue,archiveUndoUtcTime,' +
              'archiveUtcTime,actionValue,actionUtcTime,metaName,metaEmail,notificationExpirationDate,createdAt,' +
              'updatedAt from Notifications where id = uuid_to_bin(?);';

            var notification = await conn.query(notificationsQuery, [notificationId]);
            notification = Utils.filteredResponsePool(notification);

            if (!notification) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            if (notification.actionValue !== '') {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_ACTION_ALREADY_TAKEN);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            if (DataUtils.isUndefined(action)) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_REFERENCE_ACTION_REQUIRED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }
            if (currentDate > new Date(notification.notificationExpirationDate).getTime()) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_EXPIRED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            if (action === Constants.CONTACT_INVITATION_NOTIFICATION_ACTION.ACCEPT || action === Constants.CONTACT_INVITATION_NOTIFICATION_ACTION.DECLINE || action === Constants.CONTACT_INVITATION_NOTIFICATION_ACTION.IGNORE) {
                notification.archiveValue = true;
            }

            /*var query = 'IF NOT EXISTS (select 1 from Notifications where id = uuid_to_bin(?) and updatedAt = ?)' +
              'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "NOTIFICATION_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED";' +
              'ELSE UPDATE Notifications SET actionValue = ?, actionUtcTime = utc_timestamp(3), archiveValue = ?, archiveUtcTime = utc_timestamp(3), updatedAt = ?, updatedBy = uuid_to_bin(?) where id = uuid_to_bin(?) and updatedAt = ?;end IF';*/
            debug('action', action);
            var query = 'IF NOT EXISTS (select 1 from Notifications where id = uuid_to_bin(?) and updatedAt = ?)' +
              'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "NOTIFICATION_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED";' +
              'ELSE UPDATE Notifications SET actionValue = ?, actionUtcTime = utc_timestamp(3), updatedAt = ?, updatedBy = uuid_to_bin(?) where id = uuid_to_bin(?) and updatedAt = ?;end IF';

            var params = [notificationId, updatedAt, action, currentDate, userId, notificationId, updatedAt];
            var isNotificationUpdated = await conn.query(query, params);
            debug('isNotificationUpdated', isNotificationUpdated);

            if (!Utils.isAffectedPool(isNotificationUpdated)) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            var notificationReference = await conn.query('select meta from NotificationReference where id = ? and languageCultureCode = ?',
              [notification.notificationReferenceId, user.languageCultureCode]);

            notificationReference = Utils.filteredResponsePool(notificationReference);


            if (notificationReference.meta === NotificationReferenceData.CONTACT_INVITE) {
                debug('Inside contact invite');
                var notificationData = {
                    user: user,
                    contactId: notification.refereId,
                    action: action,
                    inviteeEmail: notification.metaEmail
                };

                if (action === Constants.CONTACT_INVITATION_NOTIFICATION_ACTION.ACCEPT || action === Constants.CONTACT_INVITATION_NOTIFICATION_ACTION.DECLINE || action === Constants.CONTACT_INVITATION_NOTIFICATION_ACTION.IGNORE) {
                    debug('Inside if');
                    ContactApi.acceptDeclineIgnoreInvitationMD(notificationData, auditOptions, errorOptions, async function (err, result) {
                        if (err) {
                            console.log(err);
                            await conn.query('ROLLBACK;');
                            errorOptions.err = err;
                            await ErrorUtils.create(errorOptions);
                            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_UPDATE_FAILED);
                            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                            return cb(err);
                        }
                        await conn.query('COMMIT;');
                        return cb(null, {
                            OK: Constants.SUCCESS_MESSAGE.NOTIFICATION_MARK_ACTION_SUCCESS,
                            notificationId: notificationId,
                            updatedAt: currentDate
                        });
                    });
                }
            } else if (notificationReference.meta === NotificationReferenceData.SUPPLIER_INVITE) {
                debug('Inside supplier invite');
                debug('Inside else if');
                var supplierOptions = {
                    user: user,
                    id: notification.refereId,
                    action: action,
                    inviteeEmail: notification.metaEmail
                };
                if (action === Constants.INVITATION_STATUS_NOTIFICATION_ACTION.ACCEPT || action === Constants.INVITATION_STATUS_NOTIFICATION_ACTION.DECLINE || action === Constants.INVITATION_STATUS_NOTIFICATION_ACTION.IGNORE) {
                    SupplierApi.acceptDeclineIgnoreSupplierInvitationMD(supplierOptions, auditOptions, errorOptions, async function (err, supplier) {
                        if (err) {
                            debug('err', err);
                            errorOptions.err = err;
                            await ErrorUtils.create(errorOptions);
                            if (err.isExist) {
                                await conn.query('COMMIT;');
                                return cb(err);
                            }
                            await conn.query('ROLLBACK;');
                            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_UPDATE_FAILED);
                            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                            return cb(err);
                        }
                        await conn.query('COMMIT;');
                        return cb(null, {
                            OK: Constants.SUCCESS_MESSAGE.NOTIFICATION_MARK_ACTION_SUCCESS,
                            notificationId: notificationId,
                            updatedAt: currentDate
                        });
                    });
                }
            } else if (notificationReference.meta === NotificationReferenceData.CUSTOMER_INVITE) {
                debug('Inside customer invite');
                debug('Inside else if 2');
                var customerOptions = {
                    user: user,
                    id: notification.refereId,
                    action: action,
                    inviteeEmail: notification.metaEmail
                };
                debug('');
                if (action === Constants.INVITATION_STATUS_NOTIFICATION_ACTION.ACCEPT || action === Constants.INVITATION_STATUS_NOTIFICATION_ACTION.DECLINE || action === Constants.INVITATION_STATUS_NOTIFICATION_ACTION.IGNORE) {
                    CustomerApi.acceptDeclineIgnoreCustomerInvitationMD(customerOptions, auditOptions, errorOptions, async function (err, customer) {
                        if (err) {
                            debug('err', err);
                            errorOptions.err = err;
                            await ErrorUtils.create(errorOptions);
                            if (err.isExist) {
                                await conn.query('COMMIT;');
                                return cb(err);
                            }
                            await conn.query('ROLLBACK;');
                            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_UPDATE_FAILED);
                            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                            return cb(err);
                        }
                        await conn.query('COMMIT;');
                        return cb(null, {
                            OK: Constants.SUCCESS_MESSAGE.NOTIFICATION_MARK_ACTION_SUCCESS,
                            notificationId: notificationId,
                            updatedAt: currentDate
                        });
                    });
                }
            } else if (notificationReference.meta === NotificationReferenceData.DATA_SHARE) {
                debug('Inside DATA_SHARE');
                var inShareOptions = {
                    user: user,
                    accountId: user.account.id,
                    id: notification.refereId,
                    action: action,
                    inviteeEmail: notification.metaEmail,
                    notificationAction: true
                };
                debug('inShareOptions', inShareOptions);
                if (action === Constants.INVITATION_STATUS_NOTIFICATION_ACTION.ACCEPT || action === Constants.INVITATION_STATUS_NOTIFICATION_ACTION.DECLINE || action === Constants.INVITATION_STATUS_NOTIFICATION_ACTION.IGNORE) {
                    InShareApi.updateActionMD(inShareOptions, auditOptions, errorOptions, async function (err, customer) {
                        if (err) {
                            debug('err', err);
                            await conn.query('ROLLBACK;');
                            errorOptions.err = err;
                            await ErrorUtils.create(errorOptions);
                            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_UPDATE_FAILED);
                            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                            return cb(err);
                        }
                        await conn.query('COMMIT;');
                        return cb(null, {
                            OK: Constants.SUCCESS_MESSAGE.NOTIFICATION_MARK_ACTION_SUCCESS,
                            notificationId: notificationId,
                            updatedAt: currentDate
                        });
                    });
                }
            } else {
                debug('Inside else');
                await conn.query('COMMIT;');
                return cb(null, notification);
            }
        } catch (err) {
            await conn.query('ROLLBACK;');
            debug('err', err);
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
            } else if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    markAllSnoozedMD: async function (options, auditOptions, errorOptions, cb) {
        var notificationIds = options.notificationIds;
        var userId = options.userId;
        var err;

        if (!notificationIds || !notificationIds.length) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_IDS_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            return cb(err);
        }

        try {

            await Promise.each(notificationIds, async function (notification) {
                if (DataUtils.isUndefined(notification.notificationId)) {
                    err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_ID_REQUIRED);
                }
                if (!err && DataUtils.isValidateOptionalField(notification.updatedAt)) {
                    err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_UPDATED_AT_REQUIRED);
                }
                if (!err && DataUtils.isValidateOptionalField(notification.time)) {
                    err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_SNOOZE_TIME_REQUIRED);
                }
                if (err) {
                    throw err;
                }
            });
        } catch (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        var notificationConflictList = [];
        var notificationSuccessList = [];
        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
        try {
            await conn.query('START TRANSACTION;');

            await Promise.each(notificationIds, async function (value) {
                var notificationId = value.notificationId;
                var updatedAt = value.updatedAt;
                var time = value.time;

                if (!DataUtils.isNumber(time)) {
                    time = parseInt(time);
                }
                if (!time || isNaN(time)) {
                    err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_SNOOZE_TIME_INVALID);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    throw err;
                }

                var now = new Date();
                var currentDate = now.getTime();
                now.setSeconds(now.getSeconds() + time);
                var nextUtcTime = now.toUTCString();
                var isSnoozeComplete = time < 0 ? true : false;
                nextUtcTime = new Date(nextUtcTime);
                debug('isSnoozeComplete', isSnoozeComplete);
                debug('nextUtcTime', nextUtcTime);

                var markSnooze = await conn.query('UPDATE Notifications SET snoozeValue = true, snoozeCount = 1, snoozeLastUtcTime = snoozeNextUtcTime, ' +
                  'snoozeNextUtcTime = ?, snoozeIsSnoozeComplete = ?, updatedAt = ?, updatedBy = uuid_to_bin(?)' +
                  ' where  id = uuid_to_bin(?) and userId = uuid_to_bin(?) and updatedAt = ?',
                  [nextUtcTime, isSnoozeComplete, currentDate, userId, notificationId, userId, updatedAt]);

                if (Utils.isAffectedPool(markSnooze)) {

                    notificationSuccessList.push({
                        notificationId: notificationId,
                        updatedAt: currentDate
                    });

                } else {
                    notificationConflictList.push({
                        notificationId: notificationId,
                        updatedAt: updatedAt
                    });
                }
            });

            await conn.query('COMMIT;');
            AuditUtils.create(auditOptions);

        } catch (err) {

            await conn.query('ROLLBACK;');
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }

        if (notificationConflictList.length > 0) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_HAS_SYNC_CONFLICT);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;

            if (notificationSuccessList.length > 0) {
                err.data = {
                    successMsg: Constants.SUCCESS_MESSAGE.NOTIFICATION_MARK_SNOOZE_SUCCESS,
                    success: notificationSuccessList,
                    conflict: notificationConflictList
                };
            } else {
                err.data = {
                    success: notificationSuccessList,
                    conflict: notificationConflictList
                };
            }
            return cb(err);
        }

        var response = {
            OK: Constants.SUCCESS_MESSAGE.NOTIFICATION_MARK_SNOOZE_SUCCESS,
            success: notificationSuccessList
        };

        auditOptions.notificationIds = notificationIds;
        AuditUtils.create(auditOptions);
        return cb(err, response);
    },

    undoAllSnoozeMD: async function (options, auditOptions, errorOptions, cb) {
        var notificationIds = options.notificationIds;
        var userId = options.userId;
        var err;

        if (!notificationIds || !notificationIds.length) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_IDS_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            return cb(err);
        }

        try {

            await Promise.each(notificationIds, async function (notification) {
                if (DataUtils.isUndefined(notification.notificationId)) {
                    err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_ID_REQUIRED);
                }
                if (!err && DataUtils.isValidateOptionalField(notification.updatedAt)) {
                    err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_UPDATED_AT_REQUIRED);
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
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
        var notificationConflictList = [];
        var notificationSuccessList = [];
        try {
            await conn.query('START TRANSACTION;');

            await Promise.each(notificationIds, async function (value) {
                var notificationId = value.notificationId;
                var updatedAt = value.updatedAt;
                var currentDate = new Date().getTime();

                var markSnooze = await conn.query('UPDATE Notifications SET snoozeValue = false, snoozeCount = 0, ' +
                  'snoozeNextUtcTime = ?, updatedAt = ?, updatedBy = uuid_to_bin(?)' +
                  'where id = uuid_to_bin(?) and userId = uuid_to_bin(?) and updatedAt = ?',
                  [new Date(Constants.DEFAULT_TIMESTAMP), currentDate, userId, notificationId, userId, updatedAt]);

                if (Utils.isAffectedPool(markSnooze)) {
                    notificationSuccessList.push({
                        notificationId: notificationId,
                        updatedAt: currentDate
                    });
                } else {
                    notificationConflictList.push({
                        notificationId: notificationId,
                        updatedAt: updatedAt
                    });
                }
                await conn.query('COMMIT;');
            });
        } catch (err) {
            await conn.query('ROLLBACK;');
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }

        if (notificationConflictList.length > 0) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_HAS_SYNC_CONFLICT);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            if (notificationSuccessList.length > 0) {
                err.data = {
                    successMsg: Constants.SUCCESS_MESSAGE.NOTIFICATION_UNDO_SNOOZE_SUCCESS,
                    success: notificationSuccessList,
                    conflict: notificationConflictList
                };
            } else {
                err.data = {
                    success: notificationSuccessList,
                    conflict: notificationConflictList
                };
            }
            return cb(err);
        }

        var response = {
            OK: Constants.SUCCESS_MESSAGE.NOTIFICATION_UNDO_SNOOZE_SUCCESS,
            success: notificationSuccessList
        };

        auditOptions.notificationIds = notificationIds;
        AuditUtils.create(auditOptions);
        return cb(err, response);
    },

    registerDeviceMD: async function (options, auditOptions, errorOptions, cb) {

        var userId = options.userId;
        var deviceId = options.deviceId;
        var timestamp = options.timestamp;
        var err;

        if (DataUtils.isUndefined(deviceId)) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_DEVICE_ID_REQUIRED);
        }

        if (!err && DataUtils.isValidateOptionalField(timestamp)) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_DEVICE_TIMESTAMP_REQUIRED);
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

            await conn.query('START TRANSACTION');

            var currentDate = new Date().getTime();

            var query =
              'IF NOT EXISTS (select 1 from userDeviceMapping where userId = uuid_to_bin(?)) ' +
              'THEN Insert into userDeviceMapping(userId,deviceId,timestamp,createdAt) ' +
              'VALUES(uuid_to_bin(?),?,?,?);' +
              'ELSEIF EXISTS (select 1 from userDeviceMapping where userId = uuid_to_bin(?) && deviceId = ?) ' +
              'THEN UPDATE userDeviceMapping SET deviceId = ?, timestamp = ?,updatedAt = ? ' +
              'WHERE userId = uuid_to_bin(?) && deviceId = ?; ' +
              'ELSE Insert into userDeviceMapping(userId,deviceId,timestamp,createdAt) ' +
              'VALUES(uuid_to_bin(?),?,?,?); end IF';

            var params = [userId, userId, deviceId, timestamp, currentDate, userId, deviceId, deviceId, timestamp, currentDate, userId, deviceId, userId, deviceId, timestamp, currentDate];
            var notiRef = await conn.query(query, params);
            debug('notiRef ', notiRef);


            if (Utils.isAffectedPool(notiRef)) {
                await conn.query('delete from userDeviceMapping where userId = uuid_to_bin(?) and timestamp < ((UNIX_TIMESTAMP() * 1000) - (24 * 60 * 60 * 1000))', [userId]);
            }

            AuditUtils.create(auditOptions);
            debug('COMMIT');
            await conn.query('COMMIT');
            return cb(null, {OK: Constants.SUCCESS_MESSAGE.NOTIFICATION_DEVICE_REGISTER_SUCCESS});

        } catch (err) {
            await conn.query('ROLLBACK');

            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);

            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_DEVICE_REGISTER_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    unRegisterDeviceMD: async function (options, auditOptions, errorOptions, cb) {

        var userId = options.userId;
        var deviceId = options.deviceId;
        var err;

        if (DataUtils.isUndefined(deviceId)) {
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_DEVICE_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            return cb(err);
        }


        try {
            var conn = await connection.getConnection();
            var query = 'DELETE from userDeviceMapping WHERE userId = uuid_to_bin(?) && deviceId = ?;';
            var params = [userId, deviceId];
            var unRegisterDevice = await conn.query(query, params);
            debug('unRegisterDevice', unRegisterDevice);
            if (!Utils.isAffectedPool(unRegisterDevice)) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_USER_DEVICE_MAPPING_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            AuditUtils.create(auditOptions);
            return cb(null, {OK: Constants.SUCCESS_MESSAGE.NOTIFICATION_DEVICE_UNREGISTER_SUCCESS});
        } catch (err) {
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);

            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_DEVICE_REGISTER_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    getRegisterDevicesMD: async function (options, errorOptions, cb) {

        var userId = options.userId || [];

        try {
            var conn = await connection.getConnection();
            var devices = await conn.query('select CAST(uuid_from_bin(userId) as CHAR) as userId, deviceId,timestamp,createdAt,updatedAt' +
              ' from userDeviceMapping where userId = uuid_to_bin(?)', [userId]);

            return cb(null, devices);

        } catch (err) {

            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);

            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_USER_DEVICE_MAPPING_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    getAllCountMD: async function (options, errorOptions, cb) {

        var userId = options.userId;
        var response = {
            inbox: 0,
            archive: 0,
            snooze: 0
        };

        try {
            var conn = await connection.getConnection();
            var query = 'select  (select count(1) from Notifications where userId = uuid_to_bin(?) and archiveValue = 1) as archiveCount,' +
              '(select count(1) from Notifications where userId = uuid_to_bin(?) and (snoozeValue = 1 or snoozeIsSnoozeComplete = 1)) as snoozeCount,' +
              '(select count(1) from Notifications where userId = uuid_to_bin(?) and (snoozeValue = 0 and snoozeIsSnoozeComplete = 0) and archiveValue = 0) as inboxCount';
            var count = await conn.query(query, [userId, userId, userId]);
            count = Utils.filteredResponsePool(count);

            if (count) {
                response.inbox = count.inboxCount;
                response.archive = count.archiveCount;
                response.snooze = count.snoozeCount;
            }

            return cb(null, response);

        } catch (err) {

            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);

            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }

            return cb(err);
        }
    },

    getAllUnreadCountMD: async function (options, errorOptions, cb) {

        var userId = options.userId;
        var response = {
            inbox: 0
            //archive: 0,
            //snooze: 0
        };
        debug('Inside a un-read');
        try {
            var conn = await connection.getConnection();
            /* var query =
               'select (select count(1) from Notifications where userId = uuid_to_bin(?) and archiveValue = 0 and readValue = 0 and snoozeValue = 0 and snoozeIsSnoozeComplete = 0) as inboxCount,' +
               '(select count(1) from Notifications where userId = uuid_to_bin(?) and archiveValue = 1 and readValue = 0) as archiveCount,' +
               '(select count(1) from Notifications where userId = uuid_to_bin(?) and (snoozeValue = 1 or snoozeIsSnoozeComplete = 1) and readValue = 0) as snoozeCount';
 */
            var query = 'select count(1) as inboxCount from Notifications where userId = uuid_to_bin(?) and ' +
              '((archiveValue = 0 and readValue = 0 and snoozeValue = 0 and snoozeIsSnoozeComplete = 0) OR ' +
              '(archiveValue = 0 and readValue = 0 and snoozeValue != 0 and snoozeIsSnoozeComplete != 0))';

            var count = await conn.query(query, [userId, userId, userId]);
            count = Utils.filteredResponsePool(count);

            if (count) {
                response.inbox = count.inboxCount;
                //response.archive = count.archiveCount;
                //response.snooze = count.snoozeCount;
            }

            return cb(null, response);

        } catch (err) {

            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);

            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }

    },

    getCountMD: async function (options, errorOptions, cb) {

        var userId = options.userId;
        var response = {unread: 0};

        try {
            var conn = await connection.getConnection();
            var notiRef = await conn.query('select count(1) as count from Notifications where userId = uuid_to_bin(?) ' +
              'and snoozeValue = 0 and archiveValue = 0 and readValue = 0;', [userId]);
            var count = Utils.filteredResponsePool(notiRef);

            if (count) {
                response.unread = count.count;
            }
            return cb(null, response);

        } catch (err) {

            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);

            if (err.errno) {
                err = new (ErrorConfig.MESSAGE.NOTIFICATION_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    getDeviceIds: function (options, cb) {
        var topicId = options.topicId;
        if (DataUtils.isUndefined(topicId)) {
            var err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_TOPIC_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
        TopicDeviceMappingModel.get(topicId, {
            ConsistentRead: true
        }, function (err, topicDeviceMapping) {
            if (err || !topicDeviceMapping) {
                err = err || new Error(ErrorConfig.MESSAGE.NOTIFICATION_TOPIC_DEVICE_MAPPING_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
            topicDeviceMapping = topicDeviceMapping.attrs;
            var deviceIds = topicDeviceMapping.deviceIds;
            return cb(null, deviceIds);
        });
    },

    getDeviceIdsMD: async function (options) {
        var userId = options.userId;

        if (DataUtils.isUndefined(userId)) {
            var err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_USER_ID_DEVICE_MAPPING_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            throw err;
        }

        try {
            var conn = await connection.getConnection();
            var deviceIds = await conn.query('SELECT CAST(uuid_from_bin(userId) as CHAR) as userId, deviceId from userDeviceMapping where userId = uuid_to_bin(?)', [userId]);
            //var deviceIds = Utils.getDataArray(devices);

            if (!deviceIds || deviceIds.length === 0) {
                var err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_USER_DEVICE_MAPPING_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                //throw err;
            }
            return deviceIds;

        } catch (e) {
            debug(e);
            return [];
        }
    }
};

module.exports = Notification;

(function () {
    if (require.main == module) {
        var Startup = require('../api/startup');
        Startup.init({}, function (err) {
            if (err) {
                console.log(err);
            }
            var names = ['Dheeraj', 'Ajay', 'Rahul', 'Jack'];
            var emails = ['dheeraj@user.com', 'ajay@user.com', 'rahul@user.com', 'jack@user.com'];
            var types = ['Info', 'Urgent', 'Alert', 'Danger'];


            for (var count = 0; count < 25; count++) {
                var random = Math.floor(Math.random() * 3) + 1;
                var metaRandom = Math.floor(Math.random() * 3) + 1;
                metaRandom = (count % 4) + 1;
                random = (count % 3) + 1;
                var notificationReference;
                var prevLanguageCultureCode = 'en-US';
                var nextLanguageCultureCode = 'de-DE';
                var data;
                var meta;
                switch (random) {
                    case 1:
                        notificationReference = 'LANGUAGE_PREFERENCE_UPDATED';
                        data = {
                            user: {
                                languageCultureCode: nextLanguageCultureCode
                            }
                        };
                        break;
                    case 2:
                        notificationReference = 'CONTACT_INVITE';
                        data = {
                            contact: {
                                invitee: names[metaRandom]
                            }
                        };
                        meta = {
                            name: names[metaRandom],
                            email: emails[metaRandom]
                        };
                        break;
                    case 3:
                        notificationReference = 'LANGUAGE_PREFERENCE_UPDATED';
                        data = {
                            user: {
                                languageCultureCode: prevLanguageCultureCode
                            }
                        };
                        break;
                }
                var userId = '0c1f79ee-df7a-4c24-938b-8b67cf8ca641';
                var notification = {
                    user_ids: [userId],
                    topic_id: userId,
                    notification_reference: notificationReference,
                    data: data,
                    type: types[metaRandom],
                    meta: meta
                };
                Notification.create(notification, noop);
            }
        });
    }
}());
