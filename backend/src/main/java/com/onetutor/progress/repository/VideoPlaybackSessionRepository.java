package com.onetutor.progress.repository;

import com.onetutor.progress.entity.VideoPlaybackSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface VideoPlaybackSessionRepository extends JpaRepository<VideoPlaybackSession, Long> {
    Optional<VideoPlaybackSession> findBySessionIdAndUserIdAndActiveTrue(String sessionId, Long userId);
    Optional<VideoPlaybackSession> findFirstByUserIdAndContentIdAndActiveTrueOrderByCreatedAtDesc(Long userId, Long contentId);
}
