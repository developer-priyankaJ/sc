#!/usr/bin/env node
'use strict';
var express = require('express');
var router = express.Router();

var Authentication = require('./authentication');
var ProductByMp = require('./product_by_mp');
var Common = require('./common');
var Error = require('./error');
var Constants = require('../data/constants');

//List/Copy products into different marketplace store it in ProductByMp table
//create entry in productByMp table
router.post('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.PRODUCT_BY_MP),
    ProductByMp.createMD
]);

//get detail of product by ASIN and mpId
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    ProductByMp.getProductByMpDetailByASINAndMPMD
]);

//get product all details by id
router.get('/details', [
    Authentication.authorizeUserOrGatewayMD,
    ProductByMp.getProductByMpDetailById
]);

//Get pricing detail from product by mp by mpId and productRefId
router.get('/price', [
    Authentication.authorizeUserOrGatewayMD,
    ProductByMp.getProductByMpDetailByMpIdProductRefId
]);

//get mpIds of product by productRefId
router.get('/mpIds', [
    Authentication.authorizeUserOrGatewayMD,
    ProductByMp.getProductByMpDetailByProductRef,
]);

//Get submitfeed status-report
router.get('/submitfeed-report', [
    ProductByMp.getSubmitfeedReportMD
]);

//Update Product Quantity/Inventory
router.patch('/quantity', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.PRODUCT_BY_MP),
    ProductByMp.updateQuantityMD
]);

//update price/detail of product by mp in scopehub db
router.patch('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.PRODUCT_BY_MP),
    ProductByMp.updateMD
]);

//Update Product Price on seller central
router.patch('/price', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.PRODUCT_BY_MP),
    ProductByMp.updatePriceMD
]);

module.exports = router;


