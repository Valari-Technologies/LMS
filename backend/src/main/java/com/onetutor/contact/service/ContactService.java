package com.onetutor.contact.service;

import com.onetutor.common.PageResponse;
import com.onetutor.common.email.EmailService;
import com.onetutor.common.exceptions.NotFoundException;
import com.onetutor.contact.dto.ContactMessageRequest;
import com.onetutor.contact.dto.ContactMessageResponse;
import com.onetutor.contact.dto.ContactReplyRequest;
import com.onetutor.contact.dto.ContactStatsResponse;
import com.onetutor.contact.entity.ContactMessage;
import com.onetutor.contact.repository.ContactMessageRepository;
import com.onetutor.notifications.entity.NotificationType;
import com.onetutor.notifications.service.NotificationService;
import com.onetutor.users.entity.User;
import com.onetutor.users.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
@Transactional
public class ContactService {

    private static final Logger log = LoggerFactory.getLogger(ContactService.class);

    private final ContactMessageRepository contactRepo;
    private final UserRepository userRepo;
    private final EmailService emailService;
    private final NotificationService notificationService;

    public ContactService(ContactMessageRepository contactRepo,
                          UserRepository userRepo,
                          EmailService emailService,
                          NotificationService notificationService) {
        this.contactRepo = contactRepo;
        this.userRepo = userRepo;
        this.emailService = emailService;
        this.notificationService = notificationService;
    }

    public ContactMessageResponse submitMessage(ContactMessageRequest req, User currentUser, HttpServletRequest request) {
        ContactMessage msg = new ContactMessage();
        msg.setName(req.name().trim());
        msg.setEmail(req.email().trim().toLowerCase());
        msg.setSubject(req.subject().trim());
        msg.setMessage(req.message().trim());
        msg.setStatus("PENDING");

        if (currentUser != null) {
            msg.setUser(currentUser);
        } else if (req.email() != null) {
            userRepo.findByEmail(req.email().trim().toLowerCase()).ifPresent(msg::setUser);
        }

        if (request != null) {
            String ip = request.getHeader("X-Forwarded-For");
            if (ip == null || ip.isBlank() || "unknown".equalsIgnoreCase(ip)) {
                ip = request.getRemoteAddr();
            }
            if (ip != null && ip.contains(",")) {
                ip = ip.split(",")[0].trim();
            }
            msg.setIpAddress(ip);
            msg.setUserAgent(request.getHeader("User-Agent"));
        }

        ContactMessage saved = contactRepo.save(msg);
        log.info("New contact message received from {} <{}>: Subject='{}'", saved.getName(), saved.getEmail(), saved.getSubject());
        return ContactMessageResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<ContactMessageResponse> getMyMessages(User user) {
        if (user == null) {
            return List.of();
        }
        List<ContactMessage> messages = contactRepo.findByUserIdOrderByCreatedAtDesc(user.getId());
        if (messages.isEmpty() && user.getEmail() != null) {
            messages = contactRepo.findByEmailIgnoreCaseOrderByCreatedAtDesc(user.getEmail());
        }
        return messages.stream().map(ContactMessageResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<ContactMessageResponse> searchAdminMessages(String status, String search, Pageable pageable) {
        Page<ContactMessage> page = contactRepo.searchMessages(
                (status == null || status.equalsIgnoreCase("ALL")) ? null : status.toUpperCase(),
                (search == null || search.isBlank()) ? null : search.trim(),
                pageable
        );
        return PageResponse.from(page.map(ContactMessageResponse::from));
    }

    @Transactional(readOnly = true)
    public ContactMessageResponse getMessageById(Long id) {
        ContactMessage msg = contactRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("MESSAGE_NOT_FOUND", "Contact message not found with ID: " + id));
        return ContactMessageResponse.from(msg);
    }

    public ContactMessageResponse replyToMessage(Long id, ContactReplyRequest replyReq, User replyingAdmin) {
        ContactMessage msg = contactRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("MESSAGE_NOT_FOUND", "Contact message not found with ID: " + id));

        msg.setReplyMessage(replyReq.replyMessage().trim());
        msg.setStatus("REPLIED");
        msg.setRepliedBy(replyingAdmin != null ? replyingAdmin.getId() : null);
        msg.setRepliedByName(replyingAdmin != null ? replyingAdmin.getName() : "Support Administrator");
        msg.setRepliedAt(Instant.now());

        ContactMessage updated = contactRepo.save(msg);
        log.info("Admin {} replied to contact message #{} ({})", msg.getRepliedByName(), msg.getId(), msg.getEmail());

        // 1. Send HTML Email via EmailService
        try {
            emailService.sendContactReplyEmail(
                    msg.getEmail(),
                    msg.getName(),
                    msg.getSubject(),
                    msg.getMessage(),
                    replyReq.replyMessage().trim(),
                    replyingAdmin != null ? replyingAdmin.getName() : "OneTutor Support Team"
            );
        } catch (Exception e) {
            log.error("Failed to send contact reply email to {}: {}", msg.getEmail(), e.getMessage());
        }

        // 2. Dispatch In-App Notification if user is registered
        try {
            Optional<User> targetUser = Optional.ofNullable(msg.getUser());
            if (targetUser.isEmpty() && msg.getEmail() != null) {
                targetUser = userRepo.findByEmail(msg.getEmail());
            }

            targetUser.ifPresent(u -> {
                String notifTitle = "Support Reply: " + msg.getSubject();
                String preview = replyReq.replyMessage().trim();
                if (preview.length() > 90) {
                    preview = preview.substring(0, 87) + "...";
                }
                notificationService.notify(
                        u,
                        notifTitle,
                        "OneTutor Support replied: " + preview,
                        NotificationType.SYSTEM,
                        null,
                        "/contact"
                );
            });
        } catch (Exception e) {
            log.error("Failed to create in-app notification for {}: {}", msg.getEmail(), e.getMessage());
        }

        return ContactMessageResponse.from(updated);
    }

    public ContactMessageResponse archiveMessage(Long id) {
        ContactMessage msg = contactRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("MESSAGE_NOT_FOUND", "Contact message not found with ID: " + id));

        if ("ARCHIVED".equalsIgnoreCase(msg.getStatus())) {
            msg.setStatus(msg.getReplyMessage() != null ? "REPLIED" : "PENDING");
        } else {
            msg.setStatus("ARCHIVED");
        }

        return ContactMessageResponse.from(contactRepo.save(msg));
    }

    public void deleteMessage(Long id) {
        if (!contactRepo.existsById(id)) {
            throw new NotFoundException("MESSAGE_NOT_FOUND", "Contact message not found with ID: " + id);
        }
        contactRepo.deleteById(id);
    }

    @Transactional(readOnly = true)
    public ContactStatsResponse getStats() {
        long total = contactRepo.count();
        long pending = contactRepo.countByStatus("PENDING");
        long replied = contactRepo.countByStatus("REPLIED");
        long archived = contactRepo.countByStatus("ARCHIVED");
        return new ContactStatsResponse(total, pending, replied, archived);
    }
}
