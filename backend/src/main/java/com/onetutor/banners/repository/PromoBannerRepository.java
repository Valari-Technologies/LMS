package com.onetutor.banners.repository;

import com.onetutor.banners.entity.PromoBanner;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PromoBannerRepository extends JpaRepository<PromoBanner, Long> {
    Optional<PromoBanner> findFirstByActiveTrueOrderByIdAsc();
    Optional<PromoBanner> findTopByOrderByIdAsc();
    java.util.List<PromoBanner> findAllByOrderByIdDesc();
}
