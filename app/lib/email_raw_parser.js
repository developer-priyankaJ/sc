'use strict';
/*jslint node: true */

var debug = require('debug')('scopehub.lib.email_raw_parser');
var SimpleParser = require('mailparser').simpleParser;
var FS = require('fs');
var Async = require('async');

var S3Utils = require('./s3_utils');
var Constants = require('../data/constants');
var ErrorConfig = require('../data/error');

function downloadFile(options, cb) {
    S3Utils.getObject(options.path, Constants.SCOPEHUB_SELLER_EMAILS_BUCKET, function (err, response) {
        if (err || !response) {
            err = err || new Error(ErrorConfig.MESSAGE.S3_GET_OBJECT_FAILED);
            err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
            return cb(err);
        }
        FS.writeFile(options.download_path, response.Body, cb);
    });
}

function readFile(options, cb) {
    FS.readFile(options.download_path, function (err, source) {
        if (err) {
            return cb(err);
        }
        options.file_data = source;
        return cb();
    });
}

var EmailRawParser = {
    handleS3Email: function (options, cb) {
        options.path = options.path || options.s3Object;
        options.download_path = Constants.DEFAULT_DOWNLOAD_LOCATION + '/' + options.path;
        downloadFile(options, function (err) {
            if (err) {
                return cb(err);
            }
            readFile(options, function (err) {
                if (err) {
                    return cb(err);
                }
                EmailRawParser.parseEmail(options, function (err) {
                    if (err) {
                        return cb(err);
                    }
                    EmailRawParser.uploadParsedEmail(options, cb);
                });
            });
        });
    },

    parseEmail: function (options, cb) {
        SimpleParser(options.file_data, (err, email) => {
            if (err) {
                return cb(err);
            }
            var html = email.html;
            var index = 1;
            Async.eachLimit(email.attachments, 3, function (attachment, callback) {
                parseAndUploadAttachment(attachment, options, function (err, url) {
                    if (err) {
                        return callback(err);
                    }
                    html += '<a href="' + url + '">Attachment ' + (index++) + '</a></br>';
                    return callback();
                });
            }, function (err) {
                options.write_data = html;
                options.write_path = '/tmp/' + options.path + '.html';
                return cb(err);
            });
        });

        function parseAndUploadAttachment(attachment, options, cb) {
            var path = '/tmp/' + options.path + '_' + attachment.filename;
            FS.writeFile(path, attachment.content, function (err) {
                if (err) {
                    return cb(err);
                }
                var metadata = {};
                var destination = options.userId;
                var fileName = options.path + '_' + attachment.filename;
                FS.readFile(path, function (err, buffer) {
                    S3Utils.putObject(buffer, fileName, attachment.contentType, destination, Constants.SCOPEHUB_SES_EMAIL_BUCKET, metadata, function (err) {
                        if (err) {
                            return cb(err);
                        }
                        var options = {
                            key: destination + '/' + fileName,
                            urlType: 'USER',
                            bucket: Constants.SCOPEHUB_SES_EMAIL_BUCKET
                        };
                        var url = S3Utils.getUrlforS3Key(options);
                        return cb(null, url);
                    });
                });
            });
        }
    },

    uploadParsedEmail: function (options, cb) {
        FS.writeFile(options.write_path, options.write_data, function (err) {
            if (err) {
                return cb(err);
            }
            var metadata = {};
            var fileName = options.path + '.html';
            var destination = options.userId;
            FS.readFile(options.write_path, function (err, buffer) {
                S3Utils.putObject(buffer, fileName, 'text/html', destination, Constants.SCOPEHUB_SES_EMAIL_BUCKET, metadata, function (err) {
                    if (err) {
                        return cb(err);
                    }
                    var options = {
                        key: destination + '/' + fileName,
                        urlType: 'USER',
                        bucket: Constants.SCOPEHUB_SES_EMAIL_BUCKET
                    };
                    var url = S3Utils.getUrlforS3Key(options);
                    return cb(null, url);
                });
            });
        });
    }
};

module.exports = EmailRawParser;

(function () {
    if (require.main === module) {
        /*        var FS = require('fs');
                var path = '/home/dheerajbatra/personal/scopehub_be/app/test.txt';
                var source = FS.readFileSync(path, "utf8");
                EmailRawParser.parseEmail(source, function(err, email) {
                    FS.writeFile(email.attachments[0].filename, email.attachments[0].content, function(err) {
                        if(err) {
                            return console.log(err);
                        }
                        console.log(email.attachments[0]);
                        console.log(email.attachments[0].content);
                        console.log(email.html);
                    });
                });*/
        var opt = {
            path: 'lsbatlsn62dgkclbitsv6957h9lgh097a2vio4g1',
            user: 'test'
        };
        EmailRawParser.handleS3Email(opt, function (err, response) {
            console.log(err, response);
        });
    }
}());
