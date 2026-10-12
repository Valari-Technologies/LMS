package com.onetutor.sections.repository;

import com.onetutor.sections.entity.Section;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SectionRepository extends JpaRepository<Section, Long> {
    List<Section> findByCourseIdOrderByDisplayOrderAsc(Long courseId);
    long countByCourseId(Long courseId);
}
