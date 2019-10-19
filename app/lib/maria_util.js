#!/usr/bin/env node
'use strict';

var Util = require('util');
var mariadb = require('mariadb');

var {CONNECTION_POOL_ADMIN} = require('../config/mariadb');
var {CONNECTION_POOL} = require('../config/mariadb');
console.log('=========================');
var poolBE, poolAdmin, pool;

poolBE = mariadb.createPool(CONNECTION_POOL);
poolAdmin = mariadb.createPool(CONNECTION_POOL_ADMIN);
Util.log('Pool active connections', poolBE.activeConnections());
Util.log('Pool total connections', poolBE.totalConnections());
Util.log('Pool idle connections', poolBE.idleConnections());
pool = {
    poolBE: poolBE,
    poolAdmin: poolAdmin
};
module.exports = pool;



