package io.fourtwenty.wallet

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Build
import android.os.PersistableBundle

/** W11.8 presentation-only clipboard policy. Never place secrets or signing material on the clipboard. */
object AndroidPrivacy420 {
    fun copyPublicValue(context: Context, label: String, value: String) {
        require(label.isNotBlank()) { "clipboard label is required" }
        require(value.isNotBlank()) { "clipboard value is required" }
        val clip = ClipData.newPlainText(label, value)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            clip.description.extras = PersistableBundle().apply {
                putBoolean("android.content.extra.IS_SENSITIVE", true)
            }
        }
        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(clip)
    }

    fun clear(context: Context) {
        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) clipboard.clearPrimaryClip()
        else clipboard.setPrimaryClip(ClipData.newPlainText("", ""))
    }
}
