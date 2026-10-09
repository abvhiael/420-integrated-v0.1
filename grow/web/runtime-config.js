// Configure only a trusted, HTTPS 420Location endpoint for a deployed release.
// Blank means the interface remains safely offline; no fixture records are substituted.
window.GROW420_CONFIG = Object.freeze({locationBaseUrl:"",enabled:false});

// The cultivation workspace is independent of the public 420Location directory.
// HTTPS private API must supply verified session and authorized section projections.
window.GROW420_PRIVATE_CONFIG = Object.freeze({privateApiBaseUrl:"",enabled:false});
