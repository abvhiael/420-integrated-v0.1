package org.fourtwenty.puffbuddies

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.spec.GCMParameterSpec
import android.util.Base64

class PuffBuddiesSecureSessionStore(private val context: Context) {
    private val alias="puffbuddies.session"
    private val prefs=context.getSharedPreferences("puffbuddies.secure",Context.MODE_PRIVATE)
    private fun key() = KeyStore.getInstance("AndroidKeyStore").run {
        load(null)
        (getKey(alias,null) as? javax.crypto.SecretKey) ?: run {
            val generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore")
            generator.init(KeyGenParameterSpec.Builder(alias,KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setUnlockedDeviceRequired(true).build())
            generator.generateKey()
        }
    }
    fun save(token:String) {
        require(token.isNotEmpty() && token.toByteArray().size<=4096)
        val cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key())
        val blob=cipher.iv+cipher.doFinal(token.toByteArray())
        prefs.edit().putString(alias,Base64.encodeToString(blob,Base64.NO_WRAP)).apply()
    }
    fun load():String? {
        val encoded=prefs.getString(alias,null)?:return null
        val blob=Base64.decode(encoded,Base64.NO_WRAP); if(blob.size<13)return null
        val cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),GCMParameterSpec(128,blob.copyOfRange(0,12)))
        return String(cipher.doFinal(blob.copyOfRange(12,blob.size)))
    }
    fun clear(){ prefs.edit().remove(alias).apply() }
}
