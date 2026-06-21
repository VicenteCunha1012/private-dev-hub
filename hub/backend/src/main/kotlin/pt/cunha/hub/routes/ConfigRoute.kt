package pt.cunha.hub.routes

import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import pt.cunha.hub.models.ExportedConfig
import pt.cunha.hub.models.UpdateConfigRequest
import pt.cunha.hub.services.ConfigService
import pt.cunha.hub.services.EntryService
import pt.cunha.hub.services.FolderService
import java.time.Instant

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
}
