#!/usr/bin/env node
'use strict';
var express = require('express');
var router = express.Router();

var Authentication = require('./authentication');
var ProductReference = require('./product_reference');
var Common = require('./common');
var Account = require('./account');
var Error = require('./error');
var Constants = require('../data/constants');

// To Create a new Product reference
router.post('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.PRODUCT_REFERENCES),
    ProductReference.createMD
]);

// get a Product reference
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    ProductReference.getProductReferenceMD
]);

// Update product-reference
router.patch('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.PRODUCT_REFERENCES),
    ProductReference.updateMD
]);

/*
* PRODUCT IMAGES APIs
* */
// Create a presigned url for each file
router.post('/upload/images', [
    Authentication.authorizeUserOrGatewayMD,
    Account.createS3AccountMD,
    ProductReference.checkFieldsMD,
    ProductReference.checkTotalImagesMD,
    ProductReference.deleteImageRecordMD,
    ProductReference.createImagePreSignedUrlMD
]);

// Update product image log record
router.patch('/images', [
    Authentication.authorizeUserOrGatewayMD,
    ProductReference.checkFieldsMD,
    ProductReference.updateImageLogsMD
]);

// Get image and imageLog api
router.get('/images', [
    Authentication.authorizeUserOrGatewayMD,
    ProductReference.getImageLogsMD
]);

// get original file url
router.get('/image', [
    Authentication.authorizeUserOrGatewayMD,
    ProductReference.getOriginalImageMD
]);

// delete image and imageLog api
router.delete('/images', [
    Authentication.authorizeUserOrGatewayMD,
    ProductReference.deleteProductImageLogsMD
]);

// Set image as a main image
router.patch('/image/main', [
    Authentication.authorizeUserOrGatewayMD,
    ProductReference.setMainProductImageMD
]);

module.exports = router;


