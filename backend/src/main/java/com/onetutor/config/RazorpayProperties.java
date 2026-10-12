package com.onetutor.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.razorpay")
public class RazorpayProperties {

    private String keyId = "rzp_test_placeholder";
    private String keySecret = "placeholder_secret";
    private String currency = "INR";
    private boolean enabled = true;

    public String getKeyId() {
        return keyId;
    }

    public void setKeyId(String keyId) {
        this.keyId = keyId;
    }

    public String getKeySecret() {
        return keySecret;
    }

    public void setKeySecret(String keySecret) {
        this.keySecret = keySecret;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public boolean isConfigured() {
        return keyId != null && !keyId.isBlank() && !keyId.contains("placeholder")
                && keySecret != null && !keySecret.isBlank() && !keySecret.contains("placeholder");
    }
}
