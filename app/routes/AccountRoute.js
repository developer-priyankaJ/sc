#!/usr/bin/env node
'use strict';

var Authentication = require('./authentication');
var Account = require('./account');
var Common = require('./common');
var Constants = require('../data/constants');

var express = require('express');
var router = express.Router();


/**
 * Account APIs(MariaDB)
 */
// Get account
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    Authentication.isAccountEnabled,
    Account.getAccountMD
]);

// Update account
router.patch('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.ACCOUNTS),
    Authentication.isAccountEnabled,
    Authentication.isAccountAdminMD,
    Account.updateAccountMD
]);

//Deactivate Account
router.delete('/', [
    Authentication.authorizeUserOrGatewayMD,
    Authentication.isAccountEnabled,
    Authentication.isAccountAdminMD,
    Account.deactivateAccountMD
]);

//Activate Account
router.patch('/activate', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.ACCOUNTS),
    Authentication.isAccountAdminMD,
    Account.activateAccountMD
]);

//add encryption keys for Account
router.patch('/encryption', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.ACCOUNTS),
    Authentication.isAccountAdminMD,
    Account.updateEncryptionKeys
]);

//Reactivate Account
router.patch('/reactivate', [
    Authentication.authorizeUserOrGatewayMD,
    Authentication.isAccountAdminMD,
    Account.reactivateAccountMD
]);

//Close Account
router.patch('/close', [
    Authentication.authorizeUserOrGatewayMD,
    Authentication.isAccountEnabled,
    Authentication.isAccountAdminMD,
    Account.closeAccountMD
]);

module.exports = router;