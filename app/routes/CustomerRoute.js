#!/usr/bin/env node
'use strict';
var express = require('express');
var router = express.Router();

var Authentication = require('./authentication');
var Customer = require('./customer');
var Common = require('./common');
var Error = require('./error');
var Constants = require('../data/constants');

//Create Customer
router.post('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.CUSTOMERS),
    Customer.createMD
]);

//Get Single Customer By accountId and customerUUID
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    Customer.getByIdAndAccountIdMD
]);

//Get Single Customer By accountId and customerId
router.get('/customerId', [
    Authentication.authorizeUserOrGatewayMD,
    Customer.getByAccountIdAndCustomerIdMD
]);

// Update Customer
router.patch('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.CUSTOMERS),
    Customer.updateMD
]);

//Invite customer
router.post('/invite', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.CUSTOMERS),
    Customer.inviteMD
]);

//Send reminder to customer
router.post('/reminder', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.CUSTOMERS),
    Customer.reminder
]);

//resend invitation to customer
router.post('/re-send', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.CUSTOMERS),
    Customer.reSendInvitation
]);

//resend invitation to customer
router.patch('/cancel', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.CUSTOMERS),
    Customer.cancel
]);

//Add and invite customer
router.post('/add-invite', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.CUSTOMERS),
    Customer.addInvite
]);

module.exports = router;


