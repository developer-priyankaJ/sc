/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.route.process_polling_queue');
var Util = require('util');

var SQSUtils = require('../lib/sqs_utils');
var PollingScheduleApi = require('../api/polling_schedule');

var ProcessPollingQueue = {
    init: function (cb) {
        // TODO - Dheeraj - Fix this function - Stack Overflow exception may be in future
        SQSUtils.dequeue(function (err, data) {
            if (err) {
                Util.log(err);
                return cb(err);
            }
            PollingScheduleApi.handleDequeuedMessage(data, function (err) {
                if (err) {
                    Util.log(err);
                }
                Util.log('#Message Processed');
                ProcessPollingQueue.init(cb);
            });
        });
    }
};

module.exports = ProcessPollingQueue;

(function () {
    if (require.main === module) {
        ProcessPollingQueue.init();
    }
}());