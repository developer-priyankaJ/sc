'use strict';


var debug = require('debug')('scopehub.api.FileUpload');
var Async = require('async');
var _ = require('lodash');
var MWSConfig = require('../config/mws');
var amazonMws = require('amazon-mws')(MWSConfig.ACCESS_KEY_ID, MWSConfig.SECRET_ACCESS_KEY);
var ScopehubCore = require('../lib/scope_core');
var csv = require('fast-csv');
var path = require('path');
var fs = require('fs');
var i18n = require('i18n');
var Request = require('request-promise');
var {execSync} = require('child_process');
var pako = require('pako');
var sjcl = require('sjcl');
var NodeRSA = require('node-rsa');
var crypto = require('crypto');

var NotificationReferenceData = require('../data/notification_reference');
var connection = require('../lib/connection_util');
var DataUtils = require('../lib/data_utils');
var FastCsvUtils = require('../lib/fast_csv_utils');
var ErrorConfig = require('../data/error');
var AwsConfig = require('../config/aws');
var Constants = require('../data/constants');
var AuditUtils = require('../lib/audit_utils');
var S3Utils = require('../lib/s3_utils');
var knex = require('../lib/knex_util');
var ErrorUtils = require('../lib/error_utils');
var Utils = require('../lib/utils');
var CommonApi = require('../api/common');
var NotificationApi = require('../api/notification');
var OrderReferenceInformationApi = require('../api/order_reference_information');
var CustomerApi = require('../api/customer');
var PromiseBluebird = require('bluebird');
var Decimal = require('decimal.js');
var s3 = require('../model/s3');

var OrderDirName = '..' + path.sep + 'public' + path.sep + 'orders';
OrderDirName = path.resolve(__dirname, OrderDirName);
if (fs.existsSync(OrderDirName) === false) {
    fs.mkdir(OrderDirName);
}
var count = 0;

var FileUpload = {

    /**
     * Create upload log records
     */
    createLogRecordMD: async function (options, auditOptions, errorOptions, cb) {
        var userId = options.userId;
        var version = options.version;
        var accountId = options.accountId;
        var fileName = options.fileName;
        var fileSize = options.size;
        var type = options.type;
        var isMultipart = options.isMultipart || 0;
        var startTime = DataUtils.getEpochMSTimestamp();
        var createdAt = DataUtils.getEpochMSTimestamp();
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var status = Constants.UPLOAD_STATUS.PROGRESSING;
        var ipAddress = auditOptions.ipAddress;
        var fileUploadPrivateKey = options.fileUploadPrivateKey;
        var fileUploadPublicKey = options.fileUploadPublicKey;
        var err;

        if (DataUtils.isUndefined(fileName)) {
            err = new Error(ErrorConfig.MESSAGE.FILE_NAME_REQUIRED);
        } else if (fileName.toString().length > (222 + 33)) {
            err = new Error(ErrorConfig.MESSAGE.FILE_NAME_MUST_BE_LESS_THAN_222_CHAR);
        } else if (fileName.indexOf('.csv') < 0) {
            err = new Error(ErrorConfig.MESSAGE.INVALID_FILE);
        } else if (DataUtils.isUndefined(type)) {
            err = new Error(ErrorConfig.MESSAGE.TYPE_REQUIRED);
        } else if (Object.values(Constants.UPLOAD_FILE_TYPE).indexOf((parseInt(type))) === -1) {
            err = new Error(ErrorConfig.MESSAGE.INVALID_TYPE);
        } else if (fileSize / (1024 * 1024 * 1024) > 2) {
            err = new Error(ErrorConfig.MESSAGE.FILE_MUST_BE_LESS_THAN_2_GB);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var isLogInserted = await conn.query('If (select 1 from UploadLog where fileName = ?) is not null then ' +
              'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "FILE_ALREADY_EXIST", MYSQL_ERRNO = 4001;' +
              'else insert into UploadLog (userId,accountId,fileName,fileSize,startTime,' +
              'type,status,ipAddress,isMultipart,createdAt,updatedAt,createdBy) ' +
              'values (uuid_to_bin(?),uuid_to_bin(?),?,?,?,?,?,?,?,?,?,uuid_to_bin(?));END IF',
              [fileName, userId, accountId, fileName, parseInt(fileSize), startTime, parseInt(type), status, ipAddress,
                  isMultipart, createdAt, updatedAt, userId]);
            isLogInserted = Utils.isAffectedPool(isLogInserted);
            if (!isLogInserted) {
                err = new Error(ErrorConfig.MESSAGE.UPLOAD_LOG_INSERT_FAILED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            var versionType;
            _.forEach(Constants.VERSION, function (versionObject, key) {
                if (versionObject.value === version) {
                    versionType = versionObject.type;
                    return;
                }
            });
            return cb(null, {
                fileName: fileName,
                version: versionType,
                fileUploadPublicKey: fileUploadPublicKey
            });
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.FILE_ALREADY_EXIST);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            } else {
                err = new Error(ErrorConfig.MESSAGE.UPLOAD_LOG_INSERT_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    /*
     * Validate parts
     * */
    validateParts: function (options) {
        return new Promise(async function (resolve, reject) {
            var parts = options.parts;
            var err;

            try {
                if (DataUtils.isUndefined(parts)) {
                    err = new Error(ErrorConfig.MESSAGE.PARTS_REQUIRED);
                } else if (!DataUtils.isArray(parts)) {
                    err = new Error(ErrorConfig.MESSAGE.PARTS_MUST_BE_ARRAY);
                } else if (parts.length <= 0) {
                    err = new Error(ErrorConfig.MESSAGE.AT_LEAST_ONE_PART_REQUIRED);
                } else {
                    _.map(parts, function (part) {
                        if (DataUtils.isUndefined(part.partName)) {
                            err = new Error(ErrorConfig.MESSAGE.PART_NAME_REQUIRED);
                        } else if (DataUtils.isUndefined(part.partNumber)) {
                            err = new Error(ErrorConfig.MESSAGE.PART_NUMBER_REQUIRED);
                        }
                        if (err) {
                            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                            throw err;
                        }
                    });
                }
                if (err) {
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    throw err;
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
     * Create presigned url for each parts (multiple CSV files )
     * */
    createPreSignedUrlForParts: function (options) {
        return new Promise(async function (resolve, reject) {
            var bucket = options.bucket;
            var key = options.key;
            var parts = options.parts;
            var preSignedUrls = [];

            try {
                var opt = {};
                var createUrlOption = {
                    Bucket: bucket,
                    ACL: 'public-read',
                    ContentType: 'text/csv',
                    Expires: 60 * 60
                };
                debug('createUrlOption', createUrlOption);
                await PromiseBluebird.each(parts, function (part) {
                    createUrlOption.Key = key + '/' + part.partName;
                    s3.getSignedUrl('putObject', createUrlOption, function (err, preSignedUrl) {
                        if (err) {
                            debug('err', err);
                            return reject(err);
                        }
                        preSignedUrls.push({
                            partName: part.partName,
                            partNumber: part.partNumber,
                            preSignedUrl: preSignedUrl
                        });
                    });
                });
                return resolve(preSignedUrls);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    validateFields: function (options) {
        return new Promise(function (resolve, reject) {
            var uploadLogFields = '';
            var uploadLogOptionalValues = [];
            var err;

            try {
                if (DataUtils.isDefined(options.status)) {
                    uploadLogFields += 'status = ?,';
                    uploadLogOptionalValues.push(options.status);
                }
                if (DataUtils.isDefined(options.stepCompleted)) {
                    uploadLogFields += 'stepCompleted = ?,';
                    uploadLogOptionalValues.push(options.stepCompleted);
                }
                if (DataUtils.isDefined(options.multipartStatus)) {
                    uploadLogFields += 'multipartStatus = ?,';
                    uploadLogOptionalValues.push(options.multipartStatus);
                }
                if (DataUtils.isDefined(options.isMultipart)) {
                    uploadLogFields += 'isMultipart = ?,';
                    uploadLogOptionalValues.push(options.isMultipart);
                }
                if (DataUtils.isDefined(options.preSignedUrl)) {
                    uploadLogFields += 'preSignedUrl = ?,';
                    uploadLogOptionalValues.push(options.preSignedUrl);
                }
                if (DataUtils.isDefined(options.checkOneStatus)) {
                    uploadLogFields += 'checkOneStatus = ?,';
                    uploadLogOptionalValues.push(options.checkOneStatus);
                }
                if (DataUtils.isDefined(options.checkOneTimeStamp)) {
                    uploadLogFields += 'checkOneTimeStamp = ?,';
                    uploadLogOptionalValues.push(options.checkOneTimeStamp);
                }
                if (DataUtils.isDefined(options.checkTwoStatus)) {
                    uploadLogFields += 'checkTwoStatus = ?,';
                    uploadLogOptionalValues.push(options.checkTwoStatus);
                }
                if (DataUtils.isDefined(options.checkTwoTimeStamp)) {
                    uploadLogFields += 'checkTwoTimeStamp = ?,';
                    uploadLogOptionalValues.push(options.checkTwoTimeStamp);
                }
                if (DataUtils.isDefined(options.checkThreeStatus)) {
                    uploadLogFields += 'checkThreeStatus = ?,';
                    uploadLogOptionalValues.push(options.checkThreeStatus);
                }
                if (DataUtils.isDefined(options.checkThreeTimeStamp)) {
                    uploadLogFields += 'checkThreeTimeStamp = ?,';
                    uploadLogOptionalValues.push(options.checkThreeTimeStamp);
                }
                if (DataUtils.isDefined(options.checkFourStatus)) {
                    uploadLogFields += 'checkFourStatus = ?,';
                    uploadLogOptionalValues.push(options.checkFourStatus);
                }
                if (DataUtils.isDefined(options.checkFourTimeStamp)) {
                    uploadLogFields += 'checkFourTimeStamp = ?,';
                    uploadLogOptionalValues.push(options.checkFourTimeStamp);
                }
                if (DataUtils.isDefined(options.splitStatus)) {
                    uploadLogFields += 'splitStatus = ?,';
                    uploadLogOptionalValues.push(options.splitStatus);
                }
                if (DataUtils.isDefined(options.splitTimeStamp)) {
                    uploadLogFields += 'splitTimeStamp = ?,';
                    uploadLogOptionalValues.push(options.splitTimeStamp);
                }
                if (DataUtils.isDefined(options.compressionStatus)) {
                    uploadLogFields += 'compressionStatus = ?,';
                    uploadLogOptionalValues.push(options.compressionStatus);
                }
                if (DataUtils.isDefined(options.compressionTimeStamp)) {
                    uploadLogFields += 'compressionTimeStamp = ?,';
                    uploadLogOptionalValues.push(options.compressionTimeStamp);
                }
                if (DataUtils.isDefined(options.encryptionStatus)) {
                    uploadLogFields += 'encryptionStatus = ?,';
                    uploadLogOptionalValues.push(options.encryptionStatus);
                }
                if (DataUtils.isDefined(options.encryptionTimeStamp)) {
                    uploadLogFields += 'encryptionTimeStamp = ?,';
                    uploadLogOptionalValues.push(options.encryptionTimeStamp);
                }
                if (DataUtils.isDefined(options.endTime)) {
                    uploadLogFields += 'endTime = ?,';
                    uploadLogOptionalValues.push(options.endTime);
                }
                if (DataUtils.isDefined(options.firstLine)) {
                    uploadLogFields += 'firstLine = ?,';
                    uploadLogOptionalValues.push(options.firstLine);
                }
                if (DataUtils.isDefined(options.lastLine)) {
                    uploadLogFields += 'lastLine = ?,';
                    uploadLogOptionalValues.push(options.lastLine);
                }
                if (DataUtils.isDefined(options.numberOfColumns)) {
                    uploadLogFields += 'numberOfColumns = ?,';
                    uploadLogOptionalValues.push(options.numberOfColumns);
                }
                if (DataUtils.isDefined(options.decryptionKey)) {
                    uploadLogFields += 'decryptionKey = ?,';
                    uploadLogOptionalValues.push(options.decryptionKey);
                }
                if (DataUtils.isDefined(options.IVKey)) {
                    uploadLogFields += 'IVKey = ?,';
                    uploadLogOptionalValues.push(options.IVKey);
                }
                var response = {
                    uploadLogFields: uploadLogFields,
                    uploadLogOptionalValues: uploadLogOptionalValues
                };
                return resolve(response);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }

        });
    },

    updateLog: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var fileName = options.fileName;
            var userId = options.userId;
            var currentDate = DataUtils.getEpochMSTimestamp();
            var uploadLogRequiredValues = [], uploadLogOptionalValues = [];
            var uploadLogFields;

            var err;
            try {
                var conn = await connection.getConnection();
                uploadLogRequiredValues.push(fileName);

                var response = await FileUpload.validateFields(options);
                uploadLogFields = response.uploadLogFields;
                uploadLogOptionalValues = response.uploadLogOptionalValues;

                uploadLogRequiredValues = _.concat(uploadLogRequiredValues, uploadLogOptionalValues);
                uploadLogRequiredValues.push(currentDate, fileName);

                var isUpdated = await conn.query('IF (select 1 from UploadLog where fileName=?) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "FILE_NOT_FOUND", MYSQL_ERRNO = 4001; ' +
                  'ELSE update UploadLog set ' + uploadLogFields + ' updatedAt=? where fileName=?;END IF;',
                  uploadLogRequiredValues);
                isUpdated = Utils.isAffectedPool(isUpdated);
                if (!isUpdated) {
                    err = new Error(ErrorConfig.MESSAGE.UPLOAD_FILE_LOG_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                if (err.errno === 4001) {
                    err = new Error(ErrorConfig.MESSAGE.FILE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                } else {
                    err = new Error(ErrorConfig.MESSAGE.UPLOAD_FILE_LOG_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
            }

        });
    },

    buildWhereForUploadParts: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var parts = options.parts;
            var fileName = options.fileName;
            var string = '', values = [];
            var where = 'WHERE partName IN (';
            var andCondition = ' and fileName = ? ';
            var close = ') ';

            string += where;
            _.map(parts, function (part) {
                string += '?,';
                values.push(part.partName);
            });
            string = string.replace(/,\s*$/, ' ');
            string += close;
            string += andCondition;
            values.push(fileName);

            return resolve({
                string: string,
                values: values
            });
        });
    },

    /*
     * Build query for multiple update upload parts
     * */
    buildUpdateUploadPartQuery: async function (options) {
        return new Promise(async function (resolve, reject) {
            var parts = options.parts;
            var fileName = options.fileName;
            var string = 'update UploadPart set ';
            var end = 'END, ';
            var values = [];
            var finalResponse;
            var whereResponse = await FileUpload.buildWhereForUploadParts({
                parts: parts,
                fileName: fileName
            });
            var currentDate = DataUtils.getEpochMSTimestamp();

            try {
                _.map(parts, function (part) {
                    part.updatedAt = currentDate;
                });
                _.each(parts[0], function (value, key) {
                    if (key === 'partNumber' || key === 'partName') {
                        return;
                    }

                    string += key + ' = CASE partName ';
                    parts.forEach(function (part) {
                        string += 'WHEN ? THEN ? ';
                        values.push(part['partName'], part[key]);
                    });
                    string += end;
                });
                string = string.replace(/,\s*$/, ' ');
                string += whereResponse.string;
                values = values.concat(whereResponse.values);

                finalResponse = {
                    string: string,
                    values: values
                };
                return resolve(finalResponse);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    updateUploadPart: function (options) {
        return new Promise(async function (resolve, reject) {
            var parts = options.parts;
            var fileName = options.fileName;
            var string, values;
            var err;

            try {
                var response = await FileUpload.buildUpdateUploadPartQuery({
                    parts: parts,
                    fileName: fileName
                });

                string = response.string;
                values = response.values;

                debug('string', string);
                debug('values', values);

                var conn = await connection.getConnection();
                var isUpdated = await conn.query(string, values);
                isUpdated = Utils.isAffectedPool(isUpdated);
                debug(' UPLOAD PART UPDATED-------------------', isUpdated);
                if (!isUpdated) {
                    throw err;
                }
                return resolve(Constants.OK_MESSAGE);

            } catch (err) {
                debug('err ', err);
                err = new Error(ErrorConfig.MESSAGE.UPLOAD_PART_UPDATION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    createPreSignedUrlMD: async function (options, auditOptions, errorOptions, cb) {
        var userId = options.userId;
        var accountId = options.accountId;
        var fileName = options.fileName;
        var isMultipart = options.isMultipart;
        var parts = options.parts;
        var err;

        if (isMultipart) {
            try {
                // VALIDATE parts
                var checkResponse = await FileUpload.validateParts({parts: parts});
                debug('checkResponse ', checkResponse);

                // CREATE PRESIGNED URL FOR EACH PART
                var createPreSignedUrlOption = {
                    bucket: Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET,
                    key: accountId + '/' + Constants.S3_FOLDER.ARRIVAL_FILES,
                    parts: parts
                };
                var preSignedUrls = await FileUpload.createPreSignedUrlForParts(createPreSignedUrlOption);
                debug('preSignedUrls', preSignedUrls);

                // UPDATE UPLOAD_LOG RECORD WITH isMultipart
                options.preSignedUrl = '';
                //options.status = Constants.VALIDATE_SUCCESS;
                //options.stepCompleted = Constants.UPLOAD_COMPLETED_STEPS.STEP_1;

                var updateUploadLogResponse = await FileUpload.updateLog(options);

                // UPLOAD UPLOAD_PART_RECORD by presigned url
                var updateUploadPartOption = {
                    parts: preSignedUrls,
                    fileName: fileName
                };

                debug('updateUploadPartOption', updateUploadPartOption);

                var updateUploadPartResponse = await FileUpload.updateUploadPart(updateUploadPartOption);

                return cb(null, {
                    fileName: fileName,
                    preSignedUrls: preSignedUrls
                });
            } catch (err) {
                debug('err', err);
                if (err.errno) {
                    err = new Error(ErrorConfig.MESSAGE.CREATE_PRE_SIGNED_URL_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                }
                return cb(err);
            }
        } else {
            try {
                var opt = {
                    Bucket: Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET,
                    Key: accountId + '/' + Constants.S3_FOLDER.ARRIVAL_FILES + '/' + fileName,
                    Expires: 60 * 60,
                    ACL: 'public-read',
                    ContentType: 'text/csv'
                };
                s3.getSignedUrl('putObject', opt, async function (err, preSignedUrl) {
                    if (err) {
                        debug('err', err);
                        return cb(err);
                    }
                    options.preSignedUrl = preSignedUrl;
                    //options.isMultipart = isMultipart || 0;
                    options.uploadId = '';
                    var createUploadLogResponse = await FileUpload.updateLog(options);
                    debug('createUploadLogResponse', createUploadLogResponse);

                    return cb(null, {
                        preSignedUrl: preSignedUrl,
                        fileName: fileName
                    });
                });
            } catch (err) {
                debug('err', err);
                if (err.errno) {
                    err = new Error(ErrorConfig.MESSAGE.CREATE_PRE_SIGNED_URL_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                }
                return cb(err);
            }
        }
    },

    getUploadLogMD: async function (options, cb) {
        var fileName = options.fileName;
        var err;

        if (DataUtils.isUndefined(fileName)) {
            err = new Error(ErrorConfig.MESSAGE.FILE_NAME_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var uploadLog = await conn.query('select id,CAST(uuid_from_bin(userId) as CHAR) as userId,' +
              'CAST(uuid_from_bin(accountId) as CHAR) as accountId,type from UploadLog where fileName=? ;', [fileName]);
            uploadLog = Utils.filteredResponsePool(uploadLog);
            if (!uploadLog) {
                err = new Error(ErrorConfig.MESSAGE.UPLOAD_LOG_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            debug('uploadLog', uploadLog);
            return cb(null, uploadLog);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.UPLOAD_LOG_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    insertErrorLogMD: function (options) {
        return new Promise(async function (resolve, reject) {
            var errors = options.errors;
            var convertedErrorList, keys, err;
            var flag = options.flag;
            await Utils.convertObjectToArrayMD(errors, async function (err, response) {
                if (err) {
                    debug('err', err);
                    return reject(err);
                }
                convertedErrorList = response.list;
                keys = response.keys;

                var query = 'insert into ValidationErrorLog (' + keys + ') values';
                var values = flag ? ' (?,?,?,?,?,?,?) ' : ' (?,?,?,?,?,?) ';


                await PromiseBluebird.each(errors, function (value) {
                    query = query + values;
                    query = query + ',';
                });

                query = query.replace(/,\s*$/, '');
                try {
                    var conn = await connection.getConnection();
                    var errorInserted = await conn.query(query, convertedErrorList);
                    errorInserted = Utils.isAffectedPool(errorInserted);
                    debug('errorInserted-----------------------------------------', errorInserted);
                    if (!errorInserted) {
                        throw err;
                    }
                    return resolve(Constants.OK_MESSAGE);
                } catch (err) {
                    debug('err ', err);
                    err = new Error(ErrorConfig.MESSAGE.VALIDATION_ERROR_LOG_CREATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
            });
        });
    },

    createErrorLog: async function (options, errorOptions, cb) {
        var uploadLog = options.uploadLog;
        var errors = options.errors;
        var createdAt = DataUtils.getEpochMSTimestamp();
        var err;

        try {
            if (DataUtils.isUndefined(errors)) {
                err = new Error(ErrorConfig.MESSAGE.ERRORS_REQUIRED);
            } else if (!DataUtils.isArray(errors)) {
                err = new Error(ErrorConfig.MESSAGE.ERRORS_MUST_BE_ARRAY);
            } else if (errors.length <= 0) {
                err = new Error(ErrorConfig.MESSAGE.AT_LEAST_ONE_ERROR_REQUIRED);
            } else {
                _.map(errors, function (error) {
                    if (DataUtils.isUndefined(error.errorMessage)) {
                        err = new Error(ErrorConfig.MESSAGE.ERROR_MESSAGE_REQUIRED);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        throw err;
                    }
                });
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }


            // Insert errors in validation error log table
            _.map(errors, function (error) {
                error.meta = DataUtils.isDefined(error.meta) ? error.meta : '';
                error.createdAt = createdAt;
                error.failReasonCode = DataUtils.isDefined(error.failReasonCode) ? error.failReasonCode : 0;
                error.uploadLogId = uploadLog.id;
                error.columnName = DataUtils.isDefined(error.columnName) ? error.columnName : '';
                error.numberOfOccurence = DataUtils.isDefined(error.numberOfOccurence) ? error.numberOfOccurence : 1;
            });

            debug('errors', errors);

            var errorInserted = await FileUpload.insertErrorLogMD({
                errors: errors,
                flag: true
            });
            debug('errorInserted', errorInserted);
            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err', err);
            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.CREATE_VALIDATION_ERROR_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    getOperationFields: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var operationType = options.operationType;
            var status = options.status;
            var timestamp = options.timestamp;
            var responseObject = {};

            if (operationType === 1) {
                responseObject.checkOneStatus = status;
                responseObject.checkOneTimeStamp = timestamp;
            } else if (operationType === 2) {
                responseObject.checkTwoStatus = status;
                responseObject.checkTwoTimeStamp = timestamp;
            } else if (operationType === 3) {
                responseObject.checkThreeStatus = status;
                responseObject.checkThreeTimeStamp = timestamp;
            } else if (operationType === 4) {
                responseObject.checkFourStatus = status;
                responseObject.checkFourTimeStamp = timestamp;
            } else if (operationType === 5) {
                responseObject.splitStatus = status;
                responseObject.splitTimeStamp = timestamp;
            } else if (operationType === 6) {
                responseObject.compressionStatus = status;
                responseObject.compressionTimeStamp = timestamp;
            } else if (operationType === 7) {
                responseObject.encryptionStatus = status;
                responseObject.encryptionTimeStamp = timestamp;
            }
            return resolve(responseObject);
        });
    },

    /*
     * multiple insert upload parts
     * */
    insertUploadParts: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var uploadPartsList = options.uploadPartsList;
            debug('uploadPartsList', uploadPartsList);
            var convertedUploadPartList, keys, err;
            await Utils.convertObjectToArrayMD(uploadPartsList, async function (err, response) {
                if (err) {
                    debug('err', err);
                    return reject(err);
                }
                convertedUploadPartList = response.list;
                keys = response.keys;

                var query = 'insert into UploadPart (' + keys + ') values';
                var values = ' (?,?,?,?,?,?,?,?,?,?,?,?,uuid_to_bin(?),uuid_to_bin(?)) ';


                await PromiseBluebird.each(uploadPartsList, function (value) {
                    query = query + values;
                    query = query + ',';
                });

                query = query.replace(/,\s*$/, '');
                try {
                    var conn = await connection.getConnection();
                    var uploadPartInserted = await conn.query(query, convertedUploadPartList);
                    uploadPartInserted = Utils.isAffectedPool(uploadPartInserted);
                    debug('uploadPartInserted-----------------------------------------', uploadPartInserted);
                    if (!uploadPartInserted) {
                        throw err;
                    }
                    return resolve(Constants.OK_MESSAGE);
                } catch (err) {
                    debug('err ', err);
                    err = new Error(ErrorConfig.MESSAGE.UPLOAD_PART_CREATION_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
            });
        });
    },

    /*
     * Create upload part records
     * */
    createUploadPartRecord: function (options) {
        return new Promise(async function (resolve, reject) {
            var fileName = options.fileName;
            var partName = options.partName;
            var partNumber = options.partNumber;
            var userId = options.userId;
            var splitStatus = options.splitStatus;
            var splitTimeStamp = options.splitTimeStamp;
            var compressionStatus = options.compressionStatus;
            var compressionTimeStamp = options.compressionTimeStamp;
            var encryptionStatus = options.encryptionStatus;
            var encryptionTimeStamp = options.encryptionTimeStamp;
            var status = Constants.UPLOAD_PART_STATUS.PROGRESSING;
            var uploadPartsList = [], uploadPartsObject = {};
            var currentDate = DataUtils.getEpochMSTimestamp();
            var err;

            try {
                uploadPartsObject = {
                    fileName: fileName,
                    status: status,
                    partName: partName,
                    partNumber: partNumber,
                    splitStatus: splitStatus,
                    splitTimeStamp: splitTimeStamp,
                    compressionStatus: compressionStatus,
                    compressionTimeStamp: compressionTimeStamp,
                    encryptionStatus: encryptionStatus,
                    encryptionTimeStamp: encryptionTimeStamp,
                    createdAt: currentDate,
                    updatedAt: currentDate,
                    createdBy: userId,
                    updatedBy: userId
                };
                uploadPartsList.push(uploadPartsObject);

                // MULTIPLE INSERT OF UPLOAD_PART
                var insertUploadPartOption = {
                    uploadPartsList: uploadPartsList
                };
                var insertUploadPartResponse = await FileUpload.insertUploadParts(insertUploadPartOption);
                debug('insertUploadPartResponse', insertUploadPartResponse);
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    getUploadPart: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var fileName = options.fileName;
            var err;

            try {
                var conn = await connection.getConnection();
                var parts = await conn.query('select id,fileName,partName,partNumber,status,IVKey,decryptionKey from UploadPart ' +
                  'where fileName=? order by partNumber', [fileName]);

                return resolve(parts);
            } catch (err) {
                err = new Error(ErrorConfig.MESSAGE.UPLOAD_PART_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                debug('err', err);
                return reject(err);
            }
        });
    },

    moveFileMD: function (options) {
        return new Promise(function (resolve, reject) {
            var bucket = options.bucket;
            var fileName = options.fileName;
            var destination = options.destination;// With directory

            try {
                var params = {
                    CopySource: bucket + '/' + fileName,
                    Bucket: Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET,
                    Key: destination + '/' + fileName
                };

                var headParams = {
                    Bucket: bucket,
                    Key: fileName
                };
                s3.headObject(headParams, async function (err, data) {
                    if (err) {
                        console.log(err, err);
                        return resolve(Constants.OK_MESSAGE);
                    } else {
                        s3.copyObject(params, async function (err, data) {
                            if (err) {
                                debug('err copy', err);
                                err = new Error(ErrorConfig.MESSAGE.MOVE_FILE_FAILED);
                                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                                throw err;
                            } else {
                                debug('copyData', data);
                                var deleteOption = {
                                    Bucket: bucket,
                                    Key: fileName
                                };
                                var isDeleted = await s3.deleteObject(deleteOption).promise();
                                if (!isDeleted) {
                                    debug('err delete', err);
                                    err = new Error(ErrorConfig.MESSAGE.MOVE_FILE_FAILED);
                                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                                    throw err;
                                }
                                return resolve(Constants.OK_MESSAGE);
                            }
                        });
                    }
                });
            } catch (err) {
                debug('err123', err);
                return reject(err);
            }
        });
    },

    removeUnValidatedFiles: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var uploadLog = options.uploadLog;
            var accountId = uploadLog.accountId;
            var fileName = uploadLog.fileName;
            var isMultipart = uploadLog.isMultipart;
            var parts = [];

            try {
                if (parseInt(isMultipart) === 1) {
                    parts = await FileUpload.getUploadPart({fileName: fileName});
                } else {
                    parts = [{
                        partName: fileName
                    }];
                }
                await PromiseBluebird.each(parts, async function (part) {
                    var moveToFailOption = {
                        bucket: Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET + '/' + accountId + '/' + Constants.S3_FOLDER.ARRIVAL_FILES,
                        fileName: part.partName,
                        destination: accountId + '/' + Constants.S3_FOLDER.PROCESSED_CSV_FILES
                    };
                    var isMoved = await FileUpload.moveFileMD(moveToFailOption);
                    debug('isMoved', isMoved);
                });
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.MOVE_FILE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    updateUploadLogByCheck: async function (options, errorOptions, cb) {
        var uploadLog = options.uploadLog;
        var userId = uploadLog.userId;
        var fileName = options.fileName;
        var operations = options.operations;
        var isMultipart = options.isMultipart;
        var partNumber = options.partNumber;
        var partName = options.partName;
        var isLastPart = options.isLastPart;
        var firstLine = options.firstLine;
        var lastLine = options.lastLine;
        var numberOfColumns = options.numberOfColumns;
        var flag = false;
        //var operationType = options.operationType;
        //var status = options.status;
        //var timestamp = options.timestamp;
        var errors = options.errors;
        var err;


        try {
            if (DataUtils.isUndefined(operations)) {
                err = new Error(ErrorConfig.MESSAGE.OPERATION_REQUIRED);
            } else if (!DataUtils.isArray(operations)) {
                err = new Error(ErrorConfig.MESSAGE.OPERATION_MUST_BE_ARRAY);
            } else if (operations.length <= 0) {
                err = new Error(ErrorConfig.MESSAGE.AT_LEAST_ONE_REQUIRED);
            } else if (isMultipart && DataUtils.isUndefined(partName)) {
                err = new Error(ErrorConfig.MESSAGE.PART_NAME_REQUIRED);
            } else if (isMultipart && DataUtils.isUndefined(partNumber)) {
                err = new Error(ErrorConfig.MESSAGE.PART_NUMBER_REQUIRED);
            } else {
                _.map(operations, function (operation) {
                    if (DataUtils.isUndefined(operation.type)) {
                        err = new Error(ErrorConfig.MESSAGE.OPERATION_TYPE_REQUIRED);
                    } else if (DataUtils.isUndefined(operation.status)) {
                        err = new Error(ErrorConfig.MESSAGE.STATUS_REQUIRED);
                    } else if (DataUtils.isUndefined(operation.timestamp)) {
                        err = new Error(ErrorConfig.MESSAGE.TIMESTAMP_REQUIRED);
                    } else if (Object.keys(Constants.FILE_OPERATION_TYPE).indexOf(operation.type.toString()) === -1) {
                        err = new Error(ErrorConfig.MESSAGE.INVALID_OPERATION_TYPE);
                    }
                    if (err) {
                        debug('err', err);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        throw err;
                    }
                });
            }
            if (err) {
                debug('err', err);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            if (isMultipart) {

                //Update uploadLog by isMultipart
                var updateOption = {
                    userId: userId,
                    fileName: fileName,
                    isMultipart: isMultipart
                };
                var updateResponse = await FileUpload.updateLog(updateOption);

                // CREATE UPLOAD_PART_RECORD
                var createUploadPartOption = {
                    fileName: fileName,
                    partName: partName,
                    partNumber: partNumber,
                    userId: userId
                };
                await PromiseBluebird.each(operations, async function (operation) {
                    if (operation.status === 1) {
                        flag = true;
                    }
                    var fieldResponse = await FileUpload.getOperationFields({
                        status: operation.status,
                        timestamp: operation.timestamp,
                        operationType: operation.type
                    });
                    createUploadPartOption = Object.assign(createUploadPartOption, fieldResponse);
                });
                var createUploadPartResponse = await FileUpload.createUploadPartRecord(createUploadPartOption);
                debug('createUploadPartResponse', createUploadPartResponse);
            }
            if (!isMultipart || (isMultipart && isLastPart) || flag) {
                await PromiseBluebird.each(operations, async function (operation) {
                    var fieldResponse = await FileUpload.getOperationFields({
                        status: operation.status,
                        timestamp: operation.timestamp,
                        operationType: operation.type
                    });

                    // update upload log record
                    var updateOption = {
                        userId: userId,
                        fileName: fileName,
                        firstLine: firstLine,
                        lastLine: lastLine,
                        numberOfColumns: numberOfColumns
                    };
                    if (operation.status === 1) {
                        // remove file from s3 bucket
                        var removeResponse = await FileUpload.removeUnValidatedFiles({uploadLog: uploadLog});
                        debug('removeResponse', removeResponse);

                        updateOption.endTime = DataUtils.getEpochMSTimestamp();
                        updateOption.status = Constants.UPLOAD_STATUS.VALIDATE_FAIL;
                    } else if (!flag && operation.type === 6) {
                        updateOption.status = Constants.UPLOAD_STATUS.VALIDATE_SUCCESS;
                        updateOption.stepCompleted = Constants.UPLOAD_COMPLETED_STEPS.STEP_1;
                    }
                    updateOption = Object.assign(updateOption, fieldResponse);
                    var updateResponse = await FileUpload.updateLog(updateOption);
                });
            }

            if (errors && errors.length > 0) {
                FileUpload.createErrorLog(options, errorOptions, function (err, response) {
                    if (err) {
                        debug('err', err);
                        return cb(err);
                    }
                    return cb(null, Constants.OK_MESSAGE);
                });
            }
            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err', err);
            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.UPLOAD_LOG_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    copyCSVFileMD: async function (options, cb) {
        var uploadLog = options.uploadLog;
        var accountId = uploadLog.accountId;
        var userId = uploadLog.userId;
        var fileName = options.fileName;
        var isMultipart = options.isMultipart;
        var type = uploadLog.type;
        var bucket = Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET;
        var source = 's3://' + bucket + '/' + accountId + '/' + Constants.S3_FOLDER.ARRIVAL_FILES + '/';
        var destination = Constants.SCOPEHUB_EFS_PATH + '/' + Constants.DESTINATION_FOLDER[type];
        var errorData, errorInserted;
        var str;

        try {
            debug('1', isMultipart);
            if (isMultipart) {
                //debug('2==>', fileName);
                var index = fileName.indexOf('.csv.gz.txt');
                //debug('index', index);
                var filePrefix = fileName.substring(index, 0);
                str = 'aws s3 cp ' + source + ' ' + destination + ' --recursive --exclude "*" --include "*' + filePrefix + '*"';
            } else {
                //debug('3');
                str = 'aws s3 cp ' + source + fileName + ' ' + destination;
            }
            debug('4', str);
            var data = execSync(str);
            debug('data', data);

            debug('5');
            var updateOption = {
                userId: userId,
                fileName: fileName,
                status: Constants.UPLOAD_STATUS.COPY_SUCCESS,
                stepCompleted: Constants.UPLOAD_COMPLETED_STEPS.STEP_3
            };
            var updateResponse = await FileUpload.updateLog(updateOption);
            debug('updateResponse', updateResponse);

            debug('7');
            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err', err);

            try {
                // Update the log with copy fail
                updateOption = {
                    userId: userId,
                    fileName: fileName,
                    status: Constants.UPLOAD_STATUS.COPY_FAIL,
                    statusReasonCode: Constants.UPLOAD_STATUS_REASON_CODES.COPY_FILE_TO_EFS_FAIL,
                    endTime: DataUtils.getEpochMSTimestamp()
                };
                updateResponse = await FileUpload.updateLog(updateOption);
                debug('updateResponse', updateResponse);

                // Create error log
                errorData = {
                    uploadLogId: uploadLog.id,
                    createdAt: DataUtils.getEpochMSTimestamp(),
                    numberOfOccurence: 0,
                    columnName: '',
                    failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.COPY_FILE_FROM_S3_TO_EFS_FAIL.CODE,
                    errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.COPY_FILE_FROM_S3_TO_EFS_FAIL.MESSAGE
                };
                errorInserted = await FileUpload.insertErrorLogMD({
                    errors: [errorData]
                });

                // Create entry in alert table of admin app db
                err = new Error(ErrorConfig.MESSAGE.FILE_COPY_FAIL);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            } catch (err) {
                err = new Error(ErrorConfig.MESSAGE.FILE_COPY_FAIL);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
        }
    },

    /*
     * Validate parts
     * */
    validatePartsUpload: function (options) {
        return new Promise(async function (resolve, reject) {
            var parts = options.parts;
            var err;

            try {
                if (!parts) {
                    err = new Error(ErrorConfig.MESSAGE.PARTS_REQUIRED);
                } else if (!DataUtils.isArray(parts)) {
                    err = new Error(ErrorConfig.MESSAGE.PARTS_MUST_BE_ARRAY);
                } else {
                    _.map(parts, function (part) {
                        if (DataUtils.isUndefined(part.partName)) {
                            err = new Error(ErrorConfig.MESSAGE.PART_NAME_REQUIRED);
                        } else if (DataUtils.isUndefined(part.partNumber)) {
                            err = new Error(ErrorConfig.MESSAGE.PART_NUMBER_REQUIRED);
                        } else if (DataUtils.isUndefined(part.status)) {
                            err = new Error(ErrorConfig.MESSAGE.STATUS_REQUIRED);
                        } else if (DataUtils.isUndefined(part.IVKey)) {
                            err = new Error(ErrorConfig.MESSAGE.IV_KEY_REQUIRED);
                        } else if (DataUtils.isUndefined(part.decryptionKey)) {
                            err = new Error(ErrorConfig.MESSAGE.DECRYPTION_KEY_REQUIRED);
                        }
                        if (err) {
                            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                            throw err;
                        }
                    });
                }
                if (err) {
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    throw err;
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    getHeadObject: function (params) {
        return new PromiseBluebird(function (resolve, reject) {
            s3.headObject(params, function (err, data) {
                if (err) {
                    debug('err', err);
                    return reject(err);
                }
                return resolve(data);
            });
        });
    },

    getSizeOfParts: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var parts = options.parts;
            var bucket = Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET;
            var accountId = options.accountId;

            try {
                bucket = bucket + '/' + accountId + '/' + Constants.S3_FOLDER.ARRIVAL_FILES;
                await PromiseBluebird.each(parts, async function (part) {
                    debug('1');
                    var params = {
                        Bucket: bucket,
                        Key: part.partName
                    };
                    if (part.status === 2) {
                        var headData = await FileUpload.getHeadObject(params);
                        part.partSize = headData.ContentLength;
                    }
                });
                return resolve(parts);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },
    updateUploadLog: async function (options, auditOptions, errorOptions, cb) {
        var fileName = options.fileName;
        var status = options.status;
        var uploadLog = options.uploadLog;
        var userId = uploadLog.userId;
        var accountId = uploadLog.accountId;
        var parts = options.parts;
        var isMultipart = options.isMultipart;
        var IVKey = options.IVKey;
        var decryptionKey = options.decryptionKey;
        var uploadId = options.uploadId;
        var version = options.version;
        var errors = options.errors;
        var validStatus = [1, 2];// 1 - fail, 2 - success and // for uploadPart status 2 - success , 3- fail
        var updateOption, updateResponse, stepCompleted;
        var err, flag = true;

        if (DataUtils.isUndefined(fileName)) {
            err = new Error(ErrorConfig.MESSAGE.FILE_NAME_REQUIRED);
        } else if (DataUtils.isUndefined(status)) {
            err = new Error(ErrorConfig.MESSAGE.STATUS_REQUIRED);
        } else if (validStatus.indexOf(status) === -1) {
            err = new Error(ErrorConfig.MESSAGE.INVALID_FILE_STATUS);
        } else if (!isMultipart && DataUtils.isUndefined(IVKey)) {
            err = new Error(ErrorConfig.MESSAGE.IV_KEY_REQUIRED);
        } else if (!isMultipart && DataUtils.isUndefined(decryptionKey)) {
            err = new Error(ErrorConfig.MESSAGE.DECRYPTION_KEY_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var actualStatus;
            if (status === 2) {
                actualStatus = Constants.UPLOAD_STATUS.S3_UPLOAD_SUCCESS;
                stepCompleted = Constants.UPLOAD_COMPLETED_STEPS.STEP_2;
            } else {
                actualStatus = Constants.UPLOAD_STATUS.S3_UPLOAD_FAILED;
            }
            if (isMultipart) {
                // VALIDATE parts
                var checkResponse = await FileUpload.validatePartsUpload({parts: parts});
                var multipartStatus;
                if (status === 2) {
                    multipartStatus = Constants.UPLOAD_PART_STATUS.SUCCESS;
                } else {
                    multipartStatus = Constants.UPLOAD_PART_STATUS.FAIL;
                }

                // update upload log record
                updateOption = {
                    userId: userId,
                    fileName: fileName,
                    status: actualStatus,
                    multipartStatus: multipartStatus,
                    stepCompleted: stepCompleted
                };
                updateResponse = await FileUpload.updateLog(updateOption);

                //Get parts with size
                var getSizeOption = {
                    parts: parts,
                    accountId: accountId
                };
                //debug('parts before', parts);
                parts = await FileUpload.getSizeOfParts(getSizeOption);
                //debug('parts after', parts);

                // update Upload part record
                if (parts.length > 0) {
                    var updateUploadPartOption = {
                        parts: parts,
                        fileName: fileName
                    };
                    var updateUploadPartResponse = await FileUpload.updateUploadPart(updateUploadPartOption);
                }
            } else {
                updateOption = {
                    userId: userId,
                    fileName: fileName,
                    status: actualStatus,
                    IVKey: IVKey,
                    decryptionKey: decryptionKey,
                    stepCompleted: stepCompleted

                };
                updateResponse = await FileUpload.updateLog(updateOption);
            }
            debug('1');

            if (status === 1) {
                return cb(null, Constants.OK_MESSAGE);
            }

            // COPY FILE FROM S3 TO EFS
            var host = 'https://test-be.scopehub.org';
            //var host = 'http://localhost:3000';
            var copyUrl = host + '/api/upload/file/copy';

            var option = {
                isMultipart: isMultipart,
                fileName: fileName,
                uploadLog: uploadLog
            };
            var requestOption = {
                url: copyUrl,
                method: 'PATCH',
                json: true,
                form: option
            };
            Request(requestOption, async function (err, response, body) {
                debug('err', err);
                if (err || response.statusCode >= 400) {
                    err = err || new Error(ErrorConfig.MESSAGE.HTTP_REQUEST_FAILED);
                    err.status = err.status || ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                }
                debug('Final body', body);
                await connection.closeConnectionCronJob();
            });
            AuditUtils.create(auditOptions);
            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    updateUploadLogCancel: async function (options, auditOptions, errorOptions, cb) {
        var fileName = options.fileName;
        var status = options.status;
        var uploadLog = options.uploadLog;
        var userId = uploadLog.userId;
        var accountId = uploadLog.accountId;
        var parts = options.parts;
        var isMultipart = options.isMultipart;
        var errors = options.errors;
        var validStatus = [1, 2];// 1 - fail, 2 - success and // for uploadPart status 2 - success , 3- fail
        var updateOption, updateResponse, stepCompleted;
        //var status = Constants.UPLOAD_STATUS.NOT_UPLOADED;
        var err, flag = true;

        if (DataUtils.isUndefined(fileName)) {
            err = new Error(ErrorConfig.MESSAGE.FILE_NAME_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            if (isMultipart) {
                // update upload log record
                updateOption = {
                    userId: userId,
                    fileName: fileName,
                    status: Constants.UPLOAD_STATUS.CANCEL_BY_USER,
                    multipartStatus: Constants.UPLOAD_PART_STATUS.FAIL
                };
                updateResponse = await FileUpload.updateLog(updateOption);

                if (parts && parts.length > 0) {
                    var updateUploadPartOption = {
                        parts: parts,
                        fileName: fileName
                    };
                    var updateUploadPartResponse = await FileUpload.updateUploadPart(updateUploadPartOption);
                }
            } else {
                updateOption = {
                    userId: userId,
                    fileName: fileName,
                    status: Constants.UPLOAD_STATUS.CANCEL_BY_USER
                };
                updateResponse = await FileUpload.updateLog(updateOption);
            }
            if (errors && errors.length > 0) {
                debug('Inside errors');
                FileUpload.createErrorLog(options, errorOptions, function (err, response) {
                    if (err) {
                        debug('err', err);
                        return cb(err);
                    }
                    return cb(null, Constants.OK_MESSAGE);
                });
            } else {
                return cb(null, Constants.OK_MESSAGE);
            }
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    getUploadLog: async function (options, errorOptions, cb) {
        var userId = options.userId;
        var type = options.type;
        var err;
        var validateValues;

        if (DataUtils.isUndefined(type)) {
            err = new Error(ErrorConfig.MESSAGE.TYPE_REQUIRED);
        } else if (Object.values(Constants.UPLOAD_FILE_TYPE).indexOf(parseInt(type)) === -1) {
            err = new Error(ErrorConfig.MESSAGE.INVALID_TYPE);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();

            var uploadLogs = await conn.query('select id,fileName,fileSize,status,from_unixtime(startTime/1000) as startTime,' +
              ' from_unixtime(endTime/1000) as endTime,type,status,stepCompleted,mainUrl,successUrl,failedUrl from UploadLog where userId=uuid_to_bin(?) ' +
              ' and id != 0 and type = ?;',
              [userId, type]);
            //uploadLogs = Utils.filteredResponsePool(uploadLogs);
            if (!uploadLogs) {
                err = new Error(ErrorConfig.MESSAGE.UPLOAD_LOG_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }

            /* var invalidRecordOptions = {
                 type: 1,
                 uploadLogId: uploadLogs[0].id,
                 accountId: options.accountId,
                 userId: userId,
                 languageCultureCode: 'en-US'
             };
             var invalidRecordResponse = await FileUpload.getInvalidRecords(invalidRecordOptions);
             debug('invalidRecordResponse', invalidRecordResponse);
             debug('3');*/

            /* var option = {
                 type: 10,
                 accountId: options.accountId,
                 userId: userId
             };
             var additionQueryResponse = await FileUpload.additionOperationMD(option);
             debug('additionQueryResponse', additionQueryResponse);*/
            /* var copyOption = {
                 type: 2,
                 accountId: options.accountId,
                 userId: userId
             };
             var copyResponse = await FileUpload.copyTempToOriginalTable(copyOption);
             debug('In step 4 copyResponse', copyResponse);*/

            /* var insertUOMOptions = {
                 accountId: options.accountId,
                 userId: userId,
                 languageCultureCode: 'en-US',
                 type: 8
             };
             var insertUOMResponse = await FileUpload.insertUOMRecords(insertUOMOptions);
             debug('insertUOMResponse', insertUOMResponse);*/
            return cb(null, uploadLogs);// successful response
        } catch (err) {
            debug('err456', err);
            // await ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.UPLOAD_LOG_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    getFileFormat: async function (options, errorOptions, cb) {
        var userId = options.userId;
        var type = options.type;
        var version = options.version;
        var err;

        if (DataUtils.isUndefined(type)) {
            err = new Error(ErrorConfig.MESSAGE.TYPE_REQUIRED);
        } else if (DataUtils.isUndefined(version)) {
            err = new Error(ErrorConfig.MESSAGE.VERSION_REQUIRED);
        } else if (Object.values(Constants.UPLOAD_FILE_TYPE).indexOf((parseInt(type))) === -1) {
            err = new Error(ErrorConfig.MESSAGE.INVALID_TYPE);
        } else if (Constants.FILE_DELIMETER.VERSION.indexOf(version) === -1) {
            err = new Error(ErrorConfig.MESSAGE.INVALID_VERSION);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var versionValue;
            _.forEach(Constants.VERSION, function (versionObject, key) {
                if (versionObject.type === version) {
                    versionValue = versionObject.value;
                    return;
                }
            });
            var conn = await connection.getConnection();
            var fileFormat = await conn.query('select id,importType,version,columnNumber,ColumnName,isRequiredField,' +
              'dataType,minimumLength,maximumLength from Profile where importType=? and version=? order by columnNumber;', [type, versionValue]);
            if (!fileFormat) {
                err = new Error(ErrorConfig.MESSAGE.GET_FILE_FORMAT_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            return cb(null, fileFormat);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.GET_FILE_FORMAT_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    getFilesUrl: async function (options, errorOptions, cb) {
        var accountId = options.accountId;
        var fileName = options.fileName;
        var err;
        var successUrl, failedUrl, mainUrl;

        if (DataUtils.isUndefined(fileName)) {
            err = new Error(ErrorConfig.MESSAGE.FILE_NAME_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var successFileName = 'success_' + fileName.replace('.gz.txt', '');
            var failFileName = 'fail_' + fileName.replace('.gz.txt', '');
            var originalFileName = 'original_' + fileName.replace('.gz.txt', '');
            var conn = await connection.getConnection();
            var fileUrlResponse = await conn.query('SELECT successUrl, failedUrl, mainUrl FROM UploadLog where fileName = ?',
              [fileName]);
            fileUrlResponse = Utils.filteredResponsePool(fileUrlResponse);
            debug('fileUrlResponse', fileUrlResponse);

            // Generate success url
            if (DataUtils.isDefined(fileUrlResponse.successUrl)) {
                var successStoreOption = {
                    Bucket: Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET,
                    Key: accountId + '/' + Constants.S3_FOLDER.UPLOAD_SUCCESS + '/' + successFileName,
                    Expires: 7 * 24 * 60 * 60
                };

                successUrl = await FileUpload.generateSignedUrl({
                    storeOption: successStoreOption,
                    type: 'getObject'
                });

                debug('successUrl', successUrl);
            }

            // Generate failed url
            if (DataUtils.isDefined(fileUrlResponse.failedUrl)) {
                var failStoreOption = {
                    Bucket: Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET,
                    Key: accountId + '/' + Constants.S3_FOLDER.UPLOAD_FAIL + '/' + failFileName,
                    Expires: 7 * 24 * 60 * 60
                };

                failedUrl = await FileUpload.generateSignedUrl({
                    storeOption: failStoreOption,
                    type: 'getObject'
                });
                debug('failedUrl', failedUrl);
            }

            // Generate main url
            if (DataUtils.isDefined(fileUrlResponse.mainUrl)) {
                var mainStoreOption = {
                    Bucket: Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET,
                    Key: accountId + '/' + Constants.S3_FOLDER.ORIGINAL_FILES + '/' + originalFileName,
                    Expires: 7 * 24 * 60 * 60
                };
                mainUrl = await FileUpload.generateSignedUrl({
                    storeOption: mainStoreOption,
                    type: 'getObject'
                });
                debug('mainUrl', mainUrl);
            }
            var response = {
                successUrl: successUrl,
                failedUrl: failedUrl,
                mainUrl: mainUrl
            };

            var updateUrlOptions = {
                successUrl: successUrl || '',
                failedUrl: failedUrl || '',
                mainUrl: mainUrl || '',
                fileName: options.fileName
            };
            var updateUrl = await FileUpload.updateUrlForFileUpload(updateUrlOptions);
            debug('updateUrl', updateUrl);
            return cb(null, response || []);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.GET_FILE_URL_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    getValidationErrors: async function (options, errorOptions, cb) {
        var uploadLogId = options.uploadLogId;
        var err;

        if (DataUtils.isUndefined(uploadLogId)) {
            err = new Error(ErrorConfig.MESSAGE.UPLOAD_LOG_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
        try {
            var conn = await connection.getConnection();
            var validationErrors = await conn.query('select id,uploadLogId,columnName,failReasonCode,errorMessage,numberOfOccurence,meta from ValidationErrorLog where uploadLogId=?', [uploadLogId]);
            if (!validationErrors) {
                err = new Error(ErrorConfig.MESSAGE.GET_VALIDATION_ERROR_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            _.map(validationErrors, function (error) {
                error.meta = JSON.parse(error.meta);
            });
            return cb(null, validationErrors || []);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.GET_VALIDATION_ERROR_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    removeTempTableData: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var type = options.type;
            var userId = options.userId;
            var accountId = options.accountId;
            var tempTable = Constants.TABLE_NAME[parseInt(type)].TEMP;
            var query, values = [accountId, userId], err;

            try {
                var conn = await connection.getConnection();
                query = 'DELETE FROM ' + tempTable + ' where accountId=uuid_to_bin(?) and createdBy=uuid_to_bin(?);';
                var removeResponse = await conn.query(query, values);
                removeResponse = Utils.isAffectedPool(removeResponse);
                debug('removeResponse ', removeResponse);
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    validateUploadLogFieldsMD: function (options, cb) {
        var uploadLogFields = '';
        var uploadLogOptionalValues = [];

        try {
            if (!DataUtils.isValidateOptionalField(options.fileName)) {
                uploadLogFields += 'fileName=? ,';
                uploadLogOptionalValues.push(options.fileName);
            }
            if (!DataUtils.isValidateOptionalField(options.fileSize)) {
                uploadLogFields += 'fileSize=? ,';
                uploadLogOptionalValues.push(options.fileSize);
            }
            if (!DataUtils.isValidateOptionalField(options.startTime)) {
                uploadLogFields += 'startTime=? ,';
                uploadLogOptionalValues.push(options.startTime);
            }
            if (!DataUtils.isValidateOptionalField(options.endTime)) {
                uploadLogFields += 'endTime=? ,';
                uploadLogOptionalValues.push(options.endTime);
            }
            if (!DataUtils.isValidateOptionalField(options.type)) {
                uploadLogFields += 'type=? ,';
                uploadLogOptionalValues.push(options.type);
            }
            if (!DataUtils.isValidateOptionalField(options.status)) {
                uploadLogFields += 'status=? ,';
                uploadLogOptionalValues.push(options.status);
            }
            if (!DataUtils.isValidateOptionalField(options.stepCompleted)) {
                uploadLogFields += 'stepCompleted=? ,';
                uploadLogOptionalValues.push(options.stepCompleted);
            }
            if (!DataUtils.isValidateOptionalField(options.ipAddress)) {
                uploadLogFields += 'ipAddress=? ,';
                uploadLogOptionalValues.push(options.ipAddress);
            }
            if (!DataUtils.isValidateOptionalField(options.statusReasonCode)) {
                uploadLogFields += 'statusReasonCode=? ,';
                uploadLogOptionalValues.push(options.statusReasonCode);
            }
            var response = {
                uploadLogFields: uploadLogFields,
                uploadLogOptionalValues: uploadLogOptionalValues
            };
            return cb(null, response);
        } catch (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
    },

    updateUploadLogMD: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var userId = options.userId;
            var accountId = options.accountId;
            var fileName = options.fileName;
            var uploadLogFields;
            var uploadLogOptionalValues = [];
            var uploadLogRequiredValues = [];
            var updatedAt = DataUtils.getEpochMSTimestamp();


            uploadLogRequiredValues.push(accountId, fileName);
            FileUpload.validateUploadLogFieldsMD(options, async function (err, response) {
                if (err) {
                    return reject(err);
                }
                uploadLogFields = response.uploadLogFields;
                uploadLogOptionalValues = response.uploadLogOptionalValues;

                uploadLogRequiredValues = _.concat(uploadLogRequiredValues, uploadLogOptionalValues);
                uploadLogRequiredValues.push(updatedAt, userId, accountId, fileName);

                try {
                    var conn = await connection.getConnection();
                    var uploadLodStore = await conn.query('IF (select 1 from UploadLog where accountId=uuid_to_bin(?) and fileName=?) is null then ' +
                      'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "UPLOAD_LOG_NOT_FOUND", MYSQL_ERRNO = 4001;' +
                      'ELSE update UploadLog set ' + uploadLogFields + ' updatedAt = ?,updatedBy=uuid_to_bin(?) ' +
                      'where accountId=uuid_to_bin(?) and fileName=?;end if;', uploadLogRequiredValues);
                    uploadLodStore = Utils.isAffectedPool(uploadLodStore);
                    if (!uploadLodStore) {
                        throw err;
                    }
                    debug('UPDATE UPLOAD LOG SUCCESS=============');
                    return resolve(Constants.OK_MESSAGE);
                } catch (err) {
                    debug('err 1234', err);
                    if (err.errno === 4001) {
                        err = new Error(ErrorConfig.MESSAGE.UPLOAD_LOG_NOT_FOUND);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        return reject(err);
                    } else {
                        err = new Error(ErrorConfig.MESSAGE.UPLOAD_LOG_UPDATE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                        return reject(err);
                    }
                }
            });
        });
    },

    fileUploadCatch: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var uploadLogOptions, updateResponse, date, notificationExpirationDate, notificationOption, destination;
            var removeOption, removeResponse, isMoved, error;
            var user = options.user;
            var userId = options.userId;
            var accountId = options.accountId;
            var fileName = options.fileName;
            var newFileName = options.newFileName;
            var err = options.err;
            var type = options.type;
            var isLoad = options.isLoad;
            var moveToFailOption = {
                bucket: Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET + '/' + accountId + '/' + Constants.S3_FOLDER.ARRIVAL_FILES,
                fileName: fileName,
                destination: accountId + '/' + Constants.S3_FOLDER.PROCESSED_CSV_FILES
            };

            try {
                uploadLogOptions = {
                    userId: userId,
                    accountId: accountId,
                    fileName: fileName,
                    status: err.uploadStatus,
                    statusReasonCode: err.statusReasonCode,
                    endTime: DataUtils.getEpochMSTimestamp()
                };
                updateResponse = await FileUpload.updateUploadLogMD(uploadLogOptions);

                // Send notification
                date = new Date();
                notificationExpirationDate = date.setDate(date.getDate() + Constants.INVITATION_EXPIRATION_DATE_LIMIT);
                notificationExpirationDate = new Date(notificationExpirationDate);
                notificationOption = {
                    refereId: Constants.DEFAULT_REFERE_ID,
                    user_ids: [userId],
                    topic_id: userId,
                    refereType: Constants.NOTIFICATION_REFERE_TYPE.UPLOAD_FILE,
                    notification_reference: NotificationReferenceData.FILE_UPLOAD_FAIL,
                    notificationExpirationDate: notificationExpirationDate,
                    paramasDateTime: new Date(),
                    paramsInviter: user.email + ', ' +
                      (user.firstName ? user.firstName : '') + ' ' +
                      (user.lastName ? user.lastName : ''),
                    //paramsInvitee: 'scopehub@gmail.com',
                    paramsInvitee: user.email + ', ' +
                      (user.firstName ? user.firstName : '') + ' ' +
                      (user.lastName ? user.lastName : ''),
                    metaEmail: 'scopehub@gmail.com',
                    languageCultureCode: user.languageCultureCode,
                    createdBy: userId,
                    type: Constants.DEFAULT_NOTIFICATION_TYPE
                };
                await NotificationApi.createMD(notificationOption);


                if (isLoad) {
                    // Remove file from
                    destination = '..' + path.sep + 'public' + path.sep + Constants.DESTINATION_FOLDER[type];
                    destination = path.resolve(__dirname, destination);
                    if (fs.existsSync(destination + '/' + newFileName) === true) {
                        fs.unlinkSync(destination + '/' + newFileName);
                    }

                    // Remove data from temp table
                    removeOption = {
                        type: type,
                        accountId: accountId,
                        userId: userId
                    };
                    removeResponse = await FileUpload.removeTempTableData(removeOption);
                    debug('removeResponse', removeResponse);
                }
                if (err.notFound) {
                    debug('Inside if not found');
                    return reject(err);
                } else {
                    isMoved = await FileUpload.moveFileMD(moveToFailOption);
                    debug('isMoved', isMoved);
                    if (!isMoved) {
                        error = new Error(ErrorConfig.MESSAGE.MOVE_FILE_FAILED);
                        error.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                        return reject(error);
                    }
                }
                uploadLogOptions = {
                    userId: userId,
                    accountId: accountId,
                    fileName: fileName,
                    status: err.uploadStatus,
                    statusReasonCode: err.statusReasonCode,
                    endTime: DataUtils.getEpochMSTimestamp()
                };
                updateResponse = await FileUpload.updateUploadLogMD(uploadLogOptions);
                return resolve(err);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    getUserById: function (id) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var conn = await connection.getConnection();
                var res = await conn.query('set global wsrep_max_ws_rows = 0');
                var res1 = await conn.query('show variables like \'%wsrep_max_ws_rows%\'');
                debug('res1', res1);
                var user = await conn.query('select email, firstName,lastName,languageCultureCode from users where id=uuid_to_bin(?)', [id]);
                user = Utils.filteredResponsePool(user);
                return resolve(user);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    getVersionByAccountId: function (accountId) {
        return new Promise(async function (resolve, reject) {
            var err;
            try {
                var conn = await connection.getConnection();
                var account = await conn.query('select fileUploadVersion as version,fileUploadPrivateKey as privateKey ' +
                  'from accounts where id=uuid_to_bin(?);', [accountId]);
                account = Utils.filteredResponsePool(account);
                /*if (!account || !account.version) {
                err = new Error(ErrorConfig.MESSAGE.VERSION_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return reject(err);
            }*/
                return resolve(account);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    aes256gcm: function (key, enc, iv, authTag) {
        var algo = 'aes-256-gcm';

        const decipher = crypto.createDecipheriv(algo, key, iv);
        decipher.setAuthTag(authTag);
        var str = decipher.update(enc, 'base64', 'latin1');
        str += decipher.final('latin1');
        return str;
    },

    decryptFile: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var privateKey = options.privateKey;
            var IVKey = options.IVKey;
            var decryptionKey = options.decryptionKey;
            var destination = options.destination;
            var fileName = options.fileName;
            var originalFileName = options.originalFileName;
            var userId = options.userId;
            var accountId = options.accountId;
            var uploadLogOptions, updateResponse;

            try {
                //reading a file
                var fileData = fs.readFileSync(destination + '/' + fileName);
                fileData = Buffer.from(fileData);
                debug('1');

                //decrypt key
                var passwordDecrypter = new NodeRSA(privateKey);
                debug('2');
                passwordDecrypter.setOptions({encryptionScheme: 'pkcs1'});
                debug('3', decryptionKey);
                var decryptedKey = passwordDecrypter.decrypt(decryptionKey, 'utf8');
                debug('4', decryptedKey);

                var key = Buffer.from(decryptedKey, 'base64');
                //debug('5', IVKey);
                //debug('key', key);

                //iv
                var iv = Buffer.from(JSON.parse(IVKey));
                //debug('6', iv);

                var authTag = fileData.slice(-16);

                debug('7');

                const decryptedData = FileUpload.aes256gcm(key, fileData.slice(0, -16), iv, Buffer.from(authTag));
                debug('13');

                /*var passwordDecrypter = new NodeRSA(privateKey);
                  passwordDecrypter.setOptions({encryptionScheme: 'pkcs1'});
                  var fileData = JSON.parse(fs.readFileSync(destination + '/' + fileName));
                  var encPassword = passwordDecrypter.decrypt(fileData.encPassword, 'utf8');
                  var data = sjcl.decrypt(encPassword, fileData.cipher);*/

                uploadLogOptions = {
                    userId: userId,
                    accountId: accountId,
                    fileName: originalFileName,
                    status: Constants.UPLOAD_STATUS.DECRYPT_SUCESS
                };
                updateResponse = await FileUpload.updateUploadLogMD(uploadLogOptions);

                return resolve(decryptedData);
            } catch (err) {
                debug('err', err);
                try {
                    uploadLogOptions = {
                        userId: userId,
                        accountId: accountId,
                        fileName: originalFileName,
                        status: Constants.UPLOAD_STATUS.DECRYPT_FAIL
                    };
                    updateResponse = await FileUpload.updateUploadLogMD(uploadLogOptions);
                    return reject(err);
                } catch (err) {
                    return reject(err);
                }
            }
        });
    },

    deCompress: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var data = options.data;
            var destination = options.destination;
            var fileName = options.fileName;
            var originalFileName = options.originalFileName;
            var userId = options.userId;
            var accountId = options.accountId;
            var uploadLogOptions, updateResponse;

            try {
                var csvData = pako.ungzip(data);
                //debug('csvData', typeof csvData);
                // debug('csvData', Buffer.from(csvData).toString('utf8'));
                var newFileName = fileName.replace('.gz.txt', '');
                var writeResponse = fs.writeFileSync(destination + '/' + newFileName, csvData);

                uploadLogOptions = {
                    userId: userId,
                    accountId: accountId,
                    fileName: originalFileName,
                    status: Constants.UPLOAD_STATUS.DECOMPRESS_SUCCESS
                };
                updateResponse = await FileUpload.updateUploadLogMD(uploadLogOptions);

                //remove encrypted file from folder
                if (fs.existsSync(destination + '/' + fileName) === true) {
                    fs.unlinkSync(destination + '/' + fileName);
                }
                return resolve({newFileName: newFileName});
            } catch (err) {
                try {
                    uploadLogOptions = {
                        userId: userId,
                        accountId: accountId,
                        fileName: originalFileName,
                        status: Constants.UPLOAD_STATUS.DECOMPRESS_FAIL
                    };
                    updateResponse = await FileUpload.updateUploadLogMD(uploadLogOptions);
                    return reject(err);
                } catch (err) {
                    return reject(err);
                }
            }
        });
    },

    generateOriginalCSVFile: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var type = options.type;
                var numberOfColumns = options.numberOfColumns;
                var newFileName = options.newFileName;
                var fileName = options.fileName;
                var destination = options.destination;
                var columnNameIndicator = options.columnNameIndicator;
                var partNumber = options.partNumber;
                var generateFilePath = destination + '/' + 'original_' + fileName.replace('.gz.txt', '');

                if (parseInt(partNumber) === 1 && columnNameIndicator === 0) {
                    var columnNameOptions = {
                        type: type,
                        numberOfColumns: numberOfColumns
                    };
                    var columnNamesResponse = await FileUpload.getColumnNames(columnNameOptions);
                    columnNamesResponse = _.map(columnNamesResponse, 'columnName');
                    debug('columnNamesResponse', columnNamesResponse);
                    fs.appendFileSync(generateFilePath, columnNamesResponse);
                    fs.appendFileSync(generateFilePath, '\n');
                }
                var data = fs.readFileSync(destination + '/' + newFileName);
                fs.appendFileSync(generateFilePath, data);
                debug('The "data to append" was appended to file!');

                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                if (fs.existsSync(generateFilePath)) {
                    fs.unlinkSync(generateFilePath);
                }
                return reject(err);
            }
        })
    },

    deCryptAndDeCompressFile: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var fileName = options.fileName;
            var uploadLog = options.uploadLog;
            var userId = options.userId;
            var accountId = options.accountId;
            var type = options.type;
            var parts = options.parts;
            var isMultipart = options.isMultipart;
            var privateKey = options.privateKey;
            var columnNameIndicator = options.columnNameIndicator;
            var numberOfColumns = options.numberOfColumns;
            var destination = Constants.SCOPEHUB_EFS_PATH + path.sep + Constants.DESTINATION_FOLDER[type];
            destination = path.resolve(__dirname, destination);
            var filePath = destination + '/' + 'original_' + fileName.replace('.gz.txt', '');
            var lastLine = uploadLog.lastLine;
            var encryptedData, newFileName;

            try {
                var decryptOption = {
                    destination: destination,
                    userId: userId,
                    accountId: accountId,
                    originalFileName: fileName,
                    privateKey: privateKey
                };
                if (parseInt(isMultipart) !== 1) {
                    debug('Inside if====1');
                    parts = [{
                        partName: fileName,
                        IVKey: uploadLog.IVKey,
                        decryptionKey: uploadLog.decryptionKey,
                        partNumber: 1
                    }];
                }
                debug('parts', parts);

                // Re-format firstLine (column indicator)
                var firstLine = uploadLog.firstLine;
                firstLine = firstLine.split(',');
                firstLine[11] = '1';
                firstLine = firstLine.join(',').replace('"",,', '"""""",","');
                debug('firstLine===', firstLine);
                debug('lastLine===', lastLine);

                // Create file and add first line
                fs.appendFileSync(filePath, firstLine);
                fs.appendFileSync(filePath, '\n');

                //if (parseInt(isMultipart) === 1) {
                await PromiseBluebird.each(parts, async function (part) {
                    debug('1', part.partName);
                    decryptOption.fileName = part.partName;
                    decryptOption.IVKey = part.IVKey;
                    decryptOption.decryptionKey = part.decryptionKey;
                    // decrypt
                    encryptedData = await FileUpload.decryptFile(decryptOption);
                    debug('after enctp');

                    //decompress
                    decryptOption.data = encryptedData;
                    var compressResponse = await FileUpload.deCompress(decryptOption);
                    newFileName = compressResponse.newFileName;
                    //debug('compressResponse', compressResponse);
                    var csvFileOptions = {
                        type: type,
                        numberOfColumns: numberOfColumns,
                        newFileName: newFileName,
                        destination: destination,
                        fileName: fileName,
                        partNumber: part.partNumber,
                        columnNameIndicator: columnNameIndicator
                    };
                    var csvFileResponse = await FileUpload.generateOriginalCSVFile(csvFileOptions);
                    debug('csvFileResponse', csvFileResponse);
                    if (fs.existsSync(destination + '/' + part.partName) === true) {
                        fs.unlinkSync(destination + '/' + part.partName);
                    }
                });

                // add last line to file
                fs.appendFileSync(filePath, lastLine);
                // upload original file to s3
                var uploadFileOptions = {
                    fileName: 'original_' + fileName.replace('.gz.txt', ''),
                    filePath: destination + '/' + 'original_' + fileName.replace('.gz.txt', ''),
                    destination: accountId + '/' + Constants.S3_FOLDER.ORIGINAL_FILES
                };
                var uploadFileResponse = await FileUpload.uploadFileToS3(uploadFileOptions);
                debug('uploadFileResponse', uploadFileResponse);
                var url = uploadFileResponse.url;

                /*var storeOption = {
                    Bucket: Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET,
                    Key: destination + '/' + fileName,
                    Expires: 7 * 24 * 60 * 60
                };

                var url = await FileUpload.generateSignedUrl({
                    storeOption: storeOption,
                    type: 'getObject'
                });

                debug('url==========', url);*/

                return resolve({newFileName: newFileName, mainUrl: url});
            } catch (err) {
                err = new Error(ErrorConfig.MESSAGE.DECOMPRESS_FAIL);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    createLoadDataInfileQuery: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var fields = options.fields;
            var destination = options.destination;
            var fileName = options.fileName;
            var tempTable = options.tempTable;
            var type = options.type;
            var accountId = options.accountId;
            var userId = options.userId;
            var length = options.length;
            var isFirstPart = options.isFirstPart;
            var isMultipart = options.isMultipart;
            var columnNameIndicator = options.columnNameIndicator;
            var createdAt = DataUtils.getEpochMSTimestamp();
            var updatedAt = DataUtils.getEpochMSTimestamp();
            var values = [accountId, userId, createdAt, updatedAt, Constants.RECORD_TYPE.MANUAL];
            var queryString = '';
            var count = 1;
            try {
                queryString += 'LOAD DATA LOCAL INFILE \'' + destination + '/' + fileName + '\' INTO TABLE ' + tempTable + ' ';
                queryString += ' FIELDS TERMINATED BY \',\' ENCLOSED BY \'"\' LINES TERMINATED BY \'\n\' ';
                /*if (parseInt(isMultipart) !== 1 || (parseInt(isMultipart) === 1 && isFirstPart)) {
                    queryString += ' IGNORE 1 LINES ';
                }*/
                if (columnNameIndicator && ((isMultipart === 0) || (isMultipart === 1 && isFirstPart === 1))) {
                    debug('inside a column indicator');
                    queryString += ' IGNORE 1 LINES ';
                }
                queryString += '(';
                // ALL COLUMNS
                _.each(fields, function (value) {
                    if (count === parseInt(length + 1)) {
                        return;
                    }
                    queryString += '@c' + count++ + ',';
                });
                queryString = queryString.replace(/,\s*$/, ' ');
                queryString += ') ';
                queryString += ' SET ';
                queryString += Constants.TABLE_NAME[parseInt(type)].DEFAULT_COLUMN_QUERY;

                //ASSIGNMENT OF COLUMNS
                count = 1;
                _.each(fields, function (value) {
                    if (count === parseInt(length + 1)) {
                        return;
                    }
                    if (Constants.TABLE_NAME[parseInt(type)].SKIP_FIELDS.indexOf(count) !== -1) {
                        count++;
                        return;
                    }
                    queryString += '' + value.columnName + ' = @c' + count++ + ', ';
                });
                queryString = queryString.replace(/,\s*$/, ' ');
                queryString += ';';

                debug('15');
                return resolve({
                    queryString: queryString,
                    values: values
                });

            } catch (err) {
                debug('err', err);
                return reject(err);
            }

        });
    },

    loadFileIntoTempTable: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var err, query, values;

            try {
                debug('13');
                var queryResponse = await FileUpload.createLoadDataInfileQuery(options);
                debug('queryResponse', queryResponse);
                query = queryResponse.queryString;
                values = queryResponse.values;

                var conn = await connection.getConnection();
                // RUN LOAD DATA INFILE QUERY

                var loadResponse = await conn.query(query, values);
                debug('loadResponse', loadResponse);
                loadResponse = Utils.isAffectedPool(loadResponse);
                //debug('loadResponse', loadResponse);
                if (!loadResponse) {
                    err = new Error(ErrorConfig.MESSAGE.LOAD_DATA_INTO_TEMP_TABLE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    debug('err 123', err);
                    return reject(err);
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err 234', err);
                return reject(err);
            }
        });
    },

    getFileFormatAllFieldsMD: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var version = options.version;
            var type = options.type;
            var err;
            var fields = [];

            if (DataUtils.isUndefined(version)) {
                err = new Error(ErrorConfig.MESSAGE.VERSION_REQUIRED);
            } else if (DataUtils.isUndefined(type)) {
                err = new Error(ErrorConfig.MESSAGE.TYPE_REQUIRED);
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug('err', err);
                return reject(err);
            }

            try {
                var conn = await connection.getConnection();
                var columns = await conn.query('select columnName, columnNumber,dataType from Profile ' +
                  'where importType=? and version=? order by columnNumber ', [type, version]);
                if (!columns || columns.length <= 0) {
                    err = new Error(ErrorConfig.MESSAGE.FIELDS_NOT_FOUND_FOR_THIS_VERSION_TYPE);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    debug('err', err);
                    return reject(err);
                }

                return resolve({
                    columns: columns
                });
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    createTempTableMD: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var type = options.type;
            var tempTableName = Constants.TABLE_NAME[parseInt(type)].TEMP;
            var originalTableName = Constants.TABLE_NAME[parseInt(type)].ORIGINAL;
            var err;
            try {
                var conn = await connection.getConnection();
                var isCreated = await conn.query('create table IF NOT EXISTS ' + tempTableName + ' LIKE ' + originalTableName + '');

                return resolve({tempTable: tempTableName});
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.TEMP_TABLE_CREATION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    loadFileIntoTemp: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var fileName = options.fileName;
            var accountId = options.accountId;
            var bucket = Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET + '/' + accountId + '/' + Constants.S3_FOLDER.ARRIVAL_FILES;
            var type = options.type;
            var parts = options.parts;
            var userId = options.userId;
            var numberOfColumns = options.numberOfColumns;
            var isMultipart = options.isMultipart;
            var columnNameIndicator = options.columnNameIndicator;
            var version = options.version || 1;
            var destination = Constants.SCOPEHUB_EFS_PATH + path.sep + Constants.DESTINATION_FOLDER[type];
            destination = path.resolve(__dirname, destination);
            var loadOption, loadDataResponse, uploadLogOptions, updateResponse, err;
            var tempTable = Constants.TABLE_NAME[parseInt(type)].TEMP;

            try {
                // GET THE FILE FORMAT
                var formatOption = {
                    type: type,
                    version: version
                };
                debug('8');
                var formatResponse = await FileUpload.getFileFormatAllFieldsMD(formatOption);
                debug('9', formatResponse);

                // CREATE TEMP TABLE
                var tempTableOption = {
                    type: type
                };
                debug('10');
                //var tempTableResponse = await FileUpload.createTempTableMD(tempTableOption);
                debug('11');

                loadOption = {
                    tempTable: tempTable,
                    destination: destination,
                    fields: formatResponse.columns,
                    type: type,
                    accountId: accountId,
                    userId: userId,
                    isMultipart: isMultipart,
                    length: numberOfColumns,
                    columnNameIndicator: columnNameIndicator
                };
                debug('11.A', loadOption);
                if (parseInt(isMultipart) === 1) {
                    await PromiseBluebird.each(parts, async function (part) {
                        var partName = part.partName.replace('.gz.txt', '');
                        // CREATE QUERY AND LOAD DATA
                        loadOption.fileName = partName;
                        if (part.partNumber === 1) {
                            loadOption.isFirstPart = 1;
                        } else {
                            loadOption.isFirstPart = 0;
                        }
                        debug('12');
                        loadDataResponse = await FileUpload.loadFileIntoTempTable(loadOption);
                        debug('loadDataResponse ', loadDataResponse);
                        if (fs.existsSync(destination + '/' + partName) === true) {
                            fs.unlinkSync(destination + '/' + partName);
                        }
                    });
                    return resolve({fileName: fileName});
                }
                // CREATE QUERY AND LOAD DATA
                loadOption.fileName = fileName;
                debug('12');
                loadDataResponse = await FileUpload.loadFileIntoTempTable(loadOption);
                debug('loadDataResponse ', loadDataResponse);
                if (fs.existsSync(destination + '/' + fileName) === true) {
                    fs.unlinkSync(destination + '/' + fileName);
                }
                //throw err;

                return resolve({fileName: fileName});
            } catch (err) {
                debug('err 456', err);
                uploadLogOptions = {
                    userId: userId,
                    accountId: accountId,
                    fileName: fileName,
                    status: Constants.UPLOAD_STATUS.LOAD_TO_TEMP_FAIL
                };
                updateResponse = await FileUpload.updateUploadLogMD(uploadLogOptions);

                return reject(err);
            }
        });
    },

    validateAmountUOMMD: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var fields = Constants.AMOUNT_UOM;
            var type = options.type;
            var tempTable = Constants.TABLE_NAME[parseInt(type)].TEMP;
            var userId = options.userId;
            var accountId = options.accountId;
            var uploadLogId = options.uploadLogId;
            var errorData = {}, data = [], err;
            var resultedId = [];

            try {
                var conn = await connection.getConnection();
                await PromiseBluebird.each(fields, async function (field) {
                    var response = await conn.query('SELECT CAST(uuid_from_bin(id) as CHAR) as id,' + field.AMOUNT + ',' + field.AMOUNT_UOM + ' FROM ' + tempTable + ' ' +
                      ' where createdBy=uuid_to_bin(?) and ((' + field.AMOUNT + ' != "" AND ' + field.AMOUNT_UOM + ' = "" ) ' +
                      ' OR  (' + field.AMOUNT + ' = "" AND ' + field.AMOUNT_UOM + ' != "" ));', [userId]);
                    //response = Utils.filteredResponse(response);


                    if (response && response.length > 0) {
                        resultedId = resultedId.concat(_.map(response, 'id'));
                        //if (DataUtils.isArray(response)) {
                        errorData = {
                            uploadLogId: uploadLogId,
                            createdAt: DataUtils.getEpochMSTimestamp(),
                            columnName: field.AMOUNT,
                            failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.AMOUNT_OR_UNIT_OF_MEASURE_IS_MISSING.CODE,
                            errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.AMOUNT_OR_UNIT_OF_MEASURE_IS_MISSING.MESSAGE,
                            numberOfOccurence: response.length,
                            meta: _.map(response, function (value) {
                                return _.pick(value, field.AMOUNT, field.AMOUNT_UOM)
                            })
                        };
                        data.push(errorData);
                    }
                });

                if (resultedId.length > 0) {
                    var updateOptions = {
                        ids: _.uniq(resultedId),
                        type: type,
                        error: Constants.VALIDATION_FAIL_REASON_CODE.AMOUNT_OR_UNIT_OF_MEASURE_IS_MISSING.MESSAGE
                    };

                    var updated = await FileUpload.updateInvalidRecords(updateOptions);
                    debug('updated', updated);
                }
                if (data.length > 0) {
                    //var errorsWithMessage = data;
                    var errors = Utils.convertMutable(data);

                    var errorInserted = await FileUpload.insertErrorLogMD({
                        errors: errors,
                        flag: true
                    });

                    _.map(data, function (error) {
                        delete error.uploadLogId;
                        delete error.createdAt;
                    });

                    err = new Error(ErrorConfig.MESSAGE.INVALID_FILE);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    err.data = data;
                    err.uploadStatus = Constants.UPLOAD_STATUS.LOGICAL_VALIDATION_FAIL;
                    err.statusReasonCode = Constants.UPLOAD_STATUS_REASON_CODES.LOGICAL_VALIDATION_FAIL.CODE;
                    //err.meta = data;
                }
                return resolve(err);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }

        });
    },

    removeExtraFields: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var numberOfColumns = options.numberOfColumns;
            var fieldNumber = options.fieldNumber;
            // remove extra field which is not in file
            if (fieldNumber.length > 1) {
                var tempArray = [];
                _.map(fieldNumber, function (field) {
                    debug('field', field);
                    if (field <= parseInt(numberOfColumns)) {
                        tempArray.push(field);
                    }
                });
                fieldNumber = tempArray;
            }
            debug('fieldNumber after', fieldNumber);
            return resolve(fieldNumber);
        });
    },

    manipulateQuery: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var fields = options.fieldNumber;
            var type = options.type;
            var version = options.version;
            var string = '', values = [version, type];

            debug('fields', fields);
            _.map(fields, function (field) {
                string += '?,';
                values.push(field);
            });
            debug('string', string);
            debug('values', values);
            string = string.replace(/,\s*$/, ' ');
            return resolve({
                string: string,
                values: values
            });
        });
    },

    getFieldNamesMD: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var type = options.type;
            var version = options.version;
            var fieldNumber = options.fieldNumber;
            var fieldNames = [], err;
            try {
                debug('fieldNumber', fieldNumber);
                if (fieldNumber.length < 1) {
                    return resolve([]);
                }
                var conn = await connection.getConnection();
                var response = await FileUpload.manipulateQuery(options);
                debug('response', response);
                var fieldResponse = await conn.query('select columnName from Profile where version = ? and importType=? and columnNumber in (' + response.string + ')',
                  response.values);
                //fieldResponse = Utils.filteredResponse(fieldResponse);
                debug('fieldResponse', fieldResponse);
                if (!fieldResponse) {
                    err = new Error(ErrorConfig.MESSAGE.FIELDS_NOT_FOUND_FOR_THIS_VERSION_TYPE);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    throw err;
                }
                return resolve(fieldResponse);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }

        });
    },


    validateAmountFieldsMD: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var accountId = options.accountId;
                var type = options.type;
                var userId = options.userId;
                var fieldNumber = options.fieldNumber;
                var numberOfColumns = options.numberOfColumns;
                var uploadLogId = options.uploadLogId;
                var amountRegexp = Constants.AMOUNT_REGEXP;
                var tempTable = Constants.TABLE_NAME[parseInt(type)].TEMP;
                var errorMessage = Constants.TABLE_NAME[parseInt(type)].ERROR_MESSAGE;
                var err, query, values = [];
                var data = [], errorData;
                var resultedId = [];

                //remove extraa fields which is not in file
                var removeFieldOption = {
                    fieldNumber: fieldNumber,
                    numberOfColumns: numberOfColumns
                };
                options.fieldNumber = await FileUpload.removeExtraFields(removeFieldOption);

                // GET FIELD NAMES
                var fieldNames = await FileUpload.getFieldNamesMD(options);

                // VALIDATE EACH AMOUNT FIELDS
                var conn = await connection.getConnection();
                await PromiseBluebird.each(fieldNames, async function (field) {
                    field = field.columnName;
                    query = 'select ' + field + ',CAST(uuid_from_bin(id) as CHAR) as id from  ' + tempTable + ' where ' + field + ' ' +
                      ' not REGEXP ? and accountId=uuid_to_bin(?) and createdBy=uuid_to_bin(?) and errorFlag = 0 and ' + field + '!= ?';
                    values.push(amountRegexp, accountId, userId, Constants.TYPE_DEFAULT_VALUE.STRING);

                    debug('query========', query);
                    var response = await conn.query(query, values);
                    //response = Utils.filteredResponse(response);

                    resultedId = resultedId.concat(_.map(response, 'id'));
                    debug('response========', resultedId);
                    if (response && response.length > 0) {
                        errorData = {
                            uploadLogId: uploadLogId,
                            createdAt: DataUtils.getEpochMSTimestamp(),
                            numberOfOccurence: response.length,
                            columnName: field,
                            failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE[errorMessage].CODE,
                            errorMessage: errorMessage,
                            meta: _.map(response, function (value) {
                                return _.pick(value, field)
                            })
                            /*meta: _.map(response, function (value) {
                              return value[field];
                          })*/
                        };
                        data.push(errorData);
                    }
                    values = [];
                });
                debug('data', data);
                debug('result==============================', _.uniq(resultedId));

                if (resultedId.length > 0) {
                    var updateOptions = {
                        ids: _.uniq(resultedId),
                        type: type,
                        error: errorMessage

                    };
                    var updated = await FileUpload.updateInvalidRecords(updateOptions);
                    debug('updated', updated);
                }
                if (data.length > 0) {
                    //var errorsWithMessage = data;
                    var errors = Utils.convertMutable(data);

                    /*_.map(errors, function (error) {
                      delete error.message;
                  });*/

                    var errorInserted = await FileUpload.insertErrorLogMD({
                        errors: errors,
                        flag: true
                    });

                    _.map(data, function (error) {
                        delete error.uploadLogId;
                        delete error.createdAt;
                    });
                    err = new Error(ErrorConfig.MESSAGE.INVALID_FILE);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    err.data = data;
                    err.uploadStatus = Constants.UPLOAD_STATUS.LOGICAL_VALIDATION_FAIL;
                    err.statusReasonCode = Constants.UPLOAD_STATUS_REASON_CODES.LOGICAL_VALIDATION_FAIL.CODE;
                }
                return resolve(err);
                // return resolve(data);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    getQueryForValidateUoM: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var fieldName = options.fieldName;
            var tempTable = options.tempTable;
            var defaultQuery = 'select distinct TPR.' + fieldName + ' from ' + tempTable + ' TPR where ' +
              ' TPR.createdBy = uuid_to_bin(?) and TPR.' + fieldName + ' != "0" and TPR.' + fieldName + ' != "" and ' +
              ' not exists (select 1 from uomNames UN,uomScaling US, uomCategory UC where ' +
              ' TPR.' + fieldName + ' = UN.symbol and UN.languageCultureCode = ? and ' +
              ' UN.uomScalingId = US.id and US.categoryId = UC.categoryId and UC.languageCultureCode = ? and ' +
              ' (UC.accountId = TPR.accountId OR UC.accountId=uuid_to_bin(?)))';
            return resolve(defaultQuery);
        });
    },

    validateUoMFields: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var type = options.type;
            var uploadLogId = options.uploadLogId;
            var fieldNumber = Constants.TABLE_NAME[parseInt(type)].UOM_FIELDS;
            var tempTable = Constants.TABLE_NAME[parseInt(type)].TEMP;
            var version = options.version;
            var numberOfColumns = options.numberOfColumns;
            var userId = options.userId;
            var accountId = options.accountId;
            var languageCultureCode = options.languageCultureCode;
            var defaultAccountId = Constants.DEFAULT_REFERE_ID;
            var query, values = [userId, languageCultureCode, languageCultureCode, defaultAccountId];
            var errorData, data = [], err;

            try {
                if (fieldNumber.length < 1) {
                    return resolve(err);
                }

                // remove extra field which is not in file
                var removeFieldOption = {
                    fieldNumber: fieldNumber,
                    numberOfColumns: numberOfColumns
                };
                options.fieldNumber = await FileUpload.removeExtraFields(removeFieldOption);

                var fieldNames = await FileUpload.getFieldNamesMD(options);
                debug('fieldNames', fieldNames);

                if (fieldNames.length < 1) {
                    return resolve(err);
                }

                var conn = await connection.getConnection();
                await PromiseBluebird.each(fieldNames, async function (field) {
                    var queryOption = {
                        fieldName: field.columnName,
                        tempTable: tempTable
                    };
                    query = await FileUpload.getQueryForValidateUoM(queryOption);

                    debug('query', query);

                    var response = await conn.query(query, values);
                    //response = Utils.filteredResponse(response);
                    if (response && response.length > 0) {
                        errorData = {
                            uploadLogId: uploadLogId,
                            createdAt: DataUtils.getEpochMSTimestamp(),
                            columnName: field.columnName,
                            failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_NOT_FOUND.CODE,
                            errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_NOT_FOUND.MESSAGE,
                            numberOfOccurence: response.length,
                            meta: _.map(response, function (value) {
                                return value[field.columnName];
                            })
                        };
                        data.push(errorData);
                    }
                });
                if (data.length > 0) {
                    var errors = Utils.convertMutable(data);

                    /*_.map(errors, function (error) {
                      delete error.message;
                  });*/

                    var errorInserted = await FileUpload.insertErrorLogMD({
                        errors: errors,
                        flag: true
                    });

                    _.map(data, function (error) {
                        delete error.uploadLogId;
                        delete error.createdAt;
                    });

                    err = new Error(ErrorConfig.MESSAGE.INVALID_FILE);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    err.data = data;
                    err.uploadStatus = Constants.UPLOAD_STATUS.LOGICAL_VALIDATION_FAIL;
                    err.statusReasonCode = Constants.UPLOAD_STATUS_REASON_CODES.LOGICAL_VALIDATION_FAIL.CODE;
                }
                return resolve(err);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    executeValidationMD: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            debug('options', options);
            var type = options.type;
            var userId = options.userId;
            var accountId = options.accountId;
            var uploadLogId = options.uploadLogId;
            var logicalValidationQueries = Constants.TABLE_NAME[parseInt(type)].LOGICAL_VALIDATION;
            var values = [userId], err;
            var allErrors = [], data = [];

            try {
                var conn = await connection.getConnection();
                debug('111');
                var cnt = 0;
                await PromiseBluebird.each(logicalValidationQueries, async function (validation) {
                    debug('cnt++', cnt++);
                    try {
                        var errorData = {};
                        var columnName = validation.COLUMN_NAME;
                        var response = await conn.query(validation.QUERY, values);

                        if (response && response.length > 0) {
                            errorData = {
                                uploadLogId: uploadLogId,
                                createdAt: DataUtils.getEpochMSTimestamp(),
                                columnName: columnName,
                                failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE[validation.ERROR].CODE,
                                errorMessage: Constants.VALIDATION_FAIL_REASON_CODE[validation.ERROR].MESSAGE,
                                numberOfOccurence: response.length,
                                meta: response
                            };
                            data.push(errorData);
                        }
                    } catch (err) {
                        debug('err 123', err);
                        //return reject(err);
                    }
                });
                if (data.length > 0) {
                    var errors = Utils.convertMutable(data);

                    var errorInserted = await FileUpload.insertErrorLogMD({
                        errors: errors,
                        flag: true
                    });

                    _.map(data, function (error) {
                        delete error.uploadLogId;
                        delete error.createdAt;
                    });

                    err = new Error(ErrorConfig.MESSAGE.LOGICAL_VALIDATION_FAIL);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    err.data = data;
                    err.uploadStatus = Constants.UPLOAD_STATUS.LOGICAL_VALIDATION_FAIL;
                    err.statusReasonCode = Constants.UPLOAD_STATUS_REASON_CODES.LOGICAL_VALIDATION_FAIL.CODE;
                }
                return resolve(err);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    updateTempTableMD: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var type = options.type;
            var userId = options.userId;
            var values = [userId], err;
            var queries = Constants.TABLE_NAME[parseInt(type)].UPDATE_QUERY;

            try {
                var conn = await connection.getConnection();
                if (parseInt(type) === Constants.UPLOAD_FILE_TYPE.ORI) {
                    values = values.concat(Constants.TYPE_DEFAULT_VALUE.STRING);
                }
                await PromiseBluebird.each(queries, async function (query) {
                    var isUpdated = await conn.query(query, values);
                    isUpdated = Utils.isAffectedPool(isUpdated);
                    if (!isUpdated) {
                        err = new Error(ErrorConfig.MESSAGE.TEMP_TABLE_UPDATE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        err.uploadStatus = Constants.UPLOAD_STATUS.LOGICAL_VALIDATION_FAIL;
                        err.statusReasonCode = Constants.UPLOAD_STATUS_REASON_CODES.LOGICAL_VALIDATION_FAIL.CODE;
                        throw err;
                    }
                });
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    generateUpdateAmountQueryMD: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var type = options.type;
            var accountId = options.accountId;
            var userId = options.userId;
            var tableName = Constants.TABLE_NAME[parseInt(type)].TEMP;
            var fieldNames = options.fieldNames;
            var precision = Constants.TABLE_NAME[parseInt(type)].PRECISION;
            var query = ' update ' + tableName + ' set ';
            var where = ' where createdBy = uuid_to_bin(?) and accountId=uuid_to_bin(?) and errorFlag = 0  ;';
            var values = [];
            try {
                _.map(fieldNames, function (field) {
                    var columnName = field.columnName;
                    query += columnName + ' = ' + columnName + ' * ? , ';
                    values.push(precision);
                });
                query = query.replace(/,\s*$/, ' ');
                query += where;
                values.push(userId, accountId);
                return resolve({
                    query: query,
                    values: values
                });
            } catch (err) {
                debug('err', err);
                return reject(err);
            }

        });
    },

    updateAmountFields: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var type = options.type;
                var fieldNumber = options.fieldNumber;
                var numberOfColumns = options.numberOfColumns;
                var flag = Constants.TABLE_NAME[parseInt(type)].AMOUNT_MANIPULATION;
                if (!flag) {
                    return resolve(Constants.OK_MESSAGE);
                }

                var err;
                var query, values;

                // remove extra field which is not in file
                var removeFieldOption = {
                    fieldNumber: fieldNumber,
                    numberOfColumns: numberOfColumns
                };
                options.fieldNumber = await FileUpload.removeExtraFields(removeFieldOption);

                // GET FIELD NAMES
                var fieldNames = await FileUpload.getFieldNamesMD(options);
                if (fieldNames.length < 1) {
                    return resolve(Constants.OK_MESSAGE);
                }
                // UPDATE ALL FIELDS BY CHANGING VALUE FOR REMOVE DECIMAL POINT BY TAKING PRECISION 8
                var queryOption = {
                    type: type,
                    accountId: options.accountId,
                    userId: options.userId,
                    fieldNames: fieldNames
                };
                var queryResponse = await FileUpload.generateUpdateAmountQueryMD(queryOption);
                query = queryResponse.query;
                values = queryResponse.values;
                var conn = await connection.getConnection();
                var updateAmountResponse = await conn.query(query, values);
                updateAmountResponse = Utils.isAffectedPool(updateAmountResponse);
                if (!updateAmountResponse) {
                    err = new Error(ErrorConfig.MESSAGE.TEMP_TABLE_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    err.uploadStatus = Constants.UPLOAD_STATUS.LOGICAL_VALIDATION_FAIL;
                    err.statusReasonCode = Constants.UPLOAD_STATUS_REASON_CODES.LOGICAL_VALIDATION_FAIL.CODE;
                    throw err;
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    getQueryForUpdateUoM: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var fieldName = options.fieldName;
            var tempTable = options.tempTable;
            var defaultQuery = 'UPDATE ' + tempTable + ' TPR ,uomNames UN,uomScaling US, uomCategory UC ' +
              ' SET TPR.' + fieldName + ' = US.id where TPR.createdBy = uuid_to_bin(?) and TPR.' + fieldName + ' != "0"  and TPR.' + fieldName + ' != "" ' +
              ' and TPR.' + fieldName + ' = UN.symbol and UN.languageCultureCode = ? and ' +
              ' UN.uomScalingId = US.id and US.categoryId = UC.categoryId and UC.languageCultureCode = ? and ' +
              ' (UC.accountId = TPR.accountId OR UC.accountId=uuid_to_bin(?)) and TPR.errorFlag = 0 ' +
              ' ';
            return resolve(defaultQuery);
        });
    },

    updateUoMFields: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var type = options.type;
            var fieldNumber = Constants.TABLE_NAME[parseInt(type)].UOM_FIELDS;
            var tempTable = Constants.TABLE_NAME[parseInt(type)].TEMP;
            var version = options.version;
            var numberOfColumns = options.numberOfColumns;
            var userId = options.userId;
            var accountId = options.accountId;
            var languageCultureCode = options.languageCultureCode;
            var defaultAccountId = Constants.DEFAULT_REFERE_ID;
            var query, values = [userId, languageCultureCode, languageCultureCode, defaultAccountId];
            var err;

            try {
                if (fieldNumber.length < 1) {
                    return resolve(Constants.OK_MESSAGE);
                }
                // remove extra field which is not in file
                var removeFieldOption = {
                    fieldNumber: fieldNumber,
                    numberOfColumns: numberOfColumns
                };
                options.fieldNumber = await FileUpload.removeExtraFields(removeFieldOption);

                var fieldNames = await FileUpload.getFieldNamesMD(options);
                debug('fieldNames', fieldNames);

                if (fieldNames.length < 1) {
                    return resolve(Constants.OK_MESSAGE);
                }

                var conn = await connection.getConnection();
                var c = 0;
                await PromiseBluebird.each(fieldNames, async function (field) {
                    debug('count', c++);
                    var updateOption = {
                        fieldName: field.columnName,
                        tempTable: tempTable
                    };
                    query = await FileUpload.getQueryForUpdateUoM(updateOption);
                    debug('query', query);
                    debug('values', values);
                    var response = await conn.query(query, values);
                    response = Utils.isAffectedPool(response);
                    debug('response', response);
                });
                debug('At the end');
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    getQueryForUpdateQty: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var fieldName = options.fieldName;
            var uomField = options.uomField;
            var tempTable = options.tempTable;

            var defaultQuery = 'UPDATE ' + tempTable + ' TPR , uomScaling US ' +
              ' SET TPR.' + fieldName + ' = (TPR.' + fieldName + ' * POWER(10,US.scalingPrecision)) ' +
              ' where TPR.createdBy = uuid_to_bin(?) and TPR.' + fieldName + ' != "0" and TPR.' + uomField + ' != "" ' +
              ' and TPR.' + uomField + ' = US.id and TPR.errorFlag = 0 ';
            return resolve(defaultQuery);
        });
    },

    updateQuantityFields: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var type = options.type;
            var fieldNumber = options.fieldNumber;
            var numberOfColumns = options.numberOfColumns;
            var tempTable = Constants.TABLE_NAME[parseInt(type)].TEMP;
            var QuantityFields = Constants.TABLE_NAME[parseInt(type)].QUANTITY_UOM;
            var flag = Constants.TABLE_NAME[parseInt(type)].QUANTITY_MANIPULATION;
            var userId = options.userId;
            var query, values = [userId];
            var err;

            try {
                if (fieldNumber.length < 1 || !flag) {
                    return resolve(Constants.OK_MESSAGE);
                }

                // remove extra field which is not in file
                var removeFieldOption = {
                    fieldNumber: fieldNumber,
                    numberOfColumns: numberOfColumns
                };
                options.fieldNumber = await FileUpload.removeExtraFields(removeFieldOption);

                var fieldNames = await FileUpload.getFieldNamesMD(options);

                if (fieldNames.length < 1) {
                    return resolve(Constants.OK_MESSAGE);
                }
                var conn = await connection.getConnection();
                var count = 0;
                await PromiseBluebird.each(fieldNames, async function (field) {
                    debug('count', count++);
                    var uomField;
                    _.map(QuantityFields, function (quantityField) {
                        if (quantityField.QTY === field.columnName) {
                            uomField = quantityField.QTY_UOM;
                        }
                    });
                    var updateOption = {
                        fieldName: field.columnName,
                        uomField: uomField,
                        tempTable: tempTable
                    };
                    query = await FileUpload.getQueryForUpdateQty(updateOption);
                    debug('query', query);
                    debug('values', values);
                    var response = await conn.query(query, values);
                    // response = Utils.isAffectedPool(response);
                    debug('response', response)
                });
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err4567', err);
                return reject(err);
            }
        });
    },

    manipulateQueryForUpdate: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var string = '', values = [];

            _.map(options.ids, function (id) {
                string += 'uuid_to_bin(?),';
                values.push(id);
            });
            debug('string', string);
            string = string.replace(/,\s*$/, ' ');
            return resolve({
                string: string,
                values: values
            });
        });
    },

    /*
     * Update records
     * */
    updateInvalidRecords: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var ids = options.ids;
                var type = options.type;
                var tableName = Constants.TABLE_NAME[parseInt(type)].TEMP;
                var errorDescription = options.error;
                var updatedAt = DataUtils.getEpochMSTimestamp();
                var conn = await connection.getConnection();
                debug('options', options);
                var response = await FileUpload.manipulateQueryForUpdate({ids: ids});

                var recordsById = await conn.query('UPDATE ' + tableName + ' SET errorFlag = 1, errorDescription = ?, updatedAt = ? ' +
                  ' where id IN (' + response.string + ')',
                  [errorDescription, updatedAt].concat(response.values));
                // debug('recordsById', recordsById);
                return resolve(recordsById);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
     * make a array for all invalid records to create an error
     * */
    getInvalidRecordsArray: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var uploadLogId = options.uploadLogId;
                var productReferenceNotFoundArray = options.productReferenceNotFoundArray;
                var qtyOnHandUOMArray = options.qtyOnHandUOMArray;
                var qtyOnOrderUOMArray = options.qtyOnOrderUOMArray;
                var qtyAvailableUOMArray = options.qtyAvailableUOMArray;
                var qtyInTransitUOMArray = options.qtyInTransitUOMArray;
                var duplicateProductInventoryArray = options.duplicateProductInventoryArray;
                var existProductInventoryArray = options.existProductInventoryArray;
                var differentCategoryUOMArray = options.differentCategoryUOMArray;
                var duplicateProductArray = options.duplicateProductArray;
                var existProductArray = options.existProductArray;
                var weightUoMScalArray = options.weightUoMScalArray;
                var heightUoMScalArray = options.heightUoMScalArray;
                var lengthUoMScalArray = options.lengthUoMScalArray;
                var depthUoMScalArray = options.depthUoMScalArray;
                var diameterUoMScalArray = options.diameterUoMScalArray;
                var volumeUoMScalArray = options.volumeUoMScalArray;
                var qtyUoMIdArray = options.qtyUoMIdArray;
                var duplicateSupplyItemsArray = options.duplicateSupplyItemsArray;
                var existSupplyItemsArray = options.existSupplyItemsArray;
                var duplicateSupplyInventoryArray = options.duplicateSupplyInventoryArray;
                var existSupplyInventoryArray = options.existSupplyInventoryArray;
                var duplicateOrderArray = options.duplicateOrderArray;
                var marketPlaceNotFoundArray = options.marketPlaceNotFoundArray;
                var duplicateLocationIdArray = options.duplicateLocationIdArray;
                var existLocationIdArray = options.existLocationIdArray;
                var existLocationNameArray = options.existLocationNameArray;
                var invalidLatitudeArray = options.invalidLatitudeArray;
                var invalidLongitudeArray = options.invalidLongitudeArray;
                var duplicateLocationNameArray = options.duplicateLocationNameArray;
                var existUOMNameArray = options.existUOMNameArray;
                var existUOMSymbolArray = options.existUOMSymbolArray;
                var existScalingValueArray = options.existScalingValueArray;
                var existScalingFactorArray = options.existScalingFactorArray;
                var missingScalingFactorArray = options.missingScalingFactorArray;
                var duplicateUOMNameArray = options.duplicateUOMNameArray;
                var duplicateUOMSymbolArray = options.duplicateUOMSymbolArray;
                var duplicateScalingValueArray = options.duplicateScalingValueArray;
                var invalidScalingPrecisionArray = options.invalidScalingPrecisionArray;
                var invalidEmailArray = options.invalidEmailArray;
                var duplicateSupplierEmailArray = options.duplicateSupplierEmailArray;
                var duplicateSupplierCodeArray = options.duplicateSupplierCodeArray;
                var existSupplierEmailArray = options.existSupplierEmailArray;
                var existSupplierCodeArray = options.existSupplierCodeArray;
                var locationNotFoundArray = options.locationNotFoundArray;
                var duplicateCustomerEmailArray = options.duplicateCustomerEmailArray;
                var duplicateCustomerCodeArray = options.duplicateCustomerCodeArray;
                var existCustomerEmailArray = options.existCustomerEmailArray;
                var existCustomerCodeArray = options.existCustomerCodeArray;
                var productReferenceNotFoundForOLIArray = options.productReferenceNotFoundForOLIArray;
                var data = [];
                var err;

                if (productReferenceNotFoundArray.length > 0) {
                    var errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'sku',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.PRODUCT_REFERENCE_NOT_FOUND.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.PRODUCT_REFERENCE_NOT_FOUND.MESSAGE,
                        numberOfOccurence: productReferenceNotFoundArray.length,
                        meta: _.map(productReferenceNotFoundArray, function (productReference) {
                            return _.pick(productReference, ['sku']);
                        })
                    };
                    data.push(errorData);
                }
                if (qtyOnHandUOMArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'qtyOnHandUOM',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_NOT_FOUND.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_NOT_FOUND.MESSAGE,
                        numberOfOccurence: qtyOnHandUOMArray.length,
                        meta: _.map(qtyOnHandUOMArray, function (qtyOnHandUOM) {
                            return _.pick(qtyOnHandUOM, ['qtyOnHandUOM']);
                        })
                    };
                    data.push(errorData);
                }
                if (qtyOnOrderUOMArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'qtyOnOrderUOM',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_NOT_FOUND.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_NOT_FOUND.MESSAGE,
                        numberOfOccurence: qtyOnOrderUOMArray.length,
                        meta: _.map(qtyOnOrderUOMArray, function (qtyOnOrderUOM) {
                            return _.pick(qtyOnOrderUOM, ['qtyOnOrderUOM']);
                        })
                    };
                    data.push(errorData);
                }
                if (qtyAvailableUOMArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'qtyAvailableUOM',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_NOT_FOUND.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_NOT_FOUND.MESSAGE,
                        numberOfOccurence: qtyAvailableUOMArray.length,
                        meta: _.map(qtyAvailableUOMArray, function (qtyAvailableUOM) {
                            return _.pick(qtyAvailableUOM, ['qtyAvailableUOM']);
                        })
                    };
                    data.push(errorData);
                }
                if (qtyInTransitUOMArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'qtyInTransitUOM',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_NOT_FOUND.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_NOT_FOUND.MESSAGE,
                        numberOfOccurence: qtyInTransitUOMArray.length,
                        meta: _.map(qtyInTransitUOMArray, function (qtyInTransitUOM) {
                            return _.pick(qtyInTransitUOM, ['qtyInTransitUOM']);
                        })
                    };
                    data.push(errorData);
                }
                if (duplicateProductInventoryArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'locationId',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_PRODUCT_INVENTORY_IN_THE_FILE.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_PRODUCT_INVENTORY_IN_THE_FILE.MESSAGE,
                        numberOfOccurence: duplicateProductInventoryArray.length,
                        meta: _.map(duplicateProductInventoryArray, function (duplicateProductInventory) {
                            return _.pick(duplicateProductInventory, ['sku', 'locationId', 'count']);
                        })
                    };
                    data.push(errorData);
                }
                if (existProductInventoryArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'locationId',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.PRODUCT_INVENTORY_ALREADY_EXIST.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.PRODUCT_INVENTORY_ALREADY_EXIST.MESSAGE,
                        numberOfOccurence: existProductInventoryArray.length,
                        meta: _.map(existProductInventoryArray, function (existProductInventory) {
                            return _.pick(existProductInventory, ['sku', 'locationId']);
                        })
                    };
                    data.push(errorData);
                }
                if (differentCategoryUOMArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'sku',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.UOM_IS_FROM_DIFFERENT_CATEGORY.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.UOM_IS_FROM_DIFFERENT_CATEGORY.MESSAGE,
                        numberOfOccurence: differentCategoryUOMArray.length,
                        meta: _.map(differentCategoryUOMArray, function (differentCategoryUOM) {
                            return _.pick(differentCategoryUOM, ['sku']);
                        })
                    };
                    data.push(errorData);
                }
                if (duplicateProductArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'sku',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_PRODUCT_IN_THE_FILE.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_PRODUCT_IN_THE_FILE.MESSAGE,
                        numberOfOccurence: duplicateProductArray.length,
                        meta: _.map(duplicateProductArray, function (duplicateProduct) {
                            return _.pick(duplicateProduct, ['sku', 'count']);
                        })
                    };
                    data.push(errorData);
                }
                if (existProductArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'sku',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.PRODUCT_ALREADY_EXIST.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.PRODUCT_ALREADY_EXIST.MESSAGE,
                        numberOfOccurence: existProductArray.length,
                        meta: _.map(existProductArray, function (existProduct) {
                            return _.pick(existProduct, ['sku']);
                        })
                    };
                    data.push(errorData);
                }
                if (weightUoMScalArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'weightUoMScal',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_NOT_FOUND.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_NOT_FOUND.MESSAGE,
                        numberOfOccurence: weightUoMScalArray.length,
                        meta: _.map(weightUoMScalArray, function (weightUoMScal) {
                            return _.pick(weightUoMScal, ['weightUoMScal']);
                        })
                    };
                    data.push(errorData);
                }
                if (heightUoMScalArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'heightUoMScal',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_NOT_FOUND.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_NOT_FOUND.MESSAGE,
                        numberOfOccurence: heightUoMScalArray.length,
                        meta: _.map(heightUoMScalArray, function (heightUoMScal) {
                            return _.pick(heightUoMScal, ['heightUoMScal']);
                        })
                    };
                    data.push(errorData);
                }
                if (lengthUoMScalArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'lengthUoMScal',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_NOT_FOUND.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_NOT_FOUND.MESSAGE,
                        numberOfOccurence: lengthUoMScalArray.length,
                        meta: _.map(lengthUoMScalArray, function (lengthUoMScal) {
                            return _.pick(lengthUoMScal, ['lengthUoMScal']);
                        })
                    };
                    data.push(errorData);
                }
                if (depthUoMScalArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'depthUoMScal',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_NOT_FOUND.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_NOT_FOUND.MESSAGE,
                        numberOfOccurence: depthUoMScalArray.length,
                        meta: _.map(depthUoMScalArray, function (depthUoMScal) {
                            return _.pick(depthUoMScal, ['depthUoMScal']);
                        })
                    };
                    data.push(errorData);
                }
                if (diameterUoMScalArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'diameterUoMScal',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_NOT_FOUND.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_NOT_FOUND.MESSAGE,
                        numberOfOccurence: diameterUoMScalArray.length,
                        meta: _.map(diameterUoMScalArray, function (diameterUoMScal) {
                            return _.pick(diameterUoMScal, ['diameterUoMScal']);
                        })
                    };
                    data.push(errorData);
                }
                if (volumeUoMScalArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'volumeUoMScal',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_NOT_FOUND.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_NOT_FOUND.MESSAGE,
                        numberOfOccurence: volumeUoMScalArray.length,
                        meta: _.map(volumeUoMScalArray, function (volumeUoMScal) {
                            return _.pick(volumeUoMScal, ['volumeUoMScal']);
                        })
                    };
                    data.push(errorData);
                }
                if (qtyUoMIdArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'qtyUoMId',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_NOT_FOUND.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_NOT_FOUND.MESSAGE,
                        numberOfOccurence: qtyUoMIdArray.length,
                        meta: _.map(qtyUoMIdArray, function (qtyUoMId) {
                            return _.pick(qtyUoMId, ['qtyUoMId']);
                        })
                    };
                    data.push(errorData);
                }
                if (duplicateSupplyItemsArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'sku',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_SUPPLY_ITEM_IN_THE_FILE.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_SUPPLY_ITEM_IN_THE_FILE.MESSAGE,
                        numberOfOccurence: duplicateSupplyItemsArray.length,
                        meta: _.map(duplicateSupplyItemsArray, function (duplicateSupplyItems) {
                            return _.pick(duplicateSupplyItems, ['sku', 'count']);
                        })
                    };
                    data.push(errorData);
                }
                if (existSupplyItemsArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'sku',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.SUPPLY_ITEMS_ALREADY_EXIST.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.SUPPLY_ITEMS_ALREADY_EXIST.MESSAGE,
                        numberOfOccurence: existSupplyItemsArray.length,
                        meta: _.map(existSupplyItemsArray, function (existSupplyItems) {
                            return _.pick(existSupplyItems, ['sku']);
                        })
                    };
                    data.push(errorData);
                }
                if (duplicateSupplyInventoryArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'locationId',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_SUPPLY_ITEM_INVENTORY_IN_THE_FILE.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_SUPPLY_ITEM_INVENTORY_IN_THE_FILE.MESSAGE,
                        numberOfOccurence: duplicateSupplyInventoryArray.length,
                        meta: _.map(duplicateSupplyInventoryArray, function (duplicateSupplyInventory) {
                            return _.pick(duplicateSupplyInventory, ['sku', 'locationId', 'count']);
                        })
                    };
                    data.push(errorData);
                }
                if (existSupplyInventoryArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'locationId',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.SUPPLY_ITEM_INVENTORY_ALREADY_EXIST.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.SUPPLY_ITEM_INVENTORY_ALREADY_EXIST.MESSAGE,
                        numberOfOccurence: existSupplyInventoryArray.length,
                        meta: _.map(existSupplyInventoryArray, function (existSupplyInventory) {
                            return _.pick(existSupplyInventory, ['sku', 'locationId']);
                        })
                    };
                    data.push(errorData);
                }
                if (duplicateOrderArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'amazonOrderId',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_ORDER_IN_THE_FILE.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_ORDER_IN_THE_FILE.MESSAGE,
                        numberOfOccurence: duplicateOrderArray.length,
                        meta: _.map(duplicateOrderArray, function (duplicateOrder) {
                            return _.pick(duplicateOrder, ['amazonOrderId']);
                        })
                    };
                    data.push(errorData);
                }
                if (marketPlaceNotFoundArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'mpId',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.MARKET_PLACE_NOT_FOUND.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.MARKET_PLACE_NOT_FOUND.MESSAGE,
                        numberOfOccurence: marketPlaceNotFoundArray.length,
                        meta: _.map(marketPlaceNotFoundArray, function (marketPlaceNotFound) {
                            return _.pick(marketPlaceNotFound, ['mpId']);
                        })
                    };
                    data.push(errorData);
                }
                if (duplicateLocationIdArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'locationId',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_LOCATION_REFERENCE_IN_THE_FILE.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_LOCATION_REFERENCE_IN_THE_FILE.MESSAGE,
                        numberOfOccurence: duplicateLocationIdArray.length,
                        meta: _.map(duplicateLocationIdArray, function (duplicateLocation) {
                            return _.pick(duplicateLocation, ['locationId', 'count']);
                        })
                    };
                    data.push(errorData);
                }
                if (duplicateLocationNameArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'locationName',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_LOCATION_REFERENCE_IN_THE_FILE.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_LOCATION_REFERENCE_IN_THE_FILE.MESSAGE,
                        numberOfOccurence: duplicateLocationNameArray.length,
                        meta: _.map(duplicateLocationNameArray, function (duplicateLocationName) {
                            return _.pick(duplicateLocationName, ['locationName', 'count']);
                        })
                    };
                    data.push(errorData);
                }
                if (existLocationIdArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'locationId',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.LOCATION_REFERENCE_ALREADY_EXIST.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.LOCATION_REFERENCE_ALREADY_EXIST.MESSAGE,
                        numberOfOccurence: existLocationIdArray.length,
                        meta: _.map(existLocationIdArray, function (existLocationId) {
                            return _.pick(existLocationId, ['locationId']);
                        })
                    };
                    data.push(errorData);
                }
                if (existLocationNameArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'locationName',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.LOCATION_REFERENCE_ALREADY_EXIST.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.LOCATION_REFERENCE_ALREADY_EXIST.MESSAGE,
                        numberOfOccurence: existLocationNameArray.length,
                        meta: _.map(existLocationNameArray, function (existLocationName) {
                            return _.pick(existLocationName, ['locationName']);
                        })
                    };
                    data.push(errorData);
                }
                if (invalidLatitudeArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'latitude',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.LOCATION_REFERENCE_ALREADY_EXIST.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.LOCATION_REFERENCE_ALREADY_EXIST.MESSAGE,
                        numberOfOccurence: invalidLatitudeArray.length,
                        meta: _.map(invalidLatitudeArray, function (invalidLatitude) {
                            return _.pick(invalidLatitude, ['locationId, latitude']);
                        })
                    };
                    data.push(errorData);
                }
                if (invalidLongitudeArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'longitude',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.LOCATION_REFERENCE_ALREADY_EXIST.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.LOCATION_REFERENCE_ALREADY_EXIST.MESSAGE,
                        numberOfOccurence: invalidLongitudeArray.length,
                        meta: _.map(invalidLongitudeArray, function (invalidLongitude) {
                            return _.pick(invalidLongitude, ['locationId, longitude']);
                        })
                    };
                    data.push(errorData);
                }
                if (existUOMNameArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'uomName',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_EXIST_WITH_SAME_NAME.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_EXIST_WITH_SAME_NAME.MESSAGE,
                        numberOfOccurence: existUOMNameArray.length,
                        meta: _.map(existUOMNameArray, function (existUOMName) {
                            return _.pick(existUOMName, ['categoryName', 'uomName']);
                        })
                    };
                    data.push(errorData);
                }
                if (existUOMSymbolArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'symbol',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_EXIST_WITH_SAME_SYMBOL.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_EXIST_WITH_SAME_SYMBOL.MESSAGE,
                        numberOfOccurence: existUOMSymbolArray.length,
                        meta: _.map(existUOMSymbolArray, function (existUOMSymbol) {
                            return _.pick(existUOMSymbol, ['categoryName', 'symbol']);
                        })
                    };
                    data.push(errorData);
                }
                if (existScalingValueArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'longitude',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_EXIST_WITH_SAME_SCALING_FACTOR_AND_PRECISION.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_EXIST_WITH_SAME_SCALING_FACTOR_AND_PRECISION.MESSAGE,
                        numberOfOccurence: existScalingValueArray.length,
                        meta: _.map(existScalingValueArray, function (existScalingValue) {
                            return _.pick(existScalingValue, ['categoryName']);
                        })
                    };
                    data.push(errorData);
                }
                if (existScalingFactorArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'categoryName',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_SCALING_FACTOR_ONE_ALREADY_EXIST_FOR_THIS_CATEGORY.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_SCALING_FACTOR_ONE_ALREADY_EXIST_FOR_THIS_CATEGORY.MESSAGE,
                        numberOfOccurence: existScalingFactorArray.length,
                        meta: _.map(existScalingFactorArray, function (existScalingFactor) {
                            return _.pick(existScalingFactor, ['categoryName']);
                        })
                    };
                    data.push(errorData);
                }
                if (missingScalingFactorArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'categoryName',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_SCALAR_FACTOR_SHOULD_BE_1.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_SCALAR_FACTOR_SHOULD_BE_1.MESSAGE,
                        numberOfOccurence: missingScalingFactorArray.length,
                        meta: _.map(missingScalingFactorArray, function (missingScalingFactor) {
                            return _.pick(missingScalingFactor, ['categoryName']);
                        })
                    };
                    data.push(errorData);
                }
                if (duplicateUOMNameArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'uomName',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_UNIT_OF_MEASURE_NAME_IN_THE_FILE.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_UNIT_OF_MEASURE_NAME_IN_THE_FILE.MESSAGE,
                        numberOfOccurence: duplicateUOMNameArray.length,
                        meta: _.map(duplicateUOMNameArray, function (duplicateUOMName) {
                            return _.pick(duplicateUOMName, ['categoryName', 'uomName', 'count']);
                        })
                    };
                    data.push(errorData);
                }
                if (duplicateUOMSymbolArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'symbol',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_UNIT_OF_MEASURE_SYMBOL_IN_THE_FILE.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_UNIT_OF_MEASURE_SYMBOL_IN_THE_FILE.MESSAGE,
                        numberOfOccurence: duplicateUOMSymbolArray.length,
                        meta: _.map(duplicateUOMSymbolArray, function (duplicateUOMSymbol) {
                            return _.pick(duplicateUOMSymbol, ['categoryName', 'symbol', 'count']);
                        })
                    };
                    data.push(errorData);
                }
                if (duplicateScalingValueArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'categoryName',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_SCALING_VALUE_IN_THE_FILE.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_SCALING_VALUE_IN_THE_FILE.MESSAGE,
                        numberOfOccurence: duplicateScalingValueArray.length,
                        meta: _.map(duplicateScalingValueArray, function (duplicateScalingValue) {
                            return _.pick(duplicateScalingValue, ['categoryName', 'count']);
                        })
                    };
                    data.push(errorData);
                }
                if (invalidScalingPrecisionArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'categoryName',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.INVALID_SCALING_PRECISION.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.INVALID_SCALING_PRECISION.MESSAGE,
                        numberOfOccurence: invalidScalingPrecisionArray.length,
                        meta: _.map(invalidScalingPrecisionArray, function (invalidScalingPrecision) {
                            return _.pick(invalidScalingPrecision, ['categoryName', 'scalingPrecision']);
                        })
                    };
                    data.push(errorData);
                }
                if (invalidEmailArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'email',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.INVALID_EMAIL.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.INVALID_EMAIL.MESSAGE,
                        numberOfOccurence: invalidEmailArray.length,
                        meta: _.map(invalidEmailArray, function (invalidEmail) {
                            return _.pick(invalidEmail, ['email']);
                        })
                    };
                    data.push(errorData);
                }
                if (duplicateSupplierEmailArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'email',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_SUPPLIER_IN_THE_FILE.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_SUPPLIER_IN_THE_FILE.MESSAGE,
                        numberOfOccurence: duplicateSupplierEmailArray.length,
                        meta: _.map(duplicateSupplierEmailArray, function (duplicateSupplierEmail) {
                            return _.pick(duplicateSupplierEmail, ['email']);
                        })
                    };
                    data.push(errorData);
                }
                if (duplicateSupplierCodeArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'supplierCode',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_SUPPLIER_IN_THE_FILE.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_SUPPLIER_IN_THE_FILE.MESSAGE,
                        numberOfOccurence: duplicateSupplierCodeArray.length,
                        meta: _.map(duplicateSupplierCodeArray, function (duplicateSupplierCode) {
                            return _.pick(duplicateSupplierCode, ['supplierCode']);
                        })
                    };
                    data.push(errorData);
                }
                if (existSupplierEmailArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'email',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.SUPPLIER_ALREADY_EXIST.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.SUPPLIER_ALREADY_EXIST.MESSAGE,
                        numberOfOccurence: existSupplierEmailArray.length,
                        meta: _.map(existSupplierEmailArray, function (existSupplierEmail) {
                            return _.pick(existSupplierEmail, ['email']);
                        })
                    };
                    data.push(errorData);
                }
                if (existSupplierCodeArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'supplierCode',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.SUPPLIER_ALREADY_EXIST.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.SUPPLIER_ALREADY_EXIST.MESSAGE,
                        numberOfOccurence: existSupplierCodeArray.length,
                        meta: _.map(existSupplierCodeArray, function (existSupplierCode) {
                            return _.pick(existSupplierCode, ['supplierCode']);
                        })
                    };
                    data.push(errorData);
                }
                if (locationNotFoundArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'existLocationId',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.LOCATION_REFERENCE_NOT_FOUND.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.LOCATION_REFERENCE_NOT_FOUND.MESSAGE,
                        numberOfOccurence: locationNotFoundArray.length,
                        meta: _.map(locationNotFoundArray, function (locationNotFound) {
                            return _.pick(locationNotFound, ['existLocationId']);
                        })
                    };
                    data.push(errorData);
                }
                if (duplicateCustomerEmailArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'email',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_CUSTOMER_IN_THE_FILE.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_CUSTOMER_IN_THE_FILE.MESSAGE,
                        numberOfOccurence: duplicateCustomerEmailArray.length,
                        meta: _.map(duplicateCustomerEmailArray, function (duplicateCustomerEmail) {
                            return _.pick(duplicateCustomerEmail, ['email']);
                        })
                    };
                    data.push(errorData);
                }
                if (duplicateCustomerCodeArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'customerCode',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_CUSTOMER_IN_THE_FILE.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_CUSTOMER_IN_THE_FILE.MESSAGE,
                        numberOfOccurence: duplicateCustomerCodeArray.length,
                        meta: _.map(duplicateCustomerCodeArray, function (duplicateCustomerCode) {
                            return _.pick(duplicateCustomerCode, ['customerCode']);
                        })
                    };
                    data.push(errorData);
                }
                if (existCustomerEmailArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'email',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.CUSTOMER_ALREADY_EXIST.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.CUSTOMER_ALREADY_EXIST.MESSAGE,
                        numberOfOccurence: existCustomerEmailArray.length,
                        meta: _.map(existCustomerEmailArray, function (existCustomerEmail) {
                            return _.pick(existCustomerEmail, ['email']);
                        })
                    };
                    data.push(errorData);
                }
                if (existCustomerCodeArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'customerCode',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.CUSTOMER_ALREADY_EXIST.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.CUSTOMER_ALREADY_EXIST.MESSAGE,
                        numberOfOccurence: existCustomerCodeArray.length,
                        meta: _.map(existCustomerCodeArray, function (existCustomerCode) {
                            return _.pick(existCustomerCode, ['customerCode']);
                        })
                    };
                    data.push(errorData);
                }
                if (productReferenceNotFoundForOLIArray.length > 0) {
                    errorData = {
                        uploadLogId: uploadLogId,
                        createdAt: DataUtils.getEpochMSTimestamp(),
                        columnName: 'sellerSKU',
                        failReasonCode: Constants.VALIDATION_FAIL_REASON_CODE.PRODUCT_REFERENCE_NOT_FOUND.CODE,
                        errorMessage: Constants.VALIDATION_FAIL_REASON_CODE.PRODUCT_REFERENCE_NOT_FOUND.MESSAGE,
                        numberOfOccurence: productReferenceNotFoundForOLIArray.length,
                        meta: _.map(productReferenceNotFoundForOLIArray, function (productReferenceNotFoundForOLI) {
                            return _.pick(productReferenceNotFoundForOLI, ['sellerSKU']);
                        })
                    };
                    data.push(errorData);
                }


                if (data.length > 0) {
                    //var errorsWithMessage = data;
                    var errors = Utils.convertMutable(data);

                    /*_.map(errors, function (error) {
                      delete error.message;
                  });*/

                    var errorInserted = await FileUpload.insertErrorLogMD({
                        errors: errors,
                        flag: true
                    });
                    debug('errorInserted', errorInserted);

                    _.map(data, function (error) {
                        delete error.uploadLogId;
                        delete error.createdAt;
                    });
                    err = new Error(ErrorConfig.MESSAGE.INVALID_FILE);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    err.data = data;
                    err.uploadStatus = Constants.UPLOAD_STATUS.LOGICAL_VALIDATION_FAIL;
                    err.statusReasonCode = Constants.UPLOAD_STATUS_REASON_CODES.LOGICAL_VALIDATION_FAIL.CODE;
                }
                debug('err', err);
                return resolve(err);
                //return resolve(data);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        })
    },

    /*
     * get value for invalid record query
     * */
    getValuesForInvalidRecords: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            try {
                debug('inside a getValuesForInvalidRecords', options);
                var type = options.type;
                var queryNumber = options.queryNumber;
                var values = [];
                //var values = [];
                // var itemType = Object.values(Constants.UPLOAD_FILE_TYPE).indexOf(parseInt(type));
                switch (parseInt(type)) {
                    case 1 :
                        debug('ORI');
                        switch (parseInt(queryNumber)) {
                            case 1:
                                debug('ORI 1');
                                values = [options.userId];
                                break;
                            case 2:
                                debug('ORI 2');
                                values = [Constants.TYPE_DEFAULT_VALUE.STRING, options.accountId, options.userId];
                                break;
                        }
                        break;
                    case 2 :
                        debug('OLI');
                        switch (parseInt(queryNumber)) {
                            case 1:
                                debug('OLI 1');
                                values = [options.accountId, options.accountId, options.userId];
                                break;
                        }
                        break;
                    case 3 :
                        debug('Product reference');
                        switch (parseInt(queryNumber)) {
                            case 1:
                                debug('product 1');
                                values = [options.userId];
                                break;
                            case 2:
                                debug('product 2');
                                values = [Constants.UOM_CATEGORY_FOR_PRODUCTS.WEIGHT, options.languageCultureCode, Constants.DEFAULT_REFERE_ID,
                                    options.languageCultureCode, Constants.DEFAULT_REFERE_ID, options.userId,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.DATETIME];
                                break;
                            case 3:
                                debug('product 3');
                                values = [Constants.UOM_CATEGORY_FOR_PRODUCTS.HEIGHT, options.languageCultureCode, Constants.DEFAULT_REFERE_ID,
                                    options.languageCultureCode, Constants.DEFAULT_REFERE_ID, options.userId,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.DATETIME];
                                break;
                            case 4:
                                debug('product 4');
                                values = [Constants.UOM_CATEGORY_FOR_PRODUCTS.LENGTH, options.languageCultureCode, Constants.DEFAULT_REFERE_ID,
                                    options.languageCultureCode, Constants.DEFAULT_REFERE_ID, options.userId,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.DATETIME];
                                break;
                            case 5:
                                debug('product 5');
                                values = [Constants.UOM_CATEGORY_FOR_PRODUCTS.DEPTH, options.languageCultureCode, Constants.DEFAULT_REFERE_ID,
                                    options.languageCultureCode, Constants.DEFAULT_REFERE_ID, options.userId,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.DATETIME];
                                break;
                            case 6:
                                debug('product 6');
                                values = [Constants.UOM_CATEGORY_FOR_PRODUCTS.DIAMETER, options.languageCultureCode, Constants.DEFAULT_REFERE_ID,
                                    options.languageCultureCode, Constants.DEFAULT_REFERE_ID, options.userId,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.DATETIME];
                                break;
                            case 7:
                                debug('product 7');
                                values = [Constants.UOM_CATEGORY_FOR_PRODUCTS.VOLUME, options.languageCultureCode, Constants.DEFAULT_REFERE_ID,
                                    options.languageCultureCode, Constants.DEFAULT_REFERE_ID, options.userId,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.DATETIME];
                                break;
                            case 8:
                                debug('product 8');
                                values = [options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode, options.languageCultureCode,
                                    options.accountId, Constants.DEFAULT_REFERE_ID, Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.STRING];
                                break;
                            case 9:
                                debug('product 9');
                                values = [options.userId];
                                break;

                        }
                        break;
                    case 4 :
                        debug('Product Inventory');
                        switch (parseInt(queryNumber)) {
                            case 1:
                                debug('Product Inventory 1');
                                values = [options.userId];
                                break;
                            case 2:
                                debug('Product Inventory 2');
                                values = [options.accountId, Constants.TYPE_DEFAULT_VALUE.STRING];
                                break;
                            case 3:
                                debug('Product Inventory 3');
                                values = [options.accountId, options.accountId, Constants.DEFAULT_REFERE_ID,
                                    options.languageCultureCode, Constants.TYPE_DEFAULT_VALUE.STRING,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, options.accountId];
                                break;
                            case 4:
                                debug('Product Inventory 4');
                                values = [options.accountId, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                                    options.languageCultureCode, options.accountId, Constants.DEFAULT_REFERE_ID, options.accountId,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.STRING];
                                break;
                            case 5 :
                                debug('Product Inventory 5');
                                values = [options.accountId, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.DATETIME, options.accountId];
                                break;
                            case 6 :
                                debug('Product Inventory 6');
                                values = [options.accountId, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.DATETIME, options.accountId];
                                break;
                            case 7 :
                                debug('Product Inventory 7');
                                values = [options.accountId, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.DATETIME, options.accountId];
                                break;
                            case 8 :
                                debug('Product Inventory 8');
                                values = [options.accountId, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.DATETIME, options.accountId];
                                break;
                            case 9 :
                                debug('Product Inventory 9');
                                values = [options.accountId, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                                    Constants.TYPE_DEFAULT_VALUE.DATETIME, Constants.TYPE_DEFAULT_VALUE.STRING, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                                    Constants.TYPE_DEFAULT_VALUE.DATETIME, Constants.TYPE_DEFAULT_VALUE.STRING, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                                    Constants.TYPE_DEFAULT_VALUE.DATETIME, Constants.TYPE_DEFAULT_VALUE.STRING, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                                    Constants.TYPE_DEFAULT_VALUE.DATETIME, Constants.TYPE_DEFAULT_VALUE.STRING, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                                    options.accountId];
                                break;
                            case 10 :
                                debug('Product Inventory 10');
                                values = [options.accountId, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                                    options.languageCultureCode, options.accountId, Constants.DEFAULT_REFERE_ID, Constants.TYPE_DEFAULT_VALUE.STRING,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, options.userId, Constants.TYPE_DEFAULT_VALUE.DATETIME, Constants.TYPE_DEFAULT_VALUE.STRING,
                                    Constants.TYPE_DEFAULT_VALUE.DATETIME, Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.DATETIME,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.DATETIME, Constants.TYPE_DEFAULT_VALUE.STRING, options.accountId];
                                break;
                            case 11 :
                                debug('Product Inventory 11');
                                values = [options.accountId, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                                    options.languageCultureCode, options.accountId, Constants.DEFAULT_REFERE_ID, Constants.TYPE_DEFAULT_VALUE.STRING,
                                    options.accountId];
                                break;
                            case 12:
                                debug('Product Inventory 12');
                                values = [options.accountId, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode, options.languageCultureCode, options.accountId,
                                    Constants.DEFAULT_REFERE_ID, Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.STRING, options.userId,
                                    Constants.TYPE_DEFAULT_VALUE.DATETIME, Constants.TYPE_DEFAULT_VALUE.STRING, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                                    Constants.TYPE_DEFAULT_VALUE.DATETIME, Constants.TYPE_DEFAULT_VALUE.STRING, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                                    Constants.TYPE_DEFAULT_VALUE.DATETIME, Constants.TYPE_DEFAULT_VALUE.STRING, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                                    Constants.TYPE_DEFAULT_VALUE.DATETIME, Constants.TYPE_DEFAULT_VALUE.STRING, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode];
                                break;
                            case 13:
                                debug('Product Inventory 13');
                                values = [options.userId];
                                break;
                            case 14:
                                debug('Product Inventory 14');
                                values = [options.accountId, options.accountId, options.userId];
                                break;
                        }
                        break;
                    case 5 :
                        debug('Supply Items');
                        switch (parseInt(queryNumber)) {
                            case 1:
                                debug('Supply Items 1');
                                values = [options.userId];
                                break;
                            case 2:
                                debug('Supply Items 2');
                                values = [Constants.UOM_CATEGORY_FOR_PRODUCTS.WEIGHT, options.languageCultureCode, Constants.DEFAULT_REFERE_ID,
                                    options.languageCultureCode, Constants.DEFAULT_REFERE_ID, options.userId,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.DATETIME];
                                break;
                            case 3:
                                debug('product 3');
                                values = [Constants.UOM_CATEGORY_FOR_PRODUCTS.HEIGHT, options.languageCultureCode, Constants.DEFAULT_REFERE_ID,
                                    options.languageCultureCode, Constants.DEFAULT_REFERE_ID, options.userId,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.DATETIME];
                                break;
                            case 4:
                                debug('Supply Items 4');
                                values = [Constants.UOM_CATEGORY_FOR_PRODUCTS.LENGTH, options.languageCultureCode, Constants.DEFAULT_REFERE_ID,
                                    options.languageCultureCode, Constants.DEFAULT_REFERE_ID, options.userId,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.DATETIME];
                                break;
                            case 5:
                                debug('Supply Items 5');
                                values = [Constants.UOM_CATEGORY_FOR_PRODUCTS.DEPTH, options.languageCultureCode, Constants.DEFAULT_REFERE_ID,
                                    options.languageCultureCode, Constants.DEFAULT_REFERE_ID, options.userId,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.DATETIME];
                                break;
                            case 6:
                                debug('Supply Items 6');
                                values = [Constants.UOM_CATEGORY_FOR_PRODUCTS.DIAMETER, options.languageCultureCode, Constants.DEFAULT_REFERE_ID,
                                    options.languageCultureCode, Constants.DEFAULT_REFERE_ID, options.userId,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.DATETIME];
                                break;
                            case 7:
                                debug('Supply Items 7');
                                values = [Constants.UOM_CATEGORY_FOR_PRODUCTS.VOLUME, options.languageCultureCode, Constants.DEFAULT_REFERE_ID,
                                    options.languageCultureCode, Constants.DEFAULT_REFERE_ID, options.userId,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.DATETIME];
                                break;
                            case 8:
                                debug('Supply Items 8');
                                values = [options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode, options.languageCultureCode,
                                    options.accountId, Constants.DEFAULT_REFERE_ID, Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.STRING];
                                break;
                            case 9:
                                debug('Supply Items 9');
                                values = [options.userId];
                                break;

                        }
                        break;
                    case 6 :
                        debug('Supply Inventory');
                        switch (parseInt(queryNumber)) {
                            case 1:
                                debug('Supply Inventory 1');
                                values = [options.userId];
                                break;
                            case 2:
                                debug('Supply Inventory 2');
                                values = [options.accountId, Constants.TYPE_DEFAULT_VALUE.STRING];
                                break;
                            case 3:
                                debug('Supply Inventory 3');
                                values = [options.accountId, options.accountId, Constants.DEFAULT_REFERE_ID,
                                    options.languageCultureCode, Constants.TYPE_DEFAULT_VALUE.STRING,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, options.accountId];
                                break;
                            case 4:
                                debug('Supply Inventory 4');
                                values = [options.accountId, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                                    options.languageCultureCode, options.accountId, Constants.DEFAULT_REFERE_ID, options.accountId,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.STRING];
                                break;
                            case 5 :
                                debug('Supply Inventory 5');
                                values = [options.accountId, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.DATETIME, options.accountId];
                                break;
                            case 6 :
                                debug('Supply Inventory 6');
                                values = [options.accountId, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.DATETIME, options.accountId];
                                break;
                            case 7 :
                                debug('Supply Inventory 7');
                                values = [options.accountId, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.DATETIME, options.accountId];
                                break;
                            case 8 :
                                debug('Supply Inventory 8');
                                values = [options.accountId, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.DATETIME, options.accountId];
                                break;
                            case 9 :
                                debug('Supply Inventory 9');
                                values = [options.accountId, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                                    Constants.TYPE_DEFAULT_VALUE.DATETIME, Constants.TYPE_DEFAULT_VALUE.STRING, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                                    Constants.TYPE_DEFAULT_VALUE.DATETIME, Constants.TYPE_DEFAULT_VALUE.STRING, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                                    Constants.TYPE_DEFAULT_VALUE.DATETIME, Constants.TYPE_DEFAULT_VALUE.STRING, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                                    Constants.TYPE_DEFAULT_VALUE.DATETIME, Constants.TYPE_DEFAULT_VALUE.STRING, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                                    options.accountId];
                                break;
                            case 10 :
                                debug('Supply Inventory 10');
                                values = [options.accountId, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                                    options.languageCultureCode, options.accountId, Constants.DEFAULT_REFERE_ID, Constants.TYPE_DEFAULT_VALUE.STRING,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, options.userId, Constants.TYPE_DEFAULT_VALUE.DATETIME, Constants.TYPE_DEFAULT_VALUE.STRING,
                                    Constants.TYPE_DEFAULT_VALUE.DATETIME, Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.DATETIME,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.DATETIME, Constants.TYPE_DEFAULT_VALUE.STRING, options.accountId];
                                break;
                            case 11 :
                                debug('Supply Inventory 11');
                                values = [options.accountId, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                                    options.languageCultureCode, options.accountId, Constants.DEFAULT_REFERE_ID, Constants.TYPE_DEFAULT_VALUE.STRING,
                                    options.accountId];
                                break;
                            case 12:
                                debug('Supply Inventory 12');
                                values = [options.accountId, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode, options.languageCultureCode, options.accountId,
                                    Constants.DEFAULT_REFERE_ID, Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.STRING, options.userId,
                                    Constants.TYPE_DEFAULT_VALUE.DATETIME, Constants.TYPE_DEFAULT_VALUE.STRING, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                                    Constants.TYPE_DEFAULT_VALUE.DATETIME, Constants.TYPE_DEFAULT_VALUE.STRING, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                                    Constants.TYPE_DEFAULT_VALUE.DATETIME, Constants.TYPE_DEFAULT_VALUE.STRING, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                                    Constants.TYPE_DEFAULT_VALUE.DATETIME, Constants.TYPE_DEFAULT_VALUE.STRING, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode];
                                break;
                            case 13:
                                debug('Supply Inventory 13');
                                values = [options.userId];
                                break;
                            case 14:
                                debug('Supply Inventory 14');
                                values = [options.accountId, options.accountId, options.userId];
                                break;
                        }
                        break;
                    case 7 :
                        debug('Location Reference');
                        switch (parseInt(queryNumber)) {
                            case 1:
                                debug('Location Reference 1');
                                values = [options.userId];
                                break;
                            case 2:
                                debug('Location Reference 2');
                                values = [options.userId];
                                break;
                            case 3:
                                debug('Location Reference 3');
                                values = [options.userId];
                                break;
                            case 4:
                                debug('Location Reference 4');
                                values = [options.userId];
                                break;
                            case 5:
                                debug('Location Reference 5');
                                values = [options.userId, Constants.TYPE_DEFAULT_VALUE.STRING];
                                break;
                            case 6:
                                debug('Location Reference 6');
                                values = [options.userId, Constants.TYPE_DEFAULT_VALUE.STRING];
                                break;
                        }
                        break;
                    case 8 :
                        debug('Unit Of Measure');
                        switch (parseInt(queryNumber)) {
                            case 1:
                                debug('Unit Of Measure 1');
                                values = [options.userId];
                                break;
                            case 2:
                                debug('Unit Of Measure 2');
                                values = [options.userId];
                                break;
                            case 3:
                                debug('Unit Of Measure 3');
                                values = [options.userId];
                                break;
                            case 4:
                                debug('Unit Of Measure 4');
                                values = [options.userId];
                                break;
                            case 5:
                                debug('Unit Of Measure 5');
                                values = [options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                                    options.languageCultureCode, options.accountId, Constants.DEFAULT_REFERE_ID, options.userId];
                                break;
                            case 6:
                                debug('Unit Of Measure 6');
                                values = [options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                                    options.languageCultureCode, options.accountId, Constants.DEFAULT_REFERE_ID, options.userId];
                                break;
                            case 7:
                                debug('Unit Of Measure 7');
                                values = [options.languageCultureCode, options.accountId, Constants.DEFAULT_REFERE_ID,
                                    options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode, options.userId];
                                break;
                            case 8:
                                debug('Unit Of Measure 8');
                                values = [options.languageCultureCode, options.accountId, Constants.DEFAULT_REFERE_ID,
                                    options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode, options.userId];
                                break;
                            case 9:
                                debug('Unit Of Measure 9');
                                values = [options.languageCultureCode, options.accountId, Constants.DEFAULT_REFERE_ID, options.userId,
                                    options.userId];
                                break;
                        }
                        break;
                    case 9 :
                        debug('Supplier');
                        switch (parseInt(queryNumber)) {
                            case 1:
                                debug('Supplier 1');
                                values = [Constants.EMAIL_REGEXP, options.userId];
                                break;
                            case 2:
                                debug('Supplier 2');
                                values = [options.userId];
                                break;
                            case 3:
                                debug('Supplier 3');
                                values = [options.accountId, options.accountId, options.userId];
                                break;
                            case 4:
                                debug('Supplier 4');
                                values = [options.userId];
                                break;
                            case 5:
                                debug('Supplier 5');
                                values = [options.accountId, options.accountId, options.userId];
                                break;
                            case 6:
                                debug('Supplier 6');
                                values = [options.accountId, Constants.TYPE_DEFAULT_VALUE.STRING, options.accountId, options.userId];
                                break;
                            case 7:
                                debug('Supplier 7');
                                values = [options.accountId, Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.STRING,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, options.accountId, options.userId];
                                break;
                            case 8:
                                debug('Supplier 8');
                                values = [options.accountId, Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.STRING,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, options.accountId, options.userId];
                                break;
                            case 9:
                                debug('Supplier 9');
                                values = [options.accountId, Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.STRING,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, options.accountId, options.userId, options.accountId];
                                break;
                            case 10:
                                debug('Supplier 10');
                                values = [options.accountId, Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.STRING,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, options.accountId, options.userId, options.accountId];
                                break;
                        }
                        break;
                    case 10 :
                        debug('Customer');
                        switch (parseInt(queryNumber)) {
                            case 1:
                                debug('Customer 1');
                                values = [Constants.EMAIL_REGEXP, options.userId];
                                break;
                            case 2:
                                debug('Customer 2');
                                values = [options.userId];
                                break;
                            case 3:
                                debug('Customer 3');
                                values = [options.accountId, options.accountId, options.userId];
                                break;
                            case 4:
                                debug('Customer 4');
                                values = [options.userId];
                                break;
                            case 5:
                                debug('Customer 5');
                                values = [options.accountId, options.accountId, options.userId];
                                break;
                            case 6:
                                debug('Customer 6');
                                values = [options.accountId, Constants.TYPE_DEFAULT_VALUE.STRING, options.accountId, options.userId];
                                break;
                            case 7:
                                debug('Customer 7');
                                values = [options.accountId, Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.STRING,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, options.accountId, options.userId];
                                break;
                            case 8:
                                debug('Customer 8');
                                values = [options.accountId, Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.STRING,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, options.accountId, options.userId];
                                break;
                            case 9:
                                debug('Customer 9');
                                values = [options.accountId, Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.STRING,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, options.accountId, options.userId, options.accountId];
                                break;
                            case 10:
                                debug('Customer 10');
                                values = [options.accountId, Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.STRING,
                                    Constants.TYPE_DEFAULT_VALUE.STRING, options.accountId, options.userId, options.accountId];
                                break;
                        }
                        break;

                }
                debug('value====', values);
                return resolve(values);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
     * get invalid records from temp table
     * */
    getInvalidRecords: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var type = options.type;
            var uploadLogId = options.uploadLogId;
            var productReferenceNotFoundArray = [];
            var duplicateProductInventoryArray = [], existProductInventoryArray = [];
            var differentCategoryUOMArray = [];
            var qtyOnHandUOMArray = [], qtyOnOrderUOMArray = [], qtyAvailableUOMArray = [], qtyInTransitUOMArray = [];
            var uomResultArray = [];
            var duplicateProductArray = [], existProductArray = [], qtyUoMIdArray = [];
            var weightUoMScalArray = [], heightUoMScalArray = [], lengthUoMScalArray = [];
            var depthUoMScalArray = [], diameterUoMScalArray = [], volumeUoMScalArray = [];
            var duplicateSupplyItemsArray = [], existSupplyItemsArray = [];
            var duplicateSupplyInventoryArray = [], existSupplyInventoryArray = [];
            var duplicateOrderArray = [], marketPlaceNotFoundArray = [];
            var duplicateLocationIdArray = [], duplicateLocationNameArray = [], existLocationIdArray = [],
              existLocationNameArray = [];
            var invalidLatitudeArray = [], invalidLongitudeArray = [];
            var duplicateUOMNameArray = [], existUOMNameArray = [], duplicateUOMSymbolArray = [],
              existUOMSymbolArray = [], invalidScalingPrecisionArray = [];
            var duplicateScalingValueArray = [], existScalingValueArray = [];
            var existScalingFactorArray = [], missingScalingFactorArray = [];
            var invalidEmailArray = [], duplicateSupplierEmailArray = [], duplicateSupplierCodeArray = [];
            var existSupplierEmailArray = [], existSupplierCodeArray = [], locationNotFoundArray = [];
            var duplicateCustomerEmailArray = [], duplicateCustomerCodeArray = [];
            var existCustomerEmailArray = [], existCustomerCodeArray = [];
            var productReferenceNotFoundForOLIArray = [];
            var invalidRecordsQueries = Constants.TABLE_NAME[parseInt(type)].INVALID_RECORDS;

            try {
                var conn = await connection.getConnection();

                await PromiseBluebird.each(invalidRecordsQueries, async function (invalidRecordQuery) {
                    var valueOptions = {
                        type: type,
                        queryNumber: invalidRecordQuery.QUERY_NUMBER,
                        accountId: options.accountId,
                        userId: options.userId,
                        languageCultureCode: options.languageCultureCode
                    };
                    // debug('value options', valueOptions);

                    var values = await FileUpload.getValuesForInvalidRecords(valueOptions);
                    //debug('values from function', values);

                    var result = await conn.query(invalidRecordQuery.QUERY, values);
                    debug('result===', result);

                    if (result && result.length > 0) {
                        if (invalidRecordQuery.ERROR === Constants.VALIDATION_FAIL_REASON_CODE.PRODUCT_REFERENCE_NOT_FOUND.MESSAGE) {
                            productReferenceNotFoundArray = productReferenceNotFoundArray.concat(result);
                        } else if (invalidRecordQuery.ERROR === Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_NOT_FOUND.MESSAGE) {
                            uomResultArray = uomResultArray.concat(result);
                            // For insert specific column name in error log

                            if (invalidRecordQuery.COLUMN_NAME === 'qtyOnHandUoM') {
                                qtyOnHandUOMArray = qtyOnHandUOMArray.concat(result);
                            } else if (invalidRecordQuery.COLUMN_NAME === 'qtyOnOrderUoM') {
                                qtyOnOrderUOMArray = qtyOnOrderUOMArray.concat(result);
                            } else if (invalidRecordQuery.COLUMN_NAME === 'qtyAvailableUoM') {
                                qtyAvailableUOMArray = qtyAvailableUOMArray.concat(result);
                            } else if (invalidRecordQuery.COLUMN_NAME === 'qtyInTransitUoM') {
                                qtyInTransitUOMArray = qtyInTransitUOMArray.concat(result);
                            } else if (invalidRecordQuery.COLUMN_NAME === 'weightUoMScal') {
                                weightUoMScalArray = weightUoMScalArray.concat(result);
                            } else if (invalidRecordQuery.COLUMN_NAME === 'heightUoMScal') {
                                heightUoMScalArray = heightUoMScalArray.concat(result);
                            } else if (invalidRecordQuery.COLUMN_NAME === 'lengthUoMScal') {
                                lengthUoMScalArray = lengthUoMScalArray.concat(result);
                            } else if (invalidRecordQuery.COLUMN_NAME === 'depthUoMScal') {
                                depthUoMScalArray = depthUoMScalArray.concat(result);
                            } else if (invalidRecordQuery.COLUMN_NAME === 'diameterUoMScal') {
                                diameterUoMScalArray = diameterUoMScalArray.concat(result);
                            } else if (invalidRecordQuery.COLUMN_NAME === 'volumeUoMScal') {
                                volumeUoMScalArray = volumeUoMScalArray.concat(result);
                            } else if (invalidRecordQuery.COLUMN_NAME === 'qtyUoMId') {
                                qtyUoMIdArray = qtyUoMIdArray.concat(result);
                            }

                            // Update records for all invalid qtyUOM
                            if (invalidRecordQuery.IS_UPDATE === 1) {
                                debug('inside update ', invalidRecordQuery.QUERY_NUMBER);
                                result = uomResultArray;
                                uomResultArray = [];
                            }
                            debug('result===========', result);
                        } else if (invalidRecordQuery.ERROR === Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_PRODUCT_INVENTORY_IN_THE_FILE.MESSAGE) {
                            debug('result 123456', result);
                            duplicateProductInventoryArray = duplicateProductInventoryArray.concat(result);
                            var finalResult = [];
                            _.map(result, function (value) {
                                value.tempId = value.tempId.split(',');
                                _.each(value.tempId, function (id) {
                                    finalResult = finalResult.concat({tempId: id})
                                })
                            });
                            result = finalResult;
                        } else if (invalidRecordQuery.ERROR === Constants.VALIDATION_FAIL_REASON_CODE.PRODUCT_INVENTORY_ALREADY_EXIST.MESSAGE) {
                            existProductInventoryArray = existProductInventoryArray.concat(result)
                        } else if (invalidRecordQuery.ERROR === Constants.VALIDATION_FAIL_REASON_CODE.UOM_IS_FROM_DIFFERENT_CATEGORY.MESSAGE) {
                            differentCategoryUOMArray = differentCategoryUOMArray.concat(result)
                        } else if (invalidRecordQuery.ERROR === Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_PRODUCT_IN_THE_FILE.MESSAGE) {
                            debug('result 123456', result);
                            duplicateProductArray = duplicateProductArray.concat(result);
                            finalResult = [];
                            _.map(result, function (value) {
                                value.tempId = value.tempId.split(',');
                                _.each(value.tempId, function (id) {
                                    finalResult = finalResult.concat({tempId: id})
                                })
                            });
                            result = finalResult;
                        } else if (invalidRecordQuery.ERROR === Constants.VALIDATION_FAIL_REASON_CODE.PRODUCT_ALREADY_EXIST.MESSAGE) {
                            existProductArray = existProductArray.concat(result);
                        } else if (invalidRecordQuery.ERROR === Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_SUPPLY_ITEM_IN_THE_FILE.MESSAGE) {
                            duplicateSupplyItemsArray = duplicateSupplyItemsArray.concat(result);
                            finalResult = [];
                            _.map(result, function (value) {
                                value.tempId = value.tempId.split(',');
                                _.each(value.tempId, function (id) {
                                    finalResult = finalResult.concat({tempId: id})
                                })
                            });
                            result = finalResult;
                        } else if (invalidRecordQuery.ERROR === Constants.VALIDATION_FAIL_REASON_CODE.SUPPLY_ITEMS_ALREADY_EXIST.MESSAGE) {
                            existSupplyItemsArray = existSupplyItemsArray.concat(result);
                        } else if (invalidRecordQuery.ERROR === Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_SUPPLY_ITEM_INVENTORY_IN_THE_FILE.MESSAGE) {
                            duplicateSupplyInventoryArray = duplicateSupplyInventoryArray.concat(result);
                            finalResult = [];
                            _.map(result, function (value) {
                                value.tempId = value.tempId.split(',');
                                _.each(value.tempId, function (id) {
                                    finalResult = finalResult.concat({tempId: id})
                                })
                            });
                            result = finalResult;
                        } else if (invalidRecordQuery.ERROR === Constants.VALIDATION_FAIL_REASON_CODE.SUPPLY_ITEM_INVENTORY_ALREADY_EXIST.MESSAGE) {
                            existSupplyInventoryArray = existSupplyInventoryArray.concat(result);
                        } else if (invalidRecordQuery.ERROR === Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_ORDER_IN_THE_FILE.MESSAGE) {
                            duplicateOrderArray = duplicateOrderArray.concat(result);
                            finalResult = [];
                            _.map(result, function (value) {
                                value.tempId = value.tempId.split(',');
                                _.each(value.tempId, function (id) {
                                    finalResult = finalResult.concat({tempId: id})
                                })
                            });
                            result = finalResult;
                        } else if (invalidRecordQuery.ERROR === Constants.VALIDATION_FAIL_REASON_CODE.MARKET_PLACE_NOT_FOUND.MESSAGE) {
                            marketPlaceNotFoundArray = marketPlaceNotFoundArray.concat(result);
                        } else if (invalidRecordQuery.ERROR === Constants.VALIDATION_FAIL_REASON_CODE.LOCATION_REFERENCE_ALREADY_EXIST.MESSAGE) {
                            if (invalidRecordQuery.COLUMN_NAME === 'locationId') {
                                existLocationIdArray = existLocationIdArray.concat(result);
                            } else if (invalidRecordQuery.COLUMN_NAME === 'locationName') {
                                existLocationNameArray = existLocationNameArray.concat(result);
                            }
                        } else if (invalidRecordQuery.ERROR === Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_LOCATION_REFERENCE_IN_THE_FILE.MESSAGE) {
                            if (invalidRecordQuery.COLUMN_NAME === 'locationId') {
                                duplicateLocationIdArray = duplicateLocationIdArray.concat(result);
                            } else if (invalidRecordQuery.COLUMN_NAME === 'locationName') {
                                duplicateLocationNameArray = duplicateLocationNameArray.concat(result);
                            }
                            finalResult = [];
                            _.map(result, function (value) {
                                value.tempId = value.tempId.split(',');
                                _.each(value.tempId, function (id) {
                                    finalResult = finalResult.concat({tempId: id})
                                })
                            });
                            result = finalResult;
                        } else if (invalidRecordQuery.ERROR === Constants.VALIDATION_FAIL_REASON_CODE.INVALID_LATITUDE_VALUE.MESSAGE) {
                            invalidLatitudeArray = invalidLatitudeArray.concat(result);
                        } else if (invalidRecordQuery.ERROR === Constants.VALIDATION_FAIL_REASON_CODE.INVALID_LONGITUDE_VALUE.MESSAGE) {
                            invalidLongitudeArray = invalidLongitudeArray.concat(result);
                        } else if (invalidRecordQuery.ERROR === Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_EXIST_WITH_SAME_NAME.MESSAGE) {
                            existUOMNameArray = existUOMNameArray.concat(result);
                        } else if (invalidRecordQuery.ERROR === Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_EXIST_WITH_SAME_SYMBOL.MESSAGE) {
                            existUOMSymbolArray = existUOMSymbolArray.concat(result);
                        } else if (invalidRecordQuery.ERROR === Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_EXIST_WITH_SAME_SCALING_FACTOR_AND_PRECISION.MESSAGE) {
                            existScalingValueArray = existScalingValueArray.concat(result);
                        } else if (invalidRecordQuery.ERROR === Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_SCALING_FACTOR_ONE_ALREADY_EXIST_FOR_THIS_CATEGORY.MESSAGE) {
                            existScalingFactorArray = existScalingFactorArray.concat(result);
                        } else if (invalidRecordQuery.ERROR === Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_SCALAR_FACTOR_SHOULD_BE_1.MESSAGE) {
                            missingScalingFactorArray = missingScalingFactorArray.concat(result);
                        } else if (invalidRecordQuery.ERROR === Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_UNIT_OF_MEASURE_NAME_IN_THE_FILE.MESSAGE) {
                            duplicateUOMNameArray = duplicateUOMNameArray.concat(result);
                            finalResult = [];
                            _.map(result, function (value) {
                                value.tempId = value.tempId.split(',');
                                _.each(value.tempId, function (id) {
                                    finalResult = finalResult.concat({tempId: id})
                                })
                            });
                            result = finalResult;
                        } else if (invalidRecordQuery.ERROR === Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_UNIT_OF_MEASURE_SYMBOL_IN_THE_FILE.MESSAGE) {
                            duplicateUOMSymbolArray = duplicateUOMSymbolArray.concat(result);
                            finalResult = [];
                            _.map(result, function (value) {
                                value.tempId = value.tempId.split(',');
                                _.each(value.tempId, function (id) {
                                    finalResult = finalResult.concat({tempId: id})
                                })
                            });
                            result = finalResult;
                        } else if (invalidRecordQuery.ERROR === Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_SCALING_VALUE_IN_THE_FILE.MESSAGE) {
                            duplicateScalingValueArray = duplicateScalingValueArray.concat(result);
                            finalResult = [];
                            _.map(result, function (value) {
                                value.tempId = value.tempId.split(',');
                                _.each(value.tempId, function (id) {
                                    finalResult = finalResult.concat({tempId: id})
                                })
                            });
                            result = finalResult;
                        } else if (invalidRecordQuery.ERROR === Constants.VALIDATION_FAIL_REASON_CODE.INVALID_SCALING_PRECISION.MESSAGE) {
                            invalidScalingPrecisionArray = invalidScalingPrecisionArray.concat(result);
                        } else if (invalidRecordQuery.ERROR === Constants.VALIDATION_FAIL_REASON_CODE.SUPPLIER_ALREADY_EXIST.MESSAGE) {
                            if (invalidRecordQuery.COLUMN_NAME === 'email') {
                                existSupplierEmailArray = existSupplierEmailArray.concat(result);
                            } else if (invalidRecordQuery.COLUMN_NAME === 'supplierCode') {
                                existSupplierCodeArray = existSupplierCodeArray.concat(result);
                            }
                        } else if (invalidRecordQuery.ERROR === Constants.VALIDATION_FAIL_REASON_CODE.INVALID_EMAIL.MESSAGE) {
                            invalidEmailArray = invalidEmailArray.concat(result);
                        } else if (invalidRecordQuery.ERROR === Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_SUPPLIER_IN_THE_FILE.MESSAGE) {
                            if (invalidRecordQuery.COLUMN_NAME === 'email') {
                                duplicateSupplierEmailArray = duplicateSupplierEmailArray.concat(result);
                            } else if (invalidRecordQuery.COLUMN_NAME === 'supplierCode') {
                                duplicateSupplierCodeArray = duplicateSupplierCodeArray.concat(result);
                            }
                            finalResult = [];
                            _.map(result, function (value) {
                                value.tempId = value.tempId.split(',');
                                _.each(value.tempId, function (id) {
                                    finalResult = finalResult.concat({tempId: id})
                                })
                            });
                            result = finalResult;
                        } else if (invalidRecordQuery.ERROR === Constants.VALIDATION_FAIL_REASON_CODE.LOCATION_REFERENCE_NOT_FOUND.MESSAGE) {
                            locationNotFoundArray = locationNotFoundArray.concat(result);
                        } else if (invalidRecordQuery.ERROR === Constants.VALIDATION_FAIL_REASON_CODE.CUSTOMER_ALREADY_EXIST.MESSAGE) {
                            if (invalidRecordQuery.COLUMN_NAME === 'email') {
                                existCustomerEmailArray = existCustomerEmailArray.concat(result);
                            } else if (invalidRecordQuery.COLUMN_NAME === 'customerCode') {
                                existCustomerCodeArray = existCustomerCodeArray.concat(result);
                            }
                        } else if (invalidRecordQuery.ERROR === Constants.VALIDATION_FAIL_REASON_CODE.DUPLICATE_CUSTOMER_IN_THE_FILE.MESSAGE) {
                            if (invalidRecordQuery.COLUMN_NAME === 'email') {
                                duplicateCustomerEmailArray = duplicateCustomerEmailArray.concat(result);
                            } else if (invalidRecordQuery.COLUMN_NAME === 'customerCode') {
                                duplicateCustomerCodeArray = duplicateCustomerCodeArray.concat(result);
                            }
                            finalResult = [];
                            _.map(result, function (value) {
                                value.tempId = value.tempId.split(',');
                                _.each(value.tempId, function (id) {
                                    finalResult = finalResult.concat({tempId: id})
                                })
                            });
                            result = finalResult;
                        } else if (invalidRecordQuery.ERROR === Constants.VALIDATION_FAIL_REASON_CODE.PRODUCT_REFERENCE_NOT_FOUND.MESSAGE) {
                            productReferenceNotFoundForOLIArray = productReferenceNotFoundForOLIArray.concat(result);
                        }
                    }

                    if (result.length <= 0 && invalidRecordQuery.IS_UPDATE === 1 &&
                      invalidRecordQuery.ERROR === Constants.VALIDATION_FAIL_REASON_CODE.UNIT_OF_MEASURE_NOT_FOUND.MESSAGE) {
                        result = uomResultArray;
                        uomResultArray = [];
                    }

                    var resultedId = _.map(result, 'tempId');
                    debug('resultedId', resultedId);

                    if (invalidRecordQuery.IS_UPDATE === 1 && resultedId.length > 0) {
                        var updateOptions = {
                            ids: _.uniq(resultedId),
                            type: type,
                            error: invalidRecordQuery.ERROR
                        };
                        var updated = await FileUpload.updateInvalidRecords(updateOptions);
                        debug('updated', updated);
                        debug('inside update');
                    }
                });

                var invalidRecordsArrayOptions = {
                    uploadLogId: uploadLogId,
                    productReferenceNotFoundArray: productReferenceNotFoundArray,
                    qtyOnHandUOMArray: qtyOnHandUOMArray,
                    qtyOnOrderUOMArray: qtyOnOrderUOMArray,
                    qtyAvailableUOMArray: qtyAvailableUOMArray,
                    qtyInTransitUOMArray: qtyInTransitUOMArray,
                    duplicateProductInventoryArray: duplicateProductInventoryArray,
                    existProductInventoryArray: existProductInventoryArray,
                    differentCategoryUOMArray: differentCategoryUOMArray,
                    duplicateProductArray: duplicateProductArray,
                    existProductArray: existProductArray,
                    weightUoMScalArray: weightUoMScalArray,
                    heightUoMScalArray: heightUoMScalArray,
                    lengthUoMScalArray: lengthUoMScalArray,
                    depthUoMScalArray: depthUoMScalArray,
                    diameterUoMScalArray: diameterUoMScalArray,
                    volumeUoMScalArray: volumeUoMScalArray,
                    qtyUoMIdArray: qtyUoMIdArray,
                    duplicateSupplyItemsArray: duplicateSupplyItemsArray,
                    existSupplyItemsArray: existSupplyItemsArray,
                    duplicateSupplyInventoryArray: duplicateSupplyInventoryArray,
                    existSupplyInventoryArray: existSupplyInventoryArray,
                    duplicateOrderArray: duplicateOrderArray,
                    marketPlaceNotFoundArray: marketPlaceNotFoundArray,
                    duplicateLocationIdArray: duplicateLocationIdArray,
                    duplicateLocationNameArray: duplicateLocationNameArray,
                    existLocationIdArray: existLocationIdArray,
                    existLocationNameArray: existLocationNameArray,
                    invalidLatitudeArray: invalidLatitudeArray,
                    invalidLongitudeArray: invalidLongitudeArray,
                    existUOMNameArray: existUOMNameArray,
                    existUOMSymbolArray: existUOMSymbolArray,
                    existScalingValueArray: existScalingValueArray,
                    existScalingFactorArray: existScalingFactorArray,
                    missingScalingFactorArray: missingScalingFactorArray,
                    duplicateUOMNameArray: duplicateUOMNameArray,
                    duplicateUOMSymbolArray: duplicateUOMSymbolArray,
                    duplicateScalingValueArray: duplicateScalingValueArray,
                    invalidScalingPrecisionArray: invalidScalingPrecisionArray,
                    invalidEmailArray: invalidEmailArray,
                    duplicateSupplierEmailArray: duplicateSupplierEmailArray,
                    duplicateSupplierCodeArray: duplicateSupplierCodeArray,
                    existSupplierEmailArray: existSupplierEmailArray,
                    existSupplierCodeArray: existSupplierCodeArray,
                    locationNotFoundArray: locationNotFoundArray,
                    duplicateCustomerEmailArray: duplicateCustomerEmailArray,
                    duplicateCustomerCodeArray: duplicateCustomerCodeArray,
                    existCustomerEmailArray: existCustomerEmailArray,
                    existCustomerCodeArray: existCustomerCodeArray,
                    productReferenceNotFoundForOLIArray: productReferenceNotFoundForOLIArray
                };

                var invalidRecordsArrayResponse = await FileUpload.getInvalidRecordsArray(invalidRecordsArrayOptions);
                debug('invalidRecordsArrayResponse', invalidRecordsArrayResponse);

                return resolve(invalidRecordsArrayResponse);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
     * Get location records which not exists
     * */
    getNotExistLocationRecordsInventory: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var type = options.type;
                var tableName = Constants.TABLE_NAME[parseInt(type)].TEMP;

                var conn = await connection.getConnection();

                var locations = await conn.query('SELECT distinct (CAST(uuid_from_bin(TPI.accountId) as char)) as accountId, ' +
                  ' (CAST(uuid_from_bin(TPI.createdBy) as char)) as createdBy, TPI.locationId as locationId, TPI.locationId as locationName,' +
                  ' TPI.createdAt as createdAt, TPI.updatedAt as updatedAt ' +
                  ' FROM ' + tableName + ' TPI' +
                  ' LEFT JOIN  LocationReference LR ON TPI.locationId  = LR.locationId AND LR.accountId = uuid_to_bin(?)' +
                  ' WHERE LR.locationId IS NULL AND ' +
                  ' TPI.createdBy = uuid_to_bin(?) AND TPI.errorFlag = 0', [options.accountId, options.userId]);

                return resolve(locations);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        })
    },

    /*
     *  Get records for create uom category which sku, uom, category is  not exist
     * */
    getNotExistCategoryRecordsInventory: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var type = options.type;
                var tableName = Constants.TABLE_NAME[parseInt(type)].TEMP;
                var RefTableName = Constants.TABLE_NAME[parseInt(type)].REFERENCE;
                var conn = await connection.getConnection();

                var records = await conn.query('SELECT distinct (TPI.defaultUOMCategory) as name, ' +
                  ' (CAST(uuid_from_bin(TPI.accountId) as CHAR)) as accountId, ' +
                  ' (CAST(uuid_from_bin(TPI.createdBy) as CHAR)) as createdBy, TPI.createdAt as createdAt, TPI.recordType as recordType' +
                  ' FROM ' + tableName + ' TPI LEFT JOIN ' + RefTableName + ' PR ' +
                  ' ON TPI.SKU  = PR.sku AND PR.accountId = uuid_to_bin(?) ' +
                  ' LEFT JOIN  uomNames UN ' +
                  ' INNER JOIN uomScaling US ON US.id = UN.uomScalingId ' +
                  ' AND (US.accountId = uuid_to_bin(?) OR US.accountId = uuid_to_bin(?)) ' +
                  ' AND UN.languageCultureCode = ? ON TPI.defaultUoMSymbol = UN.symbol ' +
                  ' LEFT JOIN  uomCategory UC ON TPI.defaultUoMCategory = UC.NAME ' +
                  ' AND UC.languageCultureCode = ? ' +
                  ' AND (UC.accountId = uuid_to_bin(?) OR UC.accountId = uuid_to_bin(?)) ' +
                  ' WHERE UN.symbol IS NULL AND PR.sku IS NULL AND UC.name IS NULL AND  TPI.defaultUoMSymbol != ? ' +
                  ' AND TPI.defaultUoMCategory != ? AND TPI.createdBy = uuid_to_bin(?) AND TPI.errorFlag = 0',
                  [options.accountId, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                      options.languageCultureCode, options.accountId, Constants.DEFAULT_REFERE_ID,
                      Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.STRING, options.userId]);

                return resolve(records);
                //return resolve(Constants.OK_MESSAGE)
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        })
    },

    /*
     * Get records for create unit of measure which sku, uom is  not exist
     * */
    getNotExistUOMRecordsInventory: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var type = options.type;
                var tableName = Constants.TABLE_NAME[parseInt(type)].TEMP;
                var RefTableName = Constants.TABLE_NAME[parseInt(type)].REFERENCE;
                var conn = await connection.getConnection();

                var records = await conn.query('SELECT distinct (CAST(uuid_from_bin(TPI.accountId) as CHAR)) as accountId, ' +
                  ' UC.categoryId as categoryId, 1 as scalingFactor, 3 as scalingPrecision,TPI.createdAt as createdAt, ' +
                  ' (CAST(uuid_from_bin(TPI.createdBy) as CHAR)) as createdBy, TPI.defaultUOMSymbol as symbol,' +
                  ' TPI.defaultUOMSymbol as name, TPI.recordType as recordType' +
                  ' FROM ' + tableName + ' TPI LEFT JOIN ' + RefTableName + ' PR ' +
                  ' ON TPI.SKU  = PR.sku AND PR.accountId = uuid_to_bin(?) ' +
                  ' LEFT JOIN  uomNames UN ' +
                  ' INNER JOIN uomScaling US ON US.id = UN.uomScalingId ' +
                  ' AND (US.accountId = uuid_to_bin(?) OR US.accountId = uuid_to_bin(?)) ' +
                  ' AND UN.languageCultureCode = ? ON TPI.defaultUoMSymbol = UN.symbol ' +
                  ' LEFT JOIN  uomCategory UC ON TPI.defaultUoMCategory = UC.NAME ' +
                  ' AND UC.languageCultureCode = ? ' +
                  ' AND (UC.accountId = uuid_to_bin(?) OR UC.accountId = uuid_to_bin(?)) ' +
                  ' WHERE UN.symbol IS NULL AND PR.sku IS NULL AND UC.name IS NOT NULL AND  TPI.defaultUoMSymbol != ? ' +
                  ' AND TPI.defaultUoMCategory != ? AND TPI.createdBy = uuid_to_bin(?) AND TPI.errorFlag = 0',
                  [options.accountId, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                      options.languageCultureCode, options.accountId, Constants.DEFAULT_REFERE_ID,
                      Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.STRING, options.userId]);

                return resolve(records);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        })
    },

    /*
     * Get records for create product reference which sku is  not exist
     * */
    getNotExistSKURecordsInventory: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var type = options.type;
                var tableName = Constants.TABLE_NAME[parseInt(type)].TEMP;
                var RefTableName = Constants.TABLE_NAME[parseInt(type)].REFERENCE;
                var conn = await connection.getConnection();

                var records = await conn.query('SELECT uuid() as id, (CAST(uuid_from_bin(TPI.accountId) as CHAR)) as accountId, ' +
                  ' (CAST(uuid_from_bin(TPI.createdBy) as CHAR)) as createdBy, TPI.SKU as sku, ' +
                  ' UC.categoryId as qtyUOMCategory, US.id as qtyUOMId, ? as type,' +
                  ' TPI.createdAt as createdAt, TPI.updatedAt as updatedAt  ' +
                  ' FROM ' + tableName + ' TPI LEFT JOIN ' + RefTableName + ' PR ' +
                  ' ON TPI.SKU  = PR.sku AND PR.accountId = uuid_to_bin(?) ' +
                  ' LEFT JOIN  uomNames UN ' +
                  ' INNER JOIN uomScaling US ON US.id = UN.uomScalingId ' +
                  ' AND (US.accountId = uuid_to_bin(?) OR US.accountId = uuid_to_bin(?)) ' +
                  ' AND UN.languageCultureCode = ? ON TPI.defaultUoMSymbol = UN.symbol ' +
                  ' LEFT JOIN  uomCategory UC ON TPI.defaultUoMCategory = UC.NAME ' +
                  ' AND UC.languageCultureCode = ? ' +
                  ' AND (UC.accountId = uuid_to_bin(?) OR UC.accountId = uuid_to_bin(?)) ' +
                  ' WHERE UN.symbol IS NOT NULL AND PR.sku IS NULL AND UC.name IS NOT NULL AND  TPI.defaultUoMSymbol != ? ' +
                  ' AND TPI.defaultUoMCategory != ? AND TPI.createdBy = uuid_to_bin(?) AND TPI.errorFlag = 0',
                  [Constants.PRODUCT_REFERENCE.TYPE.SIMPLE, options.accountId, options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                      options.languageCultureCode, options.accountId, Constants.DEFAULT_REFERE_ID,
                      Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.STRING, options.userId]);

                return resolve(records);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        })
    },

    /*
     *  Insert not existing records(inventory) for sku, uom and category
     * */
    insertNotExistingInventoryRecords: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var accountId = options.accountId;
                var userId = options.userId;
                var languageCultureCode = options.languageCultureCode;
                var type = options.type;

                /*
                 *  get records whose location is not exist and create location
                 * */
                var getNotExistLocationOptions = {
                    accountId: accountId,
                    userId: userId,
                    type: type
                };
                var notExistLocationResponse = await FileUpload.getNotExistLocationRecordsInventory(getNotExistLocationOptions);
                debug('notExistLocationResponse', notExistLocationResponse);
                if (notExistLocationResponse.length > 0) {
                    var insertLocation = await FileUpload.createLocationReference({locationReferences: notExistLocationResponse});
                    debug('insertLocation', insertLocation);
                }

                /*
                * get records which sku, uom, category not exist and create uom category
                * */
                var notExistCategoryRecordsOptions = {
                    accountId: accountId,
                    userId: userId,
                    languageCultureCode: languageCultureCode,
                    type: type
                };
                var notExistCategoryResponse = await FileUpload.getNotExistCategoryRecordsInventory(notExistCategoryRecordsOptions);
                debug('notExistCategoryResponse', notExistCategoryResponse);

                if (notExistCategoryResponse.length > 0) {
                    var insertUOMCategory = await FileUpload.createUoMCategory({uomCategories: notExistCategoryResponse});
                    debug('insertUOMCategory', insertUOMCategory);
                }

                /*
                * get records which sku, uom not exist and create unit of measures
                * */
                var notExistUOMRecordsOptions = {
                    accountId: accountId,
                    userId: userId,
                    languageCultureCode: languageCultureCode,
                    type: type
                };
                var notExistUOMResponse = await FileUpload.getNotExistUOMRecordsInventory(notExistUOMRecordsOptions);
                debug('notExistUOMResponse', notExistUOMResponse);

                if (notExistUOMResponse.length > 0) {
                    var insertUOM = await FileUpload.createUnitOfMeasure({unitOfMeasures: notExistUOMResponse});
                    debug('insertUOM', insertUOM);
                }

                /*
                * get records which sku not exist and create product references
                * */
                var notExistSKURecordsOptions = {
                    accountId: accountId,
                    userId: userId,
                    languageCultureCode: languageCultureCode,
                    type: type
                };
                var notExistSKUResponse = await FileUpload.getNotExistSKURecordsInventory(notExistSKURecordsOptions);
                debug('notExistSKUResponse', notExistSKUResponse);

                if (notExistSKUResponse.length > 0) {
                    if (parseInt(type) === Constants.UPLOAD_FILE_TYPE.PRODUCT_INVENTORY) {
                        var tableName = Constants.TABLE_NAME[parseInt(type)].REFERENCE
                    } else if (parseInt(type) === Constants.UPLOAD_FILE_TYPE.SUPPLY_INVENTORY) {
                        tableName = Constants.TABLE_NAME[parseInt(type)].REFERENCE
                    }
                    var insertProductReference = await FileUpload.createProductReference({
                        productReferences: notExistSKUResponse,
                        tableName: tableName
                    });
                    debug('insertProductReference', insertProductReference);
                }

                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        })
    },

    /*
     *  Get records for create uom category which  uom, category is  not exist
     * */
    getNotExistCategoryProductRecords: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var type = options.type;
                var tableName = Constants.TABLE_NAME[parseInt(type)].TEMP;
                var conn = await connection.getConnection();

                var records = await conn.query('SELECT distinct TPR.qtyUoMCategory as name, CAST(uuid_from_bin(TPR.accountId) as CHAR) as accountId, ' +
                  ' CAST(uuid_from_bin(TPR.createdBy) as CHAR) as createdBy,TPR.createdAt as createdAt,TPR.recordType as recordType FROM ' + tableName + ' TPR ' +
                  ' LEFT JOIN  uomNames UN ' +
                  ' INNER JOIN  uomCategory UC ON  UC.languageCultureCode = ?' +
                  ' AND (UC.accountId = uuid_to_bin(?) OR UC.accountId = uuid_to_bin(?))' +
                  ' INNER JOIN uomScaling US ON US.categoryId = UC.categoryId' +
                  ' AND (US.accountId = uuid_to_bin(?) OR US.accountId = uuid_to_bin(?))' +
                  ' AND UN.languageCultureCode = ?' +
                  ' ON TPR.qtyUoMId = UN.symbol AND TPR.qtyUoMCategory = UC.NAME' +
                  ' WHERE UN.symbol IS NULL AND UC.NAME IS NULL  and TPR.qtyUoMId != ? AND TPR.qtyUoMCategory != ?' +
                  ' AND TPR.createdBy = uuid_to_bin(?) AND TPR.errorFlag = 0',
                  [options.languageCultureCode, options.accountId, Constants.DEFAULT_REFERE_ID,
                      options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                      Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.STRING, options.userId]);

                return resolve(records);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        })
    },

    /*
     * Get records(products) for create unit of measure which uom is  not exist
     * */
    getNotExistUOMProductRecords: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var type = options.type;
                var tableName = Constants.TABLE_NAME[parseInt(type)].TEMP;
                var conn = await connection.getConnection();

                var records = await conn.query('SELECT distinct (CAST(uuid_from_bin(TPR.accountId) as CHAR)) as accountId, ' +
                  ' UC1.categoryId as categoryId, 1 as scalingFactor, 3 as scalingPrecision,TPR.createdAt as createdAt, ' +
                  ' (CAST(uuid_from_bin(TPR.createdBy) as CHAR)) as createdBy, TPR.qtyUoMId as symbol, TPR.qtyUoMId as name, TPR.recordType as recordType' +
                  ' FROM ' + tableName + ' TPR ' +
                  ' LEFT JOIN  uomNames UN' +
                  ' INNER JOIN  uomCategory UC ON  UC.languageCultureCode = ?' +
                  ' AND (UC.accountId = uuid_to_bin(?) OR UC.accountId = uuid_to_bin(?))' +
                  ' INNER JOIN uomScaling US ON US.categoryId = UC.categoryId' +
                  ' AND (US.accountId = uuid_to_bin(?) OR US.accountId = uuid_to_bin(?))' +
                  ' AND UN.languageCultureCode = ?' +
                  ' ON TPR.qtyUoMId = UN.symbol AND TPR.qtyUoMCategory = UC.NAME' +
                  ' LEFT JOIN  uomCategory UC1 ON TPR.qtyUoMCategory = UC1.NAME' +
                  ' AND UC1.languageCultureCode = ?' +
                  ' AND (UC1.accountId = uuid_to_bin(?) OR UC1.accountId = uuid_to_bin(?))' +
                  ' WHERE UN.symbol IS  NULL AND TPR.qtyUoMId != ? AND UC1.name IS NOT NULL AND TPR.qtyUoMCategory != ? ' +
                  ' AND TPR.createdBy = uuid_to_bin(?) AND TPR.errorFlag = 0',
                  [options.languageCultureCode, options.accountId, Constants.DEFAULT_REFERE_ID,
                      options.accountId, Constants.DEFAULT_REFERE_ID, options.languageCultureCode,
                      options.languageCultureCode, options.accountId, Constants.DEFAULT_REFERE_ID,
                      Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.STRING, options.userId]);

                return resolve(records);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        })
    },

    /*
     *  Insert not existing records(product) for  uom and category
     * */
    insertNotExistingProductRecords: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var accountId = options.accountId;
                var userId = options.userId;
                var languageCultureCode = options.languageCultureCode;
                var type = options.type;

                /*
                * get records which  uom, category not exist and create uom category
                * */
                var notExistCategoryRecordsOptions = {
                    accountId: accountId,
                    userId: userId,
                    languageCultureCode: languageCultureCode,
                    type: type
                };
                var notExistCategoryResponse = await FileUpload.getNotExistCategoryProductRecords(notExistCategoryRecordsOptions);
                debug('notExistCategoryResponse', notExistCategoryResponse);

                if (notExistCategoryResponse.length > 0) {
                    var insertUOMCategory = await FileUpload.createUoMCategory({uomCategories: notExistCategoryResponse});
                    debug('insertUOMCategory', insertUOMCategory);
                }

                /*
                * get records which  uom not exist and create unit of measures
                * */
                var notExistUOMRecordsOptions = {
                    accountId: accountId,
                    userId: userId,
                    languageCultureCode: languageCultureCode,
                    type: type
                };
                var notExistUOMResponse = await FileUpload.getNotExistUOMProductRecords(notExistUOMRecordsOptions);
                debug('notExistUOMResponse', notExistUOMResponse);

                if (notExistUOMResponse.length > 0) {
                    var insertUOM = await FileUpload.createUnitOfMeasure({unitOfMeasures: notExistUOMResponse});
                    debug('insertUOM', insertUOM);
                }

                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        })
    },

    /*
     *  Get records for create orders for order line items
     * */
    getNotExistOrderRecords: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var userId = options.userId;
                var conn = await connection.getConnection();

                var records = await conn.query('select distinct uuid() as id ,(CAST(uuid_from_bin(TOLI.accountId) as CHAR)) as accountId,' +
                  ' TOLI.amazonOrderId as amazonOrderId, MP.mpId as mpId,TOLI.createdAt as createdAt, TOLI.updatedAt as updatedAt ' +
                  ' from tempOLI TOLI, Marketplaces MP WHERE MP.isDefault =1 AND' +
                  ' TOLI.createdBy=uuid_to_bin(?) and TOLI.errorFlag = 0 and not exists ' +
                  ' (select 1 from OrderReferenceInformation ORI where TOLI.amazonOrderId = ORI.amazonOrderId and TOLI.accountId = ORI.accountId)' +
                  ' GROUP BY amazonOrderId',
                  [userId]);

                return resolve(records);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        })
    },

    /*
     *  Insert not existing orders
     * */
    insertNotExistingOrderRecords: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {

                /*
                 * get records which  order is not exist and create order
                 * */
                var NotExistOrderRecordsOptions = {
                    userId: options.userId
                };

                var notExistOrderResponse = await FileUpload.getNotExistOrderRecords(NotExistOrderRecordsOptions);
                debug('notExistOrderResponse', notExistOrderResponse);

                if (notExistOrderResponse.length > 0) {
                    var insertOrder = await FileUpload.createOrders({orders: notExistOrderResponse});
                    debug('insertOrder', insertOrder);
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        })
    },

    updateLatitudeLongitudeInLocation: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var type = options.type;
                var conn = await connection.getConnection();

                var isUpdate = await conn.query('UPDATE tempLocationReference SET ' +
                  '   latitude = case when latitude = ?  then 0' +
                  '           ELSE REPLACE(FORMAT(latitude, 16),?,?) END,' +
                  '    longitude = case when longitude = ?  then 0' +
                  '           ELSE REPLACE(FORMAT(longitude, 16),?,?) END ' +
                  ' WHERE errorFlag =0',
                  [Constants.TYPE_DEFAULT_VALUE.STRING, Constants.REFERRAL_LAST_NAME, Constants.TYPE_DEFAULT_VALUE.STRING,
                      Constants.TYPE_DEFAULT_VALUE.STRING, Constants.REFERRAL_LAST_NAME, Constants.TYPE_DEFAULT_VALUE.STRING]);

                debug('isUpdate', isUpdate);

                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        })
    },

    /*
     * Update category and uom field by id
     * */
    updateCategoryField: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var type = options.type;
                var tableName = Constants.TABLE_NAME[parseInt(type)].TEMP;
                var conn = await connection.getConnection();
                debug('options', options);

                var recordsById = await conn.query('UPDATE ' + tableName + ' TPR, uomCategory UC, uomScaling US  ' +
                  ' SET TPR.qtyUoMCategory = UC.categoryId, TPR.qtyUoMId = US.id' +
                  ' where (UC.accountId = TPR.accountId OR UC.accountId=uuid_to_bin(?)) and UC.name = TPR.qtyUoMCategory' +
                  ' and US.categoryId = UC.categoryId  ' +
                  ' and TPR.errorFlag = 0 and TPR.createdBy = uuid_to_bin(?)',
                  [Constants.DEFAULT_REFERE_ID, options.userId]);

                return resolve(recordsById);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
     * Update qty uom
     * */
    updateQtyUOM: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var type = options.type;
                var qtyUOMs = Constants.TABLE_NAME[parseInt(type)].QUANTITY_UOM;
                var qtyFlag = Constants.TABLE_NAME[parseInt(type)].QUANTITY_MANIPULATION;
                var tableName = Constants.TABLE_NAME[parseInt(type)].TEMP;
                var conn = await connection.getConnection();
                debug('options', options);
                var query = 'UPDATE ' + tableName + ' SET ';
                var values = [];

                if (!qtyFlag) {
                    return resolve(Constants.OK_MESSAGE);
                }

                var response = _.each(qtyUOMs, function (qtyUOM) {
                    query = query.concat(qtyUOM.QTY + ' = CASE WHEN ' + qtyUOM.QTY + '= ? THEN 0 ELSE ' + qtyUOM.QTY + ' END,' +
                      qtyUOM.QTY_UOM + ' = CASE WHEN ' + qtyUOM.QTY_UOM + '= ? THEN 0 ELSE ' + qtyUOM.QTY_UOM + ' END,');
                    values.push(Constants.TYPE_DEFAULT_VALUE.STRING, Constants.TYPE_DEFAULT_VALUE.STRING)

                });
                query = query.replace(/,\s*$/, ' ');
                query = query.concat(' WHERE errorFlag = 0 ;');
                debug('string', query);

                var isUpdate = await conn.query(query, values);
                debug('isUpdate', isUpdate);
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
     *  Get records for which category is not exist for uom
     * */
    getNotExistUOMCategoryRecords: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var userId = options.userId;
                var accountId = options.accountId;
                var conn = await connection.getConnection();

                var records = await conn.query('SELECT distinct TUOM.categoryName as name, CAST(uuid_from_bin(TUOM.accountId) as CHAR) as accountId, ' +
                  ' CAST(uuid_from_bin(TUOM.createdBy) as CHAR) as createdBy,TUOM.createdAt as createdAt, TUOM.recordType as recordType  ' +
                  ' FROM tempUOM TUOM' +
                  '    LEFT JOIN uomCategory UC ON TUOM.categoryName = UC.NAME ' +
                  ' AND UC.languageCultureCode = ?' +
                  ' AND (UC.accountId = uuid_to_bin(?) OR UC.accountId = uuid_to_bin(?)) ' +
                  ' WHERE UC.NAME IS NULL  AND TUOM.errorFlag =0  AND TUOM.createdBy = uuid_to_bin(?)',
                  [options.languageCultureCode, accountId, Constants.DEFAULT_REFERE_ID, userId]);

                return resolve(records);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        })
    },

    updateCategoryUOM: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var userId = options.userId;
                var accountId = options.accountId;
                var conn = await connection.getConnection();

                var records = await conn.query('UPDATE tempUOM TUOM, uomCategory UC ' +
                  ' SET TUOM.categoryName = UC.categoryId WHERE TUOM.categoryName = UC.NAME AND UC.languageCultureCode = ? AND  ' +
                  '(UC.accountId = uuid_to_bin(?) OR UC.accountId = uuid_to_bin(?)) AND TUOM.errorFlag = 0 ' +
                  'AND TUOM.createdBy=uuid_to_bin(?)',
                  [options.languageCultureCode, accountId, Constants.DEFAULT_REFERE_ID, userId]);

                return resolve(records);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        })
    },

    insertUoMScalingRecords: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var userId = options.userId;
                var accountId = options.accountId;
                var conn = await connection.getConnection();

                var records = await conn.query('INSERT INTO uomScaling ' +
                  ' (accountId,categoryId,scalingFactor,scalingPrecision,recordType,createdBy,updatedBy,createdAt,updatedAt)' +
                  ' SELECT accountId,categoryName, scalingFactor,scalingPrecision,recordType,createdBy, updatedBy, createdAt, updatedAt ' +
                  ' FROM tempUOM WHERE errorFlag=0 AND createdBy=uuid_to_bin(?) AND accountId = uuid_to_bin(?)',
                  [userId, accountId]);

                return resolve(records);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        })
    },

    insertUoMNamesRecords: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var userId = options.userId;
                var accountId = options.accountId;
                var conn = await connection.getConnection();

                var records = await conn.query('INSERT INTO uomNames ' +
                  ' (uomScalingId,languageCultureCode,name,symbol,comment,createdBy,updatedBy,createdAt,updatedAt)' +
                  ' (SELECT US.id,?,TUOM.uomName,TUOM.symbol,TUOM.COMMENT,TUOM.createdBy,TUOM.updatedBy,TUOM.createdAt,TUOM.updatedAt' +
                  ' FROM tempUOM TUOM,uomScaling US, tempUOM TUOM1  WHERE TUOM.errorFlag=0 AND' +
                  ' US.scalingFactor = TUOM1.scalingFactor AND US.scalingPrecision = TUOM1.scalingPrecision AND US.categoryId = TUOM1.categoryName' +
                  ' AND  TUOM1.errorFlag=0 AND TUOM1.id = TUOM.id AND TUOM1.createdBy=uuid_to_bin(?) AND TUOM1.accountId = uuid_to_bin(?)) ' +
                  '  UNION ALL' +
                  ' (SELECT US.id,?,TUOM.uomName,TUOM.symbol,TUOM.COMMENT,TUOM.createdBy,TUOM.updatedBy,TUOM.createdAt,TUOM.updatedAt' +
                  ' FROM tempUOM TUOM,uomScaling US, tempUOM TUOM1  WHERE TUOM.errorFlag=0 AND' +
                  ' US.scalingFactor = TUOM1.scalingFactor AND US.scalingPrecision = TUOM1.scalingPrecision AND US.categoryId = TUOM1.categoryName' +
                  ' AND  TUOM1.errorFlag=0 AND TUOM1.id = TUOM.id AND TUOM1.createdBy=uuid_to_bin(?) AND TUOM1.accountId = uuid_to_bin(?))',
                  [Constants.LANGUAGE_CULTURE_CODE.en_US, userId, accountId, Constants.LANGUAGE_CULTURE_CODE.de_DE, userId, accountId]);

                return resolve(records);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        })
    },

    insertUOMRecords: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var type = options.type;
                debug('type', type);
                /*
                 * get records which  category is not exist
                 * */
                var NotExistCategoryOptions = {
                    userId: options.userId,
                    accountId: options.accountId,
                    languageCultureCode: options.languageCultureCode
                };

                var NotExistCategoryResponse = await FileUpload.getNotExistUOMCategoryRecords(NotExistCategoryOptions);
                debug('NotExistCategoryResponse', NotExistCategoryResponse);

                if (NotExistCategoryResponse.length > 0) {
                    var insertCategory = await FileUpload.createUoMCategory({uomCategories: NotExistCategoryResponse});
                    debug('insertCategory', insertCategory);
                }

                var updateCategoryOptions = {
                    userId: options.userId,
                    accountId: options.accountId,
                    languageCultureCode: options.languageCultureCode
                };
                var updateCategoryResponse = await FileUpload.updateCategoryUOM(updateCategoryOptions);
                debug('updateCategoryResponse', updateCategoryResponse);

                var insertUOMScalingOption = {
                    userId: options.userId,
                    accountId: options.accountId
                };
                var insertUOMScalingRespose = await FileUpload.insertUoMScalingRecords(insertUOMScalingOption);
                debug('insertUOMScalingRespose', insertUOMScalingRespose);

                var insertUOMNamesOption = {
                    userId: options.userId,
                    accountId: options.accountId
                };
                var insertUOMNamesResponse = await FileUpload.insertUoMNamesRecords(insertUOMNamesOption);
                debug('insertUOMNamesResponse', insertUOMNamesResponse);


                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        })
    },

    insertLocationReferenceRecords: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var userId = options.userId;
                var accountId = options.accountId;
                var type = options.type;
                var tempTable = Constants.TABLE_NAME[parseInt(type)].TEMP;
                var defaultString = Constants.TYPE_DEFAULT_VALUE.STRING;
                var conn = await connection.getConnection();

                var records = await conn.query('INSERT INTO LocationReference (' +
                  ' accountId,locationId,locationName,phone,dialCode,phoneCountry,' +
                  ' primaryMobile,primaryMobileDialCode,primaryMobileCountry,' +
                  ' secondaryMobile,secondaryMobileDialCode,secondaryMobileCountry,' +
                  ' fax,addressLine1,addressLine2,addressLine3,zipCode,country,city,' +
                  ' state ,createdAt,updatedAt,createdBy,updatedBy)' +
                  ' SELECT TS.accountId,TS.locationId,TS.locationName,' +
                  ' CONCAT_WS(?,TS.dialCode,TS.phone) AS phone,TS.dialCode,TS.phoneCountry,' +
                  ' CONCAT_WS(?,TS.primaryMobileDialCode,TS.primaryMobile) AS primaryMobile,TS.primaryMobileDialCode,TS.primaryMobileCountry,' +
                  ' CONCAT_WS(?,TS.secondaryMobileDialCode,TS.secondaryMobile) AS secondaryMobile,TS.secondaryMobileDialCode,TS.secondaryMobileCountry,' +
                  ' TS.fax,TS.addressLine1,TS.addressLine2,TS.addressLine3,TS.zipCode,TS.country,TS.city,' +
                  ' TS.state,TS.createdAt,TS.updatedAt,TS.createdBy,TS.updatedBy FROM ' + tempTable + ' TS' +
                  ' LEFT JOIN LocationReference LR  ON TS.locationName  = LR.locationName AND TS.locationId = LR.locationId' +
                  ' AND LR.accountId = uuid_to_bin(?)' +
                  ' WHERE TS.accountId =uuid_to_Bin(?) AND TS.errorFlag =0' +
                  ' AND LR.locationId IS NULL AND LR.locationName IS NULL AND TS.locationName != ? AND TS.locationId != ? ' +
                  ' AND TS.existlocationId = ?' +
                  ' AND TS.createdBy=uuid_to_bin(?) AND TS.accountId = uuid_to_bin(?)',
                  [defaultString, defaultString, defaultString, accountId, accountId, defaultString, defaultString, defaultString,
                      userId, accountId]);

                return resolve(records);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        })
    },

    /*
     * Get column names for file by type
     * */
    getColumnNames: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var conn = await connection.getConnection();
                var columns = await conn.query('SELECT columnName  FROM Profile' +
                  ' WHERE importType = ? and columnNumber <= ? ORDER BY columnNumber ',
                  [options.type, options.numberOfColumns]);
                debug('column', columns);

                return resolve(columns);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        })
    },

    /*
     * Upload File to s3
     * */
    uploadFileToS3: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            debug('options', options);
            var fileName = options.fileName;
            var accountId = options.accountId;
            var type = Constants.CONTENT_TYPE.TEXT_CSV;
            var destination = options.destination;
            var filePath = options.filePath;


            try {
                /*
                   * read csv file
                   * */
                var data = fs.readFileSync(filePath);
                debug('file Data', data);
                var buffer = new Buffer(data, 'binary');
                /*
                   * Upload csv to s3 bucket
                   * */
                S3Utils.putObject(buffer, fileName, type, destination, Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET, '', async function (err, file) {
                    if (err) {
                        debug('err', err);
                        return reject(err);
                    }
                    debug('file=================', file);
                    /*
                       * remove file from EFS
                       * */
                    if (fs.existsSync(filePath) === true) {
                        fs.unlinkSync(filePath);
                    }
                    var storeOption = {
                        Bucket: Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET,
                        Key: destination + '/' + fileName,
                        Expires: 7 * 24 * 60 * 60
                    };

                    var url = await FileUpload.generateSignedUrl({
                        storeOption: storeOption,
                        type: 'getObject'
                    });

                    debug('url==========', {url: url});

                    return resolve({url: url});
                });

            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        })
    },

    /*
     * Generate url for get file from s3
     * */
    generateSignedUrl: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            s3.getSignedUrl(options.type, options.storeOption, async function (err, url) {
                if (err) {
                    debug('err', err);
                    err = new Error(ErrorConfig.MESSAGE.CREATE_PRE_SIGNED_URL_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
                return resolve(url);
            });
        });
    },

    /*
     *  Update url for success and fail file
     * */
    updateUrlForFileUpload: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var updatedAt = DataUtils.getEpochMSTimestamp();
                var url = options.url;
                var fileName = options.fileName;
                var queryString = '';
                var values = [];

                if (DataUtils.isDefined(options.successUrl)) {
                    debug('s12');
                    queryString += 'successUrl = ?,';
                    values.push(options.successUrl);
                }
                if (DataUtils.isDefined(options.failedUrl)) {
                    debug('f12');
                    queryString += 'failedUrl = ?,';
                    values.push(options.failedUrl);
                }
                if (DataUtils.isDefined(options.mainUrl)) {
                    debug('m12');
                    queryString += 'mainUrl = ?,';
                    values.push(options.mainUrl);
                }
                var conn = await connection.getConnection();
                var updateResponse = await conn.query('UPDATE UploadLog SET ' + queryString + ' updatedAt = ? WHERE fileName = ?',
                  values.concat(updatedAt, fileName));
                debug('updateResponse', updateResponse);

                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        })
    },

    addDataToCSVFile: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var requiredColumns = options.requiredColumns;
                var temptable = Constants.TABLE_NAME[parseInt(options.type)].TEMP;
                var filePath = options.filePath;
                var currentTime = DataUtils.getEpochMSTimestamp();
                var destination = options.destination;
                var generatedFilePath = destination + '/generated.csv';
                //var generatedFilePath = __dirname + '/' + currentTime + '_generated.csv';
                var conn = await connection.getConnection();

                var columns = '';
                var responseColumns = '';
                // get each column name to add csv file
                _.each(requiredColumns, function (columnName) {
                    columns += '\'' + columnName + '\' as ' + columnName + ',';
                    responseColumns += 'RC1.' + columnName + ',';
                });
                debug('columns', columns);
                columns = columns.replace(/,\s*$/, ' ');
                responseColumns = responseColumns.replace(/,\s*$/, ' ');
                var fileResponse = await conn.query('SELECT ' + responseColumns + ' FROM (' +
                  ' SELECT ' + columns + ' ' +
                  ' UNION ALL' +
                  ' SELECT ' + requiredColumns + ' FROM ' + temptable + ' WHERE errorFlag = ?)RC1 ' +
                  ' INTO OUTFILE \'' + destination + '/generated.csv\'' +
                  ' FIELDS TERMINATED BY \',\' OPTIONALLY ENCLOSED BY \'"\'' +
                  ' LINES TERMINATED BY \'\n\'  ;', [options.errorFlag]);
                debug('fileResponse', fileResponse);

                // append file and remove generated file
                if (fs.existsSync(generatedFilePath)) {
                    var data = fs.readFileSync(generatedFilePath);
                    debug('data', data);
                    fs.appendFileSync(filePath, data);
                    fs.unlinkSync(generatedFilePath);
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
                return reject(err);
            }
        })
    },

    /*
     * Generate csv file from temp
     * */
    generateFileFromTemp: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var fileName = options.prefixString + options.fileName.replace('.gz.txt', '');
                debug('fileName', fileName);
                var temptable = Constants.TABLE_NAME[parseInt(options.type)].TEMP;
                var destination = Constants.SCOPEHUB_EFS_PATH + path.sep + Constants.DESTINATION_FOLDER[parseInt(options.type)];
                destination = path.resolve(__dirname, destination);
                var filePath = destination + fileName;
                //var filePath = '/tmp/' + fileName;
                //var filePath = __dirname + '/' + fileName;
                var accountId = options.accountId;
                var requiredColumns = options.columns;
                var recordCount = options.recordCount;
                var conn = await connection.getConnection();

                // Re-format firstLine (column indicator)
                var firstLine = options.firstLine;
                firstLine = firstLine.split(',');
                firstLine[11] = '1';
                firstLine = firstLine.join(',').replace('"",,', '"""""",","');
                debug('firstLine===', firstLine);

                // Re-format lastLine (number of reords)
                var lastLine = options.lastLine;
                lastLine = lastLine.split(',');
                lastLine[0] = recordCount;
                lastLine = lastLine.join(',');
                debug('lastLine===', lastLine);

                // Create file and add first line
                fs.appendFileSync(filePath, firstLine);
                fs.appendFileSync(filePath, '\n');

                // to add csv data to file
                var csvDataOption = {
                    type: options.type,
                    errorFlag: options.errorFlag,
                    filePath: filePath,
                    requiredColumns: requiredColumns,
                    destination: destination
                };
                var csvDataResponse = await FileUpload.addDataToCSVFile(csvDataOption);
                debug('csvDataResponse', csvDataResponse);

                fs.appendFileSync(filePath, lastLine);

                // upload to s3
                if (options.errorFlag === 0) {
                    var destinationFolder = accountId + '/' + Constants.S3_FOLDER.UPLOAD_SUCCESS;
                }
                if (options.errorFlag === 1) {
                    destinationFolder = accountId + '/' + Constants.S3_FOLDER.UPLOAD_FAIL;
                }
                var uploadFileOptions = {
                    fileName: fileName,
                    filePath: filePath,
                    destination: destinationFolder
                };
                var uploadFileResponse = await FileUpload.uploadFileToS3(uploadFileOptions);
                debug('uploadFileResponse', uploadFileResponse);
                var url = uploadFileResponse.url;

                /*var storeOption = {
                Bucket: Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET,
                Key: destination + '/' + fileName,
                Expires: 7 * 24 * 60 * 60
            };

            var url = await FileUpload.generateSignedUrl({
                storeOption: storeOption,
                type: 'getObject'
            });

            debug('url==========', url);*/

                return resolve({url: url});
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        })
    },

    /*
     * Generate success files from temp table
     * */
    generateSuccessFiles: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var type = options.type;
                var accountId = options.accountId;
                var uploadLogId = options.uploadLogId;
                var numberOfColumns = options.numberOfColumns;

                var columnNameOptions = {
                    type: type,
                    numberOfColumns: numberOfColumns
                };
                var columnNamesResponse = await FileUpload.getColumnNames(columnNameOptions);
                columnNamesResponse = _.map(columnNamesResponse, 'columnName');
                debug('columnNamesResponse', columnNamesResponse);
                //var columns = columnNamesResponse.columnNames;
                var generateFileOptions = {
                    type: type,
                    fileName: options.fileName,
                    columns: columnNamesResponse,
                    errorFlag: 0,
                    prefixString: 'success_',
                    accountId: accountId,
                    firstLine: options.firstLine,
                    lastLine: options.lastLine,
                    recordCount: options.recordCount
                };
                var generateFileResponse = await FileUpload.generateFileFromTemp(generateFileOptions);
                debug('generateFileResponse', generateFileResponse);

                return resolve(generateFileResponse);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        })
    },

    /*
     * Generate failed files from temp table
     * */
    generateFailedFiles: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var type = options.type;
                var accountId = options.accountId;
                var numberOfColumns = options.numberOfColumns;
                var columnValue = ['errorDescription'];

                var columnNameOptions = {
                    type: type,
                    numberOfColumns: numberOfColumns
                };
                var columnNamesResponse = await FileUpload.getColumnNames(columnNameOptions);
                columnNamesResponse = _.map(columnNamesResponse, 'columnName');
                debug('columnNamesResponse', columnNamesResponse);
                columnNamesResponse = columnValue.concat(columnNamesResponse);
                debug('columnNamesResponse', columnNamesResponse);

                var generateFileOptions = {
                    type: type,
                    fileName: options.fileName,
                    columns: columnNamesResponse,
                    errorFlag: 1,
                    prefixString: 'fail_',
                    accountId: accountId,
                    firstLine: options.firstLine,
                    lastLine: options.lastLine,
                    recordCount: options.recordCount
                };
                var generateFileResponse = await FileUpload.generateFileFromTemp(generateFileOptions);
                debug('generateFileResponse', generateFileResponse);

                return resolve(generateFileResponse);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        })
    },

    /*
     * Find success and fail count
     * */
    getCountByErrorFlag: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var type = options.type;
                var tempTable = Constants.TABLE_NAME[parseInt(type)].TEMP;
                var conn = await connection.getConnection();
                var successCount = 0, failCount = 0;
                var response = await conn.query('SELECT errorFlag ,COUNT(errorFlag) AS count' +
                  ' FROM ' + tempTable + '  WHERE accountId = uuid_To_bin(?) and createdBy = uuid_to_bin(?) ' +
                  ' GROUP BY errorFlag', [options.accountId, options.userId]);

                debug('count============', response);
                var successIndex = response.findIndex(value => value.errorFlag === 0);
                var failIndex = response.findIndex(value => value.errorFlag === 1);

                if (successIndex !== -1) {
                    successCount = response[successIndex].count;
                }
                if (failIndex !== -1) {
                    failCount = response[failIndex].count;
                }

                var countResponse = {
                    successCount: successCount,
                    failCount: failCount
                };
                debug('countResponse', countResponse);
                return resolve(countResponse);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        })
    },

    logicalValidationOnTempMD: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var type = options.type;
            var userId = options.userId;
            var numberOfColumns = options.numberOfColumns;
            var accountId = options.accountId;
            var version = options.version;
            var languageCultureCode = options.languageCultureCode;
            var uploadLogId = options.uploadLogId;
            var partialImportIndicator = options.partialImportIndicator;
            var mainUrl = options.mainUrl;
            var isError = false;
            var validateAmountUOMResponse;
            var err;
            try {
                debug('1');
                if (parseInt(type) === Constants.UPLOAD_FILE_TYPE.PRODUCT || parseInt(type) === Constants.UPLOAD_FILE_TYPE.SUPPLY_ITEM) {
                    // Validate amount and uom fields (allow only if both exist or both are not exist , Give error if any one of them is missing)

                    debug('inside validateAmountUOM');
                    var validateAmountUOMOption = {
                        type: type,
                        version: version,
                        accountId: accountId,
                        userId: userId,
                        uploadLogId: uploadLogId
                    };
                    validateAmountUOMResponse = await FileUpload.validateAmountUOMMD(validateAmountUOMOption);
                    /*if (validateAmountUOMResponse) {
                    err = validateAmountUOMResponse;
                    throw err;
                }*/
                }
                debug('2');

                // VALIDATION FOR NON_NUMERIC AMOUNT VALUE
                var validateAmountOptions = {
                    type: type,
                    version: version,
                    accountId: accountId,
                    userId: userId,
                    numberOfColumns: numberOfColumns,
                    fieldNumber: Constants.TABLE_NAME[parseInt(type)].AMOUNT_FIELDS,
                    uploadLogId: uploadLogId
                };
                debug('above validateAmountFieldsMD');
                var validateAmountResponse = await FileUpload.validateAmountFieldsMD(validateAmountOptions);
                /* if (validateAmountResponse) {
                 err = validateAmountResponse;
                 throw err;
             }*/
                debug('11');

                // NEED CHANGE HERE
                //Remove record who create error
                var invalidRecordOptions = {
                    type: type,
                    uploadLogId: uploadLogId,
                    accountId: accountId,
                    userId: userId,
                    languageCultureCode: languageCultureCode
                };
                var invalidRecordResponse = await FileUpload.getInvalidRecords(invalidRecordOptions);
                debug('invalidRecordResponse', invalidRecordResponse);
                debug('3');

                //throw err;

                if (invalidRecordResponse) {
                    debug('inside invalidRecordResponse');
                }
                // VALIDATION FOR UOM IS EXIST OR NOT
                /*var UoMOption = {
                type: type,
                languageCultureCode: languageCultureCode,
                userId: userId,
                accountId: accountId,
                version: version,
                numberOfColumns: numberOfColumns,
                uploadLogId: uploadLogId,
                fieldNumber: Constants.TABLE_NAME[parseInt(type)].UOM_FIELDS
            };
            var UoMValidationResponse = await FileUpload.validateUoMFields(UoMOption);
            if (UoMValidationResponse) {
                err = UoMValidationResponse;
                throw err;
            }
            debug('4');
*/

                var countOptions = {type: type, accountId: accountId, userId: userId};
                var countResponse = await FileUpload.getCountByErrorFlag(countOptions);
                debug('countResponse', countResponse);
                var generateFilesOptions = {
                    type: type,
                    fileName: options.fileName,
                    accountId: accountId,
                    uploadLogId: uploadLogId,
                    numberOfColumns: numberOfColumns,
                    firstLine: options.firstLine,
                    lastLine: options.lastLine
                };
                if ((invalidRecordResponse || validateAmountResponse || validateAmountUOMResponse) && !partialImportIndicator) {
                    debug('inside  a if - indicator');
                    /*generateFilesOptions.recordCount = countResponse.failCount;
                    var generateFailFilesResponse = await FileUpload.generateFailedFiles(generateFilesOptions);
                    debug('generateFailFilesResponse', generateFailFilesResponse);
                    var failedUrl = generateFailFilesResponse.url;
                    var updateUrlOptions = {
                        successUrl: '',
                        failedUrl: failedUrl || '',
                        mainUrl: mainUrl || '',
                        fileName: options.fileName
                    };
                    var updateUrl = await FileUpload.updateUrlForFileUpload(updateUrlOptions);
                    debug('updateUrl', updateUrl);*/
                    err = validateAmountResponse || invalidRecordResponse || validateAmountUOMResponse;
                    throw err;
                }

                // Generate success records file
                /*if (countResponse.successCount !== 0) {
                    generateFilesOptions.recordCount = countResponse.successCount;
                    var generateSuccessFilesResponse = await FileUpload.generateSuccessFiles(generateFilesOptions);
                    debug('generateSuccessFilesResponse', generateSuccessFilesResponse);
                    var successUrl = generateSuccessFilesResponse.url;
                }

                // Genearte failed records failes
                if (countResponse.failCount !== 0) {
                    generateFilesOptions.recordCount = countResponse.failCount;
                    generateFailFilesResponse = await FileUpload.generateFailedFiles(generateFilesOptions);
                    debug('generateFailFilesResponse', generateFailFilesResponse);
                    failedUrl = generateFailFilesResponse.url;
                }

                // update the records

                updateUrlOptions = {
                    successUrl: successUrl || '',
                    failedUrl: failedUrl || '',
                    mainUrl: mainUrl || '',
                    fileName: options.fileName
                };
                updateUrl = await FileUpload.updateUrlForFileUpload(updateUrlOptions);
                debug('updateUrl', updateUrl);*/
                /*
                   * Insert not existing valid records for product inventory and supply inventory
                   * */
                if (parseInt(type) === Constants.UPLOAD_FILE_TYPE.PRODUCT_INVENTORY || parseInt(type) === Constants.UPLOAD_FILE_TYPE.SUPPLY_INVENTORY) {

                    var insertRecordOptions = {
                        accountId: accountId,
                        userId: userId,
                        languageCultureCode: languageCultureCode,
                        type: type
                    };
                    var insertRecordResponse = await FileUpload.insertNotExistingInventoryRecords(insertRecordOptions);
                    debug('insertRecordResponse', insertRecordResponse);
                }

                /*
                   * Insert not existing valid records for products and supply items
                   * */

                if (parseInt(type) === Constants.UPLOAD_FILE_TYPE.PRODUCT || parseInt(type) === Constants.UPLOAD_FILE_TYPE.SUPPLY_ITEM) {

                    insertRecordOptions = {
                        accountId: accountId,
                        userId: userId,
                        languageCultureCode: languageCultureCode,
                        type: type
                    };
                    insertRecordResponse = await FileUpload.insertNotExistingProductRecords(insertRecordOptions);
                    debug('insertRecordResponse', insertRecordResponse);

                    var updateCategoryOptions = {
                        type: type,
                        userId: userId,
                    };

                    var updateCategoryResponse = await FileUpload.updateCategoryField(updateCategoryOptions);
                    debug('updateCategoryResponse', updateCategoryResponse);

                }

                /*
                   * Insert not existing valid records for orders
                   * */
                if (parseInt(type) === Constants.UPLOAD_FILE_TYPE.OLI) {

                    insertRecordOptions = {
                        accountId: accountId,
                        userId: userId,
                        languageCultureCode: languageCultureCode,
                        type: type
                    };
                    insertRecordResponse = await FileUpload.insertNotExistingOrderRecords(insertRecordOptions);
                    debug('insertRecordResponse', insertRecordResponse);
                }

                if (parseInt(type) === Constants.UPLOAD_FILE_TYPE.LOCATION_REFERENCE) {

                    var updateLocationReferenceOptions = {
                        type: type
                    };
                    var updateLocationReferenceResponse = await FileUpload.updateLatitudeLongitudeInLocation(updateLocationReferenceOptions);
                    debug('updateLocationReferenceResponse', updateLocationReferenceResponse);

                }

                if (parseInt(type) === Constants.UPLOAD_FILE_TYPE.UNIT_OF_MEASURE) {

                    var insertUOMOptions = {
                        accountId: accountId,
                        userId: userId,
                        languageCultureCode: languageCultureCode,
                        type: type
                    };
                    var insertUOMResponse = await FileUpload.insertUOMRecords(insertUOMOptions);
                    debug('insertUOMResponse', insertUOMResponse);

                }

                if (parseInt(type) === Constants.UPLOAD_FILE_TYPE.SUPPLIER || parseInt(type) === Constants.UPLOAD_FILE_TYPE.CUSTOMER) {

                    var insertLocationRecords = {
                        accountId: accountId,
                        userId: userId,
                        languageCultureCode: languageCultureCode,
                        type: type
                    };
                    var insertLocationResponse = await FileUpload.insertLocationReferenceRecords(insertLocationRecords);
                    debug('insertLocationResponse', insertLocationResponse);
                }

                // Perform queries for validation

                // var validationResponse = await FileUpload.executeValidationMD(options);

                /*if (validationResponse) {
                err = validationResponse;
                throw err;
            }*/
                debug('234');

                // Update temp table
                var updateOption = {
                    type: type,
                    userId: userId
                };
                var updateResponse = await FileUpload.updateTempTableMD(updateOption);
                debug('345');

                // UPDATE AMOUNT FIELDS
                var updateAmountOptions = {
                    type: type,
                    version: version,
                    accountId: accountId,
                    userId: userId,
                    numberOfColumns: numberOfColumns,
                    fieldNumber: Constants.TABLE_NAME[parseInt(type)].AMOUNT_FIELDS
                };
                var updateAmountResponse = await FileUpload.updateAmountFields(updateAmountOptions);
                debug('456');

                // UPDATE UNIT OF MEASURES WITH SCALING_ID
                var updateUoMOption = {
                    type: type,
                    languageCultureCode: languageCultureCode,
                    userId: userId,
                    accountId: accountId,
                    numberOfColumns: numberOfColumns,
                    version: version,
                    fieldNumber: Constants.TABLE_NAME[parseInt(type)].UOM_FIELDS
                };
                var updateUoMResponse = await FileUpload.updateUoMFields(updateUoMOption);

                // UPDATE QTY FIELDS AS PER PRECISION OF UOM
                var updateQuantityOption = {
                    type: type,
                    languageCultureCode: languageCultureCode,
                    userId: userId,
                    accountId: accountId,
                    version: version,
                    numberOfColumns: numberOfColumns,
                    fieldNumber: Constants.TABLE_NAME[parseInt(type)].AMOUNT_FIELDS
                };
                var updateQuantityResponse = await FileUpload.updateQuantityFields(updateQuantityOption);
                debug('updateQuantityResponse', updateQuantityResponse);

                // UPDATE empty value with default (0)
                var updateQtyUOMOption = {
                    type: type
                };
                var updateQtyUOMResponse = await FileUpload.updateQtyUOM(updateQtyUOMOption);
                debug('updateQtyUOMResponse', updateQtyUOMResponse);

                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    copyTempToOriginalTable: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var type = options.type;
            var userId = options.userId;
            var accountId = options.accountId;
            var query = Constants.TABLE_NAME[parseInt(type)].FINAL_QUERY;
            var tempTable = Constants.TABLE_NAME[parseInt(type)].TEMP;
            var defaultString = Constants.TYPE_DEFAULT_VALUE.STRING;
            var values = [accountId, userId], err;
            var stringValues = [];

            if (parseInt(type) === Constants.UPLOAD_FILE_TYPE.LOCATION_REFERENCE) {
                stringValues = stringValues.concat([defaultString, defaultString, defaultString]).concat(values);
                values = stringValues;
            }
            if (parseInt(type) === Constants.UPLOAD_FILE_TYPE.SUPPLIER || type === Constants.UPLOAD_FILE_TYPE.CUSTOMER) {
                stringValues = stringValues.concat([defaultString, defaultString, defaultString, defaultString, defaultString, defaultString,
                    defaultString, defaultString, defaultString, defaultString, defaultString, defaultString, defaultString, defaultString, defaultString,
                    defaultString, defaultString, defaultString, defaultString, defaultString]).concat(values).concat([defaultString, defaultString,
                    defaultString, defaultString, defaultString, defaultString, defaultString, defaultString, defaultString, defaultString,
                    defaultString, defaultString, defaultString, defaultString, defaultString, defaultString, defaultString, defaultString, defaultString]
                  .concat(values).concat([defaultString, defaultString, defaultString, defaultString, defaultString, defaultString]).concat(values));
                values = stringValues;
            }
            if (DataUtils.isUndefined(query)) {
                return resolve(Constants.OK_MESSAGE);
            }
            try {
                var conn = await connection.getConnection();
                var insertionCount = await conn.query('SELECT count(*) as count FROM ' + tempTable + ' WHERE accountId = uuid_to_bin(?) ' +
                  'AND createdBy = uuid_to_bin(?) AND errorFlag =0 ', [accountId, userId]);
                insertionCount = Utils.filteredResponsePool(insertionCount);

                if (parseInt(insertionCount.count) === 0) {
                    debug('count', count);
                    return resolve(Constants.OK_MESSAGE);
                }

                var copyResponse = await conn.query(query, values);
                copyResponse = Utils.isAffectedPool(copyResponse);
                if (!copyResponse) {
                    err = new Error(ErrorConfig.MESSAGE.COPY_DATA_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    err.uploadStatus = Constants.UPLOAD_STATUS.COPY_TEMP_DATA_TO_ORIGINAL_FAIL;
                    err.statusReasonCode = Constants.UPLOAD_STATUS_REASON_CODES.COPY_DATA_FAIL.CODE;
                    debug('err', err);
                    return reject(err);
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err 543', err);
                return reject(err);
            }
        });
    },

    getValues: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var type = options.type;
            var userId = options.userId;
            var accountId = options.accountId;
            var createdAt = DataUtils.getEpochMSTimestamp();
            var values = [];

            if (parseInt(type) === Constants.UPLOAD_FILE_TYPE.ORI) {
                values.push(accountId, userId, accountId, userId);
            } else if (parseInt(type) === Constants.UPLOAD_FILE_TYPE.OLI) {
                values.push(userId);
            } else if (parseInt(type) === Constants.UPLOAD_FILE_TYPE.PRODUCT) {
            } else if (parseInt(type) === Constants.UPLOAD_FILE_TYPE.PRODUCT_INVENTORY) {
            } else if (parseInt(type) === Constants.UPLOAD_FILE_TYPE.SUPPLY_ITEM) {
            } else if (parseInt(type) === Constants.UPLOAD_FILE_TYPE.SUPPLY_INVENTORY) {
            }
            return resolve(values);
        });
    },

    additionOperationMD: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var type = options.type;
            var additionalQuery = Constants.TABLE_NAME[parseInt(type)].ADDITIONAL_OPERATION;
            var values = await FileUpload.getValues(options);
            var err, error;

            try {
                var conn = await connection.getConnection();
                await PromiseBluebird.each(additionalQuery, async function (query) {
                    var response = await conn.query(query.QUERY, values);
                    response = Utils.isAffectedPool(response);
                    debug('response', response);
                });
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    getPartialImportIndicator: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var firstLine = options.firstLine;
            var partialImportIndicator;
            var firstLineValues = firstLine.split(',');
            partialImportIndicator = parseInt(firstLineValues[10]);
            return resolve(partialImportIndicator);
        });
    },

    getColumnNameIndicator: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var firstLine = options.firstLine;
            var columnNameIndicator;
            var firstLineValues = firstLine.split(',');
            columnNameIndicator = parseInt(firstLineValues[11]);
            return resolve(columnNameIndicator);
        });
    },

    loadFile: async function (options, errorOptions, cb) {
        debug('Inside API');
        var uploadLog = options.uploadLog;
        var accountId = uploadLog.accountId;
        var userId = uploadLog.userId;
        var fileName = uploadLog.fileName;
        var firstLine = uploadLog.firstLine;
        var lastLine = uploadLog.lastLine;
        var type = uploadLog.type;
        var uploadLogId = uploadLog.id;
        var numberOfColumns = parseInt(uploadLog.numberOfColumns);
        var error, isMoved, uploadLogOptions;
        var removeOption, removeResponse, updateResponse, errorOption;
        var catchOption, user, version, privateKey, partialImportIndicator, columnNameIndicator;


        try {
            /*
               *  GET USER BY ID
               * */
            user = await FileUpload.getUserById(userId);
            debug('user', user);

            /*
               * Get partial Import Indicator
               * */
            partialImportIndicator = await FileUpload.getPartialImportIndicator({firstLine: firstLine});
            debug('partialImportIndicator', partialImportIndicator);
            if (!partialImportIndicator) {
                debug('inside', partialImportIndicator);
            }

            // Get column name indicator
            columnNameIndicator = await FileUpload.getColumnNameIndicator({firstLine: firstLine});
            debug('columnNameIndicator', columnNameIndicator);

            //return cb();

            /*
               * Get Version By accountId
               * */
            var account = await FileUpload.getVersionByAccountId(accountId);
            version = account.version;
            privateKey = account.privateKey;
            debug('version', version);

            var parts = await FileUpload.getUploadPart({fileName: fileName});
            debug('parts', parts);

            /*
              * DECOMPRESS A FILE
              * */
            //Decompress the .gz file and update uploadLog
            var deCompressOption = {
                fileName: fileName,
                type: type,
                userId: userId,
                accountId: accountId,
                uploadLog: uploadLog,
                parts: parts,
                privateKey: privateKey,
                isMultipart: uploadLog.isMultipart,
                numberOfColumns: numberOfColumns,
                columnNameIndicator: columnNameIndicator
            };
            debug('deCompressOption', deCompressOption);
            var deCompressResponse = await FileUpload.deCryptAndDeCompressFile(deCompressOption);
            debug('deCompressResponse', deCompressResponse);
            var newFileName = deCompressResponse.newFileName;
            var mainUrl = deCompressResponse.mainUrl;

            debug('==========', mainUrl);

            // Update uploadLog after decrypt is done
            uploadLogOptions = {
                userId: userId,
                accountId: accountId,
                fileName: fileName,
                status: Constants.UPLOAD_STATUS.DECRYPT_SUCESS,
                stepCompleted: Constants.UPLOAD_COMPLETED_STEPS.STEP_4
            };
            updateResponse = await FileUpload.updateUploadLogMD(uploadLogOptions);

            /*
                * STEP 2 : LOAD FILE FROM S3 BUCKET TO TEMP TABLE
                * */
            var loadOptions = {
                fileName: fileName.replace('.gz.txt', ''),
                isMultipart: uploadLog.isMultipart,
                parts: parts,
                type: type,
                accountId: accountId,
                userId: userId,
                version: version,
                numberOfColumns: numberOfColumns,
                columnNameIndicator: columnNameIndicator
            };
            debug('Inside step 2', loadOptions);
            var loadResponse = await FileUpload.loadFileIntoTemp(loadOptions);
            debug('loadResponse ', loadResponse);

            // Update UplaodLog table after validation step 2 is completed
            uploadLogOptions = {
                userId: userId,
                accountId: accountId,
                fileName: fileName,
                status: Constants.UPLOAD_STATUS.LOAD_TO_TEMP_SUCCESS,
                stepCompleted: Constants.UPLOAD_COMPLETED_STEPS.STEP_5
            };
            updateResponse = await FileUpload.updateUploadLogMD(uploadLogOptions);
            //throw err;

            /*
               * STEP 3 : DO LOGICAL VALIDATION ON TEMP TABLE
               * */
            // perform logical validation
            var logicalValidationOptions = {
                fileName: fileName,
                uploadLogId: uploadLogId,
                createdAt: DataUtils.getEpochMSTimestamp(),
                type: type,
                accountId: accountId,
                userId: userId,
                numberOfColumns: numberOfColumns,
                version: version || 1,//checkResponse.version || 1,
                languageCultureCode: user.languageCultureCode,//checkResponse.languageCultureCode || 'en-US'
                partialImportIndicator: partialImportIndicator,
                mainUrl: mainUrl,
                firstLine: firstLine,
                lastLine: lastLine
            };
            var validationResponse = await FileUpload.logicalValidationOnTempMD(logicalValidationOptions);
            debug('validationResponse ', validationResponse);

            // Update UplaodLog table after validation step 2 is completed
            uploadLogOptions = {
                userId: userId,
                accountId: accountId,
                fileName: fileName,
                status: Constants.UPLOAD_STATUS.LOGICAL_VALIDATION_SUCCESS,
                stepCompleted: Constants.UPLOAD_COMPLETED_STEPS.STEP_6
            };
            updateResponse = await FileUpload.updateUploadLogMD(uploadLogOptions);


            /*
               * STEP 4 : COPY RECORD OF TEMP TABLE INTO ORIGINAL TABLE
               * */
            debug('Insdie step 4');
            // Copy data from temp to original table
            var copyOption = {
                type: type,
                accountId: accountId,
                userId: userId
            };
            var copyResponse = await FileUpload.copyTempToOriginalTable(copyOption);
            debug('In step 4 copyResponse', copyResponse);

            /*
            * If
            * Check for Real_time product order and dependent demand outshare , if found then share this data
            * */
            if (type === 2) {
                var checkRealTimeOutShareOption = {
                    accountId: accountId,
                    userId: userId
                }
                var checkRealTimeOutShareResponse = await FileUpload.checkRealTimeOutShare(checkRealTimeOutShareOption)
                debug('checkRealTimeOutShareResponse', checkRealTimeOutShareResponse)
            }


            /*
            * Perform additional operation as per file type
            * */
            var option = {
                type: type,
                accountId: accountId,
                userId: userId
            };
            var additionQueryResponse = await FileUpload.additionOperationMD(option);

            // Update UplaodLog table after validation step 2 is completed
            uploadLogOptions = {
                userId: userId,
                accountId: accountId,
                fileName: fileName,
                status: Constants.UPLOAD_STATUS.COPY_TEMP_DATA_TO_ORIGINAL_SUCCESS,
                stepCompleted: Constants.UPLOAD_COMPLETED_STEPS.STEP_7,
                endTime: DataUtils.getEpochMSTimestamp()

            };
            updateResponse = await FileUpload.updateUploadLogMD(uploadLogOptions);


            // Extraa Operation like remove clean temp table and move file to success folder
            /*
             * REMOVE RECORD FROM TEMP TABLE
             * */
            removeOption = {
                type: type,
                accountId: accountId,
                userId: userId
            };
            removeResponse = await FileUpload.removeTempTableData(removeOption);
            /*
               * SEND NOTIFICATION TO THE USER
               * */
            var date = new Date();
            var notificationExpirationDate = date.setDate(date.getDate() + Constants.INVITATION_EXPIRATION_DATE_LIMIT);
            notificationExpirationDate = new Date(notificationExpirationDate);

            var notificationOption = {
                refereId: Constants.DEFAULT_REFERE_ID,
                user_ids: [userId],
                topic_id: userId,
                refereType: Constants.NOTIFICATION_REFERE_TYPE.UPLOAD_FILE,
                notification_reference: NotificationReferenceData.FILE_UPLOAD_SUCCESS,
                notificationExpirationDate: notificationExpirationDate,
                paramasDateTime: new Date(),
                paramsInviter: user.email + ', ' +
                  (user.firstName ? user.firstName : '') + ' ' +
                  (user.lastName ? user.lastName : ''),
                paramsInvitee: user.email + ', ' +
                  (user.firstName ? user.firstName : '') + ' ' +
                  (user.lastName ? user.lastName : ''),
                metaEmail: 'scopehub@gmail.com',
                languageCultureCode: user.languageCultureCode,
                createdBy: userId,
                type: Constants.DEFAULT_NOTIFICATION_TYPE
            };
            debug('notificationOption', notificationOption);
            await NotificationApi.createMD(notificationOption);

            /*
               * Move file to success folder
               * */
            var moveToSuccessOption = {
                bucket: Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET + '/' + accountId + '/' + Constants.S3_FOLDER.ARRIVAL_FILES,
                fileName: fileName,
                destination: accountId + '/' + Constants.S3_FOLDER.PROCESSED_CSV_FILES
            };
            isMoved = await FileUpload.moveFileMD(moveToSuccessOption);
            debug('isMoved', isMoved);
            if (!isMoved) {
                error = new Error(ErrorConfig.MESSAGE.MOVE_FILE_FAILED);
                error.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(error);
            }

            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err', err);
            try {
                catchOption = {
                    user: user,
                    userId: userId,
                    accountId: accountId,
                    type: type,
                    fileName: fileName,
                    newFileName: fileName.replace('.gz.txt', ''),
                    isLoad: true,
                    err: err
                };
                err = await FileUpload.fileUploadCatch(catchOption);
                return cb(err);
            } catch (err) {
                return cb(err);
            }
        }
    },

    /*
    * Get valid records from the tempOLI table for checking realtime outshare
    * */
    getOrderLineItems: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var err;
            var accountId = options.accountId;
            var userId = options.userId;
            var allItems;
            try {
                var conn = await connection.getConnection();
                allItems = await conn.query('select CAST(uuid_from_bin(productRefId) as CHAR) as productRefId, ' +
                  'CAST(uuid_from_bin(orderRefId) as CHAR) as orderRefId from tempOLI where accountId = uuid_to_bin(?) and ' +
                  'createdBy = uuid_to_bin(?) and errorFlag = 0;', [accountId, userId]);
                if (!allItems) {
                    allItems = [];
                }
                return resolve(allItems);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.GET_ITEM_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR
                return reject(err);
            }
        })
    },

    /*
    * Check RealTime Outshare
    * */
    checkRealTimeOutShare: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var accountId = options.accountId;
            var userId = options.userId;
            var arrayWithProductWiseOrder = [];
            var err;

            try {
                /*
                * Get all order line items
                * */
                var getOrderLineItemsOptions = {
                    accountId: accountId,
                    userId: userId
                }
                var allOrderLineItems = await FileUpload.getOrderLineItems(getOrderLineItemsOptions);

                /*
                * Convert object by the productRefId
                * */
                var groupByItemArray = _.groupBy(allOrderLineItems, 'productRefId');
                debug('groupByItemArray', groupByItemArray);
                _.map(groupByItemArray, function (value, key) {
                    debug('key', key);
                    debug('value', value);
                    var object = {
                        productRefId: key,
                        orderRefIds: _.map(value, 'orderRefId')
                    };
                    arrayWithProductWiseOrder.push(object);
                });
                debug('arrayWithProductWiseOrder', arrayWithProductWiseOrder);


                /*
                * Check RealTime outshare and call the api
                * */
                if (arrayWithProductWiseOrder > 0) {
                    var checkRealTimeShareOption = {
                        accountId: accountId,
                        allOrderLineItems: arrayWithProductWiseOrder,
                        frequencyType: Constants.OUT_SHARE_FREQ_TYPE.REAL_TIME
                    };
                    debug('checkRealTimeShareOption', checkRealTimeShareOption);
                    var realTimeOutProductOrderShares = await OrderReferenceInformationApi.checkForRealTimeProductOrderShare(checkRealTimeShareOption);
                    var realTimeOutDependentDemandShares = await OrderReferenceInformationApi.checkForRealTimeDependentDemandShare(checkRealTimeShareOption);
                    var realTimeOutShares = [].concat(realTimeOutProductOrderShares).concat(realTimeOutDependentDemandShares);
                    //var realTimeOutShares = [].concat(realTimeOutDependentDemandShares);

                    if (realTimeOutShares && realTimeOutShares.length > 0) {
                        debug('realTimeOutShares after', realTimeOutShares);

                        var shareOptions = {
                            realTimeOutShares: realTimeOutShares
                        };
                        var apiResponse = OrderReferenceInformationApi.buildTask(shareOptions);
                        debug('API COMPLTETED', apiResponse);
                    }
                }
                return resolve(Constants.OK_MESSAGE)
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        })
    },

    /*
     * Insert uom scaling record
     * */
    insertUoMScaling: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var isUoMInserted;
            var unitOfMeasure = options.unitOfMeasure;
            try {
                var conn = await connection.getConnection();
                isUoMInserted = await conn.query('insert into uomScaling (accountId,categoryId, scalingPrecision, ' +
                  'scalingFactor,recordType, createdAt, updatedAt, createdBy) values(uuid_to_bin(?),?,?,?,?,?,uuid_to_bin(?)) ',
                  [unitOfMeasure.accountId, unitOfMeasure.categoryId, unitOfMeasure.scalingPrecision, unitOfMeasure.scalingFactor,
                      unitOfMeasure.recordType, unitOfMeasure.createdAt, unitOfMeasure.createdAt, unitOfMeasure.createdBy]);
                isUoMInserted = Utils.isAffectedPool(isUoMInserted);
                debug('isUoMInserted', isUoMInserted);
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
     * Insert uom Names record
     * */
    insertUoMNames: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var err;
            var unitOfMeasure = options.unitOfMeasure;
            var insertedId = options.insertedId;
            try {
                var uomNamesQuery = 'insert into uomNames' +
                  '(uomScalingId, name, languageCultureCode, symbol, comment, createdAt,updatedAt, createdBy) ' +
                  ' values(?,?,?,?,?,?,?,uuid_to_bin(?)),' +
                  ' (?,?,?,?,?,?,?,uuid_to_bin(?))';

                var uomNameBindParams = [insertedId, unitOfMeasure.name, Constants.LANGUAGE_CULTURE_CODE.en_US, unitOfMeasure.symbol,
                    Constants.TYPE_DEFAULT_VALUE.STRING, unitOfMeasure.createdAt, unitOfMeasure.createdAt, unitOfMeasure.createdBy,
                    insertedId, unitOfMeasure.name, Constants.LANGUAGE_CULTURE_CODE.de_DE, unitOfMeasure.symbol,
                    Constants.TYPE_DEFAULT_VALUE.STRING, unitOfMeasure.createdAt, unitOfMeasure.createdAt, unitOfMeasure.createdBy];
                var conn = await connection.getConnection();
                var createUomNames = await conn.query(uomNamesQuery, uomNameBindParams);
                var affectedRows = Utils.getAffectedRowsPool(createUomNames);

                if (affectedRows !== 2) {
                    err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CREATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
     * Insert Unit of measure Name/uomscaling record both
     * */
    createUnitOfMeasure: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var unitOfMeasures = options.unitOfMeasures;
            var err;
            var categoryId;

            try {
                var conn = await connection.getConnection();
                await conn.query('START TRANSACTION;');
            } catch (err) {
                debug('err', err);
                return reject(err);
            }

            try {
                await PromiseBluebird.each(unitOfMeasures, async function (unitOfMeasure) {

                    //CREATE UOM SCALING RECORD
                    var uomScalingOption = {
                        unitOfMeasure: unitOfMeasure
                    };
                    var uomResponse = await FileUpload.insertUoMScaling(uomScalingOption);

                    debug('uomResponse=======', uomResponse);
                    var getInsertedId = await conn.query('select LAST_INSERT_ID() as id');
                    var insertedId = Utils.filteredResponsePool(getInsertedId).id;

                    if (!insertedId) {
                        err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CREATE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                        throw err;
                    }

                    debug('insertedId', insertedId);

                    //Insert record into uomNames record
                    var uomNamesOption = {
                        unitOfMeasure: unitOfMeasure,
                        insertedId: insertedId
                    };
                    var uomNamesResponse = await FileUpload.insertUoMNames(uomNamesOption);
                    debug('uomNamesResponse=======', uomNamesResponse);
                });
                await conn.query('COMMIT');
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err ', err);
                await conn.query('ROLLBACK');
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CREATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
     * Insert UOM Category
     * */
    createUoMCategory: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var uomCategories = options.uomCategories;
            var convertedOrderList, keys, err;
            var categoryId;
            var allUoMCategories = [];

            try {
                var conn = await connection.getConnection();

                var maxCategory = await conn.query('select max(categoryId) as maxCategoryId from uomCategory');
                maxCategory = Utils.filteredResponsePool(maxCategory);
                categoryId = parseInt(maxCategory.maxCategoryId);


                _.map(uomCategories, function (uomCategory) {
                    categoryId = categoryId + 1;
                    allUoMCategories.push({
                        accountId: uomCategory.accountId,
                        createdBy: uomCategory.createdBy,
                        categoryId: categoryId,
                        languageCultureCode: Constants.LANGUAGE_CULTURE_CODE.en_US,
                        name: uomCategory.name,
                        recordType: uomCategory.recordType,
                        createdAt: uomCategory.createdAt,
                        updatedAt: uomCategory.createdAt
                    }, {
                        accountId: uomCategory.accountId,
                        createdBy: uomCategory.createdBy,
                        categoryId: categoryId,
                        languageCultureCode: Constants.LANGUAGE_CULTURE_CODE.de_DE,
                        name: uomCategory.name,
                        recordType: uomCategory.recordType,
                        createdAt: uomCategory.createdAt,
                        updatedAt: uomCategory.createdAt
                    });
                });

                await Utils.convertObjectToArrayMD(allUoMCategories, async function (err, response) {
                    if (err) {
                        debug('err', err);
                        return reject(err);
                    }
                    convertedOrderList = response.list;
                    keys = response.keys;

                    var query = 'insert into uomCategory (' + keys + ') values';

                    var values = ' (uuid_to_bin(?), uuid_to_bin(?),?,?,?,?,?,?) ';

                    await PromiseBluebird.each(allUoMCategories, function (value) {
                        query = query + values;
                        query = query + ',';
                    });

                    query = query.replace(/,\s*$/, '');

                    var uomCategoryInserted = await conn.query(query, convertedOrderList);
                    uomCategoryInserted = Utils.isAffectedPool(uomCategoryInserted);
                    debug('uomCategoryInserted-----------------------------------------', uomCategoryInserted);
                    if (!uomCategoryInserted) {
                        throw err;
                    }
                    return resolve(Constants.OK_MESSAGE);
                });
            } catch (err) {
                debug('err ', err);
                err = new Error(ErrorConfig.MESSAGE.UNIT_OF_MEASURE_CATEGORY_CREATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
     * Insert Product Reference
     * */
    createProductReference: function (options) {
        return new Promise(async function (resolve, reject) {
            var productReferences = options.productReferences;
            var accountId = options.accountId;
            var convertedOrderList, keys, err;
            var currentTime = DataUtils.getEpochMSTimestamp();

            await Utils.convertObjectToArrayMD(productReferences, async function (err, response) {
                if (err) {
                    debug('err', err);
                    return reject(err);
                }
                convertedOrderList = response.list;
                keys = response.keys;

                var query = 'insert into ' + options.tableName + ' (' + keys + ') values';

                var values = ' (uuid_to_bin(?), uuid_to_bin(?),uuid_to_bin(?),?,?,?,?,?,?) ';

                await PromiseBluebird.each(productReferences, function (value) {
                    query = query + values;
                    query = query + ',';
                });

                query = query.replace(/,\s*$/, '');

                try {
                    var conn = await connection.getConnection();
                    var productReferenceInserted = await conn.query(query, convertedOrderList);
                    productReferenceInserted = Utils.isAffectedPool(productReferenceInserted);
                    debug('productReferenceInserted-----------------------------------------', productReferenceInserted);
                    if (!productReferenceInserted) {
                        throw err;
                    }
                    return resolve(Constants.OK_MESSAGE);
                } catch (err) {
                    debug('err ', err);
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_CREATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
            });
        });
    },

    /*
     * Insert Location Reference
     * */
    createLocationReference: function (options) {
        return new Promise(async function (resolve, reject) {
            var locationReferences = options.locationReferences;
            var convertedOrderList, keys, err;

            debug('locationReference===============', locationReferences);

            await Utils.convertObjectToArrayMD(locationReferences, async function (err, response) {
                if (err) {
                    debug('err', err);
                    return reject(err);
                }
                convertedOrderList = response.list;
                keys = response.keys;

                var query = 'insert into LocationReference (' + keys + ') values';

                var values = ' (uuid_to_bin(?), uuid_to_bin(?),?,?,?,?) ';

                await PromiseBluebird.each(locationReferences, function (value) {
                    query = query + values;
                    query = query + ',';
                });

                query = query.replace(/,\s*$/, '');

                try {
                    var conn = await connection.getConnection();
                    var locationReferenceInserted = await conn.query(query, convertedOrderList);
                    locationReferenceInserted = Utils.isAffectedPool(locationReferenceInserted);
                    debug('locationReferenceInserted-----------------------------------------', locationReferenceInserted);
                    if (!locationReferenceInserted) {
                        throw err;
                    }
                    return resolve(Constants.OK_MESSAGE);
                } catch (err) {
                    debug('err ', err);
                    err = new Error(ErrorConfig.MESSAGE.LOCATION_CREATION_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
            });
        });
    },

    /*
     *  Insert Orders
     * */
    createOrders: function (options) {
        return new Promise(async function (resolve, reject) {
            var orders = options.orders;
            var convertedOrderList, keys, err;

            debug('orders===============', orders);

            await Utils.convertObjectToArrayMD(orders, async function (err, response) {
                if (err) {
                    debug('err', err);
                    return reject(err);
                }
                convertedOrderList = response.list;
                keys = response.keys;

                var query = 'insert into OrderReferenceInformation (' + keys + ') values';

                //var values = ' (uuid_to_bin(?),?, ?,uuid_to_bin(?),?,?) ';
                var values = ' (uuid_to_bin(?),uuid_to_bin(?),?,?,?,?) ';

                await PromiseBluebird.each(orders, function (value) {
                    query = query + values;
                    query = query + ',';
                });

                query = query.replace(/,\s*$/, '');

                try {
                    var conn = await connection.getConnection();
                    var orderInserted = await conn.query(query, convertedOrderList);
                    orderInserted = Utils.isAffectedPool(orderInserted);
                    debug('orderInserted-----------------------------------------', orderInserted);
                    if (!orderInserted) {
                        throw err;
                    }
                    return resolve(Constants.OK_MESSAGE);
                } catch (err) {
                    debug('err ', err);
                    err = new Error(ErrorConfig.MESSAGE.ORDER_CREATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
            });
        });
    },

    getUploadLogToLoad: function () {
        return new PromiseBluebird(async function (resolve, reject) {
            var status = Constants.UPLOAD_STATUS.COPY_SUCCESS;
            try {
                var conn = await connection.getConnection();
                var uploadLogs = await conn.query('select id,CAST(uuid_from_bin(userId) as CHAR) as userId,' +
                  'CAST(uuid_from_bin(accountId) as CHAR) as accountId,fileName,fileSize,status,startTime,endTime,' +
                  'type,status,stepCompleted,numberOfColumns,isMultipart,IVKey,decryptionKey,firstLine,lastLine from UploadLog where status = ?;', [status]);
                //uploadLogs = Utils.filteredResponsePool(uploadLogs);
                return resolve(uploadLogs);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.UPLOAD_LOG_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    }
};

module.exports = FileUpload;
