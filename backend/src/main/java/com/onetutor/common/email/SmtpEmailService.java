package com.onetutor.common.email;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;

@Service
public class SmtpEmailService implements EmailService {

    private static final Logger log = LoggerFactory.getLogger(SmtpEmailService.class);

    private final JavaMailSender mailSender;
    private final String fromAddress;
    private final String senderName;
    private final boolean mailConfigured;

    public SmtpEmailService(JavaMailSender mailSender,
                            @Value("${app.mail.from:no-reply@onetutor.local}") String fromAddress,
                            @Value("${app.mail.sender-name:OneTutor Academy}") String senderName,
                            @Value("${spring.mail.username:}") String mailUsername) {
        this.mailSender = mailSender;
        this.senderName = senderName;
        this.mailConfigured = mailUsername != null && !mailUsername.isBlank();

        // If Gmail SMTP is used, the From address must match the authenticated Gmail user
        if (this.mailConfigured && mailUsername.contains("@") && (fromAddress == null || fromAddress.isBlank() || fromAddress.endsWith(".local"))) {
            this.fromAddress = mailUsername;
        } else {
            this.fromAddress = fromAddress;
        }

        // Sanitize password if whitespace was included (e.g. Google 4x4 app password "cngi xxcd uyrz gxrg")
        if (mailSender instanceof org.springframework.mail.javamail.JavaMailSenderImpl impl) {
            if (impl.getPassword() != null && impl.getPassword().contains(" ")) {
                impl.setPassword(impl.getPassword().replaceAll("\\s+", ""));
            }
        }
    }

    @Override
    public boolean isMailConfigured() {
        return this.mailConfigured;
    }

    @Override
    public void sendVerificationEmail(String toEmail, String toName, String verificationLink) {
        String greeting = (toName != null && !toName.isBlank()) ? "Hi " + toName : "Welcome to OneTutor";
        String subject = "Verify your OneTutor account";
        
        String html = buildEmailLayout(
                "Verify Your Email Address",
                greeting,
                "<p style=\"font-size: 15px; line-height: 1.6; color: #374151; margin-bottom: 20px;\">" +
                "Thank you for joining OneTutor! To complete your registration and secure your student account, please confirm your email address by clicking the button below:" +
                "</p>" +
                "<div style=\"text-align: center; margin: 28px 0;\">" +
                "  <a href=\"" + verificationLink + "\" style=\"display: inline-block; background: #7e22ce; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 15px; padding: 12px 28px; border-radius: 6px; box-shadow: 0 4px 6px -1px rgba(126, 34, 206, 0.2);\">Verify My Account</a>" +
                "</div>" +
                "<p style=\"font-size: 13px; color: #6b7280; line-height: 1.5;\">" +
                "Or copy and paste this link in your browser:<br>" +
                "<a href=\"" + verificationLink + "\" style=\"color: #7e22ce; word-break: break-all;\">" + verificationLink + "</a>" +
                "</p>" +
                "<p style=\"font-size: 13px; color: #9ca3af; margin-top: 20px;\">⏰ This verification link expires in 24 hours.</p>"
        );

        String text = "Hi " + toName + ",\n\nPlease verify your email by visiting:\n"
                + verificationLink + "\n\nThis link expires in 24 hours.\n\nBest regards,\nOneTutor Academy";

        send(toEmail, subject, html, text);
    }

    @Override
    public void sendPasswordResetEmail(String toEmail, String toName, String resetLink) {
        String greeting = (toName != null && !toName.isBlank()) ? "Hi " + toName : "Hello";
        String subject = "Reset your OneTutor password";

        String html = buildEmailLayout(
                "Password Reset Request",
                greeting,
                "<p style=\"font-size: 15px; line-height: 1.6; color: #374151; margin-bottom: 20px;\">" +
                "We received a request to reset the password for your OneTutor account. Click the button below to choose a new password:" +
                "</p>" +
                "<div style=\"text-align: center; margin: 28px 0;\">" +
                "  <a href=\"" + resetLink + "\" style=\"display: inline-block; background: #7e22ce; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 15px; padding: 12px 28px; border-radius: 6px; box-shadow: 0 4px 6px -1px rgba(126, 34, 206, 0.2);\">Reset Password</a>" +
                "</div>" +
                "<p style=\"font-size: 13px; color: #6b7280; line-height: 1.5;\">" +
                "Or copy and paste this link in your browser:<br>" +
                "<a href=\"" + resetLink + "\" style=\"color: #7e22ce; word-break: break-all;\">" + resetLink + "</a>" +
                "</p>" +
                "<p style=\"font-size: 13px; color: #9ca3af; margin-top: 20px;\">" +
                "⏰ This link expires in 1 hour and can only be used once. If you did not request this password reset, you can safely disregard this email." +
                "</p>"
        );

        String text = "Hi " + toName + ",\n\nReset your password by visiting:\n"
                + resetLink + "\n\nThis link expires in 1 hour. If you did not request this, ignore this email.";

        send(toEmail, subject, html, text);
    }

    @Override
    public void sendOtpEmail(String toEmail, String toName, String otp, String purpose) {
        boolean isRegistration = "REGISTRATION".equalsIgnoreCase(purpose);
        String actionLabel = isRegistration ? "complete your account registration" : "reset your account password";
        String headerTitle = isRegistration ? "Registration Verification Code" : "Password Reset Code";
        String subject = "Your OneTutor Code: " + otp;
        String greeting = (toName != null && !toName.isBlank()) ? "Hi " + toName : "Hello";

        String html = buildOtpEmailLayout(headerTitle, greeting, actionLabel, otp);
        String text = greeting + ",\n\nYour 6-digit verification code to " + actionLabel + " is: " + otp
                + "\n\nThis code is valid for 10 minutes. Do not share this code with anyone.\n\nBest regards,\nOneTutor Academy Team";

        logConsoleOtp(toEmail, otp, purpose);
        send(toEmail, subject, html, text);
    }

    @Override
    public void sendLoginOtpEmail(String toEmail, String toName, String otp) {
        String subject = "Your OneTutor Login Code: " + otp;
        String greeting = (toName != null && !toName.isBlank()) ? "Hi " + toName : "Hello";

        String html = buildOtpEmailLayout("Sign-In Verification Code", greeting, "sign in to your OneTutor account", otp);
        String text = greeting + ",\n\nYour OneTutor one-time login code is: " + otp
                + "\n\nThis code is valid for 10 minutes. Enter it on the login page to access your account.\n\nBest regards,\nOneTutor Academy Team";

        logConsoleOtp(toEmail, otp, "LOGIN");
        send(toEmail, subject, html, text);
    }

    @Override
    public void sendLoginAlertEmail(String toEmail, String toName, String loginTime, String ipAddress, String userAgent) {
        String subject = "Security Alert: New sign-in to OneTutor";
        String greeting = (toName != null && !toName.isBlank()) ? "Hi " + toName : "Hello";

        String html = buildEmailLayout(
                "New Sign-In Detected",
                greeting,
                "<p style=\"font-size: 15px; line-height: 1.6; color: #374151; margin-bottom: 16px;\">" +
                "We noticed a new sign-in to your OneTutor account." +
                "</p>" +
                "<div style=\"background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 18px 0;\">" +
                "  <table style=\"width: 100%; font-size: 14px; color: #4b5563;\">" +
                "    <tr><td style=\"padding: 4px 0; font-weight: 600; width: 100px;\">Time:</td><td style=\"padding: 4px 0;\">" + loginTime + "</td></tr>" +
                "    <tr><td style=\"padding: 4px 0; font-weight: 600;\">IP Address:</td><td style=\"padding: 4px 0;\">" + (ipAddress != null ? ipAddress : "Unknown") + "</td></tr>" +
                "    <tr><td style=\"padding: 4px 0; font-weight: 600;\">Device:</td><td style=\"padding: 4px 0;\">" + (userAgent != null ? userAgent : "Web Browser") + "</td></tr>" +
                "  </table>" +
                "</div>" +
                "<p style=\"font-size: 13px; color: #6b7280; line-height: 1.5;\">" +
                "If this was you, no action is needed. If you did not log in, please reset your password immediately." +
                "</p>"
        );

        String text = greeting + ",\n\nNew sign-in detected for your OneTutor account at " + loginTime
                + "\nDevice: " + userAgent + "\nIP: " + ipAddress;

        send(toEmail, subject, html, text);
    }

    @Override
    public void sendEnrollmentGreetingEmail(String toEmail, String toName, String courseName, String courseThumbnail, String categoryName, String batchName, String courseUrl) {
        String studentName = (toName != null && !toName.isBlank()) ? toName : "Student";
        String subject = "🎉 Welcome to " + courseName + " - Enrollment Confirmed!";

        StringBuilder cardContent = new StringBuilder();

        // Thumbnail image or banner
        if (courseThumbnail != null && !courseThumbnail.isBlank()) {
            cardContent.append("<div style=\"border-radius: 8px 8px 0 0; overflow: hidden; max-height: 220px; background: #0f172a;\">")
                    .append("<img src=\"").append(courseThumbnail).append("\" alt=\"").append(courseName)
                    .append("\" style=\"width: 100%; max-height: 220px; object-fit: cover; display: block; border: 0;\" />")
                    .append("</div>");
        } else {
            cardContent.append("<div style=\"border-radius: 8px 8px 0 0; background: linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%); padding: 36px 20px; text-align: center; color: #ffffff;\">")
                    .append("<div style=\"font-size: 42px; margin-bottom: 8px;\">🎓</div>")
                    .append("<div style=\"font-size: 16px; font-weight: 700; opacity: 0.95;\">OneTutor Learning Course</div>")
                    .append("</div>");
        }

        // Card details
        cardContent.append("<div style=\"background: #faf5ff; border: 1px solid #e9d5ff; border-top: none; border-radius: 0 0 8px 8px; padding: 20px 24px;\">")
                .append("<h3 style=\"margin: 0 0 10px 0; font-size: 18px; font-weight: 800; color: #1e1b4b;\">").append(courseName).append("</h3>")
                .append("<div style=\"margin-bottom: 12px;\">");

        if (categoryName != null && !categoryName.isBlank()) {
            cardContent.append("<span style=\"display: inline-block; background: #f3e8ff; color: #7e22ce; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 9999px; margin-right: 6px; margin-bottom: 4px;\">📚 ").append(categoryName).append("</span>");
        }
        if (batchName != null && !batchName.isBlank()) {
            cardContent.append("<span style=\"display: inline-block; background: #ecfdf5; color: #065f46; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 9999px; margin-bottom: 4px;\">👥 ").append(batchName).append("</span>");
        }

        cardContent.append("</div>")
                .append("<div style=\"font-size: 13px; color: #6b7280; line-height: 1.6;\">")
                .append("<span style=\"color: #059669; font-weight: 600;\">✓ Full Lifetime Access</span> &nbsp;•&nbsp; ")
                .append("<span>✓ Self-Paced Learning</span> &nbsp;•&nbsp; ")
                .append("<span>✓ Community Support</span>")
                .append("</div>")
                .append("</div>");

        String batchSentence = (batchName != null && !batchName.isBlank()) ? " You are enrolled in cohort <strong>" + batchName + "</strong>." : "";

        String contentHtml = "<p style=\"font-size: 15px; line-height: 1.6; color: #374151; margin: 0 0 20px 0;\">" +
                "Congratulations! You have successfully enrolled in <strong>" + courseName + "</strong>." +
                batchSentence +
                " All course lectures, sections, and community discussion rooms are now available to you." +
                "</p>" +
                cardContent.toString() +
                "<div style=\"text-align: center; margin: 32px 0 24px 0;\">" +
                "  <a href=\"" + courseUrl + "\" style=\"display: inline-block; background: #7e22ce; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 16px; padding: 14px 36px; border-radius: 8px; box-shadow: 0 4px 14px rgba(126, 34, 206, 0.3);\">Start Learning Now →</a>" +
                "</div>" +
                "<div style=\"background: #f9fafb; border: 1px solid #f3f4f6; border-radius: 8px; padding: 18px 20px; margin-top: 24px;\">" +
                "  <div style=\"font-size: 13px; font-weight: 700; color: #111827; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;\">💡 Tips for Success in Your Course</div>" +
                "  <ul style=\"margin: 0; padding-left: 18px; font-size: 13px; color: #4b5563; line-height: 1.7;\">" +
                "    <li><strong>Learn at your own pace:</strong> Watch lessons anytime, anywhere on mobile or desktop.</li>" +
                "    <li><strong>Engage with the Community:</strong> Ask questions, share insights, and learn with peers.</li>" +
                "    <li><strong>Track your milestones:</strong> Check off completed lectures to keep your momentum going.</li>" +
                "  </ul>" +
                "</div>" +
                "<p style=\"font-size: 12px; color: #9ca3af; margin-top: 24px; line-height: 1.5;\">" +
                "Direct Course Link: <a href=\"" + courseUrl + "\" style=\"color: #7e22ce; word-break: break-all;\">" + courseUrl + "</a>" +
                "</p>";

        String html = buildEmailLayout("Course Enrollment Confirmed 🎉", "Hi " + studentName, contentHtml);

        String text = "Hi " + studentName + ",\n\n"
                + "Congratulations! You have successfully enrolled in " + courseName + ".\n"
                + (batchName != null && !batchName.isBlank() ? "Cohort / Batch: " + batchName + "\n" : "")
                + "\nYou can start learning right away by visiting:\n" + courseUrl + "\n\n"
                + "Happy learning,\nOneTutor Academy Team";

        send(toEmail, subject, html, text);
    }

    @Override
    public void sendTestEmail(String toEmail) {
        String subject = "OneTutor SMTP Test Email";
        String html = buildEmailLayout(
                "SMTP Email Configuration Active",
                "Hello Admin",
                "<p style=\"font-size: 15px; line-height: 1.6; color: #374151; margin-bottom: 16px;\">" +
                "Congratulations! Your OneTutor email service has been configured successfully." +
                "</p>" +
                "<div style=\"background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; padding: 16px; margin: 18px 0; color: #065f46;\">" +
                "  <strong>✓ SMTP Handshake & TLS Verified</strong><br>" +
                "  All authentication emails (login OTP, registration verification, password resets) are operational." +
                "</div>"
        );
        send(toEmail, subject, html, "Your OneTutor email setup is active and working.");
    }

    @Override
    public void sendContactReplyEmail(String toEmail, String toName, String inquirySubject, String originalMessage, String replyMessage, String adminName) {
        String greeting = (toName != null && !toName.isBlank()) ? "Hi " + toName : "Hello";
        String subject = "Re: " + (inquirySubject != null && !inquirySubject.isBlank() ? inquirySubject : "Your OneTutor Inquiry");
        String sender = (adminName != null && !adminName.isBlank()) ? adminName + " (OneTutor Support)" : "OneTutor Support Specialist";

        String safeOriginal = originalMessage != null ? originalMessage.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br/>") : "";
        String safeReply = replyMessage != null ? replyMessage.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br/>") : "";

        String content = "<p style=\"font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 18px;\">" +
                "Thank you for contacting OneTutor. Our support team has reviewed your inquiry and replied to your message:" +
                "</p>" +
                "<div style=\"margin: 20px 0; padding: 18px 20px; background: #f8fafc; border-left: 4px solid #5A70D3; border-radius: 8px;\">" +
                "  <div style=\"font-size: 12px; font-weight: 700; color: #5A70D3; text-transform: uppercase; margin-bottom: 8px;\">Response from " + sender + "</div>" +
                "  <div style=\"font-size: 15px; color: #0b1f3a; line-height: 1.6;\">" + safeReply + "</div>" +
                "</div>" +
                "<div style=\"margin: 24px 0 16px 0; padding: 16px; background: #f1f5f9; border-radius: 8px;\">" +
                "  <div style=\"font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 6px;\">Your Inquiry</div>" +
                "  <div style=\"font-size: 13px; color: #475569; font-style: italic; line-height: 1.5;\">" + safeOriginal + "</div>" +
                "</div>" +
                "<p style=\"font-size: 13px; color: #64748b; line-height: 1.5; margin-top: 20px;\">" +
                "Need additional assistance? Visit our <a href=\"http://localhost:5173/help-center\" style=\"color: #5A70D3; font-weight: 600;\">Help Center</a> or submit another question at any time." +
                "</p>";

        String html = buildEmailLayout(
                "OneTutor Support Reply",
                greeting,
                content
        );

        send(toEmail, subject, html, "Response from OneTutor Support:\n\n" + replyMessage);
    }

    private void logConsoleOtp(String toEmail, String otp, String purpose) {
        log.info("=================================================================");
        log.info(">>> [ONE-TIME PASSWORD] FOR {}: {} (Purpose: {})", toEmail, otp, purpose);
        log.info("=================================================================");
    }

    private void send(String to, String subject, String htmlContent, String textFallback) {
        if (!mailConfigured) {
            log.info("[DEV EMAIL] To: {} | Subject: {} | Fallback:\n{}", to, subject, textFallback);
            return;
        }

        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, StandardCharsets.UTF_8.name());

            try {
                helper.setFrom(fromAddress, senderName);
            } catch (UnsupportedEncodingException e) {
                helper.setFrom(fromAddress);
            }

            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(textFallback, htmlContent);

            mailSender.send(mimeMessage);
            log.info("[SMTP SUCCESS] Email successfully dispatched to: {} | Subject: {}", to, subject);
        } catch (Exception e) {
            log.error("[SMTP ERROR] Failed to send email to {}: {}", to, e.getMessage(), e);
            throw new RuntimeException("Email delivery failed: " + e.getMessage(), e);
        }
    }

    private String buildOtpEmailLayout(String headerTitle, String greeting, String action, String otp) {
        return buildEmailLayout(
                headerTitle,
                greeting,
                "<p style=\"font-size: 15px; line-height: 1.6; color: #374151; margin-bottom: 20px;\">" +
                "Use the one-time verification code below to " + action + ":" +
                "</p>" +
                "<div style=\"text-align: center; margin: 26px 0;\">" +
                "  <div style=\"display: inline-block; background: #faf5ff; border: 2px dashed #9333ea; border-radius: 10px; padding: 14px 32px;\">" +
                "    <span style=\"font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #7e22ce;\">" + otp + "</span>" +
                "  </div>" +
                "</div>" +
                "<p style=\"font-size: 13px; color: #6b7280; text-align: center; margin-top: 10px;\">" +
                "⏰ <strong>Valid for 10 minutes.</strong> Never share this code with anyone." +
                "</p>" +
                "<p style=\"font-size: 12px; color: #9ca3af; margin-top: 24px; border-top: 1px solid #f3f4f6; padding-top: 16px;\">" +
                "If you did not request this verification code, please ignore this email or review your account security." +
                "</p>"
        );
    }

    private String buildEmailLayout(String headerTitle, String greeting, String contentHtml) {
        return "<!DOCTYPE html>" +
                "<html lang=\"en\">" +
                "<head><meta charset=\"UTF-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"></head>" +
                "<body style=\"margin: 0; padding: 30px 10px; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;\">" +
                "  <table align=\"center\" border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\" style=\"max-width: 560px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);\">" +
                "    <!-- Header -->" +
                "    <tr>" +
                "      <td style=\"background: linear-gradient(135deg, #1e1b4b 0%, #3b0764 50%, #581c87 100%); padding: 28px 32px; text-align: left;\">" +
                "        <table width=\"100%\" border=\"0\" cellpadding=\"0\" cellspacing=\"0\">" +
                "          <tr>" +
                "            <td style=\"font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;\">" +
                "              <span style=\"color: #c084fc;\">One</span>Tutor" +
                "            </td>" +
                "            <td align=\"right\" style=\"color: rgba(255,255,255,0.7); font-size: 13px; font-weight: 500;\">" +
                "              Secure Learning" +
                "            </td>" +
                "          </tr>" +
                "        </table>" +
                "      </td>" +
                "    </tr>" +
                "    <!-- Content -->" +
                "    <tr>" +
                "      <td style=\"padding: 32px 32px 28px 32px;\">" +
                "        <h2 style=\"margin: 0 0 16px 0; font-size: 19px; font-weight: 700; color: #111827;\">" + headerTitle + "</h2>" +
                "        <p style=\"font-size: 15px; color: #374151; font-weight: 600; margin: 0 0 16px 0;\">" + greeting + ",</p>" +
                "        " + contentHtml +
                "      </td>" +
                "    </tr>" +
                "    <!-- Footer -->" +
                "    <tr>" +
                "      <td style=\"background-color: #f9fafb; border-top: 1px solid #f3f4f6; padding: 20px 32px; text-align: center; font-size: 12px; color: #9ca3af;\">" +
                "        © " + java.time.Year.now().getValue() + " OneTutor Academy. All rights reserved.<br>" +
                "        This is an automated security message. Please do not reply directly to this email." +
                "      </td>" +
                "    </tr>" +
                "  </table>" +
                "</body>" +
                "</html>";
    }
}
