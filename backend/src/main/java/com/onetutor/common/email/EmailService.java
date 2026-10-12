package com.onetutor.common.email;

/**
 * Provider-agnostic email boundary. The concrete provider (SMTP,
 * SendGrid, SES, etc.) is TBD per the SRS — business code depends
 * only on this interface.
 */
public interface EmailService {
    void sendVerificationEmail(String toEmail, String toName, String verificationLink);
    void sendPasswordResetEmail(String toEmail, String toName, String resetLink);
    void sendOtpEmail(String toEmail, String toName, String otp, String purpose);
    void sendLoginOtpEmail(String toEmail, String toName, String otp);
    void sendLoginAlertEmail(String toEmail, String toName, String loginTime, String ipAddress, String userAgent);
    void sendEnrollmentGreetingEmail(String toEmail, String toName, String courseName, String courseThumbnail, String categoryName, String batchName, String courseUrl);
    void sendContactReplyEmail(String toEmail, String toName, String inquirySubject, String originalMessage, String replyMessage, String adminName);
    void sendTestEmail(String toEmail);
    boolean isMailConfigured();
}

