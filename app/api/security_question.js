/**
 * Created by MS on 07-09-2016.
 */
/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.api.user');

var DataUtils = require('../lib/data_utils');
var Constants = require('../data/constants');
var ErrorConfig = require('../data/error');
var SecurityQuestionModel = require('../model/security_question');


function getError(message, status) {
    var err = new Error(message);
    err.status = statusCode;
    return err;
}

var SecurityQuestion = {
    create: function(options, cb) {
        var text = options.text;


        var err;
        if (DataUtils.isUndefined(text) || DataUtils.isUndefined(text)) {
            err = new Error(ErrorConfig.MESSAGE.LOGIN_INCORRECT);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug(err);
            return cb(err);
        }

        var quesObj = {};
        quesObj.text = text;
        quesObj.active = true;

        var params = {};
        params.overwrite = false;

        SecurityQuestionModel.create(quesObj, params, function(error, question) {
            if (error) {
                console.log(error);
                err = new Error(error.toString());
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug(err);
                return cb(err);
            } else {
                return cb(null, question);
            }
        });

    },
    list: function(options, cb) {

        var err;
        SecurityQuestionModel.scan()
            .loadAll()
            .exec(cb);

    },

    remove: function(options, cb) {
        var id = options.id;
        SecurityQuestionModel.
        destroy(id, cb);
    }

};

module.exports = SecurityQuestion;

(function() {
    if (require.main == module) {
        var email = 'codedhrj@gmail.com';
        //  SecurityQuestionModel.get(email, {ConsistentRead: true}, console.log);
    }
}());
