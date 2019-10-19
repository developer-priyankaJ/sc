'use strict';
/*jslint node: true */

var debug = require('debug')('scopehub.api.group');
var Request = require('request');
var Util = require('util');

var ReCaptchaConfig = require('../config/recaptcha');
var endpointConfig= require('../config/endpoints');
var ErrorConfig = require('../data/error');

var ReCaptchaUtils = {
    verifyCaptcha: async function (key, cb) {
        return cb();
        var options = {
            secret: ReCaptchaConfig.SECRET_KEY,
            response: key
        };
        debug('options', options);
        Request.post(ReCaptchaConfig.ENDPOINT, options, function (err, body) {
            debug('body', body);
            if (err || !body || !body.success) {
                err = err || new Error(ErrorConfig.MESSAGE.RECAPTCHA_VALIDATION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                debug(err);
                Util.log(err);
                return cb(err);
            }
            return cb();
        });
        /*var captcha = '1234';
        var captchaSecretKey = ReCaptchaConfig.secretKey;
       // var ipAddress = auditOptions.ipAddress;

        try {
            debug('captcha', captcha);
            var captchaVerificationUrl = endpointConfig.RECAPTCHA_VERIFY_URL + '?secret=' + captchaSecretKey +
              '&response=' + captcha + '';
            /!*if (DataUtils.isDefined(ipAddress)) {
                captchaVerificationUrl += '&remoteip=' + ipAddress;
            }*!/
            var verifyOption = {
                url: captchaVerificationUrl,
                method: 'POST',
                json: true
            };
            debug('verifyOption', verifyOption);
            await Request(verifyOption, async function (err, response, body) {
                debug('body.success', body);
                if (err || !body.success) {
                    err = err || new Error(ErrorConfig.MESSAGE.RE_CAPTCHA_VERIFICATION_FAILED);
                    err.status = err.status || ErrorConfig.STATUS_CODE.UNAUTHORIZED;
                    return cb(err);
                }
                debug('====== COMPLETE ============');
                return cb(null, Constants.OK_MESSAGE);
            });
        } catch (err) {
            debug('err', err);
            return cb(err);
        }*/
    }
};

module.exports = ReCaptchaUtils;

(function () {
    if (require.main === module) {
        var key = '03AHJ_Vuu8wFjYXpIYh1zL2IoQDNhKHW4EvGLXoHLtHv2ejJ5iNWIJIuU-RIEiLKO9IaiJvmNzGhSxalOfYp0654TU1lIHRY-PfzPCN1o9b_cXPvxF2-7Bu7p9xajGkmbCASJvJSbkSGW60_qA1lW4eA3vK6FVqzsjCGLsys4A45w4fndGFdEBjdoFbOIJAcHVaACpZ4PJIbVOcairwVpS9Aol2qkR40ACL-FSVTm5Wu5RS69uCErkztqXlER2Vcc2TJy5_sbu34Psx6bzGNFLpCIBYG5EfXpc9znZMNZd-zM4wBYR-eoo0fG5bUG3g5Y1Jimq72hFJwdwJGW-3Q31R2t3F5w3GaetB2M72jDHesqnIYF_-u709OhnVkUqwGz3iZfIiFeyN1KKTK_sGtd_IG1hzsOcdlPkoSAa2TIHamOQ8OJmtOXKE1SgPA6x2rWflDYB4exRu_75piUA77OvVETdiaNCbnJPwFhYzcc1ILRyjypntQqmG_Z3mzooxZqsyyuT1urXVECvlPuCVdlqm0iOd4K9KO0Q1ps2VrDJTX55ICnHaiWNDBX91-8V3hNfNtLUgdxsF49VVNI6VG_fmsrXNbDZV1E580nIhhQ5zwRzWjDvmmEls2a29nhPxa3Os17Q-6YAjr5XiAKtXzQMH3P2PcFhPPeYbUHA9WgiP5t7eBBCbL4_kwQLrOe0LCBjbVTInhBrw09IgBah0bz7hukgigS6wplDD5AShP8xSbDHBV0iUwojbj9yxsSu7nMY8XWJ1eJifsrvIXQaiZmsGA-D9w5YZ4CBZUAiLISPsJQSfzJRxaLKmwau5VuCwl8JwOwd1i1iXS4x6NWmk0KkOku3hiKIHKSM1ujcwEYpY7VuXpAJtZPjirmW7JCJzLgq0bG9Xsqmz0sa3oTun7s47_GMb4Z_oobl5Z1-HXW5oL-8VKeNpKiWW_bkt5kI-v72MNAfwkPCj39Hvau6qQmx0ZGLFLDAPKQRXwaqBU2-4W1vW0D6UfjANSS0xizR8TRijic8ZRcylEMkrL1C2qBxsrEE2gVBotFi-dFcmmxe24cP0FUQLeqwOg2HuVE9VR-QQj_fuSpCD4gV6Z5J7mmv0kZdNrG0RLG_5fi8ag0EAP8HhvDZfgAvfP9UEUsMwCsMirjBquiaZMh4QGhbyZcJjvyQd2T7SFhexg';
        ReCaptchaUtils.verifyCaptcha(key, console.log);
    }
}());