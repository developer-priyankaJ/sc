#!/usr/bin/env node
'use strict';
var express = require('express');
var router = express.Router();

var Authentication = require('./authentication');
var Supplier = require('./supplier');
var Common = require('./common');
var Error = require('./error');
var Constants = require('../data/constants');

//Create Supplier
router.post('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.SUPPLIER),
    Supplier.createMD
]);

//Get Single Supplier By accountId and SupplierUUID
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    Supplier.getByIdAndAccountIdMD
]);

//Get Single Supplier By accountId and SupplierId
router.get('/SupplierId', [
    Authentication.authorizeUserOrGatewayMD,
    Supplier.getByAccountIdAndSupplierIdMD,
]);

// Update Supplier
router.patch('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.SUPPLIER),
    Supplier.updateMD
]);

//Invite Supplier
router.post('/invite', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.SUPPLIER),
    Supplier.inviteMD
]);

//Get suppliers and customers
router.get('/partners', [
    Authentication.authorizeUserOrGatewayMD,
    Supplier.getSupplierAndCustomerMD
]);

//resend invitation to customer
router.post('/reminder', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.SUPPLIER),
    Supplier.reminder
]);

//resend invitation to customer
router.post('/re-send', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.SUPPLIER),
    Supplier.reSendInvitation
]);

//Cancel invitation
router.patch('/cancel', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.SUPPLIER),
    Supplier.cancel
]);

//Add and invite supplier
router.post('/add-invite', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.SUPPLIER),
    Supplier.addInvite
]);

module.exports = router;


