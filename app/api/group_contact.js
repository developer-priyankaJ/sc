/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.api.user');
var Async = require('async');
var Util = require('util');
var _ = require('lodash');
var AuditUtils = require('../lib/audit_utils');
var DataUtils = require('../lib/data_utils');
var Constants = require('../data/constants');
var GroupContactModel = require('../model/group_contact');
var GroupModel = require('../model/group');
var GroupApi = require('../api/group');
var ContactModel = require('../model/contact');
var UserModel = require('../model/user');
var ErrorConfig = require('../data/error');

var GroupContact = {

    add: function (options, auditOptions, cb) {
        var groupId = options.groupId;
        var contactIds = options.contactIds;
        var createdBy = options.createdBy;
        var err;

        if (DataUtils.isUndefined(groupId)) {
            err = new Error(ErrorConfig.MESSAGE.GROUP_ID_REQ);
        } else if (!DataUtils.isArray(contactIds) || !contactIds.length) {
            err = new Error(ErrorConfig.MESSAGE.AT_LEAST_ONE_CONTACT_MUST_BE_SELECTED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }
        var groupContactOptions = {
            groupId: groupId,
            createdBy: createdBy,
            memberStartDate: new Date().getTime(),
            memberEndDate: Constants.MEMBER_END_DATE
        };

        var groupContactList = [];
        GroupApi.getGroup(options, function (err, group) {
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
                      return cbL1(err);
                  }
                  var activeContacts = (_.map(data.Items, 'attrs'));

                  var duplicateContactMessage = {};
                  var duplicateContacts = [];
                  Async.eachSeries(contactIds, function (contactId, callback) {

                      var duplicate = _.find(activeContacts, function (contact) {
                          return (contact.contactId === contactId)
                      });

                      if (duplicate) {
                          duplicateContacts.push(contactId);
                          duplicateContactMessage.message = ErrorConfig.MESSAGE.DUPLICATE_CONTACT_IN_GROUP;
                          duplicateContactMessage.contacts = duplicateContacts;
                          duplicateContactMessage.status = ErrorConfig.STATUS_CODE.CONFLICT;
                          return callback()
                      }
                      groupContactOptions.contactId = contactId;
                      GroupContactModel.create(groupContactOptions, function (err, groupContact) {
                          if (err || !groupContact) {
                              err = err || new Error(ErrorConfig.MESSAGE.GROUP_CONTACT_CREATION_FAILED);
                              err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                              Util.log(err);
                              return callback(err);
                          }
                          auditOptions.metaData = {
                              groupContact: groupContact
                          };
                          AuditUtils.create(auditOptions);
                          groupContactList.push(groupContact);
                          return callback();
                      });

                  }, function (err) {
                      if (!_.isEmpty(duplicateContactMessage)) {
                          return cb(err, duplicateContactMessage);
                      }
                      return cb(err, groupContactList);
                  });
              })
        });
    },

    getAllGroups: function (options, cb) {
        var contactId = options.contactId;
        if (DataUtils.isUndefined(contactId)) {
            var err = new Error(ErrorConfig.MESSAGE.CONTACT_ID_REQ);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('err', err);
            return cb(err);
        }
        GroupContactModel
          .query(contactId)
          .usingIndex(Constants.CONTACT_GROUP_INDEX)
          .exec(function (err, data) {
              if (err || !data || !data.Items) {
                  return cb(err)
              }
              var groupContacts = (_.map(data.Items, 'attrs'));
              var groups = [];

              Async.eachSeries(groupContacts, function (groupContact, cbL1) {
                  GroupModel.get(groupContact.groupId, {
                      ConsistentRead: true
                  }, function (err, data) {
                      if (err) {
                          return cbL1(err)
                      }
                      var group = data && data.attrs;
                      if (_.isEmpty(group)) {
                          return cbL1();
                      }
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
                                    return cbL2(err, groups);
                                });
                            }, function (err) {
                                group.contacts = contacts;
                                groups.push(group);
                                return cbL1(err, group);
                            });
                        });
                  });
              }, function (err) {
                  return cb(err, groups);
              });
          });
    },


    leaveGroup: function (options, auditOptions, cb) {
        var userId = options.userId;
        var group = options.group;
        var err;
        if (DataUtils.isUndefined(userId)) {
            err = new Error(ErrorConfig.MESSAGE.USER_ID_REQUIRED);
        }
        if (_.isEmpty(group)) {
            err = new Error(ErrorConfig.MESSAGE.GROUP_REQ);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('err', err);
            return cb(err);
        }
        if (!group.contacts) {
            return cb();
        }
        var groupContacts = group.contacts;

        Async.eachSeries(groupContacts, function (groupContact, cbL1) {
            if (groupContact.inviteeUUID === userId) {
                var groupContactUserId = groupContact.id;
            } else if (groupContact.inviterUUID === userId) {
                groupContactUserId = groupContact.id;
            } else {
                groupContactUserId = '';
            }

            if (_.isEmpty(groupContactUserId)) {
                return cbL1();
            }

            GroupContactModel
              .query(groupContactUserId)
              .usingIndex(Constants.CONTACT_GROUP_INDEX)
              .where(Constants.GROUP_ID).equals(group.id)
              .exec(function (err, data) {
                  if (err || !data || !data.Items) {
                      return callback(err);
                  }

                  var groupContact = _.map(data.Items, 'attrs');
                  var removeContact = _.find(groupContact, function (contact) {
                      return contact.memberEndDate === Constants.MEMBER_END_DATE;
                  });
                  if (_.isEmpty(removeContact)) {
                      err = err || new Error(ErrorConfig.MESSAGE.GROUP_CONTACT_ALREADY_DELETED);
                      err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                      return cb(err);
                  }
                  auditOptions.metaData = {
                      old_group_contact: removeContact
                  };
                  var groupContactOptions = {
                      id: removeContact.id,
                      memberEndDate: new Date().getTime()
                  };
                  GroupContactModel.update(groupContactOptions, {
                      ReturnValues: 'ALL_NEW'
                  }, function (err, groupContact) {
                      if (err || !groupContact) {
                          err = err || new Error(ErrorConfig.MESSAGE.GROUP_CONTACT_UPDATE_FAILED);
                          err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                          Util.log(err);
                          return cb(err);
                      }
                      groupContact = groupContact.attrs;
                      auditOptions.metaData.new_group_contact = groupContact;
                      AuditUtils.create(auditOptions);
                      return cb(null, group);
                  });
              });
        }, function (err) {
            return cb(err)
        });
    },


    getAllGroupsByUser: function (options, cb) {
        var userId = options.userId;
        if (DataUtils.isUndefined(userId)) {
            var err = new Error(ErrorConfig.MESSAGE.USER_ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('err', err);
            return cb(err);
        }
        var userContacts = [];
        ContactModel
          .query(userId)
          .usingIndex(Constants.CONTACT_INVITER_UUID_INDEX)
          .exec(function (err, data) {
              if (err) {
                  return cb(err)
              }
              if (data && data.Items) {
                  userContacts = (_.map(data.Items, 'attrs'));
              } else {
                  userContacts = [];
              }

              ContactModel
                .query(userId)
                .usingIndex(Constants.CONTACT_INVITEE_UUID_INDEX)
                .exec(function (err, data) {
                    if (err) {
                        return cb(err)
                    }
                    if (data && data.Items) {
                        var newContacts = (_.map(data.Items, 'attrs'));
                        userContacts.push.apply(userContacts, newContacts);
                    } else {
                        userContacts = [];
                    }
                    if (_.isEmpty(userContacts)) {
                        return cb();
                    }
                    userContacts = _.filter(userContacts, function (contact) {
                        return contact.status === '2';
                    });
                    var groups = [];
                    if (_.isEmpty(userContacts)) {
                        return cb();
                    }
                    userContacts.push({id: userId});
                    Async.eachSeries(userContacts, function (userContact, cbL1) {
                        GroupContactModel
                          .query(userContact.id)
                          .usingIndex(Constants.CONTACT_GROUP_INDEX)
                          .exec(function (err, data) {
                              if (err || !data || !data.Items) {
                                  return cbL1(err)
                              }

                              var groupContacts = (_.map(data.Items, 'attrs'));
                              if (_.isEmpty(groupContacts)) {
                                  return cbL1()
                              }

                              Async.eachSeries(groupContacts, function (groupContact, cbL2) {
                                  if (groupContact.memberEndDate !== Constants.MEMBER_END_DATE) {
                                      return cbL2();
                                  }
                                  if (_.isEmpty(groupContact)) {
                                      return cbL2();
                                  }
                                  GroupModel.get(groupContact.groupId, {
                                      ConsistentRead: true
                                  }, function (err, data) {
                                      if (err) {
                                          return cbL2(err);
                                      }
                                      var group = data && data.attrs;
                                      if (_.isEmpty(group)) {
                                          return cbL2();
                                      }
                                      GroupContactModel.query(group.id)
                                        .usingIndex(Constants.GROUP_MEMBER_END_DATE_INDEX)
                                        .where(Constants.GROUP_MEMBER_END_DATE)
                                        .equals(Constants.MEMBER_END_DATE)
                                        .exec(function (err, data) {
                                            if (err || !data || !data.Items) {
                                                return cbL2(err);
                                            }
                                            var groupContacts = (_.map(data.Items, 'attrs'));
                                            if (!groupContacts || !groupContacts.length) {
                                                return cbL2();
                                            }
                                            var contacts = [];

                                            Async.eachSeries(groupContacts, function (contact, cbL3) {
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
                                                                return cbL3(err);
                                                            }
                                                            var user = data && data.attrs;
                                                            contacts.push(user);
                                                            return cbL3(err, contacts);
                                                        });
                                                    } else {
                                                        return cbL3(err, contacts);
                                                    }
                                                });
                                            }, function (err) {
                                                group.contacts = contacts;
                                                groups.push(group);
                                                return cbL2(err, group);
                                            });
                                        });
                                  });
                              }, function (err) {
                                  return cbL1(err);
                              });
                          });
                    }, function (err) {
                        groups = _.uniq(groups, function (group) {
                            return group.id;
                        });
                        return cb(err, groups);
                    });
                });
          });
    },

    delete: function (options, auditOptions, cb) {
        var groupId = options.groupId;
        var contactIds = options.contactIds;
        var err;

        if (DataUtils.isUndefined(groupId)) {
            err = new Error(ErrorConfig.MESSAGE.GROUP_ID_REQ);
        } else if (!DataUtils.isArray(contactIds) || !contactIds.length) {
            err = new Error(ErrorConfig.MESSAGE.AT_LEAST_ONE_CONTACT_MUST_BE_SELECTED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('err', err);
            return cb(err);
        }
        var groupContactOptions = {
            groupId: groupId
        };
        GroupApi.getGroup(options, function (err, group) {
            if (err || !group) {
                err = err || new Error(ErrorConfig.MESSAGE.GROUP_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            Async.eachSeries(contactIds, function (contact, callback) {
                groupContactOptions.contactId = contact;

                GroupContactModel
                  .query(groupContactOptions.contactId)
                  .usingIndex(Constants.CONTACT_GROUP_INDEX)
                  .where(Constants.GROUP_ID).equals(groupContactOptions.groupId)
                  .exec(function (err, data) {
                      if (err || !data || !data.Items) {
                          return callback(err);
                      }
                      var groupContact = _.map(data.Items, 'attrs');
                      var removeContact = _.find(groupContact, function (contact) {
                          return contact.memberEndDate === Constants.MEMBER_END_DATE;
                      });
                      if (_.isEmpty(removeContact)) {
                          err = err || new Error(ErrorConfig.MESSAGE.GROUP_CONTACT_ALREADY_DELETED);
                          err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                          return cb(err);
                      }
                      auditOptions.metaData = {
                          old_group_contact: removeContact
                      };
                      var groupContactOptions = {
                          id: removeContact.id,
                          memberEndDate: new Date().getTime()
                      };
                      GroupContactModel.update(groupContactOptions, {
                          ReturnValues: 'ALL_NEW'
                      }, function (err, groupContact) {
                          if (err || !groupContact) {
                              err = err || new Error(ErrorConfig.MESSAGE.GROUP_CONTACT_UPDATE_FAILED);
                              err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                              Util.log(err);
                              return cb(err);
                          }
                          groupContact = groupContact.attrs;
                          auditOptions.metaData.new_group_contact = groupContact;
                          AuditUtils.create(auditOptions);
                          return cb(null, group);
                      });
                  });
            }, function (err) {
                return cb(err);
            });
        });
    }
};

module.exports = GroupContact;
