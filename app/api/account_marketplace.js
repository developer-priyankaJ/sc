/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.api.account_marketplace');
var Util = require('util');
var Async = require('async');
var _ = require('lodash');

var AuditUtils = require('../lib/audit_utils');
var connection = require('../lib/connection_util');
var Utils = require('../lib/utils/index');
var DataUtils = require('../lib/data_utils');
var ErrorConfig = require('../data/error');
var ErrorUtils = require('../lib/error_utils');
var Constants = require('../data/constants');
var MWSConfig = require('../config/mws');
var amazonMws = require('amazon-mws')(MWSConfig.ACCESS_KEY_ID, MWSConfig.SECRET_ACCESS_KEY);

var AccountMarketplace = {

    validateOptionalFields: async function (options, cb) {
        var accountMarketplaceFields = '';
        var accountMarketplaceOptionalValues = [];
        var err;

        try {
            if (!DataUtils.isValidateOptionalField(options.mpId)) {
                if (!DataUtils.isString(options.mpId)) {
                    throw err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_MP_ID_MUST_BE_STRING);
                } else if (options.mpId.length > 15) {
                    throw err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_MP_ID_MUST_BE_LESS_THAN_15_CHARACTER);
                } else {
                    accountMarketplaceFields += 'mpId=? ,';
                    accountMarketplaceOptionalValues.push(options.mpId);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.sellerId)) {
                if (!DataUtils.isString(options.sellerId)) {
                    throw err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_SELLER_ID_MUST_BE_STRING);
                } else if (options.sellerId.length > 20) {
                    throw err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_SELLER_ID_MUST_BE_LESS_THAN_20_CHARACTER);
                }
                else {
                    accountMarketplaceFields += 'sellerId=? ,';
                    accountMarketplaceOptionalValues.push(options.sellerId);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.token)) {
                if (!DataUtils.isString(options.token)) {
                    throw err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_TOKEN_MUST_BE_STRING);
                } else if (options.token.length > 50) {
                    throw err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_TOKEN_MUST_BE_LESS_THAN_50_CHARACTER);
                }
                else {
                    accountMarketplaceFields += 'token=? ,';
                    accountMarketplaceOptionalValues.push(options.token);
                }
            }
            if (!DataUtils.isValidateOptionalField(options.status)) {
                if (!DataUtils.isNumber(options.status)) {
                    throw err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_STATUS_MUST_BE_0_OR_1);
                }
                else {
                    accountMarketplaceFields += 'status=? ,';
                    accountMarketplaceOptionalValues.push(options.status);
                }
            }

            var response = {
                accountMarketplaceFields: accountMarketplaceFields,
                accountMarketplaceOptionalValues: accountMarketplaceOptionalValues
            };
            return cb(null, response);
        } catch (err) {
            debug('err', err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
    },

    createMD: async function (options, errorOptions, cb) {
        var mpId = options.mpId;
        var sellerId = options.sellerId;
        var token = options.token;
        var accountId = options.account.id;
        var sellerAccessCredentials = options.accessCredentials;
        var createdBy = options.user.id;
        var createdAt = DataUtils.getEpochMSTimestamp();
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var accountMarketplaceFields = '';
        var accountMarketplaceRequiredValues = [];
        var accountMarketplaceOptionalValues = [];
        var status = options.status;
        // var accessCredentials = false;
        var err;
        if (DataUtils.isUndefined(mpId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_MPID_REQUIRED);
        } else if (DataUtils.isUndefined(sellerId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_SELLER_ID_REQUIRED);
        } else if (DataUtils.isValidateOptionalField(token)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_TOKEN_REQUIRED);
        } else if (DataUtils.isUndefined(status)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_STATUS_REQUIRED);
        } else if (DataUtils.isUndefined(sellerAccessCredentials)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_ACCESS_CREDENTIAL_REQUIRED);
        } else if (sellerAccessCredentials !== Constants.SELLER_CREDENTIALS.NOT_SET) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_ACCESS_CREDENTIAL_MUST_BE_NOT_SET);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug(err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        accountMarketplaceRequiredValues.push(mpId, accountId, mpId);

        AccountMarketplace.validateOptionalFields(options, async function (err, response) {
              if (err) {
                  await ErrorUtils.create(errorOptions, options, err);
                  return cb(err);
              }
              accountMarketplaceFields = response.accountMarketplaceFields;
              accountMarketplaceOptionalValues = response.accountMarketplaceOptionalValues;

              if (accountMarketplaceOptionalValues.length === 0) {
                  err = new Error(ErrorConfig.MESSAGE.INVALID_REQUEST);
                  err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                  debug('err', err);
                  await ErrorUtils.create(errorOptions, options, err);
                  return cb(err);
              }

              try {
                  await amazonMws.sellers.search({
                      'Version': '2011-07-01',
                      'Action': 'ListMarketplaceParticipations',
                      'SellerId': sellerId,
                      'MWSAuthToken': token
                  }, async function (err, seller) {
                      if (err) {
                          debug('err ---', err);
                          if (err.Code === 'InvalidParameterValue') {
                              err = new Error(ErrorConfig.MESSAGE.INVALID_SELLR_ID);
                          }
                          if (err.Code === 'AccessDenied') {
                              err = new Error(ErrorConfig.MESSAGE.AUTH_TOKEN_NOT_VALID_FOR_SELLER_ID_AND_AWS_ACCOUNT_ID);
                          }
                          await ErrorUtils.create(errorOptions, options, err);
                          return cb(err);
                      } else {
                          var marketPlaceList = seller.ListMarketplaces.Marketplace;
                          var matchMarketPlace = _.find(marketPlaceList, function (value) {
                              if (value.MarketplaceId === mpId) {
                                  return value;
                              }
                          });
                          if (_.isEmpty(matchMarketPlace)) {
                              err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_NOT_MATCH_WITH_THIS_SELLER_MPS);
                              await ErrorUtils.create(errorOptions, options, err);
                              return cb(err);
                          }
                      }
                      var accessCredentials = Constants.SELLER_CREDENTIALS.VALIDATED;
                      /* if (accessCredentials) {
                           accessCredentials = Constants.SELLER_CREDENTIALS.VALIDATED;
                       } else {
                           accessCredentials = Constants.SELLER_CREDENTIALS.INVALIDATED;
                       }*/

                      accountMarketplaceRequiredValues = _.concat(accountMarketplaceRequiredValues, accountMarketplaceOptionalValues);
                      accountMarketplaceRequiredValues.push(accountId, accessCredentials, createdAt, updatedAt, createdBy);

                      try {
                          var conn = await connection.getConnection();
                          var accountMarketplace = await conn.query('IF (select 1 from Marketplaces where mpId=?) is null then ' +
                            'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "MARKETPLACE_NOT_FOUND_WITH_THIS_MP_ID", MYSQL_ERRNO = 4001; ' +
                            'ELSEIF (SELECT 1 from AccountMarketplaces WHERE accountId =uuid_to_bin(?) and mpId=?) is not null then ' +
                            'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "DUPLICATE_ACCOUNT_MARKETPLACE", MYSQL_ERRNO = 4002; ' +
                            'ELSE INSERT into AccountMarketplaces set ' + accountMarketplaceFields +
                            'accountId=uuid_to_bin(?),accessCredentials=?,createdAt = ?, updatedAt = ?,createdBy=uuid_to_bin(?);end if',
                            accountMarketplaceRequiredValues);

                          var isAffected = Utils.isAffectedPool(accountMarketplace);

                          if (!isAffected) {
                              err = new Error(ErrorConfig.MESSAGE.DUPLICATE_ACCOUNT_MARKETPLACE);
                              err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                              await ErrorUtils.create(errorOptions, options, err);
                              return cb(err);
                          }
                          return cb(null, {
                              OK: Constants.SUCCESS,
                              createdAt: createdAt,
                              status: status,
                              accessCredentials: Constants.SELLER_CREDENTIALS.VALIDATED
                          });
                      }
                      catch (err) {
                          debug('err', err);
                          await ErrorUtils.create(errorOptions, options, err);
                          if (err.errno === 4001) {
                              err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_NOT_FOUND_WITH_THIS_MP_ID);
                              err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                              return cb(err);
                          } else if (err.errno === 4002) {
                              err = new Error(ErrorConfig.MESSAGE.DUPLICATE_ACCOUNT_MARKETPLACE);
                              err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                              return cb(err);
                          } else {
                              err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_CREATE_FAILED);
                              err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                              return cb(err);
                          }
                      }
                  });
              }
              catch (err) {
                  return cb(err);
              }
          }
        );
    },

    updateMD: async function (options, auditOptions, errorOptions, cb) {
        var mpId = options.mpId;
        var sellerId = options.sellerId;
        var token = options.token;
        var accountId = options.account.id;
        var updatedBy = options.user.id;
        var updatedAt = options.updatedAt;
        var sellerAccessCredentials = options.accessCredentials;
        var status = options.status;
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();
        var accountMarketplaceFields = '';
        var accountMarketplaceRequiredValues = [];
        var accountMarketplaceOptionalValues = [];
        var err;
        if (DataUtils.isUndefined(mpId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_MPID_REQUIRED);
        } else if (DataUtils.isUndefined(sellerAccessCredentials)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_ACCESS_CREDENTIAL_REQUIRED);
        } else if (sellerAccessCredentials === Constants.SELLER_CREDENTIALS.NOT_SET) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_ACCESS_CREDENTIAL_MUST_NOT_BE_NOT_SET);
        } else if (updatedAt.toString().length !== 13) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_UPDATED_AT_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug(err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        if (status === true && sellerId === undefined && token === undefined) {
            try {
                var conn = await connection.getConnection();
                var accountMarketplace = await conn.query('select mpId,sellerId, token ' +
                  'from AccountMarketplaces where accountId = uuid_to_bin(?) and mpId=?', [accountId, mpId]);
                accountMarketplace = Utils.filteredResponsePool(accountMarketplace);

                if (!accountMarketplace) {
                    err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    await ErrorUtils.create(errorOptions, options, err);
                    return cb(err);
                }
                sellerId = accountMarketplace.sellerId;
                token = accountMarketplace.token;
            } catch (err) {
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
        }

        accountMarketplaceRequiredValues.push(accountId, mpId, accountId, mpId, updatedAt);
        AccountMarketplace.validateOptionalFields(options, async function (err, response) {
            if (err) {
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            accountMarketplaceFields = response.accountMarketplaceFields;
            accountMarketplaceOptionalValues = response.accountMarketplaceOptionalValues;

            if (accountMarketplaceOptionalValues.length === 0) {
                err = new Error(ErrorConfig.MESSAGE.INVALID_REQUEST);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug('err', err);
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            if (sellerId !== undefined) {
                var accessCredentialsValue = {
                    sellerId: sellerId,
                    token: token,
                    mpId: mpId,
                    account: options.account,
                    newCredentials: true
                };
                try {
                    var accessCredentialsResponse = await AccountMarketplace.validateSellerAccessCredentials(accessCredentialsValue, errorOptions);
                    sellerAccessCredentials = accessCredentialsResponse;
                }
                catch (err) {
                    return cb(err);
                }
            }

            accountMarketplaceRequiredValues = _.concat(accountMarketplaceRequiredValues, accountMarketplaceOptionalValues);
            accountMarketplaceRequiredValues.push(updatedBy, sellerAccessCredentials, newUpdatedAt, accountId, mpId);

            try {
                var conn = await connection.getConnection();
                var accountMarketplace = await conn.query('If (select 1 from AccountMarketplaces where accountId =uuid_to_bin(?) and mpId=?) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "ACCOUNT_MARKETPLACE_NOT_FOUND", MYSQL_ERRNO = 1001;' +
                  'ELSEIF (select 1 from AccountMarketplaces where accountId =uuid_to_bin(?) and mpId=? and updatedAt=?) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "ACCOUNT_MARKETPLACE_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 1002;' +
                  'ELSE  update AccountMarketplaces set ' + accountMarketplaceFields +
                  'updatedBy=uuid_to_bin(?),accessCredentials=?, updatedAt = ? where accountId =uuid_to_bin(?) and mpId=?;end if;',
                  accountMarketplaceRequiredValues);

                var isAffected = Utils.isAffectedPool(accountMarketplace);
                if (!isAffected) {
                    err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    await ErrorUtils.create(errorOptions, options, err);
                    throw err;
                }
                AuditUtils.create(auditOptions);
                return cb(null, {
                    OK: Constants.SUCCESS,
                    status: status,
                    updatedAt: newUpdatedAt,
                    accessCredentials: Constants.SELLER_CREDENTIALS.VALIDATED
                });
            } catch (err) {
                await ErrorUtils.create(errorOptions, options, err);
                if (err.errno === 1001) {
                    err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return cb(err);
                } else if (err.errno === 1002) {
                    err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    return cb(err);
                } else {
                    err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return cb(err);
                }
            }

        });
    },

    validateSellerAccessCredentials: async function (options, errorOptions) {
        return new Promise(async function (resolve, reject) {
            try {
                await amazonMws.sellers.search({
                    'Version': '2011-07-01',
                    'Action': 'ListMarketplaceParticipations',
                    'SellerId': options.sellerId,
                    'MWSAuthToken': options.token
                }, async function (err, seller) {
                    if (err) {
                        if (err.Code === 'InvalidParameterValue') {
                            err = new Error(ErrorConfig.MESSAGE.INVALID_SELLR_ID);
                        }
                        if (err.Code === 'AccessDenied') {
                            err = new Error(ErrorConfig.MESSAGE.AUTH_TOKEN_NOT_VALID_FOR_SELLER_ID_AND_AWS_ACCOUNT_ID);
                        }
                        await ErrorUtils.create(errorOptions, options, err);
                        if (options.newCredentials === false) {
                            try {
                                var conn = await connection.getConnection();
                                var accountMarketplace = await conn.query('delete from AccountMarketplaces where ' +
                                  'accountId =uuid_to_bin(?) and mpId=?', [options.account.id, options.mpId]);

                                accountMarketplace = Utils.isAffectedPool(accountMarketplace);
                                if (!accountMarketplace) {
                                    err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_NOT_FOUND);
                                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                                    await ErrorUtils.create(errorOptions, options, err);
                                    return reject(err);
                                }
                                err = new Error(ErrorConfig.MESSAGE.NEW_OLD_BOTH_CREDENTIALS_ARE_INVALID_YOUR_RECORD_HAS_BEEN_REMOVED);
                                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                                err.data = {
                                    accessCredential: 0,
                                    status: 0
                                };
                                throw err;
                            } catch (err) {
                                await ErrorUtils.create(errorOptions, options, err);
                                return reject(err);
                            }
                        } else {
                            try {
                                await AccountMarketplace.getSellerDetails(options, errorOptions);
                            } catch (err) {
                                debug('err', err);
                                return reject(err);
                            }
                        }
                        return reject(err);
                    } else {
                        var marketPlaceList = seller.ListMarketplaces.Marketplace;
                        var matchMarketPlace = _.find(marketPlaceList, function (value) {
                            if (value.MarketplaceId === options.mpId) {
                                return value;
                            }
                        });
                        if (_.isEmpty(matchMarketPlace)) {
                            err = new Error(ErrorConfig.MESSAGE.MARKETPLACE_NOT_MATCH_WITH_THIS_SELLER_MPS);
                            await ErrorUtils.create(errorOptions, options, err);
                            return reject(err);
                        }
                    }
                    var accessCredentials = Constants.SELLER_CREDENTIALS.VALIDATED;
                    return resolve(accessCredentials);
                });
            }
            catch (err) {
                debug('err', err);
                await ErrorUtils.create(errorOptions, options, err);
                return reject(err);
            }
        });
    },

    getSellerDetails: async function (options, errorOptions) {
        return new Promise(async function (resolve, reject) {
            try {
                var conn = await connection.getConnection();
                var accountMarketplace = await conn.query('select mpId,sellerId, token ' +
                  'from AccountMarketplaces where accountId = uuid_to_bin(?) and mpId=?', [options.account.id, options.mpId]);
                accountMarketplace = Utils.filteredResponsePool(accountMarketplace);

                var err;
                if (!accountMarketplace) {
                    err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    await ErrorUtils.create(errorOptions, options, err);
                    return reject(err);
                }
                try {
                    var sellerId = accountMarketplace.sellerId;
                    var token = accountMarketplace.token;
                    var newCredentials = false;
                    var accessCredentialsValue = {
                        sellerId: sellerId,
                        token: token,
                        mpId: options.mpId,
                        account: options.account,
                        newCredentials: false
                    };
                    var accessCredentialsResponse = await AccountMarketplace.validateSellerAccessCredentials(accessCredentialsValue, errorOptions);

                    debug('accessCredentialsResponse', accessCredentialsResponse);
                    return resolve(accessCredentialsResponse);
                }
                catch (err) {
                    return reject(err);
                }

            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                await ErrorUtils.create(errorOptions, options, err);
                return reject(err);
            }
        });
    },

    getMD: async function (options, errorOptions, cb) {
        var mpId = options.mpId;
        var accountId = options.account.id;
        var err;
        if (DataUtils.isUndefined(mpId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_MPID_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug(err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var accountMarketplace = await conn.query('select AccMp.mpId,AccMp.sellerId, AccMp.token, AccMp.updatedAt, ' +
              'AccMp.status, AccMp.accessCredentials,' +
              '(select Mp.name from Marketplaces Mp where(Mp.mpId = AccMp.mpId)) as mpName ' +
              'from AccountMarketplaces AccMp where accountId = uuid_to_bin(?) and mpId=?', [accountId, mpId]);

            accountMarketplace = Utils.filteredResponsePool(accountMarketplace);

            if (!accountMarketplace) {
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }

            return cb(null, accountMarketplace);
        } catch (err) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    listByAccountMD: async function (options, errorOptions, cb) {
        var accountId = options.account.id;


        try {
            var conn = await connection.getConnection();
            var accountMarketplaces = await conn.query('select AccMp.mpId,AccMp.sellerId, AccMp.token, AccMp.updatedAt,' +
              'AccMp.status, AccMp.accessCredentials,CAST(uuid_from_bin(AccMp.accountId) as CHAR) as accountId, ' +
              '(select Mp.name from Marketplaces Mp where(Mp.mpId = AccMp.mpId)) as mpName ' +
              'from AccountMarketplaces AccMp where accountId = uuid_to_bin(?)', [accountId]);

            return cb(null, accountMarketplaces);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    getUnlistedMpsProduct: async function (options, errorOptions, cb) {
        var accountId = options.account.id;
        var productRefId = options.productRefId;
        var err;
        if (DataUtils.isUndefined(productRefId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_PRODUCT_REF_ID_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug(err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var accountMarketplaces = await conn.query('select AccMp.mpId,AccMp.sellerId, AccMp.token, AccMp.updatedAt,' +
              '(select Mp.name from Marketplaces Mp where(Mp.mpId = AccMp.mpId)) as mpName ' +
              'from AccountMarketplaces AccMp where AccMp.accountId=uuid_to_bin(?) and AccMp.mpId not In (select ProdByMp.mpId ' +
              'from ProductByMP ProdByMp where productRefId = uuid_to_bin(?))', [accountId, productRefId]);

            return cb(null, accountMarketplaces);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    removeMD: async function (options, auditOptions, errorOptions, cb) {
        debug('remove options', options);
        var mpId = options.mpId;
        var accountId = options.account.id;
        var err;
        if (DataUtils.isUndefined(mpId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_MPID_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug(err);
            return cb(err);
        }
        try {
            var conn = await connection.getConnection();
            var accountMarketplace = await conn.query('delete from AccountMarketplaces where accountId =uuid_to_bin(?) and mpId=?', [accountId, mpId]);

            accountMarketplace = Utils.isAffectedPool(accountMarketplace);
            debug('accountMarketplace', accountMarketplace);
            if (!accountMarketplace) {
                err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }
            AuditUtils.create(auditOptions);
            return cb(null, {
                OK: Constants.SUCCESS,
                status: 0,
                accessCredentials: 0
            });
        } catch (err) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_MARKETPLACE_REMOVE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    }

};

module.exports = AccountMarketplace;
