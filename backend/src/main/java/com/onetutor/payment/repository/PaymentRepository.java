package com.onetutor.payment.repository;

import com.onetutor.payment.entity.Payment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, Long> {

    Optional<Payment> findByTransactionId(String transactionId);

    Page<Payment> findByStudentIdOrderByCreatedAtDesc(Long studentId, Pageable pageable);

    Page<Payment> findByCourseIdOrderByCreatedAtDesc(Long courseId, Pageable pageable);

    Page<Payment> findAllByOrderByCreatedAtDesc(Pageable pageable);

    @Query("SELECT p FROM Payment p LEFT JOIN p.student s LEFT JOIN p.course c " +
           "WHERE (:search IS NULL OR LOWER(s.name) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%')) " +
           "   OR LOWER(s.email) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%')) " +
           "   OR LOWER(c.name) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%')) " +
           "   OR LOWER(p.transactionId) LIKE LOWER(CONCAT('%', CAST(:search AS string), '%'))) " +
           "ORDER BY p.createdAt DESC")
    Page<Payment> searchPayments(@Param("search") String search, Pageable pageable);

    @Query("SELECT COALESCE(SUM(p.amount), 0.0) FROM Payment p WHERE p.status = com.onetutor.payment.entity.PaymentStatus.SUCCESS")
    Double calculateTotalRevenue();

    long countByStatus(com.onetutor.payment.entity.PaymentStatus status);
}
