#!/usr/bin/env node

'use strict';

var _ = require('lodash');

var debug = require('debug')('scopehub.route.chat');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');
var DataUtils = require('../lib/data_utils');
var Utils = require('../lib/utils');
var Events = require('../data/events');
var ErrorUtils = require('../lib/error_utils');
var HeaderUtils = require('../lib/header_utils');
var AuditUtils = require('../lib/audit_utils');
var ChatApi = require('../api/chat');

var Chat = {

    getChatById: async function (req, res, next) {
        var options = {
            chatId: req.query.id,
            user: req.user,
            isRead: req.query.isRead
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        ChatApi.getChatById(options, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    getChatBySenderAndReceiver: function (req, res, next) {
        var options = {
            senderId: req.query.senderId,
            receiverId: req.query.receiverId,
            timestamp: req.query.timestamp,
            count: req.query.count
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        ChatApi.getChatBySenderAndReceiver(options, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    getChatPartners: function (req, res, next) {
        var options = {
            senderId: req.user.id
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        ChatApi.getChatPartners(options, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    getUnreadMessagesCount: function (req, res, next) {
        var options = {
            receiverId: req.user.id
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        ChatApi.getUnreadMessagesCount(options, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    searchByName: function (req, res, next) {
        var options = {
            query: req.query.query,
            isActive: req.query.isActive,
            inviterId: req.user.id
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        ChatApi.searchByName(options, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    create: function (req, res, next) {
        var options = {
            message: req.body.message,
            members: req.body.members,
            user: req.user,
            parentId: req.body.parentId,
            tempId: req.body.tempId,
            type: req.body.type,
            fileName: req.body.fileName,
            fileSize: req.body.fileSize,
            imageString: req.body.imageString
        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.CREATE_CHAT);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        ChatApi.create(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    getChatImageUrl: async function (req, res, next) {
        var options = {
            chatId: req.query.id,
            user: req.user,
            isRegenerate: req.query.isRegenerate
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        ChatApi.getChatImageUrl(options, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    getUploadUrl: async function (req, res, next) {
        var options = {
            chatId: req.query.id,
            user: req.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        ChatApi.getUploadUrl(options, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    deleteMessage: function (req, res, next) {
        var options = {
            user: req.user,
            ids: req.body.ids
        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.DELETE_CHAT);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        ChatApi.deleteMessage(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    updateMessage: function (req, res, next) {
        var options = {
            user: req.user,
            chatId: req.body.id,
            message: req.body.message
        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_CHAT);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        ChatApi.updateMessage(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    update: function (req, res, next) {
        var options = {
            receiverId: req.body.receiverId,
            user: req.user
        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_CHAT);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        ChatApi.update(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    sendTypingStatus: function (req, res, next) {
        var options = {
            receiverIds: req.body.receiverIds,
            groupId: req.body.groupId,
            isTyping: req.body.isTyping,
            user: req.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        ChatApi.sendTypingStatus(options, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    getChatStatus: function (req, res, next) {
        var options = {
            userIds: req.body.userIds,
            user: req.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        ChatApi.getChatStatus(options, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    getAllUsersOfAccount: function (req, res, next) {
        var options = {
            user: req.user,
            query: req.query.query
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        ChatApi.getAllUsersOfAccount(options, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    }
};

module.exports = Chat;