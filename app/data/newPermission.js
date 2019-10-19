module.exports = {
    Product: {
        CREATE_PRODUCT: {
            demand: {
                product: {
                    create: true
                }
            }
        }, UPDATE_PRODUCT: {
            demand: {
                product: {
                    update: true
                }
            }
        }, GET_PRODUCT: {
            demand: {
                product: {
                    read: true
                }
            }
        }, GET_ALL_PRODUCT: {
            demand: {
                product: {
                    list: true
                }
            }
        }, DELETE_PRODUCT: {
            demand: {
                product: {
                    delete: true
                }
            }
        }
    },
    Orders: {
        CREATE_ORDERS: {
            demand: {
                orders: {
                    create: true
                }
            }
        }, UPDATE_ORDERS: {
            demand: {
                orders: {
                    update: true
                }
            }
        }, GET_ORDERS: {
            demand: {
                orders: {
                    read: true
                }
            }
        }, GET_ALL_ORDERS: {
            demand: {
                orders: {
                    list: true
                }
            }
        }, DELETE_ORDERS: {
            demand: {
                orders: {
                    delete: true
                }
            }
        }
    },
    Customers: {
        CREATE_CUSTOMERS: {
            demand: {
                customers: {
                    create: true
                }
            }
        }, UPDATE_CUSTOMERS: {
            demand: {
                customers: {
                    update: true
                }
            }
        }, GET_CUSTOMERS: {
            demand: {
                customers: {
                    read: true
                }
            }
        }, GET_ALL_CUSTOMERS: {
            demand: {
                customers: {
                    list: true
                }
            }
        }, DELETE_CUSTOMERS: {
            demand: {
                customers: {
                    delete: true
                }
            }
        }
    },
    Forecast: {
        CREATE_FORECAST: {
            demand: {
                forecast: {
                    create: true
                }
            }
        }, UPDATE_FORECAST: {
            demand: {
                forecast: {
                    update: true
                }
            }
        }, GET_FORECAST: {
            demand: {
                forecast: {
                    read: true
                }
            }
        }, GET_ALL_FORECAST: {
            demand: {
                forecast: {
                    list: true
                }
            }
        }, DELETE_FORECAST: {
            demand: {
                forecast: {
                    delete: true
                }
            }
        }
    },
    DemandSignal: {
        CREATE_DEMAND_SIGNAL: {
            demand: {
                demandSignal: {
                    create: true
                }
            }
        }, UPDATE_DEMAND_SIGNAL: {
            demand: {
                demandSignal: {
                    update: true
                }
            }
        }, GET_DEMAND_SIGNAL: {
            demand: {
                demandSignal: {
                    read: true
                }
            }
        }, GET_ALL_DEMAND_SIGNAL: {
            demand: {
                demandSignal: {
                    list: true
                }
            }
        }, DELETE_DEMAND_SIGNAL: {
            demand: {
                demandSignal: {
                    delete: true
                }
            }
        }
    },
    ProductInventory: {
        CREATE_PRODUCT_INVENTORY: {
            demand: {
                productInventory: {
                    create: true
                }
            }
        }, UPDATE_PRODUCT_INVENTORY: {
            demand: {
                productInventory: {
                    update: true
                }
            }
        }, GET_PRODUCT_INVENTORY: {
            demand: {
                productInventory: {
                    read: true
                }
            }
        }, GET_ALL_PRODUCT_INVENTORY: {
            demand: {
                productInventory: {
                    list: true
                }
            }
        }, DELETE_PRODUCT_INVENTORY: {
            demand: {
                productInventory: {
                    delete: true
                }
            }
        }
    },
    Dashboard: {
        CREATE_DASHBOARD: {
            dashboard: {
                dashboard: {
                    create: true
                }
            }
        }, UPDATE_DASHBOARD: {
            dashboard: {
                dashboard: {
                    update: true
                }
            }
        }, GET_DASHBOARD: {
            dashboard: {
                dashboard: {
                    read: true
                }
            }
        }, GET_ALL_DASHBOARD: {
            dashboard: {
                dashboard: {
                    list: true
                }
            }
        }, DELETE_DASHBOARD: {
            dashboard: {
                dashboard: {
                    delete: true
                }
            }
        }
    },
    OutShareProfile: {
        CREATE_OUTSHARE_PROFILE: {
            reference: {
                outshareProfile: {
                    create: true
                }
            }
        }, UPDATE_OUTSHARE_PROFILE: {
            reference: {
                outshareProfile: {
                    update: true
                }
            }
        }, GET_OUTSHARE_PROFILE: {
            reference: {
                outshareProfile: {
                    read: true
                }
            }
        }, GET_ALL_OUTSHARE_PROFILE: {
            reference: {
                outshareProfile: {
                    list: true
                }
            }
        }, DELETE_OUTSHARE_PROFILE: {
            reference: {
                outshareProfile: {
                    delete: true
                }
            }
        }
    },
    Location: {
        CREATE_LOCATION: {
            reference: {
                location: {
                    create: true
                }
            }
        }, UPDATE_LOCATION: {
            reference: {
                location: {
                    update: true
                }
            }
        }, GET_LOCATION: {
            reference: {
                location: {
                    read: true
                }
            }
        }, GET_ALL_LOCATION: {
            reference: {
                location: {
                    list: true
                }
            }
        }, DELETE_LOCATION: {
            reference: {
                location: {
                    delete: true
                }
            }
        }
    },
    Outshare: {
        CREATE_OUTSHARE: {
            reference: {
                outshare: {
                    create: true
                }
            }
        }, UPDATE_OUTSHARE: {
            reference: {
                outshare: {
                    update: true
                }
            }
        }, GET_OUTSHARE: {
            reference: {
                outshare: {
                    read: true
                }
            }
        }, GET_ALL_OUTSHARE: {
            reference: {
                outshare: {
                    list: true
                }
            }
        }, DELETE_OUTSHARE: {
            reference: {
                outshare: {
                    delete: true
                }
            }
        }
    },
    Inshare: {
        CREATE_INSHARE: {
            reference: {
                Inshare: {
                    create: true
                }
            }
        }, UPDATE_INSHARE: {
            reference: {
                Inshare: {
                    update: true
                }
            }
        }, GET_INSHARE: {
            reference: {
                Inshare: {
                    read: true
                }
            }
        }, GET_ALL_INSHARE: {
            reference: {
                Inshare: {
                    list: true
                }
            }
        }, DELETE_INSHARE: {
            reference: {
                Inshare: {
                    delete: true
                }
            }
        }
    },
    Operation: {
        CREATE_OPERATION: {
            operation: {
                operation: {
                    create: true
                }
            }
        }, UPDATE_OPERATION: {
            operation: {
                operation: {
                    update: true
                }
            }
        }, GET_OPERATION: {
            operation: {
                operation: {
                    read: true
                }
            }
        }, GET_ALL_OPERATION: {
            operation: {
                operation: {
                    list: true
                }
            }
        }, DELETE_OPERATION: {
            operation: {
                operation: {
                    delete: true
                }
            }
        }
    },
    SupplyInventory: {
        CREATE_SUPPLY_INVENTORY: {
            supply: {
                supplyInventory: {
                    create: true
                }
            }
        }, UPDATE_SUPPLY_INVENTORY: {
            supply: {
                supplyInventory: {
                    update: true
                }
            }
        }, GET_SUPPLY_INVENTORY: {
            supply: {
                supplyInventory: {
                    read: true
                }
            }
        }, GET_ALL_SUPPLY_INVENTORY: {
            supply: {
                supplyInventory: {
                    list: true
                }
            }
        }, DELETE_SUPPLY_INVENTORY: {
            supply: {
                supplyInventory: {
                    delete: true
                }
            }
        }
    },
    Suppliers: {
        CREATE_SUPPLIERS: {
            supply: {
                suppliers: {
                    create: true
                }
            }
        }, UPDATE_SUPPLIERS: {
            supply: {
                suppliers: {
                    update: true
                }
            }
        }, GET_SUPPLIERS: {
            supply: {
                suppliers: {
                    read: true
                }
            }
        }, GET_ALL_SUPPLIERS: {
            supply: {
                suppliers: {
                    list: true
                }
            }
        }, DELETE_SUPPLIERS: {
            supply: {
                suppliers: {
                    delete: true
                }
            }
        }
    },
    SupplyItems: {
        CREATE_SUPPLY_ITEM: {
            supply: {
                supplyItems: {
                    create: true
                }
            }
        }, UPDATE_SUPPLY_ITEM: {
            supply: {
                supplyItems: {
                    update: true
                }
            }
        }, GET_SUPPLY_ITEM: {
            supply: {
                supplyItems: {
                    read: true
                }
            }
        }, GET_ALL_SUPPLY_ITEM: {
            supply: {
                supplyItems: {
                    list: true
                }
            }
        }, DELETE_SUPPLY_ITEM: {
            supply: {
                supplyItems: {
                    delete: true
                }
            }
        }
    },
    SupplySignal: {
        CREATE_SUPPLY_SIGNAL: {
            supply: {
                supplySignal: {
                    create: true
                }
            }
        }, UPDATE_SUPPLY_SIGNAL: {
            supply: {
                supplySignal: {
                    update: true
                }
            }
        }, GET_SUPPLY_SIGNAL: {
            supply: {
                supplySignal: {
                    read: true
                }
            }
        }, GET_ALL_SUPPLY_SIGNAL: {
            supply: {
                supplySignal: {
                    list: true
                }
            }
        }, DELETE_SUPPLY_SIGNAL: {
            supply: {
                supplySignal: {
                    delete: true
                }
            }
        }
    },
    AuthorizeUser: {
        CREATE_AUTHORIZED_USER: {
            accountSettings: {
                authorizeUser: {
                    create: true
                }
            }
        }, UPDATE_AUTHORIZED_USER: {
            accountSettings: {
                authorizeUser: {
                    update: true
                }
            }
        }, GET_AUTHORIZED_USER: {
            accountSettings: {
                authorizeUser: {
                    read: true
                }
            }
        }, GET_ALL_AUTHORIZED_USER: {
            accountSettings: {
                authorizeUser: {
                    list: true
                }
            }
        }, DELETE_AUTHORIZED_USER: {
            accountSettings: {
                authorizeUser: {
                    delete: true
                }
            }
        }
    },
    Marketplaces: {
        CREATE_MARKETPLACES: {
            accountSettings: {
                marketplaces: {
                    create: true
                }
            }
        }, UPDATE_MARKETPLACES: {
            accountSettings: {
                marketplaces: {
                    update: true
                }
            }
        }, GET_MARKETPLACES: {
            accountSettings: {
                marketplaces: {
                    read: true
                }
            }
        }, GET_ALL_MARKETPLACES: {
            accountSettings: {
                marketplaces: {
                    list: true
                }
            }
        }, DELETE_MARKETPLACES: {
            accountSettings: {
                marketplaces: {
                    delete: true
                }
            }
        }
    },
    OrderReplication: {
        CREATE_ORDER_REPLICATION: {
            accountSettings: {
                orderReplication: {
                    create: true
                }
            }
        }, UPDATE_ORDER_REPLICATION: {
            accountSettings: {
                orderReplication: {
                    update: true
                }
            }
        }, GET_ORDER_REPLICATION: {
            accountSettings: {
                orderReplication: {
                    read: true
                }
            }
        }, GET_ALL_ORDER_REPLICATION: {
            accountSettings: {
                orderReplication: {
                    list: true
                }
            }
        }, DELETE_ORDER_REPLICATION: {
            accountSettings: {
                orderReplication: {
                    delete: true
                }
            }
        }
    },
    Account: {
        CREATE_ACCOUNT: {
            accountSettings: {
                account: {
                    create: true
                }
            }
        }, UPDATE_ACCOUNT: {
            accountSettings: {
                account: {
                    update: true
                }
            }
        }, GET_ACCOUNT: {
            accountSettings: {
                account: {
                    read: true
                }
            }
        }, GET_ALL_ACCOUNT: {
            accountSettings: {
                account: {
                    list: true
                }
            }
        }, DELETE_ACCOUNT: {
            accountSettings: {
                account: {
                    delete: true
                }
            }
        }
    }
};