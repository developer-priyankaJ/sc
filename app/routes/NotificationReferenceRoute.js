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

// Create a new Notification Reference
router.post('/', [
    /*Authentication.authorizeAdmin,*/
    NotificationReference.createMD
]);

// Update Notification Reference
router.patch('/', [
    Authentication.authorizeAdminMD,
    NotificationReference.updateMD
]);

// Delete a Notification Reference
router.delete('/', [
    /*Authentication.authorizeAdminMD,*/
    NotificationReference.removeMD
]);

module.exports = router;