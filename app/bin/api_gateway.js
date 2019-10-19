/* jslint node: true */
'use strict';

var Async = require('async');
var Path = require('path');
var FS = require('fs');
var Util = require('util');

var ApiGateway = require('../model/api_gateway');
var METHODS = 'methods';
var AWS_IAM = 'AWS_IAM';
var HTTP_METHOD = 'HTTP_PROXY';
var PASS_THROUGH_BEHAVIOUR = 'WHEN_NO_MATCH';
var BASE_DOMAIN = 'https://test-be.scopehub.org/api';
var STATUS_CODE = {
    200: '200'
};

var Gateway = {

    init: function(options, cb) {
        Async.waterfall([
            Async.constant(options),
            Gateway.createResourceMapFromFile,
            Gateway.getRestApiByName,
            Gateway.getResources,
            Gateway.deleteResources,
            Gateway.createResources
        ], function(err) {
            return cb(err, options);
        })
    },

    getRestApiByName: function(options, cb) {
        Util.log('fetching rest api');
        ApiGateway.getRestApis({}, function(err, data) {
            if(err || !data || !data.items || !data.items.length) {
                err = err || new Error('Rest APIs not found');
                err.status = 400;
                return cb(err);
            }

            var items = data.items;
            var restApi;
            items.some(function(item) {
                if(options.rest_api_name === item.name) {
                    restApi = item;
                    return true;
                }
            });
            options.rest_api = restApi;
            return cb(null, options);
        });
    },

    getResources: function(options, cb) {
        var opts = {
            restApiId: options.rest_api.id,
            limit: 1000
        }
        Util.log('fetching existing resources');
        ApiGateway.getResources(opts, function(err, data) {    
            if(err || !data || !data.items || !data.items.length) {
                err = err || new Error('Resources not found');
                err.status = 400;
                return cb(err);
            }
            var items = data.items;
            var parentResource;
            items.some(function(item) {
                if(item.path === '/') {
                    parentResource = item;
                    return true;
                }
            });

            var firstLevelResources = [];
            items.forEach(function(item) {
                if(item.parentId === parentResource.id) {
                    firstLevelResources.push(item);
                }
            });
            options.resources = items;
            options.first_level_resources = firstLevelResources;
            options.root_resource = parentResource;
            return cb(null, options);
        });
    },


    createResourceMapFromFile: function(options, cb) {
        var inputPath = options.input_file;

        Util.log('creating resource map');
        FS.readFile(inputPath, 'utf8', function(err, data) {
            if(err) {
                return cb(err);
            }
            var resourceMapping = {
            };

            var lines = data.split('\n');
            lines.forEach(function(line) {
                if(line.indexOf('app.') > -1) {
                    line = line.trim();

                    var url = line.match( /'((?:\\.|[^"\\])*)'/)[0];
                    url = url.substr(1).slice(0, -1);
                    var method;

                    var basePath = 'app.';
                    if(line.indexOf(basePath + 'get') > -1) {
                        method = 'GET'
                    } else if(line.indexOf(basePath + 'post') > -1) {
                        method = 'POST'
                    } else if(line.indexOf(basePath + 'put') > -1) {
                        method = 'PUT'
                    } else if(line.indexOf(basePath + 'delete') > -1) {
                        method = 'DELETE'
                    }  else if(line.indexOf(basePath + 'head') > -1) {
                        method = 'HEAD'
                    }

                    var splitUrls = url.split('/');
                    splitUrls.splice(0, 2);
                    var splitUrlsLength = splitUrls.length;
                    var lastMapping = resourceMapping;

                    for(var i = 0; i<splitUrlsLength; i++) {
                        var splitUrl = splitUrls[i];
                        if(splitUrl && splitUrl.length) {
                            if(!lastMapping[splitUrl]) {
                                lastMapping[splitUrl] = {};
                                lastMapping[splitUrl].methods = [];
                            }

                            if(i+1 === splitUrlsLength) {
                                lastMapping[splitUrl].methods.push(method);
                            } 
                            lastMapping = lastMapping[splitUrl];
                        } 
                    }
                }
            });
            options.resource_mapping = resourceMapping;
            return cb(null, options);
        });
    },

    createResources: function(options, cb) {
        var resourceMapping = options.resource_mapping;
        var restApi = options.rest_api;
        var parentResource = options.parent_resource;
        var rootResource = options.root_resource;

        Async.eachLimit(Object.keys(resourceMapping), 2, function(key, callback) {
            handleResource(key, resourceMapping[key], parentResource, callback);
        }, function(err) {
            return cb(err, options);
        });

        function handleResource(resourceName, resourceMap, parentResource, callback) {
            if(resourceName === METHODS) {
                return Gateway.putMethods(resourceMap, options, callback);
            }

            var opts = {
              parentId: parentResource && parentResource.id || rootResource.id,
              pathPart: resourceName,
              restApiId: restApi.id
            };

            Gateway.createResource(opts, function(err, createdResource) {
                if(err) {
                    return callback();
                }
                var opts = {
                    resource_mapping: resourceMap,
                    rest_api: restApi,
                    parent_resource: createdResource,
                    root_resource: rootResource
                };
                Gateway.createResources(opts, callback);
            });
        }
    },

    createResource: function(options, cb) {
        ApiGateway.createResource(options, cb);
    },

    deleteResources: function(options, cb) {
        Util.log('deleting existing resources');
        Async.eachLimit(options.first_level_resources, 2, function(resource, callback) {
            var opt = {
                resource_id: resource.id, 
                rest_api: options.rest_api
            };
            Gateway.deleteResource(opt, callback);
        }, function(err) {
            return cb(err, options);
        });
    },

    deleteResource: function(options, cb) {
        var opts = {
          resourceId: options.resource_id,
          restApiId: options.rest_api.id
        };
        ApiGateway.deleteResource(opts, function(err) {
            return cb(err, options);
        });
    },

    putMethods: function(methods, options, cb) {
        var parentResource = options.parent_resource;
        var restApi = options.rest_api;

        Async.eachLimit(methods, 2, function(method, callback) {
            var opt = {
                method: method,
                resource: parentResource,
                rest_api: restApi
            };
            Gateway.putMethod(opt, function(err) {
                if(err) {
                    Util.log('creating method: ' + parentResource.path + ', ' + method + ', ' + err);
                } else {
                    Util.log('created method: ' + parentResource.path + ', ' + method);
                }
                return callback(err);
            });
        }, function(err) {
            return cb(err);
        });
    },

    putMethod: function(options, cb) {
        var method = options.method;
        var resource = options.resource;
        var restApi = options.rest_api;

        var opts = {
          authorizationType: AWS_IAM,
          httpMethod: method,
          resourceId: resource.id,
          restApiId: restApi.id,
          apiKeyRequired: true
        };
        ApiGateway.putMethod(opts, function(err) {
            if(err) {
                return cb(err);
            }
            Gateway.putMethodRequest(options, function(err) {
                if(err) {
                    return cb(err);
                }
                Gateway.putMethodResponse(options, cb);
            });
        });
    },

    putMethodRequest: function(options, cb) {
        var method = options.method;
        var resource = options.resource;
        var restApi = options.rest_api;
        
        var params = {
          httpMethod: method,
          resourceId: resource.id,
          restApiId: restApi.id,
          type: HTTP_METHOD,
          integrationHttpMethod: method,
          passthroughBehavior: PASS_THROUGH_BEHAVIOUR,
          uri: BASE_DOMAIN + resource.path
        };
        ApiGateway.putIntegration(params, cb);
    },

    putMethodResponse: function(options, cb) {
        var method = options.method;
        var resource = options.resource;
        var restApi = options.rest_api;
        
        var opts = {
          httpMethod: method,
          resourceId: resource.id,
          restApiId: restApi.id,
          statusCode: STATUS_CODE[200], 
          responseParameters: {
            "method.response.header.Content-Type": true
          }
        };
        ApiGateway.putMethodResponse(opts, cb);
    }
};

module.exports = Gateway;

(function () {
    if (require.main == module) {
        var options = {
            // rest_api_name: 'ScopeHub',
            rest_api_name: 'ScopeHub',
            input_file: Path.join(__dirname, '../routes/frontend.js'),
            parent_resource_id: 'it52wh'
        };
        // Gateway.createResource(options, console.log);
        
        Gateway.init(options, function(err) {
            if(err) {
                Util.log(err);        
                process.exit(1);
            } else {
                Util.log('APIs created successfully');    
            }
        });
        
    }
}());
