package pt.cunha.hub.routes

import io.ktor.http.*
import io.ktor.http.content.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.utils.io.jvm.javaio.toInputStream
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import pt.cunha.hub.models.CreateEntryRequest
import pt.cunha.hub.models.SetIconUrlRequest
import pt.cunha.hub.models.UpdateEntryRequest
import pt.cunha.hub.services.EntryService
import pt.cunha.hub.services.FaviconService

fun Routing.entriesRoutes(entryService: EntryService, faviconService: FaviconService) {
    route("/entries") {
        get {
            call.respond(entryService.getAll())
        }

        post {
            val req = call.receive<CreateEntryRequest>()
            val entry = entryService.create(req.label, req.url, req.type, req.folderId, req.position, req.workdir, req.command, req.emoji)
            if (req.url != null) {
                val url = req.url
                call.application.launch(Dispatchers.IO) { faviconService.fetchAndCacheFavicon(entry.id, url) }
            }
            call.respond(HttpStatusCode.Created, entry)
        }

        put("/{id}") {
            val id = call.parameters["id"]?.toIntOrNull() ?: throw IllegalArgumentException("Invalid id")
            val req = call.receive<UpdateEntryRequest>()
            val entry = entryService.update(id, req.label, req.url, req.type, req.folderId, req.position, req.workdir, req.command, req.emoji)
            if (req.url != null) {
                val url = req.url
                call.application.launch(Dispatchers.IO) { faviconService.fetchAndCacheFavicon(entry.id, url) }
            }
            call.respond(entry)
        }

        delete("/{id}") {
            val id = call.parameters["id"]?.toIntOrNull() ?: throw IllegalArgumentException("Invalid id")
            entryService.delete(id)
            call.respond(HttpStatusCode.NoContent)
        }

        get("/{id}/icon") {
            val id = call.parameters["id"]?.toIntOrNull() ?: throw IllegalArgumentException("Invalid id")
            val icon = faviconService.getIcon(id)
            if (icon == null) {
                call.respond(HttpStatusCode.NotFound)
            } else {
                val (bytes, ct) = icon
                call.respondBytes(bytes, ContentType.parse(ct))
            }
        }

        post("/{id}/icon") {
            val id = call.parameters["id"]?.toIntOrNull() ?: throw IllegalArgumentException("Invalid id")
            val ct = call.request.contentType()
            if (ct.match(ContentType.Application.Json)) {
                val req = call.receive<SetIconUrlRequest>()
                faviconService.setOverrideFromUrl(id, req.url)
            } else if (ct.match(ContentType.MultiPart.FormData)) {
                val multipart = call.receiveMultipart()
                multipart.forEachPart { part ->
                    if (part is PartData.FileItem) {
                        val bytes = part.provider().toInputStream().readBytes()
                        val partCt = part.contentType?.toString() ?: "image/png"
                        faviconService.setOverrideBytes(id, bytes, partCt)
                    }
                    part.release()
                }
            } else {
                throw IllegalArgumentException("Unsupported content type")
            }
            call.respond(HttpStatusCode.NoContent)
        }

        delete("/{id}/icon") {
            val id = call.parameters["id"]?.toIntOrNull() ?: throw IllegalArgumentException("Invalid id")
            faviconService.clearOverride(id)
            call.respond(HttpStatusCode.NoContent)
        }

        post("/{id}/icon/refresh") {
            val id = call.parameters["id"]?.toIntOrNull() ?: throw IllegalArgumentException("Invalid id")
            val entry = entryService.getById(id)
            if (entry.url != null) {
                val url = entry.url
                call.application.launch(Dispatchers.IO) { faviconService.fetchAndCacheFavicon(id, url) }
            }
            call.respond(HttpStatusCode.Accepted, mapOf("status" to "refresh scheduled"))
        }
    }
}
