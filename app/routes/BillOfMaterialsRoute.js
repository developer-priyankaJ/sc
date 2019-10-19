#!/usr/bin/env node
'use strict';

var Authentication = require('./authentication');
var Constants = require('../data/constants');
var Common = require('./common');
var BillOfMaterials = require('./bill_of_materials');

var express = require('express');
var router = express.Router();

/*
*  BILL OF MATERIALS APIS
* */
// Create Bill Of Material
router.post('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.BILL_OF_MATERIAL),
    BillOfMaterials.createMD
]);

// Get Bill Of Material
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    BillOfMaterials.getBillOfMaterialMD
]);

// Delete Bill Of Material
router.delete('/', [
    Authentication.authorizeUserOrGatewayMD,
    BillOfMaterials.deleteMD
]);

// Update Bill Of Material
router.patch('/', [
    Authentication.authorizeUserOrGatewayMD,
    BillOfMaterials.updateMD
]);


module.exports = router;