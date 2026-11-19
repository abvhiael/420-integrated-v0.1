package io.fourtwenty.pay;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.verify.domain.DomainVerificationManager;
import android.content.pm.verify.domain.DomainVerificationUserState;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import androidx.activity.ComponentActivity;
import androidx.activity.result.ActivityResultLauncher;
import androidx.webkit.WebViewAssetLoader;
import com.journeyapps.barcodescanner.ScanContract;
import com.journeyapps.barcodescanner.ScanOptions;
import java.net.URI;
import org.json.JSONArray;
import org.json.JSONObject;

public final class PayActivity extends ComponentActivity {
    private static final String WALLET_PACKAGE = "io.fourtwenty.wallet";
    private static final String SDK_PAGE = "https://appassets.androidplatform.net/assets/review.html";
    private static final String CHANNEL = "pay-reminders";
    private static final int REMINDER = 13;

    private TextView status;
    private EditText input;
    private Button hosted;
    private Button check;
    private Button share;
    private WebView sdk;
    private CheckBox reminders;
    private boolean sdkReady;
    private URI reviewUrl;
    private long revision;
    private PayLinks.Session pending;

    private final ActivityResultLauncher<ScanOptions> scanner =
        registerForActivityResult(new ScanContract(), result -> {
            if (result.getContents() != null) validate(result.getContents());
        });

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        LinearLayout panel = new LinearLayout(this);
        panel.setOrientation(LinearLayout.VERTICAL);
        int padding = Math.round(getResources().getDisplayMetrics().density * 20);
        panel.setPadding(padding, padding, padding, padding);
        ScrollView scroll = new ScrollView(this);
        scroll.setOnApplyWindowInsetsListener((view, insets) -> {
            android.graphics.Insets bars = insets.getInsets(android.view.WindowInsets.Type.systemBars());
            panel.setPadding(padding + bars.left, padding + bars.top, padding + bars.right, padding + bars.bottom);
            return insets;
        });
        scroll.addView(panel);
        setContentView(scroll);

        TextView title = new TextView(this);
        title.setText("420 Pay");
        title.setTextSize(28);
        panel.addView(title);
        status = new TextView(this);
        status.setId(R.id.pay_status);
        panel.addView(status);
        input = new EditText(this);
        input.setId(R.id.pay_input);
        input.setHint("Pay link or address");
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI
            | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        input.setSaveEnabled(false);
        input.setImportantForAutofill(android.view.View.IMPORTANT_FOR_AUTOFILL_NO);
        panel.addView(input);
        check = button(panel, "Check link", () -> validate(input.getText().toString()));
        check.setId(R.id.pay_check);
        check.setEnabled(false);
        button(panel, "Scan payment QR", () -> scanner.launch(new ScanOptions().setDesiredBarcodeFormats(ScanOptions.QR_CODE)
            .setPrompt("Scan a 420 Pay QR code").setBeepEnabled(false).setOrientationLocked(false)));
        hosted = button(panel, "Open hosted review", this::openHosted);
        hosted.setId(R.id.pay_hosted);
        share = button(panel, "Share reviewed link", this::shareLink);
        share.setEnabled(false);
        hosted.setEnabled(false);
        button(panel, "Open verified 420 Wallet", this::openWallet).setId(R.id.pay_wallet);
        reminders = new CheckBox(this);
        reminders.setText("Show a generic return reminder");
        reminders.setSaveEnabled(false);
        panel.addView(reminders);
        reminders.setOnCheckedChangeListener((button, enabled) -> {
            if (enabled && Build.VERSION.SDK_INT >= 33 &&
                checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[] { Manifest.permission.POST_NOTIFICATIONS }, REMINDER);
            } else if (!enabled) {
                getSystemService(NotificationManager.class).cancel(REMINDER);
            }
        });
        button(panel, "Clear review", () -> clear("Review cleared."));
        input.addTextChangedListener(new android.text.TextWatcher() {
            public void beforeTextChanged(CharSequence text, int start, int count, int after) {}
            public void onTextChanged(CharSequence text, int start, int before, int count) {
                ++revision;
                reviewUrl = null;
                hosted.setEnabled(false);
                share.setEnabled(false);
            }
            public void afterTextChanged(android.text.Editable text) {}
        });
        status.setText(BuildConfig.CHAIN_ID.isEmpty() ? "Approved Pay deployment is unavailable." :
            "Scan or enter a Pay link to review.");
        startSdk(panel);
        acceptIntent(getIntent());
    }

    private Button button(LinearLayout panel, String text, Runnable action) {
        Button button = new Button(this);
        button.setText(text);
        button.setOnClickListener(view -> action.run());
        panel.addView(button);
        return button;
    }

    private void startSdk(LinearLayout panel) {
        WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        sdk = new WebView(this);
        sdk.setSaveEnabled(false);
        sdk.setImportantForAccessibility(android.view.View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
        sdk.getSettings().setJavaScriptEnabled(true);
        sdk.getSettings().setAllowFileAccess(false);
        sdk.getSettings().setAllowContentAccess(false);
        sdk.getSettings().setBlockNetworkLoads(true);
        sdk.getSettings().setDomStorageEnabled(false);
        sdk.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return true; }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse local = assets.shouldInterceptRequest(request.getUrl());
                return local != null ? local : new WebResourceResponse("text/plain", "UTF-8", null);
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (SDK_PAGE.equals(url)) {
                    sdkReady = true;
                    check.setEnabled(!BuildConfig.CHAIN_ID.isEmpty());
                }
            }
        });
        panel.addView(sdk, new ViewGroup.LayoutParams(1, 1));
        sdk.loadUrl(SDK_PAGE);
    }

    private void validate(String value) {
        reviewUrl = null;
        hosted.setEnabled(false);
        share.setEnabled(false);
        long ticket = ++revision;
        if (!sdkReady || BuildConfig.CHAIN_ID.isEmpty() || value == null || value.length() > 1024) {
            status.setText("Pay review or approved deployment is unavailable.");
            return;
        }
        String script = "reviewPay420(" + JSONObject.quote(value.trim()) + "," +
            JSONObject.quote(BuildConfig.PAY_HOST) + "," + JSONObject.quote(BuildConfig.CHAIN_ID) + ")";
        sdk.evaluateJavascript(script, result -> {
            if (ticket != revision || isFinishing()) return;
            try {
                JSONArray array = new JSONArray("[" + result + "]");
                if (array.isNull(0)) throw new IllegalArgumentException();
                URI target = URI.create(array.getString(0));
                if (!PayLinks.isHostedReview(target, BuildConfig.PAY_HOST)) throw new IllegalArgumentException();
                reviewUrl = target;
                hosted.setEnabled(true);
                share.setEnabled(true);
                status.setText("Link checked. Open 420 Pay for current terms and Wallet approval.");
            } catch (Exception ignored) {
                status.setText("Invalid payment link for this Pay deployment.");
            }
        });
    }

    private void openHosted() {
        URI target = reviewUrl;
        if (target == null || !PayLinks.isHostedReview(target, BuildConfig.PAY_HOST)) return;
        clear("Opening canonical 420 Pay review.");
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(target.toString())).addCategory(Intent.CATEGORY_BROWSABLE));
        } catch (ActivityNotFoundException ignored) {
            status.setText("No browser is available.");
        }
    }

    private void shareLink() {
        URI target = reviewUrl;
        if (target == null || !PayLinks.isHostedReview(target, BuildConfig.PAY_HOST)) return;
        Intent shareIntent = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, target.toString());
        startActivity(Intent.createChooser(shareIntent, "Share 420 Pay link"));
    }

    private boolean verifiedWallet() {
        if (BuildConfig.WALLET_HOST.isEmpty() || BuildConfig.CHAIN_ID.isEmpty()) return false;
        try {
            DomainVerificationUserState state = getSystemService(DomainVerificationManager.class)
                .getDomainVerificationUserState(WALLET_PACKAGE);
            return state != null && state.isLinkHandlingAllowed() &&
                Integer.valueOf(DomainVerificationUserState.DOMAIN_STATE_VERIFIED)
                    .equals(state.getHostToStateMap().get(BuildConfig.WALLET_HOST));
        } catch (PackageManager.NameNotFoundException | SecurityException ignored) {
            return false;
        }
    }

    private void openWallet() {
        pending = null;
        if (!verifiedWallet()) {
            status.setText("Verified 420 Wallet App Link is unavailable.");
            return;
        }
        PayLinks.Session session = PayLinks.walletRequest(BuildConfig.PAY_HOST, BuildConfig.WALLET_HOST,
            System.currentTimeMillis());
        Intent handoff = new Intent(Intent.ACTION_VIEW, Uri.parse(session.url())).addCategory(Intent.CATEGORY_BROWSABLE)
            .setPackage(WALLET_PACKAGE);
        try {
            pending = session;
            startActivity(handoff);
            status.setText("Wallet review opened.");
            if (reminders.isChecked()) notifyReturn();
        } catch (ActivityNotFoundException | SecurityException ignored) {
            pending = null;
            status.setText("Verified 420 Wallet could not open.");
        }
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        acceptIntent(intent);
    }

    private void acceptIntent(Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction()) || intent.getDataString() == null) return;
        try {
            URI candidate = URI.create(intent.getDataString());
            if (PayLinks.matchesReturn(candidate, BuildConfig.PAY_HOST, pending, System.currentTimeMillis())) {
                clear("Returned from Wallet. Open hosted checkout to verify current payment state.");
                return;
            }
        } catch (IllegalArgumentException ignored) {}
        status.setText("Wallet return could not be matched to an active review.");
    }

    private void notifyReturn() {
        if (Build.VERSION.SDK_INT >= 33 &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel(CHANNEL, "Return reminders", NotificationManager.IMPORTANCE_LOW));
        PendingIntent launch = PendingIntent.getActivity(this, REMINDER, new Intent(this, PayActivity.class),
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        manager.notify(REMINDER, new Notification.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle("420 Pay")
            .setContentText("Open the app to continue.").setContentIntent(launch)
            .setVisibility(Notification.VISIBILITY_SECRET).setAutoCancel(true).build());
    }

    private void clear(String message) {
        ++revision;
        pending = null;
        reviewUrl = null;
        input.setText("");
        hosted.setEnabled(false);
        share.setEnabled(false);
        getSystemService(NotificationManager.class).cancel(REMINDER);
        status.setText(message);
    }

    @Override protected void onDestroy() {
        ++revision;
        pending = null;
        if (sdk != null) {
            if (sdk.getParent() instanceof ViewGroup parent) parent.removeView(sdk);
            sdk.destroy();
        }
        super.onDestroy();
    }
}
