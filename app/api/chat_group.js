/* jslint node: true */
'use strict';

var debug = require('debug')('scopehub.api.chat_group');
var Util = require('util');
var Async = require('async');
var _ = require('lodash');

var DataUtils = require('../lib/data_utils');
var Utils = require('../lib/utils');
var AuditUtils = require('../lib/audit_utils');
var ErrorUtils = require('../lib/error_utils');
var Constants = require('../data/constants');
var Promise = require('bluebird');
var ErrorConfig = require('../data/error');
var connection = require('../lib/connection_util');
var FirebaseUtils = require('../lib/firebase_utils');

var ChatGroup = {

    validateCreateGroup: function (options) {
        return new Promise(async function (resolve, reject) {
            try {
                var name = options.name;
                var members = options.members;
                var isName = options.isName;

                var err;
                if (isName && DataUtils.isUndefined(name)) {
                    err = new Error(ErrorConfig.MESSAGE.GROUP_NAME_REQ);
                } else if (!DataUtils.isArray(members)) {
                    err = new Error(ErrorConfig.MESSAGE.ID_MUST_BE_ARRAY);
                } else if (members.length <= 0) {
                    err = new Error(ErrorConfig.MESSAGE.ATLEAST_ONE_ID_REUQIRED);
                } else if (members.length > 8) {
                    err = new Error(ErrorConfig.MESSAGE.GROUP_CAN_NOT_BE_CREATED_WITH_MORE_THAN_8_MEMBERS);
                }
                if (err) {
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }

                await Promise.each(members, async function (member) {
                    if (DataUtils.isUndefined(member.memberId)) {
                        err = new Error(ErrorConfig.MESSAGE.MEMBER_ID_REQ);
                    } else if (DataUtils.isValidateOptionalField(member.contactId)) {
                        err = new Error(ErrorConfig.MESSAGE.CONTACT_ID_REQ);
                    }
                    if (err) {
                        throw err;
                    }
                });
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /*validateMembers: function (options) {
        return new Promise(async function (resolve, reject) {
            var members = options.members;
            var err;
            try {

                await Promise.each(members, async function (member) {
                    if (DataUtils.isUndefined(member.memberId)) {
                        err = new Error(ErrorConfig.MESSAGE.MEMBER_ID_REQ);
                    } else if (DataUtils.isValidateOptionalField(member.contactId)) {
                        err = new Error(ErrorConfig.MESSAGE.CONTACT_ID_REQ);
                    }
                    if (err) {
                        throw err;
                    }
                });

                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        })
    },*/

    manipulateMemberQuery: function (options) {
        return new Promise(function (resolve, reject) {
            var string = '', values = [];

            _.map(options.members, function (member) {
                string += 'uuid_to_bin(?),';
                values.push(member.memberId);
            });
            string = string.replace(/,\s*$/, ' ');
            debug('string', string, 'values', values);
            return resolve({
                string: string,
                values: values
            });
        });
    },

    findExistGroup: function (options) {
        return new Promise(async function (resolve, reject) {
            try {
                var members = options.members;
                var conn = await connection.getConnection();

                var memberDetail = await ChatGroup.manipulateMemberQuery({members: members});
                debug('member detail', memberDetail, memberDetail.values.length);
                var totalMembers = memberDetail.values.length;
                var groupDetail = await conn.query('SELECT CAST(uuid_from_bin(G.id) as CHAR) AS groupId,' +
                  ' group_concat(CAST(uuid_from_bin(GM.memberId) as CHAR)) as memberIds,count(*) as memberCount,' +
                  ' (SELECT COUNT(*) FROM groupMembers GM WHERE GM.groupId=G.id) AS members,' +
                  ' CAST(uuid_from_bin(G.createdBy) as CHAR) as ownerId, G.createdAt' +
                  ' FROM groups G, groupMembers GM WHERE G.id = GM.groupId and GM.status=1 and  GM.memberId IN (' + memberDetail.string + ')' +
                  ' AND G.isName=0  GROUP  BY G.id HAVING memberCount = ? and members = ? ',
                  memberDetail.values.concat(totalMembers, totalMembers));
                // debug('groups',groupDetail);
                groupDetail = Utils.filteredResponsePool(groupDetail);
                return resolve(groupDetail);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.GROUP_CREATION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    findBlockedMember: function (options) {
        return new Promise(async function (resolve, reject) {
            try {
                var members = options.members;
                var conn = await connection.getConnection();

                var memberDetail = await ChatGroup.manipulateMemberQuery({members: members});
                var contactDetail = await conn.query('SELECT status,CAST(uuid_from_bin(inviteeUUID) as CHAR) as memberId' +
                  ' FROM contacts WHERE inviterUUID=uuid_to_bin(?) AND inviteeUUID IN (' + memberDetail.string + ')',
                  [options.userId].concat(memberDetail.values));
                // debug('groups',groupDetail);
                //contactDetail = Utils.filteredResponsePool(contactDetail);
                return resolve(contactDetail);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.NOT_ALLOWED_FOR_GROUP);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    insertGroupDetails: function (options) {
        return new Promise(async function (resolve, reject) {
            try {
                if (!options.isName) {
                    options.name = '';
                }
                var conn = await connection.getConnection();
                var groupData = await conn.query('insert into groups (id,name,status,isName,createdAt,updatedAt,createdBy) ' +
                  'values (uuid_to_bin(?),?,?,?,?,?,uuid_to_bin(?))', [options.id, options.name,
                    Constants.GROUP_STATUS.ACTIVE, options.isName, options.createdAt, options.updatedAt, options.userId]);

                groupData = Utils.isAffectedPool(groupData);
                return resolve(groupData);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.GROUP_CREATION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    insertGroupMember: function (options) {
        return new Promise(async function (resolve, reject) {
            var list = options.list;
            var convertedList, keys, err;
            await Utils.convertObjectToArrayMD(list, async function (err, response) {
                if (err) {
                    debug('err', err);
                    return reject(err);
                }
                convertedList = response.list;
                keys = response.keys;

                //debug('list', convertedList, 'keys', keys);

                var query = 'insert into groupMembers (' + keys + ') values';

                var values = ' (uuid_to_bin(?),uuid_to_bin(?),uuid_to_bin(?),uuid_to_bin(?),?,?,uuid_to_bin(?),?,?) ';

                await Promise.each(list, function (value) {
                    query = query + values;
                    query = query + ',';
                });

                query = query.replace(/,\s*$/, '');

                try {
                    var conn = await connection.getConnection();
                    var messageInsterted = await conn.query(query, convertedList);
                    messageInsterted = Utils.isAffectedPool(messageInsterted);

                    debug('Message ----------------------------------', messageInsterted);
                    if (!messageInsterted) {
                        throw err;
                    }
                    return resolve(Constants.OK_MESSAGE);
                } catch (err) {
                    debug('err', err);
                    err = new Error(ErrorConfig.MESSAGE.GROUP_MEMBER_CREATION_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
            });
        });
    },


    create: async function (options, auditOptions, errorOptions, cb) {
        var members = options.members;
        var userId = options.user.id;
        var generatedId = Utils.generateId();
        var id = generatedId.uuid;
        var name = options.name;
        var isName = options.isName;
        var createdAt = DataUtils.getEpochMSTimestamp();
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var memberStartDate = DataUtils.getEpochMSTimestamp();
        var createMemberList = [];
        var err;

        try {
            var conn = await connection.getConnection();
            await conn.query('START TRANSACTION');
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
        try {
            var checkResponse = await ChatGroup.validateCreateGroup(options);
            //debug('validate return');

            // var checkMember = await ChatGroup.validateMembers({members: members});
            //debug('member validation');
            members.push({
                memberId: userId,
                contactId: Constants.DEFAULT_REFERE_ID
            });
            var memberIds = _.map(members, 'memberId');
            var index = DataUtils.isUniqueArray(memberIds);

            if (!index) {
                err = new Error(ErrorConfig.MESSAGE.DUPLICATE_CONTACT_IN_GROUP);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                errorOptions.err = err;
                await ErrorUtils.create(errorOptions);
                return cb(err);
            }
            var contactDetail = await ChatGroup.findBlockedMember({members: members, userId: userId});
            if (contactDetail) {
                debug('contact========', contactDetail);
                var arrayForStatus = [];
                _.map(contactDetail, function (contact) {
                    if (contact.status !== Constants.CONTACT_STATUS.ACCEPTED) {
                        arrayForStatus.push({
                            memberId: contact.memberId,
                            status: contact.status
                        });
                    }
                });
                debug('Array For Status', arrayForStatus);
                if (arrayForStatus.length > 0) {
                    err = new Error(ErrorConfig.MESSAGE.NOT_ALLOWED_FOR_GROUP);
                    err.data = arrayForStatus;
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    errorOptions.err = err;
                    await ErrorUtils.create(errorOptions);
                    return cb(err);
                }
            }
            if (!isName) {
                var groupDetail = await ChatGroup.findExistGroup({members: members});
                debug('groupDetail', groupDetail);
                if (groupDetail) {
                    var groupName = await ChatGroup.getGroupName({id: userId, groupId: groupDetail.groupId});
                    debug('groupName', groupName);
                    groupName = Utils.filteredResponsePool(groupName);
                    response = {
                        OK: Constants.SUCCESS_MESSAGE.GROUP_EXISTS,
                        groupId: groupName.groupId,
                        groupName: groupName.groupName,
                        memberIds: groupName.memberIds,
                        memberCount: groupDetail.memberCount,
                        ownerId: groupDetail.ownerId,
                        createdAt: groupDetail.createdAt
                    };
                    return cb(null, response);
                }
            }
            var insertGroupOptions = {
                id: id,
                name: options.name,
                createdAt: createdAt,
                updatedAt: updatedAt,
                userId: userId,
                isName: isName
            };

            var insertGroup = await ChatGroup.insertGroupDetails(insertGroupOptions);
            if (!insertGroup) {
                err = new Error(ErrorConfig.MESSAGE.GROUP_CREATION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            await Promise.each(options.members, async function (member) {
                var currentTime = DataUtils.getEpochMSTimestamp();

                var generatedMemberId = Utils.generateId();
                var memberDetailId = generatedMemberId.uuid;

                var createMemberDetail = {
                    id: memberDetailId,
                    groupId: id,
                    memberId: member.memberId,
                    contactId: member.contactId,
                    isAdmin: 0,
                    memberStartDate: memberStartDate,
                    createdBy: userId,
                    createdAt: currentTime,
                    updatedAt: currentTime
                };
                if (member.memberId === userId) {
                    createMemberDetail.isAdmin = 1;
                }

                createMemberList.push(createMemberDetail);

                debug('insertMemberOption', createMemberDetail);
            });
            var createMemberOption = {
                list: createMemberList
            };
            var createMessageListResponse = await ChatGroup.insertGroupMember(createMemberOption);

            /*      var insertGroupMemberOptions = {
                      members: members,
                      groupId: id,
                      createdAt: createdAt,
                      updatedAt: updatedAt,
                      userId: userId,
                      memberStartDate: memberStartDate
                  };
                  var insertMember = await ChatGroup.insertGroupMember(insertGroupMemberOptions);
                  //debug('insert member', insertMember);*/
            var response = {
                id: id,
                name: name,
                ownerId: userId,
                createdAt: createdAt
            };
            await conn.query('COMMIT;');
            AuditUtils.create(auditOptions);
            return cb(null, response);
        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK;');
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    getGroupMembers: function (options) {
        return new Promise(async function (resolve, reject) {
            try {

                var conn = await connection.getConnection();
                var groupMember = await conn.query('SELECT GROUP_CONCAT(CAST(uuid_from_bin(gm.memberId) as char) SEPARATOR ?) AS members FROM ' +
                  'groupMembers gm WHERE  gm.groupId=uuid_to_bin(?) and gm.status=1', [Constants.STRING_SEPARATOR,
                    options.groupId]);

                groupMember = Utils.filteredResponsePool(groupMember);
                return resolve(groupMember);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.GROUP_CREATION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },

    insertMessageDetail: function (options) {
        return new Promise(async function (resolve, reject) {
            var list = options.list;
            var tempId = options.tempId;

            var convertedList, keys, err;
            await Utils.convertObjectToArrayMD(list, async function (err, response) {
                if (err) {
                    debug('err', err);
                    return reject(err);
                }
                if (options.name === 'groupMessages') {
                    var values = ' (uuid_to_bin(?),(select id from groupMessageReference where uuid=uuid_to_bin(?)),uuid_to_bin(?),' +
                      'uuid_to_bin(?),?,?,uuid_to_bin(?)) ';
                }
                if (options.name === 'messageEncryption') {
                    values = ' (uuid_to_bin(?),(select id from groupMessageReference where uuid=uuid_to_bin(?)),uuid_to_bin(?),' +
                      'uuid_to_bin(?),?,?,uuid_to_bin(?),?,?) ';
                }
                convertedList = response.list;
                keys = response.keys;

                //debug('list', convertedList, 'keys', keys);

                var query = 'insert into ' + options.name + ' (' + keys + ') values';

                /* var values = ' (uuid_to_bin(?),(select id from groupMessageReference where uuid=uuid_to_bin(?)),uuid_to_bin(?),' +
                   'uuid_to_bin(?),?,?,uuid_to_bin(?)) ';*/

                await Promise.each(list, function (value) {
                    query = query + values;
                    query = query + ',';
                });

                query = query.replace(/,\s*$/, '');

                try {
                    var conn = await connection.getConnection();
                    var messageInsterted = await conn.query(query, convertedList);
                    messageInsterted = Utils.isAffectedPool(messageInsterted);

                    debug('Message ----------------------------------', messageInsterted);
                    if (!messageInsterted) {
                        throw err;
                    }
                    return resolve(Constants.OK_MESSAGE);
                } catch (err) {
                    debug('err', err);
                    err = new Error(ErrorConfig.MESSAGE.MESSAGE_CREATION_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    err.data = {tempId: tempId};
                    return reject(err);
                }
            });
        });
    },

    manipulateQuery: function (options) {
        return new Promise(function (resolve, reject) {
            var receivers = options;
            var string = '', values = [];

            _.map(receivers, function (receiver) {
                string += 'uuid_to_bin(?),';
                values.push(receiver.receiverId);
            });
            string = string.replace(/,\s*$/, ' ');
            debug('string', string, 'values', values);
            return resolve({
                string: string,
                values: values
            });
        });
    },

    getDeviceIds: function (options) {
        return new Promise(async function (resolve, reject) {
            try {
                var conn = await connection.getConnection();
                var receiver = await ChatGroup.manipulateQuery(options.receivers);

                var devices = await conn.query(' SELECT deviceId FROM userDeviceMapping where userId IN (' + receiver.string + ')',
                  receiver.values);
                //devices = Utils.filteredResponsePool(devices);
                return resolve(devices);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    insertGroupMessage: function (options) {
        return new Promise(async function (resolve, reject) {
            var err;
            var tempId = options.tempId;
            try {
                var conn = await connection.getConnection();
                var string = '', condition = '';
                var values = [];

                if (options.type === Constants.MESSAGE_TYPE.IMAGE) {
                    string = ',fileName,fileSize,imageString,isDeleted';
                    condition = ',?,?,?,?';
                    values = [options.fileName, options.fileSize, options.imageString, options.isDeleted]
                } else if (options.type === Constants.MESSAGE_TYPE.CSV) {
                    string = ',fileName,fileSize,isDeleted';
                    condition = ',?,?,?';
                    values = [options.fileName, options.fileSize, options.isDeleted]
                }

                var groupMessage = await conn.query('insert into groupMessageReference (UUID,groupId,message,senderId,type,' +
                  ' createdAt,updatedAt,createdBy,updatedBy' + string + ') values (uuid_to_bin(?),uuid_to_bin(?),?,uuid_to_bin(?),?,?,?,' +
                  ' uuid_to_bin(?),uuid_to_bin(?)' + condition + ')', [options.id, options.groupId, options.message,
                    options.userId, options.type, options.createdAt, options.updatedAt, options.userId, options.userId].concat(values));

                groupMessage = Utils.isAffectedPool(groupMessage);

                return resolve(groupMessage);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.MESSAGE_CREATION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                err.data = {tempId: tempId};
                return reject(err);
            }
        });
    },

    validateMessage: function (options) {
        return new Promise(async function (resolve, reject) {
            try {
                var groupId = options.groupId;
                var message = options.message;
                var members = options.members;
                var tempId = options.tempId;
                var type = options.type;
                var err;

                if (DataUtils.isUndefined(groupId)) {
                    err = new Error(ErrorConfig.MESSAGE.GROUP_ID_REQ);
                } else if (DataUtils.isUndefined(type)) {
                    err = new Error(ErrorConfig.MESSAGE.TYPE_REQUIRED);
                } else if (type === Constants.MESSAGE_TYPE.TEXT && DataUtils.isUndefined(message)) {
                    err = new Error(ErrorConfig.MESSAGE.MESSAGE_REQ);
                } else if (!DataUtils.isArray(members)) {
                    err = new Error(ErrorConfig.MESSAGE.MEMBERS_MUST_BE_ARRAY);
                } else if (members.length <= 0) {
                    err = new Error(ErrorConfig.MESSAGE.ATLEAST_ONE_ID_REUQIRED);
                } else if (DataUtils.isUndefined(tempId)) {
                    err = new Error(ErrorConfig.MESSAGE.TEMP_ID_REQ);
                }

                if (err) {
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    return reject(err);
                }

                if (type === Constants.MESSAGE_TYPE.IMAGE) {
                    if (DataUtils.isUndefined(options.fileName)) {
                        err = new Error(ErrorConfig.MESSAGE.FILE_NAME_REQUIRED);
                    } else if (DataUtils.isUndefined(options.fileSize)) {
                        err = new Error(ErrorConfig.MESSAGE.FILE_SIZE_REQUIRED);
                    } else if (options.fileSize / (1024 * 1024) > 4) {
                        err = new Error(ErrorConfig.MESSAGE.FILE_SIZE_MUST_BE_LESS_THAN_4_MB);
                    } else if (DataUtils.isUndefined(options.imageString)) {
                        err = new Error(ErrorConfig.MESSAGE.IMAGE_STRING_REQUIRED);
                    }
                    if (err) {
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        return reject(err);
                    }
                } else if (type === Constants.MESSAGE_TYPE.CSV) {
                    if (DataUtils.isUndefined(options.fileName)) {
                        err = new Error(ErrorConfig.MESSAGE.FILE_NAME_REQUIRED);
                    } else if (DataUtils.isUndefined(options.fileSize)) {
                        err = new Error(ErrorConfig.MESSAGE.FILE_SIZE_REQUIRED);
                    } else if (options.fileSize / (1024 * 1024 * 1024) > 2) {
                        err = new Error(ErrorConfig.MESSAGE.FILE_MUST_BE_LESS_THAN_2_GB);
                    }
                    if (err) {
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        return reject(err);
                    }
                }
                await Promise.each(members, async function (member) {
                    if (DataUtils.isUndefined(member.id)) {
                        err = new Error(ErrorConfig.MESSAGE.MEMBER_ID_REQ);
                    } else if (DataUtils.isUndefined(member.encryptionOption)) {
                        err = new Error(ErrorConfig.MESSAGE.ENCRYPTION_OPTION_REQ);
                    } else if (member.encryptionOption === Constants.CHAT_ENCRYPTION_STATUS.ENCRYPTED && DataUtils.isUndefined(member.encryptionKey)) {
                        err = new Error(ErrorConfig.MESSAGE.ENCRYPTION_KEY_REQ);
                    }
                    if (err) {
                        throw err;
                    }
                });
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    sendMessage: async function (options, auditOptions, errorOptions, cb) {
        var groupId = options.groupId;
        var userId = options.user.id;
        var message = options.message;
        var tempId = options.tempId;
        var createdAt = DataUtils.getEpochMSTimestamp();
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var generatedId = Utils.generateId();
        var id = generatedId.uuid;
        var createMessageList = [];
        var createEncryptionList = [];
        var createIdsList = [];
        var type = options.type;
        var err;
        var chat = require('./chat');

        try {
            var conn = await connection.getConnection();
            await conn.query('START TRANSACTION');
        } catch (err) {
            debug('err', err);
            return cb(err);
        }
        try {
            var validated = await ChatGroup.validateMessage(options);
            var messageOption = {
                id: id,
                groupId: groupId,
                userId: userId,
                createdAt: createdAt,
                updatedAt: updatedAt,
                message: message || '',
                type: type
            };

            if (type === Constants.MESSAGE_TYPE.IMAGE) {
                var storeOption = {
                    Bucket: Constants.SCOPEHUB_CHAT_S3_BUCKET,
                    Key: Constants.CHAT_BUCKET_FOLDER.IMAGES + '/' + options.fileName,
                    Expires: 60 * 60,
                    ACL: 'public-read',
                    ContentType: Constants.CONTENT_TYPE.IMAGE_JPEG
                };

                var url = await chat.generateSignedUrl({storeOption: storeOption, type: 'putObject'});
                debug('url', url);
                messageOption.fileName = options.fileName;
                messageOption.fileSize = options.fileSize;
                messageOption.imageString = options.imageString;
                messageOption.isDeleted = 1;
            } else if (type === Constants.MESSAGE_TYPE.CSV) {
                storeOption = {
                    Bucket: Constants.SCOPEHUB_CHAT_S3_BUCKET,
                    Key: Constants.CHAT_BUCKET_FOLDER.CSV + '/' + options.fileName,
                    Expires: 60 * 60,
                    ACL: 'public-read',
                    ContentType: Constants.CONTENT_TYPE.IMAGE_JPEG
                };

                url = await chat.generateSignedUrl({storeOption: storeOption, type: 'putObject'});
                debug('url', url);
                messageOption.fileName = options.fileName;
                messageOption.fileSize = options.fileSize;
                messageOption.isDeleted = 1;
            }

            debug('messagess=====', messageOption);
            var insertMessage = await ChatGroup.insertGroupMessage(messageOption);
            if (!insertMessage) {
                err = new Error(ErrorConfig.MESSAGE.MESSAGE_CREATION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                err.data = {tempId: tempId};
                throw err;
            }

            //var memberIds = members.members.split(Constants.STRING_SEPARATOR);
            await Promise.each(options.members, async function (member) {
                var currentTime = DataUtils.getEpochMSTimestamp();

                var generatedEncryptionId = Utils.generateId();
                var encryptionDetailId = generatedEncryptionId.uuid;

                var insertEncryptionDetail = {
                    id: encryptionDetailId,
                    messageId: id,
                    groupId: groupId,
                    memberId: member.id,
                    encryptionOption: member.encryptionOption,
                    encryptionKey: member.encryptionKey || '',
                    createdBy: userId,
                    createdAt: currentTime,
                    updatedAt: currentTime
                };

                if (member.id !== userId) {
                    var generatedMessageId = Utils.generateId();
                    var messageDetailId = generatedMessageId.uuid;
                    var insertMessageDetail = {
                        id: messageDetailId,
                        messageId: id,
                        groupId: groupId,
                        createdBy: userId,
                        createdAt: currentTime,
                        updatedAt: currentTime,
                        receiverId: member.id
                    };
                    //insertMessageDetail.receiverId = member.id;
                    createIdsList.push({receiverId: member.id});
                    createMessageList.push(insertMessageDetail);
                }

                createEncryptionList.push(insertEncryptionDetail);

                debug('insertMessageOption', insertMessageDetail);
            });
            var createMessageOption = {
                name: 'groupMessages',
                list: createMessageList,
                tempId: tempId
            };
            var createMessageListResponse = await ChatGroup.insertMessageDetail(createMessageOption);
            if (!createMessageListResponse) {
                err = new Error(ErrorConfig.MESSAGE.MESSAGE_CREATION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                err.data = {tempId: tempId};
                throw err;
            }

            var createMessageEncryptionOption = {
                name: 'messageEncryption',
                list: createEncryptionList,
                tempId: tempId
            };
            var createMessageEncryptionResponse = await ChatGroup.insertMessageDetail(createMessageEncryptionOption);

            if (!createMessageEncryptionResponse) {
                err = new Error(ErrorConfig.MESSAGE.MESSAGE_CREATION_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                err.data = {tempId: tempId};
                throw err;
            }
            await conn.query('COMMIT;');
            if (type === Constants.MESSAGE_TYPE.TEXT) {
                var deviceIds = await ChatGroup.getDeviceIds({receivers: createIdsList});
                debug('device', deviceIds);
                var devices = [];
                _.map(deviceIds, function (device) {
                    devices.push(device.deviceId);
                });
                debug('device', devices);
                var opt = {
                    deviceIds: devices,
                    data: {
                        languageCultureCode: options.user.languageCultureCode || Constants.DEFAULT_LANGUAGE_CULTURE_CODE,
                        id: id,
                        type: 'newMessage',
                        groupId: groupId
                    }
                };

                if (devices.length > 0) {
                    await FirebaseUtils.sendChatId(opt);
                }
            }
            var response = {
                id: id,
                tempId: tempId,
                createdAt: createdAt
            };
            if (type === Constants.MESSAGE_TYPE.IMAGE || type === Constants.MESSAGE_TYPE.CSV) {
                response.url = url
            }
            AuditUtils.create(auditOptions);
            return cb(null, response);
        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK;');
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    getGroupName: async function (options) {
        return new Promise(async function (resolve, reject) {
            try {
                var groupQuery = '';
                var groupValues = [];
                debug('groupId', options.groupId);

                if (DataUtils.isDefined(options.groupId)) {
                    groupQuery = ' and G.id = uuid_to_bin(?) group by G.id ';
                    groupValues.push(options.groupId);
                } else {
                    groupQuery = ' group by G.id HAVING cnt >= 1 OR GM1.isAdmin=1  ';
                }
                var conn = await connection.getConnection();
                var userName = await conn.query('select group_concat(CAST(uuid_from_bin(GM2.memberId) as char)) as memberIds,' +
                  ' CAST(uuid_from_bin(GM2.groupId) as char) as groupId,' +
                  ' group_concat(CONCAT(U.firstName,?,U.lastName)) as memberNames,group_concat(U.chatPublicKey) as chatPublicKeys,' +
                  ' group_concat(CAST(U.profilePicture as char) separator ?) as profilePicture, group_concat(U.colorCode) as colorCode,' +
                  /*' group_concat(U.firstName ) as profilePicture, group_concat(U.colorCode) as colorCode,' +*/
                  ' (SELECT COUNT(*) FROM  groupMessageReference GMR WHERE  GMR.isDeleted=0  AND GMR.groupId=G.id ) AS cnt,GM1.isAdmin' +
                  ' from groups G, groupMembers GM1,groupMembers GM2 ,users U' +
                  ' where GM1.memberId = uuid_to_bin(?) AND' +
                  ' G.id = GM1.groupId and G.isName = 0 and GM2.groupId = G.id AND' +
                  ' GM1.status = 1 and GM2.status = 1 AND' +
                  ' GM2.memberId != GM1.memberId and GM2.memberId not IN' +
                  ' (select inviteeUUID from contacts where inviterUUID = GM1.memberId) AND' +
                  ' U.id = GM2.memberId' + groupQuery, [Constants.SPACE_SEPARATOR, Constants.STRING_SEPARATOR, options.id].concat(groupValues));

                var contactName = await conn.query('select CAST(uuid_from_bin(GM2.groupId) as char) as groupId,' +
                  ' group_concat(CAST(uuid_from_bin(GM2.memberId) as char)) as memberIds,' +
                  ' group_concat(CONCAT(C.firstName,?,C.lastName)) as memberNames,group_concat(U.chatPublicKey) as chatPublicKeys,' +
                  ' group_concat(CAST( U.profilePicture as char) separator ?) as profilePicture, group_concat(U.colorCode) as colorCode,' +
                  /*' group_concat( U.firstName ) as profilePicture, group_concat(U.colorCode) as colorCode,' +*/
                  ' (SELECT COUNT(*) FROM groupMessages GM, groupMessageReference GMR WHERE GM.receiverId=GM1.memberId' +
                  ' AND GMR.isDeleted=0 AND GMR.id=GM.messageId AND GM.isRead=0 AND GM.groupId=G.id AND GM1.status=1) AS count,' +
                  ' IFNULL((SELECT MAX(GMR.createdAt) FROM groupMessages GM, groupMessageReference GMR WHERE (GM.receiverId=GM2.memberId or GMR.senderId=GM2.memberId)' +
                  ' AND GMR.id=GM.messageId AND GM.groupId=G.id),0) AS createdAt,' +
                  ' (SELECT COUNT(*) FROM  groupMessageReference GMR WHERE  GMR.isDeleted=0  AND GMR.groupId=G.id ) AS cnt,GM1.isAdmin' +
                  ' from groups G, groupMembers GM1,groupMembers GM2 , contacts C, users U' +
                  ' where GM1.memberId = uuid_to_bin(?)' +
                  ' and G.id = GM1.groupId and G.isName = 0 and GM2.groupId = G.id AND' +
                  ' GM2.memberId != GM1.memberId and U.id = GM2.memberId AND' +
                  ' C.inviteeUUID = GM2.memberId AND' +
                  ' GM1.status = 1 and GM2.status = 1 AND ' +
                  ' C.inviterUUID = GM1.memberId ' + groupQuery, [Constants.SPACE_SEPARATOR, Constants.STRING_SEPARATOR, options.id].concat(groupValues));
                var response = userName.concat(contactName);

                debug('user', response);
                var group = [];
                await Promise.each(response, async function (contact) {
                    //debug('11', contact.profilePicture.split(','));
                    var index = group.findIndex(a => a.groupId === contact.groupId);
                    if (index !== -1) {
                        var profile = [];
                        contact.profilePicture = contact.profilePicture.split(Constants.STRING_SEPARATOR);
                        contact.colorCode = contact.colorCode.split(',');
                        var c = 0;
                        _.each(contact.profilePicture, function (pic) {
                            profile.push({profilePicture: pic, colorCode: contact.colorCode[c++]})
                        });
                        group[index].groupName = group[index].groupName + ',' + contact.memberNames;
                        group[index].memberIds = group[index].memberIds + ',' + contact.memberIds;
                        group[index].chatPublicKeys = group[index].chatPublicKeys + ',' + contact.chatPublicKeys;
                        group[index].profilePicture = group[index].profilePicture.concat(profile);
                        group[index].count = contact.count;
                        group[index].createdAt = contact.createdAt;
                    } else {
                        profile = [];
                        contact.profilePicture = contact.profilePicture.split(Constants.STRING_SEPARATOR);
                        contact.colorCode = contact.colorCode.split(',');
                        c = 0;
                        _.each(contact.profilePicture, function (pic) {
                            profile.push({profilePicture: pic, colorCode: contact.colorCode[c++]})
                        });
                        group.push({
                            groupId: contact.groupId,
                            groupName: contact.memberNames,
                            memberIds: contact.memberIds,
                            chatPublicKeys: contact.chatPublicKeys,
                            profilePicture: profile,
                            count: contact.count,
                            createdAt: contact.createdAt
                        });
                    }
                });
                /* _.map(group, function (group1) {
                     group1.memberIds = group1.memberIds + ',' + options.id;
                 });*/
                //debug('group23', group);
                return resolve(group);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },


    updateMessage: async function (options) {
        return new Promise(async function (resolve, reject) {
            var err;

            try {
                debug('inside update message');
                var conn = await connection.getConnection();
                var update = await conn.query('UPDATE groupMessageReference GMR , groupMessages GM SET GM.isRead= ?, ' +
                  ' GM.updatedAt = ? WHERE GMR.id=GM.messageId AND GMR.UUID=uuid_to_bin(?) AND GM.receiverId=uuid_to_bin(?)',
                  [options.isRead, options.updatedAt, options.id, options.userId]);

                update = Utils.isAffectedPool(update);
                return resolve(update);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.UPDATE_CHAT_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });

    },

    getChatById: async function (options, errorOptions, cb) {
        var chatId = options.chatId;
        var isRead = options.isRead;
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var err;

        if (DataUtils.isUndefined(chatId)) {
            err = new Error(ErrorConfig.MESSAGE.ID_REQUIRED);
        } else if (DataUtils.isUndefined(isRead)) {
            err = new Error(ErrorConfig.MESSAGE.IS_READ_REQUIRED);
        }

        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }


        try {
            var conn = await connection.getConnection();
            var groupMessage = await conn.query('SELECT CAST(uuid_from_bin(GMR.senderId) as CHAR) as senderId,' +
              ' CAST(uuid_from_bin(GM.receiverId) as CHAR) as receiverId, CAST((uuid_from_bin(GMR.groupId)) as CHAR) as groupId,' +
              ' G.isName,G.name,GMR.message,ME.encryptionOption,ME.encryptionKey,GMR.createdAt,GMR.type,GMR.fileName,GMR.fileSize,' +
              ' GMR.url, CAST(GMR.imageString as CHAR) as imageString' +
              ' FROM groupMessageReference GMR, messageEncryption ME, groupMessages GM, groups G  WHERE G.id = GMR.groupId and ' +
              ' GMR.UUID=uuid_to_bin(?) AND GMR.id=ME.messageId  AND GMR.isDeleted=0 AND GM.messageId = GMR.id AND ' +
              ' GM.receiverId=ME.memberId AND ME.memberId=uuid_to_bin(?)',
              [chatId, options.user.id]);

            groupMessage = Utils.filteredResponsePool(groupMessage);
            if (!groupMessage) {
                err = new Error(ErrorConfig.MESSAGE.CHAT_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }

            var senderName = await conn.query('IF NOT EXISTS(SELECT 1 FROM contacts where inviteeUUID = uuid_to_bin(?) ' +
              ' and inviterUUID = uuid_to_bin(?)) THEN (SELECT firstName from users  where id = uuid_to_bin(?));' +
              ' ELSE (SELECT firstName from contacts  where inviteeUUID = uuid_to_bin(?) and inviterUUID = uuid_to_bin(?)); END IF;',
              [groupMessage.senderId, groupMessage.receiverId, groupMessage.senderId, groupMessage.senderId, groupMessage.receiverId]);

            debug('sender name', senderName);

            groupMessage.senderName = Utils.filteredResponse(senderName).firstName;

            if (groupMessage.isName === 0) {
                var groupName = await ChatGroup.getGroupName({id: options.user.id, groupId: groupMessage.groupId});
                debug('group', groupName);
                groupMessage.name = groupName[0].groupName;
            }

            if (parseInt(isRead) === Constants.MESSAGE_READ_STATUS.READ) {
                var updateOptions = {
                    id: chatId,
                    isRead: Constants.MESSAGE_READ_STATUS.READ,
                    userId: options.user.id,
                    updatedAt: updatedAt
                };
                var isUpdated = await ChatGroup.updateMessage(updateOptions);
                if (!isUpdated) {
                    err = new Error(ErrorConfig.MESSAGE.UPDATE_CHAT_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }
            }
            return cb(null, groupMessage);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    updateUnreadMessage: function (options) {
        return new Promise(async function (resolve, reject) {
            try {
                var conn = await connection.getConnection();
                debug('options', options);
                var updated = await conn.query('UPDATE groupMessages  set isRead=?,updatedAt=? ' +
                  ' where receiverId = uuid_to_bin(?) and isRead=? and groupId=uuid_to_bin(?);',
                  [Constants.MESSAGE_READ_STATUS.READ, options.updatedAt, options.receiverId, Constants.MESSAGE_READ_STATUS.UNREAD,
                      options.groupId]);
                var isUpdated = Utils.isAffectedPool(updated);
                //debug('update', updated);
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);

                err = new Error(ErrorConfig.MESSAGE.UPDATE_CHAT_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;

                return reject(err);
            }
        });
    },

    getChatByGroupId: async function (options, errorOptions, cb) {
        var groupId = options.groupId;
        var timestamp = options.timestamp;
        var count = options.count;
        var limit = Constants.CHAT_MESSAGE_LIMIT;
        var err;

        if (DataUtils.isUndefined(groupId)) {
            err = new Error(ErrorConfig.MESSAGE.GROUP_ID_REQ);
        } else if (DataUtils.isUndefined(timestamp)) {
            err = new Error(ErrorConfig.MESSAGE.TIMESTAMP_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        if (count > 30) {
            limit = parseInt(count);
        }

        try {
            var conn = await connection.getConnection();

            var groupMessage = await conn.query('SELECT CAST(uuid_from_bin(GMR.UUID) as CHAR) as id,CAST(uuid_from_bin(GMR.senderId) as CHAR) as senderId,' +
              ' CAST(uuid_from_bin(GMR.groupId) as CHAR) as groupId,GMR.message,GMR.isEdited,ME.encryptionOption,' +
              ' ME.encryptionKey, GMR.createdAt,GMR.type, GMR.fileName,GMR.fileSize, GMR.url, CAST(GMR.imageString as CHAR) as imageString' +
              ' FROM groupMessageReference GMR , groupMessages GM, messageEncryption ME' +
              ' WHERE GMR.id = GM.messageId AND GMR.id = ME.messageId AND GMR.groupId=ME.groupId AND GMR.groupId = uuid_to_bin(?)' +
              ' AND ((GMR.senderId=uuid_to_bin(?) AND ME.memberId=GMR.senderId) or (GM.receiverId=uuid_to_bin(?) AND ME.memberId=GM.receiverId))' +
              ' AND GMR.createdAt <= ? AND GMR.isDeleted=0 GROUP BY GMR.UUID order by GMR.createdAt desc limit ?',
              [groupId, options.user.id, options.user.id, timestamp - 1, limit]);
            var readOption = {
                groupId: groupId,
                receiverId: options.user.id,
                updatedAt: DataUtils.getEpochMSTimestamp()
            };
            // debug('read', chat);
            var update = await ChatGroup.updateUnreadMessage(readOption);
            debug('update', update);
            return cb(null, groupMessage.reverse());
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    getNameGroup: async function (options, errorOptions, cb) {
        var memberId = options.user.id;

        try {
            var conn = await connection.getConnection();

            var groups = await conn.query('select CAST(uuid_from_bin(GM2.groupId) as char) as groupId,' +
              ' group_concat(CAST(uuid_from_bin(GM2.memberId) as char)) as memberIds, G.name,' +
              '(SELECT COUNT(*) FROM groupMessages GM, groupMessageReference GMR WHERE GM.receiverId=GM1.memberId ' +
              ' AND GMR.isDeleted=0 AND GMR.id=GM.messageId AND GM.isRead=0 AND GM.groupId=G.id AND GM1.status=1) AS count' +
              ' from groups G, groupMembers GM1,groupMembers GM2' +
              ' where GM1.memberId = uuid_to_bin(?) and G.id = GM1.groupId and G.isName = 1 and GM2.groupId = G.id AND' +
              ' GM1.status = 1 and GM2.status = 1 GROUP BY G.id', [memberId]);

            /*  _.map(groups, function (group) {
                  if (DataUtils.isDefined(group.memberId)) {
                      group.memberId = group.memberId.split(',');
                  }
              });*/
            return cb(null, groups);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.GET_GROUP_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    searchNameGroup: async function (options, errorOptions, cb) {
        var query = options.query;
        var memberId = options.user.id;
        var err;
        var string = '';
        var values = [];

       /* if (DataUtils.isUndefined(query)) {
            err = new Error(ErrorConfig.MESSAGE.GROUP_SEARCH_QUERY_REQ);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            debug('err', err);
            return cb(err);
        }*/

        try {
            if (DataUtils.isDefined(query)) {
                query = '%' + query + '%';
                string += ' and G.name like ?';
                values.push(query);
            }

            debug('string',string);
            debug('values',values);
            //query = '%' + query + '%';
            var conn = await connection.getConnection();
            var groupPartner = await conn.query('select CAST(uuid_from_bin(GM2.groupId) as char) as groupId,' +
              ' group_concat(CAST(uuid_from_bin(GM2.memberId) as char)) as memberIds, G.name,' +
              ' (SELECT COUNT(*) FROM groupMessages GM, groupMessageReference GMR WHERE GM.receiverId=GM1.memberId ' +
              ' AND GMR.isDeleted=0 AND GMR.id=GM.messageId AND GM.isRead=0 AND GM.groupId=G.id AND GM1.status=1) AS count' +
              ' from groups G, groupMembers GM1,groupMembers GM2' +
              ' where GM1.memberId = uuid_to_bin(?) and G.id = GM1.groupId and G.isName = 1 and GM2.groupId = G.id AND' +
              ' GM1.status = 1 and GM2.status = 1 ' + string + ' GROUP BY G.id', [memberId].concat(query));
            if (!groupPartner) {
                groupPartner = [];
            }
            /* _.map(groupPartner, function (group) {
                 if (DataUtils.isDefined(group.memberId)) {
                     group.memberId = group.memberId.split(',');
                 }
             });*/
            return cb(null, groupPartner);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.GROUP_SEARCH_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    markGroupMessageAsRead: async function (options, auditOptions, errorOptions, cb) {
        var groupId = options.groupId;
        var senderId = options.user.id;
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var err;

        if (DataUtils.isUndefined(groupId)) {
            err = new Error(ErrorConfig.MESSAGE.GROUP_ID_REQ);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();

            var updated = await conn.query('IF NOT EXISTS (select 1 from groups where id = uuid_to_bin(?)) ' +
              ' THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "GROUP_NOT_FOUND";' +
              ' ELSE UPDATE groupMessageReference GMR , groupMessages GM SET GM.isRead = ?,GM.updatedAt = ? WHERE ' +
              ' GMR.groupId = uuid_to_bin(?) AND GMR.id = GM.messageId AND GMR.STATUS=0 and GM.isRead = ? AND ' +
              ' GM.receiverId = uuid_to_bin(?); end if;',
              [groupId, Constants.MESSAGE_READ_STATUS.READ, updatedAt, groupId, Constants.MESSAGE_READ_STATUS.UNREAD, senderId]);
            debug('upate', updated);
            AuditUtils.create(auditOptions);
            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.GROUP_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else {
                err = new Error(ErrorConfig.MESSAGE.UPDATE_GROUP_MESSAGE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    }


    /*getAll: function (options, cb) {
        var userId = options.userId;
        var conversations = [];
        var err;
        if (DataUtils.isUndefined(userId)) {
            err = new Error(ErrorConfig.MESSAGE.USER_ID_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        ChatGroupModel.query(userId)
          .usingIndex(Constants.CHAT_GROUP_SENDER_INDEX)
          .exec(function (err, data) {
              if (err || !data || !data.Items) {
                  return cb(err);
              }
              data = (_.map(data.Items, 'attrs'));
              conversations = data;

              ChatGroupModel.query(userId)
                .usingIndex(Constants.CHAT_GROUP_RECEIVER_INDEX)
                .exec(function (err, data) {
                    if (err || !data || !data.Items) {
                        return cb(err);
                    }
                    data = (_.map(data.Items, 'attrs'));
                    data.forEach(function (d) {
                        conversations.push(d)
                    });

                    var chatRecordStore = [];
                    Async.eachSeries(conversations, function (chatRecord, cb) {
                        var contactId = chatRecord.contactId;
                        var err;
                        if (DataUtils.isUndefined(contactId)) {
                            err = new Error(ErrorConfig.MESSAGE.CONTACT_ID_REQUIRED);
                            err.status = ErrorConfig.STATUS_CODE.EXPECTATION_FAILED;
                            debug('error', err);
                            return cb(err);
                        }

                        ContactModel.get(contactId, {
                            ConsistentRead: true
                        }, function (err, contact) {
                            if (err || !contact) {
                                err = err || new Error(ErrorConfig.MESSAGE.CONTACT_NOT_FOUND);
                                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                                debug('err', err);
                                return cb(err);
                            }
                            chatRecord.firstName = contact.attrs.firstName;
                            chatRecordStore.push(chatRecord);
                            return cb(err, chatRecord);
                        });
                    }, function (err) {
                        return cb(err, chatRecordStore);
                    });
                });
          });
    },

    getChat: function (options, cb) {
        var chatGroupId = options.chatGroupId;
        if (DataUtils.isUndefined(chatGroupId)) {
            var err = new Error(ErrorConfig.MESSAGE.CHAT_GROUP_ID_REQ);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('err', err);
            return cb(err);
        }
        ChatGroupModel.get(chatGroupId, {
            ConsistentRead: true
        }, function (err, data) {
            if (err || !data) {
                err = err || new Error(ErrorConfig.MESSAGE.CHAT_GROUP_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            var chatGroup = data && data.attrs;

            ContactModel.get(chatGroup.contactId, {
                ConsistentRead: true
            }, function (err, contact) {
                if (err || !contact) {
                    err = err || new Error(ErrorConfig.MESSAGE.CONTACT_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                    debug('err', err);
                    return cb(err);
                }
                chatGroup.firstName = contact.attrs.firstName;
                return cb(err, chatGroup);
            });
        });
    }*/
};
module.exports = ChatGroup;