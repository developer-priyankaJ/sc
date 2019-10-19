var _ = require('lodash');
var uuid = require('uuid/v4');
var {raw} = require('objection');
var debug = require('debug')('scopehub.lib.utils');
var Constants = require('../../data/constants');
var DataUtils = require('../../lib/data_utils');
var moment = require('moment');
//var knexfile = require('../../knexfile');
//var knex = require('knex')(knexfile);
var countLine = require('count-lines-in-file');
var PromiseBluebird = require('bluebird');
var fs = require('fs');

var Utils = {
    filter: function (data) {
        var result = [];
        data.forEach(value => {
            result.push(_(value).omitBy(_.isNull).omitBy(_.isNaN).value());
        });
        return result;
    },

    processRawResult: function (value) {
        if (_.isEmpty(value)) {
            return {};
        } else if (value.length <= 0) {
            return {};
        } else if (_.isEmpty(value[0].info)) {
            return {};
        }
        return value[0].info;
    },

    isAffected: function (value) {
        var info = this.processRawResult(value);
        if (_.isUndefined(info.affectedRows)) {
            return false;
        } else if (_.parseInt(info.affectedRows, 0) <= 0) {
            return false;
        }
        return true;
    },
    isAffectedPool: function (value) {
        if (_.isUndefined(value.affectedRows)) {
            return false;
        } else if (_.parseInt(value.affectedRows, 0) <= 0) {
            return false;
        }
        return true;
    },

    getAffectedRows: function (value) {
        var info = this.processRawResult(value);
        if (_.isUndefined(info.affectedRows)) {
            return 0;
        }
        return info.affectedRows;
    },

    getAffectedRowsPool: function (value) {
        if (_.isUndefined(value.affectedRows)) {
            return 0;
        }
        return value.affectedRows;
    },

    getInsertedId: function (value) {
        var info = this.processRawResult(value);
        if (_.isUndefined(info.insertId)) {
            return false;
        }
        return info.insertId;
    },

    toBoolean: function (value) {
        if (value === '0' || value === '1' || value === 'true' || value === 'false') {
            return Boolean(parseInt(value));
        }

        return value;
    },

    toNumber: function (value) {
        if (value === true) {
            return 1;
        }
        return 0;
    },

    generateId: function () {
        var id = uuid();
        //var binaryId = raw('uuid_to_bin( "' + id + '" )');
        var obj = {
            uuid: id
            //binaryId: binaryId
        };
        return obj;
    },

    filteredResponse: function (value) {
        if (_.isEmpty(value)) {
            return {};
        }
        var length = value[0].length;
        if (length > 1) {
            return (value[0]);
        }
        return (value[0][0]);
    },
    filteredResponsePool: function (value) {
        if (_.isEmpty(value)) {
            return;
        }
        value = Object.assign({}, value);
        return value[0];
    },
    filteredBufferResponse: function (keys, value) {

        if (!DataUtils.isArray(value)) {
            value = [value];
        }

        _.each(keys, function (key) {
            _.map(value, function (pmp) {
                var temp = Object.keys(pmp);
                if (temp.indexOf(key) !== -1) {
                    pmp[key] = pmp[key].toString();
                }
            });
        });
        /*_.map(value, function (pmp) {
            pmp.id = pmp.id.toString();
        });*/
        return (value);
    },

    getDataArray: function (value) {
        if (_.isEmpty(value)) {
            return [];
        }
        return value[0];
    },

    getLineCount: function (filePath) {
        return new Promise(function (resolve, reject) {
            var totalLine;
            countLine(filePath, function (err, number) {
                totalLine = number;
                return resolve(totalLine);
            });
        });
    },

    convertMutable: function (value) {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (err) {
            return value;
        }
    },

    getMaxId: function (value) {
        if (!value) {
            return;
        }
        var ids = value.toString().split('\n');
        ids = _.map(ids, function (data) {
            var index = ids.indexOf(data);
            return parseInt(data);
        });
        if (ids[ids.length - 1].toString() === 'NaN') {
            ids.pop();
        }
        var maxId = Math.max.apply(null, ids);
        return maxId;
    },

    trimFileDelimeter: function (str) {
        if (!str) {
            return str;
        }
        var string = str.toString();
        if (string.toString().charAt(0) === '"' && string.toString().charAt(string.toString().length - 1) === '"') {
            return string.slice(1, -1);
        }
        if (string.toString().charAt(0) === '"') {
            return string.toString().slice(1, string.toString().length - 1);
        }
        if (string.toString().charAt(string.length - 1) === '"') {
            return string.toString().slice(0, string.toString().length - 2);
        }
        return string;
    },

    phoneEndingWith: function (value) {
        if (value.length < 6) {
            return value;
        }
        var phoneLength = value.length - 5;
        var primaryPhoneEndingWith = Constants.NUMBER_START_WITH[phoneLength] + value.substr(value.length - 5);
        return primaryPhoneEndingWith;
    },

    getTimestamp: function () {
        return new Date().getTime();
    },

    filterUpdatedAt: function (value) {
        return moment(value[0][0].updatedAt).format('YYYY-MM-DD HH:mm:ss.SSS');
    },
    filterCreatedAt: function (value) {
        return moment(value[0][0].createdAt).format('YYYY-MM-DD HH:mm:ss.SSS');
    },

    /*
    *  Convert object into flat array for multiple insert
    * */
    populateArrayMD: function (object) {
        if (!object) {
            return [];
        }
        var keys = Object.keys(object);
        var values = Object.values(object);
        var response = {
            keys: keys,
            values: values
        };
        return response;
    },
    /*
   *  Convert object into array
   * */
    convertObjectToArrayMD: async function (list, cb) {

        var temp = [], c = 1;
        var response, keys, populatedArray, tempArray = [];
        if (list.length <= 0) {
            return [];
        }
        await PromiseBluebird.each(list, async function (order) {
            populatedArray = await Utils.populateArrayMD(order);
            tempArray = tempArray.concat(populatedArray.values);

            keys = populatedArray.keys;
        });
        response = {
            list: tempArray,
            keys: keys
        };
        return cb(null, response);
    },

    /*
    * Get query for empty row accoring to column Number
    * */
    getEmptyRowQuery: function (columnNumber) {
        var query = 'SELECT COUNT(*) FROM S3Object where _' + columnNumber + '=\'\'';
        return query;
    },

    /*
    * Get query for get Min length of column
    * */
    getMinimumLengthQuery: function (columnNumber, minLength) {
        var query = 'SELECT COUNT(*) FROM S3Object where CHAR_LENGTH(_' + columnNumber + ') < ' + minLength + ' AND CHAR_LENGTH(_' + columnNumber + ') > 0;';
        return query;
    },

    /*
    * Get query for get Min length of column
    * */
    getMaximumLengthQuery: function (columnNumber, maxLength) {
        var query = 'SELECT COUNT(*) FROM S3Object where CHAR_LENGTH(_' + columnNumber + ') > ' + maxLength + ' ;';
        return query;
    },

    /*
    * Remove last line
    * */
    removeLastLine: function (string) {
        string = string.substring(0, string.lastIndexOf('\n'));
        string = string.substring(0, string.lastIndexOf('\n'));
        return string;
    },

    /*
    * GET NUMBER OF COLUMN
    * */
    getNumberOfColumn: function (string) {
        string = string.substring(0, string.indexOf('\n'));
        var length = (string.match(/,/g) || []).length;
        return length;
    },

    wait: function (minutes) {
        return new Promise(function (resolve, reject) {
            setTimeout(resolve, (minutes * 60000));
        });
    },

    /*
    * Create random color code
    * */
    generateRandomColorCode: function () {
        var letters = '0123456789ABCDEF';
        var color = '#';
        _.times(6, function () {
            color += letters[Math.floor(Math.random() * 16)];
        });
        return color;
    }
};

module.exports = Utils;
