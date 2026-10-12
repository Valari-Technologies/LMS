package com.onetutor.batches.repository;

import com.onetutor.batches.entity.Batch;
import com.onetutor.batches.entity.BatchStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface BatchRepository extends JpaRepository<Batch, Long> {

    List<Batch> findByCourseId(Long courseId);

    List<Batch> findByCourseIdOrderByIdAsc(Long courseId);

    List<Batch> findByCourseIdAndStatusIn(Long courseId, Collection<BatchStatus> statuses);

    Optional<Batch> findByCourseIdAndCode(Long courseId, String code);

    boolean existsByCourseIdAndCode(Long courseId, String code);

    boolean existsByCourseIdAndCodeAndIdNot(Long courseId, String code, Long id);

    Page<Batch> findByCourseId(Long courseId, Pageable pageable);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT b FROM Batch b WHERE b.id = :id")
    Optional<Batch> findByIdForUpdate(@Param("id") Long id);

    @Query("SELECT b FROM Batch b WHERE " +
           "(:courseId IS NULL OR b.course.id = :courseId) AND " +
           "(:status IS NULL OR b.status = :status)")
    Page<Batch> filterBatches(@Param("courseId") Long courseId,
                              @Param("status") BatchStatus status,
                              Pageable pageable);

    @Query("SELECT b FROM Batch b WHERE " +
           "(:courseId IS NULL OR b.course.id = :courseId) AND " +
           "(:status IS NULL OR b.status = :status) AND " +
           "(LOWER(b.name) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(b.code) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Batch> searchBatches(@Param("courseId") Long courseId,
                              @Param("status") BatchStatus status,
                              @Param("search") String search,
                              Pageable pageable);
}
