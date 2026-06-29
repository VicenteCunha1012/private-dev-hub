package pt.cunha.utils

import io.ktor.server.application.*
import io.ktor.server.routing.*
import pt.cunha.core.healthRoutes
import pt.cunha.core.installStandardPlugins

fun Application.module() {
    installStandardPlugins()

    routing {
        healthRoutes()
        configRoutes()
        regexRoutes()
        cronRoutes()
        uuidRoutes()
        hashRoutes()
        urlRoutes()
        jwtRoutes()
    }
}
