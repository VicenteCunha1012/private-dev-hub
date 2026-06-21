FROM gradle:8.12-jdk21 AS build
WORKDIR /app
COPY . .
RUN gradle shadowJar --no-daemon -x test

FROM eclipse-temurin:21-jre-jammy
RUN apt-get update && apt-get install -y python3 python3-pip && \
    pip3 install --break-system-packages faker && \
    apt-get clean && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/build/libs/*-all.jar app.jar
EXPOSE 10408
ENTRYPOINT ["java", "-jar", "app.jar"]
