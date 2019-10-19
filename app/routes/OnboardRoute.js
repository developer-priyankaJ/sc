#!/usr/bin/env node
'use strict';
var express = require('express');
var router = express.Router();

var Authentication = require('./authentication');
var ProductReference = require('./product_reference');
var ProductByMp = require('./product_by_mp');
var Common = require('./common');
var Error = require('./error');
var Constants = require('../data/constants');

//onboard api for insert products in product-reference and product by mp table
router.post('/products', [
    Authentication.authorizeUserOrGatewayMD,
    ProductReference.addProductReferencesMD,
]);

//onboard api for get all products form productByMp table
router.get('/products', [
    Authentication.authorizeUserOrGatewayMD,
    ProductByMp.getAllProductByMpListMD
]);

//onboard api for validate Authorization and insert product in productByMP table
router.get('/seller-authorization', [
    Authentication.authorizeUserOrGatewayMD,
    ProductByMp.validateAuthorizationMD
]);

module.exports = router;


