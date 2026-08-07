package io.github.renakoni.marktextandroid;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * OAuth token set for one cloud account, with dependency-free JSON
 * serialization (org.json ships in the platform). Storage is the caller's
 * concern; app-private SharedPreferences in the plugin.
 */
final class CloudTokenStore {

    /** Refresh this long before the reported expiry to absorb clock skew. */
    static final long EXPIRY_MARGIN_MILLIS = 60_000;

    final String accessToken;
    final String refreshToken;
    final long expiresAtMillis;
    final String accountName;

    CloudTokenStore(String accessToken, String refreshToken, long expiresAtMillis, String accountName) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.expiresAtMillis = expiresAtMillis;
        this.accountName = accountName;
    }

    boolean isAccessTokenFresh(long nowMillis) {
        return accessToken != null
            && accessToken.length() > 0
            && nowMillis < expiresAtMillis - EXPIRY_MARGIN_MILLIS;
    }

    CloudTokenStore withAccountName(String nextAccountName) {
        return new CloudTokenStore(accessToken, refreshToken, expiresAtMillis, nextAccountName);
    }

    String serialize() {
        try {
            JSONObject json = new JSONObject();
            json.put("accessToken", accessToken);
            json.put("refreshToken", refreshToken);
            json.put("expiresAtMillis", expiresAtMillis);
            json.put("accountName", accountName == null ? JSONObject.NULL : accountName);
            return json.toString();
        } catch (JSONException ex) {
            throw new IllegalStateException("Token serialization failed", ex);
        }
    }

    static CloudTokenStore parse(String serialized) {
        if (serialized == null || serialized.length() == 0) {
            return null;
        }
        try {
            JSONObject json = new JSONObject(serialized);
            String accessToken = json.optString("accessToken", "");
            String refreshToken = json.optString("refreshToken", "");
            if (refreshToken.length() == 0) {
                return null;
            }
            return new CloudTokenStore(
                accessToken,
                refreshToken,
                json.optLong("expiresAtMillis", 0),
                json.isNull("accountName") ? null : json.optString("accountName", null)
            );
        } catch (JSONException ex) {
            return null;
        }
    }
}
