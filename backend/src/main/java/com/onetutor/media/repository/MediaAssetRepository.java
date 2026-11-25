package com.onetutor.media.repository;

import com.onetutor.media.entity.MediaAsset;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MediaAssetRepository extends JpaRepository<MediaAsset, Long> {
    Page<MediaAsset> findByFileNameContainingIgnoreCase(String fileName, Pageable pageable);

    @Query("SELECT m FROM MediaAsset m WHERE (LOWER(m.fileName) LIKE LOWER(CONCAT('%', :search, '%')) OR (m.originalName IS NOT NULL AND LOWER(m.originalName) LIKE LOWER(CONCAT('%', :search, '%')))) AND m.status = 'active'")
    Page<MediaAsset> searchActive(@Param("search") String search, Pageable pageable);

    Page<MediaAsset> findByStatusOrderByCreatedAtDesc(String status, Pageable pageable);

    @Query("SELECT m FROM MediaAsset m LEFT JOIN m.uploadedBy u WHERE m.status = 'active' " +
           "AND (:source = 'ALL' " +
           "     OR (:source = 'ONETUTOR' AND (u IS NULL OR u.role != com.onetutor.users.entity.UserRole.student)) " +
           "     OR (:source = 'USER' AND u IS NOT NULL AND u.role = com.onetutor.users.entity.UserRole.student)) " +
           "ORDER BY m.createdAt DESC")
    Page<MediaAsset> findBySource(@Param("source") String source, Pageable pageable);

    @Query("SELECT m FROM MediaAsset m LEFT JOIN m.uploadedBy u WHERE m.status = 'active' " +
           "AND (LOWER(m.fileName) LIKE LOWER(CONCAT('%', :search, '%')) OR (m.originalName IS NOT NULL AND LOWER(m.originalName) LIKE LOWER(CONCAT('%', :search, '%')))) " +
           "AND (:source = 'ALL' " +
           "     OR (:source = 'ONETUTOR' AND (u IS NULL OR u.role != com.onetutor.users.entity.UserRole.student)) " +
           "     OR (:source = 'USER' AND u IS NOT NULL AND u.role = com.onetutor.users.entity.UserRole.student)) " +
           "ORDER BY m.createdAt DESC")
    Page<MediaAsset> searchFiltered(@Param("search") String search, @Param("source") String source, Pageable pageable);

    default Page<MediaAsset> findByFilenameContainingIgnoreCase(String filename, Pageable pageable) {
        return findByFileNameContainingIgnoreCase(filename, pageable);
    }
}
