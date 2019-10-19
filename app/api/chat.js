#!/usr/bin/env node

'use strict';

var _ = require('lodash');

var debug = require('debug')('scopehub.api.chat');
var ErrorConfig = require('../data/error');
var DataUtils = require('../lib/data_utils');
var ErrorUtils = require('../lib/error_utils');
var AuditUtils = require('../lib/audit_utils');
var Utils = require('../lib/utils');
var Promise = require('bluebird');
var Constants = require('../data/constants');
var Async = require('async');
var openpgp = require('openpgp');
var FirebaseUtils = require('../lib/firebase_utils');
var GroupChat = require('../api/chat_group');
var s3 = require('../model/s3_frankfurt');

var connection = require('../lib/connection_util');

var Chat = {
    /**
     * Update chat
     */
    updateChatDetails: function (options) {
        return new Promise(async function (resolve, reject) {
            try {
                var conn = await connection.getConnection();

                var chatData = await conn.query('UPDATE groupMessageReference GMR , groupMessages GM SET GM.isRead= ?, ' +
                  'GM.updatedAt= ? WHERE GMR.id=GM.messageId AND GMR.UUID=uuid_to_bin(?) AND GM.receiverId=uuid_to_bin(?)',
                  [options.isRead, options.updatedAt, options.id, options.receiverId]);

                //var isChatDataAffected = Utils.isAffectedPool(chatData);
                //debug('update123', isChatDataAffected);
                return resolve(chatData);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.UPDATE_CHAT_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                return reject(err);
            }
        });
    },
    /**
     * Get chat by id
     */
    getChatById: async function (options, errorOptions, cb) {
        var chatId = options.chatId;
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var isRead = options.isRead;
        var user = options.user;
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
            var chat = await conn.query('SELECT CAST(uuid_from_bin(GMR.senderId) as CHAR) as senderId,' +
              ' CAST(uuid_from_bin(ME.memberId) as CHAR) as receiverId, CAST(uuid_from_bin(C.contactId) as CHAR) as contactId,' +
              ' GMR.message,GMR.createdAt,ME.encryptionOption,ME.encryptionKey,C.firstName,C.lastName,GMR.type,GMR.fileName,GMR.fileSize,' +
              ' GMR.url, CAST(GMR.imageString as CHAR) as imageString ' +
              ' FROM groupMessageReference GMR, messageEncryption ME , contacts C WHERE GMR.UUID=uuid_to_bin(?) ' +
              ' AND GMR.id=ME.messageId AND C.inviteeUUID = GMR.senderId and C.inviterUUID = ME.memberId AND GMR.isDeleted=0' +
              ' AND ME.memberId=uuid_to_bin(?)', [chatId, user.id]);

            chat = Utils.filteredResponsePool(chat);
            if (!chat) {
                err = new Error(ErrorConfig.MESSAGE.CHAT_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }
            if (parseInt(isRead) === Constants.MESSAGE_READ_STATUS.READ) {
                var updateOptions = {
                    id: chatId,
                    receiverId: user.id,
                    isRead: Constants.MESSAGE_READ_STATUS.READ,
                    updatedAt: updatedAt
                };
                var isUpdated = await Chat.updateChatDetails(updateOptions);
                if (!isUpdated) {
                    err = new Error(ErrorConfig.MESSAGE.UPDATE_CHAT_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    throw err;
                }
            }
            return cb(null, chat);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    /**
     * Update unread message
     */
    updateUnreadMessage: function (options) {
        return new Promise(async function (resolve, reject) {
            try {
                var conn = await connection.getConnection();
                debug('options', options);
                var updated = await conn.query('IF NOT EXISTS (select 1 from contacts where inviteeUUID = uuid_to_bin(?)' +
                  ' and inviterUUID=uuid_to_bin(?))' +
                  'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "CONTACT_NOT_FOUND";' +
                  'ELSE UPDATE groupMessageReference GMR , groupMessages GM SET GM.isRead = ?,GM.updatedAt = ? WHERE GMR.id=GM.messageId AND ' +
                  ' GMR.senderId=uuid_to_bin(?) AND GM.receiverId=uuid_to_bin(?) AND GM.isRead = ? AND GMR.groupId=uuid_to_bin(?) AND GMR.status = ?; end if;',
                  [options.senderId, options.receiverId, Constants.MESSAGE_READ_STATUS.READ, options.updatedAt,
                      options.receiverId, options.senderId, Constants.MESSAGE_READ_STATUS.UNREAD, Constants.DEFAULT_REFERE_ID, Constants.CHAT_CONTACT_STATUS.CONTACT_EXISTS]);
                //var isUpdated = Utils.isAffectedPool(updated);
                //debug('update', updated);
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                if (err.errno === 4001) {
                    err = new Error(ErrorConfig.MESSAGE.CONTACT_NOT_FOUND);
                    err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                } else {
                    err = new Error(ErrorConfig.MESSAGE.UPDATE_CHAT_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                }
                return reject(err);
            }
        });
    },

    /**
     * Get chat by senderId and receiverId
     */
    getChatBySenderAndReceiver: async function (options, errorOptions, cb) {
        var senderId = options.senderId;
        var receiverId = options.receiverId;
        var timestamp = options.timestamp;
        var count = options.count;
        var limit = Constants.CHAT_MESSAGE_LIMIT;
        var err;

        if (DataUtils.isUndefined(senderId)) {
            err = new Error(ErrorConfig.MESSAGE.SENDER_ID_REQ);
        } else if (DataUtils.isUndefined(receiverId)) {
            err = new Error(ErrorConfig.MESSAGE.RECEIVER_ID_REQ);
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
            var chat = await conn.query('SELECT CAST(uuid_from_bin(GMR.UUID) as CHAR) as id,CAST(uuid_from_bin(GMR.senderId) as CHAR) as senderId,' +
              ' CAST(uuid_from_bin(GM.receiverId) as CHAR) as receiverId,GMR.message,ME.encryptionOption,ME.encryptionKey,' +
              ' GMR.isEdited,GMR.createdAt,GMR.type,GMR.fileName,GMR.fileSize,GMR.url,CAST(GMR.imageString as CHAR) as imageString' +
              ' FROM groupMessageReference GMR ,groupMessages GM ,messageEncryption ME ' +
              ' WHERE GMR.id=GM.messageId AND ME.messageId=GMR.id AND' +
              ' ((GMR.senderId=uuid_to_bin(?) AND GM.receiverId=uuid_to_bin(?) AND ME.memberId=GMR.senderId) OR ' +
              ' (GM.receiverId=uuid_to_bin(?) AND GMR.senderId=uuid_to_bin(?) AND ME.memberId=GM.receiverId)) AND' +
              ' GMR.STATUS=? AND GMR.groupId=uuid_to_bin(?) and GMR.createdAt <= ? and GMR.isDeleted=0 order by GMR.createdAt desc limit ?;',
              [senderId, receiverId, senderId, receiverId, Constants.CHAT_CONTACT_STATUS.CONTACT_EXISTS, Constants.DEFAULT_REFERE_ID, timestamp - 1, limit]);

            /*if (!chat) {
                err = new Error(ErrorConfig.MESSAGE.CHAT_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw err;
            }*/
            var readOption = {
                senderId: senderId,
                receiverId: receiverId,
                updatedAt: DataUtils.getEpochMSTimestamp()
            };
            // debug('read', chat);
            var update = await Chat.updateUnreadMessage(readOption);
            return cb(null, chat.reverse());
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    getChatStatusOfUsers: function (options) {
        return new Promise(async function (resolve, reject) {
            var userIds = options.userIds;
            var partners = options.partners;
            try {
                debug('options', options);
                var conn = await connection.getConnection();
                var response = await Chat.manipulateQuery({ids: userIds});
                debug('inside try');
                var loginUsers = await conn.query('SELECT CAST(uuid_from_bin(userId) as CHAR) as userId FROM userDeviceMapping ' +
                  ' where userId in (' + response.string + ') group by userId ', response.values);
                debug('devices', loginUsers.length);
                if (!loginUsers) {
                    return resolve([]);
                }
                var loginUserIds = _.map(loginUsers, 'userId');
                debug('loginUserIds', loginUserIds);
                _.map(partners, function (partner) {
                    if (loginUserIds.indexOf(partner.inviteeUUID) !== -1) {
                        partner.chatStatus = Constants.CHAT_STATUS.ONLINE;
                    } else {
                        partner.chatStatus = Constants.CHAT_STATUS.OFFLINE;
                    }
                });
                debug('partners', partners);
                return resolve(partners);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /**
     * Get all chat parter
     */
    getChatPartners: async function (options, errorOptions, cb) {
        var inviterUUID = options.senderId;

        if (DataUtils.isUndefined(inviterUUID)) {
            var err = new Error(ErrorConfig.MESSAGE.SENDER_ID_REQ);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('error', err);
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            var query = 'SELECT CAST(uuid_from_bin(c1.inviterUUID) as CHAR) as inviterUUID,CAST(uuid_from_bin(c1.contactId) as CHAR) as contactId,' +
              ' CAST(uuid_from_bin(c1.inviteeUUID) as CHAR) as inviteeUUID ,c1.firstName,c1.lastName,c1.inviteeEmail,c1.isChat,c1.status,' +
              '  U.encryptionStatus,U.chatPublicKey,CAST(U.profilePicture as CHAR) as profilePicture,U.colorCode as colorCode,' +
              ' (select count(*) from groupMessages GM, groupMessageReference GMR where GM.isRead=0 AND GMR.id=GM.messageId AND GMR.status=? AND GMR.isDeleted=0' +
              ' AND GMR.senderId=c1.inviteeUUID AND  GM.receiverId=uuid_to_bin(?) and c1.status IN (?,?,?) AND GM.groupId=uuid_to_bin(?)) as count, ' +
              ' IFNULL((SELECT MAX(GMR.createdAt) FROM groupMessages GM, groupMessageReference GMR WHERE GMR.id=GM.messageId' +
              ' AND ((GM.receiverId=uuid_to_bin(?) AND GMR.senderId=c1.inviteeUUID) OR (GM.receiverId=c1.inviteeUUID AND GMR.senderId=uuid_to_bin(?))) AND' +
              ' c1.status IN (?,?,?) and GM.groupId=uuid_to_bin(?)),0) AS createdAt ' +
              ' FROM contacts c1,  contacts c2, users U WHERE c1.inviterUUID=c2.inviteeUUID and c1.inviteeUUID = c2.inviterUUID and c1.inviterUUID=uuid_to_bin(?)' +
              ' and c1.isChat=1 and U.id=c1.inviteeUUID  limit ?;';
            var params = [Constants.CHAT_CONTACT_STATUS.CONTACT_EXISTS, inviterUUID, Constants.CONTACT_STATUS.ACCEPTED, Constants.CONTACT_STATUS.BLOCKED_BY_PARTNER,
                Constants.CONTACT_STATUS.BLOCKED, Constants.DEFAULT_REFERE_ID, inviterUUID, inviterUUID, Constants.CONTACT_STATUS.ACCEPTED, Constants.CONTACT_STATUS.BLOCKED_BY_PARTNER,
                Constants.CONTACT_STATUS.BLOCKED, Constants.DEFAULT_REFERE_ID, inviterUUID, Constants.CHAT_PARTNER_LIMIT];

            var result = await conn.query(query, params);
            var groups = await GroupChat.getGroupName({id: inviterUUID});

            if (!result) {
                result = [];
            }
            if (result.length > 0) {
                var userIds = _.map(result, 'inviteeUUID');
                result = await Chat.getChatStatusOfUsers({
                    userIds: userIds,
                    partners: result
                });
            }

            result = result.concat(groups);
            result = _.orderBy(result, ['createdAt'], ['desc']);
            //debug('result=', result);
            //result = _.sortBy(result, 'createdAt').reverse();
            /*_.map(groups, function (group) {
                result.push(group);
            });*/
            // debug('result=====', result);
            return cb(null, result || []);
        } catch (err) {
            debug('err', err);
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            if (err.code) {
                err = new Error(ErrorConfig.MESSAGE.CHAT_PARTNER_GET_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    /**
     * Get total unread messages
     */
    getUnreadMessagesCount: async function (options, errorOptions, cb) {

        var receiverId = options.receiverId;

        if (DataUtils.isUndefined(receiverId)) {
            var err = new Error(ErrorConfig.MESSAGE.RECEIVER_ID_REQ);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            debug('error', err);
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            /* var query = 'select count(*) as count from chatMessage cM,contacts c1,  contacts c2 where isRead=0 and c2.contactId = cM.contactId ' +
               ' and cM.receiverId=uuid_to_bin(?) AND c1.STATUS in(?,?,?) and c1.inviterUUID=c2.inviteeUUID and c1.inviteeUUID = c2.inviterUUID' +
               ' and c1.inviterUUID=uuid_to_bin(?) UNION SELECT COUNT(*) as count FROM groupMessageReference GM, groupMembers G WHERE ' +
               ' GM.receiverId=G.memberId AND GM.isRead=0 AND G.status=1 AND GM.groupId=G.groupId AND GM.receiverId=uuid_to_bin(?)';
 */
            var query = 'select count(*) as count from groupMessages GM,groupMessageReference GMR,contacts c1,contacts c2' +
              ' where isRead=0  AND GMR.id=GM.messageId AND GMR.senderId=c1.inviteeUUID and GM.receiverId=uuid_to_bin(?) and ' +
              ' GMR.status=? and GMR.isDeleted=0 AND c1.STATUS IN(?,?,?) and c1.inviterUUID=c2.inviteeUUID and ' +
              ' c1.inviteeUUID = c2.inviterUUID and c1.inviterUUID=uuid_to_bin(?) AND GM.groupId = uuid_to_bin(?) UNION ALL' +
              ' SELECT COUNT(*) as count FROM groupMessages GME, groups G, groupMembers GM,groupMessageReference GMR WHERE GME.receiverId=GM.memberId' +
              ' AND GME.isRead=0 AND GME.groupId=G.id AND GM.status=1 AND GME.receiverId=uuid_to_bin(?) AND GM.groupId = G.id AND G.isName=0' +
              ' AND GMR.isDeleted=0 AND GMR.id=GME.messageId';
            var params = [receiverId, Constants.CHAT_CONTACT_STATUS.CONTACT_EXISTS, Constants.CONTACT_STATUS.ACCEPTED, Constants.CONTACT_STATUS.BLOCKED_BY_PARTNER,
                Constants.CONTACT_STATUS.BLOCKED, receiverId, Constants.DEFAULT_REFERE_ID, receiverId];
            //debug('query', query);

            var result = await conn.query(query, params);
            debug('result', result);
            var count = _.sumBy(result, 'count');
            result = {count: count};
            return cb(null, result || []);

        } catch (err) {
            debug('err', err);
            errorOptions.err = err;
            await ErrorUtils.create(errorOptions);
            if (err.code) {
                err = new Error(ErrorConfig.MESSAGE.GET_UNREAD_MESSAGE_COUNT_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },
    /**
     * Search chat partner by name
     */
    searchByName: async function (options, errorOptions, cb) {
        var query = options.query;
        var inviterId = options.inviterId;
        var isActive = options.isActive;
        var condition = '';
        var value = [];
        var err;

        if (DataUtils.isUndefined(query)) {
            err = new Error(ErrorConfig.MESSAGE.CHAT_PARTNER_SEARCH_QUERY_REQ);
        } else if (DataUtils.isUndefined(isActive)) {
            err = new Error(ErrorConfig.MESSAGE.IS_ACTIVE_FIELD_REQUIRED);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            debug('err', err);
            return cb(err);
        }

        try {
            query = '%' + query + '%';
            // debug('active',options.isActive === 1);
            if (parseInt(isActive) === 1) {
                condition = ' and C.status in (?)';
                value.push(Constants.CONTACT_STATUS.ACCEPTED);
            } else {
                condition = ' and C.status in (?,?,?)';
                value.push(Constants.CONTACT_STATUS.ACCEPTED, Constants.CONTACT_STATUS.BLOCKED, Constants.CONTACT_STATUS.BLOCKED_BY_PARTNER);
            }

            debug('condition', condition, 'value', value);
            var conn = await connection.getConnection();

            var chatPartner = await conn.query('select CAST(uuid_from_bin(inviterUUID) as CHAR) as inviterUUID,' +
              ' CAST(uuid_from_bin(C.contactId) as CHAR) as contactId,CAST(uuid_from_bin(C.inviteeUUID) as CHAR) as inviteeUUID,' +
              ' C.firstName,C.lastName,C.inviteeEmail,C.isChat,C.status,CAST(U.profilePicture as char) as profilePicture,U.colorCode' +
              ' from contacts C, users U where (C.firstName like ? or C.lastName like ?) ' +
              ' and C.inviterUUID = uuid_to_bin(?) and U.id = C.inviteeUUID ' + condition, [query, query, inviterId].concat(value));

            if (!chatPartner) {
                chatPartner = [];
            }

            //Get chatPartner with chat status
            if (chatPartner.length > 0) {
                var userIds = _.map(chatPartner, 'inviteeUUID');
                chatPartner = await Chat.getChatStatusOfUsers({
                    userIds: userIds,
                    partners: chatPartner
                });
            }

            var groupPartners = await GroupChat.getGroupName({id: inviterId});
            //debug('groupPartner', groupPartners);
            _.map(groupPartners, function (groupPartner) {
                if (groupPartner.groupName.match(options.query) || groupPartner.groupName.match(options.query.toLowerCase()) ||
                  groupPartner.groupName.match(options.query.toUpperCase())) {
                    chatPartner.push(groupPartner);
                }
            });
            return cb(null, chatPartner);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.CHAT_PARTNER_SEARCH_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    /**
     * Encrypt data
     */
    /*encryptedData: function (options) {
        return new Promise(async function (resolve, reject) {
            var data = {
                message: openpgp.message.fromText(options.message),
                publicKeys: (await openpgp.key.readArmored(options.publicKey)).keys
            };
            try {
                var encrypted = await openpgp.encrypt(data);
                return resolve(encrypted);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },*/

    /**
     * Get contact details
     */
    getContactDetails: function (options) {
        return new Promise(async function (resolve, reject) {
            var senderId = options.senderId;
            var receiverId = options.receiverId;
            try {

                var err;
                var conn = await connection.getConnection();
                var contact = await conn.query('SELECT status,isChat from contacts where ' +
                  'inviterUUID = uuid_to_bin(?) and inviteeUUID = uuid_to_bin(?)', [senderId, receiverId]);
                contact = Utils.filteredResponsePool(contact);

                return resolve(contact);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /**
     * Insert into message reference table
     */
    insertMessageReferenceDetails: function (options) {
        return new Promise(async function (resolve, reject) {
            try {
                var string = '', condition = '';
                var values = [];

                if (options.type === Constants.MESSAGE_TYPE.IMAGE) {
                    string = ',fileName,fileSize,imageString,isDeleted';
                    condition = ',?,?,?,?';
                    values = [options.fileName, options.fileSize, options.imageString, options.isDeleted];
                } else if (options.type === Constants.MESSAGE_TYPE.CSV) {
                    string = ',fileName,fileSize,isDeleted';
                    condition = ',?,?,?';
                    values = [options.fileName, options.fileSize, options.isDeleted];
                }

                var conn = await connection.getConnection();
                var MessageReference = await conn.query('insert into groupMessageReference (UUID, senderId ,message,type, createdAt , updatedAt ,' +
                  ' createdBy,updatedBy' + string + ') values (uuid_to_bin(?),uuid_to_bin(?),?,?,?,?,uuid_to_bin(?),uuid_to_bin(?)' + condition + ')',
                  [options.UUID, options.senderId, options.message, options.type, options.createdAt, options.updatedAt,
                      options.createdBy, options.updatedBy].concat(values));

                MessageReference = Utils.isAffectedPool(MessageReference);
                return resolve(MessageReference);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.INSERT_CHAT_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                err.data = {tempId: options.tempId};
                return reject(err);
            }
        });
    },

    /**
     * Insert into message table
     */
    insertMessageDetails: function (options) {
        return new Promise(async function (resolve, reject) {
            try {
                var generatedId = Utils.generateId();
                var id = generatedId.uuid;
                var conn = await connection.getConnection();
                var messageData = await conn.query('INSERT INTO groupMessages (id,messageId,receiverId,createdAt,updatedAt,createdBy,updatedBy) VALUES ' +
                  '(uuid_to_bin(?),(SELECT id FROM groupMessageReference WHERE UUID=uuid_to_bin(?)),uuid_to_bin(?),?,?,uuid_to_bin(?),uuid_to_bin(?))',
                  [id, options.UUID, options.receiverId, options.createdAt, options.updatedAt, options.createdBy, options.updatedBy]);

                messageData = Utils.isAffectedPool(messageData);
                return resolve(messageData);
            } catch (err) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.INSERT_CHAT_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                err.data = {tempId: options.tempId};
                return reject(err);
            }
        });
    },

    /**
     * Insert into message encryption table
     */
    insertEncryptionDetails: function (options) {
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

                var query = 'insert into messageEncryption (' + keys + ') values';

                var values = ' (uuid_to_bin(?),(SELECT id FROM groupMessageReference WHERE UUID=uuid_to_bin(?)),' +
                  'uuid_to_bin(?),?,?,uuid_to_bin(?),uuid_to_bin(?),?,?)';

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
                    err = new Error(ErrorConfig.MESSAGE.INSERT_CHAT_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    err.data = {tempId: options.tempId};
                    return reject(err);
                }
            });
        });
    },
    /**
     * update chat flag in contacts
     */
    updateChatInContacts: function (options) {
        return new Promise(async function (resolve, reject) {
            try {
                debug('inside a update', options);
                var conn = await connection.getConnection();
                var updated = await conn.query('IF (select isChat from contacts where (inviterUUID = uuid_to_bin(?) and inviteeUUID = uuid_to_bin(?))) = 0' +
                  ' THEN update contacts set isChat=1,updatedAt=? where (inviterUUID = uuid_to_bin(?) and inviteeUUID = uuid_to_bin(?));end if ',
                  [options.senderId, options.receiverId, options.updatedAt, options.senderId, options.receiverId]);
                //debug('update12', updated);
                var isUpdated = await conn.query('IF (select isChat from contacts where (inviterUUID = uuid_to_bin(?) and inviteeUUID = uuid_to_bin(?))) = 0 ' +
                  'THEN update contacts set isChat=1,updatedAt=? where (inviterUUID = uuid_to_bin(?) and inviteeUUID = uuid_to_bin(?)); end if',
                  [options.receiverId, options.senderId, options.updatedAt, options.receiverId, options.senderId]);
                //var isUpdated = Utils.isAffectedPool(updated);
                //debug('update34', isUpdated);
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },
    /**
     * Get device ids
     */
    getDeviceIds: function (options) {
        return new Promise(async function (resolve, reject) {
            try {
                var conn = await connection.getConnection();
                debug('inside try');
                var devices = await conn.query('SELECT deviceId FROM userDeviceMapping where userId = uuid_to_bin(?)', options.userId);
                //devices = Utils.filteredResponsePool(devices);
                return resolve(devices);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /**
     * Get receiver contact details
     */
    getReceiverContactDetails: function (options) {
        return new Promise(async function (resolve, reject) {
            try {
                var conn = await connection.getConnection();
                debug('inside try');
                var receiverContact = await conn.query('SELECT CAST(uuid_from_bin(contactId) AS CHAR) as contactId,isChat FROM ' +
                  'contacts where inviterUUID = uuid_to_bin(?) and inviteeUUID = uuid_to_bin(?)', [options.receiverId, options.senderId]);
                receiverContact = Utils.filteredResponsePool(receiverContact);
                return resolve(receiverContact);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    validateMessage: function (options) {
        return new Promise(async function (resolve, reject) {
            try {

                var message = options.message;
                var members = options.members;
                var tempId = options.tempId;
                var type = options.type;
                var err;
                if (DataUtils.isUndefined(type)) {
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

    /**
     * Generate signed url for image
     */
    generateSignedUrl: function (options) {
        return new Promise(function (resolve, reject) {
            s3.getSignedUrl(options.type, options.storeOption, async function (err, url) {
                if (err) {
                    debug('err', err);
                    err = new Error(ErrorConfig.MESSAGE.CREATE_PRE_SIGNED_URL_FAILED);
                    err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                    return reject(err);
                }
                return resolve(url);
            });
        });
    },

    /**
     * Create chat
     */
    create: async function (options, auditOptions, errorOptions, cb) {
        var message = options.message;
        var user = options.user;
        var members = options.members;
        var parentId = options.parentId;
        var tempId = options.tempId;
        var type = options.type;
        var generatedId = Utils.generateId();
        var id = generatedId.uuid;
        var createdAt = DataUtils.getEpochMSTimestamp();
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var receiverId;
        var createMessageEncryptionList = [];
        var err;

        try {
            var conn = await connection.getConnection();
            await conn.query('START TRANSACTION');
            var validateMessage = await Chat.validateMessage(options);

            _.map(members, function (member) {
                if (member.id !== user.id) {
                    receiverId = member.id;
                }
            });

            var contactOption = {
                senderId: user.id,
                receiverId: receiverId
            };
            var contact = await Chat.getContactDetails(contactOption);
            debug('contact', contact);
            if (!contact) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_ID_INVALID);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            } else if (contact.status === Constants.CONTACT_STATUS.BLOCKED || contact.status === Constants.CONTACT_STATUS.BLOCKED_BY_PARTNER) {
                err = new Error(ErrorConfig.MESSAGE.BLOCK_CONTACT_NOT_ALLOWED_FOR_CHAT);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }

            var messageReferenceOptions = {
                UUID: id,
                senderId: user.id,
                parentId: parentId || 0,
                message: message || '',
                type: type,
                createdAt: createdAt,
                updatedAt: updatedAt,
                createdBy: user.id,
                updatedBy: user.id,
                tempId: tempId
            };

            if (type === Constants.MESSAGE_TYPE.IMAGE) {
                var storeOption = {
                    Bucket: Constants.SCOPEHUB_CHAT_S3_BUCKET,
                    Key: Constants.CHAT_BUCKET_FOLDER.IMAGES + '/' + options.fileName,
                    Expires: 60 * 60,
                    ACL: 'public-read',
                    ContentType: Constants.CONTENT_TYPE.IMAGE_JPEG
                };

                var url = await Chat.generateSignedUrl({storeOption: storeOption, type: 'putObject'});
                debug('url', url);
                messageReferenceOptions.fileName = options.fileName;
                messageReferenceOptions.fileSize = options.fileSize;
                messageReferenceOptions.imageString = options.imageString;
                messageReferenceOptions.isDeleted = 1;
            } else if (type === Constants.MESSAGE_TYPE.CSV) {
                storeOption = {
                    Bucket: Constants.SCOPEHUB_CHAT_S3_BUCKET,
                    Key: Constants.CHAT_BUCKET_FOLDER.CSV + '/' + options.fileName,
                    Expires: 60 * 60,
                    ACL: 'public-read',
                    ContentType: Constants.CONTENT_TYPE.TEXT_CSV
                };

                url = await Chat.generateSignedUrl({storeOption: storeOption, type: 'putObject'});
                debug('url', url);
                messageReferenceOptions.fileName = options.fileName;
                messageReferenceOptions.fileSize = options.fileSize;
                messageReferenceOptions.isDeleted = 1;
            }
            debug('MR', messageReferenceOptions);
            //insert record in message reference
            var messageReference = await Chat.insertMessageReferenceDetails(messageReferenceOptions);
            if (!messageReference) {
                err = new Error(ErrorConfig.MESSAGE.INSERT_CHAT_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                err.data = {tempId: tempId};
                throw err;
            }

            var messageOptions = {
                UUID: id,
                receiverId: receiverId,
                createdAt: createdAt,
                updatedAt: updatedAt,
                createdBy: user.id,
                updatedBy: user.id,
                tempId: tempId
            };
            debug('M', messageOptions);
            //insert record in message
            var messageInsert = await Chat.insertMessageDetails(messageOptions);
            if (!messageInsert) {
                err = new Error(ErrorConfig.MESSAGE.INSERT_CHAT_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                err.data = {tempId: tempId};
                throw err;
            }
            var index = members.findIndex(member => member.encryptionOption === 0);

            await Promise.each(members, async function (member) {
                var currentTime = DataUtils.getEpochMSTimestamp();
                var generatedId = Utils.generateId();
                var encryptionId = generatedId.uuid;

                var insertMessageDetail = {
                    id: encryptionId,
                    messageId: id,
                    memberId: member.id,
                    encryptionOption: member.encryptionOption,
                    encryptionKey: member.encryptionKey || '',
                    createdBy: user.id,
                    updatedBy: user.id,
                    createdAt: currentTime,
                    updatedAt: currentTime
                };
                if (index !== -1) {
                    insertMessageDetail.encryptionOption = 0;
                    insertMessageDetail.encryptionKey = '';
                }
                createMessageEncryptionList.push(insertMessageDetail);

                debug('insertMessageOption', insertMessageDetail);
            });
            var createMessageEncryptionOption = {
                list: createMessageEncryptionList,
                tempId: tempId
            };
            var encryptionDetail = await Chat.insertEncryptionDetails(createMessageEncryptionOption);
            debug('encryption', encryptionDetail);

            if (!encryptionDetail) {
                err = new Error(ErrorConfig.MESSAGE.INSERT_CHAT_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                err.data = {tempId: tempId};
                throw err;
            }

            var receiverOptions = {
                senderId: user.id,
                receiverId: receiverId
            };
            var receiverContact = await Chat.getReceiverContactDetails(receiverOptions);
            if (!receiverContact) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_ID_INVALID);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                throw err;
            }
            debug('receiver contact', receiverContact.contactId);
            //update chat option in contact
            if (contact.isChat === 0 || receiverContact.isChat === 0) {
                var updateOptions = {
                    senderId: user.id,
                    receiverId: receiverId,
                    updatedAt: updatedAt
                };
                var update = await Chat.updateChatInContacts(updateOptions);
                debug('update', update);
            }

            //commit changes
            await conn.query('commit;');
            if (type === Constants.MESSAGE_TYPE.TEXT) {
                var deviceIds = await Chat.getDeviceIds({userId: receiverId});
                var devices = [];
                _.map(deviceIds, function (device) {
                    devices.push(device.deviceId);
                });
                var opt = {
                    deviceIds: devices,
                    data: {
                        languageCultureCode: user.languageCultureCode || Constants.DEFAULT_LANGUAGE_CULTURE_CODE,
                        id: id,
                        type: 'newMessage',
                        contactId: receiverContact.contactId
                        //message: message
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
                response.url = url;
            }
            AuditUtils.create(auditOptions);
            return cb(null, response);
        } catch (err) {
            debug('err ', err);
            await conn.query('rollback;');
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    /**
     * Update Image Url
     */
    updateImageUrl: function (options) {
        return new Promise(async function (resolve, reject) {
            try {
                var conn = await connection.getConnection();
                var query = '';
                var values = [];
                if (DataUtils.isDefined(options.createdAt)) {
                    query = 'createdAt = ?,';
                    values.push(options.createdAt);
                }
                debug('inside try', typeof options.url);
                var update = await conn.query('UPDATE groupMessageReference SET url=?, isDeleted=?,' + query + ' updatedAt=? ' +
                  'WHERE UUID=uuid_to_bin(?)',
                  [options.url, options.isDeleted].concat(values).concat(options.updatedAt, options.chatId));

                update = Utils.isAffectedPool(update);
                return resolve(update);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /**
     * Get file Name
     */
    getFileName: function (options) {
        return new Promise(async function (resolve, reject) {
            try {
                var conn = await connection.getConnection();

                var fileName = await conn.query('SELECT fileName,type from groupMessageReference where UUID = uuid_to_bin(?)',
                  [options.chatId]);

                fileName = Utils.filteredResponsePool(fileName);
                return resolve(fileName);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },


    /**
     * Get upload url
     */
    getUploadUrl: async function (options, errorOptions, cb) {
        var user = options.user;
        var chatId = options.chatId;
        var err;

        if (DataUtils.isUndefined(chatId)) {
            err = new Error(ErrorConfig.MESSAGE.ID_REQUIRED);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var fileName = await Chat.getFileName({chatId: chatId});

            if (!fileName) {
                err = new Error(ErrorConfig.MESSAGE.CHAT_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }
            if (fileName.type === Constants.MESSAGE_TYPE.IMAGE) {
                var storeOption = {
                    Bucket: Constants.SCOPEHUB_CHAT_S3_BUCKET,
                    Key: Constants.CHAT_BUCKET_FOLDER.IMAGES + '/' + options.fileName,
                    Expires: 60 * 60,
                    ACL: 'public-read',
                    ContentType: Constants.CONTENT_TYPE.IMAGE_JPEG
                };
            } else if (fileName.type === Constants.MESSAGE_TYPE.CSV) {
                storeOption = {
                    Bucket: Constants.SCOPEHUB_CHAT_S3_BUCKET,
                    Key: Constants.CHAT_BUCKET_FOLDER.CSV + '/' + options.fileName,
                    Expires: 60 * 60,
                    ACL: 'public-read',
                    ContentType: Constants.CONTENT_TYPE.IMAGE_JPEG
                };
            }
            var url = await Chat.generateSignedUrl({
                storeOption: storeOption,
                type: 'putObject'
            });

            var response = {
                id: chatId,
                url: url
            };
            return cb(null, response);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    /**
     * Get chat image url
     */
    getChatImageUrl: async function (options, errorOptions, cb) {
        var user = options.user;
        var chatId = options.chatId;
        var isRegenerate = options.isRegenerate;
        var currentTime = DataUtils.getEpochMSTimestamp();
        var err;

        if (DataUtils.isUndefined(chatId)) {
            err = new Error(ErrorConfig.MESSAGE.ID_REQUIRED);
        } else if (DataUtils.isUndefined(isRegenerate)) {
            err = new Error(ErrorConfig.MESSAGE.IS_REGENERATE_REQ);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            var receivers = await Chat.getAllReceivers({
                chatId: chatId
            });
            debug('receivers', receivers);
            if (!receivers) {
                err = new Error(ErrorConfig.MESSAGE.CHAT_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                return cb(err);
            }

            var fileName = await Chat.getFileName({chatId: chatId});
            if (fileName.type === Constants.MESSAGE_TYPE.IMAGE) {
                var storeOption = {
                    Bucket: Constants.SCOPEHUB_CHAT_S3_BUCKET,
                    Key: Constants.CHAT_BUCKET_FOLDER.IMAGES + '/' + fileName.fileName,
                    Expires: 7 * 24 * 60 * 60
                };
            } else if (fileName.type === Constants.MESSAGE_TYPE.CSV) {
                storeOption = {
                    Bucket: Constants.SCOPEHUB_CHAT_S3_BUCKET,
                    Key: Constants.CHAT_BUCKET_FOLDER.CSV + '/' + fileName.fileName,
                    Expires: 7 * 24 * 60 * 60
                };
            }
            var url = await Chat.generateSignedUrl({
                storeOption: storeOption,
                type: 'getObject'
            });


            if (url) {
                if (parseInt(isRegenerate) === 0) {
                    var updateOptions = {
                        chatId: chatId,
                        url: url,
                        isDeleted: 0,
                        createdAt: currentTime,
                        updatedAt: currentTime
                    };
                    var update = await Chat.updateImageUrl(updateOptions);
                    if (!update) {
                        err = new Error(ErrorConfig.MESSAGE.UPDATE_CHAT_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        return cb(err);
                    }
                    var notificationOption = {
                        contacts: receivers,
                        user: user,
                        chatId: chatId
                    };
                    if (fileName.type === Constants.MESSAGE_TYPE.IMAGE) {
                        notificationOption.type = 'newMessage/image';
                    } else if (fileName.type === Constants.MESSAGE_TYPE.CSV) {
                        notificationOption.type = 'newMessage/csv';
                    }
                    var notification = await Chat.sendNotificationForMessage(notificationOption);
                } else {
                    updateOptions = {
                        chatId: chatId,
                        url: url,
                        isDeleted: 0,
                        updatedAt: currentTime
                    };
                    update = await Chat.updateImageUrl(updateOptions);
                    if (!update) {
                        err = new Error(ErrorConfig.MESSAGE.UPDATE_CHAT_FAILED);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        return cb(err);
                    }
                }
            }
            var response = {
                id: chatId
            };
            if (parseInt(isRegenerate) !== 0) {
                response.url = url;
            }

            return cb(null, response);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    manipulateQuery: function (options) {
        return new Promise(function (resolve, reject) {
            var Ids = options.ids;
            var string = '', values = [];

            _.map(Ids, function (id) {
                string += 'uuid_to_bin(?),';
                values.push(id);
            });
            string = string.replace(/,\s*$/, ' ');
            debug('string', string, 'values', values);
            return resolve({
                string: string,
                values: values
            });
        });
    },

    /**
     * Delete message
     */
    deleteMessage: async function (options, auditOptions, errorOptions, cb) {
        var Ids = options.ids;
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var user = options.user;
        var err;

        if (!DataUtils.isArray(Ids)) {
            err = new Error(ErrorConfig.MESSAGE.ID_MUST_BE_ARRAY);
        } else if (Ids.length <= 0) {
            err = new Error(ErrorConfig.MESSAGE.ATLEAST_ONE_ID_REUQIRED);
        }

        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
        try {
            var conn = await connection.getConnection();

            var chatIds = await Chat.manipulateQuery({ids: Ids});
            var update = await conn.query('UPDATE groupMessageReference GMR, groupMessages GM set GMR.isDeleted = 1,GMR.updatedAt = ? ' +
              'WHERE GMR.id=GM.messageId AND GMR.senderId=uuid_to_bin(?) AND GMR.UUID in (' + chatIds.string + ')',
              [updatedAt, user.id].concat(chatIds.values));

            debug('update', update);
            if (!update) {
                err = new Error(ErrorConfig.MESSAGE.DELETE_MESSAGE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                throw  err;
            }
            await Promise.each(Ids, async function (id) {
                var contacts = await Chat.getAllReceivers({chatId: id});

                debug('contacts=======', contacts);

                var notificationOption = {
                    contacts: contacts,
                    user: user,
                    chatId: id,
                    type: 'delete'
                };
                var notification = await Chat.sendNotificationForMessage(notificationOption);
                //debug('notification===========', notification);
            });

            AuditUtils.create(auditOptions);
            return cb(null, {OK: Constants.SUCCESS_MESSAGE.MESSAGE_DELETED_SUCCESSFULLY});
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.DELETE_MESSAGE_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },

    /**
     * get old Message
     */
    getOldMessage: function (option) {
        return new Promise(async function (resolve, reject) {
            try {
                var conn = await connection.getConnection();

                var oldMessage = await conn.query('SELECT GMR.id,GMR.message,MAX(OM.version) as version FROM groupMessageReference GMR,' +
                  ' oldMessages OM WHERE GMR.id=OM.messageId and GMR.UUID=uuid_to_bin(?) and GMR.senderId=uuid_to_bin(?) ', [option.chatId, option.senderId]);
                oldMessage = Utils.filteredResponsePool(oldMessage);

                if (DataUtils.isUndefined(oldMessage.id) || DataUtils.isUndefined(oldMessage.message) || DataUtils.isUndefined(oldMessage.version)) {
                    oldMessage = await conn.query('SELECT id,message FROM groupMessageReference WHERE UUID=uuid_to_bin(?)' +
                      ' and senderId=uuid_to_bin(?)', [option.chatId, option.senderId]);
                    oldMessage = Utils.filteredResponsePool(oldMessage);
                }

                return resolve(oldMessage);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /**
     * Insert into old message
     */
    insertOldMessage: function (options) {
        return new Promise(async function (resolve, reject) {
            try {
                var conn = await connection.getConnection();

                var oldMessage = await conn.query('insert into oldMessages (id,messageId,message,version,createdBy,createdAt)' +
                  'values (uuid_to_bin(?),?,?,?,uuid_to_bin(?),?)', [options.id, options.messageId, options.message, options.version + 1,
                    options.createdBy, options.createdAt]);
                oldMessage = Utils.isAffectedPool(oldMessage);
                return resolve(oldMessage);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    updateNewMessage: function (option) {
        return new Promise(async function (resolve, reject) {
            try {
                var conn = await connection.getConnection();

                var update = await conn.query('UPDATE groupMessageReference SET message=?,isEdited=1, updatedAt=? WHERE UUID=uuid_to_bin(?)' +
                  ' AND senderId=uuid_to_bin(?)', [option.message, option.updatedAt, option.chatId, option.userId]);
                debug('update', update);

                return resolve(update);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    getAllReceivers: function (option) {
        return new Promise(async function (resolve, reject) {
            try {
                var conn = await connection.getConnection();

                var contacts = await conn.query('SELECT CAST(uuid_from_bin(GM.groupId) as CHAR) as groupId ,group_concat(CAST(uuid_from_bin(GM.receiverId) as CHAR)) AS receiverId' +
                  ' FROM groupMessages GM, groupMessageReference GMR WHERE GM.messageId = GMR.id AND GMR.UUID = uuid_to_bin(?) ',
                  option.chatId);

                contacts = Utils.filteredResponsePool(contacts);

                return resolve(contacts);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    sendNotificationForMessage: function (option) {
        return new Promise(async function (resolve, reject) {
            try {
                var contacts = option.contacts;
                var err;
                if (contacts.groupId !== Constants.DEFAULT_REFERE_ID) {
                    var receivers = [];

                    _.map(contacts.receiverId.split(','), function (receiver) {
                        receivers.push({receiverId: receiver});
                    });

                    var deviceIds = await GroupChat.getDeviceIds({receivers: receivers});
                    debug('device', deviceIds);
                    var devices = [];
                    _.map(deviceIds, function (device) {
                        devices.push(device.deviceId);
                    });

                    var opt = {
                        deviceIds: devices,
                        data: {
                            languageCultureCode: option.user.languageCultureCode || Constants.DEFAULT_LANGUAGE_CULTURE_CODE,
                            id: option.chatId,
                            type: option.type,
                            groupId: contacts.groupId
                        }
                    };
                } else {
                    debug('=====================================');
                    var receiverOptions = {
                        senderId: option.user.id,
                        receiverId: contacts.receiverId
                    };
                    var receiverContact = await Chat.getReceiverContactDetails(receiverOptions);
                    if (!receiverContact) {
                        err = new Error(ErrorConfig.MESSAGE.CONTACT_ID_INVALID);
                        err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
                        throw err;
                    }
                    debug('receiver contact', receiverContact.contactId);
                    //update chat option in contact

                    deviceIds = await Chat.getDeviceIds({userId: contacts.receiverId});
                    devices = [];
                    _.map(deviceIds, function (device) {
                        devices.push(device.deviceId);
                    });
                    opt = {
                        deviceIds: devices,
                        data: {
                            languageCultureCode: option.user.languageCultureCode || Constants.DEFAULT_LANGUAGE_CULTURE_CODE,
                            id: option.chatId,
                            type: option.type,
                            contactId: receiverContact.contactId
                        }
                    };
                }
                if (devices.length > 0) {
                    await FirebaseUtils.sendChatId(opt);
                }
                return resolve(Constants.OK_MESSAGE);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    /**
     * Update message
     */
    updateMessage: async function (options, auditOptions, errorOptions, cb) {
        var chatId = options.chatId;
        var message = options.message;
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var createdAt = DataUtils.getEpochMSTimestamp();
        var generatedId = Utils.generateId();
        var id = generatedId.uuid;
        var user = options.user;
        var err;

        if (DataUtils.isUndefined(chatId)) {
            err = new Error(ErrorConfig.MESSAGE.ID_REQUIRED);
        } else if (DataUtils.isUndefined(message)) {
            err = new Error(ErrorConfig.MESSAGE.MESSAGE_REQ);
        }
        if (err) {
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();
            await conn.query('START TRANSACTION');

            var messageDetails = await Chat.getOldMessage({chatId: chatId, senderId: user.id});
            if (!messageDetails) {
                err = new Error(ErrorConfig.MESSAGE.CHAT_NOT_FOUND);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                await ErrorUtils.create(errorOptions, options, err);
                throw err;
            }
            var oldMessageOptions = {
                id: id,
                message: messageDetails.message,
                messageId: messageDetails.id,
                createdAt: createdAt,
                version: messageDetails.version || 0,
                createdBy: user.id
            };
            var oldMessage = await Chat.insertOldMessage(oldMessageOptions);
            if (!oldMessage) {
                debug('err', err);
                err = new Error(ErrorConfig.MESSAGE.INSERT_CHAT_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                await ErrorUtils.create(errorOptions, options, err);
                throw err;
            }
            var updateMessageOption = {
                message: message,
                userId: user.id,
                updatedAt: updatedAt,
                chatId: chatId
            };
            var update = await Chat.updateNewMessage(updateMessageOption);
            if (!update) {
                err = new Error(ErrorConfig.MESSAGE.UPDATE_MESSAGE_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
                await ErrorUtils.create(errorOptions, options, err);
                throw err;
            }

            await conn.query('COMMIT');

            var contacts = await Chat.getAllReceivers({chatId: chatId});

            debug('contacts=======', contacts);

            var notificationOption = {
                contacts: contacts,
                user: user,
                type: 'edit',
                chatId: chatId
            };
            var notification = await Chat.sendNotificationForMessage(notificationOption);
            //debug('notification===========', notification);
            AuditUtils.create(auditOptions);
            return cb(null, {
                OK: Constants.SUCCESS_MESSAGE.MESSAGE_UPDATED_SUCCESSFULLY,
                id: chatId,
                updatedAt: updatedAt
            });
        } catch (err) {
            debug('err', err);
            await conn.query('ROLLBACK');
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }
    },


    /**
     * update chat
     */
    update: async function (options, auditOptions, errorOptions, cb) {
        var receiverId = options.receiverId;
        var senderId = options.user.id;
        var updatedAt = DataUtils.getEpochMSTimestamp();
        var err;

        if (DataUtils.isUndefined(receiverId)) {
            err = new Error(ErrorConfig.MESSAGE.RECEIVER_ID_REQ);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            await ErrorUtils.create(errorOptions, options, err);
            return cb(err);
        }

        try {
            var conn = await connection.getConnection();

            var updated = await conn.query('IF NOT EXISTS (select 1 from contacts where inviteeUUID = uuid_to_bin(?)' +
              ' and inviterUUID=uuid_to_bin(?))' +
              'THEN SIGNAL SQLSTATE "45000" SET MYSQL_ERRNO = 4001,MESSAGE_TEXT = "CONTACT_NOT_FOUND";' +
              'ELSE UPDATE groupMessageReference GMR , groupMessages GM SET GM.isRead = ?,GM.updatedAt = ? WHERE GMR.id=GM.messageId AND ' +
              ' GMR.senderId=uuid_to_bin(?) AND GM.receiverId=uuid_to_bin(?) AND GM.isRead = ? AND GMR.groupId=uuid_to_bin(?) AND GMR.status = 0; end if;',
              [senderId, receiverId, Constants.MESSAGE_READ_STATUS.READ, updatedAt,
                  receiverId, senderId, Constants.MESSAGE_READ_STATUS.UNREAD, Constants.DEFAULT_REFERE_ID]);
            debug('upate', updated);
            AuditUtils.create(auditOptions);
            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err', err);
            await ErrorUtils.create(errorOptions, options, err);
            if (err.errno === 4001) {
                err = new Error(ErrorConfig.MESSAGE.CONTACT_ID_INVALID);
                err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            } else {
                err = new Error(ErrorConfig.MESSAGE.UPDATE_CHAT_FAILED);
                err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            }
            return cb(err);
        }
    },

    /**
     * Update message status when contact deleted
     */
    updateChatMessageStatus: function (options) {
        return new Promise(async function (resolve, reject) {
            try {
                var conn = await connection.getConnection();
                debug('options123', options);
                var updated = await conn.query('UPDATE groupMessageReference GMR , groupMessages GM SET GMR.STATUS = ?, GMR.updatedAt = ?' +
                  ' WHERE GMR.id=GM.messageId and ((GMR.senderId=uuid_to_bin(?) AND GM.receiverId=uuid_to_bin(?)) OR (GM.receiverId=uuid_to_bin(?) AND GMR.senderId=uuid_to_bin(?)))' +
                  ' AND GMR.STATUS = ? AND GMR.groupId=uuid_to_bin(?)',
                  [Constants.CHAT_CONTACT_STATUS.CONTACT_DELETED, options.updatedAt, options.inviterUUID, options.inviteeUUID,
                      options.inviterUUID, options.inviteeUUID, Constants.CHAT_CONTACT_STATUS.CONTACT_EXISTS, Constants.DEFAULT_REFERE_ID]);
                //var isUpdated = Utils.isAffectedPool(updated);
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

    /**
     * Get device ids for multiple users
     */
    getDeviceIdForMultipleUsers: function (options) {
        return new Promise(async function (resolve, reject) {
            var receiverIds = options.receiverIds;
            try {
                var conn = await connection.getConnection();
                var response = await Chat.manipulateQuery({ids: receiverIds});
                debug('inside try');
                var devices = await conn.query('SELECT deviceId FROM userDeviceMapping where userId in (' + response.string + ') ', response.values);
                debug('devices', devices.length);
                return resolve(devices);
            } catch (err) {
                debug('err', err);
                return reject(err);
            }
        });
    },

    sendTypingStatus: async function (options, errorOptions, cb) {
        var groupId = options.groupId;
        var user = options.user;
        var receiverIds = options.receiverIds;
        var isTyping = options.isTyping;
        var err;

        if (DataUtils.isUndefined(receiverIds)) {
            err = new Error(ErrorConfig.MESSAGE.RECEIVER_IDS_REQ);
        } else if (DataUtils.isDefined(receiverIds) && !DataUtils.isArray(receiverIds)) {
            err = new Error(ErrorConfig.MESSAGE.RECEIVER_IDS_MUST_BE_ARRAY);
        } else if (receiverIds.length === 0) {
            err = new Error(ErrorConfig.MESSAGE.AT_LEAST_ONE_RECEIVER_ID_REQUIRED);
        }
        if (err) {
            debug('err', err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            // Get deviceIds by receiverIds
            var deviceIds = await Chat.getDeviceIdForMultipleUsers({receiverIds: receiverIds});
            var devices = _.map(deviceIds, 'deviceId');

            // Send flag to receiver via firebase
            var sendFlagOption = {
                deviceIds: devices,
                data: {
                    languageCultureCode: user.languageCultureCode || Constants.DEFAULT_LANGUAGE_CULTURE_CODE,
                    isTyping: isTyping,
                    senderId: user.id
                }
            };
            if (DataUtils.isDefined(groupId)) {
                debug('Inside if', groupId);
                sendFlagOption.data.groupId = groupId;
            }
            if (devices.length > 0) {
                await FirebaseUtils.sendChatId(sendFlagOption);
            }
            return cb(null, Constants.OK_MESSAGE);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.SEND_TYPING_STATUS_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    getChatStatus: async function (options, errorOptions, cb) {
        var userIds = options.userIds;
        var err;

        if (DataUtils.isUndefined(userIds)) {
            err = new Error(ErrorConfig.MESSAGE.USER_IDS_REQ);
        } else if (DataUtils.isDefined(userIds) && !DataUtils.isArray(userIds)) {
            err = new Error(ErrorConfig.MESSAGE.USER_IDS_MUST_BE_ARRAY);
        } else if (userIds.length === 0) {
            err = new Error(ErrorConfig.MESSAGE.AT_LEAST_ONE_USER_ID_REQUIRED);
        }
        if (err) {
            debug('err', err);
            err.status = ErrorConfig.STATUS_CODE.BAD_REQUEST;
            return cb(err);
        }

        try {
            //Get chatPartner with chat status
            var chatPartners = [];
            _.map(userIds, function (userId) {
                chatPartners.push({inviteeUUID: userId});
            });

            chatPartners = await Chat.getChatStatusOfUsers({
                userIds: userIds,
                partners: chatPartners
            });
            return cb(null, chatPartners);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.CHAT_STATUS_GET_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    },

    getAllUsersOfAccount: async function (options, errorOptions, cb) {
        var user = options.user;
        var query = options.query;
        var string = '';
        var contactString = '';
        var values = [];
        var err;

        try {
            var conn = await connection.getConnection();
            if (DataUtils.isDefined(query)) {
                query = '%' + query + '%';
                string += ' and (firstName like ? or lastName like ?)';
                values.push(query, query);
                contactString += ' and (C.firstName like ? or C.lastName like ?)';
            }

            var users = await conn.query('SELECT ? as type,CAST(uuid_from_bin(id) as CHAR) as userId,CAST(uuid_from_bin(id) as CHAR) as inviteeUUID,' +
              ' firstName, lastName, CAST(profilePicture as CHAR) as profilePicture FROM users ' +
              ' WHERE accountId = uuid_to_bin(?) and status = ? and authorizeUserStatus = ?' + string,
              [Constants.SHARING_ALERT_RECEPIENT_TYPE.USERS, user.accountId, Constants.USER_STATUS.ACTIVE, Constants.AUTHORIZE_USER_STATUS.ACCEPTED].concat(values));

            var contacts = await conn.query('select ? as type,CAST(uuid_from_bin(C.inviteeUUID) as CHAR) as userId,CAST(uuid_from_bin(id) as CHAR) as inviteeUUID, ' +
              ' C.firstName,C.lastName,CAST(profilePicture as CHAR) as profilePicture ' +
              ' from contacts C, users U where C.inviteeUUID = U.id and C.inviterUUID = uuid_to_bin(?) and C.status = ? ' + contactString,
              [Constants.SHARING_ALERT_RECEPIENT_TYPE.CONTACTS, user.id, Constants.CONTACT_STATUS.ACCEPTED].concat(values));
            users = users.concat(contacts);

            debug('unique======', users);
            var userIds = _.map(users, 'userId');

            debug('users', users);
            users = await Chat.getChatStatusOfUsers({
                userIds: userIds,
                partners: users
            });

            return cb(null, users);
        } catch (err) {
            debug('err', err);
            err = new Error(ErrorConfig.MESSAGE.GET_USER_FAILED);
            err.status = ErrorConfig.STATUS_CODE.SERVER_ERROR;
            return cb(err);
        }
    }
};

module.exports = Chat;