#!/usr/bin/env node
'use strict';

var Authentication = require('./authentication');
var Common = require('./common');
var Error = require('./error');
var Constants = require('../data/constants');
var Download = require('./download');

var express = require('express');
var router = express.Router();

// Create download log , generate csv file, upload to s3
router.post('/', [
    Authentication.authorizeUserOrGatewayMD,
    Download.createDownloadLog,
    Download.getSharedData,
    Download.GenerateCSVFile,
    Download.UploadFileToS3,
    Download.getPreSignedUrlFromS3
]);


module.exports = router;


