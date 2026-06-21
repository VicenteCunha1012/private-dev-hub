package pt.cunha.aisessions

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

fun Application.module() {
    val claudeDir = environment.config.propertyOrNull("sessions.claudeDir")?.getString() ?: "/home/user/.claude"
    val sessionScanner = SessionScanner(claudeDir)

    install(ContentNegotiation) {
        json(Json { ignoreUnknownKeys = true; prettyPrint = false; encodeDefaults = true })
    }

    install(CORS) {
        allowMethod(HttpMethod.Options)
        allowMethod(HttpMethod.Get)
        allowMethod(HttpMethod.Post)
        allowMethod(HttpMethod.Put)
        allowMethod(HttpMethod.Delete)
        allowHeader(HttpHeaders.ContentType)
        anyHost()
    }

    install(DefaultHeaders) { header("X-Engine", "Ktor") }

    install(StatusPages) {
        exception<IllegalArgumentException> { call, cause ->
            call.respond(HttpStatusCode.BadRequest, mapOf("error" to (cause.message ?: "Bad request")))
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

        get("/config") {
            call.respond(mapOf("claudeDir" to claudeDir))
        }

        get("/config/export") {
            call.respond(mapOf("claudeDir" to claudeDir))
        }

        post("/config/import") {
            call.respond(HttpStatusCode.OK, mapOf("status" to "imported", "note" to "claudeDir is set via application.yaml"))
        }

        get("/sessions") {
            val tool = call.request.queryParameters["tool"] ?: "claude-code"
            val sessions = sessionScanner.getSessions(tool)
            call.respond(sessions)
        }

        get("/sessions/{id}") {
            val id = call.parameters["id"] ?: throw IllegalArgumentException("Session ID required")
            val detail = sessionScanner.getSessionDetail(id)
            if (detail == null) {
                call.respond(HttpStatusCode.NotFound, mapOf("error" to "Session not found"))
            } else {
                call.respond(detail)
            }
        }

        get("/spending") {
            val tool = call.request.queryParameters["tool"] ?: "claude-code"
            val spending = sessionScanner.getSpending(tool)
            call.respond(spending)
        }

        get("/projects") {
            val projects = sessionScanner.getProjects()
            call.respond(projects)
        }

        get("/spending/timeline") {
            val tool = call.request.queryParameters["tool"] ?: "claude-code"
            val period = call.request.queryParameters["period"] ?: "daily"
            val timeline = sessionScanner.getSpendingTimeline(tool, period)
            call.respond(timeline)
        }

        get("/spending/projection") {
            val tool = call.request.queryParameters["tool"] ?: "claude-code"
            val projection = sessionScanner.getProjection(tool)
            call.respond(projection)
        }
    }
}
