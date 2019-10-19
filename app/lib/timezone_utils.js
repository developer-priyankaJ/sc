'use strict';
/*jslint node: true */

var debug = require('debug')('scopehub.s3_utils');
var Request = require('request');

var DataUtils = require('./data_utils');
var GoogleConfig = require('../config/google');
var ErrorConfig = require('../data/error');

var TimezoneUtil = {

    getTimezoneInfo: function (options, cb) {
        var latitude = options.latitude;
        var longitude = options.longitude;
        // Must be passed in Seconds
        var timestamp = options.timestamp || DataUtils.getCurrentTimestampInSeconds();

        var opt = {
            url: GoogleConfig.getTimezoneApiURL(),
            method: 'GET',
            json: true,
            qs: {
                location: latitude + ',' + longitude,
                timestamp: timestamp,
                key: GoogleConfig.API_KEY
            }
        };

        Request(opt, function (err, response, body) {
            if (err || response.statusCode >= 400 || !body || body.status != 'OK') {
                err = err || new Error(ErrorConfig.MESSAGE.TIMZEZONE_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                return cb(err);
            }
            return cb(null, body);
        });
    },

    getDestinationArrivalTime: function (options, cb) {
        var destination = options.destination;
        // Duration must be passed in seconds
        var duration = options.duration;
        // Must be a UTC Date/Time
        var startTime = new Date(options.startTime);

        // All Timestamp are pointing to UTC
        var utcTimestamp = DataUtils.getTimestampInSeconds(startTime);
        var utcEndTimestamp = utcTimestamp + duration;

        var opt = {
            latitude: destination.latitude,
            longitude: destination.longitude,
            timestamp: utcEndTimestamp
        };

        TimezoneUtil.getTimezoneInfo(opt, function (err, response) {
            if (err) {
                return cb(err);
            }
            var dstOffset = response.dstOffset;
            var rawOffset = response.rawOffset;
            var offset = dstOffset + rawOffset;
            var destinationTime = utcEndTimestamp + offset;

            var destinationArrivalDate = new Date(destinationTime * 1000);
            destinationArrivalDate = DataUtils.formatDate(destinationArrivalDate);
            return cb(null, destinationArrivalDate);
        });
    }
};

module.exports = TimezoneUtil;

(function () {
    if (require.main === module) {
        //var options = {
        //    latitude: 40.7421,
        //    longitude: -73.9914
        //};
        //TimezoneUtil.getTimezoneInfo(options, console.log);

        var options = {
            destination: {
                latitude: 40.7421,
                longitude: -73.9914
            },
            duration: 0,
            startTime: '2016-08-04T19:33:16.584Z'
        };
        TimezoneUtil.getDestinationArrivalTime(options, console.log);
    }
}());