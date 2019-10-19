#!/usr/bin/env node

'use strict';

var debug = require('debug')('scopehub.route.document');

var DocumentApi = require('../api/document');
var ErrorConfig = require('../data/error');

var Document = {
    getDocument: function(req, res, next) {
        var options = {
            name: req.params.name,
            hl: req.query.hl
        };
        DocumentApi.getDocument(options, function(err, content) {
            if (err || !content) {
                err = err || new Error(ErrorConfig.MESSAGE.FAILED_TO_FIND_DOCUMENT);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug(err);
                return next(err);
            }
            req.data = content;
            next();
        });
    },

    sendData: function(req, res, next) {
        res.send(req.data);
    }
};

module.exports = Document;

(function() {
    if (require.main == module) {}
}());
