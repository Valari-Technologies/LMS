package com.onetutor.live.repository;

import com.onetutor.live.entity.SessionRecordingRating;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SessionRecordingRatingRepository extends JpaRepository<SessionRecordingRating, Long> {

    Optional<SessionRecordingRating> findByRecordingIdAndStudentId(Long recordingId, Long studentId);

    List<SessionRecordingRating> findByRecordingId(Long recordingId);

    @Query("SELECT AVG(r.rating) FROM SessionRecordingRating r WHERE r.recording.id = :recordingId")
    Double getAverageRatingForRecording(@Param("recordingId") Long recordingId);

    long countByRecordingId(Long recordingId);

    @Query("SELECT r FROM SessionRecordingRating r WHERE r.recording.id IN :recordingIds")
    List<SessionRecordingRating> findByRecordingIdIn(@Param("recordingIds") List<Long> recordingIds);
}

