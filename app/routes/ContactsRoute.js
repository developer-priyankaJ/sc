#!/usr/bin/env node
'use strict';
var express = require('express');
var router = express.Router();

var Authentication = require('./authentication');
var Common = require('./common');
var Contact = require('./contact');
var Constants = require('../data/constants');

/*
* CONTACT APIS
* */

// get all contacts by inviterUUID
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    Contact.getContactListMD
]);

//remove multiple contacts
router.delete('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.CONTACT),
    Contact.removeContactsMD
]);

module.exports = router;