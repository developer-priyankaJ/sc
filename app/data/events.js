/* jslint node: true */
'use strict';

module.exports = {
    LOGIN: 1,
    SIGN_UP: 2,
    PROFILE_UPDATED: 4,
    LOGIN_PHONE_VERIFICATION_CODE_GENERATION: 5,
    LOGIN_PHONE_VERIFICATION_CODE_CONFIRMATION: 6,
    REMEMBER_ME: 7,
    SET_USER_LANGUAGE_PREFERENCE: 8,
    TOS_ACCEPT_POST_REG: 9,
    VERIFY_EMAIL_POST_REG_CODE_GENERATION: 10,
    VERIFY_EMAIL_POST_REG_CODE_CONFIRMATION: 11,
    VERIFY_PHONE_POST_REG_CODE_GENERATION: 12,
    VERIFY_PHONE_POST_REG_CODE_CONFIRMATION: 13,
    SAVE_SECURITY_QUESTION_POST_REG: 14,
    RESET_PASSWORD_INITIATE: 15,
    RESET_PASSWORD_CODE_CONFIRMATION: 16,
    RESET_PASSWORD: 17,
    RESET_PASSWORD_INITIATE_SECURITY_QUESTIONS: 18,
    RESET_PASSWORD_VERIFY_SECURITY_ANSWERS: 19,
    GET_POLICIES: 20,
    CREATE_GROUP: 21,
    ADD_CONTACT: 22,
    DELETE_CONTACT: 23,
    LIST_GROUPS: 24,
    GET_GROUP_DETAILS: 25,
    REMOVE_GROUP: 26,
    EDIT_GROUP: 27,
    INVITE_CONTACT: 28,
    INVITE_EXTERNAL_CONTACT: 29,
    ACCEPT_INVITE: 30,
    DECLINE_INVITE: 31,
    CANCEL_INVITE: 32,
    GET_INVITES_SENT: 33,
    GET_INVITES_RECEIVED: 34,
    CLOSE_ACCOUNT: 35,
    GET_USER_NOTIFICATIONS: 36,
    MARK_NOTIFICATION_READ: 37,
    ADMIN_GET_USERS: 38,
    ADMIN_UPDATE_USER: 39,
    SET_USER_VERIFICATION_OPTION: 40,
    ACCOUNT_UPDATED: 41,
    ACCOUNT_DEACTIVATED: 42,
    ACCOUNT_ACTIVATE_FIRST_TIME: 43,
    ACCOUNT_INVITE_USER: 44,
    CREATE_EMAIL_TEMPLATE: 45,
    LIST_EMAIL_TEMPLATE: 46,
    REMOVE_EMAIL_TEMPLATE: 47,
    UPDATE_EMAIL_TEMPLATE: 48,
    CREATE_NOTIFICATION_MESSAGE: 49,
    LIST_NOTIFICATION_MESSAGE: 50,
    REMOVE_NOTIFICATION_MESSAGE: 51,
    UPDATE_NOTIFICATION_MESSAGE: 52,
    ACCOUNT_REACTIVATE: 53,
    SIGN_UP_CANCELLATION: 54,
    ONBOARD_PRODUCTS: 55,
    CREATE_MARKETPLACE: 56,
    UPDATE_MARKETPLACE: 57,
    REMOVE_MARKETPLACE: 58,
    CREATE_POLLING_SCHEDULE: 59,
    UPDATE_POLLING_SCHEDULE: 60,
    REMOVE_POLLING_SCHEDULE: 61,
    CREATE_NOTIFICATION_REFERENCE: 62,
    UPDATE_NOTIFICATION_REFERENCE: 63,
    REMOVE_NOTIFICATION_REFERENCE: 64,
    MARK_NOTIFICATION_ARCHIVED: 65,
    USER_UPDATE_PHONE: 66,
    MARK_NOTIFICATION_ACTION: 67,
    SNOOZE_NOTIFICATION: 68,
    UNDO_NOTIFICATION_ARCHIVED: 69,
    UNDO_NOTIFICATION_SNOOZE: 70,
    MARK_ALL_NOTIFICATION_READ: 71,
    MARK_NOTIFICATION_UNREAD: 72,
    UPDATE_PRODUCT_REFERENCE: 73,
    REMOVE_PRODUCT_REFERENCE: 74,
    CREATE_COUNTRY_REFERENCE: 75,
    UPDATE_COUNTRY_REFERENCE: 76,
    REMOVE_COUNTRY_REFERENCE: 77,
    CREATE_CURRENCY_REFERENCE: 78,
    UPDATE_CURRENCY_REFERENCE: 79,
    REMOVE_CURRENCY_REFERENCE: 80,
    CREATE_SUPPLIER_REFERENCE: 81,
    UPDATE_SUPPLIER_REFERENCE: 82,
    REMOVE_SUPPLIER_REFERENCE: 83,
    CREATE_MEASUREMENT_REFERENCE: 84,
    UPDATE_MEASUREMENT_REFERENCE: 85,
    REMOVE_MEASUREMENT_REFERENCE: 86,
    CREATE_CONTACT: 87,
    UPDATE_CONTACT: 88,
    REMOVE_CONTACT: 89,
    CREATE_SCENARIO: 90,
    CREATE_SALES: 91,
    CREATE_PRICE: 92,
    CREATE_COST: 93,
    INVITER_CANCELLED_INVITATION: 94,
    CREATE_PRODUCT_REFERENCE: 95,
    NOTIFICATION_REGISTER_DEVICE: 96,
    ADD_GROUP_CONTACT: 97,
    DELETE_GROUP_CONTACT: 98,
    RE_INVITE_CONTACT: 99,
    ADD_CONTACT_IN_BLACK_LIST: 100,
    REMOVE_CONTACT_FROM_BLACK_LIST: 101,
    RE_SEND_CONTACT_INVITATION: 102,
    UPDATE_MARKETPLACE_ACCOUNT: 103,
    ONBOARD_ADD_PRODUCT_REFERENCES: 104,
    CREATE_ORDERS: 105,
    ORDER_REPORT_CRON_JOB_START: 106,
    ORDER_REPORT_CRON_JOB_END: 107,
    CREATE_CHAT_GROUP: 108,
    CREATE_PRODUCT_BY_MP: 109,
    EXPORT_PRODUCTS: 110,
    IMPORT_PRODUCTS: 111,
    LEAVE_FROM_GROUP: 112,
    CREATE_CUSTOMER: 113,
    CREATE_SUPPLIER: 114,
    UPDATE_SUPPLIER: 115,
    DELETE_SUPPLIER: 116,
    UPDATE_CUSTOMER: 117,
    DELETE_CUSTOMER: 118,
    UPDATE_ACCOUNT_MARKETPLACE: 119,
    DELETE_ACCOUNT_MARKETPLACE: 120,
    UPDATE_ACCOUNT_DETAILS: 121,
    CREATE_LOCATION_REFERENCE: 122,
    UPDATE_LOCATION_REFERENCE: 123,
    DELETE_LOCATION_REFERENCE: 124,
    CREATE_PRODUCT_INVENTORY: 125,
    REMOVE_PRODUCT_INVENTORY: 126,
    NOTIFICATION_UN_REGISTER_DEVICE: 127,
    CREATE_OUT_SHARING: 128,
    UPDATE_OUT_SHARING: 129,
    UPDATE_SUBSCRIBER_OUT_SHARING: 130,
    DELETE_OUT_SHARING: 131,
    OUT_SHARE_INSTANCE_CREATE: 132,
    OUT_SHARE_INSTANCE_UPDATE: 133,
    OUT_SHARE_INSTANCE_UPDATE_SUBSCRIBERS: 134,
    OUT_SHARE_INSTANCE_EXPIRED: 135,
    UPDATE_OUT_SHARES_PRODUCT_INVENTORY: 136,
    UPDATE_PRODUCT_INVENTORY: 137,
    INVITE_SUPPLIER: 138,
    OUT_SHARE_INSTANCE_UPDATE_STATUS: 139,
    IN_SHARE_CREATE: 140,
    IN_SHARE_UPDATE: 141,
    IN_SHARE_DELETE: 0,
    GET_ORDERS: 142,
    UPDATE_REPLICATION_SETTING_FOR_ORDER_IMPORT: 143,
    MWS_ORDER_ERROR: 144,
    GET_ITEMS: 145,
    UPLOAD_PRODUCTS_FILE: 146,
    IMPORT_PRODUCT_INVENTORY: 147,
    UPLOAD_PRODUCT_INVENTORY_FILE: 148,
    UPLOAD_SUPPLY_ITEM_FILE: 149,
    IMPORT_SUPPLY_ITEMS: 150,
    UPLOAD_SUPPLY_INVENTORY_FILE: 151,
    IMPORT_SUPPLY_INVENTORY: 152,
    REMOVE_SUPPLY_INVENTORY: 153,
    REMOVE_SUPPLY_ITEM: 154,
    DISABLE_ORDER_REPLICATION: 155,
    ENABLE_ORDER_REPLICATION: 156,
    GET_CURRENT_REPLICATION_STATUS: 157,
    UPLOAD_ORDERS_FILE: 158,
    IMPORT_ORDERS_FILE: 159,
    SAVE_MY_PROFILE_DETAIL: 160,
    GET_MY_PROFILE_DETAIL: 161,
    USER_UPDATE_SECONDARY_NUMBER: 162,
    USER_UPDATE_EMAIL: 163,
    DECLINE_USER_INVITATION: 164,
    CANCEL_USER_INVITATION: 165,
    ADD_INVITE_AUTHORIZE_USER: 166,
    GET_ALL_AUTHORIZE_USER: 167,
    DEACTIVATE_AUTHORIZE_USER: 168,
    RE_SEND_INVITATION_AUTHORIZE_USER: 169,
    ADD_AUTHORIZE_USER: 170,
    INVITE_AUTHORIZE_USER: 171,
    CREATE_ROLE: 172,
    CREATE_UNIT_OF_MEASURE: 173,
    GET_UNIT_OF_MEASURE_BY_ID: 174,
    UPDATE_UNIT_OF_MEASURE: 175,
    CREATE_PERMISSION: 176,
    GET_AUTHORIZE_USER_BY_USER_ID: 177,
    UPDATE_AUTHORIZE_USER: 178,
    GET_LIST_OF_ROLES: 179,
    CREATE_SUPPLY_INVENTORY: 180,
    CREATE_SUPPLY_ITEM: 181,
    CREATE_BILL_OF_MATERIALS: 182,
    UPDATE_BILL_OF_MATERIALS: 183,
    GET_BILL_OF_MATERIAL: 184,
    DELETE_BILL_OF_MATERIAL: 185,
    UPDATE_SUPPLY_ITEM: 186,
    UPDATE_UINT_OF_MEASURE_CATEGORY: 187,
    UPDATE_UINT_OF_MEASURE_NAME: 188,
    CREATE_ORDER_REFERENCE_TYPE: 189,
    DELETE_UNIT_OF_MEASURE_CATEGORY: 190,
    DELETE_MULTIPLE_LOCATION_REFERENCE: 191,
    UPDATE_ADVANCED_AUTHENTICATION_NUMBER: 192,
    CREATE_REPLICATION_SETTING: 193,
    GET_REPLICATION_SETTING: 194,
    GET_ORDER: 195,
    GET_ITEM: 196,
    IMPORT_ORDER_LINE_ITEMS: 197,
    GET_REPLICATION_HISTORY: 198,
    BLOCK_CONTACT: 199,
    USER_DEACTIVATED: 200,
    USER_ACTIVATED: 201,
    CREATE_PRE_SIGNED_URL: 202,
    VERIFY_CONFIRM_CODE: 203,
    UPLOAD_PRODUCT_IMAGES: 204,
    CREATE_PRODUCT_IMAGE_LOG: 205,
    CREATE_FILE_LOG_RECORD: 206,
    UPDATE_PRODUCT_IMAGE_LOG: 207,
    DELETE_PRODUCT_IMAGE_LOG: 208,
    SET_MAIN_PRODUCT_IMAGE: 209,
    UPDATE_UPLOAD_LOG: 210,
    OUT_SHARE_INSTANCE_DELETE: 211,
    ADDED_ENCRYPTION_KEYS_IN_ACCOUNT: 212,
    DELETE_PRODUCT_INVENTORY: 213,
    DELETE_ARCHIEVE_PRODUCT_INVENTORY: 214,
    RESTORE_ARCHIEVE_PRODUCT_INVENTORY: 215,
    CREATE_VIEW: 216,
    UPDATE_VIEW: 217,
    DELETE_VIEW: 218,
    CREATE_FILE_UPLOAD_LOG: 219,
    CREATE_SUPPLY_IMAGE_LOG: 220,
    UPDATE_SUPPLY_IMAGE_LOG: 221,
    DELETE_SUPPLY_IMAGE_LOG: 222,
    SET_MAIN_SUPPLY_IMAGE: 223,
    UPDATE_SUPPLY_INVENTORY: 224,
    DELETE_SUPPLY_INVENTORY: 225,
    DELETE_ARCHIEVE_SUPPLY_INVENTORY: 226,
    RESTORE_ARCHIEVE_SUPPLY_INVENTORY: 227,
    UPDATE_UPLOAD_LOG_BY_CANCEL: 228,
    DELETE_ARCHIEVE_SUPPLY_ITEM: 229,
    RESTORE_ARCHIEVE_SUPPLY_ITEM: 230,
    DELETE_SUPPLY_ITEM: 231,
    RESTORE_CUSTOMER: 232,
    DELETE_ARCHIEVE_CUSTOMER: 233,
    RESTORE_SUPPLIER: 234,
    DELETE_ARCHIEVE_SUPPLIER: 235,
    USER_UPDATE_NOTIFICATION_FLAG: 236,
    USER_SET_DEFAULT_NOTIFICATION_FLAG: 237,
    CREATE_CHAT: 238,
    UPDATE_CHAT: 239,
    CREATE_GROUP_MESSAGE: 240,
    DELETE_CHAT: 241,
    ADDED_ENCRYPTION_KEYS_IN_USER: 242,
    CREATE_CONTACT_REQUEST: 243,
    MARK_GROUP_MESSAGE_AS_READ: 244,
    CREATE_DEPENDENT_DEMAND: 245,
    DELETE_DEPENDENT_DEMAND: 246,
    UPDATE_DEPENDENT_DEMAND: 247,
    CREATE_IN_SHARE_ALERT: 248,
    UPDATE_IN_SHARE_ALERT: 249,
    DELETE_IN_SHARE_ALERT: 250,
    UPDATE_ORDERS: 251,
    DELETE_PRODUCT: 252,
    DELETE_ARCHIEVE_PRODUCT: 253,
    RESTORE_ARCHIEVE_PRODUCT: 254
};