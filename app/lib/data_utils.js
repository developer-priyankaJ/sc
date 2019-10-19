'use strict';
/*jslint node: true */

var Crypto = require('crypto');
var SHA384 = require('crypto-js/sha384');
var Util = require('util');
var _ = require('lodash');

function addZero(i) {
    if (i < 10) {
        i = '0' + i;
    }
    return i;
}

var DataUtils = {
    isValidateOptionalField: function (value) {
        return value === undefined;
    },
    isDate: function (value) {
        if (Date.parse(value).toString() === 'NaN') {
            return false;
        }
        return true;
    },
    isDefined: function (value) {
        return value !== undefined && value != 'undefined' && value !== null && value.toString().trim().length > 0;
    },

    isUndefined: function (value) {
        return !DataUtils.isDefined(value);
    },

    isString: function (value) {
        return typeof value === 'string';
    },

    isNumber: function (value) {
        return typeof value === 'number';
    },

    isBoolean: function (value) {
        return typeof value === 'boolean';
    },

    isMobile: function (value) {
        value = Number(value);
        if (value.toString() === 'NaN') {
            return false;
        }
        return true;
    },

    isValidNumber: function (value) {
        value = Number(value);
        if (value.toString() === 'NaN') {
            return false;
        }
        return true;
    },

    isArray: function (value) {
        return Util.isArray(value);
    },

    isObject: function (value) {
        return Util.isObject(value);
    },

    isValidEmail: function (value) {
        var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(value);
    },

    isInvalidEmail: function (value) {
        return DataUtils.isUndefined(value) || !DataUtils.isValidEmail(value);
    },

    generateRandomInt: function (low, high) {
        return Math.floor(Math.random() * (high - low) + low);
    },

    getSha1: function (value) {
        var shaSum = Crypto.createHash('sha1');
        shaSum.update(value);
        return shaSum.digest('hex');
    },

    getSha384: function (value) {
        return SHA384(value);
    },

    getSalt: function () {
        return Crypto.randomBytes(16).toString('hex');
    },

    getHash: function (value, salt) {
        return Crypto.pbkdf2Sync(value, salt, 1000, 64).toString('hex');
    },

    verifyPassword: function (hash, salt, password) {
        var calculatedHash = Crypto.pbkdf2Sync(password, salt, 1000, 64).toString('hex');
        return hash == calculatedHash;
    },

    getCurrentTimestamp: function () {
        var date = new Date();
        return date.getTime();
    },

    getCurrentTimestampInSeconds: function () {
        return DataUtils.getCurrentTimestamp() / 1000;
    },

    getTimestamp: function (date) {
        return date.getTime();
    },

    getEpochMSTimestamp: function () {
        return new Date().getTime();
    },

    getTimestampInSeconds: function (date) {
        return DataUtils.getTimestamp(date) / 1000;
    },

    getCurrentUtcDateString: function () {
        var date = new Date();
        return date.toUTCString();
    },
    getDays: function (freqDay) {
        if (freqDay === 'sunday') {
            freqDay = 1;
        } else if (freqDay === 'monday') {
            freqDay = 2;
        } else if (freqDay === 'tuesday') {
            freqDay = 3;
        } else if (freqDay === 'wednesday') {
            freqDay = 4;
        } else if (freqDay === 'thursday') {
            freqDay = 5;
        } else if (freqDay === 'friday') {
            freqDay = 6;
        } else if (freqDay === 'saturday') {
            freqDay = 7;
        }
        return freqDay;
    },
    formatDate: function (date) {
        var year = date.getUTCFullYear(),
          month = addZero(date.getUTCMonth() + 1), // months are zero indexed
          day = addZero(date.getUTCDate()),
          hour = date.getUTCHours(),
          minute = addZero(date.getUTCMinutes()),
          second = addZero(date.getUTCSeconds()),
          hourFormatted = addZero(hour % 12 || 12), // hour returned in 24 hour format
          minuteFormatted = addZero(minute),
          morning = hour < 12 ? 'AM' : 'PM';

        return month + '/' + day + '/' + year + ' ' + hourFormatted + ':' +
          minuteFormatted + ' ' + morning;
    },
    /*getFreqTime: function (freqType) {

    },*/

    toLowerCase: function (value) {
        return value && value.toLowerCase();
    },

    parseBoolean: function (value) {
        try {
            return JSON.parse(value);
        } catch (e) {
            return null;
        }
    },

    cleanParams: function (data) {
        var newDocument = {};
        newDocument['isHaveValue'] = false;
        _.each(data, function (value, key) {
            if (!_.isString(value)) {
                newDocument[key] = value;
            } else if (!_.isEmpty(value)) {
                newDocument['isHaveValue'] = true;
                newDocument[key] = value;
            }
        });
        return newDocument;
    },

    replaceKey: function (existingKey, newKey, data) {

        if (DataUtils.isUndefined(existingKey) || DataUtils.isUndefined(newKey)) {
            return false;
        }
        if (DataUtils.isArray(data)) {
            var arr = [];
            for (var i = 0; i < data.length; i++) {
                var obj = data[i];
                obj[newKey] = obj[existingKey];
                delete obj[existingKey];
                arr.push(obj);
            }
            return arr;
        }
        if (DataUtils.isObject(data)) {
            data[newKey] = data[existingKey];
            delete data[existingKey];
            return data;
        }
        return false;
    },

    isUniqueArray: function (arrayList) {
        if (!DataUtils.isArray(arrayList)) {
            return false;
        }
        for (var i = 0; i < arrayList.length; i++) {
            if (arrayList.indexOf(arrayList[i]) !== i) {
                return false;
            }
        }
        return true;

    }

};

module.exports = DataUtils;

(function () {
    if (require.main === module) {
        console.log(DataUtils.isDefined('     '));
        console.log(DataUtils.getSha1('abcd'));
    }
}());
