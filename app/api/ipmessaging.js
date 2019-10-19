/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.api.IpMessaging');
var Util = require('util');

var DataUtils = require('../lib/data_utils');
var AccessToken = require('twilio').AccessToken;
var IpMessagingGrant = AccessToken.IpMessagingGrant;
var AuditUtils = require('../lib/audit_utils');
var Constants = require('../data/constants');
var ErrorConfig = require('../data/error');
var IpMessagingConfig = require('../config/ipmessaging')
var _ = require('lodash');

var IpMessaging = {
    create: function (options, cb) {
        var user = options.user;
        var identity = user.email;
        var userUUID = user.id;
        var endpointId = IpMessagingConfig.TWILIO_APP_NAME + ':' + userUUID + ':' + identity;

        var ipmGrant = new IpMessagingGrant({
            serviceSid: IpMessagingConfig.TWILIO_IPM_SERVICE_SID,
            endpointId: endpointId
        });

        var token = new AccessToken(
            IpMessagingConfig.TWILIO_ACCOUNT_SID,
            IpMessagingConfig.TWILIO_API_KEY,
            IpMessagingConfig.TWILIO_API_SECRET
        );
        
        token.addGrant(ipmGrant);
        token.identity = identity;

        var response = {
            identity: identity,
            token: token.toJwt()
        }

        return cb(null,response)

    }

};


module.exports = IpMessaging;
