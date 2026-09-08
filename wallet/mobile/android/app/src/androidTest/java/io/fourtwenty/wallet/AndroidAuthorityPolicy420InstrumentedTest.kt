package io.fourtwenty.wallet

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AndroidAuthorityPolicy420InstrumentedTest {
    @Test
    fun packageAndCanonicalAuthorityRemainBoundOnDevice() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        assertEquals("io.fourtwenty.wallet", context.packageName)
        assertEquals("SmartAccount420", AndroidAuthorityPolicy420.canonicalAccountAuthority)
        assertEquals("CapabilityRegistry420", AndroidAuthorityPolicy420.canonicalCapabilityAuthority)
        assertEquals("read_transport_only", AndroidAuthorityPolicy420.rpcRole)
        assertFalse(AndroidAuthorityPolicy420.nativeClientIsCanonicalAuthority)
        assertFalse(AndroidAuthorityPolicy420.remoteSignerAllowed)
        assertFalse(AndroidAuthorityPolicy420.exportablePrivateKeyAllowed)
    }

    @Test
    fun rpcTransportFailsClosedOnDevice() {
        assertTrue(AndroidAuthorityPolicy420.rpcMethodAllowed("eth_chainId"))
        assertTrue(AndroidAuthorityPolicy420.rpcMethodAllowed("eth_sendUserOperation"))
        assertFalse(AndroidAuthorityPolicy420.rpcMethodAllowed("personal_sign"))
        assertFalse(AndroidAuthorityPolicy420.rpcMethodAllowed("eth_sendTransaction"))
        assertTrue(AndroidAuthorityPolicy420.endpointAllowed("https://rpc.example.invalid"))
        assertFalse(AndroidAuthorityPolicy420.endpointAllowed("http://rpc.example.invalid"))
        assertFalse(AndroidAuthorityPolicy420.endpointAllowed("https://user:secret@rpc.example.invalid"))
    }
}
