# Names integration examples

For payment display: resolve the name, require unexpired state, show both `.420` label and resolved address, then let the user verify the address before signing.

For profile display: require the name record to reference `profileId` and require Identity's `primaryName` to equal that name's label hash.