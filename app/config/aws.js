/* jslint node: true */
'use strict';
/**
 *This file will be kept different on (local/staging) and production to segregate the (staging/local) and production uploads and downloads
 */

module.exports = {
    s3Endpoint: 's3-us-west-2.amazonaws.com',

    dynamodbEndpoint: 'dynamodb.us-west-2.amazonaws.com',

    accessKeyId: 'AKIAIT3GJJTSCR2I46KA',

    secretAccessKey: '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',

    REGION: 'us-west-2',

    SQS_QUEUE: 'https://sqs.us-west-2.amazonaws.com/579529254144/scopehub',

    SQS_EMAIL_TOPIC_ARN: 'arn:aws:sns:us-west-2:579529254144:ScopeHub-Email',

    NO_OF_SQS_WORKERS: 1,

    DEFAULT_SENDER: 'Do Not Reply - ScopeHub Support <support@scopehub.org>'
};
