'use strict';

var debug = require('debug')('scopehub.route.order_line_items');
var Constants = require('../data/constants');
var Events = require('../data/events');
var path = require('path');
var fs = require('fs');
var base64 = require('file-base64');
var HeaderUtils = require('../lib/header_utils');
var OrderLineItemsApi = require('../api/order_line_items');

var OrderLineItem = {

    getAllOrderLineItem: function (req, res, next) {
        debug('Inside getItems');
        var user = req.user;
        var options = {
            user: user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.GET_ITEMS);
        OrderLineItemsApi.getAllOrderLineItem(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            return next();
        });
    },

    searchOrderLineItem: function (req, res, next) {
        debug('Inside search items');
        var user = req.user;
        var options = {
            user: user,
            sellerSKU: req.query.sellerSKU,
            title: req.query.title,
            amazonOrderId: req.query.amazonOrderId
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.GET_ITEMS);
        OrderLineItemsApi.searchOrderLineItem(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            return next();
        });
    },

};

module.exports = OrderLineItem;

