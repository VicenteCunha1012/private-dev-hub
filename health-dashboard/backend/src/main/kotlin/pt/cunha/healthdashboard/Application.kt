package pt.cunha.healthdashboard

import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
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
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.time.Instant

@Serializable
data class ServiceConfig(val name: String, val url: String)

@Serializable
data class ServiceStatus(
    val name: String,
    val url: String,
    val status: String,
    val responseTimeMs: Long,
    val error: String? = null
)

@Serializable
data class StatusResponse(val services: List<ServiceStatus>, val checkedAt: String)

private val defaultServices = listOf(
    ServiceConfig("hub-backend", "http://hub-backend:10303/health"),
    ServiceConfig("kafbat-plus-backend", "http://kafbat-plus-backend:10401/health"),
    ServiceConfig("ai-session-manager-backend", "http://ai-session-manager-backend:10402/health"),
    ServiceConfig("json-tools-backend", "http://json-tools-backend:10406/health"),
    ServiceConfig("mock-data-generator-backend", "http://mock-data-generator-backend:10408/health"),
    ServiceConfig("command-vault-backend", "http://command-vault-backend:10409/health"),
    ServiceConfig("port-radar-backend", "http://port-radar-backend:10410/health"),
    ServiceConfig("ttyd-manager", "http://host.docker.internal:10600/health"),
)

private var services: MutableList<ServiceConfig> = defaultServices.toMutableList()

private val httpClient = HttpClient(CIO) {
    engine {
        requestTimeout = 5000
    }
}

fun Application.module() {
    install(ContentNegotiation) {
        json(Json {
            prettyPrint = true
            isLenient = true
            ignoreUnknownKeys = true
        })
    }
    install(CORS) {
        anyHost()
        allowHeader(HttpHeaders.ContentType)
        allowMethod(HttpMethod.Put)
        allowMethod(HttpMethod.Delete)
    }
    install(DefaultHeaders)
    install(StatusPages) {
        exception<Throwable> { call, cause ->
            call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (cause.message ?: "Unknown error")))
        }
    }

    routing {
        get("/health") {
            call.respond(mapOf("status" to "ok"))
        }

        get("/config") {
            call.respond(services.toList())
        }

        post("/config") {
            val newServices = call.receive<List<ServiceConfig>>()
            services = newServices.toMutableList()
            call.respond(services.toList())
        }

        get("/config/export") {
            call.respond(services.toList())
        }

        post("/config/import") {
            val newServices = call.receive<List<ServiceConfig>>()
            services = newServices.toMutableList()
            call.respond(services.toList())
        }

        get("/status") {
            val results = coroutineScope {
                services.map { service ->
                    async { checkService(service) }
                }.awaitAll()
            }
            call.respond(StatusResponse(
                services = results,
                checkedAt = Instant.now().toString()
            ))
        }
    }
}

private suspend fun checkService(service: ServiceConfig): ServiceStatus {
    val start = System.currentTimeMillis()
    return try {
        val response = httpClient.get(service.url)
        val elapsed = System.currentTimeMillis() - start
        val body = response.bodyAsText()
        when {
            response.status.value == 200 && body.contains("ok", ignoreCase = true) ->
                ServiceStatus(service.name, service.url, "up", elapsed)
            response.status.value == 200 ->
                ServiceStatus(service.name, service.url, "degraded", elapsed)
            else ->
                ServiceStatus(service.name, service.url, "down", elapsed, "HTTP ${response.status.value}")
        }
    } catch (e: Exception) {
        val elapsed = System.currentTimeMillis() - start
        ServiceStatus(service.name, service.url, "down", elapsed, e.message)
    }
}
