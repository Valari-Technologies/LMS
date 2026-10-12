package com.onetutor.auth.repository;

import com.onetutor.auth.entity.EmailOtp;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EmailOtpRepository extends JpaRepository<EmailOtp, Long> {

    Optional<EmailOtp> findTopByEmailIgnoreCaseAndPurposeAndUsedAtIsNullOrderByCreatedAtDesc(String email, String purpose);

    List<EmailOtp> findByEmailIgnoreCaseAndPurposeAndUsedAtIsNull(String email, String purpose);
}
