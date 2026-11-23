// Approved local 420Notifications Go service adapter for 420Bet backend.
// Must be imported only in the trusted Node worker, never bundled into a browser.
import {createGo420NotificationsAdapter} from './notifications-go-provider.mjs';
export const notifications=createGo420NotificationsAdapter({
 origin:process.env.BET_NOTIFICATIONS_CONSENT_URL,
 serviceToken:process.env.BET_NOTIFICATIONS_DELIVERY_TOKEN
});
