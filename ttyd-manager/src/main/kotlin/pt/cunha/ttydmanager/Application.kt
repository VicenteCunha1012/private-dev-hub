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
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File
import java.util.concurrent.TimeUnit

private val manager = TuiManager()

@Serializable
data class ExecRequest(val command: String, val workdir: String? = null, val timeoutSeconds: Int = 30)

@Serializable
data class ExecResult(val exitCode: Int, val stdout: String, val stderr: String, val timedOut: Boolean = false)

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
        post("/exec") {
            val req = call.receive<ExecRequest>()
            val timeout = req.timeoutSeconds.coerceIn(1, 120).toLong()
            val workdir = req.workdir?.let { File(it) }?.takeIf { it.isDirectory } ?: File(System.getProperty("user.home"))

            val process = ProcessBuilder("bash", "-c", req.command)
                .directory(workdir)
                .redirectErrorStream(false)
                .start()

            val finished = process.waitFor(timeout, TimeUnit.SECONDS)
            if (!finished) {
                process.destroyForcibly()
                val partial = process.inputStream.bufferedReader().readText().take(50_000)
                call.respond(ExecResult(exitCode = -1, stdout = partial, stderr = "Process timed out after ${timeout}s", timedOut = true))
            } else {
                val stdout = process.inputStream.bufferedReader().readText().take(50_000)
                val stderr = process.errorStream.bufferedReader().readText().take(10_000)
                call.respond(ExecResult(exitCode = process.exitValue(), stdout = stdout, stderr = stderr))
            }
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
