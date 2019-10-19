#!/usr/bin/env node
'use strict';

var debug = require('debug')('scopehub.route.billing');
var Util = require('util');

var PlanApi = require('../api/plan');
var HeaderUtils = require('../lib/header_utils');
var Events = require('../data/events');
var Constants = require('../data/constants');
var DataUtils = require('../lib/data_utils');
var _ = require('lodash');

var Plan = {

    updateAccountPlan: function (req, res, next) {
        var user = req.user;
        var options = {
            user: user,
            planType: req.body.planType,
            billCycleCount: req.body.billCycleCount
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        PlanApi.updateAccountPlan(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            return next();
        });
    }
};

module.exports = Plan;
