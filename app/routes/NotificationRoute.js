#!/usr/bin/env node
'use strict';
var express = require('express');
var router = express.Router();

var Authentication = require('./authentication');
var Common = require('./common');
var Notification = require('./notification');
var Constants = require('../data/constants');

/*
* NOTIFICATION APIS
* */

/*
*    User Device Mapping
* */
// Register Device Token
router.patch('/register/device', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.USER_DEVICE_MAPPING),
    Notification.registerDeviceMD
]);

// Un-Register Device Token
router.patch('/un-register/device', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.USER_DEVICE_MAPPING),
    Notification.unRegisterDeviceMD
]);

// Un-Register Device Token (for closing browser)
router.delete('/un-register/device', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.USER_DEVICE_MAPPING),
    Notification.unRegisterDeviceForClose
]);

// Get Registerd Device Token
router.get('/register/devices', [
    Authentication.authorizeUserOrGatewayMD,
    Notification.getRegisterDevicesMD
]);

// Get Inbox Count
router.get('/count', [
    Authentication.authorizeUserOrGatewayMD,
    Notification.getCountMD
]);

// Get all notifications Count (read/unread)
router.get('/all-count', [
    Authentication.authorizeUserOrGatewayMD,
    Notification.getAllCountMD
]);

// Get all notifications Count (unread)
router.get('/all-unread-count', [
    Authentication.authorizeUserOrGatewayMD,
    Notification.getAllUnreadCountMD
]);

// Mark Archived
router.patch('/archived', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.NOTIFICATIONS),
    Notification.markAllArchivedMD
]);

// Undo Archived
router.patch('/archived/undo', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.NOTIFICATIONS),
    Notification.undoAllArchivedMD
]);

// Mark Snooze
router.patch('/snooze', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.NOTIFICATIONS),
    Notification.markAllSnoozedMD
]);

// Undo Snooze
router.patch('/snooze/undo', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.NOTIFICATIONS),
    Notification.undoAllSnoozeMD
]);

// Mark Notification as Read
router.patch('/read', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.NOTIFICATIONS),
    Notification.markReadMD
]);

// Mark Notification as unRead
router.patch('/unread', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.NOTIFICATIONS),
    Notification.markUnReadMD
]);

// Mark All Notification as Read
router.patch('/read/all', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.NOTIFICATIONS),
    Notification.validateNotificationIds,
    Notification.markAllReadMD
]);

// Mark All Notification as unread Read
router.patch('/unread/all', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.NOTIFICATIONS),
    Notification.validateNotificationIds,
    Notification.undoAllReadMD
]);

// Add Action
router.patch('/action', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.NOTIFICATIONS),
    Notification.markActionMD
]);

module.exports = router;