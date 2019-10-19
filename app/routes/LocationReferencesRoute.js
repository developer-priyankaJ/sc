#!/usr/bin/env node
'use strict';

var Authentication = require('./authentication');
var LocationReference = require('./location_reference');
var Constants = require('../data/constants');
var Common = require('./common');

var express = require('express');
var router = express.Router();

/*
* LOCATION REFERENCE APIS
* */
//Get Location Reference List by accountId
router.get('/list', [
    Authentication.authorizeUserOrGatewayMD,
    LocationReference.getLocationReferenceByAccountIdMD
]);

//Search Location Reference by locationId/locationName/email/state/additionalLocationCode/additionalLocationName
router.get('/search', [
    Authentication.authorizeUserOrGatewayMD,
    LocationReference.searchLocationReferences
]);

//Get Location Reference id and name by accountid
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    LocationReference.getLocationReferenceDetailByAccountIdMD
]);

//Delete multiple location reference
router.put('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.LOCATION_REFERENCE),
    LocationReference.removeMultipleMD
]);

module.exports = router;