#!/usr/bin/env node
'use strict';

var Authentication = require('./authentication');
var View = require('./view');
var Common = require('./common');
var Error = require('./error');
var Constants = require('../data/constants');

var express = require('express');
var router = express.Router();

router.post('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.VIEW),
    View.create
]);

router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    View.get
]);

router.get('/recent', [
    Authentication.authorizeUserOrGatewayMD,
    View.getRecent
]);

router.get('/by-name', [
    Authentication.authorizeUserOrGatewayMD,
    View.getByName
]);

router.patch('/', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.VIEW),
    View.update
]);

router.delete('/', [
    Authentication.authorizeUserOrGatewayMD,
    View.delete
]);

router.post('/change-db', [
    Authentication.validateToken,
    View.changeDB
]);


module.exports = router;