FROM gradle:8.12-jdk21 AS build
WORKDIR /app
COPY dev-hub-core/ /dev-hub-core/
COPY ai-memory/backend/ .
RUN sed -i 's|../../dev-hub-core|/dev-hub-core|' settings.gradle.kts && gradle shadowJar --no-daemon -x test

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
COPY --from=build /app/build/libs/*-all.jar app.jar
EXPOSE 10417
ENTRYPOINT ["java", "-jar", "app.jar"]
