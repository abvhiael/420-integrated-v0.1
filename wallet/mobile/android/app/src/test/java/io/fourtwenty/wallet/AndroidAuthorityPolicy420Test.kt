package io.fourtwenty.wallet

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.assertEquals
import org.junit.Test

class AndroidAuthorityPolicy420Test {
    @Test
    fun canonicalAuthorityRemainsOnChainAndRpcIsTransportOnly() {
        assertEquals("SmartAccount420", AndroidAuthorityPolicy420.canonicalAccountAuthority)
        assertEquals("CapabilityRegistry420", AndroidAuthorityPolicy420.canonicalCapabilityAuthority)
        assertEquals("read_transport_only", AndroidAuthorityPolicy420.rpcRole)
        assertFalse(AndroidAuthorityPolicy420.nativeClientIsCanonicalAuthority)
        assertFalse(AndroidAuthorityPolicy420.remoteSignerAllowed)
        assertFalse(AndroidAuthorityPolicy420.exportablePrivateKeyAllowed)
    }

    @Test
    fun onlyQualifiedRpcVocabularyIsAllowed() {
        assertTrue(AndroidAuthorityPolicy420.rpcMethodAllowed("eth_chainId"))
        assertTrue(AndroidAuthorityPolicy420.rpcMethodAllowed("eth_sendUserOperation"))
        assertFalse(AndroidAuthorityPolicy420.rpcMethodAllowed("eth_sendTransaction"))
        assertFalse(AndroidAuthorityPolicy420.rpcMethodAllowed("personal_sign"))
        assertFalse(AndroidAuthorityPolicy420.rpcMethodAllowed("eth_signTypedData_v4"))
    }

    @Test
    fun endpointsMustBeCredentialFreeHttps() {
        assertTrue(AndroidAuthorityPolicy420.endpointAllowed("https://rpc.example"))
        assertFalse(AndroidAuthorityPolicy420.endpointAllowed("http://rpc.example"))
        assertFalse(AndroidAuthorityPolicy420.endpointAllowed("https://user:pass@rpc.example"))
    }
}
