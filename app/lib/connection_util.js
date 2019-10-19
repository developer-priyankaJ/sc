#!/usr/bin/env node
'use strict';

var pool = require('./maria_util');
var mariadb = require('mariadb');
//var pool = maria_util.getConnection();
var Util = require('util');
var utils = require('./utils');
var _ = require('lodash');
var debug = require('debug')('scopehub.util.connection_util');
var ErrorConfig = require('../data/error');
var {CONNECTION_POOL} = require('../config/mariadb');
var poolBE = pool.poolBE;
var poolAdmin = pool.poolAdmin;

var connection = {};
var connectionAdmin = {};
var databaseCredential = CONNECTION_POOL;
var fakeDatabaseCredential;

exports.changePoolBE = function (response) {
    return new Promise(async function (resolve, reject) {
        try {
            console.log('=========================');
            //await poolBE.end();
            databaseCredential = response;
            poolBE = mariadb.createPool(response);
            connection = await poolBE.getConnection();
            debug('CONNECTION CREATED');
            return resolve(connection);
        } catch (err) {
            debug('err', err);
            return reject(err);
        }
    });
};

exports.getDatabaseCredential = function () {
    return databaseCredential;
};

exports.setFakeDatabaseCredential = function (value) {
    fakeDatabaseCredential = value;
    return;
};

exports.getFakeDatabaseCredential = function (value) {
    return fakeDatabaseCredential;
};

// Get connections for cron job
exports.startConnectionCronJob = async function () {
    return new Promise(async function (resolve, reject) {
        try {
            Util.log('startConnectionCronJob');
            Util.log('start active connections', poolBE.activeConnections());
            Util.log('start total connections', poolBE.totalConnections());
            Util.log('start idle connections', poolBE.idleConnections());
            Util.log('start taskQueueSize connections', poolBE.taskQueueSize());
            connection = await poolBE.getConnection();
            return resolve();
        } catch (err) {
            debug('err ', err);
            err = new Error(ErrorConfig.MESSAGE.SERVER_IS_BUSY_PLEASE_TRY_AGAIN_LATER);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return reject(err);
        }
    });
};

// Get connections when apis execution start
exports.startConnection = async function (req, res, next) {
    if (req.method === 'OPTIONS') {
        Util.log('Return from method Option');
        return next();
    }
    try {
        Util.log('startConnection');
        Util.log('start active connections', poolBE.activeConnections());
        Util.log('start total connections', poolBE.totalConnections());
        Util.log('start idle connections', poolBE.idleConnections());
        Util.log('start taskQueueSize connections', poolBE.taskQueueSize());
        connection = await poolBE.getConnection();
        return next();
    } catch (err) {
        Util.log('Inside startConnection err', err);
        debug('err ', err);
        err = new Error(ErrorConfig.MESSAGE.SERVER_IS_BUSY_PLEASE_TRY_AGAIN_LATER);
        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
        return next(err);
    }
};

//Close the Connection after api execution complete
exports.closeConnection = async function (req, res, next) {
    try {
        await connection.end();
        Util.log('end active connections', poolBE.activeConnections());
        Util.log('end total connections', poolBE.totalConnections());
        Util.log('end idle connections', poolBE.idleConnections());
        return next();
    } catch (err) {
        Util.log('Inside closeConnection err', err);
        debug('err ', err);
        err = new Error(ErrorConfig.MESSAGE.SERVER_IS_BUSY_PLEASE_TRY_AGAIN_LATER);
        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
        return next(err);
    }
};

//Close the Connection after cron job execution complete
exports.closeConnectionCronJob = async function () {
    return new Promise(async function (resolve, reject) {
        try {
            if (connection.isValid()) {
                await connection.end();
            }
            Util.log('close end active connections', poolBE.activeConnections());
            Util.log('close total connections', poolBE.totalConnections());
            Util.log('close idle connections', poolBE.idleConnections());
            Util.log('close taskQueueSize connections', poolBE.taskQueueSize());
            return resolve();
        } catch (err) {
            debug('err ', err);
            err = new Error(ErrorConfig.MESSAGE.SERVER_IS_BUSY_PLEASE_TRY_AGAIN_LATER);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return reject(err);
        }
    });
};

// use connection in query which is already have, while api execution started
exports.getConnection = function () {
    return new Promise(async function (resolve, reject) {
        try {
            //debug('inside getConnection');
            if (connection.isValid()) {
            } else {
                debug('Inside else');
                connection = await poolBE.getConnection();
            }
            debug('return from here');
            return resolve(connection);
        } catch (err) {
            Util.log('Inside getConnection err', err);
            debug('err', err);
            return reject(err);
        }
    });
};

// Get connections of scopehub BE when apis execution start
exports.startConnectionAdmin = async function (req, res, next) {
    return new Promise(async function (resolve, reject) {
        try {
            Util.log('admin start active connections', poolAdmin.activeConnections());
            Util.log('admin start total connections', poolAdmin.totalConnections());
            Util.log('admin start idle connections', poolAdmin.idleConnections());
            Util.log('admin start taskQueueSize connections', poolAdmin.taskQueueSize());
            connectionAdmin = await poolAdmin.getConnection();
            return resolve(connectionAdmin);
        } catch (err) {
            Util.log('Inside startConnection err', err);
            debug('err ', err);
            err = new Error(ErrorConfig.MESSAGE.ADMIN_SERVER_IS_BUSY_PLEASE_TRY_AGAIN_LATER);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return reject(err);
        }
    });
};

//Close the Connection of scopehub BE after api execution complete
exports.closeConnectionAdmin = async function (req, res, next) {
    return new Promise(async function (resolve, reject) {
        try {
            //Util.log('end connection api', req.url);
            debug('connection closed here');
            if (connectionAdmin.isValid()) {
                await connectionAdmin.end();
            }
            return resolve();
        } catch (err) {
            Util.log('Inside closeConnection err', err);
            debug('err ', err);
            err = new Error(ErrorConfig.MESSAGE.ADMIN_SERVER_IS_BUSY_PLEASE_TRY_AGAIN_LATER);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return reject(err);
        }
    });
};
// use connection in query which is already have, while api execution started
exports.getConnectionAdmin = function () {
    return new Promise(async function (resolve, reject) {
        try {
            debug('inside getConnection');
            if (connectionAdmin.isValid()) {
                debug('Inside if');
            } else {
                debug('Inside else');
                connectionAdmin = await poolAdmin.getConnection();
            }
            return resolve(connectionAdmin);
        } catch (err) {
            Util.log('Inside getConnection err', err);
            debug('err', err);
            return reject(err);
        }
    });
};

//Set global variables
exports.init = async function () {
    try {
        connection = await poolBE.getConnection();

        if (connection.isValid()) {
            //await connection.query('SET GLOBAL div_precision_increment=16', null, {metadata: false});
            //await connection.query('SET GLOBAL local_infile=1;', null, {metadata: false});
            //await connection.query('SET GLOBAL wait_timeout=420;', null, {metadata: false});
            await utils.wait(0.05);
            debug('connection end');
            connection.end();
        }
    } catch (error) {
        debug('error ', error);
    }
};

exports.poolBE = poolBE;