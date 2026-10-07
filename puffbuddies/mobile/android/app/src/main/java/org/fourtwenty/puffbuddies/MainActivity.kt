package org.fourtwenty.puffbuddies

import android.app.Activity
import android.os.Bundle
import android.widget.LinearLayout
import android.widget.TextView

class MainActivity: Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val root=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL }
        listOf(
            "PuffBuddies","Eligibility","Profile & photos","Discovery","Matches & messaging",
            "Notifications","Safety: Block • Report • Unmatch","Settings: Visibility • Deactivate • Delete",
            "Premium: feature availability only"
        ).forEach { label -> root.addView(TextView(this).apply { text=label; textSize=18f; setPadding(24,18,24,18) }) }
        setContentView(root)
    }
    override fun onResume(){ super.onResume(); /* invalidate derived cache; server revalidation required */ }
}
