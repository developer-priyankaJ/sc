/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.api.group');
var Util = require('util');
var Async = require('async');
var _ = require('lodash');

var DataUtils = require('../lib/data_utils');
var AuditUtils = require('../lib/audit_utils');
var Constants = require('../data/constants');
var GroupModel = require('../model/group');
var GroupContactModel = require('../model/group_contact');
var ContactModel = require('../model/contact');
var UserModel = require('../model/user');
var ErrorConfig = require('../data/error');


var Group = {

    create: function (options, auditOptions, cb) {
        var name = options.name;
        var ownerId = options.ownerId;
        var contactIds = options.contactIds;
        var createdBy = options.createdBy;

        var err;
        if (DataUtils.isUndefined(name)) {
            err = new Error(ErrorConfig.MESSAGE.GROUP_NAME_REQ);
        } else if (DataUtils.isUndefined(ownerId)) {
            err = new Error(ErrorConfig.MESSAGE.OWNER_ID_REQ);
        } else if (!DataUtils.isArray(contactIds) || !contactIds.length) {
            err = new Error(ErrorConfig.MESSAGE.AT_LEAST_ONE_CONTACT_MUST_BE_SELECTED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
        if (contactIds) {
            contactIds.push(ownerId);
        }

        GroupModel
          .query(ownerId)
          .usingIndex(Constants.OWNER_GROUP_NAME_INDEX)
          .where(Constants.GROUP_NAME).equals(name)
          .exec(function (err, data) {
              if (err || data.Count > 0) {
                  console.log(err);
                  err = err || new Error(ErrorConfig.MESSAGE.GROUP_NAME_ALREADY_PRESENT);
                  err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                  Util.log(err);
                  return cb(err);
              }
              var groupOptions = {
                  name: name,
                  ownerId: ownerId,
                  createdBy: createdBy
              };

              var params = {
                  overwrite: false
              };
              GroupModel.create(groupOptions, params, function (err, group) {
                  if (err || !group) {
                      err = err || new Error(ErrorConfig.MESSAGE.GROUP_CREATION_FAILED);
                      err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                      Util.log(err);
                      return cb(err);
                  }
                  group = group.attrs;
                  auditOptions.metaData = {
                      group: group
                  };
                  AuditUtils.create(auditOptions);

                  var groupContactOptions = {
                      groupId: group.id,
                      createdBy: createdBy,
                      memberStartDate: new Date().getTime(),
                      memberEndDate: Constants.MEMBER_END_DATE
                  };
                  Async.eachSeries(contactIds, function (contact, callback) {
                      groupContactOptions.contactId = contact;

                      GroupContactModel.create(groupContactOptions, function (err, groupContact) {
                          if (err || !groupContact) {
                              err = err || new Error(ErrorConfig.MESSAGE.GROUP_CONTACT_CREATION_FAILED);
                              err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                              Util.log(err);
                              return callback(err);
                          }
                          return callback();
                      });
                  }, function (err) {
                      return cb(err, group);
                  });
              });
          });
    },

    getGroup: function (options, cb) {
        var groupId = options.groupId;
        if (DataUtils.isUndefined(groupId)) {
            var err = new Error(ErrorConfig.MESSAGE.GROUP_ID_REQ);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('err', err);
            return cb(err);
        }
        GroupModel.get(groupId, {
            ConsistentRead: true
        }, function (err, data) {
            if (err) {
                return cb(err)
            }
            var group = data && data.attrs;
            return cb(err, group);
        });
    },

    getGroupByName: function (name, cb) {
        if (DataUtils.isUndefined(name)) {
            var err = new Error(ErrorConfig.MESSAGE.GROUP_NAME_REQ);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('err', err);
            return cb(err);
        }
        GroupModel
          .query(name)
          .usingIndex(Constants.GROUP_NAME_INDEX)
          .exec(function (err, data) {
              var group = data && data.Items && data.Items[0];
              return cb(err, group);
          });
    },

    groupNameExist: function (options, cb) {
        var name = options.name;
        Group.getGroupByName(name, function (err, group) {
            if (err) {
                return cb(err);
            }
            group = group && group.attrs;
            return cb(null, group);
        });
    },

    getContact: function (options, cb) {
        var status = Constants.CONTACT_STATUS.ACCEPTED;
        var groupId = options.groupId;

        ContactModel
          .query(status)
          .usingIndex(Constants.STATUS_INDEX)
          .exec(function (err, data) {
              if (err || !data || !data.Items) {
                  return cb(err);
              }
              var contact = (_.map(data.Items, 'attrs'));
              var activeContacts = _.filter(contact, function (value) {
                  return value.isActive === true;
              });
              GroupContactModel.query(groupId)
                .usingIndex(Constants.GROUP_MEMBER_END_DATE_INDEX)
                .where(Constants.GROUP_MEMBER_END_DATE)
                .equals(Constants.MEMBER_END_DATE)
                .exec(function (err, data) {
                    if (err || !data || !data.Items) {
                        return cb(err);
                    }
                    var groupContacts = (_.map(data.Items, 'attrs'));

                    var contacts = [];
                    _.each(activeContacts, function (contact) {
                        var index = _.findIndex(groupContacts, {contactId: contact.id});
                        if (index === -1) {
                            contacts.push(contact);
                        }
                    });
                    return cb(null, contacts);
                });
          });
    },

    getGroupContact: function (options, cb) {
        var groupId = options.groupId;
        Group.getGroup(options, function (err, group) {
            if (err || !group) {
                err = err || new Error(ErrorConfig.MESSAGE.GROUP_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            GroupContactModel.query(groupId)
              .usingIndex(Constants.GROUP_MEMBER_END_DATE_INDEX)
              .where(Constants.GROUP_MEMBER_END_DATE)
              .equals(Constants.MEMBER_END_DATE)
              .exec(function (err, data) {
                  if (err || !data || !data.Items) {
                      return cb(err);
                  }

                  var groupContacts = (_.map(data.Items, 'attrs'));
                  if (!groupContacts || !groupContacts.length) {
                      return cb();
                  }
                  var contacts = [];
                  Async.eachSeries(groupContacts, function (contact, callback) {
                      var contactId = contact.contactId;

                      ContactModel.get(contactId, {
                          ConsistentRead: true
                      }, function (err, data) {
                          var contact = data && data.attrs;
                          if (contact) {
                              contacts.push(contact);
                          }
                          if (contactId === group.ownerId) {
                              UserModel.get(contactId, {
                                  ConsistentRead: true
                              }, function (err, data) {
                                  if (err) {
                                      return callback(err);
                                  }
                                  var user = data && data.attrs;
                                  contacts.push(user);
                                  return callback(err, contacts);
                              });
                          } else {
                              return callback(err, contacts);
                          }
                      });
                  }, function (err) {
                      return cb(err, contacts);
                  });
              });
        });
    },

    getAllGroups: function (options, cb) {
        var ownerId = options.ownerId;
        if (DataUtils.isUndefined(ownerId)) {
            var err = new Error(ErrorConfig.MESSAGE.OWNER_ID_REQ);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('err', err);
            return cb(err);
        }

        GroupModel
          .query(ownerId)
          .usingIndex(Constants.OWNER_GROUP_NAME_INDEX)
          .exec(function (err, data) {
              if (err || !data || !data.Items) {
                  return cb(err)
              }
              var groups = (_.map(data.Items, 'attrs'));
              if (_.isEmpty(groups)) {
                  return cb();
              }
              Async.eachSeries(groups, function (group, cbL1) {

                  GroupContactModel.query(group.id)
                    .usingIndex(Constants.GROUP_MEMBER_END_DATE_INDEX)
                    .where(Constants.GROUP_MEMBER_END_DATE)
                    .equals(Constants.MEMBER_END_DATE)
                    .exec(function (err, data) {
                        if (err || !data || !data.Items) {
                            return cbL1(err);
                        }

                        var groupContacts = (_.map(data.Items, 'attrs'));
                        if (!groupContacts || !groupContacts.length) {
                            return cbL1();
                        }
                        var contacts = [];

                        Async.eachSeries(groupContacts, function (contact, cbL2) {
                            var contactId = contact.contactId;

                            ContactModel.get(contactId, {
                                ConsistentRead: true
                            }, function (err, data) {
                                var contact = data && data.attrs;
                                if (contact) {
                                    contacts.push(contact);
                                }
                                if (contactId === group.ownerId) {
                                    UserModel.get(contactId, {
                                        ConsistentRead: true
                                    }, function (err, data) {
                                        if (err) {
                                            return cbL2(err);
                                        }
                                        var user = data && data.attrs;
                                        contacts.push(user);
                                        return cbL2(err, contacts);
                                    });
                                } else {
                                    return cbL2(err, contacts);
                                }
                            });
                        }, function (err) {
                            group.contacts = contacts;
                            return cbL1(err, group);
                        });
                    });
              }, function (err) {
                  return cb(err, groups);
              });
          });
    },

    update: function (options, auditOptions, cb) {
        var name = options.name;
        var updatedBy = options.updatedBy;
        var groupNameExist = options.groupNameExist;

        Group.getGroup(options, function (err, group) {
            if (err || !group) {
                err = err || new Error(ErrorConfig.MESSAGE.GROUP_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            if (groupNameExist && groupNameExist.id !== group.id && groupNameExist.ownerId === group.ownerId) {
                var err = new Error(ErrorConfig.MESSAGE.GROUP_NAME_ALREADY_PRESENT);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                debug('err', err);
                return cb(err);
            }

            var groupOptions = {
                id: group.id
            };

            if (DataUtils.isDefined(name)) {
                groupOptions.name = name;
            }
            if (DataUtils.isDefined(updatedBy)) {
                groupOptions.updatedBy = updatedBy;
            }

            auditOptions.metaData = {
                old_group: group
            };

            GroupModel.update(groupOptions, {
                ReturnValues: 'ALL_NEW'
            }, function (err, group) {
                if (err || !group) {
                    err = err || new Error(ErrorConfig.MESSAGE.GROUP_UPDATE_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                    Util.log(err);
                    return cb(err);
                }
                group = group.attrs;
                auditOptions.metaData.new_group = group;
                AuditUtils.create(auditOptions);
                return cb(null, group);
            });
        });
    },

    remove: function (options, auditOptions, cb) {
        Group.getGroup(options, function (err, group) {
            if (err || !group) {
                err = err || new Error(ErrorConfig.MESSAGE.GROUP_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            var groupId = options.groupId;
            GroupModel.destroy(groupId, function (err) {
                if (err) {
                    return cb(err);
                }
                AuditUtils.create(auditOptions);
                GroupContactModel.query(groupId)
                  .usingIndex(Constants.GROUP_INDEX)
                  .exec(function (err, data) {
                      if (err || !data || !data.Items) {
                          return cb(err);
                      }
                      var groupContacts = (_.map(data.Items, 'attrs'));
                      if (!groupContacts || !groupContacts.length) {
                          return cb();
                      }
                      Async.eachSeries(groupContacts, function (contact, callback) {
                          GroupContactModel.destroy(contact, function (err) {
                              return callback(err);
                          });
                      }, function (err) {
                          return cb(err);
                      });
                  });
            });
        });
    }
};

module.exports = Group;
