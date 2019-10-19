#!/usr/bin/env node
'use strict';

var Authentication = require('./authentication');
var Account = require('./account');
var Constants = require('../data/constants');
var Common = require('./common');
var SupplyItem = require('./supply_item');

var express = require('express');
var router = express.Router();

/*
*  SUPPLY ITEMS APIS
* */
//Create supply item
router.post('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.SUPPLY_ITEMS),
    SupplyItem.createMD
]);

//get all supply-items by supplyItem id
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    SupplyItem.getSupplyItemsByIdMD
]);

//remove supply item
router.delete('/', [
    Authentication.authorizeUserOrGatewayMD,
    SupplyItem.removeMD
]);

//Update supply item
router.patch('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.SUPPLY_ITEMS),
    SupplyItem.updateMD
]);


/*
* Supply Item IMAGES APIs
* */
// Create a presigned url for each file
router.post('/upload/images', [
    Authentication.authorizeUserOrGatewayMD,
    Account.createS3AccountMD,
    SupplyItem.checkFields,
    SupplyItem.checkTotalImages,
    SupplyItem.deleteImageRecord,
    SupplyItem.createImagePreSignedUrl
]);

// Update supply image log record
router.patch('/images', [
    Authentication.authorizeUserOrGatewayMD,
    SupplyItem.checkFields,
    SupplyItem.updateImageLogs
]);

// Get image and imageLog api
router.get('/images', [
    Authentication.authorizeUserOrGatewayMD,
    SupplyItem.getImageLogs
]);

// get original file url
router.get('/image', [
    Authentication.authorizeUserOrGatewayMD,
    SupplyItem.getOriginalImage
]);

// delete image and imageLog api
router.delete('/images', [
    Authentication.authorizeUserOrGatewayMD,
    SupplyItem.deleteSupplyImageLogs
]);

// Set image as a main image
router.patch('/image/main', [
    Authentication.authorizeUserOrGatewayMD,
    SupplyItem.setMainSupplyImage
]);


module.exports = router;