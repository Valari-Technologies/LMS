package com.onetutor.live.repository;

import com.onetutor.live.entity.SessionRecordingRating;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SessionRecordingRatingRepository extends JpaRepository<SessionRecordingRating, Long>, JpaSpecificationExecutor<SessionRecordingRating> {

    Optional<SessionRecordingRating> findByRecordingIdAndStudentId(Long recordingId, Long studentId);

    List<SessionRecordingRating> findByRecordingId(Long recordingId);

    @Query("SELECT r FROM SessionRecordingRating r JOIN FETCH r.student u WHERE r.recording.id = :recordingId ORDER BY r.createdAt DESC")
    List<SessionRecordingRating> findByRecordingIdWithStudent(@Param("recordingId") Long recordingId);

    @Query("SELECT AVG(r.rating) FROM SessionRecordingRating r WHERE r.recording.id = :recordingId AND r.status = 'published'")
    Double getAverageRatingForRecording(@Param("recordingId") Long recordingId);

    @Query("SELECT COUNT(r) FROM SessionRecordingRating r WHERE r.recording.id = :recordingId AND r.status = 'published'")
    long countPublishedByRecordingId(@Param("recordingId") Long recordingId);

    long countByRecordingId(Long recordingId);

    @Query("SELECT r FROM SessionRecordingRating r WHERE r.recording.id IN :recordingIds")
    List<SessionRecordingRating> findByRecordingIdIn(@Param("recordingIds") List<Long> recordingIds);

    @Query("SELECT AVG(r.rating) FROM SessionRecordingRating r")
    Double getOverallAverageRating();

    @Query("SELECT COUNT(r) FROM SessionRecordingRating r WHERE r.rating = 5")
    Long countFiveStarRatings();

    @Query("SELECT COUNT(DISTINCT r.student.id) FROM SessionRecordingRating r")
    Long countDistinctStudents();

    @Query("SELECT COUNT(DISTINCT r.recording.session.course.id) FROM SessionRecordingRating r")
    Long countDistinctCourses();

    @Query("SELECT COUNT(r) FROM SessionRecordingRating r WHERE r.status = 'pending' AND r.comment IS NOT NULL AND TRIM(r.comment) <> ''")
    Long countPendingRatings();
}
