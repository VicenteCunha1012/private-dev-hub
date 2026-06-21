package pt.cunha.ttydmanager

import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.plugins.defaultheaders.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.json.Json

private val manager = TuiManager()

fun Application.module() {
    install(ContentNegotiation) {
        json(Json { ignoreUnknownKeys = true })
    }
    install(CORS) {
        allowMethod(HttpMethod.Options)
        allowMethod(HttpMethod.Get)
        allowMethod(HttpMethod.Post)
        allowMethod(HttpMethod.Delete)
        allowHeader(HttpHeaders.ContentType)
        anyHost()
    }
    install(DefaultHeaders)
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
        get("/health") {
            call.respond(mapOf("status" to "ok"))
        }
        route("/tuis") {
            get {
                call.respond(manager.list())
            }
            post {
                val req = call.receive<CreateTuiRequest>()
                val session = manager.create(req.name, req.workdir, req.command)
                call.respond(HttpStatusCode.Created, session)
            }
            delete("/{id}") {
                val id = call.parameters["id"] ?: throw IllegalArgumentException("Missing id")
                if (!manager.delete(id)) throw NoSuchElementException("TUI $id not found")
                call.respond(HttpStatusCode.NoContent)
            }
        }
    }
}
