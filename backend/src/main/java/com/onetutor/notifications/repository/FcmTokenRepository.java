package com.onetutor.notifications.repository;

import com.onetutor.notifications.entity.FcmToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface FcmTokenRepository extends JpaRepository<FcmToken, Long> {

    Optional<FcmToken> findByToken(String token);

    List<FcmToken> findByUserId(Long userId);

    @Query("SELECT t.token FROM FcmToken t WHERE t.user.id = :userId")
    List<String> findTokensByUserId(@Param("userId") Long userId);

    @Query("SELECT t.token FROM FcmToken t WHERE t.user.id IN :userIds")
    List<String> findTokensByUserIds(@Param("userIds") Collection<Long> userIds);

    @Query("SELECT t.token FROM FcmToken t")
    List<String> findAllTokens();

    @Modifying
    @Query("DELETE FROM FcmToken t WHERE t.token = :token")
    void deleteByToken(@Param("token") String token);

    @Modifying
    @Query("DELETE FROM FcmToken t WHERE t.user.id = :userId AND t.token = :token")
    void deleteByUserIdAndToken(@Param("userId") Long userId, @Param("token") String token);
}
