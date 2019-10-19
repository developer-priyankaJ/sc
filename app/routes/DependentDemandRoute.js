#!/usr/bin/env node
'use strict';

var Authentication = require('./authentication');
var Constants = require('../data/constants');
var Common = require('./common');
var DependentDemand = require('./dependent_demand');

var express = require('express');
var router = express.Router();

/*
*  DEPENDENT DEMAND APIS
* */
/*// Create Dependent Demand
router.post('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.DEPENDENT_DEMAND),
    DependentDemand.create
]);

// GET Dependent Demand
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    DependentDemand.getDependentDemand
]);

// UPDATE Dependent Demand
router.patch('/', [
    Authentication.authorizeUserOrGatewayMD,
    DependentDemand.updateDependentDemand
]);

// DELETE Dependent Demand
router.delete('/', [
    Authentication.authorizeUserOrGatewayMD,
    DependentDemand.deleteDependentDemand
]);

// SEARCH FOR BOM supply Items by productRefId
router.get('/search-supply', [
    Authentication.authorizeUserOrGatewayMD,
    DependentDemand.searchSupplyItemByProductRefId
]);*/

module.exports = router;