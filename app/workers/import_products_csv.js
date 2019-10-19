/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.workers.import_products_csv');
var csv = require('fast-csv');
var path = require('path');
var fs = require('fs');
var Async = require('async');
var _ = require('lodash');
var ProductReferenceModel = require('../model/product_reference');
var ErrorConfig = require('../data/error');
var DataUtils = require('../lib/data_utils');
var S3Utils = require('../lib/s3_utils');
var Constants = require('../data/constants');

module.exports = function importProducts(data, cb) {
    if (!data) {
        return cb();
    }
    var products = [];
    var productsStore = [];
    Async.series({
        importProductsFromCsv: function (cbL1) {
            var stream = fs.createReadStream(data.fileName.path);
            csv.fromStream(stream, {headers: true}).on('data', function (data) {
                products.push(data);
            }).on('end', function () {
                debug('done');
                return cbL1(null, products);
            });
        },
        uploadFileOnS3: function (cbL1) {
            var originalFileName = data.fileName.originalFilename;
            var type = data.fileName.headers['content-type'];
            var destination = data.user.accountId;
            var filePath = data.fileName.path;
            S3Utils.getObject(data.user.accountId + '/', Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET, function (err, data) {
                if (err) {
                    debug('err', err);
                }
                if (data) {
                    fs.readFile(filePath, function (err, data) {
                        if (err) {
                            debug('err', err);
                        }
                        var buffer = new Buffer(data, 'binary');
                        S3Utils.putObject(buffer, originalFileName, type, destination, Constants.SCOPEHUB_ACCOUNTS_S3_BUCKET, '', function (err, file) {
                            if (err) {
                                debug('err', err);
                            }
                            return cbL1(null, file);
                        });
                    });
                }
            });
        },
        storeProducts: function (cbL1) {
            if (_.isEmpty(products)) {
                return cbL1();
            }
            Async.forEachOfSeries(products, function (product, key, cbL2) {

                var productReferenceOptions = {
                    sku: product.sku,
                    sellerSKUName: product.sellerSKUName,
                    sellerSKUAlias: product.sellerSKUAlias,
                    GCID: product.GCID,
                    UPC: product.UPC,
                    EAN: product.EAN,
                    ISBN: product.ISBN,
                    JAN: product.JAN,
                    barcode: product.barcode,
                    articleNo: product.articleNo,
                    modelNumber: product.modelNumber,
                    type: product.type,
                    tags: product.tags,
                    brand: product.brand,
                    weightAmount: product.weightAmount,
                    weightUoM: product.weightUoM,
                    heightAmount: product.heightAmount,
                    heightUoM: product.heightUoM,
                    lengthAmount: product.lengthAmount,
                    lenghtUoM: product.lenghtUoM,
                    depthAmount: product.depthAmount,
                    depthUoM: product.depthUoM,
                    diameterAmount: product.diameterAmount,
                    diameterUoM: product.diameterUoM,
                    volumeAmount: product.volumeAmount,
                    volumeUoM: product.volumeUoM,
                    averageRetailPrice: product.averageRetailPrice,
                    retailPriceUoM: product.retailPriceUoM,
                    averageCost: product.averageCost,
                    costUoM: product.costUoM,
                    wholesalePrice: product.wholesalePrice,
                    wholesalePriceUom: product.wholesalePriceUom,
                    declaredValue: product.declaredValue,
                    declaredValueUoM: product.declaredValueUoM,
                    harmonizedCode: product.harmonizedCode,
                    countryOfManufacture: product.countryOfManufacture,
                    supplierAccountId: product.supplierAccountId,
                    supplierProductId: product.supplierProductId,
                    supplierSKU: product.supplierSKU,
                    supplierSKUName: product.supplierSKUName,
                    supplierProductBarcode: product.supplierProductBarcode,
                    createdBy: product.createdBy,
                    accountId: product.accountId,
                    productId: product.productId,
                    MPCategoryId1: product.MPCategoryId1,
                    MPCategoryId2: product.MPCategoryId2,
                    MPRank1: product.MPRank1,
                    MPRank2: product.MPRank2,
                    imageUrl: product.imageUrl,
                    imageHeight: product.imageHeight,
                    imageHeightUoM: product.imageHeightUoM,
                    imageWidth: product.imageWidth,
                    imageWidthUoM: product.imageWidthUoM,
                    price: product.price
                };
                productReferenceOptions.MPProductId = {};
                if (!_.isEmpty(product.MPProductId)) {
                    productReferenceOptions.MPProductId = JSON.parse(product.MPProductId);
                }
                productReferenceOptions = DataUtils.cleanParams(productReferenceOptions);
                productsStore.push(productReferenceOptions);
                return cbL2(null, productsStore);
            }, function (error) {
                if (error) {
                    debug('error:%o ', error);
                    return cbL1();
                }
                return cbL1();
            });
        },
        insertProductReferences: function (cbL1) {
            var params = {
                overwrite: true
            };
            ProductReferenceModel.create(productsStore, params, function (err, productReference) {
                if (err || !productReference) {
                    debug(err || 'Failed to create productReference');
                    err = new Error(ErrorConfig.MESSAGE.PRODUCT_REFERENCE_CREATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                    return cbL1(err);
                }
                return cbL1(null, productReference.attrs);
            });
        }
    }, function (error) {
        if (error) {
            debug('error:%o ', error);
            return cb();
        }
        return cb();
    });
};