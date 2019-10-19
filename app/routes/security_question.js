#!/usr/bin/env node

'use strict';

var debug = require('debug')('scopehub.route.security_question');

var SecurityQuestionApi = require('../api/security_question');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');



var SecurityQuestion = {

    create: function(req, res, next) {
        var options = req.body;
        SecurityQuestionApi.create(options, function(err, question) {
            if (err || !question) {
                err = err || new Error(ErrorConfig.MESSAGE.BAD_REQUEST);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug(err);
                return next(err);
            }
            req.data = question;
            next();
        });
    },
    list: function(req, res, next) {
        var options = req.body;
        SecurityQuestionApi.list(options, function(err, questions) {
            if (err || !questions) {
                err = err || new Error(ErrorConfig.MESSAGE.BAD_REQUEST);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug(err);
                return next(err);
            }
            req.data = questions;
            next();
        });
    },

    remove: function(req, res, next) {
        var options = req.body;
        options.id = req.params.question;
        console.log(options.id);
        SecurityQuestionApi.remove(options, function(err, result) {
            if (err) {
                err = err || new Error(ErrorConfig.MESSAGE.BAD_REQUEST);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug(err);
                return next(err);
            }
            req.data = {
                result: 'success'
            };
            next();
        });
    },

    sendJSON: function(req, res, next) {
        res.json(req.data);
    }
};

module.exports = SecurityQuestion;

(function() {
    if (require.main == module) {}
}());
