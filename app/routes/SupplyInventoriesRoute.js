#!/usr/bin/env node
'use strict';

var Authentication = require('./authentication');
var Constants = require('../data/constants');
var Common = require('./common');
var SupplyInventory = require('./supply_inventory');

var express = require('express');
var router = express.Router();

/*
* SUPPLY INVENTORIES APIS
* */
//get all supply-inventories by account
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    SupplyInventory.getSupplyInventoriesByAccount
]);

//Search supply-inventories
router.get('/search', [
    Authentication.authorizeUserOrGatewayMD,
    SupplyInventory.searchSupplyInventories
]);

//update multiple supply inventories
router.patch('/', [
    Authentication.authorizeUserOrGatewayMD,
    SupplyInventory.updateInventories
]);

//delete(move to archive) multiple supply inventories
router.delete('/', [
    Authentication.authorizeUserOrGatewayMD,
    SupplyInventory.deleteInventories
]);

//delete archived multiple supply inventories
router.delete('/archieve', [
    Authentication.authorizeUserOrGatewayMD,
    SupplyInventory.deleteArchieveInventories
]);


//restore archived multiple supply inventories
router.patch('/restore', [
    Authentication.authorizeUserOrGatewayMD,
    SupplyInventory.restoreArchiveInventories
]);

/*
//Search supply by sku
router.get('/search/sku', [
    Authentication.authorizeUserOrGatewayMD,
    SupplyInventory.searchSupplyBySKU
]);
//Search product by seller sku name
router.get('/search/sellerSKUName', [
    Authentication.authorizeUserOrGatewayMD,
    SupplyInventory.searchProductBySellerSKUNameMD
]);*/


module.exports = router;