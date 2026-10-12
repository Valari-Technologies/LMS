package com.onetutor.community.repository;

import com.onetutor.community.entity.CommunityMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CommunityMessageRepository extends JpaRepository<CommunityMessage, Long> {

    /** Initial load: latest N messages for a course. */
    Page<CommunityMessage> findByCourseIdOrderByCreatedAtAsc(
            Long courseId, Pageable pageable);

    /** Initial load for student: only messages after enrolledAt, excluding disabled intervals. */
    @Query("SELECT m FROM CommunityMessage m WHERE m.course.id = :courseId " +
           "AND m.createdAt >= :enrolledAt " +
           "AND NOT EXISTS (" +
           "    SELECT 1 FROM CommunityDisabledInterval i " +
           "    WHERE i.course.id = m.course.id " +
           "      AND i.user.id = :userId " +
           "      AND m.createdAt >= i.disabledAt " +
           "      AND (i.enabledAt IS NULL OR m.createdAt <= i.enabledAt)" +
           ") " +
           "ORDER BY m.createdAt ASC")
    Page<CommunityMessage> findFilteredMessagesForStudent(
            @Param("courseId") Long courseId,
            @Param("userId") Long userId,
            @Param("enrolledAt") java.time.Instant enrolledAt,
            Pageable pageable);

    /** Polling: messages newer than a given id for a course. */
    List<CommunityMessage> findByCourseIdAndIdGreaterThanOrderByCreatedAtAsc(
            Long courseId, Long afterId);

    /** Polling for student: only messages after enrolledAt, excluding disabled intervals. */
    @Query("SELECT m FROM CommunityMessage m WHERE m.course.id = :courseId AND m.id > :afterId " +
           "AND m.createdAt >= :enrolledAt " +
           "AND NOT EXISTS (" +
           "    SELECT 1 FROM CommunityDisabledInterval i " +
           "    WHERE i.course.id = m.course.id " +
           "      AND i.user.id = :userId " +
           "      AND m.createdAt >= i.disabledAt " +
           "      AND (i.enabledAt IS NULL OR m.createdAt <= i.enabledAt)" +
           ") " +
           "ORDER BY m.createdAt ASC")
    List<CommunityMessage> pollFilteredMessagesForStudent(
            @Param("courseId") Long courseId,
            @Param("afterId") Long afterId,
            @Param("userId") Long userId,
            @Param("enrolledAt") java.time.Instant enrolledAt);

    /** Find maximum message id for a course. */
    @Query("SELECT MAX(m.id) FROM CommunityMessage m WHERE m.course.id = :courseId AND m.deleted = false")
    Optional<Long> findMaxIdByCourseId(@Param("courseId") Long courseId);

    /** Count non-deleted messages per course — used for admin overview. */
    @Query("SELECT m.course.id, m.course.name, m.course.thumbnail, COUNT(m) " +
           "FROM CommunityMessage m WHERE m.deleted = false " +
           "GROUP BY m.course.id, m.course.name, m.course.thumbnail " +
           "ORDER BY COUNT(m) DESC")
    List<Object[]> findCourseMessageCounts();

    /** Message counts for a subset of courses — used for the student community list. */
    @Query("SELECT m.course.id, COUNT(m) FROM CommunityMessage m " +
           "WHERE m.deleted = false AND m.course.id IN :courseIds " +
           "GROUP BY m.course.id")
    List<Object[]> countMessagesByCourseIds(@Param("courseIds") List<Long> courseIds);

    /** Unread counts per course for student (excluding messages sent during disabled intervals). */
    @Query(value = "SELECT m.course_id, COUNT(m.id) " +
                   "FROM community_messages m " +
                   "LEFT JOIN community_read_status r ON r.course_id = m.course_id AND r.user_id = :userId " +
                   "WHERE m.deleted = false " +
                   "  AND m.course_id IN (:courseIds) " +
                   "  AND m.id > COALESCE(r.last_read_message_id, 0) " +
                   "  AND NOT EXISTS (" +
                   "      SELECT 1 FROM community_disabled_intervals i " +
                   "      WHERE i.course_id = m.course_id " +
                   "        AND i.user_id = :userId " +
                   "        AND m.created_at >= i.disabled_at " +
                   "        AND (i.enabled_at IS NULL OR m.created_at <= i.enabled_at)" +
                   "  ) " +
                   "GROUP BY m.course_id",
           nativeQuery = true)
    List<Object[]> countUnreadByCourseIds(@Param("userId") Long userId, @Param("courseIds") List<Long> courseIds);

    /** Unread counts for all courses (for admin). */
    @Query(value = "SELECT m.course_id, COUNT(m.id) " +
                   "FROM community_messages m " +
                   "LEFT JOIN community_read_status r ON r.course_id = m.course_id AND r.user_id = :userId " +
                   "WHERE m.deleted = false " +
                   "  AND m.id > COALESCE(r.last_read_message_id, 0) " +
                   "GROUP BY m.course_id",
           nativeQuery = true)
    List<Object[]> countAllUnreadByCourses(@Param("userId") Long userId);

    /** Count distinct courses with unread messages for student (excluding disabled intervals). */
    @Query(value = "SELECT COUNT(DISTINCT m.course_id) " +
                   "FROM community_messages m " +
                   "LEFT JOIN community_read_status r ON r.course_id = m.course_id AND r.user_id = :userId " +
                   "WHERE m.deleted = false " +
                   "  AND m.course_id IN (:courseIds) " +
                   "  AND m.id > COALESCE(r.last_read_message_id, 0) " +
                   "  AND NOT EXISTS (" +
                   "      SELECT 1 FROM community_disabled_intervals i " +
                   "      WHERE i.course_id = m.course_id " +
                   "        AND i.user_id = :userId " +
                   "        AND m.created_at >= i.disabled_at " +
                   "        AND (i.enabled_at IS NULL OR m.created_at <= i.enabled_at)" +
                   "  )",
           nativeQuery = true)
    long countUnreadCoursesForStudent(@Param("userId") Long userId, @Param("courseIds") List<Long> courseIds);

    /** Count distinct courses with unread messages for admin. */
    @Query(value = "SELECT COUNT(DISTINCT m.course_id) " +
                   "FROM community_messages m " +
                   "LEFT JOIN community_read_status r ON r.course_id = m.course_id AND r.user_id = :userId " +
                   "WHERE m.deleted = false " +
                   "  AND m.id > COALESCE(r.last_read_message_id, 0)",
           nativeQuery = true)
    long countUnreadCoursesForAdmin(@Param("userId") Long userId);

    long countByCourseIdAndDeletedFalse(Long courseId);

    /** Filtered message counts per course for student excluding disabled intervals. */
    @Query(value = "SELECT m.course_id, COUNT(m.id) " +
                   "FROM community_messages m " +
                   "WHERE m.deleted = false " +
                   "  AND m.course_id IN (:courseIds) " +
                   "  AND NOT EXISTS (" +
                   "      SELECT 1 FROM community_disabled_intervals i " +
                   "      WHERE i.course_id = m.course_id " +
                   "        AND i.user_id = :userId " +
                   "        AND m.created_at >= i.disabled_at " +
                   "        AND (i.enabled_at IS NULL OR m.created_at <= i.enabled_at)" +
                   "  ) " +
                   "GROUP BY m.course_id",
           nativeQuery = true)
    List<Object[]> countFilteredMessagesByCourseIdsForStudent(@Param("userId") Long userId, @Param("courseIds") List<Long> courseIds);

    /** Find latest message per course for all courses (used in admin overview). */
    @Query(value = "SELECT m.course_id, m.content, m.message_type " +
                   "FROM community_messages m " +
                   "INNER JOIN (" +
                   "    SELECT course_id, MAX(id) AS max_id " +
                   "    FROM community_messages " +
                   "    WHERE deleted = false " +
                   "    GROUP BY course_id" +
                   ") latest ON m.id = latest.max_id",
           nativeQuery = true)
    List<Object[]> findLatestMessagesForAllCourses();

    /** Find latest message per course for given course IDs (used in student overview, excluding disabled intervals). */
    @Query(value = "SELECT m.course_id, m.content, m.message_type " +
                   "FROM community_messages m " +
                   "INNER JOIN (" +
                   "    SELECT m2.course_id, MAX(m2.id) AS max_id " +
                   "    FROM community_messages m2 " +
                   "    WHERE m2.deleted = false AND m2.course_id IN (:courseIds) " +
                   "      AND NOT EXISTS (" +
                   "          SELECT 1 FROM community_disabled_intervals i " +
                   "          WHERE i.course_id = m2.course_id " +
                   "            AND i.user_id = :userId " +
                   "            AND m2.created_at >= i.disabled_at " +
                   "            AND (i.enabled_at IS NULL OR m2.created_at <= i.enabled_at)" +
                   "      ) " +
                   "    GROUP BY m2.course_id" +
                   ") latest ON m.id = latest.max_id",
           nativeQuery = true)
    List<Object[]> findFilteredLatestMessagesByCourseIdsForStudent(@Param("userId") Long userId, @Param("courseIds") List<Long> courseIds);
}
