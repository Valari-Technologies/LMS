package com.onetutor.batches.dto;

import com.onetutor.batches.entity.Batch;
import com.onetutor.batches.entity.BatchStatus;

import java.time.Instant;
import java.time.LocalDate;

public record BatchResponse(
        Long id,
        Long courseId,
        String courseName,
        String name,
        String code,
        int capacity,
        long enrolledCount,
        long availableSeats,
        boolean isFull,
        BatchStatus status,
        LocalDate startDate,
        LocalDate endDate,
        Instant createdAt,
        Instant updatedAt
) {
    public static BatchResponse from(Batch batch, long enrolledCount) {
        long available = Math.max(0, batch.getCapacity() - enrolledCount);
        boolean full = enrolledCount >= batch.getCapacity();
        BatchStatus effectiveStatus = batch.getStatus();
        if (full && (effectiveStatus == BatchStatus.upcoming || effectiveStatus == BatchStatus.active)) {
            effectiveStatus = BatchStatus.full;
        } else if (!full && effectiveStatus == BatchStatus.full) {
            effectiveStatus = BatchStatus.active;
        }
        return new BatchResponse(
                batch.getId(),
                batch.getCourse().getId(),
                batch.getCourse().getName(),
                batch.getName(),
                batch.getCode(),
                batch.getCapacity(),
                enrolledCount,
                available,
                full,
                effectiveStatus,
                batch.getStartDate(),
                batch.getEndDate(),
                batch.getCreatedAt(),
                batch.getUpdatedAt()
        );
    }
}
