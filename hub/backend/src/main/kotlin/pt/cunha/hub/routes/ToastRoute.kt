package pt.cunha.hub.routes

import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import pt.cunha.hub.services.CreateToastRequest
import pt.cunha.hub.services.ToastService

fun Routing.toastRoutes(toastService: ToastService) {
    route("/toasts") {
        get {
            val since = call.request.queryParameters["since"]?.toLongOrNull() ?: 0L
            call.respond(toastService.getSince(since))
        }

        post {
            val req = call.receive<CreateToastRequest>()
            val toast = toastService.create(req)
            call.respond(HttpStatusCode.Created, toast)
        }
    }
}
