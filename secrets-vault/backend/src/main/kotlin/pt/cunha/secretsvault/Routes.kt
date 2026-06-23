package pt.cunha.secretsvault

import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Routing.healthRoutes() {
    get("/health") { call.respond(mapOf("status" to "ok")) }
}

fun Routing.configRoutes(configService: ConfigService) {
    route("/config") {
        get {
            call.respond(configService.getCryptoConfig())
        }
        post {
            val req = call.receive<UpdateCryptoConfigRequest>()
            configService.updateCryptoConfig(req)
            call.respond(configService.getCryptoConfig())
        }
        get("/export") {
            call.respond(configService.getConfig())
        }
        post("/import") {
            call.respond(HttpStatusCode.OK, mapOf("status" to "imported"))
        }
    }
    route("/db") {
        get("/export") {
            val dump = configService.exportDatabase()
            call.respondText(dump, ContentType.Text.Plain)
        }
        post("/import") {
            val sql = call.receiveText()
            configService.importDatabase(sql)
            call.respond(HttpStatusCode.OK, mapOf("status" to "imported"))
        }
    }
}

fun Routing.secretRoutes(secretService: SecretService) {
    route("/secrets") {
        get {
            val search = call.request.queryParameters["search"]
            val category = call.request.queryParameters["category"]
            call.respond(secretService.getAll(search, category))
        }
        post {
            val req = call.receive<CreateSecretRequest>()
            val secret = secretService.create(req)
            call.respond(HttpStatusCode.Created, secret)
        }
        get("/categories") { call.respond(secretService.getCategories()) }
        get("/{id}") {
            val id = call.parameters["id"]?.toIntOrNull() ?: throw IllegalArgumentException("Invalid secret id")
            val secret = secretService.getById(id) ?: throw NoSuchElementException("Secret not found")
            call.respond(secret)
        }
        put("/{id}") {
            val id = call.parameters["id"]?.toIntOrNull() ?: throw IllegalArgumentException("Invalid secret id")
            val req = call.receive<UpdateSecretRequest>()
            val updated = secretService.update(id, req) ?: throw NoSuchElementException("Secret not found")
            call.respond(updated)
        }
        delete("/{id}") {
            val id = call.parameters["id"]?.toIntOrNull() ?: throw IllegalArgumentException("Invalid secret id")
            if (secretService.delete(id)) call.respond(HttpStatusCode.NoContent)
            else throw NoSuchElementException("Secret not found")
        }
    }
}
