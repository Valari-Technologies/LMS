# ==========================================
# Multi-stage Dockerfile for OneTutor Backend
# ==========================================

# 1. Build stage
FROM maven:3.9.8-eclipse-temurin-21-alpine AS builder
WORKDIR /build

# Pre-fetch dependencies (Docker layer caching)
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy application source and build JAR package
COPY src ./src
RUN mvn clean package -DskipTests -B

# 2. Runtime stage
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Run as non-root user
RUN addgroup -S onetutor && adduser -S onetutor -G onetutor

# Copy compiled JAR
COPY --from=builder /build/target/*.jar /app/app.jar

# Give ownership to onetutor user
RUN chown -R onetutor:onetutor /app

USER onetutor

EXPOSE 8080
ENV PORT=8080

# Run with container-aware memory settings
ENTRYPOINT ["sh", "-c", "java -XX:+UseG1GC -XX:MaxRAMPercentage=75.0 -Dserver.port=${PORT:-8080} -jar /app/app.jar"]
