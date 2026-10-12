package com.onetutor.community.repository;

import com.onetutor.community.entity.CommunityMemberStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CommunityMemberStatusRepository extends JpaRepository<CommunityMemberStatus, Long> {

    Optional<CommunityMemberStatus> findByCourseIdAndUserId(Long courseId, Long userId);

    @Query("SELECT cms.user.id FROM CommunityMemberStatus cms WHERE cms.course.id = :courseId AND cms.disabled = true")
    List<Long> findDisabledUserIdsByCourseId(@Param("courseId") Long courseId);

    @Query("SELECT cms.course.id FROM CommunityMemberStatus cms WHERE cms.user.id = :userId AND cms.disabled = true")
    List<Long> findDisabledCourseIdsByUserId(@Param("userId") Long userId);
}
