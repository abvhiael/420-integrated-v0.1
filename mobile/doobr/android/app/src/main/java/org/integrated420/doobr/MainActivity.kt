package org.integrated420.doobr
import android.app.Activity
import android.os.Bundle
import android.widget.TextView
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyPairGenerator
import java.security.KeyStore

class MainActivity : Activity() {
 override fun onCreate(savedInstanceState:Bundle?) {
  super.onCreate(savedInstanceState)
  val view=TextView(this)
  view.text="DOOBr mobile — development only. No delivery or tracking active."
  setContentView(view)
 }
}
object DeviceKey {
 fun ensureKey():Boolean {
  val ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null)
  if(ks.containsAlias("doobr-device-v1"))return true
  val gen=KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC,"AndroidKeyStore")
  gen.initialize(KeyGenParameterSpec.Builder("doobr-device-v1",KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY)
   .setDigests(KeyProperties.DIGEST_SHA256)
   .setUserAuthenticationRequired(true).build())
  gen.generateKeyPair()
  return ks.containsAlias("doobr-device-v1")
 }
}
