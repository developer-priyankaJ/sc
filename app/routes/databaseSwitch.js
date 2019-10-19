#!/usr/bin/env node

'use strict';

var debug = require('debug')('scopehub.route.databaseSwitch');
var DatabaseSwitchApi = require('../api/databaseSwitch');
var HeaderUtils = require('../lib/header_utils');

var DatabaseSwitch = {

    changeDB: function (req, res, next) {
        var options = {
            userId: req.body.userId,
            database: req.body.database,
            isDefault: req.body.isDefault
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        DatabaseSwitchApi.changeDB(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            debug('typeof', typeof response.conn);
            req.session.conn = response.conn;
            debug('HERE', req.session.conn);
            next();
        });
    },

    createScript: function (req, res, next) {
        var options = {
            userId: req.user.id,
            databaseName: req.body.databaseName
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        DatabaseSwitchApi.createScript(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = {OK: 'OK'};
            req.fileNames = response.fileNames;
            req.fileNamesWithoutPath = response.fileNamesWithoutPath;
            next();
        });
    },

    createDatabase: function (req, res, next) {
        var options = {
            userId: req.user.id,
            databaseName: req.body.databaseName,
            fileNames: req.fileNames
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        DatabaseSwitchApi.createDatabase(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    insertDatabaseRecord: function (req, res, next) {
        var options = {
            userId: req.user.id,
            databaseName: req.body.databaseName,
            fileNames: req.fileNames
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        DatabaseSwitchApi.insertDatabaseRecord(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    loadScript: function (req, res, next) {
        var options = {
            userId: req.user.id,
            fileNames: req.fileNames,
            fileNamesWithoutPath: req.fileNamesWithoutPath,
            databaseName: req.body.databaseName
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        DatabaseSwitchApi.loadScript(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.fileNames = response.fileNames;
            next();
        });
    },

    deleteScriptFiles: function (req, res, next) {
        var options = {
            userId: req.user.id,
            fileNames: req.fileNames
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        DatabaseSwitchApi.deleteScriptFiles(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    getDatabase: function (req, res, next) {
        debug('Inside function2');
        var options = {
            userId: req.user.id
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        DatabaseSwitchApi.getDatabase(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            debug('function2 complete');
            next();
        });
    },

    getDatabaseByUser: function (req, res, next) {
        debug('Inside function2');
        var options = {
            userId: req.user.id
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        DatabaseSwitchApi.getDatabaseByUser(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            debug('function2 complete');
            next();
        });
    },

    function1: function (req, res, next) {
        debug('Inside function1');
        var options = {
            userId: req.body.userId
        };
        DatabaseSwitchApi.function1(options, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            debug('function1 complete', req.session.conn);
            req.data = response;
            next();
        });
    },

    function2: function (req, res, next) {
        debug('Inside function2');
        var options = {
            userId: req.body.userId
        };
        DatabaseSwitchApi.function2(options, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.session.db = 'THIS SHOULD SHOW DIFFERENT ';
            debug('function1 complete');
            req.abc = 'this should allow in next api';
            req.data = response;
            next();
        });
    },

    function3: function (req, res, next) {
        debug('req.session.conn', req.session.conn);
        var options = {
            userId: req.user,
            db: req.session.db,
            conn: req.session.conn
        };
        DatabaseSwitchApi.function3(options, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            debug('function3 complete');
            next();
        });
    }
};


module.exports = DatabaseSwitch;


