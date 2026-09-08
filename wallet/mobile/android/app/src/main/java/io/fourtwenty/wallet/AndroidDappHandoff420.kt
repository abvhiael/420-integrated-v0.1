package io.fourtwenty.wallet

import android.net.Uri
import java.net.URI

/** W11.5 inbound dApp handoff. Links carry intent only and never signing authority. */
data class AndroidDappHandoff420(
    val origin: String,
    val requestId: String,
    val expiresAt: Long,
    val callbackUrl: String,
    val transport: String,
)

object AndroidDappHandoffParser420 {
    private const val MAX_LIFETIME_MS = 10 * 60_000L
    private val requestIdPattern = Regex("^[A-Za-z0-9._:-]{8,128}$")

    fun parse(
        value: String,
        productionHost: String,
        nowMs: Long = System.currentTimeMillis(),
        allowDevelopmentScheme: Boolean = false,
    ): AndroidDappHandoff420 {
        val uri = Uri.parse(value)
        val javaUri = try { URI(value) } catch (_: Exception) { throw IllegalArgumentException("invalid dApp handoff URL") }
        require(javaUri.fragment == null && javaUri.userInfo == null) { "dApp handoff URL contains forbidden components" }

        val development = uri.scheme.equals("420wallet", ignoreCase = true)
        if (development) {
            require(allowDevelopmentScheme) { "development wallet scheme is disabled" }
            require(uri.host == "connect" && (uri.path.isNullOrEmpty() || uri.path == "/")) { "invalid development wallet handoff path" }
        } else {
            require(uri.scheme.equals("https", ignoreCase = true)) { "production wallet handoff must use https" }
            require(productionHost.isNotBlank()) { "production wallet link host required" }
            require(uri.host.equals(productionHost, ignoreCase = true) && uri.path == "/connect") { "wallet handoff host or path mismatch" }
        }

        val origin = normalizeOrigin(uri.getQueryParameter("origin"))
        val requestId = uri.getQueryParameter("requestId")?.takeIf { requestIdPattern.matches(it) }
            ?: throw IllegalArgumentException("invalid dApp request id")
        val expiresAt = uri.getQueryParameter("expiresAt")?.toLongOrNull()
            ?: throw IllegalArgumentException("invalid dApp request expiry")
        require(expiresAt > nowMs) { "dApp request expired" }
        require(expiresAt - nowMs <= MAX_LIFETIME_MS) { "dApp request expiry exceeds maximum window" }
        val callback = normalizeCallback(uri.getQueryParameter("callback"), origin)

        return AndroidDappHandoff420(origin, requestId, expiresAt, callback, if (development) "development-scheme" else "verified-link")
    }

    private fun normalizeOrigin(value: String?): String {
        require(!value.isNullOrBlank()) { "dApp origin required" }
        val uri = URI(value)
        require(uri.scheme.equals("https", ignoreCase = true) && !uri.host.isNullOrBlank() && uri.userInfo == null) { "mobile dApp origin must use https" }
        val port = if (uri.port == -1) "" else ":${uri.port}"
        return "https://${uri.host.lowercase()}$port"
    }

    private fun normalizeCallback(value: String?, origin: String): String {
        require(!value.isNullOrBlank()) { "dApp callback URL required" }
        val uri = URI(value)
        require(uri.scheme.equals("https", ignoreCase = true) && !uri.host.isNullOrBlank() && uri.userInfo == null) { "dApp callback must use credential-free https" }
        val port = if (uri.port == -1) "" else ":${uri.port}"
        require("https://${uri.host.lowercase()}$port" == origin) { "dApp callback origin mismatch" }
        return uri.toString()
    }
}
