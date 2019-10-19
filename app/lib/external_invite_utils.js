'use strict';

var Util = require('util');
var _ = require('lodash');

var DataUtils = require('../lib/data_utils');
var Constants = require('../data/constants');
var ErrorConfig = require('../data/error');
var ExternalInviteModel = require('../model/invite_external');

var ExternalInviteUtils = {
    generate: function (email, cb) {
        var user = email;
        ExternalInviteModel
            .query(user)
            .usingIndex('ExternalInvite')
            .exec(function (err, data) {
                if (data.Count > 0) {
                    var data = (_.map(data.Items, 'attrs'));
                    console.log(data.length);
                    for (var i = 0; i < data.length; i++) {
                        if (data[i].inviteStatus === '0') {
                            var NotObj = {
                                email: data[i].contact,
                                message: data[i].invitedContactName + Constants.INVITE_JOINED_SCOPEHUB,
                                agentEmail: user,
                                status: 'unread'
                            };
                            ExternalInviteUtils.createNotification(NotObj, function (err, notObj) {
                                if (err || !notObj) {
                                    Util.log(err);
                                }
                            });
                        } else {
                            var InvObj = {};
                            InvObj.contact = data[i].contact;
                            InvObj.invitedContactEmail = data[i].invitedContactEmail;
                            InvObj.invitedContactName = data[i].invitedContactName;
                            InvObj.status = '2';
                            console.log(InvObj);
                            ExternalInviteUtils.updateInvite(InvObj, function (err, invite) {
                                if (err) {
                                    console.log(err);
                                }
                                console.log(invite);
                            });
                        }
                    }

                }
                return cb(null, 'GENERATED');
            });
    },

    createNotification: function (NotObj, cb) {
        //NotificationUtils.create(notificationObj, function (err, notification) {
        //    if (err || !notification) {
        //        Util.log(err);
        //    }
        //    return (null, notification);
        //});
    },

    updateInvite: function (InvObj, cb) {
        InviteModel.create(InvObj, function (err, invite) {
            if (err || !invite) {
                console.log(err);
                return cb(err);
            }
            var notificationObj = {
                email: InvObj.contact,
                message: InvObj.invitedContactName + Constants.INVITE_JOINED_SCOPEHUB_FRIENDS,
                agentEmail: InvObj.invitedContactEmail,
                status: 'unread'
            };

            //NotificationUtils.create(notificationObj, function (err, notification) {
            //    if (err) {
            //        Util.log(err);
            //    }
            //});
            console.log(invite)
            return cb(null, invite);
        });
    }
}

module.exports = ExternalInviteUtils;

(function () {
    if (require.main === module) {

    }
}());
