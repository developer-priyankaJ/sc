/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.api.databaseSwitch');
var _ = require('lodash');
var PromiseBluebird = require('bluebird');
var mysqldump = require('mysqldump');
var mysqlImport = require('mysql-import');
var fs = require('fs');
var Request = require('request-promise');
var {execSync} = require('child_process');

var connection = require('../lib/connection_util');
var Utils = require('../lib/utils');
var DataUtils = require('../lib/data_utils');
var ErrorUtils = require('../lib/error_utils');
var Constants = require('../data/constants');
var ErrorConfig = require('../data/error');
var {CONNECTION_POOL} = require('../config/mariadb');

var DatabaseSwitch = {

    changeDB: async function (options, errorOptions, cb) {
        var userId = options.userId;
        var database = options.database;
        var isDefault = options.isDefault;
        var err;

        try {
            var conn = await connection.getConnection();
            if (isDefault) {
                response = CONNECTION_POOL;
            } else {
                var query = 'select `host`,`user`,`password`,`port`,`database`,`connectionLimit`,`permitLocalInfile`,' +
                  '`connectTimeout`,`compress`,`interactiveClient` from SystemDatabases where userId = uuid_to_bin(?) and ' +
                  '`database`=?;';
                var response = await conn.query(query, [userId, database]);
                response = Utils.filteredResponsePool(response);
                debug('response', response);
            }
            /*
            * Change the poolBE
            * */
            var conne = await connection.changePoolBE(response);
            debug('conne', conne);

            return cb(null, {conn: conne});
        } catch (err) {
            debug('err ', err);
            err = new Error(ErrorConfig.MESSAGE.DATABASE_SWITCH_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    getDumpData: function () {
        return new Promise(function (resolve, reject) {
            var currentTime = DataUtils.getEpochMSTimestamp();
            var destination = Constants.DB_SCRIPT_DESTIANATION;
            var fileNamesWithoutPath = [
                currentTime + '_' + 'schemaOnly.sql',
                currentTime + '_' + 'referenceTableWithData.sql',
                currentTime + '_' + 'referenceTableWithConditionalData.sql',
                currentTime + '_' + 'sampleUsers.sql'
            ];
            var dumpObjects = [
                // Only schema creation
                {
                    dump: {
                        tables: ['knex_migrations', 'knex_migrations_lock'],
                        excludeTables: true,
                        data: false // for schema only
                    },
                    dumpToFile: destination + '/' + currentTime + '_' + 'schemaOnly.sql'
                },
                // Specific table with data
                {
                    dump: {
                        tables: Constants.REFERENCE_TABLES,
                        schema: false,
                        data: {
                            maxRowsPerInsertStatement: 50
                        }
                    },
                    dumpToFile: destination + '/' + currentTime + '_' + 'referenceTableWithData.sql'
                },
                // Specific table with conditional data
                {
                    dump: {
                        tables: Constants.CONDITIONAL_REFERENCE_TABLE,
                        schema: false,
                        data: {
                            maxRowsPerInsertStatement: 50,
                            where: {
                                ['BillingRates']: 'accountId = uuid_to_bin(\'' + Constants.DEFAULT_REFERE_ID + '\')',
                                ['uomCategory']: 'accountId = uuid_to_bin(\'' + Constants.DEFAULT_REFERE_ID + '\')',
                                ['uomScaling']: 'accountId = uuid_to_bin(\'' + Constants.DEFAULT_REFERE_ID + '\')',
                                ['uomNames']: 'uomScalingId IN (SELECT id FROM uomScaling WHERE accountId = uuid_to_bin(\'' + Constants.DEFAULT_REFERE_ID + '\'))',
                                ['Views']: 'accountId = uuid_to_bin(\'' + Constants.DEFAULT_REFERE_ID + '\')',
                                ['ViewColumns']: 'viewId IN (SELECT id FROM Views WHERE userId = uuid_to_bin(\'' + Constants.DEFAULT_REFERE_ID + '\') AND accountId = uuid_to_bin(\'' + Constants.DEFAULT_REFERE_ID + '\'))'
                            }
                        }
                    },
                    dumpToFile: destination + '/' + currentTime + '_' + 'referenceTableWithConditionalData.sql'
                },

                //Sample users
                {
                    dump: {
                        tables: Constants.USER_RELATED_TABLE,
                        schema: false,
                        data: {
                            maxRowsPerInsertStatement: 50,
                            where: {
                                ['users']: 'email IN (' + Constants.SAMPLE_USERS + ')',
                                ['accounts']: 'id IN (select accountId from users where email in (' + Constants.SAMPLE_USERS + '))',
                                ['user_roles']: 'userId IN (select id from users where email in (' + Constants.SAMPLE_USERS + '))',
                                ['userPreferences']: 'userId IN (select id from users where email in (' + Constants.SAMPLE_USERS + '))',
                                ['AccountPlans']: 'accountId IN (select accountId from users where email in (' + Constants.SAMPLE_USERS + '))'
                            }
                        }
                    },
                    dumpToFile: destination + '/' + currentTime + '_' + 'sampleUsers.sql'
                }
            ];
            return resolve({
                fileNamesWithoutPath: fileNamesWithoutPath,
                dumpObjects: dumpObjects
            });
        });
    },

    createScript: async function (options, errorOptions, cb) {
        var userId = options.userId;
        var databaseName = options.databaseName;
        var destination = Constants.DB_SCRIPT_DESTIANATION;
        var err;

        try {
            debug('before the dumping');
            var response = await DatabaseSwitch.getDumpData();
            var dumpData = response.dumpObjects;
            var fileNamesWithoutPath = response.fileNamesWithoutPath;
            var count = 0;
            var fileNames = [];
            await PromiseBluebird.each(dumpData, async function (dumpObject) {
                const result = await mysqldump({
                    connection: {
                        host: CONNECTION_POOL.host,
                        user: CONNECTION_POOL.user,
                        password: CONNECTION_POOL.password,
                        database: CONNECTION_POOL.database
                    },
                    dump: dumpObject.dump,
                    dumpToFile: dumpObject.dumpToFile
                });
                fileNames.push(dumpObject.dumpToFile);
                debug('complete========', count++, dumpObject.dumpToFile);
            });
            fileNames.push(destination + '/' + Constants.DB_FUNCTION_CREATE_FILE);
            fileNamesWithoutPath.push(Constants.DB_FUNCTION_CREATE_FILE);
            return cb(null, {fileNames: fileNames, fileNamesWithoutPath: fileNamesWithoutPath});
        } catch (err) {
            debug('err ', err);
            err = new Error(ErrorConfig.MESSAGE.DATABASE_SCRIPT_GENERATE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    createDatabase: async function (options, errorOptions, cb) {
        var userId = options.userId;
        var databaseName = options.databaseName;
        var fileNames = options.fileNames;
        var err;

        try {
            var conn = await connection.getConnection();
            debug('databaseName', databaseName);
            var response = await conn.query('CREATE DATABASE IF NOT EXISTS ' + databaseName + ' ');
            debug('response', response);
            response = Utils.isAffectedPool(response);
            debug('response', response);
            if (!response) {
                debug('err ', err);
                err = new Error(ErrorConfig.MESSAGE.DATABASE_ALREADY_EXIST);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            debug('DATABASE CREATE SUCCESS================>');
            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err ', err);

            try {
                /*
               * Remove DB and script if exist
               * */
                response = await DatabaseSwitch.removeFileAndDatabase({
                    databaseName: databaseName,
                    fileNames: fileNames
                });
                debug('response', response);
            } catch (err) {
                debug('err', err);
                return cb(err);
            }

            err = new Error(ErrorConfig.MESSAGE.DATABASE_CREATE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    createSystemDatabaseRecord: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var userId = options.userId;
            var databaseName = options.databaseName;
            var defaultSetting = Constants.DEFAULT_CONNECTION_SETTING;
            var currentTime = DataUtils.getEpochMSTimestamp();
            var err;

            try {
                var dbCred = connection.getDatabaseCredential();
                var conn = await connection.getConnection();
                var insertResponse = await conn.query('insert into SystemDatabases (`userId`,`host`,`user`,`password`,`port`,`database`,`connectionLimit`,' +
                  '`permitLocalInfile`,`connectTimeout`,`compress`,`interactiveClient`,`isDefault`,`createdAt`,`updatedAt`,`createdBy`) values ' +
                  '(uuid_to_bin(?),?,?,?,?,?,?,?,?,?,?,?,?,?,uuid_to_bin(?))', [userId, dbCred.host, dbCred.user, dbCred.password,
                    dbCred.port, databaseName, defaultSetting.CONNECTION_LIMIT, defaultSetting.PERMIT_LOCAL_INFILE,
                    defaultSetting.CONNECT_TIMEOUT, defaultSetting.COMPRESS, defaultSetting.INTERACTIVE_CLIENT, 0,
                    currentTime, currentTime, userId]);
                insertResponse = Utils.isAffectedPool(insertResponse);
                if (!insertResponse) {
                    throw err;
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.SYSTEM_DATABASE_INSERT_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    removeSystemDatabaseRecord: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var userId = options.userId;
            var databaseName = options.databaseName;
            var err;

            try {
                if (databaseName === Constants.SCOPEHUB_DEFAULT_DB && userId === Constants.DEFAULT_REFERE_ID) {
                    return resolve(Constants.OK_MESSAGE);
                }
                var conn = await connection.getConnection();
                var deleteResponse = await conn.query('' +
                  ' If exists (select 1 from SystemDatabases where userId = uuid_to_bin(?) and databaseName = ?) THEN ' +
                  ' delete from SystemDatabases where userId = uuid_to_bin(?) and databaseName = ?; END IF; ',
                  [userId, databaseName, userId, databaseName]);
                deleteResponse = Utils.isAffectedPool(deleteResponse);
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.SYSTEM_DATABASE_DELETE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    removeDatabaseRecord: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var userId = options.userId;
            var databaseName = options.databaseName;
            var currentDatabase = '';
            var flag = false;
            var DBResponse;
            var err;
            try {
                //get current cred to switch back
                var oldDBCredential = connection.getDatabaseCredential();

                var conn = await connection.getConnection();
                var response = await conn.query('select database() as `database`;');
                response = Utils.filteredResponsePool(response);
                debug('currentDatabase', response);
                if (response) {
                    currentDatabase = response.database;
                }

                /*
                * If current connection is not default then change to default
                * */
                if (currentDatabase !== Constants.SCOPEHUB_DEFAULT_DB) {
                    /*
                    * Change the poolBE
                    * */
                    DBResponse = await connection.changePoolBE(CONNECTION_POOL);
                    debug('poolBE after', DBResponse);
                    flag = true;
                }

                /*
                * Rempve record from SystemDatabases table of main record
                * */
                var removeDatabaseOption = {
                    userId: userId,
                    databaseName: databaseName
                };
                var removeDatabaseResponse = await DatabaseSwitch.removeSystemDatabaseRecord(removeDatabaseOption);
                debug('removeDatabaseResponse', removeDatabaseResponse);

                /*
                * Switch back to original DB ,
                * */
                if (flag) {
                    debug('Inside if (flag) {}');
                    DBResponse = await connection.changePoolBE(oldDBCredential);
                    debug('poolBE after', DBResponse);
                }
                return resolve(null, Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    insertDatabaseRecord: async function (options, errorOptions, cb) {
        var userId = options.userId;
        var databaseName = options.databaseName;
        var fileNames = options.fileNames;
        var currentDatabase = '';
        var flag = false;
        var DBResponse, removeResponse;
        var err;
        try {
            //get current cred to switch back
            var oldDBCredential = connection.getDatabaseCredential();

            var conn = await connection.getConnection();
            var response = await conn.query('select database() as `database`;');
            response = Utils.filteredResponsePool(response);
            debug('currentDatabase', response);
            if (response) {
                currentDatabase = response.database;
            }

            /*
            * If current connection is not default then change to default 
            * */
            if (currentDatabase !== Constants.SCOPEHUB_DEFAULT_DB) {
                /*
                * Change the poolBE
                * */
                DBResponse = await connection.changePoolBE(CONNECTION_POOL);
                debug('poolBE after', DBResponse);
                flag = true;
            }

            /*
            * Insert record into SystemDatabases table of main record
            * */
            var insertDatabaseOption = {
                userId: userId,
                databaseName: databaseName
            };
            var insertDatabaseResponse = await DatabaseSwitch.createSystemDatabaseRecord(insertDatabaseOption);
            debug('insertDatabaseResponse', insertDatabaseResponse);

            /*
            * Switch back to original DB ,
            * */
            if (flag) {
                debug('Inside if (flag) {}');
                DBResponse = await connection.changePoolBE(oldDBCredential);
                debug('poolBE after', DBResponse);
            }
            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err', err);
            try {
                /*
                * Remove DB and script if exist
                * */
                response = await DatabaseSwitch.removeFileAndDatabase({
                    databaseName: databaseName,
                    fileNames: fileNames
                });
                debug('response', response);

                /*
                * Remove systemDatabase record
                * */
                removeResponse = await DatabaseSwitch.removeDatabaseRecord({
                    userId: userId,
                    databaseName: databaseName
                });
                return cb(err);
            } catch (err) {
                debug('err', err);
                return cb(err);
            }
        }
    },

    loadScript: async function (options, errorOptions, cb) {
        var fileNames = options.fileNames;
        var databaseName = options.databaseName;
        var fileNamesWithoutPath = options.fileNamesWithoutPath;
        var removeResponse;
        var path = require('path');
        var databaseScriptFile = path.resolve(__dirname, '../config/script/DB_Import_Script.sh');
        var err;

        try {
            debug('databaseScriptFile', databaseScriptFile);

            var commandString = '/bin/bash ' + databaseScriptFile + ' ' + databaseName + ' ';
            _.map(fileNamesWithoutPath, function (fileName) {
                commandString += fileName + ' ';
            });
            debug('commandString', commandString);
            var response = execSync(commandString);
            debug('response', response);

            // remove last script because its script for generate function , its a common for all
            fileNames.splice(-1, 1);
            debug('fileNames after ====', fileNames);
            return cb(null, {
                fileNames: fileNames
            });
        } catch (err) {
            debug('err ', err);

            try {
                /*
                * Remove DB and script if exist
                * */
                response = await DatabaseSwitch.removeFileAndDatabase({
                    databaseName: databaseName,
                    fileNames: fileNames
                });
                debug('response', response);

                /*
                * Remove systemDatabase record
                * */
                removeResponse = await DatabaseSwitch.removeDatabaseRecord({
                    userId: userId,
                    databaseName: databaseName
                });

                err = new Error(ErrorConfig.MESSAGE.DATABASE_SCRIPT_LOAD_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            } catch (err) {
                debug('err', err);
                return cb(err);
            }
        }
    },

    deleteScriptFiles: async function (options, errorOptions, cb) {
        var fileNames = options.fileNames;
        var err;
        try {
            var count = 0;
            debug('fileNames', fileNames);
            await PromiseBluebird.each(fileNames, async function (fileName) {
                if (fs.existsSync(fileName) === true) {
                    fs.unlinkSync(fileName);
                }
            });
            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err ', err);
            err = new Error(ErrorConfig.MESSAGE.DATABASE_SCRIPT_LOAD_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    removeFileAndDatabase: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var databaseName = options.databaseName;
            var fileNames = options.fileNames;
            var err;
            try {
                var conn = await connection.getConnection();
                debug('databaseName', databaseName);
                var response = await conn.query('DROP DATABASE IF NOT EXISTS ' + databaseName + ' ');
                debug('response', response);
                response = Utils.isAffectedPool(response);
                debug('response', response);
                if (!response) {
                    throw err;
                }

                /*
                * Remove script files from mnt folder
                * */
                if (fileNames) {
                    await PromiseBluebird.each(fileNames, async function (fileName) {
                        if (fs.existsSync(fileName) === true) {
                            fs.unlinkSync(fileName);
                        }
                    });
                }

                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.DATABASE_DELETE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    function1: async function (options, cb) {
        debug('Inside function1');
        var domain = 'http://localhost:3000';
        var url = domain + '/api/database/switch';
        var option = {
            userId: "fd7f3113-475d-4149-9a08-fd4cfc6fb8af",
            database: "test_DB",
            isDefault: 1,
            apiToken: 'xlK6cQsQRkvKdhIYH9n15yuzIhaLuiug'
        };
        var opt = {
            url: url,
            method: 'PATCH',
            json: true,
            form: option
        };

        try {
            await Request(opt, async function (err, response, body) {
                if (err || response.statusCode >= 400) {
                    err = err || new Error(ErrorConfig.MESSAGE.HTTP_REQUEST_FAILED);
                    err.status = err.status || ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                    //return cb2();
                }
                debug('Final body ', response);
                debug('====== COMPLETE ============',);
                //await connection.closeConnectionCronJob();
                return cb(null, body);
            });
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
    },

    function2: async function (options, cb) {
        debug('Inside function1');
        var domain = 'http://localhost:3000';
        var url = domain + '/api/database/switch';
        var option = {
            userId: "fd7f3113-475d-4149-9a08-fd4cfc6fb8af",
            database: "test_DB",
            isDefault: 0,
            apiToken: 'xlK6cQsQRkvKdhIYH9n15yuzIhaLuiug'
        };
        var opt = {
            url: url,
            method: 'PATCH',
            json: true,
            form: option
        };

        try {
            await Request(opt, async function (err, response, body) {
                if (err || response.statusCode >= 400) {
                    err = err || new Error(ErrorConfig.MESSAGE.HTTP_REQUEST_FAILED);
                    err.status = err.status || ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                    //return cb2();
                }
                //debug('Final body ', body);
                debug('====== COMPLETE ============',);
                //await connection.closeConnectionCronJob();
                return cb(null, Constants.OK_MESSAGE);
            });
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
    },

    function3: async function (options, cb) {
        debug('Inside function3');
        var conn = options.conn;
        var db = options.db;
        var email = 'nitin.restful@gmail.com';

        try {
            debug('conn', conn);
            var query = 'select * from users where email = ? ;';
            var response = await conn.query(query, [email]);
            response = Utils.filteredResponsePool(response);
            debug('response', response);
            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
    },

    getDatabase: async function (options, errorOptions, cb) {
        debug('Inside function2');
        try {
            var conn = await connection.getConnection();

            var response = await conn.query('select CAST(uuid_from_bin(userId) as CHAR) as userId,`database`,isDefault from SystemDatabases;');
            if (!response) {
                response = [];
            }
            // debug('currentDatabase', response);
            return cb(null, response);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.DATABASE_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    getDatabaseByUser: async function (options, errorOptions, cb) {
        debug('Inside function2');
        var userId = options.userId;
        try {
            var conn = await connection.getConnection();

            var response = await conn.query('select CAST(uuid_from_bin(userId) as CHAR) as userId,`database`,isDefault ' +
              ' from SystemDatabases where userId = uuid_to_bin(?) or userId = uuid_to_bin(?);', [userId, Constants.DEFAULT_REFERE_ID]);
            if (!response) {
                response = [];
            }
            // debug('currentDatabase', response);
            return cb(null, response);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.DATABASE_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    }
};

module.exports = DatabaseSwitch;