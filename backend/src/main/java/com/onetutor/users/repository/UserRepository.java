package com.onetutor.users.repository;

import com.onetutor.users.entity.User;
import com.onetutor.users.entity.UserRole;
import com.onetutor.users.entity.UserStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    Page<User> findByRole(UserRole role, Pageable pageable);
    Page<User> findByRoleIn(java.util.Collection<UserRole> roles, Pageable pageable);
    java.util.List<User> findByRole(UserRole role);
    java.util.List<User> findByRoleIn(java.util.Collection<UserRole> roles);
    Page<User> findByRoleAndStatus(UserRole role, UserStatus status, Pageable pageable);
    Page<User> findByRoleInAndStatus(java.util.Collection<UserRole> roles, UserStatus status, Pageable pageable);
    java.util.List<User> findByRoleAndStatus(UserRole role, UserStatus status);
    java.util.List<User> findByRoleInAndStatus(java.util.Collection<UserRole> roles, UserStatus status);
    java.util.List<User> findByStatus(UserStatus status);

    @Query("SELECT u FROM User u WHERE u.role = :role AND (LOWER(u.name) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(u.email) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<User> searchByRoleAndText(@Param("role") UserRole role,
                                   @Param("search") String search,
                                   Pageable pageable);

    @Query("SELECT u FROM User u WHERE u.role = :role AND u.status = :status AND (LOWER(u.name) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(u.email) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<User> searchByRoleAndStatusAndText(@Param("role") UserRole role,
                                            @Param("status") UserStatus status,
                                            @Param("search") String search,
                                            Pageable pageable);

    long countByRole(UserRole role);
    long countByRoleAndStatus(UserRole role, UserStatus status);

    @Query("SELECT u FROM User u WHERE u.role = :role AND u.lastActiveAt >= :cutoff")
    Page<User> findByRoleAndOnline(@Param("role") UserRole role, @Param("cutoff") java.time.Instant cutoff, Pageable pageable);

    @Query("SELECT u FROM User u WHERE u.role = :role AND u.lastActiveAt >= :cutoff AND (LOWER(u.name) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(u.email) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<User> searchByRoleAndOnlineAndText(@Param("role") UserRole role, @Param("cutoff") java.time.Instant cutoff, @Param("search") String search, Pageable pageable);

    @Query("SELECT COUNT(u) FROM User u WHERE u.role = :role AND u.lastActiveAt >= :cutoff")
    long countByRoleAndOnline(@Param("role") UserRole role, @Param("cutoff") java.time.Instant cutoff);
}
