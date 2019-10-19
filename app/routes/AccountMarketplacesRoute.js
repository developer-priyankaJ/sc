#!/usr/bin/env node
'use strict';

var express = require('express');
var router = express.Router();

var Authentication = require('./authentication');
var AccountMarketplace = require('./account_marketplace');
var Common = require('./common');
var Error = require('./error');
var Constants = require('../data/constants');

// List Account MarketPlace
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    AccountMarketplace.listByAccountMD,
]);

// Get Account MarketPlace where product is not already listed on
router.get('/un-listed-mps-product', [
    Authentication.authorizeUserOrGatewayMD,
    AccountMarketplace.getUnlistedMpsProduct
]);

module.exports = router;


