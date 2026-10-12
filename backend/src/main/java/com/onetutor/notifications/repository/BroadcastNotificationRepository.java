package com.onetutor.notifications.repository;

import com.onetutor.notifications.entity.BroadcastNotification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BroadcastNotificationRepository extends JpaRepository<BroadcastNotification, Long> {
    Page<BroadcastNotification> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
