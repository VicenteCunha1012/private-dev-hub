FROM gradle:8.12-jdk21 AS build
WORKDIR /app
COPY dev-hub-core/ /dev-hub-core/
COPY mock-data-generator/backend/ .
RUN sed -i 's|../../dev-hub-core|/dev-hub-core|' settings.gradle.kts && gradle shadowJar --no-daemon -x test

FROM eclipse-temurin:21-jre-jammy
RUN apt-get update && apt-get install -y python3 python3-pip && \
    pip3 install faker && \
    apt-get clean && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/build/libs/*-all.jar app.jar
EXPOSE 10408
ENTRYPOINT ["java", "-jar", "app.jar"]
