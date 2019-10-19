#!/usr/bin/env node
'use strict';
var express = require('express');
var router = express.Router();

var Authentication = require('./authentication');
var Supplier = require('./supplier');
var Common = require('./common');
var Error = require('./error');
var Constants = require('../data/constants');

//Get all Customer By accountId
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    Supplier.getSupplierByAccountIdMD
]);

//search Supplier supplierName/supplierCode/firstName/lastName/email
router.get('/search', [
    Authentication.authorizeUserOrGatewayMD,
    Supplier.searchSuppliers
]);

//Delete Multiple Supplier (move to archieve)
router.delete('/', [
    Authentication.authorizeUserOrGatewayMD,
    Supplier.removeMD
]);

//Delete multiple supplier (actual delete)
router.delete('/archieve', [
    Authentication.authorizeUserOrGatewayMD,
    Supplier.delete
]);

//Restore multiple supplier
router.patch('/restore', [
    Authentication.authorizeUserOrGatewayMD,
    Supplier.restore
]);

module.exports = router;


