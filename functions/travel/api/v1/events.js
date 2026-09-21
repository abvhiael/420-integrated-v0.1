import { publicTravelRead } from '../../../_travel-public.js';
export const onRequest = context => publicTravelRead(context, '/travel/api/v1/events');
