#!/usr/bin/env node
'use strict';
var express = require('express');
var router = express.Router();

var Authentication = require('./authentication');
var Common = require('./common');
var OrderReferenceInformation = require('./order_reference_information');
var OrderLineItem = require('./order_line_items');
var Constants = require('../data/constants');

/*
* ORDER ITEM API
* */

//Get all items of particular order
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    OrderReferenceInformation.getItemsByOrderIdMD
]);

// Get all order line items by accountId
router.get('/all', [
    Authentication.authorizeUserOrGatewayMD,
    OrderLineItem.getAllOrderLineItem

]);

// Search order line items
router.get('/search', [
    Authentication.authorizeUserOrGatewayMD,
    OrderLineItem.searchOrderLineItem

]);


module.exports = router;
