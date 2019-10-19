#!/usr/bin/env node
'use strict';
var express = require('express');
var router = express.Router();

var Authentication = require('./authentication');
var CountryReference = require('./country_reference');
var Common = require('./common');
var Error = require('./error');
var Constants = require('../data/constants');

// To Create a new country reference
router.post('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.COUNTRY_REF),
    CountryReference.createMD
]);

// get a country reference
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    CountryReference.getCountryReferenceMD,
]);

// Update country-reference
router.patch('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.COUNTRY_REF),
    CountryReference.updateMD
]);

//delete country reference
router.delete('/', [
    Authentication.authorizeUserOrGatewayMD,
    CountryReference.removeMD
]);

module.exports = router;


