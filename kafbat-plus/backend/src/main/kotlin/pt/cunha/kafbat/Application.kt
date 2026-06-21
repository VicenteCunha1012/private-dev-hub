package pt.cunha.kafbat

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

fun Application.module() {
    val db = Database(environment.config)
    db.init()

    val configService = ConfigService(db.connection)
    val kafkaService = KafkaService()

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

    install(DefaultHeaders) {
        header("X-Engine", "Ktor")
    }

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
        configRoutes(configService)
        clusterRoutes(configService)
        brokerRoutes(kafkaService, configService)
        topicRoutes(kafkaService, configService)
    }
}
