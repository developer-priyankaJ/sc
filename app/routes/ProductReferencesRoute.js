#!/usr/bin/env node
'use strict';
var express = require('express');
var router = express.Router();

var Authentication = require('./authentication');
var ProductReference = require('./product_reference');
var Common = require('./common');
var Error = require('./error');
var Constants = require('../data/constants');

//get All product-reference by accountId
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    ProductReference.getProductsByAccountIdMD
]);

// search product-reference
router.get('/search', [
    Authentication.authorizeUserOrGatewayMD,
    ProductReference.searchProductReference
]);

//Update multiple products
router.patch('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.PRODUCT_REFERENCES),
    ProductReference.updateProductsMD
]);

//delete (move to archieve) multiple products
router.delete('/archieve', [
    Authentication.authorizeUserOrGatewayMD,
    ProductReference.deleteArchieveItems
]);

//restore archieved mutiple products
router.patch('/restore', [
    Authentication.authorizeUserOrGatewayMD,
    ProductReference.restoreArchieveItems
]);

//delete archieved multiple products
/*router.delete('/', [
    Authentication.authorizeUserOrGatewayMD,
    ProductReference.deleteItems
]);*/

module.exports = router;


