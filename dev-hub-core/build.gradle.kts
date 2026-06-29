plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.serialization)
}

group = "pt.cunha"
version = "1.0.0"

kotlin {
    jvmToolchain(21)
}

dependencies {
    api(ktorLibs.serialization.kotlinx.json)
    api(ktorLibs.server.config.yaml)
    api(ktorLibs.server.contentNegotiation)
    api(ktorLibs.server.core)
    api(ktorLibs.server.cors)
    api(ktorLibs.server.defaultHeaders)
    api(ktorLibs.server.netty)
    api(ktorLibs.server.statusPages)
    api(libs.logback.classic)
    api(libs.postgresql)
}
