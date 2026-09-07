package io.fourtwenty.wallet

import android.content.Context
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/** W11.6 FCM registration. Push carries request references only and never signing authority. */
object AndroidPush420 {
    fun register(onToken: (String) -> Unit, onError: (Throwable) -> Unit) {
        FirebaseMessaging.getInstance().token
            .addOnSuccessListener { token ->
                require(token.isNotBlank()) { "empty FCM token" }
                onToken(token)
            }
            .addOnFailureListener(onError)
    }
}

class WalletFirebaseMessagingService420 : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(TOKEN_KEY, token).apply()
    }

    override fun onMessageReceived(message: RemoteMessage) {
        // Persist only the opaque request reference. Canonical request data is rehydrated after foregrounding.
        val origin = message.data["origin"] ?: return
        val requestId = message.data["requestId"] ?: return
        val expiresAt = message.data["expiresAt"] ?: return
        if (message.data.keys.any { it !in setOf("origin", "requestId", "expiresAt") }) return
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(PENDING_ORIGIN, origin)
            .putString(PENDING_REQUEST_ID, requestId)
            .putString(PENDING_EXPIRES_AT, expiresAt)
            .apply()
    }

    companion object {
        private const val PREFS = "wallet420_push_v1"
        private const val TOKEN_KEY = "fcm_token"
        private const val PENDING_ORIGIN = "pending_origin"
        private const val PENDING_REQUEST_ID = "pending_request_id"
        private const val PENDING_EXPIRES_AT = "pending_expires_at"
    }
}
