package com.onetutor.live.repository;

import com.onetutor.live.entity.LiveSession;
import com.onetutor.live.entity.LiveSessionStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface LiveSessionRepository extends JpaRepository<LiveSession, Long> {

    /**
     * Auto-complete sessions:
     * 1. If endTime is set and has passed (<= :now), mark completed.
     * 2. If endTime is not set, auto-complete only on next day (< :startOfToday).
     */
    @Modifying(clearAutomatically = true)
    @Query("UPDATE LiveSession s SET s.status = com.onetutor.live.entity.LiveSessionStatus.completed " +
           "WHERE s.status NOT IN (com.onetutor.live.entity.LiveSessionStatus.cancelled, com.onetutor.live.entity.LiveSessionStatus.completed) " +
           "AND (" +
           "  (s.endTime IS NOT NULL AND s.endTime <= :now) " +
           "  OR (s.endTime IS NULL AND s.scheduledAt < :startOfToday)" +
           ")")
    int markCompletedSessions(@Param("now") Instant now, @Param("startOfToday") Instant startOfToday);

    /**
     * Transition scheduled sessions to 'live' once their scheduled time arrives or passes,
     * as long as they have not been completed or cancelled and their end time has not passed.
     */
    @Modifying(clearAutomatically = true)
    @Query("UPDATE LiveSession s SET s.status = com.onetutor.live.entity.LiveSessionStatus.live " +
           "WHERE s.status = com.onetutor.live.entity.LiveSessionStatus.upcoming " +
           "AND s.scheduledAt <= :now " +
           "AND (s.endTime IS NULL OR s.endTime > :now)")
    int markLiveSessions(@Param("now") Instant now);

    /**
     * Revert sessions from 'live' to 'upcoming' if their scheduled time is in the future
     * (e.g. admin rescheduled the time to later).
     */
    @Modifying(clearAutomatically = true)
    @Query("UPDATE LiveSession s SET s.status = com.onetutor.live.entity.LiveSessionStatus.upcoming " +
           "WHERE s.status = com.onetutor.live.entity.LiveSessionStatus.live " +
           "AND s.scheduledAt > :now")
    int revertFutureLiveSessions(@Param("now") Instant now);

    @Query("SELECT s FROM LiveSession s WHERE (:courseId IS NULL OR s.course.id = :courseId) " +
           "AND (:status IS NULL OR s.status = :status) ORDER BY s.scheduledAt DESC")
    Page<LiveSession> filterSessions(@Param("courseId") Long courseId,
                                     @Param("status") LiveSessionStatus status,
                                     Pageable pageable);

    @Query("SELECT s FROM LiveSession s WHERE s.course.id IN :courseIds " +
           "AND s.status IN (com.onetutor.live.entity.LiveSessionStatus.upcoming, com.onetutor.live.entity.LiveSessionStatus.live) " +
           "ORDER BY s.scheduledAt ASC")
    List<LiveSession> findUpcomingByCourseIds(@Param("courseIds") List<Long> courseIds);

    @Query("SELECT s FROM LiveSession s " +
           "WHERE s.status IN (com.onetutor.live.entity.LiveSessionStatus.upcoming, com.onetutor.live.entity.LiveSessionStatus.live) " +
           "ORDER BY s.scheduledAt ASC")
    List<LiveSession> findAllUpcoming();

    @Query("SELECT DISTINCT s FROM LiveSession s " +
           "LEFT JOIN FETCH s.recordings " +
           "LEFT JOIN FETCH s.course " +
           "LEFT JOIN FETCH s.batch " +
           "WHERE s.status != com.onetutor.live.entity.LiveSessionStatus.cancelled " +
           "ORDER BY s.scheduledAt DESC")
    List<LiveSession> findAllForStudent();

    long countByStatus(LiveSessionStatus status);

    long countByScheduledAtAfterAndStatus(Instant time, LiveSessionStatus status);

    @Query("SELECT COUNT(s) FROM LiveSession s " +
           "WHERE s.status IN (com.onetutor.live.entity.LiveSessionStatus.upcoming, com.onetutor.live.entity.LiveSessionStatus.live) " +
           "AND (" +
           "  (s.endTime IS NOT NULL AND s.endTime > :now) " +
           "  OR (s.endTime IS NULL AND s.scheduledAt >= :startOfToday)" +
           ")")
    long countUpcomingAndLive(@Param("now") Instant now, @Param("startOfToday") Instant startOfToday);
}

