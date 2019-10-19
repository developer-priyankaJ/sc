"use strict";


let MWS = require('./mws');
module.exports=class ScopeHubCore {
    constructor(platform,option){
        if(platform=='MWS')
            return new MWS(option);
    }
    
};