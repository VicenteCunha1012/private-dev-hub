# ktor-base:21 — built once, shared by all Ktor backends
# Lean jlink JRE (~50MB vs ~180MB temurin JRE) on debian:12-slim so
# derived images can still apt-get install extras (git, etc.)
FROM eclipse-temurin:21-jdk-jammy AS jlink
RUN jlink \
    --add-modules java.base,java.logging,java.naming,java.sql,\
java.management,java.security.jgss,java.transaction.xa,java.xml,\
jdk.crypto.ec,jdk.crypto.cryptoki,jdk.unsupported,jdk.zipfs \
    --output /jre \
    --strip-debug \
    --no-header-files \
    --no-man-pages \
    --compress=2

FROM debian:12-slim
COPY --from=jlink /jre /opt/jre
ENV PATH="/opt/jre/bin:$PATH" \
    JAVA_HOME="/opt/jre"
# Lean flags for idle Ktor services:
#   SerialGC    — G1 wastes memory on small heaps
#   TieredStop1 — C1 only: less code cache, faster startup
#   Xshare:auto — use CDS archive if present, skip silently if not
ENTRYPOINT ["java", \
  "-XX:+UseSerialGC", \
  "-XX:MaxRAMPercentage=60.0", \
  "-XX:TieredStopAtLevel=1", \
  "-Xss512k", \
  "-XX:ReservedCodeCacheSize=32m", \
  "-XX:+ExitOnOutOfMemoryError", \
  "-Xshare:auto", \
  "-jar", "/app.jar"]
