package pt.cunha.hub.services

import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.request.*
import io.ktor.http.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import org.slf4j.LoggerFactory

@Serializable
data class EventPayload(val type: String, val data: Map<String, String> = emptyMap())

class EventService(private val toastService: ToastService) {

    private val log = LoggerFactory.getLogger(EventService::class.java)
    private val client = HttpClient(CIO)

    private val handlers: Map<String, suspend (EventPayload) -> Unit> = mapOf(
        "git-push" to ::handleGitPush
    )

    suspend fun dispatch(type: String, payload: EventPayload) {
        val handler = handlers[type]
        if (handler != null) {
            handler(payload)
        } else {
            log.warn("No handler registered for event type: {}", type)
        }
    }

    private suspend fun handleGitPush(payload: EventPayload) {
        // 1. Call arcade earn endpoint (non-blocking, best-effort)
        try {
            withContext(Dispatchers.IO) {
                client.post("http://arcade-backend:10413/coins/earn") {
                    contentType(ContentType.Application.Json)
                    setBody("{}")
                }
            }
            log.info("Arcade coin earned for git-push")
        } catch (e: Exception) {
            log.warn("Failed to call arcade earn endpoint: {}", e.message)
        }

        // 2. Create a toast notification
        toastService.create(
            CreateToastRequest(
                type = "success",
                message = "You earned a coin! 🪙",
                action = ToastAction(label = "Open Arcade", entryLabel = "Arcade")
            )
        )
    }
}
