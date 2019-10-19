#!/usr/bin/env node
'use strict';
var express = require('express');
var router = express.Router();

var Authentication = require('./authentication');
var Common = require('./common');
var UnitOfMeasureCategory = require('./unit_of_measure_category');
var Constants = require('../data/constants');

/*
     Unit Of Measure Category
    */
// Create unit of measure Category table
router.post('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.UNIT_OF_MEASURE_CATEGORY),
    UnitOfMeasureCategory.create
]);

//Get all Unit Of Measure Category
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    UnitOfMeasureCategory.getUnitOfMeasureCategoryByAccountId
]);

//get single Unit Of Measure Category
router.get('/category', [
    Authentication.authorizeUserOrGatewayMD,
    UnitOfMeasureCategory.getUnitOfMeasureCategoryByCategoryId
]);

//Update Unit Of Measure Category
router.patch('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.UNIT_OF_MEASURE_CATEGORY),
    UnitOfMeasureCategory.update
]);

//Delete Unit Of Measure Category
router.delete('/', [
    Authentication.authorizeUserOrGatewayMD,
    UnitOfMeasureCategory.delete
]);


module.exports = router;