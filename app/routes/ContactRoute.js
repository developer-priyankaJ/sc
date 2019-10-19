#!/usr/bin/env node
'use strict';
var express = require('express');
var router = express.Router();

var Authentication = require('./authentication');
var Common = require('./common');
var Contact = require('./contact');
var Constants = require('../data/constants');

/*
* CONTACT APIS
* */

// To Create a new contact
router.post('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.CONTACT),
    Contact.createMD
]);


// To invite a contact
router.post('/invite', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.CONTACT),
    Contact.inviteMD
]);

// Update contact
router.patch('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.CONTACT),
    Contact.updateMD
]);

// get by contactId
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    Contact.getContactMD
]);

//remove contact
router.delete('/', [
    Authentication.authorizeUserOrGatewayMD,
    Contact.removeMD
]);

//Add and invite contact
router.post('/add-invite', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.CONTACT),
    Contact.addAndInviteMD
]);

//cancel contact invitation by inviter
router.delete('/cancel/invitation', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.CONTACT),
    Contact.cancelMD
]);

//Reminder
router.post('/reminder', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.CONTACT),
    Contact.reminderMD
]);

//re-send invitation
router.post('/re-send-invitation', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.CONTACT),
    Contact.reSendInvitationMD
]);

//block contact
router.patch('/block', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.CONTACT),
    Contact.blockContactMD
]);

//un-block contact
router.patch('/unblock', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.CONTACT),
    Contact.unBlockContactMD
]);


module.exports = router;