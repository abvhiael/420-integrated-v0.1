import {copyFileSync,mkdirSync} from 'node:fs';
// Package the canonical browser implementation verbatim, with its sole import.
const root=new URL('../',import.meta.url);
mkdirSync(new URL('dist/',root),{recursive:true});
copyFileSync(new URL('../../wallet/web/core/bridge-client.js',root),new URL('dist/bridge-runtime.js',root));
copyFileSync(new URL('../../wallet/web/core/keccak.js',root),new URL('dist/keccak.js',root));
copyFileSync(new URL('src/bridge-runtime.d.ts',root),new URL('dist/bridge-runtime.d.ts',root));

// Treasury uses the same Wallet implementation and keccak helper.
copyFileSync(new URL('../../wallet/web/core/treasury-client.js',root),new URL('dist/treasury-runtime.js',root));
copyFileSync(new URL('src/treasury-runtime.d.ts',root),new URL('dist/treasury-runtime.d.ts',root));
