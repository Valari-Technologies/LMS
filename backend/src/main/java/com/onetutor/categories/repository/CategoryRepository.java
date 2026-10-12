package com.onetutor.categories.repository;

import com.onetutor.categories.entity.Category;
import com.onetutor.categories.entity.CategoryStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CategoryRepository extends JpaRepository<Category, Long> {
    Page<Category> findByStatus(CategoryStatus status, Pageable pageable);
    Page<Category> findByNameContainingIgnoreCase(String name, Pageable pageable);
    Page<Category> findByStatusAndNameContainingIgnoreCase(CategoryStatus status, String name, Pageable pageable);
}
