#!/usr/bin/env node
'use strict';

var Authentication = require('./authentication');
var Constants = require('../data/constants');
var Common = require('./common');
var SupplyItem = require('./supply_item');

var express = require('express');
var router = express.Router();

/*
*  SUPPLY ITEMS APIS
* */
//get all supply-items by account
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    SupplyItem.getSupplyItemsByAccountIdMD
]);

//search supply-items by sku/sellerSKUName/type/mpProductId/brand/UPC
router.get('/search', [
    Authentication.authorizeUserOrGatewayMD,
    SupplyItem.searchSupplyItems
]);

//search supply-item by sku query parameter
router.get('/search/sku', [
    Authentication.authorizeUserOrGatewayMD,
    SupplyItem.searchSupplyItemsBySKUMD
]);

//search supply-item by selletSKUName by query parameter
router.get('/search/sellerSKUName', [
    Authentication.authorizeUserOrGatewayMD,
    SupplyItem.searchSupplyItemsBySellerSKUNameMD
]);

//delete (move to archieve) multiple supply items
router.delete('/archieve', [
    Authentication.authorizeUserOrGatewayMD,
    SupplyItem.deleteArchieveItems
]);

//restore archieved mutiple supply items
router.patch('/restore', [
    Authentication.authorizeUserOrGatewayMD,
    SupplyItem.restoreArchieveItems
]);

//delete archieved multiple supply items
router.delete('/', [
    Authentication.authorizeUserOrGatewayMD,
    SupplyItem.deleteItems
]);

module.exports = router;