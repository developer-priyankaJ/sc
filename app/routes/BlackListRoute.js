#!/usr/bin/env node
'use strict';

var Authentication = require('./authentication');
var BlackList = require('./black_list');
var User = require('./user');
var Common = require('./common');
var Error = require('./error');
var Constants = require('../data/constants');

var express = require('express');
var router = express.Router();

//Create a blacklist records
router.post('/', [
    Authentication.authorizeAdminMD,
    Common.checkInvalidField(Constants.FIELDS.BLACK_LIST),
    BlackList.createBlackListMD
]);

// Update record
router.patch('/', [
    Authentication.authorizeAdminMD,
    Common.checkInvalidField(Constants.FIELDS.BLACK_LIST),
    BlackList.updateMD
]);

// To validate black list
router.patch('/check', [
    Authentication.authorizeAdminMD,
    User.validateEmailFields,
    BlackList.checkBlackListMD,
    BlackList.validateBlackListMD
]);

// get blacklist
router.get('/', [
    Authentication.authorizeAdminMD,
    BlackList.getAllBlackListMD
]);

// Delete a Role
router.delete('/', [
    Authentication.authorizeAdminMD,
    BlackList.removeBlackListMD
]);

module.exports = router;


