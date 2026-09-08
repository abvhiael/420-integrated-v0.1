package io.fourtwenty.wallet

import android.content.Context

/**
 * W11.8 lost-device coordinator.
 * Local session material is destroyed before canonical recovery is requested.
 * This coordinator cannot itself grant, revoke, or replace SmartAccount420 authority.
 */
class AndroidLostDevice420(
    private val context: Context,
    private val sessionKeys: AndroidSessionKey420,
) {
    fun handle(sessionAlias: String, beginCanonicalRecovery: () -> Unit) {
        require(sessionAlias.isNotBlank()) { "session alias is required" }
        sessionKeys.invalidate(sessionAlias)
        context.getSharedPreferences("wallet420_push_v1", Context.MODE_PRIVATE).edit().clear().apply()
        context.getSharedPreferences("wallet420_permissions_v1", Context.MODE_PRIVATE).edit().clear().apply()
        AndroidPrivacy420.clear(context)
        beginCanonicalRecovery()
    }
}
