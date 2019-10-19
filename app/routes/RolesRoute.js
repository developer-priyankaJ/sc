#!/usr/bin/env node
'use strict';

var Authentication = require('./authentication');
var Role = require('./role');
var Common = require('./common');
var Error = require('./error');
var Constants = require('../data/constants');

var express = require('express');
var router = express.Router();

//Retrieve list of Roles
router.get('/', [
    Authentication.authorizeAdminMD,
    Role.getRolesMD
]);

module.exports = router;


