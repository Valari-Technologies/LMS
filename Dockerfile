# ========================================================
# Multi-stage Dockerfile for OneTutor Backend (Root Context)
# ========================================================

# 1. Build stage
FROM maven:3.9.8-eclipse-temurin-21-alpine AS builder
WORKDIR /build

# Configure Maven to use high-speed mirror to prevent Maven Central 429 rate-limiting
RUN mkdir -p /root/.m2
COPY backend/settings.xml /root/.m2/settings.xml

# Pre-fetch dependencies
COPY backend/pom.xml .
RUN mvn dependency:go-offline -B -s /root/.m2/settings.xml || true

# Copy backend source code and build JAR package
COPY backend/src ./src
RUN mvn clean package -DskipTests -B -s /root/.m2/settings.xml

# 2. Runtime stage
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Run as non-root user
RUN addgroup -S onetutor && adduser -S onetutor -G onetutor

# Copy compiled JAR
COPY --from=builder /build/target/*.jar /app/app.jar

# Set ownership
RUN chown -R onetutor:onetutor /app

USER onetutor

EXPOSE 8080
ENV PORT=8080

ENTRYPOINT ["sh", "-c", "java -XX:+UseSerialGC -Xmx320m -Xss256k -XX:MaxMetaspaceSize=128m -Dserver.port=${PORT:-8080} -jar /app/app.jar"]
