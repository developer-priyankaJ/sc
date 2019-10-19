'use strict';
/*jslint node: true */

var HeaderUtils = {
    getAuditLogHeaders: function (req, options, eventId) {
        options.userId = req.session && req.session.user && req.session.user.id;
        options.eventId = eventId;
        options.userAgent = req.useragent;
        options.ipAddress = req.header('X-Forwarded-For') || req.connection.remoteAddress;
        options.localDeviceTimezone = req.header('localDeviceTimezone');
        options.localDeviceDateTime = req.header('localDeviceDateTime');
        options.languageCultureCode = req.header('languageCultureCode');
        options.deviceType = req.device.type;
    },

    getErrorLogHeaders: function (req) {
        var options = {};
        options.userId = req.session && req.session.user && req.session.user.id;
        options.url = req.url;
        options.method = req.method;
        options.queryParams = req.query;
        options.bodyParams = req.body;
        options.urlParams = req.params;
        options.ipAddress = req.header('X-Forwarded-For') || req.connection.remoteAddress;
        return options;
    }
};

module.exports = HeaderUtils;

(function () {
    if (require.main === module) {
    }
}());
