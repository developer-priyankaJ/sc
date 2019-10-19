#!/usr/bin/env node

'use strict';

var debug = require('debug')('scopehub.route.topic');
var Util = require('util');

var NotificationApi = require('../api/notification');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');
var HeaderUtils = require('../lib/header_utils');
var AuditUtils = require('../lib/audit_utils');
var Events = require('../data/events');

var Topic = {
    // TODO - This is mocked as of now, but it should hit the DB and fetch the topic_ids, user is subscribed to
    get: function (req, res, next) {
        req.topicIds = [req.user.id];
        return next();
    }
};

module.exports = Topic;

(function () {
    if (require.main == module) {
    }
}());
