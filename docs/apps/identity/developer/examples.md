# Identity integration examples

For credential-gated access: read the credential, require current validity, require the minimum issuer class defined by your application, then apply your own authorization policy. Do not equate credential validity with wallet permission.

For profile display with a `.420` name: require both Names→profile and Identity→primaryName agreement.