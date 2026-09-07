package io.fourtwenty.wallet

import android.app.Activity
import android.os.Bundle
import android.widget.TextView

class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(TextView(this).apply {
            text = "420 Wallet — W11 native bootstrap"
            textSize = 20f
            setPadding(32, 64, 32, 32)
        })
    }
}
