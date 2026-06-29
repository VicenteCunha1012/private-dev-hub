package pt.cunha.commandvault

import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Routing.configRoutes(configService: ConfigService) {
    route("/config") {
        get { call.respond(configService.getConfig()) }
        post {
            val req = call.receive<UpdateConfigRequest>()
            call.respond(configService.updateConfig(req.pgDumpPath, req.psqlPath, req.pgRestorePath))
        }
        get("/export") { call.respond(configService.getConfig()) }
        post("/import") {
            val imported = call.receive<VaultConfig>()
            configService.updateConfig(imported.pgDumpPath, imported.psqlPath, imported.pgRestorePath)
            call.respond(HttpStatusCode.OK, mapOf("status" to "imported"))
        }
    }
}

fun Routing.snippetRoutes(snippetService: SnippetService) {
    route("/snippets") {
        get {
            val search = call.request.queryParameters["search"]
            val tag = call.request.queryParameters["tag"]
            call.respond(snippetService.getAll(search, tag))
        }
        post {
            val req = call.receive<CreateSnippetRequest>()
            call.respond(HttpStatusCode.Created, snippetService.create(req))
        }
        get("/tags") { call.respond(snippetService.getTags()) }
        get("/{id}") {
            val id = call.parameters["id"]?.toIntOrNull() ?: throw IllegalArgumentException("Invalid snippet id")
            call.respond(snippetService.getById(id) ?: throw NoSuchElementException("Snippet not found"))
        }
        put("/{id}") {
            val id = call.parameters["id"]?.toIntOrNull() ?: throw IllegalArgumentException("Invalid snippet id")
            val req = call.receive<UpdateSnippetRequest>()
            call.respond(snippetService.update(id, req) ?: throw NoSuchElementException("Snippet not found"))
        }
        delete("/{id}") {
            val id = call.parameters["id"]?.toIntOrNull() ?: throw IllegalArgumentException("Invalid snippet id")
            if (snippetService.delete(id)) call.respond(HttpStatusCode.NoContent)
            else throw NoSuchElementException("Snippet not found")
        }
    }
}

fun Routing.flowRoutes(flowService: FlowService) {
    route("/flows") {
        get {
            val search = call.request.queryParameters["search"]
            call.respond(flowService.getAll(search))
        }
        post {
            val req = call.receive<CreateFlowRequest>()
            call.respond(HttpStatusCode.Created, flowService.create(req))
        }
        get("/{id}") {
            val id = call.parameters["id"]?.toIntOrNull() ?: throw IllegalArgumentException("Invalid flow id")
            call.respond(flowService.getById(id) ?: throw NoSuchElementException("Flow not found"))
        }
        put("/{id}") {
            val id = call.parameters["id"]?.toIntOrNull() ?: throw IllegalArgumentException("Invalid flow id")
            val req = call.receive<UpdateFlowRequest>()
            call.respond(flowService.update(id, req) ?: throw NoSuchElementException("Flow not found"))
        }
        delete("/{id}") {
            val id = call.parameters["id"]?.toIntOrNull() ?: throw IllegalArgumentException("Invalid flow id")
            if (flowService.delete(id)) call.respond(HttpStatusCode.NoContent)
            else throw NoSuchElementException("Flow not found")
        }
    }
}
