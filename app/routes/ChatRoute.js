#!/usr/bin/env node
'use strict';

var Authentication = require('./authentication');
var Common = require('./common');
var Error = require('./error');
var Constants = require('../data/constants');
var Chat = require('./chat');

var express = require('express');
var router = express.Router();


//create chat
router.post('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.CHAT),
    Chat.create
]);

//get original image url
router.get('/image', [
    Authentication.authorizeUserOrGatewayMD,
    Chat.getChatImageUrl
]);

// get url for upload file to s3
router.get('/upload', [
    Authentication.authorizeUserOrGatewayMD,
    Chat.getUploadUrl
]);

//get chat by id
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    Chat.getChatById
]);

//get all chat by senderId and receiverId
router.get('/all', [
    Authentication.authorizeUserOrGatewayMD,
    Chat.getChatBySenderAndReceiver
]);

//get all chat partners
router.get('/partner', [
    Authentication.authorizeUserOrGatewayMD,
    Chat.getChatPartners
]);

//get total unread messages
router.get('/unread/count', [
    Authentication.authorizeUserOrGatewayMD,
    Chat.getUnreadMessagesCount
]);

//search chat partner
router.get('/search', [
    Authentication.authorizeUserOrGatewayMD,
    Chat.searchByName
]);

//delete chat
router.delete('/', [
    Authentication.authorizeUserOrGatewayMD,
    Chat.deleteMessage
]);

//update message
router.patch('/message', [
    Authentication.authorizeUserOrGatewayMD,
    Chat.updateMessage
]);

//update chat
router.patch('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.CHAT),
    Chat.update
]);

/*
* Send a flag to receiver when sender is typing (to show typing.... status on UI)
**/
router.patch('/typing-status', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.CHAT),
    Chat.sendTypingStatus
]);

/*
* Get deviceIds of memberIds for online and offline status
* */
router.patch('/chat-status', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.CHAT),
    Chat.getChatStatus
]);

/*
* Get all users of account
* */
router.get('/users',[
  Authentication.authorizeUserOrGatewayMD,
  Chat.getAllUsersOfAccount
]);


module.exports = router;


