package com.onetutor.live.repository;

import com.onetutor.live.entity.LiveSessionAttendance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LiveSessionAttendanceRepository extends JpaRepository<LiveSessionAttendance, Long> {

    Optional<LiveSessionAttendance> findBySessionIdAndStudentId(Long sessionId, Long studentId);

    List<LiveSessionAttendance> findByCourseIdAndStudentId(Long courseId, Long studentId);

    List<LiveSessionAttendance> findBySessionId(Long sessionId);

    long countByCourseIdAndStudentIdAndStatus(Long courseId, Long studentId, String status);

    @Query("SELECT a FROM LiveSessionAttendance a WHERE a.session.id IN :sessionIds AND a.student.id = :studentId")
    List<LiveSessionAttendance> findBySessionIdInAndStudentId(@Param("sessionIds") List<Long> sessionIds, @Param("studentId") Long studentId);
}

