FROM gradle:8.12-jdk21 AS build
WORKDIR /app
COPY . .
RUN gradle shadowJar --no-daemon -x test

FROM eclipse-temurin:21-jre-jammy
# Install ttyd from GitHub releases (statically linked, no extra deps needed)
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL -o /usr/local/bin/ttyd \
      https://github.com/tsl0922/ttyd/releases/download/1.7.7/ttyd.x86_64 && \
    chmod +x /usr/local/bin/ttyd && \
    apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/build/libs/*-all.jar app.jar
EXPOSE 10600
ENTRYPOINT ["java", "-jar", "app.jar"]
