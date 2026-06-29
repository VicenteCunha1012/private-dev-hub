package pt.cunha.aimemory

import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Routing.configRoutes(configService: ConfigService) {
    get("/config") { call.respond(configService.getConfigMap()) }
    post("/config") {
        val updates = call.receive<Map<String, String>>()
        configService.setConfigs(updates)
        call.respond(configService.getConfigMap())
    }
    get("/config/export") { call.respond(configService.getConfigMap()) }
    post("/config/import") {
        val config = call.receive<Map<String, String>>()
        configService.setConfigs(config)
        call.respond(HttpStatusCode.OK, mapOf("status" to "ok"))
    }
}

fun Routing.handoffRoutes(handoffService: HandoffService) {
    route("/handoffs") {
        get {
            val project = call.request.queryParameters["project"]
            call.respond(handoffService.getAll(project))
        }
        get("/latest") {
            val project = call.request.queryParameters["project"] ?: throw IllegalArgumentException("project required")
            val context = call.request.queryParameters["context"] ?: "default"
            val handoff = handoffService.getLatest(project, context)
            if (handoff != null) call.respond(handoff)
            else call.respond(HttpStatusCode.NotFound, mapOf("error" to "No handoff found"))
        }
        get("/history") {
            val project = call.request.queryParameters["project"] ?: throw IllegalArgumentException("project required")
            val context = call.request.queryParameters["context"] ?: "default"
            val limit = call.request.queryParameters["limit"]?.toIntOrNull() ?: 20
            call.respond(handoffService.getHistory(project, context, limit))
        }
        post {
            val req = call.receive<CreateHandoffRequest>()
            call.respond(HttpStatusCode.Created, handoffService.write(req))
        }
    }
}

fun Routing.decisionRoutes(decisionService: DecisionService) {
    route("/decisions") {
        get {
            val search = call.request.queryParameters["search"]
            val tag = call.request.queryParameters["tag"]
            val project = call.request.queryParameters["project"]
            call.respond(decisionService.getAll(search, tag, project))
        }
        get("/tags") { call.respond(decisionService.getTags()) }
        get("/projects") { call.respond(decisionService.getProjects()) }
        get("/search") {
            val query = call.request.queryParameters["q"] ?: ""
            val limit = call.request.queryParameters["limit"]?.toIntOrNull() ?: 20
            call.respond(decisionService.search(query, limit))
        }
        get("/{id}") {
            val id = call.parameters["id"]?.toIntOrNull() ?: throw IllegalArgumentException("Invalid id")
            val decision = decisionService.getById(id) ?: throw NoSuchElementException("Decision not found")
            call.respond(decision)
        }
        post {
            val req = call.receive<CreateDecisionRequest>()
            call.respond(HttpStatusCode.Created, decisionService.create(req))
        }
        put("/{id}") {
            val id = call.parameters["id"]?.toIntOrNull() ?: throw IllegalArgumentException("Invalid id")
            val req = call.receive<UpdateDecisionRequest>()
            val updated = decisionService.update(id, req) ?: throw NoSuchElementException("Decision not found")
            call.respond(updated)
        }
        delete("/{id}") {
            val id = call.parameters["id"]?.toIntOrNull() ?: throw IllegalArgumentException("Invalid id")
            if (decisionService.delete(id)) call.respond(HttpStatusCode.OK, mapOf("status" to "deleted"))
            else throw NoSuchElementException("Decision not found")
        }
    }
}
