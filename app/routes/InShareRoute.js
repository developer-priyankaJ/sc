#!/usr/bin/env node
'use strict';

var Authentication = require('./authentication');
var InShare = require('./in_share');
var User = require('./user');
var Common = require('./common');
var Error = require('./error');
var Constants = require('../data/constants');

var express = require('express');
var router = express.Router();

//Create InShare
router.post('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.OUT_SHARING),
    InShare.createMD
]);

//Get in Share by id
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    InShare.getByIdAndAccountIdMD
]);

//Get in Share by account
router.get('/by-account', [
    Authentication.authorizeUserOrGatewayMD,
    InShare.getByAccountIdMD
]);

//Search in Share by inShareId / inShareName
router.get('/search', [
    Authentication.authorizeUserOrGatewayMD,
    InShare.searchInShares
]);

//Get sharing error log by inShareId
router.get('/error-log', [
    Authentication.authorizeUserOrGatewayMD,
    InShare.getErrorLogByInShareId
]);

//Get in Share by account
router.post('/internal', [
    //Authentication.authorizeUserOrGatewayMD,
    InShare.createInternalMD
]);

//update in Share action
router.patch('/action', [
    Authentication.authorizeUserOrGatewayMD,
    InShare.updateActionMD
]);

//update in Share record
router.patch('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.IN_SHARE),
    InShare.update
]);

//Delete in Share
router.delete('/', [
    Authentication.authorizeUserOrGatewayMD,
    InShare.delete
]);

//Expired In share record (call from sharing cron job)
router.patch('/expire-remind', [
    Authentication.validateToken,
    InShare.expiredRemindInShare
]);

/*
* SHARING ALERT RELATED API (NEW API)
* */




/*
* SHARING ALERT RELATED API (OLD API)
* */
//Create Sharing alert api
router.post('/alert', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.IN_SHARE_ALERT),
    InShare.createInShareAlert
]);

//Update Sharing alert api
router.patch('/alert', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.IN_SHARE_ALERT),
    InShare.updateInShareAlert
]);

//Get Sharing alert api
router.get('/alert', [
    Authentication.authorizeUserOrGatewayMD,
    InShare.getInShareAlert
]);

//Get all raised Sharing alert api by shareItemType
router.get('/alert/type', [
    Authentication.authorizeUserOrGatewayMD,
    InShare.getInShareAlertByItemType
]);

//Delete Sharing alert api
router.delete('/alert', [
    Authentication.authorizeUserOrGatewayMD,
    InShare.deleteInShareAlert
]);

// Check for alert and raise alert
router.post('/alert/check', [
    Authentication.validateToken,
    InShare.checkAndRaiseAlert
]);

//Get count of alert
router.get('/alert/count', [
    Authentication.authorizeUserOrGatewayMD,
    InShare.getRaisedAlertCount
]);

//Update the raised alert by isRead = 1
router.patch('/alert/read', [
    Authentication.authorizeUserOrGatewayMD,
    InShare.updateAsReadAlert
]);

//Update the multiple raised alert by isRead = 1
router.patch('/alert/type/read', [
    Authentication.authorizeUserOrGatewayMD,
    InShare.updateAsReadAlertByIds
]);


/*
* Share Item mapping apis
* */
router.post('/mapping', [
    Authentication.authorizeUserOrGatewayMD,
    InShare.validateMapShareItems,
    InShare.mapShareItems
]);

/*
* Get ShareItems
* */
router.get('/mapping', [
    Authentication.authorizeUserOrGatewayMD,
    InShare.getMappedShareItems
]);

/*
* Remove the mapping by id
* */
router.patch('/mapping', [
    Authentication.authorizeUserOrGatewayMD,
    InShare.updateMappedShareItems
]);

/*
* Get Partners(outSharePartners) who shares item with me
* */
router.get('/mapping/partners', [
    Authentication.authorizeUserOrGatewayMD,
    InShare.getOutSharePartners
]);

/*
* Get Share Items by outShare parnters
* */
router.get('/mapping/share-items', [
    Authentication.authorizeUserOrGatewayMD,
    InShare.getShareItemsByOutSharePartners
]);


module.exports = router;


