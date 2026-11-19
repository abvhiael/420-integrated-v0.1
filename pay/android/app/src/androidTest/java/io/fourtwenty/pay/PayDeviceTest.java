package io.fourtwenty.pay;

import static org.junit.Assert.*;

import android.content.Intent;
import android.net.Uri;
import android.view.WindowManager;
import android.widget.EditText;
import android.widget.TextView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import java.net.URI;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class PayDeviceTest {
    @Test public void sharedSdkReviewsOnlyConfiguredLinksOnDevice() throws Exception {
        try (ActivityScenario<PayActivity> scenario = ActivityScenario.launch(PayActivity.class)) {
            awaitEnabled(scenario, R.id.pay_check);
            scenario.onActivity(activity -> {
                assertNotEquals(0, activity.getWindow().getAttributes().flags & WindowManager.LayoutParams.FLAG_SECURE);
                ((EditText) activity.findViewById(R.id.pay_input)).setText("0x" + "ab".repeat(20));
                activity.findViewById(R.id.pay_check).performClick();
            });
            awaitEnabled(scenario, R.id.pay_hosted);
            scenario.onActivity(activity -> {
                ((EditText) activity.findViewById(R.id.pay_input))
                    .setText("https://" + BuildConfig.PAY_HOST + ".invalid/#pay?v=1");
                assertFalse(activity.findViewById(R.id.pay_hosted).isEnabled());
                activity.findViewById(R.id.pay_check).performClick();
            });
            awaitStatus(scenario, "Invalid payment link for this Pay deployment.");
        }
    }

    @Test public void unverifiedWalletAndForgedCallbackCannotAuthorizeAnything() throws Exception {
        try (ActivityScenario<PayActivity> scenario = ActivityScenario.launch(PayActivity.class)) {
            scenario.onActivity(activity -> {
                activity.findViewById(R.id.pay_wallet).performClick();
                assertEquals("Verified 420 Wallet App Link is unavailable.", status(activity));
                activity.onNewIntent(new Intent(Intent.ACTION_VIEW,
                    Uri.parse("https://" + BuildConfig.PAY_HOST + "/wallet-return?requestId=forged")));
                assertEquals("Wallet return could not be matched to an active review.", status(activity));
            });
        }
        var session = PayLinks.walletRequest("pay.example.test", "wallet.example.test", 5000);
        var callback = URI.create("https://pay.example.test/wallet-return?requestId=" + session.requestId());
        assertTrue(PayLinks.matchesReturn(callback, "pay.example.test", session, 5001));
        assertFalse(PayLinks.matchesReturn(callback, "pay.example.test", session, session.expiresAt()));
        assertFalse(PayLinks.matchesReturn(callback, "pay.example.test", null, 5001));
        assertFalse(PayLinks.matchesReturn(URI.create(callback + "&settled=true"), "pay.example.test", session, 5001));
    }

    private static String status(PayActivity activity) {
        return ((TextView) activity.findViewById(R.id.pay_status)).getText().toString();
    }

    private static void awaitStatus(ActivityScenario<PayActivity> scenario, String expected) throws Exception {
        await(scenario, activity -> status(activity).equals(expected));
    }

    private static void awaitEnabled(ActivityScenario<PayActivity> scenario, int viewId) throws Exception {
        await(scenario, activity -> activity.findViewById(viewId).isEnabled());
    }

    private static void await(ActivityScenario<PayActivity> scenario, java.util.function.Predicate<PayActivity> check)
        throws Exception {
        AtomicBoolean ready = new AtomicBoolean();
        for (int attempt = 0; attempt < 150; attempt++) {
            scenario.onActivity(activity -> ready.set(check.test(activity)));
            if (ready.get()) return;
            Thread.sleep(100);
        }
        fail("Pay UI did not reach the expected state");
    }
}
