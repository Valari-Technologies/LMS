package com.onetutor.community.repository;

import com.onetutor.community.entity.TutorDoubtReadStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TutorDoubtReadStatusRepository extends JpaRepository<TutorDoubtReadStatus, Long> {

    Optional<TutorDoubtReadStatus> findByUserIdAndCourseIdAndStudentId(
            Long userId, Long courseId, Long studentId);
}
