'use strict';

var debug = require('debug')('scopehub.route.unit_of_measure_category');
var Events = require('../data/events');
var HeaderUtils = require('../lib/header_utils');
var UnitOfMeasureCategoryApi = require('../api/unit_of_measure_category');

var UnitOfMeasureCategory = {
    create: function (req, res, next) {
        var options = {
            accountId: req.user.accountId,
            userId: req.user.id,
            name: req.body.name,
            comment: req.body.comment
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        UnitOfMeasureCategoryApi.create(options, errorOptions, function (err, unit) {
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
            languageCultureCode: req.body.languageCultureCode,
            name: req.body.name,
            comment: req.body.comment,
            categoryId: req.body.categoryId,
            updatedAt: req.body.updatedAt,
            user: req.user
        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_UINT_OF_MEASURE_CATEGORY);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        UnitOfMeasureCategoryApi.update(options, auditOptions, errorOptions, function (err, unit) {
            if (err) {
                debug(err);
                return next(err);
            }
            req.data = unit;
            next();
        });
    },

    getUnitOfMeasureCategoryByAccountId: function (req, res, next) {
        var options = {
            languageCultureCode: req.query.languageCultureCode,
            fromUOM: req.query.fromUOM,
            user: req.user
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        UnitOfMeasureCategoryApi.getUnitOfMeasureCategoryByAccountId(options, errorOptions, function (err, references) {
            if (err) {
                return next(err);
            }
            req.data = references;
            next();
        });
    },

    getUnitOfMeasureCategoryByCategoryId: function (req, res, next) {
        var options = {
            categoryId: req.query.categoryId,
            languageCultureCode: req.query.languageCultureCode,
            user: req.user
        };

        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        UnitOfMeasureCategoryApi.getUnitOfMeasureCategoryByCategoryId(options, errorOptions, function (err, references) {
            if (err) {
                return next(err);
            }
            req.data = references;
            next();
        });
    },

    delete: function (req, res, next) {
        var options = {
            categoryId: req.query.categoryId,
            updatedAt: req.query.updatedAt,
            accountId: req.user.accountId
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_UINT_OF_MEASURE_CATEGORY);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UnitOfMeasureCategoryApi.delete(options, auditOptions, errorOptions, function (err, unit) {
            if (err) {
                debug(err);
                return next(err);
            }
            req.data = unit;
            next();
        });
    }
};

module.exports = UnitOfMeasureCategory;