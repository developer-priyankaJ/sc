-'use strict';
/*jslint node: true */

var debug = require('debug')('scopehub.sqs_utils');
var SQS = require('../model/sqs');
var AwsConfig = require('../config/aws');

var noop = function () {
};

var SqsUtils = {
    enqueue: function (options, cb) {
        var opts = {
            DelaySeconds: options.DelaySeconds || 10,
            MessageBody: JSON.stringify(options),
            QueueUrl: AwsConfig.SQS_QUEUE
        };
        SQS.sendMessage(opts, function (err, data) {
            if (err) {
                return cb(err);
            }
            return cb(null, data.MessageId);
        });
    },

    dequeue: function (cb) {
        var params = {
            MaxNumberOfMessages: 5,
            QueueUrl: AwsConfig.SQS_QUEUE,
            VisibilityTimeout: 0,
            WaitTimeSeconds: 10
        };

        SQS.receiveMessage(params, function (err, data) {
            if (err) {
                return cb(err);
            }
            return cb(null, data);
        });
    },

    deleteMessage: function (options, cb) {
        cb = cb || noop;
        var receiptHandle = options.receiptHandle;
        var deleteParams = {
            QueueUrl: AwsConfig.SQS_QUEUE,
            ReceiptHandle: receiptHandle
        };
        SQS.deleteMessage(deleteParams, function (err) {
            if (err) {
                return cb(err);
            }
            console.log('Message Deleted.....')
            return cb();
        });
    },

    setVisibilityTimeout: function (options, cb) {
        console.log('Inside setVisibilityTimeout', options);
        var visibilityParams = {
            QueueUrl: AwsConfig.SQS_QUEUE,
            ReceiptHandle: options.receiptHandle,
            VisibilityTimeout: options.refreshInterval * 60
        };
        console.log(visibilityParams);
        SQS.changeMessageVisibility(visibilityParams, function (err, data) {
            if (err) {
                console.log('Inside err....', err);
                return cb(err);
            }
            console.log('Outside error / data', data);
            return cb(null, data);
        });
    }
};

module.exports = SqsUtils;

(function () {
    if (require.main === module) {
        //var options = {
        //    name: 'Jerry',
        //    last_name: 'Batra'
        //};
        //SqsUtils.enqueue(options, console.log);

        SqsUtils.dequeue(console.log);
    }
}());