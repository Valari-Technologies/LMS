package com.onetutor.auth.repository;

import com.onetutor.auth.entity.EmailVerification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface EmailVerificationRepository extends JpaRepository<EmailVerification, Long> {
    Optional<EmailVerification> findByToken(String token);
    void deleteByUserId(Long userId);
}
