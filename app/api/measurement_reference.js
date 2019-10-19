/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.api.measurement_reference');
var _ = require('lodash');
var Util = require('util');

var DataUtils = require('../lib/data_utils');
var Constants = require('../data/constants');
var ErrorConfig = require('../data/error');
var MeasurementReferenceModel = require('../model/measurement_reference');
var AuditUtils = require('../lib/audit_utils');

var MeasurementReference = {

};

module.exports = MeasurementReference;