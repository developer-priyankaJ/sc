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


//Get all notifications by notificationsIds
router.post('/all', [
    Authentication.authorizeUserOrGatewayMD,
    Notification.getAllNotificationsMD
]);

// Get Notifications
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    Notification.getNotificationsMD
]);

// Get Snooze Notifications
router.get('/snooze', [
    Authentication.authorizeUserOrGatewayMD,
    Notification.getSnoozeNotificationsMD
]);

// Get archive Notifications
router.get('/archive', [
    Authentication.authorizeUserOrGatewayMD,
    Notification.getArchiveNotificationsMD
]);


module.exports = router;