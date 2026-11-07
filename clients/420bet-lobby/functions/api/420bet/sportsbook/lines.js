import {cachedLines} from '../../../../server/sportsbook-provider.mjs';
export const onRequest=context=>cachedLines(context);
