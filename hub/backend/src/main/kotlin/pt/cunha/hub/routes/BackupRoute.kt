package pt.cunha.hub.routes

import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import pt.cunha.hub.services.BackupConfig
import pt.cunha.hub.services.BackupService

fun Routing.backupRoutes(backupService: BackupService) {
    route("/backups") {
        get {
            call.respond(backupService.listBackups())
        }

        post("/run") {
            val info = backupService.runBackup()
            call.respond(HttpStatusCode.Created, info)
        }

        get("/config") {
            call.respond(backupService.getConfig())
        }

        post("/config") {
            val config = call.receive<BackupConfig>()
            backupService.updateConfig(config)
            call.respond(backupService.getConfig())
        }
    }
}
