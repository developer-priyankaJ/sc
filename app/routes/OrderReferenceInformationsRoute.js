#!/usr/bin/env node
'use strict';
var express = require('express');
var router = express.Router();

var Authentication = require('./authentication');
var Common = require('./common');
var OrderReferenceInformation = require('./order_reference_information');
var Constants = require('../data/constants');

/*
* ORDERS API
* */

//Get orders from account using timestamp
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    OrderReferenceInformation.getOrdersMD
]);

//search orders
router.get('/search', [
    Authentication.authorizeUserOrGatewayMD,
    OrderReferenceInformation.searchOrders
]);


module.exports = router;
