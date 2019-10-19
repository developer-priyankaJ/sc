/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.workers.export_products_csv');
var fastCsv = require('fast-csv');
var path = require('path');
var fs = require('fs');
var Async = require('async');
var _ = require('lodash');
var DataUtils = require('../lib/data_utils');
var FastCsvUtils = require('../lib/fast_csv_utils');

module.exports = function exportProducts(data, cb) {
    var fileName;
    var writableStream;

    /////file path to store products csv
    var productDirName = '..' + path.sep + 'public' + path.sep + 'products';
    productDirName = path.resolve(__dirname, productDirName);
    if (fs.existsSync(productDirName) === false) {
        fs.mkdir(productDirName);
    }

    Async.series({
        exportProductsToCsv: function (cbL1) {
            var csvFileData = data.products;
            var csvStream = fastCsv.createWriteStream({
                headers: true,
                transform: function (row) {
                    try {
                        return {
                            'productId': row.productId,
                            'sku': row.sku,
                            'sellerSKUName': row.sellerSKUName,
                            'sellerSKUAlias': row.sellerSKUAlias,
                            'GCID': row.GCID,
                            'UPC': row.UPC,
                            'EAN': row.EAN,
                            'type': row.type,
                            'price': row.price,
                            'MPProductId': JSON.stringify(row.MPProductId),
                            'accountId': row.accountId,
                            'createdBy': row.createdBy,
                            'JAN': row.JAN,
                            'barcode': row.barcode,
                            'articleNo': row.articleNo,
                            'modelNumber': row.modelNumber,
                            'tags': row.tags,
                            'brand': row.brand,
                            'weightAmount': row.weightAmount,
                            'weightUoM': row.weightUoM,
                            'heightAmount': row.heightAmount,
                            'heightUoM': row.heightUoM,
                            'lengthAmount': row.lengthAmount,
                            'lenghtUoM': row.lenghtUoM,
                            'depthAmount': row.depthAmount,
                            'depthUoM': row.depthUoM,
                            'diameterAmount': row.diameterAmount,
                            'diameterUoM': row.diameterUoM,
                            'volumeAmount': row.volumeAmount,
                            'volumeUoM': row.volumeUoM,
                            'averageRetailPrice': row.averageRetailPrice,
                            'retailPriceUoM': row.retailPriceUoM,
                            'averageCost': row.averageCost,
                            'costUoM': row.costUoM,
                            'wholesalePrice': row.wholesalePrice,
                            'wholesalePriceUom': row.wholesalePriceUom,
                            'declaredValue': row.declaredValue,
                            'declaredValueUoM': row.declaredValueUoM,
                            'harmonizedCode': row.harmonizedCode,
                            'countryOfManufacture': row.countryOfManufacture,
                            'supplierAccountId': row.supplierAccountId,
                            'supplierProductId': row.supplierProductId,
                            'supplierSKU': row.supplierSKU,
                            'supplierSKUName': row.supplierSKUName,
                            'supplierProductBarcode': row.supplierProductBarcode,
                            'MPCategoryId1': row.MPCategoryId1,
                            'MPCategoryId2': row.MPCategoryId2,
                            'MPRank1': row.MPRank1,
                            'MPRank2': row.MPRank2,
                            'imageUrl': row.imageUrl,
                            'imageHeight': row.imageHeight,
                            'imageHeightUoM': row.imageHeightUoM,
                            'imageWidth': row.imageWidth,
                            'imageWidthUoM': row.imageWidthUoM
                        };
                    } catch (Exception) {
                        debug('CSV row add error exception', Exception);
                    }
                }
            });
            fileName = 'Product' + '-' + DataUtils.getCurrentTimestamp() + '.csv';
            writableStream = fs.createWriteStream(productDirName + path.sep + fileName);

            writableStream.on('finish', function () {
                return cbL1(null);
            });
            FastCsvUtils.writeToFile(csvStream, csvFileData);
            csvStream.pipe(writableStream);
        }
    }, function (error) {
        if (error) {
            debug('error:%o ', error);
            return cb();
        }
        return cb();
    });
};