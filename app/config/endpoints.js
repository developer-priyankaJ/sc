/* jslint node: true */
'use strict';
/**
 *This file will be kept different on (local/staging) and production to segregate the (staging/local) and production uploads and downloads 
*/

module.exports = {
    SCOPEHUB_TWILIO_BUCKET: 'scopehub-dev-twilio',

    SCOPEHUB_SES_EMAIL_BUCKET: 'scopehub-dev-ses',

    SCOPEHUB_SELLER_EMAILS_BUCKET: 'scopehuborg-seller-emails',

    SCOPEHUB_ACCOUNTS_S3_BUCKET: 'scopehub-accounts',

    SCOPEHUB_DOMAIN: 'scopeHub.org',

    SCOPEHUB_URL: 'https://scopehub.org',

    API_ENDPOINT: 'https://net.scopehub.org/api',

    PRIVACY_POLICY_URL: 'https://test.scopehub.org/api/policies/privacy',

    TERMS_OF_SERVICE_URL: 'https://test.scopehub.org/api/policies/tos',

    SCOPEHUB_SUPPORT_CENTER: 'https://support.scopehub.org',

    DISCONNECT_URL: 'https://scopehub.org/api/user/disconnect',

    SCOPEHUB_LOGIN_URL: 'https://test.scopehub.org/#!/login',

    SCOPEHUB_REGISTRATION_URL: 'https://test.scopehub.org/#!/registration',

    getSesEmailUrl: function() {
        return 'https://net.scopehub.org/api/ses/email';
    }
};


