#!/usr/bin/env node

'use strict';

var debug = require('debug')('scopehub.route.chat_group');
var Util = require('util');

var ChatGroupApi = require('../api/chat_group');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');
var Events = require('../data/events');
var HeaderUtils = require('../lib/header_utils');

var ChatGroup = {

    create: function (req, res, next) {
        var user = req.user;
        var options = {
            user: user,
            name: req.body.name,
            members: req.body.members,
            isName: req.body.isName
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.CREATE_CHAT_GROUP);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        ChatGroupApi.create(options, auditOptions, errorOptions, function (err, chatGroup) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            //debug('chat', chatGroup);
            req.data = chatGroup || [];
            next();
        });
    },

    sendMessage: function (req, res, next) {
        var user = req.user;
        var options = {
            user: user,
            message: req.body.message,
            groupId: req.body.groupId,
            members: req.body.members,
            tempId: req.body.tempId,
            type: req.body.type,
            fileName: req.body.fileName,
            fileSize: req.body.fileSize,
            imageString: req.body.imageString
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.CREATE_GROUP_MESSAGE);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        ChatGroupApi.sendMessage(options, auditOptions, errorOptions, function (err, chatMessage) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = chatMessage || [];
            next();
        });
    },

    getChatById: function (req, res, next) {
        var options = {
            chatId: req.query.id,
            isRead: req.query.isRead,
            user: req.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        ChatGroupApi.getChatById(options, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    getChatByGroupId: function (req, res, next) {
        var options = {
            groupId: req.query.groupId,
            timestamp: req.query.timestamp,
            count: req.query.count,
            user: req.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        ChatGroupApi.getChatByGroupId(options, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    getNameGroup: function (req, res, next) {
        var options = {
            user: req.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        ChatGroupApi.getNameGroup(options, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    searchNameGroup: function (req, res, next) {
        var options = {
            user: req.user,
            query: req.query.query
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        ChatGroupApi.searchNameGroup(options, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    markGroupMessageAsRead: function (req, res, next) {
        var options = {
            user: req.user,
            groupId: req.body.groupId
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.MARK_GROUP_MESSAGE_AS_READ);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        ChatGroupApi.markGroupMessageAsRead(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    }


    /*getAll: function (req, res, next) {
        var options = {
            userId: req.query.userId
        };

        ChatGroupApi.getAll(options, function (err, chat_groups) {
            if (err) {
                return next(err);
            }
            req.data = chat_groups;
            next();
        });
    },

    getChat: function (req, res, next) {
        var options = {
            chatGroupId: req.query.chatGroupId
        };

        ChatGroupApi.getChat(options, function (err, chat_group) {
            if (err) {
                return next(err);
            }
            req.data = chat_group;
            next();
        });
    }*/
};

module.exports = ChatGroup;
