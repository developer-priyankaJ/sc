#!/usr/bin/env node
'use strict';
var express = require('express');
var router = express.Router();

var Authentication = require('./authentication');
var CountryReferences = require('./country_reference');
var Common = require('./common');
var Error = require('./error');
var Constants = require('../data/constants');

//get All country-reference
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    CountryReferences.getAllMD
]);


module.exports = router;


