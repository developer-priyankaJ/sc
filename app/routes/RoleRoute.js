#!/usr/bin/env node
'use strict';

var Authentication = require('./authentication');
var Role = require('./role');
var Common = require('./common');
var Error = require('./error');
var Constants = require('../data/constants');

var express = require('express');
var router = express.Router();

// To Create a new Role
router.post('/', [
    Authentication.authorizeAdminMD,
    Role.createMD
]);

// To retrieve a specific Role
router.get('/', [
    Authentication.authorizeAdminMD,
    Role.getRoleMD
]);

// Update Role
router.put('/', [
    Authentication.authorizeAdminMD,
    Role.updateRoleMD
]);

// Delete a Role
router.delete('/', [
    Authentication.authorizeAdminMD,
    Role.removeMD
]);

module.exports = router;


