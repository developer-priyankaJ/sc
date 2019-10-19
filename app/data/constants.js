/* jslint node: true */
'use strict';

var EndpointConfig = require('../config/endpoints');
var AwsConfig = require('../config/aws');

var Constants = {

    ROW_LIMIT: 100,

    OK_MESSAGE: {
        OK: 'SUCCESS'
    },

    SUCCESS_MESSAGE: {
        AUTHORIZE_USER_CREATE_SUCCESS: 'AUTHORIZE_USER_CREATE_SUCCESS',
        AUTHORIZE_USER_INVITE_SUCCESS: 'AUTHORIZE_USER_INVITE_SUCCESS',
        AUTHORIZE_USER_ADD_INVITE_SUCCESS: 'AUTHORIZE_USER_ADD_INVITE_SUCCESS',
        AUTHORIZE_USER_DECLINE_INVITE_SUCCESS: 'AUTHORIZE_USER_DECLINE_INVITE_SUCCESS',
        AUTHORIZE_USER_CANCEL_INVITE_SUCCESS: 'AUTHORIZE_USER_CANCEL_INVITE_SUCCESS',
        AUTHORIZE_USER_DEACTIVATE_SUCCESS: 'AUTHORIZE_USER_DEACTIVATE_SUCCESS',
        AUTHORIZE_USER_RE_INVITE_SUCCESS: 'AUTHORIZE_USER_RE_INVITE_SUCCESS',
        AUTHORIZE_USER_UPDATE_SUCCESS: 'AUTHORIZE_USER_UPDATE_SUCCESS',

        SAVE_PROFILE_SUCCESS: 'SAVE_PROFILE_SUCCESS',
        DISABLE_ADVANCE_AUTH_NUMBER_SUCCESS: 'DISABLE_ADVANCE_AUTH_NUMBER_SUCCESS',
        MODIFY_ADVANCE_AUTH_NUMBER_SUCCESS: 'MODIFY_ADVANCE_AUTH_NUMBER_SUCCESS',
        ENABLE_ADVANCE_AUTH_NUMBER_SUCCESS: 'ENABLE_ADVANCE_AUTH_NUMBER_SUCCESS',
        REMOVE_PHONE_SUCCESS: 'REMOVE_PHONE_SUCCESS',
        ADD_PHONE_SUCCESS: 'ADD_PHONE_SUCCESS',
        MODIFY_PHONE_SUCCESS: 'MODIFY_PHONE_SUCCESS',
        UPDATE_ACCOUNT_SUCCESS: 'UPDATE_ACCOUNT_SUCCESS',
        UPDATE_EMAIL_SUCCESS: 'UPDATE_EMAIL_SUCCESS',

        CUSTOMER_CREATE_SUCCESS: 'CUSTOMER_CREATE_SUCCESS',
        CUSTOMER_UPDATE_SUCCESS: 'CUSTOMER_UPDATE_SUCCESS',
        CUSTOMER_DELETE_SUCCESS: 'CUSTOMER_DELETE_SUCCESS',
        CUSTOMER_INVITE_SUCCESS: 'CUSTOMER_INVITE_SUCCESS',
        CUSTOMERS_DELETED_SUCCESSFULLY: 'CUSTOMERS_DELETED_SUCCESSFULLY',
        CUSTOMERS_ARCHIEVED_SUCCESSFULLY: 'CUSTOMERS_ARCHIEVED_SUCCESSFULLY',
        CUSTOMERS_RESTORED_SUCCESSFULLY: 'CUSTOMERS_RESTORED_SUCCESSFULLY',
        CUSTOMER_SEND_REMINDER_SUCCESS: 'CUSTOMER_SEND_REMINDER_SUCCESS',
        CUSTOMER_RE_SEND_INVITATION_SUCCESS: 'CUSTOMER_RE_SEND_INVITATION_SUCCESS',
        CUSTOMER_CANCEL_INVITATION_SUCCESS: 'CUSTOMER_CANCEL_INVITATION_SUCCESS',
        CUSTOMER_ADD_INVITE_SUCCESS: 'CUSTOMER_ADD_INVITE_SUCCESS',

        SUPPLIER_CREATE_SUCCESS: 'SUPPLIER_CREATE_SUCCESS',
        SUPPLIER_UPDATE_SUCCESS: 'SUPPLIER_UPDATE_SUCCESS',
        SUPPLIER_DELETE_SUCCESS: 'SUPPLIER_DELETE_SUCCESS',
        SUPPLIER_INVITE_SUCCESS: 'SUPPLIER_INVITE_SUCCESS',
        SUPPLIER_DELETED_SUCCESSFULLY: 'SUPPLIER_DELETED_SUCCESSFULLY',
        SUPPLIER_RESTORED_SUCCESSFULLY: 'SUPPLIER_RESTORED_SUCCESSFULLY',
        SUPPLIER_ARCHIEVED_SUCCESSFULLY: 'SUPPLIER_ARCHIEVED_SUCCESSFULLY',
        SUPPLIER_SEND_REMINDER_SUCCESS: 'SUPPLIER_SEND_REMINDER_SUCCESS',
        SUPPLIER_RE_SEND_INVITATION_SUCCESS: 'SUPPLIER_RE_SEND_INVITATION_SUCCESS',
        SUPPLIER_CANCEL_INVITATION_SUCCESS: 'SUPPLIER_CANCEL_INVITATION_SUCCESS',
        SUPPLIER_ADD_INVITE_SUCCESS: 'SUPPLIER_ADD_INVITE_SUCCESS',

        RESEND_CONTACT_INVITE_SUCCESS: 'RESEND_CONTACT_INVITE_SUCCESS',
        CONTACT_REMINDER_SUCCESS: 'CONTACT_REMINDER_SUCCESS',
        UPDATE_CONTACT_SUCCESS: 'UPDATE_CONTACT_SUCCESS',
        CANCEL_CONTACT_SUCCESS: 'CANCEL_CONTACT_SUCCESS',
        REMOVE_CONTACT_SUCCESS: 'REMOVE_CONTACT_SUCCESS',
        SAVE_CONTACT_SUCCESS: 'SAVE_CONTACT_SUCCESS',
        ADD_AND_INVITE_CONTACT_SUCCESS: 'ADD_AND_INVITE_CONTACT_SUCCESS',
        INVITE_CONTACT_SUCCESS: 'INVITE_CONTACT_SUCCESS',
        CONTACT_BLOCK_SUCCESS: 'CONTACT_BLOCK_SUCCESS',
        CONTACT_UNBLOCK_SUCCESS: 'CONTACT_UNBLOCK_SUCCESS',

        NOTIFICATION_MARK_READ_SUCCESS: 'NOTIFICATION_MARK_READ_SUCCESS',
        NOTIFICATION_MARK_UNREAD_SUCCESS: 'NOTIFICATION_MARK_UNREAD_SUCCESS',
        NOTIFICATION_MARK_ARCHIVE_SUCCESS: 'NOTIFICATION_MARK_ARCHIVE_SUCCESS',
        NOTIFICATION_UNDO_ARCHIVE_SUCCESS: 'NOTIFICATION_UNDO_ARCHIVE_SUCCESS',
        NOTIFICATION_MARK_SNOOZE_SUCCESS: 'NOTIFICATION_MARK_SNOOZE_SUCCESS',
        NOTIFICATION_UNDO_SNOOZE_SUCCESS: 'NOTIFICATION_UNDO_SNOOZE_SUCCESS',
        NOTIFICATION_DEVICE_REGISTER_SUCCESS: 'NOTIFICATION_DEVICE_REGISTER_SUCCESS',
        NOTIFICATION_DEVICE_UNREGISTER_SUCCESS: 'NOTIFICATION_DEVICE_UNREGISTER_SUCCESS',
        NOTIFICATION_MARK_ACTION_SUCCESS: 'NOTIFICATION_MARK_ACTION_SUCCESS',
        NOTIFICATION_FLAG_UPDATE_SUCCESS: 'NOTIFICATION_FLAG_UPDATE_SUCCESS',
        NOTIFICATION_FLAG_SET_DEFAULT_SUCCESS: 'NOTIFICATION_FLAG_SET_DEFAULT_SUCCESS',
        NOTIFY_FLAG_UPDATE_SUCCESS: 'NOTIFY_FLAG_UPDATE_SUCCESS',
        UPLOAD_TAB_FLAG_UPDATE_SUCCESS: 'UPLOAD_TAB_FLAG_UPDATE_SUCCESS',
        PRODUCT_UOM_FLAG_UPDATE_SUCCESS: 'PRODUCT_UOM_FLAG_UPDATE_SUCCESS',
        NAVBAR_FLAG_UPDATE_SUCCESS: 'NAVBAR_FLAG_UPDATE_SUCCESS',
        SHARING_ALERT_FLAG_UPDATE_SUCCESS: 'SHARING_ALERT_FLAG_UPDATE_SUCCESS',

        IN_SHARE_UPDATE_SUCCESS: 'IN_SHARE_UPDATE_SUCCESS',
        IN_SHARE_CREATE_SUCCESS: 'IN_SHARE_CREATE_SUCCESS',
        IN_SHARE_DELETED_SUCCESSFULLY: 'IN_SHARE_DELETED_SUCCESSFULLY',
        IN_SHARE_DELETE_SUCCESS: 'IN_SHARE_DELETE_SUCCESS',

        PRODUCT_REFERENCE_CREATE_SUCCESS: 'PRODUCT_REFERENCE_CREATE_SUCCESS',
        PRODUCT_REFERENCE_UPDATE_SUCCESS: 'PRODUCT_REFERENCE_UPDATE_SUCCESS',

        OUT_SHARE_UPDATE_SUCCESS: 'OUT_SHARE_UPDATE_SUCCESS',
        OUT_SHARE_CREATE_SUCCESS: 'OUT_SHARE_CREATE_SUCCESS',
        OUT_SHARE_INSTANCE_DELETED_SUCCESSFULLY: 'OUT_SHARE_INSTANCE_DELETED_SUCCESSFULLY',
        OUT_SHARE_INSTANCE_DELETE_SUCCESS: 'OUT_SHARE_INSTANCE_DELETE_SUCCESS',

        PRODUCT_IMAGE_LOG_UPDATE_SUCCESS: 'PRODUCT_IMAGE_LOG_UPDATE_SUCCESS',
        PRODUCT_IMAGE_DELETE_SUCCESS: 'PRODUCT_IMAGE_DELETE_SUCCESS',
        SET_MAIN_IMAGE_SUCCESS: 'SET_MAIN_IMAGE_SUCCESS',

        SUPPLY_IMAGE_LOG_UPDATE_SUCCESS: 'SUPPLY_IMAGE_LOG_UPDATE_SUCCESS',
        SUPPLY_IMAGE_DELETE_SUCCESS: 'SUPPLY_IMAGE_DELETE_SUCCESS',

        PRODUCT_INVENTORY_DELETED_SUCCESSFULLY: 'PRODUCT_INVENTORY_DELETED_SUCCESSFULLY',
        PRODUCT_INVENTORY_RESTORED_SUCCESSFULLY: 'PRODUCT_INVENTORY_RESTORED_SUCCESSFULLY',
        PRODUCT_INVENTORY_CREATED_SUCCESSFULLY: 'PRODUCT_INVENTORY_CREATED_SUCCESSFULLY',
        PRODUCT_INVENTORY_ARCHIEVED_SUCCESSFULLY: 'PRODUCT_INVENTORY_ARCHIEVED_SUCCESSFULLY',
        PRODUCT_INVENTORY_UPDATED_SUCCESSFULLY: 'PRODUCT_INVENTORY_UPDATED_SUCCESSFULLY',

        SUPPLY_INVENTORY_CREATED_SUCCESSFULLY: 'SUPPLY_INVENTORY_CREATED_SUCCESSFULLY',
        SUPPLY_INVENTORY_ARCHIEVED_SUCCESSFULLY: 'SUPPLY_INVENTORY_ARCHIEVED_SUCCESSFULLY',
        SUPPLY_INVENTORY_UPDATED_SUCCESSFULLY: 'SUPPLY_INVENTORY_UPDATED_SUCCESSFULLY',
        SUPPLY_INVENTORY_DELETED_SUCCESSFULLY: 'SUPPLY_INVENTORY_DELETED_SUCCESSFULLY',
        SUPPLY_INVENTORY_RESTORED_SUCCESSFULLY: 'SUPPLY_INVENTORY_RESTORED_SUCCESSFULLY',


        UNIT_OF_MEASURE_CREATE_SUCCESS: 'UNIT_OF_MEASURE_CREATE_SUCCESS',
        UNIT_OF_MEASURE_UPDATE_SUCCESS: 'UNIT_OF_MEASURE_UPDATE_SUCCESS',
        UNIT_OF_MEASURE_DELETE_SUCCESS: 'UNIT_OF_MEASURE_DELETE_SUCCESS',

        UNIT_OF_MEASURE_CATEGORY_CREATE_SUCCESS: 'UNIT_OF_MEASURE_CATEGORY_CREATE_SUCCESS',
        UNIT_OF_MEASURE_CATEGORY_UPDATE_SUCCESS: 'UNIT_OF_MEASURE_CATEGORY_UPDATE_SUCCESS',
        UNIT_OF_MEASURE_CATEGORY_DELETE_SUCCESS: 'UNIT_OF_MEASURE_CATEGORY_DELETE_SUCCESS',

        SUPPLY_ITEM_DELETED_SUCCESSFULLY: 'SUPPLY_ITEM_DELETED_SUCCESSFULLY',
        SUPPLY_ITEM_ARCHIEVED_SUCCESSFULLY: 'SUPPLY_ITEM_ARCHIEVED_SUCCESSFULLY',
        SUPPLY_ITEM_RESTORED_SUCCESSFULLY: 'SUPPLY_ITEM_RESTORED_SUCCESSFULLY',

        PRODUCT_DELETED_SUCCESSFULLY: 'PRODUCT_DELETED_SUCCESSFULLY',
        PRODUCT_ARCHIEVED_SUCCESSFULLY: 'PRODUCT_ARCHIEVED_SUCCESSFULLY',
        PRODUCT_RESTORED_SUCCESSFULLY: 'PRODUCT_RESTORED_SUCCESSFULLY',

        BILLING_CONTROL_UPDATE_SUCCESS: 'BILLING_CONTROL_UPDATE_SUCCESS',

        MESSAGE_DELETED_SUCCESSFULLY: 'MESSAGE_DELETED_SUCCESSFULLY',
        MESSAGE_UPDATED_SUCCESSFULLY: 'MESSAGE_UPDATED_SUCCESSFULLY',

        DEPENDENT_DEMAND_CREATED_SUCCESSFULLY: 'DEPENDENT_DEMAND_CREATED_SUCCESSFULLY',
        DEPENDENT_DEMAND_UPDATED_SUCCESSFULLY: 'DEPENDENT_DEMAND_UPDATED_SUCCESSFULLY',
        DEPENDENT_DEMAND_DELETED_SUCCESSFULLY: 'DEPENDENT_DEMAND_DELETED_SUCCESSFULLY',

        GROUP_EXISTS: 'GROUP_EXISTS',

        SUBSCRIBED_SUCCESS_UPDATE: 'SUBSCRIBED_SUCCESS_UPDATE',
        SUBSCRIBED_SUCCESS_BETA: 'SUBSCRIBED_SUCCESS_BETA',
        SUBSCRIBED_SUCCESS_UPDATE_BETA: 'SUBSCRIBED_SUCCESS_UPDATE_BETA',


        IN_SHARE_ALERT_CREATED_SUCCESSFULLY: 'IN_SHARE_ALERT_CREATED_SUCCESSFULLY',
        IN_SHARE_ALERT_UPDATED_SUCCESSFULLY: 'IN_SHARE_ALERT_UPDATED_SUCCESSFULLY',
        IN_SHARE_ALERT_DELETED_SUCCESSFULLY: 'IN_SHARE_ALERT_DELETED_SUCCESSFULLY',
        ALERT_MARK_AS_READ_SUCCESSFULLY: 'ALERT_MARK_AS_READ_SUCCESSFULLY',

        LOCATION_REFERENCE_CREATE_SUCCESS: 'LOCATION_REFERENCE_CREATE_SUCCESS',
        LOCATION_REFERENCE_UPDATE_SUCCESS: 'LOCATION_REFERENCE_UPDATE_SUCCESS',

        VERIFY_EMAIL_SUCCESS: 'VERIFY_EMAIL_SUCCESS',
        CONFIRM_EMAIL_SUCCESS: 'CONFIRM_EMAIL_SUCCESS',

        ORDER_CREATE_SUCCESS: 'ORDER_CREATE_SUCCESS',
        UPDATE_ORDER_SUCCESS: 'UPDATE_ORDER_SUCCESS',

        CREATE_SHARE_ITEM_MAPPING_SUCCESS: 'CREATE_SHARE_ITEM_MAPPING_SUCCESS',
        UPDATE_SHARE_ITEM_MAPPING_SUCCESS: 'UPDATE_SHARE_ITEM_MAPPING_SUCCESS',
        DELETE_SHARE_ITEM_MAPPING_SUCCESS: 'DELETE_SHARE_ITEM_MAPPING_SUCCESS'
    },

    UPLOAD_S3_STATUS: {
        SUCCESS: 1,
        PROGRESSING: 2
    },

    UPLOAD_PART_STATUS: {
        PROGRESSING: 1,
        SUCCESS: 2,
        FAIL: 3
    },

    MESSAGE_TYPE: {
        TEXT: 0,
        IMAGE: 1,
        CSV: 2,
        AUDIO: 3,
        VIDEO: 4,
        TXT: 5
    },

    UPLOAD_FILE_HEADER: {
        NONE: 'NONE',
        USE: 'USE',
        IGNORE: 'IGNORE'
    },

    SUCCESS: 'SUCCESS',
    RESEND_SUCCESS: 'RESEND_SUCCESS',

    AMAZON_DEFAULT_QTY_UOM_ID: {
        QTY_UOM_ID: 107
    },

    PRECISION: {
        0: 1,
        1: 10,
        2: 100,
        3: 1000,
        4: 10000,
        5: 100000,
        6: 1000000,
        7: 10000000,
        8: 100000000,
        9: 1000000000,
        10: 10000000000,
        11: 100000000000,
        12: 1000000000000,
        13: 10000000000000,
        14: 100000000000000,
        15: 1000000000000000,
        16: 10000000000000000
    },

    REPLICATION_END_DATE: 0,

    PASS_URL: '-pass.csv',

    QUANTITY_RANGE: {
        0: {
            MAX_INTEGER: '18446744073709551615',
            MAX_FRACTIONAL: '0',
            VALUE: '18446744073709551615',
            MAX_VALUE: '18446744073709551615'
        },
        1: {
            MAX_INTEGER: '1844674407370955161',
            MAX_FRACTIONAL: '5',
            VALUE: '1844674407370955161.5',
            MAX_VALUE: '1844674407370955160.9'
        },
        2: {
            MAX_INTEGER: '184467440737095516',
            MAX_FRACTIONAL: '15',
            VALUE: '184467440737095516.15',
            MAX_VALUE: '184467440737095515.99'
        },
        3: {
            MAX_INTEGER: '18446744073709551',
            MAX_FRACTIONAL: '615',
            VALUE: '18446744073709551.615',
            MAX_VALUE: '18446744073709550.999'
        },
        4: {
            MAX_INTEGER: '1844674407370955',
            MAX_FRACTIONAL: '1615',
            VALUE: '1844674407370955.1615',
            MAX_VALUE: '1844674407370954.9999'
        },
        5: {
            MAX_INTEGER: '184467440737095',
            MAX_FRACTIONAL: '51615',
            VALUE: '184467440737095.51615',
            MAX_VALUE: '184467440737094.99999'
        },
        6: {
            MAX_INTEGER: '18446744073709',
            MAX_FRACTIONAL: '551615',
            VALUE: '18446744073709.551615',
            MAX_VALUE: '18446744073708.999999'
        }
    },


    // In Seconds
    PASSWORD_VERIFICATION_TIME_LIMIT: 2 * 60,

    //6 Week
    CONTACT_INVITATION_EXPIRATION_DATE_LIMIT: 42,

    //6 Week
    CUSTOMER_INVITATION_EXPIRATION_DATE_LIMIT: 42,

    INVITATION_EXPIRATION_DATE_LIMIT: 42,

    RANDOM_LOW_LIMIT: 10000,

    RANDOM_HIGH_LIMIT: 99999,

    SCOPEHUB_EFS_PATH: '/mnt/db_csv',

    SCOPEHUB_TWILIO_BUCKET: EndpointConfig.SCOPEHUB_TWILIO_BUCKET,

    SCOPEHUB_SES_EMAIL_BUCKET: EndpointConfig.SCOPEHUB_SES_EMAIL_BUCKET,

    SCOPEHUB_ACCOUNTS_S3_BUCKET: EndpointConfig.SCOPEHUB_ACCOUNTS_EU_S3_BUCKET,
    //SCOPEHUB_ACCOUNTS_S3_BUCKET: EndpointConfig.SCOPEHUB_ACCOUNTS_S3_BUCKET,

    SCOPEHUB_SELLER_EMAILS_BUCKET: EndpointConfig.SCOPEHUB_SELLER_EMAILS_BUCKET,

    SCOPEHUB_CHAT_S3_BUCKET: EndpointConfig.SCOPEHUB_CHAT_S3_BUCKET,

    SCOPEHUB_DECLINE_INVITATION_PAGE_URL: 'https://share.scopehub.org/decline-auth-request-by-email?',

    S3_FOLDER: {
        ARRIVAL_FILES: 'arrival-files',
        UPLOAD_SUCCESS: 'success-files',
        UPLOAD_FAIL: 'fail-files',
        PRODUCT_IMAGES: 'product-images',
        SUPPLY_ITEM_IMAGES: 'supply-item-images',
        BILLING_PDF: 'bill-pdfs',
        SHARED_DATA_CSV: 'shared-data-csv',
        PROCESSED_CSV_FILES: 'processed-csv-files',
        ORIGINAL_FILES: 'original-files'
    },
    SELLER_CREDENTIALS: {
        NOT_SET: 0,
        VALIDATED: 1
    },

    OTP_MESSAGE_PREFIX: 'Your ScopeHub verification code is : ',

    REDIS_GET_USER_NAME_DB: 'user',

    GROUP_NAME: 'name',

    RECEIVER: 'receiver',

    GROUP_ID: 'groupId',

    GROUP_STATUS_ACTIVE: 'ACTIVE',

    GROUP_STATUS_INACTIVE: 'INACTIVE',

    USER_EMAIL_INDEX: 'EmailIndex',

    CHAT_GROUP_SENDER_INDEX: 'SenderIndex',

    CHAT_GROUP_RECEIVER_INDEX: 'ReceiverIndex',

    COUNTRY_CODE_INDEX: 'CountryCodeIndex',

    CURRENCY_CODE_INDEX: 'CurrencyCodeIndex',

    USER_ACCOUNT_INDEX: 'AccountIdIndex',

    CONTACT_INVITER_UUID_INDEX: 'InviterUUIDIndex',

    CONTACT_INVITER_UUID: 'inviterUUID',

    CONTACT_INVITEE_EMAIL: 'inviteeEmail',

    CONTACT_INVITEE_UUID: 'inviteeUUID',

    CONTACT_INVITEE_UUID_INDEX: 'InviteeUUIDIndex',

    CONTACT_INVITER_UUID_INVITEE_EMAIL_INDEX: 'InviterUUIDInviteeEmailIndex',

    STATUS_INDEX: 'StatusIndex',

    GROUP_INDEX: 'GroupIndex',

    GROUP_MEMBER_END_DATE_INDEX: 'GroupMemberEndDateIndex',

    GROUP_MEMBER_END_DATE: 'memberEndDate',

    SENDER_RECEIVER_INDEX: 'SenderReceiverIndex',

    POLLING_ACCOUNT_INDEX: 'AccountIdIndex',

    POLLING_MESSAGE_ID_INDEX: 'SQSMessageIdIndex',

    OWNER_GROUP_NAME_INDEX: 'OwnerGroupNameIndex',

    GROUP_NAME_INDEX: 'GroupNameIndex',

    CONTACT_GROUP_INDEX: 'ContactGroupIndex',

    PRODUCT_SELLER_SKU_NAME: 'sellerSKU',

    SUPPLIER_CODE: 'supplierCode',

    SUPPLIER_ACCOUNT_INDEX: 'AccountIdIndex',

    ACCOUNT_ID_SUPPLIER_ID_INDEX: 'AccountIdSupplierIdIndex',

    PRODUCT_REFERENCE_ACCOUNT_INDEX: 'AccountIdIndex',

    SUPPLIER_REFERENCE_ACCOUNT_INDEX: 'AccountIdIndex',

    SUPPLIER_CODE_INDEX: 'supplierCodeIndex',

    MEASUREMENT_SHORT_NAME: 'shortName',

    MARKETPLACE_ID: 'marketplaceId',

    MEASUREMENT_SHORT_NAME_INDEX: 'shortNameIndex',

    NOTIFICATION_TOPIC_TIMESTAMP_INDEX: 'TopicTimestampIndex',

    NOTIFICATION_TOPIC_SNOOZE_TIMESTAMP_INDEX: 'TopicSnoozeNextUtcTimeIndex',

    NOTIFICATION_CONTACT_ID_INDEX: 'ContactIdIndex',

    PRODUCT_ACCOUNT_INDEX: 'AccountProductIndex',

    SELLER_PRODUCT_MP_ID_INDEX: 'SellerProductMPIdIndex',

    ACCOUNT_ID_SKU_INDEX: 'AccountIdSKUIndex',

    ACCOUNT_MARKETPLACE_INDEX: 'AccountMarketplaceIndex',

    SCENARIO_NAME_INDEX: 'ScenarioNameIndex',

    SCENARIO_ID_INDEX: 'ScenarioIdIndex',

    PRICE_SCENARIO_ID_INDEX: 'ScenarioIdIndex',

    PRICE_INDEX: 'PriceIndex',

    QUANTITY_SCENARIO_ID_INDEX: 'ScenarioIdIndex',

    QUANTITY_INDEX: 'QuantityIndex',

    COST_SCENARIO_ID_INDEX: 'ScenarioIdIndex',

    COST_INDEX: 'CostIndex',

    CONTACT_NOTIFICATION_ID_INDEX: 'NotificationIdIndex',

    BLACKLIST_INVITER_EMAIL: 'inviterEmail',

    BLACKLIST_INVITER_EMAIL_DOMAIN: 'inviterEmailDomain',

    BLACKLIST_INVITER_UUID: 'inviterUUID',

    BLACKLIST_INVITEE_UUID_INDEX: 'InviteeUUIDIndex',

    BLACKLIST_INVITEE_UUID_INVITER_UUID_INDEX: 'InviteeUUIDInviterUUIDIndex',

    BLACKLIST_INVITEE_UUID_EMAIL_INDEX: 'InviteeUUIDEmailIndex',

    BLACKLIST_INVITEE_UUID_EMAIL_DOMAIN_INDEX: 'InviteeUUIDEmailDomainIndex',

    ACCOUNT_ID_CUSTOMER_ID_INDEX: 'AccountIdCustomerIdIndex',

    CUSTOMER_ID_INDEX: 'customerIdIndex',

    CUSTOMER_ACCOUNT_INDEX: 'AccountIdIndex',

    LOCATION_REFERENCE_ACCOUNT_INDEX: 'AccountIdIndex',

    ID_INDEX: 'idIndex',

    PRODUCT_INVENTORY_ACCOUNT_INDEX: 'AccountIdIndex',

    OUT_SHARING_ACCOUNT_INDEX: 'AccountIdIndex',

    OUT_SHARE_INSTANCE_ACCOUNT_INDEX: 'AccountIdIndex',

    OUT_SHARE_INSTANCE_SHARING_DATE_INDEX: 'SharingDateIndex',

    ACCOUNT_AUTH_TOKEN_INDEX: 'AuthTokenIndex',

    SUPPLY_ITEM_ACCOUNT_INDEX: 'AccountIdIndex',

    SUPPLY_INVENTORY_ACCOUNT_INDEX: 'AccountIdIndex',

    UNIT_OF_MEASURE_CATEGORY_ACCOUNT_INDEX: 'AccountIdIndex',

    UNIT_OF_MEASURES_ACCOUNT_INDEX: 'AccountIdIndex',

    PRODUCT_ID_INDEX: 'ProductIdIndex',

    REFERRAL_LAST_NAME: '.',

    REFERRAL_STATUS: 'inactive',

    INVITE_NOTIFICATION_MESSAGE: ' has invited you to connect',

    INVITE_ACCEPT_NOTIFICATION_MESSAGE: ' has accepted your invitation to connect',

    INVITE_DECLINE_NOTIFICATION_MESSAGE: ' has declined your invitation to connect',

    INVITE_JOINED_SCOPEHUB: ' has joined Scopehub , add him to your contacts to start collaborating',

    INVITE_JOINED_SCOPEHUB_FRIENDS: ' has joined Scopehub , and has been added to your contacts',

    HTTPS_PROTOCOL: 'https://',

    USER_VERIFY_API: '/api/user/account/verify/',

    USER_RESET_PASSWORD_API: '/api/auth/reset/',

    VERIFICATION_OPTIONS: ['verifyFromPhone', 'verifyFromUnauthorized', 'never'],

    LANGUAGE_OPTIONS: ['en', 'de'],

    DEFAULT_HL: 'en',

    ALLOWED_HL_PARAMETER: ['en', 'de', 'en-US'],

    VALID_LANGUAGE_CULTURE_CODE: ['en-US', 'de-DE'],

    REMEMBER_COOKIE_PARAM: 'remember',

    REMEMBER_DEVICE_COOKIE_PARAM: 'remember_device',

    ACCOUNT_AUTHENTICATION_TOKEN: 'scopehub-auth-token',

    VERIFICATION_MODE: ['email', 'phone'],
    IN_SHARE_ACCOUNT_INDEX: 'AccountIdIndex',
    IN_SHARE_ITEMID_SHARING_PROFILEID_INDEX: 'ItemIdSharingProfileIdIndex',

    ORDER_ACCOUNT_TIMESTAMP_INDEX: 'AccountIdTimestampIndex',

    STATUS_MARKETPLACE_INDEX: 'StatusMarketplaceIdIndex',

    ACCOUNT_EVENT_INEDX: 'AccountIdEventIdIndex',

    TYPES_INDEX: 'TypesIndex',
    TYPES_NEXT_REPLICATION_TIME_INDEX: 'TypesNextReplicationTimeIndex',
    STATUS_NEXT_REPLICATION_TIME_INDEX: 'StatusNextReplicationTimeIndex',
    STATUS_ACCOUNT_INDEX: 'StatusAccountIndex',
    START_TIME_ACCOUNT_INDEX: 'StartTimeAccountIndex',
    SCOPEHUB_API_TOKEN: 'xlK6cQsQRkvKdhIYH9n15yuzIhaLuiug',

    ACCOUNT_OWNER_TITLE: 'account owner',

    ORDER_TYPE: 1,

    CODE_EXPIRE_LIMIT: 10,

    REPLICATION_STATUS: {
        NEW: '1',
        PROGRESSING: '2',
        HOLD: '3',
        FAIL: '4',
        SUCCESS: '5'
    },

    SHARING_EVENT_STATUS: {
        ACTIVE: 1,
        DEACTIVE: 2
    },

    REPLICATION_LOG_STATUS: {
        PROGRESSING: 1,
        FINISH: 2
    },

    RECORD_TYPE: {
        REPLICATION: 1,
        MANUAL: 2
    },

    ORDER_STATUS: {
        OLI_NOT_PROCESSED: 0,
        OLI_PROCESSED: 1
    },

    LIST_PRODUCT_STATUS: {
        PROGRESSING: 1,
        SUCCESS: 2,
        ERROR: 3
    },

    ORDER_FREQUENCY_TYPE: {
        DAILY: 'daily',
        WEEKLY: 'weekly',
        MONTHLY: 'monthly',
        HOURLY: 'hourly',
        EVERY_15_MIN: 'every_15_min'
    },

    TYPE_DEFAULT_VALUE: {
        STRING: '',
        NUMBER: 0,
        BOOLEAN: false,
        BINARY: '',
        DATETIME: '0',
        TIMESTAMP: '0000-00-00 00:00:00.000'
    },

    CHARACTER_SET: 'ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz',

    DEFAULT_ROLE: {
        ACCOUNT_OWNER: '7101e660-1778-4bd0-ad9f-88f3981a4c6a'
    },

    // Inventory Transaction
    QTY_TYPE: {
        QTY_ON_HAND: {
            CODE: 1,
            TYPE: 'qtyOnHand',
            QTY_UOM: 'qtyOnHandUoM'
        },
        QTY_ON_ORDER: {
            CODE: 2,
            TYPE: 'qtyOnOrder',
            QTY_UOM: 'qtyOnOrderUoM'
        },
        QTY_AVAILABLE: {
            CODE: 3,
            TYPE: 'qtyAvailable',
            QTY_UOM: 'qtyAvailableUoM'
        },
        QTY_IN_TRANSIT: {
            CODE: 4,
            TYPE: 'qtyInTransit',
            QTY_UOM: 'qtyInTransitUoM'
        },
        QTY_COMMITED: {
            CODE: 5,
            TYPE: 'qtyCommited',
            QTY_UOM: 'qtyCommitedUoM'
        }
    },

    INVENTORY_OPERATION: {
        ADD: 1,
        DEDUCT: 2
    },

    VIEW_TYPES: {
        PRODUCT_INVENTORY_SHARED_DATA: 1,
        SUPPLY_INVENTORY_SHARED_DATA: 2,
        PRODUCT_ORDER_SHARED_DATA: 3,
        DEPENDENT_DEMAND_SHARED_DATA: 4,
        IN_SHARE: 5,
        OUT_SHARE: 6,
        PRODUCT_REFERENCE: 7,
        PRODUCT_INVENTORY: 8,
        SUPPLY_ITEMS: 9,
        SUPPLY_INVNETORY: 10,
        ORDER_REFERENCE_INFORMATION: 11,
        ORDER_LINE_ITEMS: 12,
        LOCATION_REFERENCE: 13
    },

    INVENTORY_TRANSACTION_REASON_CODE: {
        DEFAULT: {
            CODE: 0
        },
        REMOVED_FOR_ORDER_FULLFILMENT: {
            CODE: 101
        },
        ADDED_FOR_ORDER_FULLFILMENT: {
            CODE: 102
        }
    },

    ORDER_TYPE_ARRAY: {
        ECO: [{
            languageCultureCode: 'en-US',
            name: 'End-Customer Order',
            symbol: 'ECO',
            comment: 'ECO for en-US'
        }, {
            languageCultureCode: 'de-DE',
            nam: 'Endkundenauftrag',
            symbol: 'EKA',
            comment: 'ECO for en-US'
        }],
        NON_ECO: [{
            languageCultureCode: 'en-US',
            name: 'non-End-Customer Order',
            symbol: 'non-ECO',
            comment: 'non-ECO order type for en-US'
        }, {
            languageCultureCode: 'de-DE',
            name: 'Weitervarbeitungsauftrag',
            symbol: 'WVA',
            comment: 'non-ECO order type for de-DE'
        }]
    },

    ORDER_TYPE_ID: {
        ECO: 'a77204df-c7b3-467e-972a-918888aeb9bc',
        NON_ECO: '667101f0-8148-4df9-ab2e-4e485b6d84c1'
    },

    UNIT_OF_MEASURE: {
        EACH: '2e44a7fb-2bb4-4ef7-a660-514c18949f3b'
    },

    UOM: {
        EACH: 107
    },

    MAX_UOM_SCALING_FACTOR: 999999999.999999,

    ITEM_ACCOUNT_MARKETPLACE_ORDER_INDEX: 'AccountIdMarketPlaceIdOrderIdIndex',
    ORDER_LINE_ITEMS_ACCOUNT_ID_SELLER_SKU_INDEX: 'AccountIdSellerSKU',

    ACCOUNT_SELLER_SKU_INDEX: 'AccountIdSellerSKUIndex',

    ROLE_ID_INDEX: 'RoleIdIndex',

    GET_ORDERS: {
        DEFAULT_LIMIT: 5
    },

    FILE_DELIMETER: {
        SOF: 'SOF',
        EOF: 'EOF',
        VERSION: ['V1.0', 'V2.0', 'V3.0'],
        LANGUAGE_CULTURE_CODE: ['en-US', 'de-DE'],
        ENCODING_TYPE: ['UTF-8'],
        COMPREESION_TYPE: ['GZIP'],
        LINE_DELIMTER: ['\\n', '\\r'],
        QUOTE_DELIMITER: ['“”', '""'],
        COLUMN_DELIMITER: [',']
    },

    VERSION: {
        VERSION_1: {
            value: 1,
            type: 'V1.0'
        },
        VERSION_2: {
            value: 2,
            type: 'V2.0'
        },
        VERSION_3: {
            value: 3,
            type: 'V3.0'
        }
    },

    CONTENT_TYPE: {
        IMAGE_JPEG: 'image/jpeg',
        TEXT_CSV: 'text/csv',
        APPLICATION_PDF: 'application/pdf'
    },

    IMAGE_UPLOAD_STATUS: {
        SUCCESS: 1,
        FAILED: 2,
        PROGRESSING: 3
    },

    FILE_RESPONSE_STATUS: [1, 2],

    DESTINATION_FOLDER: {
        1: 'orders',
        2: 'orderItems',
        3: 'products',
        4: 'productInventories',
        5: 'supplyItems',
        6: 'supplyInventories',
        7: 'locationReferences',
        8: 'unitOfMeasures',
        9: 'suppliers',
        10: 'customers'
    },

    AMOUNT_REGEXP: '^[+-]?[0-9]*([0-9]\\.|[0-9]|\\.[0-9])[0-9]*(e[+-]?[0-9]+)?$',

    EMAIL_REGEXP: '^(([^<>()\\[\\]\\\\.,;:\\s@"]+(\\.[^<>()\\[\\]\\\\.,;:\\s@"]+)*)|(".+"))@((\\[[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}])|(([a-zA-Z\\-0-9]+\\.)+[a-zA-Z]{2,}))$',

    DEFAULT_MAIN_IMAGE: '',

    MILISECONDS_OF_DAY: 86400000,

    LOCATION_REFERENCE_DELETED_SUCCESSFULLY: 'LOCATION_REFERENCE_DELETED_SUCCESSFULLY',

    UPLOAD_COMPLETED_STEPS: {
        STEP_1: 1, //validation on client
        STEP_2: 2, // upload to s3
        STEP_3: 3,// copy
        STEP_4: 4, // decompress , decrypt
        STEP_5: 5, // load into temp
        STEP_6: 6, //logical validation
        STEP_7: 7  //Move to original
    },

    UPLOAD_STATUS: {
        PROGRESSING: 0,// File is not validated and uploaded on s3 bucket yet
        VALIDATE_FAIL: 1, // File is fail to validate on client side
        VALIDATE_SUCCESS: 2, // Validate success on client side
        S3_UPLOAD_FAILED: 3, // uploading is fail
        S3_UPLOAD_SUCCESS: 4,// file is uploaded on s3 bucket successfully
        COPY_FAIL: 5, // Copy file from s3 to EFS and scan fail
        COPY_SUCCESS: 6,//Copy file from s3 to EFS and scan success
        DECRYPT_FAIL: 7, // decrypt fail
        DECRYPT_SUCESS: 8, // decrypt success
        DECOMPRESS_FAIL: 9, // decompress fail
        DECOMPRESS_SUCCESS: 10, // decompress success
        LOAD_TO_TEMP_FAIL: 11, // Fail during load to temp table
        LOAD_TO_TEMP_SUCCESS: 12, // Success in load to temp table
        LOGICAL_VALIDATION_SUCCESS: 13, // Logical validation success
        LOGICAL_VALIDATION_FAIL: 14, // logical validation fail
        COPY_TEMP_DATA_TO_ORIGINAL_SUCCESS: 15, //copy from temp to original table success
        COPY_TEMP_DATA_TO_ORIGINAL_FAIL: 16, // copy from temp to original table fail
        UPLOAD_FAILED: 17, // In case of file not found
        CANCEL_BY_USER: 18 // upload cancel by user
    },

    UPLOAD_STATUS_REASON_CODES: {
        DEFAULT: {
            CODE: 0
        },
        INVALID_FILE_FORMAT: {
            CODE: 101
        },
        INVALID_FILE: {
            CODE: 102
        },
        UPLOAD_FAIL: {
            CODE: 103
        },
        COPY_FILE_TO_EFS_FAIL: {
            CODE: 104
        },
        LOGICAL_VALIDATION_FAIL: {
            CODE: 105
        },
        COPY_DATA_FAIL: {
            CODE: 106
        },
        FILE_NOT_FOUND: {
            CODE: 107
        }
    },

    FILE_OPERATION_TYPE: {
        1: 'CHECK_1',
        2: 'CHECK_2',
        3: 'CHECK_3',
        4: 'CHECK_4',
        5: 'COMPRESSION',
        6: 'SPLITTING',
        7: 'ENCRYPTION'
    },

    AMOUNT_UOM: [
        {
            AMOUNT: 'weightAmount',
            AMOUNT_UOM: 'weightUoMScal'
        },
        {
            AMOUNT: 'heightAmount',
            AMOUNT_UOM: 'heightUoMScal'
        },
        {
            AMOUNT: 'lengthAmount',
            AMOUNT_UOM: 'lengthUoMScal'
        },
        {
            AMOUNT: 'depthAmount',
            AMOUNT_UOM: 'depthUoMScal'
        },
        {
            AMOUNT: 'diameterAmount',
            AMOUNT_UOM: 'diameterUoMScal'
        },
        {
            AMOUNT: 'volumeAmount',
            AMOUNT_UOM: 'volumeUoMScal'
        }
    ],

    ORDER_ERROR_LOG_REASON_CODE: {
        CREATE_REPLICATION_LOG_FAIL: {
            CODE: 101,
            MESSAGE: 'CREATE_REPLICATION_LOG_FAIL'
        },
        GET_SELLER_TOKEN_FAILED: {
            CODE: 102,
            MESSAGE: 'GET_SELLER_TOKEN_FAILED'
        },
        ORDER_GET_FAILED: {
            CODE: 103,
            MESSAGE: 'ORDER_GET_FAILED'
        },
        ORDER_ITEM_GET_FAILED: {
            CODE: 104,
            MESSAGE: 'ORDER_ITEM_GET_FAILED'
        },
        ORDER_REFERENCE_INFORMATION_STORE_FAILED: {
            CODE: 105,
            MESSAGE: 'ORDER_REFERENCE_INFORMATION_STORE_FAILED'
        },
        ORDER_LINE_ITEM_STORE_FAILED: {
            CODE: 106,
            MESSAGE: 'ORDER_LINE_ITEM_STORE_FAILED'
        },
        CUSTOMER_STORE_FAILED: {
            CODE: 107,
            MESSAGE: 'CUSTOMER_STORE_FAILED'
        },
        ORDER_REFERENCE_INFORMATION_UPDATE_FAILED: {
            CODE: 108,
            MESSAGE: 'ORDER_REFERENCE_INFORMATION_UPDATE_FAILED'
        },
        ORDER_LINE_ITEM_UPDATE_FAILED: {
            CODE: 109,
            MESSAGE: 'ORDER_LINE_ITEM_UPDATE_FAILED'
        },
        CUSTOMER_UPDATE_FAILED: {
            CODE: 110,
            MESSAGE: 'CUSTOMER_UPDATE_FAILED'
        },
        PRODUCT_NOT_FOUND: {
            CODE: 111,
            MESSAGE: 'PRODUCT_NOT_FOUND, ORDER_LINE_ITEM_NOT_IMPORTED'
        }
    },

    DATA_SHARING_FAIL_REASON_CODE: {
        IN_SHARE_PARTNER_NOT_HAS_ENCRYPTION_SETUP: {
            CODE: 101,
            MESSAGE: 'IN_SHARE_PARTNER_NOT_HAS_ENCRYPTION_SETUP'
        },
        SHARE_ITEM_NOT_FOUND: {
            CODE: 102,
            MESSAGE: 'SHARE_ITEM_NOT_FOUND'
        },
        SHARE_PARTNER_NOT_FOUND: {
            CODE: 103,
            MESSAGE: 'SHARE_PARTNER_NOT_FOUND'
        },
        ENCRYPTION_FAILED: {
            CODE: 104,
            MESSAGE: 'ENCRYPTION_FAILED'
        },
        HASH_GENERATE_FAILED: {
            CODE: 105,
            MESSAGE: 'HASH_GENERATE_FAILED'
        },
        SHARED_DATA_CREATE_FAILED: {
            CODE: 106,
            MESSAGE: 'SHARED_DATA_CREATE_FAILED'
        },
        OUT_SHARE_PARTNER_NOT_HAS_ENCRYPTION_SETUP: {
            CODE: 107,
            MESSAGE: 'OUT_SHARE_PARTNER_NOT_HAS_ENCRYPTION_SETUP'
        },
        OUT_SHARE_NOT_HAVE_ANY_IN_SHARE_PARTNER: {
            CODE: 108,
            MESSAGE: 'OUT_SHARE_NOT_HAVE_ANY_IN_SHARE_PARTNER'
        }
    },

    VALIDATION_FAIL_REASON_CODE: {
        INVALID_FILE_FORMAT: {
            CODE: 100,
            MESSAGE: 'INVALID_FILE_FORMAT'
        },
        EMPTY_VALUE: {
            CODE: 101,
            MESSAGE: 'EMPTY_VALUE'
        }, INVALID_FILE_DELIMITER: {
            CODE: 102,
            MESSAGE: 'INVALID_FILE_DELIMITER'
        }, FIELD_HAS_NON_NUMERIC_DATA: {
            CODE: 103,
            MESSAGE: 'FIELD_HAS_NON_NUMERIC_DATA'
        }, FIELD_HAS_NON_STRING_DATA: {
            CODE: 104,
            MESSAGE: 'FIELD_HAS_NON_STRING_DATA'
        }, FIELD_HAS_NON_BOOLEAN_DATA: {
            CODE: 105,
            MESSAGE: 'FIELD_HAS_NON_BOOLEAN_DATA'
        }, FIELD_HAS_NON_DATETIME_DATA: {
            CODE: 106,
            MESSAGE: 'FIELD_HAS_NON_DATETIME_DATA'
        }, FIELD_HAS_LESS_LENGTH_VALUE_THAN_MININUM_LENGTH: {
            CODE: 107,
            MESSAGE: 'FIELD_HAS_LESS_LENGTH_VALUE_THAN_MININUM_LENGTH'
        }, FIELD_HAS_MORE_LENGTH_VALUE_THAN_MAXINUM_LENGTH: {
            CODE: 108,
            MESSAGE: 'FIELD_HAS_MORE_LENGTH_VALUE_THAN_MAXINUM_LENGTH'
        }, AMOUNT_OR_UNIT_OF_MEASURE_IS_MISSING: {
            CODE: 109,
            MESSAGE: 'AMOUNT_OR_UNIT_OF_MEASURE_IS_MISSING'
        }, INVALID_QUANTITY_VALUES: {
            CODE: 110,
            MESSAGE: 'INVALID_QUANTITY_VALUES'
        }, INVALID_AMOUNT_VALUES: {
            CODE: 111,
            MESSAGE: 'INVALID_AMOUNT_VALUES'
        }, UNIT_OF_MEASURE_NOT_FOUND: {
            CODE: 112,
            MESSAGE: 'UNIT_OF_MEASURE_NOT_FOUND'
        }, DUPLICATE_ORDER_IN_THE_FILE: {
            CODE: 113,
            MESSAGE: 'DUPLICATE_ORDER_IN_THE_FILE'
        }, ORDER_NOT_FOUND: {
            CODE: 114,
            MESSAGE: 'ORDER_NOT_FOUND'
        }, DUPLICATE_PRODUCT_IN_THE_FILE: {
            CODE: 115,
            MESSAGE: 'DUPLICATE_PRODUCT_IN_THE_FILE'
        }, PRODUCT_ALREADY_EXIST: {
            CODE: 116,
            MESSAGE: 'PRODUCT_ALREADY_EXIST'
        }, DUPLICATE_PRODUCT_INVENTORY_IN_THE_FILE: {
            CODE: 117,
            MESSAGE: 'DUPLICATE_PRODUCT_INVENTORY_IN_THE_FILE'
        }, PRODUCT_REFERENCE_NOT_FOUND: {
            CODE: 118,
            MESSAGE: 'PRODUCT_REFERENCE_NOT_FOUND'
        }, LOCATION_REFERENCE_NOT_FOUND: {
            CODE: 119,
            MESSAGE: 'LOCATION_REFERENCE_NOT_FOUND'
        }, PRODUCT_INVENTORY_ALREADY_EXIST: {
            CODE: 120,
            MESSAGE: 'PRODUCT_INVENTORY_ALREADY_EXIST'
        }, DUPLICATE_SUPPLY_ITEM_IN_THE_FILE: {
            CODE: 121,
            MESSAGE: 'DUPLICATE_SUPPLY_ITEM_IN_THE_FILE'
        }, SUPPLY_ITEMS_ALREADY_EXIST: {
            CODE: 122,
            MESSAGE: 'SUPPLY_ITEMS_ALREADY_EXIST'
        }, DUPLICATE_SUPPLY_ITEM_INVENTORY_IN_THE_FILE: {
            CODE: 123,
            MESSAGE: 'DUPLICATE_SUPPLY_ITEM_INVENTORY_IN_THE_FILE'
        }, SUPPLY_ITEM_NOT_FOUND: {
            CODE: 124,
            MESSAGE: 'SUPPLY_ITEM_NOT_FOUND'
        }, SUPPLY_ITEM_INVENTORY_ALREADY_EXIST: {
            CODE: 126,
            MESSAGE: 'SUPPLY_ITEM_INVENTORY_ALREADY_EXIST'
        }, COPY_FILE_FROM_S3_TO_EFS_FAIL: {
            CODE: 127,
            MESSAGE: 'COPY_FILE_FROM_S3_TO_EFS_FAIL'
        }, UOM_IS_FROM_DIFFERENT_CATEGORY: {
            CODE: 128,
            MESSAGE: 'UOM_IS_FROM_DIFFERENT_CATEGORY'
        }, INVALID_PHONE_VALUES: {
            CODE: 129,
            MESSAGE: 'INVALID_PHONE_VALUES'
        }, DUPLICATE_LOCATION_REFERENCE_IN_THE_FILE: {
            CODE: 130,
            MESSAGE: 'DUPLICATE_LOCATION_REFERENCE_IN_THE_FILE'
        }, LOCATION_REFERENCE_ALREADY_EXIST: {
            CODE: 131,
            MESSAGE: 'LOCATION_REFERENCE_ALREADY_EXIST'
        }, INVALID_LATITUDE_VALUE: {
            CODE: 132,
            MESSAGE: 'INVALID_LATITUDE_VALUE'
        }, INVALID_LONGITUDE_VALUE: {
            CODE: 133,
            MESSAGE: 'INVALID_LONGITUDE_VALUE'
        }, INVALID_SCALING_VALUE: {
            CODE: 134,
            MESSAGE: 'INVALID_SCALING_VALUE'
        }, UNIT_OF_MEASURE_EXIST_WITH_SAME_NAME: {
            CODE: 135,
            MESSAGE: 'UNIT_OF_MEASURE_EXIST_WITH_SAME_NAME'
        }, UNIT_OF_MEASURE_EXIST_WITH_SAME_SYMBOL: {
            CODE: 136,
            MESSAGE: 'UNIT_OF_MEASURE_EXIST_WITH_SAME_SYMBOL'
        }, UNIT_OF_MEASURE_EXIST_WITH_SAME_SCALING_FACTOR_AND_PRECISION: {
            CODE: 137,
            MESSAGE: 'UNIT_OF_MEASURE_EXIST_WITH_SAME_SCALING_FACTOR_AND_PRECISION'
        }, UNIT_OF_MEASURE_SCALING_FACTOR_ONE_ALREADY_EXIST_FOR_THIS_CATEGORY: {
            CODE: 138,
            MESSAGE: 'UNIT_OF_MEASURE_SCALING_FACTOR_ONE_ALREADY_EXIST_FOR_THIS_CATEGORY'
        }, UNIT_OF_MEASURE_SCALAR_FACTOR_SHOULD_BE_1: {
            CODE: 139,
            MESSAGE: 'UNIT_OF_MEASURE_SCALAR_FACTOR_SHOULD_BE_1'
        }, DUPLICATE_UNIT_OF_MEASURE_NAME_IN_THE_FILE: {
            CODE: 140,
            MESSAGE: 'DUPLICATE_UNIT_OF_MEASURE_NAME_IN_THE_FILE'
        }, DUPLICATE_UNIT_OF_MEASURE_SYMBOL_IN_THE_FILE: {
            CODE: 141,
            MESSAGE: 'DUPLICATE_UNIT_OF_MEASURE_SYMBOL_IN_THE_FILE'
        }, DUPLICATE_SCALING_VALUE_IN_THE_FILE: {
            CODE: 142,
            MESSAGE: 'DUPLICATE_SCALING_VALUE_IN_THE_FILE'
        }, INVALID_SCALING_PRECISION: {
            CODE: 143,
            MESSAGE: 'INVALID_SCALING_PRECISION'
        }, INVALID_EMAIL: {
            CODE: 144,
            MESSAGE: 'INVALID_EMAIL'
        }, DUPLICATE_SUPPLIER_IN_THE_FILE: {
            CODE: 145,
            MESSAGE: 'DUPLICATE_SUPPLIER_IN_THE_FILE'
        }, SUPPLIER_ALREADY_EXIST: {
            CODE: 146,
            MESSAGE: 'SUPPLIER_ALREADY_EXIST'
        }, DUPLICATE_CUSTOMER_IN_THE_FILE: {
            CODE: 147,
            MESSAGE: 'DUPLICATE_CUSTOMER_IN_THE_FILE'
        }, CUSTOMER_ALREADY_EXIST: {
            CODE: 148,
            MESSAGE: 'CUSTOMER_ALREADY_EXIST'
        }, MARKET_PLACE_NOT_FOUND: {
            CODE: 149,
            MESSAGE: 'MARKET_PLACE_NOT_FOUND'
        }
    },

    LANGUAGE_CULTURE_CODE: {
        en_US: 'en-US',
        de_DE: 'de-DE'
    },

    SPACE_SEPARATOR: ' ',

    UOM_CATEGORY_FOR_PRODUCTS: {
        WEIGHT: 'Weight',
        HEIGHT: 'Height',
        LENGTH: 'Length',
        DEPTH: 'Depth',
        DIAMETER: 'Diameter',
        VOLUME: 'Volume'
    },

    TABLE_NAME: {
        1: {
            TEMP: 'tempORI',
            ORIGINAL: 'OrderReferenceInformation',
            REFERENCE: '',
            AMOUNT_MANIPULATION: true,
            AMOUNT_FIELDS: [7],
            QUANTITY_MANIPULATION: false,
            QUANTITY_UOM: [],
            ERROR_MESSAGE: 'INVALID_AMOUNT_VALUES',
            SKIP_FIELDS: [],
            DEFAULT_COLUMN_QUERY: 'id=uuid_to_bin(uuid()),accountId=uuid_to_bin(?),createdBy=uuid_to_bin(?),createdAt=?,updatedAt=?,recordType=?,',
            INVALID_RECORDS: [
                {
                    QUERY: 'SELECT amazonOrderId,count(*) as count,group_concat(CAST(uuid_from_bin(id) as CHAR)) as tempId FROM tempORI ' +
                      ' WHERE createdBy = uuid_to_bin(?) GROUP BY amazonOrderID, mpId HAVING count > 1',
                    ERROR: 'DUPLICATE_ORDER_IN_THE_FILE',
                    COLUMN_NAME: 'amazonOrderId',
                    QUERY_NUMBER: 1,
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT distinct TORI.mpId, CAST(uuid_from_bin(TORI.id) as CHAR) as tempId from tempORI TORI WHERE' +
                      ' TORI.mpId not LIKE \'%DEFAULT%\' AND TORI.mpId != ? AND' +
                      ' NOT exists (select 1 from AccountMarketplaces AM where TORI.mpId = AM.mpId and TORI.accountId = AM.accountId)' +
                      ' AND accountId = uuid_to_bin(?) AND createdBy = uuid_to_bin(?) ',
                    ERROR: 'MARKET_PLACE_NOT_FOUND',
                    COLUMN_NAME: 'mpId',
                    QUERY_NUMBER: 2,
                    IS_UPDATE: 1
                }
            ],
            LOGICAL_VALIDATION: [
                /* {
                     QUERY: 'select distinct TORI.mpId from tempORI TORI where createdBy=uuid_to_bin(?) and not exists ' +
                       '(select 1 from AccountMarketplaces AM where TORI.mpId = AM.mpId and TORI.accountId = AM.accountId);',
                     ERROR: 'MARKETPLACE_NOT_FOUND',
                     COLUMN_NAME: 'mpId'
                 }*/
                /*, {
                    QUERY: 'select TORI.mpId, TORI.amazonOrderId from OrderReferenceInformation ORI , tempORI TORI where ' +
                    'ORI.mpId=TORI.mpId and  ORI.amazonOrderId=TORI.amazonOrderId and ' +
                    'ORI.accountId = TORI.accountId and TORI.createdBy = uuid_to_bin(?)',
                    ERROR: 'ORDERS_ALREADY_EXIST',
                    COLUMN_NAME: 'amazonOrderId'
                }*/
            ],
            UOM_FIELDS: [],
            UPDATE_QUERY: ['UPDATE tempORI TORI, Marketplaces MP SET TORI.mpId = MP.mpId  WHERE  MP.isDefault =1 AND ' +
            '  TORI.createdBy = uuid_to_bin(?) and (TORI.mpId = ? OR TORI.mpId LIKE \'%DEFAULT%\') '],
            PRECISION: 100000000,
            FINAL_QUERY: 'REPLACE into OrderReferenceInformation (id,accountId,mpId,amazonOrderId,buyerName,buyerEmail,' +
              ' lastUpdateDate,orderTotalCurrencyCode,orderTotalAmount,purchaseDate,fulfillmentChannel,addressLine1,addressLine2,' +
              ' name,countryCode,stateOrRegion,postalCode,city,addressType,numberOfItemsShipped,numberOfItemsUnshipped,' +
              ' latestShipDate,orderType,isReplacementOrder,shipServiceLevel,salesChannel,shippedByAmazonTFM,isBusinessOrder,' +
              ' latestDeliveryDate,paymentMethodDetails,earliestDeliveryDate,isPremiumOrder,earliestShipDate,' +
              ' purchaseOrderNumber,paymentMethod,isPrime,shipmentServiceLevelCategory,sellerOrderId,orderStatus,recordType,' +
              ' createdAt,updatedAt,createdBy,updatedBy)' +
              ' (select uuid_to_bin(UUID()),accountId,mpId,amazonOrderId,buyerName,buyerEmail,' +
              ' FLOOR(UNIX_TIMESTAMP(lastUpdateDate)*1000),orderTotalCurrencyCode,orderTotalAmount,FLOOR(UNIX_TIMESTAMP(purchaseDate)*1000),' +
              ' fulfillmentChannel,addressLine1,addressLine2,' +
              ' name,countryCode,stateOrRegion,postalCode,city,addressType,numberOfItemsShipped,numberOfItemsUnshipped,' +
              ' FLOOR(UNIX_TIMESTAMP(latestShipDate)*1000),orderType,isReplacementOrder,shipServiceLevel,salesChannel,shippedByAmazonTFM,isBusinessOrder,' +
              ' FLOOR(UNIX_TIMESTAMP(latestDeliveryDate)*1000),paymentMethodDetails,FLOOR(UNIX_TIMESTAMP(earliestDeliveryDate)*1000),isPremiumOrder,' +
              ' FLOOR(UNIX_TIMESTAMP(earliestShipDate)*1000),' +
              ' purchaseOrderNumber,paymentMethod,isPrime,shipmentServiceLevelCategory,sellerOrderId,orderStatus,recordType,' +
              ' createdAt,updatedAt,createdBy,updatedBy' +
              ' from tempORI where accountId=uuid_to_bin(?) and createdBy=uuid_to_bin(?) and errorFlag = 0);',
            ADDITIONAL_OPERATION: [
                /*{
                    QUERY: 'REPLACE into Customers (id,accountId,customerCode,email,customerName,addressLine1,addressLine2, ' +
                      'city,firstName,zipCode,state,country,recordType,createdBy,createdAt) ' +
                      'select uuid_to_bin(uuid()),uuid_to_bin(?),concat(buyerName,LPAD(FLOOR(RAND() * 999999.99), 6, 0)), ' +
                      'buyerEmail,buyerName,addressLine1,addressLine2,city,name,postalCode,stateOrRegion,countryCode,2,uuid_to_bin(?),? ' +
                      ' from tempORI where accountId=uuid_to_bin(?) and createdBy=uuid_to_bin(?) and errorFlag = 0;',
                    ERROR: 'CREATE_CUSTOMER_FAILED'
                }*/
                {
                    QUERY: 'IF EXISTS (select * from tempORI TORI LEFT JOIN  Customers C ' +
                      ' ON TORI.accountId = uuid_to_bin(?) and TORI.createdBy = uuid_to_bin(?)' +
                      ' AND TORI.buyerEmail = C.email AND TORI.accountId = C.accountId' +
                      ' WHERE  C.email IS NOT  null and TORI.errorFlag = 0)' +
                      ' THEN ' +
                      ' UPDATE tempORI TORI LEFT JOIN  Customers C ON TORI.accountId = uuid_to_bin(?) and TORI.createdBy = uuid_to_bin(?)' +
                      ' AND TORI.buyerEmail = C.email AND TORI.accountId = C.accountId' +
                      ' SET C.customerName = TORI.buyerName , C.addressLine1 = TORI.addressLine1,C.addressLine2=TORI.addressLine2,' +
                      ' C.city= TORI.city,C.firstName = TORI.name,C.zipCode = TORI.postalCode,C.state=TORI.stateOrRegion,' +
                      ' C.country=TORI.countryCode,C.recordType = 2' +
                      ' WHERE  C.email IS NOT  null AND TORI.errorFlag = 0 AND' +
                      ' TORI.lastUpdateDate IN ' +
                      ' (SELECT distinct MAX(lastUpdateDate) FROM tempORI WHERE buyerEmail = TORI.buyerEmail and errorFlag = 0 GROUP BY buyerEmail);' +
                      ' END IF;',
                    ERROR: 'UPDATE_CUSTOMER_FAILED'
                },
                {
                    QUERY: 'insert into Customers (id,accountId,customerCode,email,customerName,addressLine1,addressLine2,' +
                      ' city,firstName,zipCode,state,country,recordType,createdBy,createdAt)' +
                      ' SELECT  uuid_to_bin(uuid()),uuid_to_bin(?),CONCAT(SUBSTR(buyerName,1,5),LPAD(FLOOR(RAND() * 999999.99), 5, 0)),' +
                      ' buyerEmail,buyerName,TORI.addressLine1,TORI.addressLine2,TORI.city,TORI.name,TORI.postalCode,' +
                      ' TORI.stateOrRegion,TORI.countryCode,2,uuid_to_bin(?), 0' +
                      ' from tempORI TORI LEFT JOIN  Customers C ON TORI.accountId = uuid_to_bin(?) and TORI.createdBy = uuid_to_bin(?)' +
                      ' AND TORI.buyerEmail = C.email AND TORI.accountId = C.accountId' +
                      ' WHERE  C.email IS NULL  AND errorFlag = 0 AND' +
                      ' TORI.lastUpdateDate IN ' +
                      ' (SELECT distinct MAX(lastUpdateDate) FROM tempORI WHERE buyerEmail = TORI.buyerEmail and errorFlag = 0 GROUP BY buyerEmail)' +
                      ' GROUP BY TORI.buyerEmail',
                    ERROR: 'CREATE_CUSTOMER_FAILED'
                }
            ]
        },
        2: {
            TEMP: 'tempOLI',
            ORIGINAL: 'OrderLineItems',
            REFERENCE: '',
            AMOUNT_FIELDS: [6, 11, 15, 17, 20, 22, 25, 27, 35, 37],
            AMOUNT_MANIPULATION: true,
            QUANTITY_MANIPULATION: false,
            QUANTITY_UOM: [],
            ERROR_MESSAGE: 'INVALID_AMOUNT_VALUES',
            SKIP_FIELDS: [2],
            DEFAULT_COLUMN_QUERY: 'id=uuid_to_bin(uuid()),accountId=uuid_to_bin(?),createdBy=uuid_to_bin(?),createdAt=?,updatedAt=?,recordType=?,',
            INVALID_RECORDS: [
                {
                    QUERY: 'select CAST(uuid_from_bin(TOLI.id) as char) as tempId,TOLI.sellerSKU as sellerSKU from tempOLI  TOLI ' +
                      ' LEFT JOIN ProductReferences PR ON PR.accountId = uuid_to_bin(?) and PR.sku = TOLI.sellerSKU ' +
                      ' where TOLI.accountId = uuid_to_bin(?) and TOLI.createdBy = uuid_to_bin(?) and TOLI.errorFlag = 0 and ' +
                      ' PR.id is null ',
                    QUERY_NUMBER: 1,
                    ERROR: 'PRODUCT_REFERENCE_NOT_FOUND',
                    COLUMN_NAME: 'sellerSKU',
                    IS_UPDATE: 1
                }
            ],
            LOGICAL_VALIDATION: [
                /*{
                    QUERY: 'select distinct TOLI.amazonOrderId from tempOLI TOLI where createdBy=uuid_to_bin(?) and not exists ' +
                      '(select 1 from OrderReferenceInformation ORI where TOLI.amazonOrderId = ORI.amazonOrderId and TOLI.accountId = ORI.accountId);',
                    ERROR: 'ORDER_NOT_FOUND',
                    COLUMN_NAME: 'amazonOrderId'
                }*/
                /*{
                    QUERY: 'select TOLI.amazonOrderId,TOLI.orderItemId from OrderLineItems OLI , tempOLI TOLI where ' +
                    'OLI.orderItemId=TOLI.orderItemId  and OLI.amazonOrderId=TOLI.amazonOrderId and ' +
                    'OLI.accountId = TOLI.accountId and TOLI.createdBy = uuid_to_bin(?);',
                    ERROR: 'ORDER_LINE_ITEM_ALREADY_EXIST',
                    COLUMN_NAME: 'orderItemId'
                }*/
            ],
            UOM_FIELDS: [],
            UPDATE_QUERY: ['UPDATE tempOLI AS TOLI, OrderReferenceInformation AS ORI SET TOLI.orderRefId = ORI.id ' +
            ' WHERE TOLI.amazonOrderId = ORI.amazonOrderId and TOLI.accountId = ORI.accountId and TOLI.createdBy = uuid_to_bin(?) ' +
            ' and TOLI.errorFlag=0; ',
                ' UPDATE tempOLI AS TOLI, ProductReferences AS PR SET TOLI.productRefId = PR.id ' +
                ' WHERE TOLI.sellerSKU = PR.sku and TOLI.accountId = PR.accountId and TOLI.createdBy = uuid_to_bin(?) AND ' +
                ' TOLI.errorFlag=0;'],
            PRECISION: 100000000,
            FINAL_QUERY: 'REPLACE into OrderLineItems (id,accountId,productRefId,orderRefId,UOMScalId,orderItemId,amazonOrderId,mpProductId,itemPriceCurrencyCode,' +
              ' itemPriceAmount,sellerSKU,quantityOrdered,quantityShipped,shippingPriceCurrencyCode,shippingPriceAmount,title,' +
              ' numberOfItems,shippingTaxCurrencyCode,shippingTaxAmount,promotionDiscountCurrencyCode,promotionDiscountAmount,' +
              ' conditionId,giftWrapTaxCurrencyCode,giftWrapTaxAmount,giftWrapPriceCurrencyCode,giftWrapPriceAmount,conditionSubtypeId,' +
              ' itemTaxCurrencyCode,itemTaxAmount,shippingDiscountCurrencyCode,shippingDiscountAmount,giftMessageText,isGift,' +
              ' priceDestination,conditionNote,scheduledDeliveryStartDate,scheduledDeliveryEndDate,CODFeeCurrencyCode,CODFeeAmount,' +
              ' CODFeeDiscountCurrencyCode,CODFeeDiscountAmount,createdAt,updatedAt,createdBy,updatedBy)' +
              ' (select uuid_to_bin(UUID()),accountId,productRefId,orderRefId,107,orderItemId,amazonOrderId,mpProductId,itemPriceCurrencyCode,' +
              ' itemPriceAmount,sellerSKU,quantityOrdered,quantityShipped,shippingPriceCurrencyCode,shippingPriceAmount,title,' +
              ' numberOfItems,shippingTaxCurrencyCode,shippingTaxAmount,promotionDiscountCurrencyCode,promotionDiscountAmount,' +
              ' conditionId,giftWrapTaxCurrencyCode,giftWrapTaxAmount,giftWrapPriceCurrencyCode,giftWrapPriceAmount,conditionSubtypeId,' +
              ' itemTaxCurrencyCode,itemTaxAmount,shippingDiscountCurrencyCode,shippingDiscountAmount,giftMessageText,isGift,' +
              ' priceDestination,conditionNote,scheduledDeliveryStartDate,scheduledDeliveryEndDate,CODFeeCurrencyCode,CODFeeAmount,' +
              ' CODFeeDiscountCurrencyCode,CODFeeDiscountAmount,recordType,createdAt,updatedAt,createdBy,updatedBy' +
              ' from tempOLI where accountId=uuid_to_bin(?) and createdBy=uuid_to_bin(?) and errorFlag = 0);',
            ADDITIONAL_OPERATION: [
                {
                    QUERY: 'UPDATE tempOLI AS TOLI, OrderReferenceInformation AS ORI SET ORI.status = 1 ' +
                      ' WHERE TOLI.amazonOrderId = ORI.amazonOrderId and TOLI.accountId = ORI.accountId and TOLI.createdBy = uuid_to_bin(?);',
                    ERROR: 'ORDER_UPDATE_FAILED'
                }
            ]
        },
        3: {
            TEMP: 'tempProductReferences',
            ORIGINAL: 'ProductReferences',
            REFERENCE: '',
            AMOUNT_FIELDS: [23, 25, 27, 29, 31, 33],
            AMOUNT_MANIPULATION: false,
            QUANTITY_MANIPULATION: true,
            QUANTITY_UOM: [
                {
                    QTY: 'weightAmount',
                    QTY_UOM: 'weightUoMScal'
                },
                {
                    QTY: 'heightAmount',
                    QTY_UOM: 'heightUoMScal'
                },
                {
                    QTY: 'lengthAmount',
                    QTY_UOM: 'lengthUoMScal'
                },
                {
                    QTY: 'depthAmount',
                    QTY_UOM: 'depthUoMScal'
                },
                {
                    QTY: 'diameterAmount',
                    QTY_UOM: 'diameterUoMScal'
                },
                {
                    QTY: 'volumeAmount',
                    QTY_UOM: 'volumeUoMScal'
                }
            ],
            ERROR_MESSAGE: 'INVALID_AMOUNT_VALUES',
            SKIP_FIELDS: [],
            DEFAULT_COLUMN_QUERY: 'id=uuid_to_bin(uuid()),accountId=uuid_to_bin(?),createdBy=uuid_to_bin(?),createdAt=?,updatedAt=?,recordType=?,',
            INVALID_RECORDS: [
                {
                    QUERY: 'select sku,count(sku) as count,group_concat(CAST(uuid_from_bin(id) as CHAR)) as tempId from tempProductReferences where ' +
                      'createdBy=uuid_to_bin(?) and errorFlag=0 group by sku having count(sku) > 1',
                    QUERY_NUMBER: 1,
                    ERROR: 'DUPLICATE_PRODUCT_IN_THE_FILE',
                    COLUMN_NAME: 'sku',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT TPR.weightUoMScal,CAST(uuid_from_bin(TPR.id) as CHAR) as tempId FROM tempProductReferences TPR ' +
                      ' LEFT JOIN  uomNames UN' +
                      ' INNER JOIN uomCategory UC ON UC.NAME = ? AND UC.languageCultureCode = ?' +
                      ' AND UC.accountId = uuid_to_bin(?)' +
                      ' INNER JOIN uomScaling US ON  US.categoryId = UC.categoryId AND  US.id = UN.uomScalingId  AND UN.languageCultureCode = ? ' +
                      ' AND US.accountId = uuid_to_bin(?) ' +
                      ' ON TPR.weightUoMScal = UN.symbol' +
                      ' WHERE' +
                      ' UN.symbol IS NULL  and TPR.createdBy = uuid_to_bin(?) and TPR.errorFlag =0' +
                      ' and TPR.weightUoMScal != ?  and TPR.weightUoMScal != ? ',
                    QUERY_NUMBER: 2,
                    ERROR: 'UNIT_OF_MEASURE_NOT_FOUND',
                    COLUMN_NAME: 'weightUoMScal',
                    IS_UPDATE: 0
                },
                {
                    QUERY: 'SELECT TPR.heightUoMScal,CAST(uuid_from_bin(TPR.id) as CHAR) as tempId FROM tempProductReferences TPR ' +
                      ' LEFT JOIN  uomNames UN' +
                      ' INNER JOIN uomCategory UC ON UC.NAME = ? AND UC.languageCultureCode = ?' +
                      ' AND UC.accountId = uuid_to_bin(?)' +
                      ' INNER JOIN uomScaling US ON  US.categoryId = UC.categoryId AND  US.id = UN.uomScalingId  AND UN.languageCultureCode = ? ' +
                      ' AND US.accountId = uuid_to_bin(?) ' +
                      ' ON TPR.heightUoMScal = UN.symbol' +
                      ' WHERE' +
                      ' UN.symbol IS NULL  and TPR.createdBy = uuid_to_bin(?) and TPR.errorFlag =0 ' +
                      ' and TPR.heightUoMScal != ?  and TPR.heightUoMScal != ?',
                    QUERY_NUMBER: 3,
                    ERROR: 'UNIT_OF_MEASURE_NOT_FOUND',
                    COLUMN_NAME: 'heightUoMScal',
                    IS_UPDATE: 0
                },
                {
                    QUERY: 'SELECT TPR.lengthUoMScal,CAST(uuid_from_bin(TPR.id) as CHAR) as tempId  FROM tempProductReferences TPR ' +
                      ' LEFT JOIN  uomNames UN' +
                      ' INNER JOIN uomCategory UC ON UC.NAME = ? AND UC.languageCultureCode = ?' +
                      ' AND UC.accountId = uuid_to_bin(?)' +
                      ' INNER JOIN uomScaling US ON  US.categoryId = UC.categoryId AND  US.id = UN.uomScalingId  AND UN.languageCultureCode = ? ' +
                      ' AND US.accountId = uuid_to_bin(?) ' +
                      ' ON TPR.lengthUoMScal = UN.symbol' +
                      ' WHERE' +
                      ' UN.symbol IS NULL  and TPR.createdBy = uuid_to_bin(?) and TPR.errorFlag =0 ' +
                      'and TPR.lengthUoMScal != ?  and TPR.lengthUoMScal != ?',
                    QUERY_NUMBER: 4,
                    ERROR: 'UNIT_OF_MEASURE_NOT_FOUND',
                    COLUMN_NAME: 'lengthUoMScal',
                    IS_UPDATE: 0
                },
                {
                    QUERY: 'SELECT TPR.depthUoMScal,CAST(uuid_from_bin(TPR.id) as CHAR) as tempId  FROM tempProductReferences TPR ' +
                      ' LEFT JOIN  uomNames UN' +
                      ' INNER JOIN uomCategory UC ON UC.NAME = ? AND UC.languageCultureCode = ?' +
                      ' AND UC.accountId = uuid_to_bin(?)' +
                      ' INNER JOIN uomScaling US ON  US.categoryId = UC.categoryId AND  US.id = UN.uomScalingId  AND UN.languageCultureCode = ? ' +
                      ' AND US.accountId = uuid_to_bin(?) ' +
                      ' ON TPR.depthUoMScal = UN.symbol' +
                      ' WHERE' +
                      ' UN.symbol IS NULL  and TPR.createdBy = uuid_to_bin(?) and TPR.errorFlag =0 ' +
                      'and TPR.depthUoMScal != ?  and TPR.depthUoMScal != ?',
                    QUERY_NUMBER: 5,
                    ERROR: 'UNIT_OF_MEASURE_NOT_FOUND',
                    COLUMN_NAME: 'depthUoMScal',
                    IS_UPDATE: 0
                },
                {
                    QUERY: 'SELECT TPR.diameterUoMScal,CAST(uuid_from_bin(TPR.id) as CHAR) as tempId  FROM tempProductReferences TPR ' +
                      ' LEFT JOIN  uomNames UN' +
                      ' INNER JOIN uomCategory UC ON UC.NAME = ? AND UC.languageCultureCode = ?' +
                      ' AND UC.accountId = uuid_to_bin(?)' +
                      ' INNER JOIN uomScaling US ON  US.categoryId = UC.categoryId AND  US.id = UN.uomScalingId  AND UN.languageCultureCode = ? ' +
                      ' AND US.accountId = uuid_to_bin(?) ' +
                      ' ON TPR.diameterUoMScal = UN.symbol' +
                      ' WHERE' +
                      ' UN.symbol IS NULL  and TPR.createdBy = uuid_to_bin(?) and TPR.errorFlag =0 ' +
                      'and TPR.diameterUoMScal != ?  and TPR.diameterUoMScal != ?',
                    QUERY_NUMBER: 6,
                    ERROR: 'UNIT_OF_MEASURE_NOT_FOUND',
                    COLUMN_NAME: 'diameterUoMScal',
                    IS_UPDATE: 0
                },
                {
                    QUERY: 'SELECT TPR.volumeUoMScal,CAST(uuid_from_bin(TPR.id) as CHAR) as tempId  FROM tempProductReferences TPR ' +
                      ' LEFT JOIN  uomNames UN' +
                      ' INNER JOIN uomCategory UC ON UC.NAME = ? AND UC.languageCultureCode = ?' +
                      ' AND UC.accountId = uuid_to_bin(?)' +
                      ' INNER JOIN uomScaling US ON  US.categoryId = UC.categoryId AND  US.id = UN.uomScalingId  AND UN.languageCultureCode = ? ' +
                      ' AND US.accountId = uuid_to_bin(?) ' +
                      ' ON TPR.volumeUoMScal = UN.symbol' +
                      ' WHERE' +
                      ' UN.symbol IS NULL  and TPR.createdBy = uuid_to_bin(?) and TPR.errorFlag =0' +
                      ' and TPR.volumeUoMScal != ?  and TPR.volumeUoMScal != ? ',
                    QUERY_NUMBER: 7,
                    ERROR: 'UNIT_OF_MEASURE_NOT_FOUND',
                    COLUMN_NAME: 'volumeUoMScal',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(TPR.id) as CHAR) as tempId,TPR.qtyUoMId  FROM tempProductReferences TPR' +
                      ' LEFT JOIN  uomNames UN ' +
                      ' INNER JOIN uomScaling US ON US.id = UN.uomScalingId ' +
                      ' AND (US.accountId = uuid_to_bin(?) OR US.accountId = uuid_to_bin(?))' +
                      ' AND UN.languageCultureCode = ?' +
                      ' ON TPR.qtyUoMId = UN.symbol ' +
                      ' LEFT JOIN  uomCategory UC ON TPR.qtyUoMCategory = UC.NAME' +
                      ' AND UC.languageCultureCode = ?' +
                      ' AND (UC.accountId = uuid_to_bin(?) OR UC.accountId = uuid_to_bin(?)) ' +
                      ' WHERE ' +
                      ' UN.symbol IS NULL AND  UC.name IS not NULL AND  TPR.qtyUoMId != ? AND TPR.qtyUoMCategory != ? and TPR.errorFlag =0  ',
                    QUERY_NUMBER: 8,
                    ERROR: 'UNIT_OF_MEASURE_NOT_FOUND',
                    COLUMN_NAME: 'qtyUoMId',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'select CAST(uuid_from_bin(TPR.id) as CHAR) as tempId,TPR.sku from ProductReferences PR , tempProductReferences TPR where PR.sku=TPR.sku and ' +
                      ' PR.accountId = TPR.accountId and TPR.createdBy = uuid_to_bin(?) and TPR.errorFlag =0 ',
                    ERROR: 'PRODUCT_ALREADY_EXIST',
                    QUERY_NUMBER: 9,
                    COLUMN_NAME: 'sku',
                    IS_UPDATE: 1
                }
            ],
            LOGICAL_VALIDATION: [
                /*{
                    QUERY: 'select sku,count(sku) as count from tempProductReferences where createdBy=uuid_to_bin(?) group by sku having count(sku) > 1',
                    ERROR: 'DUPLICATE_PRODUCT_IN_THE_FILE',
                    COLUMN_NAME: 'sku'
                },
                {
                    QUERY: 'select TPR.sku from ProductReferences PR , tempProductReferences TPR where PR.sku=TPR.sku and ' +
                    ' PR.accountId = TPR.accountId and TPR.createdBy = uuid_to_bin(?)',
                    ERROR: 'PRODUCT_ALREADY_EXIST',
                    COLUMN_NAME: 'sku'
                }*/
            ],
            UOM_FIELDS: [24, 26, 28, 30, 32, 34],
            PRECISION: 1,
            UPDATE_QUERY: [],
            FINAL_QUERY: ' INSERT into ProductReferences (id,accountId,sku,sellerSKUName,mpProductId,qtyUomId,qtyUoMCategory,' +
              ' GCID,UPC,EAN,ISBN,JAN,articleNo,modelNumber,type,countryOfManufacture,barcode,skuAlias,brand,harmonizedCode,' +
              ' endCustomerProduct,classificationSystem,classificationCode,tags,weightAmount,weightUoMScal,heightAmount,heightUoMScal,' +
              ' lengthAmount,lengthUoMScal,depthAmount,depthUoMScal,diameterAmount,diameterUoMScal,volumeAmount,volumeUoMScal,recordType,' +
              ' createdAt,updatedAt,createdBy,updatedBy)' +
              ' (SELECT  uuid_to_bin(UUID()),accountId,sku,sellerSKUName,mpProductId,qtyUomId,qtyUoMCategory,' +
              ' GCID,UPC,EAN,ISBN,JAN,articleNo,modelNumber,type,countryOfManufacture,barcode,skuAlias,brand,harmonizedCode,' +
              ' endCustomerProduct,classificationSystem,classificationCode,tags,weightAmount,weightUoMScal,heightAmount,heightUoMScal,' +
              ' lengthAmount,lengthUoMScal,depthAmount,depthUoMScal,diameterAmount,diameterUoMScal,volumeAmount,volumeUoMScal,recordType,' +
              ' createdAt,updatedAt,createdBy,updatedBy' +
              '  FROM tempProductReferences WHERE accountId = uuid_to_bin(?) AND createdBy = uuid_to_bin(?) AND errorFlag =0 )',
            ADDITIONAL_OPERATION: []
        },
        4: {
            TEMP: 'tempProductInventory',
            ORIGINAL: 'ProductInventory',
            REFERENCE: 'ProductReferences',
            AMOUNT_MANIPULATION: false,
            AMOUNT_FIELDS: [5, 7, 9, 11], // Its a quantity field
            QUANTITY_MANIPULATION: true,
            QUANTITY_UOM: [
                {
                    QTY: 'qtyOnHand',
                    QTY_UOM: 'qtyOnHandUoM'
                },
                {
                    QTY: 'qtyOnOrder',
                    QTY_UOM: 'qtyOnOrderUoM'
                },
                {
                    QTY: 'qtyAvailable',
                    QTY_UOM: 'qtyAvailableUoM'
                },
                {
                    QTY: 'qtyInTransit',
                    QTY_UOM: 'qtyInTransitUoM'
                }
            ],
            ERROR_MESSAGE: 'INVALID_QUANTITY_VALUES',
            SKIP_FIELDS: [],
            AMOUNT_UOM: [],
            DEFAULT_COLUMN_QUERY: 'id=uuid_to_bin(uuid()),accountId=uuid_to_bin(?),createdBy=uuid_to_bin(?),createdAt=?,updatedAt=?,recordType=?,',

            INVALID_RECORDS: [
                {
                    QUERY: 'select sku,locationId,count(sku) as count,group_concat(CAST(uuid_from_bin(id) as CHAR)) as tempId from tempProductInventory where ' +
                      ' createdBy=uuid_to_bin(?) and errorFlag=0 group by sku,locationId having count(sku) > 1',
                    QUERY_NUMBER: 1,
                    ERROR: 'DUPLICATE_PRODUCT_INVENTORY_IN_THE_FILE',
                    COLUMN_NAME: 'locationId',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(TPI.id) as CHAR) as tempId, TPI.sku FROM tempProductInventory TPI LEFT JOIN  ProductReferences PR ON TPI.SKU  = PR.sku ' +
                      ' AND PR.accountId = uuid_to_bin(?) WHERE PR.sku IS NULL  AND TPI.defaultUoMSymbol = ? AND TPI.accountId = PR.accountId AND TPI.errorFlag = 0',
                    QUERY_NUMBER: 2,
                    ERROR: 'PRODUCT_REFERENCE_NOT_FOUND',
                    COLUMN_NAME: 'sku',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(TPI.id) as CHAR) as tempId, TPI.sku FROM tempProductInventory TPI LEFT JOIN  ProductReferences PR ON TPI.SKU  = PR.sku ' +
                      ' AND PR.accountId = uuid_to_bin(?) LEFT JOIN  uomNames UN INNER JOIN uomScaling US ON US.id = UN.uomScalingId' +
                      ' AND (US.accountId = uuid_to_bin(?) OR US.accountId = uuid_to_bin(?)) AND UN.languageCultureCode = ?' +
                      ' ON TPI.defaultUoMSymbol = UN.symbol WHERE UN.symbol IS NULL AND PR.sku IS NULL AND ' +
                      ' TPI.defaultUoMSymbol != ? and TPI.defaultUoMCategory = ? AND TPI.accountId = uuid_to_bin(?) AND TPI.errorFlag = 0 ',
                    QUERY_NUMBER: 3,
                    ERROR: 'PRODUCT_REFERENCE_NOT_FOUND',
                    COLUMN_NAME: 'sku',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(TPI.id) as CHAR) as tempId, TPI.sku FROM tempProductInventory TPI LEFT JOIN  ProductReferences PR ON TPI.SKU  = PR.sku AND ' +
                      ' PR.accountId = uuid_to_bin(?) LEFT JOIN  uomNames UN INNER JOIN uomScaling US ON US.id = UN.uomScalingId ' +
                      ' AND (US.accountId = uuid_to_bin(?) OR US.accountId = uuid_to_bin(?)) AND UN.languageCultureCode = ?' +
                      ' ON TPI.defaultUoMSymbol = UN.symbol LEFT JOIN  uomCategory UC ON TPI.defaultUoMCategory = UC.NAME ' +
                      ' AND UC.languageCultureCode = ? AND (UC.accountId = uuid_to_bin(?) OR UC.accountId = uuid_to_bin(?)) ' +
                      ' WHERE UN.symbol IS NULL AND PR.sku IS NULL  AND UC.name IS not NULL AND TPI.accountId = uuid_to_bin(?) AND' +
                      ' TPI.defaultUoMSymbol != ? AND TPI.defaultUoMCategory != ? AND TPI.errorFlag = 0 ',
                    QUERY_NUMBER: 4,
                    ERROR: 'PRODUCT_REFERENCE_NOT_FOUND',
                    COLUMN_NAME: 'sku',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(TPI.id) as CHAR) as tempId, TPI.qtyOnHandUoM as qtyOnHandUOM FROM tempProductInventory TPI ' +
                      ' LEFT JOIN  ProductReferences PR ON TPI.SKU  = PR.sku AND PR.accountId = uuid_to_bin(?) ' +
                      ' LEFT JOIN  uomNames UN INNER JOIN uomScaling US ON US.id = UN.uomScalingId AND ' +
                      ' (US.accountId = uuid_to_bin(?) OR US.accountId = uuid_to_bin(?)) AND UN.languageCultureCode = ? ' +
                      ' ON TPI.qtyOnHandUoM = UN.symbol WHERE PR.sku IS NOT NULL AND UN.symbol IS NULL AND ' +
                      ' TPI.qtyOnHandUoM != ? AND TPI.qtyOnHandUoM != ? AND TPI.accountId = uuid_to_bin(?) AND TPI.errorFlag = 0 ',
                    QUERY_NUMBER: 5,
                    ERROR: 'UNIT_OF_MEASURE_NOT_FOUND',
                    COLUMN_NAME: 'qtyOnHandUoM',
                    IS_UPDATE: 0
                },
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(TPI.id) as CHAR) as tempId, TPI.qtyOnOrderUoM as qtyOnOrderUOM FROM tempProductInventory TPI ' +
                      ' LEFT JOIN  ProductReferences PR ON TPI.SKU  = PR.sku AND PR.accountId = uuid_to_bin(?) ' +
                      ' LEFT JOIN  uomNames UN INNER JOIN uomScaling US ON US.id = UN.uomScalingId AND ' +
                      ' (US.accountId = uuid_to_bin(?) OR US.accountId = uuid_to_bin(?)) AND UN.languageCultureCode = ?' +
                      ' ON TPI.qtyOnOrderUoM = UN.symbol WHERE PR.sku IS NOT NULL AND UN.symbol IS NULL AND ' +
                      ' TPI.qtyOnOrderUoM != ? AND TPI.qtyOnOrderUoM != ? AND TPI.accountId = uuid_to_bin(?) AND TPI.errorFlag = 0 ',
                    QUERY_NUMBER: 6,
                    ERROR: 'UNIT_OF_MEASURE_NOT_FOUND',
                    COLUMN_NAME: 'qtyOnOrderUoM',
                    IS_UPDATE: 0
                },
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(TPI.id) as CHAR) as tempId, TPI.qtyAvailableUoM as qtyAvailableUOM FROM tempProductInventory TPI ' +
                      ' LEFT JOIN  ProductReferences PR ON TPI.SKU  = PR.sku AND PR.accountId = uuid_to_bin(?) ' +
                      ' LEFT JOIN  uomNames UN INNER JOIN uomScaling US ON US.id = UN.uomScalingId AND ' +
                      ' (US.accountId = uuid_to_bin(?) OR US.accountId = uuid_to_bin(?)) AND UN.languageCultureCode = ?' +
                      ' ON TPI.qtyAvailableUoM = UN.symbol WHERE PR.sku IS NOT NULL AND UN.symbol IS NULL AND ' +
                      ' TPI.qtyAvailableUoM != ? AND TPI.qtyAvailableUoM != ? AND TPI.accountId = uuid_to_bin(?) AND TPI.errorFlag = 0 ',
                    QUERY_NUMBER: 7,
                    ERROR: 'UNIT_OF_MEASURE_NOT_FOUND',
                    COLUMN_NAME: 'qtyAvailableUoM',
                    IS_UPDATE: 0
                },
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(TPI.id) as CHAR) as tempId, TPI.qtyInTransitUoM as qtyInTransitUOM FROM tempProductInventory TPI ' +
                      ' LEFT JOIN  ProductReferences PR ON TPI.SKU  = PR.sku AND PR.accountId = uuid_to_bin(?) ' +
                      ' LEFT JOIN  uomNames UN INNER JOIN uomScaling US ON US.id = UN.uomScalingId AND ' +
                      ' (US.accountId = uuid_to_bin(?) OR US.accountId = uuid_to_bin(?)) AND UN.languageCultureCode = ?' +
                      ' ON TPI.qtyInTransitUoM = UN.symbol WHERE PR.sku IS NOT NULL AND UN.symbol IS NULL AND ' +
                      ' TPI.qtyInTransitUoM != ? AND TPI.qtyInTransitUoM != ? AND TPI.accountId = uuid_to_bin(?) AND TPI.errorFlag = 0 ',
                    QUERY_NUMBER: 8,
                    ERROR: 'UNIT_OF_MEASURE_NOT_FOUND',
                    COLUMN_NAME: 'qtyInTransitUoM',
                    IS_UPDATE: 1
                },
                /*{
                    QUERY: QUERY_4.QUERY + ' ' + QUERY_4.QTY_ON_HAND_UOM + QUERY_4.UNION +
                      QUERY_4.QUERY + ' ' + QUERY_4.QTY_ON_ORDER_UOM + QUERY_4.UNION +
                      QUERY_4.QUERY + ' ' + QUERY_4.QTY_AVAILABLE_UOM + QUERY_4.UNION +
                      QUERY_4.QUERY + ' ' + QUERY_4.QTY_IN_TRANSIT_UOM,
                    /!*QUERY: this.QUERY_4.QUERY +' '+this.QUERY_4.QTY_ON_HAND_UOM + this.QUERY_4.UNION +
                      this.QUERY_4.QUERY +' '+this.QUERY_4.QTY_ON_ORDER_UOM + this.QUERY_4.UNION +
                      this.QUERY_4.QUERY +' '+this.QUERY_4.QTY_AVAILABLE_UOM + this.QUERY_4.UNION +
                      this.QUERY_4.QUERY +' '+this.QUERY_4.QTY_IN_TRANSIT_UOM + this.QUERY_4.UNION,*!/
                    QUERY_NUMBER: 5,
                    ERROR: 'UNIT_OF_MEASURE_NOT_FOUND',
                    COLUMN_NAME: 'sku'
                },*/
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(TPI.id) as CHAR) as tempId, TPI.sku FROM tempProductInventory TPI , ProductReferences PR, uomCategory UC' +
                      ' WHERE PR.accountId = uuid_to_bin(?) AND TPI.SKU = PR.sku AND (UC.accountId = uuid_to_bin(?) OR UC.accountId = uuid_to_bin(?)) and' +
                      ' UC.languageCultureCode = ? AND UC.categoryId = PR.qtyUoMCategory AND ' +
                      '((TPI.qtyOnHandUoM != ? AND TPI.qtyOnHandUoM != ? AND TPI.qtyOnHandUoM NOT IN ( SELECT UN1.symbol from uomScaling US1,uomNames UN1 WHERE ' +
                      '(US1.accountId = uuid_to_bin(?) OR US1.accountId = uuid_to_bin(?))' +
                      'AND UN1.languageCultureCode = ?  AND  UN1.uomScalingId = US1.id and US1.categoryId = UC.categoryId )) OR' +
                      '( TPI.qtyOnOrderUoM != ? AND TPI.qtyOnOrderUoM != ? AND TPI.qtyOnOrderUoM NOT IN (SELECT UN1.symbol from uomScaling US1,uomNames UN1 WHERE' +
                      '(US1.accountId = uuid_to_bin(?) OR US1.accountId = uuid_to_bin(?))' +
                      'AND UN1.languageCultureCode = ?  AND  UN1.uomScalingId = US1.id and US1.categoryId = UC.categoryId )) OR ' +
                      '(TPI.qtyAvailableUoM != ? AND TPI.qtyAvailableUoM != ? AND TPI.qtyAvailableUoM NOT IN (SELECT UN1.symbol from uomScaling US1,uomNames UN1 WHERE ' +
                      '(US1.accountId = uuid_to_bin(?) OR US1.accountId = uuid_to_bin(?))' +
                      'AND UN1.languageCultureCode = ?  AND  UN1.uomScalingId = US1.id and US1.categoryId = UC.categoryId )) OR' +
                      '(TPI.qtyInTransitUoM != ? AND TPI.qtyInTransitUoM != ? AND TPI.qtyInTransitUoM NOT IN (SELECT UN1.symbol from uomScaling US1,uomNames UN1 WHERE' +
                      '(US1.accountId = uuid_to_bin(?) OR US1.accountId = uuid_to_bin(?))' +
                      'AND UN1.languageCultureCode = ?  AND  UN1.uomScalingId = US1.id and US1.categoryId = UC.categoryId )))' +
                      'AND TPI.accountId = uuid_to_bin(?) AND TPI.errorFlag = 0',
                    QUERY_NUMBER: 9,
                    ERROR: 'UOM_IS_FROM_DIFFERENT_CATEGORY',
                    COLUMN_NAME: 'defaultUOMSymbol',
                    IS_UPDATE: 1
                    //ERROR: 'PRODUCT_REFERENCE_NOT_FOUND'
                },
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(TPI.id) as CHAR) as tempId, TPI.sku FROM tempProductInventory TPI LEFT JOIN  ProductReferences PR ON TPI.SKU  = PR.sku AND ' +
                      ' PR.accountId = uuid_to_bin(?) LEFT JOIN  uomNames UN INNER JOIN uomScaling US ON US.id = UN.uomScalingId' +
                      ' AND (US.accountId = uuid_to_bin(?) OR US.accountId = uuid_to_bin(?)) AND UN.languageCultureCode = ?' +
                      ' ON TPI.defaultUoMSymbol = UN.symbol LEFT JOIN  uomCategory UC ON TPI.defaultUoMCategory = UC.NAME ' +
                      ' AND UC.languageCultureCode = ? AND (UC.accountId = uuid_to_bin(?) OR UC.accountId = uuid_to_bin(?))' +
                      ' WHERE UN.symbol IS NULL AND PR.sku IS NULL  AND UC.name IS NULL AND  TPI.defaultUoMSymbol != ? AND TPI.defaultUoMCategory != ?' +
                      ' AND TPI.createdBy = uuid_to_bin(?) AND ((TPI.defaultUOMSymbol != TPI.qtyOnHandUOM AND  TPI.qtyOnHandUOM != ? AND  TPI.qtyOnHandUOM != ?) OR ' +
                      ' (TPI.defaultUOMSymbol != TPI.qtyOnOrderUOM AND TPI.qtyOnOrderUOM != ? AND TPI.qtyOnOrderUOM != ?) OR ' +
                      ' (TPI.defaultUOMSymbol != TPI.qtyAvailableUOM AND TPI.qtyAvailableUOM != ? AND TPI.qtyAvailableUOM != ?) OR ' +
                      ' (TPI.defaultUOMSymbol != TPI.qtyInTransitUOM AND TPI.qtyInTransitUOM != ? AND TPI.qtyInTransitUOM != ? )) AND TPI.accountId = uuid_to_bin(?) AND TPI.errorFlag = 0',
                    QUERY_NUMBER: 10,
                    ERROR: 'PRODUCT_REFERENCE_NOT_FOUND',
                    COLUMN_NAME: 'sku',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(TPI.id) as CHAR) as tempId, TPI.sku FROM tempProductInventory TPI LEFT JOIN  ProductReferences PR ON TPI.SKU  = PR.sku AND PR.accountId = uuid_to_bin(?)' +
                      ' LEFT JOIN  uomNames UN INNER JOIN uomScaling US ON US.id = UN.uomScalingId ' +
                      ' AND (US.accountId = uuid_to_bin(?) OR US.accountId = uuid_to_bin(?))' +
                      ' AND UN.languageCultureCode = ? ON TPI.defaultUoMSymbol = UN.symbol  ' +
                      ' LEFT JOIN  uomCategory UC ON TPI.defaultUoMCategory = UC.NAME ' +
                      ' AND UC.languageCultureCode = ? AND UC.categoryId = US.categoryId ' +
                      ' AND (UC.accountId = uuid_to_bin(?) OR UC.accountId = uuid_to_bin(?))' +
                      ' WHERE UN.symbol IS NOT NULL AND PR.sku IS NULL AND UC.name IS NULL  AND TPI.defaultUoMSymbol != ? ' +
                      ' AND TPI.accountId = uuid_to_bin(?) AND TPI.errorFlag = 0',
                    QUERY_NUMBER: 11,
                    ERROR: 'PRODUCT_REFERENCE_NOT_FOUND',
                    COLUMN_NAME: 'sku',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(TPI.id) as CHAR) as tempId, TPI.sku FROM tempProductInventory TPI ' +
                      ' LEFT JOIN  ProductReferences PR ON TPI.SKU  = PR.sku AND PR.accountId = uuid_to_bin(?) ' +
                      ' LEFT JOIN  uomNames UN ' +
                      ' INNER JOIN uomScaling US ON US.id = UN.uomScalingId ' +
                      ' AND (US.accountId = uuid_to_bin(?) OR US.accountId = uuid_to_bin(?)) ' +
                      ' AND UN.languageCultureCode = ? ON TPI.defaultUoMSymbol = UN.symbol ' +
                      ' LEFT JOIN  uomCategory UC ON TPI.defaultUoMCategory = UC.NAME ' +
                      ' AND UC.languageCultureCode = ? AND UC.categoryId = US.categoryId ' +
                      ' AND (UC.accountId = uuid_to_bin(?) OR UC.accountId = uuid_to_bin(?)) ' +
                      ' WHERE UN.symbol IS NOT NULL AND PR.sku IS NULL AND UC.name IS NOT NULL AND ' +
                      ' TPI.defaultUoMSymbol != ? AND TPI.defaultUoMCategory != ? ' +
                      ' AND TPI.createdBy = uuid_to_bin(?) AND' +
                      ' ((TPI.qtyOnHandUoM != ? AND TPI.qtyOnHandUoM != ? AND ' +
                      ' TPI.qtyOnHandUoM NOT IN ( SELECT UN1.symbol from uomScaling US1,uomNames UN1 WHERE ' +
                      ' (US1.accountId = uuid_to_bin(?) OR US1.accountId = uuid_to_bin(?)) AND UN1.languageCultureCode = ?' +
                      ' AND  UN1.uomScalingId = US1.id and US1.categoryId = UC.categoryId )) OR ' +
                      ' (TPI.qtyOnOrderUoM != ? AND TPI.qtyOnOrderUoM != ? AND TPI.qtyOnOrderUoM NOT IN (SELECT UN1.symbol from uomScaling US1,uomNames UN1 WHERE ' +
                      ' (US1.accountId = uuid_to_bin(?) OR US1.accountId = uuid_to_bin(?)) ' +
                      ' AND UN1.languageCultureCode = ?  AND  UN1.uomScalingId = US1.id and US1.categoryId = UC.categoryId )) OR' +
                      ' (TPI.qtyAvailableUoM != ? AND TPI.qtyAvailableUoM != ? AND TPI.qtyAvailableUoM NOT IN (SELECT UN1.symbol from uomScaling US1,uomNames UN1 WHERE' +
                      ' (US1.accountId = uuid_to_bin(?) OR US1.accountId = uuid_to_bin(?)) AND UN1.languageCultureCode = ?  ' +
                      ' AND  UN1.uomScalingId = US1.id and US1.categoryId = UC.categoryId )) OR ' +
                      ' (TPI.qtyInTransitUoM != ? AND TPI.qtyInTransitUoM != ? AND TPI.qtyInTransitUoM NOT IN (SELECT UN1.symbol from uomScaling US1,uomNames UN1 WHERE ' +
                      ' (US1.accountId = uuid_to_bin(?) OR US1.accountId = uuid_to_bin(?)) AND UN1.languageCultureCode = ?  AND ' +
                      ' UN1.uomScalingId = US1.id and US1.categoryId = UC.categoryId ))) AND TPI.errorFlag = 0 ',
                    QUERY_NUMBER: 12,
                    ERROR: 'PRODUCT_REFERENCE_NOT_FOUND',
                    COLUMN_NAME: 'sku',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'select PI.SKU,PI.locationId,CAST(uuid_from_bin(TPI.id) as CHAR) as tempId, TPI.sku from ProductInventory PI , ' +
                      ' tempProductInventory TPI where PI.SKU=TPI.SKU and PI.locationId = TPI.locationId and ' +
                      ' PI.accountId = TPI.accountId and TPI.createdBy = uuid_to_bin(?) AND TPI.errorFlag = 0',
                    QUERY_NUMBER: 13,
                    ERROR: 'PRODUCT_INVENTORY_ALREADY_EXIST',
                    COLUMN_NAME: 'sku',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(TPI.id) as CHAR) as tempId,TPI.locationId as locationName FROM tempProductInventory TPI' +
                      ' LEFT JOIN LocationReference LR  ON ' +
                      ' TPI.locationId  = LR.locationName AND TPI.locationId != LR.locationId AND LR.accountId = uuid_to_bin(?)' +
                      ' WHERE TPI.accountId =uuid_to_bin(?) AND TPI.createdBy = uuid_to_bin(?) AND TPI.errorFlag =0' +
                      ' AND LR.locationId IS NOT NULL AND LR.locationName IS NOT null ',
                    QUERY_NUMBER: 14,
                    ERROR: 'LOCATION_REFERENCE_ALREADY_EXIST',
                    COLUMN_NAME: 'locationId',
                    IS_UPDATE: 1
                }
            ],

            LOGICAL_VALIDATION: [
                /*{
                    QUERY: 'select sku,locationId,count(sku) as count from tempProductInventory where createdBy=uuid_to_bin(?) group by sku,locationId having count(sku) > 1',
                    ERROR: 'DUPLICATE_PRODUCT_INVENTORY_IN_THE_FILE',
                    COLUMN_NAME: 'locationId'
                },
                 {
                     QUERY: 'select distinct TPI.SKU from tempProductInventory TPI where createdBy=uuid_to_bin(?) ' +
                       'and not exists (select 1 from ProductReferences PR where TPI.SKU = PR.SKU and TPI.accountId = PR.accountId);',
                     ERROR: 'PRODUCT_REFERENCE_NOT_FOUND',
                     COLUMN_NAME: 'SKU'
                 },
                 {
                     QUERY: 'select distinct TPI.locationId from tempProductInventory TPI where createdBy=uuid_to_bin(?) ' +
                       'and not exists (select 1 from LocationReference LR where TPI.locationId = LR.locationId and TPI.accountId = LR.accountId and status = 1);',
                     ERROR: 'LOCATION_REFERENCE_NOT_FOUND',
                     COLUMN_NAME: 'locationId'
                 },
                {
                    QUERY: 'select PI.SKU,PI.locationId from ProductInventory PI , tempProductInventory TPI where PI.SKU=TPI.SKU and ' +
                      ' PI.locationId = TPI.locationId and PI.accountId = TPI.accountId and TPI.createdBy = uuid_to_bin(?);',
                    ERROR: 'PRODUCT_INVENTORY_ALREADY_EXIST',
                    COLUMN_NAME: 'locationId'
                }*/
            ],
            UOM_FIELDS: [6, 8, 10, 12],
            UPDATE_QUERY: ['update ProductReferences PR,tempProductInventory TPI set TPI.productRefId = PR.id where TPI.createdBy = uuid_to_bin(?) and ' +
            ' TPI.accountId=PR.accountId and TPI.SKU = PR.sku and TPI.errorFlag = 0;'],
            PRECISION: 1,
            FINAL_QUERY: 'INSERT into ProductInventory (id,accountId,productRefId,SKU,locationId,qtyOnHand,qtyOnHandUoM,qtyOnOrder,qtyOnOrderUoM,' +
              ' qtyAvailable,qtyAvailableUoM,qtyInTransit,qtyIntransitUoM,notes,recordType,createdAt,updatedAt,createdBy,updatedBy)' +
              ' (SELECT  uuid_to_bin(UUID()),accountId,productRefId,SKU,locationId,qtyOnHand,qtyOnHandUoM,qtyOnOrder,qtyOnOrderUoM,qtyAvailable,qtyAvailableUoM,' +
              ' qtyInTransit,qtyIntransitUoM,notes,recordType,createdAt,updatedAt,createdBy,updatedBy' +
              ' FROM tempProductInventory WHERE accountId = uuid_to_bin(?) AND createdBy = uuid_to_bin(?) AND errorFlag =0 )',
            ADDITIONAL_OPERATION: []
        },
        5: {
            TEMP: 'tempSupplyItems',
            ORIGINAL: 'SupplyItems',
            REFERENCE: '',
            AMOUNT_FIELDS: [23, 25, 27, 29, 31, 33],
            AMOUNT_MANIPULATION: false,
            QUANTITY_MANIPULATION: true,
            QUANTITY_UOM: [
                {
                    QTY: 'weightAmount',
                    QTY_UOM: 'weightUoMScal'
                },
                {
                    QTY: 'heightAmount',
                    QTY_UOM: 'heightUoMScal'
                },
                {
                    QTY: 'lengthAmount',
                    QTY_UOM: 'lengthUoMScal'
                },
                {
                    QTY: 'depthAmount',
                    QTY_UOM: 'depthUoMScal'
                },
                {
                    QTY: 'diameterAmount',
                    QTY_UOM: 'diameterUoMScal'
                },
                {
                    QTY: 'volumeAmount',
                    QTY_UOM: 'volumeUoMScal'
                }
            ],
            ERROR_MESSAGE: 'INVALID_AMOUNT_VALUES',
            SKIP_FIELDS: [],
            DEFAULT_COLUMN_QUERY: 'id=uuid_to_bin(uuid()),accountId=uuid_to_bin(?),createdBy=uuid_to_bin(?),createdAt=?,updatedAt=?,recordType=?,',
            INVALID_RECORDS: [
                {
                    QUERY: 'select sku,count(sku) as count,group_concat(CAST(uuid_from_bin(id) as CHAR)) as tempId from tempSupplyItems where ' +
                      'createdBy=uuid_to_bin(?) and errorFlag=0 group by sku having count(sku) > 1',
                    QUERY_NUMBER: 1,
                    ERROR: 'DUPLICATE_SUPPLY_ITEM_IN_THE_FILE',
                    COLUMN_NAME: 'sku',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT TSI.weightUoMScal,CAST(uuid_from_bin(TSI.id) as CHAR) as tempId FROM tempSupplyItems TSI ' +
                      ' LEFT JOIN  uomNames UN' +
                      ' INNER JOIN uomCategory UC ON UC.NAME = ? AND UC.languageCultureCode = ?' +
                      ' AND UC.accountId = uuid_to_bin(?)' +
                      ' INNER JOIN uomScaling US ON  US.categoryId = UC.categoryId AND  US.id = UN.uomScalingId  AND UN.languageCultureCode = ? ' +
                      ' AND US.accountId = uuid_to_bin(?) ' +
                      ' ON TSI.weightUoMScal = UN.symbol' +
                      ' WHERE' +
                      ' UN.symbol IS NULL  and TSI.createdBy = uuid_to_bin(?) and TSI.errorFlag =0' +
                      ' and TSI.weightUoMScal != ?  and TSI.weightUoMScal != ? ',
                    QUERY_NUMBER: 2,
                    ERROR: 'UNIT_OF_MEASURE_NOT_FOUND',
                    COLUMN_NAME: 'weightUoMScal',
                    IS_UPDATE: 0
                },
                {
                    QUERY: 'SELECT TSI.heightUoMScal,CAST(uuid_from_bin(TSI.id) as CHAR) as tempId FROM tempSupplyItems TSI ' +
                      ' LEFT JOIN  uomNames UN' +
                      ' INNER JOIN uomCategory UC ON UC.NAME = ? AND UC.languageCultureCode = ?' +
                      ' AND UC.accountId = uuid_to_bin(?)' +
                      ' INNER JOIN uomScaling US ON  US.categoryId = UC.categoryId AND  US.id = UN.uomScalingId  AND UN.languageCultureCode = ? ' +
                      ' AND US.accountId = uuid_to_bin(?) ' +
                      ' ON TSI.heightUoMScal = UN.symbol' +
                      ' WHERE' +
                      ' UN.symbol IS NULL  and TSI.createdBy = uuid_to_bin(?) and TSI.errorFlag =0 ' +
                      ' and TSI.heightUoMScal != ?  and TSI.heightUoMScal != ?',
                    QUERY_NUMBER: 3,
                    ERROR: 'UNIT_OF_MEASURE_NOT_FOUND',
                    COLUMN_NAME: 'heightUoMScal',
                    IS_UPDATE: 0
                },
                {
                    QUERY: 'SELECT TSI.lengthUoMScal,CAST(uuid_from_bin(TSI.id) as CHAR) as tempId  FROM tempSupplyItems TSI ' +
                      ' LEFT JOIN  uomNames UN' +
                      ' INNER JOIN uomCategory UC ON UC.NAME = ? AND UC.languageCultureCode = ?' +
                      ' AND UC.accountId = uuid_to_bin(?)' +
                      ' INNER JOIN uomScaling US ON  US.categoryId = UC.categoryId AND  US.id = UN.uomScalingId  AND UN.languageCultureCode = ? ' +
                      ' AND US.accountId = uuid_to_bin(?) ' +
                      ' ON TSI.lengthUoMScal = UN.symbol' +
                      ' WHERE' +
                      ' UN.symbol IS NULL  and TSI.createdBy = uuid_to_bin(?) and TSI.errorFlag =0 ' +
                      'and TSI.lengthUoMScal != ?  and TSI.lengthUoMScal != ?',
                    QUERY_NUMBER: 4,
                    ERROR: 'UNIT_OF_MEASURE_NOT_FOUND',
                    COLUMN_NAME: 'lengthUoMScal',
                    IS_UPDATE: 0
                },
                {
                    QUERY: 'SELECT TSI.depthUoMScal,CAST(uuid_from_bin(TSI.id) as CHAR) as tempId  FROM tempSupplyItems TSI ' +
                      ' LEFT JOIN  uomNames UN' +
                      ' INNER JOIN uomCategory UC ON UC.NAME = ? AND UC.languageCultureCode = ?' +
                      ' AND UC.accountId = uuid_to_bin(?)' +
                      ' INNER JOIN uomScaling US ON  US.categoryId = UC.categoryId AND  US.id = UN.uomScalingId  AND UN.languageCultureCode = ? ' +
                      ' AND US.accountId = uuid_to_bin(?) ' +
                      ' ON TSI.depthUoMScal = UN.symbol' +
                      ' WHERE' +
                      ' UN.symbol IS NULL  and TSI.createdBy = uuid_to_bin(?) and TSI.errorFlag =0 ' +
                      'and TSI.depthUoMScal != ?  and TSI.depthUoMScal != ?',
                    QUERY_NUMBER: 5,
                    ERROR: 'UNIT_OF_MEASURE_NOT_FOUND',
                    COLUMN_NAME: 'depthUoMScal',
                    IS_UPDATE: 0
                },
                {
                    QUERY: 'SELECT TSI.diameterUoMScal,CAST(uuid_from_bin(TSI.id) as CHAR) as tempId  FROM tempSupplyItems TSI ' +
                      ' LEFT JOIN  uomNames UN' +
                      ' INNER JOIN uomCategory UC ON UC.NAME = ? AND UC.languageCultureCode = ?' +
                      ' AND UC.accountId = uuid_to_bin(?)' +
                      ' INNER JOIN uomScaling US ON  US.categoryId = UC.categoryId AND  US.id = UN.uomScalingId  AND UN.languageCultureCode = ? ' +
                      ' AND US.accountId = uuid_to_bin(?) ' +
                      ' ON TSI.diameterUoMScal = UN.symbol' +
                      ' WHERE' +
                      ' UN.symbol IS NULL  and TSI.createdBy = uuid_to_bin(?) and TSI.errorFlag =0 ' +
                      'and TSI.diameterUoMScal != ?  and TSI.diameterUoMScal != ?',
                    QUERY_NUMBER: 6,
                    ERROR: 'UNIT_OF_MEASURE_NOT_FOUND',
                    COLUMN_NAME: 'diameterUoMScal',
                    IS_UPDATE: 0
                },
                {
                    QUERY: 'SELECT TSI.volumeUoMScal,CAST(uuid_from_bin(TSI.id) as CHAR) as tempId  FROM tempSupplyItems TSI ' +
                      ' LEFT JOIN  uomNames UN' +
                      ' INNER JOIN uomCategory UC ON UC.NAME = ? AND UC.languageCultureCode = ?' +
                      ' AND UC.accountId = uuid_to_bin(?)' +
                      ' INNER JOIN uomScaling US ON  US.categoryId = UC.categoryId AND  US.id = UN.uomScalingId  AND UN.languageCultureCode = ? ' +
                      ' AND US.accountId = uuid_to_bin(?) ' +
                      ' ON TSI.volumeUoMScal = UN.symbol' +
                      ' WHERE' +
                      ' UN.symbol IS NULL  and TSI.createdBy = uuid_to_bin(?) and TSI.errorFlag =0' +
                      ' and TSI.volumeUoMScal != ?  and TSI.volumeUoMScal != ? ',
                    QUERY_NUMBER: 7,
                    ERROR: 'UNIT_OF_MEASURE_NOT_FOUND',
                    COLUMN_NAME: 'volumeUoMScal',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT TSI.qtyUoMId ,CAST(uuid_from_bin(TSI.id) as CHAR) as tempId  FROM tempSupplyItems TSI' +
                      ' LEFT JOIN  uomNames UN ' +
                      ' INNER JOIN uomScaling US ON US.id = UN.uomScalingId ' +
                      ' AND (US.accountId = uuid_to_bin(?) OR US.accountId = uuid_to_bin(?))' +
                      ' AND UN.languageCultureCode = ?' +
                      ' ON TSI.qtyUoMId = UN.symbol ' +
                      ' LEFT JOIN  uomCategory UC ON TSI.qtyUoMCategory = UC.NAME' +
                      ' AND UC.languageCultureCode = ?' +
                      ' AND (UC.accountId = uuid_to_bin(?) OR UC.accountId = uuid_to_bin(?)) ' +
                      ' WHERE ' +
                      ' UN.symbol IS NULL AND  UC.name IS not NULL AND  TSI.qtyUoMId != ? AND TSI.qtyUoMCategory != ? ' +
                      ' and TSI.errorFlag =0  ',
                    QUERY_NUMBER: 8,
                    ERROR: 'UNIT_OF_MEASURE_NOT_FOUND',
                    COLUMN_NAME: 'qtyUoMId',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'select CAST(uuid_from_bin(TSI.id) as CHAR) as tempId,TSI.sku from SupplyItems SI , tempSupplyItems TSI' +
                      ' where SI.sku=TSI.sku and SI.accountId = TSI.accountId and TSI.createdBy = uuid_to_bin(?) and TSI.errorFlag =0 ',
                    ERROR: 'SUPPLY_ITEMS_ALREADY_EXIST',
                    QUERY_NUMBER: 9,
                    COLUMN_NAME: 'sku',
                    IS_UPDATE: 1
                }
            ],
            LOGICAL_VALIDATION: [
                /* {
                     QUERY: 'select sku,count(sku) as count from tempSupplyItems where createdBy=uuid_to_bin(?) group by sku having count(sku) > 1',
                     ERROR: 'DUPLICATE_SUPPLY_ITEM_IN_THE_FILE',
                     COLUMN_NAME: 'sku'
                 },
                 {
                     QUERY: 'select TSI.sku from SupplyItems SI , tempSupplyItems TSI where SI.sku=TSI.sku and ' +
                       ' SI.accountId = TSI.accountId and TSI.createdBy = uuid_to_bin(?)',
                     ERROR: 'SUPPLY_ITEMS_ALREADY_EXIST',
                     COLUMN_NAME: 'sku'
                 }*/
            ],
            UOM_FIELDS: [24, 26, 28, 30, 32, 34],
            PRECISION: 1,
            UPDATE_QUERY: [],
            FINAL_QUERY: ' INSERT into SupplyItems (id,accountId,sku,sellerSKUName,mpProductId,qtyUomId,qtyUoMCategory,' +
              ' GCID,UPC,EAN,ISBN,JAN,articleNo,modelNumber,type,countryOfManufacture,barcode,skuAlias,brand,harmonizedCode,' +
              ' endCustomerProduct,classificationSystem,classificationCode,tags,weightAmount,weightUoMScal,heightAmount,heightUoMScal,' +
              ' lengthAmount,lengthUoMScal,depthAmount,depthUoMScal,diameterAmount,diameterUoMScal,volumeAmount,volumeUoMScal,recordType,' +
              ' createdAt,updatedAt,createdBy,updatedBy)' +
              ' (SELECT  uuid_to_bin(UUID()),accountId,sku,sellerSKUName,mpProductId,qtyUomId,qtyUoMCategory,' +
              ' GCID,UPC,EAN,ISBN,JAN,articleNo,modelNumber,type,countryOfManufacture,barcode,skuAlias,brand,harmonizedCode,' +
              ' endCustomerProduct,classificationSystem,classificationCode,tags,weightAmount,weightUoMScal,heightAmount,heightUoMScal,' +
              ' lengthAmount,lengthUoMScal,depthAmount,depthUoMScal,diameterAmount,diameterUoMScal,volumeAmount,volumeUoMScal,recordType,' +
              ' createdAt,updatedAt,createdBy,updatedBy' +
              '  FROM tempSupplyItems WHERE accountId = uuid_to_bin(?) AND createdBy = uuid_to_bin(?) AND errorFlag =0 )',
            ADDITIONAL_OPERATION: []
        },
        6: {
            TEMP: 'tempSupplyInventory',
            ORIGINAL: 'SupplyInventory',
            REFERENCE: 'SupplyItems',
            AMOUNT_MANIPULATION: false,
            AMOUNT_FIELDS: [5, 7, 9, 11], // Its a quantity field
            QUANTITY_MANIPULATION: true,
            QUANTITY_UOM: [
                {
                    QTY: 'qtyOnHand',
                    QTY_UOM: 'qtyOnHandUoM'
                },
                {
                    QTY: 'qtyOnOrder',
                    QTY_UOM: 'qtyOnOrderUoM'
                },
                {
                    QTY: 'qtyAvailable',
                    QTY_UOM: 'qtyAvailableUoM'
                },
                {
                    QTY: 'qtyInTransit',
                    QTY_UOM: 'qtyInTransitUoM'
                }
            ],
            ERROR_MESSAGE: 'INVALID_QUANTITY_VALUES',
            SKIP_FIELDS: [],
            DEFAULT_COLUMN_QUERY: 'id=uuid_to_bin(uuid()),accountId=uuid_to_bin(?),createdBy=uuid_to_bin(?),createdAt=?,updatedAt=?,recordType=?,',
            INVALID_RECORDS: [
                {
                    QUERY: 'select sku,locationId,count(sku) as count,group_concat(CAST(uuid_from_bin(id) as CHAR)) as tempId' +
                      ' from tempSupplyInventory where ' +
                      ' createdBy=uuid_to_bin(?) and errorFlag=0 group by sku,locationId having count(sku) > 1',
                    QUERY_NUMBER: 1,
                    ERROR: 'DUPLICATE_SUPPLY_ITEM_INVENTORY_IN_THE_FILE',
                    COLUMN_NAME: 'locationId',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(TSI.id) as CHAR) as tempId, TSI.sku FROM tempSupplyInventory TSI ' +
                      ' LEFT JOIN  SupplyItems SI ON TSI.SKU  = SI.sku ' +
                      ' AND SI.accountId = uuid_to_bin(?) WHERE SI.sku IS NULL  AND TSI.defaultUoMSymbol = ? ' +
                      ' AND TSI.accountId = SI.accountId AND TSI.errorFlag = 0',
                    QUERY_NUMBER: 2,
                    ERROR: 'SUPPLY_ITEM_NOT_FOUND',
                    COLUMN_NAME: 'sku',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(TSI.id) as CHAR) as tempId, TSI.sku FROM tempSupplyInventory TSI ' +
                      ' LEFT JOIN  SupplyItems SI ON TSI.SKU  = SI.sku ' +
                      ' AND SI.accountId = uuid_to_bin(?) LEFT JOIN  uomNames UN INNER JOIN uomScaling US ON US.id = UN.uomScalingId' +
                      ' AND (US.accountId = uuid_to_bin(?) OR US.accountId = uuid_to_bin(?)) AND UN.languageCultureCode = ?' +
                      ' ON TSI.defaultUoMSymbol = UN.symbol WHERE UN.symbol IS NULL AND SI.sku IS NULL AND ' +
                      ' TSI.defaultUoMSymbol != ? and TSI.defaultUoMCategory = ? AND TSI.accountId = uuid_to_bin(?) AND TSI.errorFlag = 0 ',
                    QUERY_NUMBER: 3,
                    ERROR: 'SUPPLY_ITEM_NOT_FOUND',
                    COLUMN_NAME: 'sku',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(TSI.id) as CHAR) as tempId, TSI.sku FROM tempSupplyInventory TSI' +
                      ' LEFT JOIN  SupplyItems SI ON TSI.SKU  = SI.sku AND ' +
                      ' SI.accountId = uuid_to_bin(?) LEFT JOIN  uomNames UN INNER JOIN uomScaling US ON US.id = UN.uomScalingId ' +
                      ' AND (US.accountId = uuid_to_bin(?) OR US.accountId = uuid_to_bin(?)) AND UN.languageCultureCode = ?' +
                      ' ON TSI.defaultUoMSymbol = UN.symbol LEFT JOIN  uomCategory UC ON TSI.defaultUoMCategory = UC.NAME ' +
                      ' AND UC.languageCultureCode = ? AND (UC.accountId = uuid_to_bin(?) OR UC.accountId = uuid_to_bin(?)) ' +
                      ' WHERE UN.symbol IS NULL AND SI.sku IS NULL  AND UC.name IS not NULL AND TSI.accountId = uuid_to_bin(?) AND' +
                      ' TSI.defaultUoMSymbol != ? AND TSI.defaultUoMCategory != ? AND TSI.errorFlag = 0 ',
                    QUERY_NUMBER: 4,
                    ERROR: 'SUPPLY_ITEM_NOT_FOUND',
                    COLUMN_NAME: 'sku',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(TSI.id) as CHAR) as tempId, TSI.qtyOnHandUoM as qtyOnHandUOM FROM tempSupplyInventory TSI ' +
                      ' LEFT JOIN  SupplyItems SI ON TSI.SKU  = SI.sku AND SI.accountId = uuid_to_bin(?) ' +
                      ' LEFT JOIN  uomNames UN INNER JOIN uomScaling US ON US.id = UN.uomScalingId AND ' +
                      ' (US.accountId = uuid_to_bin(?) OR US.accountId = uuid_to_bin(?)) AND UN.languageCultureCode = ? ' +
                      ' ON TSI.qtyOnHandUoM = UN.symbol WHERE SI.sku IS NOT NULL AND UN.symbol IS NULL AND ' +
                      ' TSI.qtyOnHandUoM != ? AND TSI.qtyOnHandUoM != ? AND TSI.accountId = uuid_to_bin(?) AND TSI.errorFlag = 0 ',
                    QUERY_NUMBER: 5,
                    ERROR: 'UNIT_OF_MEASURE_NOT_FOUND',
                    COLUMN_NAME: 'qtyOnHandUoM',
                    IS_UPDATE: 0
                },
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(TSI.id) as CHAR) as tempId, TSI.qtyOnOrderUoM as qtyOnOrderUOM FROM tempSupplyInventory TSI ' +
                      ' LEFT JOIN  SupplyItems SI ON TSI.SKU  = SI.sku AND SI.accountId = uuid_to_bin(?) ' +
                      ' LEFT JOIN  uomNames UN INNER JOIN uomScaling US ON US.id = UN.uomScalingId AND ' +
                      ' (US.accountId = uuid_to_bin(?) OR US.accountId = uuid_to_bin(?)) AND UN.languageCultureCode = ?' +
                      ' ON TSI.qtyOnOrderUoM = UN.symbol WHERE SI.sku IS NOT NULL AND UN.symbol IS NULL AND ' +
                      ' TSI.qtyOnOrderUoM != ? AND TSI.qtyOnOrderUoM != ? AND TSI.accountId = uuid_to_bin(?) AND TSI.errorFlag = 0 ',
                    QUERY_NUMBER: 6,
                    ERROR: 'UNIT_OF_MEASURE_NOT_FOUND',
                    COLUMN_NAME: 'qtyOnOrderUoM',
                    IS_UPDATE: 0
                },
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(TSI.id) as CHAR) as tempId, TSI.qtyAvailableUoM as qtyAvailableUOM FROM tempSupplyInventory TSI ' +
                      ' LEFT JOIN  SupplyItems SI ON TSI.SKU  = SI.sku AND SI.accountId = uuid_to_bin(?) ' +
                      ' LEFT JOIN  uomNames UN INNER JOIN uomScaling US ON US.id = UN.uomScalingId AND ' +
                      ' (US.accountId = uuid_to_bin(?) OR US.accountId = uuid_to_bin(?)) AND UN.languageCultureCode = ?' +
                      ' ON TSI.qtyAvailableUoM = UN.symbol WHERE SI.sku IS NOT NULL AND UN.symbol IS NULL AND ' +
                      ' TSI.qtyAvailableUoM != ? AND TSI.qtyAvailableUoM != ? AND TSI.accountId = uuid_to_bin(?) AND TSI.errorFlag = 0 ',
                    QUERY_NUMBER: 7,
                    ERROR: 'UNIT_OF_MEASURE_NOT_FOUND',
                    COLUMN_NAME: 'qtyAvailableUoM',
                    IS_UPDATE: 0
                },
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(TSI.id) as CHAR) as tempId, TSI.qtyInTransitUoM as qtyInTransitUOM FROM tempSupplyInventory TSI ' +
                      ' LEFT JOIN  SupplyItems SI ON TSI.SKU  = SI.sku AND SI.accountId = uuid_to_bin(?) ' +
                      ' LEFT JOIN  uomNames UN INNER JOIN uomScaling US ON US.id = UN.uomScalingId AND ' +
                      ' (US.accountId = uuid_to_bin(?) OR US.accountId = uuid_to_bin(?)) AND UN.languageCultureCode = ?' +
                      ' ON TSI.qtyInTransitUoM = UN.symbol WHERE SI.sku IS NOT NULL AND UN.symbol IS NULL AND ' +
                      ' TSI.qtyInTransitUoM != ? AND TSI.qtyInTransitUoM != ? AND TSI.accountId = uuid_to_bin(?) AND TSI.errorFlag = 0 ',
                    QUERY_NUMBER: 8,
                    ERROR: 'UNIT_OF_MEASURE_NOT_FOUND',
                    COLUMN_NAME: 'qtyInTransitUoM',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(TSI.id) as CHAR) as tempId, TSI.sku FROM tempSupplyInventory TSI , ' +
                      ' SupplyItems SI, uomCategory UC' +
                      ' WHERE SI.accountId = uuid_to_bin(?) AND TSI.SKU = SI.sku AND (UC.accountId = uuid_to_bin(?) OR UC.accountId = uuid_to_bin(?)) and' +
                      ' UC.languageCultureCode = ? AND UC.categoryId = SI.qtyUoMCategory AND ' +
                      '((TSI.qtyOnHandUoM != ? AND TSI.qtyOnHandUoM != ? AND TSI.qtyOnHandUoM NOT IN ( SELECT UN1.symbol from uomScaling US1,uomNames UN1 WHERE ' +
                      '(US1.accountId = uuid_to_bin(?) OR US1.accountId = uuid_to_bin(?))' +
                      'AND UN1.languageCultureCode = ?  AND  UN1.uomScalingId = US1.id and US1.categoryId = UC.categoryId )) OR' +
                      '( TSI.qtyOnOrderUoM != ? AND TSI.qtyOnOrderUoM != ? AND TSI.qtyOnOrderUoM NOT IN (SELECT UN1.symbol from uomScaling US1,uomNames UN1 WHERE' +
                      '(US1.accountId = uuid_to_bin(?) OR US1.accountId = uuid_to_bin(?))' +
                      'AND UN1.languageCultureCode = ?  AND  UN1.uomScalingId = US1.id and US1.categoryId = UC.categoryId )) OR ' +
                      '(TSI.qtyAvailableUoM != ? AND TSI.qtyAvailableUoM != ? AND TSI.qtyAvailableUoM NOT IN (SELECT UN1.symbol from uomScaling US1,uomNames UN1 WHERE ' +
                      '(US1.accountId = uuid_to_bin(?) OR US1.accountId = uuid_to_bin(?))' +
                      'AND UN1.languageCultureCode = ?  AND  UN1.uomScalingId = US1.id and US1.categoryId = UC.categoryId )) OR' +
                      '(TSI.qtyInTransitUoM != ? AND TSI.qtyInTransitUoM != ? AND TSI.qtyInTransitUoM NOT IN (SELECT UN1.symbol from uomScaling US1,uomNames UN1 WHERE' +
                      '(US1.accountId = uuid_to_bin(?) OR US1.accountId = uuid_to_bin(?))' +
                      'AND UN1.languageCultureCode = ?  AND  UN1.uomScalingId = US1.id and US1.categoryId = UC.categoryId )))' +
                      'AND TSI.accountId = uuid_to_bin(?) AND TSI.errorFlag = 0',
                    QUERY_NUMBER: 9,
                    ERROR: 'UOM_IS_FROM_DIFFERENT_CATEGORY',
                    COLUMN_NAME: 'defaultUOMSymbol',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(TSI.id) as CHAR) as tempId, TSI.sku FROM tempSupplyInventory TSI ' +
                      ' LEFT JOIN  SupplyItems SI ON TSI.SKU  = SI.sku AND ' +
                      ' SI.accountId = uuid_to_bin(?) LEFT JOIN  uomNames UN INNER JOIN uomScaling US ON US.id = UN.uomScalingId' +
                      ' AND (US.accountId = uuid_to_bin(?) OR US.accountId = uuid_to_bin(?)) AND UN.languageCultureCode = ?' +
                      ' ON TSI.defaultUoMSymbol = UN.symbol LEFT JOIN  uomCategory UC ON TSI.defaultUoMCategory = UC.NAME ' +
                      ' AND UC.languageCultureCode = ? AND (UC.accountId = uuid_to_bin(?) OR UC.accountId = uuid_to_bin(?))' +
                      ' WHERE UN.symbol IS NULL AND SI.sku IS NULL  AND UC.name IS NULL AND  TSI.defaultUoMSymbol != ? AND TSI.defaultUoMCategory != ?' +
                      ' AND TSI.createdBy = uuid_to_bin(?) AND ' +
                      ' ((TSI.defaultUOMSymbol != TSI.qtyOnHandUOM AND  TSI.qtyOnHandUOM != ? AND  TSI.qtyOnHandUOM != ?) OR ' +
                      ' (TSI.defaultUOMSymbol != TSI.qtyOnOrderUOM AND TSI.qtyOnOrderUOM != ? AND TSI.qtyOnOrderUOM != ?) OR ' +
                      ' (TSI.defaultUOMSymbol != TSI.qtyAvailableUOM AND TSI.qtyAvailableUOM != ? AND TSI.qtyAvailableUOM != ?) OR ' +
                      ' (TSI.defaultUOMSymbol != TSI.qtyInTransitUOM AND TSI.qtyInTransitUOM != ? AND TSI.qtyInTransitUOM != ? )) ' +
                      ' AND TSI.accountId = uuid_to_bin(?) AND TSI.errorFlag = 0',
                    QUERY_NUMBER: 10,
                    ERROR: 'SUPPLY_ITEM_NOT_FOUND',
                    COLUMN_NAME: 'sku',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(TSI.id) as CHAR) as tempId, TSI.sku FROM tempSupplyInventory TSI ' +
                      ' LEFT JOIN  SupplyItems SI ON TSI.SKU  = SI.sku AND SI.accountId = uuid_to_bin(?)' +
                      ' LEFT JOIN  uomNames UN INNER JOIN uomScaling US ON US.id = UN.uomScalingId ' +
                      ' AND (US.accountId = uuid_to_bin(?) OR US.accountId = uuid_to_bin(?))' +
                      ' AND UN.languageCultureCode = ? ON TSI.defaultUoMSymbol = UN.symbol  ' +
                      ' LEFT JOIN  uomCategory UC ON TSI.defaultUoMCategory = UC.NAME ' +
                      ' AND UC.languageCultureCode = ? AND UC.categoryId = US.categoryId ' +
                      ' AND (UC.accountId = uuid_to_bin(?) OR UC.accountId = uuid_to_bin(?))' +
                      ' WHERE UN.symbol IS NOT NULL AND SI.sku IS NULL AND UC.name IS NULL  AND TSI.defaultUoMSymbol != ? ' +
                      ' AND TSI.accountId = uuid_to_bin(?) AND TSI.errorFlag = 0',
                    QUERY_NUMBER: 11,
                    ERROR: 'SUPPLY_ITEM_NOT_FOUND',
                    COLUMN_NAME: 'sku',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(TSI.id) as CHAR) as tempId, TSI.sku FROM tempSupplyInventory TSI ' +
                      ' LEFT JOIN  SupplyItems SI ON TSI.SKU  = SI.sku AND SI.accountId = uuid_to_bin(?) ' +
                      ' LEFT JOIN  uomNames UN ' +
                      ' INNER JOIN uomScaling US ON US.id = UN.uomScalingId ' +
                      ' AND (US.accountId = uuid_to_bin(?) OR US.accountId = uuid_to_bin(?)) ' +
                      ' AND UN.languageCultureCode = ? ON TSI.defaultUoMSymbol = UN.symbol ' +
                      ' LEFT JOIN  uomCategory UC ON TSI.defaultUoMCategory = UC.NAME ' +
                      ' AND UC.languageCultureCode = ? AND UC.categoryId = US.categoryId ' +
                      ' AND (UC.accountId = uuid_to_bin(?) OR UC.accountId = uuid_to_bin(?)) ' +
                      ' WHERE UN.symbol IS NOT NULL AND SI.sku IS NULL AND UC.name IS NOT NULL AND ' +
                      ' TSI.defaultUoMSymbol != ? AND TSI.defaultUoMCategory != ? ' +
                      ' AND TSI.createdBy = uuid_to_bin(?) AND' +
                      ' ((TSI.qtyOnHandUoM != ? AND TSI.qtyOnHandUoM != ? AND ' +
                      ' TSI.qtyOnHandUoM NOT IN ( SELECT UN1.symbol from uomScaling US1,uomNames UN1 WHERE ' +
                      ' (US1.accountId = uuid_to_bin(?) OR US1.accountId = uuid_to_bin(?)) AND UN1.languageCultureCode = ?' +
                      ' AND  UN1.uomScalingId = US1.id and US1.categoryId = UC.categoryId )) OR ' +
                      ' (TSI.qtyOnOrderUoM != ? AND TSI.qtyOnOrderUoM != ? AND TSI.qtyOnOrderUoM NOT IN (SELECT UN1.symbol from uomScaling US1,uomNames UN1 WHERE ' +
                      ' (US1.accountId = uuid_to_bin(?) OR US1.accountId = uuid_to_bin(?)) ' +
                      ' AND UN1.languageCultureCode = ?  AND  UN1.uomScalingId = US1.id and US1.categoryId = UC.categoryId )) OR' +
                      ' (TSI.qtyAvailableUoM != ? AND TSI.qtyAvailableUoM != ? AND TSI.qtyAvailableUoM NOT IN (SELECT UN1.symbol from uomScaling US1,uomNames UN1 WHERE' +
                      ' (US1.accountId = uuid_to_bin(?) OR US1.accountId = uuid_to_bin(?)) AND UN1.languageCultureCode = ?  ' +
                      ' AND  UN1.uomScalingId = US1.id and US1.categoryId = UC.categoryId )) OR ' +
                      ' (TSI.qtyInTransitUoM != ? AND TSI.qtyInTransitUoM != ? AND TSI.qtyInTransitUoM NOT IN (SELECT UN1.symbol from uomScaling US1,uomNames UN1 WHERE ' +
                      ' (US1.accountId = uuid_to_bin(?) OR US1.accountId = uuid_to_bin(?)) AND UN1.languageCultureCode = ?  AND ' +
                      ' UN1.uomScalingId = US1.id and US1.categoryId = UC.categoryId ))) AND TSI.errorFlag = 0 ',
                    QUERY_NUMBER: 12,
                    ERROR: 'SUPPLY_ITEM_NOT_FOUND',
                    COLUMN_NAME: 'sku',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'select SI.SKU,SI.locationId,CAST(uuid_from_bin(TSI.id) as CHAR) as tempId, TSI.sku from SupplyInventory SI , ' +
                      ' tempSupplyInventory TSI where SI.SKU=TSI.SKU and SI.locationId = TSI.locationId and ' +
                      ' SI.accountId = TSI.accountId and TSI.createdBy = uuid_to_bin(?) AND TSI.errorFlag = 0',
                    QUERY_NUMBER: 13,
                    ERROR: 'SUPPLY_ITEM_INVENTORY_ALREADY_EXIST',
                    COLUMN_NAME: 'sku',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(TSI.id) as CHAR) as tempId,TSI.locationId as locationName ' +
                      ' FROM tempSupplyInventory TSI' +
                      ' LEFT JOIN LocationReference LR  ON ' +
                      ' TSI.locationId  = LR.locationName AND TSI.locationId != LR.locationId AND LR.accountId = uuid_to_bin(?)' +
                      ' WHERE TSI.accountId =uuid_to_bin(?) AND TSI.createdBy = uuid_to_bin(?) AND TSI.errorFlag =0' +
                      ' AND LR.locationId IS NOT NULL AND LR.locationName IS NOT null ',
                    QUERY_NUMBER: 14,
                    ERROR: 'LOCATION_REFERENCE_ALREADY_EXIST',
                    COLUMN_NAME: 'locationId',
                    IS_UPDATE: 1
                }
            ],
            LOGICAL_VALIDATION: [
                /*{
                    QUERY: 'select sku,locationId,count(sku) as count from tempSupplyInventory where createdBy=uuid_to_bin(?) group by sku,locationId having count(sku) > 1',
                    ERROR: 'DUPLICATE_SUPPLY_ITEM_INVENTORY_IN_THE_FILE',
                    COLUMN_NAME: 'locationId'
                },
                {
                    QUERY: 'select distinct TSI.SKU from tempSupplyInventory TSI where createdBy=uuid_to_bin(?) ' +
                      'and not exists (select 1 from SupplyItems SI where TSI.SKU = SI.SKU and TSI.accountId = SI.accountId);',
                    ERROR: 'SUPPLY_ITEM_NOT_FOUND',
                    COLUMN_NAME: 'SKU'
                },
                {
                    QUERY: 'select distinct TSI.locationId from tempSupplyInventory TSI where createdBy=uuid_to_bin(?) ' +
                      'and not exists (select 1 from LocationReference LR where TSI.locationId = LR.locationId and TSI.accountId = LR.accountId and status = 1);',
                    ERROR: 'LOCATION_REFERENCE_NOT_FOUND',
                    COLUMN_NAME: 'locationId'
                },
                {
                    QUERY: 'select SI.SKU,SI.locationId from SupplyInventory SI , tempSupplyInventory TSI where SI.SKU=TSI.SKU and ' +
                      ' SI.locationId = TSI.locationId and SI.accountId = TSI.accountId and TSI.createdBy = uuid_to_bin(?);',
                    ERROR: 'SUPPLY_ITEM_INVENTORY_ALREADY_EXIST',
                    COLUMN_NAME: 'locationId'
                }*/
            ],
            UOM_FIELDS: [6, 8, 10, 12],
            UPDATE_QUERY: ['update SupplyItems SI,tempSupplyInventory TSI set TSI.supplyItemId = SI.id where TSI.createdBy = uuid_to_bin(?) and ' +
            ' TSI.accountId=SI.accountId and TSI.SKU = SI.sku ;'],
            PRECISION: 1,
            FINAL_QUERY: 'INSERT into SupplyInventory (id,accountId,supplyItemId,SKU,locationId,qtyOnHand,qtyOnHandUoM,qtyOnOrder,qtyOnOrderUoM,' +
              ' qtyAvailable,qtyAvailableUoM,qtyInTransit,qtyIntransitUoM,notes,recordType,createdAt,updatedAt,createdBy,updatedBy)' +
              ' (SELECT  uuid_to_bin(UUID()),accountId,supplyItemId,SKU,locationId,qtyOnHand,qtyOnHandUoM,qtyOnOrder,qtyOnOrderUoM,qtyAvailable,qtyAvailableUoM,' +
              ' qtyInTransit,qtyIntransitUoM,notes,recordType,createdAt,updatedAt,createdBy,updatedBy' +
              ' FROM tempSupplyInventory WHERE accountId = uuid_to_bin(?) AND createdBy = uuid_to_bin(?) AND errorFlag =0 )',
            ADDITIONAL_OPERATION: []
        },
        7: {
            TEMP: 'tempLocationReference',
            ORIGINAL: 'LocationReference',
            REFERENCE: '',
            AMOUNT_MANIPULATION: false,
            AMOUNT_FIELDS: [6, 7, 9, 10, 12, 13, 23, 24],
            QUANTITY_MANIPULATION: false,
            QUANTITY_UOM: [],
            ERROR_MESSAGE: 'INVALID_PHONE_VALUES',
            SKIP_FIELDS: [],
            DEFAULT_COLUMN_QUERY: 'id=uuid_to_bin(uuid()),accountId=uuid_to_bin(?),createdBy=uuid_to_bin(?),createdAt=?,updatedAt=?,recordType=?,',
            INVALID_RECORDS: [
                {
                    QUERY: 'SELECT locationId,count(locationId) as count,group_concat(CAST(uuid_from_bin(id) as CHAR)) as tempId' +
                      ' from tempLocationReference where createdBy=uuid_to_bin(?) and errorFlag=0 ' +
                      ' group BY locationId having count(locationId) > 1',
                    QUERY_NUMBER: 1,
                    ERROR: 'DUPLICATE_LOCATION_REFERENCE_IN_THE_FILE',
                    COLUMN_NAME: 'locationId',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT locationName,count(locationName) as count,group_concat(CAST(uuid_from_bin(id) as CHAR)) as tempId' +
                      ' from tempLocationReference where createdBy=uuid_to_bin(?) and errorFlag=0 ' +
                      ' group BY locationName having count(locationName) > 1',
                    QUERY_NUMBER: 2,
                    ERROR: 'DUPLICATE_LOCATION_REFERENCE_IN_THE_FILE',
                    COLUMN_NAME: 'locationName',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT TLR.locationId as locationId,CAST(uuid_from_bin(TLR.id) as CHAR) as tempId' +
                      ' FROM tempLocationReference TLR , LocationReference LR  WHERE TLR.accountId =  LR.accountId ' +
                      ' AND TLR.locationId = LR.locationId AND TLR.createdBy= uuid_to_Bin(?)  AND TLR.errorFlag = 0',
                    QUERY_NUMBER: 3,
                    ERROR: 'LOCATION_REFERENCE_ALREADY_EXIST',
                    COLUMN_NAME: 'locationId',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT TLR.locationName as locationName,CAST(uuid_from_bin(TLR.id) as CHAR) as tempId' +
                      ' FROM tempLocationReference TLR , LocationReference LR  WHERE TLR.accountId =  LR.accountId ' +
                      ' AND TLR.locationName = LR.locationName AND TLR.createdBy= uuid_to_Bin(?)  AND TLR.errorFlag = 0',
                    QUERY_NUMBER: 4,
                    ERROR: 'LOCATION_REFERENCE_ALREADY_EXIST',
                    COLUMN_NAME: 'locationName',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT locationId,latitude,CAST(uuid_from_bin(id) as CHAR) as tempId FROM tempLocationReference ' +
                      ' WHERE ( latitude <-90 OR latitude > 90) and errorFlag = 1 AND createdBy= uuid_to_Bin(?) AND latitude != ?',
                    QUERY_NUMBER: 5,
                    ERROR: 'INVALID_LATITUDE_VALUE',
                    COLUMN_NAME: 'latitude',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT locationId,longitude,CAST(uuid_from_bin(id) as CHAR) as tempId FROM tempLocationReference ' +
                      ' WHERE (longitude < -180 OR longitude > 180 ) and errorFlag = 1 AND createdBy= uuid_to_Bin(?) AND longitude != ?',
                    QUERY_NUMBER: 6,
                    ERROR: 'INVALID_LONGITUDE_VALUE',
                    COLUMN_NAME: 'longitude',
                    IS_UPDATE: 1
                }
            ],
            LOGICAL_VALIDATION: [],
            UOM_FIELDS: [],
            UPDATE_QUERY: [],
            PRECISION: 0,
            FINAL_QUERY: 'INSERT into LocationReference (accountId,locationId,locationName,additionalLocationCode,additionalLocationName,' +
              ' email,phone,dialCode,phoneCountry,primaryMobile,primaryMobileDialCode,primaryMobileCountry,secondaryMobile,' +
              ' secondaryMobileDialCode,secondaryMobileCountry,fax,addressLine1,addressLine2,addressLine3,city,zipcode,state,' +
              ' country,latitude,longitude,comment,recordType,createdAt,updatedAt,createdBy,updatedBy)' +
              ' (SELECT accountId,locationId,locationName,additionalLocationCode,additionalLocationName,' +
              ' email,CONCAT_WS(?,dialCode,phone),dialCode,phoneCountry,' +
              ' CONCAT_WS(?,primaryMobileDialCode,primaryMobile),primaryMobileDialCode,primaryMobileCountry,' +
              ' CONCAT_WS(?,primaryMobileDialCode,secondaryMobile),secondaryMobileDialCode,secondaryMobileCountry,' +
              ' fax,addressLine1,addressLine2,addressLine3,city,zipcode,state,' +
              ' country,latitude,longitude,comment,recordType,createdAt,updatedAt,createdBy,updatedBy' +
              ' FROM tempLocationReference WHERE accountId = uuid_to_bin(?) AND createdBy = uuid_to_bin(?) AND errorFlag =0 )',
            ADDITIONAL_OPERATION: []
        },
        8: {
            TEMP: 'tempUOM',
            ORIGINAL: '',
            REFERENCE: '',
            AMOUNT_MANIPULATION: false,
            AMOUNT_FIELDS: [4, 5],
            QUANTITY_MANIPULATION: false,
            QUANTITY_UOM: [],
            ERROR_MESSAGE: 'INVALID_SCALING_VALUE',
            SKIP_FIELDS: [],
            DEFAULT_COLUMN_QUERY: 'id=uuid_to_bin(uuid()),accountId=uuid_to_bin(?),createdBy=uuid_to_bin(?),createdAt=?,updatedAt=?,recordType=?,',
            INVALID_RECORDS: [
                {
                    QUERY: 'SELECT categoryName ,uomName, COUNT(uomName) as count, group_concat(CAST(uuid_from_bin(id) as CHAR)) as tempId FROM tempUOM ' +
                      ' where createdBy=uuid_to_bin(?) and errorFlag=0 GROUP BY uomName, categoryName HAVING count > 1',
                    QUERY_NUMBER: 1,
                    ERROR: 'DUPLICATE_UNIT_OF_MEASURE_NAME_IN_THE_FILE',
                    COLUMN_NAME: 'uomName',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT categoryName ,symbol, COUNT(symbol) as count, group_concat(CAST(uuid_from_bin(id) as CHAR)) as tempId FROM tempUOM ' +
                      ' where createdBy=uuid_to_bin(?) and errorFlag=0 GROUP BY categoryName, symbol HAVING count > 1',
                    QUERY_NUMBER: 2,
                    ERROR: 'DUPLICATE_UNIT_OF_MEASURE_SYMBOL_IN_THE_FILE',
                    COLUMN_NAME: 'symbol',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT categoryName , COUNT(scalingFactor) as count, group_concat(CAST(uuid_from_bin(id) as CHAR)) as tempId FROM tempUOM ' +
                      ' where createdBy=uuid_to_bin(?) and errorFlag=0 GROUP BY scalingFactor,scalingPrecision, categoryName HAVING count > 1',
                    QUERY_NUMBER: 3,
                    ERROR: 'DUPLICATE_SCALING_VALUE_IN_THE_FILE',
                    COLUMN_NAME: 'categoryName',
                    IS_UPDATE: 1
                },
                {
                    QUERY: ' SELECT categoryName, scalingPrecision,CAST(uuid_from_bin(id) as CHAR) as tempId FROM tempUOM ' +
                      ' WHERE (scalingPrecision < 1 OR scalingPrecision > 6) AND createdBy=uuid_to_bin(?) AND errorFlag = 0',
                    QUERY_NUMBER: 4,
                    ERROR: 'INVALID_SCALING_PRECISION',
                    COLUMN_NAME: 'categoryName',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(TUOM.id) as CHAR) as tempId, TUOM.uomName,TUOM.categoryName FROM tempUOM TUOM' +
                      ' LEFT JOIN  uomNames UN' +
                      ' INNER JOIN uomScaling US ON US.id = UN.uomScalingId' +
                      ' AND (US.accountId = uuid_to_bin(?) OR US.accountId = uuid_to_bin(?))' +
                      ' AND UN.languageCultureCode = ? ON TUOM.uomName = UN.NAME' +
                      ' LEFT JOIN  uomCategory UC ON TUOM.categoryName = UC.NAME AND UC.categoryId = US.categoryId' +
                      ' AND UC.languageCultureCode = ?' +
                      ' AND (UC.accountId = uuid_to_bin(?) OR UC.accountId = uuid_to_bin(?))' +
                      ' WHERE' +
                      ' UN.name IS not  NULL AND' +
                      ' UC.name IS not NULL   AND TUOM.errorFlag = 0 AND TUOM.createdBy = uuid_to_bin(?)',
                    QUERY_NUMBER: 5,
                    ERROR: 'UNIT_OF_MEASURE_EXIST_WITH_SAME_NAME',
                    COLUMN_NAME: 'uomName',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(TUOM.id) as CHAR) as tempId, TUOM.symbol, TUOM.categoryName FROM tempUOM TUOM' +
                      ' LEFT JOIN  uomNames UN' +
                      ' INNER JOIN uomScaling US ON US.id = UN.uomScalingId' +
                      ' AND (US.accountId = uuid_to_bin(?) OR US.accountId = uuid_to_bin(?))' +
                      ' AND UN.languageCultureCode = ? ' +
                      ' ON TUOM.symbol = UN.symbol' +
                      ' LEFT JOIN  uomCategory UC ON TUOM.categoryName = UC.NAME AND UC.categoryId = US.categoryId' +
                      ' AND UC.languageCultureCode = ?' +
                      ' AND (UC.accountId = uuid_to_bin(?) OR UC.accountId = uuid_to_bin(?))' +
                      ' WHERE' +
                      ' UN.symbol IS not  NULL  AND' +
                      ' UC.name IS not NULL   AND TUOM.errorFlag = 0 AND TUOM.createdBy = uuid_to_bin(?)',
                    QUERY_NUMBER: 6,
                    ERROR: 'UNIT_OF_MEASURE_EXIST_WITH_SAME_SYMBOL',
                    COLUMN_NAME: 'symbol',
                    IS_UPDATE: 1
                },
                {
                    QUERY: ' SELECT CAST(uuid_from_bin(TUOM.id) as CHAR) as tempId, TUOM.categoryName FROM tempUOM TUOM' +
                      ' LEFT JOIN  uomCategory UC ON TUOM.categoryName = UC.NAME' +
                      ' AND UC.languageCultureCode = ?' +
                      ' AND (UC.accountId = uuid_to_bin(?) OR UC.accountId = uuid_to_bin(?))' +
                      ' INNER JOIN uomScaling US ON US.categoryId = UC.categoryId' +
                      ' AND (US.accountId = uuid_to_bin(?) OR US.accountId = uuid_to_bin(?))' +
                      ' AND UC.languageCultureCode = ? ' +
                      ' AND US.scalingFactor = TUOM.scalingFactor  AND US.scalingPrecision = TUOM.scalingPrecision' +
                      ' WHERE US.scalingFactor IS NOT NULL AND US.scalingPrecision IS NOT NULL AND UC.NAME IS NOT NULL' +
                      ' AND TUOM.errorFlag = 0 AND TUOM.createdBy = uuid_to_bin(?)',
                    QUERY_NUMBER: 7,
                    ERROR: 'UNIT_OF_MEASURE_EXIST_WITH_SAME_SCALING_FACTOR_AND_PRECISION',
                    COLUMN_NAME: 'categoryName',
                    IS_UPDATE: 1
                },
                {
                    QUERY: ' SELECT CAST(uuid_from_bin(TUOM.id) as CHAR) as tempId, TUOM.categoryName FROM tempUOM TUOM' +
                      ' LEFT JOIN  uomCategory UC ON TUOM.categoryName = UC.NAME' +
                      ' AND UC.languageCultureCode = ?' +
                      ' AND (UC.accountId = uuid_to_bin(?) OR UC.accountId = uuid_to_bin(?))' +
                      ' INNER JOIN uomScaling US ON US.categoryId = UC.categoryId' +
                      ' AND (US.accountId = uuid_to_bin(?) OR US.accountId = uuid_to_bin(?))' +
                      ' AND UC.languageCultureCode = ? AND US.scalingFactor = TUOM.scalingFactor  AND  US.scalingFactor = 1' +
                      ' WHERE US.scalingFactor IS NOT NULL AND UC.NAME IS NOT NULL' +
                      ' AND TUOM.errorFlag = 0 AND TUOM.createdBy = uuid_to_bin(?)',
                    QUERY_NUMBER: 8,
                    ERROR: 'UNIT_OF_MEASURE_SCALING_FACTOR_ONE_ALREADY_EXIST_FOR_THIS_CATEGORY',
                    COLUMN_NAME: 'categoryName',
                    IS_UPDATE: 1
                },
                {
                    QUERY: ' with category AS ' +
                      ' (SELECT TUOM.categoryName,COUNT(case when TUOM.scalingFactor = 1 then 1 end) AS COUNT  FROM tempUOM TUOM' +
                      ' LEFT JOIN  uomCategory UC ON TUOM.categoryName = UC.NAME' +
                      ' AND UC.languageCultureCode = ?' +
                      ' AND (UC.accountId = uuid_to_bin(?) OR UC.accountId = uuid_to_bin(?))' +
                      ' WHERE  UC.NAME  IS NULL' +
                      ' AND TUOM.errorFlag = 0 AND TUOM.createdBy = uuid_to_bin(?) GROUP BY TUOM.categoryName HAVING COUNT != 1 )' +
                      ' SELECT CAST(uuid_from_bin(TUOM.id) as CHAR) as tempId, TUOM.categoryName FROM tempUOM TUOM,category C' +
                      ' WHERE  TUOM.categoryName = C.categoryName AND TUOM.errorFlag = 0 AND TUOM.createdBy = uuid_to_bin(?)',
                    QUERY_NUMBER: 9,
                    ERROR: 'UNIT_OF_MEASURE_SCALAR_FACTOR_SHOULD_BE_1',
                    COLUMN_NAME: 'categoryName',
                    IS_UPDATE: 1
                }
            ],
            LOGICAL_VALIDATION: [],
            UOM_FIELDS: [],
            UPDATE_QUERY: [],
            PRECISION: 0,
            FINAL_QUERY: '',
            ADDITIONAL_OPERATION: []
        },
        9: {
            TEMP: 'tempSupplier',
            ORIGINAL: 'Supplier',
            REFERENCE: '',
            AMOUNT_MANIPULATION: false,
            AMOUNT_FIELDS: [11, 12, 14, 15, 17, 18],
            QUANTITY_MANIPULATION: false,
            QUANTITY_UOM: [],
            ERROR_MESSAGE: 'INVALID_PHONE_VALUES',
            SKIP_FIELDS: [],
            DEFAULT_COLUMN_QUERY: 'id=uuid_to_bin(uuid()),accountId=uuid_to_bin(?),createdBy=uuid_to_bin(?),createdAt=?,updatedAt=?,recordType=?,',
            INVALID_RECORDS: [
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(id) as CHAR) as tempId,email FROM tempSupplier WHERE email not REGEXP ? and ' +
                      ' createdBy = uuid_to_bin(?) and errorFlag = 0',
                    QUERY_NUMBER: 1,
                    ERROR: 'INVALID_EMAIL',
                    COLUMN_NAME: 'email',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT  group_concat(CAST(uuid_from_bin(id) as CHAR)) as tempId, email, COUNT(email) AS count ' +
                      ' FROM tempSupplier  WHERE createdBy = uuid_to_bin(?) and errorFlag = 0 GROUP BY email HAVING count > 1',
                    QUERY_NUMBER: 2,
                    ERROR: 'DUPLICATE_SUPPLIER_IN_THE_FILE',
                    COLUMN_NAME: 'email',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(TS.id) as CHAR) as tempId,TS.email FROM tempSupplier TS' +
                      ' LEFT join Supplier S ON TS.email = S.email AND S.accountId = uuid_to_bin(?)' +
                      ' WHERE S.email IS not null AND TS.accountId = uuid_to_bin(?) AND TS.createdBy = uuid_to_bin(?) ' +
                      ' AND TS.errorFlag = 0',
                    QUERY_NUMBER: 3,
                    ERROR: 'SUPPLIER_ALREADY_EXIST',
                    COLUMN_NAME: 'email',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT group_concat(CAST(uuid_from_bin(id) as CHAR)) as tempId, supplierCode, COUNT(supplierCode) AS count' +
                      ' FROM tempSupplier WHERE createdBy = uuid_to_bin(?) and errorFlag = 0 GROUP BY supplierCode HAVING COUNT > 1',
                    QUERY_NUMBER: 4,
                    ERROR: 'DUPLICATE_SUPPLIER_IN_THE_FILE',
                    COLUMN_NAME: 'supplierCode',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(TS.id) as CHAR) as tempId,TS.supplierCode FROM tempSupplier TS' +
                      ' LEFT join Supplier S ON TS.supplierCode = S.supplierCode AND S.accountId = uuid_to_bin(?) ' +
                      ' WHERE S.supplierCode IS not null AND TS.accountId = uuid_to_bin(?) AND TS.createdBy = uuid_to_bin(?)' +
                      ' AND TS.errorFlag = 0',
                    QUERY_NUMBER: 5,
                    ERROR: 'SUPPLIER_ALREADY_EXIST',
                    COLUMN_NAME: 'supplierCode',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(TS.id) as CHAR) as tempId,TS.existLocationId FROM tempSupplier TS' +
                      ' LEFT JOIN LocationReference LR  ON TS.existLocationId = LR.locationId' +
                      ' AND LR.accountId = uuid_to_bin(?)' +
                      ' WHERE ' +
                      ' LR.locationId IS NULL AND TS.existLocationId != ?  AND' +
                      ' TS.accountId =uuid_to_Bin(?) AND TS.errorFlag =0  AND TS.createdBy = uuid_to_bin(?)',
                    QUERY_NUMBER: 6,
                    ERROR: 'LOCATION_REFERENCE_NOT_FOUND',
                    COLUMN_NAME: 'existLocationId',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT group_concat(CAST(uuid_from_bin(TS.id) as CHAR)) as tempId,TS.locationId,COUNT(TS.locationId) AS count ' +
                      ' FROM tempSupplier TS ' +
                      ' LEFT JOIN LocationReference LR  ON TS.locationName  = LR.locationName AND TS.locationId = LR.locationId' +
                      ' AND LR.accountId = uuid_to_bin(?)' +
                      ' WHERE LR.locationId IS NULL AND LR.locationName IS NULL AND TS.locationName != ? AND TS.locationId != ? AND TS.existlocationId = ?' +
                      ' AND TS.accountId =uuid_to_Bin(?) AND TS.errorFlag =0 AND TS.createdBy = uuid_to_bin(?)' +
                      ' GROUP BY TS.locationId HAVING COUNT > 1',
                    QUERY_NUMBER: 7,
                    ERROR: 'DUPLICATE_LOCATION_REFERENCE_IN_THE_FILE',
                    COLUMN_NAME: 'locationId',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT group_concat(CAST(uuid_from_bin(TS.id) as CHAR)) as tempId,TS.locationName,COUNT(TS.locationName) AS count ' +
                      ' FROM tempSupplier TS ' +
                      ' LEFT JOIN LocationReference LR  ON TS.locationName  = LR.locationName AND TS.locationId = LR.locationId' +
                      ' AND LR.accountId = uuid_to_bin(?)' +
                      ' WHERE LR.locationId IS NULL AND LR.locationName IS NULL AND TS.locationName != ? AND TS.locationId != ? AND TS.existlocationId = ?' +
                      ' AND TS.accountId =uuid_to_Bin(?) AND TS.errorFlag =0 AND TS.createdBy = uuid_to_bin(?)' +
                      ' GROUP BY TS.locationName HAVING COUNT > 1',
                    QUERY_NUMBER: 8,
                    ERROR: 'DUPLICATE_LOCATION_REFERENCE_IN_THE_FILE',
                    COLUMN_NAME: 'locationName',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'with location  as (SELECT TS.id,TS.locationId,TS.locationName' +
                      ' FROM tempSupplier TS' +
                      ' LEFT JOIN LocationReference LR  ON TS.locationName  = LR.locationName AND TS.locationId = LR.locationId' +
                      ' AND LR.accountId = uuid_to_bin(?)' +
                      ' WHERE ' +
                      ' LR.locationId IS NULL AND LR.locationName IS NULL AND TS.locationName != ? AND TS.locationId != ? AND TS.existlocationId = ?' +
                      ' AND TS.accountId =uuid_to_Bin(?) AND TS.errorFlag =0 AND TS.createdBy = uuid_to_bin(?) )' +
                      ' ' +
                      ' SELECT CAST(uuid_from_bin(L.id) as CHAR) as tempId, L.locationId FROM location L' +
                      ' LEFT JOIN LocationReference LR ON L.locationId = LR.locationId AND LR.accountId = uuid_to_bin(?)' +
                      ' WHERE LR.locationId IS NOT null',
                    QUERY_NUMBER: 9,
                    ERROR: 'LOCATION_REFERENCE_ALREADY_EXIST',
                    COLUMN_NAME: 'locationId',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'with location  as (SELECT TS.id,TS.locationId,TS.locationName' +
                      ' FROM tempSupplier TS' +
                      ' LEFT JOIN LocationReference LR  ON TS.locationName  = LR.locationName AND TS.locationId = LR.locationId' +
                      ' AND LR.accountId = uuid_to_bin(?)' +
                      ' WHERE ' +
                      ' LR.locationId IS NULL AND LR.locationName IS NULL AND TS.locationName != ? AND TS.locationId != ? AND TS.existlocationId = ?' +
                      ' AND TS.accountId =uuid_to_Bin(?) AND TS.errorFlag =0 AND TS.createdBy = uuid_to_bin(?) )' +
                      ' ' +
                      ' SELECT CAST(uuid_from_bin(L.id) as CHAR) as tempId, L.locationName FROM location L' +
                      ' LEFT JOIN LocationReference LR ON L.locationName = LR.locationName AND LR.accountId = uuid_to_bin(?)' +
                      ' WHERE LR.locationName IS NOT null',
                    QUERY_NUMBER: 10,
                    ERROR: 'LOCATION_REFERENCE_ALREADY_EXIST',
                    COLUMN_NAME: 'locationName',
                    IS_UPDATE: 1
                }
            ],
            LOGICAL_VALIDATION: [],
            UOM_FIELDS: [],
            UPDATE_QUERY: [],
            PRECISION: 0,
            FINAL_QUERY: 'INSERT INTO Supplier (' +
              ' id,accountId,email,supplierCode,supplierName,firstName,lastName,locationId,locationName,companyName,supplierId,' +
              ' phone,dialCode,phoneCountry,primaryMobile,primaryMobileDialCode,primaryMobileCountry,' +
              ' secondaryMobile,secondaryMobileDialCode,secondaryMobileCountry,fax,addressLine1,addressLine2,addressLine3,' +
              ' zipCode,country,city,state ,personalMessage,recordType,createdAt,updatedAt,createdBy,updatedBy)' +
              ' (SELECT uuid_to_bin(UUID()),accountId,email,supplierCode,supplierName,firstName,lastName,locationId,locationName,' +
              ' companyName, companyId,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,personalMessage,recordType,createdAt,updatedAt,createdBy,updatedBy' +
              ' FROM tempSupplier WHERE existLocationId = ? AND locationName !=? AND locationId != ? ' +
              ' AND errorFlag =0   AND accountId = uuid_to_bin(?) AND createdBy = uuid_to_bin(?) )' +
              ' UNION ALL' +
              ' (SELECT uuid_to_bin(UUID()),accountId,email,supplierCode,supplierName,firstName,lastName,existLocationId ,?,' +
              ' companyName, companyId,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,personalMessage,recordType,createdAt,updatedAt,createdBy,updatedBy' +
              ' FROM tempSupplier WHERE existLocationId != ? AND errorFlag =0  AND accountId = uuid_to_bin(?) ' +
              ' AND createdBy = uuid_to_bin(?))' +
              ' UNION ALL' +
              ' (SELECT uuid_to_bin(UUID()),accountId,email,supplierCode,supplierName,firstName,lastName,locationId,locationName,' +
              ' companyName, companyId,CONCAT_WS(?,dialCode,phone) AS phone,dialCode,phoneCountry,' +
              ' CONCAT_WS(?,primaryMobileDialCode,primaryMobile) AS primaryMobile,primaryMobileDialCode,primaryMobileCountry,' +
              ' CONCAT_WS(?,secondaryMobileDialCode,secondaryMobile) AS secondaryMobile,secondaryMobileDialCode,secondaryMobileCountry,' +
              ' fax,addressLine1,addressLine2,addressLine3,zipCode,country,city,' +
              ' state ,personalMessage,recordType,createdAt,updatedAt,createdBy,updatedBy' +
              ' FROM tempSupplier WHERE existLocationId = ? AND locationName = ? AND locationId = ? AND errorFlag =0  ' +
              ' AND accountId = uuid_to_bin(?) AND createdBy = uuid_to_bin(?))',
            ADDITIONAL_OPERATION: []
        },
        10: {
            TEMP: 'tempCustomer',
            ORIGINAL: 'Customers',
            REFERENCE: '',
            AMOUNT_MANIPULATION: false,
            AMOUNT_FIELDS: [11, 12, 14, 15, 17, 18],
            QUANTITY_MANIPULATION: false,
            QUANTITY_UOM: [],
            ERROR_MESSAGE: 'INVALID_PHONE_VALUES',
            SKIP_FIELDS: [],
            DEFAULT_COLUMN_QUERY: 'id=uuid_to_bin(uuid()),accountId=uuid_to_bin(?),createdBy=uuid_to_bin(?),createdAt=?,updatedAt=?,recordType=?,',
            INVALID_RECORDS: [
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(id) as CHAR) as tempId,email FROM tempCustomer WHERE email not REGEXP ? and ' +
                      ' createdBy = uuid_to_bin(?) and errorFlag = 0',
                    QUERY_NUMBER: 1,
                    ERROR: 'INVALID_EMAIL',
                    COLUMN_NAME: 'email',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT  group_concat(CAST(uuid_from_bin(id) as CHAR)) as tempId, email, COUNT(email) AS count ' +
                      ' FROM tempCustomer  WHERE createdBy = uuid_to_bin(?) and errorFlag = 0 GROUP BY email HAVING count > 1',
                    QUERY_NUMBER: 2,
                    ERROR: 'DUPLICATE_CUSTOMER_IN_THE_FILE',
                    COLUMN_NAME: 'email',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(TC.id) as CHAR) as tempId,TC.email FROM tempCustomer TC' +
                      ' LEFT join Customers C ON TC.email = C.email AND C.accountId = uuid_to_bin(?)' +
                      ' WHERE C.email IS not null AND TC.accountId = uuid_to_bin(?) AND TC.createdBy = uuid_to_bin(?) ' +
                      ' AND TC.errorFlag = 0',
                    QUERY_NUMBER: 3,
                    ERROR: 'CUSTOMER_ALREADY_EXIST',
                    COLUMN_NAME: 'email',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT group_concat(CAST(uuid_from_bin(id) as CHAR)) as tempId, customerCode, COUNT(customerCode) AS count' +
                      ' FROM tempCustomer WHERE createdBy = uuid_to_bin(?) and errorFlag = 0 GROUP BY customerCode HAVING COUNT > 1',
                    QUERY_NUMBER: 4,
                    ERROR: 'DUPLICATE_CUSTOMER_IN_THE_FILE',
                    COLUMN_NAME: 'customerCode',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(TC.id) as CHAR) as tempId,TC.customerCode FROM tempCustomer TC' +
                      ' LEFT join Customers C ON TC.customerCode = C.customerCode AND C.accountId = uuid_to_bin(?) ' +
                      ' WHERE C.customerCode IS not null AND TC.accountId = uuid_to_bin(?) AND TC.createdBy = uuid_to_bin(?)' +
                      ' AND TC.errorFlag = 0',
                    QUERY_NUMBER: 5,
                    ERROR: 'CUSTOMER_ALREADY_EXIST',
                    COLUMN_NAME: 'customerCode',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT CAST(uuid_from_bin(TC.id) as CHAR) as tempId,TC.existLocationId FROM tempCustomer TC' +
                      ' LEFT JOIN LocationReference LR  ON TC.existLocationId = LR.locationId' +
                      ' AND LR.accountId = uuid_to_bin(?)' +
                      ' WHERE ' +
                      ' LR.locationId IS NULL AND TC.existLocationId != ?  AND' +
                      ' TC.accountId =uuid_to_Bin(?) AND TC.errorFlag =0  AND TC.createdBy = uuid_to_bin(?)',
                    QUERY_NUMBER: 6,
                    ERROR: 'LOCATION_REFERENCE_NOT_FOUND',
                    COLUMN_NAME: 'existLocationId',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT group_concat(CAST(uuid_from_bin(TC.id) as CHAR)) as tempId,TC.locationId,COUNT(TC.locationId) AS count ' +
                      ' FROM tempCustomer TC ' +
                      ' LEFT JOIN LocationReference LR  ON TC.locationName  = LR.locationName AND TC.locationId = LR.locationId' +
                      ' AND LR.accountId = uuid_to_bin(?)' +
                      ' WHERE LR.locationId IS NULL AND LR.locationName IS NULL AND TC.locationName != ? AND TC.locationId != ? AND TC.existlocationId = ?' +
                      ' AND TC.accountId =uuid_to_Bin(?) AND TC.errorFlag =0 AND TC.createdBy = uuid_to_bin(?)' +
                      ' GROUP BY TC.locationId HAVING COUNT > 1',
                    QUERY_NUMBER: 7,
                    ERROR: 'DUPLICATE_LOCATION_REFERENCE_IN_THE_FILE',
                    COLUMN_NAME: 'locationId',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'SELECT group_concat(CAST(uuid_from_bin(TC.id) as CHAR)) as tempId,TC.locationName,COUNT(TC.locationName) AS count ' +
                      ' FROM tempCustomer TC ' +
                      ' LEFT JOIN LocationReference LR  ON TC.locationName  = LR.locationName AND TC.locationId = LR.locationId' +
                      ' AND LR.accountId = uuid_to_bin(?)' +
                      ' WHERE LR.locationId IS NULL AND LR.locationName IS NULL AND TC.locationName != ? AND TC.locationId != ? AND TC.existlocationId = ?' +
                      ' AND TC.accountId =uuid_to_Bin(?) AND TC.errorFlag =0 AND TC.createdBy = uuid_to_bin(?)' +
                      ' GROUP BY TC.locationName HAVING COUNT > 1',
                    QUERY_NUMBER: 8,
                    ERROR: 'DUPLICATE_LOCATION_REFERENCE_IN_THE_FILE',
                    COLUMN_NAME: 'locationName',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'with location  as (SELECT TC.id,TC.locationId,TC.locationName' +
                      ' FROM tempCustomer TC' +
                      ' LEFT JOIN LocationReference LR  ON TC.locationName  = LR.locationName AND TC.locationId = LR.locationId' +
                      ' AND LR.accountId = uuid_to_bin(?)' +
                      ' WHERE ' +
                      ' LR.locationId IS NULL AND LR.locationName IS NULL AND TC.locationName != ? AND TC.locationId != ? AND TC.existlocationId = ?' +
                      ' AND TC.accountId =uuid_to_Bin(?) AND TC.errorFlag =0 AND TC.createdBy = uuid_to_bin(?) )' +
                      ' ' +
                      ' SELECT CAST(uuid_from_bin(L.id) as CHAR) as tempId, L.locationId FROM location L' +
                      ' LEFT JOIN LocationReference LR ON L.locationId = LR.locationId AND LR.accountId = uuid_to_bin(?)' +
                      ' WHERE LR.locationId IS NOT null',
                    QUERY_NUMBER: 9,
                    ERROR: 'LOCATION_REFERENCE_ALREADY_EXIST',
                    COLUMN_NAME: 'locationId',
                    IS_UPDATE: 1
                },
                {
                    QUERY: 'with location  as (SELECT TC.id,TC.locationId,TC.locationName' +
                      ' FROM tempCustomer TC' +
                      ' LEFT JOIN LocationReference LR  ON TC.locationName  = LR.locationName AND TC.locationId = LR.locationId' +
                      ' AND LR.accountId = uuid_to_bin(?)' +
                      ' WHERE ' +
                      ' LR.locationId IS NULL AND LR.locationName IS NULL AND TC.locationName != ? AND TC.locationId != ? AND TC.existlocationId = ?' +
                      ' AND TC.accountId =uuid_to_Bin(?) AND TC.errorFlag =0 AND TC.createdBy = uuid_to_bin(?) )' +
                      ' ' +
                      ' SELECT CAST(uuid_from_bin(L.id) as CHAR) as tempId, L.locationName FROM location L' +
                      ' LEFT JOIN LocationReference LR ON L.locationName = LR.locationName AND LR.accountId = uuid_to_bin(?)' +
                      ' WHERE LR.locationName IS NOT null',
                    QUERY_NUMBER: 10,
                    ERROR: 'LOCATION_REFERENCE_ALREADY_EXIST',
                    COLUMN_NAME: 'locationName',
                    IS_UPDATE: 1
                }
            ],
            LOGICAL_VALIDATION: [],
            UOM_FIELDS: [],
            UPDATE_QUERY: [],
            PRECISION: 0,
            FINAL_QUERY: 'INSERT INTO Customers (' +
              ' id,accountId,email,customerCode,customerName,firstName,lastName,locationId,locationName,companyName,customerId,' +
              ' phone,dialCode,phoneCountry,primaryMobile,primaryMobileDialCode,primaryMobileCountry,' +
              ' secondaryMobile,secondaryMobileDialCode,secondaryMobileCountry,fax,addressLine1,addressLine2,addressLine3,' +
              ' zipCode,country,city,state ,personalMessage,recordType,createdAt,updatedAt,createdBy,updatedBy)' +
              ' (SELECT uuid_to_bin(UUID()),accountId,email,customerCode,customerName,firstName,lastName,locationId,locationName,' +
              ' companyName, companyId,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,personalMessage,recordType,createdAt,updatedAt,createdBy,updatedBy' +
              ' FROM tempCustomer WHERE existLocationId = ? AND locationName !=? AND locationId != ? ' +
              ' AND errorFlag =0   AND accountId = uuid_to_bin(?) AND createdBy = uuid_to_bin(?) )' +
              ' UNION ALL' +
              ' (SELECT uuid_to_bin(UUID()),accountId,email,customerCode,customerName,firstName,lastName,existLocationId ,?,' +
              ' companyName, companyId,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,personalMessage,recordType,createdAt,updatedAt,createdBy,updatedBy' +
              ' FROM tempCustomer WHERE existLocationId != ? AND errorFlag =0  AND accountId = uuid_to_bin(?) ' +
              ' AND createdBy = uuid_to_bin(?))' +
              ' UNION ALL' +
              ' (SELECT uuid_to_bin(UUID()),accountId,email,customerCode,customerName,firstName,lastName,locationId,locationName,' +
              ' companyName, companyId,CONCAT_WS(?,dialCode,phone) AS phone,dialCode,phoneCountry,' +
              ' CONCAT_WS(?,primaryMobileDialCode,primaryMobile) AS primaryMobile,primaryMobileDialCode,primaryMobileCountry,' +
              ' CONCAT_WS(?,secondaryMobileDialCode,secondaryMobile) AS secondaryMobile,secondaryMobileDialCode,secondaryMobileCountry,' +
              ' fax,addressLine1,addressLine2,addressLine3,zipCode,country,city,' +
              ' state ,personalMessage,recordType,createdAt,updatedAt,createdBy,updatedBy' +
              ' FROM tempCustomer WHERE existLocationId = ? AND locationName = ? AND locationId = ? AND errorFlag =0  ' +
              ' AND accountId = uuid_to_bin(?) AND createdBy = uuid_to_bin(?))',
            ADDITIONAL_OPERATION: []
        }
    },


    /*
    * 1 - Empty
    * 2 - Minimum
    * 3 - Maximum
    * */
    VALIDATION_TYPE: [
        1, 2, 3
    ],

    FILE_FORMAT: {
        ORI: {
            FIELDS: {
                1: 'mpId',
                2: 'amazonOrderId',
                3: 'buyerName',
                4: 'buyerEmail',
                5: 'lastUpdateDate',
                6: 'orderTotalCurrencyCode',
                7: 'orderTotalAmount',
                8: 'purchaseDate',
                9: 'fulfillmentChannel',
                10: 'addressLine1',
                11: 'addressLine2',
                12: 'name',
                13: 'countryCode',
                14: 'stateOrRegion',
                15: 'postalCode',
                16: 'city',
                17: 'addressType',
                18: 'numberOfItemsShipped',
                19: 'numberOfItemsUnshipped'
            }

        },
        OLI: {
            FIELDS: {
                1: 'orderItemId',
                2: 'mpId',
                3: 'amazonOrderId',
                4: 'mpProductId',
                5: 'itemPriceAmount',
                6: 'itemPriceCurrencyCode',
                7: 'sellerSKU',
                8: 'quantityOrdered',
                9: 'quantityShipped',
                10: 'shippingPriceAmount',
                11: 'shippingPriceCurrencyCode',
                12: 'title',
                13: 'numberOfItems'
            }
        }
    },

    UPLOAD_FILE_TYPE: {
        ORI: 1,
        OLI: 2,
        PRODUCT: 3,
        PRODUCT_INVENTORY: 4,
        SUPPLY_ITEM: 5,
        SUPPLY_INVENTORY: 6,
        LOCATION_REFERENCE: 7,
        UNIT_OF_MEASURE: 8,
        SUPPLIER: 9,
        CUSTOMER: 10
    },

    SELECT_QUERIES: {
        ORI: {QUERY: 'SELECT COUNT(*) FROM S3Object where _2=\'\'; '},
        OLI: {QUERY: 'SELECT COUNT(*) FROM S3Object where _2=\'\' OR _3=\'\';'}
    },

    NUMBER_START_WITH: {
        1: 'X',
        2: 'XX',
        3: 'XXX',
        4: 'XXXX',
        5: 'XXXXX',
        6: 'XXXXXX',
        7: 'XXXXXXX',
        8: 'XXXXXXXX',
        9: 'XXXXXXXXX'
    },


    TEMPLATES: {
        EN: {
            GENERIC_TEMPLATE: 'GENERIC_TEMPLATE_EN'
        },
        DE: {
            GENERIC_TEMPLATE: 'GENERIC_TEMPLATE_DE'
        }
    },

    BILL_TEMPLATES: {
        EN: {
            GENERIC_TEMPLATE: 'GENERIC_BILL_TEMPLATE_EN'
        },
        DE: {
            GENERIC_TEMPLATE: 'GENERIC_BILL_TEMPLATE_DE'
        }
    },

    EMAIL_TEMPLATES: {
        SIGN_UP: 'signup',
        RESET_PASSWORD_INITIATE: 'resetPasswordInitiate',
        RESET_PASSWORD: 'resetPassword',
        RESET_PASSWORD_NOTIFIER: 'resetPasswordNotifier',
        VERIFY_EMAIL: 'verifyEmail',
        INVITE_SENT: 'invite',
        AUTHORIZED_USER_INVITE: 'authorizeUserInvite',
        DECLINED_USER_INVITE: 'declinedUserInvite',
        INVITE_EXTERNAL_SENT: 'externalInvite',
        ACCEPT_INVITE: 'acceptInvite',
        DECLINED_INVITE: 'declinedInvite',
        CANCEL_USER_INVITE: 'cancelUserInvite',
        DEACTIVATE_AUTHORIZE_USER: 'deactivateAuthorizeUser',
        ACCOUNT_INVITE_USER: 'accountInviteUser',
        SUPPLIER_INVITE: 'supplierInvite',
        CUSTOMER_INVITE: 'customerInvite',
        IN_SHARE_INVITE: 'inShareInvite',
        EXPIRED_INVITE: 'expiredInvite',
        PAUSED_INVITE: 'pausedInvite',
        ACTIVE_INVITE: 'activeInvite',
        DELETE_SUPPLIER: 'deleteSupplier',
        DELETE_CUSTOMER: 'deleteCustomer',
        REMOVE_PARTNER: 'removePartner',
        ADD_SHARE_ITEM: 'addShareItem',
        REMOVE_SHARE_ITEM: 'removeShareItem',
        REMOVE_OUT_SHARE: 'removeOutShare',
        REMOVE_IN_SHARE: 'removeInShare',
        PAUSE_DATA_SHARING: 'pauseDataSharing',
        ACTIVE_DATA_SHARING: 'activeDataSharing',
        STOP_DATA_SHARING: 'stopDataSharing',
        START_DATE_CHANGE: 'startDateChange',
        FREQUENCY_CHANGE: 'frequencyChange',
        CUSTOMER_REMINDER: 'customerReminder',
        IN_SHARE_REMINDER: 'inShareReminder',
        SUPPLIER_REMINDER: 'supplierReminder',
        CUSTOMER_INVITE_CANCEL: 'customerInviteCancel',
        SUPPLIER_INVITE_CANCEL: 'supplierInviteCancel',
        BILLING_PDF: 'billingPDF',
        BILLING_EMAIL: 'billEmail',
        SUPPORT_REQUEST: 'supportRequest',
        SHARING_ALERT: 'sharingAlert'
    },


    GET_USERS: {
        DEFAULT_LIMIT: 10,

        MAX_LIMIT: 100,

        ALLOWED_FILTERS: ['id', 'email', 'firstName', 'lastName', 'verified'],

        VERIFIED_FILTER: 'verified',

        ATTRIBUTES: ['id', 'email', 'firstName', 'middleName', 'lastName', 'dateOfBirth'],

        PARALLEL_SCAN_SEGMENTS: 20

    },

    MEMBER_END_DATE: 32503679999000,

    DEFAULT_REFERE_ID: '00000000-0000-0000-0000-000000000000',

    CUSTOMER_TYPE: {
        DEFAULT: 0
    },

    GET_NOTIFICATIONS: {
        DEFAULT_LIMIT: 50
    },

    USER_STATUS: {
        ACTIVE: 'active',
        INACTIVE: 'inactive',
        TEMPORARY: 'temporary',
        BLOCK: 'block',
        DECLINE: 'decline',
        CLOSED: 'closed'
    },

    AUTHORIZE_USER_STATUS: {
        OPEN: 0,
        ACCEPTED: 1,
        DECLINED: 2,
        CANCELED: 3,
        DEACTIVATED: 4,
        NO_INVITATION: 5
    },

    USER_FLAG: {
        AUTHORIZED_USER_INVITATION: 'authorizedUserInvitation',
        CONTACT_INVITATION: 'contactInvitation',
        SUPPLIER_INVITATION: 'supplierInvitation',
        CUSTOMER_INVITATION: 'customerInvitation'
    },

    PRODUCT_REFERENCE: {
        TYPE: {
            SIMPLE: 'simple'
        }
    },

    SUPPLY_ITEM: {
        TYPE: {
            SIMPLE: 'simple'
        }
    },

    USER_INACTIVE_REASON_CODES: {
        DEFAULT: {
            CODE: 0
        },
        EMAIL_NOT_VERIFIED: {
            CODE: 101
        },
        USER_CANCELLATION: {
            CODE: 102
        },
        USER_BLOCKED: {
            CODE: 103
        },
        TOS_NOT_ACCEPTED: {
            CODE: 104
        },
        PASSWORD_RESET_PROGRESS: {
            CODE: 201
        },
        EMAIL_CHANGE_PROGRESS: {
            CODE: 202
        },
        LOGIN_ATTEMPT_EXCEED: {
            CODE: 203
        },
        SEND_VERIFICATION_CODE_ATTEMPT_EXCEED: {
            CODE: 204
        },
        CONFIRM_VERIFICATION_CODE_ATTEMPT_EXCEED: {
            CODE: 206
        },
        BLOCKED_BY_ADMIN: {
            CODE: 205
        },
        SUBSCRIPTION_ISSUE: {
            CODE: 300
        },
        ADMIN_BLOCKED: {
            CODE: 501
        },
        IS_REFERRAL_USER: {
            CODE: 999
        }
    },

    BLACK_LIST_REASON_CODES: {
        SITES_KNOWN_FOR_DRUGS: {
            CODE: 101
        },
        MILITARY_GOV_DOMAIN: {
            CODE: 102
        },
        BAD_EMAIL: {
            CODE: 102
        }
    },

    USER_INACTIVE_MESSAGES: {
        101: 'Email not verified',
        102: 'User Cancellation',
        103: 'Account Blocked, User Request',
        104: 'Terms of Service not accepted',
        201: 'System-Blocked, Password Reset in progress',
        202: 'System-Blocked, Email Change in progress',
        203: 'System-Blocked, Exceeded Login Attempts',
        300: 'Subscription Issue',
        501: 'Account blocked by the admin',
        999: 'Please complete the signup process to login'
    },

    ACCOUNT_STATUS: {
        TEMPORARY: 'temporary',// when account create at invitation of customer and supplier
        CLOSED: 'closed',
        ACTIVE: 'active'
    },

    ORDER_REPORT_CRON_JOB: {
        Seconds: 0,
        Minutes: '*',
        Hours: '*',
        DayOfMonth: '*',
        Months: '*',
        DayOfWeek: '*'
    },

    IMPORT_ORDERS_CRON_JOB: {
        Seconds: 0,
        Minutes: '*/1',
        Hours: '*',
        DayOfMonth: '*',
        Months: '*',
        DayOfWeek: '*'
    },

    LIST_PRODUCTS_STATUS_CRON_JOB: {
        Seconds: '*/20',
        Minutes: '*',
        Hours: '*',
        DayOfMonth: '*',
        Months: '*',
        DayOfWeek: '*'
    },

    SHARING_DATA_CRON_JOB: {
        Seconds: 0,
        Minutes: '*/2',
        Hours: '*',
        DayOfMonth: '*',
        Months: '*',
        DayOfWeek: '*'
    },

    SHARING_ALERT_CRON_JOB: {
        Seconds: 0,
        Minutes: '*/2',
        Hours: '*',
        DayOfMonth: '*',
        Months: '*',
        DayOfWeek: '*'
    },

    LOAD_CSV_DATA_TO_DB_CRON_JOB: {
        Seconds: '*/30',
        Minutes: '*',
        Hours: '*',
        DayOfMonth: '*',
        Months: '*',
        DayOfWeek: '*'
    },

    BILLING_LINE_ITEM_DAILY_CRON_JOB: {
        Seconds: 0,
        Minutes: '01',
        Hours: '00',
        DayOfMonth: '*',
        Months: '*',
        DayOfWeek: '*'
    },

    BILLING_LINE_ITEM_MONTHLY_CRON_JOB: {
        Seconds: 0,
        Minutes: '10',
        Hours: '00',
        DayOfMonth: '*',
        Months: '*',
        DayOfWeek: '*'
    },

    SHARING_STATUS_MANAGE_CRON_JOB: {
        Seconds: '*/30',
        Minutes: '*',
        Hours: '*',
        DayOfMonth: '*',
        Months: '*',
        DayOfWeek: '*'
    },

    UPDATE_REPLICATION_SETTING_FOR_ORDER_IMPORT: 143,

    IMPORT_ORDERS_CRON_JOB_STATUS: {
        PROGRESSING: 'Progressing',
        FINISH: 'Finish'
    },

    LIST_PRODUCTS_STATUS_CRON_JOB_STATUS: {
        PROGRESSING: 'Progressing',
        FINISH: 'Finish'
    },

    SHARING_DATA_CRON_JOB_STATUS: {
        PROGRESSING: 'Progressing',
        FINISH: 'Finish'
    },

    SHARING_ALERT_CRON_JOB_STATUS: {
        PROGRESSING: 'Progressing',
        FINISH: 'Finish'
    },

    LOAD_CSV_DATA_TO_DB_CRON_JOB_STATUS: {
        PROGRESSING: 'Progressing',
        FINISH: 'Finish'
    },

    BILLING_LINE_ITEM_DAILY_CRON_JOB_STATUS: {
        PROGRESSING: 'Progressing',
        FINISH: 'Finish'
    },

    BILLING_LINE_ITEM_MONTHLY_CRON_JOB_STATUS: {
        PROGRESSING: 'Progressing',
        FINISH: 'Finish'
    },

    SHARING_STATUS_MANAGE_CRON_JOB_STATUS: {
        PROGRESSING: 'Progressing',
        FINISH: 'Finish'
    },

    IMPORT_ORDERS_CRON_JOB_NAME: 'ImportOrdersCronJob',

    LIST_PRODUCTS_STATUS_CRON_JOB_NAME: 'ListProductsStatusCronJob',

    SHARING_DATA_CRON_JOB_NAME: 'SharingDataCronJob',

    SHARING_ALERT_CRON_JOB_NAME: 'SharingAlertCronJob',

    LOAD_CSV_DATA_TO_DB_CRON_JOB_NAME: 'LoadCSVDataToDBCronJob',

    BILLING_LINE_ITEM_DAILY_CRON_JOB_NAME: 'BillingLineItemDailyCronJob',

    BILLING_LINE_ITEM_MONTHLY_CRON_JOB_NAME: 'BillingLineItemMonthlyCronJob',

    SHARING_STATUS_MANAGE_CRON_JOB_NAME: 'SharingStatusManageCronJob',

    SHARING_CRON_JOB: {
        Seconds: 0,
        Minutes: '*/1',
        Hours: '*',
        DayOfMonth: '*',
        Months: '*',
        DayOfWeek: '*'
    },

    REMOVE_DEVICE_ID_CRONJOB: {
        Seconds: 0,
        Minutes: '*/15',
        Hours: '*',
        DayOfMonth: '*',
        Months: '*',
        DayOfWeek: '*'
    },

    CRON_JOB_STATUS: {
        PROGRESSING: 'Progressing',
        FINISH: 'Finish',
        NEW: 'new'
    },

    SHARING_CRON_JOB_NAME: 'SharingCronJob',

    INVITE_STATUS: {
        SENT: '1',
        ACCEPTED: '2',
        DECLINED: '3',
        CANCELLED: '4',
        REMOVED: '5'
    },

    CONTACT_STATUS: {
        NO_INVITATION: 0,
        OPEN: 1,
        ACCEPTED: 2,
        DECLINED: 3,
        IGNORED: 4,
        STOPPED: 5,
        BLOCKED: 6,
        BLOCKED_BY_PARTNER: 7,
        USER_UNAVAILABLE: 8
    },

    CONTACT_INVITATION_NOTIFICATION_ACTION: {
        ACCEPT: 'Accept',
        DECLINE: 'Decline',
        IGNORE: 'Ignore'
    },

    NOTIFICATION_ACTION: {
        ACCEPT: 'Accept',
        DECLINE: 'Decline',
        IGNORE: 'Ignore'
    },

    RESET_PASSWORD_NOTIFY_SMS: {
        EN: 'ScopeHub - Password reset request received. If not done by you, please click here to recover your account',
        DE: 'ScopeHub – Neues Passwort angeforder. Falls nicht von Ihnen initiiert, bitte hier klicken um Ihr ScopeHub Konto zu berichtigen'
    },

    USER_ACTIVE_CODE: 100,

    MB: 'MB',
    DATA_POINTS: 'DP',
    USERS: 'Users',
    USER_TEXT: '(pro-rated, if applicable)',
    TOTAL_SIZE: '-',
    PDF_DESTINATION: '/mnt/db_csv/PDF/',
    CSV_DESTINATION: '/mnt/db_csv/CSV/',
    INVOICE_PREFIX: 'SH - ',

    BILLING_LINE_ITEM: {
        REGISTERD_USER_CHARGES: 1,
        IN_BOUND_DATA_TRANSFER: 2,
        OUT_BOUND_DATA_TRANSFER: 3,
        IN_SHARING_DATA_TRANSFER: 4,
        OUT_SHARING_DATA_TRANSFER: 5
    },

    BILLING_CONTROL_STATUS: {
        COMPLETE: 1,
        NOT_COMPLETE: 0
    },

    BILLING_CYCLE_TYPE: {
        MONTHLY: 1,
        WEEKLY: 2,
        DAILY: 3
    },

    SUB_SCRIPTION_PLANS: {
        FREE_DAILY: 0,
        FREE_MONTHLY: 1,
        PLUS_DAILY: 2,
        PLUS_MONTHLY: 3,
        STANDARD_DAILY: 4,
        STANDARD_MONTHLY: 5,
        ENTERPRISE_DAILY: 6,
        ENTERPRISE_MONTHLY: 7
    },

    DEFAULT_BILLING_SUB_TYPE: 1,

    ACTION_TYPE: {
        SIGNUP: 0,
        SWITCH: 1
    },

    BILLING_CYCLE_STATUS: {
        DE_ACTIVE: 0,
        ACTIVE: 1
    },

    SUBSCRIPTION_PLAN_TYPE: {
        FREE: 0,
        PLUS: 1,
        STANDARD: 2,
        ENTERPRISE: 3
    },

    DEFAULT_FORMAT: '%Y-%m-%d',

    DEFAULT_ENCRYPTION_MODE: 'gcm',

    //POST_REGISTRATION_STEPS_ALL: ['tos', 'email', 'phone', 'securityQuestions'],

    POST_REGISTRATION_STEPS_ALL: ['tos', 'email'],

    POST_REGISTRATION_STEPS_OPTIONAL: ['phone'],

    //POST_REGISTRATION_STEPS: ['tos', 'email', 'securityQuestions'],

    POST_REGISTRATION_STEPS: ['tos', 'email'],

    POST_REG_EMAIL: 'email',

    POST_REG_SECURITY_QUESTION: 'securityQuestions',

    SECURITY_QUESTIONS_LENGTH: 3,

    NOTIFICATION_TEMPLATE: {
        PROFILE_UPDATED: 'PROFILE_UPDATED',
        LANGUAGE_PREFERENCE_UPDATED: 'LANGUAGE_PREFERENCE_UPDATED',
        TOS_ACCEPTED: 'TOS_ACCEPTED',
        SETUP_COMPLETE: 'SETUP_COMPLETE',
        PASSWORD_UPDATED: 'PASSWORD_UPDATED'
    },

    ACCOUNT_ROLES: {
        ADMIN: 'admin',
        EMPLOYEE: 'employee'
    },

    PLATFORMS: {
        mws: 'MWS'
    },

    UPDATE_PHONE_ACTION: {
        UPDATE: 'update',
        ADD: 'add',
        DELETE: 'delete'
    },

    NOTIFICATION_MAX_NO_OF_DAYS: 14,

    DEFAULT_NOTIFICATION_TYPE: 'Info',

    SES_RULE_SET_NAME: 'Seller-Email-Rule-Set',

    SES_RULE_NAME: 'Seller-Email',

    USER_EMAIL_PREFIX: 'us+',

    DEFAULT_DOWNLOAD_LOCATION: '/tmp',

    OUT_SHARE_TYPE: ['productInventory', 'supplyInventory', 'productOrder', 'dependentDemand'],

    OUT_SHARE_INSTANCE_ITEM_TYPE: {
        PRODUCT_INVENTORY: 'productInventory',
        SUPPLY_INVENTORY: 'supplyInventory',
        PRODUCT_ORDER: 'productOrder',
        DEPENDENT_DEMAND: 'dependentDemand'
    },

    DEFAULT_OUT_SHARE_INSTANCE_STATUS: '0',

    OUT_SHARE_FREQ_TYPE: {
        DAILY: 'daily',
        WEEKLY: 'weekly',
        MONTHLY: 'monthly',
        HOURLY: 'hourly',
        EVERY_15_MIN: 'every_15_min',
        REAL_TIME: 'real_time'
    },

    FREQ_MONTHLY: {
        END_OF_MONTH: 'EOM'
    },

    SHARING_DATA_PROTECTION_OPTION: {
        UNENCRYPTED: 0,
        ENCRYPTED_IF_SETUP_BY_PARTNER: 1,
        ENCRYPTED_ONLY: 2,
        ENCRYPTED_AND_SECURED: 3
    },

    SHARING_TYPE: {
        productInventory: 1,
        supplyInventory: 2,
        productOrder: 3,
        dependentDemand: 4
    },

    //SHARED_DATA_ITEMS: [1, 4, 5],

    DEFAULT_LANGUAGE_CULTURE_CODE: 'en-US',

    CUSTOMER_INVITATION_STATUS: {
        NO_INVITATION: 0,
        OPEN: 1,
        ACCEPTED: 2,
        DECLINED: 3,
        USER_UNAVAILABLE: 4
    },

    SUPPLIER_INVITATION_STATUS: {
        NO_INVITATION: 0,
        OPEN: 1,
        ACCEPTED: 2,
        DECLINED: 3,
        USER_UNAVAILABLE: 4
    },

    INVITATION_STATUS: {
        NO_INVITATION: '0',
        OPEN: '1',
        ACCEPTED: '2',
        DECLINED: '3',
        IGNORED: '4'
    },

    ADVANCE_AUTH_NUMBER: ['0', '1', '2'],

    ADVANCED_AUTH_NUMBER: {
        MOBILE_1: '1',
        MOBILE_2: '2',
        DISABLE: '0'
    },

    INVITATION_STATUS_NOTIFICATION_ACTION: {
        ACCEPT: 'Accept',
        DECLINE: 'Decline',
        IGNORE: 'Ignore'
    },

    PARTNER_INVITATION_ACTION: {
        NO_INVITATION: 'No_invitation',
        OPEN: 'Open',
        ACCEPTED: 'Accept',
        DECLINED: 'Decline',
        STOPPED: 'Stopped',
        BLOCKED: 'Blocked',
        BLOCKED_BY_PARTNER: 'Blocked By Partner',
        USER_UNAVAILABLE: 'User Unavailable'
    },

    IN_SHARE_TYPES: {
        DEMAND_SIGNAL: 'Demand Signal',
        OPERATIONAL_SIGNAL: 'Operation Signal',
        SUPPLY_SIGNAL: 'Supply Signal'
    },

    OUT_SHARE_PROFILE_TYPE: {
        PRODUCT_INVENTORY: 'productInventory',
        SUPPLY_INVENTORY: 'supplyInventory',
        PRODUCT_ORDERS: 'productOrder',
        DEPENDENT_DEMAND: 'dependentDemand'
    },

    OUT_SHARE_MISSING_FLAG: {
        ITEM: 1,
        PARTNER: 2
    },

    OUT_SHARE_PROFILE_TYPES: {
        1: 'productInventory',
        2: 'supplyInventory',
        3: 'productOrder',
        4: 'dependentDemand'
    },

    SHARE_ITEM_REFERENCE: {
        PRODUCT: 1,
        SUPPLY: 2
    },

    DEFAULT_CHARACTER: '-',

    /*IN_SHARE_STATUS: {
        NEW: 0,
        ACTIVE: 1,
        DECLINED: 2,
        IGNORE: 3,
        EXPIRED: 4,
        PAUSED: 5,
        PAUSED_BY_OUT_SHARE_PARTNER: 7,
        PAUSED_BY_IN_SHARE: 8,
        STOP: 9
    },*/

    STRING_SEPARATOR: ',,,',

    MINIMUM_CAPTCHA_SCORE: 0.5,

    DOWNLOAD_CSV_TYPE: {
        OUT_SHARE: 1,
        IN_SHARE: 2
    },

    DOWNLOAD_CSV_LOG_STATUS: {
        NEW_ARRIVAL: 0,
        FILE_GENERATE_SUCCESS: 1,
        FILE_GENERATE_FAIL: 2,
        UPLOAD_TO_S3_SUCCESS: 3,
        UPLOAD_TO_S3_FAIL: 4,
        GET_PRE_SIGNED_URL_SUCCESS: 5,
        GET_PRE_SIGNED_URL_FAIL: 6,
        NO_SHARED_DATA_FOUND: 7
    },

    SHARED_CSV_LOG_STATUS: {
        NEW_ARRIVAL: 0,
        FILE_GENERATE_SUCCESS: 1,
        FILE_GENERATE_FAIL: 2,
        UPLOAD_TO_S3_SUCCESS: 3,
        UPLOAD_TO_S3_FAIL: 4
    },


    IN_SHARE_STATUS: {
        NEW: 0,
        ACTIVE: 1,
        DECLINED: 2,
        EXPIRED: 3,
        PAUSED_BY_OUT_SHARE_PARTNER: 4,
        PAUSED_BY_IN_SHARE: 5,
        STOP_BY_OUT_SHARE_PARTNER: 6,
        STOP_BY_IN_SHARE: 7
    },

    IN_SHARE_STATUS_NOTIFICATION_ACTION: {
        NEW: 'New',
        ACCEPTED: 'Accept',
        ACTIVE: 'Active',
        DECLINED: 'Decline',
        EXPIRED: 'Expired',
        PAUSED_BY_OUT_SHARE_PARTNER: 'paused_by_out_share_partner',
        PAUSED_BY_IN_SHARE: 'paused_by_in_share',
        STOP_BY_OUT_SHARE_PARTNER: 'stop_by_out_Share_partner',
        STOP_BY_IN_SHARE: 'stop_by_in_Share'
    },

    /*IN_SHARE_STATUS_NOTIFICATION_ACTION: {
        NEW: 'New',
        ACCEPTED: 'Accept',
        DECLINED: 'Decline',
        IGNORE: 'Ignore',
        EXPIRED: 'Expired',
        PAUSED: 'Paused',
        ACTIVE: 'Active',
        PAUSED_BY_OUT_SHARE_PARTNER: 'paused_by_out_share_partner',
        PAUSED_BY_IN_SHARE: 'paused_by_in_share',
        STOP: 'Stop'
    },*/

    OUT_SHARE_STATUS_ACTION: {
        NO_INVITATION_SENT: 0,
        INVITATION_SENDING: 1,
        INVITATION_SENT: 2,
        ACTIVE: 3,
        EXPIRED: 4,
        PAUSED: 5
    },

    OUT_SHARE_STATUS: {
        NO_INVITATION_SENT: 0,
        INVITATION_SENDING: 1,
        INVITATION_SENT: 2,
        ACTIVE: 3,
        EXPIRED: 4,
        PAUSED: 5,
        STOP: 6
    },

    OUT_SHARE_START_DATE: {
        ASAP: 1,
        ASAP_AFTER: 2,
        PAUSE: 3
    },

    STATUS: {
        DEACTIVE: 0,
        ACTIVE: 1
    },

    PRODUCT_INVENTORY_STATUS: {
        IN_ACTIVE: 0,
        ACTIVE: 1
    },

    SUPPLY_INVENTORY_STATUS: {
        IN_ACTIVE: 0,
        ACTIVE: 1
    },

    SUPPLY_ITEM_STATUS: {
        IN_ACTIVE: 0,
        ACTIVE: 1
    },

    PRODUCT_STATUS: {
        IN_ACTIVE: 0,
        ACTIVE: 1
    },

    OUT_SHARE_START_DATE_TYPE: {
        ASAP: 'asap',
        ASAP_AFTER: 'asapAfter',
        PAUSE: 'pause'
    },

    OUT_SHARE_PARTNER_STATUS: {
        PROCESSING: 0,
        OK: 1,
        FAIL: 2,
        DECLINED: 3,
        EXPIRED: 4
    },

    PARTNER_TYPES: {
        CUSTOMER: 'customer',
        SUPPLIER: 'supplier'
    },

    ARCHIVE_TYPES: {
        PRODUCT_INVENTORY: 'productInventory',
        SUPPLY_INVENTORY: 'supplyInventory',
        PRODUCT_ORDER: 'productOrder',
        SUPPLY_ITEM: 'supplyItems',
        CUSTOMERS: 'customers',
        SUPPLIER: 'supplier'
    },

    SHARING_LOG_REASON_CODE: {
        ADD_PARTNER: 101,
        REMOVE_PARTNER: 102,
        ADD_SHARE_ITEM: 103,
        REMOVE_SHARE_ITEM: 104,
        SHARING_STOP_BY_OUT_SHARE_PARTNER: 105,
        SHARING_STOP_BY_IN_SHARE_PARTNER: 106,
        SHARING_PAUSE_BY_OUT_SHARE_PARTNER: 107,
        SHARING_PAUSE_BY_IN_SHARE_PARTNER: 108,
        SHARING_ACTIVE_BY_OUT_SHARE_PARTNER: 109,
        SHARING_ACTIVE_BY_IN_SHARE_PARTNER: 110,
        SHARING_FREQUENCY_CHANGE: 111,
        SHARED_DATA_ITEMS_CHANGE: 112,
        START_DATE_SETTING_CHANGE: 113
    },

    DATA_DELIVERY_OPTION: {
        ONLINE_ONLY: 1,
        FILES_ONLY: 2,
        ONLINE_AND_FILES: 3
    },

    NOTIFY_FLAG: {
        NOTIFICATION_ONLY: 0,
        EMAIL_ONLY: 1,
        NOTIFICATION_AND_EMAIL: 2
    },

    DEFAULT_DATE: 0,

    DATA_SHARE_REMINDER_DAY: 15,

    DATA_SHARE_EXPIRED_DAY: 30,

    MAX_OUT_SHARE_INSTANCE_SUBSCRIBERS: 10,

    MAX_OUT_SHARE_SHARE_ITEM_IDS: 10,

    OUT_SHARE_INSTANCE_PARTNER_TYPE: {
        SUPPLIER: 'Supplier',
        CUSTOMER: 'Customer'
    },

    AM_PM_FORMATE: {
        AM: 'am',
        PM: 'pm'
    },

    LATITUDE: {
        MAX: 90,
        MIN: -90
    },

    LONGITUDE: {
        MAX: 180,
        MIN: -180
    },

    CHAT_BUCKET_FOLDER: {
        IMAGES: 'images',
        CSV: 'csv'
    },

    ORDER_ITEM_RECORD_TYPE: {
        MANUAL: 1,
        REPLICATION: 2
    },

    MAX_SUPPLY_ITEM_QANTITY: 4293.999999,

    MAX_SUPPLY_ITEM_PRECISION: 6,

    MAX_PRECISION: 16,

    ORDER_ITEM_PRECESION: 8,

    NOTIFICATION_REFERE_TYPE: {
        CONTACT: 'CONTACT',
        SUPPLIER: 'SUPPLIER',
        CUSTOMER: 'CUSTOMER',
        IN_SHARE: 'IN_SHARE',
        AUTH_USER: 'AUTH_USER',
        UPLOAD_FILE: 'UPLOAD_FILE',
        REPLICATION: 'REPLICATION',
        OUT_SHARE: 'OUT_SHARE',
        PRODUCT_INVENTORY_SHARING_ALERT: 'PRODUCT_INVENTORY_SHARING_ALERT',
        SUPLLY_INVENTORY_SHARING_ALERT: 'SUPLLY_INVENTORY_SHARING_ALERT',
        PRODUCT_ORDER_SHARING_ALERT: 'PRODUCT_ORDER_SHARING_ALERT',
        DEPENDENT_DEMAND_SHARING_ALERT: 'DEPENDENT_DEMAND_SHARING_ALERT'
    },

    //FOR CHILD TABLE
    OUT_SHARES_PARTNER_STATUS: {
        ACTIVE: 1,
        DEACTIVE: 2
    },

    SHARING_ALERT_RECEPIENT_TYPE: {
        USERS: 1,
        CONTACTS: 2,
        GROUPS: 3
    },

    PARTNER_TYPE: {
        CUSTOMER: '1',
        SUPPLIER: '2'
    },

    CHAT_ENCRYPTION_STATUS: {
        UNENCRYPTED: 0,
        ENCRYPTED: 1
    },

    MESSAGE_READ_STATUS: {
        UNREAD: 0,
        READ: 1
    },

    CHAT_CONTACT_STATUS: {
        CONTACT_EXISTS: 0,
        CONTACT_DELETED: 1
    },

    CHAT_STATUS: {
        OFFLINE: 0,
        ONLINE: 1
    },

    CHAT_MESSAGE_LIMIT: 30,

    CHAT_PARTNER_LIMIT: 10,

    LOOP: 2,

    DEFAULT_TIMESTAMP: '1970-01-01T00:00:00.001Z',

    DEFAULT_SHARING_TIMESTAMP: 0,

    OUT_SHARE_INSTANCE_CREATE_RETRY_LIMIT: 3,

    FRQ_DAYS: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],

    RE_CAPTCHA_FLAG: {
        SIGNUP: 1,
        RESET_PASSWORD: 2,
        CONTACT_REQUEST: 3
    },

    RE_CAPTCHA_STATUS: {
        OK: 0,
        FAILED: 1
    },

    RE_CAPTCHA_REASON_CODE: 110,

    init: function () {
        this.URL_TYPES = {
            SYSTEM: {
                endpoint: 'https://' + AwsConfig.s3Endpoint
            },
            USER: {
                endpoint: EndpointConfig.API_ENDPOINT,
                label: 'USER'
            }
        };
        return this;
    },

    CSV_UNENCRYPTED_SHARED_DATA_FIELDS: {
        PRODUCT_INVENTORY: ['sku', 'sellerSKUName', 'qtyOnHand', 'qtyOnHandUOMSymbol', 'qtyOnHandUOMName', 'qtyOnHandUoMScalingFactor',
            'qtyOnOrder', 'qtyOnOrderUOMSymbol', 'qtyOnOrderUOMName', 'qtyOnOrderUoMScalingFactor',
            'qtyAvailable', 'qtyAvailableUOMSymbol', 'qtyAvailableUOMName', 'qtyAvailableUoMScalingFactor',
            'effectiveSharedDateTime', 'defaultUOMSymbol', 'defaultUOMName', 'defaultUoMScalingFactor'],
        SUPPLY_INVENTORY: ['sku', 'sellerSKUName', 'qtyOnHand', 'qtyOnHandUOMSymbol', 'qtyOnHandUOMName', 'qtyOnHandUoMScalingFactor',
            'qtyInTransit', 'qtyInTransitUOMSymbol', 'qtyInTransitUOMName', 'qtyInTransitUoMScalingFactor',
            'qtyOnOrder', 'qtyOnOrderUOMSymbol', 'qtyOnOrderUOMName', 'qtyOnOrderUoMScalingFactor',
            'effectiveSharedDateTime', 'defaultUOMSymbol', 'defaultUOMName', 'defaultUoMScalingFactor'],
        PRODUCT_ORDER: ['sku', 'sellerSKUName', 'quantityOrdered', 'quantityOrderedUoMSymbol', 'quantityOrderedUoMName', 'quantityOrderedUoMScalingFactor',
            'orderId', 'orderTime', 'effectiveSharedDateTime', 'defaultUOMSymbol', 'defaultUOMName', 'defaultUoMScalingFactor'],
        DEPENDENT_DEMAND: ['productRefSKU', 'productRefSellerSKUName', 'supplyItemSKU', 'supplyItemSellerSKUName', 'quantityOrdered', 'quantityOrderedUoMSymbol', 'quantityOrderedUoMName', 'quantityOrderedUoMScalingFactor',
            'orderId', 'orderTime', 'effectiveSharedDateTime', 'defaultUOMSymbol', 'defaultUOMName', 'defaultUoMScalingFactor']
    },

    CSV_ENCRYPTED_SHARED_DATA_FIELDS: {
        PRODUCT_INVENTORY: ['sku', 'sellerSKUName', 'data'],
        SUPPLY_INVENTORY: ['sku', 'sellerSKUName', 'data'],
        PRODUCT_ORDER: ['sku', 'sellerSKUName', 'data'],
        DEPENDENT_DEMAND: ['productRefSKU', 'productRefSellerSKUName', 'supplyItemSKU', 'supplyItemSellerSKUName', 'data']
    },

    SHARED_DATA_FIELDS: {
        PRODUCT_INVENTORY: ['qtyOnHand', 'qtyOnHandUOMSymbol', 'qtyOnHandUOMName', 'qtyOnHandUoMScalingFactor',
            'qtyOnOrder', 'qtyOnOrderUOMSymbol', 'qtyOnOrderUOMName', 'qtyOnOrderUoMScalingFactor',
            'qtyAvailable', 'qtyAvailableUOMSymbol', 'qtyAvailableUOMName', 'qtyAvailableUoMScalingFactor',
            'effectiveSharedDateTime', 'defaultUOMSymbol', 'defaultUOMName', 'defaultUoMScalingFactor'],
        SUPPLY_INVENTORY: ['qtyOnHand', 'qtyOnHandUOMSymbol', 'qtyOnHandUOMName', 'qtyOnHandUoMScalingFactor',
            'qtyInTransit', 'qtyInTransitUOMSymbol', 'qtyInTransitUOMName', 'qtyInTransitUoMScalingFactor',
            'qtyOnOrder', 'qtyOnOrderUOMSymbol', 'qtyOnOrderUOMName', 'qtyOnOrderUoMScalingFactor',
            'effectiveSharedDateTime', 'defaultUOMSymbol', 'defaultUOMName', 'defaultUoMScalingFactor'],
        PRODUCT_ORDER: ['quantityOrdered', 'quantityOrderedUoMSymbol', 'quantityOrderedUoMName', 'quantityOrderedUoMScalingFactor',
            'orderId', 'orderTime', 'effectiveSharedDateTime', 'defaultUOMSymbol', 'defaultUOMName', 'defaultUoMScalingFactor'],
        DEPENDENT_DEMAND: ['quantityOrdered', 'quantityOrderedUoMSymbol', 'quantityOrderedUoMName', 'quantityOrderedUoMScalingFactor',
            'orderId', 'orderTime', 'effectiveSharedDateTime', 'defaultUOMSymbol', 'defaultUOMName', 'defaultUoMScalingFactor']
    },

    DEPENDENT_DEMAND_STATUS: {
        ACTIVE: 1,
        IN_ACTIVE: 0
    },

    ALERT_TYPES: {
        REGULAR: 1,
        REAL_TIME: 2
    },

    ALERT_AVERAGE_TYPE: {
        MOVING: 1,
        ABSOLUTE: 2
    },
    ALERT_FREQUENCY_TYPE: {
        EVERY_24_HOUR: 1,
        EVERY_18_HOUR: 2,
        EVERY_12_HOUR: 3,
        EVERY_6_HOUR: 4,
        EVERY_3_HOUR: 5,
        EVERY_1_HOUR: 6
    },
    ALERT_STATUS: {
        ACTIVE: 1,
        IN_ACTIVE: 0
    },
    SHARED_DATA_ITEMS: {
        QTY_ON_HAND: 1,
        QTY_IN_TRANSIT: 2,
        ORDER_QUANTITY: 3,
        QTY_ON_ORDER: 4,
        QTY_AVAILABLE: 5,
        ORDER_ID: 6,
        ORDER_TIME: 7
    },
    ALERT_RECIPIENT_STATUS: {
        ACTIVE: 1,
        IN_ACTIVE: 2
    },

    ALERT_RECIPIENT_TYPE: {
        USERS: 1,
        CONTACTS: 2,
        GROUPS: 3
    },

    RAISED_ALERT_READ_STATUS: {
        UN_READ: 0,
        READ: 1
    },

    GROUP_STATUS: {
        ACTIVE: 1,
        IN_ACTIVE: 0
    },

    GROUP_MEMBER_STATUS: {
        ACTIVE: 1,
        IN_ACTIVE: 0
    },

    DEFAULT_ALERT_NOTIFICATION_SETTING: {
        notification: 1,
        email: 1,
        sms: 1
    },

    ALERT_OPERATION_TYPE: {
        LESS_THAN: 1,
        GREATER_THAN: 2
    },

    NOTIFICATION_CATEGORY_TYPE: {
        SHARING_ALERTS: 1,
        SHARING: 2,
        PARTNERS: 3,
        CONTACTS: 4,
        AUTH_USER: 5,
        WARNING: 6
    },

    MAP_ITEM_TYPES: {
        PRODUCTS: 1,
        SUPPLY_ITEM: 2,
    },

    SHARE_ITEM_MAP_STATUS: {
        ACTIVE: 1,
        IN_ACTIVE: 0
    },

    SCOPEHUB_DEFAULT_DB: 'ScopehubAppDB',

    DEFAULT_CONNECTION_SETTING: {
        CONNECTION_LIMIT: 10,
        PERMIT_LOCAL_INFILE: true,
        CONNECT_TIMEOUT: 60000,
        COMPRESS: true,
        INTERACTIVE_CLIENT: true
    },

    REFERENCE_TABLES: ['MarketPlaces', 'Roles', 'CountryReference', 'DSIbyType', 'DSIreference', 'emailTemplate', 'ErrorReference', 'NotificationReference', 'PlanReference'],

    CONDITIONAL_REFERENCE_TABLE: ['BillingRates', 'uomCategory', 'uomScaling', 'uomNames', 'Views', 'ViewColumns'],

    USER_RELATED_TABLE: ['users', 'accounts', 'user_roles', 'userPreferences', 'AccountPlans'],
    //USER_RELATED_TABLE: ['users', 'accounts', 'user_roles', 'userPreferences', 'AccountPlans'],
    SAMPLE_USERS: '\'shorgkn@gmail.com\', \'shorgn@gmail.com\', \'shorgzp@gmail.com\', \'shorgps@gmail.com\', \'shorgf@gmail.com\', \'shorgks@gmail.com\', \'shorgv@gmail.com\'',

    DEFAULT_NOTIFICATION_SETTINGS: [
        {
            type: 1,
            flag: {
                sms: 1,
                notification: 1,
                email: 1
            }
        },
        {
            type: 2,
            flag: {
                notification: 1,
                email: 1
            }
        },
        {
            type: 3,
            flag: {
                notification: 1,
                email: 1
            }
        },
        {
            type: 4,
            flag: {
                notification: 1,
                email: 1
            }
        },
        {
            type: 5,
            flag: {
                notification: 1,
                email: 1
            }
        },
        {
            type: 6,
            flag: {
                productUoMFlag: 1,
                uploadTabFlag: 1,
                notificationFlag: 1,
                /*products: 1,
                productInventory: 1,
                supplyItems: 1,
                supplyInventory: 1,
                suppliers: 1,
                customers: 1,
                locations: 1*/
            }
        }
    ],

    DB_FUNCTION_CREATE_FILE: 'dbscript_function.sql',

    DB_SCRIPT_DESTIANATION: '/mnt/db_csv/database_scripts',


    FIELDS: {
        USERS: ['id', 'accountId', 'firstName', 'middleName', 'lastName', 'email', 'dateOfBirth', 'password', 'confirmPassword', 'remember',
            'g-recaptcha-response', 'securityQuestion1', 'securityQuestion2', 'securityQuestion3', 'securityAnswer1', 'securityAnswer2', 'securityAnswer3', 'phone',
            'addressLine1', 'addressLine2', 'addressLine3', 'languageCultureCode', 'status', 'statusReasonCode', 'postRegComplete',
            'authorizeUserInvitationDate', 'tosUtcDateTime', 'tosStatus', 'tosLocalDeviceDateTime', 'emailUtcDateTime', 'emailStatus',
            'emailLocalDeviceDateTime', 'secondaryMobile', 'secondaryMobileCountry', 'secondaryMobileLocalDeviceDateTime',
            'secondaryMobileUtcDateTime', 'secondaryMobileDialCode', 'secondaryMobileStatus', 'secondaryMobilePhoneEndingWith',
            'primaryMobile', 'primaryMobileCountry', 'primaryMobileLocalDeviceDateTime', 'primaryMobileUtcDateTime', 'primaryMobileDialCode',
            'primaryMobileStatus', 'primaryMobilePhoneEndingWith', 'useForTwoFactor', 'flag', 'authorizeUserStatus', 'userRememberToken',
            'userRememberDeviceToken', 'securityQuestionStatus', 'securityQuestionUtcDateTime', 'securityQuestionLocalDeviceDateTime',
            'city', 'zipCode', 'state', 'country', 'isAccountActive', 'isAccountEnabled', 'updatedAt', 'roles', 'oldRoles', 'addRoles', 'removeRoles',
            'lastResetPasswordDeviceTime', 'mode', 'code', 'deviceDateTime', 'currentEmail', 'skipStatusCheck', 'skipEmailCheck', 'phone', 'fromLogin',
            'verificationOption', 'questions', 'dialCode', 'phoneCountry', 'action', 'newEmail', 'userId', 'resetPasswordDeviceTime', 'newLocationId', 'newLocationName',
            'locationId', 'locationName', 'saveAsLater', 'useExisting', 'confirmEmail', 'advancedAuthNumber', 'isPrimary', 'sendToAAN', 'currentPassword',
            'newPassword', 'apiToken', 'uploadTabFlag', 'notifyFlag', 'productUoMFlag', 'profilePicture', 'accountName', 'accountDescription',
            'navBarViewFlag', 'menuFlag', 'sharingAlertFlag', 'notifications', 'userEmail', 'authUserEmail'],


        PRODUCT_REFERENCES: ['id', 'accountId', 'sku', 'sellerSKUName', 'GCID', 'UPC', 'EAN', 'ISBN', 'JAN', 'articleNo', 'modelNumber', 'type',
            'countryOfManufacture', 'barcode', 'skuAlias', 'brand', 'harmonizedCode', 'mpProductId', 'weightAmount', 'weightUoMScal',
            'heightAmount', 'heightUoMScal', 'lengthAmount', 'lengthUoMScal', 'depthAmount', 'depthUoMScal', 'diameterAmount', 'diameterUoMScal',
            'volumeAmount', 'volumeUoMScal', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt', 'endCustomerProduct', 'classificationSystem',
            'classificationCode', 'tags', 'qtyUoMId', 'qtyUoMCategory', 'products', 'inventoryCount'],

        UNIT_OF_MEASURE_CATEGORY: ['categoryId', 'languageCultureCode', 'accountId', 'name', 'comment', 'updatedAt'],

        UNIT_OF_MEASURES: ['categoryId', 'id', 'name', 'symbol', 'scalingPrecision', 'scalingFactor', 'comment', 'updatedAt', 'languageCultureCode'],


        MARKETPLACES: ['id', 'name', 'region', 'mpLink', 'mpId', 'active', 'imageURL', 'updatedAt', 'countryCode', 'currencyCode', 'primaryTimeZone'],

        COUNTRY_REF: ['id', 'countryCode', 'countryName', 'currencyCode', 'currencyName', 'languageCulturalCode', 'updatedAt'],

        ACCOUNTS: ['companyName', 'addressLine1', 'addressLine2', 'addressLine3', 'city', 'zipCode', 'state', 'country', 'phone', 'dialCode', 'phoneCountry',
            'fax', 'primaryMobile', 'primaryMobileDialCode', 'primaryMobileCountry', 'secondaryMobile', 'secondaryMobileDialCode', 'secondaryMobileCountry',
            'email', 'active', 'apiGetewayAuthToken', 'statusReasonCode', 'status', 'updatedAt', 'locationId', 'locationName', 'locationRefUpdatedAt', 'accountUpdatedAt',
            'publicKey', 'privateKey', 'encryptionStatus', 'addKeys', 'saveAsLater', 'useExisting', 'newLocationId', 'newLocationName', 'accountName', 'accountDescription'],


        ACCOUNT_MARKETPLACES: ['mpId', 'accountId', 'sellerId', 'token', 'updatedAt', 'status', 'accessCredentials'],


        LOCATION_REFERENCE: ['id', 'locationId', 'locationCode', 'locationName', 'companyName', 'contactFirstName', 'contactLastName',
            'email', 'phone', 'dialCode', 'phoneCountry', 'primaryMobile', 'primaryMobileDialCode', 'primaryMobileCountry', 'secondaryMobile', 'secondaryMobileDialCode', 'secondaryMobileCountry',
            'extension', 'fax', 'addressLine1', 'addressLine2', 'addressLine2', 'addressLine3', 'city', 'zipCode', 'state', 'country', 'latitude', 'longitude', 'googleLink', 'comment', 'updatedAt', 'locationIds',
            'additionalLocationCode', 'additionalLocationName', 'googleLocationId', 'googleLocationName', 'googleFormattedAddress'],


        PRODUCT_BY_MP: ['id', 'mpId', 'accountId', 'productRefId', 'sku', 'mpCategoryId1', 'mpCategoryId2', 'mpCategoryId3', 'mpRank1',
            'mpRank2', 'mpRank3', 'averageRetailPrice', 'averageCost', 'wholesalePrice', 'declaredValue', 'retailPriceUoM', 'costUoM',
            'wholesalePriceUoM', 'declaredValueUoM', 'supplierAccountId', 'supplierProductId', 'supplierSKU', 'supplierSKUName',
            'supplierProductBarcode', 'imageUrl', 'imageHeight', 'imageHeightUoM', 'imageWidth', 'imageWidthUoM', 'productTitle',
            'packageQuantity', 'description', 'postSubmitfeedRequestId', 'quantitySubmitfeedRequestId', 'priceSubmitfeedRequestId',
            'updatedAt', 'mpProductId', 'conditionType', 'product'],


        PRODUCT_INVENTORY: ['id', 'accountId', 'locationId', 'SKU', 'type', 'qtyOnHand', 'qtyOnOrder', 'qtyAvailable', 'qtyInTransit', 'notes', 'qtyUOM',
            'weightAmount', 'weightUoMScal', 'heightAmount', 'heightUoMScal', 'lengthAmount', 'lengthUoMScal', 'depthAmount', 'depthUoMScal',
            'diameterAmount', 'diameterUoMScal', 'volumeAmount', 'volumeUoMScal', 'updatedAt', 'saveAsLater', 'useExisting', 'newLocationId',
            'newLocationName', 'qtyOnHandUOM', 'qtyOnOrderUOM', 'qtyAvailableUOM', 'qtyInTransitUOM', 'isRealTimeFrequency'],

        SUPPLY_INVENTORY: ['id', 'accountId', 'locationId', 'SKU', 'type', 'qtyOnHand', 'qtyOnOrder', 'qtyAvailable', 'qtyInTransit', 'notes', 'qtyUOM',
            'weightAmount', 'weightUoMScal', 'heightAmount', 'heightUoMScal', 'lengthAmount', 'lengthUoMScal', 'depthAmount', 'depthUoMScal',
            'diameterAmount', 'diameterUoMScal', 'volumeAmount', 'volumeUoMScal', 'updatedAt', 'saveAsLater', 'useExisting', 'newLocationId',
            'newLocationName', 'qtyOnHandUOM', 'qtyOnOrderUOM', 'qtyAvailableUOM', 'qtyInTransitUOM', 'isRealTimeFrequency'],


        CONTACT: ['contactId', 'inviterUUID', 'firstName', 'lastName', 'nickName', 'company', 'fax', 'phone', 'dialCode', 'phoneCountry', 'primaryMobile',
            'primaryMobileCountry', 'primaryMobileDialCode', 'secondaryMobile', 'secondaryMobileCountry', 'secondaryMobileDialCode', 'notes', 'personalMessage',
            'email', 'contactIds', 'inviteeUUID', 'invitationUTCTime', 'actionUTCTime', 'status', 'invitationExpirationDate', 'inviteeEmail', 'isActive',
            'updatedAt', 'createdAt', 'createdBy', 'updatedBy'],

        USER_DEVICE_MAPPING: ['deviceId', 'timestamp'],

        NOTIFICATIONS: ['notificationId', 'notificationIds', 'action', 'updatedAt', 'time'],

        CUSTOMERS: ['id', 'personalMessage', 'newLocationId', 'newLocationName', 'locationName', 'useExisting', 'saveAsLater',
            'customerId', 'customerName', 'locationId', 'customerAccountId', 'firstName', 'lastName', 'companyName', 'email',
            'customerCode', 'phone', 'fax', 'recordType', 'updatedAt', 'addressLine1', 'addressLine2', 'addressLine3', 'zipCode',
            'state', 'country', 'city', 'googleLink', 'dialCode', 'phoneCountry', 'primaryMobile', 'primaryMobileCountry', 'primaryMobileDialCode',
            'secondaryMobile', 'secondaryMobileCountry', 'secondaryMobileDialCode'],

        SUPPLIER: ['id', 'personalMessage', 'supplierId', 'supplierName', 'locationId', 'locationName', 'supplierAccountId',
            'firstName', 'lastName', 'companyName', 'email', 'supplierCode', 'phone', 'fax', 'locationId', 'updatedAt', 'status',
            'useExisting', 'saveAsLater', 'newLocationId', 'newLocationName', 'addressLine1', 'addressLine2', 'addressLine3',
            'zipCode', 'state', 'country', 'city', 'googleLink', 'dialCode', 'phoneCountry', 'primaryMobile', 'primaryMobileCountry',
            'primaryMobileDialCode', 'secondaryMobile', 'secondaryMobileCountry', 'secondaryMobileDialCode'],

        ORDERS: ['frequency', 'mpId', 'platform', 'startDate', 'createdAfter', 'updatedAt', 'numberOfRecords', 'id', 'isDisable',
            'orderId', 'orderDeliveryDate', 'buyerName', 'items', 'marketplaceId', 'sku', 'skuName', 'orderLocation', 'quantityOrdered'],

        SUPPLY_ITEMS: ['id', 'accountId', 'sku', 'sellerSKUName', 'GCID', 'UPC', 'EAN', 'ISBN', 'JAN', 'articleNo', 'modelNumber', 'type',
            'countryOfManufacture', 'barcode', 'skuAlias', 'brand', 'harmonizedCode', 'mpProductId', 'weightAmount', 'weightUoMScal',
            'heightAmount', 'heightUoMScal', 'lengthAmount', 'lengthUoMScal', 'depthAmount', 'depthUoMScal', 'diameterAmount', 'diameterUoMScal',
            'volumeAmount', 'volumeUoMScal', 'createdBy', 'updatedBy', 'createdAt', 'updatedAt', 'endCustomerProduct', 'classificationSystem',
            'classificationCode', 'tags', 'qtyUoMId', 'qtyUoMCategory', 'products'],

        BILL_OF_MATERIAL: ['productRefId', 'supplyItemId', 'quantity', 'supplyItemUpdatedAt', 'qtyUOM', 'updatedAt', 'accountId'],

        DEPENDENT_DEMAND: ['accountId', 'productRefId', 'supplyItemId', 'dependentDemandId', 'dependentDemandName', 'status', 'updatedAt'],

        OUT_SHARING: ['id', 'accounts', 'accountId', 'profileId', 'shareItemType', 'sharedDataItems', 'freqType', 'freqTime', 'freqDay', 'notes',
            'noOfDays', 'shareItemIds', 'sharingProfileId', 'status', 'outShareId', 'outShareIds', 'outShareName', 'startDate',
            'startDateType', 'updatedAt', 'offeredStartDate', 'newProfileId', 'newProfileName', 'useExisting', 'dataProtectionOption', 'saveAsLater', 'outSharingInstanceIds', 'partenrAccountIds',
            'addSharePartners', 'removeSharePartners', 'addShareItems', 'removeShareItems', 'supplyItemId'],

        IN_SHARE: ['id', 'inShareId', 'action', 'inShareName', 'notes', 'status', 'updatedAt'],

        IN_SHARE_ALERT: ['id', 'accountId', 'alertId', 'alertName', 'inShareId', 'shareItemId', 'shareItemType', 'sharedDataItem',
            'alertType', 'averageType', 'averageValue', 'frequencyType', 'checkTime', 'startDate', 'nextAlertDate', 'recipients',
            'operationType', 'updatedAt'],

        BLACK_LIST: ['inviteeUUID', 'inviterEmailDomain', 'email', 'domain', 'subDomain', 'reasonCode', 'restrictionType', 'notes'],

        VIEW: ['name', 'columns', 'type', 'fromFilterDate', 'toFilterDate', 'sortColumn', 'sortOrder', 'id', 'updatedAt', 'isRecentViewUpdate'],

        CHAT: ['id', 'senderId', 'receiverId', 'contactId', 'message', 'encryptionOption', 'createdAt', 'updatedAt', 'createdBy',
            'receiverIds', 'groupId', 'isTyping', 'userIds', 'fileName', 'fileSize', 'imageString', 'url', 'tempId', 'members', 'type']

    }


};

Constants.init();

module.exports = Constants;

