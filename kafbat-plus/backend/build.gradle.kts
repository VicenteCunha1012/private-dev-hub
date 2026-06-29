plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
    alias(ktorLibs.plugins.ktor)
}

group = "pt.cunha.kafbat"
version = "1.0.0-SNAPSHOT"

application {
    mainClass = "io.ktor.server.netty.EngineMain"
}

kotlin {
    jvmToolchain(21)
}

dependencies {
    implementation("pt.cunha:dev-hub-core")
    implementation(libs.kafka.clients)

    testImplementation(kotlin("test"))
    testImplementation(ktorLibs.server.testHost)
}
