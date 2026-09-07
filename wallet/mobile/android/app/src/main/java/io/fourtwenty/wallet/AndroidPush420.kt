package io.fourtwenty.wallet

import android.content.Context
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/** W11.6 FCM registration. Push carries request references only and never signing authority. */
data class AndroidPushReference420(val origin: String, val requestId: String, val expiresAt: Long, val state: String)

object AndroidPush420 {
    private const val PREFS = "wallet420_push_v1"
    private const val TOKEN_KEY = "fcm_token"
    private const val PENDING_ORIGIN = "pending_origin"
    private const val PENDING_REQUEST_ID = "pending_request_id"
    private const val PENDING_EXPIRES_AT = "pending_expires_at"
    private const val PENDING_STATE = "pending_state"
    private const val CONSUMED_KEY = "consumed_reference"

    fun register(onToken: (String) -> Unit, onError: (Throwable) -> Unit) {
        FirebaseMessaging.getInstance().token
            .addOnSuccessListener { token ->
                require(token.isNotBlank()) { "empty FCM token" }
                onToken(token)
            }
            .addOnFailureListener(onError)
    }

    fun storeReference(context: Context, data: Map<String, String>, state: String, nowMs: Long = System.currentTimeMillis()): Boolean {
        if (state !in setOf("foreground", "background", "terminated")) return false
        if (data.keys.any { it !in setOf("origin", "requestId", "expiresAt") }) return false
        val origin = data["origin"] ?: return false
        val requestId = data["requestId"] ?: return false
        val expiresAt = data["expiresAt"]?.toLongOrNull() ?: return false
        if (!origin.startsWith("https://") || requestId.length !in 8..128 || expiresAt <= nowMs || expiresAt - nowMs > 10 * 60_000L) return false
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString(PENDING_ORIGIN, origin)
            .putString(PENDING_REQUEST_ID, requestId)
            .putLong(PENDING_EXPIRES_AT, expiresAt)
            .putString(PENDING_STATE, state)
            .apply()
        return true
    }

    /** One-shot consumption before canonical request rehydration. Duplicate/stale references fail closed. */
    fun consumePending(context: Context, nowMs: Long = System.currentTimeMillis()): AndroidPushReference420? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val origin = prefs.getString(PENDING_ORIGIN, null) ?: return null
        val requestId = prefs.getString(PENDING_REQUEST_ID, null) ?: return null
        val expiresAt = prefs.getLong(PENDING_EXPIRES_AT, 0L)
        val state = prefs.getString(PENDING_STATE, null) ?: return null
        val key = "$origin\n$requestId"
        val alreadyConsumed = prefs.getString(CONSUMED_KEY, null) == key
        prefs.edit().remove(PENDING_ORIGIN).remove(PENDING_REQUEST_ID).remove(PENDING_EXPIRES_AT).remove(PENDING_STATE).apply()
        if (alreadyConsumed || expiresAt <= nowMs) return null
        prefs.edit().putString(CONSUMED_KEY, key).apply()
        return AndroidPushReference420(origin, requestId, expiresAt, state)
    }
}

class WalletFirebaseMessagingService420 : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        getSharedPreferences("wallet420_push_v1", Context.MODE_PRIVATE).edit().putString("fcm_token", token).apply()
    }

    override fun onMessageReceived(message: RemoteMessage) {
        // Service delivery is background by definition; launch/foreground consumption converges in MainActivity.
        AndroidPush420.storeReference(this, message.data, state = "background")
    }
}
