FROM gradle:8.12-jdk21 AS build
WORKDIR /app
COPY dev-hub-core/ /dev-hub-core/
COPY mock-data-generator/backend/ .
RUN sed -i 's|../../dev-hub-core|/dev-hub-core|' settings.gradle.kts
RUN --mount=type=cache,target=/root/.gradle \
    gradle shadowJar --no-daemon -x test

# Needs python3+faker — stays on temurin (ktor-base is too minimal)
FROM eclipse-temurin:21-jre-jammy
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip && \
    pip3 install faker && \
    apt-get clean && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/build/libs/*-all.jar /app.jar
EXPOSE 10408
ENTRYPOINT ["java", \
  "-XX:+UseSerialGC", \
  "-XX:MaxRAMPercentage=60.0", \
  "-XX:TieredStopAtLevel=1", \
  "-Xss512k", \
  "-XX:ReservedCodeCacheSize=32m", \
  "-XX:+ExitOnOutOfMemoryError", \
  "-Xshare:auto", \
  "-jar", "/app.jar"]
