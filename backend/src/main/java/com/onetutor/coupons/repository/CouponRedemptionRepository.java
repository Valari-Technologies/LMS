package com.onetutor.coupons.repository;

import com.onetutor.coupons.entity.CouponRedemption;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CouponRedemptionRepository extends JpaRepository<CouponRedemption, Long> {

    long countByCouponIdAndUserId(Long couponId, Long userId);

    long countByCouponId(Long couponId);
}
