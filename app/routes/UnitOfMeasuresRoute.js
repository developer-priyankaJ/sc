#!/usr/bin/env node
'use strict';
var express = require('express');
var router = express.Router();

var Authentication = require('./authentication');
var Common = require('./common');
var UnitOfMeasures = require('./unit_of_measures');
var Constants = require('../data/constants');

/*
* unit Of Measures apis
* */

// Get unit Of Measure by category and accountId
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    UnitOfMeasures.getUnitOfMeasuresByAccountId
]);

// Get UOMs of same category by UOMId
router.get('/id', [
    Authentication.authorizeUserOrGatewayMD,
    UnitOfMeasures.getUnitOfMeasuresById
]);


module.exports = router;