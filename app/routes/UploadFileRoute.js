#!/usr/bin/env node
'use strict';
var express = require('express');
var router = express.Router();

var Authentication = require('./authentication');
var Common = require('./common');
var Account = require('./account');
var FileUpload = require('./uploadFile');
var Constants = require('../data/constants');

/*
* Upload CSV File Apis
* */

// Create the presigned url of given csv file
router.post('/log', [
    Authentication.authorizeUserOrGatewayMD,
    Account.createS3AccountMD,
    FileUpload.createLogRecordMD
]);

// Create the presigned url of given csv file
router.post('/pre-signed-url', [
    Authentication.authorizeUserOrGatewayMD,
    FileUpload.createPreSignedUrlMD
]);

// Create error log record
router.post('/error-log', [
    FileUpload.getUploadLogMD,
    FileUpload.createErrorLog
]);

// Update upload log after each validation check
router.patch('/check', [
    FileUpload.getUploadLogMD,
    FileUpload.updateUploadLogByCheck
]);

// copy file from s3 to EFS
router.patch('/copy', [
    //Authentication.authorizeUserOrGatewayMD,
    FileUpload.copyCSVFileMD
]);

/*
// Update upload log after steps completions
router.patch('/steps', [
    OrderReferenceInformation.getUploadLogMD,
    OrderReferenceInformation.updateUploadLogSteps
]);
*/

// Update upload log after successfull upload
router.patch('/', [
    Authentication.validatePreSignedUrl,
    FileUpload.getUploadLogMD,
    FileUpload.updateUploadLog
]);

// Update upload log after user cancel the upload
router.patch('/cancel', [
    FileUpload.getUploadLogMD,
    Authentication.validateFileUploadPublicKey,
    FileUpload.updateUploadLogCancel
]);

// Get Upload log
router.get('/', [
    Authentication.authorizeUserOrGatewayMD,
    FileUpload.getUploadLog
]);

// Get File Format
router.get('/file-format', [
    Authentication.authorizeUserOrGatewayMD,
    FileUpload.getFileFormat
]);

// Get Validation Errors from uploadLogId
router.get('/validation-errors', [
    Authentication.authorizeUserOrGatewayMD,
    FileUpload.getValidationErrors
]);

/*// Create the log record of order file
router.post('/', [
    Authentication.authorizeUserOrGatewayMD,
    OrderReferenceInformation.createLogRecordMD
]);*/

/*// Validate CSV file on s3 bucket
router.post('/validate', [
    OrderReferenceInformation.validateFilesMD
]);*/

// Load file from s3 to EFS
router.post('/load', [
    FileUpload.loadFile
]);

// Get url for uploaded file
router.get('/url', [
    Authentication.authorizeUserOrGatewayMD,
    FileUpload.getFilesUrl
]);

/*
// Logical validation and copy data into original file
router.post('/logical-validation', [
    OrderReferenceInformation.logicalValidation
]);
*/


module.exports = router;
