#!/usr/bin/env node

'use strict';

var debug = require('debug')('scopehub.route.measurement_reference');
var HeaderUtils = require('../lib/header_utils');
var MeasurementReferenceApi = require('../api/measurement_reference');
var ErrorConfig = require('../data/error');
var Constants = require('../data/constants');
var Events = require('../data/events');

var MeasurementReference = {

};

module.exports = MeasurementReference;

(function () {
    if (require.main == module) {

    }
}());