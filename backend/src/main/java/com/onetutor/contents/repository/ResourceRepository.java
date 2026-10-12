package com.onetutor.contents.repository;

import com.onetutor.contents.entity.Resource;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ResourceRepository extends JpaRepository<Resource, Long> {
    List<Resource> findByContentIdOrderByDisplayOrderAsc(Long contentId);

    @Query("SELECT r FROM Resource r WHERE r.content.section.course.id = :courseId ORDER BY r.content.section.displayOrder ASC, r.content.displayOrder ASC, r.displayOrder ASC")
    List<Resource> findByCourseId(@Param("courseId") Long courseId);
}
