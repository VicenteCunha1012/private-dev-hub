package pt.cunha.commandvault

import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Routing.healthRoutes() {
    get("/health") {
        call.respond(mapOf("status" to "ok"))
    }
}

fun Routing.configRoutes(configService: ConfigService) {
    route("/config") {
        get {
            call.respond(configService.getConfig())
        }

        post {
            val req = call.receive<UpdateConfigRequest>()
            val updated = configService.updateConfig(req.pgDumpPath, req.psqlPath, req.pgRestorePath)
            call.respond(updated)
        }

        get("/export") {
            val config = configService.getConfig()
            call.respond(config)
        }

        post("/import") {
            val imported = call.receive<VaultConfig>()
            configService.updateConfig(imported.pgDumpPath, imported.psqlPath, imported.pgRestorePath)
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

fun Routing.snippetRoutes(snippetService: SnippetService) {
    route("/snippets") {
        get {
            val search = call.request.queryParameters["search"]
            val tag = call.request.queryParameters["tag"]
            call.respond(snippetService.getAll(search, tag))
        }

        post {
            val req = call.receive<CreateSnippetRequest>()
            val snippet = snippetService.create(req)
            call.respond(HttpStatusCode.Created, snippet)
        }

        get("/tags") {
            call.respond(snippetService.getTags())
        }

        get("/{id}") {
            val id = call.parameters["id"]?.toIntOrNull()
                ?: throw IllegalArgumentException("Invalid snippet id")
            val snippet = snippetService.getById(id)
                ?: throw NoSuchElementException("Snippet not found")
            call.respond(snippet)
        }

        put("/{id}") {
            val id = call.parameters["id"]?.toIntOrNull()
                ?: throw IllegalArgumentException("Invalid snippet id")
            val req = call.receive<UpdateSnippetRequest>()
            val updated = snippetService.update(id, req)
                ?: throw NoSuchElementException("Snippet not found")
            call.respond(updated)
        }

        delete("/{id}") {
            val id = call.parameters["id"]?.toIntOrNull()
                ?: throw IllegalArgumentException("Invalid snippet id")
            if (snippetService.delete(id)) {
                call.respond(HttpStatusCode.NoContent)
            } else {
                throw NoSuchElementException("Snippet not found")
            }
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
            val flow = flowService.create(req)
            call.respond(HttpStatusCode.Created, flow)
        }

        get("/{id}") {
            val id = call.parameters["id"]?.toIntOrNull()
                ?: throw IllegalArgumentException("Invalid flow id")
            val flow = flowService.getById(id)
                ?: throw NoSuchElementException("Flow not found")
            call.respond(flow)
        }

        put("/{id}") {
            val id = call.parameters["id"]?.toIntOrNull()
                ?: throw IllegalArgumentException("Invalid flow id")
            val req = call.receive<UpdateFlowRequest>()
            val updated = flowService.update(id, req)
                ?: throw NoSuchElementException("Flow not found")
            call.respond(updated)
        }

        delete("/{id}") {
            val id = call.parameters["id"]?.toIntOrNull()
                ?: throw IllegalArgumentException("Invalid flow id")
            if (flowService.delete(id)) {
                call.respond(HttpStatusCode.NoContent)
            } else {
                throw NoSuchElementException("Flow not found")
            }
        }
    }
}
