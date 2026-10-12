package com.onetutor.coupons.entity;

import com.onetutor.users.entity.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "coupon_redemptions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CouponRedemption {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "coupon_id", nullable = false)
    private Coupon coupon;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "payment_id")
    private Long paymentId;

    @Column(name = "discount_applied", nullable = false, precision = 10, scale = 2)
    @Builder.Default
    private BigDecimal discountApplied = BigDecimal.ZERO;

    @CreationTimestamp
    @Column(name = "redeemed_at", nullable = false, updatable = false)
    private Instant redeemedAt;
}
