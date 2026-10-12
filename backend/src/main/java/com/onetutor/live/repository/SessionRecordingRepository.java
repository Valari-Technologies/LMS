package com.onetutor.live.repository;

import com.onetutor.live.entity.SessionRecording;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SessionRecordingRepository extends JpaRepository<SessionRecording, Long> {
    List<SessionRecording> findBySessionId(Long sessionId);
}
