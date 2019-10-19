#!/usr/bin/env node
'use strict';

var express = require('express');
var router = express.Router();

var Authentication = require('./authentication');
var User = require('./user');
var Common = require('./common');
var Constants = require('../data/constants');
var BlackList = require('./black_list');

/**
 * Authorize User
 */

//Only add authorize user.
router.post('/add', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.USERS),
    User.validateEmailFields,
    User.createMD,
    User.assignRole
]);

//only invite Authorize user
router.post('/invite', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.USERS),
    User.validateEmailFields,
    User.inviteMD
]);

//To get the all Authorize User.
router.get('/getAllUser', [
    Authentication.authorizeUserOrGatewayMD,
    Authentication.isAccountAdminMD,
    User.getAllAuthorizedUserMD
]);

//TO add and invite Authorize user
router.post('/add-invite', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.USERS),
    User.validateEmailFields,
    BlackList.checkBlackListMD,
    User.addInviteMD
]);


//To decline-invite
router.patch('/decline-invite', [
    Authentication.validateToken,
    Common.checkInvalidField(Constants.FIELDS.USERS),
    User.declineAuthorizedUserInvitationMD
]);

//To cancel authorize user.
router.patch('/cancel', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.USERS),
    User.cancelMD
]);

// Deactive authorize user
router.patch('/deactivate', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.USERS),
    User.cancelUserMD,
    User.deActivateMD
]);

// Re-invite authorize user
router.post('/re-invite', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.USERS),
    User.validateUserIdMD,
    User.reInviteMD
]);

// Get authorize user
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    User.getAuthorizedUserMD
]);

// Update authorize user
router.patch('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.USERS),
    User.updateAuthorizedUserMD,
    User.updateRolesMD
]);

module.exports = router;