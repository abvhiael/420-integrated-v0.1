package org.integrated420.doobr
import android.Manifest
import android.app.Activity
import android.os.Build
import android.os.Bundle
import android.widget.LinearLayout
import android.widget.Button
import android.widget.TextView
import android.content.pm.PackageManager
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyPairGenerator
import java.security.KeyStore

class MainActivity : Activity() {
 private var locationGranted = false
 private var assignmentVerified = false
 private var courierConsent = false
 override fun onCreate(savedInstanceState: Bundle?) {
  super.onCreate(savedInstanceState)
  val layout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
  layout.addView(TextView(this).apply { text = "DOOBr development only. Delivery and tracking disabled." })
  layout.addView(Button(this).apply {
   text = "Request foreground location"
   setOnClickListener { requestPermissions(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION), 110) }
  })
  layout.addView(Button(this).apply {
   text = "Request notifications"
   setOnClickListener {
    if (Build.VERSION.SDK_INT >= 33) requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 120)
   }
  })
  layout.addView(Button(this).apply {
   text = "Stop location"
   setOnClickListener { stopLocation() }
  })
  setContentView(layout)
 }
 override fun onRequestPermissionsResult(requestCode:Int, permissions:Array<out String>, grantResults:IntArray) {
  super.onRequestPermissionsResult(requestCode, permissions, grantResults)
  if(requestCode == 110) {
   locationGranted = grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
   if(!locationGranted) stopLocation()
  }
 }
 override fun onStop() { super.onStop(); stopLocation() }
 private fun stopLocation() { courierConsent = false }
 private fun mayCollectLocation() = locationGranted && assignmentVerified && courierConsent
}
object DeviceKey {
 fun ensureKey(): Boolean {
  val ks = KeyStore.getInstance("AndroidKeyStore")
  ks.load(null)
  if(ks.containsAlias("doobr-device-v1")) return true
  val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore")
  generator.initialize(KeyGenParameterSpec.Builder("doobr-device-v1",
    KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY)
   .setDigests(KeyProperties.DIGEST_SHA256)
   .setUserAuthenticationRequired(true).build())
  generator.generateKeyPair()
  return ks.containsAlias("doobr-device-v1")
 }
}
