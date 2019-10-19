#!/usr/bin/env node
'use strict';

var Authentication = require('./authentication');
var Constants = require('../data/constants');
var Common = require('./common');
var ProductInventory = require('./product_inventory');

var express = require('express');
var router = express.Router();

/*
* PRODUCT INVENTORY APIS
* */
// Create product Inventory
router.post('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.PRODUCT_INVENTORY),
    ProductInventory.createMD
]);

//get products-inventory by id
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    ProductInventory.getProductInventoryMD
]);

//remove product inventory
router.delete('/', [
    Authentication.authorizeUserOrGatewayMD,
    ProductInventory.removeMD
]);

//Get product Inventory by productRefId
router.get('/productRefId', [
    Authentication.authorizeUserOrGatewayMD,
    ProductInventory.getProductInventoryByProductRefIdMD
]);

//update product inventory
router.patch('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.PRODUCT_INVENTORY),
    ProductInventory.updateMD
]);

module.exports = router;