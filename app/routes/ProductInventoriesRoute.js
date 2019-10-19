#!/usr/bin/env node
'use strict';

var Authentication = require('./authentication');
var Constants = require('../data/constants');
var Common = require('./common');
var ProductInventory = require('./product_inventory');

var express = require('express');
var router = express.Router();

/*
* PRODUCT INVENTORIES APIS
* */
//get all products-inventories by account
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    ProductInventory.getProductsInventoriesByAccountMD
]);

//Search  products-inventories
router.get('/search', [
    Authentication.authorizeUserOrGatewayMD,
    ProductInventory.searchProductsInventories
]);

//update multiple product inventories
router.patch('/', [
    Authentication.authorizeUserOrGatewayMD,
    ProductInventory.updateInventoriesMD
]);

//delete multiple product inventories
router.delete('/', [
    Authentication.authorizeUserOrGatewayMD,
    ProductInventory.deleteInventories
]);

//delete archieve multiple product inventories
router.delete('/archieve', [
    Authentication.authorizeUserOrGatewayMD,
    ProductInventory.deleteArchieveInventories
]);

//restore archieve multiple product inventories
router.patch('/restore', [
    Authentication.authorizeUserOrGatewayMD,
    ProductInventory.restoreArchieveInventories
]);

//Search product by sku
router.get('/search/sku', [
    Authentication.authorizeUserOrGatewayMD,
    ProductInventory.searchProductBySKUMD
]);

//Search product by seller sku name
router.get('/search/sellerSKUName', [
    Authentication.authorizeUserOrGatewayMD,
    ProductInventory.searchProductBySellerSKUNameMD
]);


module.exports = router;