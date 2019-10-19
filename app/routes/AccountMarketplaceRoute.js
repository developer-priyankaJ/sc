#!/usr/bin/env node
'use strict';

var express = require('express');
var router = express.Router();

var Authentication = require('./authentication');
var AccountMarketplace = require('./account_marketplace');
var Common = require('./common');
var Error = require('./error');
var Constants = require('../data/constants');

// Add Account MarketPlace
router.post('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.ACCOUNT_MARKETPLACES),
    AccountMarketplace.createMD
]);

// Update status Account MarketPlace
router.patch('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.ACCOUNT_MARKETPLACES),
    AccountMarketplace.updateMD
]);

// Get Account MarketPlace
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    AccountMarketplace.getMD
]);

// Delete Account MarketPlace
router.delete('/', [
    Authentication.authorizeUserOrGatewayMD,
    AccountMarketplace.removeMD
]);

module.exports = router;


