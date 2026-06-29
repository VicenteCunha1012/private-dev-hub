package pt.cunha.githistory

import io.ktor.server.application.*
import io.ktor.server.routing.*
import pt.cunha.core.healthRoutes
import pt.cunha.core.installStandardPlugins

fun Application.module() {
    val configDirs = environment.config.propertyOrNull("repos.directories")?.getString() ?: ""
    val traceDepth = environment.config.propertyOrNull("repos.traceDepth")?.getString()?.toIntOrNull() ?: 50
    val gitService = GitService(configDirs, traceDepth)

    installStandardPlugins()

    routing {
        healthRoutes()
        configRoutes(gitService)
        repoRoutes(gitService)
    }
}
