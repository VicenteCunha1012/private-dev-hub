package pt.cunha.hub

import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.plugins.defaultheaders.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.json.Json
import pt.cunha.hub.routes.configRoutes
import pt.cunha.hub.routes.entriesRoutes
import pt.cunha.hub.routes.foldersRoutes
import pt.cunha.hub.routes.healthRoutes
import pt.cunha.hub.services.ConfigService
import pt.cunha.hub.services.EntryService
import pt.cunha.hub.services.FaviconService
import pt.cunha.hub.services.FolderService

fun Application.module() {
    val db = Database(environment.config)
    db.init()

    val folderService = FolderService(db.connection)
    val entryService = EntryService(db.connection)
    val configService = ConfigService(db.connection)
    val faviconService = FaviconService(db.connection)

    install(ContentNegotiation) {
        json(Json { ignoreUnknownKeys = true; prettyPrint = false })
    }

    install(CORS) {
        allowMethod(HttpMethod.Options)
        allowMethod(HttpMethod.Get)
        allowMethod(HttpMethod.Post)
        allowMethod(HttpMethod.Put)
        allowMethod(HttpMethod.Delete)
        allowMethod(HttpMethod.Patch)
        allowHeader(HttpHeaders.ContentType)
        allowHeader(HttpHeaders.Authorization)
        anyHost()
    }

    install(DefaultHeaders) {
        header("X-Engine", "Ktor")
    }

    install(StatusPages) {
        exception<IllegalArgumentException> { call, cause ->
            call.respond(HttpStatusCode.BadRequest, mapOf("error" to (cause.message ?: "Bad request")))
        }
        exception<NoSuchElementException> { call, cause ->
            call.respond(HttpStatusCode.NotFound, mapOf("error" to (cause.message ?: "Not found")))
        }
        exception<Throwable> { call, cause ->
            call.application.log.error("Unhandled error", cause)
            call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (cause.message ?: "Internal error")))
        }
    }

    routing {
        healthRoutes()
        foldersRoutes(folderService)
        entriesRoutes(entryService, faviconService)
        configRoutes(configService, folderService, entryService)
    }
}
