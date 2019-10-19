#!/usr/bin/env node

'use strict';

var _ = require('lodash');

var debug = require('debug')('scopehub.route.authentication');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');
var AccountApi = require('../api/account');
var UserApi = require('../api/user');
var DataUtils = require('../lib/data_utils');
var Utils = require('../lib/utils');

var connection = require('../lib/connection_util');
var knexfile = require('../knexfile');
//var knex = require('knex')(knexfile);
//var {raw} = require('objection');

var noop = function () {
}; // do nothing.

function authorizeUser(req, cb) {
    var err;
    if (!req.session || !req.session.user || !req.session.user.isLoggedIn) {
        err = new Error(ErrorConfig.MESSAGE.SESSION_INVALID);
    }
    if (!err && Constants.USER_STATUS.ACTIVE !== req.session.user.status) {
        err = new Error(ErrorConfig.MESSAGE.USER_INACTIVE);
    }
    if (!err && !Utils.toBoolean(req.session.user.postRegComplete)) {
        err = new Error(ErrorConfig.MESSAGE.COMPLETE_POST_REGISTRATION);
    }
    if (err) {
        err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
        return cb(err);
    }
    req.user = req.session.user;
    req.account = req.user.account;
    return cb();
}

function authorizeUserMD(req, cb) {
    var err;
    if (!req.session || !req.session.user || !req.session.user.isLoggedIn) {
        err = new Error(ErrorConfig.MESSAGE.SESSION_INVALID);
    }
    if (!err && Constants.USER_STATUS.ACTIVE !== req.session.user.status) {
        err = new Error(ErrorConfig.MESSAGE.USER_INACTIVE);
    }
    if (!err && !req.session.user.post_reg_complete) {
        err = new Error(ErrorConfig.MESSAGE.COMPLETE_POST_REGISTRATION);
    }
    if (err) {
        err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
        return cb(err);
    }
    req.user = req.session.user;
    req.account = req.user.account;
    return cb();
}

function authorizeGatewayRequestMD(req, cb) {
    debug('1');
    var headers = req.headers;
    var accountAuthToken = headers[Constants.ACCOUNT_AUTHENTICATION_TOKEN];
    var err;
    if (!accountAuthToken) {
        err = new Error(ErrorConfig.MESSAGE.ACCOUNT_AUTH_TOKEN_NOT_FOUND);
        err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
        return cb(err);
    }
    var opt = {
        authToken: accountAuthToken
    };
    AccountApi.getAccountByAuthTokenMD(opt, function (err, account) {
        if (err) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_AUTHNETICATION_FAILED);
        } else if (!account) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_NOT_FOUND);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
            return cb(err);
        }
        req.account = account;

        UserApi.getOwnerByAccountIdMD(account.id, function (err, user) {
            if (err) {
                err = new Error(ErrorConfig.MESSAGE.USER_AUTHNETICATION_FAILED);
            } else if (!account) {
                err = new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
                return cb(err);
            }
            req.user = user;
            return cb();
        });
    });
}

var Authentication = {

    // TODO - Dheeraj - When entering deviceAuthorized check, verify that it is not creating a problem for CloseAccount API
    commonAuthorize: function (req, res, next) {
        var err;
        if (!req.session || !req.session.user || !req.session.user.isLoggedIn) {
            err = new Error(ErrorConfig.MESSAGE.SESSION_INVALID);
        }
        if (!err && Constants.USER_STATUS.ACTIVE != req.session.user.status) {
            err = new Error(ErrorConfig.MESSAGE.USER_INACTIVE);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
            return next(err);
        }

        req.user = req.session.user;
        req.account = req.user.account;
        return next();
    },

    authorizeUser: function (req, res, next) {
        return authorizeUser(req, next);
    },

    authorizeUserOrGatewayMD: function (req, res, next) {
        authorizeGatewayRequestMD(req, function (err) {
            if (!err) {
                return next();
            }
            authorizeUser(req, function (err) {
                if (err) {
                    return next(err);
                }
                return next();
            });
        });
    },

    validateUserParam: function (req, res, next) {
        var userId = req.params.userId;
        if (req.session.user.id !== userId) {
            var err = new Error(ErrorConfig.MESSAGE.USER_MISMATCH);
            err.status = ErrorConfig.STATUS_CODE.FORBIDDEN;
            return next(err);
        }
        return next();
    },

    authorizeUserWithAcl: function (token) {
        return function (req, res, next) {
            var err;
            if (!req.session || !req.session.user || !req.session.user.isLoggedIn) {
                err = new Error(ErrorConfig.MESSAGE.SESSION_INVALID);
            }
            if (!err && req.session.user.tokens.indexOf(token) < 0) {
                err = new Error(ErrorConfig.MESSAGE.UNAUTHORIZED_TO_ACCESS);
                return next(err);
            }
            if (!err && Constants.USER_STATUS.ACTIVE != req.session.user.status) {
                err = new Error(ErrorConfig.MESSAGE.USER_INACTIVE);
            }
            if (!err && !req.session.user.postRegComplete) {
                err = new Error(ErrorConfig.MESSAGE.COMPLETE_POST_REGISTRATION);
            }
            if (!err && req.session.user.isAdmin) {
                err = new Error(ErrorConfig.MESSAGE.USER_LOGIN_REQUIRED);
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
                return next(err);
            }
            req.user = req.session.user;
            return next();
        };
    },

    authorizeAdmin: function (req, res, next) {
        var err;
        if (!req.session || !req.session.user || !req.session.user.isLoggedIn) {
            err = new Error(ErrorConfig.MESSAGE.SESSION_INVALID);
        }
        if (!err && Constants.USER_STATUS.ACTIVE !== req.session.user.status) {
            err = new Error(ErrorConfig.MESSAGE.USER_INACTIVE);
        }
        if (!err && !req.session.user.isAdmin) {
            err = new Error(ErrorConfig.MESSAGE.ADMIN_RIGHTS_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
            return next(err);
        }
        req.user = req.session.user;
        return next();
    },

    authorizeAdminMD: async function (req, res, next) {
        var err;

        if (!req.session || !req.session.user || !req.session.user.isLoggedIn) {
            err = new Error(ErrorConfig.MESSAGE.SESSION_INVALID);
        }
        if (!err && Constants.USER_STATUS.ACTIVE !== req.session.user.status) {
            err = new Error(ErrorConfig.MESSAGE.USER_INACTIVE);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
            return next(err);
        }
        var user = req.session.user;

        var userId = user.id;
        var adminRole = 'account admin', ownerRole = 'account owner';
        try {
            var conn = await connection.getConnection();

            var accountRoles = await conn.query('select *,CAST(uuid_from_bin(id) as CHAR) as id, CAST(uuid_from_bin(userId) as CHAR) as userId, ' +
              ' CAST(uuid_from_bin(roleId) as CHAR) as roleId ' +
              ' from user_roles where userId = uuid_to_bin(?) and roleId in (select id from Roles where title in (?,?) )',
              [userId, adminRole, ownerRole]);
            accountRoles = Utils.filteredResponsePool(accountRoles);

            if (!accountRoles) {
                var err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ADMIN_LOGIN_REQUIRED);
                err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
                return next(err);
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
                return next(err);
            }
            req.user = req.session.user;
            return next();
        } catch (err) {
            debug('err', err);
            return next(err);
        }
    },


    /*
    * Function check the permissions (token) with permission in session object ,
    * If user has not permission then it gives permission denied error
    * */
    checkForPermissions: function (token) {
        return function (req, res, next) {
            var permissionObject = req.session.user.permissions;
            var err;
            var flag = true;
            if (!permissionObject || _.isEmpty(permissionObject)) {
                err = new Error(ErrorConfig.MESSAGE.PERMISSION_DENIED);
                err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
                return next(err);
            }

            var firstKey = Object.getOwnPropertyNames(token);
            firstKey = firstKey[0];
            if (permissionObject.hasOwnProperty(firstKey)) {
                var secondKey = Object.getOwnPropertyNames(token[firstKey]);
                secondKey = secondKey[0];
                if (permissionObject[firstKey].hasOwnProperty(secondKey)) {
                    var thirdKey = Object.getOwnPropertyNames(token[firstKey][secondKey]);
                    thirdKey = thirdKey[0];
                    if (permissionObject[firstKey][secondKey].hasOwnProperty(thirdKey)) {
                        if (permissionObject[firstKey][secondKey][thirdKey] === token[firstKey][secondKey][thirdKey]) {
                            flag = false;
                        }
                    }
                }
            }
            if (flag) {
                err = new Error(ErrorConfig.MESSAGE.PERMISSION_DENIED);
                err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
                return next(err);
            }
            return next();
        };
    },

    authorizeResetPasswordSession: function (req, res, next) {

        var email = req.body.email;
        var fromLogin = req.body.fromLogin;
        var err;
        if (DataUtils.isUndefined(fromLogin)) {
            err = new Error(ErrorConfig.MESSAGE.FROM_LOG_IN_VALUE_REQ);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return next(err);
        }
        if (fromLogin === false) {
            if (!req.session || !req.session.user || !req.session.user.isLoggedIn) {
                err = new Error(ErrorConfig.MESSAGE.SESSION_INVALID);
                err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
                return next(err);
            }
            UserApi.getUserByEmailMD(req.session.user.email, function (err, user) {

                if (err) {
                    err = new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return next(err);
                }
                if (!err && Constants.USER_STATUS.ACTIVE !== user.status) {
                    err = new Error(ErrorConfig.MESSAGE.USER_INACTIVE);
                }
                if (!err && !Utils.toBoolean(user.postRegComplete)) {
                    err = new Error(ErrorConfig.MESSAGE.COMPLETE_POST_REGISTRATION);
                }
                if (err) {
                    err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
                    return next(err);
                }
                var isAccountEnabled = Utils.toBoolean(user.isAccountEnabled);
                var isAccountActive = Utils.toBoolean(user.isAccountActive);

                if (!isAccountEnabled || !isAccountActive) {
                    err = new Error(ErrorConfig.MESSAGE.ACCOUNT_DISABLED);
                    err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
                    return next(err);
                }
                var lastResetPassword = user.lastResetPassword;
                if (lastResetPassword) {
                    var currentTimestamp = new Date().getTime();
                    var tenMinutes = 10 * 60 * 1000;
                    if (currentTimestamp - lastResetPassword > tenMinutes) {
                        err = new Error(ErrorConfig.MESSAGE.VERIFICATION_CODE_EXPIRED);
                        err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
                        return next(err);
                    }
                }
                req.user = user;
                return next();
            });
        } else {
            if (DataUtils.isUndefined(email)) {
                err = new Error(ErrorConfig.MESSAGE.EMAIL_REQ);
            } else if (DataUtils.isInvalidEmail(email)) {
                err = new Error(ErrorConfig.MESSAGE.EMAIL_INVALID);
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return next(err);
            }

            UserApi.getUserByEmailMD(email, function (err, user) {
                if (err) {
                    debug('err', err);
                    err = new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return next(err);
                }
                var isAccountEnabled = Utils.toBoolean(user.isAccountEnabled);
                var isAccountActive = Utils.toBoolean(user.isAccountActive);

                if (!isAccountEnabled || !isAccountActive) {
                    err = new Error(ErrorConfig.MESSAGE.ACCOUNT_DISABLED);
                    err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
                    return next(err);
                }
                /*if (Constants.USER_STATUS.ACTIVE != user.status) {
                    err = new Error(ErrorConfig.MESSAGE.USER_INACTIVE);
                    err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
                    return next(err);
                }*/

                var lastResetPassword = user.lastResetPassword;
                var currentTimestamp = new Date().getTime();
                var tenMinutes = 10 * 60 * 1000;
                if (currentTimestamp - lastResetPassword > tenMinutes) {
                    err = new Error(ErrorConfig.MESSAGE.VERIFICATION_CODE_EXPIRED);
                    err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
                    return next(err);
                }

                req.user = user;
                return next();
            });
        }
    },

    resetPasswordValidatePasswordMD: function (req, res, next) {
        var err;

        if (!req.session || !req.session.user || !req.session.user.isLoggedIn) {
            err = new Error(ErrorConfig.MESSAGE.SESSION_INVALID);
            err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
            return next(err);
        }

        UserApi.getUserByEmailMD(req.session.user.email, function (err, user) {
            if (err) {
                err = new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return next(err);
            }
            if (!err && Constants.USER_STATUS.ACTIVE !== user.status) {
                err = new Error(ErrorConfig.MESSAGE.USER_INACTIVE);
            }
            if (!err && !Utils.toBoolean(user.postRegComplete)) {
                err = new Error(ErrorConfig.MESSAGE.COMPLETE_POST_REGISTRATION);
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
                return next(err);
            }
            var isAccountEnabled = Utils.toBoolean(user.isAccountEnabled);
            var isAccountActive = Utils.toBoolean(user.isAccountActive);

            if (!isAccountEnabled || !isAccountActive) {
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_DISABLED);
                err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
                return next(err);
            }
            req.user = user;
            return next();
        });
    },
    resetPasswordResendSession: function (req, res, next) {

        var email = req.body.email;
        var fromLogin = req.body.fromLogin;
        var err;
        if (DataUtils.isUndefined(fromLogin)) {
            err = new Error(ErrorConfig.MESSAGE.FROM_LOG_IN_VALUE_REQ);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return next(err);
        }
        if (fromLogin === false) {
            if (!req.session || !req.session.user || !req.session.user.isLoggedIn) {
                err = new Error(ErrorConfig.MESSAGE.SESSION_INVALID);
                err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
                return next(err);
            }

            UserApi.getUserByEmailMD(req.session.user.email, function (err, user) {
                if (err) {
                    err = new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return next(err);
                }
                if (!err && Constants.USER_STATUS.ACTIVE !== user.status) {
                    err = new Error(ErrorConfig.MESSAGE.USER_INACTIVE);
                }
                if (!err && !Utils.toBoolean(user.postRegComplete)) {
                    err = new Error(ErrorConfig.MESSAGE.COMPLETE_POST_REGISTRATION);
                }
                if (err) {
                    err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
                    return next(err);
                }
                var isAccountEnabled = Utils.toBoolean(user.isAccountEnabled);
                var isAccountActive = Utils.toBoolean(user.isAccountActive);

                if (!isAccountEnabled || !isAccountActive) {
                    err = new Error(ErrorConfig.MESSAGE.ACCOUNT_DISABLED);
                    err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
                    return next(err);
                }
                req.user = user;
                return next();
            });
        } else {
            if (DataUtils.isUndefined(email)) {
                err = new Error(ErrorConfig.MESSAGE.EMAIL_REQ);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return next(err);
            }

            UserApi.getUserByEmailMD(email, function (err, user) {
                if (err) {
                    debug('err', err);
                    err = new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return next(err);
                }
                var isAccountEnabled = Utils.toBoolean(user.isAccountEnabled);
                var isAccountActive = Utils.toBoolean(user.isAccountActive);

                if (!isAccountEnabled || !isAccountActive) {
                    err = new Error(ErrorConfig.MESSAGE.ACCOUNT_DISABLED);
                    err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
                    return next(err);
                }
                if (Constants.USER_STATUS.ACTIVE !== user.status) {
                    err = new Error(ErrorConfig.MESSAGE.USER_INACTIVE);
                    err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
                    return next(err);
                }
                req.user = user;
                return next();
            });
        }
    },

    validateRequest: async function (req, res, next) {
        var body = req.body;
        var email = body.email;
        var captcha = body['g-recaptcha-response'];
        var fromLogin = body.fromLogin;
        var mode = body.mode;
        var err;

        if (DataUtils.isUndefined(fromLogin)) {
            err = new Error(ErrorConfig.MESSAGE.FROM_LOG_IN_VALUE_REQ);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return next(err);
        }
        if (fromLogin === false) {
            if (!req.session || !req.session.user || !req.session.user.isLoggedIn) {
                err = new Error(ErrorConfig.MESSAGE.SESSION_INVALID);
            }

            if (!err && !Utils.toBoolean(req.session.user.postRegComplete)) {
                err = new Error(ErrorConfig.MESSAGE.COMPLETE_POST_REGISTRATION);
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
                return next(err);
            }
            var isAccountEnabled = Utils.toBoolean(req.session.user.isAccountEnabled);
            var isAccountActive = Utils.toBoolean(req.session.user.isAccountActive);

            if (!isAccountEnabled || !isAccountActive) {
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_DISABLED);
                err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
                return next(err);
            }
            UserApi.getUserByEmailMD(req.session.user.email, function (err, user) {
                if (err) {
                    err = new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return next(err);
                }
                if (!err && Constants.USER_STATUS.ACTIVE !== user.status) {
                    err = new Error(ErrorConfig.MESSAGE.USER_INACTIVE);
                }
                if (err) {
                    err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
                    return next(err);
                }
                var isAccountEnabled = Utils.toBoolean(user.isAccountEnabled);
                var isAccountActive = Utils.toBoolean(user.isAccountActive);

                if (!isAccountEnabled || !isAccountActive) {
                    err = new Error(ErrorConfig.MESSAGE.ACCOUNT_DISABLED);
                    err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
                    return next(err);
                }

                var lastResetPassword = user.lastResetPassword;
                if (lastResetPassword) {
                    var currentTimestamp = new Date().getTime();
                    var tenMinutes = 1 * 60 * 1000;
                    if (currentTimestamp - lastResetPassword <= tenMinutes && mode === Constants.VERIFICATION_MODE[0]) {
                        err = new Error(ErrorConfig.MESSAGE.RESET_REPETITIVE_REQUEST);
                        err.status = ErrorConfig.STATUS_CODE.FORBIDDEN;
                        return next(err);
                    }
                }
                req.user = user;
                return next();
            });
        } else {
            if (DataUtils.isUndefined(email)) {
                err = new Error(ErrorConfig.MESSAGE.EMAIL_REQ);
            } else if (!DataUtils.isValidEmail(email)) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_EMAIL);
            } else if (DataUtils.isUndefined(captcha)) {
                err = new Error(ErrorConfig.MESSAGE.CAPTCHA_REQUIRED);
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return next(err);
            }

            UserApi.getUserByEmailMD(email, function (err, user) {
                if (err) {
                    err = new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return next(err);
                }
                var isAccountEnabled = Utils.toBoolean(user.isAccountEnabled);
                var isAccountActive = Utils.toBoolean(user.isAccountActive);

                if (!isAccountEnabled || !isAccountActive) {
                    err = new Error(ErrorConfig.MESSAGE.ACCOUNT_DISABLED);
                    err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
                    return next(err);
                }
                if (Constants.USER_STATUS.ACTIVE !== user.status) {
                    err = new Error(ErrorConfig.MESSAGE.USER_INACTIVE);
                    err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
                    return next(err);
                }

                var lastResetPassword = user.lastResetPassword;
                if (lastResetPassword) {
                    var currentTimestamp = new Date().getTime();
                    var tenMinutes = 1 * 60 * 1000;
                    if (currentTimestamp - lastResetPassword <= tenMinutes && mode === Constants.VERIFICATION_MODE[0]) {
                        err = new Error(ErrorConfig.MESSAGE.RESET_REPETITIVE_REQUEST);
                        err.status = ErrorConfig.STATUS_CODE.FORBIDDEN;
                        return next(err);
                    }
                }
                req.user = user;
                req.flag = Constants.RE_CAPTCHA_FLAG.RESET_PASSWORD;
                return next();
            });
        }
    },

    postRegistrationUserAuthentication: function (req, res, next) {
        var err;
        if (Utils.toBoolean(req.user.postRegComplete)) {
            err = new Error(ErrorConfig.MESSAGE.POST_REG_COMPLETE);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
        }
        return next(err);
    },

    postRegistrationUserAuthenticationMD: function (req, res, next) {
        var err;
        if (!req.session || !req.session.user) {
            err = new Error(ErrorConfig.MESSAGE.SESSION_INVALID);
        }
        if (!err && !Utils.toBoolean(req.session.user.post_reg_complete)) {
            err = new Error(ErrorConfig.MESSAGE.POST_REG_COMPLETE);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
        }
        req.user = req.session.user;
        return next(err);
    },

    sessionAuthentication: function (req, res, next) {
        var err;
        if (!req.session || !req.session.user) {
            err = new Error(ErrorConfig.MESSAGE.SESSION_INVALID);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
        }
        req.user = req.session.user;
        return next(err);
    },

    isAccountEnabled: function (req, res, next) {
        var user = req.session.user;
        var isAccountActive = user.isAccountActive;
        var isAccountEnabled = user.isAccountEnabled;

        var err;
        if (!Utils.toBoolean(isAccountEnabled)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_DISABLED);
        } else if (!Utils.toBoolean(isAccountActive)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_NOT_INITIALISED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
            return next(err);
        }
        return next();
    },

    isAccountAdmin: function (req, res, next) {
        var user = req.session.user;
        var accountRoles = user.accountRoles || [];
        if (accountRoles.indexOf(Constants.ACCOUNT_ROLES.ADMIN) < 0) {
            var err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ADMIN_LOGIN_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
            return next(err);
        }
        return next();
    },

    isAccountAdminMD: async function (req, res, next) {
        var user = req.session.user;
        var userId = user.id;

        try {
            var conn = await connection.getConnection();
            var accountRoles = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id from user_roles ' +
              'where userId = uuid_to_bin(?) and roleId = (select id from Roles where title = ?)', [userId, Constants.ACCOUNT_OWNER_TITLE]);

            accountRoles = Utils.filteredResponsePool(accountRoles);

            if (!accountRoles) {
                var err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ADMIN_LOGIN_REQUIRED);
                err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
                return next(err);
            }
            return next();
        } catch (err) {
            debug('err', err);
            return next(err);
        }
    },

    validateToken: function (req, res, next) {
        req.body = req.body.options || req.body;
        var apiToken = req.body.apiToken;
        var err;

        if (_.isEmpty(apiToken) || DataUtils.isUndefined(apiToken)) {
            err = new Error(ErrorConfig.MESSAGE.TOKEN_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('err', err);
            return next(err);
        } else if (Constants.SCOPEHUB_API_TOKEN !== apiToken) {
            err = new Error(ErrorConfig.MESSAGE.INVALID_TOKEN);
            err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
            debug('err', err);
            return next(err);
        }
        return next();
    },

    validateTokenForGet: function (req, res, next) {
        var apiToken = req.query.apiToken;
        var err;

        if (_.isEmpty(apiToken) || DataUtils.isUndefined(apiToken)) {
            err = new Error(ErrorConfig.MESSAGE.TOKEN_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('err', err);
            return next(err);
        } else if (Constants.SCOPEHUB_API_TOKEN !== apiToken) {
            err = new Error(ErrorConfig.MESSAGE.INVALID_TOKEN);
            err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
            debug('err', err);
            return next(err);
        }
        return next();
    },

    validateFileUploadPublicKey: async function (req, res, next) {
        var uploadLog = req.uploadLog;
        var accountId = uploadLog.accountId;
        var fileUploadPublicKey = req.body.fileUploadPublicKey;
        var err;

        if (DataUtils.isUndefined(fileUploadPublicKey)) {
            err = new Error(ErrorConfig.MESSAGE.FILE_UPLOAD_PUBLIC_KEY_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('err', err);
            return next(err);
        }
        try {
            var conn = await connection.getConnection();

            var account = await conn.query('select fileUploadPublicKey from accounts where id = uuid_to_bin(?)', [accountId]);
            account = Utils.filteredResponsePool(account);

            if (account && account.fileUploadPublicKey !== fileUploadPublicKey) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_FILE_UPLOAD_PUBLIC_KEY);
                err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
                debug('err', err);
                return next(err);
            }
            return next();
        } catch (err) {
            debug('err', err);
            return next(err);
        }
    },

    validatePreSignedUrl: async function (req, res, next) {
        req.body = req.body.options || req.body;
        var preSignedUrl = req.body.preSignedUrl;
        var isMultipart = req.body.isMultipart;
        var fileName = req.body.fileName;
        var uploadLog;
        var err;

        if (DataUtils.isUndefined(fileName)) {
            err = new Error(ErrorConfig.MESSAGE.FILE_NAME_REQUIRED);
        } else if (DataUtils.isUndefined(preSignedUrl)) {
            err = new Error(ErrorConfig.MESSAGE.PRE_SIGNED_URL_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('err', err);
            return next(err);
        }

        try {
            var conn = await connection.getConnection();

            if (isMultipart) {
                uploadLog = await conn.query('select preSignedUrl from UploadPart where fileName=? and partNumber = 1;', [fileName]);
            } else {
                uploadLog = await conn.query('select preSignedUrl from UploadLog where fileName=?;', [fileName]);
            }
            uploadLog = Utils.filteredResponsePool(uploadLog);
            if (!uploadLog) {
                err = new Error(ErrorConfig.MESSAGE.FILE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug('err', err);
                return next(err);
            }

            /*if (isMultipart) {
                if (uploadLog.uploadId !== uploadId) {
                    err = new Error(ErrorConfig.MESSAGE.INVALID_UPLOAD_ID);
                }
            }
            else*/
            if (uploadLog.preSignedUrl !== preSignedUrl) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_PRE_SIGNED_URL);
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
                debug('err', err);
                return next(err);
            }
            return next();
        } catch (err) {
            debug('err', err);
            return next(err);
        }
    }
};

module.exports = Authentication;

(function () {
    if (require.main == module) {
    }
}());
