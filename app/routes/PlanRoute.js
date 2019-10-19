#!/usr/bin/env node
'use strict';

var express = require('express');
var router = express.Router();

var Authentication = require('./authentication');
var Common = require('./common');
var Constants = require('../data/constants');
var Plan = require('./plan');
var Account = require('./account');

/**
 * Plan APIs
 */

//Update the plan
router.patch('/', [
    Authentication.authorizeUserOrGatewayMD,
    Plan.updateAccountPlan
]);

module.exports = router;