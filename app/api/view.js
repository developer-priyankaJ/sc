/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.api.view');
var Util = require('util');
var Async = require('async');
var _ = require('lodash');
var Promise = require('bluebird');
var connection = require('../lib/connection_util');
var ErrorConfig = require('../data/error');
var DataUtils = require('../lib/data_utils');
var AuditUtils = require('../lib/audit_utils');
var Constants = require('../data/constants');
var EmailUtils = require('../lib/email_utils');
var Utils = require('../lib/utils');
var ErrorUtils = require('../lib/error_utils');

var View = {

    /*
    * validate create view request
    * */
    validateCreateView: function (options) {
        return new Promise(function (resolve, reject) {
            var name = options.name;
            var type = options.type;
            var columns = options.columns;
            var fromFilterDate = options.fromFilterDate;
            var toFilterDate = options.toFilterDate;
            var sortColumn = options.sortColumn;
            var sortOrder = options.sortOrder;
            var columnsNames = _.map(columns, 'name');
            var err;

            try {
                if (DataUtils.isUndefined(name)) {
                    err = new Error(ErrorConfig.MESSAGE.VIEW_NAME_REQUIRED);
                } else if (DataUtils.isUndefined(type)) {
                    err = new Error(ErrorConfig.MESSAGE.VIEW_TYPE_REQUIRED);
                } else if (DataUtils.isUndefined(columns)) {
                    err = new Error(ErrorConfig.MESSAGE.VIEW_COLUMNS_REQUIRED);
                } else if (!DataUtils.isArray(columns)) {
                    err = new Error(ErrorConfig.MESSAGE.COLUMNS_MUST_BE_ARRAY);
                } else if (columns.length <= 0) {
                    err = new Error(ErrorConfig.MESSAGE.AT_LEAST_ONE_COLUMN_REQUIRED);
                } else if (DataUtils.isUndefined(fromFilterDate)) {
                    err = new Error(ErrorConfig.MESSAGE.FROM_FILTER_DATE_REQUIRED);
                } else if (DataUtils.isUndefined(toFilterDate)) {
                    err = new Error(ErrorConfig.MESSAGE.TO_FILTER_DATE_REQUIRED);
                } else if (DataUtils.isUndefined(sortColumn)) {
                    err = new Error(ErrorConfig.MESSAGE.SORT_COLUMN_REQUIRED);
                } else if (DataUtils.isUndefined(sortOrder)) {
                    err = new Error(ErrorConfig.MESSAGE.SORT_ORDER_REQUIRED);
                } else if (sortOrder !== 0 && sortOrder !== 1) {
                    err = new Error(ErrorConfig.MESSAGE.INVALID_SORT_ORDER);
                } else if (columnsNames.indexOf(sortColumn) === -1) {
                    err = new Error(ErrorConfig.MESSAGE.SORT_COLUMN_NOT_FOUND);
                } else if (columns.length > 0) {
                    _.map(columns, function (column) {
                        if (DataUtils.isUndefined(column.name)) {
                            err = new Error(ErrorConfig.MESSAGE.COLUMN_NAME_REQUIRED);
                            throw err;
                        }
                        if (DataUtils.isUndefined(column.order)) {
                            err = new Error(ErrorConfig.MESSAGE.COLUMN_ORDER_REQUIRED);
                            throw err;
                        }
                    });
                }
                if (err) {
                    throw err;
                }
                return resolve(Constants.OK_MESSAGE);

            } catch (err) {
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return reject(err);
            }
        });
    },

    /*
    * create view column records
    * */
    createViewColumns: function (options) {
        return new Promise(async function (resolve, reject) {
            var viewColumnList = options.viewColumnList;
            var query, values;
            var convertedviewColumnList, keys, err;

            await Utils.convertObjectToArrayMD(viewColumnList, async function (err, response) {
                if (err) {
                    debug('err', err);
                    return reject(err);
                }
                convertedviewColumnList = response.list;
                keys = response.keys;

                query = 'insert into ViewColumns (' + keys + ') values';
                values = ' (uuid_to_bin(?),uuid_to_bin(?),?,?,?,?) ';


                await Promise.each(viewColumnList, function (value) {
                    query = query + values;
                    query = query + ',';
                });

                query = query.replace(/,\s*$/, '');

                try {
                    var conn = await connection.getConnection();
                    var viewColumnInserted = await conn.query(query, convertedviewColumnList);
                    viewColumnInserted = Utils.isAffectedPool(viewColumnInserted);
                    debug('viewColumnInserted-----------------------------------------', viewColumnInserted);
                    return resolve(Constants.OK_MESSAGE);
                } catch (err) {
                    debug('err ', err);
                    err = new Error(ErrorConfig.MESSAGE.CREATE_VIEW_COLUMN_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
            });

        });
    },

    /*
    * check for default is exist or not
    * */
    checkDefaultView: function (options) {
        return new Promise(async function (resolve, reject) {
            var userId = options.userId;
            var type = options.type;

            try {
                var conn = await connection.getConnection();

                var defaultView = await conn.query('select * from Views where type=? ' +
                  ' and isDefault = 1;', [type]);

                return resolve(defaultView);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }

        });
    },

    /*
    * create view
    * */
    createView: function (options) {
        return new Promise(async function (resolve, reject) {
            var name = options.name;
            var userId = options.userId;
            var createdBy = userId;
            var accountId = options.accountId;
            var type = options.type;
            var isDefault = options.isDefault || 0;
            var columns = options.columns;
            var fromFilterDate = options.fromFilterDate;
            var toFilterDate = options.toFilterDate;
            var sortColumn = options.sortColumn;
            var sortOrder = options.sortOrder;
            var currentDate = DataUtils.getEpochMSTimestamp();
            var generatedId = Utils.generateId();
            var err;

            try {
                /*var accountData = await conn.query('IF (select 1 from accounts where id=uuid_to_bin(?)) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "ACCOUNT_NOT_FOUND", MYSQL_ERRNO = 4001;' +
                  'ELSEIF (select 1 from accounts where  id=uuid_to_bin(?) and updatedAt=?) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "ACCOUNT_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
                  'ELSE update accounts set ' + accountFields + ' updatedAt = ?,' +
                  ' updatedBy=uuid_to_bin(?) where id = uuid_to_bin(?);END IF', accountRequiredValues);*/

                if (isDefault === 1) {
                    userId = Constants.DEFAULT_REFERE_ID;
                    accountId = Constants.DEFAULT_REFERE_ID;
                }

                var conn = await connection.getConnection();
                var isInserted = await conn.query('IF (select 1 from Views where userId = uuid_to_bin(?) and name=? and type = ?) is not null THEN ' +
                  ' SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "VIEW_ALREADY_EXIST_WITH_SAME_NAME", MYSQL_ERRNO = 4001; ' +
                  ' ELSE insert into Views set id = uuid_to_bin(?) ,userId = uuid_to_bin(?), accountId = uuid_to_bin(?) ,' +
                  ' name = ? , type = ? ,isDefault = ?,  fromFilterDate = ? , toFilterDate = ?, sortColumn=?, sortOrder=?,recentViewTime = ?,' +
                  ' createdAt = ?, updatedAt = ?, createdBy = uuid_to_bin(?) , updatedBy = uuid_to_bin(?); end if;'
                  , [userId, name, type, generatedId.uuid, userId, accountId, name, type, isDefault, fromFilterDate, toFilterDate, sortColumn, sortOrder, currentDate, currentDate, currentDate,
                      createdBy, createdBy]);
                isInserted = Utils.isAffectedPool(isInserted);
                if (!isInserted) {
                    err = new Error(ErrorConfig.MESSAGE.CREATE_VIEW_FAILED);
                    err.status = new ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
                debug('isInserted', isInserted);
                return resolve({
                    OK: Constants.SUCCESS,
                    id: generatedId.uuid,
                    updatedAt: currentDate,
                    recentViewTime: currentDate
                });
            } catch (err) {
                debug('err', err);
                if (err.errno === 4001) {
                    err = new Error(ErrorConfig.MESSAGE.VIEW_ALREADY_EXIST_WITH_SAME_NAME);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                } else {
                    err = new Error(ErrorConfig.MESSAGE.CREATE_VIEW_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }

            }
        });
    },

    /*
    * convert column object into into comma separated string 
    * */
    convertColumnObject: function (options) {
        return new Promise(function (resolve, reject) {
            var columns = options.columns;
            var columnName = '', columnOrder = '';

            _.map(columns, function (column) {
                columnName += column.name + ',';
                columnOrder += column.order + ',';
            });
            columnName = columnName.replace(/,\s*$/, '');
            columnOrder = columnOrder.replace(/,\s*$/, '');
            return resolve({
                name: columnName,
                order: columnOrder
            });
        });
    },

    create: async function (options, auditOptions, errorOptions, cb) {
        var columns = options.columns;
        var userId = options.userId;
        var accountId = options.accountId;
        var type = options.type;
        var name = options.name;
        var fromFilterDate = options.fromFilterDate;
        var toFilterDate = options.toFilterDate;
        var sortColumn = options.sortColumn;
        var sortOrder = options.sortOrder;


        var viewColumnList = [], viewColumnObject = {};
        var currentDate = DataUtils.getEpochMSTimestamp();
        var isDefault = 0;

        try {
            var conn = await connection.getConnection();
            await conn.query('START TRANSACTION;');
        } catch (err) {
            debug('err', err);
            return cb(err);
        }

        try {
            var checkResponse = await View.validateCreateView(options);
            debug('checkResponse', checkResponse);

            //check for default view
            var checkDefaultViewOption = {
                userId: userId,
                type: type
            };
            var defaultView = await View.checkDefaultView(checkDefaultViewOption);
            if (defaultView && defaultView.length <= 0) {
                isDefault = 1;
            }
            options.isDefault = isDefault;

            // Create view
            var createViewResponse = await View.createView(options);

            // Create list for multiple object
            await Promise.each(columns, function (column) {
                var generatedId = Utils.generateId();
                viewColumnObject = {
                    id: generatedId.uuid,
                    viewId: createViewResponse.id,
                    columnName: column.name,
                    columnOrder: column.order,
                    createdAt: currentDate,
                    updatedAt: currentDate
                };
                viewColumnList.push(viewColumnObject);
            });

            //Create view columns
            if (viewColumnList.length > 0) {
                var createViewColumnOption = {
                    viewColumnList: viewColumnList
                };
                var createViewColumnResponse = await View.createViewColumns(createViewColumnOption);
            }

            var columnResponse = await View.convertColumnObject({columns: columns});
            var response = {
                id: createViewResponse.id,
                accountId: accountId,
                type: type,
                name: name,
                fromFilterDate: fromFilterDate,
                toFilterDate: toFilterDate,
                sortColumn: sortColumn,
                sortOrder: sortOrder,
                columnName: columnResponse.name,
                columnOrder: columnResponse.order,
                recentViewTime: createViewResponse.recentViewTime,
                isDefault: isDefault,
                updatedAt: createViewResponse.updatedAt
            };

            AuditUtils.create(auditOptions);
            await conn.query('COMMIT;');
            return cb(null, response);
        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK;');
            await ErrorUtils.create(errorOptions, options, err);
            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.CREATE_VIEW_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }

    },

    /*
    * Get all view from type
    * */
    get: async function (options, errorOptions, cb) {
        var userId = options.userId;
        var type = options.type;
        var err;

        if (DataUtils.isUndefined(type)) {
            err = new Error(ErrorConfig.MESSAGE.VIEW_TYPE_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            debug('demo call');
            ///debug('file', file.b);
            var conn = await connection.getConnection();

            var view = await conn.query('with viewcolumn as (select V.id as viewId,group_concat(VC.columnName) as columnName,' +
              'group_concat(VC.columnOrder) as columnOrder from Views V , ViewColumns VC where type = ? and ' +
              'V.userId = uuid_to_bin(?) and VC.viewId = V.id group by V.id ) ' +
              'select CAST(uuid_from_bin(V.id) as char) as id,CAST(uuid_from_bin(V.accountId) as char) as accountId,' +
              'V.name, V.`type`,V.fromFilterDate,V.toFilterDate,V.sortColumn,V.sortOrder,V.isDefault,V.recentViewTime, ' +
              'VC.columnName,VC.columnOrder,V.updatedAt  from Views V , viewcolumn VC where type = ? and V.userId = uuid_to_bin(?) ' +
              'and VC.viewId = V.id', [type, userId, type, userId]);

            return cb(null, view);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.GET_VIEW_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }

    },

    /*
    * Get recent view from type
    * */
    getRecent: async function (options, errorOptions, cb) {
        var userId = options.userId;
        var type = options.type;
        var err;

        if (DataUtils.isUndefined(type)) {
            err = new Error(ErrorConfig.MESSAGE.VIEW_TYPE_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();

            var view = await conn.query('with viewcolumn as (select V.id as viewId,group_concat(VC.columnName) as columnName,' +
              'group_concat(VC.columnOrder) as columnOrder from Views V , ViewColumns VC where type = ? and ' +
              'V.userId = uuid_to_bin(?) and VC.viewId = V.id group by V.id ) ' +
              'select CAST(uuid_from_bin(V.id) as char) as id,CAST(uuid_from_bin(V.accountId) as char) as accountId,' +
              'V.name, V.`type`,V.fromFilterDate,V.toFilterDate,V.recentViewTime,V.sortColumn,V.sortOrder,V.isDefault,' +
              'VC.columnName,VC.columnOrder,V.updatedAt  from Views V , viewcolumn VC where type = ? and V.userId = uuid_to_bin(?) ' +
              'and VC.viewId = V.id order by recentViewTime desc limit 10', [type, userId, type, userId]);

            return cb(null, view);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.GET_VIEW_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }

    },

    /*
    * Get view by name and type , if not name then give default view
    * */
    getByName: async function (options, errorOptions, cb) {
        var userId = options.userId;
        var type = options.type;
        var name = options.name;
        var err, queryString, values = [];
        var view;

        if (DataUtils.isUndefined(type)) {
            err = new Error(ErrorConfig.MESSAGE.VIEW_TYPE_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }


        try {
            var conn = await connection.getConnection();

            if (DataUtils.isDefined(name)) {
                queryString = 'with viewcolumn as (select V.id as viewId,group_concat(VC.columnName) as columnName,' +
                  'group_concat(VC.columnOrder) as columnOrder from Views V , ViewColumns VC where type = ? and ' +
                  'V.userId = uuid_to_bin(?) and VC.viewId = V.id and V.name = ? group by V.id ) ' +
                  'select CAST(uuid_from_bin(V.id) as char) as id,CAST(uuid_from_bin(V.accountId) as char) as accountId,' +
                  'V.name,V.`type`,V.fromFilterDate,V.toFilterDate,V.sortColumn,V.sortOrder,V.isDefault,' +
                  'VC.columnName,VC.columnOrder,V.updatedAt  from Views V , viewcolumn VC where type = ? and V.userId = uuid_to_bin(?) ' +
                  'and V.name = ? and VC.viewId = V.id ';
                values.push(type, userId, name, type, userId, name);
            } else {
                queryString = 'with viewcolumn as (select V.id as viewId,group_concat(VC.columnName) as columnName,' +
                  'group_concat(VC.columnOrder) as columnOrder from Views V , ViewColumns VC where type = ? and ' +
                  'V.userId = uuid_to_bin(?) and VC.viewId = V.id and V.isDefault = 1 group by V.id ) ' +
                  'select CAST(uuid_from_bin(V.id) as char) as id,CAST(uuid_from_bin(V.accountId) as char) as accountId,' +
                  'V.name,V.`type`,V.fromFilterDate,V.toFilterDate,V.sortColumn,V.sortOrder,V.isDefault,' +
                  'VC.columnName,VC.columnOrder,V.updatedAt  from Views V , viewcolumn VC where type = ? and V.userId = uuid_to_bin(?) ' +
                  'and V.isDefault = 1 and VC.viewId = V.id ';
                values.push(type, Constants.DEFAULT_REFERE_ID, type, Constants.DEFAULT_REFERE_ID);
            }
            view = await conn.query(queryString, values);
            view = Utils.filteredResponsePool(view);
            if (!view) {
                err = new Error(ErrorConfig.MESSAGE.VIEW_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                await ErrorUtils.create(errorOptions, options, err);
                return cb(err);
            }

            return cb(null, view);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            err = new Error(ErrorConfig.MESSAGE.GET_VIEW_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }

    },

    /*
    * Validate optional fields
    * */
    validateOptionalFields: async function (options) {
        return new Promise(function (resolve, reject) {
            var viewFields = '';
            var viewOptionalValues = [];
            var err;

            try {
                if (!DataUtils.isValidateOptionalField(options.isRecentViewUpdate)) {
                    if (options.isRecentViewUpdate === 1) {
                        viewFields += 'recentViewTime=? ,';
                        viewOptionalValues.push(DataUtils.getEpochMSTimestamp());
                    }
                }
                if (!DataUtils.isValidateOptionalField(options.name)) {
                    if (!DataUtils.isString(options.name)) {
                        throw err = new Error(ErrorConfig.MESSAGE.VIEW_NAME_MUST_BE_STRING);
                    } else if (options.name.length > 100) {
                        throw err = new Error(ErrorConfig.MESSAGE.VIEW_NAME_MUST_BE_LESS_THAN_100_CHARACTER);
                    } else {
                        viewFields += 'name=? ,';
                        viewOptionalValues.push(options.name);
                    }
                }
                if (!DataUtils.isValidateOptionalField(options.fromFilterDate)) {
                    if (!DataUtils.isDate(new Date(options.fromFilterDate))) {
                        throw err = new Error(ErrorConfig.MESSAGE.FROM_FILTER_DATE_MUST_BE_DATE);
                    }
                    else {
                        viewFields += 'fromFilterDate=? ,';
                        viewOptionalValues.push(options.fromFilterDate);
                    }
                }
                if (!DataUtils.isValidateOptionalField(options.toFilterDate)) {
                    if (!DataUtils.isDate(new Date(options.toFilterDate))) {
                        throw err = new Error(ErrorConfig.MESSAGE.TO_FILTER_DATE_MUST_BE_DATE);
                    }
                    else {
                        viewFields += 'toFilterDate=? ,';
                        viewOptionalValues.push(options.toFilterDate);
                    }
                }
                if (!DataUtils.isValidateOptionalField(options.sortColumn)) {
                    if (!DataUtils.isString(options.sortColumn)) {
                        throw err = new Error(ErrorConfig.MESSAGE.SORT_COLUMN_MUST_BE_STRING);
                    } else if (options.sortColumn.length > 100) {
                        throw err = new Error(ErrorConfig.MESSAGE.SORT_COLUMN_MUST_BE_LESS_THAN_100_CHARACTER);
                    }
                    else {
                        viewFields += 'sortColumn=? ,';
                        viewOptionalValues.push(options.sortColumn);
                    }
                }
                if (!DataUtils.isValidateOptionalField(options.sortOrder)) {
                    if (options.sortOrder !== 0 && options.sortOrder !== 1) {
                        throw err = new Error(ErrorConfig.MESSAGE.INVALID_SORT_ORDER);
                    }
                    else {
                        viewFields += 'sortOrder=? ,';
                        viewOptionalValues.push(options.sortOrder);
                    }
                }
                if (!DataUtils.isValidateOptionalField(options.columns)) {
                    if (!DataUtils.isArray(options.columns)) {
                        throw err = new Error(ErrorConfig.MESSAGE.COLUMNS_MUST_BE_ARRAY);
                    } else if (options.columns.length <= 0) {
                        throw err = new Error(ErrorConfig.MESSAGE.AT_LEAST_ONE_COLUMN_REQUIRED);
                    } else if (options.columns.length > 0) {
                        _.map(options.columns, function (column) {
                            if (DataUtils.isUndefined(column.name)) {
                                err = new Error(ErrorConfig.MESSAGE.COLUMN_NAME_REQUIRED);
                                throw err;
                            }
                            if (DataUtils.isUndefined(column.order)) {
                                err = new Error(ErrorConfig.MESSAGE.COLUMN_ORDER_REQUIRED);
                                throw err;
                            }
                        });
                    }
                }

                var response = {
                    viewFields: viewFields,
                    viewOptionalValues: viewOptionalValues
                };
                debug('response', response);
                return resolve(response);
            } catch (err) {
                debug('err', err);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return reject(err);
            }
        });
    },

    /*
    * Update view by id
    * */
    updateView: function (options) {
        return new Promise(async function (resolve, reject) {
            debug('options----', options);
            if (_.isEmpty(options)) {
                return resolve(Constants.OK_MESSAGE);
            }
            var err;
            try {
                var conn = await connection.getConnection();

                var isUpdated = await conn.query('IF (select 1 from Views where id=uuid_to_bin(?)) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "VIEW_NOT_FOUND", MYSQL_ERRNO = 4001;' +
                  'ELSEIF (select 1 from Views where userId = uuid_to_bin(?) and type = ? and name=?) is not null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "VIEW_WITH_SAME_NAME_ALREADY_EXIST", MYSQL_ERRNO = 4002;' +
                  'ELSEIF (select 1 from Views where id=uuid_to_bin(?) and isDefault = 1) is not null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "CAN_NOT_UPDATE_DEFAULT_VIEW", MYSQL_ERRNO = 4003;' +
                  'ELSEIF (select 1 from Views where id=uuid_to_bin(?) and updatedAt=?) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "VIEW_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4004;' +
                  'ELSE update Views set ' + options.viewFields + ' recentViewTime=?, updatedAt = ?,updatedBy=uuid_to_bin(?) ' +
                  'where id = uuid_to_bin(?);end if;', options.viewRequiredValues);
                isUpdated = Utils.isAffectedPool(isUpdated);

                if (!isUpdated) {
                    throw err;
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                if (err.errno === 4001) {
                    err = new Error(ErrorConfig.MESSAGE.VIEW_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                } else if (err.errno === 4002) {
                    err = new Error(ErrorConfig.MESSAGE.VIEW_WITH_SAME_NAME_ALREADY_EXIST);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    return reject(err);
                } else if (err.errno === 4003) {
                    err = new Error(ErrorConfig.MESSAGE.CAN_NOT_UPDATE_DEFAULT_VIEW);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                } else if (err.errno === 4004) {
                    err = new Error(ErrorConfig.MESSAGE.VIEW_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    return reject(err);
                } else {
                    err = new Error(ErrorConfig.MESSAGE.VIEW_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
            }
        });
    },

    /*
    * delete all the columns by viewId
    * */
    deleteViewColumn: function (options) {
        return new Promise(async function (resolve, reject) {
            var viewId = options.viewId;
            var userId = options.userId;

            try {
                var conn = await connection.getConnection();

                var isDeleted = await conn.query('delete from ViewColumns where viewId = uuid_to_bin(?); ', [viewId, userId]);
                isDeleted = Utils.isAffectedPool(isDeleted);
                debug('isDeleted', isDeleted);
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.VIEW_COLUMNS_DELETE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    /*
    * get column record by column name and viewId
    * */
    getColumn: function (options) {
        return new Promise(async function (resolve, reject) {
            var viewId = options.viewId;
            var columnName = options.columnName;
            var err;

            try {
                var conn = await connection.getConnection();
                var column = await conn.query('select columnName from ViewColumns where columnName=? and viewId=uuid_to_bin(?)',
                  [columnName, viewId]);
                column = Utils.filteredResponsePool(column);
                return resolve(column);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.GET_VIEW_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }

        });
    },

    /*
    * Update view
    * */
    update: async function (options, auditOptions, errorOptions, cb) {
        var userId = options.userId;
        var type = options.type;
        var viewId = options.id;
        var updatedAt = options.updatedAt;
        var name = options.name;
        var columns = options.columns;
        var sortColumn = options.sortColumn;
        var err, queryString, values = [];
        var viewFields = '';
        var viewRequiredValues = [];
        var viewOptionalValues = [];
        var newUpdatedAt = DataUtils.getEpochMSTimestamp();
        var viewColumnObject = {}, viewColumnList = [];

        if (DataUtils.isUndefined(viewId)) {
            err = new Error(ErrorConfig.MESSAGE.VIEW_ID_REQUIRED);
        } else if (DataUtils.isUndefined(type)) {
            err = new Error(ErrorConfig.MESSAGE.VIEW_TYPE_REQUIRED);
        } else if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.VIEW_UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.INVALID_VIEW_UPDATED_AT);
        }
        if (err) {
            debug('err', err);
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
            if (DataUtils.isDefined(sortColumn)) {
                // validate sort column
                var columnOption = {
                    columnName: sortColumn,
                    viewId: viewId
                };
                var column = await View.getColumn(columnOption);
                if (!column) {
                    err = new Error(ErrorConfig.MESSAGE.SORT_COLUMN_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return cb(err);
                }
            }


            var response = await View.validateOptionalFields(options);
            viewFields = response.viewFields;
            viewOptionalValues = response.viewOptionalValues;

            viewRequiredValues.push(viewId, userId, type, name || '', viewId, viewId, updatedAt);
            viewRequiredValues = _.concat(viewRequiredValues, viewOptionalValues);
            viewRequiredValues.push(newUpdatedAt, newUpdatedAt, userId, viewId);

            var updateViewOption = {
                viewFields: viewFields,
                viewRequiredValues: viewRequiredValues
            };
            var updateViewResponse = await View.updateView(updateViewOption);
            debug('updateViewResponse', updateViewResponse);

            if (DataUtils.isDefined(columns)) {
                // delete old columns
                var deleteOption = {
                    userId: userId,
                    viewId: viewId
                };
                var deleteResponse = await View.deleteViewColumn(deleteOption);
                debug('deleteResponse', deleteResponse);


                // Create list for multiple object
                await Promise.each(columns, function (column) {
                    var generatedId = Utils.generateId();
                    viewColumnObject = {
                        id: generatedId.uuid,
                        viewId: viewId,
                        columnName: column.name,
                        columnOrder: column.order,
                        createdAt: newUpdatedAt,
                        updatedAt: newUpdatedAt
                    };
                    viewColumnList.push(viewColumnObject);
                });

                //Create view columns
                if (viewColumnList.length > 0) {
                    var createViewColumnOption = {
                        viewColumnList: viewColumnList
                    };
                    var createViewColumnResponse = await View.createViewColumns(createViewColumnOption);
                    debug('createViewColumnResponse', createViewColumnResponse);
                }
            }
            AuditUtils.create(auditOptions);
            await conn.query('COMMIT;');
            return cb(null, {
                OK: Constants.SUCCESS,
                updatedAt: newUpdatedAt
            });
        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK;');
            await ErrorUtils.create(errorOptions, options, err);
            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.VIEW_UPDATE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }

    },

    /*
    * Delete view
    * */
    deleteView: function (options) {
        return new Promise(async function (resolve, reject) {
            var viewId = options.viewId;
            var userId = options.userId;
            var updatedAt = options.updatedAt;

            try {
                var conn = await connection.getConnection();
                var isDeleted = await conn.query('IF (select 1 from Views where id=uuid_to_bin(?)) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "VIEW_NOT_FOUND", MYSQL_ERRNO = 4001;' +
                  'ELSEIF (select 1 from Views where id=uuid_to_bin(?) and updatedAt=?) is null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "VIEW_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED", MYSQL_ERRNO = 4002;' +
                  'ELSEIF (select 1 from Views where id=uuid_to_bin(?) and isDefault = 1) is not null then ' +
                  'SIGNAL SQLSTATE "45000" SET MESSAGE_TEXT = "CAN_NOT_DELETE_DEFAULT_VIEW", MYSQL_ERRNO = 4003;' +
                  'ELSE delete from Views where userId = uuid_to_bin(?) and id = uuid_to_bin(?);end if;'
                  , [viewId, viewId, updatedAt, viewId, userId, viewId]);
                isDeleted = Utils.isAffectedPool(isDeleted);
                debug('isDeleted', isDeleted);
                if (!isDeleted) {
                    throw err;
                }

                return resolve(Constants.OK_MESSAGE);

            } catch (err) {
                debug('err', err);
                if (err.errno === 4001) {
                    err = new Error(ErrorConfig.MESSAGE.VIEW_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                } else if (err.errno === 4002) {
                    err = new Error(ErrorConfig.MESSAGE.VIEW_WAS_UPDATED_SINCE_YOU_LAST_RETRIEVED);
                    err.status = ErrorConfig.STATUS_CODE.CONFLICT;
                    return reject(err);
                } else if (err.errno === 4003) {
                    err = new Error(ErrorConfig.MESSAGE.CAN_NOT_DELETE_DEFAULT_VIEW);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                } else {
                    err = new Error(ErrorConfig.MESSAGE.VIEW_DELETE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
            }
        });
    },

    /*
    * Delete view
    * */
    delete: async function (options, auditOptions, errorOptions, cb) {
        var userId = options.userId;
        var type = options.type;
        var viewId = options.id;
        var updatedAt = options.updatedAt;
        var err;

        if (DataUtils.isUndefined(viewId)) {
            err = new Error(ErrorConfig.MESSAGE.VIEW_ID_REQUIRED);
        } else if (DataUtils.isUndefined(type)) {
            err = new Error(ErrorConfig.MESSAGE.VIEW_TYPE_REQUIRED);
        } else if (DataUtils.isUndefined(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.VIEW_UPDATED_AT_REQUIRED);
        } else if (!DataUtils.isValidNumber(updatedAt)) {
            err = new Error(ErrorConfig.MESSAGE.INVALID_VIEW_UPDATED_AT);
        }
        if (err) {
            debug('err', err);
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
            // delete view columns
            var deleteOption = {
                userId: userId,
                viewId: viewId,
                updatedAt: updatedAt
            };
            var deleteResponse = await View.deleteViewColumn(deleteOption);
            debug('deleteResponse', deleteResponse);

            // delete views
            var deleteViewResponse = await View.deleteView(deleteOption);
            debug('deleteViewResponse', deleteViewResponse);

            AuditUtils.create(auditOptions);
            await conn.query('COMMIT;');
            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK;');
            await ErrorUtils.create(errorOptions, options, err);
            if (err.errno) {
                err = new Error(ErrorConfig.MESSAGE.VIEW_DELETE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    changeDB: async function (options, errorOptions, cb) {
        var userId = options.userId;
        var database = options.database;
        var isDefault = options.isDefault;
        var err;


        try {
            var conn = await connection.getConnection();
            if (isDefault) {
                userId = '00000000-0000-0000-0000-000000000000';
                database = 'ScopehubAppDB';
            }

            var query = 'select `host`,`user`,`password`,`port`,`database`,`connectionLimit`,`permitLocalInfile`,' +
              '`connectTimeout`,`compress`,`interactiveClient` from SystemDatabases where userId = uuid_to_bin(?) and ' +
              '`database`=?;';
            var response = await conn.query(query, [userId, database]);
            response = Utils.filteredResponsePool(response);
            debug('response', response);

            /*
            * Change the poolBE
            * */
            var newPoolBE = await connection.changePoolBE(response);
            debug('poolBE after', newPoolBE);


            return cb(null, response);
            /*pool.getConnection()
              .then(async function (conn) {
                  debug('234');
                  console.log('connected ! connection id is ' + conn);
                  await pool.query('select host,user,password,port,database,connectionLimit,permitLocalInfile,' +
                    'connectTimeout,compress,interactiveClient where userId = uuid_to_bin(?)', [userId])
                    .then(function (connectionDetail) {
                        debug('567');
                        connectionDetail = Utils.isAffectedPool(connectionDetail);
                        debug('connectionDetail', connectionDetail);
                        CONNECTION = connectionDetail;
                        debug('CONNECTION', CONNECTION);
                    });
                  conn.end();
                  debug('789');
                  return resolve(CONNECTION);
              }).catch(function (err) {
                debug('999');
                console.log('not connected due to error: ' + err);
            });*/
        } catch (err) {
            debug('err ', err);
            return cb(err);
        }
    }
};

module.exports = View;