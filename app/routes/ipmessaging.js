#!/usr/bin/env node

'use strict';

var debug = require('debug')('scopehub.route.ipmessaging');

var IpMessagingApi = require('../api/ipmessaging');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');



var IpMessaging = {

    createToken: function(req, res, next) {
        var options = {
        	user: req.user
        }
        IpMessagingApi.create(options, function(err, token) {
            if (err || !token) {
                err = err || new Error(ErrorConfig.MESSAGE.BAD_REQUEST);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug(err);
                return next(err);
            }
            req.data = token;
            next();
        });
    },

    sendJSON: function(req, res, next) {
        res.json(req.data);
    }
};

module.exports = IpMessaging;

