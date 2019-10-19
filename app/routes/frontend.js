#!/usr/bin/env node

'use strict';

var Authentication = require('./authentication');
var Account = require('./account');
var User = require('./user');
var SecurityQuestion = require('./security_question');
var Document = require('./document');
var GroupContact = require('./group_contact');
var Group = require('./group');
var IpMessaging = require('./ipmessaging');
var Common = require('./common');
var EmailTemplate = require('./email_template');
var Role = require('./role');
var Marketplace = require('./marketplace');
var ProductByMp = require('./product_by_mp');
var NotificationReference = require('./notification_reference');
var Notification = require('./notification');
var Topic = require('./topic');
var PollingSchedule = require('./polling_schedule');
var Error = require('./error');
var ProductReference = require('./product_reference');
var MeasurementReference = require('./measurement_reference');
var Contact = require('./contact');
var BlackList = require('./black_list');
var ChatGroup = require('./chat_group');
var Constants = require('../data/constants');
var StartUp = require('../api/startup');
var Customer = require('./customer');
var Supplier = require('./supplier');
var LocationReference = require('./location_reference');
var ProductInventory = require('./product_inventory');
var OutSharing = require('./out_sharing');
var OutShareInstance = require('./out_share_instance');
var OrderReferenceInformation = require('./order_reference_information');
var OrderLineItems = require('./order_line_items');
var SupplyItem = require('./supply_item');
var SupplyInventory = require('./supply_inventory');
var UnitOfMeasures = require('./unit_of_measures');
var Permission = require('./permission');
var BillOfMaterials = require('./bill_of_materials');
var UnitOfMeasureCategory = require('./unit_of_measure_category');
var AccountMarketplace = require('./account_marketplace');
var connection = require('../lib/connection_util');
var NewPermission = require('../data/newPermission');

module.exports = function (app) {

    StartUp.init();

    // TODO - ALL - If the scope of these APIs are finalised, Add Notification and Audit Log for these
    // Security Questions
    app.post('/old/api/securityquestion', SecurityQuestion.create, SecurityQuestion.sendJSON, Error);

    app.get('/old/api/securityquestion', SecurityQuestion.list, SecurityQuestion.sendJSON, Error);

    app.delete('/old/api/securityquestion/:question', SecurityQuestion.remove, SecurityQuestion.sendJSON, Error);

    // Reset APIs

    app.put('/old/api/user/reset/securityquestion', User.getResetSecurityQuestions, User.sendJSON, Error);

    app.put('/old/api/user/reset/verify/securityquestion', Authentication.authorizeResetPasswordSession, User.verifyResetSecurityQuestions, User.sendJSON, Error);

    // Policies
    app.get('/old/api/policies/:name', Document.getDocument, Document.sendData, Error);

    // Admin APIs
    app.get('/old/api/users', Authentication.authorizeAdmin, User.list, User.sendJSON, Error);

    app.put('/old/api/user/update', Authentication.authorizeAdmin, User.updateUserByAdmin, User.sendJSON, Error);

    //Email Template APIs
    app.get('/old/api/emailtemplate', Authentication.authorizeAdmin, EmailTemplate.list, EmailTemplate.sendJSON, Error);

    app.post('/old/api/emailtemplate', Authentication.authorizeAdmin, EmailTemplate.create, EmailTemplate.sendJSON, Error);

    app.put('/old/api/emailtemplate', Authentication.authorizeAdmin, EmailTemplate.edit, EmailTemplate.sendJSON, Error);

    app.delete('/old/api/emailtemplate', Authentication.authorizeAdmin, EmailTemplate.delete, EmailTemplate.sendJSON, Error);

    // Chat API token
    app.get('/old/api/chat/token', IpMessaging.createToken, IpMessaging.sendJSON, Error);

    // Role Permission APIs
    app.get('/old/api/role/permissions', Authentication.authorizeAdmin, Permission.list, Common.sendJSON, Error);

    // Create New permission
    // To Create a new PERMISSION
    app.post('/old/api/permission', Authentication.authorizeAdmin, Permission.create, Common.sendJSON, Error);

    // CRUD Marketplace

    // To retrieve a specific Marketplace
    app.get('/old/api/marketplace', Marketplace.getMarketplace, Common.sendJSON, Error);

    // Get Scheduling Events
    app.get('/old/api/scheduling/events', PollingSchedule.getSchedulingEvents, Common.sendJSON, Error);

    // To Create a new Polling Schedule
    app.post('/old/api/schedule', PollingSchedule.create, Common.sendJSON, Error);

    // Get Schedules
    app.get('/old/api/schedules', PollingSchedule.getSchedules, Common.sendJSON, Error);

    // Update Polling Schedule
    app.put('/old/api/schedule', PollingSchedule.updateSchedule, Common.sendJSON, Error);

    // Delete Polling Schedule
    app.delete('/old/api/schedule', PollingSchedule.removeSchedule, Common.sendJSON, Error);

    // CRUD Notification Reference

    // Get Notification by notificationId
    app.get('/old/api/user/notification', Notification.getNotification, Common.sendJSON, Error);

    //GROUP APIS
    //Create a group
    app.post('/old/api/group', User.ownerExist, Group.create, Common.sendJSON, Error);

    //update a group name
    app.put('/old/api/group', Group.groupNameExist, Group.update, Common.sendJSON, Error);

    //delete a group and group contacts
    app.delete('/old/api/group', Group.remove, Common.sendJSON, Error);

    //get qualified contact list
    app.get('/old/api/group/list/contacts', Group.getContact, Common.sendJSON, Error);

    //get group contacts by groupId
    app.get('/old/api/group/contacts', Group.getGroupContact, Common.sendJSON, Error);

    //list all groups defined for a specific owner
    app.get('/old/api/groups', Group.getAllGroups, Common.sendJSON, Error);

    //list all groups defined for a specific contact
    app.get('/old/api/contact/groups', GroupContact.getAllGroups, Common.sendJSON, Error);

    //list all groups defined for a specific login user
    app.get('/old/api/user/groups', GroupContact.getAllGroupsByUser, Common.sendJSON, Error);

    //leave group by user
    app.delete('/old/api/user/leave-group', GroupContact.leaveGroup, Common.sendJSON, Error);

    //add contact to group
    app.post('/old/api/group/contact/add', GroupContact.add, Common.sendJSON, Error);

    //delete contact from group
    app.delete('/old/api/group/contact/delete', GroupContact.delete, Common.sendJSON, Error);

    //CHAT-GROUP APIS
    //Create a Chat group
    app.post('/old/api/chat-group', ChatGroup.create, Common.sendJSON, Error);

    //Get all ongoing conversation of login user
    //app.get('/old/api/chat-groups', ChatGroup.getAll, Common.sendJSON, Error);

    //Get selected chat by chatGroupId
    //app.get('/old/api/chat-group', ChatGroup.getChat, Common.sendJSON, Error);


    app.post('/old/api/ses/email', User.handleSesEmail, Common.sendJSON, Error);

    app.get('/old/api/' + Constants.SCOPEHUB_SES_EMAIL_BUCKET + '/:userId/:s3key(\\w*.(png|jpeg|jpg|html|html))', Authentication.validateUserParam, Common.getSignedUrl, Error);

    //PRODUCT INVENTORY APIS
    //update product inventory by adding out-share profile in out-shares field
    app.put('/old/api/product/inventory/out-shares', ProductInventory.updateByAddingOutShares, Common.sendJSON, Error);

    //update product inventory by removing out-share profile from out-shares field
    app.put('/old/api/product/inventory/remove/out-shares', ProductInventory.updateByRemovingOutShares, Common.sendJSON, Error);

};
