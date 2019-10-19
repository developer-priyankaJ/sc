#!/usr/bin/env node
'use strict';

var express = require('express');
var router = express.Router();
var userRoute = require('./UserRoute');
var authUserRoute = require('./AuthUserRoute');
var roleRoute = require('./RoleRoute');
var rolesRoute = require('./RolesRoute');
var marketplaceRoute = require('./MarketplaceRoute');
var marketplacesRoute = require('./MarketplacesRoute');
var accountMarketplaceRoute = require('./AccountMarketplaceRoute');
var accountMarketplacesRoute = require('./AccountMarketplacesRoute');
var countryReferenceRoute = require('./CountryReferenceRoute');
var countryReferencesRoute = require('./CountryReferencesRoute');
var productReferenceRoute = require('./ProductReferenceRoute');
var productReferencesRoute = require('./ProductReferencesRoute');
var ProductByMpRoute = require('./ProductByMpRoute');
var OnboardRoute = require('./OnboardRoute');
var CustomerRoute = require('./CustomerRoute');
var CustomersRoute = require('./CustomersRoute');
var SupplierRoute = require('./SupplierRoute');
var SuppliersRoute = require('./SuppliersRoute');
var BlackListRoute = require('./BlackListRoute');
var OutShareRoute = require('./OutShareRoute');
var InShareRoute = require('./InShareRoute');
var accountRoute = require('./AccountRoute');
var locationReference = require('./LocationReferenceRoute');
var locationReferences = require('./LocationReferencesRoute');
var errorReferences = require('./ErrorReferencesRoute');
var productInventory = require('./ProductInventoryRoute');
var productInventories = require('./ProductInventoriesRoute');
var billOfMaterials = require('./BillOfMaterialsRoute');
var supplyItem = require('./SupplyItemRoute');
var supplyItems = require('./SupplyItemsRoute');
var orderReferenceInformation = require('./OrderReferenceInformationRoute');
var orderReferenceInformations = require('./OrderReferenceInformationsRoute');
var orderLineItem = require('./OrderLineItemRoute');
var orderLineItems = require('./OrderLineItemsRoute');
var uploadFile = require('./UploadFileRoute');
var contact = require('./ContactRoute');
var contacts = require('./ContactsRoute');
var notificationReferences = require('./NotificationReferencesRoute');
var notificationReference = require('./NotificationReferenceRoute');
var notification = require('./NotificationRoute');
var notifications = require('./NotificationsRoute');
var unitOfMeasureCategory = require('./UnitOfMeasureCategoryRoute');
var unitOfMeasure = require('./UnitOfMeasureRoute');
var unitOfMeasures = require('./UnitOfMeasuresRoute');
var ViewRoute = require('./ViewRoute');
var SupplyInventory = require('./SupplyInventoryRoute');
var SupplyInventories = require('./SupplyInventoriesRoute');
var ChatRoute = require('./ChatRoute');
var BillingRoute = require('./BillingRoute');
var groupChat = require('./chatGroupRoute');
var PlanRoute = require('./PlanRoute');
var download = require('./downloadRoute');
var ContactRequestRoute = require('./ContactRequestRoute');
var DependentDemandRoute = require('./DependentDemandRoute');
var DatabaseSwitchRoute = require('./DatabaseSwitchRoute');

// User Route
router.use('/user', userRoute);

router.use('/authorized-user', authUserRoute);

router.use('/role', roleRoute);

router.use('/roles', rolesRoute);

router.use('/marketplace', marketplaceRoute);

router.use('/marketplaces', marketplacesRoute);

router.use('/account/marketplace', accountMarketplaceRoute);

router.use('/account/marketplaces', accountMarketplacesRoute);

router.use('/country/reference', countryReferenceRoute);

router.use('/country/references', countryReferencesRoute);

router.use('/product/reference', productReferenceRoute);

router.use('/products/references', productReferencesRoute);

router.use('/product', ProductByMpRoute);

router.use('/onboard', OnboardRoute);

router.use('/customer', CustomerRoute);

router.use('/customers', CustomersRoute);

router.use('/supplier', SupplierRoute);

router.use('/suppliers', SuppliersRoute);

router.use('/black-list', BlackListRoute);

router.use('/out-share', OutShareRoute);

router.use('/in-share', InShareRoute);

router.use('/account', accountRoute);

router.use('/location/reference', locationReference);

router.use('/location/references', locationReferences);

router.use('/error-references', errorReferences);

router.use('/product/inventory', productInventory);

router.use('/product/inventories', productInventories);

router.use('/billOfMaterials', billOfMaterials);

router.use('/supply/item', supplyItem);

router.use('/supply/items', supplyItems);

router.use('/order', orderReferenceInformation);

router.use('/orders', orderReferenceInformations);

router.use('/order-item', orderLineItem);

router.use('/order-items', orderLineItems);

router.use('/upload/file', uploadFile);

router.use('/contact', contact);

router.use('/contacts', contacts);

router.use('/notifications/reference', notificationReferences);

router.use('/notification/reference', notificationReference);

router.use('/user/notification', notification);

router.use('/user/notifications', notifications);

router.use('/unitOfMeasureCategory', unitOfMeasureCategory);

router.use('/unitOfMeasure', unitOfMeasure);

router.use('/unitOfMeasures', unitOfMeasures);

router.use('/view', ViewRoute);

router.use('/supply/inventory', SupplyInventory);

router.use('/supply/inventories', SupplyInventories);

router.use('/chat', ChatRoute);

router.use('/billing', BillingRoute);

router.use('/groupChat', groupChat);

router.use('/plan', PlanRoute);

router.use('/download', download);

router.use('/contact-request', ContactRequestRoute);

router.use('/dependent-demand', DependentDemandRoute);

router.use('/database', DatabaseSwitchRoute);


module.exports = router;