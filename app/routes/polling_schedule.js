#!/usr/bin/env node

'use strict';

var debug = require('debug')('scopehub.route.polling_schedule');
var Util = require('util');

var SchedulingEntities = require('../data/scheduling_entities');
var PollingScheduleApi = require('../api/polling_schedule');
var HeaderUtils = require('../lib/header_utils');
var Events = require('../data/events');
var Constants = require('../data/constants');

var PollingSchedule = {
    create: function (req, res, next) {
        var options = {
            accountId: req.user.accountId,
            marketplaceId: req.body.marketplaceId,
            refreshInterval: req.body.refreshInterval,
            entities: req.body.entities
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.CREATE_POLLING_SCHEDULE);
        PollingScheduleApi.create(options, auditOptions, function (err, schedule) {
            if (err) {
                return next(err);
            }
            req.data = schedule;
            next();
        });
    },

    getSchedules: function (req, res, next) {
        var options = {
            accountId: req.user.accountId
        };
        PollingScheduleApi.getSchedules(options, function (err, schedules) {
            if (err) {
                return next(err);
            }
            req.data = schedules;
            next();
        });
    },

    updateSchedule: function (req, res, next) {
        var options = {
            scheduleId: req.body.scheduleId,
            refreshInterval: req.body.refreshInterval,
            entities: req.body.entities
        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_POLLING_SCHEDULE);
        PollingScheduleApi.updateSchedule(options, auditOptions, function (err, schedule) {
            if (err) {
                return next(err);
            }
            req.data = schedule;
            next();
        });
    },

    removeSchedule: function (req, res, next) {
        var options = {
            scheduleId: req.query.scheduleId
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.REMOVE_POLLING_SCHEDULE);
        PollingScheduleApi.removeSchedule(options, auditOptions, function (err) {
            if (err) {
                debug(err);
                return next(err);
            }
            req.data = Constants.OK_MESSAGE;
            next();
        });
    },

    getSchedulingEvents: function (req, res, next) {
        req.data = Object.keys(SchedulingEntities);
        return next();
    }
};

module.exports = PollingSchedule;

(function () {
    if (require.main == module) {
    }
}());