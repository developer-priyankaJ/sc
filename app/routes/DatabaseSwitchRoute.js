#!/usr/bin/env node
'use strict';

var Authentication = require('./authentication');
var DatabaseSwitch = require('./databaseSwitch');

var express = require('express');
var router = express.Router();

/*
* Switch the database
* */
router.patch('/switch', [
    Authentication.validateToken,
    DatabaseSwitch.changeDB
]);

/*
* Create database script
* */
router.post('/', [
    Authentication.authorizeUserOrGatewayMD,
    DatabaseSwitch.createDatabase,
    DatabaseSwitch.createScript,
    DatabaseSwitch.insertDatabaseRecord,
    DatabaseSwitch.loadScript,
    DatabaseSwitch.deleteScriptFiles
]);

/*router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    DatabaseSwitch.function1
]);

router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    DatabaseSwitch.function1
]);*/

/*
* Get all databases
* */
router.get('/all', [
    Authentication.validateTokenForGet,
    DatabaseSwitch.getDatabase
]);

/*
* Get all databases
* */
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    DatabaseSwitch.getDatabaseByUser
]);

/*
* test api
* */
router.get('/function1', [
    //Authentication.validateTokenForGet,
    DatabaseSwitch.function1
]);

/*
* test api
* */
router.get('/function2', [
    //Authentication.validateTokenForGet,
    DatabaseSwitch.function2
]);

/*
* test api
* */
router.get('/function3', [
    //Authentication.validateTokenForGet,
    DatabaseSwitch.function3
]);


module.exports = router;