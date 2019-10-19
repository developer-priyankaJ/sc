/* jslint node: true */
'use strict';

var TwilioConfig = require('../config/twilio');
var DataUtils = require('../lib/data_utils');

var debug = require('debug')('scopehub.api.user');
var Twilio = require('twilio'), Client = Twilio(TwilioConfig.TWILIO_ACCOUNT_SID, TwilioConfig.TWILIO_AUTH_TOKEN);
var S3Utils = require('../lib/s3_utils');

var Constants = require('../data/constants');
var ErrorConfig = require('../data/error');

function createTwiML(message, cb) {
    var resp = new Twilio.TwimlResponse();
    var random = DataUtils.generateRandomInt(Constants.RANDOM_LOW_LIMIT, Constants.RANDOM_HIGH_LIMIT);

    resp.say({voice: 'woman'}, message);
    var fileName = DataUtils.getSha1(random + message) + '.xml';

    var buffer = new Buffer(resp.toString(), "binary");
    var metadata = {
        acl: 'public-read'
    };

    S3Utils.putObject(buffer, fileName, 'text/xml', null, Constants.SCOPEHUB_TWILIO_BUCKET, metadata, function (err, response) {
        if (err) {
            debug(err);
            err = new Error(ErrorConfig.MESSAGE.CALL_FAILED);
            err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
            return cb(err);
        }

        var options = {
            key: fileName,
            urlType: 'SYSTEM',
            bucket: Constants.SCOPEHUB_TWILIO_BUCKET
        };
        var url = S3Utils.getUrlforS3Key(options);
        return cb(null, url);
    });
}

var TwilioUtils = {
    sendSMS: function (to, from, body, cb) {
        Client.sendSms({
            to: to,
            from: from,
            body: body
        }, function (err, message) {
            if (err) {
                return cb(err);
            }
            return cb(null, message);
        });
    },

    makeCall: function (to, from, message, cb) {
        createTwiML(message, function (err, url) {
            if (err || !url) {
                err = new Error(ErrorConfig.MESSAGE.CALL_FAILED);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                debug(err);
                return cb(err);
            }

            Client.makeCall({
                to: to,
                from: from,
                url: url
            }, function (err, message) {
                if (err) {
                    return cb(err);
                }
                return cb(null, message);
            });
        });
    }
};

module.exports = TwilioUtils;

(function () {
    if (require.main == module) {
        //createTwiML('Hey wasss up guys?', console.log);
        //TwilioUtils.sendSMS('+14084786025', '+16174335257', 'Hey Wass up buddy?', console.log);
        //TwilioUtils.makeCall('+14084786025', '+16174335257', 'Hey Wass up buddy?', console.log);
    }
}());