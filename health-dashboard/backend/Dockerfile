FROM gradle:8.12-jdk21 AS build
WORKDIR /app
COPY . .
RUN gradle shadowJar --no-daemon -x test

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
COPY --from=build /app/build/libs/*-all.jar app.jar
EXPOSE 10411
ENTRYPOINT ["java", "-jar", "app.jar"]
