package pt.cunha.hub.routes

import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import pt.cunha.hub.services.EventPayload
import pt.cunha.hub.services.EventService

fun Routing.eventRoutes(eventService: EventService) {
    post("/events/{type}") {
        val type = call.parameters["type"] ?: throw IllegalArgumentException("Missing event type")
        val payload = try {
            call.receive<EventPayload>()
        } catch (_: Exception) {
            EventPayload(type = type)
        }
        eventService.dispatch(type, payload)
        call.respond(HttpStatusCode.OK, mapOf("status" to "dispatched", "type" to type))
    }
}
