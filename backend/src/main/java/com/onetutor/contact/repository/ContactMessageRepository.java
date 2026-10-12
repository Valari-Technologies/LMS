package com.onetutor.contact.repository;

import com.onetutor.contact.entity.ContactMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ContactMessageRepository extends JpaRepository<ContactMessage, Long> {

    List<ContactMessage> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<ContactMessage> findByEmailIgnoreCaseOrderByCreatedAtDesc(String email);

    Page<ContactMessage> findByStatusOrderByCreatedAtDesc(String status, Pageable pageable);

    @Query("SELECT cm FROM ContactMessage cm WHERE " +
           "(:status IS NULL OR :status = '' OR cm.status = :status) AND (" +
           ":search IS NULL OR :search = '' OR " +
           "LOWER(cm.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(cm.email) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(cm.subject) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(cm.message) LIKE LOWER(CONCAT('%', :search, '%'))" +
           ") ORDER BY cm.createdAt DESC")
    Page<ContactMessage> searchMessages(@Param("status") String status,
                                        @Param("search") String search,
                                        Pageable pageable);

    long countByStatus(String status);
}
