#!/usr/bin/env node
'use strict';

var express = require('express');
var router = express.Router();

var Authentication = require('./authentication');
var Marketplace = require('./marketplace');
var Common = require('./common');
var Error = require('./error');

// List of Marketplace
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    Marketplace.getMarketplacesMD
]);

// List of mps for set Account mp
router.get('/sellers', [
    Authentication.authorizeUserOrGatewayMD,
    Marketplace.getMarketplacesDetailsForSellerMD
]);

// Get MarketPlaces which is not already added for account
router.get('/un-registered-mps-account', [
    Authentication.authorizeUserOrGatewayMD,
    Marketplace.getUnRegisteredMpsAccount
]);


module.exports = router;


