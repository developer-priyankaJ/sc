'use strict';

var debug = require('debug')('scopehub.lib.notification_utils');
var FirebaseAdmin = require('firebase-admin');
var _ = require('lodash');

var FirebaseKey = require('../config/firebase_key.json');
var FirebaseConfig = require('../config/firebase');
var NotificationApi = require('../api/notification');


var FirebaseUtils = {
    /*init: function (cb) {
        debug('Inside initializeApp', FirebaseKey);
        FirebaseAdmin.initializeApp({
            credential: FirebaseAdmin.credential.cert(FirebaseKey),
            databaseURL: FirebaseConfig.DATABASE_URL
        });
        return cb();
    },*/

    init: function () {
        return new Promise(function (resolve, reject) {
            debug('Inside initializeApp');
            FirebaseAdmin.initializeApp({
                credential: FirebaseAdmin.credential.cert(FirebaseKey),
                databaseURL: FirebaseConfig.DATABASE_URL
            });
            return resolve({OK: 'SUCCESS'});
        });
    },

    sendNotification: function (options, cb) {
        var deviceIds = options.deviceIds;
        var notification = options.data;
        var topicId = notification.topicId;
        var languageCultureCode = options.languageCultureCode;
        notification.userData[topicId] = notification.userData[topicId];

        var payload = {
            data: {
                notification: JSON.stringify(notification),
                languageCultureCode: languageCultureCode
            }
        };

        FirebaseAdmin.messaging().sendToDevice(deviceIds, payload)
          .then(function (response) {
              return cb(null, response);
          }).catch(function (err) {
            return cb(err);
        });
    },

    sendNotificationMD: async function (options) {
        var deviceIds = options.deviceIds;
        var notification = options.data;
        var languageCultureCode = options.languageCultureCode;

        var payload = {
            data: {
                notification: JSON.stringify(notification),
                languageCultureCode: languageCultureCode
            }
        };

        return await FirebaseAdmin.messaging().sendToDevice(deviceIds, payload);
        //     .then(function (value) {
        //     return value;
        // }).catch(function (reason) {
        //     console.log(reason);
        // });
    },

    sendChatId: async function (options) {
        var deviceIds = options.deviceIds;
        var data = options.data;
        /*var id = options.id;
        var contactId = options.contactId;
        var languageCultureCode = options.languageCultureCode;*/
        debug('inside firebase send chat id', deviceIds);
        var payload = {
            data: data
        };
        debug('payload', payload);
        return await FirebaseAdmin.messaging().sendToDevice(deviceIds, payload);
    },
};

module.exports = FirebaseUtils;

(function () {
    if (require.main === module) {
        FirebaseUtils.init(console.log);
        var options = {
            deviceIds: ['fcKB3SLgUpk:APA91bGHPZwgxwWChyyNrwTpKevMYcx5h-hMO7P7FK8g8jRJnDtE85kXkHKPLc1eW5JtVCwd9embdInc247uQ11x7Mt0tPoQMI1Z9vYy5dOTzr2ED6aoFS8GG0DrnxfGuktaRKQuCDRY'],
            data: {
                hello: JSON.stringify({'params': {'test': {'test': 'ok'}}})
            }
        };
        FirebaseUtils.sendNotification(options, console.log);
    }
}());