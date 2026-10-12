package com.onetutor.community.repository;

import com.onetutor.community.entity.CommunityReadStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CommunityReadStatusRepository extends JpaRepository<CommunityReadStatus, Long> {

    Optional<CommunityReadStatus> findByUserIdAndCourseId(Long userId, Long courseId);

    List<CommunityReadStatus> findByUserId(Long userId);

    List<CommunityReadStatus> findByUserIdAndCourseIdIn(Long userId, List<Long> courseIds);
}
