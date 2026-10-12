package com.onetutor.coupons.service;

import com.onetutor.categories.entity.Category;
import com.onetutor.categories.repository.CategoryRepository;
import com.onetutor.common.exceptions.BadRequestException;
import com.onetutor.common.exceptions.ConflictException;
import com.onetutor.common.exceptions.NotFoundException;
import com.onetutor.courses.entity.Course;
import com.onetutor.courses.repository.CourseRepository;
import com.onetutor.coupons.dto.CouponRequest;
import com.onetutor.coupons.dto.CouponResponse;
import com.onetutor.coupons.dto.CouponValidateRequest;
import com.onetutor.coupons.dto.CouponValidateResponse;
import com.onetutor.coupons.entity.Coupon;
import com.onetutor.coupons.entity.CouponRedemption;
import com.onetutor.coupons.entity.CouponScope;
import com.onetutor.coupons.entity.DiscountType;
import com.onetutor.coupons.repository.CouponRedemptionRepository;
import com.onetutor.coupons.repository.CouponRepository;
import com.onetutor.users.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class CouponService {

    private final CouponRepository couponRepository;
    private final CouponRedemptionRepository couponRedemptionRepository;
    private final CategoryRepository categoryRepository;
    private final CourseRepository courseRepository;

    @Transactional(readOnly = true)
    public Page<CouponResponse> getCoupons(String search, Boolean active, Pageable pageable) {
        String cleanSearch = (search != null && !search.trim().isEmpty()) ? search.trim() : null;
        Page<Coupon> page;

        if (cleanSearch != null && active != null) {
            page = couponRepository.searchByActiveAndText(active, cleanSearch, pageable);
        } else if (cleanSearch != null) {
            page = couponRepository.searchByText(cleanSearch, pageable);
        } else if (active != null) {
            page = couponRepository.findByActiveOrderByCreatedAtDesc(active, pageable);
        } else {
            page = couponRepository.findAllByOrderByCreatedAtDesc(pageable);
        }

        return page.map(CouponResponse::from);
    }

    @Transactional(readOnly = true)
    public CouponResponse getCouponById(Long id) {
        Coupon coupon = couponRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("COUPON_NOT_FOUND", "Coupon not found with ID: " + id));
        return CouponResponse.from(coupon);
    }

    @Transactional(readOnly = true)
    public List<CouponResponse> getActiveAvailableCoupons() {
        return couponRepository.findActiveAvailableCoupons(Instant.now())
                .stream()
                .map(CouponResponse::from)
                .toList();
    }

    @Transactional
    public CouponResponse createCoupon(CouponRequest req, User creator) {
        String normalizedCode = req.code().trim().toUpperCase();

        if (couponRepository.existsByCodeIgnoreCase(normalizedCode)) {
            throw new ConflictException("COUPON_CODE_EXISTS", "A coupon with code '" + normalizedCode + "' already exists.");
        }

        validateDiscountConstraints(req);

        CouponScope scope = req.scope() != null ? req.scope() : CouponScope.ALL_COURSES;
        Category category = null;
        Course course = null;
        Set<Category> categories = new HashSet<>();
        Set<Course> courses = new HashSet<>();

        if (scope == CouponScope.ALL_CATEGORIES) {
            categories.addAll(categoryRepository.findAll());
        } else if (scope == CouponScope.CATEGORY) {
            if (req.categoryIds() != null && !req.categoryIds().isEmpty()) {
                for (Long cId : req.categoryIds()) {
                    categoryRepository.findById(cId).ifPresent(categories::add);
                }
                if (!categories.isEmpty()) {
                    category = categories.iterator().next();
                }
            } else if (req.categoryId() != null) {
                final Long targetCatId = req.categoryId();
                category = categoryRepository.findById(targetCatId)
                        .orElseThrow(() -> new NotFoundException("CATEGORY_NOT_FOUND", "Category not found with ID: " + targetCatId));
                categories.add(category);
            }
        } else if (scope == CouponScope.COURSE) {
            Long crsId = req.courseId();
            if (crsId == null && req.courseIds() != null && !req.courseIds().isEmpty()) {
                crsId = req.courseIds().get(0);
            }
            if (crsId != null) {
                final Long targetCrsId = crsId;
                course = courseRepository.findById(targetCrsId)
                        .orElseThrow(() -> new NotFoundException("COURSE_NOT_FOUND", "Course not found with ID: " + targetCrsId));
                courses.add(course);
            }
            if (req.courseIds() != null) {
                for (Long cId : req.courseIds()) {
                    courseRepository.findById(cId).ifPresent(courses::add);
                }
            }
        }

        Coupon coupon = Coupon.builder()
                .code(normalizedCode)
                .discountType(req.discountType())
                .discountValue(req.discountValue())
                .scope(scope)
                .category(category)
                .course(course)
                .applicableCategories(categories)
                .applicableCourses(courses)
                .minPurchaseAmount(req.minPurchaseAmount() != null ? req.minPurchaseAmount() : BigDecimal.ZERO)
                .maxDiscountAmount(req.maxDiscountAmount())
                .startDate(req.startDate())
                .expiryDate(req.expiryDate())
                .usageLimit(req.usageLimit())
                .perUserLimit(req.perUserLimit() != null && req.perUserLimit() > 0 ? req.perUserLimit() : 1)
                .active(req.active() != null ? req.active() : true)
                .description(req.description())
                .createdBy(creator)
                .usedCount(0)
                .build();

        Coupon saved = couponRepository.save(coupon);
        log.info("Created coupon {} (ID: {}, Scope: {}) by user: {}", saved.getCode(), saved.getId(), saved.getScope(), creator != null ? creator.getEmail() : "system");
        return CouponResponse.from(saved);
    }

    @Transactional
    public CouponResponse updateCoupon(Long id, CouponRequest req) {
        Coupon coupon = couponRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("COUPON_NOT_FOUND", "Coupon not found with ID: " + id));

        String normalizedCode = req.code().trim().toUpperCase();
        if (couponRepository.existsByCodeIgnoreCaseAndIdNot(normalizedCode, id)) {
            throw new ConflictException("COUPON_CODE_EXISTS", "Another coupon with code '" + normalizedCode + "' already exists.");
        }

        validateDiscountConstraints(req);

        CouponScope scope = req.scope() != null ? req.scope() : CouponScope.ALL_COURSES;
        Category category = null;
        Course course = null;
        Set<Category> categories = new HashSet<>();
        Set<Course> courses = new HashSet<>();

        if (scope == CouponScope.ALL_CATEGORIES) {
            categories.addAll(categoryRepository.findAll());
        } else if (scope == CouponScope.CATEGORY) {
            if (req.categoryIds() != null && !req.categoryIds().isEmpty()) {
                for (Long cId : req.categoryIds()) {
                    categoryRepository.findById(cId).ifPresent(categories::add);
                }
                if (!categories.isEmpty()) {
                    category = categories.iterator().next();
                }
            } else if (req.categoryId() != null) {
                final Long targetCatId = req.categoryId();
                category = categoryRepository.findById(targetCatId)
                        .orElseThrow(() -> new NotFoundException("CATEGORY_NOT_FOUND", "Category not found with ID: " + targetCatId));
                categories.add(category);
            }
        } else if (scope == CouponScope.COURSE) {
            Long crsId = req.courseId();
            if (crsId == null && req.courseIds() != null && !req.courseIds().isEmpty()) {
                crsId = req.courseIds().get(0);
            }
            if (crsId != null) {
                final Long targetCrsId = crsId;
                course = courseRepository.findById(targetCrsId)
                        .orElseThrow(() -> new NotFoundException("COURSE_NOT_FOUND", "Course not found with ID: " + targetCrsId));
                courses.add(course);
            }
            if (req.courseIds() != null) {
                for (Long cId : req.courseIds()) {
                    courseRepository.findById(cId).ifPresent(courses::add);
                }
            }
        }

        coupon.setCode(normalizedCode);
        coupon.setDiscountType(req.discountType());
        coupon.setDiscountValue(req.discountValue());
        coupon.setScope(scope);
        coupon.setCategory(category);
        coupon.setCourse(course);
        coupon.setApplicableCategories(categories);
        coupon.setApplicableCourses(courses);
        coupon.setMinPurchaseAmount(req.minPurchaseAmount() != null ? req.minPurchaseAmount() : BigDecimal.ZERO);
        coupon.setMaxDiscountAmount(req.maxDiscountAmount());
        coupon.setStartDate(req.startDate());
        coupon.setExpiryDate(req.expiryDate());
        coupon.setUsageLimit(req.usageLimit());
        if (req.perUserLimit() != null && req.perUserLimit() > 0) {
            coupon.setPerUserLimit(req.perUserLimit());
        }
        if (req.active() != null) {
            coupon.setActive(req.active());
        }
        coupon.setDescription(req.description());

        Coupon updated = couponRepository.save(coupon);
        log.info("Updated coupon {} (ID: {}, Scope: {})", updated.getCode(), updated.getId(), updated.getScope());
        return CouponResponse.from(updated);
    }

    @Transactional
    public CouponResponse toggleCouponStatus(Long id, Boolean active) {
        Coupon coupon = couponRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("COUPON_NOT_FOUND", "Coupon not found with ID: " + id));

        boolean newStatus = (active != null) ? active : !coupon.isActive();
        coupon.setActive(newStatus);
        Coupon updated = couponRepository.save(coupon);
        log.info("Toggled coupon {} (ID: {}) active state to: {}", updated.getCode(), updated.getId(), newStatus);
        return CouponResponse.from(updated);
    }

    @Transactional
    public void deleteCoupon(Long id) {
        Coupon coupon = couponRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("COUPON_NOT_FOUND", "Coupon not found with ID: " + id));

        couponRepository.delete(coupon);
        log.info("Deleted coupon {} (ID: {})", coupon.getCode(), id);
    }

    @Transactional(readOnly = true)
    public CouponValidateResponse validateCoupon(CouponValidateRequest req, User user) {
        if (req.code() == null || req.code().trim().isEmpty()) {
            return CouponValidateResponse.invalid("Please provide a valid coupon code.");
        }

        String normalizedCode = req.code().trim().toUpperCase();
        Coupon coupon = couponRepository.findByCodeIgnoreCase(normalizedCode)
                .orElse(null);

        if (coupon == null || !coupon.isActive()) {
            return CouponValidateResponse.invalid("Coupon '" + normalizedCode + "' is invalid or inactive.");
        }

        Instant now = Instant.now();
        if (coupon.getStartDate() != null && now.isBefore(coupon.getStartDate())) {
            return CouponValidateResponse.invalid("Coupon '" + normalizedCode + "' is not active yet.");
        }

        if (coupon.getExpiryDate() != null && now.isAfter(coupon.getExpiryDate())) {
            return CouponValidateResponse.invalid("Coupon '" + normalizedCode + "' has expired.");
        }

        if (coupon.getUsageLimit() != null && coupon.getUsedCount() >= coupon.getUsageLimit()) {
            return CouponValidateResponse.invalid("Coupon '" + normalizedCode + "' usage limit has been reached.");
        }

        BigDecimal originalAmount = req.amount() != null ? req.amount() : BigDecimal.ZERO;
        if (originalAmount.compareTo(BigDecimal.ZERO) <= 0) {
            return CouponValidateResponse.invalid("Coupons can only be applied to paid courses.");
        }

        if (coupon.getMinPurchaseAmount() != null && originalAmount.compareTo(coupon.getMinPurchaseAmount()) < 0) {
            return CouponValidateResponse.invalid("Minimum purchase amount of ₹" + coupon.getMinPurchaseAmount() + " required to use this coupon.");
        }

        // Scope validation: Category, All Categories, or Course
        if (coupon.getScope() == CouponScope.ALL_CATEGORIES) {
            if (req.courseId() != null) {
                Course course = courseRepository.findById(req.courseId()).orElse(null);
                if (course != null && course.getCategory() == null) {
                    return CouponValidateResponse.invalid("This coupon only applies to categorized courses.");
                }
            }
        } else if (coupon.getScope() == CouponScope.CATEGORY) {
            if (req.courseId() == null) {
                return CouponValidateResponse.invalid("This coupon is restricted to specific course categories. Please select a valid course.");
            }
            Course course = courseRepository.findById(req.courseId()).orElse(null);
            if (course == null) {
                return CouponValidateResponse.invalid("Course could not be verified for category-based coupon application.");
            }
            Long courseCatId = course.getCategory() != null ? course.getCategory().getId() : null;
            boolean matches = false;
            if (coupon.getCategory() != null && coupon.getCategory().getId().equals(courseCatId)) {
                matches = true;
            } else if (coupon.getApplicableCategories() != null && !coupon.getApplicableCategories().isEmpty()) {
                matches = coupon.getApplicableCategories().stream().anyMatch(cat -> cat.getId().equals(courseCatId));
            }
            if (!matches) {
                String allowedCatName = coupon.getCategory() != null ? coupon.getCategory().getName() : "the designated categories";
                return CouponValidateResponse.invalid("Coupon '" + normalizedCode + "' is only valid for courses in the '" + allowedCatName + "' category.");
            }
        } else if (coupon.getScope() == CouponScope.COURSE) {
            if (req.courseId() == null) {
                return CouponValidateResponse.invalid("This coupon is only valid for a specific course. Please select the eligible course.");
            }
            boolean matches = false;
            if (coupon.getCourse() != null && coupon.getCourse().getId().equals(req.courseId())) {
                matches = true;
            } else if (coupon.getApplicableCourses() != null) {
                matches = coupon.getApplicableCourses().stream().anyMatch(c -> c.getId().equals(req.courseId()));
            }
            if (!matches) {
                String allowedCourseName = coupon.getCourse() != null ? coupon.getCourse().getName() : "the designated course";
                return CouponValidateResponse.invalid("Coupon '" + normalizedCode + "' is only valid for the course '" + allowedCourseName + "'.");
            }
        }

        if (user != null) {
            long userRedemptions = couponRedemptionRepository.countByCouponIdAndUserId(coupon.getId(), user.getId());
            if (userRedemptions >= coupon.getPerUserLimit()) {
                return CouponValidateResponse.invalid("You have already used this coupon the maximum allowed times (" + coupon.getPerUserLimit() + ").");
            }
        }

        BigDecimal calculatedDiscount;
        if (coupon.getDiscountType() == DiscountType.PERCENTAGE) {
            calculatedDiscount = originalAmount.multiply(coupon.getDiscountValue())
                    .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
            if (coupon.getMaxDiscountAmount() != null && calculatedDiscount.compareTo(coupon.getMaxDiscountAmount()) > 0) {
                calculatedDiscount = coupon.getMaxDiscountAmount();
            }
        } else {
            calculatedDiscount = coupon.getDiscountValue().min(originalAmount);
        }

        BigDecimal finalPrice = originalAmount.subtract(calculatedDiscount).max(BigDecimal.ZERO);

        return new CouponValidateResponse(
                true,
                coupon.getCode(),
                coupon.getDiscountType(),
                coupon.getDiscountValue(),
                calculatedDiscount,
                finalPrice,
                "Coupon applied successfully! You saved ₹" + calculatedDiscount + ".",
                coupon.getDescription()
        );
    }

    @Transactional
    public void recordRedemption(String couponCode, User user, Long paymentId, BigDecimal discountApplied) {
        if (couponCode == null || couponCode.trim().isEmpty() || user == null) {
            return;
        }

        couponRepository.findByCodeIgnoreCase(couponCode.trim()).ifPresent(coupon -> {
            coupon.setUsedCount(coupon.getUsedCount() + 1);
            couponRepository.save(coupon);

            CouponRedemption redemption = CouponRedemption.builder()
                    .coupon(coupon)
                    .user(user)
                    .paymentId(paymentId)
                    .discountApplied(discountApplied != null ? discountApplied : BigDecimal.ZERO)
                    .build();
            couponRedemptionRepository.save(redemption);
            log.info("Recorded redemption of coupon {} by user {} for payment {}", coupon.getCode(), user.getEmail(), paymentId);
        });
    }

    private void validateDiscountConstraints(CouponRequest req) {
        if (req.discountType() == DiscountType.PERCENTAGE) {
            if (req.discountValue().compareTo(BigDecimal.valueOf(100)) > 0) {
                throw new BadRequestException("INVALID_DISCOUNT", "Percentage discount cannot exceed 100%.");
            }
        }
        if (req.startDate() != null && req.expiryDate() != null) {
            if (req.expiryDate().isBefore(req.startDate())) {
                throw new BadRequestException("INVALID_DATES", "Expiry date must be after the start date.");
            }
        }
    }
}
