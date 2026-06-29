package pt.cunha.todo

import io.ktor.server.application.*
import io.ktor.server.routing.*
import pt.cunha.core.configDbRoutes
import pt.cunha.core.healthRoutes
import pt.cunha.core.installStandardPlugins

fun Application.module() {
    val db = Database(environment.config)
    db.init()

    val configService = ConfigService(db.connection)
    val listService = ListService(db.connection)
    val taskService = TaskService(db.connection)

    installStandardPlugins()

    routing {
        healthRoutes()
        configDbRoutes(configService)
        configRoutes(configService)
        listRoutes(listService)
        taskRoutes(taskService)
    }
}
