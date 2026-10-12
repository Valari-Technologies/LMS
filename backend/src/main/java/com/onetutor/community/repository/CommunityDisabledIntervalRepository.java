package com.onetutor.community.repository;

import com.onetutor.community.entity.CommunityDisabledInterval;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CommunityDisabledIntervalRepository extends JpaRepository<CommunityDisabledInterval, Long> {

    Optional<CommunityDisabledInterval> findByCourseIdAndUserIdAndEnabledAtIsNull(Long courseId, Long userId);

    List<CommunityDisabledInterval> findByCourseIdAndUserId(Long courseId, Long userId);
}
