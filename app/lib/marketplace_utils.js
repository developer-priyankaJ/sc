'use strict';

var debug = require('debug')('scopehub.lib.marketplace_utils');
var Util = require('util');

var DataUtils = require('../lib/data_utils');
var Constants = require('../data/constants');
var MarketplaceLogModel = require('../model/marketplace_log');
var ErrorConfig = require('../data/error');

var noop = function() {
}; //

var MarketplaceUtils = {
	log : function(options, cb) {
		cb = cb || noop;
		var opt = {
			userId: options.userId || 0,
			requestType: options.requestType,
			endpoint: options.endpoint,
			params: options.params,
			response: options.response,
			requestId: options.requestId,
			metaData: options.metaData && JSON.stringify(options.metaData),
			accountId: options.accountId,
			platform: options.platform,
			marketplace: options.marketplace
		};
		MarketplaceLogModel.create(opt, function(err, data) {
			if (err) {
				Util.log(err);
				return cb(err);
			}
			return cb();
		});
	}
};

module.exports = MarketplaceUtils;

(function() {
	if (require.main === module) {

	}
}());