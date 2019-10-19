#!/usr/bin/env node
'use strict';
var express = require('express');
var router = express.Router();

var Authentication = require('./authentication');
var Marketplace = require('./marketplace');
var Common = require('./common');
var Error = require('./error');
var Constants = require('../data/constants');

// To retrieve a specific Marketplace
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    Marketplace.getMarketplaceMD
]);

// To Create a new Marketplace
router.post('/', [
    Authentication.authorizeAdminMD,
    Common.checkInvalidField(Constants.FIELDS.MARKETPLACES),
    Marketplace.createMD
]);

// Update Marketplace
router.patch('/', [
    Authentication.authorizeAdminMD,
    Common.checkInvalidField(Constants.FIELDS.MARKETPLACES),
    Marketplace.updateMarketplaceMD
]);

// Delete a Marketplace
router.delete('/', [
    Authentication.authorizeAdminMD,
    Marketplace.removeMarketplaceMD
]);

module.exports = router;


