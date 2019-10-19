/*
'use strict';
var {CONNECTION} = require('./config/mariadb');
//var moment = require('moment');
//var mariasql = require('mariasql');
var mariadb = require('mariadb');
//var mysql2 = require('mysql2');

module.exports = {
    client: 'mariadb',
    connection: {

        /!*host: 'localhost',
        user: 'root',
        password: 'root',
        port: '3306',
        db: 'ScopehubAppDB',*!/

        host: CONNECTION.HOST,
        user: CONNECTION.USER,
        password: CONNECTION.PASSWORD,
        port: CONNECTION.PORT,
        db: CONNECTION.DB,

        multipleStatements: true,
        local_infile: true
    },
    acquireConnectionTimeout: 120000,
    pool: {
        afterCreate: function (conn, done) {
            conn.query('SET div_precision_increment=16', function () {
                done(null, conn);
            });
        }
    }
};*/
