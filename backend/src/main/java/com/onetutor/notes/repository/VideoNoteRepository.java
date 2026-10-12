package com.onetutor.notes.repository;

import com.onetutor.notes.entity.VideoNote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface VideoNoteRepository extends JpaRepository<VideoNote, Long> {

    @Query("SELECT n FROM VideoNote n WHERE n.user.id = :userId AND n.content.id = :contentId " +
           "ORDER BY COALESCE(n.videoTimestampSeconds, 0) ASC, n.createdAt ASC")
    List<VideoNote> findByUserIdAndContentId(@Param("userId") Long userId, @Param("contentId") Long contentId);

    @Query("SELECT n FROM VideoNote n WHERE n.user.id = :userId AND n.course.id = :courseId " +
           "ORDER BY n.createdAt DESC")
    List<VideoNote> findByUserIdAndCourseId(@Param("userId") Long userId, @Param("courseId") Long courseId);

    Optional<VideoNote> findByIdAndUserId(Long id, Long userId);

    void deleteAllByUserIdAndContentId(Long userId, Long contentId);
}
