package com.onetutor.notifications.repository;

import com.onetutor.notifications.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    Page<Notification> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);
    long countByUserIdAndReadFalse(Long userId);

    @Modifying
    @Query("UPDATE Notification n SET n.read = true WHERE n.user.id = :userId")
    void markAllReadForUser(@Param("userId") Long userId);

    @Modifying
    @Query("DELETE FROM Notification n WHERE n.user.id = :userId AND n.type = com.onetutor.notifications.entity.NotificationType.COMMUNITY AND n.linkUrl = :linkUrl")
    void deleteCommunityNotificationsForUserAndLink(@Param("userId") Long userId, @Param("linkUrl") String linkUrl);
}
