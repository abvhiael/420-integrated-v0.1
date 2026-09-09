package io.fourtwenty.wallet

import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.provider.Settings
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

object Wallet420DesignSystem {
    private const val LIGHT_BACKGROUND = "#F4F7F3"
    private const val DARK_BACKGROUND = "#0E1511"
    private const val LIGHT_SURFACE = "#FFFFFF"
    private const val DARK_SURFACE = "#151F19"
    private const val LIGHT_TEXT = "#132018"
    private const val DARK_TEXT = "#F2F6F2"
    private const val LIGHT_SECONDARY = "#526158"
    private const val DARK_SECONDARY = "#A9B8AE"
    private const val LIGHT_PRIMARY = "#176B3A"
    private const val DARK_PRIMARY = "#65C887"
    private const val LIGHT_DIVIDER = "#DCE5DE"
    private const val DARK_DIVIDER = "#2C3A31"

    const val MIN_TOUCH_TARGET_DP = 44
    const val SPACE_XS_DP = 4
    const val SPACE_SM_DP = 8
    const val SPACE_MD_DP = 16
    const val SPACE_LG_DP = 24
    const val SPACE_XL_DP = 32
    const val RADIUS_MD_DP = 14
    const val MOTION_SHORT_MS = 140L
    const val MOTION_MEDIUM_MS = 220L

    fun isDark(view: View): Boolean =
        (view.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

    fun reducedMotion(view: View): Boolean = try {
        Settings.Global.getFloat(view.context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
    } catch (_: Exception) {
        false
    }

    fun animateContentIn(view: View) {
        if (reducedMotion(view)) {
            view.alpha = 1f
            view.translationY = 0f
            return
        }
        view.animate().cancel()
        view.alpha = 0f
        view.translationY = dp(view, SPACE_SM_DP).toFloat()
        view.animate().alpha(1f).translationY(0f).setDuration(MOTION_MEDIUM_MS).start()
    }

    fun pulseStatus(view: View) {
        if (reducedMotion(view)) {
            view.alpha = 1f
            return
        }
        view.animate().cancel()
        view.alpha = 0.55f
        view.animate().alpha(1f).setDuration(MOTION_SHORT_MS).start()
    }

    fun applyRoot(root: LinearLayout) {
        val dark = isDark(root)
        root.setBackgroundColor(Color.parseColor(if (dark) DARK_BACKGROUND else LIGHT_BACKGROUND))
        root.setPadding(dp(root, SPACE_XL_DP), dp(root, SPACE_LG_DP), dp(root, SPACE_XL_DP), dp(root, SPACE_XL_DP))
    }

    fun styleTitle(view: TextView) {
        val dark = isDark(view)
        view.textSize = 26f
        view.setTypeface(view.typeface, Typeface.BOLD)
        view.setTextColor(Color.parseColor(if (dark) DARK_TEXT else LIGHT_TEXT))
    }

    fun styleSectionTitle(view: TextView) {
        val dark = isDark(view)
        view.textSize = 18f
        view.setTypeface(view.typeface, Typeface.BOLD)
        view.setTextColor(Color.parseColor(if (dark) DARK_TEXT else LIGHT_TEXT))
    }

    fun styleBody(view: TextView) {
        val dark = isDark(view)
        view.textSize = 16f
        view.setTextColor(Color.parseColor(if (dark) DARK_SECONDARY else LIGHT_SECONDARY))
        view.setLineSpacing(0f, 1.08f)
    }

    fun styleCaption(view: TextView) {
        val dark = isDark(view)
        view.textSize = 13f
        view.setTextColor(Color.parseColor(if (dark) DARK_SECONDARY else LIGHT_SECONDARY))
    }

    fun styleAction(button: Button) {
        val dark = isDark(button)
        button.isAllCaps = false
        button.textSize = 14f
        button.setTypeface(button.typeface, Typeface.BOLD)
        button.setTextColor(Color.parseColor(if (dark) DARK_BACKGROUND else "#FFFFFF"))
        button.background = roundedBackground(button, if (dark) DARK_PRIMARY else LIGHT_PRIMARY)
        button.minHeight = dp(button, MIN_TOUCH_TARGET_DP)
        button.minWidth = dp(button, MIN_TOUCH_TARGET_DP)
    }

    fun styleSecondaryAction(button: Button) {
        val dark = isDark(button)
        button.isAllCaps = false
        button.textSize = 14f
        button.setTypeface(button.typeface, Typeface.BOLD)
        button.setTextColor(Color.parseColor(if (dark) DARK_TEXT else LIGHT_TEXT))
        button.background = roundedBackground(button, if (dark) DARK_SURFACE else LIGHT_SURFACE)
        button.minHeight = dp(button, MIN_TOUCH_TARGET_DP)
        button.minWidth = dp(button, MIN_TOUCH_TARGET_DP)
    }

    fun styleNavigation(button: Button, selected: Boolean = false) {
        val dark = isDark(button)
        button.isAllCaps = false
        button.textSize = 13f
        button.setTypeface(button.typeface, if (selected) Typeface.BOLD else Typeface.NORMAL)
        button.setTextColor(Color.parseColor(if (selected) (if (dark) DARK_PRIMARY else LIGHT_PRIMARY) else (if (dark) DARK_TEXT else LIGHT_TEXT)))
        button.background = roundedBackground(button, if (selected) (if (dark) DARK_SURFACE else LIGHT_SURFACE) else "#00000000")
        button.minHeight = dp(button, MIN_TOUCH_TARGET_DP)
        button.minWidth = dp(button, MIN_TOUCH_TARGET_DP)
    }

    fun styleCard(view: LinearLayout) {
        val dark = isDark(view)
        view.orientation = LinearLayout.VERTICAL
        view.background = roundedBackground(view, if (dark) DARK_SURFACE else LIGHT_SURFACE)
        view.setPadding(dp(view, SPACE_MD_DP), dp(view, SPACE_MD_DP), dp(view, SPACE_MD_DP), dp(view, SPACE_MD_DP))
    }

    fun styleDivider(view: View) {
        view.setBackgroundColor(Color.parseColor(if (isDark(view)) DARK_DIVIDER else LIGHT_DIVIDER))
    }

    fun verticalSpace(view: View, value: Int): View = View(view.context).apply {
        layoutParams = LinearLayout.LayoutParams(1, dp(view, value))
    }

    private fun roundedBackground(view: View, hex: String): GradientDrawable = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = dp(view, RADIUS_MD_DP).toFloat()
        setColor(Color.parseColor(hex))
    }

    private fun dp(view: View, value: Int): Int =
        (value * view.resources.displayMetrics.density).toInt()
}
