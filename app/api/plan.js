/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.api.Billing');
var Util = require('util');
var PromiseBluebird = require('bluebird');
var _ = require('lodash');
var moment = require('moment');

var DataUtils = require('../lib/data_utils');
var Utils = require('../lib/utils');
var AuditUtils = require('../lib/audit_utils');
var EmailUtils = require('../lib/email_utils');
var connection = require('../lib/connection_util');
var ErrorUtils = require('../lib/error_utils');
var Constants = require('../data/constants');
var ErrorConfig = require('../data/error');


var Plan = {

    getActivePlanByAccountId: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var accountId = options.accountId;
            var err;

            try {
                var conn = await connection.getConnection();
                var accountPlan = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id,actionType,actionDate,' +
                  ' effectiveFromDate,effectiveToDate,billingCycleStartDate,billingCycleEndDate,billCycleCount ' +
                  ' from AccountPlans where accountId = uuid_to_bin(?) and effectiveToDate = 0', [accountId]);
                accountPlan = Utils.filteredResponsePool(accountPlan);
                return resolve(accountPlan);
            } catch (err) {
                debug('err', err);
                if (err.errno) {
                    err = new Error(ErrorConfig.MESSAGE.ACCOUNT_PLAN_GET_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                }
                return reject(err);
            }
        });
    },

    expireActivePlan: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var accountPlanId = options.id;
            var effectiveToDate = options.effectiveToDate;
            var currentTime = DataUtils.getEpochMSTimestamp();
            var userId = options.userId;
            var err;

            try {
                var conn = await connection.getConnection();
                var isUpdated = await conn.query('Update AccountPlans set effectiveToDate = ? , updatedAt=? , updatedBy=uuid_to_bin(?) ' +
                  ' where id = uuid_to_bin(?)', [effectiveToDate, currentTime, userId, accountPlanId]);
                isUpdated = Utils.isAffectedPool(isUpdated);
                if (!isUpdated) {
                    err = new Error(ErrorConfig.MESSAGE.ACCOUNT_PLAN_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                if (err.errno) {
                    err = new Error(ErrorConfig.MESSAGE.ACCOUNT_PLAN_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                }
                return reject(err);
            }
        });
    },

    updateAccountPlan: async function (options, errorOptions, cb) {
        debug('options', options);
        var user = options.user;
        var accountId = user.accountId;
        var planType = options.planType;
        var billCycleCount = options.billCycleCount || 1;
        var currentTime = DataUtils.getEpochMSTimestamp();
        var billingCycleStartDate;
        var err;

        if (DataUtils.isUndefined(planType)) {
            err = new Error(ErrorConfig.MESSAGE.PLAN_TYPE_REQUIRED);
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
            // Get account plan
            var accountPlan = await Plan.getActivePlanByAccountId({accountId: accountId});
            debug('accountPlan', accountPlan);

            //Update old plan by expiring it
            var expireOption = {
                id: accountPlan.id,
                effectiveToDate: currentTime,
                userId: user.id
            };
            var expireResponse = await Plan.expireActivePlan(expireOption);
            debug('expireResponse ', expireResponse);

            if (accountPlan && accountPlan.actionType === Constants.ACTION_TYPE.SIGNUP) {
                billingCycleStartDate = currentTime;
            } else {
                billingCycleStartDate = accountPlan.billingCycleStartDate;
            }

            //Insert new account plans
            var newEffectiveFromDate = moment(currentTime).add(1, 'seconds').valueOf();
            var billingCycleOption = {
                accountId: accountId,
                planType: planType,
                actionDate: currentTime,
                effectiveFromDate: newEffectiveFromDate,
                billingCycleStartDate: billingCycleStartDate,
                actionType: Constants.ACTION_TYPE.SWITCH,
                billCycleCount: billCycleCount,
                userId: user.id
            };
            debug('billingCycleOption', billingCycleOption);
            var billingCycleResponse = await Plan.createBillingCycle(billingCycleOption);
            debug('billingCycleResponse', billingCycleResponse);

            await conn.query('COMMIT;');
            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            await conn.query('ROLLBACK;');
            debug('err', err);
            return cb(err);
        }
    },

    getPlanById: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            var planType = options.planType;
            var err;

            try {
                var conn = await connection.getConnection();
                var plan = await conn.query('select CAST(uuid_from_bin(id) as CHAR) as id,name from PlanReference where name = ?;', [planType]);
                plan = Utils.filteredResponsePool(plan);
                return resolve(plan);
            } catch (err) {
                debug('err', err);
                if (err.errno) {
                    err = new Error(ErrorConfig.MESSAGE.SUBSCRIPTION_PLAN_GET_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                }
                return reject(err);
            }
        });
    },

    validateBillingCycle: function (options) {
        var err;
        if (DataUtils.isUndefined(options.accountId)) {
            err = new Error(ErrorConfig.MESSAGE.ACCOUNT_ID_REQUIRED);
        } else if (DataUtils.isUndefined(options.actionDate)) {
            err = new Error(ErrorConfig.MESSAGE.BILLING_CYCLE_ACTION_DATE_REQUIRED);
        } else if (DataUtils.isUndefined(options.effectiveFromDate)) {
            err = new Error(ErrorConfig.MESSAGE.EFFECTIVE_FROM_DATE_REQUIRED);
        } else if (DataUtils.isUndefined(options.actionType)) {
            err = new Error(ErrorConfig.MESSAGE.BILLING_CYCLE_ACTION_TYPE_REQUIRED);
        } else if (DataUtils.isUndefined(options.planType)) {
            err = new Error(ErrorConfig.MESSAGE.PLAN_TYPE_REQUIRED);
        }
        return err;
    },

    calculateBillingCycleEndDate: function (options) {
        return new PromiseBluebird(function (resolve, reject) {
            var fromCycle = options.fromCycle;
            var planType = parseInt(options.planType);
            var billingCycleStartDate = parseInt(options.billingCycleStartDate);
            var billingCycleEndDate = parseInt(options.billingCycleEndDate);
            var billCycleCount = parseInt(options.billCycleCount);
            var newBillingCycleEndDate = new moment();

            if (planType === Constants.SUB_SCRIPTION_PLANS.PLUS_DAILY || planType === Constants.SUB_SCRIPTION_PLANS.STANDARD_DAILY
              || planType === Constants.SUB_SCRIPTION_PLANS.ENTERPRISE_DAILY) {
                if (fromCycle) {
                    newBillingCycleEndDate = moment(billingCycleEndDate).add(parseInt(billCycleCount), 'day');
                } else {
                    newBillingCycleEndDate = moment(billingCycleStartDate).add(parseInt(billCycleCount), 'day');
                }
                newBillingCycleEndDate = newBillingCycleEndDate.set({
                    hour: '00',
                    minutes: '00',
                    seconds: '00',
                    millisecond: '000'
                }).valueOf();
                debug('date', newBillingCycleEndDate);
                debug('newBillingCycleEndDate', newBillingCycleEndDate);
            } else {
                if (fromCycle) {
                    newBillingCycleEndDate = moment(billingCycleEndDate).add(parseInt(billCycleCount), 'month');
                } else {
                    newBillingCycleEndDate = moment(billingCycleStartDate).add(parseInt(billCycleCount), 'month');
                }
                newBillingCycleEndDate = newBillingCycleEndDate.set({
                    date: '1',
                    hour: '00',
                    minutes: '00',
                    seconds: '00',
                    millisecond: '000'
                }).valueOf();
            }
            if (fromCycle) {
                billingCycleStartDate = moment(billingCycleEndDate).add(1, 'milliseconds').valueOf();
            }
            return resolve({billingCycleEndDate: newBillingCycleEndDate, billingCycleStartDate: billingCycleStartDate});
        });
    },

    insertAccountPlans: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            try {
                var conn = await connection.getConnection();

                var isInserted = await conn.query('insert into AccountPlans (id,accountId,planReferenceId,actionDate,' +
                  ' effectiveFromDate,billingCycleStartDate,billingCycleEndDate,actionType,billCycleCount,createdAt,updatedAt,createdBy) ' +
                  ' values (uuid_to_bin(?),uuid_to_bin(?),uuid_to_bin(?),?,?,?,?,?,?,?,?,uuid_to_bin(?))',
                  [options.id, options.accountId, options.planReferenceId, options.actionDate, options.effectiveFromDate,
                      options.billingCycleStartDate, options.billingCycleEndDate, options.actionType,
                      options.billCycleCount, options.currentTime, options.currentTime, options.userId]);
                isInserted = Utils.isAffectedPool(isInserted);
                debug('isInserted', isInserted);
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.BILLING_CYCLE_CREATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    createBillingCycle: function (options) {
        return new PromiseBluebird(async function (resolve, reject) {
            //debug('options', options);
            var accountId = options.accountId;
            var userId = options.userId;
            var planType = options.planType;
            var planReferenceId;
            var billCycleCount = options.billCycleCount || 2;
            var actionDate = options.actionDate;
            var effectiveFromDate = options.effectiveFromDate;
            var billingCycleStartDate = options.billingCycleStartDate;
            var actionType = options.actionType;
            var id = Utils.generateId().uuid;
            var currentTime = DataUtils.getEpochMSTimestamp();
            var billingCycleEndDate;

            try {
                // validate the request
                var err = Plan.validateBillingCycle(options);
                if (err) {
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }

                // Get planId
                var plan = await Plan.getPlanById({
                    planType: planType
                });
                if (DataUtils.isUndefined(plan)) {
                    err = new Error(ErrorConfig.MESSAGE.SUB_SCRIPTION_PLAN_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }
                planReferenceId = plan.id;

                // Get billingCycleEndDate
                if (planType === Constants.SUB_SCRIPTION_PLANS.FREE_DAILY || planType === Constants.SUB_SCRIPTION_PLANS.FREE_MONTHLY) {
                    debug('Inside if');
                    billingCycleEndDate = 0;
                    billingCycleStartDate = 0;
                } else {
                    debug('Inside else');
                    var calculateDateOption = {
                        planType: planType,
                        billingCycleStartDate: billingCycleStartDate,
                        billCycleCount: billCycleCount
                    };
                    var dates = await Plan.calculateBillingCycleEndDate(calculateDateOption);
                    billingCycleStartDate = dates.billingCycleStartDate;
                    billingCycleEndDate = dates.billingCycleEndDate;
                    debug('dates', dates);
                }

                // insert record in billing cycle table
                var insertOption = {
                    id: id,
                    accountId: accountId,
                    planReferenceId: planReferenceId,
                    actionDate: actionDate,
                    effectiveFromDate: effectiveFromDate,
                    billingCycleStartDate: billingCycleStartDate,
                    billingCycleEndDate: billingCycleEndDate,
                    actionType: actionType,
                    billCycleCount: billCycleCount,
                    currentTime: currentTime,
                    userId: userId
                };
                debug('insertOption', insertOption);
                var insertResponse = await Plan.insertAccountPlans(insertOption);

                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    }
};

module.exports = Plan;
