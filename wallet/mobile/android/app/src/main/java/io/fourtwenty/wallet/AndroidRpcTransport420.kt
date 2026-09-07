package io.fourtwenty.wallet

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.atomic.AtomicLong

/** W11.4 HTTPS-only JSON-RPC transport. Never provides signing authority. */
class AndroidRpcTransport420(
    endpoints: Map<String, String>,
    private val activeChainId: () -> String,
) {
    private val requestId = AtomicLong(1)
    private val endpointsByChain = endpoints.mapValues { (_, value) ->
        require(value.startsWith("https://")) { "RPC endpoint must use HTTPS" }
        value
    }

    suspend fun rpc(method: String, paramsJson: String = "[]"): String {
        require(method in allowedMethods) { "RPC method is not allowed for native transport: $method" }
        val chainId = activeChainId()
        val endpoint = endpointsByChain[chainId] ?: error("active chain is not allowlisted")
        val params = parseParams(paramsJson)
        val body = JSONObject()
            .put("jsonrpc", "2.0")
            .put("id", requestId.getAndIncrement())
            .put("method", method)
            .put("params", params)
        return post(endpoint, body.toString())
    }

    private fun parseParams(paramsJson: String): Any = when {
        paramsJson.isBlank() -> JSONArray()
        paramsJson.trimStart().startsWith("[") -> JSONArray(paramsJson)
        paramsJson.trimStart().startsWith("{") -> JSONObject(paramsJson)
        else -> throw IllegalArgumentException("RPC params must be JSON array or object")
    }

    private suspend fun post(endpoint: String, body: String): String = withContext(Dispatchers.IO) {
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
            val stream = if (connection.responseCode in 200..299) connection.inputStream else connection.errorStream
            val response = stream?.bufferedReader()?.use { it.readText() } ?: error("empty RPC response")
            if (connection.responseCode !in 200..299) error("RPC HTTP failure: ${connection.responseCode}")
            val json = JSONObject(response)
            if (json.has("error")) error("RPC returned error")
            response
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
