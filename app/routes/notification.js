#!/usr/bin/env node

'use strict';

var debug = require('debug')('scopehub.route.notification');
var Util = require('util');

var NotificationApi = require('../api/notification');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');
var HeaderUtils = require('../lib/header_utils');
var AuditUtils = require('../lib/audit_utils');
var Events = require('../data/events');
var FirebaseUtils = require('../lib/firebase_utils');

var Notification = {

    /*getNotifications: function (req, res, next) {
        var options = {
            userId: req.user.id,
            topicIds: req.topicIds,
            timestamp: req.query.timestamp,
            days: req.query.days,
            getMostRecent: req.query.getMostRecent
        };
        NotificationApi.getNotifications(options, function (err, notifications) {
            if (err) {
                return next(err);
            }
            req.notifications = notifications;
            return next();
        });
    },*/

    getNotificationsMD: function (req, res, next) {
        var options = {
            userId: req.user.id,
            timestamp: req.query.timestamp,
            count: req.query.count,
            getMostRecent: req.query.getMostRecent
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        NotificationApi.getNotificationsMD(options, errorOptions, function (err, notifications) {
            if (err) {
                return next(err);
            }
            req.data = notifications;
            return next();
        });
    },

    getArchiveNotificationsMD: function (req, res, next) {
        var options = {
            userId: req.user.id,
            topicIds: req.topicIds,
            timestamp: req.query.timestamp,
            days: req.query.days,
            getMostRecent: req.query.getMostRecent
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        NotificationApi.getArchiveNotificationsMD(options, errorOptions, function (err, notifications) {
            if (err) {
                return next(err);
            }
            req.data = notifications;
            return next();
        });
    },

    getSnoozeNotificationsMD: function (req, res, next) {
        var options = {
            userId: req.user.id,
            snoozeNextUtcTime: req.query.snoozeNextUtcTime,
            getMostRecent: req.query.getMostRecent
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        NotificationApi.getSnoozeNotificationsMD(options, errorOptions, function (err, notifications) {
            if (err) {
                return next(err);
            }
            req.data = notifications;
            return next();
        });
    },

    getNotification: function (req, res, next) {
        var options = {
            notificationId: req.query.notificationId
        };
        NotificationApi.getNotification(options, function (err, notification) {
            if (err) {
                return next(err);
            }
            req.data = notification;
            return next();
        });
    },

    getAllNotificationsMD: function (req, res, next) {

        var options = {
            notificationIds: req.body.notificationIds
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        NotificationApi.getAllNotificationsMD(options, errorOptions, function (err, notification) {
            if (err) {
                return next(err);
            }
            req.data = notification;
            return next();
        });
    },

    markReadMD: function (req, res, next) {
        var options = {
            notificationId: req.body.notificationId,
            userId: req.user.id,
            updatedAt: req.body.updatedAt
        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.MARK_NOTIFICATION_READ);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        NotificationApi.markReadMD(options, auditOptions, errorOptions, function (err, notification) {
            if (err) {
                return next(err);
            }
            req.data = notification;
            return next();
        });
    },

    markUnReadMD: function (req, res, next) {
        var options = {
            notificationId: req.body.notificationId,
            userId: req.user.id,
            updatedAt: req.body.updatedAt
        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.MARK_NOTIFICATION_UNREAD);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        NotificationApi.markUnReadMD(options, auditOptions, errorOptions, function (err, notification) {
            if (err) {
                return next(err);
            }
            req.data = notification;
            return next();
        });
    },

    validateNotificationIds: function (req, res, next) {
        debug('Inside validateNotificationIds');
        var options = {
            userId: req.user.id,
            notificationIds: req.body.notificationIds
        };
        NotificationApi.validateNotificationIds(options, function (err, notification) {
            if (err) {
                return next(err);
            }
            return next();
        });
    },

    markAllReadMD: function (req, res, next) {
        var options = {
            userId: req.user.id,
            notificationIds: req.body.notificationIds
        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.MARK_NOTIFICATION_ARCHIVED);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        NotificationApi.markAllReadMD(options, auditOptions, errorOptions, function (err, notification) {
            if (err) {
                return next(err);
            }
            req.data = notification;
            return next();
        });
    },

    undoAllReadMD: function (req, res, next) {
        var options = {
            notificationIds: req.body.notificationIds,
            userId: req.user.id
        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.MARK_NOTIFICATION_ARCHIVED);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        NotificationApi.undoAllReadMD(options, auditOptions, errorOptions, function (err, notification) {
            if (err) {
                return next(err);
            }
            req.data = notification;
            return next();
        });
    },

    markAllArchivedMD: function (req, res, next) {
        var options = {
            user: req.user,
            notificationIds: req.body.notificationIds,
            userId: req.user.id
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.MARK_NOTIFICATION_ARCHIVED);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        NotificationApi.markAllArchivedMD(options, auditOptions, errorOptions, function (err, notification) {
            if (err) {
                return next(err);
            }
            req.data = notification;
            return next();
        });
    },

    undoAllArchivedMD: function (req, res, next) {
        var options = {
            notificationIds: req.body.notificationIds,
            userId: req.user.id
        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.MARK_NOTIFICATION_ARCHIVED);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        NotificationApi.undoAllArchivedMD(options, auditOptions, errorOptions, function (err, notification) {
            if (err) {
                return next(err);
            }
            req.data = notification;
            return next();
        });
    },

    markActionMD: function (req, res, next) {
        var options = {
            notificationId: req.body.notificationId,
            userId: req.user.id,
            action: req.body.action,
            user: req.user,
            updatedAt: req.body.updatedAt
        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.MARK_NOTIFICATION_ACTION);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        NotificationApi.markActionMD(options, auditOptions, errorOptions, function (err, notification) {
            if (err) {
                return next(err);
            }
            req.data = notification;
            return next();
        });
    },

    markAllSnoozedMD: function (req, res, next) {

        var options = {
            notificationIds: req.body.notificationIds,
            userId: req.user.id
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.SNOOZE_NOTIFICATION);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        NotificationApi.markAllSnoozedMD(options, auditOptions, errorOptions, function (err, notification) {
            if (err) {
                return next(err);
            }
            req.data = notification;
            return next();
        });
    },

    undoAllSnoozeMD: function (req, res, next) {

        var options = {
            notificationIds: req.body.notificationIds,
            userId: req.user.id
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UNDO_NOTIFICATION_SNOOZE);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        NotificationApi.undoAllSnoozeMD(options, auditOptions, errorOptions, function (err, notification) {
            if (err) {
                return next(err);
            }
            req.data = notification;
            return next();
        });
    },

    getCountMD: function (req, res, next) {
        var options = {
            userId: req.user.id
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        NotificationApi.getCountMD(options, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    getAllCountMD: function (req, res, next) {
        var options = {
            userId: req.user.id
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        NotificationApi.getAllCountMD(options, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    getAllUnreadCountMD: function (req, res, next) {
        var options = {
            userId: req.user.id
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        NotificationApi.getAllUnreadCountMD(options, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    registerDeviceMD: function (req, res, next) {
        debug('insdie register--', options);
        var user = req.user;
        var options = {
            userId: user.id,
            deviceId: req.body.deviceId,
            timestamp: req.body.timestamp
        };
        debug('options--', options);
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.NOTIFICATION_REGISTER_DEVICE);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        NotificationApi.registerDeviceMD(options, auditOptions, errorOptions, function (err) {
            if (err) {
                return next(err);
            }
            req.data = {OK: Constants.SUCCESS_MESSAGE.NOTIFICATION_DEVICE_REGISTER_SUCCESS};
            return next();
        });
    },

    unRegisterDeviceMD: function (req, res, next) {
        var user = req.user;
        var options = {
            userId: user.id,
            deviceId: req.body.deviceId
        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.NOTIFICATION_UN_REGISTER_DEVICE);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        NotificationApi.unRegisterDeviceMD(options, auditOptions, errorOptions, function (err) {
            if (err) {
                return next(err);
            }
            req.data = {OK: Constants.SUCCESS_MESSAGE.NOTIFICATION_DEVICE_UNREGISTER_SUCCESS};
            return next();
        });
    },

    unRegisterDeviceForClose: function (req, res, next) {
        var user = req.user;
        var options = {
            userId: user.id,
            deviceId: req.query.deviceId
        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.NOTIFICATION_UN_REGISTER_DEVICE);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        NotificationApi.unRegisterDeviceMD(options, auditOptions, errorOptions, function (err) {
            if (err) {
                return next(err);
            }
            req.data = {OK: Constants.SUCCESS_MESSAGE.NOTIFICATION_DEVICE_UNREGISTER_SUCCESS};
            return next();
        });
    },

    getRegisterDevicesMD: function (req, res, next) {

        var user = req.user;
        var options = {
            userId: user.id
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        NotificationApi.getRegisterDevicesMD(options, errorOptions, function (err, userDeviceMapping) {
            if (err) {
                return next(err);
            }
            req.data = userDeviceMapping;
            return next();
        });
    }
};

module.exports = Notification;

(function () {
    if (require.main == module) {
    }
}());
