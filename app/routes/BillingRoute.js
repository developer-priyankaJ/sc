#!/usr/bin/env node
'use strict';

var express = require('express');
var router = express.Router();

var Authentication = require('./authentication');
var Common = require('./common');
var Constants = require('../data/constants');
var Billing = require('./billing');
var Account = require('./account');

/**
 * Billing APIs
 */

//Calculate daily billing for all billing line item
router.post('/daily', [
    Authentication.validateToken,
    Billing.calculateRegisteredUserDailyBill,
    Billing.calculateInboudDailyBill,
    Billing.calculateOutboundDailyBill,
    Billing.calculateInSharingDailyBill,
    Billing.calculateOutSharingDailyBill,
    Billing.updateBillingControl
]);

//Calculate monthly billing for all billing line item
router.post('/cycle', [
    Authentication.validateToken,
    Billing.getAccountById,
    Account.createS3AccountMD,
    Billing.createInvoice,
    Billing.calculateMonthlyBill,
    Billing.generateBillPDF,
    Billing.updateInvoice,
    Billing.sendEmailToOwner,
    Billing.uploadFileToS3,
    Billing.updateBillingCycle,
    Billing.updateBillInvoiceControl
]);

//Get monthly billing of account
router.get('/monthly', [
    Authentication.authorizeUserOrGatewayMD,
    Billing.getMonthlyBill
]);

//Get daily billing of account
router.get('/daily', [
    Authentication.authorizeUserOrGatewayMD,
    Billing.getDailyBill
]);

//Get upload detail with size and amount
router.get('/detail', [
    Authentication.authorizeUserOrGatewayMD,
    Billing.getBillDetail
]);

//Get upload detail with size and amount
router.get('/yearly', [
    Authentication.authorizeUserOrGatewayMD,
    Billing.getYearlyBill
]);

//Get users detail
router.get('/users', [
    Authentication.authorizeUserOrGatewayMD,
    Billing.getUsersBill
]);

//Get url for download invoice
router.get('/download',[
    Authentication.authorizeUserOrGatewayMD,
  Billing.downloadInvoiceUrl
]);

module.exports = router;