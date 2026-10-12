package com.onetutor.coupons.dto;

import com.onetutor.categories.entity.Category;
import com.onetutor.courses.entity.Course;
import com.onetutor.coupons.entity.Coupon;
import com.onetutor.coupons.entity.CouponScope;
import com.onetutor.coupons.entity.DiscountType;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collections;
import java.util.List;

public record CouponResponse(
        Long id,
        String code,
        DiscountType discountType,
        BigDecimal discountValue,
        CouponScope scope,
        Long categoryId,
        String categoryName,
        Long courseId,
        String courseName,
        List<Long> categoryIds,
        List<String> categoryNames,
        List<Long> courseIds,
        BigDecimal minPurchaseAmount,
        BigDecimal maxDiscountAmount,
        Instant startDate,
        Instant expiryDate,
        Integer usageLimit,
        int usedCount,
        int perUserLimit,
        boolean active,
        String description,
        boolean expired,
        String createdByName,
        Instant createdAt,
        Instant updatedAt
) {
    public static CouponResponse from(Coupon coupon) {
        boolean isExpired = coupon.getExpiryDate() != null && coupon.getExpiryDate().isBefore(Instant.now());
        String creatorName = coupon.getCreatedBy() != null ? coupon.getCreatedBy().getName() : null;

        Long catId = coupon.getCategory() != null ? coupon.getCategory().getId() : null;
        String catName = coupon.getCategory() != null ? coupon.getCategory().getName() : null;
        if (coupon.getScope() == CouponScope.ALL_CATEGORIES && catName == null) {
            catName = "All Categories";
        }
        Long crsId = coupon.getCourse() != null ? coupon.getCourse().getId() : null;
        String crsName = coupon.getCourse() != null ? coupon.getCourse().getName() : null;

        List<Long> catIds = (coupon.getApplicableCategories() != null && !coupon.getApplicableCategories().isEmpty())
                ? coupon.getApplicableCategories().stream().map(Category::getId).toList()
                : (catId != null ? List.of(catId) : Collections.emptyList());

        List<String> catNames = (coupon.getApplicableCategories() != null && !coupon.getApplicableCategories().isEmpty())
                ? coupon.getApplicableCategories().stream().map(Category::getName).toList()
                : (catName != null ? List.of(catName) : Collections.emptyList());

        List<Long> crsIds = (coupon.getApplicableCourses() != null && !coupon.getApplicableCourses().isEmpty())
                ? coupon.getApplicableCourses().stream().map(Course::getId).toList()
                : (crsId != null ? List.of(crsId) : Collections.emptyList());

        return new CouponResponse(
                coupon.getId(),
                coupon.getCode(),
                coupon.getDiscountType(),
                coupon.getDiscountValue(),
                coupon.getScope() != null ? coupon.getScope() : CouponScope.ALL_COURSES,
                catId,
                catName,
                crsId,
                crsName,
                catIds,
                catNames,
                crsIds,
                coupon.getMinPurchaseAmount(),
                coupon.getMaxDiscountAmount(),
                coupon.getStartDate(),
                coupon.getExpiryDate(),
                coupon.getUsageLimit(),
                coupon.getUsedCount(),
                coupon.getPerUserLimit(),
                coupon.isActive(),
                coupon.getDescription(),
                isExpired,
                creatorName,
                coupon.getCreatedAt(),
                coupon.getUpdatedAt()
        );
    }
}
