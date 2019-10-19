/* jslint node: true */
'use strict';
var debug = require('debug')('scopehub.api.user');
var Util = require('util');
var EJS = require('ejs');
var Bcrypt = require('bcryptjs');
var _ = require('lodash');
var RandomSeed = require('random-seed').create();
var Async = require('async');
var knex = require('../lib/knex_util');
var CommonApi = require('./common');
var moment = require('moment');
var Promise = require('bluebird');

var connection = require('../lib/connection_util');
var Constants = require('../data/constants');
var UserModel = require('../model/user');
var UserEmailModel = require('../model/user_email');
var ErrorConfig = require('../data/error');
var TwilioConfig = require('../config/twilio');
var AWS = require('../config/aws');
var DataUtils = require('../lib/data_utils');
var TwilioUtils = require('../lib/twilio_utils');
var ReCaptchaUtils = require('../lib/recaptcha_utils');
var HeaderUtils = require('../lib/header_utils');
var EmailUtils = require('../lib/email_utils');
var NotificationApi = require('../api/notification');
var NotificationReferenceData = require('../data/notification_reference');
var AuditUtils = require('../lib/audit_utils');
var Endpoints = require('../config/endpoints');
var EmailRawParser = require('../lib/email_raw_parser');
var ErrorUtils = require('../lib/error_utils');
var Utils = require('../lib/utils');
//var AccountApi = require('../api/account');
var PlanApi = require('../api/plan');

var noop = function () {
}; // do nothing.

/*
* Function combine two permission object to single object
* */
var combine = function (obj1, obj2) {
    var obj3 = {};
    _.each(obj1, function (value, key) {
        obj3[key] = value;
        _.each(value, function (value1, key1) {
            obj3[key][key1] = value1;
            _.each(value1, function (value2, key2) {

                if (value1[key2] === false && obj2[key][key1][key2] === false) {
                    obj3[key][key1][key2] = false;
                } else {
                    obj3[key][key1][key2] = true;
                }
            });
        });
    });
    //debug('PERMISSIONS %c', obj3);
    return obj3;
};

var rolePermissions = function (user, cb) {

    var options = {
        roles: user.roles
    };

    User.getPermission(options, function (err, permissions) {
        if (err) {
            debug('err', err);
        }
        user.permissions = permissions;
        return cb(null, user);
    });

};

var User = {

    getAccountCountry: function (options) {
        return new Promise(async function (resolve, reject) {

            var accountId = options.accountId;
            try {
                var conn = await connection.getConnection();
                var account = await conn.query('select LR.country as country from accounts A, LocationReference LR ' +
                  'where A.id=uuid_to_bin(?) and LR.accountId = A.id and LR.locationId = A.locationId', accountId);
                account = Utils.filteredResponsePool(account);
                if (!account) {
                    account = {country: ''};
                }
                return resolve(account);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }

        });
    },

    loginMD: async function (options, auditOptions, errorOptions, cb) {
        var email = options.email;
        var password = options.password;
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var accountApi = require('./account');
        var err;
        if (DataUtils.isInvalidEmail(email)) {
            err = new Error(ErrorConfig.MESSAGE.EMAIL_INVALID);
        } else if (DataUtils.isUndefined(password)) {
            err = new Error(ErrorConfig.MESSAGE.PASSWORD_REQ);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            debug('err', err);
            return cb(err);
        }
        /*Find user with given login from user table
        * */
        try {
            var conn = await connection.getConnection();
            await conn.query('START TRANSACTION');
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
        Util.log('Inside Before transaction');
        try {

            var user = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id ,CAST(uuid_from_bin(accountId) as CHAR) as accountId , ' +
              ' firstName,lastName,email,colorCode,status, password, statusReasonCode, useForTwoFactor, postRegComplete, ' +
              ' languageCultureCode, tosStatus, emailStatus,isAccountEnabled, isAccountActive, primaryMobile, primaryMobileCountry, ' +
              ' primaryMobilePhoneEndingWith, secondaryMobile, secondaryMobilePhoneEndingWith,secondaryMobileCountry, useForTwoFactor, ' +
              ' addressLine1, addressLine2, addressLine3, city, state, zipCode, country, advancedAuthNumber,' +
              ' loginAttemptsCount,lastLoginTimestamp,profileComplete,encryptionStatus,' +
              ' chatPublicKey,chatPrivateKey,profilePicture,navBarViewFlag,menuFlag from users where email=?', email);
            user = Utils.filteredResponsePool(user);
            if (!user) {
                err = new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }
            //If account is disable for this user
            var isAccountActive = user.isAccountActive;
            var isAccountEnabled = user.isAccountEnabled;
            if (user.status === Constants.USER_STATUS.CLOSED) {
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_CLOSED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            if (!Utils.toBoolean(isAccountActive) || !Utils.toBoolean(isAccountEnabled)) {
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_DISABLED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }

            // Get accountId owner country
            var accountCountry = await User.getAccountCountry({accountId: user.accountId});
            user.ownerCountry = accountCountry.country;

            var roles = await conn.query('select CAST(uuid_from_bin(roleId) as CHAR) as id from user_roles where userId=uuid_to_bin(?)', user.id);
            roles = Utils.filteredResponsePool(roles);

            debug('roles---', roles);
            Util.log('Inside roles', roles);
            if (roles) {
                user.roles = [];
                user.roles.push(roles.id);
            }

            var warningFlag = await conn.query('SELECT flag FROM userPreferences WHERE userId  = uuid_to_bin(?) AND TYPE = 6', user.id);
            warningFlag = Utils.filteredResponsePool(warningFlag);
            if (warningFlag) {
                user.warningFlag = warningFlag.flag;
            }
            debug('warningFlag', user.warningFlag);


            var ownerDetails = await conn.query('SELECT CAST(uuid_from_bin(U.id) as CHAR) as id, U.chatPublicKey, U.encryptionStatus ' +
              ' FROM users U, user_roles UR, Roles R WHERE U.id = UR.userId AND R.id = UR.roleId AND R.title=\'account owner\' ' +
              ' AND U.accountId=uuid_to_bin(?) AND R.id NOT IN (uuid_to_bin(?))', [user.accountId, roles.id]);
            ownerDetails = Utils.filteredResponsePool(ownerDetails);

            debug('owner=======', ownerDetails);

            if (ownerDetails) {
                user.ownerChatEncryptionStatus = ownerDetails.encryptionStatus;
                user.ownerChatPublicKey = ownerDetails.chatPublicKey;
            }
            var userId = user.id;
            var savedHash = user.password;

            if (!Bcrypt.compareSync(password, savedHash)) {
                //err = new Error(ErrorConfig.MESSAGE.LOGIN_INCORRECT);
                var loginAttemptsCount;
                if ((parseInt(user.lastLoginTimestamp) + 1 * 60 * 1000) < updatedAt) {
                    loginAttemptsCount = 1;
                } else {
                    loginAttemptsCount = parseInt(user.loginAttemptsCount) + 1;
                }
                try {
                    var updatedUser = await conn.query('update users set loginAttemptsCount=?, lastLoginTimestamp=?, updatedBy=uuid_to_bin(?),' +
                      'updatedAt=? where id=uuid_to_bin(?)', [loginAttemptsCount, updatedAt, userId, updatedAt, userId]);

                    updatedUser = Utils.isAffectedPool(updatedUser);
                    if (!updatedUser) {
                        AuditUtils.create(auditOptions);
                        err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        throw err;
                    }
                    await conn.query('commit;');
                } catch (err) {
                    debug('errr', err);
                    return cb(err);
                }

                if (parseInt(user.loginAttemptsCount) > 2 && (parseInt(user.lastLoginTimestamp) + 1 * 60 * 1000) > updatedAt) {
                    AuditUtils.create(auditOptions);
                    err = new Error(ErrorConfig.MESSAGE.USER_BLOCKED_DUE_TO_EXCEED_LIMIT_FOR_LOGIN_ATTEMPT_TRY_AGAIN_LATER);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    err.flag = true;
                    await conn.query('rollback;');
                    await ErrorUtils.create(errorOptions, options, err);
                    debug('err', err);
                    Util.log(err);
                    return cb(err);
                } else {
                    await conn.query('rollback;');
                    err = new Error(ErrorConfig.MESSAGE.LOGIN_INCORRECT);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    await ErrorUtils.create(errorOptions, options, err);
                    debug('err', err);
                    Util.log(err);
                    return cb(err);
                }
            } else if (parseInt(user.loginAttemptsCount) > 2 && (parseInt(user.lastLoginTimestamp) + 1 * 60 * 1000) > updatedAt) {
                AuditUtils.create(auditOptions);
                err = new Error(ErrorConfig.MESSAGE.USER_BLOCKED_DUE_TO_EXCEED_LIMIT_FOR_LOGIN_ATTEMPT_TRY_AGAIN_LATER);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                err.flag = true;
                await conn.query('rollback;');
                await ErrorUtils.create(errorOptions, options, err);
                debug('err', err);
                Util.log(err);
                return cb(err);
            } else {
                try {
                    var loginAttemptsCount = 0;
                    var updatedUser = await conn.query('update users set loginAttemptsCount=?, lastLoginTimestamp=?, updatedBy=uuid_to_bin(?),' +
                      'updatedAt=? where id=uuid_to_bin(?)', [loginAttemptsCount, updatedAt, userId, updatedAt, userId]);

                    updatedUser = Utils.isAffectedPool(updatedUser);
                    if (!updatedUser) {
                        AuditUtils.create(auditOptions);
                        err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        await conn.query('rollback;');
                        throw err;
                    }
                    //await knex.raw('commit;');
                } catch (err) {
                    debug('errr', err);
                    return cb(err);
                }
            }

            var status = user.status;
            if (!err && Constants.USER_STATUS.ACTIVE !== status && user.statusReasonCode === Constants.USER_INACTIVE_REASON_CODES.SEND_VERIFICATION_CODE_ATTEMPT_EXCEED.CODE) {
                var reasonCode = user.statusReasonCode;
                var message = ErrorConfig.MESSAGE.USER_BLOCKED_DUE_TO_EXCEED_LIMIT_FOR_RESEND;
                //   message = message || 'User Inactive. Please contact support team';
                err = new Error(message);
            } else if (!err && Constants.USER_STATUS.ACTIVE !== status && user.statusReasonCode === Constants.USER_INACTIVE_REASON_CODES.CONFIRM_VERIFICATION_CODE_ATTEMPT_EXCEED.CODE) {
                var reasonCode = user.statusReasonCode;
                var message = ErrorConfig.MESSAGE.USER_BLOCKED_DUE_TO_EXCEED_LIMIT_FOR_CONFIRM_VERIFICATION_CODE;
                //   message = message || 'User Inactive. Please contact support team';
                err = new Error(message);
            } else if (!err && Constants.USER_STATUS.ACTIVE !== status) {
                var reasonCode = user.statusReasonCode;
                var message = Constants.USER_INACTIVE_MESSAGES[reasonCode];
                message = ErrorConfig.MESSAGE.USER_IS_INACTIVE_PLEASE_CONTACT_SUPPORT_TEAM;
                err = new Error(message);
            }

            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await conn.query('rollback;');
                await ErrorUtils.create(errorOptions, options, err);
                debug('err', err);
                Util.log(err);
                return cb(err);
            }
            // Audit Log
            auditOptions.userId = user.id;
            var accountId = (user.accountId || null);
            try {
                /*Get the account of user who wants to login by the accountId
                  * */
                var account = await conn.query('select *,CAST(uuid_from_bin(id) as CHAR) as id from accounts where id=uuid_to_bin(?)', accountId);
                account = Utils.filteredResponsePool(account);

                if (!accountId) {
                    err = new Error(ErrorConfig.MESSAGE.ACCOUNT_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }
                user.account = account;
                AuditUtils.create(auditOptions);
                return cb(null, user);
                /*
                  * add the permission in login response when use_for_two_factor is false or undefined
                  * */

                /*if (user.use_for_two_factor === false || user.use_for_two_factor === undefined) {
                      try {
                          /!*
                          * Get the roles id from user role table by the userId
                          * *!/

                          var roles = await UserRoleModelMD.query().where('userId', '=', userId);
                          debug('roles', roles);
                          if (!roles) {
                              throw err;
                          }
                          /!*
                          * Roles has the array of role_id and from this we can get the permissions
                          * *!/
                          if (DataUtils.isArray(roles) && !_.isEmpty(roles)) {
                              rolePermissions(user, function (err, response) {
                                  if (err) {
                                      debug('err', err);
                                      return cb(err)
                                  }
                                  debug('response from 1', response);
                                  user = response;
                                  return cb(null, user);
                              });
                          } else {
                              debug('return from else');
                              return cb(null, user);
                          }

                      } catch (err) {
                          debug('err', err);
                          return cb(err);
                      }
                  }
                  /!*else if (user.use_for_two_factor === undefined) {
                      try {
                          var roles = await UserRoleModelMD.query().where('userId', '=', userId);
                          if (!roles) {
                              throw err;
                          }
                          // Roles has the array of role_id and from this we can get the permissions
                          if (DataUtils.isArray(roles) && !_.isEmpty(roles)) {
                              rolePermissions(user, function (err, response) {
                                  if (err) {
                                      debug('err', err);
                                      return cb(err)
                                  }
                                  debug('response from 1', response);
                                  user = response;
                                  return cb(null, user);
                              });

                          } else {
                              return cb(null, user);
                          }

                      } catch (err) {
                          debug('err', err);
                          return cb(err);
                      }
                  }*!/
                  else {
                      //AuditUtils.create(auditOptions);
                      return cb(null, user);
                  }*/
            } catch (err) {
                await conn.query('rollback;');
                await ErrorUtils.create(errorOptions, options, err);
                debug('err', err);
                return cb(err);
            }
        } catch (err) {
            debug('err', err);
            await conn.query('rollback;');
            await ErrorUtils.create(errorOptions, options, err);
            debug('err', err);
            return cb(err);
        }
    },

    /*
        * Function get the list of permission from Roles array and
        * combine this result into one object of permission
        * */
    getPermission: function (options, cb) {
        var roles = options.roles || [];
        var err;
        var permissions = [];

        if (_.isEmpty(roles)) {
            err = new Error(ErrorConfig.MESSAGE.ROLES_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
        Async.eachSeries(roles, function (role, cb1) {
            PermissionModel
              .query(role)
              .usingIndex(Constants.ROLE_ID_INDEX)
              .exec(function (err, permission) {
                  permission = _.map(permission.Items, 'attrs');
                  if (err) {
                      err = new Error(ErrorConfig.MESSAGE.PERMISSION_NOT_FOUND);
                      err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                      //return cb(err);
                  }
                  if (!_.isEmpty(permission)) {
                      if (permission[0].id) {
                          delete permission[0].id;
                      }
                      if (permission[0].roleId) {
                          delete permission[0].roleId;
                      }
                      if (permission[0].createdAt) {
                          delete permission[0].createdAt;
                      }
                      if (permission[0].updatedAt) {
                          delete permission[0].updatedAt;
                      }
                      permissions.push(permission[0]);
                  }
                  return cb1();
              });
        }, function (err) {
            if (err) {
                debug('err', err);
                return cb(err);
            }
            var length = permissions.length, i;
            if (_.isEmpty(permissions)) {
                err = new Error(ErrorConfig.MESSAGE.PERMISSION_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
            var permissionObject = {};

            permissionObject = permissions[0];
            for (i = 1; i < length; i++) {
                permissionObject = combine(permissionObject, permissions[i]);
            }
            return cb(null, permissionObject);
        });
    },

    setRememberMD: async function (options, errorOptions, cb) {
        var err;
        var userId = options.userId;
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var token = options.email + RandomSeed.intBetween(Constants.RANDOM_LOW_LIMIT, Constants.RANDOM_HIGH_LIMIT)
          + new Date().getTime();
        token = DataUtils.getSha384(token).toString();

        var userRememberOptions = {
            userRememberToken: token
        };
        try {
            debug('inside set----------');
            var conn = await connection.getConnection();
            var updatedUser = await conn.query('update users set userRememberToken=?, updatedBy=uuid_to_bin(?),' +
              'updatedAt=? where id=uuid_to_bin(?)', [token, userId, updatedAt, userId]);

            updatedUser = Utils.isAffectedPool(updatedUser);
            if (!updatedUser) {
                err = new Error(ErrorConfig.MESSAGE.USER_REMEMBER_FAILED);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                throw err;
            }
            return cb(null, token);
        } catch (err) {
            await conn.query('rollback;');
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    ensurePostRegStepsMD: async function (options, errorOptions, cb) {
        var user = options.user;
        var tosStatus = Utils.toBoolean(user.tosStatus);
        var emailStatus = Utils.toBoolean(user.emailStatus);
        var postRegComplete = Utils.toBoolean(user.postRegComplete) || false;
        var phoneStatus = user.phoneStatus;
        var updatedAt = DataUtils.getEpochMSTimestamp();

        var isChanged = false;

        if (tosStatus === undefined && emailStatus === undefined) {
            tosStatus = false;
            emailStatus = false;
            isChanged = true;
            if (phoneStatus) {
                postRegComplete = false;
            }
        }
        if (isChanged) {
            var userOptions = {
                tosStatus: Boolean(parseInt(tosStatus)),
                emailStatus: Boolean(parseInt(emailStatus)),
                postRegComplete: Boolean(parseInt(postRegComplete))
            };
            try {
                var conn = await connection.getConnection();
                var updatedResponse = await conn.query('update users set tosStatus=?,emailStatus=?,postRegComplete=?, ' +
                  'updatedBy=uuid_to_bin(?), updatedAt=? where id=uuid_to_bin(?)', [tosStatus, emailStatus, postRegComplete, user.id, updatedAt, user.id]);
                updatedResponse = Utils.isAffectedPool(updatedResponse);
                if (!updatedResponse) {
                    return cb(null, user);
                }
                user.tosStatus = tosStatus;
                user.emailStatus = emailStatus;
                user.postRegComplete = postRegComplete;
                return cb(null, user);
            } catch (err) {
                await conn.query('rollback;');
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED) || err;
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                await ErrorUtils.create(errorOptions, options, err);
                Util.log(err);
                return cb(err);
            }
        } else {
            return cb(null, user);
        }
    },

    isPostRegCompleteMD: async function (options, errorOptions, cb) {
        var user = options.user;
        var tosStatus = Utils.toBoolean(user.tosStatus);
        var emailStatus = Utils.toBoolean(user.emailStatus);
        var postRegComplete = Utils.toBoolean(user.postRegComplete) || false;
        var isComplete = true;
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var response;
        var err;

        if (tosStatus === false || emailStatus === false) {
            isComplete = false;
        }

        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        if (postRegComplete !== isComplete) {
            try {
                var isUserUpdated = await conn.query('update users set postRegComplete=?,postRegCompleteDate=?, updatedAt=?,' +
                  'updatedBy=uuid_to_bin(?) where id=uuid_to_bin(?)', [isComplete, updatedAt, updatedAt, user.id, user.id]);
                isUserUpdated = Utils.isAffectedPool(isUserUpdated);
                if (!isUserUpdated) {
                    err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }
                var updatedUser = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id, CAST(uuid_from_bin(accountId) as CHAR) as accountId,email,' +
                  'tosStatus,firstName,languageCultureCode,status,statusReasonCode,useForTwoFactor,postRegComplete,emailStatus,' +
                  'emailUtcDateTime,isAccountActive,isAccountEnabled,updatedAt from users where id = uuid_to_bin(?)', user.id);
                updatedUser = Utils.filteredResponsePool(updatedUser);
                if (!updatedUser) {
                    err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }
                user.postRegComplete = updatedUser.postRegComplete;
                user.updatedAt = updatedUser.updatedAt;
                response = {
                    user: user,
                    clonedUser: updatedUser
                };
                await conn.query('commit');
                return cb(null, response);
            } catch (err) {
                await conn.query('rollback');
                await ErrorUtils.create(errorOptions, options, err);
                debug('err', err);
                Util.log(err);
                return cb(err);
            }
        } else {
            await conn.query('commit');
            var clonedUser = {
                email: user.email,
                tosStatus: user.tosStatus,
                firstName: user.firstName,
                languageCultureCode: user.languageCultureCode,
                status: user.status,
                statusReasonCode: user.statusReasonCode,
                useForTwoFactor: user.useForTwoFactor,
                postRegComplete: user.postRegComplete,
                emailStatus: user.emailStatus,
                emailUtcDateTime: user.emailUtcDateTime,
                isLoggedIn: user.isLoggedIn,
                deviceAuthorised: user.deviceAuthorised,
                updatedAt: user.updatedAt
            };
            response = {
                user: user,
                clonedUser: clonedUser
            };
            return cb(null, response);
        }
    },

    getUserByEmail: function (email, cb) {
        if (!email) {
            return cb();
        }
        UserModel.query(email)
          .usingIndex(Constants.USER_EMAIL_INDEX)
          .exec(function (err, data) {
              var user = data && data.Items && data.Items[0];
              return cb(err, user);
          });
    },

    getUserById: function (userId, cb) {
        UserModel.get(userId, {
            ConsistentRead: true
        }, function (err, data) {
            var user = data && data.attrs;
            return cb(err, user);
        });
    },


    getOwnerByAccountIdMD: async function (accountId, cb) {
        try {
            var conn = await connection.getConnection();
            var owner = await conn.query('select uuid_from_bin(id) as id,email,status,country from users where id = (select userId from user_roles where ' +
              ' userId in (select id from users where  accountId = uuid_to_bin(?) and status = ?) and roleId = (select id from Roles where title=?))',
              [accountId, Constants.USER_STATUS.ACTIVE, Constants.ACCOUNT_OWNER_TITLE]);
            owner = Utils.filteredResponsePool(owner);
            return cb(null, owner);
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
    },

    getOwnerByAccountIdPromise: function (accountId) {
        return new Promise(async function (resolve, reject) {
            try {
                var conn = await connection.getConnection();
                var owner = await conn.query('select uuid_from_bin(id) as id,firstName,lastName,addressLine1,addressLine2,addressLine3,' +
                  ' email,city,zipCode,state,status,country,languageCultureCode,locationId from users where id = (select userId from user_roles where ' +
                  ' userId in (select id from users where  accountId = uuid_to_bin(?) and status = ?) and roleId = (select id from Roles where title=?))',
                  [accountId, Constants.USER_STATUS.ACTIVE, Constants.ACCOUNT_OWNER_TITLE]);
                owner = Utils.filteredResponsePool(owner);
                if (owner && owner.locationId !== '') {
                    var location = await conn.query('select addressLine1,addressLine2,addressLine3,city,zipCode,state,country from LocationReference ' +
                      'where locationId = ? and accountId = uuid_to_bin(?) ',
                      [owner.locationId, accountId]);
                    location = Utils.filteredResponsePool(location);
                    debug('location', location);
                    if (location) {
                        owner.addressLine1 = location.addressLine1;
                        owner.addressLine2 = location.addressLine2;
                        owner.addressLine3 = location.addressLine3;
                        owner.city = location.city;
                        owner.state = location.state;
                        owner.zipCode = location.zipCode;
                        owner.country = location.country;
                    }
                }

                return resolve(owner);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.USER_NOT_EXISTS);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    ownerExist: function (options, cb) {
        var userId = options.userId;
        if (DataUtils.isUndefined(userId)) {
            var err = err || new Error(ErrorConfig.MESSAGE.OWNER_ID_REQ);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('error', err);
            return cb(err);
        }
        User.getUserById(userId, function (err, data) {
            if (err || !data) {
                err = err || new Error(ErrorConfig.MESSAGE.OWNER_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            return cb(null, data);
        });
    },

    getUserByRememberTokenMD: async function (token, cb) {
        var err;
        try {
            var conn = await connection.getConnection();
            if (!token) {
                return cb();
            }

            var user = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id,CAST(uuid_from_bin(accountId) as CHAR) as accountId,email,' +
              ' status,password,statusReasonCode,useForTwoFactor,postRegComplete,languageCultureCode from users ' +
              'where userRememberToken = ? ', token);
            user = Utils.filteredResponsePool(user);
            if (!user) {
                throw err;
            }
            return cb(null, user);
        } catch (err) {
            debug('err', err);
            return cb();
        }
    },

    getUserByIdMD: async function (userId, cb) {
        debug('this is the function');
        var err;
        try {
            var conn = await connection.getConnection();
            var user = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id,CAST(uuid_from_bin(accountId) as CHAR) as accountId ,email,status,authorizeUserStatus,' +
              'addressLine1,addressLine2,addressLine3,city,state,zipCode,country,languageCultureCode,firstName,lastName,createdAt,updatedAt  from users where id = uuid_to_bin(?)', userId);
            user = Utils.filteredResponsePool(user);
            if (!user) {
                throw err;
            }
            return cb(err, user);
        } catch (err) {
            err = new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    getUserWithFlagByIdMD: async function (options, cb) {
        var userId = options.userId;
        var notifyType = options.notifyType;
        debug('this is the function');
        var err;
        try {
            var conn = await connection.getConnection();
            var user = await conn.query('select CAST(uuid_from_bin(U.id) as CHAR) as id,CAST(uuid_from_bin(U.accountId) as CHAR) as accountId ,' +
              ' U.email,U.status,U.authorizeUserStatus,U.addressLine1,U.addressLine2,U.addressLine3,U.city,U.state,U.zipCode,' +
              ' U.country,U.languageCultureCode,U.firstName,U.lastName,U.createdAt,U.updatedAt,UP.flag as notifyFlag ' +
              ' from users U,userPreferences UP ' +
              ' where U.id = uuid_to_bin(?) and UP.userId = U.id and UP.type = ? ;', [userId, notifyType]);
            user = Utils.filteredResponsePool(user);
            if (!user) {
                throw err;
            }
            return cb(err, user);
        } catch (err) {
            err = new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    getUserByEmailMD: async function (email, cb) {
        var err;
        try {
            debug('email', email);
            var conn = await connection.getConnection();
            var user = await conn.query('select *,CAST(uuid_from_bin(id) as CHAR) as id from users where email=?', email);
            user = Utils.filteredResponsePool(user);
            if (!user) {
                err = new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                //return cb(err);
            }
            return cb(err, user);
        } catch (err) {
            return cb(err);
        }
    },

    getUserByRememberDeviceTokenMD: async function (options, errorOptions, cb) {
        var token = options.token;
        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
        try {
            if (!token) {
                await conn.query('commit;');
                return cb();
            }
            var userRememberDevice = await conn.query('select uuid_from_bin(id) as id from users where userRememberDeviceToken = ?', token);
            userRememberDevice = Utils.filteredResponse(userRememberDevice);
            if (userRememberDevice) {
                var userId = userRememberDevice.id;
                User.getUserByIdMD(userId, async function (err, response) {
                    if (err || !response) {
                        err = new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
                        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                        throw err;
                    }
                    await conn.query('commit;');
                    return cb();
                });
            } else {
                await conn.query('commit;');
                return cb();
            }
        } catch (err) {
            await conn.query('rollback;');
            await ErrorUtils.create(errorOptions, options, err);
            return cb();
        }
    },

    validateFieldsMD: async function (options, errorOptions, cb) {
        var email = options.email;
        var firstName = options.firstName;
        var lastName = options.lastName;
        var password = options.password;
        var confirmPassword = options.confirmPassword;
        var languageCultureCode = options.languageCultureCode;
        var captcha = options.captcha;
        var accountName = options.accountName;
        var err;
        var language = languageCultureCode && languageCultureCode.substr(0, 2);
        if (DataUtils.isUndefined(firstName)) {
            err = new Error(ErrorConfig.MESSAGE.FIRST_NAME_REQ);
        } else if (DataUtils.isUndefined(lastName)) {
            err = new Error(ErrorConfig.MESSAGE.LAST_NAME_REQ);
        } else if (DataUtils.isInvalidEmail(email)) {
            err = new Error(ErrorConfig.MESSAGE.EMAIL_REQ);
        } else if (email.length > 254) {
            err = new Error(ErrorConfig.MESSAGE.EMAIL_MUST_BE_LESS_THAN_254_CHARACTER);
        } else if (DataUtils.isUndefined(password)) {
            err = new Error(ErrorConfig.MESSAGE.PASSWORD_REQ);
        } else if (DataUtils.isUndefined(captcha)) {
            err = new Error(ErrorConfig.MESSAGE.CAPTCHA_REQUIRED);
        } else if (Constants.LANGUAGE_OPTIONS.indexOf(language) < 0) {
            err = new Error(ErrorConfig.MESSAGE.LANGUAGE_OPTION_INVALID);
        } else if (DataUtils.isUndefined(accountName)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_NAME_REQUIRED);
        } else if (accountName.length > 60) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_NAME_MUST_BE_LESS_THAN_60_CHARACTER);
        } else if (password !== confirmPassword) {
            err = new Error(ErrorConfig.MESSAGE.PASSWORD_AND_CONFIRM_NOT_MATCH);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            Util.log(err);
            debug(err);
            return cb(err);
        }
        return cb();
    },

    validateEmailFields: async function (options, errorOptions, cb) {
        var email = options.email;
        var updatedAt = options.updatedAt;

        var err;
        debug('email', email);
        if (DataUtils.isUndefined(email)) {
            err = new Error(ErrorConfig.MESSAGE.EMAIL_REQ);
        } else if (DataUtils.isInvalidEmail(email)) {
            err = new Error(ErrorConfig.MESSAGE.INVALID_EMAIL);
        } else if (email.length > 254) {
            err = new Error(ErrorConfig.MESSAGE.EMAIL_MUST_BE_LESS_THAN_254_CHARACTER);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            debug(err);
            return cb(err);
        }
        return cb();
    },

    getRolesMD: async function (userId, cb) {
        var err;
        var roleArray = [];
        try {
            var conn = await connection.getConnection();
            var roles = await conn.query('select CAST(uuid_from_bin(r.id) as CHAR) as id , r.title as title from Roles r, user_roles ur where ur.userid=uuid_to_bin(?) and ur.roleid = r.id', [userId]);

            if (!roles) {
                return cb(null, roleArray);
            }
            return cb(null, roles);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.ROLE_NOT_FOUND);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    getAuthorizedUserMD: async function (options, auditOptions, errorOptions, cb) {
        var userId = options.userId;
        var err;
        if (DataUtils.isUndefined(userId)) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.USER_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var userData = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id ,firstName, lastName, dateOfBirth, email, phone, addressLine1, ' +
              'addressLine2, addressLine3, city, zipCode, state, country,phone,dialCode,phoneCountry, secondaryMobile, secondaryMobileCountry,' +
              'secondaryMobileDialCode,primaryMobile,primaryMobileDialCode, primaryMobileCountry,authorizeUserStatus, status, updatedAt from users where id=uuid_to_bin(?)', userId);
            userData = Utils.filteredResponsePool(userData);

            if (!userData) {
                err = new Error(ErrorConfig.MESSAGE.USER_NOT_EXISTS);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            User.getRolesMD(userId, async function (err, roles) {
                if (err) {
                    debug('err', err);
                    return cb(err);
                }
                debug('roles', roles);
                userData.roles = _.map(roles, function (role) {
                    return role.id;
                });
                return cb(null, userData);
            });
        } catch (err) {
            debug('err ', err);
            await ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.AUTHORIZE_USER_NOT_FOUND);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    cancelUserMD: async function (options, auditOptions, errorOptions, cb) {
        var userId = options.userId;
        var user = options.user;
        var updatedAt = options.updatedAt;
        var err;

        if (DataUtils.isUndefined(userId)) {
            err = new Error(ErrorConfig.MESSAGE.USER_ID_REQUIRED);
        } else if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_MUST_BE_NUMBER);
        } else if (updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_IS_INVALID);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        try {
            User.getUserWithFlagByIdMD({
                userId: userId,
                notifyType: Constants.NOTIFICATION_CATEGORY_TYPE.AUTH_USER
            }, async function (err, userResponse) {
                if (err || !userResponse) {
                    debug('err', err);
                    err = new Error(ErrorConfig.MESSAGE.USER_NOT_EXISTS);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
                var option = {
                    user: user,
                    userId: userResponse.id,
                    updatedAt: updatedAt
                };
                /*var opt = {
                    languageCultureCode: userResponse.languageCultureCode,
                    template: Constants.EMAIL_TEMPLATES.DEACTIVATE_AUTHORIZE_USER,
                    email: userResponse.email
                };
                var compileOptions = {
                    name: userResponse.firstName || '',
                    user_email: user.email,
                    scopehub_login: ''
                };*/
                var conn = await connection.getConnection();
                await conn.query('START TRANSACTION;');
                debug('userResponse', userResponse);

                if (userResponse.authorizeUserStatus === Constants.AUTHORIZE_USER_STATUS.OPEN) {
                    User.cancelMD(option, auditOptions, errorOptions, async function (err, data) {
                        if (err || !data) {
                            await conn.query('rollback;');
                            err = err || new Error(ErrorConfig.MESSAGE.CANCEL_AUTHORIZE_USER_INVITATION_FAILED);
                            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                            ErrorUtils.create(errorOptions, options, err);
                            return cb(err);
                        }
                        var updatedUser = await conn.query('select email, status,authorizeUserStatus,updatedAt from users where id = uuid_to_bin(?) ', userId);
                        updatedUser = Utils.filteredResponsePool(updatedUser);
                        if (!updatedUser) {
                            throw err;
                        }
                        userResponse.status = updatedUser.status;
                        userResponse.authorizeUserStatus = updatedUser.authorizeUserStatus;
                        userResponse.updatedAt = updatedUser.updatedAt;
                        userResponse.isCancel = true;
                        return cb(null, userResponse);
                    });
                } else {
                    return cb(null, userResponse);
                }
            });
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
    },

    deActivateMD: async function (options, auditOptions, errorOptions, cb) {
        var userId = options.userId;
        var user = options.user;
        var authUser = options.authUser;
        var isCancel = options.isCancel;
        var updatedAtBody = options.updatedAtBody;
        var updatedAt = isCancel ? authUser.updatedAt : updatedAtBody;
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();
        var date = new Date();
        var err;

        var opt = {
            languageCultureCode: authUser.languageCultureCode,
            template: Constants.EMAIL_TEMPLATES.DEACTIVATE_AUTHORIZE_USER,
            email: authUser.email
        };
        var compileOptions = {
            name: user.firstName || '',
            user_email: user.email,
            scopehub_login: ''
        };

        try {
            var conn = await connection.getConnection();
            if (authUser.authorizeUserStatus === Constants.AUTHORIZE_USER_STATUS.ACCEPTED || authUser.authorizeUserStatus === Constants.AUTHORIZE_USER_STATUS.CANCELED || authUser.authorizeUserStatus === Constants.AUTHORIZE_USER_STATUS.DECLINED) {

                var userUpdated = await conn.query('IF (select 1 from users where id = uuid_to_bin(?)) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "USER_NOT_FOUND", MYSQL_ERRNO = 4001;' +
                  'ELSEIF (select 1 from users where id = uuid_to_bin(?) and updatedAt=?) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "USER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
                  'ELSE update users set status=?, authorizeUserStatus=?, updatedBy=uuid_to_bin(?), updatedAt=?  ' +
                  'where id = uuid_to_bin(?) ;end if;',
                  [userId, userId, updatedAt, Constants.USER_STATUS.INACTIVE, Constants.AUTHORIZE_USER_STATUS.DEACTIVATED, user.id, newUpdatedAt, userId]);
                userUpdated = Utils.isAffectedPool(userUpdated);

                if (!userUpdated) {
                    debug('err', err);
                    err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }

                var notifyFlag = JSON.parse(authUser.notifyFlag);

                if (notifyFlag.notification === 1) {
                    var invitationExpirationDate = date.setDate(date.getDate() + Constants.INVITATION_EXPIRATION_DATE_LIMIT);
                    invitationExpirationDate = new Date(invitationExpirationDate);

                    var notificationOption = {
                        refereId: Constants.DEFAULT_REFERE_ID,
                        user_ids: [authUser.id],
                        topic_id: authUser.id,
                        refereType: Constants.NOTIFICATION_REFERE_TYPE.AUTH_USER,
                        notification_reference: NotificationReferenceData.AUTHROIZED_USER_INVITE_DECLINE,
                        notificationExpirationDate: new Date(),
                        paramasDateTime: new Date(),
                        paramsInviter: user.email + ', ' +
                          (user.firstName ? user.firstName : '') + ' ' +
                          (user.lastName ? user.lastName : ''),
                        paramsInvitee: authUser.email + ', ' +
                          (authUser.firstName ? authUser.firstName : '') + ' ' +
                          (authUser.lastName ? authUser.lastName : ''),
                        metaEmail: user.email,
                        metaName: user.firstName || '',
                        languageCultureCode: authUser.languageCultureCode,
                        createdBy: user.id,
                        type: Constants.DEFAULT_NOTIFICATION_TYPE
                    };

                    await NotificationApi.createMD(notificationOption);
                }
                if (notifyFlag.email === 1) {
                    await EmailUtils.sendEmailPromise(opt, compileOptions);
                }

                await conn.query('COMMIT;');

                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.AUTHORIZE_USER_DEACTIVATE_SUCCESS,
                    authorizeUserStatus: Constants.AUTHORIZE_USER_STATUS.DEACTIVATED,
                    updatedAt: newUpdatedAt
                });

                /*EmailUtils.sendEmailMD(opt, compileOptions, async function (err) {
                    if (err) {
                        debug('err', err);
                        await ErrorUtils.create(errorOptions, options, err);
                        return cb(err);
                    }
                    await conn.query('COMMIT;');
                    return cb(null, {
                        OK: Constants.SUCCESS_MESSAGE.AUTHORIZE_USER_DEACTIVATE_SUCCESS,
                        authorizeUserStatus: Constants.AUTHORIZE_USER_STATUS.DEACTIVATED,
                        updatedAt: newUpdatedAt
                    });
                });*/
            } else {
                await conn.query('ROLLBACK;');
                err = new Error(ErrorConfig.MESSAGE.STATUS_OF_THE_AUTHORIZED_USER_RECORD_CHANGED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
        } catch (err) {
            debug('err');
            await conn.query('ROLLBACK;');
            await ErrorUtils.create(errorOptions, options, err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            } else if (err.errno === 4002) {
                err = new Error(ErrorConfig.MESSAGE.USER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                return cb(err);
            } else {
                err = new Error(ErrorConfig.MESSAGE.AUTHORIZE_USER_DEACTIVATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
        }
        /*notifyContact: function (cb1) {
              var userId = userResponse.id;
              return cb1();
              /!*ContactModel
                .query(userId)
                .usingIndex(Constants.CONTACT_INVITER_UUID_INDEX)
                .exec(function (err, response) {
                    if (err || !response) {
                        err = new Error(ErrorConfig.MESSAGE.CONTACT_NOT_FOUND);
                        debug('err', err);
                    }
                    response = _.map(response.Items, 'attrs');

                    Async.forEachOfSeries(response, function (value, key, cb2) {
                        var options = {
                            user: userResponse,
                            contactId: value.id
                        };
                        ContactApi.remove(options, auditOptions, function (err, response) {
                            if (err) {
                                debug('err', err);
                            }
                            return cb2();
                        });
                    }, function (err) {
                        if (err) {
                            debug('err', err);
                            return cb1(err);
                        }
                        return cb1();
                    });
                });*!/
          }*/
    },

    createAccountMD: async function (options, errorOptions, cb) {
        var generatedId = Utils.generateId();
        var id = generatedId.uuid;
        var user = options.user;
        var err;
        var status = Constants.ACCOUNT_STATUS.ACTIVE;
        try {
            var conn = await connection.getConnection();
            var account = await conn.query('insert into accounts (id,status,createdAt,createdBy,updatedAt) values ' +
              '(uuid_to_bin(?),?,utc_timestamp(3),uuid_to_bin(?),utc_timestamp(3))', [id, status, user.id]);
            var isAccountAffected = Utils.isAffectedPool(account);
            if (!isAccountAffected) {
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_CREATION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }

            account = {};
            account.id = id;
            return cb(null, account);
        } catch (err) {
            await conn.query('rollback;');
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    updateUserMD: async function (options, errorOptions, cb) {
        var user = options.user;
        var accountId = options.accountId;
        var userExist = options.userExist;
        var createdAt = DataUtils.getEpochMSTimestamp();
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var err;
        var actualUser = user ? user : userExist;

        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
        try {
            if (user || userExist.flag === Constants.USER_FLAG.CONTACT_INVITATION || userExist.flag === Constants.USER_FLAG.SUPPLIER_INVITATION || userExist.flag === Constants.USER_FLAG.CUSTOMER_INVITATION) {
                var userId = actualUser.id;
                //update status and account id
                var updateResponse = await conn.query('update users set isAccountEnabled=?, isAccountActive=?, accountId = uuid_to_bin(?),' +
                  'status=?,updatedBy=uuid_to_bin(?),updatedAt=? where id=uuid_to_bin(?)',
                  [true, true, accountId, Constants.USER_STATUS.ACTIVE, userId, updatedAt, userId]);
                var isUpdated = Utils.isAffectedPool(updateResponse);
                if (isUpdated) {
                    actualUser.accountId = accountId;
                }
                if (!isUpdated) {
                    err = new Error(ErrorConfig.MESSAGE.USER_SIGNUP_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }

                try {
                    var roles = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id from Roles where title=?', Constants.ACCOUNT_OWNER_TITLE);
                    roles = Utils.filteredResponsePool(roles);

                    if (!roles) {
                        err = new Error(ErrorConfig.MESSAGE.ROLE_NOT_FOUND);
                        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                        throw err;
                    }
                    var generatedId = Utils.generateId();

                    try {
                        var userRoleResponse = await conn.query('insert into user_roles (id,userId,roleId,createdAt,createdBy,updatedAt) values' +
                          ' (uuid_to_bin(?),uuid_to_bin(?),uuid_to_bin(?),?,uuid_to_bin(?),?)', [generatedId.uuid, actualUser.id, roles.id, createdAt, actualUser.id, updatedAt]);

                        userRoleResponse = Utils.isAffectedPool(userRoleResponse);
                        if (!userRoleResponse) {
                            err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                            throw err;
                        }
                        await conn.query('commit;');
                        return cb(null, actualUser);
                    } catch (err) {
                        await conn.query('rollback;');
                        await ErrorUtils.create(errorOptions, options, err);
                        debug('err', err);
                        return cb(err);
                    }
                } catch (err) {
                    await conn.query('rollback;');
                    debug('err', err);
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
            }
            await conn.query('commit;');
            return cb(null, actualUser);
        } catch (err) {
            await conn.query('rollback;');
            await ErrorUtils.create(errorOptions, options, err);
            debug('err', err);
            return cb(err);
        }
    },

    getInviters: function (options) {
        return new Promise(async function (resolve, reject) {
            var userId = options.id;

            try {
                var conn = await connection.getConnection();
                // Active Inviters
                var activeInviters = await conn.query('select CAST(uuid_from_bin(C.contactId) as CHAR) as contactId ,CAST(uuid_from_bin(C.inviterUUID) as CHAR) as inviterUUID,' +
                  ' CAST(uuid_from_bin(C.inviteeUUID) as CHAR) as inviteeUUID ,C.status,C.invitationExpirationDate,C.inviteeEmail,U.firstName,U.lastName,U.email' +
                  ' from contacts C , users U where C.inviteeUUID=uuid_to_bin(?) and ' +
                  ' C.invitationExpirationDate > now(3) and C.inviterUUID= U.id', [userId]);
                if (!activeInviters) {
                    activeInviters = [];
                }

                // Expire Inviters
                var expireInviters = await conn.query('select CAST(uuid_from_bin(C.contactId) as CHAR) as contactId ,CAST(uuid_from_bin(C.inviterUUID) as CHAR) as inviterUUID,' +
                  ' CAST(uuid_from_bin(C.inviteeUUID) as CHAR) as inviteeUUID ,C.status,C.invitationExpirationDate,C.inviteeEmail,U.firstName,U.lastName,U.email' +
                  ' from contacts C , users U where C.inviteeUUID=uuid_to_bin(?) and ' +
                  ' C.invitationExpirationDate < now(3) and C.inviterUUID= U.id', [userId]);
                if (!expireInviters) {
                    expireInviters = [];
                }
                var response = {
                    activeInviters: activeInviters,
                    expireInviters: expireInviters
                };
                return resolve(response);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    notifyInviter: function (options) {
        return new Promise(async function (resolve, reject) {
            debug('2');
            var userResponse = options.userResponse;
            var date = new Date();
            var currentDate = new Date();
            var err;

            try {
                var inviterOption = {
                    id: userResponse.id
                };
                var inviterResponse = await User.getInviters(inviterOption);
                var activeInviters = inviterResponse.activeInviters;
                var expireInviters = inviterResponse.expireInviters;

                await Promise.each(activeInviters, async function (inviter) {
                    var invitationExpirationDate = date.setDate(date.getDate() + Constants.INVITATION_EXPIRATION_DATE_LIMIT);
                    invitationExpirationDate = new Date(invitationExpirationDate);

                    var notificationOption = {
                        refereId: Constants.DEFAULT_REFERE_ID,
                        user_ids: [inviter.inviterUUID],
                        topic_id: inviter.inviterUUID,
                        refereType: Constants.NOTIFICATION_REFERE_TYPE.CONTACT,
                        notification_reference: NotificationReferenceData.CONTACT_SIGNUP,
                        notificationExpirationDate: invitationExpirationDate,
                        paramasDateTime: currentDate,
                        paramsInviter: userResponse.email + ', ' +
                          (userResponse.firstName ? userResponse.firstName : '') + ' ' +
                          (userResponse.lastName ? userResponse.lastName : ''),
                        paramsInvitee: inviter.email + ', ' +
                          (inviter.firstName ? inviter.firstName : '') + ' ' +
                          (inviter.lastName ? inviter.lastName : ''),
                        metaEmail: userResponse.email,
                        languageCultureCode: userResponse.languageCultureCode,
                        createdBy: userResponse.id,
                        type: Constants.DEFAULT_NOTIFICATION_TYPE
                    };
                    if (userResponse.firstName) {
                        notificationOption.metaName = userResponse.firstName;
                    }
                    await NotificationApi.createMD(notificationOption);
                });
                debug('3');
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*
    * Update accounts with LCC when inviter supplier or customer signs up
    * */
    updateAccountOfPartner: function (options) {
        return new Promise(async function (resolve, reject) {
            var accountId = options.accountId;
            var languageCultureCode = options.languageCultureCode;
            var status = options.status;
            var accountName = options.accountName;
            var err;

            try {
                var conn = await connection.getConnection();

                var isUpdated = await conn.query('update accounts set languageCultureCode=?, status=?,active=1, accountName=?' +
                  ' where id=uuid_to_bin(?)',
                  [languageCultureCode, status, accountName, accountId]);
                isUpdated = Utils.isAffectedPool(isUpdated);
                if (!isUpdated) {
                    err = new Error(ErrorConfig.MESSAGE.ACCOUNT_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    getUserByColorCode: function (options) {
        return new Promise(async function (resolve, reject) {
            var firstNameLetter = options.firstNameLetter;
            var lastNameLetter = options.lastNameLetter;
            var colorCode = options.colorCode;
            try {
                var conn = await connection.getConnection();
                var users = await conn.query('SELECT firstName,lastName FROM users WHERE SUBSTRING(firstName,1,1) = ? ' +
                  ' AND SUBSTRING(lastName,1,1) = ? AND colorCode = ?', [firstNameLetter, lastNameLetter, colorCode]);
                debug('length', users.length);
                if (users.length > 0) {
                    colorCode = Utils.generateRandomColorCode();
                    var option = {
                        firstNameLetter: firstNameLetter,
                        lastNameLetter: lastNameLetter,
                        colorCode: colorCode
                    };
                    return resolve(await User.getUserByColorCode(option));
                } else {
                    return resolve({colorCode: colorCode});
                }
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    checkColorCombination: async function (options, errorOptions, cb) {
        var colorCode = Utils.generateRandomColorCode();
        var firstName = options.firstName;
        var lastName = options.lastName;

        try {
            var firstNameLetter = firstName.charAt(0);
            var lastNameLetter = lastName.charAt(0);
            var checkOption = {
                firstNameLetter: firstNameLetter,
                lastNameLetter: lastNameLetter,
                colorCode: colorCode
            };
            debug('checkOption', checkOption);
            var response = await User.getUserByColorCode(checkOption);
            debug('This should be print');
            return cb(null, response);
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
    },

    /*
    * Insert notification
    * */
    createNotificationByCategory: function (options) {
        return new Promise(async function (resolve, reject) {
            var notifications = Constants.DEFAULT_NOTIFICATION_SETTINGS;
            var userId = options.userId;
            var convertedOrderList, keys, err;
            var currentTime = DataUtils.getEpochMSTimestamp();

            _.map(notifications, function (notification) {
                notification.userId = userId;
                notification.createdBy = userId;
                notification.updatedBy = userId;
                notification.createdAt = currentTime;
                notification.updatedAt = currentTime;
            });

            await Utils.convertObjectToArrayMD(notifications, async function (err, response) {
                if (err) {
                    debug('err', err);
                    return reject(err);
                }
                convertedOrderList = response.list;
                keys = response.keys;

                var query = 'insert into userPreferences (' + keys + ') values';

                var values = ' (?,?,uuid_to_bin(?),uuid_to_bin(?), uuid_to_bin(?),?,?) ';

                await Promise.each(notifications, function (value) {
                    query = query + values;
                    query = query + ',';
                });

                query = query.replace(/,\s*$/, '');

                try {
                    var conn = await connection.getConnection();
                    var notificationTypeInserted = await conn.query(query, convertedOrderList);
                    notificationTypeInserted = Utils.isAffectedPool(notificationTypeInserted);
                    debug('notificationTypeInserted-----------------------------------------', notificationTypeInserted);
                    if (!notificationTypeInserted) {
                        throw err;
                    }
                    return resolve(Constants.OK_MESSAGE);
                } catch (err) {
                    debug('err ', err);
                    err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_TYPE_CREATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
            });
        });
    },

    /*
      * Signup api function after migration
      * */
    signupMD: async function (options, auditOptions, errorOptions, cb) {
        var email = options.email;
        var password = options.password;
        var languageCultureCode = options.languageCultureCode;
        var firstName = options.firstName;
        var lastName = options.lastName;
        var planType = options.planType;
        var colorCode = options.colorCode;
        var accountName = options.accountName;
        var salt = Bcrypt.genSaltSync(10);
        var hashedPassword = Bcrypt.hashSync(password, salt);
        var generatedId = Utils.generateId();
        var createdAt = DataUtils.getEpochMSTimestamp();
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var err;


        // Enable/Disable Beta Stage
        // commented during migration bcoz this condition is not allow to create record without invitation
        /*if (!user) {
                  err = new Error(ErrorConfig.MESSAGE.USER_REGISTRATION_NOT_ALLOWED);
                  err.status = ErrorConfig.STATUS_CODE.FORBIDDEN;
                  debug(err);
                  return cb(err);
              }*/
        try {
            var conn = await connection.getConnection();
            await conn.query('START TRANSACTION');
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        try {

            var insertResponse = await conn.query('If (select 1 from users where email = ?) is null then ' +
              'INSERT into users (id,firstName,lastName,email,password,languageCultureCode,status,postRegComplete,tosStatus,' +
              'emailStatus,profileComplete,securityComplete,isAccountActive,isAccountEnabled,colorCode,createdAt,updatedAt)' +
              'values(uuid_to_bin(?),?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?); end if;',
              [email, generatedId.uuid, firstName, lastName, email, hashedPassword, languageCultureCode, Constants.USER_STATUS.ACTIVE,
                  false, false, false, false, false, false, false, colorCode, createdAt, updatedAt]);

            var isUserAffected = Utils.isAffectedPool(insertResponse);

            var userResponse;
            if (isUserAffected) {
                userResponse = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id,status,flag,postRegComplete,firstName,lastName,' +
                  'tosStatus,email,languageCultureCode,emailStatus from users where email=?', email);
                userResponse = Utils.filteredResponsePool(userResponse);
            } else {
                userResponse = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id,CAST(uuid_from_bin(accountId) as CHAR) as accountId ,firstName,lastName,' +
                  'status,flag,postRegComplete,tosStatus,email,languageCultureCode,emailStatus from users where email=?', email);
                userResponse = Utils.filteredResponsePool(userResponse);
            }

            // add notification for users
            var notificationTypeResponse = await User.createNotificationByCategory({userId: userResponse.id});
            debug('notificationTypeResponse', notificationTypeResponse);

            try {
                if (!isUserAffected) {
                    //userResponse.flag = Constants.USER_FLAG.AUTHORIZED_USER_INVITATION;
                    if (userResponse.status === Constants.USER_STATUS.ACTIVE || userResponse.status === Constants.USER_STATUS.INACTIVE || userResponse.status === Constants.USER_STATUS.CLOSED) {
                        var metaData = {};
                        var postRegComplete = userResponse.postRegComplete;

                        if (!postRegComplete) {
                            metaData = {
                                message: ErrorConfig.MESSAGE.USER_EXISTS_POST_REG_INCOMPLETE + ' : ' + email
                            };
                        } else {
                            metaData = {
                                message: ErrorConfig.MESSAGE.USER_EXISTS + ' : ' + email
                            };
                        }
                        err = new Error(ErrorConfig.MESSAGE.USER_EXISTS);
                        err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                        await ErrorUtils.create(errorOptions, options, err);
                        auditOptions.metaData = metaData;
                        AuditUtils.create(auditOptions);
                        await conn.query('rollback;');
                        return cb(err);
                    }
                    // Send notificatin to inviter if invitee signup
                    if (userResponse.status === Constants.USER_STATUS.TEMPORARY && userResponse.flag === Constants.USER_FLAG.CONTACT_INVITATION) {
                        try {
                            var option = {
                                userResponse: userResponse
                            };
                            var notifyResponse = await User.notifyInviter(option);
                        } catch (err) {
                            debug('err', err);
                            await conn.query('rollback;');
                            debug('err', err);
                            err = new Error(ErrorConfig.MESSAGE.USER_SIGNUP_FAILED);
                            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                            await ErrorUtils.create(errorOptions, options, err);
                            return cb(err);
                        }
                    }
                }
                // MAKE STATUS = ACTIVE while signup of authorize user
                //if (!isUserAffected) {
                try {
                    if (userResponse.flag === Constants.USER_FLAG.AUTHORIZED_USER_INVITATION) {
                        var updateResponse = await conn.query('update users set firstName=?,lastName=?,email=?,password=?,' +
                          ' languageCultureCode=?,status=?,postRegComplete=?,tosStatus=?,emailStatus=?,profileComplete=?,' +
                          ' securityComplete=?,isAccountActive=?,isAccountEnabled=?,authorizeUserStatus=?,colorCode=?, updatedBy=uuid_to_bin(?), ' +
                          ' updatedAt=? where id = uuid_to_bin(?)', [firstName, lastName, email, hashedPassword, languageCultureCode,
                            Constants.USER_STATUS.ACTIVE, false, false, false, false, false, true, true,
                            Constants.AUTHORIZE_USER_STATUS.ACCEPTED, colorCode, userResponse.id, updatedAt, userResponse.id]);

                        updateResponse = Utils.isAffectedPool(updateResponse);
                        if (!updateResponse) {
                            err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                            throw err;
                        }
                    }


                    // Update accounts with LCC when invited supplier or customer signs up
                    if (userResponse.flag === Constants.USER_FLAG.SUPPLIER_INVITATION ||
                      userResponse.flag === Constants.USER_FLAG.CUSTOMER_INVITATION) {
                        debug('Inside customer invitation');

                        updateResponse = await conn.query('update users set firstName=?,lastName=?,email=?,password=?,languageCultureCode=?,' +
                          ' status=?,postRegComplete=?,tosStatus=?,emailStatus=?,profileComplete=?,securityComplete=?,' +
                          ' isAccountActive=?,isAccountEnabled=?,colorCode=?,updatedBy=uuid_to_bin(?), updatedAt=? ' +
                          ' where id = uuid_to_bin(?)', [firstName, lastName, email, hashedPassword, languageCultureCode,
                            Constants.USER_STATUS.ACTIVE, false, false, false, false, false, false, false, colorCode,
                            userResponse.id, updatedAt, userResponse.id]);

                        updateResponse = Utils.isAffectedPool(updateResponse);
                        if (!updateResponse) {
                            err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                            throw err;
                        }

                        var updateAccountOption = {
                            accountId: userResponse.accountId,
                            languageCultureCode: languageCultureCode,
                            status: Constants.ACCOUNT_STATUS.ACTIVE,
                            accountName: accountName
                        };
                        var updateAccountResponse = await User.updateAccountOfPartner(updateAccountOption);
                        debug('updateAccountResponse', updateAccountResponse);
                    }

                    // Create default plan and billing cycle
                    if (userResponse.flag === Constants.USER_FLAG.SUPPLIER_INVITATION ||
                      userResponse.flag === Constants.USER_FLAG.CUSTOMER_INVITATION ||
                      userResponse.flag === Constants.USER_FLAG.CONTACT_INVITATION) {
                        var currentTime = DataUtils.getEpochMSTimestamp();
                        var billingCycleOption = {
                            accountId: userResponse.accountId,
                            planType: planType || Constants.SUB_SCRIPTION_PLANS.FREE_MONTHLY,
                            actionDate: currentTime,
                            billingCycleStartDate: currentTime,
                            effectiveFromDate: currentTime,
                            actionType: Constants.ACTION_TYPE.SIGNUP,
                            userId: userResponse.id
                        };
                        var billingCycleResponse = await PlanApi.createBillingCycle(billingCycleOption);
                        debug('billingCycleResponse', billingCycleResponse);
                    }

                    userResponse.status = Constants.USER_STATUS.ACTIVE;
                    auditOptions.userId = userResponse.id;
                    AuditUtils.create(auditOptions);
                    return cb(null, userResponse, isUserAffected);
                } catch (err) {
                    await conn.query('rollback;');
                    await ErrorUtils.create(errorOptions, options, err);
                    debug('err', err); // user updation failed
                    err = new Error(ErrorConfig.MESSAGE.USER_SIGNUP_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return cb(err);
                }
                AuditUtils.create(auditOptions);
                return cb(null, userResponse, isUserAffected);
            } catch (err) {
                await conn.query('rollback;');
                debug('err', err); // user updation failed
                return cb(err);
            }

        } catch (err) {
            await conn.query('rollback;');
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.USER_SIGNUP_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    deleteUserMD: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var userId = user.id;
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var err;

        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        try {
            await conn.query('START TRANSACTION');
            var roles = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id from user_roles where userId=uuid_to_bin(?)' +
              'and roleId = (select id from Roles where title=?)', [userId, Constants.ACCOUNT_OWNER_TITLE]);
            roles = Utils.filteredResponsePool(roles);
            if (!roles) {
                err = new Error(ErrorConfig.MESSAGE.ROLE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            auditOptions.metaData = {
                user: user
            };
            AuditUtils.create(auditOptions);

            if (roles) {
                var updatedUser = await conn.query('update users set status=?,statusReasonCode=?, updatedAt=?,' +
                  'updatedBy=uuid_to_bin(?) where id=uuid_to_bin(?)', [Constants.USER_STATUS.CLOSED, Constants.USER_INACTIVE_REASON_CODES.USER_CANCELLATION.CODE, updatedAt, userId, userId]);

                updatedUser = Utils.isAffectedPool(updatedUser);
                if (!updatedUser) {
                    err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }
                updatedUser = user;
                updatedUser.status = Constants.USER_STATUS.CLOSED;
                updatedUser.accountOwnerRolesId = roles.id;
                return cb(null, updatedUser);
            }
            if (user.flag = Constants.USER_FLAG.AUTHORIZED_USER_INVITATION) {
                var updatedUser = await conn.query('update users set status=?,authorizeUserStatus=?,statusReasonCode=?,' +
                  'updatedAt=?, updatedBy=uuid_to_bin(?) where id=uuid_to_bin(?)', [Constants.USER_STATUS.CLOSED, Constants.AUTHORIZE_USER_STATUS.DECLINED,
                    Constants.USER_INACTIVE_REASON_CODES.USER_CANCELLATION.CODE, updatedAt, userId, userId]);

                updatedUser = Utils.isAffectedPool(updatedUser);
                if (!updatedUser) {
                    err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }
                updatedUser = user;
                updatedUser.status = Constants.USER_STATUS.CLOSED;
                updatedUser.authorizeUserStatus = Constants.AUTHORIZE_USER_STATUS.DECLINED;
                return cb(null, updatedUser);
            }
            //await knex.raw('commit');
            return cb(null, user);
        } catch (err) {
            await conn.query('rollback');
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.USER_SIGNUP_CANCEL_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
        /*auditOptions.metaData = {
              user: user
          };
          AuditUtils.create(auditOptions);*/
    },

    deleteUserRolesMD: async function (options, cb) {
        var user = options.user;
        var userId = user.id;
        var err;
        //debug('defaultId', defaultId.toString().length);
        try {

            /*  var updatedUser = await knex.raw('update users set accountId=uuid_to_bin(?) where id=uuid_to_bin(?)', [defaultId, userId]);
                debug('updatedUser', updatedUser);
                updatedUser = Utils.isAffected(updatedUser);
                if (!updatedUser) {
                    throw err;
                }
  */
            var conn = await connection.getConnection();
            await conn.query('START TRANSACTION');

            var deleteUserRoles = await conn.query('delete from user_roles where userId=uuid_to_bin(?)', [userId]);
            deleteUserRoles = Utils.isAffectedPool(deleteUserRoles);
            if (!deleteUserRoles) {
                throw err;
            }
            return cb(null, deleteUserRoles);
        } catch (err) {
            await conn.query('rollback');
            debug('err', err);
            return cb(err);
        }

        /*auditOptions.metaData = {
              user: user
          };
          AuditUtils.create(auditOptions);*/
    },

    userExistsMD: async function (options, errorOptions, cb) {
        var email = options.email;
        var err;
        try {
            var conn = await connection.getConnection();
            await conn.query('START TRANSACTION');
            var user = await conn.query('select uuid_from_bin(id)as id,uuid_from_bin(accountId)as accountId from users' +
              ' where email = ?', [email]);

            user = Utils.filteredResponsePool(user);
            return cb(null, user);
        } catch (err) {
            await conn.query('rollback;');
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    userExistsWithNewMailMD: async function (options, errorOptions, cb) {
        var email = options.email;
        var skipEmailCheck = options.skipEmailCheck;
        var err;
        if (skipEmailCheck) {
            return cb();
        }
        try {
            var conn = await connection.getConnection();

            var user = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id from users where email=?', email);
            user = Utils.filteredResponsePool(user);
            debug('user', user);
            if (!user) {
                //err = new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
                //err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            return cb(null, user);
        } catch (err) {
            debug('err', err);
            //await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    verifyEmailMD: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var skipStatusCheck = options.skipStatusCheck;
        var email = user.email;
        var err;
        var tosStatus = user.tosStatus;
        var emailStatus = user.emailStatus;
        var updatedAt = DataUtils.getEpochMSTimestamp();

        if (!skipStatusCheck) {
            if (!Utils.toBoolean(tosStatus) || !Utils.toBoolean(emailStatus)) {
                err = new Error(ErrorConfig.MESSAGE.COMPLETE_PREVIOUS_POST_REG_STEPS);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                debug('err', err);
                return cb(err);
            }
        }
        try {
            var conn = await connection.getConnection();

            var userResponse = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id, emailCodeSendCount,emailCodeConfirmCount,secondaryMobile, primaryMobile from users where id = uuid_to_bin(?)', user.id);
            userResponse = Utils.filteredResponsePool(userResponse);
            debug('userResponse', userResponse);
            if (!userResponse) {
                err = new Error(ErrorConfig.MESSAGE.USER_NOT_EXISTS);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            var emailCodeSendCount;
            try {
                debug('userResponse', userResponse);
                emailCodeSendCount = parseInt(userResponse.emailCodeSendCount) + 1;
                var updatedUser = await conn.query('update users set emailCodeSendCount=?, updatedBy=uuid_to_bin(?),' +
                  'updatedAt=? where id=uuid_to_bin(?)', [emailCodeSendCount, user.id, updatedAt, user.id]);

                updatedUser = Utils.isAffectedPool(updatedUser);
                if (!updatedUser) {
                    AuditUtils.create(auditOptions);
                    err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    throw err;
                }
            } catch (err) {
                debug('errr', err);
                return cb(err);
            }
            //Block the user due to exceed limit for code resend
            debug('userResponse.emailCodeSendCount', userResponse.emailCodeSendCount);
            if (parseInt(userResponse.emailCodeSendCount) > 1) {
                try {
                    var userOptions = {
                        user: user,
                        status: Constants.USER_STATUS.INACTIVE,
                        statusReasonCode: Constants.USER_INACTIVE_REASON_CODES.SEND_VERIFICATION_CODE_ATTEMPT_EXCEED.CODE
                    };
                    debug('Inside Blocked user', userOptions);
                    //temp added comments for below code to not block user again and again, after development remove comment
                    var userBlocked = User.deactivateUserPromiseMD(userOptions, auditOptions, errorOptions);

                    var languageCultureCode = user.languageCultureCode;
                    var code = RandomSeed.intBetween(Constants.RANDOM_LOW_LIMIT, Constants.RANDOM_HIGH_LIMIT);
                    code = String(code);
                    debug('code---', code);
                    var hashedCode = DataUtils.getSha384(code).toString();

                    var opt = {
                        languageCultureCode: languageCultureCode,
                        template: Constants.EMAIL_TEMPLATES.VERIFY_EMAIL,
                        email: email
                    };

                    var compileOptions = {
                        name: user.firstName || '',
                        verification_code: code
                    };

                    EmailUtils.sendEmailMD(opt, compileOptions, function (err) {
                        if (err) {
                            debug('err', err);
                            return cb(err);
                        }
                        AuditUtils.create(auditOptions);
                        var response = {
                            OK: Constants.RESEND_SUCCESS,
                            attempts: emailCodeSendCount,
                            hashedCode: hashedCode
                        };
                        return cb(null, response);
                    });
                    /*  if (userBlocked) {
                          AuditUtils.create(auditOptions);
                          var error = new Error(ErrorConfig.MESSAGE.USER_BLOCKED_DUE_TO_EXCEED_LIMIT_FOR_RESEND);
                          error.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                          error.flag = true;
                          throw error;
                      }*/
                    /* var error = new Error(ErrorConfig.MESSAGE.USER_BLOCKED_DUE_TO_EXCEED_LIMIT_FOR_RESEND);
                     error.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                     error.flag = true;
                     return cb(error);*/
                } catch (err) {
                    return cb(err);
                }
            } else if (parseInt(userResponse.emailCodeSendCount) < 3 && parseInt(userResponse.emailCodeConfirmCount) !== 0) {
                //Allow user to try for 3 times to confirm code
                try {
                    var emailCodeConfirmCount = 0;
                    var updatedUser = await conn.query('update users set emailCodeConfirmCount=?, updatedBy=uuid_to_bin(?),' +
                      'updatedAt=? where id=uuid_to_bin(?)', [emailCodeConfirmCount, user.id, updatedAt, user.id]);

                    updatedUser = Utils.isAffectedPool(updatedUser);
                    if (!updatedUser) {
                        AuditUtils.create(auditOptions);
                        err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        throw err;
                    }

                    var languageCultureCode = user.languageCultureCode;
                    var code = RandomSeed.intBetween(Constants.RANDOM_LOW_LIMIT, Constants.RANDOM_HIGH_LIMIT);
                    code = String(code);
                    debug('code---', code);
                    var hashedCode = DataUtils.getSha384(code).toString();

                    var opt = {
                        languageCultureCode: languageCultureCode,
                        template: Constants.EMAIL_TEMPLATES.VERIFY_EMAIL,
                        email: email
                    };

                    var compileOptions = {
                        name: user.firstName || '',
                        verification_code: code
                    };

                    EmailUtils.sendEmailMD(opt, compileOptions, function (err) {
                        if (err) {
                            debug('err', err);
                            return cb(err);
                        }
                        AuditUtils.create(auditOptions);
                        var response = {
                            OK: Constants.RESEND_SUCCESS,
                            attempts: emailCodeSendCount,
                            hashedCode: hashedCode
                        };
                        return cb(null, response);
                    });
                } catch (err) {
                    debug('errr', err);
                    return cb(err);
                }
            } else {
                var languageCultureCode = user.languageCultureCode;
                var code = RandomSeed.intBetween(Constants.RANDOM_LOW_LIMIT, Constants.RANDOM_HIGH_LIMIT);
                code = String(code);
                debug('code---22', code);
                var hashedCode = DataUtils.getSha384(code).toString();

                var opt = {
                    languageCultureCode: languageCultureCode,
                    template: Constants.EMAIL_TEMPLATES.VERIFY_EMAIL,
                    email: email
                };

                var compileOptions = {
                    name: user.firstName || '',
                    verification_code: code
                };

                EmailUtils.sendEmailMD(opt, compileOptions, function (err) {
                    if (err) {
                        debug('err', err);
                        return cb(err);
                    }
                    AuditUtils.create(auditOptions);
                    var response = {
                        OK: Constants.RESEND_SUCCESS,
                        attempts: emailCodeSendCount,
                        hashedCode: hashedCode
                    };
                    return cb(null, response);
                });
            }

        } catch (err) {
            debug(err || 'Failed to fetch user having id: ' + userId);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

    },

    verifyUserEmailMD: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var skipStatusCheck = options.skipStatusCheck;
        var skipEmailCheck = options.skipEmailCheck;
        var email = options.email;
        var confirmEmail = options.confirmEmail;
        var userExist = options.userExist;
        var err;
        var tosStatus = user.tosStatus;
        var emailStatus = user.emailStatus;
        var updatedAt = DataUtils.getEpochMSTimestamp();

        if (!skipEmailCheck) {
            if (userExist) {
                err = new Error(ErrorConfig.MESSAGE.USER_WITH_THIS_EMAIL_IS_ALREADY_EXIST);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                debug('err', err);
                return cb(err);
            }
            if (DataUtils.isUndefined(email)) {
                err = new Error(ErrorConfig.MESSAGE.EMAIL_REQ);
            } else if (DataUtils.isUndefined(confirmEmail)) {
                err = new Error(ErrorConfig.MESSAGE.CONFIRM_EMAIL_REQUIRED);
            } else if (confirmEmail !== email) {
                err = new Error(ErrorConfig.MESSAGE.CONFIRM_EMAIL_AND_EMAIL_MUST_BE_SAME);
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
        }
        if (!skipStatusCheck) {
            if (!Utils.toBoolean(tosStatus) || !Utils.toBoolean(emailStatus)) {
                err = new Error(ErrorConfig.MESSAGE.COMPLETE_PREVIOUS_POST_REG_STEPS);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                debug('err', err);
                return cb(err);
            }
        }
        try {
            var conn = await connection.getConnection();

            var userResponse = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id, emailCodeSendCount,emailCodeConfirmCount,secondaryMobile, primaryMobile from users where id = uuid_to_bin(?)', user.id);
            userResponse = Utils.filteredResponsePool(userResponse);
            if (!userResponse) {
                err = new Error(ErrorConfig.MESSAGE.USER_NOT_EXISTS);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            var emailCodeSendCount;
            try {
                emailCodeSendCount = parseInt(userResponse.emailCodeSendCount) + 1;
                var updatedUser = await conn.query('update users set emailCodeSendCount=?, updatedBy=uuid_to_bin(?),' +
                  'updatedAt=? where id=uuid_to_bin(?)', [emailCodeSendCount, user.id, updatedAt, user.id]);

                updatedUser = Utils.isAffectedPool(updatedUser);
                if (!updatedUser) {
                    AuditUtils.create(auditOptions);
                    err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    throw err;
                }
            } catch (err) {
                debug('errr', err);
                return cb(err);
            }
            //Block the user due to exceed limit for code resend
            debug('userResponse.emailCodeSendCount', userResponse.emailCodeSendCount);
            if (parseInt(userResponse.emailCodeSendCount) > 2) {
                try {
                    var userOptions = {
                        user: user,
                        status: Constants.USER_STATUS.INACTIVE,
                        statusReasonCode: Constants.USER_INACTIVE_REASON_CODES.SEND_VERIFICATION_CODE_ATTEMPT_EXCEED.CODE
                    };
                    debug('Inside Blocked user', userOptions);
                    //temp added comments for below code to not block user again and again, after development remove comment
                    var userBlocked = User.deactivateUserPromiseMD(userOptions, auditOptions, errorOptions);

                    if (userBlocked) {
                        AuditUtils.create(auditOptions);
                        var error = new Error(ErrorConfig.MESSAGE.USER_BLOCKED_DUE_TO_EXCEED_LIMIT_FOR_RESEND);
                        error.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        error.flag = true;
                        throw error;
                    }
                    /* var error = new Error(ErrorConfig.MESSAGE.USER_BLOCKED_DUE_TO_EXCEED_LIMIT_FOR_RESEND);
                     error.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                     error.flag = true;
                     return cb(error);*/
                } catch (err) {
                    return cb(err);
                }
            } else if (parseInt(userResponse.emailCodeSendCount) < 3 && parseInt(userResponse.emailCodeConfirmCount) !== 0) {
                //Allow user to try for 3 times to confirm code
                try {
                    var emailCodeConfirmCount = 0;
                    var updatedUser = await conn.query('update users set emailCodeConfirmCount=?, updatedBy=uuid_to_bin(?),' +
                      'updatedAt=? where id=uuid_to_bin(?)', [emailCodeConfirmCount, user.id, updatedAt, user.id]);

                    updatedUser = Utils.isAffectedPool(updatedUser);
                    if (!updatedUser) {
                        AuditUtils.create(auditOptions);
                        err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        throw err;
                    }

                    var languageCultureCode = user.languageCultureCode;
                    var code = RandomSeed.intBetween(Constants.RANDOM_LOW_LIMIT, Constants.RANDOM_HIGH_LIMIT);
                    code = String(code);
                    var hashedCode = DataUtils.getSha384(code).toString();

                    if (skipEmailCheck) {
                        email = user.email;
                    }
                    var opt = {
                        languageCultureCode: languageCultureCode,
                        template: Constants.EMAIL_TEMPLATES.VERIFY_EMAIL,
                        email: email
                    };

                    var compileOptions = {
                        name: user.firstName || '',
                        verification_code: code
                    };

                    EmailUtils.sendEmailMD(opt, compileOptions, function (err) {
                        if (err) {
                            debug('err', err);
                            return cb(err);
                        }
                        AuditUtils.create(auditOptions);
                        var response = {
                            OK: Constants.RESEND_SUCCESS,
                            attempts: emailCodeSendCount,
                            hashedCode: hashedCode
                        };
                        return cb(null, response);
                    });
                } catch (err) {
                    debug('errr', err);
                    return cb(err);
                }
            } else {
                var languageCultureCode = user.languageCultureCode;
                var code = RandomSeed.intBetween(Constants.RANDOM_LOW_LIMIT, Constants.RANDOM_HIGH_LIMIT);
                code = String(code);
                var hashedCode = DataUtils.getSha384(code).toString();

                if (skipEmailCheck) {
                    email = user.email;
                }
                var opt = {
                    languageCultureCode: languageCultureCode,
                    template: Constants.EMAIL_TEMPLATES.VERIFY_EMAIL,
                    email: email
                };

                var compileOptions = {
                    name: user.firstName || '',
                    verification_code: code
                };

                EmailUtils.sendEmailMD(opt, compileOptions, function (err) {
                    if (err) {
                        debug('err', err);
                        return cb(err);
                    }
                    AuditUtils.create(auditOptions);
                    var response = {
                        OK: Constants.RESEND_SUCCESS,
                        attempts: emailCodeSendCount,
                        hashedCode: hashedCode
                    };
                    return cb(null, response);
                });
            }

        } catch (err) {
            debug(err || 'Failed to fetch user having id: ' + userId);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

    },

    confirmUserEmailVerificationMD: async function (options, errorOptions, cb) {
        // TODO - Dheeraj = Only change if email is not verified earlier
        var err;
        var user = options.user;
        var updatedAt = options.updatedAt;
        var emailStatus = true;
        var emailUtcDateTime = new Date(DataUtils.getCurrentUtcDateString());
        var emailCodeSendCount = 0;
        var emailCodeConfirmCount = 0;
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();

        emailUtcDateTime = moment(emailUtcDateTime).utc().format('YYYY-MM-DD HH:mm:ss.SSS');

        /*if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_MUST_BE_NUMBER);
        } else if (updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_IS_INVALID);
        }*/

        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();

            var updatedUser = await conn.query('IF (select 1 from users where id=uuid_to_bin(?)) is null then ' +
              'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "USER_NOT_FOUND", MYSQL_ERRNO = 4001;' +
              'ELSE update users set emailStatus=? , emailUtcDateTime=? , ' +
              'emailCodeSendCount=?,emailCodeConfirmCount=?,' +
              'updatedAt=?, updatedBy=uuid_to_bin(?) where id = uuid_to_bin(?);END IF;',
              [user.id, emailStatus, emailUtcDateTime, emailCodeSendCount, emailCodeConfirmCount, newUpdatedAt, user.id, user.id]);

            updatedUser = Utils.isAffectedPool(updatedUser);
            if (!updatedUser) {
                err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }

            user.updatedAt = newUpdatedAt;
            user.emailStatus = emailStatus;
            user.emailUtcDateTime = emailUtcDateTime;
            return cb(null, user);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            } else if (err.errno === 4002) {
                err = new Error(ErrorConfig.MESSAGE.USER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                return cb(err);
            } else {
                err = new Error(ErrorConfig.MESSAGE.VERIFY_EMAIL_INITIATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
        }
    },

    confirmResetPasswordVerificationMD: async function (options, errorOptions, cb) {
        var updatedAt = DataUtils.getEpochMSTimestamp();

        var user = options.user;
        var fromLogin = options.fromLogin;
        var newPassword = options.newPassword;
        var resetPasswordCodeSendCount = 0;
        var resetPasswordCodeConfirmCount = 0;
        var lastPasswordChanged = new Date().getTime();
        var err;

        if (!fromLogin && DataUtils.isUndefined(newPassword)) {
            err = new Error(ErrorConfig.MESSAGE.NEW_PASSWORD_REQ);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, {}, err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        if (!fromLogin && DataUtils.isDefined(newPassword)) {
            var salt = Bcrypt.genSaltSync(10);
            var hashedPassword = Bcrypt.hashSync(newPassword, salt);

            try {
                var updatedUser = await conn.query('update users set password=? , lastPasswordChanged=?,' +
                  'resetPasswordCodeSendCount=?,resetPasswordCodeConfirmCount=?,' +
                  'updatedAt=?, updatedBy=uuid_to_bin(?) where id = uuid_to_bin(?);',
                  [hashedPassword, lastPasswordChanged, resetPasswordCodeSendCount, resetPasswordCodeConfirmCount, updatedAt, user.id, user.id]);

                updatedUser = Utils.isAffectedPool(updatedUser);
                if (!updatedUser) {
                    err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }
                return cb(null, {advancedAuthNumber: user.advancedAuthNumber});

            } catch (err) {
                debug('err', err);
                await ErrorUtils.create(errorOptions, options, err);
                err = new Error(ErrorConfig.MESSAGE.VERIFY_EMAIL_INITIATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
        } else {
            try {

                var updatedUser = await conn.query('update users set ' +
                  'resetPasswordCodeSendCount=?,resetPasswordCodeConfirmCount=?,' +
                  'updatedAt=?, updatedBy=uuid_to_bin(?) where id = uuid_to_bin(?);',
                  [resetPasswordCodeSendCount, resetPasswordCodeConfirmCount, updatedAt, user.id, user.id]);

                updatedUser = Utils.isAffectedPool(updatedUser);
                if (!updatedUser) {
                    err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }
                return cb(null, {advancedAuthNumber: user.advancedAuthNumber});

            } catch (err) {
                debug('err', err);
                await ErrorUtils.create(errorOptions, options, err);
                err = new Error(ErrorConfig.MESSAGE.VERIFY_EMAIL_INITIATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }

        }

    },

    confirmEmailVerificationMD: async function (options, errorOptions, cb) {
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var err;
        // TODO - Dheeraj = Only change if email is not verified earlier
        if (DataUtils.isUndefined(options.deviceDateTime)) {
            err = new Error(ErrorConfig.MESSAGE.DEVICE_DATE_TIME_MISSING);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
        var user = options.user;
        var emailStatus = true;
        var emailUtcDateTime = new Date(DataUtils.getCurrentUtcDateString());
        var emailLocalDeviceDateTime = new Date(options.deviceDateTime);
        var emailCodeSendCount = 0;
        var emailCodeConfirmCount = 0;
        emailUtcDateTime = moment(emailUtcDateTime).utc().format('YYYY-MM-DD HH:mm:ss.SSS');
        emailLocalDeviceDateTime = moment(emailLocalDeviceDateTime).format('YYYY-MM-DD HH:mm:ss.SSS');

        try {
            var conn = await connection.getConnection();

            var updatedUser = await conn.query('update users set emailStatus=? , emailUtcDateTime=? ,emailLocalDeviceDateTime=?,' +
              'emailCodeSendCount=?,emailCodeConfirmCount=?,' +
              'updatedAt=?, updatedBy=uuid_to_bin(?) where id = uuid_to_bin(?);',
              [emailStatus, emailUtcDateTime, emailLocalDeviceDateTime, emailCodeSendCount, emailCodeConfirmCount, updatedAt, user.id, user.id]);

            updatedUser = Utils.isAffectedPool(updatedUser);
            if (!updatedUser) {
                err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            user.updatedAt = updatedAt.toString();
            user.emailStatus = emailStatus;
            user.emailUtcDateTime = emailUtcDateTime;
            return cb(null, user);
            /*User.getUserByIdMD(user.id, function (err, response) {
                if (err) {
                    debug('err', err);
                    return cb(err);
                }

            });
*/
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.VERIFY_EMAIL_INITIATE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    verifyCodeMD: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var userId = user.id;
        var actualCode = options.actualCode;
        var codeSendTime = options.codeSendTime;
        var code = options.code;
        var updatedAt = DataUtils.getEpochMSTimestamp();

        var currentTime = new Date().getTime();
        codeSendTime = new Date(codeSendTime).getTime() + (Constants.CODE_EXPIRE_LIMIT * 60000);

        var err;

        if (DataUtils.isUndefined(code)) {
            err = new Error(ErrorConfig.MESSAGE.VERIFICATION_CODE_REQUIRED);
        } else if (currentTime > codeSendTime) {
            err = new Error(ErrorConfig.MESSAGE.CODE_EXPIRES_DUE_TO_TIME_LIMIT);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, {}, err);
            return cb(err);
        }
        try {
            code = DataUtils.getSha384(code).toString();
        } catch (e) {
            code = null;
        }

        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        try {
            var userResponse = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id, phoneCodeConfirmCount,emailCodeConfirmCount ,' +
              'resetPasswordCodeConfirmCount from users where id = uuid_to_bin(?)', userId);
            userResponse = Utils.filteredResponsePool(userResponse);
            if (!userResponse) {
                err = new Error(ErrorConfig.MESSAGE.USER_NOT_EXISTS);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }

        } catch (err) {
            debug('err', err);
            return cb(err);
        }
        try {
            if (options.flag === 'phoneConfirm') {
                var phoneCodeConfirmCount = parseInt(userResponse.phoneCodeConfirmCount) + 1;
                var updatedUser = await conn.query('update users set phoneCodeConfirmCount=?, status = ?,statusReasonCode=?,updatedBy=uuid_to_bin(?),' +
                  'updatedAt=? where id=uuid_to_bin(?)', [phoneCodeConfirmCount, Constants.USER_STATUS.ACTIVE,
                    Constants.USER_INACTIVE_REASON_CODES.DEFAULT.CODE, userId, updatedAt, userId]);

                if (parseInt(userResponse.phoneCodeConfirmCount) > 1) {
                    if (actualCode === code) {
                        return cb();
                    }
                    try {
                        var userOptions = {
                            user: user,
                            status: Constants.USER_STATUS.INACTIVE,
                            statusReasonCode: Constants.USER_INACTIVE_REASON_CODES.CONFIRM_VERIFICATION_CODE_ATTEMPT_EXCEED.CODE
                        };
                        debug('Inside Blocked user', userOptions);
                        //temp added comments for below code to not block user again and again, after development remove comment
                        var userBlocked = User.deactivateUserPromiseMD(userOptions, auditOptions, errorOptions);

                        if (userBlocked) {
                            AuditUtils.create(auditOptions);
                            //await ErrorUtils.create(errorOptions, {}, err);
                            var error = new Error(ErrorConfig.MESSAGE.USER_BLOCKED_DUE_TO_EXCEED_LIMIT_FOR_CONFIRM_VERIFICATION_CODE);
                            error.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                            error.flag = true;
                            throw error;
                        }
                        // return cb();
                        /*var error = new Error(ErrorConfig.MESSAGE.USER_BLOCKED_DUE_TO_EXCEED_LIMIT_FOR_CONFIRM_VERIFICATION_CODE);
                        error.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        error.flag = true;
                        return cb(error);*/
                    } catch (err) {
                        debug('errr', err);
                        return cb(err);
                    }
                } else if (actualCode !== code) {
                    err = new Error(ErrorConfig.MESSAGE.VERIFICATION_CODE_INVALID);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    err.attempts = phoneCodeConfirmCount;
                    await ErrorUtils.create(errorOptions, {}, err);
                    return cb(err);
                }
            }

            if (options.flag === 'emailConfirm') {
                var emailCodeConfirmCount = parseInt(userResponse.emailCodeConfirmCount) + 1;
                var updatedUser = await conn.query('update users set emailCodeConfirmCount=?,status = ?,statusReasonCode=?, updatedBy=uuid_to_bin(?),' +
                  'updatedAt=? where id=uuid_to_bin(?)', [emailCodeConfirmCount, Constants.USER_STATUS.ACTIVE,
                    Constants.USER_INACTIVE_REASON_CODES.DEFAULT.CODE, userId, updatedAt, userId]);

                if (parseInt(userResponse.emailCodeConfirmCount) > 1) {
                    if (actualCode === code) {
                        return cb();
                    }
                    try {
                        var userOptions = {
                            user: user,
                            status: Constants.USER_STATUS.INACTIVE,
                            statusReasonCode: Constants.USER_INACTIVE_REASON_CODES.CONFIRM_VERIFICATION_CODE_ATTEMPT_EXCEED.CODE
                        };
                        debug('Inside Blocked user', userOptions);
                        //temp added comments for below code to not block user again and again, after development remove comment
                        var userBlocked = User.deactivateUserPromiseMD(userOptions, auditOptions, errorOptions);

                        if (userBlocked) {
                            AuditUtils.create(auditOptions);
                            //await ErrorUtils.create(errorOptions, {}, err);
                            var error = new Error(ErrorConfig.MESSAGE.USER_BLOCKED_DUE_TO_EXCEED_LIMIT_FOR_CONFIRM_VERIFICATION_CODE);
                            error.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                            error.flag = true;
                            throw error;
                        }
                        /* var error = new Error(ErrorConfig.MESSAGE.USER_BLOCKED_DUE_TO_EXCEED_LIMIT_FOR_CONFIRM_VERIFICATION_CODE);
                         error.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                         error.flag = true;
                         return cb(error);*/
                    } catch (err) {
                        debug('errr', err);
                        return cb(err);
                    }
                } else if (actualCode !== code) {
                    err = new Error(ErrorConfig.MESSAGE.VERIFICATION_CODE_INVALID);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    err.attempts = emailCodeConfirmCount;
                    await ErrorUtils.create(errorOptions, {}, err);
                    return cb(err);
                }
            }

            if (options.flag === 'resetPasswordConfirm') {

                var resetPasswordCodeConfirmCount = parseInt(userResponse.resetPasswordCodeConfirmCount) + 1;
                var updatedUser = await conn.query('update users set resetPasswordCodeConfirmCount=?,status = ?,statusReasonCode=?, updatedBy=uuid_to_bin(?),' +
                  'updatedAt=? where id=uuid_to_bin(?)', [resetPasswordCodeConfirmCount, Constants.USER_STATUS.ACTIVE,
                    Constants.USER_INACTIVE_REASON_CODES.DEFAULT.CODE, userId, updatedAt, userId]);

                if (parseInt(userResponse.resetPasswordCodeConfirmCount) > 1) {
                    if (actualCode === code) {
                        return cb();
                    }
                    try {
                        var userOptions = {
                            user: user,
                            status: Constants.USER_STATUS.INACTIVE,
                            statusReasonCode: Constants.USER_INACTIVE_REASON_CODES.CONFIRM_VERIFICATION_CODE_ATTEMPT_EXCEED.CODE
                        };
                        debug('Inside Blocked user', userOptions);
                        //temp added comments for below code to not block user again and again, after development remove comment
                        var userBlocked = User.deactivateUserPromiseMD(userOptions, auditOptions, errorOptions);

                        if (userBlocked) {
                            AuditUtils.create(auditOptions);
                            //await ErrorUtils.create(errorOptions, {}, err);
                            var error = new Error(ErrorConfig.MESSAGE.USER_BLOCKED_DUE_TO_EXCEED_LIMIT_FOR_CONFIRM_VERIFICATION_CODE);
                            error.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                            error.flag = true;
                            throw error;
                        }
                        /* var error = new Error(ErrorConfig.MESSAGE.USER_BLOCKED_DUE_TO_EXCEED_LIMIT_FOR_CONFIRM_VERIFICATION_CODE);
                         error.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                         error.flag = true;
                         return cb(error);*/
                    } catch (err) {
                        debug('err', err);
                        return cb(err);
                    }
                } else if (actualCode !== code) {
                    err = new Error(ErrorConfig.MESSAGE.VERIFICATION_CODE_INVALID);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    err.attempts = resetPasswordCodeConfirmCount;
                    await ErrorUtils.create(errorOptions, {}, err);
                    return cb(err);
                }
            }

            updatedUser = Utils.isAffectedPool(updatedUser);
            if (!updatedUser) {
                AuditUtils.create(auditOptions);
                err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

        } catch (err) {
            debug('err', err);
            return cb(err);
        }


        /*if (parseInt(userResponse.phoneCodeConfirmCount) > 1 || parseInt(userResponse.emailCodeConfirmCount) > 1) {
            if (actualCode === code) {
                return cb();
            }
            try {
                var userOptions = {
                    user: user,
                    status: Constants.USER_STATUS.INACTIVE,
                    statusReasonCode: Constants.USER_INACTIVE_REASON_CODES.CONFIRM_VERIFICATION_CODE_ATTEMPT_EXCEED.CODE
                };
                var userBlocked = User.deactivateUserPromiseMD(userOptions, auditOptions, errorOptions);

                if (userBlocked) {
                    AuditUtils.create(auditOptions);
                    //await ErrorUtils.create(errorOptions, {}, err);
                    var error = new Error(ErrorConfig.MESSAGE.USER_BLOCKED_DUE_TO_EXCEED_LIMIT_FOR_CONFIRM_VERIFICATION_CODE);
                    error.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    error.flag = true;
                    throw error;
                }
            } catch (err) {
                debug('errr', err);
                return cb(err);
            }
        }*/

        if (actualCode !== code) {
            err = new Error(ErrorConfig.MESSAGE.VERIFICATION_CODE_INVALID);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, {}, err);
            return cb(err);
        }
        return cb(null, phoneCodeConfirmCount);
    },

    verifyPhoneMD: async function (options, auditOptions, errorOptions, cb) {
        var phone = options.phone;
        var user = options.user;
        var userId = user.id;
        var isPrimary = options.isPrimary;
        var sendToAAN = options.sendToAAN;
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var err;

        if (!sendToAAN) {
            if (DataUtils.isUndefined(phone)) {
                err = new Error(ErrorConfig.MESSAGE.PHONE_NUMBER_NOT_AVAILABLE);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                debug(err);
                return cb(err);
            }
        }

        try {
            var conn = await connection.getConnection();

            var userResponse = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id, phoneCodeSendCount,phoneCodeConfirmCount,secondaryMobile, primaryMobile from users where id = uuid_to_bin(?)', userId);
            userResponse = Utils.filteredResponsePool(userResponse);
            debug('userResponse', userResponse);
            if (!userResponse) {
                err = new Error(ErrorConfig.MESSAGE.USER_NOT_EXISTS);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            var secondaryMobile = userResponse.secondaryMobile;
            var primaryMobile = userResponse.primaryMobile;

            if (!sendToAAN) {
                if (isPrimary) {
                    if (phone === secondaryMobile) {
                        err = new Error(ErrorConfig.MESSAGE.MOBILE_1_MUST_DIFFERENT_THAN_MOBILE_2);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        return cb(err);
                    }
                } else {
                    if (phone === primaryMobile) {
                        err = new Error(ErrorConfig.MESSAGE.MOBILE_2_MUST_DIFFERENT_THAN_MOBILE_1);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        return cb(err);
                    }
                }
            }
            var phoneCodeSendCount;
            try {
                phoneCodeSendCount = parseInt(userResponse.phoneCodeSendCount) + 1;
                var updatedUser = await conn.query('update users set phoneCodeSendCount=?, updatedBy=uuid_to_bin(?),' +
                  'updatedAt=? where id=uuid_to_bin(?)', [phoneCodeSendCount, userId, updatedAt, userId]);

                updatedUser = Utils.isAffectedPool(updatedUser);
                if (!updatedUser) {
                    AuditUtils.create(auditOptions);
                    err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    throw err;
                }
            } catch (err) {
                debug('errr', err);
                return cb(err);
            }

            //Block the user due to exceed limit for code resend
            if (parseInt(userResponse.phoneCodeSendCount) > 1) {
                try {
                    var userOptions = {
                        user: user,
                        status: Constants.USER_STATUS.INACTIVE,
                        statusReasonCode: Constants.USER_INACTIVE_REASON_CODES.SEND_VERIFICATION_CODE_ATTEMPT_EXCEED.CODE
                    };
                    debug('Inside Blocked user', userOptions);
                    //temp added comments for below code to not block user again and again, after development remove comment
                    var userBlocked = User.deactivateUserPromiseMD(userOptions, auditOptions, errorOptions);
                    var code = RandomSeed.intBetween(Constants.RANDOM_LOW_LIMIT, Constants.RANDOM_HIGH_LIMIT);
                    code = String(code);
                    debug('code----111', code);
                    var hashedCode = DataUtils.getSha384(code).toString();
                    var opt = {
                        phone: phone,
                        code: code
                    };
                    // Audit Log
                    AuditUtils.create(auditOptions);
                    var response = {
                        OK: Constants.RESEND_SUCCESS,
                        attempts: phoneCodeSendCount,
                        hashedCode: hashedCode
                    };
                    User.sendCode(opt, function (err) {
                        return cb(null, response);
                    });
                    /* if (userBlocked) {
                         AuditUtils.create(auditOptions);
                         var error = new Error(ErrorConfig.MESSAGE.USER_BLOCKED_DUE_TO_EXCEED_LIMIT_FOR_RESEND);
                         error.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                         error.flag = true;
                         throw error;
                     }*/
                    /* var error = new Error(ErrorConfig.MESSAGE.USER_BLOCKED_DUE_TO_EXCEED_LIMIT_FOR_RESEND);
                     error.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                     error.flag = true;
                     return cb(error);*/
                } catch (err) {
                    return cb(err);
                }
            } else if (parseInt(userResponse.phoneCodeSendCount) < 3 && parseInt(userResponse.phoneCodeConfirmCount) !== 0) {
                //Allow user to try for 3 times to confirm code
                try {
                    var phoneCodeConfirmCount = 0;
                    var updatedUser = await conn.query('update users set phoneCodeConfirmCount=?, updatedBy=uuid_to_bin(?),' +
                      'updatedAt=? where id=uuid_to_bin(?)', [phoneCodeConfirmCount, userId, updatedAt, userId]);

                    updatedUser = Utils.isAffectedPool(updatedUser);
                    if (!updatedUser) {
                        AuditUtils.create(auditOptions);
                        err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        throw err;
                    }
                    var code = RandomSeed.intBetween(Constants.RANDOM_LOW_LIMIT, Constants.RANDOM_HIGH_LIMIT);
                    code = String(code);
                    debug('code----111', code);
                    var hashedCode = DataUtils.getSha384(code).toString();
                    var opt = {
                        phone: phone,
                        code: code
                    };
                    // Audit Log
                    AuditUtils.create(auditOptions);
                    var response = {
                        OK: Constants.RESEND_SUCCESS,
                        attempts: phoneCodeSendCount,
                        hashedCode: hashedCode
                    };
                    User.sendCode(opt, function (err) {
                        return cb(null, response);
                    });
                } catch (err) {
                    debug('errr', err);
                    return cb(err);
                }
            } else {
                var code = RandomSeed.intBetween(Constants.RANDOM_LOW_LIMIT, Constants.RANDOM_HIGH_LIMIT);
                code = String(code);
                debug('code----', code);
                var hashedCode = DataUtils.getSha384(code).toString();
                var opt = {
                    phone: phone,
                    code: code
                };
                // Audit Log
                AuditUtils.create(auditOptions);
                var response = {
                    OK: Constants.RESEND_SUCCESS,
                    attempts: phoneCodeSendCount,
                    hashedCode: hashedCode
                };
                User.sendCode(opt, function (err) {
                    return cb(null, response);
                });
            }
        } catch (err) {
            debug(err || 'Failed to fetch user having id: ' + userId);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        /*if (sendCount > 3) {
            var error = new Error(ErrorConfig.MESSAGE.USER_BLOCKED_DUE_TO_EXCEED_LIMIT_FOR_RESEND);
            error.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
            debug('err', error);
            var userOptions = {
                user: user,
                status: Constants.USER_STATUS.INACTIVE,
                statusReasonCode: Constants.USER_INACTIVE_REASON_CODES.SEND_VERIFICATION_CODE_ATTEMPT_EXCEED.CODE
            };

            //Block the user due to exceed limit for code resend
            User.deactivateUserMD(userOptions, function (err, response) {

                debug('response', response);
                debug('err', err);
            });
        } else {
            // This is for Phone
            if (DataUtils.isUndefined(phone)) {
                err = new Error(ErrorConfig.MESSAGE.PHONE_NUMBER_NOT_AVAILABLE);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                debug(err);
                return cb(err);
            }

            var code = RandomSeed.intBetween(Constants.RANDOM_LOW_LIMIT, Constants.RANDOM_HIGH_LIMIT);
            code = String(code);
            var hashedCode = DataUtils.getSha384(code).toString();
            var opt = {
                phone: phone,
                code: code
            };
            // Audit Log
            AuditUtils.create(auditOptions);
            User.sendCode(opt, function (err) {
                return cb(null, hashedCode);
            });
        }*/
    },

    updatePrimaryPhoneMD: async function (options, cb) {
        var id = options.id;
        var primaryStatus = true;
        var primaryUtcDateTime = moment(new Date()).utc().format('YYYY-MM-DD HH:mm:ss.SSS');
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var phoneCodeConfirmCount = 0;
        var phoneCodeSendCount = 0;
        var err;
        try {
            var conn = await connection.getConnection();

            var updatedUser = await conn.query('update users set primaryMobileStatus=? , primaryMobileUtcDateTime=? ,' +
              'phoneCodeConfirmCount=?,phoneCodeSendCount=?,' +
              'updatedAt=?, updatedBy=uuid_to_bin(?) where id=uuid_to_bin(?)',
              [primaryStatus, primaryUtcDateTime, phoneCodeConfirmCount, phoneCodeSendCount, updatedAt, id, id]);

            updatedUser = Utils.isAffectedPool(updatedUser);

            if (!updatedUser) {
                err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            var response = {
                primaryStatus: primaryStatus,
                primaryUtcDateTime: primaryUtcDateTime,
                updatedAt: updatedAt
            };
            return cb(null, response);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    updateSecondaryPhoneMD: async function (options, cb) {
        var id = options.id;
        var secondaryStatus = true;
        var secondaryUtcDateTime = moment(new Date()).utc().format('YYYY-MM-DD HH:mm:ss.SSS');
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var phoneCodeConfirmCount = 0;
        var phoneCodeSendCount = 0;
        var err;
        try {
            var conn = await connection.getConnection();

            var updatedUser = await conn.query('update users set secondaryMobileStatus=? , secondaryMobileUtcDateTime=? ,' +
              'phoneCodeConfirmCount=?,phoneCodeSendCount=?,' +
              'updatedAt=?, updatedBy=uuid_to_bin(?) where id=uuid_to_bin(?)',
              [secondaryStatus, secondaryUtcDateTime, phoneCodeConfirmCount, phoneCodeSendCount, updatedAt, id, id]);

            updatedUser = Utils.isAffectedPool(updatedUser);

            if (!updatedUser) {
                err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            var response = {
                secondaryStatus: secondaryStatus,
                secondaryUtcDateTime: secondaryUtcDateTime,
                updatedAt: updatedAt
            };
            return cb(null, response);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    confirmPhoneVerificationMD: async function (options, errorOptions, cb) {
        var err;
        // TODO - Dheeraj = Only change if phone is not verified earlier
        var user = options.user;
        var isPrimary = options.isPrimary;
        var fromLogin = options.fromLogin;
        var id = user.id;
        var updatedAt = DataUtils.getEpochMSTimestamp();
        try {
            var conn = await connection.getConnection();

            if (fromLogin || (DataUtils.isValidateOptionalField(fromLogin) && DataUtils.isValidateOptionalField(isPrimary))) {
                debug('fromLogin', fromLogin);
                try {
                    var phoneCodeSendCount = 0;
                    var phoneCodeConfirmCount = 0;
                    var updatedUser = await conn.query('update users set phoneCodeSendCount=?,phoneCodeConfirmCount=?, updatedBy=uuid_to_bin(?),' +
                      'updatedAt=? where id=uuid_to_bin(?)', [phoneCodeSendCount, phoneCodeConfirmCount, id, updatedAt, id]);

                    updatedUser = Utils.isAffectedPool(updatedUser);
                    if (!updatedUser) {
                        err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        throw err;
                    }
                } catch (err) {
                    debug('errr', err);
                    return cb(err);
                }
                return cb(null, user);
            } else if (isPrimary) {
                User.updatePrimaryPhoneMD({id: id}, function (err, response) {
                    if (err) {
                        debug('err', err);
                        return cb(err);
                    }

                    user.primaryMobileStatus = response.primaryStatus;
                    user.primaryMobileUtcDateTime = response.primaryUtcDateTime;
                    user.updatedAt = response.updatedAt;

                    //THIS PERMISION PART IS REMAINING
                    /*if (user.settings && user.settings.phone && user.settings.phone.useForTwoFactor === true) {
                          if (DataUtils.isArray(user.roles) && !_.isEmpty(user.roles)) {
                              var options = {
                                  roles: user.roles
                              };

                              User.getPermission(options, function (err, permissions) {
                                  if (err) {
                                      debug('err', err);
                                      return cb(err);
                                  }
                                  user.permissions = permissions;
                                  return cb(null, user);
                              });
                          } else {
                              return cb(null, user);
                          }
                      } else {
                          return cb(null, user);
                      }*/
                    return cb(null, user);

                });
            } else {
                User.updateSecondaryPhoneMD({id: id}, function (err, response) {
                    if (err) {
                        debug('err', err);
                        return cb(err);
                    }
                    user.secondaryMobileStatus = response.primaryStatus;
                    user.secondaryMobileUtcDateTime = response.primaryUtcDateTime;
                    user.updatedAt = response.updatedAt;
                    return cb(null, user);
                });
            }
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            Util.log(err);
            return cb(err);
        }
    },

    closeAccount: function (options, auditOptions, cb) {
        var statusReasonCode;
        if (options.tos_decline) {
            statusReasonCode = Constants.USER_INACTIVE_REASON_CODES.TOS_NOT_ACCEPTED.CODE;
        } else if (options.user_request) {
            statusReasonCode = Constants.USER_INACTIVE_REASON_CODES.USER_BLOCKED.CODE;
        }

        if (!statusReasonCode) {
            var err = new Error(ErrorConfig.MESSAGE.CLOSE_ACCOUNT_STATUS_MISSING);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        var userOptions = {
            id: options.userId,
            status: Constants.USER_STATUS.INACTIVE,
            statusReasonCode: statusReasonCode
        };
        auditOptions.metaData = {
            tos_decline: options.tos_decline,
            user_request: options.user_request
        };

        UserModel.update(userOptions, function (err) {
            if (err) {
                return cb(err);
            }
            // Audit Log
            AuditUtils.create(auditOptions);
            return cb();
        });
    },

    getResetSecurityQuestions: function (options, auditOptions, cb) {
        var err;
        var email = options.email;
        if (DataUtils.isUndefined(email)) {
            err = new Error(ErrorConfig.MESSAGE.EMAIL_REQ);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
        User.getUserByEmail(email, function (err, user) {
            if (err) {
                return cb(err);
            }
            user = user.attrs;
            auditOptions.userId = user.id;

            var securityQuestions = user.securityQuestions;
            if (!securityQuestions || !securityQuestions.length) {
                err = new Error(ErrorConfig.MESSAGE.SECURITY_QUESTIONS_NOT_REGISTERED);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                return cb(err);
            }
            var securityData = {
                questions: [],
                answers: []
            };
            var response = {
                user: user,
                security_data: securityData
            };

            var questions = securityData.questions;
            var answers = securityData.answers;
            var count = 1;
            securityQuestions.forEach(function (securityQuestion) {
                var question = {
                    id: count,
                    description: securityQuestion.description
                };
                var answer = {
                    id: count,
                    answer: securityQuestion.answer
                };
                questions.push(question);
                answers.push(answer);
                count++;
            });
            var random = Math.floor(Math.random() * 3);
            questions.splice(random, 1);
            answers.splice(random, 1);

            var languageCultureCode = user.languageCultureCode;
            AuditUtils.create(auditOptions);

            var opt = {
                languageCultureCode: languageCultureCode,
                template: Constants.EMAIL_TEMPLATES.RESET_PASSWORD_NOTIFIER,
                email: user.email
            };

            var compileOptions = {
                name: user.firstName,
                disconnect_url: Endpoints.DISCONNECT_URL
            };

            EmailUtils.sendEmail(opt, compileOptions, function (err) {
                if (err) {
                    return cb(err);
                }
                return cb(null, response);
            });
        });
    },

    acceptTOSMD: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var email = options.email;
        var userId = user.id;
        var tosStatus = true;
        var tosUtcDateTime = DataUtils.getCurrentUtcDateString();
        var tosLocalDeviceDateTime = options.deviceDateTime || new Date();
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var err;

        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
        try {

            var updatedUser = await conn.query('update users set tosStatus=? , tosUtcDateTime=? , tosLocalDeviceDateTime=?, ' +
              'updatedAt=?, updatedBy=uuid_to_bin(?) where email=?;',
              [tosStatus, new Date(tosUtcDateTime), tosLocalDeviceDateTime, updatedAt, userId, email]);

            updatedUser = Utils.isAffectedPool(updatedUser);
            if (!updatedUser) {
                err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            user.tosStatus = tosStatus;
            user.tosUtcDateTime = tosUtcDateTime;
            user.tosLocalDeviceDateTime = tosLocalDeviceDateTime;
            /*updatedUser = {};
              updatedUser.id = user.id;
              updatedUser.accountId = user.accountId;*/
            /*var notification = {
                user_ids: [user.id],
                topic_id: user.id,
                notification_reference: NotificationReferenceData.ACCEPT_TOS,
                data: {
                    user: user
                },
                languageCultureCode: user.languageCultureCode
            };
            NotificationApi.create(notification);*/
            AuditUtils.create(auditOptions);
            return cb(null, user);

        } catch (err) {
            await ErrorUtils.create(errorOptions, options, err);
            debug('err', err);
            return cb(err);
        }
    },

    saveSecurityQuestionsMD: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var err;
        var tosStatus = Utils.toBoolean(user.tosStatus);
        var emailStatus = Utils.toBoolean(user.emailStatus);
        var securityQuestionStatus = Utils.toBoolean(user.securityQuestionStatus);
        var updatedAt = DataUtils.getEpochMSTimestamp();

        if (!tosStatus || !emailStatus) {
            err = new Error(ErrorConfig.MESSAGE.COMPLETE_PREVIOUS_POST_REG_STEPS);
        }
        if (!err && DataUtils.isUndefined(options.deviceDateTime)) {
            err = new Error(ErrorConfig.MESSAGE.DEVICE_DATE_TIME_MISSING);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
        /*Constants.POST_REGISTRATION_STEPS.some(function (step) {
              if (step == Constants.POST_REG_SECURITY_QUESTION) {
                  return true;
              }
              if (!settings[step] || !settings[step].status) {
                  err = new Error(ErrorConfig.MESSAGE.COMPLETE_PREVIOUS_POST_REG_STEPS);
                  return true;
              }
          });*/

        var questions = options.questions;
        var questionsLength = options.questions && options.questions.length;
        if (questionsLength !== Constants.SECURITY_QUESTIONS_LENGTH) {
            err = new Error(ErrorConfig.MESSAGE.MIN_SECURITY_QUESTIONS);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        var q1 = questions[0];
        var q2 = questions[1];
        var q3 = questions[2];
        if (DataUtils.isUndefined(q1.description) || DataUtils.isUndefined(q2.description) || DataUtils.isUndefined(q3.description)) {
            err = new Error(ErrorConfig.MESSAGE.QUESTION_DESCRIPTION_MISSING);
        }
        if (!err && (DataUtils.isUndefined(q1.answer) || DataUtils.isUndefined(q2.answer) || DataUtils.isUndefined(q3.answer))) {
            err = new Error(ErrorConfig.MESSAGE.QUESTION_ANSWER_MISSING);
        }
        if (!err && (q1.description === q2.description || q2.description === q3.description || q3.description === q1.description)) {
            err = new Error(ErrorConfig.MESSAGE.SECURITY_QUESTIONS_UNIQUE);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }


        //securityQuestionStatus = true;
        var securityQuestionUtcDateTime = moment(new Date()).utc().format('YYYY-MM-DD HH:mm:ss.SSS');
        var securityQuestionLocalDeviceDateTime = moment(options.deviceDateTime).format('YYYY-MM-DD HH:mm:ss.SSS');

        /*var userOptions = {
              id: user.id,
              securityQuestions: questions,
              settings: settings,
              postRegComplete: true
          };*/

        try {
            var conn = await connection.getConnection();

            var updatedUser = await conn.query('update users set securityQuestion1=? ,securityQuestion2=? ,' +
              'securityQuestion3=? ,securityAnswer1=? , securityAnswer2=? ,securityAnswer3=? ,securityQuestionStatus=? ,' +
              ' securityQuestionUtcDateTime=? ,securityQuestionLocalDeviceDateTime=? , postRegComplete=? , ' +
              'updatedBy=uuid_to_bin(?) , updatedAt=? where id=uuid_to_bin(?)', [q1.description, q2.description,
                q3.description, q1.answer, q2.answer, q3.answer, true, securityQuestionUtcDateTime,
                securityQuestionLocalDeviceDateTime, true, user.id, updatedAt, user.id]);

            updatedUser = Utils.isAffectedPool(updatedUser);
            debug('');
            if (!updatedUser) {
                err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }

            user.securityQuestionStatus = true;
            user.securityQuestionLocalDeviceDateTime = securityQuestionLocalDeviceDateTime;
            user.securityQuestionUtcDateTime = securityQuestionUtcDateTime;
            user.postRegComplete = true;
            user.securityQuestion1 = q1.description;
            user.securityQuestion2 = q2.description;
            user.securityQuestion3 = q3.description;
            user.securityAnswer1 = q1.answer;
            user.securityAnswer2 = q2.answer;
            user.securityAnswer3 = q3.answer;

            var notification = {
                user_ids: [user.id],
                topic_id: user.id,
                notification_reference: NotificationReferenceData.SAVE_SECURITY_QUESTION,
                data: {
                    user: user
                },
                languageCultureCode: user.languageCultureCode
            };
            NotificationApi.create(notification, function (err) {
                if (err) {
                    debug('err', err);
                }
                AuditUtils.create(auditOptions);
                return cb(null, user);
            });

        } catch (err) {
            err = err || new Error(ErrorConfig.MESSAGE.SAVE_SECURITY_QUESTIONS_FAILED);
            await ErrorUtils.create(errorOptions, options, err);
            Util.log(err);
            return cb(err);
        }
    },

    setVerificationOptionMD: async function (options, auditOptions, errorOptions, cb) {
        var err;
        var user = options.user;
        var id = user.id;
        var verificationOption = options.verificationOption;
        var updatedAt = DataUtils.getEpochMSTimestamp();

        if (Constants.VERIFICATION_OPTIONS.indexOf(verificationOption) < 0) {
            err = new Error(ErrorConfig.MESSAGE.VERIFICATION_OPTION_INVALID);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            debug(err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();

            var updatedUser = await conn.query('update users set verificationOption=?, updatedAt=?,' +
              'updatedBy=uuid_to_bin(?) where id=uuid_to_bin(?)', [verificationOption, updatedAt, id, id]);

            updatedUser = Utils.isAffectedPool(updatedUser);
            if (!updatedUser) {
                err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            updatedUser = user;
            updatedUser.verificationOption = verificationOption;
            // Audit Log
            AuditUtils.create(auditOptions);
            return cb(null, updatedUser);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            Util.log(err);
            return cb(err);
        }
    },

    setLanguageMD: async function (options, auditOptions, errorOptions, cb) {
        var err;
        var languageCultureCode = options.languageCultureCode;
        var language = languageCultureCode && languageCultureCode.substr(0, 2);
        var user = options.user;
        var id = user.id;
        var updatedAt = DataUtils.getEpochMSTimestamp();

        if (Constants.LANGUAGE_OPTIONS.indexOf(language) < 0) {
            err = new Error(ErrorConfig.MESSAGE.LANGUAGE_OPTION_INVALID);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            debug(err);
            Util.log(err);
            return cb(err);
        }
        auditOptions.metaData = {
            old_reference: user
        };
        if (user.languageCultureCode === languageCultureCode) {
            AuditUtils.create(auditOptions);
            return cb(null, user);
        }
        try {
            var conn = await connection.getConnection();

            var updatedUser = await conn.query('update users set languageCultureCode=?, updatedAt=?, ' +
              'updatedBy=uuid_to_bin(?) where id=uuid_to_bin(?)', [languageCultureCode, updatedAt, id, id]);
            updatedUser = Utils.isAffectedPool(updatedUser);
            debug('updatedUser', updatedUser);
            if (!updatedUser) {
                err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            updatedUser = user;
            updatedUser.languageCultureCode = languageCultureCode;
            auditOptions.metaData = {
                new_reference: updatedUser
            };
            AuditUtils.create(auditOptions);
            return cb(null, updatedUser);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    resetPasswordInitiateMD: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var captcha = options.captcha;
        var fromLogin = options.fromLogin;
        var mode = options.mode;
        var updatedAt = DataUtils.getEpochMSTimestamp();
        options.metaData = {
            mode: options.mode
        };

        var err;
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            debug(err);
            return cb(err);
        }
        if (parseInt(user.resetPasswordCodeSendCount) > 1) {
            try {
                var userOptions = {
                    user: user,
                    status: Constants.USER_STATUS.INACTIVE,
                    statusReasonCode: Constants.USER_INACTIVE_REASON_CODES.SEND_VERIFICATION_CODE_ATTEMPT_EXCEED.CODE
                };
                debug('Inside Blocked user', userOptions);
                //temp added comments for below code to not block user again and again, after development remove comment
                var userBlocked = User.deactivateUserPromiseMD(userOptions, auditOptions, errorOptions);

                if (userBlocked) {
                    AuditUtils.create(auditOptions);
                    var error = new Error(ErrorConfig.MESSAGE.USER_BLOCKED_DUE_TO_EXCEED_LIMIT_FOR_RESEND);
                    error.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    error.flag = true;
                    throw error;
                }
                /* var error = new Error(ErrorConfig.MESSAGE.USER_BLOCKED_DUE_TO_EXCEED_LIMIT_FOR_RESEND);
                 error.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                 error.flag = true;
                 return cb(error);*/
            } catch (err) {
                return cb(err);
            }
        }
        var attempts;
        if (user.resetPasswordCodeSendCount === 0) {
            attempts = 1;
        } else {
            attempts = user.resetPasswordCodeSendCount;
        }

        if (fromLogin === false) {
            User.resetPasswordInitiateCommonMD(options, auditOptions, errorOptions, function (err, response) {
                debug('err', err);
                if (err) {
                    return cb(err);
                }
                debug('response', response);
                response = {
                    OK: Constants.RESEND_SUCCESS,
                    attempts: attempts,
                    hashedCode: response.hashedCode
                };
                return cb(null, response);
            });
        } else if (fromLogin === true && mode === Constants.VERIFICATION_MODE[0]) {

            User.resetPasswordInitiateCommonMD(options, auditOptions, errorOptions, function (err, response) {
                debug('err', err);
                if (err) {
                    return cb(err);
                }
                response = {
                    OK: Constants.RESEND_SUCCESS,
                    attempts: attempts,
                    hashedCode: response.hashedCode
                };
                return cb(null, response);
            });

        } else {
            User.resetPasswordInitiateCommonMD(options, auditOptions, errorOptions, function (err, response) {
                debug('err', err);
                if (err) {
                    return cb(err);
                }
                response = {
                    OK: Constants.RESEND_SUCCESS,
                    attempts: attempts,
                    hashedCode: response.hashedCode
                };
                return cb(null, response);
            });
        }
    },

    resetPasswordInitiateCommonMD: async function (options, auditOptions, errorOptions, cb) {

        var user = options.user;
        var email = user.email;
        var mode = options.mode;
        // var lastResetPasswordDeviceTime = options.lastResetPasswordDeviceTime;
        var updatedAt = DataUtils.getEpochMSTimestamp();
        options.metaData = {
            mode: options.mode
        };

        var err;
        if (DataUtils.isUndefined(email)) {
            err = new Error(ErrorConfig.MESSAGE.EMAIL_REQ);
        } else if (DataUtils.isInvalidEmail(email)) {
            err = new Error(ErrorConfig.MESSAGE.INVALID_EMAIL);
        }
        /* if (!err && DataUtils.isUndefined(lastResetPasswordDeviceTime)) {
             err = new Error(ErrorConfig.MESSAGE.RESET_LOCAL_TIME_MISSING);
         }*/
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            debug(err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        try {
            user = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id ,CAST(uuid_from_bin(accountId) as CHAR) as accountId ,' +
              'firstName, email,languageCultureCode, primaryMobile, primaryMobileStatus, status from users ' +
              'where id=uuid_to_bin(?)', user.id);
            user = Utils.filteredResponsePool(user);
            if (!user) {
                err = err || new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            var status = user.status;
            if (!err && status !== Constants.USER_STATUS.ACTIVE) {
                err = new Error(ErrorConfig.MESSAGE.USER_INACTIVE);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
            }
            if (err) {
                await ErrorUtils.create(errorOptions, options, err);
                debug(err);
                Util.log(err);
                return cb(err);
            }

            var languageCultureCode = user.languageCultureCode;
            var language = languageCultureCode && languageCultureCode.substr(0, 2);
            var upperCaseLanguage = language.toUpperCase();
            var code = RandomSeed.intBetween(Constants.RANDOM_LOW_LIMIT, Constants.RANDOM_HIGH_LIMIT);
            debug('code-------', code);
            if (Constants.VERIFICATION_MODE.indexOf(mode) < 0) {
                err = new Error(ErrorConfig.MESSAGE.RESET_MODE_INVALID);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug(err);
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            code = String(code);
            var hashedCode = DataUtils.getSha384(code).toString();


            var lastResetPassword = new Date().getTime();
            //lastResetPasswordDeviceTime: lastResetPasswordDeviceTime

            var phone = user.primaryMobile;
            var phoneVerified = user.primaryMobileStatus;

            if (Constants.VERIFICATION_MODE.indexOf(mode) === 0) {
                var opt = {
                    languageCultureCode: languageCultureCode,
                    template: Constants.EMAIL_TEMPLATES.RESET_PASSWORD_INITIATE,
                    email: email
                };
                var compileOptions = {
                    name: user.firstName || '',
                    verification_code: code
                };
                EmailUtils.sendEmailMD(opt, compileOptions, async function (err) {
                    if (err) {
                        return cb(err);
                    }
                    var updatedUser = await conn.query('update users set lastResetPassword=?, updatedAt=?, ' +
                      'updatedBy=uuid_to_bin(?) where id=uuid_to_bin(?)', [lastResetPassword, updatedAt, user.id, user.id]);
                    updatedUser = Utils.isAffectedPool(updatedUser);
                    debug('updated updatedUser', updatedUser);
                    if (!updatedUser) {
                        err = err || new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                        throw err;
                    }
                    AuditUtils.create(auditOptions);

                    var message = Constants.RESET_PASSWORD_NOTIFY_SMS[upperCaseLanguage];
                    var response = {
                        hashedCode: hashedCode,
                        user: user
                    };
                    if (DataUtils.isDefined(phone)) {
                        TwilioUtils.sendSMS(phone, TwilioConfig.FROM, message, function (err) {
                            return cb(null, response);
                        });
                    } else {
                        return cb(null, response);
                    }
                });
            } else {
                // This is for Phone
                if (DataUtils.isUndefined(phone)) {
                    err = new Error(ErrorConfig.MESSAGE.PHONE_NUMBER_NOT_REGISTERED);
                }
                if (!err && !phoneVerified) {
                    err = new Error(ErrorConfig.MESSAGE.PHONE_NUMBER_NOT_VERIFIED);
                }

                if (err) {
                    err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                    await ErrorUtils.create(errorOptions, options, err);
                    debug(err);
                    return cb(err);
                }
                var userOptions = {
                    phone: phone,
                    code: code
                };
                User.sendCode(userOptions, async function (err) {
                    var updatedUser = await conn.query('update users set lastResetPassword=?, updatedAt=? ,' +
                      'updatedBy=uuid_to_bin(?) where id=uuid_to_bin(?)', [lastResetPassword, updatedAt, user.id, user.id]);

                    updatedUser = Utils.isAffectedPool(updatedUser);
                    if (!updatedUser) {
                        err = err || new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                        throw err;
                    }
                    AuditUtils.create(auditOptions);
                    var opt = {
                        languageCultureCode: languageCultureCode,
                        template: Constants.EMAIL_TEMPLATES.RESET_PASSWORD_INITIATE,
                        email: email
                    };
                    var compileOptions = {
                        name: user.firstName || 'Nitin',
                        verification_code: code
                    };
                    var response = {
                        hashedCode: hashedCode,
                        user: user
                    };
                    EmailUtils.sendEmailMD(opt, compileOptions, function (err) {
                        if (err) {
                            return cb(err);
                        }
                        return cb(null, response);
                    });
                });
            }
        } catch (err) {
            await ErrorUtils.create(errorOptions, options, err);
            debug('err', err);
            return cb(err);
        }
    },

    resendCodePasswordMD: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var updatedAt = DataUtils.getEpochMSTimestamp();
        options.metaData = {
            mode: options.mode
        };

        var err;
        try {
            var conn = await connection.getConnection();

            user = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id, CAST(uuid_from_bin(accountId) as CHAR) as accountId,' +
              'firstName, email,languageCultureCode, primaryMobile, primaryMobileStatus,resetPasswordCodeSendCount,' +
              'resetPasswordCodeConfirmCount, status from users ' +
              'where id=uuid_to_bin(?)', user.id);
            user = Utils.filteredResponsePool(user);
            debug('user----', user);
            if (!user) {
                err = err || new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            if (err) {
                await ErrorUtils.create(errorOptions, options, err);
                debug(err);
                Util.log(err);
                return cb(err);
            }
            var resetPasswordCodeSendCount;
            try {
                resetPasswordCodeSendCount = parseInt(user.resetPasswordCodeSendCount) + 1;
                debug('resetPasswordCodeSendCount', resetPasswordCodeSendCount);
                var updatedUser = await conn.query('update users set resetPasswordCodeSendCount=?, updatedBy=uuid_to_bin(?),' +
                  'updatedAt=? where id=uuid_to_bin(?)', [resetPasswordCodeSendCount, user.id, updatedAt, user.id]);

                updatedUser = Utils.isAffectedPool(updatedUser);
                debug('updatedUser', updatedUser);
                if (!updatedUser) {
                    AuditUtils.create(auditOptions);
                    err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    throw err;
                }
            } catch (err) {
                debug('errr', err);
                return cb(err);
            }

            //Block the user due to exceed limit for code resend
            debug('user.resetPasswordCodeSendCount ---', user.resetPasswordCodeSendCount);
            if (parseInt(user.resetPasswordCodeSendCount) > 0) {
                try {
                    var userOptions = {
                        user: user,
                        status: Constants.USER_STATUS.INACTIVE,
                        statusReasonCode: Constants.USER_INACTIVE_REASON_CODES.SEND_VERIFICATION_CODE_ATTEMPT_EXCEED.CODE
                    };
                    debug('Inside Blocked user', userOptions);
                    //temp added comments for below code to not block user again and again, after development remove comment
                    var userBlocked = User.deactivateUserPromiseMD(userOptions, auditOptions, errorOptions);
                    User.resetPasswordCodeSendMD(options, auditOptions, user, errorOptions, function (err, response) {
                        if (err) {
                            debug('err', err);
                            return cb(err);
                        }
                        response = {
                            OK: Constants.RESEND_SUCCESS,
                            attempts: resetPasswordCodeSendCount + 1,
                            hashedCode: response.hashedCode
                        };
                        return cb(null, response);
                    });
                    /*if (userBlocked) {
                        AuditUtils.create(auditOptions);
                        var error = new Error(ErrorConfig.MESSAGE.USER_BLOCKED_DUE_TO_EXCEED_LIMIT_FOR_RESEND);
                        error.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        error.flag = true;
                        throw error;
                    }*/
                    /* var error = new Error(ErrorConfig.MESSAGE.USER_BLOCKED_DUE_TO_EXCEED_LIMIT_FOR_RESEND);
                     error.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                     error.flag = true;
                     return cb(error);*/
                } catch (err) {
                    return cb(err);
                }
            } else if (parseInt(user.resetPasswordCodeSendCount) < 2 && parseInt(user.resetPasswordCodeConfirmCount) !== 0) {
                //Allow user to try for 3 times to confirm code
                try {
                    var resetPasswordCodeConfirmCount = 0;
                    var updatedUser = await conn.query('update users set resetPasswordCodeConfirmCount=?, updatedBy=uuid_to_bin(?),' +
                      'updatedAt=? where id=uuid_to_bin(?)', [resetPasswordCodeConfirmCount, user.id, updatedAt, user.id]);

                    updatedUser = Utils.isAffectedPool(updatedUser);
                    if (!updatedUser) {
                        AuditUtils.create(auditOptions);
                        err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        throw err;
                    }
                    User.resetPasswordCodeSendMD(options, auditOptions, user, errorOptions, function (err, response) {
                        if (err) {
                            debug('err', err);
                            return cb(err);
                        }
                        response = {
                            OK: Constants.RESEND_SUCCESS,
                            attempts: resetPasswordCodeSendCount + 1,
                            hashedCode: response.hashedCode
                        };
                        return cb(null, response);
                    });
                } catch (err) {
                    debug('errr', err);
                    return cb(err);
                }
            } else {

                User.resetPasswordCodeSendMD(options, auditOptions, user, errorOptions, function (err, response) {
                    if (err) {
                        debug('err', err);
                        return cb(err);
                    }
                    response = {
                        OK: Constants.RESEND_SUCCESS,
                        attempts: resetPasswordCodeSendCount + 1,
                        hashedCode: response.hashedCode
                    };
                    return cb(null, response);
                });
            }

        } catch (err) {
            await ErrorUtils.create(errorOptions, options, err);
            debug('err', err);
            return cb(err);
        }
    },

    resetPasswordCodeSendMD: async function (options, auditOptions, user, errorOptions, cb) {
        var email = user.email;
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var languageCultureCode = user.languageCultureCode;
        var mode = options.mode;
        var language = languageCultureCode && languageCultureCode.substr(0, 2);
        var upperCaseLanguage = language.toUpperCase();
        var code = RandomSeed.intBetween(Constants.RANDOM_LOW_LIMIT, Constants.RANDOM_HIGH_LIMIT);
        var err;
        if (Constants.VERIFICATION_MODE.indexOf(mode) < 0) {
            err = new Error(ErrorConfig.MESSAGE.RESET_MODE_INVALID);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug(err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
        debug('code', code);
        code = String(code);
        var hashedCode = DataUtils.getSha384(code).toString();


        var lastResetPassword = new Date().getTime();
        //lastResetPasswordDeviceTime: lastResetPasswordDeviceTime

        var phone = user.primaryMobile;
        var phoneVerified = user.primaryMobileStatus;

        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        if (Constants.VERIFICATION_MODE.indexOf(mode) === 0) {
            var opt = {
                languageCultureCode: languageCultureCode,
                template: Constants.EMAIL_TEMPLATES.RESET_PASSWORD_INITIATE,
                email: email
            };
            var compileOptions = {
                name: user.firstName || '',
                verification_code: code
            };
            EmailUtils.sendEmailMD(opt, compileOptions, async function (err) {
                if (err) {
                    return cb(err);
                }
                var updatedUser = await conn.query('update users set lastResetPassword=?, updatedAt=?, ' +
                  'updatedBy=uuid_to_bin(?) where id=uuid_to_bin(?)', [lastResetPassword, updatedAt, user.id, user.id]);
                updatedUser = Utils.isAffectedPool(updatedUser);
                if (!updatedUser) {
                    err = err || new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }
                AuditUtils.create(auditOptions);

                var message = Constants.RESET_PASSWORD_NOTIFY_SMS[upperCaseLanguage];
                var response = {
                    hashedCode: hashedCode,
                    user: user
                };
                if (DataUtils.isDefined(phone)) {
                    TwilioUtils.sendSMS(phone, TwilioConfig.FROM, message, function (err) {
                        return cb(null, response);
                    });
                } else {
                    return cb(null, response);
                }
            });
        } else {
            // This is for Phone
            if (DataUtils.isUndefined(phone)) {
                err = new Error(ErrorConfig.MESSAGE.PHONE_NUMBER_NOT_REGISTERED);
            }
            if (!err && !phoneVerified) {
                err = new Error(ErrorConfig.MESSAGE.PHONE_NUMBER_NOT_VERIFIED);
            }

            if (err) {
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                await ErrorUtils.create(errorOptions, options, err);
                debug(err);
                return cb(err);
            }
            var userOptions = {
                phone: phone,
                code: code
            };

            User.sendCode(userOptions, async function (err) {
                var updatedUser = await conn.query('update users set lastResetPassword=?, updatedAt=? ,' +
                  'updatedBy=uuid_to_bin(?) where id=uuid_to_bin(?)', [lastResetPassword, updatedAt, user.id, user.id]);

                updatedUser = Utils.isAffectedPool(updatedUser);
                if (!updatedUser) {
                    err = err || new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }
                AuditUtils.create(auditOptions);
                var opt = {
                    languageCultureCode: languageCultureCode,
                    template: Constants.EMAIL_TEMPLATES.RESET_PASSWORD_INITIATE,
                    email: email
                };
                var compileOptions = {
                    name: user.firstName || 'Nitin',
                    verification_code: code
                };
                EmailUtils.sendEmailMD(opt, compileOptions, function (err) {
                    if (err) {
                        return cb(err);
                    }
                    var response = {
                        hashedCode: hashedCode,
                        user: user
                    };
                    return cb(null, response);
                });
            });
        }
    },

    resetPasswordMD: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var email = user.email;
        var languageCultureCode = user.languageCultureCode;
        var password = options.password;
        var confirmPassword = options.confirmPassword;
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var err;

        if (!options.codeVerified) {
            err = new Error(ErrorConfig.MESSAGE.VERIFICATION_CODE_NOT_VERIFIED);
            err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
        } else if (DataUtils.isInvalidEmail(email)) {
            err = new Error(ErrorConfig.MESSAGE.EMAIL_INVALID);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
        } else if (password !== confirmPassword) {
            err = new Error(ErrorConfig.MESSAGE.PASSWORD_AND_CONFIRM_NOT_MATCH);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
        }
        if (err) {
            Util.log(err);
            debug(err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
        var salt = Bcrypt.genSaltSync(10);
        var hashedPassword = Bcrypt.hashSync(password, salt);
        var lastPasswordChanged = new Date().getTime();

        try {
            var conn = await connection.getConnection();

            var updatedUser = await conn.query('update users set password=? , lastPasswordChanged=?, updatedAt=?, ' +
              'updatedBy=uuid_to_bin(?) where id=uuid_to_bin(?)', [hashedPassword, lastPasswordChanged, updatedAt, user.id, user.id]);

            updatedUser = Utils.isAffectedPool(updatedUser);
            if (!updatedUser) {
                err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            var opt = {
                languageCultureCode: languageCultureCode,
                template: Constants.EMAIL_TEMPLATES.RESET_PASSWORD,
                email: email
            };

            var compileOptions = {
                name: updatedUser.firstName || ''
            };

            EmailUtils.sendEmailMD(opt, compileOptions, function (err) {
                if (err) {
                    return cb(err);
                }
                AuditUtils.create(auditOptions);
                return cb();
            });
        } catch (err) {
            await ErrorUtils(errorOptions, options, err);
            err = err || new Error(ErrorConfig.MESSAGE.USER_RESET_PASSWORD_FAILED);
            err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
            debug(err);
            Util.log(err);
            return cb(err);
        }
    },

    sendCode: function (options, cb) {
        var phone = options.phone;
        var code = options.code;
        var err;
        if (DataUtils.isUndefined(phone)) {
            err = new Error(ErrorConfig.MESSAGE.SMS_FAILED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug(err);
            return cb(err);
        }

        if (!code) {
            code = RandomSeed.intBetween(Constants.RANDOM_LOW_LIMIT, Constants.RANDOM_HIGH_LIMIT);
        }
        var message = Constants.OTP_MESSAGE_PREFIX + code;

        TwilioUtils.sendSMS(phone, TwilioConfig.FROM, message, function (err) {
            return cb(err, code);
        });
    },

    getUsers: function (options, cb) {
        var err;
        var limit = options.limit || Constants.GET_USERS.DEFAULT_LIMIT;
        var filterKey = options.filterKey;
        var lastKey = options.lastKey;

        if (limit > Constants.GET_USERS.MAX_LIMIT) {
            err = new Error(ErrorConfig.MESSAGE.GET_USER_LIMIT_EXCEEDED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug(err);
            return cb(err);
        }
        var query = UserModel.scan();
        if (filterKey) {
            if (Constants.GET_USERS.ALLOWED_FILTERS.indexOf(filterKey) < 0) {
                err = new Error(ErrorConfig.MESSAGE.GET_USER_INVALID_FILTER);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug(err);
                return cb(err);
            }
            if (filterKey == Constants.GET_USERS.VERIFIED_FILTER) {
                query = query.where(options.filterKey).eq(JSON.parse(options.filterValue));
            } else {
                query = query.where(options.filterKey).contains(options.filterValue);
            }
        }


        if (lastKey) {
            query = query.startKey({'id': lastKey});
        }
        query = query.attributes(Constants.GET_USERS.ATTRIBUTES);
        query = query.limit(limit);

        query.exec(function (err, data) {
            if (err || !data || !data.Items || !data.Items.length) {
                Util.log(err);
                err = new Error(ErrorConfig.MESSAGE.GET_USER_FAILED);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                debug(err);
                return cb(err);
            }
            var users = data.Items;
            var userList = [];
            users.forEach(function (user) {
                userList.push(user.attrs);
            });

            var paginationKey = data.LastEvaluatedKey;
            var response = {
                lastKey: paginationKey,
                users: userList
            };
            return cb(null, response);
        });
    },

    list: function (cb) {
        UserModel.parallelScan(Constants.GET_USERS.PARALLEL_SCAN_SEGMENTS).loadAll().exec(function (err, data) {
            if (err || !data || !data.Items || !data.Items.length) {
                Util.log(err);
                err = new Error(ErrorConfig.MESSAGE.GET_USER_FAILED);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                debug(err);
                return cb(err);
            }
            var users = data.Items;
            var userList = [];
            users.forEach(function (user) {
                userList.push(user.attrs);
            });

            var response = {
                users: userList
            };
            return cb(null, response);
        });
    },

    updateUserByAdmin: function (options, auditOptions, cb) {
        var err;
        var id = options.id;
        if (DataUtils.isUndefined(id)) {
            err = new Error(ErrorConfig.MESSAGE.USER_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug(err);
            return cb(err);
        }
        User.getUserById(id, function (err, user) {
            if (err || !user) {
                debug(err || 'Failed to fetch user having id: ' + id);
                err = new Error(ErrorConfig.MESSAGE.USER_VERIFICATION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                return cb(err);
            }

            var userOptions = {
                id: id
            };
            var email = options.email;
            var firstName = options.firstName;
            var middleName = options.middleName;
            var lastName = options.lastName;
            var dateOfBirth = options.dateOfBirth;
            var phone = options.phone;
            var verificationOption = options.verificationOption;
            var languageCultureCode = options.languageCultureCode;
            var language = languageCultureCode && languageCultureCode.substr(0, 2);
            var status = options.status;
            var statusReasonCode = options.statusReasonCode;
            var isAdmin = options.isAdmin;
            var roles = options.roles;

            if (DataUtils.isDefined(email)) {
                userOptions.email = email;
            }
            if (DataUtils.isDefined(firstName)) {
                userOptions.firstName = firstName;
            }
            if (DataUtils.isDefined(middleName)) {
                userOptions.middleName = middleName;
            }
            if (DataUtils.isDefined(lastName)) {
                userOptions.lastName = lastName;
            }
            if (DataUtils.isDefined(dateOfBirth)) {
                userOptions.dateOfBirth = dateOfBirth;
            }
            if (DataUtils.isDefined(phone)) {
                userOptions.phone = phone;
            }
            if (statusReasonCode) {
                if (!Constants.USER_INACTIVE_REASON_CODES[statusReasonCode]) {
                    err = new Error(ErrorConfig.MESSAGE.USER_INVALID_REASON_CODE);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    debug(err);
                    return cb(err);
                }
                userOptions.statusReasonCode = statusReasonCode;
            }
            if (DataUtils.isDefined(status)) {
                if (Constants.USER_STATUS.ACTIVE != status && Constants.USER_STATUS.INACTIVE != status) {
                    err = new Error(ErrorConfig.MESSAGE.USER_INVALID_STATUS);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    debug(err);
                    return cb(err);
                }
                if (!statusReasonCode) {
                    statusReasonCode = Constants.USER_STATUS.ACTIVE == status ? null : Constants.USER_INACTIVE_REASON_CODES.ADMIN_BLOCKED;
                    userOptions.statusReasonCode = statusReasonCode;
                }
                userOptions.status = status;
            }
            if (DataUtils.isDefined(verificationOption)) {
                if (Constants.VERIFICATION_OPTIONS.indexOf(verificationOption) < 0) {
                    err = new Error(ErrorConfig.MESSAGE.VERIFICATION_OPTION_INVALID);
                    err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                    debug(err);
                    return cb(err);
                }
                userOptions.verificationOption = verificationOption;
            }
            if (DataUtils.isDefined(language)) {
                if (Constants.LANGUAGE_OPTIONS.indexOf(language) < 0) {
                    err = new Error(ErrorConfig.MESSAGE.LANGUAGE_OPTION_INVALID);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    debug(err);
                    Util.log(err);
                    return cb(err);
                }
                userOptions.languageCultureCode = languageCultureCode;
            }
            if (isAdmin == true || isAdmin == false) {
                userOptions.isAdmin = isAdmin;
            }
            // TODO - Validate these roles
            if (roles && Array.isArray(roles)) {
                userOptions.roles = roles;
            }

            user = user.attrs;
            auditOptions.metaData.old_user = user;

            UserModel.update(userOptions, function (err, user) {
                if (err || !user) {
                    err = err || new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                    Util.log(err);
                    return cb(err);
                }
                user = user.attrs;
                auditOptions.metaData.new_user = user;
                AuditUtils.create(auditOptions);

                return cb(null, user);
            });
        });
    },

    updateAdvancedAuthNumberMD: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var advancedAuthNumber = options.advancedAuthNumber;
        var updatedAt = options.updatedAt;
        var passwordVerified = DataUtils.parseBoolean((options.passwordVerified));
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();
        var err, flag = false;

        if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_MUST_BE_NUMBER);
        } else if (updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_IS_INVALID);
        } else if (DataUtils.isUndefined(advancedAuthNumber)) {
            err = new Error(ErrorConfig.MESSAGE.ADVANCED_AUTH_NUMBER_REQUIRE);
        } else if (Constants.ADVANCE_AUTH_NUMBER.indexOf(advancedAuthNumber) === -1) {
            err = new Error(ErrorConfig.MESSAGE.INVALID_ADVANCED_AUTH_NUMBER);
        } else if (!passwordVerified) {
            err = new Error(ErrorConfig.MESSAGE.PASSWORD_VERIFICATION_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        User.getUserByEmailMD(user.email, async function (err, response) {
            if (err) {
                debug('err', err);
                return cb(err);
            }
            if (advancedAuthNumber === Constants.ADVANCED_AUTH_NUMBER.MOBILE_1 && DataUtils.isUndefined(response.primaryMobile)) {
                err = new Error(ErrorConfig.MESSAGE.CAN_NOT_ACTIVATE_PRIMARY_MOBILE_IS_MISSING);
            } else if (advancedAuthNumber === Constants.ADVANCED_AUTH_NUMBER.MOBILE_2 && DataUtils.isUndefined(response.secondaryMobile)) {
                err = new Error(ErrorConfig.MESSAGE.CAN_NOT_ACTIVATE_SECONDARY_MOBILE_IS_MISSING);
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }

            if (advancedAuthNumber !== Constants.ADVANCED_AUTH_NUMBER.DISABLE && (response.advancedAuthNumber === Constants.ADVANCED_AUTH_NUMBER.DISABLE || response.advancedAuthNumber === '')) {
                flag = true;
            }

            try {
                var conn = await connection.getConnection();

                var userUpdated = await conn.query('IF (select 1 from users where id=uuid_to_bin(?)) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "USER_NOT_FOUND", MYSQL_ERRNO = 4001;' +
                  'ELSEIF (select 1 from users where id=uuid_to_bin(?) and updatedAt=?) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "USER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
                  'ELSE update users set advancedAuthNumber=?, updatedAt = ?,updatedBy=uuid_to_bin(?)' +
                  ' where id = uuid_to_bin(?);END IF;', [user.id, user.id, updatedAt, advancedAuthNumber, newUpdatedAt, user.id, user.id]);

                userUpdated = Utils.isAffectedPool(userUpdated);

                if (!userUpdated) {
                    err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    await ErrorUtils.create(errorOptions, options, err);
                    throw err;
                }
                user.updatedAt = newUpdatedAt;
                user.advancedAuthNumber = advancedAuthNumber;
                user.success = User.filterAANResponse(advancedAuthNumber, flag);
                return cb(null, user);
            } catch (err) {
                debug('err', err);
                await ErrorUtils.create(errorOptions, options, err);
                if (err.errno === 4001) {
                    err = new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return cb(err);
                } else if (err.errno === 4002) {
                    err = new Error(ErrorConfig.MESSAGE.USER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    return cb(err);
                } else {
                    err = new Error(ErrorConfig.MESSAGE.UPDATE_ADVANCED_AUTH_NUMBER_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return cb(err);
                }
            }
        });
    },

    filterAANResponse: function (advancedAuthNumber, flag) {
        if (advancedAuthNumber !== Constants.ADVANCED_AUTH_NUMBER.DISABLE && flag) {
            return Constants.SUCCESS_MESSAGE.ENABLE_ADVANCE_AUTH_NUMBER_SUCCESS;
        } else if (advancedAuthNumber !== Constants.ADVANCED_AUTH_NUMBER.DISABLE && !flag) {
            return Constants.SUCCESS_MESSAGE.MODIFY_ADVANCE_AUTH_NUMBER_SUCCESS;
        } else if (advancedAuthNumber === Constants.ADVANCED_AUTH_NUMBER.DISABLE) {
            return Constants.SUCCESS_MESSAGE.DISABLE_ADVANCE_AUTH_NUMBER_SUCCESS;
        }
        return;
    },

    updateUserPhoneMD: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var userId = user.id;
        var action = options.action;
        var updatedAt = options.updatedAt;
        var primaryDialCode = options.primaryDialCode;
        var err;
        var passwordVerified = DataUtils.parseBoolean((options.passwordVerified));
        var useForTwoFactor = Utils.toBoolean(options.useForTwoFactor) || false;
        var primaryMobile = options.primaryMobile || '';
        var primaryMobileCountry = options.primaryMobileCountry || '';
        var primaryMobileLocalDeviceDateTime = new Date(options.primaryMobileLocalDeviceDateTime);
        var primaryPhoneEndingWith, advancedAuthNumber;
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();


        if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_MUST_BE_NUMBER);
        } else if (updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_IS_INVALID);
        } else if (!passwordVerified && (action === Constants.UPDATE_PHONE_ACTION.UPDATE || action === Constants.UPDATE_PHONE_ACTION.DELETE)) {
            err = new Error(ErrorConfig.MESSAGE.PASSWORD_VERIFICATION_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
        /*else if ((action === Constants.UPDATE_PHONE_ACTION.UPDATE) && !passwordVerifiedTime || (currentTime - passwordVerifiedTime) / 1000 > Constants.PASSWORD_VERIFICATION_TIME_LIMIT) {
            err = new Error(ErrorConfig.MESSAGE.PASSWORD_VERIFICATION_EXPIRED_REVERIFY);
        }*/

        if (action !== Constants.UPDATE_PHONE_ACTION.DELETE) {
            if (DataUtils.isUndefined(primaryMobile)) {
                err = new Error(ErrorConfig.MESSAGE.PHONE_NUMBER_REQUIRED);
            }
            if (DataUtils.isUndefined(primaryMobileCountry)) {
                err = new Error(ErrorConfig.MESSAGE.PHONE_COUNTRY_REQUIRED);
            }
            if (DataUtils.isUndefined(primaryDialCode)) {
                err = new Error(ErrorConfig.MESSAGE.DIAL_CODE_REQUIRED);
            }
            if (primaryDialCode + '' + primaryMobile === user.primaryMobile) {
                err = new Error(ErrorConfig.MESSAGE.ALREADY_YOU_ARE_USING_THE_SAME_NUMBER);
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            primaryPhoneEndingWith = Utils.phoneEndingWith(primaryMobile);
            primaryMobile = primaryDialCode + '' + primaryMobile;

            if (useForTwoFactor) {
                advancedAuthNumber = Constants.ADVANCED_AUTH_NUMBER.MOBILE_1;
            } else {
                advancedAuthNumber = user.advancedAuthNumber;
            }
        }

        if (action === Constants.UPDATE_PHONE_ACTION.DELETE || (action === Constants.UPDATE_PHONE_ACTION.UPDATE && useForTwoFactor === false)) {
            if (user.advancedAuthNumber === Constants.ADVANCED_AUTH_NUMBER.MOBILE_1) {
                advancedAuthNumber = Constants.ADVANCED_AUTH_NUMBER.DISABLE;
            } else {
                advancedAuthNumber = user.advancedAuthNumber;
            }
        }
        if (action === Constants.UPDATE_PHONE_ACTION.DELETE) {
            primaryPhoneEndingWith = '';
        }

        auditOptions.metaData = {};
        auditOptions.metaData.old_primaryMobile = user.primaryMobile;
        auditOptions.metaData.old_primaryMobileCountry = user.primaryMobileCountry;
        try {
            var conn = await connection.getConnection();
            var userUpdated = await conn.query('IF (select 1 from users where id=uuid_to_bin(?)) is null then ' +
              'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "USER_NOT_FOUND", MYSQL_ERRNO = 4001;' +
              'ELSEIF (select 1 from users where id=uuid_to_bin(?) and updatedAt=?) is null then ' +
              'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "USER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
              'ELSE update users set primaryMobileStatus=? , primaryMobile=? ,  primaryMobileCountry=?, ' +
              'primaryMobileLocalDeviceDateTime=?,primaryMobilePhoneEndingWith=?, useForTwoFactor=?,advancedAuthNumber=?,' +
              'updatedAt=?, updatedBy=uuid_to_bin(?)  where id=uuid_to_bin(?);end If',
              [userId, userId, updatedAt, true, primaryMobile, primaryMobileCountry, primaryMobileLocalDeviceDateTime,
                  primaryPhoneEndingWith, useForTwoFactor, advancedAuthNumber, newUpdatedAt, userId, userId]);

            userUpdated = Utils.isAffectedPool(userUpdated);

            if (!userUpdated) {
                err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            var userResponse = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id,primaryMobile,primaryMobileCountry,' +
              'primaryMobileLocalDeviceDateTime,advancedAuthNumber,updatedAt from users where id = uuid_to_bin(?)', userId);
            userResponse = Utils.filteredResponsePool(userResponse);
            if (!userResponse) {
                err = new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }

            auditOptions.metaData.new_primaryMobile = primaryMobile;
            auditOptions.metaData.new_primaryMobileCountry = primaryMobileCountry;
            AuditUtils.create(auditOptions);

            user.primaryMobile = userResponse.primaryMobile;
            user.primaryMobileCountry = userResponse.primaryMobileCountry;
            user.advancedAuthNumber = userResponse.advancedAuthNumber;
            user.primaryMobileLocalDeviceDateTime = userResponse.primaryMobileLocalDeviceDateTime;
            user.updatedAt = newUpdatedAt;
            user.success = User.filterResponse(action);

            return cb(null, user);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            } else if (err.errno === 4002) {
                err = new Error(ErrorConfig.MESSAGE.USER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                return cb(err);
            } else {
                err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_PHONE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
        }
    },

    filterResponse: function (action) {
        if (action === Constants.UPDATE_PHONE_ACTION.DELETE) {
            return Constants.SUCCESS_MESSAGE.REMOVE_PHONE_SUCCESS;
        } else if (action === Constants.UPDATE_PHONE_ACTION.ADD) {
            return Constants.SUCCESS_MESSAGE.ADD_PHONE_SUCCESS;
        } else if (action === Constants.UPDATE_PHONE_ACTION.UPDATE) {
            return Constants.SUCCESS_MESSAGE.MODIFY_PHONE_SUCCESS;
        }
        return;
    },

    updateSecondaryNumberMD: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var userId = user.id;
        var action = options.action;
        var updatedAt = options.updatedAt;
        var useForTwoFactor = Utils.toBoolean(options.useForTwoFactor) || false;
        var advancedAuthNumber, err;
        var passwordVerified = DataUtils.parseBoolean((options.passwordVerified));
        var secondaryMobile = options.secondaryMobile || '';
        var secondaryDialCode = options.secondaryDialCode || '';
        var secondaryMobileCountry = options.secondaryMobileCountry || '';
        var secondaryMobileLocalDeviceDateTime = new Date(options.secondaryMobileLocalDeviceDateTime);
        var PrimaryPhone = user.primaryMobile;
        var secondaryMobilePhoneEndingWith;
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();

        if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_MUST_BE_NUMBER);
        } else if (updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_IS_INVALID);
        } else if (!passwordVerified && (action === Constants.UPDATE_PHONE_ACTION.UPDATE || action === Constants.UPDATE_PHONE_ACTION.DELETE)) {
            err = new Error(ErrorConfig.MESSAGE.PASSWORD_VERIFICATION_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
        /*else if ((action === Constants.UPDATE_PHONE_ACTION.UPDATE) && !passwordVerifiedTime || (currentTime - passwordVerifiedTime) / 1000 > Constants.PASSWORD_VERIFICATION_TIME_LIMIT) {
            err = new Error(ErrorConfig.MESSAGE.PASSWORD_VERIFICATION_EXPIRED_REVERIFY);
        }*/

        if (action !== Constants.UPDATE_PHONE_ACTION.DELETE) {
            if (DataUtils.isUndefined(secondaryMobile)) {
                err = new Error(ErrorConfig.MESSAGE.PHONE_NUMBER_REQUIRED);
            }
            if (DataUtils.isUndefined(secondaryDialCode)) {
                err = new Error(ErrorConfig.MESSAGE.DIAL_CODE_REQUIRED);
            }
            if (DataUtils.isUndefined(secondaryMobileCountry)) {
                err = new Error(ErrorConfig.MESSAGE.PHONE_COUNTRY_REQUIRED);
            }
            if (secondaryDialCode + '' + secondaryMobile === user.secondaryMobile) {
                err = new Error(ErrorConfig.MESSAGE.ALREADY_YOU_ARE_USING_THE_SAME_NUMBER);
            }
            if (err) {
                await ErrorUtils.create(errorOptions, options, err);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            secondaryMobilePhoneEndingWith = Utils.phoneEndingWith(secondaryMobile);
            secondaryMobile = secondaryDialCode + '' + secondaryMobile;

            if (useForTwoFactor) {
                advancedAuthNumber = Constants.ADVANCED_AUTH_NUMBER.MOBILE_2;
            } else {
                advancedAuthNumber = user.advancedAuthNumber;
            }

            if (PrimaryPhone) {
                if (secondaryMobile === PrimaryPhone) {
                    err = new Error(ErrorConfig.MESSAGE.MOBILE_2_MUST_DIFFERENT_THAN_MOBILE_1);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
            }
        }
        if (action === Constants.UPDATE_PHONE_ACTION.DELETE || (action === Constants.UPDATE_PHONE_ACTION.UPDATE && useForTwoFactor === false)) {
            if (user.advancedAuthNumber === Constants.ADVANCED_AUTH_NUMBER.MOBILE_2) {
                advancedAuthNumber = Constants.ADVANCED_AUTH_NUMBER.DISABLE;
            } else {
                advancedAuthNumber = user.advancedAuthNumber;
            }
        }

        if (action === Constants.UPDATE_PHONE_ACTION.DELETE) {
            secondaryMobilePhoneEndingWith = '';
        }
        auditOptions.metaData = {};
        auditOptions.metaData.old_secondaryMobile = user.secondaryMobile;
        auditOptions.metaData.old_secondaryMobileCountry = user.secondaryMobileCountry;

        try {
            var conn = await connection.getConnection();
            var userUpdated = await conn.query('IF (select 1 from users where id=uuid_to_bin(?)) is null then ' +
              'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "USER_NOT_FOUND", MYSQL_ERRNO = 4001;' +
              'ELSEIF (select 1 from users where id=uuid_to_bin(?) and updatedAt=?) is null then ' +
              'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "USER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
              'ELSE update users set secondaryMobileStatus=? , secondaryMobile=? , secondaryMobileCountry=?,useForTwoFactor=?, ' +
              'advancedAuthNumber=?,secondaryMobileLocalDeviceDateTime=?,secondaryMobilePhoneEndingWith=?, updatedAt=?,' +
              ' updatedBy=uuid_to_bin(?)  where id=uuid_to_bin(?);END IF;', [userId, userId, updatedAt, true, secondaryMobile,
                secondaryMobileCountry, useForTwoFactor, advancedAuthNumber, secondaryMobileLocalDeviceDateTime, secondaryMobilePhoneEndingWith, newUpdatedAt, userId, userId]);
            userUpdated = Utils.isAffectedPool(userUpdated);

            if (!userUpdated) {
                err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            var userResponse = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id ,secondaryMobile,secondaryMobileCountry,' +
              'secondaryMobileLocalDeviceDateTime,advancedAuthNumber,updatedAt from users where id = uuid_to_bin(?)', userId);
            userResponse = Utils.filteredResponsePool(userResponse);
            if (!userResponse) {
                err = new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            auditOptions.metaData.new_secondaryMobile = secondaryMobile;
            auditOptions.metaData.new_secondaryMobileCountry = secondaryMobileCountry;
            AuditUtils.create(auditOptions);

            user.secondaryMobile = userResponse.secondaryMobile;
            user.secondaryMobileCountry = userResponse.secondaryMobileCountry;
            user.secondaryMobileLocalDeviceDateTime = userResponse.secondaryMobileLocalDeviceDateTime;
            user.advancedAuthNumber = userResponse.advancedAuthNumber;
            user.updatedAt = newUpdatedAt;
            user.success = User.filterResponse(action);
            return cb(null, user);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            } else if (err.errno === 4002) {
                err = new Error(ErrorConfig.MESSAGE.USER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                return cb(err);
            } else {
                err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_MOBILE_2_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
        }
    },

    updateUserEmailMD: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var confirmEmail = options.confirmEmail;
        var newEmail = options.newEmail;
        var deviceDateTime = options.deviceDateTime;
        var updatedAt = options.updatedAt;
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();
        var err;


        if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_MUST_BE_NUMBER);
        } else if (updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_IS_INVALID);
        } else if (DataUtils.isUndefined(newEmail)) {
            err = new Error(ErrorConfig.MESSAGE.NEW_EMAIL_REQUIRED);
        } else if (DataUtils.isUndefined(confirmEmail)) {
            err = new Error(ErrorConfig.MESSAGE.CONFIRM_EMAIL_REQUIRED);
        } else if (DataUtils.isUndefined(deviceDateTime)) {
            err = new Error(ErrorConfig.MESSAGE.DEVICE_DATE_TIME_REQUIRED);
        } else if (confirmEmail !== newEmail) {
            err = new Error(ErrorConfig.MESSAGE.CONFIRM_EMAIL_AND_NEW_EMAIL_MUST_BE_SAME);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();

            var userExist = await conn.query('select email from users where email=?', newEmail);
            userExist = Utils.filteredResponsePool(userExist);
            if (userExist) {
                err = new Error(ErrorConfig.MESSAGE.USER_WITH_THIS_EMAIL_IS_ALREADY_EXIST);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }

            var passwordVerified = DataUtils.parseBoolean((options.passwordVerified));

            if (!passwordVerified) {
                err = new Error(ErrorConfig.MESSAGE.PASSWORD_VERIFICATION_REQUIRED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            var userUpdated = await conn.query('IF (select 1 from users where id=uuid_to_bin(?)) is null then ' +
              'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "USER_NOT_FOUND", MYSQL_ERRNO = 4001;' +
              'ELSEIF (select 1 from users where id=uuid_to_bin(?) and updatedAt=?) is null then ' +
              'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "USER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
              'ELSE update users set email = ? , emailStatus = ? ,emailLocalDeviceDateTime=?,' +
              ' updatedAt = ? where id = uuid_to_bin(?);end If', [user.id, user.id, updatedAt, newEmail, true, new Date(deviceDateTime), newUpdatedAt, user.id]);
            userUpdated = Utils.isAffectedPool(userUpdated);

            if (!userUpdated) {
                err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }

            var updatedUser = await conn.query('select updatedAt,createdAt,postRegComplete,emailStatus from users where id = uuid_to_bin(?)', user.id);
            updatedUser = Utils.filteredResponsePool(updatedUser);

            if (!updatedUser) {
                throw err;
            }

            user.updatedAt = updatedUser.updatedAt;
            user.createdAt = updatedUser.createdAt;
            user.email = newEmail;
            user.emailStatus = updatedUser.emailStatus;
            user.postRegComplete = updatedUser.postRegComplete;
            user.emailLocalDeviceDateTime = new Date(deviceDateTime);

            auditOptions.metaData = {};
            auditOptions.metaData.old_email = user.email;
            auditOptions.metaData.new_email = newEmail;
            AuditUtils.create(auditOptions);
            return cb(null, user);

        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            } else if (err.errno === 4002) {
                err = new Error(ErrorConfig.MESSAGE.USER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                return cb(err);
            } else {
                err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_EMAIL_FAILED);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                return cb(err);
            }
        }
    },

    deactivateUserMD: async function (options, auditOptions, errorOptions, cb) {
        try {
            var deactivateUserPromiseMD = await User.deactivateUserPromiseMD(options, auditOptions, errorOptions);
            return cb(null, deactivateUserPromiseMD);
        } catch (err) {
            return cb(err);
        }
    },

    // Deactivate User
    deactivateUserPromiseMD: function (options, auditOptions, errorOptions) {

        return new Promise(async function (resolve, reject) {
            var userId = options.user.id;
            var updatedBy = userId;
            var updatedAt = DataUtils.getEpochMSTimestamp();
            var status = options.status;
            var statusReasonCode = options.statusReasonCode;
            if (options.deactivateUserId) {
                userId = options.deactivateUserId;
            }
            var err;

            try {
                var conn = await connection.getConnection();
            } catch (err) {
                debug('err', err);
                return reject(err);
            }

            try {
                await conn.query('START TRANSACTION');

                var userUpdate = await conn.query('If (select 1 from users where id=uuid_to_bin(?)) is not null then' +
                  ' update users set status = ?,statusReasonCode=?, updatedAt =?,updatedBy=uuid_to_bin(?) ' +
                  'where id = uuid_to_bin(?);end if', [userId, status, statusReasonCode, updatedAt, updatedBy, userId]);

                userUpdate = Utils.isAffectedPool(userUpdate);
                if (!userUpdate) {
                    err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }
            } catch (err) {
                await conn.query('rollback;');
                debug('err', err);
                await ErrorUtils.create(errorOptions, options, err);
                err = new Error(ErrorConfig.MESSAGE.USER_DEACTIVATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }

            try {
                var contactsUpdate = await conn.query('update contacts set userActive=?,updatedAt = ?,' +
                  'updatedBy=uuid_to_bin(?) where inviteeUUID=uuid_to_bin(?)',
                  [false, updatedAt, updatedBy, userId]);
                contactsUpdate = Utils.isAffectedPool(contactsUpdate);
                /*if (!contactsUpdate) {
                    err = new Error(ErrorConfig.MESSAGE.CONTACT_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }*/
            } catch (err) {
                await conn.query('rollback;');
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.USER_DEACTIVATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                await ErrorUtils.create(errorOptions, options, err);
                return reject(err);
            }
            debug('commited');
            await conn.query('commit;');
            return resolve({OK: Constants.SUCCESS});
        });
    },

    // activate User
    activateUserMD: async function (options, auditOptions, errorOptions, cb) {

        debug('statusReasonCode', options.statusReasonCode);
        var updatedBy = options.user.id;
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var activateUserId = options.activateUserId;
        var status = options.status;
        var statusReasonCode = options.statusReasonCode;
        var contactStatus = Constants.CONTACT_STATUS.ACCEPTED;
        var phoneCodeSendCount = 0;
        var emailCodeSendCount = 0;
        var resetPasswordCodeSendCount = 0;
        var phoneCodeConfirmCount = 0;
        var emailCodeConfirmCount = 0;
        var resetPasswordCodeConfirmCount = 0;
        var err;

        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
        try {
            await conn.query('START TRANSACTION');

            var userUpdate = await conn.query('If (select 1 from users where id=uuid_to_bin(?)) is not null then ' +
              'update users set status = ?,statusReasonCode=?,phoneCodeSendCount=?,emailCodeSendCount=?,resetPasswordCodeSendCount=?,' +
              'phoneCodeConfirmCount=?, emailCodeConfirmCount=?,resetPasswordCodeConfirmCount=?, updatedAt = ?,updatedBy=uuid_to_bin(?) ' +
              'where id = uuid_to_bin(?);end if', [activateUserId, status, statusReasonCode, phoneCodeSendCount, emailCodeSendCount, resetPasswordCodeSendCount,
                phoneCodeConfirmCount, emailCodeConfirmCount, resetPasswordCodeConfirmCount, updatedAt, updatedBy, activateUserId]);

            userUpdate = Utils.isAffectedPool(userUpdate);
            if (!userUpdate) {
                err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
        } catch (err) {
            await conn.query('rollback;');
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.USER_ACTIVATE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }

        try {
            var contactsUpdate = await conn.query('update contacts set userActive=?,status=?,updatedAt =?,' +
              'updatedBy=uuid_to_bin(?) where inviteeUUID=uuid_to_bin(?)',
              [true, contactStatus, updatedAt, updatedBy, activateUserId]);
            contactsUpdate = Utils.isAffectedPool(contactsUpdate);
            if (!contactsUpdate) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            await conn.query('commit;');
            return cb(null, {OK: Constants.SUCCESS});
        } catch (err) {
            await conn.query('rollback;');
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.USER_ACTIVATE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    verifyPasswordMD: async function (options, cb) {
        var email = options.email;
        var password = options.password;
        var err;

        if (DataUtils.isUndefined(password)) {
            err = new Error(ErrorConfig.MESSAGE.PASSWORD_REQ);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('err', err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();

            var user = await conn.query('select password from users where email=?', email);
            user = Utils.filteredResponsePool(user);
            debug('user', user);
            if (!user) {
                throw err;
            }
            var savedHash = user.password;
            if (!Bcrypt.compareSync(password, savedHash)) {
                err = new Error(ErrorConfig.MESSAGE.PASSWORD_INVALID);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                Util.log(err);
                return cb(err);
            }
            return cb(null, user);

        } catch (err) {
            debug(err || 'Failed to fetch user having email: ' + email);
            err = new Error(ErrorConfig.MESSAGE.PASSWORD_INVALID);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            Util.log(err);
            return cb(err);
        }
    },

    validatePasswordMD: async function (options, cb) {
        var email = options.email;
        var currentPassword = options.currentPassword;
        var newPassword = options.newPassword;
        var confirmPassword = options.confirmPassword;
        var err;

        if (DataUtils.isUndefined(currentPassword)) {
            err = new Error(ErrorConfig.MESSAGE.CURRENT_PASSWORD_REQ);
        } else if (DataUtils.isUndefined(newPassword)) {
            err = new Error(ErrorConfig.MESSAGE.NEW_PASSWORD_REQ);
        } else if (DataUtils.isUndefined(confirmPassword)) {
            err = new Error(ErrorConfig.MESSAGE.CONFIRM_PASSWORD_REQ);
        } else if (newPassword !== confirmPassword) {
            err = new Error(ErrorConfig.MESSAGE.PASSWORD_AND_CONFIRM_NOT_MATCH);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('err', err);
            return cb(err);
        }
        try {
            var conn = await connection.getConnection();

            var user = await conn.query('select password,advancedAuthNumber from users where email=?', email);
            user = Utils.filteredResponsePool(user);
            if (!user) {
                throw err;
            }
            var savedHash = user.password;
            if (!Bcrypt.compareSync(currentPassword, savedHash)) {
                err = new Error(ErrorConfig.MESSAGE.PASSWORD_INVALID);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                Util.log(err);
                return cb(err);
            }
            return cb(null, {advancedAuthNumber: user.advancedAuthNumber});

        } catch (err) {
            debug(err || 'Failed to fetch user having email: ' + email);
            err = new Error(ErrorConfig.MESSAGE.PASSWORD_INVALID);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            Util.log(err);
            return cb(err);
        }
    },

    handleSesEmail: function (options, cb) {
        var userId = options.userId;
        User.getUserById(userId, function (err, user) {
            if (err || !user) {
                err = err || new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }

            EmailRawParser.handleS3Email(options, function (err, url) {
                if (err) {
                    return cb(err);
                }
                var userEmailOptions = {
                    accountId: user.accountId,
                    userId: userId,
                    timestamp: options.timestamp,
                    subject: options.subject,
                    sender: options.sender,
                    s3url: url
                };

                var params = {
                    overwrite: false
                };
                UserEmailModel.create(userEmailOptions, params, function (err, userEmail) {
                    if (err) {
                        return cb(err);
                    }
                    var notification = {
                        user_ids: [userId],
                        topic_id: userId,
                        notification_reference: NotificationReferenceData.EMAIL_RECEIVED,
                        data: {
                            url: url
                        },
                        languageCultureCode: user.languageCultureCode
                    };
                    NotificationApi.create(notification);
                    return cb();
                });
            });
        });
    },

    assignRole: async function (options, errorOptions, cb) {
        var authUser = options.authUser;
        var authUserId = authUser.id;
        var user = options.user;
        var roles = options.roles;
        var createdAt = DataUtils.getEpochMSTimestamp();
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var err;

        try {
            var conn = await connection.getConnection();

            await Promise.each(roles, async function (value) {
                var generateIdForRoles = Utils.generateId();

                var userRole = await conn.query('insert into user_roles (id, roleId, userId, createdAt, updatedAt, createdBy)' +
                  ' values(uuid_to_bin(?),uuid_to_bin(?),uuid_to_bin(?),?,?,uuid_to_bin(?))',
                  [generateIdForRoles.uuid, value, authUserId, createdAt, updatedAt, user.id]);
                userRole = Utils.isAffectedPool(userRole);
                if (!userRole) {
                    err = new Error(ErrorConfig.MESSAGE.CREATE_USER_ROLE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }
            });

            if (authUser.authorizeUserStatus === Constants.AUTHORIZE_USER_STATUS.NO_INVITATION) {
                await conn.query('commit;');
            }
            return cb(null, authUser);
        } catch (err) {
            await conn.query('rollback;');
            await ErrorUtils.create(errorOptions, options, err);
            debug('err %o', err);
            return cb(err);
        }
    },

    createUserMD: function (options, errorOptions, cb) {
        var profileFields = '';
        var profileRequiredValues = [];
        var profileOptionalValues = [];
        var generatedIdForUser = Utils.generateId();
        var authUserId = generatedIdForUser.uuid;
        var email = options.email;
        var accountId = options.accountId;
        var languageCultureCode = options.languageCultureCode;
        var userId = options.userId;
        var createdAt = DataUtils.getEpochMSTimestamp();
        var updatedAt = DataUtils.getEpochMSTimestamp();

        profileRequiredValues.push(email, authUserId, accountId);
        User.validateOptionalFields(options, async function (err, response) {
            if (err) {
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            profileFields = response.profileFields;
            profileOptionalValues = response.profileOptionalValues;

            /*if (profileOptionalValues.length === 0) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_REQUEST);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug('err', err);
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }*/

            profileRequiredValues = _.concat(profileRequiredValues, profileOptionalValues);

            profileRequiredValues.push(languageCultureCode, options.postRegComplete, options.isAccountActive, options.isAccountEnabled,
              options.profileComplete, options.securityComplete, options.status, options.flag, options.authorizeUserStatus, createdAt, updatedAt, userId);

            try {
                var conn = await connection.getConnection();
                var authorizeUser = await conn.query('If (select 1 from users where email = ?) is null then ' +
                  'insert into users set id=uuid_to_bin(?), accountId=uuid_to_bin(?),' + profileFields + 'languageCultureCode=?,' +
                  ' postRegComplete=?, isAccountActive=?, isAccountEnabled=?, profileComplete=?, securityComplete=?, status=?, flag=?, authorizeUserStatus=?, ' +
                  'createdAt=?, updatedAt=?, createdBy=uuid_to_bin(?);end if;', profileRequiredValues);

                authorizeUser = Utils.isAffectedPool(authorizeUser);

                if (!authorizeUser) {
                    err = new Error(ErrorConfig.MESSAGE.USER_WITH_THIS_EMAIL_IS_ALREADY_EXIST);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
                options.id = authUserId;
                options.createdAt = createdAt;
                options.updatedAt = updatedAt;
                return cb(null, options);
            } catch (err) {
                await ErrorUtils.create(errorOptions, options, err);
                debug('err %o', err);
                err = new Error(ErrorConfig.MESSAGE.AUTHORIZE_USER_CREATION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
        });
    },

    createLocationReferenceMD: function (options, errorOptions, cb) {
        var locationRefFields = '';
        var locationRefOptionalValues = [];
        var locationRefRequiredValues = [];
        var locationId = options.locationId;
        var accountId = options.accountId;
        var locationName = options.locationName;
        var user = options.user;

        locationRefRequiredValues.push(accountId, locationId, accountId, locationId, locationName);
        CommonApi.validateLocRefOptionalFields(options, async function (err, response) {
            if (err) {
                debug('err', err);
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            locationRefFields = response.locationRefFields;
            locationRefOptionalValues = response.locationRefOptionalValues;

            locationRefRequiredValues = _.concat(locationRefRequiredValues, locationRefOptionalValues);

            locationRefRequiredValues.push(user.id);

            try {
                var conn = await connection.getConnection();
                var locationReference = await conn.query('IF (select 1 from LocationReference where accountId=uuid_to_bin(?) and locationId=?) is null then ' +
                  'insert into LocationReference set accountId=uuid_to_bin(?), locationId=?, locationName=?, ' + locationRefFields + ' createdBy=uuid_to_bin(?), ' +
                  'createdAt=utc_timestamp(3), updatedAt=utc_timestamp(3) ; END IF;', locationRefRequiredValues);

                locationReference = Utils.isAffectedPool(locationReference);

                if (!locationReference) {
                    debug('err', err);
                    err = new Error(ErrorConfig.MESSAGE.DUPLICATE_LOCATION_CREATION);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    return cb(err);
                }
                return cb(null, {OK: 'Location reference created successfully...!!!'});
            } catch (err) {
                debug('err', err);
                //await ErrorUtils.create(errorOptions, options, err);
                err = new Error(ErrorConfig.MESSAGE.LOCATION_CREATION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
        });
    },

    createMD: async function (options, auditOptions, errorOptions, cb) {
        var email = options.email;
        var user = options.user;
        var userId = options.userId;
        var languageCultureCode = options.languageCultureCode;
        var accountId = options.accountId;
        var firstName = options.firstName;
        var middleName = options.middleName;
        var lastName = options.lastName;
        var dateOfBirth = options.dateOfBirth;
        var phone = options.phone;
        var dialCode = options.dialCode;
        var phoneCountry = options.phoneCountry;
        var primaryMobile = options.primaryMobile;
        var primaryMobileDialCode = options.primaryMobileDialCode;
        var primaryMobileCountry = options.primaryMobileCountry;
        var secondaryMobile = options.secondaryMobile;
        var secondaryMobileDialCode = options.secondaryMobileDialCode;
        var secondaryMobileCountry = options.secondaryMobileCountry;
        var primaryMobilePhoneEndingWith, secondaryMobilePhoneEndingWith;
        var addressLine1 = options.addressLine1;
        var addressLine2 = options.addressLine2;
        var addressLine3 = options.addressLine3;
        var city = options.city;
        var state = options.state;
        var zipCode = options.zipCode;
        var country = options.country;
        var roles = options.roles || [];
        var err;


        if (!firstName) {
            err = new Error(ErrorConfig.MESSAGE.FIRST_NAME_REQ);
        } else if (firstName.lenght > 60) {
            err = new Error(ErrorConfig.MESSAGE.FIRST_NAME_MUST_BE_LESS_THAN_60_CHARACTER);
        } else if (roles.length <= 0) {
            err = new Error(ErrorConfig.MESSAGE.ROLES_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        if (DataUtils.isDefined(phone) || DataUtils.isDefined(dialCode) || DataUtils.isDefined(phoneCountry)) {
            if (DataUtils.isUndefined(phone)) {
                err = new Error(ErrorConfig.MESSAGE.PHONE_NUMBER_REQUIRED);
            } else if (DataUtils.isUndefined(dialCode)) {
                err = new Error(ErrorConfig.MESSAGE.DIAL_CODE_REQUIRED);
            } else if (DataUtils.isUndefined(phoneCountry)) {
                err = new Error(ErrorConfig.MESSAGE.PHONE_COUNTRY_REQUIRED);
            }
            if (err) {
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            //phone = dialCode + '' + phone;
        }
        if (DataUtils.isDefined(primaryMobile) || DataUtils.isDefined(primaryMobileDialCode) || DataUtils.isDefined(primaryMobileCountry)) {
            if (DataUtils.isUndefined(primaryMobile)) {
                err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_REQUIRED);
            } else if (DataUtils.isUndefined(primaryMobileDialCode)) {
                err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_DIAL_CODE_REQUIRED);
            } else if (DataUtils.isUndefined(primaryMobileCountry)) {
                err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_COUNTRY_REQUIRED);
            }
            if (err) {
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            primaryMobilePhoneEndingWith = Utils.phoneEndingWith(primaryMobile);
            //primaryMobile = primaryMobileDialCode + '' + primaryMobile;
        }
        if (DataUtils.isDefined(secondaryMobile) || DataUtils.isDefined(secondaryMobileDialCode) || DataUtils.isDefined(secondaryMobileCountry)) {
            if (DataUtils.isUndefined(secondaryMobile)) {
                err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_REQUIRED);
            } else if (DataUtils.isUndefined(secondaryMobileDialCode)) {
                err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_DIAL_CODE_REQUIRED);
            } else if (DataUtils.isUndefined(secondaryMobileCountry)) {
                err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_COUNTRY_REQUIRED);
            }
            if (err) {
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            secondaryMobilePhoneEndingWith = Utils.phoneEndingWith(secondaryMobile);
            //secondaryMobile = secondaryMobileDialCode + '' + secondaryMobile;
        }

        var userOptions = {
            email: email,
            accountId: accountId,
            userId: userId,
            firstName: firstName,
            middleName: middleName,
            lastName: lastName,
            dateOfBirth: dateOfBirth,
            phone: phone,
            dialCode: dialCode,
            phoneCountry: phoneCountry,
            primaryMobile: primaryMobile,
            primaryMobilePhoneEndingWith: primaryMobilePhoneEndingWith,
            primaryMobileCountry: primaryMobileCountry,
            primaryMobileDialCode: primaryMobileDialCode,
            secondaryMobile: secondaryMobile,
            secondaryMobilePhoneEndingWith: secondaryMobilePhoneEndingWith,
            secondaryMobileDialCode: secondaryMobileDialCode,
            secondaryMobileCountry: secondaryMobileCountry,
            languageCultureCode: languageCultureCode,
            addressLine1: addressLine1,
            addressLine2: addressLine2,
            addressLine3: addressLine3,
            city: city,
            state: state,
            zipCode: zipCode,
            country: country,
            postRegComplete: false,
            isAccountActive: false,
            isAccountEnabled: false,
            profileComplete: false,
            securityComplete: false,
            status: Constants.USER_STATUS.TEMPORARY,
            flag: Constants.USER_FLAG.AUTHORIZED_USER_INVITATION,
            authorizeUserStatus: Constants.AUTHORIZE_USER_STATUS.NO_INVITATION
        };
        debug('userOptions', userOptions);

        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        try {
            await conn.query('START TRANSACTION');
            User.createUserMD(userOptions, errorOptions, async function (err, response) {
                if (err) {
                    await conn.query('rollback;');
                    debug('err', err);
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
                AuditUtils.create(auditOptions);
                userOptions.id = response.id;
                await conn.query('commit;');
                return cb(null, userOptions);
            });
        } catch (err) {
            await conn.query('rollback;');
            debug('err', err);
            return cb(err);
        }
    },

    getUserWithFlagById: function (options) {
        return new Promise(async function (resolve, reject) {
            var userId = options.userId;
            var notifyType = options.notifyType;
            debug('userId', userId);
            var err;
            try {
                var conn = await connection.getConnection();

                var user = await conn.query('select CAST(uuid_from_bin(U.id) as char) as id,U.firstName,U.lastName,U.email,' +
                  ' UP.flag as notifyFlag from users U,userPreferences UP ' +
                  ' where U.id = uuid_to_bin(?) and UP.userId = U.id and UP.type = ?;',
                  [userId, notifyType]);
                user = Utils.filteredResponsePool(user);
                if (!user) {
                    err = new Error(ErrorConfig.MESSAGE.USER_NOT_EXISTS);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }
                return resolve(user);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.USER_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    inviteMD: async function (options, auditOptions, errorOptions, cb) {
        var email = options.email;
        var user = options.user;
        var updatedAt = options.updatedAt;
        var languageCultureCode = user.languageCultureCode;
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();
        var err;

        if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_MUST_BE_NUMBER);
        } else if (updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_IS_INVALID);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var tempUser = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id,email,firstName,authorizeUserStatus from users where email = ?', email);
            tempUser = Utils.filteredResponsePool(tempUser);

            if (!tempUser) {
                err = new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }

            var opt = {
                languageCultureCode: languageCultureCode,
                template: Constants.EMAIL_TEMPLATES.AUTHORIZED_USER_INVITE,
                email: tempUser.email
            };
            var compileOptions = {
                name: tempUser.firstName,
                friend: user.email,
                scopehub_register: Endpoints.SCOPEHUB_REGISTRATION_URL,
                scopehub_decline: Constants.SCOPEHUB_DECLINE_INVITATION_PAGE_URL + 'authUserEmail=' + tempUser.email + '&userEmail=' + user.email // put URL decline page which redirect when user click on decline link from mail
            };

            if ((user.status === Constants.USER_STATUS.ACTIVE || user.status === Constants.USER_STATUS.TEMPORARY) && tempUser.authorizeUserStatus === Constants.AUTHORIZE_USER_STATUS.NO_INVITATION) {

                tempUser.authorizeUserStatus = Constants.AUTHORIZE_USER_STATUS.OPEN;
                try {
                    var userUpdated = await conn.query('IF (select 1 from users where email = ?) is null then ' +
                      'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "USER_NOT_FOUND", MYSQL_ERRNO = 4001;' +
                      'ELSEIF (select 1 from users where email = ? and updatedAt = ?) is null then ' +
                      'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "USER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
                      'ELSE update users set authorizeUserStatus = ?,authorizeUserInvitationDate = utc_timestamp(3),updatedAt = ?,updatedBy = uuid_to_bin(?)' +
                      ' where email = ?;end if;', [tempUser.email, tempUser.email, updatedAt, Constants.AUTHORIZE_USER_STATUS.OPEN, newUpdatedAt, user.id, tempUser.email]);

                    userUpdated = Utils.isAffectedPool(userUpdated);
                    if (!userUpdated) {
                        debug('err', err);
                        err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                        throw err;
                    }

                    /*var userResponse = await User.getUserWithFlagById({
                        userId: user.id,
                        notifyType: Constants.NOTIFICATION_CATEGORY_TYPE.AUTH_USER
                    });*/

                    /*
                    * SEND NOTIFICATION
                    * */
                    //var notifyFlag = JSON.parse(userResponse.notifyFlag);
                    //if (notifyFlag.email === 1) {
                    await EmailUtils.sendEmailPromise(opt, compileOptions);
                    //}
                    AuditUtils.create(auditOptions);
                    return cb(null, {
                        OK: Constants.SUCCESS_MESSAGE.AUTHORIZE_USER_INVITE_SUCCESS,
                        authorizeUserStatus: Constants.AUTHORIZE_USER_STATUS.OPEN,
                        updatedAt: newUpdatedAt
                    });
                } catch (err) {
                    debug('err %o', err);
                    await ErrorUtils.create(errorOptions, options, err);
                    if (err.errno === 4001) {
                        err = new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        return cb(err);
                    } else if (err.errno === 4002) {
                        err = new Error(ErrorConfig.MESSAGE.USER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                        err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                        return cb(err);
                    } else {
                        err = new Error(ErrorConfig.MESSAGE.AUTHORIZE_USER_INVITATION_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                        return cb(err);
                    }
                }
            } else {
                err = new Error(ErrorConfig.MESSAGE.STATUS_OF_THE_AUTHORIZED_USER_RECORD_CHANGED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }

        } catch (err) {
            debug('err %o', err);
            await ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.AUTHORIZE_USER_INVITATION_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    validateUserIdMD: async function (options, errorOptions, cb) {
        var userId = options.userId;
        var err;

        if (DataUtils.isUndefined(userId)) {
            err = new Error(ErrorConfig.MESSAGE.USER_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        User.getUserByIdMD(userId, async function (err, userResponse) {
            if (err || !userResponse) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.USER_NOT_EXISTS);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            return cb(null, userResponse);
        });
    },

    assignRoleAndInvite: async function (options, errorOptions, cb) {
        var user = options.user;
        var authUser = options.authUser;
        var roles = options.roles;

        var roleOption = {
            user: user,
            authUser: authUser,
            roles: roles
        };
        try {
            var conn = await connection.getConnection();
            User.assignRole(roleOption, errorOptions, async function (err, authUser) {
                if (err) {
                    return cb(err);
                }
                var opt = {
                    languageCultureCode: user.languageCultureCode,
                    template: Constants.EMAIL_TEMPLATES.AUTHORIZED_USER_INVITE,
                    email: authUser.email
                };
                var compileOptions = {
                    name: authUser.firstName || '',
                    friend: user.email,
                    scopehub_register: Endpoints.SCOPEHUB_REGISTRATION_URL,
                    scopehub_decline: Constants.SCOPEHUB_DECLINE_INVITATION_PAGE_URL + authUser.email // put URL decline page which redirect when user click on decline link from mail
                };
                if (user.status === Constants.USER_STATUS.ACTIVE || user.status === Constants.USER_STATUS.TEMPORARY) {
                    EmailUtils.sendEmailMD(opt, compileOptions, async function (err) {
                        if (err) {
                            debug('err', err);
                            await conn.query('rollback;');
                            await ErrorUtils.create(errorOptions, options, err);
                            return cb(err);
                        }
                        return cb(null, authUser);
                    });
                } else {
                    return cb(null, authUser);
                }
            });
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
    },

    addInviteMD: async function (options, auditOptions, errorOptions, cb) {

        var email = options.email;
        var user = options.user;
        var accountId = options.accountId;
        var userId = options.userId;
        var languageCultureCode = user.languageCultureCode;
        var firstName = options.firstName;
        var middleName = options.middleName;
        var lastName = options.lastName;
        var dateOfBirth = options.dateOfBirth;
        var phone = options.phone;
        var dialCode = options.dialCode;
        var phoneCountry = options.phoneCountry;
        var addressLine1 = options.addressLine1;
        var addressLine2 = options.addressLine2;
        var addressLine3 = options.addressLine3;
        var primaryMobile = options.primaryMobile;
        var primaryMobileDialCode = options.primaryMobileDialCode;
        var primaryMobileCountry = options.primaryMobileCountry;
        var secondaryMobile = options.secondaryMobile;
        var secondaryMobileDialCode = options.secondaryMobileDialCode;
        var secondaryMobileCountry = options.secondaryMobileCountry;
        var primaryMobilePhoneEndingWith, secondaryMobilePhoneEndingWith;
        var city = options.city;
        var state = options.state;
        var zipCode = options.zipCode;
        var country = options.country;
        var roles = options.roles || [];
        var error, err;

        if (DataUtils.isUndefined(firstName)) {
            err = new Error(ErrorConfig.MESSAGE.FIRST_NAME_REQ);
        } else if (roles.length <= 0) {
            err = new Error(ErrorConfig.MESSAGE.ROLES_REQUIRED);
        }
        if (err) {
            await ErrorUtils.create(errorOptions, options, err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
        if (DataUtils.isDefined(phone) || DataUtils.isDefined(dialCode) || DataUtils.isDefined(phoneCountry)) {
            if (DataUtils.isUndefined(phone)) {
                err = new Error(ErrorConfig.MESSAGE.PHONE_NUMBER_REQUIRED);
            } else if (DataUtils.isUndefined(dialCode)) {
                err = new Error(ErrorConfig.MESSAGE.DIAL_CODE_REQUIRED);
            } else if (DataUtils.isUndefined(phoneCountry)) {
                err = new Error(ErrorConfig.MESSAGE.PHONE_COUNTRY_REQUIRED);
            }
            if (err) {
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            //phone = dialCode + '' + phone;
        }
        if (DataUtils.isDefined(primaryMobile) || DataUtils.isDefined(primaryMobileDialCode) || DataUtils.isDefined(primaryMobileCountry)) {
            if (DataUtils.isUndefined(primaryMobile)) {
                err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_REQUIRED);
            } else if (DataUtils.isUndefined(primaryMobileDialCode)) {
                err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_DIAL_CODE_REQUIRED);
            } else if (DataUtils.isUndefined(primaryMobileCountry)) {
                err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_COUNTRY_REQUIRED);
            }
            if (err) {
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            primaryMobilePhoneEndingWith = Utils.phoneEndingWith(primaryMobile);
            //primaryMobile = primaryMobileDialCode + '' + primaryMobile;
        }
        if (DataUtils.isDefined(secondaryMobile) || DataUtils.isDefined(secondaryMobileDialCode) || DataUtils.isDefined(secondaryMobileCountry)) {
            if (DataUtils.isUndefined(secondaryMobile)) {
                err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_REQUIRED);
            } else if (DataUtils.isUndefined(secondaryMobileDialCode)) {
                err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_DIAL_CODE_REQUIRED);
            } else if (DataUtils.isUndefined(secondaryMobileCountry)) {
                err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_COUNTRY_REQUIRED);
            }
            if (err) {
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            secondaryMobilePhoneEndingWith = Utils.phoneEndingWith(secondaryMobile);
            //secondaryMobile = secondaryMobileDialCode + '' + secondaryMobile;
        }

        /*if (primaryMobile) {
            if (DataUtils.isUndefined(primaryMobileDialCode)) {
                err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_DIAL_CODE_REQUIRED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }

        }
        if (secondaryMobile) {
            if (DataUtils.isUndefined(secondaryMobileDialCode)) {
                err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_DIAL_CODE_REQUIRED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }

        }*/


        var userOptions = {
            email: email,
            firstName: firstName,
            middleName: middleName,
            lastName: lastName,
            dateBfBirth: dateOfBirth,
            phone: phone,
            dialCode: dialCode,
            phoneCountry: phoneCountry,
            primaryMobile: primaryMobile,
            primaryMobilePhoneEndingWith: primaryMobilePhoneEndingWith,
            primaryMobileCountry: primaryMobileCountry,
            primaryMobileDialCode: primaryMobileDialCode,
            secondaryMobile: secondaryMobile,
            secondaryMobilePhoneEndingWith: secondaryMobilePhoneEndingWith,
            secondaryMobileCountry: secondaryMobileCountry,
            secondaryMobileDialCode: secondaryMobileDialCode,
            languageCultureCode: languageCultureCode,
            addressLine1: addressLine1,
            addressLine2: addressLine2,
            addressLine3: addressLine3,
            city: city,
            state: state,
            zipCode: zipCode,
            country: country,
            postRegComplete: false,
            isAccountActive: false,
            isAccountEnabled: false,
            profileComplete: false,
            securityComplete: false,
            status: Constants.USER_STATUS.TEMPORARY,
            flag: Constants.USER_FLAG.AUTHORIZED_USER_INVITATION,
            authorizeUserStatus: Constants.AUTHORIZE_USER_STATUS.OPEN,
            accountId: accountId,
            userId: userId
        };

        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
        try {
            await conn.query('START TRANSACTION');

            User.createUserMD(userOptions, errorOptions, async function (err, response) {
                if (err) {
                    await conn.query('rollback;');
                    debug('err', err);
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
                userOptions.id = response.id;
                userOptions.createdAt = response.createdAt;
                userOptions.updatedAt = response.updatedAt;
                var roleOption = {
                    user: user,
                    authUser: userOptions,
                    roles: roles
                };
                User.assignRoleAndInvite(roleOption, errorOptions, async function (err, response) {
                    if (err) {
                        debug('err %o', err);
                        await conn.query('rollback;');
                        await ErrorUtils.create(errorOptions, options, err);
                        err = new Error(ErrorConfig.MESSAGE.AUTHORIZE_USER_ADD_AND_INVITE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                        return cb(err);
                    }
                    await conn.query('commit;');
                    AuditUtils.create(auditOptions);
                    return cb(null, response);
                });
            });
        } catch (err) {
            debug('err', err);
            await conn.query('rollback;');
            return cb(err);
        }
    },

    getAllAuthorizedUserMD: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var accountId = user.accountId;
        var authUserArray = [];
        var err;
        try {
            var conn = await connection.getConnection();
            var authUsers = await conn.query('select CAST(uuid_from_bin(U.id) as CHAR) as id,U.firstName,U.lastName,U.languageCultureCode,' +
              'U.email,U.authorizeUserStatus,U.status,U.dateOfBirth,U.updatedAt,group_concat(R.title) as roles from users U , user_roles UR , Roles R ' +
              'where U.accountId=uuid_to_bin(?) and U.flag = ? and UR.userId = U.id and R.id = UR.roleId group by U.id ;',
              [accountId, Constants.USER_FLAG.AUTHORIZED_USER_INVITATION]);

            if (!authUsers) {
                err = new Error(ErrorConfig.MESSAGE.USER_NOT_EXISTS);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }

            // do not remove
            /* await Promise.each(authUsers, async function (value) {
                 var userId = value.id;
                 var roles = await knex.raw('select uuid_from_bin(id) as id,title from Roles where id in (select roleId from user_roles where userId=uuid_to_bin(?))', [userId]);
                 roles = Utils.filteredResponse(roles);
                 if (!roles) {
                     debug('err', err);
                     err = new Error(ErrorConfig.MESSAGE.CREATE_USER_ROLE_FAILED);
                     err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                     throw err;
                 }
                 value.roles = roles;
             });*/
            await AuditUtils.create(auditOptions);
            return cb(null, authUsers);
        } catch (err) {
            debug('err ', err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    declineAuthorizedUserInvitationMD: async function (options, auditOptions, errorOptions, cb) {
        var userEmail = options.userEmail;
        var authUserEmail = options.authUserEmail;
        //var updatedAt = options.updatedAt;
        var currentDate = new Date();
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();
        var date = new Date();
        var err;


        if (DataUtils.isUndefined(userEmail)) {
            err = new Error(ErrorConfig.MESSAGE.EMAIL_REQUIRED);
        } else if (DataUtils.isUndefined(authUserEmail)) {
            err = new Error(ErrorConfig.MESSAGE.AUTHORIZE_USER_EMAIL_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        //updatedAt = new Date(updatedAt);
        User.getUserByEmailMD(userEmail, async function (err, userData) {
            var email = userData.email;
            var languageCultureCode = userData.languageCultureCode;

            User.getUserByEmailMD(authUserEmail, async function (err, authUserData) {
                if (err) {
                    await ErrorUtils.create(errorOptions, options, err);
                    return err;
                }
                var opt = {
                    languageCultureCode: languageCultureCode,
                    template: Constants.EMAIL_TEMPLATES.DECLINED_USER_INVITE,
                    email: email
                };
                var compileOptions = {
                    name: userData.firstName,
                    friend_name: authUserData.firstName,
                    user_email: authUserEmail,//AWS.DEFAULT_SENDER,
                    scopehub_login: ''
                };
                if ((userData.status === Constants.USER_STATUS.ACTIVE || userData.status === Constants.USER_STATUS.TEMPORARY) && authUserData.authorizeUserStatus === Constants.AUTHORIZE_USER_STATUS.OPEN) {
                    EmailUtils.sendEmailMD(opt, compileOptions, async function (err) {
                        if (err) {
                            await ErrorUtils.create(errorOptions, options, err);
                            return cb(err);
                        }
                        try {
                            var conn = await connection.getConnection();
                            var userUpdated = await conn.query('if (select 1 from users where email=?) is not null then ' +
                              'update users set status=? , authorizeUserStatus = ?, updatedBy = uuid_to_bin(?) ,' +
                              'updatedAt = ? where email = ?;end if;', [authUserEmail, Constants.USER_STATUS.INACTIVE,
                                Constants.AUTHORIZE_USER_STATUS.DECLINED, userData.id, newUpdatedAt, authUserEmail]);
                            userUpdated = Utils.isAffectedPool(userUpdated);
                            if (!userUpdated) {
                                err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                                throw err;
                            }

                            var invitationExpirationDate = date.setDate(date.getDate() + Constants.INVITATION_EXPIRATION_DATE_LIMIT);
                            invitationExpirationDate = new Date(invitationExpirationDate);

                            var notificationOption = {
                                refereId: Constants.DEFAULT_REFERE_ID,
                                user_ids: [userData.id],
                                topic_id: userData.id,
                                refereType: Constants.NOTIFICATION_REFERE_TYPE.AUTH_USER,
                                notification_reference: NotificationReferenceData.AUTHROIZED_USER_INVITE_DECLINE,
                                notificationExpirationDate: invitationExpirationDate,
                                paramasDateTime: currentDate,
                                paramsInviter: userData.email + ', ' +
                                  (userData.firstName ? userData.firstName : '') + ' ' +
                                  (userData.lastName ? userData.lastName : ''),
                                paramsInvitee: authUserData.email + ', ' +
                                  (authUserData.firstName ? authUserData.firstName : '') + ' ' +
                                  (authUserData.lastName ? authUserData.lastName : ''),
                                metaEmail: userData.email,
                                languageCultureCode: userData.languageCultureCode,
                                createdBy: userData.id,
                                type: Constants.DEFAULT_NOTIFICATION_TYPE
                            };
                            if (authUserData.firstName) {
                                notificationOption.metaName = authUserData.firstName;
                            }
                            debug('notification', notificationOption);
                            await NotificationApi.createMD(notificationOption);
                            return cb(null, {
                                OK: Constants.SUCCESS_MESSAGE.AUTHORIZE_USER_DECLINE_INVITE_SUCCESS,
                                authorizeUserStatus: Constants.AUTHORIZE_USER_STATUS.DECLINED,
                                updatedAt: newUpdatedAt
                            });
                        } catch (err) {
                            debug('err ', err);
                            await ErrorUtils.create(errorOptions, options, err);
                            err = new Error(ErrorConfig.MESSAGE.AUTHORIZE_USER_DECLINE_FAILED);
                            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                            return cb(err);
                        }
                    });
                } else {
                    debug('err', err);
                    err = new Error(ErrorConfig.MESSAGE.STATUS_OF_THE_AUTHORIZED_USER_RECORD_CHANGED);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
            });
        });

    },

    cancelMD: async function (options, auditOptions, errorOptions, cb) {
        var userId = options.userId;
        var user = options.user;
        var updatedAt = options.updatedAt;
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();
        var err;

        if (DataUtils.isUndefined(userId)) {
            err = new Error(ErrorConfig.MESSAGE.USER_ID_REQUIRED);
        } else if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_MUST_BE_NUMBER);
        } else if (updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_IS_INVALID);
        }

        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        User.getUserByIdMD(userId, async function (err, userResponse) {
            if (err || !userResponse) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
            var opt = {
                languageCultureCode: userResponse.languageCultureCode,
                template: Constants.EMAIL_TEMPLATES.CANCEL_USER_INVITE,
                email: userResponse.email
            };
            var compileOptions = {
                name: user.firstName || '',
                user_email: user.email,
                scopehub_login: ''
            };

            if (userResponse.authorizeUserStatus === Constants.AUTHORIZE_USER_STATUS.OPEN) {
                try {
                    var conn = await connection.getConnection();
                    var userUpdated = await conn.query('IF (select 1 from users where id = uuid_to_bin(?)) is null then ' +
                      'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "USER_NOT_FOUND", MYSQL_ERRNO = 4001;' +
                      'ELSEIF (select 1 from users where id = uuid_to_bin(?) and updatedAt=?) is null then ' +
                      'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "USER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
                      'ELSE update users set status = ? , authorizeUserStatus = ?, updatedAt = ?, ' +
                      'updatedBy=uuid_to_bin(?) where id = uuid_to_bin(?);end if;',
                      [userId, userId, updatedAt, Constants.USER_STATUS.INACTIVE, Constants.AUTHORIZE_USER_STATUS.CANCELED, newUpdatedAt, user.id, userId]);

                    userUpdated = Utils.isAffectedPool(userUpdated);

                    if (!userUpdated) {
                        debug('err', err);
                        err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                        throw err;
                    }
                    EmailUtils.sendEmailMD(opt, compileOptions, async function (err) {
                        if (err) {
                            debug('err', err);
                            await ErrorUtils.create(errorOptions, options, err);
                            return cb(err);
                        }
                        //tempUser = userResponse;
                        AuditUtils.create(auditOptions);
                        return cb(null, {
                            OK: Constants.SUCCESS_MESSAGE.AUTHORIZE_USER_CANCEL_INVITE_SUCCESS,
                            authorizeUserStatus: Constants.AUTHORIZE_USER_STATUS.CANCELED,
                            updatedAt: newUpdatedAt
                        });
                    });
                } catch (err) {
                    debug('err ', err);
                    await ErrorUtils.create(errorOptions, options, err);
                    if (err.errno === 4001) {
                        err = new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        return cb(err);
                    } else if (err.errno === 4002) {
                        err = new Error(ErrorConfig.MESSAGE.USER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                        err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                        return cb(err);
                    } else {
                        err = new Error(ErrorConfig.MESSAGE.AUTHORIZE_USER_CANCEL_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                        return cb(err);
                    }
                }
            } else {
                err = new Error(ErrorConfig.MESSAGE.STATUS_OF_THE_AUTHORIZED_USER_RECORD_CHANGED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
        });
    },

    validateOptionalFields: async function (options, cb) {
        var profileFields = '';
        var profileOptionalValues = [];
        var err;
        try {
            if (!DataUtils.isValidateOptionalField(options.firstName)) {
                if (!DataUtils.isString(options.firstName)) {
                    throw err = new Error(ErrorConfig.MESSAGE.FIRST_NAME_MUST_BE_STRING);
                } else if (options.firstName.length > 60) {
                    throw err = new Error(ErrorConfig.MESSAGE.FIRST_NAME_MUST_BE_LESS_THAN_60_CHARACTER);
                } else {
                    profileFields += 'firstName=? ,';
                    profileOptionalValues.push(options.firstName);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.middleName)) {
                if (!DataUtils.isString(options.middleName)) {
                    throw err = new Error(ErrorConfig.MESSAGE.MIDDLE_NAME_MUST_BE_STRING);
                } else if (options.middleName.length > 60) {
                    throw err = new Error(ErrorConfig.MESSAGE.MIDDLE_NAME_MUST_BE_LESS_THAN_60_CHARACTER);
                } else {
                    profileFields += 'middleName=? ,';
                    profileOptionalValues.push(options.middleName);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.lastName)) {
                if (!DataUtils.isString(options.lastName)) {
                    throw err = new Error(ErrorConfig.MESSAGE.LAST_NAME_MUST_BE_STRING);
                } else if (options.lastName.length > 60) {
                    throw err = new Error(ErrorConfig.MESSAGE.LAST_NAME_MUST_BE_LESS_THAN_60_CHARACTER);
                } else {
                    profileFields += 'lastName=? ,';
                    profileOptionalValues.push(options.lastName);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.dateOfBirth)) {
                if (!DataUtils.isDate(options.dateOfBirth)) {
                    throw err = new Error(ErrorConfig.MESSAGE.DATE_OF_BIRTH_MUST_BE_VALID_DATE);
                } else {
                    profileFields += 'dateOfBirth=? ,';
                    profileOptionalValues.push(options.dateOfBirth);
                }

            }
            if (!DataUtils.isValidateOptionalField(options.email)) {
                if (!DataUtils.isValidEmail(options.email) && options.email !== '') {
                    throw err = new Error(ErrorConfig.MESSAGE.INVALID_EMAIL);
                } else if (options.email.length > 254) {
                    throw err = new Error(ErrorConfig.MESSAGE.EMAIL_MUST_BE_LESS_THAN_254_CHARACTER);
                } else {
                    profileFields += 'email=? ,';
                    profileOptionalValues.push(options.email);
                }
            }


            if (!DataUtils.isValidateOptionalField(options.dialCode)) {
                if (!DataUtils.isString(options.dialCode)) {
                    throw err = new Error(ErrorConfig.MESSAGE.DIAL_CODE_MUST_BE_STRING);
                } else if (options.dialCode.length > 5) {
                    throw err = new Error(ErrorConfig.MESSAGE.DIAL_CODE_MUST_BE_LESS_THAN_5_CHARACTER);
                } else {
                    profileFields += 'dialCode=? ,';
                    profileOptionalValues.push(options.dialCode);
                }
            }

            if (!DataUtils.isValidateOptionalField(options.phoneCountry)) {
                if (!DataUtils.isString(options.phoneCountry)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PHONE_COUNTRY_MUST_BE_STRING);
                } else if (options.phoneCountry.length > 2) {
                    throw err = new Error(ErrorConfig.MESSAGE.PHONE_COUNTRY_MUST_BE_LESS_THAN_2_CHARACTER);
                } else {
                    profileFields += 'phoneCountry=? ,';
                    profileOptionalValues.push(options.phoneCountry);
                }
            }

            if (!DataUtils.isValidateOptionalField(options.phone)) {
                if (!DataUtils.isMobile(options.phone)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PHONE_MUST_BE_VALID_NUMBER);
                } else if (options.phone.length > 15) {
                    throw err = new Error(ErrorConfig.MESSAGE.PHONE_MUST_BE_LESS_THAN_15_DIGITS);
                } else {
                    profileFields += 'phone=? ,';
                    profileOptionalValues.push(options.dialCode + '' + options.phone);
                }
            }

            if (!DataUtils.isValidateOptionalField(options.addressLine1)) {
                if (!DataUtils.isString(options.addressLine1)) {
                    throw err = new Error(ErrorConfig.MESSAGE.ADDRESS_LINE_1_MUST_BE_STRING);
                } else if (options.addressLine1.length > 60) {
                    throw err = new Error(ErrorConfig.MESSAGE.ADDRESS_LINE_1_MUST_BE_LESS_THAN_60_CHARACTER);
                } else {
                    profileFields += 'addressLine1=? ,';
                    profileOptionalValues.push(options.addressLine1);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.addressLine2)) {
                if (!DataUtils.isString(options.addressLine2)) {
                    throw err = new Error(ErrorConfig.MESSAGE.ADDRESS_LINE_2_MUST_BE_STRING);
                } else if (options.addressLine2.length > 60) {
                    throw err = new Error(ErrorConfig.MESSAGE.ADDRESS_LINE_2_MUST_BE_LESS_THAN_60_CHARACTER);
                } else {
                    profileFields += 'addressLine2=? ,';
                    profileOptionalValues.push(options.addressLine2);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.addressLine3)) {
                if (!DataUtils.isString(options.addressLine3)) {
                    throw err = new Error(ErrorConfig.MESSAGE.ADDRESS_LINE_3_MUST_BE_STRING);
                } else if (options.addressLine3.length > 60) {
                    throw err = new Error(ErrorConfig.MESSAGE.ADDRESS_LINE_3_MUST_BE_LESS_THAN_60_CHARACTER);
                } else {
                    profileFields += 'addressLine3=? ,';
                    profileOptionalValues.push(options.addressLine3);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.city)) {
                if (!DataUtils.isString(options.city)) {
                    throw err = new Error(ErrorConfig.MESSAGE.CITY_MUST_BE_STRING);
                } else if (options.city.length > 60) {
                    throw err = new Error(ErrorConfig.MESSAGE.CITY_MUST_BE_LESS_THAN_60_CHARACTER);
                } else {
                    profileFields += 'city=? ,';
                    profileOptionalValues.push(options.city);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.zipCode)) {
                if (!DataUtils.isMobile(options.zipCode)) {
                    throw err = new Error(ErrorConfig.MESSAGE.ZIP_CODE_MUST_BE_VALID_NUMBER);
                } else if (options.zipCode.toString().length > 10) {
                    throw err = new Error(ErrorConfig.MESSAGE.ZIP_CODE_MUST_BE_LESS_THAN_10_DIGIT);
                } else {
                    profileFields += 'zipCode=? ,';
                    profileOptionalValues.push(options.zipCode);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.state)) {
                if (!DataUtils.isString(options.state)) {
                    throw err = new Error(ErrorConfig.MESSAGE.STATE_MUST_BE_STRING);
                } else if (options.state.length > 60) {
                    throw err = new Error(ErrorConfig.MESSAGE.STATE_MUST_BE_LESS_THAN_60_CHARACTER);
                } else {
                    profileFields += 'state=? ,';
                    profileOptionalValues.push(options.state);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.country)) {
                if (!DataUtils.isString(options.country)) {
                    throw err = new Error(ErrorConfig.MESSAGE.COUNTRY_MUST_BE_STRING);
                } else if (options.country.length > 2) {
                    throw err = new Error(ErrorConfig.MESSAGE.COUNTRY_MUST_BE_LESS_THAN_2_CHARACTER);
                } else {
                    profileFields += 'country=? ,';
                    profileOptionalValues.push(options.country);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.primaryMobileDialCode)) {
                if (!DataUtils.isString(options.primaryMobileDialCode)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_DIAL_CODE_MUST_BE_STRING);
                } else if (options.primaryMobileDialCode.length > 5) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_DIAL_CODE_MUST_BE_LESS_THAN_5_CHARACTER);
                } else {
                    profileFields += 'primaryMobileDialCode=? ,';
                    profileOptionalValues.push(options.primaryMobileDialCode);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.primaryMobileCountry)) {
                if (!DataUtils.isString(options.primaryMobileCountry)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_COUNTRY_MUST_BE_STRING);
                } else if (options.primaryMobileCountry.length > 2) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_COUNTRY_MUST_BE_LESS_THAN_2_CHARACTER);
                } else {
                    profileFields += 'primaryMobileCountry=? ,';
                    profileOptionalValues.push(options.primaryMobileCountry);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.primaryMobile)) {
                if (!DataUtils.isMobile(options.primaryMobile)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_MUST_BE_VALID_NUMBER);
                } else if (options.primaryMobile.toString().length > 15) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_MUST_BE_LESS_THAN_OF_15_DIGIT);
                } else {
                    profileFields += 'primaryMobile=? ,';
                    profileOptionalValues.push(options.primaryMobileDialCode + '' + options.primaryMobile);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.primaryMobilePhoneEndingWith)) {
                profileFields += 'primaryMobilePhoneEndingWith=? ,';
                profileOptionalValues.push(options.primaryMobilePhoneEndingWith);
            }
            if (!DataUtils.isValidateOptionalField(options.secondaryMobileDialCode)) {
                if (!DataUtils.isString(options.secondaryMobileDialCode)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_DIAL_CODE_MUST_BE_STRING);
                } else if (options.secondaryMobileDialCode.length > 5) {
                    throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_DIAL_CODE_MUST_BE_LESS_THAN_5_CHARACTER);
                } else {
                    profileFields += 'secondaryMobileDialCode=? ,';
                    profileOptionalValues.push(options.secondaryMobileDialCode);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.secondaryMobileCountry)) {
                if (!DataUtils.isString(options.secondaryMobileCountry)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_COUNTRY_MUST_BE_STRING);
                } else if (options.secondaryMobileCountry.length > 2) {
                    throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_COUNTRY_MUST_BE_LESS_THAN_2_CHARACTER);
                } else {
                    profileFields += 'secondaryMobileCountry=? ,';
                    profileOptionalValues.push(options.secondaryMobileCountry);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.secondaryMobile)) {
                if (!DataUtils.isMobile(options.secondaryMobile)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_MUST_BE_NUMBER);
                } else if (options.secondaryMobile.toString().length > 15) {
                    throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_MUST_BE_LESS_THAN_OF_15_DIGIT);
                } else {
                    profileFields += 'secondaryMobile=? ,';
                    profileOptionalValues.push(options.secondaryMobileDialCode + '' + options.secondaryMobile);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.secondaryMobilePhoneEndingWith)) {
                profileFields += 'secondaryMobilePhoneEndingWith=? ,';
                profileOptionalValues.push(options.secondaryMobilePhoneEndingWith);
            }
            if (!DataUtils.isValidateOptionalField(options.locationId)) {
                if (!DataUtils.isString(options.locationId)) {
                    throw err = new Error(ErrorConfig.MESSAGE.LOCATION_ID_MUST_BE_STRING);
                } else if (options.locationId.length > 40) {
                    throw err = new Error(ErrorConfig.MESSAGE.LOCATION_ID_MUST_BE_LESS_THAN_40_CHARACTER);
                } else {
                    profileFields += 'locationId=? ,';
                    profileOptionalValues.push(options.locationId);
                }
            }
            /*if (!DataUtils.isValidateOptionalField(options.uploadTabFlag)) {
                profileFields += 'uploadTabFlag=? ,';
                profileOptionalValues.push(options.uploadTabFlag);
            }*/
            if (!DataUtils.isValidateOptionalField(options.profilePicture)) {
                profileFields += 'profilePicture=? ,';
                profileOptionalValues.push(options.profilePicture);
            }
            var response = {
                profileFields: profileFields,
                profileOptionalValues: profileOptionalValues
            };
            return cb(null, response);
        } catch (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
    },

    updateUserDetailMD: function (options, errorOptions, cb) {
        var updatedAt = options.updatedAt;
        var userId = options.userId;
        var profileFields = '';
        var profileRequiredValues = [];
        var profileOptionalValues = [];
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();

        profileRequiredValues.push(userId, userId, updatedAt);
        User.validateOptionalFields(options, async function (err, response) {
            if (err) {
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            profileFields = response.profileFields;
            profileOptionalValues = response.profileOptionalValues;

            profileRequiredValues = _.concat(profileRequiredValues, profileOptionalValues);
            profileRequiredValues.push(newUpdatedAt, userId, userId);

            try {
                var conn = await connection.getConnection();
                debug('profileFields', profileFields);
                debug('profileRequiredValues', profileRequiredValues);

                var userUpdated = await conn.query('IF (select 1 from users where id=uuid_to_bin(?)) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "USER_NOT_FOUND", MYSQL_ERRNO = 4001;' +
                  'ELSEIF (select 1 from users where id=uuid_to_bin(?) and updatedAt=?) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "USER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
                  'ELSE update users set ' + profileFields + 'profileComplete=1, updatedAt = ?,updatedBy=uuid_to_bin(?)' +
                  ' where id = uuid_to_bin(?);END IF;', profileRequiredValues);

                userUpdated = Utils.isAffectedPool(userUpdated);
                if (!userUpdated) {
                    err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
                User.getUserByIdMD(userId, function (err, response) {
                    if (err) {
                        debug('err', err);
                        return cb(err);
                    }
                    return cb(null, response);
                });
            } catch (err) {
                debug('err', err);
                await ErrorUtils.create(errorOptions, options, err);
                if (err.errno === 4001) {
                    err = new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return cb(err);
                } else if (err.errno === 4002) {
                    err = new Error(ErrorConfig.MESSAGE.USER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    return cb(err);
                } else {
                    err = new Error(ErrorConfig.MESSAGE.SAVE_MY_PROFILE_DETAIL_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return cb(err);
                }
            }
        });
    },

    getUserMD: async function (email, cb) {
        var err;
        try {
            var conn = await connection.getConnection();
            var user = await conn.query('select addressLine1,addressLine2,addressLine3,city,state,zipCode,country from users where email = ?', email);
            user = Utils.filteredResponsePool(user);
            if (!user) {
                err = new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            return cb(null, user);
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
    },

    /*updateNotificationFlag: async function (options, auditOptions, errorOptions, cb) {
        var err;
        var id = options.user.id;
        var notifyFlag = options.notifyFlag;
        var uploadTabFlag = options.uploadTabFlag;
        var productUoMFlag = options.productUoMFlag;
        var navBarViewFlag = options.navBarViewFlag;
        var menuFlag = options.menuFlag;
        var sharingAlertFlag = options.sharingAlertFlag;
        var updateFields = '';
        var updateOptionalValues = [];
        var successMessage;

        if (DataUtils.isDefined(notifyFlag) && Object.values(Constants.NOTIFY_FLAG).indexOf(notifyFlag) === -1) {
            err = new Error(ErrorConfig.MESSAGE.INVALID_NOTIFY_FLAG_VALUE);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            debug('err', err);
            return cb(err);
        }

        if (DataUtils.isDefined(notifyFlag)) {
            updateFields += 'notifyFlag = ?,';
            updateOptionalValues.push(notifyFlag);
        }
        if (DataUtils.isDefined(uploadTabFlag)) {
            updateFields += 'uploadTabFlag = ?,';
            updateOptionalValues.push(uploadTabFlag);
        }
        if (DataUtils.isDefined(productUoMFlag)) {
            updateFields += 'productUoMFlag = ?,';
            updateOptionalValues.push(productUoMFlag);
        }
        if (DataUtils.isDefined(navBarViewFlag)) {
            updateFields += 'navBarViewFlag = ?,';
            updateOptionalValues.push(navBarViewFlag);
        }
        if (DataUtils.isDefined(menuFlag)) {
            updateFields += 'menuFlag = ?,';
            updateOptionalValues.push(menuFlag);
        }
        if (DataUtils.isDefined(sharingAlertFlag)) {
            updateFields += 'sharingAlertFlag = ?,';
            updateOptionalValues.push(sharingAlertFlag);
        }
        updateFields = updateFields.replace(/,\s*$/, ' ');

        try {
            var conn = await connection.getConnection();

            var user = await conn.query('UPDATE users SET ' + updateFields + ' where ' +
              'id=uuid_to_bin(?)', updateOptionalValues.concat([id]));
            var isUpdated = Utils.isAffectedPool(user);
            if (!isUpdated && options.defaultFlag) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_FLAG_SET_DEFAULT_FAILED);
            } else if (!isUpdated) {
                err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_FLAG_UPDATE_FAILED);
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            if (options.defaultFlag) {
                successMessage = Constants.SUCCESS_MESSAGE.NOTIFICATION_FLAG_SET_DEFAULT_SUCCESS;
            } else if (DataUtils.isDefined(notifyFlag)) {
                successMessage = Constants.SUCCESS_MESSAGE.NOTIFY_FLAG_UPDATE_SUCCESS;
            } else if (DataUtils.isDefined(uploadTabFlag)) {
                successMessage = Constants.SUCCESS_MESSAGE.UPLOAD_TAB_FLAG_UPDATE_SUCCESS;
            } else if (DataUtils.isDefined(productUoMFlag)) {
                successMessage = Constants.SUCCESS_MESSAGE.PRODUCT_UOM_FLAG_UPDATE_SUCCESS;
            } else if (DataUtils.isDefined(navBarViewFlag) || DataUtils.isDefined(menuFlag)) {
                successMessage = Constants.SUCCESS_MESSAGE.NAVBAR_FLAG_UPDATE_SUCCESS;
            } else if (DataUtils.isDefined(sharingAlertFlag)) {
                successMessage = Constants.SUCCESS_MESSAGE.SHARING_ALERT_FLAG_UPDATE_SUCCESS;
            }
            return cb(null, {
                OK: successMessage
            });
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
    },*/

    ValidateNotificationArray: async function (options) {
        return new Promise(async function (resolve, reject) {
            try {
                var notifications = options.notifications;
                var err;

                await Promise.each(notifications, async function (notification) {
                    if (DataUtils.isUndefined(notification.type)) {
                        err = new Error(ErrorConfig.MESSAGE.TYPE_REQUIRED);
                    } else if (Object.values(Constants.NOTIFICATION_CATEGORY_TYPE).indexOf(parseInt(notification.type)) === -1) {
                        err = new Error(ErrorConfig.MESSAGE.INVALID_TYPE);
                    } else if (DataUtils.isUndefined(notification.flag)) {
                        err = new Error(ErrorConfig.MESSAGE.FLAG_REQUIRED);
                    }
                    if (err) {
                        throw err;
                    }

                });
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }

        });
    },

    updateNotificationsByType: async function (options) {
        return new Promise(async function (resolve, reject) {
            try {
                var notifications = options.notifications;
                var currentTime = DataUtils.getEpochMSTimestamp();
                var userId = options.userId;
                var conn = await connection.getConnection();
                await Promise.each(notifications, async function (notification) {
                    var type = notification.type;
                    var flag = notification.flag;

                    var isUpdate = await conn.query('UPDATE userPreferences SET flag = ?, updatedAt = ? ' +
                      'WHERE userId = uuid_to_bin(?) and type = ?', [flag, currentTime, userId, type]);

                    debug('isUpdate', isUpdate);
                });
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }

        });
    },

    updateNotificationFlag: async function (options, auditOptions, errorOptions, cb) {
        var err;
        var id = options.user.id;
        var notifications = options.notifications;
        var navBarViewFlag = options.navBarViewFlag;
        var menuFlag = options.menuFlag;
        var updateFields = '';
        var updateOptionalValues = [];
        var successMessage;


        if (DataUtils.isDefined(navBarViewFlag)) {
            updateFields += 'navBarViewFlag = ?,';
            updateOptionalValues.push(navBarViewFlag);
        }
        if (DataUtils.isDefined(menuFlag)) {
            updateFields += 'menuFlag = ?,';
            updateOptionalValues.push(menuFlag);
        }

        updateFields = updateFields.replace(/,\s*$/, ' ');

        try {
            var conn = await connection.getConnection();

            if (DataUtils.isArray(notifications)) {
                var validateResponse = await User.ValidateNotificationArray({notifications: notifications});
                debug('validateResponse', validateResponse);

                if (!validateResponse) {
                    throw err;
                }

                var update = await User.updateNotificationsByType({notifications: notifications, userId: id});
                debug('update', update);
                if (!update && options.defaultFlag) {
                    err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_FLAG_SET_DEFAULT_FAILED);
                } else if (!update) {
                    err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_FLAG_UPDATE_FAILED);
                }
            }

            if (!options.defaultFlag) {
                var user = await conn.query('UPDATE users SET ' + updateFields + ' where ' +
                  'id=uuid_to_bin(?)', updateOptionalValues.concat([id]));
                var isUpdated = Utils.isAffectedPool(user);

                if (!isUpdated) {
                    err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_FLAG_UPDATE_FAILED);
                }
                if (err) {
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
                successMessage = Constants.SUCCESS_MESSAGE.NOTIFICATION_FLAG_UPDATE_SUCCESS;
            } else {
                successMessage = Constants.SUCCESS_MESSAGE.NOTIFICATION_FLAG_SET_DEFAULT_SUCCESS;
            }
            return cb(null, {
                OK: successMessage
            });
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
    },

    getNotificationFlag: async function (options, errorOptions, cb) {
        var userId = options.userId;
        try {
            var conn = await connection.getConnection();

            /*var query = 'SELECT notifyFlag,productUOMFlag,uploadTabFlag,sharingAlertFlag FROM users WHERE id=uuid_to_bin(?)';
            var params = [userId];*/
            var query = 'SELECT type, flag FROM userPreferences WHERE userId=uuid_to_bin(?)';
            var params = [userId];

            var result = await conn.query(query, params);
            _.each(result, function (value) {
                value.flag = JSON.parse(value.flag);
            });
            //result = Utils.filteredResponsePool(result);
            //result.flag = JSON.parse(result.flag);
            return cb(null, result || []);
        } catch (err) {
            debug('err', err);
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            err = new Error(ErrorConfig.MESSAGE.NOTIFICATION_FLAG_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    saveMyProfileDetailMD: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var err;
        var userId = user.id;
        var accountId = user.accountId;
        var updatedAt = options.updatedAt;
        var phone = options.phone;
        var dialCode = options.dialCode;
        var phoneCountry = options.phoneCountry;
        var locationId = options.locationId;
        var locationName = options.locationName;
        var newLocationId = options.newLocationId;
        var newLocationName = options.newLocationName;
        var saveAsLater = options.saveAsLater;
        var useExisting = options.useExisting;
        var profilePicture = options.profilePicture;
        var locationCreatedAt = DataUtils.getEpochMSTimestamp();
        var locationUpdatedAt = DataUtils.getEpochMSTimestamp();


        if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_MUST_BE_NUMBER);
        } else if (updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_IS_INVALID);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        if (DataUtils.isDefined(phone) || DataUtils.isDefined(dialCode) || DataUtils.isDefined(phoneCountry)) {
            if (DataUtils.isUndefined(phone)) {
                err = new Error(ErrorConfig.MESSAGE.PHONE_NUMBER_REQUIRED);
            } else if (DataUtils.isUndefined(dialCode)) {
                err = new Error(ErrorConfig.MESSAGE.DIAL_CODE_REQUIRED);
            } else if (DataUtils.isUndefined(phoneCountry)) {
                err = new Error(ErrorConfig.MESSAGE.PHONE_COUNTRY_REQUIRED);
            }
            if (err) {
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            //options.phone = dialCode + '' + phone;
        }

        if (useExisting) {
            if (DataUtils.isUndefined(locationId)) {
                err = new Error(ErrorConfig.MESSAGE.SELECT_ANY_LOCATION_ID);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
        }

        try {
            var conn = await connection.getConnection();
            await conn.query('START TRANSACTION');
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        if (saveAsLater) {
            var locationRefFields = '';
            var locationRefRequiredValues = [];
            var locationRefOptionalValues = [];
            if (DataUtils.isUndefined(newLocationId)) {
                err = new Error(ErrorConfig.MESSAGE.LOCATION_ID_REQUIRED);
            } else if (newLocationId.length > 40) {
                err = new Error(ErrorConfig.MESSAGE.LOCATION_ID_MUST_BE_LESS_THAN_40_CHARACTER);
            } else if (DataUtils.isUndefined(newLocationName)) {
                err = new Error(ErrorConfig.MESSAGE.LOCATION_NAME_REQUIRED);
            } else if (newLocationName.length > 60) {
                err = new Error(ErrorConfig.MESSAGE.LOCATION_NAME_MUST_BE_LESS_THEN_60_CHARACTER);
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }

            locationRefRequiredValues.push(accountId, newLocationId, accountId, newLocationName, accountId, newLocationId, newLocationName);
            try {
                User.getUserMD(user.email, function (err, userResponse) {
                    var locationOptions = {
                        addressLine1: options.addressLine1 || userResponse.addressLine1,
                        addressLine2: options.addressLine2 || userResponse.addressLine2,
                        addressLine3: options.addressLine3 || userResponse.addressLine3,
                        city: options.city || userResponse.city,
                        zipCode: options.zipCode || userResponse.zipCode,
                        state: options.state || userResponse.state,
                        country: options.country || userResponse.country
                    };
                    CommonApi.validateLocRefOptionalFields(locationOptions, async function (err, response) {
                        if (err) {
                            debug('err', err);
                            await ErrorUtils.create(errorOptions, options, err);
                            return cb(err);
                        }
                        locationRefFields = response.locationRefFields;
                        locationRefOptionalValues = response.locationRefOptionalValues;

                        locationRefRequiredValues = _.concat(locationRefRequiredValues, locationRefOptionalValues);
                        locationRefRequiredValues.push(userId, locationCreatedAt, locationUpdatedAt);

                        try {
                            var locationReference = await conn.query('IF (select 1 from LocationReference where accountId=uuid_to_bin(?) and locationId=?) is not null then ' +
                              ' SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "LOCATION_EXIST_WITH_SAME_LOCATION_ID"; ' +
                              ' ELSEIF exists (select 1 from LocationReference where accountId=uuid_to_bin(?) and locationName=?) then ' +
                              ' SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4002,MESSAGE_TEXT = "LOCATION_EXIST_WITH_SAME_LOCATION_NAME"; ' +
                              ' ELSE insert into LocationReference set accountId=uuid_to_bin(?), locationId=?, locationName=?, ' + locationRefFields + ' createdBy=uuid_to_bin(?),' +
                              ' createdAt=?, updatedAt=?;END IF;', locationRefRequiredValues);

                            locationReference = Utils.isAffectedPool(locationReference);
                            if (!locationReference) {
                                await conn.query('rollback');
                                err = new Error(ErrorConfig.MESSAGE.DUPLICATE_LOCATION_CREATION);
                                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                                ErrorUtils.create(errorOptions, options, err);
                                return cb(err);
                            }
                        } catch (err) {
                            await conn.query('rollback;');
                            if (err.errno === 4001) {
                                err = new Error(ErrorConfig.MESSAGE.LOCATION_EXIST_WITH_SAME_LOCATION_ID);
                                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                            } else if (err.errno === 4002) {
                                err = new Error(ErrorConfig.MESSAGE.LOCATION_EXIST_WITH_SAME_LOCATION_NAME);
                                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                            } else {
                                err = new Error(ErrorConfig.MESSAGE.SAVE_MY_PROFILE_DETAIL_FAILED);
                                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                            }
                            ErrorUtils.create(errorOptions, options, err);
                            return cb(err);
                        }
                        var userOption = {
                            userId: userId,
                            firstName: options.firstName,
                            middleName: options.middleName,
                            lastName: options.lastName,
                            dateOfBirth: options.dateOfBirth,
                            phone: options.phone,
                            dialCode: dialCode,
                            phoneCountry: phoneCountry,
                            locationId: newLocationId,
                            addressLine1: '',
                            addressLine2: '',
                            addressLine3: '',
                            city: '',
                            state: '',
                            zipCode: 0,
                            country: '',
                            profilePicture: profilePicture,
                            updatedAt: updatedAt
                        };
                        User.updateUserDetailMD(userOption, errorOptions, async function (err, response) {
                            if (err) {
                                debug('err', err);
                                await conn.query('rollback;');
                                await ErrorUtils.create(errorOptions, options, err);
                                return cb(err);
                            }
                            await conn.query('commit;');
                            user.firstName = response.firstName;
                            user.lastName = response.lastName;
                            user.addressLine1 = response.addressLine1;
                            user.addressLine2 = response.addressLine2;
                            user.addressLine3 = response.addressLine3;
                            user.city = response.city;
                            user.state = response.state;
                            user.zipCode = response.zipCode;
                            user.country = response.country;
                            user.updatedAt = response.updatedAt;
                            return cb(null, user);
                        });
                    });
                });
            } catch (err) {
                await conn.query('rollback;');
                err = new Error(ErrorConfig.MESSAGE.SAVE_MY_PROFILE_DETAIL_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
        } else {
            var userOption = {};
            if (locationId) {
                userOption = {
                    userId: userId,
                    firstName: options.firstName,
                    middleName: options.middleName,
                    lastName: options.lastName,
                    dateOfBirth: options.dateOfBirth,
                    phone: options.phone,
                    dialCode: dialCode,
                    phoneCountry: phoneCountry,
                    locationId: locationId,
                    addressLine1: '',
                    addressLine2: '',
                    addressLine3: '',
                    city: '',
                    state: '',
                    zipCode: 0,
                    country: '',
                    profilePicture: profilePicture,
                    updatedAt: updatedAt
                };
            } else {
                options.userId = userId;
                options.locationId = '';
                userOption = options;
            }
            User.updateUserDetailMD(userOption, errorOptions, async function (err, response) {
                if (err) {
                    await conn.query('rollback;');
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
                await conn.query('commit;');
                user.firstName = response.firstName;
                user.lastName = response.lastName;
                user.addressLine1 = response.addressLine1;
                user.addressLine2 = response.addressLine2;
                user.addressLine3 = response.addressLine3;
                user.city = response.city;
                user.state = response.state;
                user.zipCode = response.zipCode;
                user.country = response.country;
                user.updatedAt = response.updatedAt;
                return cb(null, user);
            });
        }
    },

    getMyProfileDetailMD: async function (options, auditOptions, errorOptions, cb) {
        var err;
        var user = options.user;
        var userId = user.id;
        var accountId = user.accountId;
        var {execSync} = require('child_process')

        /*var databaseName = 'test_DB';
        var fileNamesWithoutPath = ['1559804213523_schemaOnly.sql', 'dbscript_function.sql', '1559804213523_referenceTableWithData.sql',
            '1559804213523_referenceTableWithConditionalData.sql', '1559804213523_sampleUsers.sql'];
        var path = require('path')
        var databaseScriptFile = path.resolve(__dirname, '../config/dB_Import_Script.sh')*/

        try {
            /*file.b = 'nitin 123456';
            debug('file after', file.b);*/

            /*debug('databaseScriptFile', databaseScriptFile)

            var commandString = '/bin/bash ' + databaseScriptFile + ' ' + databaseName + ' ';
            _.map(fileNamesWithoutPath, function (fileName) {
                commandString += fileName + ' '
            });
            debug('commandString', commandString);
            var response = execSync(commandString);
            debug('response', response)*/


            var conn = await connection.getConnection();

            var userData = await conn.query('select firstName, lastName, dateOfBirth, email, dialCode,phone,phoneCountry, addressLine1, ' +
              'addressLine2, addressLine3, city, zipCode, state, country, secondaryMobile, secondaryMobileCountry, ' +
              ' secondaryMobilePhoneEndingWith, primaryMobile, primaryMobileCountry,locationId, ' +
              'primaryMobilePhoneEndingWith,advancedAuthNumber,colorCode,updatedAt,profilePicture from users where id=uuid_to_bin(?)', userId);
            userData = Utils.filteredResponsePool(userData);

            if (!userData) {
                debug(err || 'Failed to fetch user having id: ' + err);
                err = new Error(ErrorConfig.MESSAGE.USER_VERIFICATION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }

            var warningFlag = await conn.query('SELECT flag FROM userPreferences WHERE userId  = uuid_to_bin(?) AND TYPE = 6', user.id);
            warningFlag = Utils.filteredResponsePool(warningFlag);
            if (warningFlag) {
                userData.warningFlag = JSON.parse(warningFlag.flag);
            }
            debug('warningFlag', user.warningFlag);

            userData.profilePicture = userData.profilePicture.toString();
            AuditUtils.create(auditOptions);
            if (userData.locationId) {
                var locationReferenceData = await conn.query('select locationId, locationName, addressLine1, ' +
                  'addressLine2, addressLine3, city, zipCode, state, country from LocationReference where accountId=uuid_to_bin(?) and locationId=?', [accountId, userData.locationId]);
                locationReferenceData = Utils.filteredResponsePool(locationReferenceData);
                if (!locationReferenceData) {
                    debug('err', err);
                    return cb(null, userData);
                }
                var profile = Object.assign(userData, locationReferenceData);
                return cb(null, profile);
            }
            return cb(null, userData);
        } catch (err) {
            debug('err ', err);
            err = new Error(ErrorConfig.MESSAGE.USER_RECORD_NOT_FOUND);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    reInviteMD: async function (options, auditOptions, errorOptions, cb) {
        var userId = options.userId;
        var user = options.user;
        var userExist = options.userExist;
        var updatedAt = options.updatedAt;
        var languageCultureCode = userExist.languageCultureCode;
        var err;
        var email = userExist.email;
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();
        // var userId = userExist.id;

        if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_MUST_BE_NUMBER);
        } else if (updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_IS_INVALID);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        if (userExist.authorizeUserStatus === Constants.AUTHORIZE_USER_STATUS.DECLINED || userExist.authorizeUserStatus === Constants.AUTHORIZE_USER_STATUS.CANCELED || userExist.authorizeUserStatus === Constants.AUTHORIZE_USER_STATUS.OPEN) {
            try {
                var conn = await connection.getConnection();
                var userUpdated = await conn.query('IF (select 1 from users where id=uuid_to_bin(?)) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "USER_NOT_FOUND", MYSQL_ERRNO = 4001;' +
                  'ELSEIF (select 1 from users where id = uuid_to_bin(?) and updatedAt = ?) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "USER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
                  'ELSE update users set status = ? , authorizeUserStatus = ? , flag = ? , authorizeUserInvitationDate = utc_timestamp(3),' +
                  ' updatedBy = uuid_to_bin(?) , updatedAt = ? where id = uuid_to_bin(?);END IF;',
                  [userId, userId, updatedAt, Constants.USER_STATUS.TEMPORARY, Constants.AUTHORIZE_USER_STATUS.OPEN, Constants.USER_FLAG.AUTHORIZED_USER_INVITATION, user.id, newUpdatedAt, userId]);

                userUpdated = Utils.isAffectedPool(userUpdated);
                if (!userUpdated) {
                    err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }
                var opt = {
                    languageCultureCode: languageCultureCode,
                    template: Constants.EMAIL_TEMPLATES.AUTHORIZED_USER_INVITE,
                    email: email
                };
                var compileOptions = {
                    name: userExist.firstName,
                    friend: user.email,
                    scopehub_register: Endpoints.SCOPEHUB_REGISTRATION_URL,
                    scopehub_decline: Constants.SCOPEHUB_DECLINE_INVITATION_PAGE_URL + 'authUserEmail=' + email + '&userEmail=' + user.email
                    //scopehub_decline: Constants.SCOPEHUB_DECLINE_INVITATION_PAGE_URL + email
                };

                debug('compileOptions', compileOptions);
                debug('opt', opt);
                EmailUtils.sendEmailMD(opt, compileOptions, async function (err) {
                    if (err) {
                        debug('err', err);
                        await ErrorUtils.create(errorOptions, options, err);
                        return cb(err);
                    }
                    AuditUtils.create(auditOptions);
                    return cb(null, {
                        OK: Constants.SUCCESS_MESSAGE.AUTHORIZE_USER_RE_INVITE_SUCCESS,
                        authorizeUserStatus: Constants.AUTHORIZE_USER_STATUS.OPEN,
                        updatedAt: newUpdatedAt
                    });
                });
            } catch (err) {
                debug('err ', err);
                await ErrorUtils.create(errorOptions, options, err);
                if (err.errno === 4001) {
                    err = new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return cb(err);
                } else if (err.errno === 4002) {
                    err = new Error(ErrorConfig.MESSAGE.USER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    return cb(err);
                } else {
                    err = new Error(ErrorConfig.MESSAGE.AUTHORIZE_USER_RE_SEND_INVITATION_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return cb(err);
                }
            }
        } else {
            err = new Error(ErrorConfig.MESSAGE.STATUS_OF_THE_AUTHORIZED_USER_RECORD_CHANGED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    updateRolesMD: async function (options, errorOptions, cb) {
        var user = options.user;
        var authUserId = options.id;
        var oldRoles = options.oldRoles;
        var addRoles = options.addRoles;
        var removeRoles = options.removeRoles;
        var authUser = options.authUser;
        var err;

        if (!authUser) {
            return cb();
        }
        var conn = await connection.getConnection();
        try {
            if (addRoles && addRoles.length > 0) {
                await Promise.each(addRoles, async function (value) {
                    var generateIdForRoles = Utils.generateId();
                    var userRole = await conn.query('if (select 1 from user_roles where userId=uuid_to_bin(?) and roleId=uuid_to_bin(?)) is null then ' +
                      'insert into user_roles (id, roleId, userId, createdAt, updatedAt, createdBy)' +
                      ' values(uuid_to_bin(?),uuid_to_bin(?),uuid_to_bin(?),utc_timestamp(3),utc_timestamp(3),uuid_to_bin(?));end if;',
                      [authUserId, value, generateIdForRoles.uuid, value, authUserId, user.id]);
                    userRole = Utils.isAffectedPool(userRole);
                    if (!userRole) {
                        err = new Error(ErrorConfig.MESSAGE.DUPLICATE_ROLE);
                        err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                        await ErrorUtils.create(errorOptions, options, err);
                        return cb(err);
                    }
                });
            }
            if (addRoles && removeRoles.length > 0) {
                await Promise.each(removeRoles, async function (value) {
                    var userRoleDeleted = await conn.query('if (select 1 from user_roles where userId=uuid_to_bin(?) and roleId=uuid_to_bin(?)) is not null then ' +
                      'delete from user_roles where userId=uuid_to_bin(?) and roleId=uuid_to_bin(?);end if;', [authUserId, value, authUserId, value]);
                    userRoleDeleted = Utils.isAffectedPool(userRoleDeleted);
                    if (!userRoleDeleted) {
                        err = new Error(ErrorConfig.MESSAGE.DELETE_ROLE_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                        throw err;
                    }
                });
            }
            await conn.query('commit;');
            return cb(null, authUser);
        } catch (err) {
            await conn.query('rollback;');
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.AUTHORIZE_USER_UPDATION_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    updateAuthUserDetailMD: function (options, errorOptions, cb) {
        var updatedAt = options.updatedAt;
        var authUserId = options.id;
        var user = options.user;
        var profileFields = '';
        var profileRequiredValues = [];
        var profileOptionalValues = [];
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();

        //updatedAt = new Date(updatedAt);
        profileRequiredValues.push(authUserId, authUserId, updatedAt);
        User.validateOptionalFields(options, async function (err, response) {
            if (err) {
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            profileFields = response.profileFields;
            profileOptionalValues = response.profileOptionalValues;

            profileRequiredValues = _.concat(profileRequiredValues, profileOptionalValues);
            profileRequiredValues.push(newUpdatedAt, user.id, authUserId);

            try {
                var conn = await connection.getConnection();
                var userUpdated = await conn.query('IF (select 1 from users where id=uuid_to_bin(?)) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "USER_NOT_FOUND", MYSQL_ERRNO = 4001;' +
                  'ELSEIF (select 1 from users where id=uuid_to_bin(?) and updatedAt=?) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "USER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
                  'ELSE update users set ' + profileFields + ' updatedAt = ?,updatedBy=uuid_to_bin(?)' +
                  ' where id = uuid_to_bin(?);END IF;', profileRequiredValues);

                userUpdated = Utils.isAffectedPool(userUpdated);

                if (!userUpdated) {
                    err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }

                return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.AUTHORIZE_USER_UPDATE_SUCCESS,
                    updatedAt: newUpdatedAt
                });

            } catch (err) {
                debug('err', err);
                await ErrorUtils.create(errorOptions, options, err);
                if (err.errno === 4001) {
                    err = new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return cb(err);
                } else if (err.errno === 4002) {
                    err = new Error(ErrorConfig.MESSAGE.USER_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    return cb(err);
                } else {
                    err = new Error(ErrorConfig.MESSAGE.AUTHORIZE_USER_UPDATION_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return cb(err);
                }
            }
        });
    },

    updateAuthorizedUserMD: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var authUserId = options.id;
        var updatedAt = options.updatedAt;
        var email = options.email;
        var roles = options.roles;
        var phone = options.phone;
        var dialCode = options.dialCode;
        var phoneCountry = options.phoneCountry;
        var primaryMobile = options.primaryMobile;
        var primaryMobileDialCode = options.primaryMobileDialCode;
        var primaryMobileCountry = options.primaryMobileCountry;
        var secondaryMobile = options.secondaryMobile;
        var secondaryMobileDialCode = options.secondaryMobileDialCode;
        var secondaryMobileCountry = options.secondaryMobileCountry;
        var err;

        if (DataUtils.isDefined(roles)) {
            err = new Error(ErrorConfig.MESSAGE.INVALID_REQUEST);
        } else if (DataUtils.isUndefined(authUserId)) {
            err = new Error(ErrorConfig.MESSAGE.USER_ID_REQUIRED);
        } else if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_MUST_BE_NUMBER);
        } else if (updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.UPDATED_AT_IS_INVALID);
        } else if (DataUtils.isDefined(email)) {
            err = new Error(ErrorConfig.MESSAGE.CAN_NOT_UPDATE_EMAIL);
        }
        if (err) {
            debug('err', err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
        if (DataUtils.isDefined(phone) || DataUtils.isDefined(dialCode) || DataUtils.isDefined(phoneCountry)) {
            if (DataUtils.isUndefined(phone)) {
                err = new Error(ErrorConfig.MESSAGE.PHONE_NUMBER_REQUIRED);
            } else if (DataUtils.isUndefined(dialCode)) {
                err = new Error(ErrorConfig.MESSAGE.DIAL_CODE_REQUIRED);
            } else if (DataUtils.isUndefined(phoneCountry)) {
                err = new Error(ErrorConfig.MESSAGE.PHONE_COUNTRY_REQUIRED);
            }
            if (err) {
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            //options.phone = dialCode + '' + phone;
        }
        if (DataUtils.isDefined(primaryMobile) || DataUtils.isDefined(primaryMobileDialCode) || DataUtils.isDefined(primaryMobileCountry)) {
            if (DataUtils.isUndefined(primaryMobile)) {
                err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_REQUIRED);
            } else if (DataUtils.isUndefined(primaryMobileDialCode)) {
                err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_DIAL_CODE_REQUIRED);
            } else if (DataUtils.isUndefined(primaryMobileCountry)) {
                err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_COUNTRY_REQUIRED);
            }
            if (err) {
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            //options.primaryMobile = primaryMobileDialCode + '' + primaryMobile;
        }
        if (DataUtils.isDefined(secondaryMobile) || DataUtils.isDefined(secondaryMobileDialCode) || DataUtils.isDefined(secondaryMobileCountry)) {
            if (DataUtils.isUndefined(secondaryMobile)) {
                err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_REQUIRED);
            } else if (DataUtils.isUndefined(secondaryMobileDialCode)) {
                err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_DIAL_CODE_REQUIRED);
            } else if (DataUtils.isUndefined(secondaryMobileCountry)) {
                err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_COUNTRY_REQUIRED);
            }
            if (err) {
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            //options.secondaryMobile = secondaryMobileDialCode + '' + secondaryMobile;
        }

        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
        try {
            await conn.query('START TRANSACTION;');
            User.updateAuthUserDetailMD(options, errorOptions, async function (err, response) {
                if (err) {
                    debug('err', err);
                    await conn.query('rollback;');
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
                await conn.query('commit;');
                return cb(null, response);
            });
        } catch (err) {
            debug('err', err);
            await conn.query('rollback;');
            return cb(err);
        }
    },

    getUserByEmailId: async function (options, cb) {
        var email = options.email;
        debug('email', email);
        var err;

        if (DataUtils.isUndefined(email)) {
            err = new Error(ErrorConfig.MESSAGE.EMAIL_REQUIRED);
        } else if (!DataUtils.isValidEmail(email)) {
            err = new Error(ErrorConfig.MESSAGE.EMAIL_INVALID);
        }
        if (err) {
            debug('err', err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
        try {
            var conn = await connection.getConnection();
            var user = await conn.query('select *,CAST(uuid_from_bin(id) as CHAR) as id,CAST(uuid_from_bin(accountId) as CHAR) as accountId' +
              ' from users where email=?', email);
            user = Utils.filteredResponsePool(user);
            if (!user) {
                err = new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            return cb(null, user);
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

    },
    updateEncryptionKeys: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var userId = user.id;
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();
        var err;

        if (DataUtils.isUndefined(options.addKeys)) {
            err = new Error(ErrorConfig.MESSAGE.ADD_KEY_FLAG_REQUIRED);
        } else if (!DataUtils.isBoolean(options.addKeys)) {
            err = new Error(ErrorConfig.MESSAGE.ADD_KEY_FLAG_MUST_BE_BOOLEAN);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
        var userRequiredValues = [userId, options.addKeys];
        if (options.addKeys) {
            if (DataUtils.isUndefined(options.publicKey)) {
                err = new Error(ErrorConfig.MESSAGE.PUBLIC_KEY_REQUIRED);
            } else if (DataUtils.isUndefined(options.privateKey)) {
                err = new Error(ErrorConfig.MESSAGE.PRIVATE_KEY_REQUIRED);
            } else if (DataUtils.isUndefined(options.encryptedPassword)) {
                err = new Error(ErrorConfig.MESSAGE.ENCRYPTED_PASSWORD_REQ);
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            userRequiredValues.push(options.publicKey, options.privateKey, options.encryptedPassword);
        } else {
            userRequiredValues.push('', '', '');
        }
        userRequiredValues.push(newUpdatedAt, userId, userId);
        try {
            var conn = await connection.getConnection();

            var updateKeys = await conn.query('IF (SELECT 1 from users where id = uuid_to_bin(?)) is null then ' +
              'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "USER_NOT_FOUND", MYSQL_ERRNO = 4001;' +
              'ELSE update users set encryptionStatus=?,chatPublicKey=? ,chatPrivateKey=?, encryptedPassword=?, updatedAt = ?,' +
              'updatedBy=uuid_to_bin(?) where id = uuid_to_bin(?);END IF', userRequiredValues);

            updateKeys = Utils.isAffectedPool(updateKeys);
            if (!updateKeys) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            var userResponse = {
                OK: Constants.SUCCESS
            };
            AuditUtils.create(auditOptions);
            return cb(null, userResponse);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.USER_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            } else {
                err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                Util.log(err);
                return cb(err);
            }
        }
    },

    checkArchive: async function (options, errorOptions, cb) {
        var accountId = options.user.accountId;
        var type = options.type;
        var err;
        var query = '';
        var values = [accountId];
        if (DataUtils.isUndefined(type)) {
            err = new Error(ErrorConfig.MESSAGE.TYPE_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
        try {
            var conn = await connection.getConnection();

            if (type === Constants.ARCHIVE_TYPES.PRODUCT_INVENTORY) {
                query += 'SELECT  count(1) as count FROM ProductInventory WHERE accountId = uuid_to_Bin(?) AND STATUS = 0';
            } else if (type === Constants.ARCHIVE_TYPES.SUPPLY_INVENTORY) {
                query += 'SELECT  count(1) as count FROM SupplyInventory WHERE accountId = uuid_to_Bin(?) AND STATUS = 0';
            } else if (type === Constants.ARCHIVE_TYPES.SUPPLY_ITEM) {
                query += 'SELECT  count(1) as count FROM SupplyItems WHERE accountId = uuid_to_Bin(?) AND STATUS = 0';
            } else if (type === Constants.ARCHIVE_TYPES.PRODUCT_ORDER) {
                query += 'SELECT  count(1) as count FROM OrderReferenceInformation WHERE accountId = uuid_to_Bin(?) AND STATUS = 0';
            } else if (type === Constants.ARCHIVE_TYPES.CUSTOMERS) {
                query += 'SELECT  count(1) as count FROM Customers WHERE accountId = uuid_to_Bin(?) AND isActive = 0';
            } else if (type === Constants.ARCHIVE_TYPES.SUPPLIER) {
                query += 'SELECT  count(1) as count FROM Supplier WHERE accountId = uuid_to_Bin(?) AND isActive = 0';
            }


            var archiveCheck = await conn.query(query, values);
            archiveCheck = Utils.filteredResponsePool(archiveCheck);
            debug('archiveCheck', archiveCheck);

            return cb(null, archiveCheck || []);
        } catch (err) {
            debug('err', err);
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            err = new Error(ErrorConfig.MESSAGE.CHECK_ARCHIVED_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    sendCodeViaMail: async function (options, cb) {
        var email = options.email;
        var languageCultureCode = options.languageCultureCode;
        var err;

        try {
            if (DataUtils.isUndefined(email)) {
                err = new Error(ErrorConfig.MESSAGE.EMAIL_REQUIRED);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            var code = RandomSeed.intBetween(Constants.RANDOM_LOW_LIMIT, Constants.RANDOM_HIGH_LIMIT);
            code = String(code);
            var hashedCode = DataUtils.getSha384(code).toString();

            var opt = {
                languageCultureCode: 'en-US',
                template: Constants.EMAIL_TEMPLATES.VERIFY_EMAIL,
                email: email
            };

            var compileOptions = {
                name: '',
                verification_code: code
            };

            var response = await EmailUtils.sendEmailPromise(opt, compileOptions);
            debug('response', response);
            return cb(null, {
                hashedCode: hashedCode,
                OK: Constants.SUCCESS_MESSAGE.VERIFY_EMAIL_SUCCESS
            });
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.VERIFY_EMAIL_CONFIRM_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    confirmCode: async function (options, cb) {
        var actualCode = options.actualCode;
        var code = options.code;
        var codeSendTime = options.codeSendTime;
        var currentTime = DataUtils.getEpochMSTimestamp();
        var err;

        try {
            codeSendTime = codeSendTime + (Constants.CODE_EXPIRE_LIMIT * 60000);
            if (DataUtils.isUndefined(code)) {
                err = new Error(ErrorConfig.MESSAGE.VERIFICATION_CODE_REQUIRED);
            } else if (currentTime > codeSendTime) {
                err = new Error(ErrorConfig.MESSAGE.CODE_EXPIRES_DUE_TO_TIME_LIMIT);
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }

            try {
                code = DataUtils.getSha384(code).toString();
            } catch (e) {
                code = null;
            }

            debug('actualCode', actualCode);
            debug('code', code);
            if (actualCode !== code) {
                err = new Error(ErrorConfig.MESSAGE.VERIFICATION_CODE_INVALID);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }

            return cb(null, {
                OK: Constants.SUCCESS_MESSAGE.CONFIRM_EMAIL_SUCCESS
            });
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.VERIFY_EMAIL_CONFIRM_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    }
};

module.exports = User;

(function () {
    if (require.main == module) {

    }
}());
