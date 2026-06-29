FROM gradle:8.12-jdk21 AS build
WORKDIR /app
COPY . .
RUN --mount=type=cache,target=/root/.gradle \
    gradle shadowJar --no-daemon -x test

FROM ktor-base:21
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/build/libs/*-all.jar /app.jar
EXPOSE 10402
