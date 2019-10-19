'use strict';
/*jslint node: true */
var debug = require('debug')('scopehub.lib.fast_csv_utils');

var FastCsvUtils = {
    writeToFile: function (csvStream, data, cb) {
        data.forEach(function (record) {
            csvStream.write(record);
        });
        csvStream.end();
        return cb();
    }
};

module.exports = FastCsvUtils;


(function () {
    if (require.main === module) {

    }
}());