'use strict';


var debug = require('debug')('scopehub.api.unit_of_measure');
var _ = require('lodash');
var DataUtils = require('../lib/data_utils');
var ErrorConfig = require('../data/error');
var UnitOfMeasureModel = require('../model/unit_of_measure');
var Constants = require('../data/constants');
var AuditUtils = require('../lib/audit_utils');


var UnitOfMeasure = {
}

module.exports = UnitOfMeasure;
