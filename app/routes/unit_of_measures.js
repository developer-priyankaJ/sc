'use strict';

var debug = require('debug')('scopehub.route.unit_of_measures');
var Events = require('../data/events');
var HeaderUtils = require('../lib/header_utils');
var UnitOfMeasuresApi = require('../api/unit_of_measures');


var UnitOfMeasures = {
    create: function (req, res, next) {
        var options = {
            accountId: req.user.accountId,
            categoryId: req.body.categoryId,
            name: req.body.name,
            symbol: req.body.symbol,
            scalingPrecision: req.body.scalingPrecision,
            scalingFactor: req.body.scalingFactor,
            comment: req.body.comment,
            userId: req.user.id
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        UnitOfMeasuresApi.create(options, errorOptions, function (err, unit) {
            if (err) {
                debug(err);
                return next(err);
            }
            req.data = unit;
            next();
        });
    },

    update: function (req, res, next) {

        var options = {
            id: req.body.id,
            name: req.body.name,
            symbol: req.body.symbol,
            scalingPrecision: req.body.scalingPrecision,
            scalingFactor: req.body.scalingFactor,
            comment: req.body.comment,
            updatedAt: req.body.updatedAt,
            user: req.user,
            languageCultureCode: req.body.languageCultureCode

        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_UINT_OF_MEASURE_CATEGORY);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        UnitOfMeasuresApi.update(options, auditOptions, errorOptions, function (err, unit) {
            if (err) {
                debug(err);
                return next(err);
            }
            req.data = unit;
            next();
        });
    },

    delete: function (req, res, next) {
        var options = {
            id: req.query.id,
            updatedAt: req.query.updatedAt,
            accountId: req.user.accountId
        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.DELETE_UNIT_OF_MEASURE_CATEGORY);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        UnitOfMeasuresApi.delete(options, auditOptions, errorOptions, function (err, unit) {
            if (err) {
                debug(err);
                return next(err);
            }
            req.data = unit;
            next();
        });
    },

    getUnitOfMeasuresByAccountId: function (req, res, next) {
        var options = {
            categoryId: req.query.categoryId,
            languageCultureCode: req.query.languageCultureCode,
            user: req.user
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        UnitOfMeasuresApi.getUnitOfMeasuresByAccountId(options, errorOptions, function (err, references) {
            if (err) {
                return next(err);
            }
            req.data = references;
            next();
        });
    },

    getUnitOfMeasuresById: function (req, res, next) {

        var options = {
            id: req.query.id,
            languageCultureCode: req.query.languageCultureCode,
            user: req.user
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        UnitOfMeasuresApi.getUnitOfMeasuresById(options, errorOptions, function (err, references) {
            if (err) {
                return next(err);
            }
            req.data = references;
            next();
        });
    },

    getUnitOfMeasureById: function (req, res, next) {
        var options = {
            id: req.query.id,
            languageCultureCode: req.query.languageCultureCode,
            user: req.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UnitOfMeasuresApi.getUnitOfMeasureById(options, errorOptions, function (err, references) {
            if (err) {
                return next(err);
            }
            req.data = references;
            next();
        });
    }
};

module.exports = UnitOfMeasures;