#!/usr/bin/env node
'use strict';
var express = require('express');
var router = express.Router();

var Authentication = require('./authentication');
var Common = require('./common');
var OrderReferenceInformation = require('./order_reference_information');
var Constants = require('../data/constants');

/*
* ORDER ITEM API
* */

//Get Order item by Id
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    OrderReferenceInformation.getItemByIdMD
]);


module.exports = router;
