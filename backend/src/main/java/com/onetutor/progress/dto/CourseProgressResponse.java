package com.onetutor.progress.dto;

import java.time.Instant;
import java.util.List;

/**
 * Course/section progress per SRS section 19-20: derived from content
 * completion counts, never from total video time watched.
 */
public record CourseProgressResponse(
        Long courseId,
        int totalContents,
        int completedContents,
        double progressPercent,
        List<SectionProgress> sections,
        Instant lastAccessedAt
) {
    public CourseProgressResponse(Long courseId, int totalContents, int completedContents, double progressPercent, List<SectionProgress> sections) {
        this(courseId, totalContents, completedContents, progressPercent, sections, null);
    }

    public record SectionProgress(
            Long sectionId,
            String sectionTitle,
            int totalContents,
            int completedContents,
            double progressPercent
    ) {}
}
