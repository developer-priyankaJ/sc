#!/usr/bin/env node
'use strict';
var express = require('express');
var router = express.Router();

var Authentication = require('./authentication');
var Common = require('./common');
var NotificationReference = require('./notification_reference');
var Constants = require('../data/constants');

/*
* NOTIFICATION REFERENCE APIS
* */

// List of Notification References
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    NotificationReference.getLanguageCultureCodeNotificationsMD,
]);


module.exports = router;