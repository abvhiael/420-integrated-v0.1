package io.fourtwenty.pay;

import java.net.URI;
import java.net.URLEncoder;
import java.io.UnsupportedEncodingException;
import java.security.SecureRandom;

final class PayLinks {
    private static final SecureRandom RANDOM = new SecureRandom();
    static final long LIFETIME_MS = 120_000L;

    private PayLinks() {}

    static boolean isApprovedOrigin(URI uri, String host) {
        return host != null && !host.isEmpty() && "https".equals(uri.getScheme()) &&
            host.equals(uri.getHost()) && uri.getPort() == -1 && uri.getRawUserInfo() == null;
    }

    static boolean isHostedReview(URI uri, String host) {
        return isApprovedOrigin(uri, host) && "/".equals(uri.getRawPath()) && uri.getRawQuery() == null &&
            uri.getRawFragment() != null && uri.getRawFragment().startsWith("pay?");
    }

    record Session(String requestId, long expiresAt, String url) {}

    static Session walletRequest(String payHost, String walletHost, long now) {
        if (walletHost == null || walletHost.isEmpty() || now <= 0) throw new IllegalArgumentException("Wallet not configured");
        byte[] nonce = new byte[24];
        RANDOM.nextBytes(nonce);
        // HexFormat is unavailable on older supported Android releases.
        StringBuilder request = new StringBuilder();
        for (byte value : nonce) {
            request.append(Character.forDigit((value >>> 4) & 15, 16));
            request.append(Character.forDigit(value & 15, 16));
        }
        String id = request.toString();
        String origin = "https://" + payHost;
        String callback = origin + "/wallet-return?requestId=" + id;
        long expiry = Math.addExact(now, LIFETIME_MS);
        return new Session(id, expiry, "https://" + walletHost + "/connect?origin=" + encode(origin) +
            "&requestId=" + id + "&expiresAt=" + expiry + "&callback=" + encode(callback));
    }

    static boolean matchesReturn(URI uri, String host, Session session, long now) {
        return session != null && now > 0 && now < session.expiresAt() &&
            now >= session.expiresAt() - LIFETIME_MS && isApprovedOrigin(uri, host) &&
            "/wallet-return".equals(uri.getRawPath()) && uri.getRawFragment() == null &&
            ("requestId=" + session.requestId()).equals(uri.getRawQuery());
    }

    private static String encode(String value) {
        try {
            return URLEncoder.encode(value, "UTF-8");
        } catch (UnsupportedEncodingException error) {
            throw new AssertionError(error);
        }
    }
}
