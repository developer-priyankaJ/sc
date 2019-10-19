#!/usr/bin/env node
'use strict';

var Authentication = require('./authentication');
var Common = require('./common');
var Error = require('./error');
var Constants = require('../data/constants');
var ChatGroup = require('./chat_group');

var express = require('express');
var router = express.Router();


//create group
router.post('/', [
    Authentication.authorizeUserOrGatewayMD,
    ChatGroup.create
]);

//send message
router.post('/message', [
    Authentication.authorizeUserOrGatewayMD,
    ChatGroup.sendMessage
]);

//get chat by id
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    ChatGroup.getChatById
]);

//get all message
router.get('/all', [
    Authentication.authorizeUserOrGatewayMD,
    ChatGroup.getChatByGroupId
]);

//get all name group
router.get('/name-group', [
    Authentication.authorizeUserOrGatewayMD,
    ChatGroup.getNameGroup
]);

//search in name group
router.get('/search/name-group', [
    Authentication.authorizeUserOrGatewayMD,
    ChatGroup.searchNameGroup
]);

//Update mark group message as read
router.patch('/', [
    Authentication.authorizeUserOrGatewayMD,
    ChatGroup.markGroupMessageAsRead
]);

module.exports = router;