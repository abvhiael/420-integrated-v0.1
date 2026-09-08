package io.fourtwenty.wallet

import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

object Wallet420DesignSystem {
    private const val LIGHT_BACKGROUND = "#F4F7F3"
    private const val DARK_BACKGROUND = "#0E1511"
    private const val LIGHT_TEXT = "#132018"
    private const val DARK_TEXT = "#F2F6F2"
    private const val LIGHT_SECONDARY = "#526158"
    private const val DARK_SECONDARY = "#A9B8AE"
    private const val LIGHT_PRIMARY = "#176B3A"
    private const val DARK_PRIMARY = "#65C887"

    const val MIN_TOUCH_TARGET_DP = 44
    const val SPACE_SM_DP = 8
    const val SPACE_MD_DP = 16
    const val SPACE_LG_DP = 24
    const val SPACE_XL_DP = 32

    fun isDark(view: View): Boolean =
        (view.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

    fun applyRoot(root: LinearLayout) {
        val dark = isDark(root)
        root.setBackgroundColor(Color.parseColor(if (dark) DARK_BACKGROUND else LIGHT_BACKGROUND))
        root.setPadding(dp(root, SPACE_XL_DP), dp(root, SPACE_LG_DP), dp(root, SPACE_XL_DP), dp(root, SPACE_XL_DP))
    }

    fun styleTitle(view: TextView) {
        val dark = isDark(view)
        view.textSize = 24f
        view.setTypeface(view.typeface, Typeface.BOLD)
        view.setTextColor(Color.parseColor(if (dark) DARK_TEXT else LIGHT_TEXT))
    }

    fun styleBody(view: TextView) {
        val dark = isDark(view)
        view.textSize = 16f
        view.setTextColor(Color.parseColor(if (dark) DARK_SECONDARY else LIGHT_SECONDARY))
        view.setPadding(0, dp(view, SPACE_LG_DP), 0, dp(view, SPACE_LG_DP))
    }

    fun styleAction(button: Button) {
        val dark = isDark(button)
        button.isAllCaps = false
        button.textSize = 14f
        button.setTypeface(button.typeface, Typeface.BOLD)
        button.setTextColor(Color.parseColor(if (dark) DARK_BACKGROUND else "#FFFFFF"))
        button.setBackgroundColor(Color.parseColor(if (dark) DARK_PRIMARY else LIGHT_PRIMARY))
        button.minHeight = dp(button, MIN_TOUCH_TARGET_DP)
        button.minWidth = dp(button, MIN_TOUCH_TARGET_DP)
    }

    fun styleNavigation(button: Button) {
        val dark = isDark(button)
        button.isAllCaps = false
        button.textSize = 14f
        button.setTextColor(Color.parseColor(if (dark) DARK_TEXT else LIGHT_TEXT))
        button.minHeight = dp(button, MIN_TOUCH_TARGET_DP)
        button.minWidth = dp(button, MIN_TOUCH_TARGET_DP)
    }

    private fun dp(view: View, value: Int): Int =
        (value * view.resources.displayMetrics.density).toInt()
}
