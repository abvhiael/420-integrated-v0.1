package io.fourtwenty.wallet

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.SocketTimeoutException
import java.net.URL
import java.net.UnknownHostException
import java.io.IOException
import java.util.concurrent.atomic.AtomicLong

/** W11.4 HTTPS-only JSON-RPC transport. Never provides signing authority. */
class AndroidRpcTransport420(
    endpoints: Map<String, String>,
    private val activeChainId: () -> String,
) {
    private val requestId = AtomicLong(1)
    private val endpointsByChain = endpoints.mapKeys { (chainId, _) -> NativeNetworkConfig420.normalizeChainId(chainId) }
        .mapValues { (_, value) ->
            require(value.startsWith("https://", ignoreCase = true)) { "RPC endpoint must use HTTPS" }
            val url = URL(value)
            require(url.protocol.equals("https", ignoreCase = true) && url.host.isNotBlank() && url.userInfo == null) {
                "RPC endpoint is malformed"
            }
            value
        }

    suspend fun rpc(method: String, paramsJson: String = "[]"): String {
        require(method in allowedMethods) { "RPC method is not allowed for native transport: $method" }
        val chainId = NativeNetworkConfig420.normalizeChainId(activeChainId())
        val endpoint = endpointsByChain[chainId] ?: throw RpcTransport420Exception.ChainNotAllowlisted(chainId)
        val params = parseParams(paramsJson)
        val id = requestId.getAndIncrement()
        val body = JSONObject()
            .put("jsonrpc", "2.0")
            .put("id", id)
            .put("method", method)
            .put("params", params)
        return post(endpoint, body.toString(), id)
    }

    private fun parseParams(paramsJson: String): Any = when {
        paramsJson.isBlank() -> JSONArray()
        paramsJson.trimStart().startsWith("[") -> JSONArray(paramsJson)
        paramsJson.trimStart().startsWith("{") -> JSONObject(paramsJson)
        else -> throw RpcTransport420Exception.InvalidParams
    }

    private suspend fun post(endpoint: String, body: String, expectedId: Long): String = withContext(Dispatchers.IO) {
        val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 15_000
            readTimeout = 30_000
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Accept", "application/json")
        }
        try {
            connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val response = stream?.bufferedReader()?.use { it.readText() }
                ?: throw RpcTransport420Exception.MalformedResponse("empty response")
            if (status !in 200..299) throw RpcTransport420Exception.HttpFailure(status)

            val json = try { JSONObject(response) } catch (_: Exception) {
                throw RpcTransport420Exception.MalformedResponse("invalid JSON")
            }
            if (json.optString("jsonrpc") != "2.0") throw RpcTransport420Exception.MalformedResponse("invalid jsonrpc version")
            if (!json.has("id") || json.optLong("id", Long.MIN_VALUE) != expectedId) {
                throw RpcTransport420Exception.MalformedResponse("response id mismatch")
            }
            if (json.has("error")) {
                val error = json.optJSONObject("error")
                throw RpcTransport420Exception.RpcFailure(
                    code = error?.optInt("code") ?: 0,
                    rpcMessage = error?.optString("message")?.takeIf { it.isNotBlank() } ?: "unknown RPC error",
                )
            }
            if (!json.has("result")) throw RpcTransport420Exception.MalformedResponse("missing result")
            response
        } catch (error: SocketTimeoutException) {
            throw RpcTransport420Exception.Timeout(error)
        } catch (error: UnknownHostException) {
            throw RpcTransport420Exception.NetworkFailure(error)
        } catch (error: IOException) {
            throw RpcTransport420Exception.NetworkFailure(error)
        } finally {
            connection.disconnect()
        }
    }

    companion object {
        val allowedMethods = setOf(
            "eth_chainId", "eth_call", "eth_estimateGas", "eth_getBalance", "eth_getCode",
            "eth_getTransactionCount", "eth_getBlockByNumber", "eth_getLogs",
            "eth_sendUserOperation", "eth_getUserOperationReceipt", "eth_estimateUserOperationGas"
        )
    }
}

sealed class RpcTransport420Exception(message: String, cause: Throwable? = null) : Exception(message, cause) {
    data class ChainNotAllowlisted(val chainId: String) : RpcTransport420Exception("active chain is not allowlisted: $chainId")
    data object InvalidParams : RpcTransport420Exception("RPC params must be JSON array or object")
    data class HttpFailure(val status: Int) : RpcTransport420Exception("RPC HTTP failure: $status")
    data class RpcFailure(val code: Int, val rpcMessage: String) : RpcTransport420Exception("RPC failure $code: $rpcMessage")
    data class MalformedResponse(val reason: String) : RpcTransport420Exception("malformed RPC response: $reason")
    class Timeout(cause: Throwable) : RpcTransport420Exception("RPC request timed out", cause)
    class NetworkFailure(cause: Throwable) : RpcTransport420Exception("RPC network failure", cause)
}
