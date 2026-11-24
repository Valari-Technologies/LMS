package com.onetutor.community.repository;

import com.onetutor.community.entity.TutorDoubtMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TutorDoubtMessageRepository extends JpaRepository<TutorDoubtMessage, Long> {

    /** Paginated messages for a course-student doubt thread. */
    Page<TutorDoubtMessage> findByCourseIdAndStudentIdOrderByCreatedAtAsc(
            Long courseId, Long studentId, Pageable pageable);

    /** Polling: messages newer than afterId for a course-student doubt thread. */
    List<TutorDoubtMessage> findByCourseIdAndStudentIdAndIdGreaterThanOrderByCreatedAtAsc(
            Long courseId, Long studentId, Long afterId);

    /** Find maximum message id for a course-student thread. */
    @Query("SELECT MAX(m.id) FROM TutorDoubtMessage m WHERE m.course.id = :courseId AND m.student.id = :studentId AND m.deleted = false")
    Optional<Long> findMaxIdByCourseIdAndStudentId(
            @Param("courseId") Long courseId,
            @Param("studentId") Long studentId);

    /** Distinct students who have participated in doubts for a given course. */
    @Query("SELECT DISTINCT m.student.id FROM TutorDoubtMessage m WHERE m.course.id = :courseId")
    List<Long> findDistinctStudentIdsByCourseId(@Param("courseId") Long courseId);

    /** Latest message in a course-student doubt thread. */
    Optional<TutorDoubtMessage> findFirstByCourseIdAndStudentIdOrderByCreatedAtDesc(
            Long courseId, Long studentId);

    /** Count unread messages in a thread for a user. */
    @Query("SELECT COUNT(m) FROM TutorDoubtMessage m " +
           "WHERE m.course.id = :courseId AND m.student.id = :studentId AND m.deleted = false AND m.id > :lastReadId AND m.sender.id <> :userId")
    long countUnreadMessages(
            @Param("courseId") Long courseId,
            @Param("studentId") Long studentId,
            @Param("lastReadId") Long lastReadId,
            @Param("userId") Long userId);

    /** Count total unread replies for a student across all their enrolled courses. */
    @Query(value = "SELECT COUNT(m.id) " +
                   "FROM tutor_doubt_messages m " +
                   "LEFT JOIN tutor_doubt_read_status r ON r.course_id = m.course_id AND r.student_id = m.student_id AND r.user_id = :studentId " +
                   "WHERE m.deleted = false " +
                   "  AND m.student_id = :studentId " +
                   "  AND m.sender_id <> :studentId " +
                   "  AND m.id > COALESCE(r.last_read_message_id, 0)",
           nativeQuery = true)
    long countTotalUnreadForStudent(@Param("studentId") Long studentId);

    /** Count total unread doubts for tutors/admins across all courses. */
    @Query(value = "SELECT COUNT(m.id) " +
                   "FROM tutor_doubt_messages m " +
                   "LEFT JOIN tutor_doubt_read_status r ON r.course_id = m.course_id AND r.student_id = m.student_id AND r.user_id = :tutorId " +
                   "WHERE m.deleted = false " +
                   "  AND m.sender_id = m.student_id " +
                   "  AND m.id > COALESCE(r.last_read_message_id, 0)",
           nativeQuery = true)
    long countTotalUnreadForTutor(@Param("tutorId") Long tutorId);
}
