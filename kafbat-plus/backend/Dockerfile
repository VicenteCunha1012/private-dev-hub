FROM gradle:8.12-jdk21 AS build
WORKDIR /app
COPY dev-hub-core/ /dev-hub-core/
COPY kafbat-plus/backend/ .
RUN sed -i 's|../../dev-hub-core|/dev-hub-core|' settings.gradle.kts
RUN --mount=type=cache,target=/root/.gradle \
    gradle shadowJar --no-daemon -x test

FROM ktor-base:21
COPY --from=build /app/build/libs/*-all.jar /app.jar
EXPOSE 10401
