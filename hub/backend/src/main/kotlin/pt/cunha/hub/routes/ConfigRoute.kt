package pt.cunha.hub.routes

import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable
import pt.cunha.hub.models.ExportedConfig
import pt.cunha.hub.models.UpdateConfigRequest
import pt.cunha.hub.services.ConfigService
import pt.cunha.hub.services.EntryService
import pt.cunha.hub.services.FolderService
import java.time.Instant

@Serializable
data class FullExport(
    val version: String = "1.0",
    val exportedAt: String,
    val modules: Map<String, ModuleExport>
)

@Serializable
data class ModuleExport(
    val dbSql: String? = null,
    val configJson: String? = null
)

private val MODULE_BACKENDS = mapOf(
    "hub" to "http://hub-backend:10303",
    "kafbat" to "http://kafbat-plus-backend:10401",
    "command-vault" to "http://command-vault-backend:10409",
    "mock-generator" to "http://mock-data-generator-backend:10408",
    "arcade" to "http://arcade-backend:10413",
    "secrets-vault" to "http://secrets-vault-backend:10414",
    "todo" to "http://todo-backend:10412",
)

fun Routing.configRoutes(configService: ConfigService, folderService: FolderService, entryService: EntryService) {
    route("/config") {
        get {
            call.respond(configService.getConfig())
        }

        post {
            val req = call.receive<UpdateConfigRequest>()
            val updated = configService.updateConfig(req.pgDumpPath, req.psqlPath, req.pgRestorePath, req.keybinds, req.palette)
            call.respond(updated)
        }

        get("/export") {
            val config = configService.getConfig()
            val folders = folderService.getAll()
            call.respond(
                ExportedConfig(
                    exportedAt = Instant.now().toString(),
                    config = config,
                    folders = folders
                )
            )
        }

        post("/import") {
            val imported = call.receive<ExportedConfig>()
            configService.updateConfig(
                imported.config.pgDumpPath,
                imported.config.psqlPath,
                imported.config.pgRestorePath,
                imported.config.keybinds,
                imported.config.palette
            )
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

    route("/backup") {
        get("/full-export") {
            val client = HttpClient(CIO) { expectSuccess = false }
            val modules = mutableMapOf<String, ModuleExport>()

            for ((name, baseUrl) in MODULE_BACKENDS) {
                try {
                    val dbSql = try {
                        val res = client.get("$baseUrl/db/export")
                        if (res.status.isSuccess()) res.bodyAsText() else null
                    } catch (_: Exception) { null }

                    val configJson = try {
                        val res = client.get("$baseUrl/config/export")
                        if (res.status.isSuccess()) res.bodyAsText() else null
                    } catch (_: Exception) { null }

                    if (dbSql != null || configJson != null) {
                        modules[name] = ModuleExport(dbSql = dbSql, configJson = configJson)
                    }
                } catch (_: Exception) { /* skip unreachable modules */ }
            }

            client.close()
            call.respond(FullExport(exportedAt = Instant.now().toString(), modules = modules))
        }

        post("/full-import") {
            val export = call.receive<FullExport>()
            val client = HttpClient(CIO) { expectSuccess = false }
            val results = mutableMapOf<String, String>()

            for ((name, data) in export.modules) {
                val baseUrl = MODULE_BACKENDS[name] ?: continue
                try {
                    if (data.dbSql != null) {
                        val res = client.post("$baseUrl/db/import") {
                            contentType(ContentType.Text.Plain)
                            setBody(data.dbSql)
                        }
                        results[name] = if (res.status.isSuccess()) "ok" else "db-import-failed"
                    }
                    if (data.configJson != null) {
                        val res = client.post("$baseUrl/config/import") {
                            contentType(ContentType.Application.Json)
                            setBody(data.configJson)
                        }
                        if (!res.status.isSuccess()) results[name] = (results[name] ?: "") + ",config-import-failed"
                    }
                    if (!results.containsKey(name)) results[name] = "ok"
                } catch (e: Exception) {
                    results[name] = "unreachable: ${e.message}"
                }
            }

            client.close()
            call.respond(mapOf("status" to "imported", "results" to results))
        }
    }
}
