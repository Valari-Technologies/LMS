package com.onetutor.contents.repository;

import com.onetutor.contents.entity.ContentResource;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ContentResourceRepository extends JpaRepository<ContentResource, Long> {
    List<ContentResource> findByContentIdOrderByDisplayOrderAsc(Long contentId);
    void deleteByContentId(Long contentId);
}
