/* jslint node: true */
'use strict';

var express = require('express');
var device = require('express-device');
var router = express.Router();
var session = require('express-session');
var redisStore = require('connect-redis')(session);
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var xFrameOptions = require('x-frame-options');
var userAgent = require('express-useragent');

var sessionConfig = require('./config/session');
var secretConfig = require('./config/secret');
//var dynamic_connection_util = require('./lib/dynamic_connection_utils');
var connection_util = require('./lib/connection_util');
var routes = require('./routes');
var Common = require('./routes/common');
var Error = require('./routes/error');
var app = express();
var i18n = require('i18n');
//Set globals
global.ROOT_PATH = __dirname;

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
//require('./model/permission');
app.use(logger('dev'));

app.use(device.capture({
    parseUserAgent: true
}));

i18n.configure({
    locales: ['en', 'de', 'ko'],
    directory: __dirname + '/api/locales',
    updateFiles: false,
    objectNotation: true
});

app.use(bodyParser.json({limit: '2gb'}));
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(cookieParser(secretConfig.SECURE_COOKIE_SECRET));
app.use(require('./routes/lib/corsheaders'));
app.use(session({
    key: 'sh.sid',
    store: new redisStore({
        host: sessionConfig.host,
        port: sessionConfig.port,
        ttl: 2 * 24 * 60 * 60 //in secs
    }),
    secret: secretConfig.REDIS_SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        domain: sessionConfig.domain,
        maxAge: 15 * 60 * 1000 // 15 Minutes
        //httpOnly: true,
        //secure: true,
        //hostOnly: true
    }
}));

//app.use(dynamic_connection_util.fetchConnectionCredential);
app.use(connection_util.startConnection);
app.use(xFrameOptions());
app.use(userAgent.express());
app.options('*', function (req, res) {
    res.sendStatus(200);
});
app.use(router);
require('./routes/frontend')(app);
app.use('/api', routes);
app.use(connection_util.closeConnection);
app.use(Common.sendJSON);
app.use(Error);

app.use(function (req, res, next) {
    res.sendStatus(404);
});

module.exports = app;