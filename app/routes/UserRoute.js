#!/usr/bin/env node
'use strict';

var Authentication = require('./authentication');
var Account = require('./account');
var User = require('./user');
var Common = require('./common');
var Error = require('./error');
var Constants = require('../data/constants');

var express = require('express');
var router = express.Router();


/**
 * Migration APIs.(MariaDB)
 */

router.patch('/session-test', [
    Authentication.authorizeUserOrGatewayMD,
    User.checkSession
]);

router.post('/signup', [
    Common.checkInvalidField(Constants.FIELDS.USERS),
    User.validateFieldsMD,
    Common.verifyRecaptcha,
    User.checkColorCombination,
    User.signupMD,
    Account.createAccountMD,
    User.updateUserMD
]);

router.post('/login', [
    Common.checkInvalidField(Constants.FIELDS.USERS),
    User.loginMD,
    User.ensurePostRegStepsMD,
    User.setRememberMD,
    User.rememberDeviceMD
]);

// password reset
router.patch('/reset/password/initiate', [
    Authentication.validateRequest,
    Common.checkInvalidField(Constants.FIELDS.USERS),
    Common.verifyRecaptcha,
    User.resetPasswordInitiateMD
]);

//resend the code
router.patch('/reset/password/resend', [
    Authentication.resetPasswordResendSession,
    Common.checkInvalidField(Constants.FIELDS.USERS),
    User.resendCodePasswordMD
]);

router.post('/reset/code/verify', [
    Authentication.authorizeResetPasswordSession,
    Common.checkInvalidField(Constants.FIELDS.USERS),
    User.setResetPasswordCodeConfirmation,
    User.verifyCodeMD,
    User.confirmResetPasswordVerificationMD
]);

router.patch('/reset/password', [
    Authentication.authorizeResetPasswordSession,
    Common.checkInvalidField(Constants.FIELDS.USERS),
    User.resetPasswordMD
]);

router.patch('/verify/password', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.USERS),
    User.verifyPasswordMD
]);

//verify password from profile setting page
router.patch('/reset/password/verify-setting', [
    Authentication.resetPasswordValidatePasswordMD,
    Common.checkInvalidField(Constants.FIELDS.USERS),
    User.validatePasswordMD
]);

// Post Registration APIs
router.patch('/tos/accept', [
    Authentication.validateToken,
    User.getUserByEmailId,
    Authentication.postRegistrationUserAuthentication,
    Common.checkInvalidField(Constants.FIELDS.USERS),
    User.acceptTOSMD
]);

router.patch('/verify/email', [
    Authentication.validateToken,
    User.getUserByEmailId,
    Authentication.postRegistrationUserAuthentication,
    Common.checkInvalidField(Constants.FIELDS.USERS),
    User.verifyEmailMD
]);

router.patch('/verify/userEmail', [
    Authentication.sessionAuthentication,
    Common.checkInvalidField(Constants.FIELDS.USERS),
    User.userExistsWithNewMailMD,
    User.verifyUserEmailMD
]);

router.patch('/confirm/email', [
    Authentication.validateToken,
    User.getUserByEmailId,
    Authentication.postRegistrationUserAuthentication,
    Common.checkInvalidField(Constants.FIELDS.USERS),
    User.setVerifyEmailPostRegistrationCodeConfirmation,
    User.verifyCodeMD,
    User.confirmEmailVerificationMD,
    User.isPostRegCompleteMD
]);

router.patch('/confirm/userEmail', [
    Authentication.sessionAuthentication,
    Common.checkInvalidField(Constants.FIELDS.USERS),
    User.setVerifyEmailPostRegistrationCodeConfirmation,
    User.verifyCodeMD,
    User.confirmUserEmailVerificationMD
]);

// Verify Phone
router.patch('/verify/phone', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.USERS),
    User.setUpdatePhoneCodeGeneration,
    User.verifyPhoneMD
]);

router.patch('/confirm/phone', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.USERS),
    User.setUpdatePhoneCodeConfirmation,
    User.verifyCodeMD,
    User.confirmPhoneVerificationMD
]);

// User Preference APIs
router.patch('/preference/language', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.USERS),
    User.setLanguageMD
]);

router.patch('/preference/option', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.USERS),
    User.setVerificationOptionMD
]);

router.get('/remember', [
    User.rememberMD
]);

router.get('', [
    Authentication.commonAuthorize,
    User.getLoginUser
]);

// Signup Cancel - Before completing the Post Registration Steps
router.patch('/signup/cancel', [
    Authentication.validateToken,
    User.getUserByEmailId,
    Authentication.postRegistrationUserAuthentication,
    /* User.deleteUserRolesMD,*/
    User.deleteUserMD,
    Account.deleteAccountMD
    // User.deleteSession
]);

router.patch('/confirm/securityquestion', [
    User.getUserByEmailId,
    Authentication.postRegistrationUserAuthentication,
    Common.checkInvalidField(Constants.FIELDS.USERS),
    User.saveSecurityQuestionsMD
]);

//Save profile detail in user table from mariaDB.
router.patch('/profile', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.USERS),
    User.saveMyProfileDetailMD
]);

//Get profile details from user table from mariaDB
router.get('/profile', [
    Authentication.authorizeUserOrGatewayMD,
    User.getMyProfileDetailMD
]);

//Update flag in notification
router.patch('/notification-flag', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.USERS),
    User.updateNotificationFlag
]);

//set default value to flag in notification
router.patch('/default/notification-flag', [
    Authentication.authorizeUserOrGatewayMD,
    User.setDefaultNotificationFlag
]);

//get notification flag
router.get('/notification-flag', [
    Authentication.authorizeUserOrGatewayMD,
    User.getNotificationFlag
]);

//Update AdvancedAuthenticationNumber
router.patch('/advanced-auth-number', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.USERS),
    User.updateAdvancedAuthNumberMD
]);

//Update phone , secondary phone and email
router.patch('/phone/update', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.USERS),
    User.updateUserPhoneMD
]);

router.patch('/secondary', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.USERS),
    User.updateSecondaryNumberMD
]);

router.patch('/email', [
    Authentication.authorizeUserOrGatewayMD,
    Common.checkInvalidField(Constants.FIELDS.USERS),
    User.updateUserEmailMD
]);

//Block/Deactivate User
router.delete('/deactivate', [
    Authentication.authorizeUserOrGatewayMD,
    Authentication.isAccountEnabled,
    Authentication.isAccountAdminMD,
    User.deactivateUserMD
]);

//Activate User
router.patch('/activate', [
    Authentication.authorizeUserOrGatewayMD,
    Authentication.isAccountEnabled,
    Authentication.isAccountAdminMD,
    User.activateUserMD
]);

//Encryption key for Chat
router.patch('/encryption', [
    Authentication.authorizeUserOrGatewayMD,
    User.updateEncryptionKeys
]);

//Archieve check for account
router.get('/check/archive', [
    Authentication.authorizeUserOrGatewayMD,
    User.checkArchive
]);

/*
* SIGNUP API's for marketing website
* */
router.post('/wesite/verify/email', [
    Authentication.validateToken,
    Common.checkInvalidField(Constants.FIELDS.USERS),
    User.sendCodeViaMail
]);

router.patch('/wesite/confirm/email', [
    Authentication.validateToken,
    Common.checkInvalidField(Constants.FIELDS.USERS),
    User.confirmCode
]);

router.post('/website/signup', [
    Authentication.validateToken,
    Common.checkInvalidField(Constants.FIELDS.USERS),
    User.validateFieldsMD,
    Common.verifyRecaptcha,
    User.checkColorCombination,
    User.signupMD,
    Account.createAccountMD,
    User.updateUserMD
]);

module.exports = router;