/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.api.out_sharing');
var Util = require('util');
var Promise = require('bluebird');
var _ = require('lodash');
var Async = require('async');
var Request = require('request-promise');
var env = process.env.NODE_ENV || 'development';

var connection = require('../lib/connection_util');
var ErrorUtils = require('../lib/error_utils');
var Utils = require('../lib/utils');
var ErrorConfig = require('../data/error');
var DataUtils = require('../lib/data_utils');
var AuditUtils = require('../lib/audit_utils');
var EmailUtils = require('../lib/email_utils');
var Constants = require('../data/constants');
var OutSharingApi = require('../api/out_sharing');
var InShareApi = require('../api/in_share');
var ProductInventoryApi = require('./product_inventory');
var CustomerApi = require('./customer');
var SupplierApi = require('./supplier');
var NotificationReferenceData = require('../data/notification_reference');

var OutShareInstance = {
      /**
       * Update product inventory
       */
      updateProductInventory: function (options) {
          return new Promise(async function (resolve, reject) {
              var shareItemIds = options.shareItemIds;
              var accountId = options.accountId;
              var currentDate = DataUtils.getEpochMSTimestamp();
              var err;
              try {
                  var conn = await connection.getConnection();

                  var queryResponse = await ProductInventoryApi.manipulateInventoryQuery({list: shareItemIds});

                  var isUpdated = await conn.query('update ProductInventory set isRealTimeFrequency = ?,updatedAt=? ' +
                    'where accountId = uuid_to_bin(?) and id in (' + queryResponse.string + ');',
                    [1, currentDate, accountId].concat(queryResponse.values));
                  isUpdated = Utils.isAffectedPool(isUpdated);
                  debug('isUpdated', isUpdated);

                  return resolve(Constants.OK_MESSAGE);
              } catch (err) {
                  err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_UPDATE_FAILED);
                  err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                  return reject(err);
              }
          });
      },
      /**
       * Update supply inventory
       */
      updateSupplyInventory: function (options) {
          return new Promise(async function (resolve, reject) {
              var shareItemIds = options.shareItemIds;
              var accountId = options.accountId;
              var currentDate = DataUtils.getEpochMSTimestamp();
              var err;
              try {
                  var conn = await connection.getConnection();

                  var queryResponse = await ProductInventoryApi.manipulateInventoryQuery({list: shareItemIds});

                  var isUpdated = await conn.query('update SupplyInventory set isRealTimeFrequency = ?,updatedAt=? ' +
                    'where accountId = uuid_to_bin(?) and id in (' + queryResponse.string + ');',
                    [1, currentDate, accountId].concat(queryResponse.values));
                  isUpdated = Utils.isAffectedPool(isUpdated);
                  debug('isUpdated', isUpdated);

                  return resolve(Constants.OK_MESSAGE);
              } catch (err) {
                  err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_UPDATE_FAILED);
                  err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                  return reject(err);
              }
          });
      },
      /**
       * Update isRealTime frequency
       */
      updateIsRealTimeFrequency: function (options) {
          return new Promise(async function (resolve, reject) {
              var shareItemType = options.shareItemType;
              var shareItemIds = options.shareItemIds;
              var accountId = options.accountId;
              var response;
              try {
                  var shareItemOption = {
                      accountId: accountId,
                      shareItemIds: shareItemIds
                  };
                  if (shareItemType === Constants.OUT_SHARE_PROFILE_TYPE.PRODUCT_INVENTORY) {
                      response = await OutShareInstance.updateProductInventory(shareItemOption);
                  } else if (shareItemType === Constants.OUT_SHARE_PROFILE_TYPE.SUPPLY_INVENTORY) {
                      response = await OutShareInstance.updateSupplyInventory(shareItemOption);
                  } else if (shareItemType === Constants.OUT_SHARE_PROFILE_TYPE.PRODUCT_ORDERS) {

                  } else if (shareItemType === Constants.OUT_SHARE_PROFILE_TYPE.DEPENDENT_DEMAND) {

                  }
                  return resolve(Constants.OK_MESSAGE);
              } catch (err) {
                  debug('err', err);
                  return reject(err);
              }
          });
      },

      /**
       * Validate create outshare fields
       */
      validateCreateOutShare: function (options) {
          return new Promise(async function (resolve, reject) {
              try {
                  var offeredStartDate = DataUtils.getEpochMSTimestamp();
                  var err, startDateTypeToSave;
                  if (DataUtils.isUndefined(options.accountId)) {
                      debug('1');
                      err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
                  } else if (!DataUtils.isArray(options.shareItemIds)) {
                      debug('2');
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ITEM_IDS_REQUIRED_AND_IDS_MUST_BE_IN_ARRAY);
                  } else if (!options.shareItemIds.length) {
                      debug('3');
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ITEM_IDS_REQUIRED_AND_IDS_MUST_BE_IN_ARRAY);
                  } else if (!DataUtils.isUniqueArray(options.shareItemIds)) {
                      debug('4');
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ITEM_ID_DUPLICATE);
                  } else if (options.shareItemIds.length > Constants.MAX_OUT_SHARE_SHARE_ITEM_IDS) {
                      debug('5');
                      err = new Error(ErrorConfig.MESSAGE.ONLY_10_OUT_SHARE_ITEM_ID_ALLOWED);
                  } else if (DataUtils.isUndefined(options.outShareId)) {
                      debug('6');
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_OUTSHARE_ID_REQUIRED);
                  } else if (DataUtils.isUndefined(options.outShareName)) {
                      debug('7');
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_OUTSHARE_NAME_REQUIRED);
                  } else if (!DataUtils.isArray(options.accounts)) {
                      debug('8');
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ACCOUNTS_REQUIRED_AND_IDS_MUST_BE_IN_ARRAY);
                      debug('10');
                  } else if (options.accounts.length <= 0) {
                      debug('11');
                      err = new Error(ErrorConfig.MESSAGE.ATLEAST_ONE_ID_REUQIRED);
                  } else if (options.accounts.length > Constants.MAX_OUT_SHARE_INSTANCE_SUBSCRIBERS) {
                      debug('12');
                      err = new Error(ErrorConfig.MESSAGE.ONLY_10_OUT_SHARE_INSTANCE_SUBSCRIBERS_ALLOWED);
                  } else if (DataUtils.isUndefined(options.shareItemType)) {
                      debug('13');
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_SHARE_ITEM_TYPE_REQUIRED);
                  } else if (DataUtils.isUndefined(options.dataProtectionOption)) {
                      debug('14');
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_DATA_PROTECTION_OPTION_REQUIRED);
                  } else if (!DataUtils.isNumber(options.dataProtectionOption)) {
                      debug('15');
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_DATA_PROTECTION_OPTION_REQUIRED);
                  } else if (Constants.OUT_SHARE_TYPE.indexOf(options.shareItemType) === -1) {
                      debug('16');
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_SHARE_ITEM_TYPE_INVALID);
                  } else if (DataUtils.isUndefined(options.startDateType)) {
                      debug('17');
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_START_DATE_TYPE_REQUIRED);
                  } else if (options.startDateType.toLowerCase() === Constants.OUT_SHARE_START_DATE_TYPE.ASAP.toLocaleLowerCase()) {
                      debug('18');
                      startDateTypeToSave = Constants.OUT_SHARE_START_DATE.ASAP;
                  } else if (options.startDateType.toLowerCase() === Constants.OUT_SHARE_START_DATE_TYPE.ASAP_AFTER.toLocaleLowerCase()) {
                      debug('20');
                      if (DataUtils.isUndefined(options.offeredStartDate)) {
                          debug('201');
                          err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_START_DATE_REQUIRED);
                      } else if ((options.offeredStartDate).toString().length !== 13) {
                          debug('202');
                          err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_START_DATE_INVALID);
                      } else {
                          debug('203');
                          startDateTypeToSave = Constants.OUT_SHARE_START_DATE.ASAP_AFTER;
                          offeredStartDate = options.offeredStartDate;
                          debug('offeredStartDate', offeredStartDate);
                      }
                  } else if (options.startDateType.toLowerCase() === Constants.OUT_SHARE_START_DATE_TYPE.PAUSE.toLocaleLowerCase()) {
                      debug('21');
                      startDateTypeToSave = Constants.OUT_SHARE_START_DATE.PAUSE;
                      offeredStartDate = Constants.DEFAULT_DATE;
                  } else if (DataUtils.isUndefined(startDateTypeToSave)) {
                      debug('23');
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_START_DATE_TYPE_INVALID);
                  }
                  if (err) {
                      throw err;
                  }
                  await Promise.each(options.accounts, async function (account) {

                      if (DataUtils.isUndefined(account.accountId)) {
                          err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ACCOUNT_ID_REQUIRED);
                      } else if (!err && DataUtils.isValidateOptionalField(account.type)) {
                          err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_PARTNER_TYPE_REQUIRED);
                      }
                      if (err) {
                          throw err;
                      }
                  });
                  var response = {
                      startDateTypeToSave: startDateTypeToSave,
                      offeredStartDate: offeredStartDate
                  };
                  debug('in function', response);
                  return resolve(response);
              } catch (err) {
                  debug('err', err);
                  //err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                  return reject(err);
              }
          });
      },
      /**
       * Validate sharing
       */
      validateOutSharing: function (options) {
          return new Promise(async function (resolve, reject) {
              try {
                  debug('inside a out');
                  var conn = await connection.getConnection();
                  var err;
                  var shareItemIdParams = options.shareItemIds.map(sid => 'uuid_to_bin(?)');
                  var shareItemIdParams2 = options.shareItemIds.map(sid => '?');
                  var shareItemIdParamsValue = options.shareItemIds.map(sid => sid);
                  debug('1', shareItemIdParams, '2', shareItemIdParams2, '3', shareItemIdParamsValue);
                  var query = 'IF 0 > 1 THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4000,MESSAGE_TEXT = "Something went wrong";';
                  var params = [];

                  if (options.useExisting && DataUtils.isUndefined(options.sharingProfileId)) {
                      err = new Error(ErrorConfig.MESSAGE.SELECT_ANY_OUT_SHARING_PROFILE_ID);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                      throw err;
                  }

                  //Check that outShareId Duplicate for same accountId
                  query += 'ELSEIF (SELECT count(*) from OutShare where accountId = uuid_to_bin(?) and outShareId = ?) ' +
                    'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4004,MESSAGE_TEXT = "OUT_SHARE_ALREADY_EXISTS_WITH_SAME_OUT_SHARE_ID";';
                  params = params.concat([options.accountId]).concat(options.outShareId);

                  // checking that ProfileId is exist in OutSharingProfile table or not.
                  if (options.useExisting && DataUtils.isDefined(options.sharingProfileId)) {

                      query += 'ELSEIF NOT EXISTS(select 1 from OutSharingProfile where accountId = uuid_to_bin(?) and id = uuid_to_bin(?))' +
                        'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "OUT_SHARING_PROFILE_ID_INVALIED";' +
                        'ELSEIF (SELECT count(*) from OutShare where accountId = uuid_to_bin(?) and sharingProfileId = uuid_to_bin(?) and (shareItemId in (' + shareItemIdParams2 + '))) > 0 ' +
                        'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4002,MESSAGE_TEXT = "OUT_SHARE_ITEM_ID_ALREADY_EXISTS_WITH_SAME_PROFILE_ID";';

                      params = params.concat([options.accountId, options.sharingProfileId, options.accountId, options.sharingProfileId]).concat(shareItemIdParamsValue);
                  }

                  // Checking that shareItemId is exists or not in sharing profile type tables
                  if (options.shareItemType === Constants.OUT_SHARE_PROFILE_TYPE.PRODUCT_INVENTORY) {
                      query += 'ELSEIF (SELECT count(*) from ProductInventory where accountId = uuid_to_bin(?) and status = 1 and id in (' + shareItemIdParams + ')) != ? ' +
                        'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4003,MESSAGE_TEXT = "PRODUCT_INVENTORY_NOT_FOUND";';
                      params = params.concat([options.accountId]).concat(shareItemIdParamsValue).concat([shareItemIdParamsValue.length]);
                  } else if (options.shareItemType === Constants.OUT_SHARE_PROFILE_TYPE.SUPPLY_INVENTORY) {
                      query += 'ELSEIF (SELECT count(*) from SupplyInventory where accountId = uuid_to_bin(?) and status = 1 and id in (' + shareItemIdParams + ')) != ? ' +
                        'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4005,MESSAGE_TEXT = "SUPPLY_INVENTORY_NOT_FOUND";';
                      params = params.concat([options.accountId]).concat(shareItemIdParamsValue).concat([shareItemIdParamsValue.length]);
                  } else if (options.shareItemType === Constants.OUT_SHARE_PROFILE_TYPE.PRODUCT_ORDERS) {
                      query += 'ELSEIF (SELECT count(*) from ProductReferences where accountId = uuid_to_bin(?) and id in (' + shareItemIdParams + ')) != ? ' +
                        'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4006,MESSAGE_TEXT = "PRODUCT_REFERENCE_NOT_FOUND";';
                      params = params.concat([options.accountId]).concat(shareItemIdParamsValue).concat([shareItemIdParamsValue.length]);
                  } else if (options.shareItemType === Constants.OUT_SHARE_PROFILE_TYPE.DEPENDENT_DEMAND) {
                      query += ' ELSEIF (SELECT count(*) from SupplyItems where accountId = uuid_to_bin(?) and id in (' + shareItemIdParams + ')) != ? ' +
                        'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4006,MESSAGE_TEXT = "SUPPLY_ITEM_NOT_FOUND"; ';
                      params = params.concat([options.accountId]).concat(shareItemIdParamsValue).concat([shareItemIdParamsValue.length]);

                  } else {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_SHARE_ITEM_TYPE_INVALID);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                      throw err;
                  }

                  query += 'end IF';
                  debug('query', query);
                  debug('params', params);
                  await conn.query(query, params);

                  var existOutShare = await OutShareInstance.getExistingOutShareWithSamePartnerItems(options);
                  if(existOutShare.length > 0){
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_EXIST_WITH_SAME_IN_SHARE_PARTNER_AND_OUT_SHARE_ITEMS);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                      err.data = existOutShare;
                      return reject(err);
                  }
                  return resolve();

              } catch (err) {
                  debug('err', err);
                  if (err.errno === 4001) {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARING_PROFILE_ID_INVALID);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                  } else if (err.errno === 4002) {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_ITEM_ID_ALREADY_EXISTS_WITH_SAME_PROFILE_ID);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                  } else if (err.errno === 4003) {
                      err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_NOT_FOUND);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                  } else if (err.errno === 4004) {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_ALREADY_EXISTS_WITH_SAME_OUT_SHARE_ID);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                  } else if (err.errno === 4005) {
                      err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_NOT_FOUND);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                  } else if (err.errno === 4006) {
                      err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_NOT_FOUND);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                  }
                  return reject(err);
              }
          });
      },

      insertOutShare: function (options) {
          return new Promise(async function (resolve, reject) {
              try {
                  debug('inside a out share insert');
                  var err, outSharingInstanceIds;
                  var currentDate = DataUtils.getEpochMSTimestamp();
                  var conn = await connection.getConnection();
                  var instanceParams = [options.id, options.accountId, options.outShareId,
                      Constants.SHARING_TYPE[options.shareItemType], options.sharingProfileId, options.outShareName, Constants.OUT_SHARE_STATUS.INVITATION_SENDING,
                      options.offeredStartDate, options.startDateTypeToSave, options.dataProtectionOption, options.userId, currentDate, currentDate];

                  var outSharingInstance = await conn.query('INSERT into OutShare SET ' +
                    'id = uuid_to_bin(?), accountId = uuid_to_bin(?),outShareId = ?,' +
                    'shareItemType = ?,sharingProfileId = uuid_to_bin(?),outShareName = ?,status = ?,' +
                    'offeredStartDate = ?,startDateType = ?,dataProtectionOption=?,createdBy = uuid_to_bin(?),createdAt = ?,updatedAt = ?', instanceParams);
                  debug('outshare', outSharingInstance);
                  outSharingInstance = Utils.isAffectedPool(outSharingInstance);
                  if (!outSharingInstance) {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_CREATION_FAILED);
                      err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                      throw err;
                  }
                  outSharingInstanceIds = {
                      id: options.id,
                      updatedAt: currentDate
                  };
                  return resolve(outSharingInstanceIds);
              } catch (err) {
                  debug('err', err);
                  return reject(err);
              }
          });
      },

      insertShareItems: function (options) {
          return new Promise(async function (resolve, reject) {
              try {
                  debug('inside a share item');
                  var conn = await connection.getConnection();
                  var status = Constants.STATUS.ACTIVE;
                  var currentDate = DataUtils.getEpochMSTimestamp();
                  var tempItemsValue = [];
                  options.shareItemIds.forEach(function (value) {
                      var outShareItemId = Utils.generateId().uuid;
                      tempItemsValue = tempItemsValue.concat(outShareItemId, options.outSharingInstanceId, value, currentDate, currentDate, status);
                  });
                  var query = 'INSERT into OutShareItems (id,outShareInstanceId,shareItemId,' +
                    'createdAt,updatedAt,status) values';

                  var values = ' (uuid_to_bin(?), uuid_to_bin(?),uuid_to_bin(?), ?,?,?) ';
                  options.shareItemIds.forEach(function (value) {
                      query = query + values;
                      query = query + ',';
                  });
                  query = query.replace(/,\s*$/, '');
                  debug('query', query);
                  var outShareItem = await conn.query(query, tempItemsValue);
                  debug('item', outShareItem);
                  return resolve(outShareItem);
              } catch (err) {
                  debug('err', err);
                  return reject(err);
              }
          });
      },

      insertSharePartner: function (options) {
          return new Promise(async function (resolve, reject) {
              try {
                  var conn = await connection.getConnection();
                  var status = Constants.OUT_SHARE_PARTNER_STATUS.PROCESSING;
                  var currentDate = DataUtils.getEpochMSTimestamp();
                  var tempPartnersValue = [];
                  options.accounts.forEach(function (value) {
                      var outSharePartnerId = Utils.generateId().uuid;
                      tempPartnersValue = tempPartnersValue.concat(outSharePartnerId, options.outSharingInstanceId, value.accountId, value.type,
                        currentDate, currentDate, status);
                  });

                  var query = 'INSERT into OutSharePartners (id,outShareInstanceId,inSharePartnerId,type,' +
                    'createdAt,updatedAt,status) values';

                  var values = ' (uuid_to_bin(?), uuid_to_bin(?),uuid_to_bin(?),?, ?,?,?) ';
                  options.accounts.forEach(function (value) {
                      query = query + values;
                      query = query + ',';
                  });
                  query = query.replace(/,\s*$/, '');
                  var outSharePartner = await conn.query(query, tempPartnersValue);
                  return resolve(outSharePartner);
              } catch (err) {
                  debug('err', err);
                  return reject(err);
              }
          });
      },

      createMD: async function (options, errorOptions, cb) {

          var useExisting = options.useExisting;
          var accountId = options.accountId;
          var sharingProfileId = options.sharingProfileId;
          var dataProtectionOption = options.dataProtectionOption;
          //var offeredStartDate = DataUtils.getEpochMSTimestamp();
          var err, startDateTypeToSave, offeredStartDate;

          try {
              var validateResponse = await OutShareInstance.validateCreateOutShare(options);
              debug('response', validateResponse);
              startDateTypeToSave = validateResponse.startDateTypeToSave;
              offeredStartDate = validateResponse.offeredStartDate;
          } catch (err) {
              debug('err', err);
              errorOptions.err = err;
              await ErrorUtils.create(errorOptions);
              err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
              return cb(err);
          }
          var accountIds = _.map(options.accounts, 'accountId');
          var index = DataUtils.isUniqueArray(accountIds);

          if (!index) {
              err = new Error(ErrorConfig.MESSAGE.DUPLICATE_PARTNER_WITH_THE_SAME_ACCOUNT_ID);
              err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
              errorOptions.err = err;
              await ErrorUtils.create(errorOptions);
              return cb(err);
          }

          var outSharingInstanceIds;
          var success = [];

          try {
              var conn = await connection.getConnection();
          } catch (err) {
              debug('err', err);
              return cb(err);
          }

          try {
              await conn.query('START TRANSACTION;');

              await OutShareInstance.validateOutSharing(options);
              if (!useExisting) {
                  options.type = options.shareItemType;
                  // creating OutSharing Profile
                  sharingProfileId = await OutSharingApi.createMD(options);
              }

              var shareItemIds = options.shareItemIds.join(',');
              var currentDate = new Date().getTime();

              // creating OutSharingInstance
              var outSharingInstanceId = Utils.generateId().uuid;
              var insertOutShareOptions = {
                  id: outSharingInstanceId,
                  accountId: options.accountId,
                  outShareId: options.outShareId,
                  shareItemType: options.shareItemType,
                  sharingProfileId: sharingProfileId,
                  outShareName: options.outShareName,
                  startDateTypeToSave: startDateTypeToSave,
                  offeredStartDate: offeredStartDate,
                  dataProtectionOption: options.dataProtectionOption,
                  userId: options.userId
              };
              // Insert out share
              outSharingInstanceIds = await OutShareInstance.insertOutShare(insertOutShareOptions);

              // Create OutShareItems for Each shareItemId and one outShare record
              //Status for Active/InActive items
              var insertShareItemOptions = {
                  shareItemIds: options.shareItemIds,
                  outSharingInstanceId: outSharingInstanceId
              };
              var outShareItem = await OutShareInstance.insertShareItems(insertShareItemOptions);
              debug('outshareitem', outShareItem);

              //Create OutSharePartners for Each inSharePartnersIds and one outShare record
              //status for in share record creation success /fail

              var insertSharePartnerOptions = {
                  accounts: options.accounts,
                  outSharingInstanceId: outSharingInstanceId
              };
              var outSharePartner = await OutShareInstance.insertSharePartner(insertSharePartnerOptions);

              /**
               * Update isRealTimeFrequency if freqType = realTime
               */
              if (options.freqType === Constants.OUT_SHARE_FREQ_TYPE.REAL_TIME) {
                  var updateOption = {
                      accountId: accountId,
                      shareItemIds: options.shareItemIds,
                      shareItemType: options.shareItemType
                  };
                  var updateResponse = await OutShareInstance.updateIsRealTimeFrequency(updateOption);
                  debug('updateResponse', updateResponse);
              }

              //Calling InShare create api
              //if (env.toLowerCase() === 'production') {
              //var url = 'http://localhost:3000/api/in-share/internal';
              //var url = 'https://test-be.scopehub.org/api/in-share/internal';
              //} else {
              //    debug('inside local url');
              //    var url = 'http://localhost:3000/api/in-share/internal';
              //}

              var option = {
                  outShareIds: outSharingInstanceIds,
                  accountId: options.accountId,
                  user: options.user
              };
              debug('options', option);
              //await conn.query('COMMIT;');
              InShareApi.createMD(option, errorOptions, async function (err, response) {
                  if (err) {
                      debug('err', err);
                      await conn.query('ROLLBACK;');
                      return cb(err);
                  }
                  debug('response', response);
                  await conn.query('COMMIT;');
                  response = {
                      OK: Constants.SUCCESS_MESSAGE.OUT_SHARE_CREATE_SUCCESS,
                      id: outSharingInstanceId,
                      status: Constants.OUT_SHARE_STATUS_ACTION.INVITATION_SENDING,
                      updatedAt: currentDate,
                      createdAt: currentDate,
                      offeredStartDate: offeredStartDate
                  };
                  return cb(null, response);
              });
              /*Util.log('Inside Call in share api', option);
              var opt = {
                  url: url,
                  method: 'POST',
                  json: true,
                  form: option
              };*/
              //await conn.query('COMMIT;');
              /* await Request(opt, async function (err, response, body) {
                   //debug('request', err, response, body);
                   if (err || response.statusCode >= 400) {
                       debug('err200', err);
                       err = err || new Error(ErrorConfig.MESSAGE.HTTP_REQUEST_FAILED);
                       err.status = err.status || ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                   }
                   if (err) {
                       debug('errrr', err);
                       await conn.query('ROLLBACK;');
                       errorOptions.err = err;
                       await ErrorUtils.create(errorOptions);
                       err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_CREATION_FAILED);
                       err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                       return cb(err);
                   }
                   debug('inside out share commit', body);
                   await conn.query('COMMIT;');
                   var response = {
                       OK: Constants.SUCCESS_MESSAGE.OUT_SHARE_CREATE_SUCCESS,
                       id: outSharingInstanceId,
                       status: Constants.OUT_SHARE_STATUS_ACTION.INVITATION_SENDING,
                       updatedAt: currentDate,
                       createdAt: currentDate,
                       offeredStartDate: offeredStartDate
                   };
                   return cb(null, response);
               });
 */
          } catch (err) {
              debug('err', err);
              await conn.query('ROLLBACK;');
              errorOptions.err = err;
              await ErrorUtils.create(errorOptions);
              if (err.code) {
                  err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_CREATION_FAILED);
                  err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
              }
              return cb(err);
          }
      },

      sendNotifications: async function (notificationOptions, cb) {

          var accountId = notificationOptions.accountId;
          var user = notificationOptions.user;
          var date = new Date();
          var currentDate = date.getTime();
          var err;
          try {
              var conn = await connection.getConnection();
          } catch (err) {
              debug('err', err);
              return cb(err);
          }
          try {

              var account = await conn.query('SELECT CAST(uuid_from_bin(id) as char) as id, companyName, email,' +
                ' status from accounts where id = uuid_to_bin(?) and status = "active"', [accountId]);

              account = Utils.filteredResponsePool(account);

              if (!account) {
                  return cb(null, null);
              }
              var query = 'select *,CAST(uuid_from_bin(id) as char) as id , ' +
                'CAST(uuid_from_bin(userId) as char) as userId ,CAST(uuid_from_bin(roleId) as char) as roleId from user_roles ' +
                'where userId in (select  id from users where accountId = uuid_to_bin(?)) and ' +
                'roleId in (select id from Roles where title in ("account admin", "account owner"))';

              var userIds = await conn.query(query, [notificationOptions.accountId]);

              Async.eachSeries(userIds, function (userId, calb) {

                  var ownerUUID = userId.userId;

                  OutShareInstance.getUser({ownerUUID: ownerUUID}, function (err, accountOwner) {

                      if (err) {
                          return calb();
                      }
                      if (!accountOwner) {
                          return calb();
                      }

                      var opt = {
                          languageCultureCode: accountOwner.languageCultureCode,
                          template: Constants.EMAIL_TEMPLATES.IN_SHARE_INVITE,
                          email: accountOwner.email
                      };

                      var compileOptions = {
                          name: accountOwner.firstName,
                          user_email: user.email,
                          scopehub_login: ''
                      };


                      var invitationExpirationDate = date.setDate(date.getDate() + Constants.CONTACT_INVITATION_EXPIRATION_DATE_LIMIT);
                      invitationExpirationDate = new Date(invitationExpirationDate);

                      EmailUtils.sendEmailMD(opt, compileOptions, async function (err) {

                          if (err) {
                              return calb(err);
                          }

                          try {
                              var NotificationApi = require('../api/notification');

                              var notificationSendOption = {
                                  refereId: notificationOptions.outSharingInstanceId,
                                  refereType: Constants.NOTIFICATION_REFERE_TYPE.IN_SHARE,
                                  user_ids: [accountOwner.id],
                                  topic_id: accountOwner.id,
                                  notificationExpirationDate: invitationExpirationDate,
                                  paramasDateTime: date,
                                  notification_reference: NotificationReferenceData.DATA_SHARE,
                                  metaEmail: user.email,
                                  paramsInviter: user.email + ', ' + (user.firstName ? user.firstName : '') + ' ' + (user.lastName ? user.lastName : ''),
                                  paramsInvitee: accountOwner.email + ', ' + (accountOwner.firstName ? accountOwner.firstName : '') + ' ' + (accountOwner.lastName ? accountOwner.lastName : ''),
                                  languageCultureCode: accountOwner.languageCultureCode,
                                  createdBy: user.id
                              };
                              if (user.firstName) {
                                  notificationSendOption.metaName = user.firstName;
                              }

                              await NotificationApi.createMD(notificationSendOption);
                              return calb();
                          } catch (err) {

                              if (err.code) {
                                  err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_NOTIFICATION_CREATION_FAILED);
                                  err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                              }
                              return calb(err);
                          }
                          ;

                      });

                  });

              }, async function (err) {
                  if (err) {
                      return cb(err);
                  }
                  try {
                      var id = Utils.generateId().uuid;

                      var inshareValues = [id, notificationOptions.outSharingInstanceId, accountId, Constants.INVITATION_STATUS.OPEN,
                          user.id, currentDate, currentDate];

                      await conn.query('INSERT into InShare SET id = uuid_to_bin(?),' +
                        'outShareInstanceId = uuid_to_bin(?),accountId = uuid_to_bin(?),status = ?,' +
                        'inShareId = "",inShareName = "",createdBy = uuid_to_bin(?),' +
                        'createdAt = ?,updatedAt = ?', inshareValues);

                      return cb(null, account);

                  } catch (err) {
                      if (err.code) {
                          err = new Error(ErrorConfig.MESSAGE.IN_SHARE_CREATION_FAILED);
                          err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                      }
                      return cb(err);
                  }
              });

          } catch (err) {

              if (err.code) {
                  err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_NOTIFICATION_CREATION_FAILED);
                  err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
              }
              return cb(err);
          }
      },

      getUser: async function (options, cb) {
          var userId = options.ownerUUID;
          var err;
          try {
              var conn = await connection.getConnection();
              var accountOwner = await conn.query('select CHAR(uuid_from_bin(id) as char) as id,status,flag,postRegComplete,firstName,lastName,' +
                'tosStatus, email,languageCultureCode from users where id = uuid_to_bin(?)', [userId]);

              accountOwner = Utils.filteredResponsePool(accountOwner);

              return cb(null, accountOwner);

          } catch (err) {

              if (err.code) {
                  err = new Error(ErrorConfig.MESSAGE.USER_GET_FAILED);
                  err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
              }
              return cb(err);
          }
      },

      getQueryForAllProfile: function (options) {
          return new Promise(function (resolve, reject) {
              try {
                  var response;
                  var groupQuery = '';
                  var tables = '';
                  var condition = '';
                  var values = [];
                  var shareItemTypeValue;

                  if (options === Constants.SHARING_TYPE.productInventory) {
                      debug('productInventory');
                      groupQuery = 'GROUP_CONCAT(PIR.sku separator ?) as sku,GROUP_CONCAT(PIR.locationId separator ?) as locationId,';
                      tables = 'ProductInventory PIR,';
                      condition = ' PIR.id = OSI.shareItemId AND ';
                      shareItemTypeValue = Constants.SHARING_TYPE.productInventory;
                      values.push(Constants.STRING_SEPARATOR, Constants.STRING_SEPARATOR);

                  } else if (options === Constants.SHARING_TYPE.supplyInventory) {
                      debug('supplyInventory');
                      groupQuery = 'GROUP_CONCAT(PIR.sku separator ?) as sku,GROUP_CONCAT(PIR.locationId separator ?) as locationId,';
                      tables = 'SupplyInventory PIR,';
                      condition = ' PIR.id = OSI.shareItemId AND ';
                      shareItemTypeValue = Constants.SHARING_TYPE.supplyInventory;
                      values.push(Constants.STRING_SEPARATOR, Constants.STRING_SEPARATOR);

                  } else if (options === Constants.SHARING_TYPE.productOrder) {
                      debug('productOrder');
                      groupQuery = 'GROUP_CONCAT(PIR.sku separator ?) as sku,';
                      tables = 'ProductReferences PIR,';
                      condition = ' PIR.id = OSI.shareItemId AND ';
                      shareItemTypeValue = Constants.SHARING_TYPE.productOrder;
                      values.push(Constants.STRING_SEPARATOR);
                  } else if (options === Constants.SHARING_TYPE.dependentDemand) {
                      groupQuery = ' GROUP_CONCAT(SIT.sku separator ?) AS sku, ';
                      tables = ' SupplyItems SIT, ';
                      condition = ' SIT.id = OSI.shareItemId AND ';
                      shareItemTypeValue = Constants.SHARING_TYPE.dependentDemand;
                      values.push(Constants.STRING_SEPARATOR);
                  }
                  response = {
                      groupQuery: groupQuery,
                      tables: tables,
                      condition: condition,
                      values: values,
                      shareItemTypeValue: shareItemTypeValue
                  };
                  return resolve(response);
              } catch (err) {
                  debug('err', err);
                  return reject(err);
              }
          });
      },

      getOutShareWithoutPartners: function (options) {
          return new Promise(async function (resolve, reject) {
              try {
                  var groupQuery = options.groupQuery;
                  var tables = options.tables;
                  var condition = options.condition;
                  var values = options.values;
                  var accountId = options.accountId;
                  var outShares = options.outShares;
                  var defaultChar = Constants.DEFAULT_CHARACTER;
                  var conn = await connection.getConnection();

                  var response = await ProductInventoryApi.manipulateOutShareQuery({
                      outShares: outShares
                  });

                  var outShareWithoutPartners = await conn.query('SELECT CAST(uuid_from_bin(OS.id) AS CHAR) AS id, ' +
                    ' CAST(uuid_from_bin(OS.sharingProfileId) AS CHAR) AS sharingProfileId, CAST(uuid_from_bin(OS.accountId) AS CHAR) ' +
                    ' AS accountId,OS.status,OS.outShareId,OS.createdAt,OS.actualSharingDate, OS.outShareName,OS.dataProtectionOption,' +
                    ' OS.shareItemType,OS.offeredStartDate,OS.startDateType,OS.updatedAt, OSP.profileName,OSP.profileId,OSP.sharedDataItems,' +
                    ' OSP.freqType,OSP.freqTime,OSP.freqDay,OSP.notes,' + groupQuery + ' ? as partnerNames FROM OutShare OS,OutSharingProfile OSP,' +
                    ' ' + tables + ' OutShareItems OSI WHERE OSI.outShareInstanceId = OS.id AND ' + condition + ' ' +
                    ' OSI.STATUS != ? AND OSP.id = OS.sharingProfileId AND OS.accountId = uuid_to_bin(?) AND ' +
                    ' OS.id IN (' + response.string + ') GROUP BY OS.id',
                    [].concat(values).concat([defaultChar, Constants.STATUS.DEACTIVE, accountId].concat(response.values)));

                  if (!outShareWithoutPartners || !DataUtils.isArray(outShareWithoutPartners)) {
                      return resolve([]);
                  }

                  return resolve(outShareWithoutPartners);

              } catch (err) {
                  debug('err', err);
                  return reject(err);
              }

          });
      },

      getOutShareData: function (options) {
          return new Promise(async function (resolve, reject) {
              try {
                  var groupQuery = options.groupQuery;
                  var tables = options.tables;
                  var condition = options.condition;
                  var values = options.values;
                  var shareItemTypeValue = options.shareItemTypeValue;
                  var accountId = options.accountId;
                  var searchCondition1 = options.searchCondition1;
                  var searchCondition2 = options.searchCondition2;
                  var searchCondition3 = options.searchCondition3;
                  var searchCondition4 = options.searchCondition4;
                  var searchCondition0 = options.searchCondition0;
                  var searchValue = options.searchValue;
                  var outShareQuery = options.outShareQuery;
                  var outShareQuery1 = '', outShareQuery2 = '', outShareQuery3 = '', outShareQuery4 = '',
                    outShareQuery5 = '';
                  var outShareValues = [];
                  var conn = await connection.getConnection();
                  debug('values', values);

                  if (outShareQuery) {
                      outShareQuery1 = ' and OS1.id IN ( ' + outShareQuery.string + ')';
                      outShareQuery2 = ' and OS2.id IN ( ' + outShareQuery.string + ')';
                      outShareQuery3 = ' and OS3.id IN ( ' + outShareQuery.string + ')';
                      outShareQuery4 = ' and OS4.id IN ( ' + outShareQuery.string + ')';
                      outShareQuery5 = ' and OS.id IN ( ' + outShareQuery.string + ')';
                      outShareValues = outShareQuery.values;
                  }

                  var accountIdSearchValue = [accountId].concat(outShareValues, searchValue);

                  var getOutSInstances = await conn.query('with Partners as (select  tbl1.name as name ,tbl1.id as id from (SELECT concat_ws(",",t1.s1,t2.c1) as name ,t1.id1 as id ' +
                    ' FROM (SELECT group_concat(Supp.supplierName) AS s1,OS1.id as id1 FROM Supplier Supp,OutSharePartners OSPart1,OutShare OS1 ' +
                    ' WHERE OS1.accountId = uuid_to_bin(?) ' + outShareQuery1 + ' and Supp.accountId=OS1.accountId ' +
                    ' and  OS1.id= OSPart1.outShareInstanceId and  Supp.suppliersAccountId = OSPart1.inSharePartnerId AND ' +
                    ' OSPart1.type="supplier" ' + searchCondition1 + ' group by OS1.id )t1 LEFT OUTER JOIN(SELECT group_concat(C.customerName) AS c1,OS2.id as id2 ' +
                    ' FROM Customers C,OutSharePartners OSPart2,OutShare OS2 WHERE OS2.accountId = uuid_to_bin(?) ' + outShareQuery2 + ' ' +
                    ' AND C.accountId=OS2.accountId and  OS2.id= OSPart2.outShareInstanceId and C.customersAccountId = OSPart2.inSharePartnerId AND ' +
                    ' OSPart2.type="customer" ' + searchCondition2 + ' group by OS2.id )t2 on t2.id2 = t1.id1 union SELECT concat_ws(",",t3.s1,t4.c1) as name ,t4.id2 as id ' +
                    ' FROM (SELECT group_concat(Supp1.supplierName) AS s1,OS3.id as id1 FROM Supplier Supp1,OutSharePartners OSPart3,OutShare OS3 ' +
                    ' WHERE OS3.accountId = uuid_to_bin(?) ' + outShareQuery3 + ' and Supp1.accountId=OS3.accountId and  OS3.id= OSPart3.outShareInstanceId and ' +
                    ' Supp1.suppliersAccountId = OSPart3.inSharePartnerId AND OSPart3.type="supplier" ' + searchCondition3 + ' group by OS3.id )t3 right OUTER JOIN ' +
                    ' (SELECT group_concat(C1.customerName) AS c1,OS4.id as id2 FROM Customers C1,OutSharePartners OSPart4,OutShare OS4 ' +
                    ' WHERE OS4.accountId = uuid_to_bin(?) ' + outShareQuery4 + ' AND C1.accountId=OS4.accountId and   OS4.id= OSPart4.outShareInstanceId and ' +
                    ' C1.customersAccountId = OSPart4.inSharePartnerId AND OSPart4.type="customer" ' + searchCondition4 + ' group by OS4.id )t4 ' +
                    ' on t3.id1 = t4.id2)tbl1 group by tbl1.id) ' +
                    ' SELECT CAST(uuid_from_bin(OS.id) AS CHAR) AS id, CAST(uuid_from_bin(OS.sharingProfileId) AS CHAR) AS sharingProfileId, CAST(uuid_from_bin(OS.accountId) AS CHAR) ' +
                    ' AS accountId,OS.status,OS.outShareId,OS.createdAt,OS.actualSharingDate,' +
                    ' OS.outShareName,OS.dataProtectionOption,OS.shareItemType,OS.offeredStartDate,OS.startDateType,OS.updatedAt, OSP.profileName,' +
                    ' OSP.profileId,OSP.sharedDataItems,OSP.freqType,OSP.freqTime,OSP.freqDay,OSP.notes, ' + groupQuery +
                    ' P.name as partnerNames FROM OutShare OS,Partners P,' +
                    ' OutSharingProfile OSP,' + tables + ' OutShareItems OSI ' +
                    ' WHERE OSI.outShareInstanceId = OS.id AND' + condition + ' OSI.status != ? AND OSP.id = OS.sharingProfileId AND ' +
                    ' OS.accountId = uuid_to_bin(?) and OS.shareItemType = ? and P.id = OS.id ' + searchCondition0 +
                    ' ' + outShareQuery5 + '  GROUP BY OS.id',
                    accountIdSearchValue.concat(accountIdSearchValue, accountIdSearchValue, accountIdSearchValue, values,
                      [Constants.STATUS.DEACTIVE, accountId, shareItemTypeValue], searchValue.concat(outShareValues)));

                  //[accountId].concat(searchValue).concat([accountId].concat(searchValue)), accountId, accountId].concat(values).concat([Constants.STATUS.DEACTIVE, accountId, shareItemTypeValue]));


                  if (!getOutSInstances || !DataUtils.isArray(getOutSInstances) || getOutSInstances.length < 1) {
                      return resolve([]);
                  }

                  return resolve(getOutSInstances);

              } catch (err) {
                  debug('err', err);
                  return reject(err);
              }

          });
      },

      getOutShareWithoutItemPartners: function (options) {
          return new Promise(async function (resolve, reject) {
              debug('options', options);
              var accountId = options.accountId;
              var shareItemType1 = options.shareItemType1;
              var shareItemType2 = options.shareItemType2;
              var searchCondition = options.searchCondition;
              var searchValue = options.searchValue;
              var outShareQuery = options.outShareQuery;
              var itemMissing = Constants.OUT_SHARE_MISSING_FLAG.ITEM;
              var partnerMissing = Constants.OUT_SHARE_MISSING_FLAG.PARTNER;
              var outShareString = '', outShareValues = [];

              try {
                  var conn = await connection.getConnection();

                  if (outShareQuery) {
                      outShareString += ' and OS.id IN (' + outShareQuery.string + ') ';
                      outShareValues = outShareValues.concat(outShareQuery.values);
                  }

                  var outShares = await conn.query('SELECT CAST(uuid_from_bin(OS.id) AS CHAR) AS id ,OS.STATUS,OS.shareItemType,? AS flag FROM ' +
                    ' OutShare OS WHERE OS.accountId = uuid_to_bin(?) AND (OS.shareItemType = ? OR OS.shareItemType = ?) AND ' +
                    ' OS.id NOT IN (SELECT outShareInstanceId FROM OutShareItems WHERE STATUS = 1) ' + searchCondition + ' ' +
                    ' ' + outShareString + ' ' +
                    ' UNION ALL ' +
                    ' SELECT uuid_from_bin(OS.id),OS.STATUS,OS.shareItemType,? AS flag FROM OutShare OS WHERE ' +
                    ' OS.accountId = uuid_to_bin(?) AND (OS.shareItemType = ? OR OS.shareItemType = ?) AND ' +
                    ' OS.id NOT IN (SELECT outShareInstanceId FROM OutSharePartners) ' + searchCondition + ' ' +
                    ' ' + outShareString + ' ',
                    [itemMissing, accountId, shareItemType1, shareItemType2].concat(searchValue).concat(outShareValues)
                      .concat([partnerMissing, accountId, shareItemType1, shareItemType2]).concat(outShareValues).concat(searchValue));

                  if (!outShares || !DataUtils.isArray(outShares)) {
                      return resolve([]);
                  }
                  return resolve(outShares);
              } catch (err) {
                  debug('err', err);
                  return reject(err);
              }
          });
      },

      filterDuplicateOutShare: function (options) {
          return new Promise(function (resolve, reject) {
              var outSharesWithNoItemPartner = options.outSharesWithNoItemPartner;
              var outShares = [], duplicateOutShares = [];

              var ids = _.map(outSharesWithNoItemPartner, 'id');
              var duplicateArray = [];
              var outShareIds = Utils.convertMutable(ids);

              _.map(outShareIds, function (Aid) {
                  var c = 0;
                  _.map(outShareIds, function (Bid) {
                      if (Aid === Bid) {
                          c++;
                      }
                      if (c > 1 && duplicateArray.indexOf(Aid) === -1) {
                          debug('Inside if');
                          duplicateArray.push(Aid);
                      }
                  });
              });
              _.map(duplicateArray, function (d) {
                  outShareIds = outShareIds.filter(function (c) {
                      return c !== d;
                  });
              });

              _.map(outShareIds, function (id) {
                  var index = _.findIndex(outSharesWithNoItemPartner, function (outshare) {
                      return outshare.id === id;
                  });
                  if (index !== -1) {
                      outShares.push(outSharesWithNoItemPartner[index]);
                  }
              });

              _.map(duplicateArray, function (id) {
                  var index = _.findIndex(outSharesWithNoItemPartner, function (outshare) {
                      return outshare.id === id;
                  });
                  if (index !== -1) {
                      duplicateOutShares.push(outSharesWithNoItemPartner[index]);
                  }
              });

              var itemMissingOutShare = [], partnerMissingOutShare = [];

              if (outShares.length > 0) {
                  _.map(outShares, function (outShare) {
                      if (parseInt(outShare.flag) === Constants.OUT_SHARE_MISSING_FLAG.ITEM) {
                          itemMissingOutShare.push(outShare);
                      } else if (parseInt(outShare.flag) === Constants.OUT_SHARE_MISSING_FLAG.PARTNER) {
                          partnerMissingOutShare.push(outShare);
                      }
                  });
              }
              return resolve({
                  itemMissingOutShares: itemMissingOutShare,
                  partnerMissingOutShares: partnerMissingOutShare,
                  duplicateOutShares: duplicateOutShares
              });
          });
      },

      getOutShareWithoutItems: function (options) {
          return new Promise(async function (resolve, reject) {
              var outShares = options.outShares;
              var accountId = options.accountId;
              var values = [];
              var defaultString = Constants.DEFAULT_CHARACTER;
              var err;

              try {
                  var conn = await connection.getConnection();

                  var response = await ProductInventoryApi.manipulateOutShareQuery({
                      outShares: outShares
                  });
                  values = [accountId].concat(response.values);

                  var outShareWithoutItems = await conn.query('WITH Partners AS (SELECT tbl1.name AS name,tbl1.id AS id ' +
                    ' FROM (SELECT CONCAT_WS(",",t1.s1,t2.c1) AS name,t1.id1 AS id FROM ( SELECT GROUP_CONCAT(Supp.supplierName) AS s1,' +
                    ' OS1.id AS id1 FROM Supplier Supp,OutSharePartners OSPart1,OutShare OS1 WHERE OS1.accountId = uuid_to_bin(?) ' +
                    ' AND Supp.accountId=OS1.accountId AND OSPart1.outShareInstanceId IN (' + response.string + ') ' +
                    ' AND OS1.id= OSPart1.outShareInstanceId AND Supp.suppliersAccountId = OSPart1.inSharePartnerId AND ' +
                    ' OSPart1.type="supplier" GROUP BY OS1.id)t1 LEFT OUTER JOIN( SELECT GROUP_CONCAT(C.customerName) AS c1,OS2.id AS id2 ' +
                    ' FROM Customers C,OutSharePartners OSPart2,OutShare OS2 WHERE OS2.accountId = uuid_to_bin(?) AND C.accountId=OS2.accountId ' +
                    ' AND OSPart2.outShareInstanceId IN (' + response.string + ') AND OS2.id= OSPart2.outShareInstanceId AND C.customersAccountId = OSPart2.inSharePartnerId ' +
                    ' AND  OSPart2.type="customer" GROUP BY OS2.id)t2 ON t2.id2 = t1.id1 ' +
                    ' UNION ' +
                    ' SELECT CONCAT_WS(",",t3.s1,t4.c1) AS name,t4.id2 AS id FROM (SELECT GROUP_CONCAT(Supp1.supplierName) AS s1,OS3.id AS id1 ' +
                    ' FROM Supplier Supp1,OutSharePartners OSPart3,OutShare OS3 WHERE OS3.accountId = uuid_to_bin(?) AND Supp1.accountId=OS3.accountId ' +
                    ' AND OSPart3.outShareInstanceId IN (' + response.string + ') AND OS3.id= OSPart3.outShareInstanceId AND Supp1.suppliersAccountId = OSPart3.inSharePartnerId ' +
                    ' AND OSPart3.type="supplier" GROUP BY OS3.id)t3 RIGHT OUTER JOIN (SELECT GROUP_CONCAT(C1.customerName) AS c1,OS4.id AS id2 ' +
                    ' FROM Customers C1,OutSharePartners OSPart4,OutShare OS4 WHERE OS4.accountId = uuid_to_bin(?) AND C1.accountId=OS4.accountId ' +
                    ' AND OSPart4.outShareInstanceId IN (' + response.string + ') and OS4.id= OSPart4.outShareInstanceId AND C1.customersAccountId = OSPart4.inSharePartnerId ' +
                    ' AND OSPart4.type="customer" GROUP BY OS4.id)t4 ON t3.id1 = t4.id2)tbl1 GROUP BY tbl1.id)' +
                    ' ' +
                    ' SELECT CAST(uuid_from_bin(OS.id) AS CHAR) AS id, CAST(uuid_from_bin(OS.sharingProfileId) AS CHAR) AS sharingProfileId, ' +
                    ' CAST(uuid_from_bin(OS.accountId) AS CHAR) AS accountId,OS.status,OS.outShareId,OS.createdAt,OS.actualSharingDate,' +
                    ' OS.outShareName,OS.dataProtectionOption,OS.shareItemType,OS.offeredStartDate,OS.startDateType,OS.updatedAt, OSP.profileName,' +
                    ' OSP.profileId,OSP.sharedDataItems,OSP.freqType,OSP.freqTime,OSP.freqDay,' +
                    ' OSP.notes, ? as sku,? as locationId, P.name AS partnerNames FROM OutShare OS,Partners P,OutSharingProfile OSP ' +
                    ' WHERE OSP.id = OS.sharingProfileId AND OS.accountId = uuid_to_bin(?) AND OS.id IN (' + response.string + ') AND P.id = OS.id ' +
                    ' GROUP BY OS.id', values.concat(values).concat(values).concat(values).concat([defaultString, defaultString]).concat(values));

                  if (!outShareWithoutItems || !DataUtils.isArray(outShareWithoutItems)) {
                      return resolve([]);
                  }
                  return resolve(outShareWithoutItems);
              } catch (err) {
                  debug('err', err);
                  return reject(err);
              }
          });
      },

      getOutShareWithoutItemsAndPartners: function (options) {
          return new Promise(async function (resolve, reject) {
              var outShares = options.outShares;
              var accountId = options.accountId;
              var defaultString = Constants.DEFAULT_CHARACTER;
              var err;

              try {
                  var conn = await connection.getConnection();

                  var response = await ProductInventoryApi.manipulateOutShareQuery({
                      outShares: outShares
                  });
                  var outShareWithoutItemsAndPartners = await conn.query('SELECT CAST(uuid_from_bin(OS.id) AS CHAR) AS id, ' +
                    ' CAST(uuid_from_bin(OS.sharingProfileId) AS CHAR) AS sharingProfileId, CAST(uuid_from_bin(OS.accountId) AS CHAR) AS accountId,' +
                    ' OS.status,OS.outShareId,OS.createdAt,OS.actualSharingDate,OS.outShareName,OS.dataProtectionOption,' +
                    ' OS.shareItemType,OS.offeredStartDate,OS.startDateType,OS.updatedAt, OSP.profileName,' +
                    ' OSP.profileId,OSP.sharedDataItems,OSP.freqType,OSP.freqTime,OSP.freqDay,' +
                    ' OSP.notes, ? as sku,? as locationId, ? AS partnerNames FROM OutShare OS,OutSharingProfile OSP ' +
                    ' WHERE OSP.id = OS.sharingProfileId AND OS.accountId = uuid_to_bin(?) AND OS.id IN (' + response.string + ') ' +
                    ' GROUP BY OS.id', [defaultString, defaultString, defaultString, accountId].concat(response.values));
                  if (!outShareWithoutItemsAndPartners || !DataUtils.isArray(outShareWithoutItemsAndPartners)) {
                      return resolve([]);
                  }
                  return resolve(outShareWithoutItemsAndPartners);
              } catch (err) {
                  debug('err', err);
                  return reject(err);
              }
          });
      },

      getByAccountIdMD: async function (options, errorOptions, cb) {
          var accountId = options.accountId;
          var shareItemReference = parseInt(options.shareItemReference);
          var outShare = [];
          var searchCondition = '', searchValue = [];
          var searchCondition1 = '', searchCondition2 = '', searchCondition3 = '', searchCondition4 = '',
            searchCondition0 = '';
          var shareItemType1, shareItemType2, shareItemTypes = [];
          var itemMissingOutShares = [], partnerMissingOutShares = [], duplicateOutShares = [];
          var err;

          if (DataUtils.isUndefined(accountId)) {
              err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
          } else if (DataUtils.isUndefined(shareItemReference)) {
              err = new Error(ErrorConfig.MESSAGE.SHARE_ITEM_REFERENCE_IS_MISSING);
          }
          if (err) {
              err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
              debug('err', err);
              return cb(err);
          }

          try {
              var conn = await connection.getConnection();

              //GET shareItemTypes
              debug('shareItemReference', shareItemReference);
              if (shareItemReference === Constants.SHARE_ITEM_REFERENCE.PRODUCT) {
                  debug('Inside if12345');
                  shareItemType1 = Constants.SHARING_TYPE.productInventory;
                  shareItemType2 = Constants.SHARING_TYPE.productOrder;
                  shareItemTypes.push(shareItemType1, shareItemType2);
              } else if (shareItemReference === Constants.SHARE_ITEM_REFERENCE.SUPPLY) {
                  debug('Inside if12345');
                  shareItemType1 = Constants.SHARING_TYPE.supplyInventory;
                  shareItemType2 = Constants.SHARING_TYPE.dependentDemand;
                  shareItemTypes.push(shareItemType1, shareItemType2);
              }

              var records = await conn.query('SELECT CAST(uuid_from_bin(id) as CHAR) as id from OutShare ' +
                'where accountId = uuid_to_bin(?) and (shareItemType = ? or shareItemType = ?) order by updatedAt desc limit 10',
                [accountId].concat(shareItemTypes));

              debug('records', records.length);

              if (records.length <= 0) {
                  return cb(null, outShare);
              }

              var outShareQuery = await ProductInventoryApi.manipulateOutShareQuery({outShares: records});
              debug('outShareQuery', outShareQuery);

              // Get outshare with no item and partner
              var outSharesWithNoItemPartner = await OutShareInstance.getOutShareWithoutItemPartners({
                  accountId: accountId,
                  shareItemType1: shareItemType1,
                  shareItemType2: shareItemType2,
                  searchCondition: searchCondition,
                  searchValue: searchValue,
                  outShareQuery: outShareQuery
              });
              debug('outSharesWithNoItemPartner', outSharesWithNoItemPartner.length);

              // Filter outshare which has item and partner
              var outSharesWithItemPartnerIdsArray = [];
              var outSharesWithNoItemPartnerIds = _.map(outSharesWithNoItemPartner, 'id');
              _.each(outShareQuery.values, function (value) {
                  if (outSharesWithNoItemPartnerIds.indexOf(value) === -1) {
                      outSharesWithItemPartnerIdsArray.push({id: value});
                  }
              });
              debug('outSharesWithItemPartnerIdsArray', outSharesWithItemPartnerIdsArray);

              outShareQuery = await ProductInventoryApi.manipulateOutShareQuery({outShares: outSharesWithItemPartnerIdsArray});
              debug('outShareQuery', outShareQuery);

              //Filter duplicate outshare(missing item and partner both)
              var filterResponse = await OutShareInstance.filterDuplicateOutShare({outSharesWithNoItemPartner: outSharesWithNoItemPartner});
              debug('filterResponse', filterResponse);
              itemMissingOutShares = filterResponse.itemMissingOutShares;
              partnerMissingOutShares = filterResponse.partnerMissingOutShares;
              duplicateOutShares = filterResponse.duplicateOutShares;

              if (itemMissingOutShares.length > 0) {
                  var getOption = {
                      accountId: accountId,
                      outShares: itemMissingOutShares
                  };
                  var outShareWithoutItems = await OutShareInstance.getOutShareWithoutItems(getOption);
                  debug('outSharewithoutItems', outShareWithoutItems.length);
              }
              if (duplicateOutShares.length > 0) {
                  getOption = {
                      accountId: accountId,
                      outShares: duplicateOutShares
                  };
                  var outShareWithoutItemsAndPartners = await OutShareInstance.getOutShareWithoutItemsAndPartners(getOption);
                  debug('outShareWithoutItemsAndPartners', outShareWithoutItemsAndPartners.length);
              }

              debug('shareItemTypes', shareItemTypes);
              await Promise.each(shareItemTypes, async function (profileType) {
                  debug('profileType', profileType);
                  var response = await OutShareInstance.getQueryForAllProfile(profileType);
                  response.accountId = accountId;
                  debug('response', response);

                  if (response.groupQuery && response.tables && response.condition && response.values) {
                      var outShareIdsWithoutPartners = partnerMissingOutShares.filter(function (outshare) {
                          debug('========', Constants.OUT_SHARE_PROFILE_TYPES[profileType]);
                          return outshare.shareItemType === profileType;
                          //return outshare.shareItemType === Constants.OUT_SHARE_PROFILE_TYPES[profileType];
                      });
                      debug('outShareIdsWithoutPartners', outShareIdsWithoutPartners);
                      response.outShares = outShareIdsWithoutPartners;
                      if (outShareIdsWithoutPartners && outShareIdsWithoutPartners.length > 0) {
                          var outShareWithoutPartners = await OutShareInstance.getOutShareWithoutPartners(response);
                          outShare = outShare.concat(outShareWithoutPartners);
                      }

                      // if there is outshare with items and partners
                      if (outShareQuery.values.length > 0) {
                          response.searchCondition1 = searchCondition1;
                          response.searchCondition2 = searchCondition2;
                          response.searchCondition3 = searchCondition3;
                          response.searchCondition4 = searchCondition4;
                          response.searchCondition0 = searchCondition0;
                          response.searchValue = searchValue;
                          response.outShareQuery = outShareQuery;
                          debug('outShareQuery========', outShareQuery);
                          var getOutSInstances = await OutShareInstance.getOutShareData(response);
                          debug('getOutSInstances========', getOutSInstances);
                          if (getOutSInstances) {
                              outShare = outShare.concat(getOutSInstances);
                          }
                      }
                  }
              });

              if (outShareWithoutItems) {
                  outShare = outShare.concat(outShareWithoutItems);
              }
              if (outShareWithoutItemsAndPartners) {
                  outShare = outShare.concat(outShareWithoutItemsAndPartners);
              }

              //outShare = outShare.concat(outShareWithoutItems).concat(outShareWithoutItemsAndPartners);

              await Promise.each(outShare, async function (getOutSInstance) {

                  getOutSInstance.shareItemType = Object.keys(Constants.SHARING_TYPE)[Object.values(Constants.SHARING_TYPE).indexOf(getOutSInstance.shareItemType)];

                  var startDateType = Object.keys(Constants.OUT_SHARE_START_DATE)[Object.values(Constants.OUT_SHARE_START_DATE).indexOf(getOutSInstance.startDateType)];
                  getOutSInstance.startDateType = Constants.OUT_SHARE_START_DATE_TYPE[startDateType];

                  if (DataUtils.isDefined(getOutSInstance.sku)) {
                      if (getOutSInstance.sku.length === 1) {
                          getOutSInstance.sku = [];
                      } else {
                          getOutSInstance.sku = getOutSInstance.sku.split(Constants.STRING_SEPARATOR);
                      }
                  }
                  if (DataUtils.isDefined(getOutSInstance.productReferenceSKU)) {
                      if (getOutSInstance.productReferenceSKU.length === 1) {
                          getOutSInstance.productReferenceSKU = [];
                      } else {
                          getOutSInstance.productReferenceSKU = getOutSInstance.productReferenceSKU.split(Constants.STRING_SEPARATOR);
                      }
                  }
                  if (DataUtils.isDefined(getOutSInstance.supplyItemSKU)) {
                      if (getOutSInstance.supplyItemSKU.length === 1) {
                          getOutSInstance.supplyItemSKU = [];
                      } else {
                          getOutSInstance.supplyItemSKU = getOutSInstance.supplyItemSKU.split(Constants.STRING_SEPARATOR);
                      }
                  }
                  if (DataUtils.isDefined(getOutSInstance.sharedDataItems)) {
                      getOutSInstance.sharedDataItems = getOutSInstance.sharedDataItems.split(',');
                      var temp = [];
                      _.each(getOutSInstance.sharedDataItems, function (item) {
                          temp.push(parseInt(item));
                      });
                      getOutSInstance.sharedDataItems = temp;
                  }
                  if (DataUtils.isDefined(getOutSInstance.locationId)) {
                      if (getOutSInstance.locationId.length === 1) {
                          getOutSInstance.locationId = [];
                      } else {
                          getOutSInstance.locationId = getOutSInstance.locationId.split(Constants.STRING_SEPARATOR);
                      }
                  }
                  if (DataUtils.isDefined(getOutSInstance.partnerNames)) {
                      if (getOutSInstance.partnerNames.length === 1) {
                          getOutSInstance.partnerNames = [];
                      } else {
                          getOutSInstance.partnerNames = getOutSInstance.partnerNames.split(',');
                      }
                  }
              });

              outShare = _.orderBy(outShare, ['updatedAt'], ['desc']);
              debug('Outside !isSearch');

              return cb(null, outShare);

          } catch (err) {
              debug('err', err);
              errorOptions.err = err;
              await ErrorUtils.create(errorOptions);
              err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_GET_FAILED);
              err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
              return cb(err);
          }
      },

      searchOutShares: async function (options, errorOptions, cb) {
          var accountId = options.accountId;
          var shareItemReference = parseInt(options.shareItemReference);
          var outShareId = options.outShareId;
          var outShareName = options.outShareName;
          var searchCondition = '', searchValue = [];
          var searchCondition1 = '', searchCondition2 = '', searchCondition3 = '', searchCondition4 = '',
            searchCondition0 = '';
          var outShare = [];
          var shareItemType1, shareItemType2, shareItemTypes = [];
          var itemMissingOutShares = [], partnerMissingOutShares = [], duplicateOutShares = [];
          var err;

          if (DataUtils.isUndefined(accountId)) {
              err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
          } else if (DataUtils.isUndefined(shareItemReference)) {
              err = new Error(ErrorConfig.MESSAGE.SHARE_ITEM_REFERENCE_IS_MISSING);
          }
          if (err) {
              err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
              debug('err', err);
              return cb(err);
          }

          try {
              if (DataUtils.isDefined(outShareId)) {
                  searchCondition = ' AND outShareId like ? ';
                  searchCondition1 = ' AND OS1.outShareId like ? ';
                  searchCondition2 = ' AND OS2.outShareId like ? ';
                  searchCondition3 = ' AND OS3.outShareId like ? ';
                  searchCondition4 = ' AND OS4.outShareId like ? ';
                  searchCondition0 = ' AND OS.outShareId like ? ';
                  searchValue.push('%' + outShareId + '%');
              }
              if (DataUtils.isDefined(outShareName)) {
                  searchCondition = ' AND outShareName like ? ';
                  searchCondition1 = ' AND OS1.outShareName like ? ';
                  searchCondition2 = ' AND OS2.outShareName like ? ';
                  searchCondition3 = ' AND OS3.outShareName like ? ';
                  searchCondition4 = ' AND OS4.outShareName like ? ';
                  searchCondition0 = ' AND OS.outShareName like ? ';
                  searchValue.push('%' + outShareName + '%');
              }

              //GET shareItemTypes
              debug('shareItemReference', shareItemReference);
              if (shareItemReference === Constants.SHARE_ITEM_REFERENCE.PRODUCT) {
                  debug('Inside if12345');
                  shareItemType1 = Constants.SHARING_TYPE.productInventory;
                  shareItemType2 = Constants.SHARING_TYPE.productOrder;
                  shareItemTypes.push(shareItemType1, shareItemType2);
              } else if (shareItemReference === Constants.SHARE_ITEM_REFERENCE.SUPPLY) {
                  debug('Inside if12345');
                  shareItemType1 = Constants.SHARING_TYPE.supplyInventory;
                  shareItemType2 = Constants.SHARING_TYPE.dependentDemand;
                  shareItemTypes.push(shareItemType1, shareItemType2);
              }

              // Get outshare with no item and partner
              var outSharesWithNoItemPartner = await OutShareInstance.getOutShareWithoutItemPartners({
                  accountId: accountId,
                  shareItemType1: shareItemType1,
                  shareItemType2: shareItemType2,
                  searchCondition: searchCondition,
                  searchValue: searchValue
              });
              debug('outSharesWithNoItemPartner', outSharesWithNoItemPartner.length);

              //Filter duplicate outshare(missing item and partner both)
              var filterResponse = await OutShareInstance.filterDuplicateOutShare({outSharesWithNoItemPartner: outSharesWithNoItemPartner});
              debug('filterResponse', filterResponse);
              itemMissingOutShares = filterResponse.itemMissingOutShares;
              partnerMissingOutShares = filterResponse.partnerMissingOutShares;
              duplicateOutShares = filterResponse.duplicateOutShares;

              if (itemMissingOutShares.length > 0) {
                  var getOption = {
                      accountId: accountId,
                      outShares: itemMissingOutShares
                  };
                  var outShareWithoutItems = await OutShareInstance.getOutShareWithoutItems(getOption);
                  debug('outSharewithoutItems', outShareWithoutItems.length);
              }
              if (duplicateOutShares.length > 0) {
                  getOption = {
                      accountId: accountId,
                      outShares: duplicateOutShares
                  };
                  var outShareWithoutItemsAndPartners = await OutShareInstance.getOutShareWithoutItemsAndPartners(getOption);
                  debug('outShareWithoutItemsAndPartners', outShareWithoutItemsAndPartners);
              }

              await Promise.each(shareItemTypes, async function (profileType) {
                  debug('profileType', profileType);
                  var response = await OutShareInstance.getQueryForAllProfile(profileType);
                  response.accountId = accountId;
                  if (response.groupQuery && response.tables && response.condition && response.values) {
                      //
                      var outShareIdsWithoutPartners = partnerMissingOutShares.filter(function (outshare) {
                          return outshare.shareItemType === profileType;
                          //return outshare.shareItemType === Constants.SHARING_TYPE[profileType];
                      });
                      debug('outShareIdsWithoutPartners', outShareIdsWithoutPartners);
                      response.outShares = outShareIdsWithoutPartners;
                      if (outShareIdsWithoutPartners && outShareIdsWithoutPartners.length > 0) {
                          var outShareWithoutPartners = await OutShareInstance.getOutShareWithoutPartners(response);
                          outShare = outShare.concat(outShareWithoutPartners);
                      }

                      response.searchCondition1 = searchCondition1;
                      response.searchCondition2 = searchCondition2;
                      response.searchCondition3 = searchCondition3;
                      response.searchCondition4 = searchCondition4;
                      response.searchCondition0 = searchCondition0;
                      response.searchValue = searchValue;
                      var getOutSInstances = await OutShareInstance.getOutShareData(response);
                      if (getOutSInstances) {
                          outShare = outShare.concat(getOutSInstances);
                      }
                  }
              });

              if (outShareWithoutItems) {
                  outShare = outShare.concat(outShareWithoutItems);
              }
              if (outShareWithoutItemsAndPartners) {
                  outShare = outShare.concat(outShareWithoutItemsAndPartners);
              }

              await Promise.each(outShare, async function (getOutSInstance) {

                  getOutSInstance.shareItemType = Object.keys(Constants.SHARING_TYPE)[Object.values(Constants.SHARING_TYPE).indexOf(getOutSInstance.shareItemType)];

                  var startDateType = Object.keys(Constants.OUT_SHARE_START_DATE)[Object.values(Constants.OUT_SHARE_START_DATE).indexOf(getOutSInstance.startDateType)];
                  getOutSInstance.startDateType = Constants.OUT_SHARE_START_DATE_TYPE[startDateType];

                  if (DataUtils.isDefined(getOutSInstance.sku)) {
                      if (getOutSInstance.sku.length === 1) {
                          getOutSInstance.sku = [];
                      } else {
                          getOutSInstance.sku = getOutSInstance.sku.split(Constants.STRING_SEPARATOR);
                      }
                  }
                  if (DataUtils.isDefined(getOutSInstance.productReferenceSKU)) {
                      if (getOutSInstance.productReferenceSKU.length === 1) {
                          getOutSInstance.productReferenceSKU = [];
                      } else {
                          getOutSInstance.productReferenceSKU = getOutSInstance.productReferenceSKU.split(Constants.STRING_SEPARATOR);
                      }
                  }
                  if (DataUtils.isDefined(getOutSInstance.supplyItemSKU)) {
                      if (getOutSInstance.supplyItemSKU.length === 1) {
                          getOutSInstance.supplyItemSKU = [];
                      } else {
                          getOutSInstance.supplyItemSKU = getOutSInstance.supplyItemSKU.split(Constants.STRING_SEPARATOR);
                      }
                  }
                  if (DataUtils.isDefined(getOutSInstance.sharedDataItems)) {
                      getOutSInstance.sharedDataItems = getOutSInstance.sharedDataItems.split(',');
                      var temp = [];
                      _.each(getOutSInstance.sharedDataItems, function (item) {
                          temp.push(parseInt(item));
                      });
                      getOutSInstance.sharedDataItems = temp;
                  }
                  if (DataUtils.isDefined(getOutSInstance.locationId)) {
                      if (getOutSInstance.locationId.length === 1) {
                          getOutSInstance.locationId = [];
                      } else {
                          getOutSInstance.locationId = getOutSInstance.locationId.split(Constants.STRING_SEPARATOR);
                      }
                  }
                  if (DataUtils.isDefined(getOutSInstance.partnerNames)) {
                      if (getOutSInstance.partnerNames.length === 1) {
                          getOutSInstance.partnerNames = [];
                      } else {
                          getOutSInstance.partnerNames = getOutSInstance.partnerNames.split(',');
                      }
                  }
              });

              outShare = _.orderBy(outShare, ['updatedAt'], ['desc']);
              debug('Outside !isSearch');

              return cb(null, outShare);

          } catch (err) {
              debug('err', err);
              errorOptions.err = err;
              await ErrorUtils.create(errorOptions);
              err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_GET_FAILED);
              err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
              return cb(err);
          }
      },

      getEFSDetail: function (options) {
          return new Promise(function (resolve, reject) {
              var EFS = require('../model/efs');
              EFS.describeFileSystems({}, function (err, data) {
                  if (err) {
                      Util.log('error', err, err.stack); // an error occurred
                      return resolve(Constants.OK_MESSAGE);
                  } else {
                      Util.log('data', data);
                      return resolve(Constants.OK_MESSAGE);
                  }
              });
          });
      },

      getQueryForShareItemType: function (options) {
          return new Promise(function (resolve, reject) {
              var shareItemType = options.shareItemType;
              var groupQuery = '';
              var tables = '';
              var condition = '';
              var values = [];
              try {
                  if (shareItemType === Constants.OUT_SHARE_PROFILE_TYPE.PRODUCT_INVENTORY) {
                      groupQuery = 'GROUP_CONCAT(PIR.sku separator ?) as sku,GROUP_CONCAT(PIR.locationId separator ?) as locationId, ' +
                        'GROUP_CONCAT(ProdRef.sellerSKUName separator ?) as sellerSKUName,GROUP_CONCAT(LocRef.locationName separator ?) as locationName,';
                      tables = 'ProductInventory PIR,ProductReferences ProdRef,LocationReference LocRef ';
                      condition = ' PIR.id = OSI.shareItemId and PIR.productRefId = ProdRef.id and PIR.locationId = LocRef.locationId and LocRef.accountId = OS.accountId';
                      values.push(Constants.STRING_SEPARATOR, Constants.STRING_SEPARATOR, Constants.STRING_SEPARATOR, Constants.STRING_SEPARATOR);
                  } else if (shareItemType === Constants.OUT_SHARE_PROFILE_TYPE.SUPPLY_INVENTORY) {
                      groupQuery = 'GROUP_CONCAT(SIN.sku separator ?) as sku,GROUP_CONCAT(SIN.locationId separator ?) as locationId, ' +
                        'GROUP_CONCAT(SI.sellerSKUName separator ?) as sellerSKUName,GROUP_CONCAT(LocRef.locationName separator ?) as locationName,';
                      tables = 'SupplyInventory SIN,SupplyItems SI,LocationReference LocRef ';
                      condition = ' SIN.id = OSI.shareItemId and SIN.supplyItemId = SI.id and SIN.locationId = LocRef.locationId and LocRef.accountId = OS.accountId';
                      values.push(Constants.STRING_SEPARATOR, Constants.STRING_SEPARATOR, Constants.STRING_SEPARATOR, Constants.STRING_SEPARATOR);
                  } else if (shareItemType === Constants.OUT_SHARE_PROFILE_TYPE.PRODUCT_ORDERS) {
                      groupQuery = 'GROUP_CONCAT(PR.sku separator ?) as sku,GROUP_CONCAT(PR.sellerSKUName separator ?) as sellerSKUName ,';
                      tables = 'ProductReferences PR ';
                      condition = ' PR.id = OSI.shareItemId ';
                      values.push(Constants.STRING_SEPARATOR, Constants.STRING_SEPARATOR);
                  } else if (shareItemType === Constants.OUT_SHARE_PROFILE_TYPE.DEPENDENT_DEMAND) {
                      groupQuery = ' GROUP_CONCAT(SIT.sku separator ?) AS supplyItemSKU,GROUP_CONCAT(SIT.sellerSKUName separator ?) AS supplyItemSellerSKUName,';
                      tables = ' SupplyItems SIT ';
                      condition = ' SIT.id = OSI.shareItemId ';
                      values.push(Constants.STRING_SEPARATOR, Constants.STRING_SEPARATOR);
                  }
                  var response = {
                      groupQuery: groupQuery,
                      tables: tables,
                      condition: condition,
                      values: values
                  };
                  return resolve(response);

              } catch (err) {
                  debug('err', err);
                  return reject(err);
              }
          });
      },

      getByIdAndAccountIdMD: async function (options, errorOptions, cb) {
          var accountId = options.accountId;
          var shareItemType = options.shareItemType;
          var err;
          if (DataUtils.isUndefined(accountId)) {
              err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
          } else if (DataUtils.isUndefined(options.id)) {
              err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ID_REQUIRED);
          } else if (DataUtils.isUndefined(shareItemType)) {
              err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ITEM_TYPE_REQUIRED);
          }
          if (err) {
              err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
              debug('err', err);
              errorOptions.err = err;
              await ErrorUtils.create(errorOptions);
              return cb(err);
          }
          var response = await OutShareInstance.getQueryForShareItemType({shareItemType: shareItemType});
          var groupQuery = response.groupQuery;
          var tables = response.tables;
          var condition = response.condition;
          var values = response.values;

          try {
              var conn = await connection.getConnection();

              var getOutSInstance = await conn.query('with partners as (' +
                'select concat_WS(?,t1.s1,t2.c1) as partnerNames,concat_WS(?,t1.p1,t2.p2) as partnerAccountIds from ' +
                '(SELECT GROUP_CONCAT(Supp.supplierName separator ?) as s1,' +
                'GROUP_CONCAT(CAST(uuid_from_bin(OSPart.inSharePartnerId) as char) SEPARATOR ?) AS p1,' +
                'CAST(uuid_from_bin(Supp.suppliersAccountId) as char)as accountId FROM ' +
                'Supplier Supp,OutSharePartners OSPart, OutShare OS ' +
                'WHERE  OS.id = uuid_to_bin(?) and  OSPart.outShareInstanceId = OS.id ' +
                'AND Supp.accountId = OS.accountId and Supp.suppliersAccountId = OSPart.inSharePartnerId AND OSPart.type="supplier")t1,' +
                '(SELECT GROUP_CONCAT(C.customerName separator ?) as c1,' +
                'GROUP_CONCAT(CAST(uuid_from_bin(OSPart.inSharePartnerId) as char) SEPARATOR ?) AS p2,' +
                'CAST(uuid_from_bin(C.customersAccountId) as char)as accountId,OS.id ' +
                'FROM Customers C,OutSharePartners OSPart, OutShare OS ' +
                'WHERE OS.id = uuid_to_bin(?) and  OSPart.outShareInstanceId = OS.id ' +
                'AND C.accountId = OS.accountId  AND C.customersAccountId = OSPart.inSharePartnerId AND OSPart.type="customer")t2) ' +
                'SELECT CAST(uuid_from_bin(OS.id) as char) as id, ' +
                'CAST(uuid_from_bin(OS.sharingProfileId) as char) as sharingProfileId,' +
                'CAST(uuid_from_bin(OS.accountId) as char) as accountId,OS.status,OS.createdAt,OS.actualSharingDate,OS.outShareId,' +
                'OS.outShareName,OS.dataProtectionOption,OS.shareItemType,OS.offeredStartDate,OS.startDateType,' +
                'OS.updatedAt, OSP.profileName,' +
                'OSP.profileId,OSP.sharedDataItems,OSP.freqType ,OSP.freqTime,OSP.freqDay,OSP.notes,' + groupQuery +
                'GROUP_CONCAT(CAST(uuid_from_bin(OSI.shareItemId) as char) separator ? ) as shareItemIds, ' +
                'PT.partnerNames,PT.partnerAccountIds ' +
                'from partners PT , OutShare OS,OutSharingProfile OSP, OutShareItems OSI,' + tables +
                'where OS.id = uuid_to_bin(?) and OSP.id=OS.sharingProfileId and OSI.outShareInstanceId = OS.id ' +
                'and OSI.outShareInstanceId = OS.id and OSI.status != ? and' + condition,
                [Constants.STRING_SEPARATOR, Constants.STRING_SEPARATOR, Constants.STRING_SEPARATOR, Constants.STRING_SEPARATOR,
                    options.id, Constants.STRING_SEPARATOR, Constants.STRING_SEPARATOR, options.id].concat(values,
                  [Constants.STRING_SEPARATOR, options.id, Constants.STATUS.DEACTIVE]));

              getOutSInstance = Utils.filteredResponsePool(getOutSInstance);
              debug('getOutSInstance', getOutSInstance);

              if (!getOutSInstance || getOutSInstance.outShareId === null) {
                  err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ID_INVALID);
                  err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                  throw err;
              }

              getOutSInstance.shareItemType = Object.keys(Constants.SHARING_TYPE)[Object.values(Constants.SHARING_TYPE).indexOf(getOutSInstance.shareItemType)];

              var startDateType = Object.keys(Constants.OUT_SHARE_START_DATE)[Object.values(Constants.OUT_SHARE_START_DATE).indexOf(getOutSInstance.startDateType)];
              getOutSInstance.startDateType = Constants.OUT_SHARE_START_DATE_TYPE[startDateType];

              if (DataUtils.isDefined(getOutSInstance.sku)) {
                  getOutSInstance.sku = getOutSInstance.sku.split(Constants.STRING_SEPARATOR);
              }
              if (DataUtils.isDefined(getOutSInstance.shareItemIds)) {
                  getOutSInstance.shareItemIds = getOutSInstance.shareItemIds.split(Constants.STRING_SEPARATOR);
              }
              if (DataUtils.isDefined(getOutSInstance.partnerAccountIds)) {
                  getOutSInstance.partnerAccountIds = getOutSInstance.partnerAccountIds.split(Constants.STRING_SEPARATOR);
              }
              if (DataUtils.isDefined(getOutSInstance.sharedDataItems)) {
                  getOutSInstance.sharedDataItems = getOutSInstance.sharedDataItems.split(',');
                  var temp = [];
                  _.each(getOutSInstance.sharedDataItems, function (item) {
                      temp.push(parseInt(item));
                  });
                  getOutSInstance.sharedDataItems = temp;
              }

              if (DataUtils.isDefined(getOutSInstance.sellerSKUName)) {
                  getOutSInstance.sellerSKUName = getOutSInstance.sellerSKUName.split(Constants.STRING_SEPARATOR);
              }
              if (DataUtils.isDefined(getOutSInstance.locationName)) {
                  getOutSInstance.locationName = getOutSInstance.locationName.split(Constants.STRING_SEPARATOR);
              }

              if (DataUtils.isDefined(getOutSInstance.locationId)) {
                  getOutSInstance.locationId = getOutSInstance.locationId.split(Constants.STRING_SEPARATOR);
              }

              if (DataUtils.isDefined(getOutSInstance.partnerNames)) {
                  getOutSInstance.partnerNames = getOutSInstance.partnerNames.split(Constants.STRING_SEPARATOR);
              }
              if (DataUtils.isDefined(getOutSInstance.productReferenceSKU)) {
                  getOutSInstance.productReferenceSKU = getOutSInstance.productReferenceSKU.split(Constants.STRING_SEPARATOR);
              }
              if (DataUtils.isDefined(getOutSInstance.productReferenceSellerSKUName)) {
                  getOutSInstance.productReferenceSellerSKUName = getOutSInstance.productReferenceSellerSKUName.split(Constants.STRING_SEPARATOR);
              }
              if (DataUtils.isDefined(getOutSInstance.supplyItemSKU)) {
                  getOutSInstance.supplyItemSKU = getOutSInstance.supplyItemSKU.split(Constants.STRING_SEPARATOR);
              }
              if (DataUtils.isDefined(getOutSInstance.supplyItemSellerSKUName)) {
                  getOutSInstance.supplyItemSellerSKUName = getOutSInstance.supplyItemSellerSKUName.split(Constants.STRING_SEPARATOR);
              }


              /*if (DataUtils.isDefined(getOutSInstance.partnerIds)) {
                  getOutSInstance.partnerIds = getOutSInstance.partnerIds.split(Constants.STRING_SEPARATOR);
              }*/

              return cb(null, getOutSInstance);

          } catch (err) {
              debug('err', err);
              errorOptions.err = err;
              await ErrorUtils.create(errorOptions);

              if (err.code) {
                  err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_GET_FAILED);
                  err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
              }
              return cb(err);
          }
      },

      getByItemIdsAndProfileIdMD: async function (options, errorOptions, cb) {
          console.log(options);
          var accountId = options.accountId;
          var err;

          if (DataUtils.isUndefined(accountId)) {
              err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
          }

          if (!err && !DataUtils.isArray(options.shareItemIds)) {
              err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ITEM_IDS_REQUIRED_AND_IDS_MUST_BE_IN_ARRAY);
          }

          if (!err && !options.shareItemIds.length) {
              err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ITEM_IDS_REQUIRED_AND_IDS_MUST_BE_IN_ARRAY);
          }

          if (!err && options.shareItemIds.length > Constants.MAX_OUT_SHARE_SHARE_ITEM_IDS) {
              err = new Error(ErrorConfig.MESSAGE.ONLY_10_OUT_SHARE_ITEM_ID_ALLOWED);
          }

          if (!err && DataUtils.isUndefined(options.sharingProfileId)) {
              err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_SHARING_PROFILE_ID_REQUIRED);
          }

          if (err) {
              err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
              errorOptions.err = err;
              await ErrorUtils.create(errorOptions);
              return cb(err);
          }

          var conflict = [];
          var success = [];

          try {
              var conn = await connection.getConnection();
              await Promise.each(options.shareItemIds, async function (shareItemId) {
                  var getOutSInstance = await conn.query('SELECT shareItemId from OutShare where accountId = uuid_to_bin(?) ' +
                    'and sharingProfileId = uuid_to_bin(?) and shareItemId = ?', [accountId, options.sharingProfileId, shareItemId]);

                  getOutSInstance = Utils.filteredResponsePool(getOutSInstance);

                  if (getOutSInstance) {
                      conflict.push(shareItemId);
                  } else {
                      success.push(shareItemId);
                  }
              });
          } catch (err) {

              errorOptions.err = err;
              await ErrorUtils.create(errorOptions);

              if (err.code) {
                  err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_GET_FAILED);
                  err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
              }
              return cb(err);
          }

          return cb(null, {success: success, conflict: conflict});

      },

      searchProductBySKUMD: async function (options, errorOptions, cb) {
          var query = options.query;
          var accountId = options.user.accountId;
          var err;

          if (DataUtils.isUndefined(query)) {
              err = new Error(ErrorConfig.MESSAGE.PRODUCT_SEARCH_QUERY_REQ);
              err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
              errorOptions.err = err;
              await ErrorUtils.create(errorOptions);
              debug('err', err);
              return cb(err);
          }

          try {
              var conn = await connection.getConnection();
              query = '%' + query + '%';
              debug('query', query);
              var products = await conn.query('select CAST(uuid_from_bin(pi.id) as char) as id,pi.locationId,pi.sku,pr.sellerSKUName,' +
                'lr.locationId,lr.locationName from ProductInventory pi,ProductReferences pr,LocationReference lr ' +
                'where pi.accountId = uuid_to_bin(?) and pi.status = 1 and lr.locationId = pi.locationId and pr.id = pi.productRefId ' +
                'and lr.accountId = pi.accountId and lower(pi.sku) like lower(?);', [accountId, query]);

              return cb(null, products);
          } catch (err) {
              errorOptions.err = err;
              await ErrorUtils.create(errorOptions);
              err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_GET_FAILED);
              err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
              return cb(err);
          }
      },

      searchProductBySKUDependentDemand: async function (options, errorOptions, cb) {
          var query = options.query;
          var supplyItemSKU = options.supplyItemSKU;
          var accountId = options.user.accountId;
          var err;

          if (DataUtils.isUndefined(query)) {
              err = new Error(ErrorConfig.MESSAGE.PRODUCT_SEARCH_QUERY_REQ);
          } else if (DataUtils.isUndefined(supplyItemSKU)) {
              err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_SKU_REQUIRED);
          }
          if (err) {
              err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
              errorOptions.err = err;
              await ErrorUtils.create(errorOptions);
              debug('err', err);
              return cb(err);
          }

          try {
              var conn = await connection.getConnection();
              query = '%' + query + '%';
              var products = await conn.query('select CAST(uuid_from_bin(PR.id) as char) as id,PR.sku,PR.sellerSKUName ' +
                ' from ProductReferences PR ,BillOfMaterial BOM WHERE ' +
                ' BOM.supplyItemSKU = ? AND BOM.accountId = uuid_to_bin(?) AND ' +
                ' PR.id = BOM.productRefId AND lower(PR.sku) like LOWER(?)', [supplyItemSKU, accountId, query]);

              return cb(null, products);
          } catch (err) {
              errorOptions.err = err;
              await ErrorUtils.create(errorOptions);
              err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_GET_FAILED);
              err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
              return cb(err);
          }
      },

      searchProductBySellerSKUNameDependentDemand: async function (options, errorOptions, cb) {
          var query = options.query;
          var supplyItemSKU = options.supplyItemSKU;
          var accountId = options.user.accountId;
          var err;

          if (DataUtils.isUndefined(query)) {
              err = new Error(ErrorConfig.MESSAGE.PRODUCT_SEARCH_QUERY_REQ);
          } else if (DataUtils.isUndefined(supplyItemSKU)) {
              err = new Error(ErrorConfig.MESSAGE.SUPPLY_ITEM_SKU_REQUIRED);
          }
          if (err) {
              err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
              errorOptions.err = err;
              await ErrorUtils.create(errorOptions);
              debug('err', err);
              return cb(err);
          }

          try {
              var conn = await connection.getConnection();
              query = '%' + query + '%';
              var products = await conn.query('select CAST(uuid_from_bin(PR.id) as char) as id,PR.sku,PR.sellerSKUName ' +
                ' from ProductReferences PR ,BillOfMaterial BOM WHERE ' +
                ' BOM.supplyItemSKU = ? AND BOM.accountId = uuid_to_bin(?) AND ' +
                ' PR.id = BOM.productRefId AND lower(PR.sellerSKUName) like LOWER(?)', [supplyItemSKU, accountId, query]);

              return cb(null, products);
          } catch (err) {
              errorOptions.err = err;
              await ErrorUtils.create(errorOptions);
              err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_GET_FAILED);
              err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
              return cb(err);
          }
      },

      searchByPartnerNameMD: async function (options, errorOptions, cb) {
          var query = options.query;
          var accountId = options.user.accountId;
          var err;

          if (DataUtils.isUndefined(query)) {
              err = new Error(ErrorConfig.MESSAGE.PARTNER_NAME_SEARCH_QUERY_REQ);
          }
          if (err) {
              err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
              errorOptions.err = err;
              await ErrorUtils.create(errorOptions);
              debug('err', err);
              return cb(err);
          }

          try {
              var conn = await connection.getConnection();
              query = query + '%';

              var suppliers = await conn.query('SELECT CAST(uuid_from_bin(s.suppliersAccountId) as char) as accountId, ' +
                ' s.supplierName as partnerName,email, ? as type ' +
                ' from Supplier s where s.accountId = uuid_to_bin(?) and s.suppliersAccountId != uuid_to_bin(?) and ' +
                ' s.supplierName like lower(?) and s.isActive = 1;',
                [Constants.PARTNER_TYPES.SUPPLIER, accountId, '00000000-0000-0000-0000-000000000000', query]);


              var customers = await conn.query('SELECT ' +
                ' CAST(uuid_from_bin(c.customersAccountId) as char) as accountId, ' +
                ' c.customerName as partnerName,email , ? as type ' +
                ' from Customers c where c.accountId = uuid_to_bin(?) and c.customersAccountId != uuid_to_bin(?) and ' +
                ' c.customerName like lower(?) and c.isActive = 1;',
                [Constants.PARTNER_TYPES.CUSTOMER, accountId, '00000000-0000-0000-0000-000000000000', query]);

              return cb(null, suppliers.concat(customers));
          } catch (err) {
              errorOptions.err = err;
              await ErrorUtils.create(errorOptions);
              err = new Error(ErrorConfig.MESSAGE.PARTNER_NAME_GET_FAILED);
              err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
              return cb(err);
          }
      },

      searchProductBySellerSKUNameMD: async function (options, errorOptions, cb) {
          var query = options.query;
          var accountId = options.user.accountId;
          var err;

          if (DataUtils.isUndefined(query)) {
              err = new Error(ErrorConfig.MESSAGE.PRODUCT_SEARCH_QUERY_REQ);
              err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
              errorOptions.err = err;
              await ErrorUtils.create(errorOptions);
              debug('err', err);
              return cb(err);
          }

          try {

              var conn = await connection.getConnection();
              query = '%' + query + '%';
              var products = await conn.query('select CAST(uuid_from_bin(pi.id) as char) as id,pi.locationId,pi.sku,pr.sellerSKUName,' +
                ' lr.locationId,lr.locationName from ProductInventory pi,ProductReferences pr,LocationReference lr ' +
                ' where pi.accountId = uuid_to_bin(?) and pi.status = 1 and lr.locationId = pi.locationId and pr.id = pi.productRefId ' +
                ' and lr.accountId = pi.accountId and lower(pr.sellerSKUName) like lower(?);',
                [accountId, query]);

              return cb(null, products);
          } catch (err) {
              errorOptions.err = err;
              await ErrorUtils.create(errorOptions);
              err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTORY_GET_FAILED);
              err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
              return cb(err);
          }
      },

      searchSupplyInventoryBySKU: async function (options, errorOptions, cb) {
          var query = options.query;
          var accountId = options.user.accountId;
          var err;

          if (DataUtils.isUndefined(query)) {
              err = new Error(ErrorConfig.MESSAGE.SUPPLY_SEARCH_QUERY_REQ);
              err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
              errorOptions.err = err;
              await ErrorUtils.create(errorOptions);
              debug('err', err);
              return cb(err);
          }

          try {
              var conn = await connection.getConnection();
              query = '%' + query + '%';
              debug('query', query);
              var supplyItems = await conn.query('select CAST(uuid_from_bin(si.id) as char) as id,si.locationId,si.SKU as sku,sitem.sellerSKUName,' +
                'lr.locationId,lr.locationName from SupplyInventory si,SupplyItems sitem,LocationReference lr ' +
                'where si.accountId = uuid_to_bin(?) and si.status = 1 and lr.locationId = si.locationId and sitem.id = si.supplyItemId ' +
                'and lr.accountId = si.accountId and lower(si.SKU) like lower(?);', [accountId, query]);

              return cb(null, supplyItems);
          } catch (err) {
              errorOptions.err = err;
              await ErrorUtils.create(errorOptions);
              err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_GET_FAILED);
              err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
              return cb(err);
          }
      },

      searchSupplyInventoryBySellerSKUName: async function (options, errorOptions, cb) {
          var query = options.query;
          var accountId = options.user.accountId;
          var err;

          if (DataUtils.isUndefined(query)) {
              err = new Error(ErrorConfig.MESSAGE.SUPPLY_SEARCH_QUERY_REQ);
              err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
              errorOptions.err = err;
              await ErrorUtils.create(errorOptions);
              debug('err', err);
              return cb(err);
          }

          try {
              var conn = await connection.getConnection();
              query = '%' + query + '%';
              var supplyItems = await conn.query('select CAST(uuid_from_bin(si.id) as char) as id,si.locationId,si.SKU as sku,sitem.sellerSKUName,' +
                ' lr.locationId,lr.locationName from SupplyInventory si,SupplyItems sitem,LocationReference lr ' +
                ' where si.accountId = uuid_to_bin(?) and si.status = 1 and lr.locationId = si.locationId and sitem.id = si.supplyItemId ' +
                ' and lr.accountId = si.accountId and lower(sitem.sellerSKUName) like lower(?);', [accountId, query]);

              return cb(null, supplyItems);
          } catch (err) {
              errorOptions.err = err;
              await ErrorUtils.create(errorOptions);
              err = new Error(ErrorConfig.MESSAGE.SUPPLY_INVENTORY_GET_FAILED);
              err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
              return cb(err);
          }
      },

      checkUpdatedAt: function (options) {
          return new Promise(async function (resolve, reject) {
              var outShareInstances = options.outShareInstances;
              var string = '', values = [];
              var conflict = [], success = [];
              var conflictIds = [];

              try {
                  var conn = await connection.getConnection();

                  await Promise.each(outShareInstances, function (outShare) {
                      string += ' SELECT CAST(uuid_from_bin(id) as char) as id FROM OutShare WHERE (updatedAt != ? AND id = uuid_to_bin(?)) UNION ALL ';
                      values.push(outShare.updatedAt, outShare.id);
                  });
                  string = string.replace(/UNION ALL \s*$/, ' ');
                  var response = await conn.query(string, values);

                  conflictIds = _.map(response, function (value) {
                      return value.id;
                  });

                  debug('conflictIds', conflictIds);
                  _.map(outShareInstances, function (outShare) {
                      if (conflictIds.indexOf(outShare.id) === -1) {
                          success.push(outShare.id);
                      } else {
                          debug('inside conflict', outShare);
                          conflict.push(outShare.id);
                      }
                  });

                  return resolve({success: success, conflict: conflict});
              } catch (err) {
                  debug('err', err);
                  return reject(err);
              }
          });
      },

      checkOutShareInShare: function (options) {
          return new Promise(async function (resolve, reject) {
              var Supplier = require('./supplier');
              var id = options.id;
              var userId = options.userId;
              var accountId = options.accountId;
              var outShares = [], inShares = [];
              var updatedAt = DataUtils.getEpochMSTimestamp();
              var currentDate = DataUtils.getEpochMSTimestamp();
              var notifyFlag = false;
              var err;

              try {
                  var conn = await connection.getConnection();

                  outShares = await conn.query('select CAST(uuid_from_bin(id) as char) as id,status from OutShare ' +
                    'where accountId=uuid_to_bin(?) and id = uuid_to_bin(?) ; ', [accountId, id]);

                  inShares = await conn.query('select CAST(uuid_from_bin(id) as char) as id, ' +
                    'CAST(uuid_from_bin(accountId) as char) as accountId from InShare ' +
                    'where outShareInstanceId = uuid_to_bin(?);', [id]);

                  // Update InShare
                  if (inShares.length > 0) {

                      var status = Constants.IN_SHARE_STATUS.STOP_BY_OUT_SHARE_PARTNER;
                      var response = await Supplier.manipulateInShareQuery({inShares: inShares});
                      var isUpdated = await conn.query('update InShare set status=?,updatedAt=?,updatedBy=uuid_to_bin(?),endDate=? where ' +
                        'id in (' + response.string + ')', [status, updatedAt, userId, currentDate].concat(response.values));
                      isUpdated = Utils.isAffectedPool(isUpdated);

                      if (!isUpdated) {
                          err = new Error(ErrorConfig.MESSAGE.IN_SHARE_UPDATE_FAILED);
                          err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                          return reject(err);
                      }
                      var updateInShareResponse = Constants.OK_MESSAGE;
                  }

                  // Update outShare
                  if (outShares.length > 0) {
                      var partnerRemoved = await conn.query('delete from OutSharePartners where outShareInstanceId ' +
                        '=uuid_to_bin(?) ', id);
                      partnerRemoved = Utils.isAffectedPool(partnerRemoved);
                      var status = Constants.OUT_SHARE_STATUS.STOP;

                      var isUpdated = await conn.query('update OutShare set status=?,updatedAt=?,updatedBy=uuid_to_bin(?),' +
                        'isArchive=?,endDate=? where ' +
                        'id = uuid_to_bin(?)', [status, updatedAt, userId, 1, currentDate, id]);
                      isUpdated = Utils.isAffectedPool(isUpdated);


                      if (!isUpdated) {
                          err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_UPDATE_FAILED);
                          err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                          return reject(err);
                      }
                      var updateOutShareResponse = Constants.OK_MESSAGE;
                      notifyFlag = true;
                  }

                  // update Sharing Event by stopping it
                  if (outShares.length > 0 && outShares[0].status === Constants.OUT_SHARE_STATUS.ACTIVE) {
                      var updateSharingEventOption = {
                          outShares: outShares,
                          userId: userId
                      };
                      debug('Inside update sharing event', updateSharingEventOption);
                      var updateSharingEventsResponse = await Supplier.updatesharingEvent(updateSharingEventOption);
                      debug('updateSharingEventsResponse', updateSharingEventsResponse);
                  }

                  return resolve({inShares: inShares, notifyFlag: notifyFlag, id: id});
              } catch (err) {
                  debug('err', err);
                  return reject(err);
              }
          });
      },

      delete: async function (options, auditOptions, errorOptions, cb) {
          var outShareInstances = options.ids;
          var accountId = options.accountId;
          var userId = options.userId;
          var successOutShares = [], conflictOutShares = [];
          var checkResponses = [];
          var err;

          try {
              if (DataUtils.isUndefined(outShareInstances)) {
                  err = new Error(ErrorConfig.MESSAGE.ID_REQUIRED);
              } else if (!DataUtils.isArray(outShareInstances)) {
                  err = new Error(ErrorConfig.MESSAGE.ID_MUST_BE_ARRAY);
              } else if (outShareInstances.length <= 0) {
                  err = new Error(ErrorConfig.MESSAGE.ATLEAST_ONE_ID_REUQIRED);
              }
              if (err) {
                  err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                  return cb(err);
              }

              await Promise.each(outShareInstances, async function (outShareInstance) {

                  if (DataUtils.isUndefined(outShareInstance.id)) {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ID_REQUIRED);
                  } else if (DataUtils.isValidateOptionalField(outShareInstance.updatedAt)) {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_UPDATED_AT_REQUIRED);
                  } else if (!DataUtils.isValidNumber(outShareInstance.updatedAt)) {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_UPDATED_AT_MUST_BE_NUMBER);
                  } else if (outShareInstance.updatedAt.toString().length !== 13) {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_UPDATED_AT_INVALID);
                  }
                  if (err) {
                      throw err;
                  }
              });

          } catch (err) {
              err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
              return cb(err);
          }

          try {
              var conn = await connection.getConnection();
              await conn.query('START TRANSACTION;');
          } catch (err) {
              debug('err', err);
              return cb(err);
          }

          try {
              // CHECK UPDATED AT
              var response = await OutShareInstance.checkUpdatedAt({outShareInstances: outShareInstances});
              debug('response', response);
              successOutShares = response.success;
              conflictOutShares = response.conflict;

              debug('successOutShares', successOutShares);
              if (successOutShares.length <= 0) {
                  err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_HAS_SYNC_CONFLICT);
                  err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                  err.data = {success: successOutShares, conflict: conflictOutShares};
                  return cb(err);
              }

              // Check if any inShares are exist for Out share , if yes then stop sharing for those in-shares

              await Promise.each(successOutShares, async function (outShare) {
                  var checkOptions = {
                      id: outShare,
                      accountId: accountId,
                      userId: userId
                  };
                  var checkResponse = await OutShareInstance.checkOutShareInShare(checkOptions);
                  if (checkResponse) {
                      checkResponses.push(checkResponse);
                  }
              });

              await Promise.each(checkResponses, async function (outShare) {
                  //NOTIFY ALL AUTHORIZE USER OF THIS PARTNER
                  if (outShare.inShares && outShare.inShares.length > 0) {
                      var notifyOptions = {
                          sharePartners: outShare.inShares,
                          outShareInstanceId: outShare.id,
                          notificationReference: NotificationReferenceData.REMOVE_OUT_SHARE,
                          emailTemplate: Constants.EMAIL_TEMPLATES.REMOVE_OUT_SHARE,
                          userId: userId
                      };
                      var notifyResponse = await OutShareInstance.notifyPartnersForAddRemoveShareItems(notifyOptions);
                  }
              });

              await conn.query('COMMIT;');
              AuditUtils.create(auditOptions);

              debug('here1', successOutShares.length);
              if (successOutShares.length > 0 && conflictOutShares.length > 0) {
                  err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_HAS_SYNC_CONFLICT);
                  err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                  err.data = {
                      successMsg: Constants.SUCCESS_MESSAGE.OUT_SHARE_INSTANCE_DELETED_SUCCESSFULLY,
                      success: successOutShares,
                      conflict: conflictOutShares
                  };
                  debug('err');
                  return cb(err);
              } else {
                  var success = {
                      OK: Constants.SUCCESS_MESSAGE.OUT_SHARE_INSTANCE_DELETE_SUCCESS,
                      success: successOutShares
                  };
                  debug('success', success);
                  return cb(null, success);
              }
          } catch (err) {
              debug('err', err);
              debug('ROLLBACK');
              await conn.query('ROLLBACK;');
              ErrorUtils.create(errorOptions, options, err);
              if (err.errno === 4002) {
                  return cb(err);
              } else {
                  err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_DELETE_FAILED);
                  err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
              }
              return cb(err);
          }
      },

      /*
    * Insert a Sharing log when item or partners added or removed
    * */
      insertsharingLog: function (options) {
          return new Promise(async function (resolve, reject) {
              var sharingLogList = options.sharingLogList;
              var query, values;

              var convertedinsharingLogList, keys, err;
              await Utils.convertObjectToArrayMD(sharingLogList, async function (err, response) {
                  if (err) {
                      debug('err', err);
                      return reject(err);
                  }
                  convertedinsharingLogList = response.list;
                  keys = response.keys;

                  query = 'insert into SharingLog (' + keys + ') values';
                  values = ' (uuid_to_bin(?), uuid_to_bin(?),uuid_to_bin(?),uuid_to_bin(?),?,?,?) ';


                  await Promise.each(sharingLogList, function (value) {
                      query = query + values;
                      query = query + ',';
                  });

                  query = query.replace(/,\s*$/, '');

                  try {
                      var conn = await connection.getConnection();
                      var sharingLogInserted = await conn.query(query, convertedinsharingLogList);
                      sharingLogInserted = Utils.isAffectedPool(sharingLogInserted);
                      debug('sharing log Inserted-----------------------------------------', sharingLogInserted);
                      if (!sharingLogInserted) {
                          throw err;
                      }
                      return resolve(Constants.OK_MESSAGE);
                  } catch (err) {
                      debug('err ', err);
                      err = new Error(ErrorConfig.MESSAGE.IN_SHARE_CREATION_FAILED);
                      err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                      return reject(err);
                  }
              });
          });
      },

      /*
    * Prepare query string for multiple insert
    * */
      manipulateCheckInSharePartnerQuery: function (options) {
          return new Promise(function (resolve, reject) {
              var inSharePartners = options.inSharePartners;
              var string = '', values = [];

              _.map(inSharePartners, function (inSharePartner) {
                  string += 'uuid_to_bin(?),';
                  values.push(inSharePartner.accountId);
              });
              string = string.replace(/,\s*$/, ' ');
              return resolve({
                  string: string,
                  values: values
              });
          });
      },

      /*
    * Send Notification to all new added partners
    * */
      sendInShareInvitation: function (options) {
          return new Promise(async function (resolve, reject) {
              var addSharePartners = options.addSharePartners;
              var userId = options.userId;
              var shareItemType = options.shareItemType;
              var NotificationApi = require('../api/notification');

              try {
                  var inviterUser = await CustomerApi.getUserById({userId: userId});

                  await Promise.each(addSharePartners, async function (partner) {

                      // GET ALL AUTH USER OF ACCOUNTS OR PARTNERS
                      var authUsers = await CustomerApi.getAuthorizeUser({accountId: partner.accountId});

                      // SEND NOTIFICATION FOR ALL AUTH USERS
                      var date = new Date();
                      var invitationExpirationDate = date.setDate(date.getDate() + Constants.INVITATION_EXPIRATION_DATE_LIMIT);
                      invitationExpirationDate = new Date(invitationExpirationDate);

                      await Promise.each(authUsers, async function (user) {
                          var inviteeUser = await CustomerApi.getUserByIdMD({
                              userId: user.userId,
                              notifyType: Constants.NOTIFICATION_CATEGORY_TYPE.SHARING
                          });

                          var opt = {
                              languageCultureCode: inviterUser.languageCultureCode,
                              template: Constants.EMAIL_TEMPLATES.IN_SHARE_INVITE,
                              email: inviteeUser.email
                          };

                          var compileOptions = {
                              name: inviteeUser.firstName,
                              user_email: inviterUser.email,
                              scopehub_login: ''
                          };

                          try {
                              var notifyFlag = JSON.parse(inviteeUser.notifyFlag);
                              // SEND EMAIL
                              if (notifyFlag.email === 1) {
                                  await EmailUtils.sendEmailPromise(opt, compileOptions);
                              }
                              if (notifyFlag.notification === 1) {
                                  var notificationOption = {
                                      refereId: partner.inShareId, //id of inShare record
                                      refereType: Constants.NOTIFICATION_REFERE_TYPE.IN_SHARE,
                                      user_ids: [inviteeUser.id],
                                      topic_id: inviteeUser.id,
                                      notificationExpirationDate: invitationExpirationDate,
                                      paramasDateTime: new Date(),
                                      notification_reference: NotificationReferenceData.DATA_SHARE,
                                      metaEmail: inviterUser.email,
                                      paramsInviter: inviterUser.email + ', ' + (inviterUser.firstName ? inviterUser.firstName : '') + ' ' + (inviterUser.lastName ? inviterUser.lastName : ''),
                                      paramsInvitee: inviteeUser.email + ', ' + (inviteeUser.firstName ? inviteeUser.firstName : '') + ' ' + (inviteeUser.lastName ? inviteeUser.lastName : ''),
                                      paramasOtherData: shareItemType,
                                      languageCultureCode: inviteeUser.languageCultureCode,
                                      createdBy: inviterUser.id,
                                      type: Constants.DEFAULT_NOTIFICATION_TYPE
                                  };
                                  if (inviterUser.firstName) {
                                      notificationOption.metaName = inviterUser.firstName;
                                  }

                                  await NotificationApi.createMD(notificationOption);
                              }
                          } catch (err) {
                              debug('err', err);
                              err = new Error(ErrorConfig.MESSAGE.IN_SHARE_PARTNER_NOTIFY_FAILED);
                              err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                              return reject(err);
                          }
                      });
                  });

                  return resolve(Constants.OK_MESSAGE);
              } catch (err) {
                  debug('err', err);
                  err = new Error(ErrorConfig.MESSAGE.IN_SHARE_PARTNER_NOTIFY_FAILED);
                  err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                  return reject(err);
              }
          });
      },

      /*
    * Create multiple out share partners record (child partner)
    * */
      createOutSharePartners: function (options) {
          return new Promise(async function (resolve, reject) {
              var inSharePartnerList = options.inSharePartnerList;
              var query, values;

              var convertedinSharePartnerList, keys, err;
              await Utils.convertObjectToArrayMD(inSharePartnerList, async function (err, response) {
                  if (err) {
                      debug('err', err);
                      return reject(err);
                  }
                  convertedinSharePartnerList = response.list;
                  keys = response.keys;

                  query = 'insert into OutSharePartners (' + keys + ') values';
                  values = ' (uuid_to_bin(?), uuid_to_bin(?),uuid_to_bin(?),?,?,?) ';


                  await Promise.each(inSharePartnerList, function (value) {
                      query = query + values;
                      query = query + ',';
                  });

                  query = query.replace(/,\s*$/, '');

                  try {
                      var conn = await connection.getConnection();
                      var outSharePartnerInserted = await conn.query(query, convertedinSharePartnerList);
                      outSharePartnerInserted = Utils.isAffectedPool(outSharePartnerInserted);
                      debug('outSharePartnerInserted-----------------------------------------', outSharePartnerInserted);
                      if (!outSharePartnerInserted) {
                          throw err;
                      }
                      return resolve(Constants.OK_MESSAGE);
                  } catch (err) {
                      debug('err ', err);
                      err = new Error(ErrorConfig.MESSAGE.IN_SHARE_CREATION_FAILED);
                      err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                      return reject(err);
                  }
              });
          });
      },

      /*
    * Create multiple in shared record
    * */
      createInShares: function (options) {
          return new Promise(async function (resolve, reject) {
              var inShareList = options.inShareList;
              var query, values;

              var convertedinShareList, keys, err;
              await Utils.convertObjectToArrayMD(inShareList, async function (err, response) {
                  if (err) {
                      debug('err', err);
                      return reject(err);
                  }
                  convertedinShareList = response.list;
                  keys = response.keys;

                  query = 'insert into InShare (' + keys + ') values';
                  values = ' (uuid_to_bin(?), uuid_to_bin(?),uuid_to_bin(?),uuid_to_bin(?),?,?,?,?,?) ';


                  await Promise.each(inShareList, function (value) {
                      query = query + values;
                      query = query + ',';
                  });

                  query = query.replace(/,\s*$/, '');

                  try {
                      var conn = await connection.getConnection();
                      var inShareInserted = await conn.query(query, convertedinShareList);
                      inShareInserted = Utils.isAffectedPool(inShareInserted);
                      debug('InShare Inserted-----------------------------------------', inShareInserted);
                      if (!inShareInserted) {
                          throw err;
                      }
                      return resolve(Constants.OK_MESSAGE);
                  } catch (err) {
                      debug('err ', err);
                      err = new Error(ErrorConfig.MESSAGE.IN_SHARE_CREATION_FAILED);
                      err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                      return reject(err);
                  }
              });
          });
      },

      /*
    * Check the same partner is exist or not , is exist then not allow to add new same partner
    * */
      checkAlreadyExistPartner: function (options) {
          return new Promise(async function (resolve, reject) {
              var outShareInstanceId = options.outShareInstanceId;
              var addSharePartners = options.addSharePartners;
              var err;

              try {
                  var conn = await connection.getConnection();

                  var response = await OutShareInstance.manipulateCheckInSharePartnerQuery({inSharePartners: addSharePartners});

                  var inSharePartners = await conn.query('select CAST(uuid_from_bin(accountId) as char) as inSharePartnerId ' +
                    ' from InShare where outShareInstanceId=uuid_to_bin(?) ' +
                    'and accountId in (' + response.string + ') and (status = 0 or status = 1 or status = 4 or status = 5);', [outShareInstanceId].concat(response.values));

                  debug('inSharePartners', inSharePartners.length);

                  if (inSharePartners.length > 0) {
                      err = new Error(ErrorConfig.MESSAGE.IN_SHARE_PARTNER_ALREADY_EXIST);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                      return reject(err);
                  }
                  return resolve(Constants.OK_MESSAGE);
              } catch (err) {
                  debug('err', err);
                  err = new Error(ErrorConfig.MESSAGE.IN_SHARE_PARTNER_CHECK_FAILED);
                  err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                  return reject(err);
              }
          });
      },

      /*
      * Check how many active partner is there for outShare , if greater than 10 then dont allow
      * */
      checkForActiveInSharePartner: function (options) {
          return new Promise(async function (resolve, reject) {
              var outShareInstanceId = options.outShareInstanceId;
              var addSharePartners = options.addSharePartners;
              var accountId = options.accountId;
              var err;

              try {
                  var conn = await connection.getConnection();

                  var inSharePartners = await conn.query('IF (select 1 from OutShare where id = uuid_to_bin(?)) is null then ' +
                    ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "OUT_SHARE_INSTANCE_NOT_FOUND",MYSQL_ERRNO = 4001;' +
                    ' ELSE select count(*) as count from InShare where outShareInstanceId=uuid_to_bin(?) and status = 1;end if;',
                    [outShareInstanceId, outShareInstanceId]);
                  debug('inSharePartners before', inSharePartners);
                  inSharePartners = Utils.filteredResponsePool(inSharePartners)[0];

                  if (inSharePartners && inSharePartners.count >= 10 || (inSharePartners.count + addSharePartners.length) > 10) {
                      err = new Error(ErrorConfig.MESSAGE.CAN_NOT_ADD_MORE_THEN_10_PARTNER);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                      return reject(err);
                  }
                  return resolve(Constants.OK_MESSAGE);
              } catch (err) {
                  debug('err', err);
                  if (err.errno = 4001) {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_NOT_FOUND);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                  } else {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_GET_FAILED);
                      err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                  }
                  return reject(err);
              }
          });
      },

      /*
      * validate partner array
      * */
      validatePartnerArray: function (options) {
          return new Promise(function (resolve, reject) {
              var partnerArray = options.partnerArray;
              var err;

              try {
                  _.map(partnerArray, function (partner) {
                      if (DataUtils.isUndefined(partner.accountId)) {
                          err = new Error(ErrorConfig.MESSAGE.PARTNER_ACCOUNT_ID_REQUIRED);
                      } else if (DataUtils.isUndefined(partner.type)) {
                          err = new Error(ErrorConfig.MESSAGE.PARTNER_TYPE_REQUIRED);
                      }
                      if (err) {
                          throw err;
                      }
                  });
                  return resolve(Constants.OK_MESSAGE);
              } catch (err) {
                  err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                  return reject(err);
              }
          });
      },

      /*
      * function for Check if addSharePartners array dont have duplicate accountId
      * */
      checkDuplicatePartner: function (options) {
          return new Promise(function (resolve, reject) {
              var partners = options.partners;
              var count = 0, err;

              _.map(partners, function (partner) {
                  _.map(partners, function (innerPartner) {
                      if (partner.accountId === innerPartner.accountId) {
                          count++;
                      }
                  });
              });
              debug('count', count);
              if (count > partners.length) {
                  err = new Error(ErrorConfig.MESSAGE.CAN_NOT_ADD_DUPLICATE_PARTNER);
                  err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                  return reject(err);
              }
              return resolve(Constants.OK_MESSAGE);
          });
      },

      /*
      * Add new partners from add partner array of update outShare api
      * */
      addNewInShares: function (options) {
          return new Promise(async function (resolve, reject) {
              var outShareInstanceId = options.outShareInstanceId;
              var addSharePartners = options.addSharePartners;
              var status = Constants.IN_SHARE_STATUS.NEW;
              var userId = options.userId;
              var outShare = options.outShare;
              var createdAt = DataUtils.getEpochMSTimestamp();
              var updatedAt = DataUtils.getEpochMSTimestamp();
              var inShareList = [];
              var inSharePartnerList = [];
              var sharingLogList = [];
              var err;

              try {
                  // validate and check addShareParnter array
                  var checkResponse = await OutShareInstance.validatePartnerArray({partnerArray: addSharePartners});

                  // Check if addSharePartners array dont have duplicate accountId
                  checkResponse = await OutShareInstance.checkDuplicatePartner({partners: addSharePartners});

                  debug('1');
                  // Check the same partner is exist or not , is exist then not allow to add new same partner
                  var checkOption = {
                      outShareInstanceId: outShareInstanceId,
                      addSharePartners: addSharePartners
                  };
                  checkResponse = await OutShareInstance.checkAlreadyExistPartner(checkOption);

                  debug('2');
                  //Check how many active partner is there for outShare , if greater than 10 then dont allow
                  var checkCountOption = {
                      outShareInstanceId: outShareInstanceId,
                      addSharePartners: addSharePartners
                  };
                  var checkCountResponse = await OutShareInstance.checkForActiveInSharePartner(checkCountOption);


                  debug('3');
                  await Promise.each(addSharePartners, function (partner) {
                      var generatedId = Utils.generateId();
                      var generatedIdPartners = Utils.generateId();

                      var inShareObject = {
                          id: generatedId.uuid,
                          outShareInstanceId: outShareInstanceId,
                          accountId: partner.accountId,
                          createdBy: userId,
                          status: status,
                          inShareId: '',
                          inShareName: '',
                          createdAt: createdAt,
                          updatedAt: updatedAt
                      };
                      var outSharePartnerObject = {
                          id: generatedIdPartners.uuid,
                          outShareInstanceId: outShareInstanceId,
                          inSharePartnerId: partner.accountId,
                          type: partner.type,
                          createdAt: createdAt,
                          updatedAt: updatedAt
                      };
                      partner.inShareId = generatedId.uuid;

                      var sharingLogObject = {
                          outShareInstanceId: outShareInstanceId,
                          inSharePartnerId: partner.accountId,
                          shareItemId: Constants.DEFAULT_REFERE_ID,
                          createdBy: userId,
                          reasonCode: Constants.SHARING_LOG_REASON_CODE.ADD_PARTNER,
                          createdAt: createdAt,
                          timestamp: createdAt
                      };

                      sharingLogList.push(sharingLogObject);
                      inShareList.push(inShareObject);
                      inSharePartnerList.push(outSharePartnerObject);
                  });

                  // CREATE INSHARE RECORDS
                  if (inShareList.length > 0) {
                      var createOption = {
                          inShareList: inShareList
                      };
                      var createResponse = await OutShareInstance.createInShares(createOption);
                  }

                  //CREATE OUTSHARE PARTNERS RECORD
                  if (inSharePartnerList.length > 0) {
                      var createPartnerOption = {
                          inSharePartnerList: inSharePartnerList
                      };
                      var createPartnerResponse = await OutShareInstance.createOutSharePartners(createPartnerOption);
                  }

                  //CREATE SHARING LOG RECORD FOR ADD PARTNER
                  if (sharingLogList.length > 0) {
                      var sharingLogOption = {
                          sharingLogList: sharingLogList
                      };
                      var sharingLogResponse = await OutShareInstance.insertsharingLog(sharingLogOption);
                  }

                  //NOTIFY ALL AUTH USERS OF PARTNERS ACCOUNT
                  var invitationOption = {
                      addSharePartners: addSharePartners,
                      userId: userId,
                      shareItemType: Constants.OUT_SHARE_PROFILE_TYPES[parseInt(outShare.shareItemType)]

                  };
                  var notifyResponse = await OutShareInstance.sendInShareInvitation(invitationOption);

                  return resolve(Constants.OK_MESSAGE);
              } catch (err) {
                  debug('err', err);
                  return reject(err);
              }
          });
      },

      /*
      * Remove child record from OutSharePartner table
      * */
      removeOutSharePartnerRecord: function (options) {
          return new Promise(async function (resolve, reject) {
              var outShareInstanceId = options.outShareInstanceId;
              var removeSharePartners = options.removeSharePartners;

              try {
                  var conn = await connection.getConnection();

                  var response = await OutShareInstance.manipulateCheckInSharePartnerQuery({inSharePartners: removeSharePartners});

                  var isDeleted = await conn.query('DELETE from OutSharePartners where outShareInstanceId=uuid_to_bin(?) and ' +
                    'inSharePartnerId in (' + response.string + ')', [outShareInstanceId].concat(response.values));
                  isDeleted = Utils.isAffectedPool(isDeleted);

                  return resolve(Constants.OK_MESSAGE);
              } catch (err) {
                  debug('err', err);
                  err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_PARTNER_REMOVE_FAILED);
                  err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                  return reject(err);
              }
          });
      },

      /*
      * Update InShare record with status = stop
      * */
      updateInShare: function (options) {
          return new Promise(async function (resolve, reject) {
              var sharePartners = options.sharePartners;
              var outshareInstanceId = options.outShareInstanceId;
              var status = options.status;
              var userId = options.userId;
              var endDate = options.endDate;
              var updatedAt = DataUtils.getEpochMSTimestamp();
              var err;

              try {
                  if (sharePartners.length <= 0) {
                      return resolve(Constants.OK_MESSAGE);
                  }
                  var conn = await connection.getConnection();

                  var response = await OutShareInstance.manipulateCheckInSharePartnerQuery({inSharePartners: sharePartners});

                  var isUpdated = await conn.query('update InShare set status=?,updatedAt=?,updatedBy=uuid_to_bin(?),endDate=? where ' +
                    ' outShareInstanceId=uuid_to_bin(?) and accountId in (' + response.string + ')', [status, updatedAt, userId, endDate, outshareInstanceId].concat(response.values));
                  isUpdated = Utils.isAffectedPool(isUpdated);
                  /*if (!isUpdated) {
                    err = new Error(ErrorConfig.MESSAGE.IN_SHARE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }*/
                  return resolve(Constants.OK_MESSAGE);
              } catch (err) {
                  debug('err', err);
                  err = new Error(ErrorConfig.MESSAGE.IN_SHARE_UPDATE_FAILED);
                  err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                  return reject(err);
              }
          });
      },

      /*
    * Send notification to the auth users of removed partners
    * */
      notifyRemovedPartner: function (options) {
          return new Promise(async function (resolve, reject) {
              var outShareInstanceId = options.outShareInstanceId;
              var removeSharePartners = options.removeSharePartners;
              var userId = options.userId;
              var NotificationApi = require('../api/notification');

              try {
                  var inviterUser = await CustomerApi.getUserById({userId: userId});

                  await Promise.each(removeSharePartners, async function (partner) {

                      // GET ALL AUTH USER OF ACCOUNTS OR PARTNERS
                      var authUsers = await CustomerApi.getAuthorizeUser({accountId: partner.accountId});

                      // SEND NOTIFICATION FOR ALL AUTH USERS
                      var date = new Date();
                      var invitationExpirationDate = date.setDate(date.getDate() + Constants.INVITATION_EXPIRATION_DATE_LIMIT);
                      invitationExpirationDate = new Date(invitationExpirationDate);

                      await Promise.each(authUsers, async function (user) {
                          var inviteeUser = await CustomerApi.getUserByIdMD({
                              userId: user.userId,
                              notifyType: Constants.NOTIFICATION_CATEGORY_TYPE.SHARING
                          });

                          var opt = {
                              languageCultureCode: inviterUser.languageCultureCode,
                              template: Constants.EMAIL_TEMPLATES.REMOVE_PARTNER,
                              email: inviteeUser.email
                          };

                          var compileOptions = {
                              name: inviteeUser.firstName,
                              friend: inviterUser.email,
                              scopehub_login: ''
                          };

                          try {
                              var notifyFlag = JSON.parse(inviteeUser.notifyFlag);
                              // SEND EMAIL
                              if (notifyFlag.email === 1) {
                                  await EmailUtils.sendEmailPromise(opt, compileOptions);
                              }

                              if (notifyFlag.notification === 1) {
                                  var notificationOption = {
                                      refereId: outShareInstanceId, //id of out Share record
                                      refereType: Constants.NOTIFICATION_REFERE_TYPE.OUT_SHARE,
                                      user_ids: [inviteeUser.id],
                                      topic_id: inviteeUser.id,
                                      notificationExpirationDate: invitationExpirationDate,
                                      paramasDateTime: new Date(),
                                      notification_reference: NotificationReferenceData.REMOVE_PARTNER,
                                      metaEmail: inviterUser.email,
                                      paramsInviter: inviterUser.email + ', ' + (inviterUser.firstName ? inviterUser.firstName : '') + ' ' + (inviterUser.lastName ? inviterUser.lastName : ''),
                                      paramsInvitee: inviteeUser.email + ', ' + (inviteeUser.firstName ? inviteeUser.firstName : '') + ' ' + (inviteeUser.lastName ? inviteeUser.lastName : ''),
                                      languageCultureCode: inviteeUser.languageCultureCode,
                                      createdBy: inviterUser.id,
                                      type: Constants.DEFAULT_NOTIFICATION_TYPE
                                  };
                                  if (inviterUser.firstName) {
                                      notificationOption.metaName = inviterUser.firstName;
                                  }
                                  await NotificationApi.createMD(notificationOption);
                              }
                          } catch (err) {
                              debug('err', err);
                              err = new Error(ErrorConfig.MESSAGE.IN_SHARE_PARTNER_NOTIFY_FAILED);
                              err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                              return reject(err);
                          }
                      });
                  });

                  return resolve(Constants.OK_MESSAGE);
              } catch (err) {
                  debug('err', err);
                  err = new Error(ErrorConfig.MESSAGE.IN_SHARE_PARTNER_NOTIFY_FAILED);
                  err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                  return reject(err);
              }
          });
      },

      /*
      * Update inshare alert
      * */
      updateInShareAlert: function (options) {
          return new Promise(async function (resolve, reject) {
              var outshareInstanceId = options.outShareInstanceId;
              var removeShareItems = options.removeShareItems;
              var removeSharePartners = options.removeSharePartners;
              var status = options.status;
              var updatedAt = DataUtils.getEpochMSTimestamp();
              var string = '';
              var values = [];
              var err;

              try {
                  var conn = await connection.getConnection();

                  if (DataUtils.isDefined(removeShareItems)) {
                      var response = await OutShareInstance.manipulateCheckShareItemsQuery({shareItems: removeShareItems});
                      string += ' AND SA.shareItemId IN ( ' + response.string + ' ) ';
                      values = values.concat(response.values);
                  }
                  if (DataUtils.isDefined(removeSharePartners)) {
                      response = await OutShareInstance.manipulateCheckInSharePartnerQuery({inSharePartners: removeSharePartners});
                      string += ' AND SA.accountId IN ( ' + response.string + ' ) ';
                      values = values.concat(response.values);
                  }

                  var isUpdated = await conn.query('UPDATE SharingAlert SA, InShare IS1 SET SA.STATUS = ?, SA.updatedAt = ? ' +
                    ' WHERE SA.inShareId = IS1.id AND SA.accountId = IS1.accountId AND IS1.outShareInstanceId = uuid_to_bin(?) AND SA.status = ?' + string,
                    [status, updatedAt, outshareInstanceId, Constants.ALERT_STATUS.ACTIVE].concat(values));
                  //isUpdated = Utils.isAffectedPool(isUpdated);
                  debug('isUpdated', isUpdated);
                  /*if (!isUpdated) {
                    err = new Error(ErrorConfig.MESSAGE.IN_SHARE_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }*/
                  return resolve(Constants.OK_MESSAGE);
              } catch (err) {
                  debug('err', err);
                  err = new Error(ErrorConfig.MESSAGE.UPDATE_IN_SHARE_ALERT_FAILED);
                  err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                  return reject(err);
              }
          });
      },

      /*
    * Remove partners from outShare from update outshare api
    * */
      removeInShares: function (options) {
          return new Promise(async function (resolve, reject) {
              var outShareInstanceId = options.outShareInstanceId;
              var removeSharePartners = options.removeSharePartners;
              var userId = options.userId;
              var outShare = options.outShare;
              var currentDate = DataUtils.getEpochMSTimestamp();
              var SupplierApi = require('./supplier');
              var sharingLogList = [], err;

              var updateOutShareOption;
              var newUpdatedAt, newStatus;

              try {
                  // validate and check removeSharePartners array
                  _.map(removeSharePartners, function (partner) {
                      if (DataUtils.isUndefined(partner.accountId)) {
                          err = new Error(ErrorConfig.MESSAGE.PARTNER_ACCOUNT_ID_REQUIRED);
                          err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                          throw err;
                      }
                  });

                  // DELETE OUT SHARE PARTNER RECORD
                  var deleteOption = {
                      outShareInstanceId: outShareInstanceId,
                      removeSharePartners: removeSharePartners
                  };
                  var deleteResponse = await OutShareInstance.removeOutSharePartnerRecord(deleteOption);

                  // UPDATE IN SHARE RECORD WITH STATUS = STOP
                  var updateInShareOption = {
                      sharePartners: removeSharePartners,
                      outShareInstanceId: outShareInstanceId,
                      status: Constants.IN_SHARE_STATUS.STOP_BY_OUT_SHARE_PARTNER,
                      endDate: DataUtils.getEpochMSTimestamp(),
                      userId: userId
                  };
                  var updateInShareResponse = await OutShareInstance.updateInShare(updateInShareOption);

                  // UPDATE INSHARE ALERT WITH STATUS = IN_ACTIVE
                  var updateInShareAlertOptions = {
                      outShareInstanceId: outShareInstanceId,
                      status: Constants.ALERT_STATUS.IN_ACTIVE,
                      removeSharePartners: removeSharePartners
                  };
                  var updateInShareAlertResponse = await OutShareInstance.updateInShareAlert(updateInShareAlertOptions);
                  debug('updateInShareAlertResponse', updateInShareAlertResponse);
                  //throw err;

                  //Check this outShare has any active inShare or not , if not then stop it
                  var checkActiveInShareOption = {
                      outShares: [{
                          id: outShareInstanceId
                      }]
                  };
                  var outShareWithNoActiveInShare = await SupplierApi.getOutShareWithNoPartner(checkActiveInShareOption);

                  if (outShareWithNoActiveInShare.length > 0) {

                      var checkNewPauseInShareOption = {
                          outShares: [{
                              id: outShareInstanceId
                          }]
                      };
                      var outShareWithNewPauseInShare = await SupplierApi.getOutShareWithNewPauseInShare(checkNewPauseInShareOption);

                      if (outShareWithNewPauseInShare.length > 0) {
                          if (outShare.status === Constants.OUT_SHARE_STATUS.ACTIVE) {
                              updateOutShareOption = {
                                  outShareInstanceId: outShareInstanceId,
                                  userId: userId,
                                  status: Constants.OUT_SHARE_STATUS.PAUSED,
                                  endDate: DataUtils.getEpochMSTimestamp()
                              };
                          }
                      } else {
                          updateOutShareOption = {
                              outShareInstanceId: outShareInstanceId,
                              userId: userId,
                              status: Constants.OUT_SHARE_STATUS.STOP,
                              endDate: DataUtils.getEpochMSTimestamp()
                          };
                      }
                      //Update outShare with status stop/pause
                      if (updateOutShareOption) {
                          var updateResponse = await OutShareInstance.updateOutShareInstance(updateOutShareOption);
                          newUpdatedAt = updateResponse.updatedAt;
                          newStatus = updateResponse.status;
                          debug('updateResponse ', updateResponse);

                          // Stop sharing Events if exist
                          var updateSharingEventOption = {
                              outShares: [{
                                  id: outShareInstanceId
                              }],
                              userId: userId
                          };
                          debug('updateSharingEventOption ', updateSharingEventOption);
                          var udpateSharingResponse = await SupplierApi.updatesharingEvent(updateSharingEventOption);
                          debug('udpateSharingResponse', udpateSharingResponse);
                      }
                  }

                  var sharingLogObject;
                  await Promise.each(removeSharePartners, function (partner) {
                      sharingLogObject = {
                          outShareInstanceId: outShareInstanceId,
                          inSharePartnerId: partner.accountId,
                          shareItemId: Constants.DEFAULT_REFERE_ID,
                          createdBy: userId,
                          reasonCode: Constants.SHARING_LOG_REASON_CODE.REMOVE_PARTNER,
                          timestamp: currentDate,
                          createdAt: currentDate
                      };
                      sharingLogList.push(sharingLogObject);
                  });

                  // ADD SHARING LOG WHEN PARTNER IS REMOVED
                  if (sharingLogList.length > 0) {
                      var sharingLogOption = {
                          sharingLogList: sharingLogList
                      };
                      var sharingLogResponse = await OutShareInstance.insertsharingLog(sharingLogOption);
                  }

                  // NOTIFY REMOVED PARTNER
                  var notifyOption = {
                      removeSharePartners: removeSharePartners,
                      outShareInstanceId: outShareInstanceId,
                      userId: userId
                  };
                  var notifyResponse = await OutShareInstance.notifyRemovedPartner(notifyOption);

                  //return resolve(Constants.OK_MESSAGE);
                  return resolve({
                      OK: Constants.SUCCESS,
                      updatedAt: newUpdatedAt,
                      status: newStatus
                  });
              } catch (err) {
                  debug('err', err);
                  return reject(err);
              }
          });
      },

      /*
      * Prepare query string for multiple insert
      * */
      manipulateCheckShareItemsQuery: function (options) {
          return new Promise(function (resolve, reject) {
              var shareItems = options.shareItems;
              var string = '', values = [];

              _.map(shareItems, function (shareItem) {
                  string += 'uuid_to_bin(?),';
                  values.push(shareItem);
              });
              string = string.replace(/,\s*$/, ' ');
              return resolve({
                  string: string,
                  values: values
              });
          });
      }
      ,

      /*
      * Check how many share Item is there, not allow to add more then 10 share items
      * */
      checkForActiveShareItems: function (options) {
          return new Promise(async function (resolve, reject) {
              var outShareInstanceId = options.outShareInstanceId;
              var addShareItems = options.addShareItems;
              var accountId = options.accountId;
              var err;

              try {
                  var conn = await connection.getConnection();

                  var shareITems = await conn.query('IF (select 1 from OutShare where id = uuid_to_bin(?)) is null then ' +
                    ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "OUT_SHARE_INSTANCE_NOT_FOUND",MYSQL_ERRNO = 4001;' +
                    ' ELSE select count(*) as count from OutShareItems where outShareInstanceId=uuid_to_bin(?) and status = 1;end if;',
                    [outShareInstanceId, outShareInstanceId]);
                  debug('shareITems before', shareITems);
                  shareITems = Utils.filteredResponsePool(shareITems)[0];

                  if (shareITems && shareITems.count >= 10 || (shareITems.count + addShareItems.length) > 10) {
                      err = new Error(ErrorConfig.MESSAGE.CAN_NOT_ADD_MORE_THEN_10_ITEMS);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                      return reject(err);
                  }
                  return resolve(Constants.OK_MESSAGE);
              } catch (err) {
                  debug('err', err);
                  if (err.errno = 4001) {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_NOT_FOUND);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                  } else {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_GET_FAILED);
                      err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                  }
                  return reject(err);
              }
          });
      }
      ,

      /*
      * Check if same share Item is already exist or not
      * */
      checkAlreadyExistShareItem: function (options) {
          return new Promise(async function (resolve, reject) {
              var outShareInstanceId = options.outShareInstanceId;
              var addShareItems = options.addShareItems;
              var err;

              try {
                  var conn = await connection.getConnection();

                  var response = await OutShareInstance.manipulateCheckShareItemsQuery({shareItems: addShareItems});

                  var shareItems = await conn.query('select CAST(uuid_from_bin(shareItemId) as char) as shareItemId ' +
                    ' from OutShareItems where outShareInstanceId=uuid_to_bin(?) and status = 1 ' +
                    ' and shareItemId in (' + response.string + ') ;', [outShareInstanceId].concat(response.values));

                  debug('shareItems', shareItems.length);

                  if (shareItems.length > 0) {
                      err = new Error(ErrorConfig.MESSAGE.SHARE_ITEM_ALREADY_EXIST);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                      return reject(err);
                  }
                  return resolve(Constants.OK_MESSAGE);
              } catch (err) {
                  debug('err', err);
                  err = new Error(ErrorConfig.MESSAGE.SHARE_ITEM_CHECK_FAILED);
                  err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                  return reject(err);
              }
          });
      }
      ,

      /*
      * Create multiple out share item record
      * */
      createOutShareItems: function (options) {
          return new Promise(async function (resolve, reject) {
              var shareItemsList = options.shareItemsList;
              var query, values;

              var convertedshareItemsList, keys, err;
              await Utils.convertObjectToArrayMD(shareItemsList, async function (err, response) {
                  if (err) {
                      debug('err', err);
                      return reject(err);
                  }
                  convertedshareItemsList = response.list;
                  keys = response.keys;

                  query = 'insert into OutShareItems (' + keys + ') values';
                  values = ' (uuid_to_bin(?), uuid_to_bin(?),uuid_to_bin(?),?,?,?) ';


                  await Promise.each(shareItemsList, function (value) {
                      query = query + values;
                      query = query + ',';
                  });

                  query = query.replace(/,\s*$/, '');

                  try {
                      var conn = await connection.getConnection();
                      var inShareInserted = await conn.query(query, convertedshareItemsList);
                      inShareInserted = Utils.isAffectedPool(inShareInserted);
                      debug('outShareItems Inserted-----------------------------------------', inShareInserted);
                      if (!inShareInserted) {
                          throw err;
                      }
                      return resolve(Constants.OK_MESSAGE);
                  } catch (err) {
                      debug('err ', err);
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_ITEM_CREATION_FAILED);
                      err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                      return reject(err);
                  }
              });
          });
      }
      ,

      /*
      * Add NEW Share Items from update outShare api
      * */
      addShareItems: function (options) {
          return new Promise(async function (resolve, reject) {
              var outShareInstanceId = options.outShareInstanceId;
              var addShareItems = options.addShareItems;
              var sharePartners = options.sharePartners;
              var userId = options.userId;
              var shareItemsList = [];
              var createdAt = DataUtils.getEpochMSTimestamp();
              var updatedAt = DataUtils.getEpochMSTimestamp();
              var status = Constants.STATUS.ACTIVE;
              var sharingLogObject, sharingLogList = [];
              var err;

              try {
                  // Check if same share Item is already exist or not
                  var checkOption = {
                      outShareInstanceId: outShareInstanceId,
                      addShareItems: addShareItems
                  };
                  var checkResponse = await OutShareInstance.checkAlreadyExistShareItem(checkOption);

                  //Check how many share Item is there, not allow to add more then 10 share items
                  var checkCountOption = {
                      outShareInstanceId: outShareInstanceId,
                      addShareItems: addShareItems
                  };
                  var checkCountResponse = await OutShareInstance.checkForActiveShareItems(checkCountOption);

                  // CREATE OBJECT FOR OUT_SHARE_ITEMS RECORD
                  await Promise.each(addShareItems, function (shareItem) {
                      var generatedId = Utils.generateId();

                      var shareItemObject = {
                          id: generatedId.uuid,
                          outShareInstanceId: outShareInstanceId,
                          shareItemId: shareItem,
                          status: status,
                          createdAt: createdAt,
                          updatedAt: updatedAt
                      };

                      sharingLogObject = {
                          outShareInstanceId: outShareInstanceId,
                          inSharePartnerId: Constants.DEFAULT_REFERE_ID,
                          shareItemId: shareItem,
                          createdBy: userId,
                          reasonCode: Constants.SHARING_LOG_REASON_CODE.ADD_SHARE_ITEM,
                          timestamp: createdAt,
                          createdAt: createdAt
                      };

                      sharingLogList.push(sharingLogObject);
                      shareItemsList.push(shareItemObject);
                  });

                  // CREATE MULTIPLE OUT_SHARE_ITEM record
                  if (shareItemsList.length > 0) {
                      var createOption = {
                          shareItemsList: shareItemsList
                      };
                      var createResponse = await OutShareInstance.createOutShareItems(createOption);
                  }

                  // ADD SHARING LOG WHEN NEW ITEM IS ADDED
                  if (sharingLogList.length > 0) {
                      var sharingLogOption = {
                          sharingLogList: sharingLogList
                      };
                      var sharingLogResponse = await OutShareInstance.insertsharingLog(sharingLogOption);
                  }

                  //NOTIFY ALL AUTHORIZE USER OF THIS PARTNER
                  if (sharePartners && sharePartners.length > 0) {
                      var notifyOptions = {
                          sharePartners: sharePartners,
                          outShareInstanceId: outShareInstanceId,
                          notificationReference: NotificationReferenceData.ADD_SHARE_ITEM,
                          emailTemplate: Constants.EMAIL_TEMPLATES.ADD_SHARE_ITEM,
                          userId: userId
                      };
                      var notifyResponse = await OutShareInstance.notifyPartnersForAddRemoveShareItems(notifyOptions);
                  }

                  return resolve(Constants.OK_MESSAGE);
              } catch (err) {
                  debug('err', err);
                  return reject(err);
              }
          });
      }
      ,

      /*
      * Notify partner if any items added from outshare
      * */
      notifyPartnersForAddRemoveShareItems: function (options) {
          return new Promise(async function (resolve, reject) {
              var outShareInstanceId = options.outShareInstanceId;
              var sharePartners = options.sharePartners;
              var notificationReference = options.notificationReference;
              var emailTemplate = options.emailTemplate;
              var userId = options.userId;
              var NotificationApi = require('../api/notification');

              try {
                  var inviterUser = await CustomerApi.getUserById({userId: userId});

                  await Promise.each(sharePartners, async function (partner) {

                      // GET ALL AUTH USER OF ACCOUNTS OR PARTNERS
                      var authUsers = await CustomerApi.getAuthorizeUser({accountId: partner.accountId});

                      // SEND NOTIFICATION FOR ALL AUTH USERS
                      var date = new Date();
                      var invitationExpirationDate = date.setDate(date.getDate() + Constants.INVITATION_EXPIRATION_DATE_LIMIT);
                      invitationExpirationDate = new Date(invitationExpirationDate);

                      await Promise.each(authUsers, async function (user) {
                          var inviteeUser = await CustomerApi.getUserByIdMD({
                              userId: user.userId,
                              notifyType: Constants.NOTIFICATION_CATEGORY_TYPE.SHARING
                          });

                          var opt = {
                              languageCultureCode: inviterUser.languageCultureCode,
                              template: emailTemplate,
                              email: inviteeUser.email
                          };

                          var compileOptions = {
                              name: inviteeUser.firstName,
                              friend: inviterUser.email,
                              scopehub_login: ''
                          };

                          try {
                              var notifyFlag = JSON.parse(inviteeUser.notifyFlag);
                              // SEND EMAIL
                              if (notifyFlag.email === 1) {
                                  await EmailUtils.sendEmailPromise(opt, compileOptions);
                              }
                              if (notifyFlag.notification === 1) {
                                  var notificationOption = {
                                      refereId: outShareInstanceId, //id of out Share record/in share record
                                      refereType: Constants.NOTIFICATION_REFERE_TYPE.OUT_SHARE,
                                      user_ids: [inviteeUser.id],
                                      topic_id: inviteeUser.id,
                                      notificationExpirationDate: invitationExpirationDate,
                                      paramasDateTime: new Date(),
                                      notification_reference: notificationReference,
                                      metaEmail: inviterUser.email,
                                      paramsInviter: inviterUser.email + ', ' + (inviterUser.firstName ? inviterUser.firstName : '') + ' ' + (inviterUser.lastName ? inviterUser.lastName : ''),
                                      paramsInvitee: inviteeUser.email + ', ' + (inviteeUser.firstName ? inviteeUser.firstName : '') + ' ' + (inviteeUser.lastName ? inviteeUser.lastName : ''),
                                      languageCultureCode: inviteeUser.languageCultureCode,
                                      createdBy: inviterUser.id,
                                      type: Constants.DEFAULT_NOTIFICATION_TYPE
                                  };
                                  if (inviterUser.firstName) {
                                      notificationOption.metaName = inviterUser.firstName;
                                  }
                                  debug('notificationOption', notificationOption);
                                  await NotificationApi.createMD(notificationOption);
                              }
                          } catch (err) {
                              debug('err', err);
                              err = new Error(ErrorConfig.MESSAGE.IN_SHARE_PARTNER_NOTIFY_FAILED);
                              err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                              return reject(err);
                          }
                      });
                  });
                  return resolve(Constants.OK_MESSAGE);
              } catch (err) {
                  debug('err', err);
                  return reject(err);
              }
          });
      }
      ,

      /*
      * UPDATE OUT SHARE ITEMS WITH STATUS = 0 (deactivate)
      * */
      updateOutShareItems: function (options) {
          return new Promise(async function (resolve, reject) {
              var removeShareItems = options.removeShareItems;
              var outShareInstanceId = options.outShareInstanceId;
              var status = Constants.STATUS.DEACTIVE;
              var currentDate = DataUtils.getEpochMSTimestamp();
              var err;

              try {
                  var conn = await connection.getConnection();

                  var response = await OutShareInstance.manipulateCheckShareItemsQuery({shareItems: removeShareItems});

                  var isUpdated = await conn.query('update OutShareItems set status=? , endDate=?, updatedAt=? where ' +
                    ' outShareInstanceId = uuid_to_bin(?) and shareItemId in (' + response.string + ')',
                    [status, currentDate, currentDate, outShareInstanceId].concat(response.values));
                  isUpdated = Utils.isAffectedPool(isUpdated);

                  if (!isUpdated) {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_ITEM_NOT_FOUND);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                      return reject(err);
                  }
                  return resolve(Constants.OK_MESSAGE);
              } catch (err) {
                  debug('err', err);
                  err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_ITEM_UPDATE_FAILED);
                  err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                  return reject(err);
              }
          });
      }
      ,

      /*
       * UPDATE ALL ACTIVE INSHARE TO STOP BY OUTSHARE ID
       * */
      updateInShareByOutShareId: function (options) {
          return new Promise(async function (resolve, reject) {
              var outShareInstanceId = options.outShareInstanceId;
              var inShareStatus = Constants.IN_SHARE_STATUS.STOP_BY_OUT_SHARE_PARTNER;
              var userId = options.userId;
              var currentDate = DataUtils.getEpochMSTimestamp();
              var err;

              try {
                  var conn = await connection.getConnection();
                  var response = await ProductInventoryApi.manipulateOutShareQuery({
                      outShares: [{
                          id: outShareInstanceId
                      }]
                  });
                  /*var isDeletePartners = await conn.query('delete from OutSharePartners where outShareInstanceId in (' + response.string + ')', response.values);
                  isDeletePartners = Utils.isAffectedPool(isDeletePartners);*/

                  var isInshareUpdated = await conn.query('update InShare set status=?,updatedAt=?,updatedBy=uuid_to_bin(?),endDate=? where ' +
                    'outShareInstanceId in (' + response.string + ') and status = 1;', [inShareStatus, currentDate, userId, currentDate].concat(response.values));
                  isInshareUpdated = Utils.isAffectedPool(isInshareUpdated);

                  return resolve(Constants.OK_MESSAGE);
              } catch (err) {
                  debug('err', err);
                  err = new Error(ErrorConfig.MESSAGE.IN_SHARE_UPDATE_FAILED);
                  err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                  return reject(err);
              }
          });
      }
      ,

      /*
      * REMOVE OLD SHARE ITEMS FROM UPDATE OUTSHARE API
      * */
      removeShareItems: function (options) {
          return new Promise(async function (resolve, reject) {
              var outShareInstanceId = options.outShareInstanceId;
              var removeShareItems = options.removeShareItems;
              var sharePartners = options.sharePartners;
              var userId = options.userId;
              var sharingLogObject, sharingLogList = [];
              var createdAt = DataUtils.getEpochMSTimestamp();
              var SupplierApi = require('./supplier');
              var newUpdatedAt, newStatus;

              try {
                  // UPDATE OUT SHARE ITEMS WITH STATUS = 0 (deactivate)
                  var updateOption = {
                      outShareInstanceId: outShareInstanceId,
                      removeShareItems: removeShareItems
                  };
                  var updateResponse = await OutShareInstance.updateOutShareItems(updateOption);

                  // UPDATE IN SHARE ALERT WITH STATUS = IN_ACTIVE (0)
                  var updateInShareAlertOption = {
                      outShareInstanceId: outShareInstanceId,
                      removeShareItems: removeShareItems,
                      status: Constants.ALERT_STATUS.IN_ACTIVE
                  };
                  var updateInShareAlertResponse = await OutShareInstance.updateInShareAlert(updateInShareAlertOption);
                  debug('updateInShareAlertResponse', updateInShareAlertResponse);
                  //throw err;

                  //CHECK if any active shareItem is exist or not , if not then stop this outshare
                  var checkActiveItemOption = {
                      outShares: [{
                          id: outShareInstanceId
                      }]
                  };
                  var checkResponse = await ProductInventoryApi.getOutShareWithNoItems(checkActiveItemOption);
                  if (checkResponse.length > 0) {

                      //UPDATE ACTIVE INSHARE WITH STOP
                      var updateInShareOption = {
                          outShareInstanceId: outShareInstanceId,
                          userId: userId
                      };
                      var updateInShareResponse = await OutShareInstance.updateInShareByOutShareId(updateInShareOption);

                      //UPDATE OUTSHARE WITH STATUS = STOP
                      var updateOutShareOption = {
                          outShareInstanceId: outShareInstanceId,
                          userId: userId,
                          status: Constants.OUT_SHARE_STATUS.STOP,
                          endDate: DataUtils.getEpochMSTimestamp()
                      };
                      updateResponse = await OutShareInstance.updateOutShareInstance(updateOutShareOption);
                      newUpdatedAt = updateResponse.updatedAt;
                      newStatus = updateResponse.status;

                      //UPDATE SHARING EVENT by stoping it
                      var updateSharingEventOption = {
                          outShares: [{
                              id: outShareInstanceId
                          }],
                          userId: userId
                      };
                      var udpateSharingResponse = await SupplierApi.updatesharingEvent(updateSharingEventOption);
                  }

                  await Promise.each(removeShareItems, function (shareItem) {
                      sharingLogObject = {
                          outShareInstanceId: outShareInstanceId,
                          inSharePartnerId: Constants.DEFAULT_REFERE_ID,
                          shareItemId: shareItem,
                          createdBy: userId,
                          reasonCode: Constants.SHARING_LOG_REASON_CODE.REMOVE_SHARE_ITEM,
                          timestamp: createdAt,
                          createdAt: createdAt
                      };
                      sharingLogList.push(sharingLogObject);
                  });

                  // ADD SHARING LOG WHEN ITEM IS REMOVED
                  if (sharingLogList.length > 0) {
                      var sharingLogOption = {
                          sharingLogList: sharingLogList
                      };
                      var sharingLogResponse = await OutShareInstance.insertsharingLog(sharingLogOption);
                  }

                  //NOTIFY ALL AUTHORIZE USER OF ALL SHARE PARTNERS
                  if (sharePartners && sharePartners.length > 0) {
                      var notifyOptions = {
                          sharePartners: sharePartners,
                          outShareInstanceId: outShareInstanceId,
                          notificationReference: NotificationReferenceData.REMOVE_SHARE_ITEM,
                          emailTemplate: Constants.EMAIL_TEMPLATES.REMOVE_SHARE_ITEM,
                          userId: userId
                      };
                      var notifyResponse = await OutShareInstance.notifyPartnersForAddRemoveShareItems(notifyOptions);
                  }
                  return resolve({
                      OK: Constants.SUCCESS,
                      updatedAt: newUpdatedAt,
                      status: newStatus
                  });

              } catch (err) {
                  debug('err', err);
                  return reject(err);
              }
          });
      }
      ,

      /*
      * Get all outShare partners of outShare instance
      * */
      getAllSharePartners: function (options) {
          return new Promise(async function (resolve, reject) {
              var outShareInstanceId = options.outShareInstanceId;
              var err;

              try {
                  var conn = await connection.getConnection();

                  var sharePartners = await conn.query('select CAST(uuid_from_bin(accountId) as char) as accountId ' +
                    'from InShare where outShareInstanceId = uuid_to_bin(?) and status = 1;', [outShareInstanceId]);

                  return resolve(sharePartners);
              } catch (err) {
                  debug('err', err);
                  err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_PARTNER_GET_FAILED);
                  err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                  return reject(err);
              }

          });
      }
      ,

      /*
      * Build  a field string for update outshare instanct
      * */
      validateOptionalFields: function (options) {
          return new Promise(function (resolve, reject) {
              var err;
              var outShareInstanceFields = '';
              var outShareInstanceOptionalValues = [];

              try {
                  if (!DataUtils.isValidateOptionalField(options.status)) {
                      outShareInstanceFields += 'status=? ,';
                      outShareInstanceOptionalValues.push(options.status);
                  }
                  if (!DataUtils.isValidateOptionalField(options.endDate)) {
                      outShareInstanceFields += 'endDate=? ,';
                      outShareInstanceOptionalValues.push(options.endDate);
                  }
                  if (!DataUtils.isValidateOptionalField(options.outShareId)) {
                      outShareInstanceFields += 'outShareId=? ,';
                      outShareInstanceOptionalValues.push(options.outShareId);
                  }
                  if (!DataUtils.isValidateOptionalField(options.outShareName)) {
                      outShareInstanceFields += 'outShareName=? ,';
                      outShareInstanceOptionalValues.push(options.outShareName);
                  }
                  if (!DataUtils.isValidateOptionalField(options.startDateType)) {
                      outShareInstanceFields += 'startDateType=? ,';
                      outShareInstanceOptionalValues.push(options.startDateType);
                  }
                  if (!DataUtils.isValidateOptionalField(options.offeredStartDate)) {
                      outShareInstanceFields += 'offeredStartDate=? ,';
                      outShareInstanceOptionalValues.push(options.offeredStartDate);
                  }
                  if (!DataUtils.isValidateOptionalField(options.actualSharingDate)) {
                      outShareInstanceFields += 'actualSharingDate=? ,';
                      outShareInstanceOptionalValues.push(options.actualSharingDate);
                  }

                  var response = {
                      outShareInstanceFields: outShareInstanceFields,
                      outShareInstanceOptionalValues: outShareInstanceOptionalValues
                  };
                  return resolve(response);
              } catch (err) {
                  debug('err', err);
                  return reject(err);
              }
          });
      }
      ,

      /*
      * Update a outshare record with status , end date
      * */
      updateOutShareInstance: function (options) {
          return new Promise(async function (resolve, reject) {
              var outShareInstanceId = options.outShareInstanceId;
              var newUpdatedAt = DataUtils.getEpochMSTimestamp();
              var userId = options.userId;

              var outShareInstanceFields, outShareInstanceOptionalValues = [], outShareInstanceRequiredValues = [];
              var err;

              try {
                  outShareInstanceRequiredValues.push(outShareInstanceId);
                  var response = await OutShareInstance.validateOptionalFields(options);

                  outShareInstanceFields = response.outShareInstanceFields;
                  outShareInstanceOptionalValues = response.outShareInstanceOptionalValues;


                  outShareInstanceRequiredValues = _.concat(outShareInstanceRequiredValues, outShareInstanceOptionalValues);
                  outShareInstanceRequiredValues.push(userId, newUpdatedAt, outShareInstanceId);

                  var conn = await connection.getConnection();

                  var isOutShareUpdated = await conn.query('IF (select 1 from OutShare where id=uuid_to_bin(?)) is null then ' +
                    'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "OUT_SHARE_INSTANCE_NOT_FOUND", MYSQL_ERRNO = 4001;' +
                    'ELSE update OutShare set ' + outShareInstanceFields + ' updatedBy=uuid_to_bin(?), updatedAt = ? ' +
                    'where id=uuid_to_bin(?); END IF;', outShareInstanceRequiredValues);

                  isOutShareUpdated = Utils.isAffectedPool(isOutShareUpdated);

                  if (!isOutShareUpdated) {
                      throw err;
                  }
                  return resolve({
                      OK: Constants.SUCCESS,
                      updatedAt: newUpdatedAt,
                      status: options.status
                  });

              } catch (err) {
                  debug('err', err);
                  if (err.errno === 4001) {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_NOT_FOUND);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                      return reject(err);
                  }
                  err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_UPDATE_FAILED);
                  err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                  return reject(err);
              }
          });
      }
      ,

      updateNotes: function (options) {
          return new Promise(async function (resolve, reject) {
              var sharingProfileId = options.sharingProfileId;
              var newUpdatedAt = DataUtils.getEpochMSTimestamp();
              var userId = options.userId;

              try {

                  var conn = await connection.getConnection();

                  var isNotesUpdated = await conn.query('update OutSharingProfile set notes=?, updatedBy=uuid_to_bin(?), ' +
                    'updatedAt = ? where id=uuid_to_bin(?)', [options.notes, userId, newUpdatedAt, sharingProfileId]);

                  isNotesUpdated = Utils.isAffectedPool(isNotesUpdated);

                  if (!isNotesUpdated) {
                      throw err;
                  }
                  return resolve({
                      OK: Constants.SUCCESS
                  });

              } catch (err) {
                  debug('err', err);
                  err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_SHARING_PROFILE_ID_UPDATE_FAILED);
                  err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                  return reject(err);
              }
          });
      }
      ,
      /*
      * Update sharing event record while share stop or pause
      * */
      updateSharingEvents: function (options) {
          return new Promise(async function (resolve, reject) {
              var outShareInstanceId = options.outShareInstanceId;
              var status = options.status;
              var endDate = options.endDate;
              var updatedAt = DataUtils.getEpochMSTimestamp();

              try {
                  var conn = await connection.getConnection();

                  var isUpdated = await conn.query('if (select 1 from SharingEvents where outShareInstanceId=uuid_to_bin(?) and status = 1 ) is not null then ' +
                    ' update SharingEvents set status=?,endDate=?, updatedAt=? where ' +
                    ' outShareInstanceId=uuid_to_bin(?) and status = 1 ; end if;', [outShareInstanceId, status, endDate, updatedAt, outShareInstanceId]);

                  isUpdated = Utils.isAffectedPool(isUpdated);
                  /*if (!isUpdated) {
                    err = new Error(ErrorConfig.MESSAGE.SHARING_EVENT_NOT_EXIST);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }*/
                  return resolve(Constants.OK_MESSAGE);
              } catch (err) {
                  debug('err', err);
                  err = new Error(ErrorConfig.MESSAGE.SHARING_EVENT_UPDATE_FAILED);
                  err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                  return reject(err);
              }
          });
      }
      ,

      /*
      * Delete outShare Partners
      * */
      deleteOutSharePartners: function (options) {
          return new Promise(async function (resolve, reject) {
              var outShareInstanceId = options.outShareInstanceId;
              var err;

              try {
                  var conn = await connection.getConnection();

                  var isDeleted = await conn.query('delete from OutSharePartners where outShareInstanceId = uuid_to_bin(?);', [outShareInstanceId]);
                  isDeleted = Utils.isAffectedPool(isDeleted);
                  debug('isDeleted parnter', isDeleted);

                  return resolve(Constants.OK_MESSAGE);
              } catch (err) {
                  debug('err', err);
                  return reject(err);
              }

          });
      }
      ,

      /*
      * update inShare status = active if current status is pause by outshare partner
      * */
      updateInshareActive: function (options) {
          return new Promise(async function (resolve, reject) {
              var outShareInstanceId = options.outShareInstanceId;
              var userId = options.userId;
              var oldStatus = Constants.IN_SHARE_STATUS.PAUSED_BY_OUT_SHARE_PARTNER;
              var newStatus = Constants.IN_SHARE_STATUS.ACTIVE;
              var currentDate = DataUtils.getEpochMSTimestamp();
              var err;

              try {
                  var conn = await connection.getConnection();
                  var isUpdated = await conn.query('update InShare set status = ?, updatedAt=?,updatedBy = uuid_to_bin(?) where ' +
                    'status = ? and outShareInstanceId = uuid_to_bin(?);', [newStatus, currentDate, userId, oldStatus, outShareInstanceId]);
                  isUpdated = Utils.isAffectedPool(isUpdated);
                  debug('isUpdated', isUpdated);
                  return resolve(Constants.OK_MESSAGE);
              } catch (err) {
                  debug('err', err);
                  err = new Error(ErrorConfig.MESSAGE.IN_SHARE_UPDATE_FAILED);
                  err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                  return reject(err);
              }
          });
      }
      ,

      /*
      * Update Status / outshareId / outshareName
      * */
      updateOutShareStatus: function (options) {
          return new Promise(async function (resolve, reject) {
              var outShareInstanceId = options.outShareInstanceId;
              var userId = options.userId;
              var outShare = options.outShare;
              var status = options.status;
              var sharePartners = options.sharePartners;
              var updateOutShareOption, updateOutShareResponse, updateInShareOption;
              var sharingLogOption, sharingLogResponse, notifyOptions, notifyResponse;
              var updateSharingEventOption, updateSharingEventResponse;
              var currentDate = DataUtils.getEpochMSTimestamp();
              var err;

              try {

                  debug('status', status);
                  debug('status', Constants.OUT_SHARE_STATUS.STOP);
                  if (status === Constants.OUT_SHARE_STATUS.PAUSED) {
                      debug('1');

                      // Check current status of outShare and validate
                      if (outShare.status !== Constants.OUT_SHARE_STATUS.ACTIVE) {
                          err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_STATUS_CAN_NOT_UPDATE_TO_PAUSED);
                          err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                          throw err;
                      }

                      debug('2');
                      //UPDATE OUTSHARE
                      updateOutShareOption = {
                          outShareInstanceId: outShareInstanceId,
                          userId: userId,
                          status: status,
                          endDate: DataUtils.getEpochMSTimestamp()
                      };
                      updateOutShareResponse = await OutShareInstance.updateOutShareInstance(updateOutShareOption);

                      debug('sharePartners', sharePartners);
                      // UPDATE INSHAREs
                      updateInShareOption = {
                          outShareInstanceId: outShareInstanceId,
                          sharePartners: sharePartners,
                          userId: userId,
                          status: Constants.IN_SHARE_STATUS.PAUSED_BY_OUT_SHARE_PARTNER,
                          endDate: DataUtils.getEpochMSTimestamp()
                      };
                      updateInShareResponse = await OutShareInstance.updateInShare(updateInShareOption);

                      // Insert a Sharing log for status change
                      sharingLogOption = {
                          outShareInstanceId: outShareInstanceId,
                          inSharePartnerId: Constants.DEFAULT_REFERE_ID,
                          shareItemId: Constants.DEFAULT_REFERE_ID,
                          createdBy: userId,
                          reasonCode: Constants.SHARING_LOG_REASON_CODE.SHARING_PAUSE_BY_OUT_SHARE_PARTNER,
                          timestamp: currentDate,
                          createdAt: currentDate
                      };
                      sharingLogResponse = await OutShareInstance.insertsharingLog({sharingLogList: [sharingLogOption]});

                      // UPDATE SHARING EVENT BY STOPING IT
                      if (outShare.status === Constants.OUT_SHARE_STATUS.ACTIVE) {
                          updateSharingEventOption = {
                              outShareInstanceId: outShareInstanceId,
                              status: Constants.SHARING_EVENT_STATUS.DEACTIVE,
                              endDate: DataUtils.getEpochMSTimestamp()
                          };
                          updateSharingEventResponse = await OutShareInstance.updateSharingEvents(updateSharingEventOption);
                      }

                      //NOTIFY THE SHARE PARTNERS
                      if (sharePartners && sharePartners.length > 0) {
                          notifyOptions = {
                              sharePartners: sharePartners,
                              outShareInstanceId: outShareInstanceId,
                              notificationReference: NotificationReferenceData.DATA_SHARE_PAUSED,
                              emailTemplate: Constants.EMAIL_TEMPLATES.PAUSE_DATA_SHARING,
                              userId: userId
                          };
                          notifyResponse = await OutShareInstance.notifyPartnersForAddRemoveShareItems(notifyOptions);
                      }

                  } else if (status === Constants.OUT_SHARE_STATUS.STOP) {
                      debug('Inside if =============');
                      // Check current status of outShare and validate
                      if (outShare.status !== Constants.OUT_SHARE_STATUS.ACTIVE && outShare.status !== Constants.OUT_SHARE_STATUS.PAUSED) {
                          err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_STATUS_CAN_NOT_UPDATE_TO_STOP);
                          err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                          throw err;
                      }

                      //UPDATE OUTSHARE
                      updateOutShareOption = {
                          outShareInstanceId: outShareInstanceId,
                          userId: userId,
                          status: status,
                          endDate: DataUtils.getEpochMSTimestamp()
                      };
                      updateOutShareResponse = await OutShareInstance.updateOutShareInstance(updateOutShareOption);

                      // DELETE OUT SHARE PARTNER (CHILD RECORd)
                      /*var deleteOption = {
                          outShareInstanceId: outShareInstanceId
                      };
                      var deleteResponse = await OutShareInstance.deleteOutSharePartners(deleteOption);*/

                      // UPDATE INSHAREs
                      updateInShareOption = {
                          outShareInstanceId: outShareInstanceId,
                          sharePartners: sharePartners,
                          userId: userId,
                          status: Constants.IN_SHARE_STATUS.STOP_BY_OUT_SHARE_PARTNER,
                          endDate: DataUtils.getEpochMSTimestamp()
                      };
                      updateInShareResponse = await OutShareInstance.updateInShare(updateInShareOption);

                      // Insert a Sharing log for status change
                      sharingLogOption = {
                          outShareInstanceId: outShareInstanceId,
                          inSharePartnerId: Constants.DEFAULT_REFERE_ID,
                          shareItemId: Constants.DEFAULT_REFERE_ID,
                          createdBy: userId,
                          reasonCode: Constants.SHARING_LOG_REASON_CODE.SHARING_STOP_BY_OUT_SHARE_PARTNER,
                          timestamp: currentDate,
                          createdAt: currentDate
                      };
                      sharingLogResponse = await OutShareInstance.insertsharingLog({sharingLogList: [sharingLogOption]});

                      // UPDATE SHARING EVENT BY STOPING IT
                      if (outShare.status === Constants.OUT_SHARE_STATUS.ACTIVE) {
                          updateSharingEventOption = {
                              outShareInstanceId: outShareInstanceId,
                              status: Constants.SHARING_EVENT_STATUS.DEACTIVE,
                              endDate: DataUtils.getEpochMSTimestamp()
                          };
                          updateSharingEventResponse = await OutShareInstance.updateSharingEvents(updateSharingEventOption);
                      }

                      //NOTIFY THE SHARE PARTNERS
                      if (sharePartners && sharePartners.length > 0) {
                          notifyOptions = {
                              sharePartners: sharePartners,
                              outShareInstanceId: outShareInstanceId,
                              notificationReference: NotificationReferenceData.DATA_SHARE_STOP,
                              emailTemplate: Constants.EMAIL_TEMPLATES.STOP_DATA_SHARING,
                              userId: userId
                          };
                          notifyResponse = await OutShareInstance.notifyPartnersForAddRemoveShareItems(notifyOptions);
                      }
                  } else if (status === Constants.OUT_SHARE_STATUS.ACTIVE) {
                      if (outShare.status === Constants.OUT_SHARE_STATUS.STOP) {
                          err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_STATUS_CAN_NOT_UPDATE_TO_ACTIVE);
                          err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                          throw err;
                      }

                      //UPDATE OUTSHARE
                      updateOutShareOption = {
                          outShareInstanceId: outShareInstanceId,
                          userId: userId,
                          status: status,
                          endDate: DataUtils.getEpochMSTimestamp()
                      };
                      updateOutShareResponse = await OutShareInstance.updateOutShareInstance(updateOutShareOption);


                      //NEED TO UPDATE INSHARE PARTNER STATUS = ACTIVE WHOSE STATUS IS PAUSE_BY_OUT_SHARE_PARTNER
                      updateInShareOption = {
                          outShareInstanceId: outShareInstanceId,
                          userId: userId
                      };
                      var updateInShareResponse = await OutShareInstance.updateInshareActive(updateInShareOption);
                      debug('updateInShareResponse', updateInShareResponse);

                      // GET ALL SHARE PARTNERS
                      var activeSharePartners = await OutShareInstance.getAllSharePartners({outShareInstanceId: outShareInstanceId});
                      debug('activeSharePartners', activeSharePartners.length);

                      //NOTIFY THE SHARE PARTNERS
                      if (activeSharePartners && activeSharePartners.length > 0) {
                          // get nextSharingDate
                          var nextSharingDate = await InShareApi.getFrequencyDateTime(outShare);


                          // CREATE A SHARING EVENT
                          var generatedId = Utils.generateId();
                          var createSharingEventOption = {
                              id: generatedId.uuid,
                              outShareInstanceId: outShareInstanceId,
                              startDate: currentDate,
                              nextSharingDate: nextSharingDate,
                              status: Constants.SHARING_EVENT_STATUS.ACTIVE,
                              frequency: outShare.freqType
                          };
                          var createSharingEventResponse = await OutShareInstance.createUpdateSharingEvent(createSharingEventOption);
                          debug('createSharingEventResponse', createSharingEventResponse);


                          // NOTIFY ACTIVE PARTNERS
                          notifyOptions = {
                              sharePartners: activeSharePartners,
                              outShareInstanceId: outShareInstanceId,
                              notificationReference: NotificationReferenceData.DATA_SHARE_ACTIVE,
                              emailTemplate: Constants.EMAIL_TEMPLATES.ACTIVE_DATA_SHARING,
                              userId: userId
                          };
                          notifyResponse = await OutShareInstance.notifyPartnersForAddRemoveShareItems(notifyOptions);
                      }
                  } else {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_STATUS_INVALID);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                      throw err;
                  }

                  return resolve({
                      OK: Constants.SUCCESS,
                      updatedAt: updateOutShareResponse.updatedAt,
                      status: updateOutShareResponse.status
                  });
              } catch (err) {
                  debug('err', err);
                  return reject(err);
              }
          });
      }
      ,

      /*
      * Get outShare Instance
      * */
      getOutShareInstance: function (options) {
          return new Promise(async function (resolve, reject) {
              var outShareInstanceId = options.outShareInstanceId;
              var updatedAt = options.updatedAt;
              var outShare;
              var err;

              try {
                  var conn = await connection.getConnection();
                  outShare = await conn.query('SELECT CAST(uuid_from_bin(OS.id) AS CHAR) AS id, CAST(uuid_from_bin(OS.sharingProfileId) AS CHAR) AS sharingProfileId,' +
                    ' CAST(uuid_from_bin(OS.accountId) AS CHAR) AS accountId, OS.status,OS.shareItemType,OS.offeredStartDate,OS.startDateType,OS.updatedAt,OS.actualSharingDate,' +
                    ' OSP.freqType,OSP.freqTime,OSP.freqDay  FROM OutShare OS , OutSharingProfile OSP' +
                    ' WHERE OS.id = uuid_to_bin(?) and OS.sharingProfileId = OSP.id', [outShareInstanceId]);

                  outShare = Utils.filteredResponsePool(outShare);
                  if (!outShare) {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ID_INVALID);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                      throw err;
                  }
                  if (DataUtils.isUndefined(options.checkFlag)) {
                      if (outShare.updatedAt !== updatedAt) {
                          err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                          err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                          throw err;
                      }

                      if (outShare.status === Constants.OUT_SHARE_STATUS.EXPIRED) {
                          err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ALREADY_EXPIRED);
                          err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                          throw err;
                      }
                  }

                  return resolve(outShare);
              } catch (err) {
                  debug('err', err);
                  return reject(err);
              }
          });
      }
      ,

      /*
      * Get invitation accepted inSharePartners
      * */
      getInvitationAcceptedInSharePartner: function (options) {
          return new Promise(async function (resolve, reject) {
              var outShareInstanceId = options.outShareInstanceId;
              var err;
              var acceptedPartners;

              try {
                  var conn = await connection.getConnection();
                  acceptedPartners = await conn.query('select CAST(uuid_from_bin(accountId) as char) as accountId from InShare where outShareInstanceId = uuid_to_bin(?) and status = 1;', [outShareInstanceId]);

                  if (!acceptedPartners) {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ID_INVALID);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                      throw err;
                  }

                  return resolve(acceptedPartners);
              } catch (err) {
                  debug('err', err);
                  return reject(err);
              }
          });
      }
      ,

      /*
      * MANAGE SHARING EVENT WHEN UPDATING THE START DATE
      * */
      manageSharingEvent: function (options) {
          return new Promise(async function (resolve, reject) {
              //var isEventCreate = false, isEventUpdate = false;
              var eventFlag = false;
              var freqType = options.freqType;
              var outShareInstanceId = options.outShareInstanceId;
              var outShare = options.outShare;

              try {
                  if (freqType) {
                      if (outShare.freqType === Constants.OUT_SHARE_FREQ_TYPE.REAL_TIME && freqType !== Constants.OUT_SHARE_FREQ_TYPE.REAL_TIME) {
                          eventFlag = true;
                      } else if (outShare.freqType !== Constants.OUT_SHARE_FREQ_TYPE.REAL_TIME && freqType === Constants.OUT_SHARE_FREQ_TYPE.REAL_TIME) {

                          // DEACTIVATE EVENT WHICH IS ALREADY CREATED
                          var updateEventOption = {
                              outShareInstanceId: outShareInstanceId,
                              status: Constants.SHARING_EVENT_STATUS.DEACTIVE,
                              endDate: DataUtils.getEpochMSTimestamp()
                          };
                          var updateEventResponse = await OutShareInstance.updateSharingEvents(updateEventOption);

                      } else if (outShare.freqType !== Constants.OUT_SHARE_FREQ_TYPE.REAL_TIME && freqType !== Constants.OUT_SHARE_FREQ_TYPE.REAL_TIME) {
                          eventFlag = true;
                      } else if (outShare.freqType === Constants.OUT_SHARE_FREQ_TYPE.REAL_TIME && freqType === Constants.OUT_SHARE_FREQ_TYPE.REAL_TIME) {
                          // isEventUpdate = true;
                          // do nothing
                      }
                  } else {
                      if (outShare.freqType !== Constants.OUT_SHARE_FREQ_TYPE.REAL_TIME) {
                          eventFlag = true;
                      }
                  }
                  var response = {
                      eventFlag: eventFlag
                  };

                  return resolve(response);
              } catch (err) {
                  debug('err', err);
                  return reject(err);
              }
          });
      }
      ,

      /*
      * return start date type
      * */
      getStartDateType: function (startDateTypeString) {
          if (startDateTypeString === Constants.OUT_SHARE_START_DATE_TYPE.ASAP) {
              return Constants.OUT_SHARE_START_DATE.ASAP;
          } else if (startDateTypeString === Constants.OUT_SHARE_START_DATE_TYPE.ASAP_AFTER) {
              return Constants.OUT_SHARE_START_DATE.ASAP_AFTER;
          } else if (startDateTypeString === Constants.OUT_SHARE_START_DATE_TYPE.PAUSE) {
              return Constants.OUT_SHARE_START_DATE.PAUSE;
          }
      }
      ,

      /*
      * COMPUTE STARTDATE AND ACTUAL SHARING DATE WHEN START DATE SETTING IS CHANGED
      * */
      computeStartDate: function (options) {
          return new Promise(async function (resolve, reject) {
              var outShareInstanceId = options.outShareInstanceId;
              var outShare = options.outShare;
              var startDateType = options.startDateType;
              var offeredStartDate = options.offeredStartDate;
              var freqType = options.freqType;
              var freqDay = options.freqDay;
              var freqTime = options.freqTime;
              var computedOfferedStartDate, actualSharingDate, status;
              var currentDate = DataUtils.getEpochMSTimestamp();
              var eventFlag, notifyFlag = false;
              var invitationAcceptedPartners, manageSharingEventResponse;

              try {
                  // GET Partner who accept the invitation
                  invitationAcceptedPartners = await OutShareInstance.getInvitationAcceptedInSharePartner({outShareInstanceId: outShareInstanceId});

                  // add new freq if its in req obj
                  outShare.freqType = freqType || outShare.freqType;
                  outShare.freqDay = freqDay || outShare.freqDay;
                  outShare.freqTime = freqTime || outShare.freqTime;


                  if (outShare.startDateType === Constants.OUT_SHARE_START_DATE.ASAP) {
                      if (startDateType === Constants.OUT_SHARE_START_DATE_TYPE.ASAP_AFTER) {
                          computedOfferedStartDate = offeredStartDate;
                          if (outShare.actualSharingDate > currentDate) {
                              // compute new actualsharingDate
                              outShare.startDateType = OutShareInstance.getStartDateType(startDateType) || outShare.startDateType;
                              outShare.offeredStartDate = offeredStartDate || outShare.offeredStartDate;
                              actualSharingDate = await InShareApi.getFrequencyDateTime(outShare);

                              // update the sharing Event which is created at the time of of acceptance of inshare partner
                              manageSharingEventResponse = await OutShareInstance.manageSharingEvent(options);
                              eventFlag = manageSharingEventResponse.eventFlag;

                              // NOTIFY ACCEPTED PARTNER AND START SHARING
                              notifyFlag = true;
                          }
                      } else if (startDateType === Constants.OUT_SHARE_START_DATE_TYPE.PAUSE) {
                          computedOfferedStartDate = Constants.DEFAULT_DATE;
                      }
                  } else if (outShare.startDateType === Constants.OUT_SHARE_START_DATE.ASAP_AFTER) {
                      if (startDateType === Constants.OUT_SHARE_START_DATE_TYPE.ASAP) {
                          // need to update actualSharingDate bcoz someone accept the invitation so we have to start the sharing for that partners
                          if (invitationAcceptedPartners.length > 0) {
                              // compute new actualsharingDate
                              actualSharingDate = await InShareApi.getFrequencyDateTime(outShare);

                              // update the sharing Event which is created at the time of of acceptance of inshare partner
                              manageSharingEventResponse = await OutShareInstance.manageSharingEvent(options);
                              eventFlag = manageSharingEventResponse.eventFlag;

                              // NOTIFY ACCEPTED PARTNER AND START SHARING
                              notifyFlag = true;

                          }
                          computedOfferedStartDate = currentDate;
                      } else if (startDateType === Constants.OUT_SHARE_START_DATE_TYPE.ASAP_AFTER) {
                          if (invitationAcceptedPartners.length > 0) {
                              // COMPUTE actualSharingDate according to new offered startDate
                              actualSharingDate = await InShareApi.getFrequencyDateTime(outShare);

                              // NEED TO UPDATE THE SHARING EVENT TO DEACTIVATE WHICH IS CREATED AT TIME OF ACCEPTANCE OF INSHARE PARTNER
                              manageSharingEventResponse = await OutShareInstance.manageSharingEvent(options);
                              eventFlag = manageSharingEventResponse.eventFlag;

                              // NOTIFY ACCEPTED PARTNER CREATE EVENT BUT SHARING NOT START
                              notifyFlag = true;

                          }
                          computedOfferedStartDate = offeredStartDate;
                      } else if (startDateType === Constants.OUT_SHARE_START_DATE_TYPE.PAUSE) {
                          if (invitationAcceptedPartners.length > 0) {
                              actualSharingDate = await InShareApi.getFrequencyDateTime(outShare);
                              status = Constants.OUT_SHARE_STATUS.PAUSED;
                              // NEED TO UPDATE THE SHARING EVENT TO DEACTIVATE WHICH IS CREATED AT TIME OF ACCEPTANCE OF INSHARE PARTNER
                              manageSharingEventResponse = await OutShareInstance.manageSharingEvent(options);
                              eventFlag = manageSharingEventResponse.eventFlag;

                              // NOTIFY ACCEPTED PARTNER BUT SHARING NOT START
                              notifyFlag = true;
                          }
                          computedOfferedStartDate = Constants.DEFAULT_DATE;
                      }
                  } else if (outShare.startDateType === Constants.OUT_SHARE_START_DATE.PAUSE) {
                      if (startDateType === Constants.OUT_SHARE_START_DATE_TYPE.ASAP) {
                          if (invitationAcceptedPartners.length > 0) {
                              actualSharingDate = await InShareApi.getFrequencyDateTime(outShare);
                              status = Constants.OUT_SHARE_STATUS.ACTIVE;

                              // Create a new sharing event by actualSharingDate
                              manageSharingEventResponse = await OutShareInstance.manageSharingEvent(options);
                              eventFlag = manageSharingEventResponse.eventFlag;

                              // NOTIFY ACCEPTED PARTNER AND START SHARING
                              notifyFlag = true;
                          }
                          computedOfferedStartDate = currentDate;
                      } else if (startDateType === Constants.OUT_SHARE_START_DATE_TYPE.ASAP_AFTER) {
                          if (invitationAcceptedPartners.length > 0) {
                              actualSharingDate = await InShareApi.getFrequencyDateTime(outShare);
                              status = Constants.OUT_SHARE_STATUS.ACTIVE;

                              // Create a new sharing event by actualSharingDate
                              manageSharingEventResponse = await OutShareInstance.manageSharingEvent(options);
                              eventFlag = manageSharingEventResponse.eventFlag;

                              // NOTIFY ACCEPTED PARTNER BUT SHARING NOT START
                              notifyFlag = true;
                          }
                          computedOfferedStartDate = offeredStartDate;
                      }
                  }

                  var response = {
                      computedOfferedStartDate: computedOfferedStartDate,
                      actualSharingDate: actualSharingDate,
                      status: status,
                      eventFlag: eventFlag,
                      invitationAcceptedPartners: invitationAcceptedPartners,
                      notifyFlag: notifyFlag
                  };
                  return resolve(response);
              } catch (err) {
                  debug('err', err);
                  return reject(err);
              }
          });
      }
      ,

      /*
      * Create and update SHARING EVENT
      * */
      createUpdateSharingEvent: function (options) {
          return new Promise(async function (resolve, reject) {
              var sharingEventsId = options.id;
              var outShareInstanceId = options.outShareInstanceId;
              var startDate = options.startDate;
              var nextSharingDate = options.nextSharingDate;
              var status = options.status;
              var frequency = options.frequency;
              var currentDate = DataUtils.getEpochMSTimestamp();
              var err;

              try {
                  var conn = await connection.getConnection();

                  var paramValues = [outShareInstanceId, nextSharingDate, frequency, currentDate, outShareInstanceId,
                      sharingEventsId, outShareInstanceId, startDate, nextSharingDate, status, frequency, currentDate, currentDate];

                  var sharingEvents = await conn.query('if (select 1 from SharingEvents where outshareInstanceId=uuid_to_bin(?) and status = 1) is not null then ' +
                    ' update SharingEvents set nextSharingDate=?,frequency=? , updatedAt=? where ' +
                    ' outShareInstanceId=uuid_to_bin(?) and status = 1 ; ' +
                    ' else INSERT into SharingEvents SET id = uuid_to_bin(?),outShareInstanceId=uuid_to_bin(?),' +
                    ' startDate=?,nextSharingDate=?,status=?,frequency=?,createdAt=?,updatedAt=?;end if;', paramValues);
                  sharingEvents = Utils.isAffectedPool(sharingEvents);

                  if (!sharingEvents) {
                      err = new Error(ErrorConfig.MESSAGE.SHARING_EVENTS_CREATE_FAILED);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                      return reject(err);
                  }
                  return resolve(Constants.OK_MESSAGE);
              } catch (err) {
                  debug('err', err);
                  err = new Error(ErrorConfig.MESSAGE.SHARING_EVENTS_CREATE_FAILED);
                  err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                  return reject(err);
              }
          });
      }
      ,

      /*
      * Notify partners when start date is updated
      * */
      notifyPartnerForStartDateChange: function (options) {
          return new Promise(async function (resolve, reject) {
              var outShareInstanceId = options.outShareInstanceId;
              var sharePartners = options.sharePartners;
              var notificationReference = options.notificationReference;
              var emailTemplate = options.emailTemplate;
              var offeredStartDate = options.offeredStartDate;
              var userId = options.userId;
              var NotificationApi = require('../api/notification');

              try {
                  var inviterUser = await CustomerApi.getUserById({userId: userId});

                  await Promise.each(sharePartners, async function (partner) {

                      // GET ALL AUTH USER OF ACCOUNTS OR PARTNERS
                      var authUsers = await CustomerApi.getAuthorizeUser({accountId: partner.accountId});

                      // SEND NOTIFICATION FOR ALL AUTH USERS
                      var date = new Date();
                      var invitationExpirationDate = date.setDate(date.getDate() + Constants.INVITATION_EXPIRATION_DATE_LIMIT);
                      invitationExpirationDate = new Date(invitationExpirationDate);

                      await Promise.each(authUsers, async function (user) {
                          var inviteeUser = await CustomerApi.getUserByIdMD({
                              userId: user.userId,
                              notifyType: Constants.NOTIFICATION_CATEGORY_TYPE.SHARING
                          });

                          var opt = {
                              languageCultureCode: inviterUser.languageCultureCode,
                              template: emailTemplate,
                              email: inviteeUser.email
                          };

                          var compileOptions = {
                              name: inviteeUser.firstName,
                              friend: inviterUser.email,
                              startDate: new Date(offeredStartDate)
                          };

                          try {
                              var notifyFlag = JSON.parse(inviteeUser.notifyFlag);
                              // SEND EMAIL
                              if (notifyFlag.email === 1) {
                                  await EmailUtils.sendEmailPromise(opt, compileOptions);
                              }
                              if (notifyFlag.notification === 1) {
                                  var notificationOption = {
                                      refereId: outShareInstanceId, //id of out Share record
                                      refereType: Constants.NOTIFICATION_REFERE_TYPE.OUT_SHARE,
                                      user_ids: [inviteeUser.id],
                                      topic_id: inviteeUser.id,
                                      notificationExpirationDate: invitationExpirationDate,
                                      paramasDateTime: new Date(),
                                      paramasOtherData: new Date(offeredStartDate),
                                      notification_reference: notificationReference,
                                      metaEmail: inviterUser.email,
                                      paramsInviter: inviterUser.email + ', ' + (inviterUser.firstName ? inviterUser.firstName : '') + ' ' + (inviterUser.lastName ? inviterUser.lastName : ''),
                                      paramsInvitee: inviteeUser.email + ', ' + (inviteeUser.firstName ? inviteeUser.firstName : '') + ' ' + (inviteeUser.lastName ? inviteeUser.lastName : ''),
                                      languageCultureCode: inviteeUser.languageCultureCode,
                                      createdBy: inviterUser.id,
                                      type: Constants.DEFAULT_NOTIFICATION_TYPE
                                  };
                                  if (inviterUser.firstName) {
                                      notificationOption.metaName = inviterUser.firstName;
                                  }
                                  await NotificationApi.createMD(notificationOption);
                              }
                          } catch (err) {
                              debug('err', err);
                              err = new Error(ErrorConfig.MESSAGE.IN_SHARE_PARTNER_NOTIFY_FAILED);
                              err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                              return reject(err);
                          }
                      });
                  });
                  return resolve(Constants.OK_MESSAGE);
              } catch (err) {
                  debug('err', err);
                  return reject(err);
              }
          });
      }
      ,

      /*
      * UPDATE THE START_DATE FROM UPDATE OUTSHARE API , CANT UPDATE START_DATE AFTER ACTUAL SHARING WILL START
      * */
      updateStartDateType: function (options) {
          return new Promise(async function (resolve, reject) {
              var outShareInstanceId = options.outShareInstanceId;
              var outShare = options.outShare;
              var startDateType = options.startDateType;
              var offeredStartDate = options.offeredStartDate;
              var userId = options.userId;
              var freqType = options.freqType;
              var freqTime = options.freqTime;
              var freqDay = options.freqDay;
              var startDateTypevalue, status;
              var currentDate = DataUtils.getEpochMSTimestamp();
              var computedOfferedStartDate, actualSharingDate;
              var eventFlag, notifyFlag, invitationAcceptedPartners;
              var newUpdatedAt, newStatus;
              var err;

              try {
                  if (outShare.status === Constants.OUT_SHARE_STATUS.ACTIVE && outShare.actualSharingDate !== 0
                    && outShare.actualSharingDate < currentDate) {
                      err = new Error(ErrorConfig.MESSAGE.CAN_NOT_UPDATE_START_DATE_SETTING);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                      throw err;
                  }

                  if (startDateType === Constants.OUT_SHARE_START_DATE_TYPE.ASAP_AFTER) {
                      if (DataUtils.isUndefined(offeredStartDate)) {
                          err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_START_DATE_REQUIRED);
                      } else if ((offeredStartDate).toString().length !== 13) {
                          err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_START_DATE_INVALID);
                      } else if (offeredStartDate <= currentDate) {
                          err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_START_DATE_CAN_NOT_BE_PAST_DATE);
                      } else {
                          startDateTypevalue = Constants.OUT_SHARE_START_DATE.ASAP_AFTER;
                      }
                      if (err) {
                          err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                          throw err;
                      }
                  } else if (startDateType === Constants.OUT_SHARE_START_DATE_TYPE.ASAP) {
                      startDateTypevalue = Constants.OUT_SHARE_START_DATE.ASAP;
                  } else if (startDateType === Constants.OUT_SHARE_START_DATE_TYPE.PAUSE) {
                      startDateTypevalue = Constants.OUT_SHARE_START_DATE.PAUSE;
                  }

                  // GET COMPUTED START DATE
                  var computeOption = {
                      outShareInstanceId: outShareInstanceId,
                      outShare: outShare,
                      startDateType: startDateType,
                      offeredStartDate: offeredStartDate,
                      freqType: freqType,
                      freqDay: freqDay,
                      freqTime: freqTime
                  };
                  var computeResponse = await OutShareInstance.computeStartDate(computeOption);

                  computedOfferedStartDate = computeResponse.computedOfferedStartDate;
                  actualSharingDate = computeResponse.actualSharingDate;
                  status = computeResponse.status;
                  eventFlag = computeResponse.eventFlag;
                  notifyFlag = computeResponse.notifyFlag;
                  invitationAcceptedPartners = computeResponse.invitationAcceptedPartners;

                  //UPDATE OUTSHARE INSTANCE
                  var updateStartDateOption = {
                      outShareInstanceId: outShareInstanceId,
                      userId: userId,
                      startDateType: startDateTypevalue,
                      offeredStartDate: computedOfferedStartDate,
                      actualSharingDate: actualSharingDate,
                      status: status
                  };
                  var updateStartDateResponse = await OutShareInstance.updateOutShareInstance(updateStartDateOption);
                  newUpdatedAt = updateStartDateResponse.updatedAt;
                  newStatus = updateStartDateResponse.status;

                  //Need to create or udpate event as per isEventCreate and isEventUpdate
                  var frequency = freqType ? freqType : outShare.freqType;
                  if (eventFlag && frequency !== Constants.OUT_SHARE_FREQ_TYPE.REAL_TIME) {
                      var generatedId = Utils.generateId();

                      var createSharingEventOption = {
                          id: generatedId.uuid,
                          outShareInstanceId: outShareInstanceId,
                          startDate: currentDate,
                          nextSharingDate: actualSharingDate,
                          status: Constants.SHARING_EVENT_STATUS.ACTIVE,
                          frequency: frequency
                      };
                      var createSharingEventResponse = await OutShareInstance.createUpdateSharingEvent(createSharingEventOption);
                  }

                  // Insert a Sharing log for status change
                  var sharingLogOption = {
                      outShareInstanceId: outShareInstanceId,
                      inSharePartnerId: Constants.DEFAULT_REFERE_ID,
                      shareItemId: Constants.DEFAULT_REFERE_ID,
                      createdBy: userId,
                      reasonCode: Constants.SHARING_LOG_REASON_CODE.START_DATE_SETTING_CHANGE,
                      timestamp: currentDate,
                      createdAt: currentDate
                  };
                  var sharingLogResponse = await OutShareInstance.insertsharingLog({sharingLogList: [sharingLogOption]});

                  // NOTIFY THE PARTNER WHO ACCEPTED THE INVITATION
                  if (notifyFlag) {
                      var notifyOption = {
                          outShareInstanceId: outShareInstanceId,
                          userId: userId,
                          sharePartners: invitationAcceptedPartners,
                          offeredStartDate: computedOfferedStartDate,
                          emailTemplate: Constants.EMAIL_TEMPLATES.START_DATE_CHANGE,
                          notificationReference: NotificationReferenceData.DATE_SHARE_START_DATE_CHANGE
                      };
                      var notifyResponse = await OutShareInstance.notifyPartnerForStartDateChange(notifyOption);
                  }

                  return resolve({
                      OK: Constants.SUCCESS,
                      updatedAt: newUpdatedAt,
                      status: newStatus,
                      offeredStartDate: computedOfferedStartDate || outShare.offeredStartDate,
                      actualSharingDate: actualSharingDate || outShare.actualSharingDate
                  });
              } catch (err) {
                  debug('err', err);
                  return reject(err);
              }
          });
      }
      ,

      getSharedDataItems: function (options) {
          return new Promise(async function (resolve, reject) {
              var shareItemType = options.shareItemType;
              try {
                  var conn = await connection.getConnection();
                  shareItemType = Constants.SHARING_TYPE[shareItemType];
                  debug('shareItemType', shareItemType);

                  var shareDataItems = await conn.query('select dataItemId from DSIbyType where sharingType = ? ', [shareItemType]);
                  if (!shareDataItems || !DataUtils.isArray(shareDataItems)) {
                      debug('Inside if12345');
                      return resolve([]);
                  }
                  return resolve(shareDataItems);
              } catch (err) {
                  debug('err', err);
                  return reject(err);
              }
          });
      }
      ,

      /*
      * UPDATE SHARED DATA ITEMS
      * */
      updateSharedDataItems: function (options) {
          return new Promise(async function (resolve, reject) {
              var outShareInstanceId = options.outShareInstanceId;
              var sharedDataItems = options.sharedDataItems;
              var shareItemType = options.shareItemType;
              var userId = options.userId;
              var newUpdatedAt = DataUtils.getEpochMSTimestamp();
              var currentDate = DataUtils.getEpochMSTimestamp();
              var err;

              try {
                  if (!DataUtils.isArray(sharedDataItems)) {
                      err = new Error(ErrorConfig.MESSAGE.SHARED_DATA_ITEMS_MUST_BE_ARRAY);
                      throw err;
                  } else if (sharedDataItems.length <= 0) {
                      err = new Error(ErrorConfig.MESSAGE.SHARED_DATA_ITEMS_CAN_NOT_BE_EMPTY);
                      throw err;
                  }
                  var defaultSharedDataItems = await OutShareInstance.getSharedDataItems({shareItemType: shareItemType});
                  defaultSharedDataItems = _.map(defaultSharedDataItems, 'dataItemId');

                  _.map(sharedDataItems, function (item) {
                      if (defaultSharedDataItems.indexOf(item) === -1) {
                          err = new Error(ErrorConfig.MESSAGE.INVALID_SHARED_DATA_ITEMS);
                          throw err;
                      }
                  });
              } catch (err) {
                  debug('err', err);
                  err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                  return reject(err);
              }

              try {
                  sharedDataItems = sharedDataItems.join(',');
                  var conn = await connection.getConnection();

                  var isUpdated = await conn.query('update OutSharingProfile OSP, OutShare OS set OSP.sharedDataItems=?,' +
                    'OS.updatedAt=?,OSP.updatedAt=?,OS.updatedBy=uuid_to_bin(?),OSP.updatedBy=uuid_to_bin(?) where ' +
                    'OS.id=uuid_to_bin(?) and OSP.id = OS.sharingProfileId;',
                    [sharedDataItems, newUpdatedAt, newUpdatedAt, userId, userId, outShareInstanceId]);
                  isUpdated = Utils.isAffectedPool(isUpdated);
                  if (!isUpdated) {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_NOT_FOUND);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                      return reject(err);
                  }

                  // Insert a Sharing log for status change
                  var sharingLogOption = {
                      outShareInstanceId: outShareInstanceId,
                      inSharePartnerId: Constants.DEFAULT_REFERE_ID,
                      shareItemId: Constants.DEFAULT_REFERE_ID,
                      createdBy: userId,
                      reasonCode: Constants.SHARING_LOG_REASON_CODE.SHARED_DATA_ITEMS_CHANGE,
                      timestamp: currentDate,
                      createdAt: currentDate
                  };
                  var sharingLogResponse = await OutShareInstance.insertsharingLog({sharingLogList: [sharingLogOption]});

                  return resolve({
                      OK: Constants.SUCCESS,
                      updatedAt: newUpdatedAt
                  });
              } catch (err) {
                  debug('err', err);
                  err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_UPDATE_FAILED);
                  err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                  return reject(err);
              }
          });
      }
      ,

      /*
      * Handle case of real_time and calculate actualSharingDate
      * */
      calculateNextSharingDate: function (options) {
          return new Promise(async function (resolve, reject) {
              debug('inside calculateNextSharingDate');
              var oldFreqType = options.oldFreqType;
              var newFreqType = options.newFreqType;
              var newFreqTime = options.newFreqTime;
              var newFreqDay = options.newFreqDay;
              var startDateType = options.startDateType;
              var offeredStartDate = options.offeredStartDate;
              var outShareInstanceId = options.outShareInstanceId;
              var currentDate = DataUtils.getEpochMSTimestamp();
              var frequencyOption, nextSharingDate, updateSharingEventOption, updateSharingEventResponse;

              try {

                  if (oldFreqType !== Constants.OUT_SHARE_FREQ_TYPE.REAL_TIME && newFreqType !== Constants.OUT_SHARE_FREQ_TYPE.REAL_TIME) {
                      // calculate nextSharingDate

                      frequencyOption = {
                          freqType: newFreqType,
                          freqDay: newFreqDay,
                          freqTime: newFreqTime,
                          offeredStartDate: offeredStartDate,
                          startDateType: startDateType
                      };
                      nextSharingDate = await InShareApi.getFrequencyDateTime(frequencyOption);

                      // update sharing event with nextsharingDate , if event not exist then create it
                      updateSharingEventOption = {
                          id: Utils.generateId().uuid,
                          outShareInstanceId: outShareInstanceId,
                          startDate: currentDate,
                          nextSharingDate: nextSharingDate,
                          status: Constants.SHARING_EVENT_STATUS.ACTIVE,
                          frequency: newFreqType
                      };
                      updateSharingEventResponse = await OutShareInstance.createUpdateSharingEvent(updateSharingEventOption);

                  } else if (oldFreqType !== Constants.OUT_SHARE_FREQ_TYPE.REAL_TIME && newFreqType === Constants.OUT_SHARE_FREQ_TYPE.REAL_TIME) {
                      //update sharing event with status = deactivate
                      debug('inside else if 2');
                      updateSharingEventOption = {
                          outShareInstanceId: outShareInstanceId,
                          status: Constants.SHARING_EVENT_STATUS.DEACTIVE,
                          endDate: currentDate
                      };
                      updateSharingEventResponse = await OutShareInstance.updateSharingEvents(updateSharingEventOption);
                  } else if (oldFreqType === Constants.OUT_SHARE_FREQ_TYPE.REAL_TIME && newFreqType !== Constants.OUT_SHARE_FREQ_TYPE.REAL_TIME) {
                      // calculate nextSharingDate from current date
                      frequencyOption = {
                          freqType: newFreqType,
                          freqDay: newFreqDay,
                          freqTime: newFreqTime,
                          offeredStartDate: offeredStartDate,
                          startDateType: startDateType
                      };
                      nextSharingDate = await InShareApi.getFrequencyDateTime(frequencyOption);
                      // create sharing event with new sharing date
                      var generatedId = Utils.generateId();
                      var createSharingEventOption = {
                          id: generatedId.uuid,
                          outShareInstanceId: outShareInstanceId,
                          startDate: currentDate,
                          nextSharingDate: nextSharingDate,
                          status: Constants.SHARING_EVENT_STATUS.ACTIVE,
                          frequency: newFreqType
                      };
                      var createSharingEventResponse = await OutShareInstance.createUpdateSharingEvent(createSharingEventOption);
                  }

                  return resolve(Constants.OK_MESSAGE);
              } catch (err) {
                  debug('err', err);
                  return reject(err);
              }
          });
      }
      ,

      /*
      * Build  a field string for update outshare instance by frequency
      * */
      validateOptionalFieldsFrequecy: function (options) {
          return new Promise(function (resolve, reject) {
              var err;
              var frequencyFields = '';
              var frequencyOptionalValues = [];

              try {
                  frequencyFields += 'freqType=? ,freqTime=? ,freqDay=? ,';

                  if (!DataUtils.isValidateOptionalField(options.freqType)) {
                      frequencyOptionalValues.push(options.freqType);
                  } else {
                      frequencyOptionalValues.push('');
                  }
                  if (!DataUtils.isValidateOptionalField(options.freqTime)) {
                      frequencyOptionalValues.push(options.freqTime);
                  } else {
                      frequencyOptionalValues.push('');
                  }
                  if (!DataUtils.isValidateOptionalField(options.freqDay)) {
                      frequencyOptionalValues.push(options.freqDay);
                  } else {
                      frequencyOptionalValues.push('');
                  }

                  var response = {
                      frequencyFields: frequencyFields,
                      frequencyOptionalValues: frequencyOptionalValues
                  };
                  return resolve(response);
              } catch (err) {
                  debug('err', err);
                  return reject(err);
              }
          });
      }
      ,

      /*
      * UPDATE FREQUENCY
      * */
      updateFrequency: function (options) {
          return new Promise(async function (resolve, reject) {
              var userId = options.userId;
              var sharingProfileId = options.sharingProfileId;
              var newUpdatedAt = DataUtils.getEpochMSTimestamp();
              var err;
              var frequencyFields, frequencyOptionalValues = [], frequencyRequiredValues = [];
              try {
                  var response = await OutShareInstance.validateOptionalFieldsFrequecy(options);

                  frequencyFields = response.frequencyFields;
                  frequencyOptionalValues = response.frequencyOptionalValues;


                  frequencyRequiredValues = _.concat(frequencyRequiredValues, frequencyOptionalValues);
                  frequencyRequiredValues.push(userId, newUpdatedAt, sharingProfileId);

                  var conn = await connection.getConnection();

                  var isOutShareProfileUpdated = await conn.query('update OutSharingProfile set ' + frequencyFields + ' updatedBy=uuid_to_bin(?), ' +
                    'updatedAt = ? where id=uuid_to_bin(?);', frequencyRequiredValues);

                  isOutShareProfileUpdated = Utils.isAffectedPool(isOutShareProfileUpdated);

                  if (!isOutShareProfileUpdated) {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARING_PROFILE_NOT_FOUND);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                      return reject(err);
                  }
                  return resolve({
                      OK: Constants.SUCCESS
                  });
              } catch (err) {
                  debug('err', err);
                  err = new Error(ErrorConfig.MESSAGE.OUT_SHARING_PROFILE_UPDATE_FAILED);
                  err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                  return reject(err);
              }

          });
      }
      ,

      /*
      * MANAGE actualSharing date according to new FREQUENCY
      * */
      manageUpdateFrequency: function (options) {
          return new Promise(async function (resolve, reject) {
              var outShareInstanceId = options.outShareInstanceId;
              var updatedAt = options.updatedAt;
              var freqType = options.freqType;
              var freqTime = options.freqTime;
              var freqDay = options.freqDay;
              var notes = options.notes;
              var userId = options.userId;
              var currentDate = DataUtils.getEpochMSTimestamp();
              var outShare;
              var updateFrequencyOptions, updateFrequencyResponse;
              var frequencyOption, frequencyResponse, newActualSharingDate;
              var updateOutShareInstanceOption, updateOutShareInstanceResponse, updateSharingEventOption,
                updateSharingEventResponse;
              var newUpdatedAt;

              try {
                  outShare = await OutShareInstance.getOutShareInstance({
                      outShareInstanceId: outShareInstanceId,
                      updatedAt: updatedAt
                  });

                  if (outShare.status === Constants.OUT_SHARE_STATUS.PAUSED) {
                      // update only freqType
                      updateFrequencyOptions = {
                          freqType: freqType,
                          freqTime: freqTime,
                          freqDay: freqDay,
                          sharingProfileId: outShare.sharingProfileId,
                          userId: userId,
                          notes: notes
                      };
                      updateFrequencyResponse = await OutShareInstance.updateFrequency(updateFrequencyOptions);
                  } else if (outShare.status === Constants.OUT_SHARE_STATUS.ACTIVE || outShare.status === Constants.OUT_SHARE_STATUS.INVITATION_SENT) {
                      //if(sharing is not start yet){}
                      //else (sharing is started){}
                      if (currentDate < outShare.actualSharingDate || outShare.actualSharingDate === Constants.DEFAULT_DATE) {

                          // inshare partner accept but sharing not started in case of weekly or monthly
                          if (currentDate < outShare.actualSharingDate) {
                              // Calculate new actualsharing date , need to update actual sharing date
                              frequencyOption = {
                                  freqType: freqType,
                                  freqDay: freqDay,
                                  freqTime: freqTime,
                                  offeredStartDate: outShare.offeredStartDate,
                                  startDateType: outShare.startDateType
                              };
                              newActualSharingDate = await InShareApi.getFrequencyDateTime(frequencyOption);

                              // UPDATE THE ACTUAL SHARING DATE also
                              if (newActualSharingDate) {
                                  updateOutShareInstanceOption = {
                                      actualSharingDate: newActualSharingDate,
                                      outShareInstanceId: outShareInstanceId,
                                      userId: userId
                                  };
                                  updateOutShareInstanceResponse = await OutShareInstance.updateOutShareInstance(updateOutShareInstanceOption);
                              }
                          }
                          // UPDATE THE SharingEvent by changing nextSharingDate if actualSharingDate become < currentDate after compute
                          if (newActualSharingDate && newActualSharingDate < currentDate) {
                              updateSharingEventOption = {
                                  id: Utils.generateId().uuid,
                                  outShareInstanceId: outShareInstanceId,
                                  startDate: currentDate,
                                  nextSharingDate: newActualSharingDate,
                                  status: Constants.SHARING_EVENT_STATUS.ACTIVE,
                                  frequency: freqType
                              };
                              updateSharingEventResponse = await OutShareInstance.createUpdateSharingEvent(updateSharingEventOption);
                          }
                      } else {
                          // calculate nextSharingDate and update sharing events
                          frequencyOption = {
                              oldFreqType: outShare.freqType,
                              newFreqType: freqType,
                              newFreqTime: freqTime,
                              newFreqDay: freqDay,
                              offeredStartDate: outShare.offeredStartDate,
                              startDateType: outShare.startDateType,
                              outShareInstanceId: outShareInstanceId
                          };
                          frequencyResponse = await OutShareInstance.calculateNextSharingDate(frequencyOption);
                      }

                      // Update frequency
                      updateFrequencyOptions = {
                          freqType: freqType,
                          freqTime: freqTime,
                          freqDay: freqDay,
                          sharingProfileId: outShare.sharingProfileId,
                          userId: userId,
                          notes: notes
                      };
                      updateFrequencyResponse = await OutShareInstance.updateFrequency(updateFrequencyOptions);
                  }

                  // Insert a Sharing log for status change
                  var sharingLogOption = {
                      outShareInstanceId: outShareInstanceId,
                      inSharePartnerId: Constants.DEFAULT_REFERE_ID,
                      shareItemId: Constants.DEFAULT_REFERE_ID,
                      createdBy: userId,
                      reasonCode: Constants.SHARING_LOG_REASON_CODE.SHARING_FREQUENCY_CHANGE,
                      timestamp: currentDate,
                      createdAt: currentDate
                  };
                  var sharingLogResponse = await OutShareInstance.insertsharingLog({sharingLogList: [sharingLogOption]});

                  // GET Partner who accept the invitation
                  var invitationAcceptedPartners = await OutShareInstance.getInvitationAcceptedInSharePartner({outShareInstanceId: outShareInstanceId});

                  // NOTIFY THE PARTNERS who accept the invitation
                  var notifyOptions = {
                      sharePartners: invitationAcceptedPartners,
                      outShareInstanceId: outShareInstanceId,
                      notificationReference: NotificationReferenceData.DATE_SHARE_FREQUENCY_CHANGE,
                      emailTemplate: Constants.EMAIL_TEMPLATES.FREQUENCY_CHANGE,
                      userId: userId
                  };
                  var notifyResponse = await OutShareInstance.notifyPartnersForAddRemoveShareItems(notifyOptions);


                  return resolve({
                      OK: Constants.SUCCESS,
                      updatedAt: newUpdatedAt || updatedAt,
                      actualSharingDate: newActualSharingDate || outShare.actualSharingDate,
                      offeredStartDate: outShare.offeredStartDate
                  });

              } catch (err) {
                  debug('err', err);
                  return reject(err);
              }
          });
      }
      ,

      /*
      * check if outshare with outShareId is already exist or not
      * */
      checkOutshareId: function (options) {
          return new Promise(async function (resolve, reject) {
              var accountId = options.accountId;
              var outShareId = options.outShareId;
              var err;

              try {
                  var conn = await connection.getConnection();
                  var outShare = await conn.query('select * from OutShare where outShareId = ? ' +
                    ' and accountId = uuid_to_bin(?)', [outShareId, accountId]);
                  outShare = Utils.filteredResponsePool(outShare);

                  if (outShare) {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_ID_ALREADY_EXIST);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                      return reject(err);
                  }

                  return resolve(Constants.OK_MESSAGE);
              } catch (err) {
                  debug('err', err);
                  return reject(err);
              }
          });
      }
      ,

      /*
      * update outshare
      * */
      updateMD: async function (options, auditOptions, errorOptions, cb) {
          var err;
          var accountId = options.user.accountId;
          var addSharePartners = options.addSharePartners;
          var removeSharePartners = options.removeSharePartners;
          var removeShareItems = options.removeShareItems;
          var addShareItems = options.addShareItems;
          var outShareInstanceId = options.id;
          var userId = options.user.id;
          var status = options.status;
          var outShareId = options.outShareId;
          var outShareName = options.outShareName;
          var startDateType = options.startDateType;
          var offeredStartDate = options.offeredStartDate;
          var sharedDataItems = options.sharedDataItems;
          var shareItemType = options.shareItemType;
          var freqType = options.freqType;
          var freqTime = options.freqTime;
          var freqDay = options.freqDay;
          var notes = options.notes;
          var updateOutShareOption, updateOutShareResponse;
          var newUpdatedAt, outShare, newStatus;
          var newOfferedStartDate, newActualSharingDate;

          if (DataUtils.isUndefined(accountId)) {
              err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
          } else if (DataUtils.isUndefined(options.id)) {
              err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ID_REQUIRED);
          } else if (DataUtils.isValidateOptionalField(options.updatedAt)) {
              err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_UPDATED_AT_REQUIRED);
          } else if ((DataUtils.isDefined(freqDay) || DataUtils.isDefined(freqTime)) && DataUtils.isUndefined(freqType)) {
              err = new Error(ErrorConfig.MESSAGE.FREQ_TYPE_REQUIRED);
          } else if (DataUtils.isDefined(offeredStartDate) && DataUtils.isUndefined(startDateType)) {
              err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_START_DATE_TYPE_REQUIRED);
          } else if (DataUtils.isDefined(sharedDataItems) && DataUtils.isUndefined(shareItemType)) {
              err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ITEM_TYPE_REQUIRED);
          }

          if (err) {
              err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
              return cb(err);
          }

          try {
              var conn = await connection.getConnection();
              await conn.query('START TRANSACTION;');
          } catch (err) {
              debug('err', err);
              return cb(err);
          }

          try {
              // GET OUTSHARE INSTANCE
              var getOutShareOption = {
                  outShareInstanceId: outShareInstanceId,
                  updatedAt: options.updatedAt
              };
              outShare = await OutShareInstance.getOutShareInstance(getOutShareOption);
              debug('outShare', outShare);

              if (DataUtils.isDefined(outShareId)) {
                  var checkOption = {
                      accountId: accountId,
                      outShareId: outShareId
                  };
                  var checkResponse = await OutShareInstance.checkOutshareId(checkOption);
                  debug('checkResponse', checkResponse);
              }

              // GET ALL SHARE PARTNERS
              var sharePartners = await OutShareInstance.getAllSharePartners({outShareInstanceId: outShareInstanceId});
              debug('sharePartners', sharePartners.length);


              //UPDATE OUTSHARE BY ADDING NEW PARTNER
              if (addSharePartners && addSharePartners.length > 0) {
                  var addSharePartnerOption = {
                      outShareInstanceId: outShareInstanceId,
                      addSharePartners: addSharePartners,
                      userId: userId,
                      outShare: outShare
                  };
                  var addSharePartnerResponse = await OutShareInstance.addNewInShares(addSharePartnerOption);
                  debug('addSharePartnerResponse', addSharePartnerResponse);
              }

              //UPDATE OUTSHARE BY REMOVING OLD PARTNER
              if (removeSharePartners && removeSharePartners.length > 0) {
                  var removeSharePartnerOption = {
                      outShareInstanceId: outShareInstanceId,
                      removeSharePartners: removeSharePartners,
                      userId: userId,
                      outShare: outShare
                  };
                  var removeSharePartnerResponse = await OutShareInstance.removeInShares(removeSharePartnerOption);
                  if (removeSharePartnerResponse && removeSharePartnerResponse.updatedAt && removeSharePartnerResponse.status) {
                      newUpdatedAt = removeSharePartnerResponse.updatedAt;
                      newStatus = removeSharePartnerResponse.status;
                  }
                  debug('removeSharePartnerResponse', removeSharePartnerResponse);
              }

              // UPDATE OUTSHARE BY ADDING NEW SHARE ITEMS
              if (addShareItems && addShareItems.length > 0) {
                  var addShareItemOption = {
                      outShareInstanceId: outShareInstanceId,
                      addShareItems: addShareItems,
                      sharePartners: sharePartners,
                      userId: userId
                  };
                  var addShareItemResponse = await OutShareInstance.addShareItems(addShareItemOption);
                  debug('addShareItemResponse', addShareItemResponse);
              }

              // UPDATE OUTSHARE BY REMOVING OLD SHARE ITEMS
              if (removeShareItems && removeShareItems.length > 0) {
                  var removeShareItemOption = {
                      outShareInstanceId: outShareInstanceId,
                      removeShareItems: removeShareItems,
                      sharePartners: sharePartners,
                      userId: userId
                  };
                  var removeShareItemResponse = await OutShareInstance.removeShareItems(removeShareItemOption);
                  if (removeShareItemResponse && removeShareItemResponse.updatedAt && removeShareItemResponse.status) {
                      newUpdatedAt = removeShareItemResponse.updatedAt;
                      newStatus = removeShareItemResponse.status;
                  }
                  debug('removeShareItemResponse', removeShareItemResponse);
              }

              // UPDATE OUTSHARE STATUS
              if (DataUtils.isDefined(status) && outShare.status !== status) {
                  var updateStatusOption = {
                      outShareInstanceId: outShareInstanceId,
                      outShare: outShare,
                      sharePartners: sharePartners,
                      userId: userId,
                      status: status
                  };
                  var updatedStatusResponse = await OutShareInstance.updateOutShareStatus(updateStatusOption);
                  newUpdatedAt = updatedStatusResponse.updatedAt;
                  newStatus = updatedStatusResponse.status;
                  debug('updatedStatusResponse', updatedStatusResponse);
              }

              // UPDATE SHARED DATA ITEMS [1,4,5]
              if (sharedDataItems) {
                  var updateSharedDataOption = {
                      outShareInstanceId: outShareInstanceId,
                      userId: userId,
                      sharedDataItems: sharedDataItems,
                      shareItemType: shareItemType
                  };
                  var updatedSharedDataResponse = await OutShareInstance.updateSharedDataItems(updateSharedDataOption);
                  debug('updatedSharedDataResponse', updatedSharedDataResponse);
                  newUpdatedAt = updatedSharedDataResponse.updatedAt;
              }

              // UPDATE START DATE
              if (DataUtils.isDefined(startDateType)) {
                  var updateStartDateOption = {
                      outShareInstanceId: outShareInstanceId,
                      userId: userId,
                      startDateType: startDateType,
                      offeredStartDate: offeredStartDate,
                      outShare: outShare,
                      freqType: freqType,
                      freqDay: freqDay,
                      freqTime: freqTime
                  };
                  var updateStartDateResponse = await OutShareInstance.updateStartDateType(updateStartDateOption);
                  newUpdatedAt = updateStartDateResponse.updatedAt;
                  newStatus = updateStartDateResponse.status;
                  newOfferedStartDate = updateStartDateResponse.offeredStartDate;
                  newActualSharingDate = updateStartDateResponse.actualSharingDate;
                  debug('updateStartDateResponse', updateStartDateResponse);
              }

              // UPDATE FREQ_TYPE
              if (DataUtils.isDefined(freqType)) {
                  var updateFreqTypeOption = {
                      outShareInstanceId: outShareInstanceId,
                      updatedAt: newUpdatedAt || options.updatedAt,
                      freqType: freqType,
                      freqTime: freqTime,
                      freqDay: freqDay,
                      userId: userId,
                      notes: notes
                  };
                  var updateFreqTypeRespose = await OutShareInstance.manageUpdateFrequency(updateFreqTypeOption);
                  if (updateFreqTypeRespose && DataUtils.isDefined(updateFreqTypeRespose.updatedAt)) {
                      newUpdatedAt = updateFreqTypeRespose.updatedAt;
                  }
                  newActualSharingDate = updateFreqTypeRespose.actualSharingDate;
                  newOfferedStartDate = updateFreqTypeRespose.offeredStartDate;

              }
              if (DataUtils.isDefined(notes)) {
                  var updateNotesOptions = {
                      sharingProfileId: outShare.sharingProfileId,
                      userId: userId,
                      notes: notes
                  };
                  debug('updateNotesOptions', updateNotesOptions);
                  var updateNotesResponse = await OutShareInstance.updateNotes(updateNotesOptions);
                  debug('updateNotesResponse', updateNotesResponse);
              }

              // UPDATE OUTSHARE ID/NAME
              if (DataUtils.isDefined(outShareId) || DataUtils.isDefined(outShareName)) {
                  updateOutShareOption = {
                      outShareInstanceId: outShareInstanceId,
                      userId: userId,
                      outShareId: outShareId,
                      outShareName: outShareName
                  };
                  updateOutShareResponse = await OutShareInstance.updateOutShareInstance(updateOutShareOption);
                  newUpdatedAt = updateOutShareResponse.updatedAt;
                  debug('updateOutShareResponse', updateOutShareResponse);
              }


              //
              /*var demoOutShare = await conn.query('SELECT CAST(uuid_from_bin(OS.id) AS CHAR) AS id, CAST(uuid_from_bin(OS.sharingProfileId) AS CHAR) AS sharingProfileId,' +
              ' CAST(uuid_from_bin(OS.accountId) AS CHAR) AS accountId, OS.status,OS.shareItemType,OS.offeredStartDate,OS.startDateType,OS.updatedAt,OS.actualSharingDate,' +
              ' OSP.freqType,OSP.freqTime,OSP.freqDay  FROM OutShare OS , OutSharingProfile OSP' +
              ' WHERE OS.id = uuid_to_bin(?) and OS.sharingProfileId = OSP.id', [outShareInstanceId]);
            demoOutShare = Utils.filteredResponsePool(demoOutShare);
            debug('demoOutShare', demoOutShare);*/

              // update outShare outSharingProfile
              /*if (DataUtils.isDefined(options.useExisting) || DataUtils.isDefined(options.saveAsLater)) {

                options.type = Object.keys(Constants.SHARING_TYPE)[Object.values(Constants.SHARING_TYPE).indexOf(getOutShare.shareItemType)];
                options.accountId = options.user.accountId;
                options.userId = options.user.id;

                await OutShareInstance.updateOutSharingProfileMD(options);
            }*/

              // update outShare startDateType
              /*if (DataUtils.isDefined(options.startDateType)) {

                options.getOutShare = getOutShare;
                await OutShareInstance.updateStartDateTypeMD(options);
            }*/

              /*var newPartnerAccountIds = options.accounts;
            var oldPartnerAccountIds = [];
            var oldMatch = [];

            // convert accountId from string to array
            if (DataUtils.isArray(newPartnerAccountIds) && newPartnerAccountIds.length > 0) {
                var inSharePartners = getOutShare.inSharePartnerIds.split(',');

                await Promise.each(inSharePartners, function (inSharePartner) {

                    var id = inSharePartner.split(':');
                    oldPartnerAccountIds.push(id[0]);

                    Promise.each(newPartnerAccountIds, function (newPartnerAccountId) {
                        if (newPartnerAccountId === id[0]) {
                            oldMatch.push(id[0] + ':' + id[1]);
                        }
                    });
                });
            }
      */

              // here update old accountId to expired and new accountId to active and send notification and email
              /* Async.series([
                 function (removeCallback) {
                     if (DataUtils.isArray(newPartnerAccountIds) && newPartnerAccountIds.length > 0) {
                         var updatePartnerOptions = {
                             oldPartnerAccountIds: oldPartnerAccountIds,
                             newPartnerAccountIds: newPartnerAccountIds,
                             id: options.id,
                             user: options.user
                         };

                         debug('updatePartnerOptions', updatePartnerOptions);
                         OutShareInstance.removePartnerMD(updatePartnerOptions, async function (err, removeResult) {
                             if (err) {
                                 errorOptions.err = err;
                                 await ErrorUtils.create(errorOptions);
                                 return removeCallback(err);
                             }
                             return removeCallback(null, removeResult);
                         });
                     } else {
                         return removeCallback();
                     }
                 }, function (addCallback) {
                     if (DataUtils.isArray(newPartnerAccountIds) && newPartnerAccountIds.length > 0) {

                         var updatePartnerOptions = {
                             oldPartnerAccountIds: oldPartnerAccountIds,
                             newPartnerAccountIds: newPartnerAccountIds,
                             oldMatch: oldMatch,
                             id: options.id,
                             user: options.user
                         };

                         OutShareInstance.addNewPartnerMD(updatePartnerOptions, async function (err, addResult) {

                             if (err) {
                                 errorOptions.err = err;
                                 await ErrorUtils.create(errorOptions);
                                 return addCallback(err);
                             }
                             return addCallback(null, addResult);
                         });
                     } else {
                         return addCallback();
                     }
                 }], async function (err, result) {

                 if (err) {

                     await conn.query('ROLLBACK;');
                     console.log(err);
                     errorOptions.err = err;
                     await ErrorUtils.create(errorOptions);

                     if (err.code) {
                         err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_UPDATE_FAILED);
                         err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                     }
                     return cb(err);
                 }
                 getOutShare = await conn.query('select uuid_from_bin(id) as id, uuid_from_bin(sharingProfileId) as sharingProfileId, shareItemId, inSharePartnerIds,' +
                   'uuid_from_bin(accountId) as accountId,status,shareItemType,offeredStartDate,startDateType,updatedAt from OutShare where id = uuid_to_bin(?)', [options.id]);

                 getOutShare = Utils.filteredResponsePool(getOutShare);
                 AuditUtils.create(auditOptions);
                 await conn.query('COMMIT;');


                 if (emailAndnotifictionsToSend.length > 0) {
                     Async.eachSeries(emailAndnotifictionsToSend, function (notification, callback) {
                         OutShareInstance.sendDataShareNotificationMD(notification, async function (err, result) {
                             if (err) {
                                 errorOptions.err = err;
                                 await ErrorUtils.create(errorOptions);
                                 return callback();
                             }
                             if (!result) {
                                 return callback(null, null);
                             }
                             return callback();
                         });
                     }, function (err) {
                         if (err) {
                             return cb(err);
                         }
                         return cb(null, {
                             OK: Constants.SUCCESS_MESSAGE.OUT_SHARE_UPDATE_SUCCESS,
                             id: options.id,
                             updatedAt: getOutShare.updatedAt,
                             status: Constants.OUT_SHARE_STATUS_ACTION[Object.keys(Constants.OUT_SHARE_STATUS)[Object.values(Constants.OUT_SHARE_STATUS).indexOf(getOutShare.status)]]
                         });
                     });
                 } else {
                     return cb(null, {
                         OK: Constants.SUCCESS_MESSAGE.OUT_SHARE_UPDATE_SUCCESS,
                         id: options.id,
                         updatedAt: getOutShare.updatedAt,
                         status: Constants.OUT_SHARE_STATUS_ACTION[Object.keys(Constants.OUT_SHARE_STATUS)[Object.values(Constants.OUT_SHARE_STATUS).indexOf(getOutShare.status)]]
                     });
                 }
             });*/
              await conn.query('COMMIT;');
              return cb(null, {
                  OK: Constants.SUCCESS_MESSAGE.OUT_SHARE_UPDATE_SUCCESS,
                  updatedAt: newUpdatedAt || options.updatedAt,
                  status: newStatus || outShare.status,
                  offeredStartDate: newOfferedStartDate,
                  actualSharingDate: newActualSharingDate
              });

          } catch (err) {
              debug('err', err);
              await conn.query('ROLLBACK;');
              await ErrorUtils.create(errorOptions, options, err);
              if (err.code) {
                  err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_UPDATE_FAILED);
                  err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
              }
              return cb(err);
          }
      }
      ,

      updateOutSharingProfileMD: async function (options) {
          var err;
          try {
              var conn = await connection.getConnection();
              if (options.useExisting) {

                  var updateOutSharingProfileId = await conn.query('update OutShare set sharingProfileId = uuid_to_bin(?), updatedAt = ?,updatedBy = uuid_to_bin(?) ' +
                    'where id = uuid_to_bin(?)', [options.sharingProfileId, new Date().getTime(), options.user.id, options.id]);

                  if (!Utils.isAffectedPool(updateOutSharingProfileId)) {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_SHARING_PROFILE_ID_UPDATE_FAILED);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                      throw err;
                  }

                  return {
                      OK: Constants.SUCCESS_MESSAGE.OUT_SHARE_UPDATE_SUCCESS,
                      SharingProfileId: options.sharingProfileId
                  };

              } else {

                  var createOutSharingProfileId = await OutSharingApi.createMD(options);

                  if (!createOutSharingProfileId) {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_SHARING_PROFILE_ID_UPDATE_FAILED);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                      throw err;
                  }

                  updateOutSharingProfileId = await conn.query('update OutShare set sharingProfileId = uuid_to_bin(?), updatedAt = ?,updatedBy = uuid_to_bin(?) ' +
                    'where id = uuid_to_bin(?)', [createOutSharingProfileId, new Date().getTime(), options.user.id, options.id]);

                  if (!Utils.isAffectedPool(updateOutSharingProfileId)) {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_SHARING_PROFILE_ID_UPDATE_FAILED);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                      throw err;
                  }

                  return {
                      OK: Constants.SUCCESS_MESSAGE.OUT_SHARE_UPDATE_SUCCESS,
                      SharingProfileId: createOutSharingProfileId
                  };

              }

          } catch (err) {
              throw err;
          }

      }
      ,

      addNewPartnerMD: function (options, cb) {

          var oldPartnerAccountIds = options.oldPartnerAccountIds;
          var newPartnerAccountIds = options.newPartnerAccountIds;
          var addAccountIds = newPartnerAccountIds.filter(element => !oldPartnerAccountIds.includes(element));
          var currentDate = new Date().getTime();
          var updateOkFailAccountIds = [];


          Async.eachSeries(addAccountIds, function (addAccountId, callback) {

              var addPartenerOptions = {
                  addAccountId: addAccountId,
                  user: options.user,
                  id: options.id,
                  currentDate: currentDate
              };

              OutShareInstance.addInSharePartnerIdMD(addPartenerOptions, function (err, result) {
                  if (err) {
                      return callback(err);
                  }
                  if (result) {
                      updateOkFailAccountIds.push(addAccountId + Constants.OUT_SHARE_PARTNER_STATUS.OK);
                  } else {
                      updateOkFailAccountIds.push(addAccountId + Constants.OUT_SHARE_PARTNER_STATUS.FAIL);
                  }
                  return callback();
              });

          }, async function (err) {
              if (err) {
                  console.log(err.code, err);
                  return cb(err);
              }
              try {

                  var conn = await connection.getConnection();
                  var inSharePartnerIds = options.oldMatch.concat(updateOkFailAccountIds).join(',');
                  var updateOutShare = await conn.query('update OutShare set inSharePartnerIds = ?, updatedAt = ?, updatedBy = uuid_to_bin(?)' +
                    'where id = uuid_to_bin(?)', [inSharePartnerIds, new Date().getTime(), options.user.id, options.id]);

                  if (!Utils.isAffectedPool(updateOutShare)) {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_STATUS_UPDATE_FAILED);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                      throw err;
                  }
                  return cb(null, {OK: Constants.SUCCESS_MESSAGE.OUT_SHARE_UPDATE_SUCCESS});
              } catch (err) {
                  return cb(err);
              }

          });

      }
      ,

      addInSharePartnerIdMD: async function (options, cb) {


          var id = Utils.generateId().uuid;
          var defaultTimestamp = new Date(Constants.DEFAULT_SHARING_TIMESTAMP);
          var currentDate = options.currentDate;

          var notificationOptions = {
              accountId: options.addAccountId,
              user: options.user,
              id: options.id,
              template: Constants.EMAIL_TEMPLATES.IN_SHARE_INVITE,
              notification_reference: NotificationReferenceData.DATA_SHARE

          };

          OutShareInstance.sendDataShareNotificationMD(notificationOptions, async function (err, result) {
              if (err) {
                  console.log(err);
                  return cb();
              }

              if (result) {
                  try {
                      var conn = await connection.getConnection();
                      var inshareValues = [id, options.id, options.addAccountId, Constants.IN_SHARE_STATUS.NEW,
                          options.user.id, currentDate, currentDate];

                      var createInShare = await conn.query('INSERT into InShare SET id = uuid_to_bin(?),' +
                        'outShareInstanceId = uuid_to_bin(?),accountId = uuid_to_bin(?),status = ?,' +
                        'inShareId = "",inShareName = "",createdBy = uuid_to_bin(?),' +
                        'createdAt = ?,updatedAt = ?', inshareValues);

                      if (!Utils.isAffectedPool(createInShare)) {
                          return cb();
                      }
                      return cb(null, result);
                  } catch (err) {

                      if (err.code) {
                          err = new Error(ErrorConfig.MESSAGE.IN_SHARE_CREATION_FAILED);
                          err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                      }
                      return cb(err);
                  }
              } else {
                  return cb(null, result);
              }

          });


      }
      ,

      removePartnerMD: function (options, cb) {
          var oldPartnerAccountIds = options.oldPartnerAccountIds;
          var newPartnerAccountIds = options.newPartnerAccountIds;
          var removeAccountIds = oldPartnerAccountIds.filter(element => !newPartnerAccountIds.includes(element));
          var currentDate = new Date().getTime();

          Async.eachSeries(removeAccountIds, function (removeAccountId, callback) {

              var removePartenerOptions = {
                  removeAccountId: removeAccountId,
                  user: options.user,
                  id: options.id,
                  currentDate: currentDate
              };

              OutShareInstance.removeInSharePartnerIdMD(removePartenerOptions, function (err, result) {
                  if (err) {
                      return callback(err);
                  }
                  return callback();
              });

          }, async function (err) {
              if (err) {
                  console.log(err.code, err);
                  return cb(err);
              }

              return cb(null, {OK: Constants.SUCCESS_MESSAGE.IN_SHARE_UPDATE_SUCCESS});
          });

      }
      ,

      removeInSharePartnerIdMD: async function (options, cb) {
          try {

              var conn = await connection.getConnection();
              var updateInShareStatus = await conn.query('update InShare set status = ?, updatedAt = ?,updatedBy = uuid_to_bin(?) ' +
                'where outShareInstanceId = uuid_to_bin(?) and accountId = uuid_to_bin(?) and status != ?',
                [
                    Constants.IN_SHARE_STATUS.EXPIRED,
                    options.currentDate,
                    options.user.id,
                    options.id,
                    options.removeAccountId, Constants.IN_SHARE_STATUS.EXPIRED]);

              if (Utils.isAffectedPool(updateInShareStatus)) {

                  var notificationOptions = {
                      accountId: options.removeAccountId,
                      user: options.user,
                      id: options.id,
                      template: Constants.EMAIL_TEMPLATES.EXPIRED_INVITE,
                      notification_reference: NotificationReferenceData.DATA_SHARE_EXPIRED
                  };

                  OutShareInstance.sendDataShareNotificationMD(notificationOptions, function (err, result) {
                      if (err) {
                          return cb();
                      }

                      if (!result) {
                          return cb();
                      }
                      return cb(null, {OK: Constants.SUCCESS_MESSAGE.IN_SHARE_UPDATE_SUCCESS});
                  });

              } else {
                  return cb(null, null);
              }
          } catch (err) {
              return cb(err);
          }
      }
      ,

      updateStatusMD: async function (options) {
          var err, status, updatedOutShareStatus, updateInShareStatus, notificationOptions, inShareStatus, template,
            notification_reference;
          var action = options.action;
          var currentDate = new Date().getTime();
          var notifications = [];

          try {
              var conn = await connection.getConnection();
              if (action === Constants.OUT_SHARE_STATUS_ACTION.PAUSED) {
                  if (options.outShareStatus === Constants.OUT_SHARE_STATUS.ACTIVE) {
                      status = Constants.OUT_SHARE_STATUS.PAUSED;
                  } else {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_STATUS_CAN_NOT_UPDATE_TO_PAUSED);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                      throw err;
                  }

                  updatedOutShareStatus = await conn.query('update OutShare set status = ?, updatedAt = ? ' +
                    'where id = uuid_to_bin(?)', [status, currentDate, options.id]);

                  if (!Utils.isAffectedPool(updatedOutShareStatus)) {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_STATUS_UPDATE_FAILED);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                      throw err;
                  }

                  updateInShareStatus = await conn.query('update InShare set status = ?, updatedAt = ?,updatedBy = uuid_to_bin(?) ' +
                    'where outShareInstanceId = uuid_to_bin(?) and status = ?',
                    [Constants.IN_SHARE_STATUS.PAUSED_BY_OUT_SHARE_PARTNER, currentDate, options.user.id, options.id, Constants.IN_SHARE_STATUS.ACTIVE]);

                  if (Utils.isAffectedPool(updateInShareStatus)) {

                      inShareStatus = Constants.IN_SHARE_STATUS.PAUSED_BY_OUT_SHARE_PARTNER;
                      template = Constants.EMAIL_TEMPLATES.PAUSED_INVITE;
                      notification_reference = NotificationReferenceData.DATA_SHARE_PAUSED;

                  } else {
                      return {OK: Constants.SUCCESS_MESSAGE.OUT_SHARE_UPDATE_SUCCESS, notifications: notifications};
                  }


              } else if (action === Constants.OUT_SHARE_STATUS_ACTION.ACTIVE) {
                  debug('Innside else if 1', options.outShareStatus);

                  if (options.outShareStatus === Constants.OUT_SHARE_STATUS.PAUSED) {
                      status = Constants.OUT_SHARE_STATUS.ACTIVE;
                  } else {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_STATUS_CAN_NOT_UPDATE_TO_ACTIVE);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                      throw err;
                  }

                  updatedOutShareStatus = await conn.query('update OutShare set status = ?, updatedAt = ? ' +
                    'where id = uuid_to_bin(?)', [status, currentDate, options.id]);

                  if (!Utils.isAffectedPool(updatedOutShareStatus)) {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_STATUS_UPDATE_FAILED);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                      throw err;
                  }

                  updateInShareStatus = await conn.query('update InShare set status = ?, updatedAt = ?,updatedBy = uuid_to_bin(?) ' +
                    'where outShareInstanceId = uuid_to_bin(?) and status = ?',
                    [Constants.IN_SHARE_STATUS.ACTIVE, currentDate, options.user.id, options.id, Constants.IN_SHARE_STATUS.PAUSED_BY_OUT_SHARE_PARTNER]);

                  if (Utils.isAffectedPool(updateInShareStatus)) {

                      inShareStatus = Constants.IN_SHARE_STATUS.ACTIVE;
                      template = Constants.EMAIL_TEMPLATES.ACCEPT_INVITE;
                      notification_reference = NotificationReferenceData.DATA_SHARE_ACTIVE;

                  } else {
                      return {OK: Constants.SUCCESS_MESSAGE.OUT_SHARE_UPDATE_SUCCESS, notifications: notifications};
                  }

              } else if (action === Constants.OUT_SHARE_STATUS_ACTION.EXPIRED) {
                  debug('Innside else if 2');
                  status = Constants.OUT_SHARE_STATUS.EXPIRED;

                  updatedOutShareStatus = await conn.query('update OutShare set status = ?, updatedAt = ? ' +
                    'where id = uuid_to_bin(?)', [status, currentDate, options.id]);

                  if (!Utils.isAffectedPool(updatedOutShareStatus)) {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_STATUS_UPDATE_FAILED);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                      throw err;
                  }

                  updateInShareStatus = await conn.query('update InShare set status = ?, updatedAt = ?,updatedBy = uuid_to_bin(?) ' +
                    'where outShareInstanceId = uuid_to_bin(?) and status != ?',
                    [Constants.IN_SHARE_STATUS.EXPIRED, currentDate, options.user.id, options.id, Constants.IN_SHARE_STATUS.EXPIRED]);

                  if (Utils.isAffectedPool(updateInShareStatus)) {

                      inShareStatus = Constants.IN_SHARE_STATUS.EXPIRED;
                      template = Constants.EMAIL_TEMPLATES.EXPIRED_INVITE;
                      notification_reference = NotificationReferenceData.DATA_SHARE_EXPIRED;

                  } else {
                      return {OK: Constants.SUCCESS_MESSAGE.OUT_SHARE_UPDATE_SUCCESS, notifications: notifications};
                  }

              } else if (DataUtils.isDefined(action)) {
                  throw new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_STATUS_INVALID);
              }


              if (inShareStatus) {

                  var getInShares = await conn.query('select CAST(uuid_from_bin(accountId) as char) as accountId from InShare ' +
                    'where outShareInstanceId = uuid_to_bin(?) and status = ?', [options.id, inShareStatus]);

                  await Promise.each(getInShares, function (getInShare) {

                      notificationOptions = {
                          accountId: getInShare.accountId,
                          user: options.user,
                          id: options.id,
                          template: template,
                          notification_reference: notification_reference
                      };
                      notifications.push(notificationOptions);

                  });

                  return {OK: Constants.SUCCESS_MESSAGE.OUT_SHARE_UPDATE_SUCCESS, notifications: notifications};

              }

          } catch (err) {
              throw err;
          }

      }
      ,

      sendDataShareNotificationMD: async function (options, cb) {
          var accountId = options.accountId;
          var user = options.user;
          var date = new Date();

          try {
              var conn = await connection.getConnection();
              var account = await conn.query('SELECT CAST(uuid_from_bin(id) as char) as id, companyName, email,' +
                ' status from accounts where id = uuid_to_bin(?) and status = "active"', [accountId]);

              account = Utils.filteredResponsePool(account);

              if (!account) {
                  return cb(null, null);
              }

              var query = 'select *,CAST(uuid_from_bin(id) as char) as id , ' +
                'CAST(uuid_from_bin(userId) as char) as userId ,CAST(uuid_from_bin(roleId) as char) as roleId from user_roles ' +
                'where userId in (select  id from users where accountId = uuid_to_bin(?)) and ' +
                'roleId in (select id from Roles where title in ("account admin", "account owner"))';

              var userIds = await conn.query(query, [options.accountId]);

              Async.eachSeries(userIds, function (userId, calb) {

                  var ownerUUID = userId.userId;

                  OutShareInstance.getUser({ownerUUID: ownerUUID}, function (err, accountOwner) {

                      if (err) {
                          return calb();
                      }
                      if (!accountOwner) {
                          return calb();
                      }

                      var opt = {
                          languageCultureCode: accountOwner.languageCultureCode,
                          template: options.template,
                          email: accountOwner.email
                      };

                      var compileOptions = {
                          name: accountOwner.firstName,
                          friend_name: user.firstName,
                          user_email: user.email,
                          scopehub_login: ''
                      };


                      var invitationExpirationDate = date.setDate(date.getDate() + Constants.CONTACT_INVITATION_EXPIRATION_DATE_LIMIT);
                      invitationExpirationDate = new Date(invitationExpirationDate);

                      EmailUtils.sendEmailMD(opt, compileOptions, async function (err) {

                          if (err) {
                              return calb(err);
                          }

                          try {
                              var NotificationApi = require('../api/notification');

                              var notificationSendOption = {
                                  refereId: options.id,
                                  refereType: Constants.NOTIFICATION_REFERE_TYPE.IN_SHARE,
                                  user_ids: [accountOwner.id],
                                  topic_id: accountOwner.id,
                                  notificationExpirationDate: invitationExpirationDate,
                                  paramasDateTime: date,
                                  notification_reference: options.notification_reference,
                                  metaEmail: user.email,
                                  paramsInviter: user.email + ', ' + (user.firstName ? user.firstName : '') + ' ' + (user.lastName ? user.lastName : ''),
                                  paramsInvitee: accountOwner.email + ', ' + (accountOwner.firstName ? accountOwner.firstName : '') + ' ' + (accountOwner.lastName ? accountOwner.lastName : ''),
                                  languageCultureCode: accountOwner.languageCultureCode,
                                  createdBy: user.id
                              };
                              if (user.firstName) {
                                  notificationSendOption.metaName = user.firstName;
                              }

                              await NotificationApi.createMD(notificationSendOption);

                              return calb();
                          } catch (err) {

                              if (err.code) {
                                  err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_NOTIFICATION_CREATION_FAILED);
                                  err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                              }
                              return calb(err);
                          }
                          ;

                      });

                  });

              }, async function (err) {
                  if (err) {
                      return cb(err);
                  }
                  return cb(null, account);

              });

          } catch (err) {
              throw err;
          }

      },

      validateExistingOutShareDetails: function (options) {
          return new Promise(async function (resolve, reject) {
              var accountId = options.accountId;
              var shareItemType = options.shareItemType;
              var accounts = options.accounts;
              var shareItemIds = options.shareItemIds;
              var err;
              try {
                  if (DataUtils.isUndefined(accountId)) {
                      err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
                  } else if (DataUtils.isUndefined(shareItemType)) {
                      err = new Error(ErrorConfig.MESSAGE.SHARE_ITEM_TYPE_REQUIRED);
                  } else if (Constants.OUT_SHARE_TYPE.indexOf(shareItemType) === -1) {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_SHARE_ITEM_TYPE_INVALID);
                  } else if (!DataUtils.isArray(shareItemIds)) {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ITEM_IDS_REQUIRED_AND_IDS_MUST_BE_IN_ARRAY);
                  } else if (shareItemIds.length <= 0) {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ITEM_IDS_REQUIRED_AND_IDS_MUST_BE_IN_ARRAY);
                  } else if (!DataUtils.isUniqueArray(shareItemIds)) {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ITEM_ID_DUPLICATE);
                  } else if (shareItemIds.length > Constants.MAX_OUT_SHARE_SHARE_ITEM_IDS) {
                      err = new Error(ErrorConfig.MESSAGE.ONLY_10_OUT_SHARE_ITEM_ID_ALLOWED);
                  } else if (!DataUtils.isArray(accounts)) {
                      err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ACCOUNTS_REQUIRED_AND_IDS_MUST_BE_IN_ARRAY);
                  } else if (accounts.length <= 0) {
                      err = new Error(ErrorConfig.MESSAGE.ATLEAST_ONE_ID_REUQIRED);
                  } else if (accounts.length > Constants.MAX_OUT_SHARE_INSTANCE_SUBSCRIBERS) {
                      err = new Error(ErrorConfig.MESSAGE.ONLY_10_OUT_SHARE_INSTANCE_SUBSCRIBERS_ALLOWED);
                  }

                  if (err) {
                      throw err;
                  }
                  await Promise.each(accounts, async function (account) {

                      if (DataUtils.isUndefined(account.accountId)) {
                          err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ACCOUNT_ID_REQUIRED);
                      } else if (!err && DataUtils.isValidateOptionalField(account.type)) {
                          err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_PARTNER_TYPE_REQUIRED);
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

    getExistingOutShareWithSamePartnerItems: function (options) {
          return new Promise(async function (resolve, reject) {
              var accountId = options.accountId;
              var shareItemType = options.shareItemType;
              var accounts = options.accounts;
              var shareItemIds = options.shareItemIds;
              var partnerString = '', itemString = '';
              var partnerValue = [], itemValue = [];
              var err;
              try {
                  var conn = await connection.getConnection();
                  _.map(accounts, function (account) {
                      partnerString += 'uuid_to_bin(?),';
                      partnerValue.push(account.accountId);
                  });

                  _.map(shareItemIds, function (shareItemId) {
                      itemString += 'uuid_to_bin(?),';
                      itemValue.push(shareItemId);
                  });
                  partnerString = partnerString.replace(/,\s*$/, ' ');
                  itemString = itemString.replace(/,\s*$/, ' ');

                  var outShares = await conn.query('SELECT  CAST(uuid_from_bin(OS.id) as CHAR) as outShareInstanceId,' +
                    ' OS.outShareId as outShareId, OS.outShareName as outShareName ' +
                    ' FROM OutShare OS, OutSharePartners OSP, OutShareItems OSI' +
                    ' WHERE OS.id = OSP.outShareInstanceId AND OS.id = OSI.outShareInstanceId AND ' +
                    ' OS.ShareItemType = ? AND OS.accountId = uuid_to_Bin(?) AND OS.STATUS IN (?,?,?) AND OSI.status = 1' +
                    ' AND OSP.inSharePartnerId IN (' + partnerString + ')' +
                    ' AND OSI.shareItemId IN (' + itemString + ')' +
                    ' GROUP BY OS.id',
                    [Constants.SHARING_TYPE[shareItemType], accountId, Constants.OUT_SHARE_STATUS.ACTIVE, Constants.OUT_SHARE_STATUS.INVITATION_SENT,
                        Constants.OUT_SHARE_STATUS.PAUSED].concat(partnerValue, itemValue));


                  return resolve(outShares);
              } catch (err) {
                  debug('err', err);
                  return reject(err);
              }
          });
      },


      getExistingOutShareDetails: async function (options, errorOptions, cb) {
          var accountId = options.accountId;
          var shareItemType = options.shareItemType;
          var accounts = options.accounts;
          var shareItemIds = options.shareItemIds;
          var partnerString = '', itemString = '';
          var partnerValue = [], itemValue = [];
          var outShareInstanceId = [];
          try {
              var conn = await connection.getConnection();
              var validateResponse = await OutShareInstance.validateExistingOutShareDetails(options);
              debug('validateResponse', validateResponse);
             /* var itemLength = shareItemIds.length;
              var partnerLength = accounts.length;
              var totalCount = Math.max(itemLength, partnerLength);

              _.map(accounts, function (account) {
                  partnerString += 'uuid_to_bin(?),';
                  partnerValue.push(account.accountId);
              });

              _.map(shareItemIds, function (shareItemId) {
                  itemString += 'uuid_to_bin(?),';
                  itemValue.push(shareItemId);
              });
              partnerString = partnerString.replace(/,\s*$/, ' ');
              itemString = itemString.replace(/,\s*$/, ' ');*/

            /*  var outShares = await conn.query('SELECT  CAST(uuid_from_bin(OS.id) as CHAR) as outShareInstanceId,' +
                ' OS.outShareId as outShareId, OS.outShareName as outShareName,' +
                ' COUNT(1) AS totalCount, ' +
                ' (SELECT COUNT(1) FROM OutSharePartners OSP WHERE OS.id = OSP.outShareInstanceId) AS partners,' +
                ' (SELECT COUNT(1) FROM OutShareItems OSI WHERE OS.id = OSI.outShareInstanceId ) AS items' +
                ' FROM OutShare OS, OutSharePartners OSP, OutShareItems OSI' +
                ' WHERE OS.id = OSP.outShareInstanceId AND OS.id = OSI.outShareInstanceId AND ' +
                ' OS.ShareItemType = ? AND OS.accountId = uuid_to_Bin(?) AND OS.STATUS IN (?,?,?) AND OSI.status = 1' +
                ' AND OSP.inSharePartnerId IN (' + partnerString + ')' +
                ' AND OSI.shareItemId IN (' + itemString + ')' +
                ' GROUP BY OS.id HAVING totalCount= ? AND partners = ?  AND items = ?',
                [Constants.SHARING_TYPE[shareItemType], accountId, Constants.OUT_SHARE_STATUS.ACTIVE, Constants.OUT_SHARE_STATUS.INVITATION_SENT,
                    Constants.OUT_SHARE_STATUS.PAUSED].concat(partnerValue, itemValue).concat([totalCount, partnerLength, itemLength]));
*/
              /* debug('outShare', outShares);
               outShareInstanceId = _.map(outShares, function (outShare) {
                   return _.pick(outShare, ['outShareInstanceId', 'outShareId', 'outShareName']);
               });*/
              var outShares = await OutShareInstance.getExistingOutShareWithSamePartnerItems(options);
              debug('outShares', outShares);

              var response = {
                  isConflict: 0,
                  outShares: outShares
              };

              if (outShares.length > 0) {
                  response.isConflict = 1;
              }

              return cb(null, response);
          } catch (err) {
              debug('err', err);
              await ErrorUtils.create(errorOptions, options, err);
              return cb(err);
          }
      },

      /*getByItemIdSharingProfileId: function (options, cb) {
          var err;
          if (DataUtils.isUndefined(options.accountId)) {
              err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
          }
          if (!err && DataUtils.isUndefined(options.itemId)) {
              err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ITEM_ID_REQUIRED);
          }
          if (!err && DataUtils.isUndefined(options.sharingProfileId)) {
              err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_SHARING_PROFILE_ID_REQUIRED);
          }
          if (err) {
              err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
              return cb(err);
          }
          options.itemIdSharingProfileId = options.itemId + '-' + options.sharingProfileId;
          var accountId = options.accountId;
          OutShareInstance.getByItemIdAndSharingProfileId(options, function (err, outShareInstance) {
              if (err) {
                  return cb(err);
              }
              if (!outShareInstance || accountId !== outShareInstance.accountId) {
                  err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_NOT_FOUND);
                  err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                  debug('err', err);
                  return cb(err);
              }

              OutShareInstance.populateSubscribersAndCustomers(outShareInstance, function (err, outShareInstance) {
                  if (err) {
                      return cb(err);
                  }
                  return cb(null, outShareInstance);
              });
          });
      },*/

      /*getByAccountId: function (options, cb) {
          var accountId = options.accountId;
          var itemId = options.itemId;
          if (DataUtils.isUndefined(accountId)) {
              var err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
              err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
              debug('err', err);
              return cb(err);
          }

          Async.series([function (callback) {
              if (DataUtils.isDefined(itemId)) {
                  OutShareInstanceModel.query(accountId)
                    .usingIndex(Constants.OUT_SHARE_INSTANCE_ACCOUNT_INDEX)
                    .filter('itemId').in([itemId])
                    .exec(callback);
              } else {
                  OutShareInstanceModel.query(accountId)
                    .usingIndex(Constants.OUT_SHARE_INSTANCE_ACCOUNT_INDEX)
                    .exec(callback);
              }
          }], function (err, result) {
              if (err) {
                  err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                  return cb(err);
              }
              var data = result[0];
              var outShareInstances = _.map(data.Items, 'attrs');

              OutShareInstance.populateSharingProfile(outShareInstances, function (err, outShareInstances) {
                  if (err) {
                      return cb(err);
                  }

                  return cb(null, outShareInstances);
                  // OutShareInstance.populateInShares(outShareInstances, function (err, outShareInstances) {
                  //     if (err) {
                  //         return cb(err);
                  //     }
                  //
                  //     //debug('outShareInstances', outShareInstances);
                  //       OutShareInstance.populateSubscribersAndCustomers(outShareInstances, function (err, outShareInstances) {
                  //           if (err) {
                  //               return cb(err);
                  //           }
                  //
                  //           var subscribers = [];
                  //
                  //           _.map(outShareInstances, function (outShareInstance) {
                  //               var partners = [];
                  //               _.each(outShareInstance.customers, function (customer) {
                  //                   partners.push({
                  //                       firstName: customer.firstName,
                  //                       streetAddress1: customer.streetAddress1,
                  //                       lastName: customer.lastName,
                  //                       streetAddress2: customer.streetAddress2,
                  //                       status: customer.status,
                  //                       email: customer.email,
                  //                       code: customer.customerCode,
                  //                       id: customer.customerId,
                  //                       accountIdCustomerId: customer.accountIdCustomerId,
                  //                       startDate: customer.startDate,
                  //                       type: Constants.OUT_SHARE_INSTANCE_PARTNER_TYPE.CUSTOMER,
                  //                       customerAccountId: customer.customerAccountId
                  //                   });
                  //               });
                  //               _.each(outShareInstance.subscribers, function (supplier) {
                  //                   var inShareStatus;
                  //                   var acceptedAt;
                  //                   var itemIdSharingProfileIdPartnerId = outShareInstance.itemIdSharingProfileId + '-' + supplier.supplierAccountId;
                  //
                  //                   _.each(outShareInstance.inShares, function (inShare) {
                  //                       console.log(itemIdSharingProfileIdPartnerId, itemIdSharingProfileIdPartnerId);
                  //                       if (inShare.itemIdSharingProfileIdPartnerId === itemIdSharingProfileIdPartnerId) {
                  //                           inShareStatus = inShare.status;
                  //                           acceptedAt = inShare.startDate;
                  //                       }
                  //                   });
                  //
                  //                   partners.push({
                  //                       firstName: supplier.firstName,
                  //                       streetAddress1: supplier.streetAddress1,
                  //                       lastName: supplier.lastName,
                  //                       streetAddress2: supplier.streetAddress2,
                  //                       status: inShareStatus,
                  //                       acceptedAt: acceptedAt,
                  //                       email: supplier.email,
                  //                       code: supplier.supplierCode,
                  //                       id: supplier.supplierId,
                  //                       accountIdSupplierId: supplier.accountIdSupplierId,
                  //                       startDate: supplier.startDate,
                  //                       type: Constants.OUT_SHARE_INSTANCE_PARTNER_TYPE.SUPPLIER,
                  //                       supplierAccountId: supplier.supplierAccountId
                  //                   });
                  //               });
                  //
                  //               delete outShareInstance.customers;
                  //               delete outShareInstance.subscribers;
                  //               delete outShareInstance.inShares;
                  //               debug('partners', partners);
                  //               outShareInstance.partners = partners;
                  //               return outShareInstance;
                  //           });
                  //
                  //           return cb(null, outShareInstances);
                  //       });
                  //
                  // });
              });
          });
      }
      ,*/

      /*getByItemIdAndSharingProfileId: function (options, cb) {
          var itemIdSharingProfileId = options.itemIdSharingProfileId;
          if (DataUtils.isUndefined(itemIdSharingProfileId)) {
              var err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ITEM_ID_SHARING_PROFILE_ID_REQUIRED);
              err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
              return cb(err);
          }
          OutShareInstanceModel.get(itemIdSharingProfileId, {
              ConsistentRead: true
          }, function (err, data) {
              if (err) {
                  err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                  return cb(err);
              }
              var outShareInstance = data && data.attrs;
              return cb(null, outShareInstance);
          });
      },*/

      /*checkSharedSubscribers: function (options, cb) {
          var sharedSubscribers = options.sharedSubscribers;
          var accountId = options.accountId;
          var err;
          if (DataUtils.isUndefined(accountId)) {
              err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
          }
          if (!DataUtils.isArray(sharedSubscribers)) {
              err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_SUPPLIER_ID_INVALID);
          }
          if (err) {
              err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
              return cb(err);
          }
          if (sharedSubscribers.length == 0) {
              return cb(null, []);
          }
          SupplierModel.query(accountId)
            .usingIndex(Constants.SUPPLIER_ACCOUNT_INDEX)
            .filter('accountIdSupplierId').in(sharedSubscribers)
            .exec(function (err, data) {
                if (err) {
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return cb(err);
                }
                var suppliersList = _.map(data.Items, 'attrs');
                return cb(null, suppliersList);
            });
      },*/

      /*getByItemIdSharingProfileIds: function (options, cb) {
          var itemIdsSharingProfileIds = options.itemIdsSharingProfileIds;
          var accountId = options.accountId;
          var err;
          if (DataUtils.isUndefined(accountId)) {
              err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
          }
          if (!DataUtils.isArray(itemIdsSharingProfileIds)) {
              err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ITEM_ID_SHARING_PROFILE_ID_REQUIRED);
          }
          if (err) {
              err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
              return cb(err);
          }
          OutShareInstanceModel.query(accountId)
            .usingIndex(Constants.OUT_SHARE_INSTANCE_ACCOUNT_INDEX)
            .filter('itemIdSharingProfileId').in(itemIdsSharingProfileIds)
            .exec(function (err, data) {
                if (err) {
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return cb(err);
                }

                var outShareInstances = _.map(data.Items, 'attrs');
                return cb(null, outShareInstances);
            });
      },*/

      /*getProductInventoryByAccountIdProductIdLocationId: function (options, cb) {
          var accountIdProductIdLocationId = options.accountIdProductIdLocationId;
          var accountId = options.accountId;
          var err;
          if (DataUtils.isUndefined(accountId)) {
              err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
          }
          if (DataUtils.isUndefined(accountIdProductIdLocationId)) {
              err = new Error(ErrorConfig.MESSAGE.PRODUCT_INVENTRY_ACCOUNT_ID_PRODUCT_ID_LOCATION_ID_REQUIRE);
          }
          if (err) {
              err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
              return cb(err);
          }

          ProductInventoryModel.get(accountIdProductIdLocationId, {
              ConsistentRead: true
          }, function (err, data) {
              if (err) {
                  err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;

                  return cb(err);
              }
              var productInventory = data && data.attrs;
              return cb(null, productInventory);
          });
      },*/

      /*getProductInventoryByAccountIdProductIdLocationIds: function (options, cb) {
          var itemsIds = options.itemsIds;
          var accountId = options.accountId;
          var err;
          if (DataUtils.isUndefined(accountId)) {
              err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
          }
          if (!DataUtils.isArray(itemsIds)) {
              err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ITEM_ID_REQUIRED);
          }
          if (err) {
              err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
              return cb(err);
          }
          ProductInventoryModel.query(accountId)
            .usingIndex(Constants.PRODUCT_INVENTORY_ACCOUNT_INDEX)
            .filter('accountIdProductIdLocationId').in(itemsIds)
            .exec(function (err, data) {
                if (err) {
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return cb(err);
                }

                var productInventories = _.map(data.Items, 'attrs');
                return cb(null, productInventories);
            });
      },*/

      /*populateSubscribersAndCustomers: function (outShareInstance, cb) {

          if (Array.isArray(outShareInstance)) {
              var finalOutShareInstances = [];
              Async.eachSeries(outShareInstance, function (obj, callback) {
                  OutShareInstance.populateSubscribersAndCustomers(obj, function (err, osi) {
                      if (err) {
                          return callback(err);
                      }
                      finalOutShareInstances.push(osi);
                      return callback(null);
                  });

              }, function (err) {
                  if (err) {
                      return cb(err);
                  }
                  return cb(null, finalOutShareInstances);
              });
          } else {
              Async.series([function (cb1) {
                  if (DataUtils.isArray(outShareInstance.subscribers)) {
                      return OutShareInstance.checkSharedSubscribers({
                          sharedSubscribers: outShareInstance.subscribers,
                          accountId: outShareInstance.accountId
                      }, cb1);
                  }
                  return cb1(null, undefined);
              }, function (cb2) {
                  if (DataUtils.isArray(outShareInstance.customers)) {
                      return CustomerApi.getCustomersByAccountIdCustomerIds({
                          accountIdCustomersIds: outShareInstance.customers,
                          accountId: outShareInstance.accountId
                      }, cb2);
                  }
                  return cb2(null, undefined);
              }], function (err, subscribersAndCustomer) {
                  if (err) {
                      return cb(err);
                  }
                  if (DataUtils.isArray(subscribersAndCustomer[0])) {
                      outShareInstance.subscribers = subscribersAndCustomer[0];
                  }
                  if (DataUtils.isArray(subscribersAndCustomer[1])) {
                      outShareInstance.customers = subscribersAndCustomer[1];
                  }
                  return cb(null, outShareInstance);
              });
          }
      },*/

      /*populateInShares: function (outShareInstance, cb) {

          if (Array.isArray(outShareInstance)) {
              var finalOutShareInstances = [];
              Async.eachSeries(outShareInstance, function (obj, callback) {
                  OutShareInstance.populateInShares(obj, function (err, osi) {
                      if (err) {
                          return callback(err);
                      }
                      finalOutShareInstances.push(osi);
                      return callback(null);
                  });

              }, function (err) {
                  if (err) {
                      return cb(err);
                  }
                  return cb(null, finalOutShareInstances);
              });
          } else {

              var itemIdSharingProfileId = outShareInstance.itemIdSharingProfileId;
              var accountId = outShareInstance.accountId;

              OutShareInstance.getInShareByItemIdSharingProfileId({
                  itemIdSharingProfileId: itemIdSharingProfileId,
                  accountId: accountId
              }, function (err, inShares) {
                  if (err) {
                      return cb(err);
                  }
                  var newOutShareInstance = Object.assign({}, outShareInstance);
                  console.log(inShares.length);
                  newOutShareInstance.inShares = inShares;
                  return cb(null, newOutShareInstance);
              });
          }
      },*/

      /*populateSharingProfile: function (outShareInstance, cb) {

          if (Array.isArray(outShareInstance)) {
              var finalOutShareInstances = [];
              Async.eachSeries(outShareInstance, function (obj, callback) {
                  OutShareInstance.populateSharingProfile(obj, function (err, osi) {
                      if (err) {
                          return callback(err);
                      }
                      finalOutShareInstances.push(osi);
                      return callback(null);
                  });

              }, function (err) {
                  if (err) {
                      return cb(err);
                  }
                  return cb(null, finalOutShareInstances);
              });
          } else {

              var sharingProfileId = outShareInstance.sharingProfileId;

              OutSharingApi.getByAccountIdAndProfileId({
                  accountIdProfileId: sharingProfileId
              }, function (err, profile) {
                  if (err) {
                      return cb(err);
                  }
                  var newOutShareInstance = Object.assign({}, outShareInstance);
                  newOutShareInstance.sharingProfile = profile;


                  return cb(null, newOutShareInstance);
              });
          }
      }
      ,*/

      /*getByAccountIdAndAccountISupplierId: function (options, cb) {
          var accountId = options.accountId;
          var accountIdSupplierId = options.accountIdSupplierId;

          var err;
          if (DataUtils.isUndefined(accountId)) {
              err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
          }
          if (DataUtils.isUndefined(accountIdSupplierId)) {
              err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_SUPPLIER_ID_REQUIRED);
          }
          if (err) {
              err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
              return cb(err);
          }

          OutShareInstanceModel
            .query(accountId)
            .usingIndex(Constants.OUT_SHARE_INSTANCE_ACCOUNT_INDEX)
            .filter('subscribers').contains(accountIdSupplierId)
            .exec(function (err, data) {
                if (err) {
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return cb(err);
                }
                var outSahreInstances = _.map(data.Items, 'attrs');
                return cb(null, outSahreInstances);
            });
      }
      ,*/

      /*getInShareByItemIdSharingProfileId: function (options, cb) {
          var itemIdSharingProfileId = options.itemIdSharingProfileId;
          var accountId = options.accountId;
          var err;

          if (DataUtils.isUndefined(itemIdSharingProfileId)) {
              err = new Error(ErrorConfig.MESSAGE.IN_SHARE_ITEM_ID_SHARING_PROFILE_ID_REQUIRED);
          }
          if (DataUtils.isUndefined(accountId)) {
              err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
          }
          if (err) {
              err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
              return cb(err);
          }

          InShareModel.query(itemIdSharingProfileId)
            .usingIndex(Constants.IN_SHARE_ITEMID_SHARING_PROFILEID_INDEX)
            .exec(function (err, data) {
                if (err) {
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return cb(err);
                }
                var inShares = _.map(data.Items, 'attrs');
                return cb(null, inShares);
            });
      }*/


      /*createHistory: function (options, cb) {
          OutShareInstanceModel.update(options, cb);
      }
      ,*/

      /*getByAccountIdAndOutShareId: function (options, cb) {
          var outShareId = options.outShareId;
          var accountId = options.accountId;
          var err;

          if (DataUtils.isUndefined(accountId)) {
              err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
          }
          if (DataUtils.isUndefined(outShareId)) {
              err = new Error(ErrorConfig.MESSAGE.OUT_SHARE_INSTANCE_ID_REQUIRED);
          }
          if (err) {
              err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
              return cb(err);
          }
          OutShareInstanceModel.query(accountId)
            .usingIndex(Constants.OUT_SHARE_INSTANCE_ACCOUNT_INDEX)
            .filter('outShareId').in([outShareId])
            .exec(function (err, data) {
                if (err) {
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return cb(err);
                }
                var outShareInstances = _.map(data.Items, 'attrs');

                return cb(null, outShareInstances);
            });
      }*/
  }
;

module.exports = OutShareInstance;