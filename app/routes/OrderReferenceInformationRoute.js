#!/usr/bin/env node
'use strict';
var express = require('express');
var router = express.Router();

var Authentication = require('./authentication');
var Common = require('./common');
var OrderReferenceInformation = require('./order_reference_information');
var Constants = require('../data/constants');

/*
* REPLICATION SETTINGS API
* */

//Create replication Setting
router.post('/replicationSetting', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.ORDERS),
    OrderReferenceInformation.createReplicationSettingMD
]);

//Update replication Setting
router.patch('/replicationSetting', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.ORDERS),
    OrderReferenceInformation.updateReplicationSettingMD
]);

//Get replication Setting by accountId
router.get('/replicationSetting', [
    Authentication.authorizeUserOrGatewayMD,
    OrderReferenceInformation.getReplicationSettingMD
]);

//Get ReplicationLogs for history
router.get('/replicationSetting/history', [
    Authentication.authorizeUserOrGatewayMD,
    OrderReferenceInformation.getReplicationHistoryMD
]);

//Import orders from amazon and store in DB using replication
router.get('/replicate', [
    Authentication.validateToken,
    OrderReferenceInformation.importOrdersMD
]);

//Get Order by OrderRefId
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    OrderReferenceInformation.getOrderByIdMD
]);

/*
* Orders api
* */
// Create Order
router.post('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.ORDERS),
    OrderReferenceInformation.createOrder
]);

// Edit Order
router.patch('/',[
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.ORDERS),
    OrderReferenceInformation.editOrder
]);

module.exports = router;
