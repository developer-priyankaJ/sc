#!/usr/bin/env node
'use strict';
var express = require('express');
var router = express.Router();

var Authentication = require('./authentication');
var Customer = require('./customer');
var Common = require('./common');
var Error = require('./error');
var Constants = require('../data/constants');

//Get all Customer By accountId
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    Customer.getCustomersByAccountIdMD
]);
//Search Customer By customerName/customerCode/firstName/lastName/email
router.get('/search', [
    Authentication.authorizeUserOrGatewayMD,
    Customer.searchCustomers
]);

//Delete multiple Customers (move to archieve)
router.delete('/', [
    Authentication.authorizeUserOrGatewayMD,
    Customer.removeMD
]);

//Delete multiple customers (actual delete)
router.delete('/archieve', [
    Authentication.authorizeUserOrGatewayMD,
    Customer.delete
]);

//Restore muiltiple customers 
router.patch('/restore', [
    Authentication.authorizeUserOrGatewayMD,
    Customer.restore
]);

module.exports = router;


