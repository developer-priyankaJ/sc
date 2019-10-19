#!/usr/bin/env node

'use strict';
var debug = require('debug')('scopehub.api.download');
var _ = require('lodash');
var jsonToCsv = require('json2csv').parse;
var fs = require('fs');
var Promise = require('bluebird');

var ErrorConfig = require('../data/error');
var DataUtils = require('../lib/data_utils');
var ErrorUtils = require('../lib/error_utils');
var AuditUtils = require('../lib/audit_utils');
var Utils = require('../lib/utils');
var Constants = require('../data/constants');
var S3Utils = require('../lib/s3_utils');
var connection = require('../lib/connection_util');
var s3 = require('../model/s3');

var Download = {

    validateRequestDetails: function (options) {
        return new Promise(async function (resolve, reject) {
            try {
                var refereId = options.refereId;
                var outShareInstanceId = options.outShareInstanceId;
                var shareItemType = options.shareItemType;
                var refereShareId = options.refereShareId;
                var refereShareName = options.refereShareName;
                var fromFilterDate = options.fromFilterDate;
                var toFilterDate = options.toFilterDate;
                var type = options.type;
                var err;

                if (DataUtils.isUndefined(refereId)) {
                    err = new Error(ErrorConfig.MESSAGE.REFERE_ID_REQUIRED);
                } else if (DataUtils.isUndefined(type)) {
                    err = new Error(ErrorConfig.MESSAGE.TYPE_REQUIRED);
                } else if (DataUtils.isUndefined(outShareInstanceId)) {
                    err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ID_REQUIRED);
                } else if (DataUtils.isUndefined(shareItemType)) {
                    err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ITEM_TYPE_REQUIRED);
                } else if (DataUtils.isUndefined(refereShareId)) {
                    err = new Error(ErrorConfig.MESSAGE.REFERE_SHARE_ID_REQUIRED);
                } else if (DataUtils.isUndefined(refereShareName)) {
                    err = new Error(ErrorConfig.MESSAGE.REFERE_SHARE_NAME_REQUIRED);
                } else if (DataUtils.isUndefined(fromFilterDate)) {
                    err = new Error(ErrorConfig.MESSAGE.FROM_FILTER_DATE_REQUIRED);
                } else if (DataUtils.isUndefined(toFilterDate)) {
                    err = new Error(ErrorConfig.MESSAGE.TO_FILTER_DATE_REQUIRED);
                } else if (fromFilterDate.toString().length !== 13) {
                    err = new Error(ErrorConfig.MESSAGE.INVALID_FROM_FILTER_DATE);
                } else if (toFilterDate.toString().length !== 13) {
                    err = new Error(ErrorConfig.MESSAGE.INVALID_TO_FILTER_DATE);
                }
                if (err) {
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
    * Create download log record
    * */
    insertFileDetails: function (options) {
        return new Promise(async function (resolve, reject) {
            try {
                var conn = await connection.getConnection();

                var inserted = await conn.query('INSERT INTO downloadLog (id,accountId,refereId,type,startTime,status,' +
                  ' fromFilterDate,toFilterDate,createdBy,updatedBy,createdAt,updatedAt) VALUES ' +
                  ' (uuid_to_bin(?),uuid_to_bin(?),uuid_to_bin(?),?,?,?,?,?,uuid_to_bin(?),uuid_to_bin(?),?,?)',
                  [options.id, options.accountId, options.refereId, options.type, options.startTime, options.status,
                      options.fromFilterDate, options.toFilterDate, options.userId, options.userId, options.createdAt, options.updatedAt]);

                inserted = Utils.isAffectedPool(inserted);

                return resolve(inserted);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    createDownloadLog: async function (options, auditOptions, errorOptions, cb) {
        var accountId = options.user.accountId;
        var userId = options.user.id;
        var generatedId = Utils.generateId();
        var id = generatedId.uuid;
        var refereId = options.refereId;
        var fromFilterDate = options.fromFilterDate;
        var toFilterDate = options.toFilterDate;
        var type = options.type;
        var startTime = DataUtils.getEpochMSTimestamp();
        var createdAt = DataUtils.getEpochMSTimestamp();
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var err;
        try {
            var conn = await connection.getConnection();

            var validateFile = await Download.validateRequestDetails(options);
            debug('validate Response', validateFile);

            var insertOptions = {
                id: id,
                accountId: accountId,
                refereId: refereId,
                type: type,
                startTime: startTime,
                fromFilterDate: fromFilterDate,
                toFilterDate: toFilterDate,
                userId: userId,
                status: Constants.DOWNLOAD_CSV_LOG_STATUS.NEW_ARRIVAL,
                createdAt: createdAt,
                updatedAt: updatedAt
            };

            var insertFileDetails = await Download.insertFileDetails(insertOptions);
            if (!insertFileDetails) {
                err = new Error(ErrorConfig.MESSAGE.CREATE_FILE_LOG_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            await AuditUtils.create(auditOptions);
            return cb(null, {id: id, createdAt: createdAt});
        } catch (err) {
            debug('err', err);
            await conn.query('rollback');
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            return cb(err);
        }
    },

    /*
     * Get shared data record for
     * */
    getSharedData: async function (options, errorOptions, cb) {
        var user = options.user;
        var type = options.type;
        var outShareInstanceId = options.outShareInstanceId;
        var toFilterDate = options.toFilterDate;
        var fromFilterDate = options.fromFilterDate;
        var accountId = user.accountId;
        var firstConcatString = '"', secondConcatString = '","', thirdConcatString = '",';
        var sharedData, err;

        try {
            var conn = await connection.getConnection();
            if (type === Constants.DOWNLOAD_CSV_TYPE.OUT_SHARE) {
                accountId = Constants.DEFAULT_REFERE_ID;
            }

            sharedData = await conn.query('SELECT CONCAT(?,PR.sku,?,PR.sellerSKUName,?,PIS.data) AS data ' +
              ' FROM SharedData PIS, ProductInventory PI, ProductReferences PR WHERE ' +
              ' PIS.outShareInstanceId = uuid_to_bin(?) AND PIS.inSharePartnerId=uuid_to_bin(?) AND ' +
              ' PIS.effectiveSharedDateTime BETWEEN ? AND ? AND PI.id = PIS.shareItemId AND PR.id = PI.productRefId ' +
              ' UNION ALL ' +
              ' SELECT CONCAT(?,SIT.sku,?,SIT.sellerSKUName,?,PIS.data) AS data ' +
              ' FROM SharedData PIS, SupplyInventory SI, SupplyItems SIT WHERE  ' +
              ' PIS.outShareInstanceId = uuid_to_bin(?) AND PIS.inSharePartnerId=uuid_to_bin(?) AND ' +
              ' PIS.effectiveSharedDateTime BETWEEN ? AND ? AND SI.id = PIS.shareItemId AND SIT.id = SI.supplyItemId;',
              [firstConcatString, secondConcatString, thirdConcatString, outShareInstanceId, accountId, fromFilterDate, toFilterDate,
                  firstConcatString, secondConcatString, thirdConcatString, outShareInstanceId, accountId, fromFilterDate, toFilterDate]);

            if (!sharedData || !DataUtils.isArray(sharedData) || sharedData.length <= 0) {
                err = new Error(ErrorConfig.MESSAGE.NO_SHARED_DATA_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            return cb(null, sharedData);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.GET_SHARED_DATA_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    /*
    * Generate CSV file of shared data and store into EFS
    * */
    GenerateCSVFile: async function (options, errorOptions, cb) {
        var user = options.user;
        var downloadLog = options.downloadLog;
        var sharedData = options.sharedData;
        var refereShareId = options.refereShareId;
        var refereShareName = options.refereShareName;
        var shareItemType = options.shareItemType;
        var fields, fileSize;
        var currentTime = DataUtils.getEpochMSTimestamp();
        var fileName = refereShareId + '_' + refereShareName + '_' + currentTime + '.csv';
        var destination = Constants.CSV_DESTINATION;
        var updateLogOption, updateResponse;

        try {
            if (shareItemType === Constants.OUT_SHARE_PROFILE_TYPE.PRODUCT_INVENTORY) {
                fields = Constants.CSV_UNENCRYPTED_SHARED_DATA_FIELDS.PRODUCT_INVENTORY;
            } else if (shareItemType === Constants.OUT_SHARE_PROFILE_TYPE.SUPPLY_INVENTORY) {
                fields = Constants.CSV_UNENCRYPTED_SHARED_DATA_FIELDS.SUPPLY_INVENTORY;
            }
            //build csv string from json
            var csvString = jsonToCsv(sharedData, {header: false, quote: ''});
            csvString = fields.toString() + '\n' + csvString;

            //Create file
            await fs.writeFileSync(destination + fileName, csvString);

            //Get filesize
            if (fs.existsSync(destination + fileName) === true) {
                var fileState = fs.statSync(destination + fileName);
                fileSize = fileState.size;
            }
            debug('fileSize', fileSize);
            // Update downloadLog
            updateLogOption = {
                userId: user.id,
                id: downloadLog.id,
                fileName: fileName,
                fileSize: fileSize,
                status: Constants.DOWNLOAD_CSV_LOG_STATUS.FILE_GENERATE_SUCCESS
            };
            updateResponse = await Download.updateDownloadLog(updateLogOption);
            debug('updateResponse', updateResponse);

            return cb(null, {
                fileName: fileName
            });
        } catch (err) {
            debug('err', err);
            updateLogOption = {
                userId: user.id,
                id: downloadLog.id,
                status: Constants.DOWNLOAD_CSV_LOG_STATUS.FILE_GENERATE_FAIL
            };
            updateResponse = await Download.updateDownloadLog(updateLogOption);
            debug('updateResponse', updateResponse);

            err = new Error(ErrorConfig.MESSAGE.CSV_FILE_GENERATE_FAIL);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    /*
    * Upload CSV file to s3 bucket
    * */
    UploadFileToS3: async function (options, errorOptions, cb) {
        var fileName = options.fileName;
        var downloadLog = options.downloadLog;
        var user = options.user;
        var accountId = user.accountId;
        var destination = Constants.CSV_DESTINATION;
        var type = Constants.CONTENT_TYPE.TEXT_CSV;
        var s3Destination = accountId + '/' + Constants.S3_FOLDER.SHARED_DATA_CSV;
        var updateResponse;
        try {
            var updateLogOption = {
                userId: user.id,
                id: downloadLog.id
            };

            /*
            * read pdf file
            * */
            fs.readFile(destination + fileName, async function (err, data) {
                if (err) {
                    debug('err', err);
                    err = new Error(ErrorConfig.MESSAGE.FILE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    await ErrorUtils.create(errorOptions, options, err);

                    // update log
                    updateLogOption.status = Constants.DOWNLOAD_CSV_LOG_STATUS.UPLOAD_TO_S3_FAIL;
                    updateResponse = await Download.updateDownloadLog(updateLogOption);

                    return cb(err);
                }
                debug('file Data', data);
                var buffer = new Buffer(data, 'binary');

                /*
                * Upload pdf to s3 bucket
                * */
                debug('s3Destination', s3Destination);
                S3Utils.putObject(buffer, fileName, type, s3Destination, Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET, '', async function (err, file) {
                    if (err) {
                        debug('err', err);
                        err = new Error(ErrorConfig.MESSAGE.UPLOAD_CSV_FILE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                        await ErrorUtils.create(errorOptions, options, err);

                        // update log
                        updateLogOption.status = Constants.DOWNLOAD_CSV_LOG_STATUS.UPLOAD_TO_S3_FAIL;
                        updateResponse = await Download.updateDownloadLog(updateLogOption);

                        return cb(err);
                    }
                    debug('file', file);

                    /*
                    * remove file from EFS
                    * */
                    if (fs.existsSync(destination + fileName) === true) {
                        fs.unlinkSync(destination + fileName);
                    }

                    /*
                    * update download log
                    * */
                    updateLogOption.status = Constants.DOWNLOAD_CSV_LOG_STATUS.UPLOAD_TO_S3_SUCCESS;
                    updateResponse = await Download.updateDownloadLog(updateLogOption);
                    debug('updateResponse', updateResponse);

                    return cb(null, Constants.OK_MESSAGE);
                });
            });
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.UPLOAD_CSV_FILE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;

            // update log
            updateLogOption.status = Constants.DOWNLOAD_CSV_LOG_STATUS.UPLOAD_TO_S3_FAIL;
            updateResponse = await Download.updateDownloadLog(updateLogOption);
            return cb(err);
        }
    },

    /*
    * Get presigned url of the uploaded csv file
    * */
    getPreSignedUrlFromS3: async function (options, errorOptions, cb) {
        var fileName = options.fileName;
        var downloadLog = options.downloadLog;
        var user = options.user;
        var accountId = user.accountId;
        var s3Destination = accountId + '/' + Constants.S3_FOLDER.SHARED_DATA_CSV;
        var updateResponse;
        try {
            var updateLogOption = {
                userId: user.id,
                id: downloadLog.id
            };

            var getUrlOption = {
                Bucket: Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET,
                Key: s3Destination + '/' + fileName,
                Expires: 60 * 60 * 24 // 1 day
            };
            s3.getSignedUrl('getObject', getUrlOption, async function (err, preSignedUrl) {
                if (err) {
                    debug('err', err);
                    err = new Error(ErrorConfig.MESSAGE.GET_PRE_SIGNED_URL_FAIL);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;

                    // update log
                    updateLogOption.status = Constants.DOWNLOAD_CSV_LOG_STATUS.GET_PRE_SIGNED_URL_FAIL;
                    updateResponse = await Download.updateDownloadLog(updateLogOption);

                    return cb(err);
                }

                /*
                * update download log
                * */
                updateLogOption.status = Constants.DOWNLOAD_CSV_LOG_STATUS.GET_PRE_SIGNED_URL_SUCCESS;
                updateLogOption.preSignedUrl = preSignedUrl;
                updateResponse = await Download.updateDownloadLog(updateLogOption);
                return cb(null, {preSignedUrl: preSignedUrl});
            });
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.GET_PRE_SIGNED_URL_FAIL);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;

            // update log
            updateLogOption.status = Constants.DOWNLOAD_CSV_LOG_STATUS.GET_PRE_SIGNED_URL_FAIL;
            updateResponse = await Download.updateDownloadLog(updateLogOption);
            return cb(err);
        }
    },

    /*
    * validate download log object
    * */
    validateDownLoadLog: function (options) {
        return new Promise(function (resolve, reject) {
            var downloadLogFields = '';
            var downloadLogValues = [];

            if (DataUtils.isDefined(options.fileName)) {
                downloadLogFields += 'fileName=? ,';
                downloadLogValues.push(options.fileName);
            }
            if (DataUtils.isDefined(options.fileSize)) {
                downloadLogFields += 'fileSize=? ,';
                downloadLogValues.push(options.fileSize);
            }
            if (DataUtils.isDefined(options.status)) {
                downloadLogFields += 'status=? ,';
                downloadLogValues.push(options.status);
            }
            if (DataUtils.isDefined(options.preSignedUrl)) {
                downloadLogFields += 'preSignedUrl=? ,';
                downloadLogValues.push(options.preSignedUrl);
            }
            var response = {
                downloadLogFields: downloadLogFields,
                downloadLogValues: downloadLogValues
            };
            return resolve(response);
        });
    },

    /*
    * Update the download log record
    * */
    updateDownloadLog: function (options) {
        return new Promise(async function (resolve, reject) {
            var id = options.id;
            var userId = options.userId;
            var downloadLogFields = '', downloadLogValues = [];
            var currentTime = DataUtils.getEpochMSTimestamp();

            try {
                var response = await Download.validateDownLoadLog(options);
                downloadLogFields = response.downloadLogFields;
                downloadLogValues = response.downloadLogValues;
                downloadLogValues.push(userId, currentTime, id);
                var conn = await connection.getConnection();

                var downloadLogUpdated = await conn.query(' update downloadLog set ' + downloadLogFields + ' ' +
                  'updatedBy=uuid_to_bin(?), updatedAt = ? where id=uuid_to_bin(?); ', downloadLogValues);
                downloadLogUpdated = Utils.isAffectedPool(downloadLogUpdated);
                debug('downloadLogUpdated ', downloadLogUpdated);
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.UPDATE_DOWNLOAD_LOG_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    }
};

module.exports = Download;