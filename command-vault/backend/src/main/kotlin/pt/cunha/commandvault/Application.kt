package pt.cunha.commandvault

import io.ktor.server.application.*
import io.ktor.server.routing.*
import pt.cunha.core.configDbRoutes
import pt.cunha.core.healthRoutes
import pt.cunha.core.installStandardPlugins

fun Application.module() {
    val db = Database(environment.config)
    db.init()

    val configService = ConfigService(db.connection)
    val snippetService = SnippetService(db.connection)
    val flowService = FlowService(db.connection)

    installStandardPlugins()

    routing {
        healthRoutes()
        configRoutes(configService)
        configDbRoutes(configService)
        snippetRoutes(snippetService)
        flowRoutes(flowService)
    }
}
