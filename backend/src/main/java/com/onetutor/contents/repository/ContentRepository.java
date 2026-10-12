package com.onetutor.contents.repository;

import com.onetutor.contents.entity.Content;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ContentRepository extends JpaRepository<Content, Long> {
    List<Content> findBySectionIdOrderByDisplayOrderAsc(Long sectionId);
    long countBySectionId(Long sectionId);

    @org.springframework.data.jpa.repository.Query("""
            SELECT c FROM Content c WHERE c.section.course.id = :courseId
            ORDER BY c.section.displayOrder ASC, c.displayOrder ASC
            """)
    List<Content> findAllByCourseIdOrdered(@org.springframework.data.repository.query.Param("courseId") Long courseId);

    long countBySectionCourseId(Long courseId);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query("UPDATE Content c SET c.subtitleProgress = :progress, c.updatedAt = :now WHERE c.id = :id")
    void updateSubtitleProgress(@org.springframework.data.repository.query.Param("id") Long id,
                                @org.springframework.data.repository.query.Param("progress") int progress,
                                @org.springframework.data.repository.query.Param("now") java.time.Instant now);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query("UPDATE Content c SET c.subtitleStatus = :status, c.subtitleProgress = :progress, c.subtitleError = null, c.updatedAt = :now WHERE c.id = :id")
    void updateSubtitleStatusAndProgress(@org.springframework.data.repository.query.Param("id") Long id,
                                         @org.springframework.data.repository.query.Param("status") com.onetutor.subtitles.entity.SubtitleStatus status,
                                         @org.springframework.data.repository.query.Param("progress") int progress,
                                         @org.springframework.data.repository.query.Param("now") java.time.Instant now);
}
