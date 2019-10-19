#!/usr/bin/env node
'use strict';

var Authentication = require('./authentication');
var Constants = require('../data/constants');
var Common = require('./common');

var express = require('express');
var router = express.Router();

/*
* ERROR REFERENCE APIS
* */
//Update error reference
router.post('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.updateErrorReference
]);

//Get error reference
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.getErrorReference
]);

//Get error reference at login time
router.get('/login', [
    //Authentication.authorizeUserOrGatewayMD,
    Common.getErrorReferenceForLogin
]);


module.exports = router;