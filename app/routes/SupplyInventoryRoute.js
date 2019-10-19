#!/usr/bin/env node
'use strict';

var Authentication = require('./authentication');
var Constants = require('../data/constants');
var Common = require('./common');
var SupplyInventory = require('./supply_inventory');

var express = require('express');
var router = express.Router();

/*
* SUPPLY INVENTORY APIS
* */
// Create supply Inventory
router.post('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.SUPPLY_INVENTORY),
    SupplyInventory.create
]);

//get supply-inventory by id
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    SupplyInventory.getSupplyInventory
]);


//remove supply inventory (move to archieve)
router.delete('/', [
    Authentication.authorizeUserOrGatewayMD,
    SupplyInventory.remove
]);


//Get supply Inventory by supplyItemId
router.get('/supplyItemId', [
    Authentication.authorizeUserOrGatewayMD,
    SupplyInventory.getSupplyInventoryBySupplyItemId
]);


//update supply inventory
router.patch('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.SUPPLY_INVENTORY),
    SupplyInventory.update
]);

module.exports = router;