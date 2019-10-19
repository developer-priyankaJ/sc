'use strict';
/*jslint node: true */

var debug = require('debug')('scopehub.ses_utils');

var SES = require('../model/ses');
var Constants = require('../data/constants');

var noop = function () {
};

var SesUtils = {
    updateRuleSet: function(options, cb) {
        cb = cb || noop;
        var email = options.email;

        var params = {
            RuleName: "Seller-Email",
            RuleSetName: "Seller-Email-Rule-Set"
        };
        SES.describeReceiptRule(params, function(err, data) {
            if(err) {
                return cb(err);
            } else {
                var rule = data.Rule;
                var recipients = rule.Recipients;
                recipients.push(email);
                var params = {
                    Rule: rule,
                    //OriginalRuleSetName: "Seller-Email-Rule-Set",
                    RuleSetName: 'Seller-Email-Rule-Set' /* required */
                };

                SES.updateReceiptRule(params, function (err, data) {
                    return cb(err, data);
                });
            }
        });
    }
};

module.exports = SesUtils;

(function () {
    if (require.main === module) {
        var options = {
            email: 'us+d4fa2944-ec3b-44b3-a3d3-1eedbdef6322@scopehub.org'
        };
        SesUtils.updateRuleSet(options, console.log);
    }
}());