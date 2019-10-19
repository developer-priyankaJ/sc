/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.api.document');

var DataUtils = require('../lib/data_utils');
var DocumentModel = require('../model/document');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');

var Document = {
    getDocument: function (options, cb) {
        var name = options.name;
        var hl = options.hl;
        var err;
        if (DataUtils.isUndefined(name)) {
            err = new Error(ErrorConfig.MESSAGE.DOCUMENT_NAME_NOT_FOUND);
        }
        if (!err && DataUtils.isDefined(hl)) {
            if (Constants.ALLOWED_HL_PARAMETER.indexOf(hl) < 0) {
                err = new Error(ErrorConfig.MESSAGE.DOCUMENT_HL_INVALID_PARAMETER);
            }
        } else {
            hl = Constants.DEFAULT_HL;
        }

        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug(err);
            return cb(err);
        }

        DocumentModel
            .query(name)
            .where('language').eq(hl)
            .exec(function (err, data) {
                if (err || !data || !data.Items || !data.Items.length) {
                    err = new Error(ErrorConfig.MESSAGE.FAILED_TO_FIND_DOCUMENT);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    debug(err);
                    return cb(err);
                }
                var document = data.Items[0];
                var content = document.attrs && document.attrs.content;
                return cb(null, content);
            });
    }
};

module.exports = Document;

(function () {
    if (require.main == module) {
        var options = {
            name: 'tos'
        };
        Document.getDocument(options, console.log);
    }
}());
