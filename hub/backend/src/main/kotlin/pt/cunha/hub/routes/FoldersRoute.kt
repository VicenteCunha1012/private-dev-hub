package pt.cunha.hub.routes

import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import pt.cunha.hub.models.CreateFolderRequest
import pt.cunha.hub.models.UpdateFolderRequest
import pt.cunha.hub.services.FolderService

fun Routing.foldersRoutes(service: FolderService) {
    route("/folders") {
        get {
            call.respond(service.getAll())
        }
        post {
            val req = call.receive<CreateFolderRequest>()
            val folder = service.create(req.name, req.parentId)
            call.respond(HttpStatusCode.Created, folder)
        }
        put("/{id}") {
            val id = call.parameters["id"]?.toIntOrNull() ?: throw IllegalArgumentException("Invalid id")
            val req = call.receive<UpdateFolderRequest>()
            call.respond(service.update(id, req.name, req.position, req.parentId))
        }
        delete("/{id}") {
            val id = call.parameters["id"]?.toIntOrNull() ?: throw IllegalArgumentException("Invalid id")
            service.delete(id)
            call.respond(HttpStatusCode.NoContent)
        }
    }
}
