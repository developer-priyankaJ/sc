'use strict';
/*jslint node: true */

var AWSConfig = require('../config/aws');

var debug = require('debug')('scopehub.lib.email');
var Util = require('util');
var EJS = require('ejs');
var Async = require('async');
var Path = require('path');
var NodeMailer = require('nodemailer');
var Transport = require('nodemailer-ses-transport');
var Promise = require('bluebird');
/*var Mailer = NodeMailer.createTransport(Transport({
    accessKeyId: 'AKIAYN3VCUUABTCKXFEU',
    secretAccessKey: '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'
}));*/

var Mailer = NodeMailer.createTransport({
    host: AWSConfig.SMTP_EMAIL_HOST,
    port: AWSConfig.SMTP_EMAIL_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
        user: AWSConfig.SMTP_EMAIL_USER, // Use from
        pass: AWSConfig.SMTP_EMAIL_PASSWORD // Use from Amazon Credentials
    }
});

var connection = require('../lib/connection_util');
var EmailTemplates = require('email-templates');
var EmailTemplateModel = require('../model/email_template');

var TemplatesDir = Path.resolve(__dirname, '..', 'templates');
var DataUtils = require('./data_utils');
var Endpoints = require('../config/endpoints');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');

var knex = require('../lib/knex_util');
var Utils = require('../lib/utils');

var Email = {
    sendNodeMailerEmail: function (mailOptions, cb) {
        try {
            if (mailOptions.text && DataUtils.isString(mailOptions.text)) {
                mailOptions.text = mailOptions.text
                  .replace(/\n/g, '<br>')
                  .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
            } else {
                mailOptions.text = JSON.stringify(mailOptions.text);
            }
        } catch (e) {
            Util.log('Error parsing email text: ' + mailOptions.text + ':' + e);
        }
        mailOptions.retryCounter = 0;
        var templateData = mailOptions.template_data;
        templateData.disconnect_url = Endpoints.DISCONNECT_URL;
        templateData.scopehub_domain = Endpoints.SCOPEHUB_DOMAIN;
        templateData.scopehub_domain_url = Endpoints.SCOPEHUB_URL;
        templateData.tos_url = Endpoints.TERMS_OF_SERVICE_URL + '?hl=' + mailOptions.language;
        templateData.privacy_url = Endpoints.PRIVACY_POLICY_URL + '?hl=' + mailOptions.language;
        templateData.support_center = Endpoints.SCOPEHUB_SUPPORT_CENTER;
        mailOptions.template_data = templateData;

        Async.waterfall([
            Async.constant(mailOptions),
            loadTemplate,
            sendMail
        ], function (err) {
            if (err) {
                Util.log(err);
            }
            return cb(err);
        });

        function loadTemplate(options, callback) {
            var templateData = options.template_data || {};
            if (options.templateName) {
                EmailTemplates(TemplatesDir, function (err, template) {
                    if (err) {
                        return callback(err);
                    }
                    template(options.templateName, templateData, function (err, html) {
                        if (err) {
                            return cb(err);
                        }
                        options.html = html;
                        //debug('options.html', html);
                        return callback(null, options);
                    });
                });
            } else {
                return callback(null, options);
            }
        }

        function sendMail(options, callback) {
            var mail = {
                subject: options.subject,
                from: options.from || AWSConfig.DEFAULT_SENDER,
                to: options.to,
                cc: options.cc,
                bcc: options.bcc,
                html: options.html || options.body || options.text
            };

            if (options.attachments) {
                mail.attachments = options.attachments;
            }

            var retryCounter = options.retryCounter;
            Mailer.sendMail(mail, function (err, response) {
                if (err) {
                    debug('error', err);
                    retryCounter++;
                    if (retryCounter < 2) {
                        return setTimeout(function () {
                            sendMail(retryCounter);
                        }, 5 * 1000 * 60);
                    } else {
                        err = new Error(err);
                    }
                }
                debug('response of email send', response);
                return callback(err, mail.subject);
            });
        }
    },

    loadTemplateData: function (options) {
        return new Promise(function (resolve, reject) {
            var templateData = options.template_data || {};
            EmailTemplates(TemplatesDir, function (err, template) {
                if (err) {
                    return reject(err);
                }
                template(options.templateName, templateData, function (err, html) {
                    if (err) {
                        return reject(err);
                    }
                    options.html = html;
                    //debug('options.html', html);
                    return resolve({html: html});
                });
            });
        });
    },

    getHTML: async function (mailOptions) {
        return new Promise(async function (resolve, reject) {
            try {
                if (mailOptions.text && DataUtils.isString(mailOptions.text)) {
                    mailOptions.text = mailOptions.text
                      .replace(/\n/g, '<br>')
                      .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
                } else {
                    mailOptions.text = JSON.stringify(mailOptions.text);
                }

                mailOptions.retryCounter = 0;
                var templateData = mailOptions.template_data;
                templateData.disconnect_url = Endpoints.DISCONNECT_URL;
                templateData.scopehub_domain = Endpoints.SCOPEHUB_DOMAIN;
                templateData.scopehub_domain_url = Endpoints.SCOPEHUB_URL;
                templateData.tos_url = Endpoints.TERMS_OF_SERVICE_URL + '?hl=' + mailOptions.language;
                templateData.privacy_url = Endpoints.PRIVACY_POLICY_URL + '?hl=' + mailOptions.language;
                templateData.support_center = Endpoints.SCOPEHUB_SUPPORT_CENTER;
                mailOptions.template_data = templateData;

                var htmlResponse = await Email.loadTemplateData(mailOptions);
                return resolve(htmlResponse);
            } catch (err) {
                Util.log('Error parsing email text: ' + mailOptions.text + ':' + err);
                debug('err', err);
                return reject(err);
            }
        });
    },

    // sendEmailMD: async function (options, compileOptions, cb) {
    //     var languageCultureCode = options.languageCultureCode;
    //     var language = languageCultureCode && languageCultureCode.substr(0, 2);
    //     var err;
    //
    //     var template = await knex.raw('select * from emailTemplate where languageCultureCode=? and name=?;', [languageCultureCode, options.template]);
    //     template = Utils.filteredResponse(template);
    //     if (!template) {
    //         err = new Error(ErrorConfig.MESSAGE.EMAIL_TEMPLATE_NOT_FOUND);
    //         err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
    //         debug(err);
    //         return cb(err);
    //     }
    //
    //     var bannerColor = template.bannerColor;
    //     var bannerText = template.bannerText;
    //     var emailSubject = template.emailSubject;
    //     var content = template.content;
    //     var upperCaseLanguage = language.toUpperCase();
    //     var compiledHTML = EJS.compile(content);
    //     var html = compiledHTML(compileOptions);
    //
    //     var templateData = {
    //         user_email: options.email,
    //         banner_color: bannerColor,
    //         banner_text: bannerText,
    //         content: html
    //     };
    //
    //     var opt = {
    //         to: options.email,
    //         subject: emailSubject,
    //         templateName: Constants.TEMPLATES[upperCaseLanguage].GENERIC_TEMPLATE,
    //         template_data: templateData,
    //         language: language
    //     };
    //
    //     Email.sendNodeMailerEmail(opt, function (err, body) {
    //         if (err) {
    //             err = new Error(ErrorConfig.MESSAGE.EMAIL_SEND_FAILURE);
    //             err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
    //             debug(err);
    //             return cb(err);
    //         }
    //         return cb();
    //     });
    //
    // },

    sendEmail: function (options, compileOptions, cb) {
        var languageCultureCode = options.languageCultureCode;
        var language = languageCultureCode && languageCultureCode.substr(0, 2);

        EmailTemplateModel
          .query(options.template)
          .where('languageCultureCode').eq(languageCultureCode)
          .exec(function (err, data) {
              if (err || !data || !data.Items || !data.Items.length) {
                  err = new Error(ErrorConfig.MESSAGE.EMAIL_TEMPLATE_NOT_FOUND);
                  err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                  debug(err);
                  return cb(err);
              }
              var template = data.Items[0];
              template = template.attrs;
              var bannerColor = template.bannerColor;
              var bannerText = template.bannerText;
              var emailSubject = template.emailSubject;
              var content = template.content;
              var upperCaseLanguage = language.toUpperCase();
              var compiledHTML = EJS.compile(content);
              var html = compiledHTML(compileOptions);

              var templateData = {
                  user_email: options.email,
                  banner_color: bannerColor,
                  banner_text: bannerText,
                  content: html
              };

              var opt = {
                  to: options.email,
                  subject: emailSubject,
                  templateName: Constants.TEMPLATES[upperCaseLanguage].GENERIC_TEMPLATE,
                  template_data: templateData,
                  language: language
              };
              Email.sendNodeMailerEmail(opt, function (err, body) {
                  if (err) {
                      err = new Error(ErrorConfig.MESSAGE.EMAIL_SEND_FAILURE);
                      err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                      debug(err);
                      return cb(err);
                  }
                  return cb();
              });
          });
    },

    sendEmailMD: async function (options, compileOptions, cb) {
        var languageCultureCode = options.languageCultureCode;
        var language = languageCultureCode && languageCultureCode.substr(0, 2);

        try {
            var conn = await connection.getConnection();
            var template = await conn.query('SELECT name, languageCultureCode, content, bannerColor, bannerText, emailSubject, description FROM ' +
              'emailTemplate where name = ? and languageCultureCode = ? ', [options.template, languageCultureCode]);

            template = Utils.filteredResponsePool(template);
            if (!template) {
                var err = new Error(ErrorConfig.MESSAGE.EMAIL_TEMPLATE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                debug(err);
                return cb(err);
            }

            var bannerColor = template.bannerColor;
            var bannerText = template.bannerText;
            var emailSubject = template.emailSubject;
            var content = template.content;
            var upperCaseLanguage = language.toUpperCase();
            var compiledHTML = EJS.compile(content);
            var html = compiledHTML(compileOptions);

            var templateData = {
                user_email: options.email,
                banner_color: bannerColor,
                banner_text: bannerText,
                content: html
            };

            var opt = {
                to: options.email,
                subject: emailSubject,
                templateName: Constants.TEMPLATES[upperCaseLanguage].GENERIC_TEMPLATE,
                template_data: templateData,
                language: language
            };

            Email.sendNodeMailerEmail(opt, function (err, body) {
                if (err) {
                    debug('errror ', err);
                    err = new Error(ErrorConfig.MESSAGE.EMAIL_SEND_FAILURE);
                    err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                    debug(err);
                    return cb(err);
                }
                return cb();
            });
        } catch (err) {
            if (err.code) {
                err = new Error(ErrorConfig.MESSAGE.EMAIL_SEND_FAILURE);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
            }
            return cb(err);
        }
    },

    /*getBillingHTML: async function (options, compileOptions, cb) {
        var languageCultureCode = options.languageCultureCode;
        var language = languageCultureCode && languageCultureCode.substr(0, 2);

        try {
            var conn = await connection.getConnection();
            var template = await conn.query('SELECT name, languageCultureCode, content, bannerColor, bannerText, emailSubject, description FROM ' +
              'emailTemplate where name = ? and languageCultureCode = ? ', [options.template, languageCultureCode]);

            template = Utils.filteredResponsePool(template);
            if (!template) {
                var err = new Error(ErrorConfig.MESSAGE.EMAIL_TEMPLATE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                debug(err);
                return cb(err);
            }

            var bannerColor = template.bannerColor;
            var bannerText = template.bannerText;
            var emailSubject = template.emailSubject;
            var content = template.content;
            var upperCaseLanguage = language.toUpperCase();
            var compiledHTML = EJS.compile(content);
            var html = compiledHTML(compileOptions);

            var templateData = {
                user_email: options.email,
                banner_color: bannerColor,
                banner_text: bannerText,
                content: html
            };

            var opt = {
                to: options.email,
                subject: emailSubject,
                templateName: Constants.TEMPLATES[upperCaseLanguage].GENERIC_TEMPLATE,
                template_data: templateData,
                language: language
            };

            Email.sendNodeMailerEmail(opt, function (err, body) {
                if (err) {
                    err = new Error(ErrorConfig.MESSAGE.EMAIL_SEND_FAILURE);
                    err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                    debug(err);
                    return cb(err);
                }
                return cb();
            });
        } catch (err) {
            if (err.code) {
                err = new Error(ErrorConfig.MESSAGE.EMAIL_SEND_FAILURE);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
            }
            return cb(err);
        }
    },*/

    sendEmailPromise: async function (options, compileOptions) {
        return new Promise(async function (resolve, reject) {
            var languageCultureCode = options.languageCultureCode;
            var language = languageCultureCode && languageCultureCode.substr(0, 2);

            try {
                var conn = await connection.getConnection();
                var template = await conn.query('SELECT name, languageCultureCode, content, bannerColor, bannerText, emailSubject, description FROM ' +
                  'emailTemplate where name = ? and languageCultureCode = ? ', [options.template, languageCultureCode]);

                template = Utils.filteredResponsePool(template);
                if (!template) {
                    var err = new Error(ErrorConfig.MESSAGE.EMAIL_TEMPLATE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                    debug(err);
                    return reject(err);
                }

                var bannerColor = template.bannerColor;
                var bannerText = template.bannerText;
                var emailSubject = template.emailSubject;
                var content = template.content;
                debug('content', content);
                var upperCaseLanguage = language.toUpperCase();
                var compiledHTML = EJS.compile(content);
                var html = compiledHTML(compileOptions);

                var templateData = {
                    user_email: options.email,
                    banner_color: bannerColor,
                    banner_text: bannerText,
                    content: html
                };

                var opt = {
                    to: options.email,
                    subject: emailSubject,
                    templateName: Constants.TEMPLATES[upperCaseLanguage].GENERIC_TEMPLATE,
                    template_data: templateData,
                    language: language,
                    attachments: options.attachments
                };

                Email.sendNodeMailerEmail(opt, function (err, body) {
                    if (err) {
                        err = new Error(ErrorConfig.MESSAGE.EMAIL_SEND_FAILURE);
                        err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                        debug(err);
                        return reject(err);
                    }
                    return resolve(Constants.OK_MESSAGE);
                });
            } catch (err) {
                if (err.code) {
                    err = new Error(ErrorConfig.MESSAGE.EMAIL_SEND_FAILURE);
                    err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                }
                return reject(err);
            }
        });
    },

    getBillingHTML: function (options, compileOptions) {
        return new Promise(async function (resolve, reject) {
            var languageCultureCode = options.languageCultureCode;
            var language = languageCultureCode && languageCultureCode.substr(0, 2);
            var isBill = options.isBill;

            try {
                var conn = await connection.getConnection();
                var template = await conn.query('SELECT name, languageCultureCode, content, bannerColor, bannerText, emailSubject, description FROM ' +
                  'emailTemplate where name = ? and languageCultureCode = ? ', [options.template, languageCultureCode]);

                template = Utils.filteredResponsePool(template);
                if (!template) {
                    var err = new Error(ErrorConfig.MESSAGE.EMAIL_TEMPLATE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                    debug(err);
                    return reject(err);
                }

                var bannerColor = template.bannerColor;
                var bannerText = template.bannerText;
                var emailSubject = template.emailSubject;
                var content = template.content;
                var upperCaseLanguage = language.toUpperCase();
                var compiledHTML = EJS.compile(content);
                var html = compiledHTML(compileOptions);

                var templateData = {
                    user_email: options.email,
                    banner_color: bannerColor,
                    banner_text: bannerText,
                    content: html
                };

                var opt = {
                    to: options.email,
                    subject: emailSubject,
                    templateName: Constants.BILL_TEMPLATES[upperCaseLanguage].GENERIC_TEMPLATE,
                    template_data: templateData,
                    language: language
                };

                var htmlResponse = await Email.getHTML(opt);
                return resolve(htmlResponse);

            } catch (err) {
                if (err.code) {
                    err = new Error(ErrorConfig.MESSAGE.EMAIL_SEND_FAILURE);
                    err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                }
                return reject(err);
            }
        });
    }

};

module.exports = Email;

(function () {
    if (require.main === module) {
        var opt = {
            languageCultureCode: 'en-US',
            template: Constants.EMAIL_TEMPLATES.INVITE_EXTERNAL_SENT,
            email: 'codedhrj@gmail.com'
        };

        var compileOptions = {
            name: 'dheeraj',
            friend: 'codedhrj@gmail.com',
            message: 'Wass up?'
        };

        Email.sendEmail(opt, compileOptions, console.log);
    }
}());
