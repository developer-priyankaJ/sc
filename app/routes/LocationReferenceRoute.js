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

//Create Location reference
router.post('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.LOCATION_REFERENCE),
    LocationReference.createMD
]);

//Get Location Reference for logined user
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    LocationReference.getByAccountIdLocationIdMD
]);

//Update Location Reference
router.patch('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.LOCATION_REFERENCE),
    LocationReference.updateMD
]);

//Delete location reference
router.delete('/', [
    Authentication.authorizeUserOrGatewayMD,
    LocationReference.removeMD
]);


module.exports = router;