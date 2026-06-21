package pt.cunha.mockgen.routes

import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import pt.cunha.mockgen.ConfigService
import pt.cunha.mockgen.ai.AiProvider
import pt.cunha.mockgen.models.GenerateRequest
import pt.cunha.mockgen.models.GenerationSpec
import pt.cunha.mockgen.models.InferRequest
import pt.cunha.mockgen.services.GeneratorService
import pt.cunha.mockgen.services.ScriptGenerator
import pt.cunha.mockgen.services.SpecService

fun Routing.configRoutes(configService: ConfigService) {
    route("/config") {
        get {
            call.respond(configService.getMasked())
        }
        post {
            val updates = call.receive<Map<String, String>>()
            updates.forEach { (k, v) -> configService.set(k, v) }
            call.respond(configService.getMasked())
        }
        get("/export") {
            call.respond(configService.getAll())
        }
        post("/import") {
            val data = call.receive<Map<String, String>>()
            data.forEach { (k, v) -> configService.set(k, v) }
            call.respond(HttpStatusCode.OK, mapOf("status" to "imported"))
        }
    }
    route("/db") {
        get("/export") {
            call.respondText(configService.exportDatabase(), ContentType.Text.Plain)
        }
        post("/import") {
            val sql = call.receiveText()
            configService.importDatabase(sql)
            call.respond(HttpStatusCode.OK, mapOf("status" to "imported"))
        }
    }
}

fun Routing.specRoutes(specService: SpecService, aiProvider: AiProvider) {
    route("/specs") {
        get {
            call.respond(specService.getAll())
        }

        get("/{id}") {
            val id = call.parameters["id"]?.toIntOrNull() ?: throw IllegalArgumentException("Invalid id")
            call.respond(specService.getById(id))
        }

        put("/{id}") {
            val id = call.parameters["id"]?.toIntOrNull() ?: throw IllegalArgumentException("Invalid id")
            val spec = call.receive<GenerationSpec>()
            call.respond(specService.update(id, spec))
        }

        delete("/{id}") {
            val id = call.parameters["id"]?.toIntOrNull() ?: throw IllegalArgumentException("Invalid id")
            specService.delete(id)
            call.respond(HttpStatusCode.NoContent)
        }

        get("/{id}/history") {
            val id = call.parameters["id"]?.toIntOrNull() ?: throw IllegalArgumentException("Invalid id")
            call.respond(specService.getHistory(id))
        }

        post("/{id}/rollback/{version}") {
            val id = call.parameters["id"]?.toIntOrNull() ?: throw IllegalArgumentException("Invalid id")
            val version = call.parameters["version"]?.toIntOrNull() ?: throw IllegalArgumentException("Invalid version")
            call.respond(specService.rollback(id, version))
        }
    }

    post("/infer") {
        val req = call.receive<InferRequest>()
        val spec = aiProvider.inferSpec(req.samples, req.schema, req.schemaType, req.mode)
        val record = specService.create(req.name, req.mode, spec)
        call.respond(HttpStatusCode.Created, record)
    }
}

fun Routing.generateRoutes(
    specService: SpecService,
    generatorService: GeneratorService,
    scriptGenerator: ScriptGenerator,
    localeProvider: () -> String
) {
    post("/generate") {
        val req = call.receive<GenerateRequest>()
        val spec = specService.getById(req.specId)
        val result = generatorService.generate(spec.spec, req.count, req.profile, req.seed, req.entityName)
        call.respond(result)
    }

    get("/specs/{id}/export") {
        val id = call.parameters["id"]?.toIntOrNull() ?: throw IllegalArgumentException("Invalid id")
        val type = call.request.queryParameters["type"] ?: "generate"
        val spec = specService.getById(id)
        val locale = localeProvider()

        val script = when (type) {
            "generate" -> scriptGenerator.generatePythonScript(spec.spec, locale)
            "call_api" -> scriptGenerator.generateCallApiScript(spec.spec, locale)
            else -> throw IllegalArgumentException("Type must be 'generate' or 'call_api'")
        }

        val filename = if (type == "generate") "generate.py" else "call_api.py"
        call.response.header(HttpHeaders.ContentDisposition, "attachment; filename=\"$filename\"")
        call.respondText(script, ContentType.Text.Plain)
    }
}
