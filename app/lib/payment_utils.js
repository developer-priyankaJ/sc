'use strict';
/*jslint node: true */

var debug = require('debug')('scopehub.payment_utils');
var Util = require('util');
var Constants = require('../data/constants');
var Path = require('path');
var PromiseBluebird = require('bluebird');
var DataUtils = require('./data_utils');
var request = require('request-promise');

var PaymentUtils = {

    /*
    * https://mws.amazonservices.com/OffAmazonPayments_Sandbox/2013-01-01?
    AWSAccessKeyId=AKIAJKYFSJU7PEXAMPLE
    &AmazonBillingAgreementId=C01-8824045-7416542
    &Action=SetBillingAgreementDetails
    &BillingAgreementAttributes.PlatformId=PLATFORM_ID_HERE
    &BillingAgreementAttributes.SellerNote=APPROVE LITE APPROVE HEAVY
    &BillingAgreementAttributes.SellerBillingAgreementAttributes.CustomInformati
    on=Example Customer Info
    &BillingAgreementAttributes.SellerBillingAgreementAttributes.StoreName=Test Store Name
    &MWSAuthToken=amzn.mws.4ea38b7b-f563-7709-4bae-87aeaEXAMPLE
    &SellerId=YOUR_SELLER_ID_HERE
    &SignatureMethod=HmacSHA256
    &SignatureVersion=2
    &Timestamp=2013-12-11T10:57:18.000Z
    &Version=2013-01-01
    &Signature=Z0ZVgWu0ICF4FLxt1mTjyK+jdYG6Kmm8JxLTfsQtKRY=
    * */

    getParamsValues: function (options) {
        var string = '';
        if (DataUtils.isDefined(options.AWSAccessKeyId)) {
            string += 'AWSAccessKeyId=' + options.AWSAccessKeyId + '?';
        }
        if (DataUtils.isDefined(options.PlatformId)) {
            string += 'PlatformId=' + options.PlatformId + '?';
        }
        if (DataUtils.isDefined(options.SellerNote)) {
            string += 'SellerNote=' + options.SellerNote + '?';
        }
        if (DataUtils.isDefined(options.CustomInformation)) {
            string += 'CustomInformation=' + options.CustomInformation + '?';
        }
        if (DataUtils.isDefined(options.StoreName)) {
            string += 'StoreName=' + options.StoreName + '?';
        }
        if (DataUtils.isDefined(options.SellerId)) {
            string += 'SellerId=' + options.SellerId + '?';
        }
        if (DataUtils.isDefined(options.SignatureMethod)) {
            string += 'SignatureMethod=' + options.SignatureMethod + '?';
        }
        if (DataUtils.isDefined(options.SignatureVersion)) {
            string += 'SignatureVersion=' + options.SignatureVersion + '?';
        }
        if (DataUtils.isDefined(options.Timestamp)) {
            string += 'Timestamp=' + options.Timestamp + '?';
        }
        if (DataUtils.isDefined(options.Version)) {
            string += 'Version=' + options.Version + '?';
        }
        if (DataUtils.isDefined(options.Signature)) {
            string += 'Signature=' + options.Signature + '?';
        }
        if (DataUtils.isDefined(options.AccessToken)) {
            string += 'AccessToken=' + options.AccessToken + '?';
        }
        if (DataUtils.isDefined(options.AmazonBillingAgreementId)) {
            string += 'AmazonBillingAgreementId=' + options.AmazonBillingAgreementId + '?';
        }
        string = string.slice(0, -1);
        return string;
    },

    SetBillingAgreementDetails: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var url = 'https://mws.amazonservices.com/OffAmazonPayments_Sandbox/2013-01-01?';
            var AWSAccessKeyId = options.AWSAccessKeyId;
            var Action = 'SetBillingAgreementDetails';
            var AmazonBillingAgreementId = options.AmazonBillingAgreementId;
            var PlatformId = options.PlatformId;
            var SellerNote = options.SellerNote;
            var CustomInformation = options.CustomInformation;
            var StoreName = options.StoreName;
            var SellerId = options.SellerId;
            var SignatureMethod = options.SignatureMethod;
            var SignatureVersion = options.SignatureVersion;
            var Timestamp = options.Timestamp;
            var Version = options.Version;
            var Signature = options.Signature;

            var params = PaymentUtils.getParamsValues(options);

            url += params;

            try {
                var response = await request(url);
                debug('response', response);
                return resolve(response);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },


    /*
    * POST /OffAmazonPayments/2013-01-01 HTTP/1.1
      Content-Type: x-www-form-urlencoded
      Host: mws.amazonservices.com
      User-Agent: <Your User Agent Header>

      AWSAccessKeyId=AKIAJKYFSJU7PEXAMPLE
      &Action=GetOrderReferenceDetails
      &AccessToken=YOUR_ACCESS_TOKEN
      &AmazonOrderReferenceId=P01-1234567-1234567
      &SellerId=YOUR_SELLER_ID_HERE
      &SignatureMethod=HmacSHA256
      &SignatureVersion=2
      &Timestamp=2012-11-05T19%3A01%3A11Z
      &Version=2013-01-01
      &Signature=CLZOdtJGjAo81IxaLoE7af6HqK0EXAMPLE
    * */

    GetBillingAgreementDetails: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var url = 'https://mws.amazonservices.com/OffAmazonPayments_Sandbox/2013-01-01?';
            var AWSAccessKeyId = options.AWSAccessKeyId;
            //var Action = 'GetBillingAgreementDetails';
            var AccessToken = options.AccessToken;
            var AmazonBillingAgreementId = options.AmazonBillingAgreementId;
            var SellerId = options.SellerId;
            var SignatureMethod = options.SignatureMethod;
            var SignatureVersion = options.SignatureVersion;
            var Timestamp = options.Timestamp;
            var Version = options.Version;
            var Signature = options.Signature;

            url += PaymentUtils.getParamsValues(options);

            try {
                var option = {};
                var opt = {
                    url: url,
                    method: 'POST',
                    json: true,
                    form: option
                };

                debug('options', opt);
                debug('new ', new Date().toISOString());

                /*await request(opt, async function (err, response, body) {
                    //debug('err', err);
                    if (err || response.statusCode >= 400) {
                        debug('Inside err');
                        return reject(err);
                    }
                    debug('response');
                    return resolve(body);
                });*/
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    }
};

module.exports = PaymentUtils;