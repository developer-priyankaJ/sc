/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.api.account');
var Util = require('util');
var Async = require('async');
var _ = require('lodash');
var moment = require('moment');
var ursa = require('ursa');

var AccountModel = require('../model/account');
var UserModel = require('../model/user');
var UserApi = require('../api/user');
var Constants = require('../data/constants');
var AuditUtils = require('../lib/audit_utils');
var EmailUtils = require('../lib/email_utils');
var DataUtils = require('../lib/data_utils');
var ErrorUtils = require('../lib/error_utils');
var S3Utils = require('../lib/s3_utils');
var ErrorConfig = require('../data/error');
var MarketplaceApi = require('./marketplace');
var pool = require('../lib/maria_util');
var connection = require('../lib/connection_util');

//MD
var CommonApi = require('./common');
var PlanApi = require('./plan');
var knex = require('../lib/knex_util');
var Utils = require('../lib/utils');

var noop = function () {
}; // do nothing.

function filterAccountUser(user) {
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
        'postRegComplete',
        'accountRoles',
        'accountPermissions'
    ];

    var clonedUser = {};
    fields.forEach(function (field) {
        if (user[field] !== null) {
            clonedUser[field] = user[field];
        }
    });

    if (user.phone) {
        clonedUser.phoneEndingWith = user.phone.substr(user.phone.length - 5);
    }
    return clonedUser;
}

var Account = {

    createS3AccountMD: async function (options, cb) {
        var user = options.user;
        var accountId = user.accountId;
        var account = user.account;
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var err, conn;

        if (account.fileUploadPublicKey === '' || account.fileUploadPrivateKey === '') {
            var keys = await Account.createKeys();
            try {
                conn = await connection.getConnection();
                var accountUpdated = await conn.query('update accounts set fileUploadPublicKey=?,fileUploadPrivateKey=?,' +
                  'updatedAt=? where id = uuid_to_bin(?)', [keys.publicKey, keys.privateKey, updatedAt, accountId]);
                accountUpdated = Utils.isAffectedPool(accountUpdated);
                if (!accountUpdated) {
                    throw err;
                }
                account.fileUploadPublicKey = keys.publicKey;
                account.fileUploadPrivateKey = keys.privateKey;
                user.account = account;
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
        }
        if (account.s3StorageAddress === '') {

            S3Utils.putObject('', accountId + '/', '', '', Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET, '', async function (err, data) {
                if (err) {
                    debug('err', err);
                    return cb(err);
                }
                _.each(Constants.S3_FOLDER, function (value, key) {
                    S3Utils.putObject('', value + '/', '', '', Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET + '/' + accountId, '', async function (err, data) {
                        if (err) {
                            debug('err', err);
                            return cb(err);
                        }
                    });
                });
            });
            var response = {
                successUploadedFileUrl: 'https://s3.console.aws.amazon.com/s3/object/' + Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET + '/' + accountId
            };
            try {
                conn = await connection.getConnection();
                accountUpdated = await conn.query('update accounts set s3StorageAddress=?,updatedAt=? where id = uuid_to_bin(?)', [response.successUploadedFileUrl, updatedAt, accountId]);
                accountUpdated = Utils.isAffectedPool(accountUpdated);
                if (!accountUpdated) {
                    throw err;
                }
                account.s3StorageAddress = response.successUploadedFileUrl;
                user.account = account;
                return cb(null, user);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return cb(err);
            }
        } else {
            return cb(null, user);
        }
    },

    /*
      * Create public and private keys for file upload
      * */
    createKeys: function () {
        return new Promise(async function (resolve, reject) {

            try {
                var key = ursa.generatePrivateKey(2048, 65537);

                var privateKey = key.toPrivatePem();
                var publicKey = key.toPublicPem();

                return resolve({
                    privateKey: privateKey.toString(),
                    publicKey: publicKey.toString()
                });
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    createAccountMD: async function (options, errorOptions, cb) {
        var generatedId = Utils.generateId();
        var id = generatedId.uuid;
        var user = options.user;
        var planType = options.planType;
        var languageCultureCode = options.languageCultureCode;
        var accountName = options.accountName;
        var err;
        var status = Constants.ACCOUNT_STATUS.ACTIVE;
        var createdAt = DataUtils.getEpochMSTimestamp();
        var updatedAt = DataUtils.getEpochMSTimestamp();

        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        try {
            // Get keys
            var keys = await Account.createKeys();
            debug('keys', keys);

            var account = await conn.query('insert into accounts (id,languageCultureCode,status,fileUploadPublicKey,fileUploadPrivateKey,' +
              'accountName,createdAt,createdBy,updatedAt) values (uuid_to_bin(?),?,?,?,?,?,?,uuid_to_bin(?),?)',
              [id, languageCultureCode, status, keys.publicKey, keys.privateKey, accountName, createdAt, user.id, updatedAt]);
            var isAccountAffected = Utils.isAffectedPool(account);
            if (!isAccountAffected) {
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_CREATION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }

            // Create default plan and billing cycle
            var currentTime = DataUtils.getEpochMSTimestamp();
            var billingCycleOption = {
                accountId: id,
                planType: planType || Constants.SUB_SCRIPTION_PLANS.FREE_MONTHLY,
                actionDate: currentTime,
                billingCycleStartDate: currentTime,
                effectiveFromDate: currentTime,
                actionType: Constants.ACTION_TYPE.SIGNUP,
                userId: user.id
            };
            debug('billingCycleOption', billingCycleOption);
            var billingCycleResponse = await PlanApi.createBillingCycle(billingCycleOption);
            debug('billingCycleResponse', billingCycleResponse);

            account = {};
            account.id = id;
            return cb(null, account);
        } catch (err) {
            await conn.query('rollback;');
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.USER_SIGNUP_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    getAccount: function (options, cb) {
        var accountId = options.accountId;
        if (!accountId) {
            var err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
            return cb(err);
        }
        AccountModel.get(accountId, {
            ConsistentRead: true
        }, function (err, data) {
            var account = data && data.attrs;
            return cb(err, account);
        });
    },

    getAccountByAuthTokenMD: async function (options, cb) {

        var authToken = options.authToken;
        if (!authToken) {
            var err = new Error(ErrorConfig.MESSAGE.ACCOUNT_AUTH_TOKEN_NOT_FOUND);
            err.status = ErrorConfig.STATUS_CODE.UNAUTHORIZED;
            return cb(err);
        }
        try {
            var conn = await connection.getConnection();
            var account = await conn.query('select uuid_from_bin(id) as id,companyName,' +
              'phone1,phone2,phone3,fax1,fax2,fax3,email,active,apiGetewayAuthToken,statusReasonCode,' +
              'updatedAt,status from accounts where apiGetewayAuthToken = ?', authToken);
            account = Utils.filteredResponsePool(account);
            return cb(null, account);
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
    },

    // Delete Account
    deleteAccountMD: async function (options, errorOptions, cb) {
        var user = options.user;
        var accountId = user.accountId;
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var err;

        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        try {
            if (user.accountOwnerRolesId) {
                var updatedAccount = await conn.query('update accounts set status=?,statusReasonCode=?,updatedAt=?,' +
                  'updatedBy=uuid_to_bin(?) where id=uuid_to_bin(?)',
                  [Constants.USER_STATUS.CLOSED, Constants.USER_INACTIVE_REASON_CODES.USER_CANCELLATION.CODE, updatedAt, user.id, accountId]);

                updatedAccount = Utils.isAffectedPool(updatedAccount);
                if (!updatedAccount) {
                    err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }
                await conn.query('commit');
                return cb(null, updatedAccount);
            }
            await conn.query('commit');
            return cb(null, user);
        } catch (err) {
            debug('err', err);
            await conn.query('rollback');
            await ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.USER_SIGNUP_CANCEL_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    // Implement Invite System first
    inviteUser: function (options, auditOptions, cb) {
        var user = options.user;
        var email = options.email;
        var name = options.name;
        var message = options.message;

        var err;
        if (DataUtils.isInvalidEmail(name)) {
            err = new Error(ErrorConfig.MESSAGE.FIRST_NAME_REQ);
        }
        if (!err && DataUtils.isInvalidEmail(email)) {
            err = new Error(ErrorConfig.MESSAGE.EMAIL_INVALID);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        UserApi.getUserByEmail(email, function (err, invitedUser) {
            if (err) {
                return cb(err);
            }
            if (invitedUser) {
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_USER_EXISTS);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                return cb(err);
            }
            var userOptions = {
                email: email,
                firstName: contactName,
                lastName: Constants.REFERRAL_LAST_NAME,
                isReferral: true,
                status: Constants.REFERRAL_STATUS,
                statusReasonCode: Constants.USER_INACTIVE_REASON_CODES.IS_REFERRAL_USER.CODE,
                accountId: user.accountId,
                isAccountActive: false,
                isAccountEnabled: false,
                accountRoles: [Constants.ACCOUNT_ROLES.EMPLOYEE]
            };
            UserModel.create(userOptions, function (err, invitedUser) {
                if (err || !invitedUser) {
                    err = err || new Error(ErrorConfig.MESSAGE.REFERRAL_USER_CREATION_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                    Util.log(err);
                    return cb(err);
                }

                var languageCultureCode = user.languageCultureCode;
                var language = languageCultureCode && languageCultureCode.substr(0, 2);
                var opt = {
                    languageCultureCode: languageCultureCode,
                    template: Constants.EMAIL_TEMPLATES.ACCOUNT_INVITE_USER,
                    email: email
                };

                var compileOptions = {
                    name: name,
                    friend: email,
                    message: message
                };

                auditOptions.metaData = {
                    user_invited_uuid: invitedUser.id
                };
                AuditUtils.create(auditOptions);
                EmailUtils.sendEmail(opt, compileOptions, function (err) {
                    if (err) {
                        return cb(err);
                    }
                    return cb();
                });
            });
        });
    },

    getUsers: function (options, cb) {
        var user = options.user;
        var accountId = user.accountId;
        UserModel.query(accountId)
          .usingIndex(Constants.USER_ACCOUNT_INDEX)
          .exec(function (err, data) {
              var users = data && data.Items;
              var userList = [];
              users.forEach(function (user) {
                  user = filterAccountUser(user.attrs);
                  userList.push(user);
              });
              return cb(err, userList);
          });
    },

    // Convert Single-User to Multi-User Account
    upgradeAccount: function (options, cb) {
        var user = options.user;
        var accountId = user.accountId;

        var opt = {
            accountId: accountId
        };
        Account.getAccount(opt, function (err, account) {
            if (err) {
                return cb(err);
            }
            var isMultiUser = account.isMultiUser;
            if (isMultiUser) {
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ALREADY_UPGRADED);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                return cb(err);
            }
            var accountOptions = {
                id: account.id,
                isMultiUser: true
            };
            AccountModel.update(accountOptions, function (err, account) {
                if (err || !account) {
                    err = err || new Error(ErrorConfig.MESSAGE.ACCOUNT_UPGRADE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                    Util.log(err);
                    return cb(err);
                }
                account = account.attrs;
                return cb(null, account);
            });
        });
    },

    downgradeAccount: function (options, cb) {
        var user = options.user;
        var accountId = user.accountId;

        var opt = {
            accountId: accountId
        };
        Account.getAccount(opt, function (err, account) {
            if (err) {
                return cb(err);
            }
            var isMultiUser = account.isMultiUser;
            if (!isMultiUser) {
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ALREADY_SINGLE_USER);
                err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                return cb(err);
            }
            var accountOptions = {
                id: account.id,
                isMultiUser: false
            };
            AccountModel.update(accountOptions, function (err, account) {
                if (err || !account) {
                    err = err || new Error(ErrorConfig.MESSAGE.ACCOUNT_UPGRADE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                    Util.log(err);
                    return cb(err);
                }
                UserModel.query(accountId)
                  .usingIndex(Constants.USER_ACCOUNT_INDEX)
                  .exec(function (err, data) {
                      if (err) {
                          return cb(err);
                      }
                      var users = data && data.Items || [];
                      Async.eachLimit(users, 5, function (user, callback) {
                          user = user.attrs;

                          var userOptions = {
                              id: user.id,
                              isAccountEnabled: false
                          };
                          UserModel.update(userOptions, {
                              ReturnValues: 'ALL_NEW'
                          }, function (err, user) {
                              if (err || !user) {
                                  err = err || new Error(ErrorConfig.MESSAGE.ACCOUNT_DOWNGRADE_FAILED);
                                  Util.log(err);
                                  return callback(err);
                              }
                              return callback();
                          });
                      }, function (err) {
                          if (err) {
                              return cb(err);
                          }
                          account = account.attrs;
                          return cb(null, account);
                      });
                  });
            });
        });
    },

    getAccountMD: async function (options, errorOptions, cb) {
        var accountId = options.accountId;
        if (!accountId) {
            var err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();

            var account = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id,publicKey,privateKey,encryptionStatus,accountName,accountDescription,' +
              'companyName,locationId,phone,dialCode,phoneCountry,primaryMobile,primaryMobileDialCode,primaryMobileCountry,' +
              'secondaryMobile,secondaryMobileDialCode,secondaryMobileCountry,fax,email,updatedAt from accounts where id = uuid_to_bin(?);', accountId);
            account = Utils.filteredResponsePool(account);
            if (!account) {
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            var option = {
                accountId: accountId,
                locationId: account.locationId
            };

            if (account.locationId === '') {
                CommonApi.getDefaultLocationReference(option, async function (err, response) {
                    if (err) {
                        await ErrorUtils.create(errorOptions, options, err);
                        return cb(err);
                    }
                    var accountDetail = Object.assign(account, response);
                    return cb(null, accountDetail);
                });
            } else {
                CommonApi.getLocationReferenceById(option, async function (err, response) {
                    if (err) {
                        await ErrorUtils.create(errorOptions, options, err);
                        return cb(err);
                    }
                    var accountDetail = Object.assign(account, response);
                    return cb(null, accountDetail);
                });
            }
        } catch (err) {
            debug('err ', err);
            await ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_NOT_FOUND);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    validateOptionalFields: async function (options, cb) {
        var accountFields = '';
        var accountOptionalValues = [];
        var err;

        try {
            if (!DataUtils.isValidateOptionalField(options.companyName)) {
                if (!DataUtils.isString(options.companyName)) {
                    throw err = new Error(ErrorConfig.MESSAGE.COMPANY_NAME_MUST_BE_STRING);
                } else if (options.companyName.length > 120) {
                    throw err = new Error(ErrorConfig.MESSAGE.COMPANY_NAME_MUST_BE_LESS_THAN_120_CHARACTER);
                } else {
                    accountFields += 'companyName=? ,';
                    accountOptionalValues.push(options.companyName);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.email)) {
                if (!DataUtils.isValidEmail(options.email) && options.email !== '') {
                    throw err = new Error(ErrorConfig.MESSAGE.INVALID_EMAIL);
                } else if (options.email.length > 254) {
                    throw err = new Error(ErrorConfig.MESSAGE.EMAIL_MUST_BE_LESS_THAN_254_CHARACTER);
                } else {
                    accountFields += 'email=? ,';
                    accountOptionalValues.push(options.email);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.extension)) {
                if (!DataUtils.isMobile(options.extension)) {
                    throw err = new Error(ErrorConfig.MESSAGE.EXTENSION_MUST_BE_VALID_NUMBER);
                } else if (options.extension.toString().length > 10) {
                    throw err = new Error(ErrorConfig.MESSAGE.EXTENSION_MUST_BE_LESS_THAN_10_CHARACTER);
                } else {
                    accountFields += 'extension=? ,';
                    accountOptionalValues.push(options.extension);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.dialCode)) {
                if (!DataUtils.isString(options.dialCode)) {
                    throw err = new Error(ErrorConfig.MESSAGE.DIAL_CODE_MUST_BE_STRING);
                } else if (options.dialCode.toString().length > 5) {
                    throw err = new Error(ErrorConfig.MESSAGE.DIAL_CODE_MUST_BE_LESS_THAN_5_CHARACTER);
                } else {
                    accountFields += 'dialCode=? ,';
                    accountOptionalValues.push(options.dialCode);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.phoneCountry)) {
                if (!DataUtils.isString(options.phoneCountry)) {
                    throw err = new Error(ErrorConfig.MESSAGE.COUNTRY_MUST_BE_STRING);
                } else if (options.phoneCountry.toString().length > 2) {
                    throw err = new Error(ErrorConfig.MESSAGE.COUNTRY_MUST_BE_LESS_THAN_2_CHARACTER);
                } else {
                    accountFields += 'phoneCountry=? ,';
                    accountOptionalValues.push(options.phoneCountry);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.phone)) {
                if (!DataUtils.isMobile(options.phone)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PHONE_1_MUST_BE_VALID_NUMBER);
                } else if (options.phone.toString().length > 15) {
                    throw err = new Error(ErrorConfig.MESSAGE.PHONE_1_MUST_BE_LESS_THAN_15_CHARACTER);
                } else {
                    accountFields += 'phone=? ,';
                    accountOptionalValues.push(options.dialCode.concat(options.phone));
                }
            }

            if (!DataUtils.isValidateOptionalField(options.primaryMobileDialCode)) {
                if (!DataUtils.isString(options.primaryMobileDialCode)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_DIAL_CODE_MUST_BE_STRING);
                } else if (options.primaryMobileDialCode.toString().length > 5) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_DIAL_CODE_MUST_BE_LESS_THAN_5_CHARACTER);
                } else {
                    accountFields += 'primaryMobileDialCode=? ,';
                    accountOptionalValues.push(options.primaryMobileDialCode);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.primaryMobileCountry)) {
                if (!DataUtils.isString(options.primaryMobileCountry)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_COUNTRY_MUST_BE_STRING);
                } else if (options.primaryMobileCountry.toString().length > 2) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_COUNTRY_MUST_BE_LESS_THAN_2_CHARACTER);
                } else {
                    accountFields += 'primaryMobileCountry=? ,';
                    accountOptionalValues.push(options.primaryMobileCountry);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.primaryMobile)) {
                if (!DataUtils.isMobile(options.primaryMobile)) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_MUST_BE_VALID_NUMBER);
                } else if (options.primaryMobile.toString().length > 15) {
                    throw err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_MUST_BE_LESS_THAN_OF_15_DIGIT);
                } else {
                    accountFields += 'primaryMobile=? ,';
                    accountOptionalValues.push(options.primaryMobileDialCode.concat(options.primaryMobile));
                }
            }

            if (!DataUtils.isValidateOptionalField(options.secondaryMobileDialCode)) {
                if (!DataUtils.isString(options.secondaryMobileDialCode)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_DIAL_CODE_MUST_BE_STRING);
                } else if (options.secondaryMobileDialCode.toString().length > 5) {
                    throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_DIAL_CODE_MUST_BE_LESS_THAN_5_CHARACTER);
                } else {
                    accountFields += 'secondaryMobileDialCode=? ,';
                    accountOptionalValues.push(options.secondaryMobileDialCode);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.secondaryMobileCountry)) {
                if (!DataUtils.isString(options.secondaryMobileCountry)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_COUNTRY_MUST_BE_STRING);
                } else if (options.secondaryMobileCountry.toString().length > 2) {
                    throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_COUNTRY_MUST_BE_LESS_THAN_2_CHARACTER);
                } else {
                    accountFields += 'secondaryMobileCountry=? ,';
                    accountOptionalValues.push(options.secondaryMobileCountry);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.secondaryMobile)) {
                if (!DataUtils.isMobile(options.secondaryMobile)) {
                    throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_MUST_BE_NUMBER);
                } else if (options.secondaryMobile.toString().length > 15) {
                    throw err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_MUST_BE_LESS_THAN_OF_15_DIGIT);
                } else {
                    accountFields += 'secondaryMobile=? ,';
                    accountOptionalValues.push(options.secondaryMobileDialCode.concat(options.secondaryMobile));
                }
            }
            if (!DataUtils.isValidateOptionalField(options.fax)) {
                if (!DataUtils.isMobile(options.fax)) {
                    throw err = new Error(ErrorConfig.MESSAGE.FAX_1_MUST_BE_VALID_NUMBER);
                } else if (options.fax.toString().length > 15) {
                    throw err = new Error(ErrorConfig.MESSAGE.FAX_1_MUST_BE_LESS_THAN_15_CHARACTER);
                } else {
                    accountFields += 'fax=? ,';
                    accountOptionalValues.push(options.fax);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.locationId)) {
                if (!DataUtils.isString(options.locationId)) {
                    throw err = new Error(ErrorConfig.MESSAGE.LOCATION_ID_MUST_BE_STRING);
                } else if (options.locationId.length > 40) {
                    throw err = new Error(ErrorConfig.MESSAGE.LOCATION_ID_MUST_BE_LESS_THAN_40_CHARACTER);
                } else {
                    accountFields += 'locationId=? ,';
                    accountOptionalValues.push(options.locationId);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.accountName)) {
                if (!DataUtils.isString(options.accountName)) {
                    throw err = new Error(ErrorConfig.MESSAGE.ACCOUNT_NAME_MUST_BE_STRING);
                } else if (options.accountName.length > 120) {
                    throw err = new Error(ErrorConfig.MESSAGE.ACCOUNT_NAME_MUST_BE_LESS_THAN_60_CHARACTER);
                } else {
                    accountFields += 'accountName=? ,';
                    accountOptionalValues.push(options.accountName);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.accountDescription)) {
                if (!DataUtils.isString(options.accountDescription)) {
                    throw err = new Error(ErrorConfig.MESSAGE.ACCOUNT_DESCRIPTION_MUST_BE_STRING);
                } else {
                    accountFields += 'accountDescription=? ,';
                    accountOptionalValues.push(options.accountDescription);
                }
            }
            var response = {
                accountFields: accountFields,
                accountOptionalValues: accountOptionalValues
            };
            return cb(null, response);
        } catch (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
    },

    getAccountByIdMD: async function (accountId, cb) {
        var err;
        try {
            var conn = await connection.getConnection();
            var account = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id,accountName,accountDescription,' +
              ' companyName,locationId,phone,primaryMobile,secondaryMobile,extension,fax,email,active,apiGetewayAuthToken,' +
              ' fileUploadPublicKey,fileUploadPrivateKey,s3StorageAddress,status,updatedAt from accounts where id = uuid_to_bin(?);', accountId);
            account = Utils.filteredResponsePool(account);
            if (!account) {
                throw err;
            }
            return cb(null, account);
        } catch (err) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_NOT_FOUND);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            throw err;
        }
    },

    updateAccountDetailsMD: function (options, errorOptions, cb) {
        var accountFields = '';
        var accountOptionalValues = [];
        var accountRequiredValues = [];
        var accountId = options.accountId;
        var updatedAt = options.updatedAt;
        var userId = options.userId;
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

        accountRequiredValues.push(accountId, accountId, updatedAt);
        Account.validateOptionalFields(options, async function (err, response) {
            if (err) {
                debug('err', err);
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            accountFields = response.accountFields;
            accountOptionalValues = response.accountOptionalValues;

            accountRequiredValues = _.concat(accountRequiredValues, accountOptionalValues);
            accountRequiredValues.push(newUpdatedAt, userId, accountId);

            try {
                var conn = await connection.getConnection();
                var accountData = await conn.query('IF (select 1 from accounts where id=uuid_to_bin(?)) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "ACCOUNT_NOT_FOUND", MYSQL_ERRNO = 4001;' +
                  'ELSEIF (select 1 from accounts where  id=uuid_to_bin(?) and updatedAt=?) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "ACCOUNT_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
                  'ELSE update accounts set ' + accountFields + ' updatedAt = ?,' +
                  ' updatedBy=uuid_to_bin(?) where id = uuid_to_bin(?);END IF', accountRequiredValues);

                accountData = Utils.isAffectedPool(accountData);
                if (!accountData) {
                    err = new Error(ErrorConfig.MESSAGE.ACCOUNT_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }
                /*return cb(null, {
                    OK: Constants.SUCCESS_MESSAGE.UPDATE_ACCOUNT_SUCCESS,
                    updatedAt: newUpdatedAt.toString()
                });*/
                Account.getAccountByIdMD(accountId, function (err, response) {
                    if (err) {
                        debug('err', err);
                        return cb(err);
                    }
                    return cb(null, response);
                });
            } catch (err) {
                debug('err ', err);
                await ErrorUtils.create(errorOptions, options, err);
                if (err.errno === 4001) {
                    err = new Error(ErrorConfig.MESSAGE.ACCOUNT_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return cb(err);
                } else if (err.errno === 4002) {
                    err = new Error(ErrorConfig.MESSAGE.ACCOUNT_DETAILS_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    return cb(err);
                } else {
                    err = new Error(ErrorConfig.MESSAGE.ACCOUNT_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    Util.log(err);
                    return cb(err);
                }
            }
        });
    },

    updateAccountMD: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var account = user.account;
        var currentLocationId = account.locationId;
        var accountId = options.accountId;
        var locationId = options.locationId;
        var newLocationId = options.newLocationId;
        var newLocationName = options.newLocationName;
        var phone = options.phone;
        var dialCode = options.dialCode;
        var phoneCountry = options.phoneCountry;
        var primaryMobile = options.primaryMobile;
        var primaryMobileDialCode = options.primaryMobileDialCode;
        var primaryMobileCountry = options.primaryMobileCountry;
        var secondaryMobile = options.secondaryMobile;
        var secondaryMobileDialCode = options.secondaryMobileDialCode;
        var secondaryMobileCountry = options.secondaryMobileCountry;
        var updatedAt = options.updatedAt;
        var saveAsLater = options.saveAsLater;
        var useExisting = options.useExisting;
        var accountName = options.accountName;
        var accountDescription = options.accountDescription;
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

        if (useExisting) {
            if (DataUtils.isUndefined(locationId)) {
                err = new Error(ErrorConfig.MESSAGE.SELECT_ANY_LOCATION_ID);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
        }

        if (DataUtils.isDefined(phone) || DataUtils.isDefined(dialCode) || DataUtils.isDefined(phoneCountry)) {
            if (!DataUtils.isDefined(phone)) {
                err = new Error(ErrorConfig.MESSAGE.PHONE_REQUIRED);
            } else if (!DataUtils.isDefined(dialCode)) {
                err = new Error(ErrorConfig.MESSAGE.PHONE_DIALCODE_REQUIRED);
            } else if (!DataUtils.isDefined(phoneCountry)) {
                err = new Error(ErrorConfig.MESSAGE.PHONE_COUNTRY_REQUIRED);
            }
            if (err) {
                debug('err', err);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
        }
        if (DataUtils.isDefined(primaryMobile) || DataUtils.isDefined(primaryMobileCountry) || DataUtils.isDefined(primaryMobileDialCode)) {
            if (!DataUtils.isDefined(primaryMobile)) {
                err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_REQUIRED);
            } else if (!DataUtils.isDefined(primaryMobileDialCode)) {
                err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_DIAL_CODE_REQUIRED);
            } else if (!DataUtils.isDefined(primaryMobileCountry)) {
                err = new Error(ErrorConfig.MESSAGE.PRIMARY_MOBILE_COUNTRY_REQUIRED);
            }
            if (err) {
                debug('err', err);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
        }
        if (DataUtils.isDefined(secondaryMobile) || DataUtils.isDefined(secondaryMobileCountry) || DataUtils.isDefined(secondaryMobileDialCode)) {
            if (!DataUtils.isDefined(secondaryMobile)) {
                err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_REQUIRED);
            } else if (!DataUtils.isDefined(secondaryMobileDialCode)) {
                err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_DIAL_CODE_REQUIRED);
            } else if (!DataUtils.isDefined(secondaryMobileCountry)) {
                err = new Error(ErrorConfig.MESSAGE.SECONDARY_MOBILE_COUNTRY_REQUIRED);
            }
            if (err) {
                debug('err', err);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
        }

        try {
            var conn = await connection.getConnection();
            await conn.query('START TRANSACTION;');
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        if (saveAsLater) {
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

            var locationOption = {
                accountId: accountId,
                userId: user.id,
                phone: options.phone,
                dialCode: options.dialCode,
                phoneCountry: options.phoneCountry,
                primaryMobile: options.primaryMobile,
                primaryMobileDialCode: options.primaryMobileDialCode,
                primaryMobileCountry: options.primaryMobileCountry,
                secondaryMobile: options.secondaryMobile,
                secondaryMobileDialCode: options.secondaryMobileDialCode,
                secondaryMobileCountry: options.secondaryMobileCountry,
                addressLine1: options.addressLine1,
                addressLine2: options.addressLine2,
                addressLine3: options.addressLine3,
                city: options.city,
                state: options.state,
                zipCode: options.zipCode,
                country: options.country,
                locationId: newLocationId,
                locationName: newLocationName
            };
            // Create record in location reference table with new locationId and name
            CommonApi.createLocationReferenceMD(locationOption, errorOptions, async function (err, response) {
                if (err) {
                    debug('err', err);
                    await conn.query('rollback');
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
                var accountOption = {
                    companyName: options.companyName,
                    phone: options.phone,
                    dialCode: options.dialCode,
                    phoneCountry: options.phoneCountry,
                    primaryMobile: options.primaryMobile,
                    primaryMobileDialCode: options.primaryMobileDialCode,
                    primaryMobileCountry: options.primaryMobileCountry,
                    secondaryMobile: options.secondaryMobile,
                    secondaryMobileDialCode: options.secondaryMobileDialCode,
                    secondaryMobileCountry: options.secondaryMobileCountry,
                    extension: options.extension,
                    fax: options.fax,
                    email: options.email,
                    locationId: newLocationId,
                    userId: user.id,
                    accountId: accountId,
                    updatedAt: updatedAt,
                    accountName: accountName,
                    accountDescription: accountDescription,
                };
                auditOptions.metaData = {};
                auditOptions.metaData.old_account = account;

                Account.updateAccountDetailsMD(accountOption, errorOptions, async function (err, response) {
                    if (err) {
                        debug('err', err);
                        await conn.query('rollback');
                        await ErrorUtils.create(errorOptions, options, err);
                        return cb(err);
                    }
                    await conn.query('commit');
                    AuditUtils.create(auditOptions);
                    return cb(null, response);
                });
            });
        } else {
            var accountOption = {
                companyName: options.companyName,
                phone: options.phone,
                dialCode: options.dialCode,
                phoneCountry: options.phoneCountry,
                primaryMobile: options.primaryMobile,
                primaryMobileDialCode: options.primaryMobileDialCode,
                primaryMobileCountry: options.primaryMobileCountry,
                secondaryMobile: options.secondaryMobile,
                secondaryMobileDialCode: options.secondaryMobileDialCode,
                secondaryMobileCountry: options.secondaryMobileCountry,
                extension: options.extension,
                fax: options.fax,
                email: options.email,
                locationId: newLocationId,
                userId: user.id,
                accountId: accountId,
                updatedAt: updatedAt,
                accountName: accountName,
                accountDescription: accountDescription,
            };
            if (locationId) {
                accountOption.locationId = locationId;
            } else {
                accountOption.locationId = '';
            }

            // Update Account Record record
            Account.updateAccountDetailsMD(accountOption, errorOptions, async function (err, response) {
                if (err) {
                    debug('err', err);
                    await conn.query('rollback;');
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
                await conn.query('commit');
                AuditUtils.create(auditOptions);
                return cb(null, response);
            });
        }
    },

    // Disable Account
    deactivateAccountMD: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var email = user.email;
        var userId = user.id;
        var accountId = options.accountId;
        var newupdatedAt = DataUtils.getEpochMSTimestamp();
        var err;

        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        try {
            await conn.query('START TRANSACTION');

            var accountUpdate = await conn.query('If (select 1 from accounts where id=uuid_to_bin(?)) is not null then' +
              ' update accounts set active = ?, updatedAt = ?,updatedBy=uuid_to_bin(?) ' +
              'where id = uuid_to_bin(?);end if', [accountId, false, newupdatedAt, userId, accountId]);

            accountUpdate = Utils.isAffectedPool(accountUpdate);

            if (!accountUpdate) {
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
        } catch (err) {
            await conn.query('rollback;');
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_DEACTIVATE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }

        try {

            var userUpdate = await conn.query('update users set isAccountEnabled = ?,isAccountActive = ?, updatedAt = ?,' +
              'updatedBy=uuid_to_bin(?) where accountId = uuid_to_bin(?)', [false, false, newupdatedAt, userId, accountId]);

            userUpdate = Utils.isAffectedPool(userUpdate);

            if (!userUpdate) {
                err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
        } catch (err) {
            await conn.query('rollback;');
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_DEACTIVATE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        try {
            var contactsUpdate = await conn.query('update contacts set userActive=?,updatedAt = ?,' +
              'updatedBy=uuid_to_bin(?) where inviteeUUID in ' +
              '(select id from users where accountId=uuid_to_bin(?)) ',
              [false, newupdatedAt, userId, accountId]);
            contactsUpdate = Utils.isAffectedPool(contactsUpdate);
            if (!contactsUpdate) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
        } catch (err) {
            await conn.query('rollback;');
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_DEACTIVATE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
        await conn.query('commit;');
        AuditUtils.create(auditOptions);
        return cb(null, {OK: Constants.SUCCESS});
    },

    // Close Account
    closeAccountMD: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var email = user.email;
        var userId = user.id;
        var accountId = options.accountId;
        var newupdatedAt = DataUtils.getEpochMSTimestamp();
        var err;

        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        try {
            await conn.query('START TRANSACTION');

            var accountUpdate = await conn.query('If (select 1 from accounts where id=uuid_to_bin(?)) is not null then' +
              ' update accounts set status=?, active = ?, updatedAt = ?,updatedBy=uuid_to_bin(?) ' +
              'where id = uuid_to_bin(?);end if', [accountId, Constants.ACCOUNT_STATUS.CLOSED, false, newupdatedAt, userId, accountId]);

            accountUpdate = Utils.isAffectedPool(accountUpdate);
            if (!accountUpdate) {
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
        } catch (err) {
            await conn.query('rollback;');
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_DEACTIVATE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }

        try {

            var userUpdate = await conn.query('update users set isAccountEnabled = ?,isAccountActive = ?,status=?, updatedAt = ?,' +
              'updatedBy=uuid_to_bin(?) where accountId = uuid_to_bin(?)', [false, false, Constants.USER_STATUS.CLOSED, newupdatedAt, userId, accountId]);

            userUpdate = Utils.isAffectedPool(userUpdate);

            if (!userUpdate) {
                err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            await conn.query('commit;');
            AuditUtils.create(auditOptions);
            return cb(null, {OK: Constants.SUCCESS});
        } catch (err) {
            await conn.query('rollback;');
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_DEACTIVATE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
        /* try {
             var contactsUpdate = await conn.query('update contacts set userActive=?,updatedAt = ?,' +
               'updatedBy=uuid_to_bin(?) where inviteeUUID in ' +
               '(select id from users where accountId=uuid_to_bin(?)) ',
               [false, newupdatedAt, userId, accountId]);
             contactsUpdate = Utils.isAffectedPool(contactsUpdate);
             if (!contactsUpdate) {
                 //  err = new Error(ErrorConfig.MESSAGE.CONTACT_UPDATE_FAILED);
                 //   err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                 throw err;
             }
             await conn.query('commit;');
             AuditUtils.create(auditOptions);
             return cb(null, {OK: Constants.SUCCESS});
         } catch (err) {
             await conn.query('rollback;');
             debug('err', err);
             err = new Error(ErrorConfig.MESSAGE.ACCOUNT_DEACTIVATE_FAILED);
             err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
             await ErrorUtils.create(errorOptions, options, err);
             return cb(err);
         }*/
    },

    updateEncryptionKeys: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var userId = user.id;
        var accountId = user.accountId;
        var updatedAt = options.updatedAt;
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();
        var err;

        if (DataUtils.isUndefined(options.addKeys)) {
            err = new Error(ErrorConfig.MESSAGE.ADD_KEY_FLAG_REQUIRED);
        } else if (!DataUtils.isBoolean(options.addKeys)) {
            err = new Error(ErrorConfig.MESSAGE.ADD_KEY_FLAG_MUST_BE_BOOLEAN);
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
        var accountFields = '';
        accountFields += '';
        var accountRequiredValues = [accountId, accountId, updatedAt, options.addKeys];
        if (options.addKeys) {
            if (DataUtils.isUndefined(options.publicKey)) {
                err = new Error(ErrorConfig.MESSAGE.PUBLIC_KEY_REQUIRED);
            } else if (DataUtils.isUndefined(options.privateKey)) {
                err = new Error(ErrorConfig.MESSAGE.PRIVATE_KEY_REQUIRED);
            }
            if (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            accountRequiredValues.push(options.publicKey, options.privateKey);
        } else {
            accountRequiredValues.push('', '');
        }
        accountRequiredValues.push(newUpdatedAt, userId, accountId);
        try {
            var conn = await connection.getConnection();

            var updateKeys = await conn.query('IF (SELECT 1 from accounts where id = uuid_to_bin(?)) is null then ' +
              'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "ACCOUNT_NOT_FOUND", MYSQL_ERRNO = 4001;' +
              'ELSEIF (select 1 from accounts where id=uuid_to_bin(?) and updatedAt=?) is null then ' +
              'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "ACCOUNT_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
              'ELSE update accounts set encryptionStatus=?,publicKey=? ,privateKey=?, updatedAt = ?,' +
              'updatedBy=uuid_to_bin(?) where id = uuid_to_bin(?);END IF', accountRequiredValues);

            updateKeys = Utils.isAffectedPool(updateKeys);
            if (!updateKeys) {
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            var accountOptions = {
                OK: Constants.SUCCESS,
                updatedAt: newUpdatedAt
            };
            AuditUtils.create(auditOptions);
            return cb(null, accountOptions);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            } else if (err.errno === 4002) {
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_DETAILS_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                return cb(err);
            } else {
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                Util.log(err);
                return cb(err);
            }
        }
    },

    activateAccountMD: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var userId = user.id;
        var accountId = user.accountId;
        var companyName = options.companyName;
        var addressLine1 = options.addressLine1;
        var addressLine2 = options.addressLine2;
        var addressLine3 = options.addressLine3;
        var phone1 = options.phone1;
        var phone2 = options.phone2;
        var phone3 = options.phone3;
        var fax1 = options.fax1;
        var fax2 = options.fax2;
        var fax3 = options.fax3;
        var email = options.email;
        var city = options.city;
        var state = options.state;
        var zipCode = options.zipCode;
        var country = options.country;
        var updatedAt = options.updatedAt;
        var active = true;
        var accountFields = '';
        var accountOptionalValues = [];
        var accountRequiredValues = [];
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();
        var err;

        if (!accountId) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
        } else if (!companyName) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_COMPANY_NAME_REQUIRED);
        } else if (!addressLine1) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ADDRESS_REQUIRED);
        } else if (!fax1) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_FAX_REQUIRED);
        } else if (!phone1) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_PHONES_REQUIRED);
        } else if (DataUtils.isUndefined(email)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_EMAIL_REQUIRED);
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
        accountRequiredValues.push(accountId, accountId, updatedAt);

        Account.validateOptionalFields(options, async function (err, response) {
            if (err) {
                debug('err', err);
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            accountFields = response.accountFields;
            accountOptionalValues = response.accountOptionalValues;

            if (accountOptionalValues.length === 0) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_REQUEST);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug('err', err);
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            accountRequiredValues = _.concat(accountRequiredValues, accountOptionalValues);
            accountRequiredValues.push(Constants.ACCOUNT_STATUS.ACTIVE, newUpdatedAt, user.id, accountId);

            try {
                var conn = await connection.getConnection();
                var accountUpdated = await conn.query('IF (select 1 from accounts where id=uuid_to_bin(?)) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "ACCOUNT_NOT_FOUND", MYSQL_ERRNO = 4001;' +
                  'ELSEIF (select 1 from accounts where id=uuid_to_bin(?) and updatedAt=?) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "ACCOUNT_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
                  'ELSE update accounts set ' + accountFields + 'status = ?, updatedAt = ?,' +
                  ' updatedBy=uuid_to_bin(?) where id = uuid_to_bin(?);END IF', accountRequiredValues);
                accountUpdated = Utils.isAffectedPool(accountUpdated);

                if (!accountUpdated) {
                    err = new Error(ErrorConfig.MESSAGE.ACCOUNT_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }

                var userUpdated = await conn.query('update users set isAccountEnabled = ?, isAccountActive =?,updatedAt = ?,' +
                  'updatedBy=uuid_to_bin(?) where id = uuid_to_bin(?)', [true, true, newUpdatedAt, userId, userId]);
                userUpdated = Utils.isAffectedPool(userUpdated);

                if (!userUpdated) {
                    err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }

                var accountOptions = {
                    id: accountId,
                    active: active,
                    companyName: companyName,
                    addressLine1: addressLine1,
                    addressLine2: addressLine2,
                    addressLine3: addressLine3,
                    phone1: phone1,
                    phone2: phone2,
                    phone3: phone3,
                    fax1: fax1,
                    fax2: fax2,
                    fax3: fax3,
                    email: email,
                    city: city,
                    state: state,
                    zipCode: zipCode,
                    updatedAt: newUpdatedAt
                };
                AuditUtils.create(auditOptions);
                return cb(null, accountOptions);
            } catch (err) {
                debug('err', err);
                await ErrorUtils.create(errorOptions, options, err);
                if (err.errno === 4001) {
                    err = new Error(ErrorConfig.MESSAGE.ACCOUNT_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return cb(err);
                } else if (err.errno === 4002) {
                    err = new Error(ErrorConfig.MESSAGE.ACCOUNT_DETAILS_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    return cb(err);
                } else {
                    err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ACTIVATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    Util.log(err);
                    return cb(err);
                }
            }
        });
    },

    reactivateAccountMD: async function (options, auditOptions, errorOptions, cb) {
        var user = options.user;
        var userId = user.id;
        var account = user.account;
        var accountId = user.accountId;
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();
        var contactStatus = Constants.CONTACT_STATUS.ACCEPTED;
        var err;

        try {
            var conn = await connection.getConnection();
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        try {
            await conn.query('START TRANSACTION');
            var accountUpdated = await conn.query('update accounts set active = ?,status = ? ,updatedAt = ? where id = uuid_to_bin(?)',
              [true, Constants.ACCOUNT_STATUS.ACTIVE, newUpdatedAt, accountId]);
            accountUpdated = Utils.isAffectedPool(accountUpdated);
            if (!accountUpdated) {
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }

            delete account.updatedBy;
            account.active = true;
            account.status = Constants.ACCOUNT_STATUS.ACTIVE;
            account.updatedAt = newUpdatedAt;

            AuditUtils.create(auditOptions);
            // return cb(null, account);
        } catch (err) {
            await conn.query('rollback;');
            debug('err ', err);
            await ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_REACTIVATE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
        try {
            var user = await conn.query('update users set isAccountEnabled = ?,isAccountActive=?,updatedAt = ? where id= uuid_to_bin(?)',
              [true, true, newUpdatedAt, userId]);
            user = Utils.isAffectedPool(user);
            if (!user) {
                err = new Error(ErrorConfig.MESSAGE.USER_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
        } catch (err) {
            await conn.query('rollback;');
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_REACTIVATE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
        try {
            var contactsUpdate = await conn.query('update contacts set userActive=?,status=?,updatedAt = ?,' +
              'updatedBy=uuid_to_bin(?) where inviteeUUID in ' +
              '(select id from users where accountId=uuid_to_bin(?)) ',
              [true, contactStatus, newUpdatedAt, userId, accountId]);
            contactsUpdate = Utils.isAffectedPool(contactsUpdate);
            if (!contactsUpdate) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            await conn.query('commit;');
            AuditUtils.create(auditOptions);
            return cb(null, {OK: Constants.SUCCESS});
        } catch (err) {
            await conn.query('rollback;');
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_REACTIVATE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    }
};


module.exports = Account;