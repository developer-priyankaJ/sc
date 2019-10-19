'use strict';

let mwsSdk = require('mws-sdk-promises');
let fs = require('fs');
let _ = require('lodash');

let readline = require('readline');
let stream = require('stream');
let MarletplaceLog = require('../../../lib/marketplace_utils');
let OrdersLog = require('../../../lib/orders_utils');

module.exports = class MWS {

    /**
     * Constructor for the main MWS class
     *
     * @param {Object}
     *            params All parameters required to connect to mws and
     *            additional configuration options
     */

    constructor(params) {

        this.accountId = params.accountId;
        this.userId = params.userId;
        this.options = params.options || {};
        this.accessKeyId = params.accessKeyId || null;
        this.secretAccessKey = params.secretAccessKey || null;
        this.merchantId = params.merchantId || null;
        this.authToken = params.authToken;
        this.platform = 'MWS';
        if (params.authToken != undefined)
            this.options.authToken = params.authToken;

        this.marketplaceId = params.marketplaceId || 'ATVPDKIKX0DER';
        this.columnNames = [];

        if (this.secretAccessKey == null || this.accessKeyId == null || this.merchantId == null) {
            throw 'accessKeyId, secretAccessKey, and merchantId required';
        }
        this.client = new mwsSdk.Client(this.accessKeyId, this.secretAccessKey, this.merchantId, this.options);
    }


    /**
     * Method to get product detail for given ASINList
     *
     * @param {Array}
     *            ASINList List of ASIN
     *
     * @return {Array} Array of Products return from MWS.
     */
    getProductDetail(ASINList) {
        let req = mwsSdk.Products.requests.GetMatchingProduct();
        let params = {MarketplaceId: this.marketplaceId, ASINList: ASINList};
        req.set(params);
        this.logTransaction('GetMatchingProduct', params, 'REQUEST', {}, '', {});

        return this.client.invoke(req).then((data) => {

            if (data.ErrorResponse) {
                throw data.ErrorResponse;
                return;
            }
            this.logTransaction('GetMatchingProduct', {}, 'RESPONSE', JSON.stringify(data), this.getRequestId(data), data);
            return data;
        }).catch((error) => {
            this.logTransaction('RequestReport', {}, 'RESPONSE', JSON.stringify(error), this.getRequestId(error), error);
            throw error;
        });
    }

    /**
     * Method to Manage  report schedule
     *
     *
     * @return {Object} Object of requested report.
     */
    manageReportSchedule(reportType, schedule) {
        let req = mwsSdk.Reports.requests.ManageReportSchedule();
        let params = {ReportType: reportType, Schedule: schedule};
        req.set(params);
        this.logTransaction('ManageReportSchedule', params, 'REQUEST', {}, '', {});
        return this.client.invoke(req).then((data) => {
            if (data.ErrorResponse) {
                throw data.ErrorResponse;
                return;
            }
            this.logTransaction('ManageReportSchedule', {}, 'RESPONSE', JSON.stringify(data), this.getRequestId(data), data);
            return data;
        }).catch((error) => {
            this.logTransaction('ManageReportSchedule', {}, 'RESPONSE', JSON.stringify(error), this.getRequestId(error), error);
            throw error;
        });
    }

    /**
     * Method to request updated inventory
     *
     *
     * @return {Object} Object of requested report.
     */
    reportRequest(reportType) {
        let req = mwsSdk.Reports.requests.RequestReport();
        let params = {ReportType: reportType};
        req.set(params);
        this.logTransaction('RequestReport', params, 'REQUEST', {}, '', {});
        return this.client.invoke(req).then((data) => {
            if (data.ErrorResponse) {
                throw data.ErrorResponse;
                return;
            }
            this.logTransaction('RequestReport', {}, 'RESPONSE', JSON.stringify(data), this.getRequestId(data), data);
            return data;
        }).catch((error) => {
            this.logTransaction('RequestReport', {}, 'RESPONSE', JSON.stringify(error), this.getRequestId(error), error);
            throw error;
        });
    }

    /**
     * Method to list requested report
     *
     *
     * @return {Object} Object of requested report.
     */
    reportRequestList(reportType, reportId) {
        let params = {};
        if (reportType) {
            params['ReportTypeList'] = reportType;
        }
        if (reportId) {
            params['ReportRequestIdList'] = reportId;
        }

        let req = mwsSdk.Reports.requests.GetReportRequestList();
        req.set(params);
        this.logTransaction('GetReportRequestList', params, 'REQUEST', {}, '', {});
        return this.client.invoke(req).then((data) => {
            this.logTransaction('GetReportRequestList', {}, 'RESPONSE', JSON.stringify(data), this.getRequestId(data), data);
            if (data.ErrorResponse) {
                throw data.ErrorResponse;
                return;
            }
            return data;
        }).catch((error) => {
            this.logTransaction('GetReportRequestList', {}, 'RESPONSE', JSON.stringify(error), this.getRequestId(error), error);
            throw error;
        });
    }

    /**
     * Method to get available order
     *
     *
     * @return {Array} Array of order return from MWS.
     */
    getOrder(options) {
        var reportListParams = {
            reportTypeList: '_GET_FLAT_FILE_ORDERS_DATA_'
        };
        if (options.availableFromDate !== undefined) {
            reportListParams['availableFromDate'] = new Date(options.availableFromDate);
        }
        return this.GetReportId(reportListParams).then((reportId) => {
            let req = mwsSdk.Reports.requests.GetReport();
            let params = {ReportId: reportId};
            req.set(params);
            this.logTransaction('GetReport', params, 'REQUEST', {}, null, {});
            return this.client.invoke(req).then((data) => {
                if (data.ErrorResponse) {
                    throw data.ErrorResponse;
                    return;
                }
                console.log('data', data);
                this.logTransaction('GetReport', {}, 'RESPONSE', JSON.stringify(data), this.getRequestId(data), data);
                return this.parseToJson(data);
            }).catch((error) => {
                this.logTransaction('GetReport', {}, 'RESPONSE', JSON.stringify(error), this.getRequestId(error), error);
                throw error;
            });
        }).catch((error) => {
            throw error;
        });
    }

    /**
     * Method to get available inventory
     *
     *
     * @return {Array} Array of Product Inventory return from MWS.
     */
    getInventory() {
        var reportListParams = {
            reportTypeList: '_GET_FLAT_FILE_OPEN_LISTINGS_DATA_'
        };
        return this.GetReportId(reportListParams).then((reportId) => {
            let req = mwsSdk.Reports.requests.GetReport();
            let params = {ReportId: reportId};
            req.set(params);
            this.logTransaction('GetReport', params, 'REQUEST', {}, null, {});
            return this.client.invoke(req).then((data) => {
                if (data.ErrorResponse) {
                    throw data.ErrorResponse;
                    return;
                }
                console.log('data', data);
                this.logTransaction('GetReport', {}, 'RESPONSE', JSON.stringify(data), this.getRequestId(data), data);
                return this.parseToJson(data);
            }).catch((error) => {
                this.logTransaction('GetReport', {}, 'RESPONSE', JSON.stringify(error), this.getRequestId(error), error);
                throw error;
            });
        }).catch((error) => {
            throw error;
        });
    }

    GetReportId(reportListParams) {
        let params = {};
        if (reportListParams) {
            if (reportListParams.reportTypeList) {
                params['ReportTypeList'] = reportListParams.reportTypeList;
            }
            if (reportListParams.availableFromDate) {
                params['AvailableFromDate'] = reportListParams.availableFromDate;
            }
        }
        var req = mwsSdk.Reports.requests.GetReportList();
        req.set(params);
        this.logTransaction('GetReportList', params, 'REQUEST', {}, '', {});
        return this.client.invoke(req).catch((error) => {
            this.logTransaction('GetReportList', {}, 'RESPONSE', JSON.stringify(error), this.getRequestId(error), error);
            return null;
        }).then((RESULT) => {

            if (RESULT.ErrorResponse) {
                throw RESULT.ErrorResponse;
            }

            this.logTransaction('GetReportList', {}, 'RESPONSE', JSON.stringify(RESULT), this.getRequestId(RESULT), RESULT);
            var reports = RESULT.GetReportListResponse.GetReportListResult[0].ReportInfo;
            var report = _.find(reports, function (item) {
                if (item.ReportType.indexOf(reportListParams.reportTypeList) >= 0) {
                    return true;
                }
            });
            return report.ReportId[0];
        });
    }

    ListParticipations() {
        // ListParticipations
        let req = mwsSdk.Sellers.requests.ListMarketplaceParticipations();
        this.logTransaction('ListMarketplaceParticipations', {}, 'REQUEST', {}, '', {});
        return this.client.invoke(req).then((data) => {
            if (data.ErrorResponse) {
                throw data.ErrorResponse;
                return;
            }
            this.logTransaction('ListMarketplaceParticipations', {}, 'RESPONSE', JSON.stringify(data), this.getRequestId(data), data);
            var participations = data.ListMarketplaceParticipationsResponse.ListMarketplaceParticipationsResult[0].ListParticipations;
            var places = data.ListMarketplaceParticipationsResponse.ListMarketplaceParticipationsResult[0].ListMarketplaces;
            return {participations: participations, marketplaces: places};
        }).catch((error) => {
            throw error;
        });
    }


    parseToJson(stringData) {
        return new Promise((resolve, reject) => {

            let buf = new Buffer(stringData);
            let bufferStream = new stream.PassThrough();

            bufferStream.end(buf);

            let lineReader = readline.createInterface({
                input: bufferStream,
            });

            let isHeader = false;
            this.columnNames = [];

            let json = {};
            json['data'] = [];

            lineReader.on('line', (line) => {
                if (!isHeader) {
                    this.columnNames = this.parseLine(line);
                    isHeader = true;
                } else {
                    json['data'].push(this.createRowObject(this.parseLine(line)));
                }
            });

            lineReader.on('close', function () {
                resolve(json);
            });
        });
    }

    parseLine(line) {

        return line.trim().split('\t');
    }

    createRowObject(values) {
        var rowObject = {};
        this.columnNames.forEach((value, index) => {
            rowObject[value] = values[index];
        });
        if (Object.keys(rowObject).length > 0) {
            rowObject['id'] = {'ASIN': rowObject.asin};
        }
        return rowObject;
    }

    logTransaction(endpoint, params, type, response, requestId, metaData) {
        var option = {
            userId: this.userId,
            requestType: type,
            endpoint: endpoint,
            params: (JSON.stringify(params) || ''),
            metaData: metaData,
            accountId: this.accountId,
            platform: this.platform,
            marketplace: this.marketplaceId,
            merchantId: this.merchantId
        };
        if (requestId) {
            option['requestId'] = requestId;
        }
        MarletplaceLog.log(option);
    }

    orderLogTransaction(endpoint, params, type, response, requestId, metaData, orderId) {
        return new Promise(function (resolve, reject) {
            try {
                var option = {
                    userId: this.userId,
                    requestType: type,
                    endpoint: endpoint,
                    params: (JSON.stringify(params) || ''),
                    metaData: metaData,
                    accountId: this.accountId,
                    platform: this.platform,
                    marketplace: this.marketplaceId,
                    merchantId: this.merchantId,
                    orderId: orderId
                };
                if (requestId) {
                    option['requestId'] = requestId;
                }
                OrdersLog.logMD(option, function (err, response) {
                    if (err) {
                        console.log('err', err);
                        return reject(err);
                    }
                    return resolve(response);
                });
            } catch (err) {
                console.log('err', err);
                return reject(err);
            }
        });

    }

    getRequestId(data) {
        var keys = Object.keys(data);
        var requestId;
        if (typeof data === 'object' && keys.length > 0) {
            var response = undefined;
            if (data.hasOwnProperty(keys[0]))
                response = data[keys[0]];
            if (response == undefined)
                requestId = 'dummy-id';
            else {
                requestId = (response['ResponseMetadata'][0].RequestId.toString() || 'dummy-id');
            }
        } else {
            requestId = 'dummy-id';
        }
        return requestId;
    }


};