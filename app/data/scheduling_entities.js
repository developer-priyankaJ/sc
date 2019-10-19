var EndpointConfig = require('../config/endpoints');
module.exports = {
    FINANCE: {
        value: 'FINANCE',
        url: 'http://www.google.com',
        method: 'POST'
    }, INVENTORY: {
        value: 'INVENTORY',
        url: 'http://www.google.com',
        method: 'POST'
    }, PRODUCT: {
        value: 'PRODUCT',
        url: 'http://www.google.com',
        method: 'POST'
    }, ORDER: {
        value: 'ORDER',
        url: 'http://www.google.com',
        method: 'POST'
    }, LIST_PRODUCT: {
        value: 'LIST_PRODUCT',
        //url: 'http://127.0.0.1:3000/api/product/submitfeed-report',
        url: EndpointConfig.API_ENDPOINT + '/product/submitfeed-report',
        method: 'PUT'
    }, LIST_ORDER: {
        value: 'LIST_ORDER',
        //url: EndpointConfig.API_ENDPOINT + '/order',
        url: 'http://127.0.0.1:3000/api/order',
        method: 'GET'
    }
};