#!/usr/bin/env node

'use strict';

var debug = require('debug')('scopehub.route.view');
var Util = require('util');
var ViewApi = require('../api/view');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');
var Events = require('../data/events');
var HeaderUtils = require('../lib/header_utils');

var View = {

    create: function (req, res, next) {
        var options = {
            userId: req.user.id,
            accountId: req.user.accountId,
            name: req.body.name,
            type: req.body.type,
            columns: req.body.columns,
            fromFilterDate: req.body.fromFilterDate,
            toFilterDate: req.body.toFilterDate,
            sortColumn: req.body.sortColumn,
            sortOrder: req.body.sortOrder
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.CREATE_VIEW);
        ViewApi.create(options, auditOptions, errorOptions, function (err, view) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = view;
            next();
        });
    },

    get: function (req, res, next) {
        var options = {
            userId: req.user.id,
            accountId: req.user.accountId,
            type: req.query.type
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        ViewApi.get(options, errorOptions, function (err, view) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = view;
            next();
        });
    },

    getRecent: function (req, res, next) {
        var options = {
            userId: req.user.id,
            accountId: req.user.accountId,
            type: req.query.type
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        ViewApi.getRecent(options, errorOptions, function (err, view) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = view;
            next();
        });
    },

    getByName: function (req, res, next) {
        var options = {
            userId: req.user.id,
            accountId: req.user.accountId,
            type: req.query.type,
            name: req.query.name
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        ViewApi.getByName(options, errorOptions, function (err, view) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = view;
            next();
        });
    },

    update: function (req, res, next) {
        var options = {
            userId: req.user.id,
            accountId: req.user.accountId,
            type: req.body.type,
            name: req.body.name,
            id: req.body.id,
            columns: req.body.columns,
            fromFilterDate: req.body.fromFilterDate,
            toFilterDate: req.body.toFilterDate,
            sortColumn: req.body.sortColumn,
            sortOrder: req.body.sortOrder,
            updatedAt: req.body.updatedAt,
            isRecentViewUpdate: req.body.isRecentViewUpdate
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_VIEW);
        ViewApi.update(options, auditOptions, errorOptions, function (err, view) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = view;
            next();
        });
    },

    delete: function (req, res, next) {
        var options = {
            userId: req.user.id,
            type: req.body.type,
            id: req.body.id,
            updatedAt: req.body.updatedAt
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.DELETE_VIEW);
        ViewApi.delete(options, auditOptions, errorOptions, function (err, view) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = view;
            next();
        });
    },

    changeDB: function (req, res, next) {
        var options = {
            userId: req.body.userId,
            database: req.body.database,
            isDefault: req.body.isDefault
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        ViewApi.changeDB(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            next();
        });
    }
};


module.exports = View;


