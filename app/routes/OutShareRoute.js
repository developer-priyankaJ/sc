#!/usr/bin/env node
'use strict';

var Authentication = require('./authentication');
var OutSharing = require('./out_sharing');
var OutShareInstance = require('./out_share_instance');
var User = require('./user');
var Common = require('./common');
var Error = require('./error');
var Constants = require('../data/constants');

var express = require('express');
var router = express.Router();

//OUT SHARE INSTANCES
//Create Out Share Instance
router.post('/instance', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.OUT_SHARING),
    OutShareInstance.createMD
]);

//Get Out Share Instances for logined user
router.get('/instance', [
    Authentication.authorizeUserOrGatewayMD,
    OutShareInstance.getByIdAndAccountIdMD
]);

//Update Out Share Instance
router.patch('/instance', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.OUT_SHARING),
    OutShareInstance.updateMD
]);

// Delete Out Share Instances
router.delete('/instances', [
    Authentication.authorizeUserOrGatewayMD,
    OutShareInstance.delete
]);


//Get Out Share Instances for logined user
router.get('/instances', [
    Authentication.authorizeUserOrGatewayMD,
    OutShareInstance.getByAccountIdMD
]);

//Search Out Share Instances by outShareId , outShareName
router.get('/instances/search', [
    Authentication.authorizeUserOrGatewayMD,
    OutShareInstance.searchOutShares
]);

//Get Out Share Instances by shareItemIds and profile id
router.post('/instances/by-item-profile', [
    Authentication.authorizeUserOrGatewayMD,
    OutShareInstance.getByItemIdsAndProfileIdMD
]);

//Search by partnerName
router.get('/partners/search/partnerName', [
    Authentication.authorizeUserOrGatewayMD,
    OutShareInstance.searchByPartnerNameMD
]);

//Search product-inventories by sku
router.get('/product-inventories/search/sku', [
    Authentication.authorizeUserOrGatewayMD,
    OutShareInstance.searchProductBySKUMD
]);

//Search product-inventories by sellerSKUName
router.get('/product-inventories/search/sellerSKUName', [
    Authentication.authorizeUserOrGatewayMD,
    OutShareInstance.searchProductBySellerSKUNameMD
]);

//Search supply-inventories by sku
router.get('/supply-inventories/search/sku', [
    Authentication.authorizeUserOrGatewayMD,
    OutShareInstance.searchSupplyInventoryBySKU
]);

//Search supply-inventories by sellerSKUName
router.get('/supply-inventories/search/sellerSKUName', [
    Authentication.authorizeUserOrGatewayMD,
    OutShareInstance.searchSupplyInventoryBySellerSKUName
]);

//Search product Reference by sku (for dependent demand sharing)
router.get('/product/search/sku', [
    Authentication.authorizeUserOrGatewayMD,
    OutShareInstance.searchProductBySKUDependentDemand
]);

//Search product Reference by sellerSKUName (for dependent demand sharing)
router.get('/product/search/sellerSKUName', [
    Authentication.authorizeUserOrGatewayMD,
    OutShareInstance.searchProductBySellerSKUNameDependentDemand
]);

//OUT SHARE PROFILES
//Get Out Sharing profile by accountId and id
router.get('/profile', [
    Authentication.authorizeUserOrGatewayMD,
    OutSharing.getByAccountIdAndProfileIdMD
]);

//Get Out Sharings profiles by accountId
router.get('/profiles', [
    Authentication.authorizeUserOrGatewayMD,
    OutSharing.getByAccountIdMD
]);

/*//Create Out Sharing
router.post('/profile', [
    Authentication.authorizeUserOrGatewayMD,
    OutSharing.createMD
]);*/

//Get Out Sharings by accountId
router.get('/data-items', [
    Authentication.authorizeUserOrGatewayMD,
    OutSharing.getDataItemsMD
]);

//create shared data record (call from sharing cron job)
router.post('/shared-data', [
    Authentication.validateToken,
    OutSharing.createSharedData
]);

//create shared data record (call from update inventory api/import order api)
router.post('/shared-data/real-time', [
    Authentication.validateToken,
    OutSharing.createRealTimeSharedData
]);

//get shared data record for productInventory by outShareInstanceId (for shared with me screen)
router.get('/shared-data', [
    Authentication.authorizeUserOrGatewayMD,
    OutSharing.getSharedDataByOutShareId
]);

//get shared data record for productInventory by outShareInstanceId (for shared by me screen)
router.get('/shared-data/id', [
    Authentication.authorizeUserOrGatewayMD,
    OutSharing.getSharedDataForOutShare
]);

//get sharing Error Log by outShareInstanceId
router.get('/error-log', [
    Authentication.authorizeUserOrGatewayMD,
    OutSharing.getSharingErrorLogByOutShareId
]);

// Check if any out outshare is exist or not for given partners
router.patch('/check', [
    Authentication.authorizeUserOrGatewayMD,
    OutSharing.checkOutShares
]);

// Check if any out outshare is exist or not for given shareItems
router.patch('/check/shareItem', [
    Authentication.authorizeUserOrGatewayMD,
    OutSharing.checkOutSharesByShareItems
]);

//get shared data record for download a csv files
router.get('/shared-data/download', [
    Authentication.authorizeUserOrGatewayMD,
    OutSharing.getSharedDataForDownload
]);

//get existing outshare details (same partner and same items)
router.get('/check/existing', [
  Authentication.authorizeUserOrGatewayMD,
    OutShareInstance.getExistingOutShareDetails
]);


module.exports = router;


