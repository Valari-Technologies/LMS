package com.onetutor.coupons.repository;

import com.onetutor.coupons.entity.Coupon;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface CouponRepository extends JpaRepository<Coupon, Long> {

    Optional<Coupon> findByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCaseAndIdNot(String code, Long id);

    Page<Coupon> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<Coupon> findByActiveOrderByCreatedAtDesc(boolean active, Pageable pageable);

    @Query("SELECT c FROM Coupon c WHERE " +
           "(LOWER(c.code) LIKE LOWER(CONCAT('%', :search, '%')) OR (c.description IS NOT NULL AND LOWER(c.description) LIKE LOWER(CONCAT('%', :search, '%')))) " +
           "ORDER BY c.createdAt DESC")
    Page<Coupon> searchByText(@Param("search") String search, Pageable pageable);

    @Query("SELECT c FROM Coupon c WHERE c.active = :active AND " +
           "(LOWER(c.code) LIKE LOWER(CONCAT('%', :search, '%')) OR (c.description IS NOT NULL AND LOWER(c.description) LIKE LOWER(CONCAT('%', :search, '%')))) " +
           "ORDER BY c.createdAt DESC")
    Page<Coupon> searchByActiveAndText(@Param("active") boolean active, @Param("search") String search, Pageable pageable);

    @Query("SELECT c FROM Coupon c WHERE c.active = true AND " +
           "(c.startDate IS NULL OR c.startDate <= :now) AND " +
           "(c.expiryDate IS NULL OR c.expiryDate > :now) AND " +
           "(c.usageLimit IS NULL OR c.usedCount < c.usageLimit) " +
           "ORDER BY c.createdAt DESC")
    List<Coupon> findActiveAvailableCoupons(@Param("now") Instant now);
}
