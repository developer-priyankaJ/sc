#!/usr/bin/env node
'use strict';

var debug = require('debug')('scopehub.route.user');
var Util = require('util');

var UserApi = require('../api/user');
var DataUtils = require('../lib/data_utils');
var ErrorUtils = require('../lib/error_utils');
var HeaderUtils = require('../lib/header_utils');
var AuditUtils = require('../lib/audit_utils');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');
var Events = require('../data/events');
var mockUser = require('../lib/mock_user');
var Utils = require('../lib/utils');

var camelcase = require('camelcase-keys');

function filterUser(user, isEnsurePostRegSteps) {
    var fields = [
        'id',
        'email',
        'firstName',
        'middleName',
        'lastName',
        'dateOfBirth',
        'languageCultureCode',
        'status',
        'statusReasonCode',
        'deviceAuthorised',
        'postRegComplete',
        'accessList',
        'roles',
        'settings',
        'isAdmin',
        'tokens',
        'postRegSteps',
        'createdAt',
        'updatedAt'
    ];

    if (user.permissions) {
        fields.push('permissions');
    }
    var clonedUser = {};
    fields.forEach(function (field) {
        if (user[field] != null) {
            clonedUser[field] = user[field];
        }
    });

    if (user.settings && user.settings.phone && user.settings.phone.phone) {
        clonedUser.settings.phone = clonedUser.settings.phone;
        clonedUser.settings.phone.phoneEndingWith = Constants.NUMBER_START_WITH + user.settings.phone.phone.substr(user.settings.phone.phone.length - 5);
    }
    if (user.settings && user.settings.secondaryMobileNumber && user.settings.secondaryMobileNumber.phone) {
        clonedUser.settings.secondaryMobileNumber = clonedUser.settings.secondaryMobileNumber;
        clonedUser.settings.secondaryMobileNumber.phoneEndingWith = Constants.NUMBER_START_WITH + user.settings.secondaryMobileNumber.phone.substr(user.settings.secondaryMobileNumber.phone.length - 5);
    }

    if (isEnsurePostRegSteps && clonedUser.settings && clonedUser.settings.phone && clonedUser.settings.phone.phone) {
        delete clonedUser.settings.phone.phone;
    }
    if (isEnsurePostRegSteps && clonedUser.settings && clonedUser.settings.secondaryMobileNumber && clonedUser.settings.secondaryMobileNumber.phone) {
        delete clonedUser.settings.secondaryMobileNumber.phone;
    }
    return clonedUser;
}

function filterUserMD(user, isEnsurePostRegSteps) {
    var fields = [
        'id',
        'accountId',
        'email',
        'firstName',
        'middleName',
        'lastName',
        'dateOfBirth',
        'languageCultureCode',
        'status',
        'statusReasonCode',
        'postRegComplete',
        'tosStatus',
        'tosUtcDateTime',
        'emailStatus',
        'emailLocalDeviceDateTime',
        'emailUtcDateTime',
        'primaryMobile',
        'primaryMobileCountry',
        'primaryMobileLocalDeviceDateTime',
        'primaryMobileUtcDateTime',
        'primaryMobileStatus',
        'primaryMobilePhoneEndingWith',
        'useForTwoFactor',
        'advancedAuthNumber',
        'secondaryMobile',
        'secondaryMobileCountry',
        'secondaryMobileLocalDeviceDateTime',
        'secondaryMobileUtcDateTime',
        'secondaryMobileDialCode',
        'secondaryMobileStatus',
        'secondaryMobilePhoneEndingWith',
        'isAdmin',
        'profileComplete',
        'encryptionStatus',
        'chatPublicKey',
        'chatPrivateKey',
        'ownerChatEncryptionStatus',
        'ownerChatPublicKey',
        'accountName',
        'roles',
        'warningFlag',
        'updatedAt'
    ];

    if (user.permissions) {
        fields.push('permissions');
    }
    var clonedUser = {};
    fields.forEach(function (field) {
        if (user[field] != null) {
            clonedUser[field] = user[field];
        }
    });

    if (user.primaryMobile) {
        clonedUser.primaryMobilePhoneEndingWith = Constants.NUMBER_START_WITH + user.primaryMobile.substr(user.primaryMobile.length - 5);
    }
    if (user.secondaryMobile) {
        clonedUser.secondaryMobilePhoneEndingWith = Constants.NUMBER_START_WITH + user.secondaryMobile.substr(user.secondaryMobile.length - 5);
    }
    /*if (isEnsurePostRegSteps && clonedUser.primaryMobile) {
        delete clonedUser.primaryMobile;
    }
    if (isEnsurePostRegSteps && clonedUser.secondaryMobile) {
        delete clonedUser.secondaryMobile;
    }
    debug('cloneUser', clonedUser);*/
    return clonedUser;
}

function manageUserSession(req, user, isLoggedIn, isEnsurePostRegSteps) {
    user['isLoggedIn'] = isLoggedIn;
    req.session.user = user;
    // deviceAuthorised is for 2nd Step Authentication using (SMS/Phone Call), It's on by default
    req.session.user.deviceAuthorised = true;
    //req.session.user.deviceAuthorised = req.session.deviceAuthorised || false;
    // req.data = filterUser(user, isEnsurePostRegSteps);
    req.data = filterUser(user, isEnsurePostRegSteps);
}

function manageUserSessionMD(req, user, isLoggedIn, isEnsurePostRegSteps) {
    user['isLoggedIn'] = isLoggedIn;
    req.session.user = user;
    // deviceAuthorised is for 2nd Step Authentication using (SMS/Phone Call), It's on by default
    req.session.user.deviceAuthorised = true;
    //req.session.user.deviceAuthorised = req.session.deviceAuthorised || false;
    // req.data = filterUser(user, isEnsurePostRegSteps);
    req.data = filterUserMD(user, isEnsurePostRegSteps);
}

function regenerateSession(req, cb) {
    req.session.regenerate(function (err) {
        return cb(err);
    });
}

var User = {
    loginMD: function (req, res, next) {
        var sendCount = 0;
        if (req.session) {
            sendCount = req.session.sendCount || 0;
        }

        var options = {
            email: DataUtils.toLowerCase(req.body.email),
            password: req.body.password,
            sendCount: sendCount
        };
        Util.log('Inside Login route');
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.LOGIN);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.loginMD(options, auditOptions, errorOptions, function (err, user) {
            if (err || !user) {
                req.session.sendCount += 1;
                //err = err || new Error(ErrorConfig.MESSAGE.LOGIN_INCORRECT);
                //err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                //debug('err.flag',err.flag)
                /*if (err.flag) {
                    req.session.user.status = 'inactive';
                }*/
                Util.log(err);
                return next(err);
            }
            regenerateSession(req, function (err) {
                manageUserSessionMD(req, user, true);
                //req.session.codeSendCount += 1;
                next();
            });
        });
    },

    saveMyProfileDetailMD: function (req, res, next) {
        var user = req.user;
        var options = {
            firstName: req.body.firstName,
            middleName: req.body.middleName,
            lastName: req.body.lastName,
            dateOfBirth: req.body.dateOfBirth,
            phone: req.body.phone,
            dialCode: req.body.dialCode,
            phoneCountry: req.body.phoneCountry,
            addressLine1: req.body.addressLine1,
            addressLine2: req.body.addressLine2,
            addressLine3: req.body.addressLine3,
            city: req.body.city,
            zipCode: req.body.zipCode,
            state: req.body.state,
            country: req.body.country,
            saveAsLater: req.body.saveAsLater,
            useExisting: req.body.useExisting,
            newLocationId: req.body.newLocationId,
            newLocationName: req.body.newLocationName,
            locationId: req.body.locationId,
            locationName: req.body.locationName,
            updatedAt: req.body.updatedAt,
            profilePicture: req.body.profilePicture,
            user: user
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.SAVE_MY_PROFILE_DETAIL);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.saveMyProfileDetailMD(options, auditOptions, errorOptions, function (err, user) {
            if (err) {
                debug(err);
                return next(err);
            }
            manageUserSessionMD(req, user, true);
            req.data = {
                updatedAt: user.updatedAt,
                OK: Constants.SUCCESS_MESSAGE.SAVE_PROFILE_SUCCESS
            };
            return next();
        });
    },

    getMyProfileDetailMD: function (req, res, next) {
        var user = req.user;
        var options = {
            user: user
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.GET_MY_PROFILE_DETAIL);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.getMyProfileDetailMD(options, auditOptions, errorOptions, function (err, response) {
            if (err || !response) {
                err = new Error(ErrorConfig.MESSAGE.GET_MY_PROFILE_DETAIL_FAILED);
                debug('err ', err);
                return next(err);
            }
            req.data = response;
            return next();
        });
    },

    setRememberMD: function (req, res, next) {
        /*if (!req.body.isLogin) {
            return next();
        }*/
        var remember = req.body.remember && JSON.parse(req.body.remember) || false;
        if (!remember) {
            res.clearCookie(Constants.REMEMBER_COOKIE_PARAM);
            return next();
        }
        var options = {
            email: req.session.user.email,
            userId: req.session.user.id
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.setRememberMD(options, errorOptions, function (err, token) {
            if (err || !token) {
                // Ignoring Remember request
                return next();
            }
            res.cookie(Constants.REMEMBER_COOKIE_PARAM, token, {maxAge: 7 * 24 * 60 * 60 * 1000});
            next();
        });
    },

    loginResponse: function (user) {
        var advancedAuthNumberEndingWith;
        var advancedAuthCountry;
        if (user.advancedAuthNumber === '1') {
            advancedAuthNumberEndingWith = user.primaryMobilePhoneEndingWith;
            advancedAuthCountry = user.primaryMobileCountry;
        } else if (user.advancedAuthNumber === '2') {
            advancedAuthNumberEndingWith = user.secondaryMobilePhoneEndingWith;
            advancedAuthCountry = user.secondaryMobileCountry;
        } else {
            advancedAuthNumberEndingWith = '';
            advancedAuthCountry = '';
        }

        var options = {
            id: user.id,
            accountId: user.accountId,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            colorCode: user.colorCode,
            languageCultureCode: user.languageCultureCode,
            status: user.status,
            statusReasonCode: user.statusReasonCode,
            postRegComplete: user.postRegComplete,
            tosStatus: user.tosStatus,
            emailStatus: user.emailStatus,
            advancedAuthNumber: user.advancedAuthNumber,
            advancedAuthNumberEndingWith: advancedAuthNumberEndingWith,
            advancedAuthCountry: advancedAuthCountry,
            uploadTabFlag: user.uploadTabFlag,
            productUoMFlag: user.productUoMFlag,
            notifyFlag: user.notifyFlag,
            profileComplete: user.profileComplete,
            ownerCountry: user.ownerCountry,
            roles: user.roles,
            navBarViewFlag: user.navBarViewFlag,
            menuFlag: JSON.parse(user.menuFlag),
            warningFlag: JSON.parse(user.warningFlag),
            accountName: user.account.accountName,
            encryptionStatus: user.encryptionStatus,
            chatPublicKey: user.chatPublicKey,
            chatPrivateKey: user.chatPrivateKey,
            ownerChatPublicKey: user.ownerChatPublicKey,
            ownerChatEncryptionStatus: user.ownerChatEncryptionStatus,
            profilePicture: user.profilePicture.toString()
        };
        return options;
    },

    ensurePostRegStepsMD: function (req, res, next) {
        var options = {
            user: req.session.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.ensurePostRegStepsMD(options, errorOptions, function (err, user) {
            if (err || !user) {
                err = err || new Error(ErrorConfig.MESSAGE.LOGIN_INCORRECT);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return next(err);
            }
            manageUserSessionMD(req, user, true, true);
            req.data = User.loginResponse(user);
            next();
        });
    },

    isPostRegCompleteMD: function (req, res, next) {
        var options = {
            user: req.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.isPostRegCompleteMD(options, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = Constants.OK_MESSAGE;
            next();
        });
    },

    validateFieldsMD: function (req, res, next) {
        var body = req.body;
        var options = {
            email: DataUtils.toLowerCase(body.email),
            firstName: body.firstName,
            lastName: body.lastName,
            password: body.password,
            confirmPassword: body.confirmPassword,
            languageCultureCode: body.languageCultureCode,
            captcha: body['g-recaptcha-response'],
            accountName: body.accountName,
            host: Constants.HTTPS_PROTOCOL + req.headers.host
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.validateFieldsMD(options, errorOptions, function (err) {
            if (err) {
                debug('err ', err);
                Util.log(err);
                return next(err);
            }
            req.flag = Constants.RE_CAPTCHA_FLAG.SIGNUP;
            next();
        });
    },

    checkColorCombination: function (req, res, next) {
        var options = {
            firstName: req.body.firstName,
            lastName: req.body.lastName
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.checkColorCombination(options, errorOptions, function (err, response) {
            if (err) {
                debug('err ', err);
                Util.log(err);
                return next(err);
            }
            if (response) {
                req.colorCode = response.colorCode;
            }
            debug('req.colorCode', req.colorCode);
            next();
        });
    },

    validateEmailFields: function (req, res, next) {
        var options = {
            email: DataUtils.toLowerCase(req.body.email)
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.validateEmailFields(options, errorOptions, function (err) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            next();
        });
    },

    getAllAuthorizedUserMD: function (req, res, next) {
        var user = req.user;
        var options = {
            user: user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.GET_ALL_AUTHORIZE_USER);
        UserApi.getAllAuthorizedUserMD(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    getAuthorizedUserMD: function (req, res, next) {
        var userId = req.query.userId;
        var options = {
            userId: userId
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.GET_AUTHORIZE_USER_BY_USER_ID);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.getAuthorizedUserMD(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    updateAuthorizedUserMD: function (req, res, next) {
        var user = req.user;
        var options = {
            user: user,
            id: req.body.id,
            userId: user.id,
            accountId: user.accountId,
            firstName: req.body.firstName,
            email: req.body.email,
            middleName: req.body.middleName,
            lastName: req.body.lastName,
            dateOfBirth: req.body.dateOfBirth,
            phone: req.body.phone,
            dialCode: req.body.dialCode,
            phoneCountry: req.body.phoneCountry,
            primaryMobile: req.body.primaryMobile,
            primaryMobileDialCode: req.body.primaryMobileDialCode,
            primaryMobileCountry: req.body.primaryMobileCountry,
            secondaryMobile: req.body.secondaryMobile,
            secondaryMobileDialCode: req.body.secondaryMobileDialCode,
            secondaryMobileCountry: req.body.secondaryMobileCountry,
            addressLine1: req.body.addressLine1,
            addressLine2: req.body.addressLine2,
            addressLine3: req.body.addressLine3,
            city: req.body.city,
            state: req.body.state,
            zipCode: req.body.zipCode,
            country: req.body.country,
            roles: req.body.roles,
            updatedAt: req.body.updatedAt
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_AUTHORIZE_USER);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.updateAuthorizedUserMD(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.authUser = response;
            next();
        });
    },

    updateRolesMD: function (req, res, next) {
        var options = {
            user: req.user,
            id: req.body.id,
            oldRoles: req.body.roles,
            addRoles: req.body.addRoles,
            removeRoles: req.body.removeRoles,
            authUser: req.authUser
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.updateRolesMD(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    cancelMD: function (req, res, next) {
        var user = req.user;
        var options = {
            userId: req.body.userId,
            updatedAt: req.body.updatedAt,
            user: user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.CANCEL_USER_INVITATION);
        UserApi.cancelMD(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                //Util.log(err);
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    deActivateMD: function (req, res, next) {
        var user = req.user;
        var isCancel = req.body.isCancel;
        var options = {
            userId: req.body.userId,
            authUser: req.body.authUser,
            updatedAtBody: req.body.updatedAt,
            isCancel: isCancel,
            user: user

        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.DEACTIVATE_AUTHORIZE_USER);
        UserApi.deActivateMD(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    cancelUserMD: function (req, res, next) {
        var user = req.user;
        var options = {
            userId: req.body.userId,
            updatedAt: req.body.updatedAt,
            user: user

        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.DEACTIVATE_AUTHORIZE_USER);
        UserApi.cancelUserMD(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            if (response.isCancel) {
                req.body.isCancel = true;
            }
            req.body.authUser = response;
            next();
        });
    },

    validateUserIdMD: function (req, res, next) {
        var userId = req.body.userId;
        var user = req.user;
        var options = {
            userId: userId,
            user: user

        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.validateUserIdMD(options, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.userExist = response;
            req.body.email = response.email;
            next();
        });
    },

    reInviteMD: function (req, res, next) {
        var user = req.user;
        var userExist = req.userExist;
        var options = {
            user: user,
            userExist: userExist,
            userId: req.body.userId,
            updatedAt: req.body.updatedAt
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.RE_SEND_INVITATION_AUTHORIZE_USER);
        UserApi.reInviteMD(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    signupMD: function (req, res, next) {
        var options = {
            email: DataUtils.toLowerCase(req.body.email),
            password: req.body.password,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            confirmPassword: req.body.confirmPassword,
            languageCultureCode: req.body.languageCultureCode,
            captcha: req.body.captcha,
            planType: req.body.planType,
            accountName: req.body.accountName,
            host: Constants.HTTPS_PROTOCOL + req.headers.host,
            colorCode: req.colorCode
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.SIGN_UP);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.signupMD(options, auditOptions, errorOptions, function (err, user, isUserAffected) {
            if (err || !user) {
                debug('err', err);
                err = err || new Error(ErrorConfig.MESSAGE.USER_SIGNUP_FAILED);
                Util.log(err);
                return next(err);
            }
            if (!isUserAffected) {
                req.userExist = user;
            } else {
                req.body.user = user;
            }
            next();
        });
    },

    createAccountMD: function (req, res, next) {
        var userExist = req.userExist;
        if (userExist) {
            req.body.accountId = userExist.accountId;
            return next();
        }
        var options = {
            user: req.body.user
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.createAccountMD(options, errorOptions, function (err, account) {
            if (err) {
                Util.log(err);
                return next(err);
            }
            req.body.accountId = account.id;
            next();
        });
    },

    updateUserMD: function (req, res, next) {
        var user = req.body.user;
        var accountId = req.body.accountId;
        var userExist = req.userExist;
        var options = {
            user: user,
            accountId: accountId,
            userExist: userExist
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.updateUserMD(options, errorOptions, function (err, user) {
            if (err || !user) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.USER_SIGNUP_FAILED);
                Util.log(err);
                return next(err);
            }
            //manageUserSessionMD(req, user, true);
            req.data = Constants.OK_MESSAGE;
            next();
        });
    },

    deleteUserMD: function (req, res, next) {
        var options = {
            user: req.user
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.SIGN_UP_CANCELLATION);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.deleteUserMD(options, auditOptions, errorOptions, function (err, user) {
            if (err) {
                return next(err);
            }
            req.user = user;
            return next();
        });
    },

    deleteUserRolesMD: function (req, res, next) {
        var options = {
            user: req.user
        };
        /*var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.SIGN_UP_CANCELLATION);*/
        UserApi.deleteUserRolesMD(options, function (err, user) {
            if (err) {
                return next(err);
            }
            req.data = Constants.OK_MESSAGE;
            return next();
        });
    },

    deleteSession: function (req, res, next) {
        regenerateSession(req, function (err) {
            return next();
        });
    },

    getLoginUser: function (req, res, next) {
        var user = req.user;
        req.data = filterUserMD(user);
        next();
    },

    getPhoneFromAAN: function (user) {
        if (user.advancedAuthNumber === Constants.ADVANCED_AUTH_NUMBER.MOBILE_1) {
            return user.primaryMobile;
        } else if (user.advancedAuthNumber === Constants.ADVANCED_AUTH_NUMBER.MOBILE_2) {
            return user.secondaryMobile;
        }
        return;
    },

    verifyPhoneMD: function (req, res, next) {
        var sendToAAN = req.body.sendToAAN;
        var phone;

        if (sendToAAN) {
            phone = User.getPhoneFromAAN(req.user);
        } else {
            phone = req.body.phone;
        }

        var options = {
            user: req.user,
            phone: phone,
            mode: req.body.mode,
            isPrimary: req.body.isPrimary,
            sendToAAN: sendToAAN
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, req.eventId);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.verifyPhoneMD(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                if (err.flag) {
                    req.user.status = 'inactive';
                }
                return next(err);
            }
            req.session.code = response.hashedCode;
            req.session.phoneCodeConfirmCount = 0;
            req.session.codeSendTime = new Date();
            req.data = {
                OK: response.OK,
                attempts: response.attempts
            };
            next();
        });
    },

    rememberMD: function (req, res, next) {
        var token = req.cookies[Constants.REMEMBER_COOKIE_PARAM];
        UserApi.getUserByRememberTokenMD(token, function (err, user) {
            req.data = {};
            if (user) {
                // Audit Log
                var auditOptions = {
                    userId: user.id
                };
                HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.REMEMBER_ME);
                AuditUtils.create(auditOptions);
                req.data = filterUserMD(user);
            }
            next();
        });
    },

    rememberDeviceMD: async function (req, res, next) {
        var options = {
            token: req.cookies[Constants.REMEMBER_DEVICE_COOKIE_PARAM]
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.getUserByRememberDeviceTokenMD(options, errorOptions, function (err, user) {
            if (user) {
                user = user.attrs;
                if (user && user.email === DataUtils.toLowerCase(req.body.email)) {
                    req.session.deviceAuthorised = true;
                    manageUserSessionMD(req, user, true);
                }
            }
            return next();
        });

    },

    saveSecurityQuestionsMD: function (req, res, next) {
        var user = req.user;
        var options = {
            user: user,
            questions: req.body.questions,
            deviceDateTime: req.body.deviceDateTime
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.SAVE_SECURITY_QUESTION_POST_REG);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.saveSecurityQuestionsMD(options, auditOptions, errorOptions, function (err, user) {
            if (err || !user) {
                err = err || new Error(ErrorConfig.MESSAGE.BAD_REQUEST);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug(err);
                Util.log(err);
                return next(err);
            }
            manageUserSession(req, user, true);
            req.data = filterUser(user);
            next();
        });
    },

    setVerificationOptionMD: function (req, res, next) {
        var user = req.user;
        var options = {
            user: user,
            verificationOption: req.body.verificationOption
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.SET_USER_VERIFICATION_OPTION);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.setVerificationOptionMD(options, auditOptions, errorOptions, function (err, user) {
            if (err || !user) {
                err = new Error(ErrorConfig.MESSAGE.USER_VERIFICATION_OPTION_PREFERENCE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                debug(err);
                Util.log(err);
                return next(err);
            }
            req.data = {Ok: 'Success'};
            next();
        });
    },

    setLanguageMD: function (req, res, next) {
        var user = req.user;
        var options = {
            user: user,
            languageCultureCode: req.body.languageCultureCode
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.SET_USER_LANGUAGE_PREFERENCE);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.setLanguageMD(options, auditOptions, errorOptions, function (err, user) {
            if (err || !user) {
                err = new Error(ErrorConfig.MESSAGE.USER_LANGUAGE_PREFERENCE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                debug(err);
                Util.log(err);
                return next(err);
            }
            req.session.user.languageCultureCode = user.languageCultureCode;
            req.data = filterUserMD(user);
            next();
        });
    },

    resetPasswordInitiateMD: function (req, res, next) {
        var options = {
            mode: req.body.mode,
            fromLogin: req.body.fromLogin,
            user: req.user
        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.RESET_PASSWORD_INITIATE);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.resetPasswordInitiateMD(options, auditOptions, errorOptions, function (err, response) {
            if (err || !response) {
                err = err || new Error(ErrorConfig.MESSAGE.USER_RESET_PASSWORD_INITIATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                Util.log(err);
                return next(err);
            }
            //req.session.user = response.user;
            req.session.code = response.hashedCode;
            req.session.codeVerified = false;
            req.session.startTime = new Date().getTime();
            req.data = {
                OK: response.OK,
                attempts: response.attempts
            };
            next();
        });
    },

    resendCodePasswordMD: function (req, res, next) {
        var options = {
            user: req.user,
            mode: req.body.mode
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.RESET_PASSWORD_INITIATE);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.resendCodePasswordMD(options, auditOptions, errorOptions, function (err, response) {
            if (err || !response) {
                if (err.flag) {
                    req.user.status = 'inactive';
                }
                err = err || new Error(ErrorConfig.MESSAGE.USER_RESET_PASSWORD_RESEND);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                Util.log(err);
                return next(err);
            }
            //req.session.user = response.user;
            req.session.code = response.hashedCode;
            req.session.codeVerified = false;
            req.session.startTime = new Date().getTime();
            req.data = {
                OK: response.OK,
                attempts: response.attempts
            };
            next();
        });
    },

    acceptTOSMD: function (req, res, next) {
        var user = req.user;
        var options = {
            user: user,
            deviceDateTime: req.body.deviceDateTime,
            email: req.body.email
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.TOS_ACCEPT_POST_REG);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.acceptTOSMD(options, auditOptions, errorOptions, function (err, user) {
            if (err) {
                debug(err);
                err = new Error(ErrorConfig.MESSAGE.ACCEPT_TOS_FAILED);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                Util.log(err);
                return next(err);
            }
            req.data = {
                tosStatus: 1,
                email: user.email
            };
            next();
        });
    },

    verifyEmailMD: function (req, res, next) {
        var user = req.user;

        var options = {
            skipStatusCheck: req.body.skipStatusCheck,
            skipEmailCheck: req.body.skipEmailCheck,
            user: user,
            userExist: req.userExist
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.VERIFY_EMAIL_POST_REG_CODE_GENERATION);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.verifyEmailMD(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                Util.log('err', err);
                if (err.flag) {
                    req.user.status = 'inactive';
                }
                return next(err);
            }
            req.session.code = response.hashedCode;
            req.session.codeSendTime = new Date();
            req.data = {
                OK: response.OK,
                attempts: response.attempts
            };
            next();
        });
    },

    verifyUserEmailMD: function (req, res, next) {
        var user = req.user;
        var email = req.body.email;
        var confirmEmail = req.body.confirmEmail;

        var options = {
            skipStatusCheck: req.body.skipStatusCheck,
            skipEmailCheck: req.body.skipEmailCheck,
            user: user,
            email: email,
            confirmEmail: confirmEmail,
            userExist: req.userExist
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.VERIFY_EMAIL_POST_REG_CODE_GENERATION);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.verifyUserEmailMD(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                if (err.flag) {
                    req.user.status = 'inactive';
                }
                return next(err);
            }
            req.session.code = response.hashedCode;
            req.session.codeSendTime = new Date();
            req.data = {
                OK: response.OK,
                attempts: response.attempts
            };
            next();
        });
    },

    verifyCodeMD: async function (req, res, next) {
        var code = req.body.code && String(req.body.code);
        var actualCode = req.session.code;
        var codeSendTime = req.session.codeSendTime;

        var options = {
            user: req.user,
            code: code,
            actualCode: actualCode,
            codeSendTime: codeSendTime,
            flag: req.flag,
            newPassword: req.body.newPassword,
            fromLogin: req.body.fromLogin
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.VERIFY_CONFIRM_CODE);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.verifyCodeMD(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                if (err.flag) {
                    req.user.status = 'inactive';
                }
                return next(err);
            }
            req.session.codeVerified = true;
            req.data = response;
            next();
        });
    },

    confirmResetPasswordVerificationMD: function (req, res, next) {
        var options = {
            user: req.user,
            newPassword: req.body.newPassword,
            fromLogin: req.body.fromLogin
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.confirmResetPasswordVerificationMD(options, errorOptions, function (err, user) {
            if (err) {
                err = err || new Error(ErrorConfig.MESSAGE.VERIFY_EMAIL_CONFIRM_FAILED);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                return next(err);
            }
            // manageUserSessionMD(req, user, true);
            req.data = user;
            next();
        });
    },

    confirmEmailVerificationMD: function (req, res, next) {
        var options = {
            user: req.user,
            deviceDateTime: req.body.deviceDateTime
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.confirmEmailVerificationMD(options, errorOptions, function (err, user) {
            if (err) {
                err = err || new Error(ErrorConfig.MESSAGE.VERIFY_EMAIL_CONFIRM_FAILED);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                return next(err);
            }
            next();
        });
    },

    confirmUserEmailVerificationMD: function (req, res, next) {
        var options = {
            user: req.user,
            updatedAt: req.body.updatedAt
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.confirmUserEmailVerificationMD(options, errorOptions, function (err, user) {
            if (err || !user) {
                err = err || new Error(ErrorConfig.MESSAGE.VERIFY_EMAIL_CONFIRM_FAILED);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                return next(err);
            }
            manageUserSessionMD(req, user, true);
            req.data = {updatedAt: user.updatedAt};
            next();
        });
    },

    confirmPhoneVerificationMD: function (req, res, next) {
        var fromLogin = req.body.fromLogin;
        var options = {
            user: req.user,
            isPrimary: req.body.isPrimary,
            fromLogin: fromLogin
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.confirmPhoneVerificationMD(options, errorOptions, function (err, user) {
            if (err || !user) {
                err = err || new Error(ErrorConfig.MESSAGE.VERIFY_EMAIL_CONFIRM_FAILED);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                return next(err);
            }
            manageUserSessionMD(req, user, true, true);
            if (fromLogin) {
                req.data = User.loginResponse(user);
            } else {
                req.data = {
                    Ok: Constants.SUCCESS,
                    updatedAt: user.updatedAt
                };
            }
            req.session.codeSendCount = 0;
            next();
        });
    },

    resetPasswordMD: function (req, res, next) {
        var options = {
            user: req.user,
            email: req.body.email,
            password: req.body.password,
            confirmPassword: req.body.confirmPassword,
            codeVerified: req.session.codeVerified
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.RESET_PASSWORD);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.resetPasswordMD(options, auditOptions, errorOptions, function (err) {
            if (err) {
                Util.log(err);
                err.status = err.status < 500 ? err.status : ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return next(err);
            }
            req.data = Constants.OK_MESSAGE;
            next();
        });
    },

    closeAccount: function (req, res, next) {
        var options = {
            userId: req.user.id,
            tos_decline: req.body.tos_decline,
            user_request: req.body.user_request
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.CLOSE_ACCOUNT);
        UserApi.closeAccount(options, auditOptions, function (err) {
            if (err) {
                return next(err);
            }
            regenerateSession(req, function (err) {
                req.data = Constants.OK_MESSAGE;
                return next();
            });
        });
    },

    getResetSecurityQuestions: function (req, res, next) {
        var options = {
            email: DataUtils.toLowerCase(req.body.email)
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.RESET_PASSWORD_INITIATE_SECURITY_QUESTIONS);
        UserApi.getResetSecurityQuestions(options, auditOptions, function (err, response) {
            if (err || !response) {
                err = err || new Error(ErrorConfig.MESSAGE.VERIFY_EMAIL_INITIATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                Util.log(err);
                return next(err);
            }
            req.session.user = options.user;
            var securityData = response.security_data;
            req.session.savedAnswers = securityData.answers;
            req.session.codeVerified = false;
            req.data = securityData.questions;
            return next();
        });
    },

    verifyResetSecurityQuestions: function (req, res, next) {
        var codeVerificationCount = req.session.codeVerificationCount || 0;
        codeVerificationCount += 1;
        var err;
        if (codeVerificationCount > 3) {
            err = new Error(ErrorConfig.MESSAGE.CODE_VERIFICATION_ATTEMPT_EXCEEDED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return next(err);
        }
        req.session.codeVerificationCount = codeVerificationCount;

        var answers = req.body.answers || [];
        var savedAnswers = req.session.savedAnswers;
        var correctAnswer = false;
        savedAnswers.forEach(function (savedAnswer) {
            var id = savedAnswer.id;
            var actualAnswer = savedAnswer.answer && savedAnswer.answer.toLowerCase();
            answers.some(function (answer) {
                if (answer.id == id) {
                    var ans = answer.answer || '';
                    correctAnswer = ans.toLowerCase() == actualAnswer;
                    return true;
                } else {
                    return false;
                }
            });
        });
        if (!correctAnswer) {
            err = new Error(ErrorConfig.MESSAGE.INVALID_SECURITY_ANSWERS);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return next(err);
        }
        req.session.codeVerified = true;
        req.session.codeVerificationCount = 0;
        req.data = Constants.OK_MESSAGE;

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.RESET_PASSWORD_INITIATE_SECURITY_QUESTIONS);
        AuditUtils.create(auditOptions);
        return next();
    },

    getUsers: function (req, res, next) {
        var options = {
            limit: req.query.limit,
            filterKey: req.query.filterKey,
            filterValue: req.query.filterValue,
            lastKey: req.query.lastKey
        };
        UserApi.getUsers(options, function (err, response) {
            if (err || !response) {
                err = err || new Error(ErrorConfig.MESSAGE.GET_USER_FAILED);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                debug(err);
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    list: function (req, res, next) {
        UserApi.list(function (err, response) {
            if (err || !response) {
                err = err || new Error(ErrorConfig.MESSAGE.GET_USER_FAILED);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                Util.log(err);
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    updateUserByAdmin: function (req, res, next) {
        var options = {
            id: req.body.id,
            email: DataUtils.toLowerCase(req.body.email),
            firstName: req.body.firstName,
            middleName: req.body.middleName,
            lastName: req.body.lastName,
            dateOfBirth: req.body.dateOfBirth,
            phone: req.body.phone,
            verificationOption: req.body.verificationOption,
            languageCultureCode: req.body.languageCultureCode,
            status: req.body.status,
            statusReasonCode: req.body.statusReasonCode,
            isAdmin: req.body.isAdmin,
            roles: req.body.roles
        };

        // Adding the userId
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.ADMIN_UPDATE_USER);
        auditOptions.userId = options.id;
        auditOptions.metaData = {
            admin_id: req.user.id
        };

        UserApi.updateUserByAdmin(options, auditOptions, function (err, user) {
            if (err || !user) {
                err = err || new Error(ErrorConfig.MESSAGE.GET_USER_FAILED);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                Util.log(err);
                return next(err);
            }
            req.data = user;
            next();
        });
    },

    updateUserPhoneMD: function (req, res, next) {
        var options = {
            user: req.user,
            primaryMobile: req.body.phone,
            primaryDialCode: req.body.dialCode,
            primaryMobileCountry: req.body.country,
            action: req.body.action,
            updatedAt: req.body.updatedAt,
            useForTwoFactor: req.body.useForTwoFactor,
            primaryMobileLocalDeviceDateTime: req.body.deviceDateTime,
            passwordVerified: req.session.passwordVerified,
            passwordVerifiedTime: req.session.passwordVerifiedTime
        };
        // Adding the userId
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.USER_UPDATE_PHONE);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.updateUserPhoneMD(options, auditOptions, errorOptions, function (err, user) {
            if (err || !user) {
                Util.log(err);
                return next(err);
            }
            regenerateSession(req, function (err) {
                manageUserSessionMD(req, user, true, true);
                req.data = {
                    updatedAt: user.updatedAt,
                    OK: user.success
                };
                next();
            });
        });
    },

    updateAdvancedAuthNumberMD: function (req, res, next) {
        var options = {
            user: req.user,
            advancedAuthNumber: req.body.advancedAuthNumber,
            updatedAt: req.body.updatedAt,
            passwordVerified: req.session.passwordVerified,
            passwordVerifiedTime: req.session.passwordVerifiedTime
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.UPDATE_ADVANCED_AUTHENTICATION_NUMBER);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.updateAdvancedAuthNumberMD(options, auditOptions, errorOptions, function (err, user) {
            if (err || !user) {
                Util.log(err);
                return next(err);
            }
            regenerateSession(req, function (err) {
                manageUserSessionMD(req, user, true, true);

                req.data = {
                    updatedAt: user.updatedAt,
                    OK: user.success
                };
                next();
            });
        });
    },

    updateSecondaryNumberMD: function (req, res, next) {
        var options = {
            user: req.user,
            secondaryMobile: req.body.phone,
            secondaryDialCode: req.body.dialCode,
            secondaryMobileCountry: req.body.country,
            action: req.body.action,
            updatedAt: req.body.updatedAt,
            useForTwoFactor: req.body.useForTwoFactor,
            secondaryMobileLocalDeviceDateTime: req.body.deviceDateTime,
            passwordVerified: req.session.passwordVerified,
            passwordVerifiedTime: req.session.passwordVerifiedTime
        };

        // Adding the userId
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.USER_UPDATE_SECONDARY_NUMBER);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.updateSecondaryNumberMD(options, auditOptions, errorOptions, function (err, user) {
            if (err || !user) {
                Util.log(err);
                return next(err);
            }
            regenerateSession(req, function (err) {
                manageUserSessionMD(req, user, true, true);
                req.data = {
                    updatedAt: user.updatedAt,
                    OK: user.success
                };
                next();
            });
        });
    },

    updateUserEmailMD: function (req, res, next) {
        var options = {
            id: req.user.id,
            user: req.user,
            confirmEmail: req.body.confirmEmail,
            newEmail: req.body.newEmail,
            deviceDateTime: req.body.deviceDateTime,
            updatedAt: req.body.updatedAt,
            passwordVerified: req.session.passwordVerified,
            passwordVerifiedTime: req.session.passwordVerifiedTime,
            userExist: req.userExist
        };
        // Adding the userId
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.USER_UPDATE_EMAIL);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.updateUserEmailMD(options, auditOptions, errorOptions, function (err, user) {
            if (err || !user) {
                Util.log(err);
                return next(err);
            }
            regenerateSession(req, function (err) {
                manageUserSessionMD(req, user, true, true);
                req.data = {
                    updatedAt: user.updatedAt,
                    OK: Constants.SUCCESS_MESSAGE.UPDATE_EMAIL_SUCCESS
                };
                next();
            });
        });
    },

    deactivateUserMD: function (req, res, next) {
        var options = {
            user: req.user,
            deactivateUserId: req.body.deactivateUserId,
            status: Constants.USER_STATUS.INACTIVE,
            statusReasonCode: Constants.USER_INACTIVE_REASON_CODES.BLOCKED_BY_ADMIN.CODE
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.USER_DEACTIVATED);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.deactivateUserMD(options, auditOptions, errorOptions, function (err, data) {
            if (err) {
                Util.log(err);
                return next(err);
            }
            req.data = data;
            next();
        });
    },

    activateUserMD: function (req, res, next) {
        var options = {
            user: req.user,
            activateUserId: req.body.activateUserId,
            status: Constants.USER_STATUS.ACTIVE,
            statusReasonCode: Constants.USER_INACTIVE_REASON_CODES.DEFAULT.CODE
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.USER_ACTIVATED);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.activateUserMD(options, auditOptions, errorOptions, function (err, data) {

            if (err) {
                Util.log(err);
                return next(err);
            }
            req.data = data;
            next();
        });
    },

    verifyPasswordMD: function (req, res, next) {
        var options = {
            email: req.user.email,
            password: req.body.password
        };

        UserApi.verifyPasswordMD(options, function (err, user) {
            if (err) {
                return next(err);
            }
            req.session.passwordVerified = true;
            req.session.passwordVerifiedTime = new Date().getTime();
            req.data = Constants.OK_MESSAGE;
            return next();
        });
    },

    validatePasswordMD: function (req, res, next) {
        var options = {
            email: req.user.email,
            currentPassword: req.body.currentPassword,
            newPassword: req.body.newPassword,
            confirmPassword: req.body.confirmPassword
        };

        UserApi.validatePasswordMD(options, function (err, user) {
            if (err) {
                return next(err);
            }
            req.session.passwordVerified = true;
            req.session.passwordVerifiedTime = new Date().getTime();
            req.data = user;
            return next();
        });
    },

    userExistsMD: function (req, res, next) {
        var options = {
            email: DataUtils.toLowerCase(req.body.email)
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.userExistsMD(options, errorOptions, function (err, user) {
            if (err) {
                debug('err ', err);
                return next(err);
            }
            req.userExist = user;
            next();
        });
    },

    getUserMD: function (req, res, next) {
        var options = {
            email: req.body.email
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.ADMIN_GET_USERS);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.getUserMD(options, auditOptions, errorOptions, function (err, user) {
            if (err) {
                return next(err);
            }
            req.data = user;
            next();
        });
    },

    updateNotificationFlag: function (req, res, next) {
        var options = {
            id: req.user.id,
            user: req.user,
            notifications: req.body.notifications,
            navBarViewFlag: req.body.navBarViewFlag,
            menuFlag: req.body.menuFlag
        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.USER_UPDATE_NOTIFICATION_FLAG);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.updateNotificationFlag(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    setDefaultNotificationFlag: function (req, res, next) {
        var options = {
            id: req.user.id,
            user: req.user,
            defaultFlag: true,
            notifications: Constants.DEFAULT_NOTIFICATION_SETTINGS
        };

        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.USER_SET_DEFAULT_NOTIFICATION_FLAG);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.updateNotificationFlag(options, auditOptions, errorOptions, function (err, response) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.data = response;
            next();
        });

    },

    getNotificationFlag: function (req, res, next) {
        var options = {
            userId: req.user.id
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;

        UserApi.getNotificationFlag(options, errorOptions, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    createMD: function (req, res, next) {
        var user = req.user;
        var options = {
            email: DataUtils.toLowerCase(req.body.email),
            user: user,
            languageCultureCode: user.languageCultureCode,
            accountId: user.accountId,
            userId: user.id,
            firstName: req.body.firstName,
            middleName: req.body.middleName,
            lastName: req.body.lastName,
            dateOfBirth: req.body.dateOfBirth,
            phone: req.body.phone,
            dialCode: req.body.dialCode,
            phoneCountry: req.body.phoneCountry,
            primaryMobile: req.body.primaryMobile,
            primaryMobileDialCode: req.body.primaryMobileDialCode,
            primaryMobileCountry: req.body.primaryMobileCountry,
            secondaryMobile: req.body.secondaryMobile,
            secondaryMobileDialCode: req.body.secondaryMobileDialCode,
            secondaryMobileCountry: req.body.secondaryMobileCountry,
            addressLine1: req.body.addressLine1,
            addressLine2: req.body.addressLine2,
            addressLine3: req.body.addressLine3,
            city: req.body.city,
            state: req.body.state,
            zipCode: req.body.zipCode,
            country: req.body.country,
            roles: req.body.roles
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.ADD_AUTHORIZE_USER);
        UserApi.createMD(options, auditOptions, errorOptions, function (err, user) {
            if (err) {
                return next(err);
            }
            req.authUser = user;
            next();
        });
    },

    assignRole: function (req, res, next) {
        var authUser = req.authUser;
        var options = {
            user: req.user,
            authUser: authUser,
            roles: req.body.roles
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.assignRole(options, errorOptions, function (err, user) {
            if (err) {
                return next(err);
            }
            req.data = {
                OK: Constants.SUCCESS_MESSAGE.AUTHORIZE_USER_CREATE_SUCCESS,
                authorizeUserStatus: user.authorizeUserStatus,
                id: user.id,
                createdAt: user.createdAt ? user.createdAt : user.updatedAt
            };
            next();
        });
    },

    declineAuthorizedUserInvitationMD: function (req, res, next) {
        var user = req.user;
        var options = {
            user: user,
            userEmail: req.body.userEmail,
            authUserEmail: req.body.authUserEmail
            //updatedAt: req.body.updatedAt
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.DECLINE_USER_INVITATION);
        UserApi.declineAuthorizedUserInvitationMD(options, auditOptions, errorOptions, function (err, user) {
            if (err) {
                return next(err);
            }
            req.data = user;
            next();
        });
    },

    userExistsWithNewMailMD: function (req, res, next) {
        var options = {
            email: DataUtils.toLowerCase(req.body.email),
            skipEmailCheck: req.body.skipEmailCheck
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.userExistsWithNewMailMD(options, errorOptions, function (err, user) {
            if (err) {
                Util.log('err userExistsWithNewMailMD route', err);
                return next(err);
            }
            req.userExist = user;
            next();
        });
    },

    inviteMD: function (req, res, next) {
        var user = req.user;
        var options = {
            email: DataUtils.toLowerCase(req.body.email),
            updatedAt: req.body.updatedAt,
            user: user,
            userExist: req.userExist
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.INVITE_AUTHORIZE_USER);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.inviteMD(options, auditOptions, errorOptions, function (err, user) {
            if (err) {
                return next(err);
            }
            req.data = user;
            next();
        });
    },

    getUserByEmailId: function (req, res, next) {
        var email = req.body.email;
        var options = {
            email: email
        };
        UserApi.getUserByEmailId(options, function (err, user) {
            if (err) {
                debug('err', err);
                return next(err);
            }
            req.user = user;
            next();
        });
    },

    addInviteMD: function (req, res, next) {
        var user = req.user;
        var options = {
            email: DataUtils.toLowerCase(req.body.email),
            user: user,
            userId: user.id,
            accountId: user.accountId,
            firstName: req.body.firstName,
            middleName: req.body.middleName,
            lastName: req.body.lastName,
            dateOfBirth: req.body.dateOfBirth,
            phone: req.body.phone,
            dialCode: req.body.dialCode,
            phoneCountry: req.body.phoneCountry,
            primaryMobile: req.body.primaryMobile,
            primaryMobileDialCode: req.body.primaryMobileDialCode,
            primaryMobileCountry: req.body.primaryMobileCountry,
            secondaryMobile: req.body.secondaryMobile,
            secondaryMobileDialCode: req.body.secondaryMobileDialCode,
            secondaryMobileCountry: req.body.secondaryMobileCountry,
            addressLine1: req.body.addressLine1,
            addressLine2: req.body.addressLine2,
            addressLine3: req.body.addressLine3,
            city: req.body.city,
            state: req.body.state,
            zipCode: req.body.zipCode,
            country: req.body.country,
            languageCultureCode: req.body.languageCultureCode,
            roles: req.body.roles

        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.ADD_INVITE_AUTHORIZE_USER);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.addInviteMD(options, auditOptions, errorOptions, function (err, user) {
            if (err) {
                return next(err);
            }
            req.data = {
                OK: Constants.SUCCESS_MESSAGE.AUTHORIZE_USER_ADD_INVITE_SUCCESS,
                authorizeUserStatus: user.authorizeUserStatus,
                id: user.id,
                createdAt: user.createdAt ? user.createdAt : user.updatedAt
            };
            next();
        });
    },

    updateEncryptionKeys: function (req, res, next) {
        var options = {
            user: req.user,
            publicKey: req.body.publicKey,
            privateKey: req.body.privateKey,
            encryptedPassword: req.body.encryptedPassword,
            encryptionStatus: req.body.encryptionStatus,
            addKeys: req.body.addKeys
        };
        var auditOptions = {};
        HeaderUtils.getAuditLogHeaders(req, auditOptions, Events.ADDED_ENCRYPTION_KEYS_IN_USER);
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.updateEncryptionKeys(options, auditOptions, errorOptions, function (err, user) {
            if (err) {
                Util.log(err);
                return next(err);
            }
            req.data = user;
            next();
        });
    },

    checkArchive: function (req, res, next) {
        var options = {
            user: req.user,
            type: req.query.type
        };
        var errorOptions = HeaderUtils.getErrorLogHeaders(req);
        errorOptions.data = options;
        UserApi.checkArchive(options, errorOptions, function (err, user) {
            if (err) {
                Util.log(err);
                return next(err);
            }
            req.data = user;
            next();
        });
    },

    sendCodeViaMail: function (req, res, next) {
        var options = {
            email: req.body.email
        };

        UserApi.sendCodeViaMail(options, function (err, response) {
            if (err) {
                return next(err);
            }
            req.session.code = response.hashedCode;
            req.session.codeSendTime = new Date().getTime();
            req.data = {OK: response.OK};
            next();
        });
    },

    confirmCode: function (req, res, next) {
        var options = {
            code: req.body.code,
            actualCode: req.session.code,
            codeSendTime: req.session.codeSendTime
        };

        UserApi.confirmCode(options, function (err, response) {
            if (err) {
                return next(err);
            }
            req.data = response;
            next();
        });
    },

    ownerExist: function (req, res, next) {
        var options = {
            userId: req.body.ownerId
        };

        UserApi.ownerExist(options, function (err, user) {
            if (err) {
                return next(err);
            }
            req.user = user;
            next();
        });
    },

    checkSession: function (req, res, next) {
        req.data = Constants.OK_MESSAGE;
        next();
    },

    handleSesEmail: function (req, res, next) {
        var options = {
            userId: req.body.userId,
            sender: req.body.sender,
            timestamp: req.body.timestamp,
            subject: req.body.subject,
            s3Object: req.body.s3Object
        };
        UserApi.handleSesEmail(options, function (err) {
            if (err) {
                return next(err);
            }
            return next();
        });
    },

    setLoginPhoneVerificationCodeGeneration: function (req, res, next) {
        req.eventId = Events.LOGIN_PHONE_VERIFICATION_CODE_GENERATION;
        next();
    },

    setLoginPhoneVerificationCodeConfirmation: function (req, res, next) {
        req.eventId = Events.LOGIN_PHONE_VERIFICATION_CODE_CONFIRMATION;
        next();
    },

    setVerifyEmailPostRegistrationCodeConfirmation: function (req, res, next) {
        req.eventId = Events.VERIFY_EMAIL_POST_REG_CODE_CONFIRMATION;
        req.flag = 'emailConfirm';
        next();
    },

    setUpdatePhoneCodeGeneration: function (req, res, next) {
        req.eventId = Events.VERIFY_PHONE_POST_REG_CODE_GENERATION;
        next();
    },

    setUpdatePhoneCodeConfirmation: function (req, res, next) {
        req.eventId = Events.VERIFY_PHONE_POST_REG_CODE_CONFIRMATION;
        req.flag = 'phoneConfirm';
        next();
    },

    setResetPasswordCodeConfirmation: function (req, res, next) {
        req.eventId = Events.RESET_PASSWORD_CODE_CONFIRMATION;
        req.flag = 'resetPasswordConfirm';
        next();
    },

    sendJSON: function (req, res, next) {
        res.json(req.data);
    }
};

module.exports = User;

(function () {
    if (require.main == module) {
    }
}());
