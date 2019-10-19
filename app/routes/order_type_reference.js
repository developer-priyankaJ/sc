#!/usr/bin/env node

'use strict';

var debug = require('debug')('scopehub.route.bill_of_materials');
var Util = require('util');

var OrderTypeReferenceApi = require('../api/order_type_reference');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');
var Events = require('../data/events');
var HeaderUtils = require('../lib/header_utils');

var OrderTypeReference = {

    create: function (req, res, next) {
        var options = {
            type: req.body.type,
        };
        OrderTypeReferenceApi.create(options, function (err, data) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = data;
            next();
        });
    },

};

module.exports = OrderTypeReference;