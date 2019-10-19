#!/usr/bin/env node
'use strict';

var express = require('express');
var router = express.Router();
var Authentication = require('./authentication');
var Common = require('./common');
var Constants = require('../data/constants');
var ContactRequest = require('./contactRequest');

/**
 * Support request APIs
 */

//Create support request
router.post('/', [
    Authentication.validateToken,
    ContactRequest.validateContactsRequest,
    ContactRequest.verifyRecaptcha,
    ContactRequest.createContactRequest,
    ContactRequest.sendEmailToSupport
]);

module.exports = router;