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

// Creating unit Of Measure
router.post('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.UNIT_OF_MEASURES),
    UnitOfMeasures.create
]);

//Update Unit of Measure
router.patch('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.UNIT_OF_MEASURES),
    UnitOfMeasures.update
]);

// Delete unit Of Measure
router.delete('/', [
    Authentication.authorizeUserOrGatewayMD,
    UnitOfMeasures.delete
]);

// Get UOM by id
router.get('/id', [
    Authentication.authorizeUserOrGatewayMD,
    UnitOfMeasures.getUnitOfMeasureById
]);


module.exports = router;