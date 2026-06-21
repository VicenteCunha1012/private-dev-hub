package pt.cunha.mockgen

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
import pt.cunha.mockgen.ai.GroqProvider
import pt.cunha.mockgen.routes.configRoutes
import pt.cunha.mockgen.routes.generateRoutes
import pt.cunha.mockgen.routes.specRoutes
import pt.cunha.mockgen.services.GeneratorService
import pt.cunha.mockgen.services.ScriptGenerator
import pt.cunha.mockgen.services.SpecService

fun Application.module() {
    val db = Database(environment.config)
    db.init()

    val configService = ConfigService(db.connection)
    val specService = SpecService(db.connection)
    val localeProvider = { configService.get("faker_locale") ?: "en_US" }
    val generatorService = GeneratorService(localeProvider)
    val scriptGenerator = ScriptGenerator()

    val groqProvider = GroqProvider(
        apiKeyProvider = { configService.get("groq_api_key") ?: "" },
        modelProvider = { configService.get("groq_model") ?: "llama-3.3-70b-versatile" }
    )

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
        allowHeader(HttpHeaders.Authorization)
        anyHost()
    }

    install(DefaultHeaders) { header("X-Engine", "Ktor") }

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
        get("/health") { call.respond(mapOf("status" to "ok")) }
        configRoutes(configService)
        specRoutes(specService, groqProvider)
        generateRoutes(specService, generatorService, scriptGenerator, localeProvider)
    }
}
