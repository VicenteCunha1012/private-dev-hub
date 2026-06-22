package pt.cunha.hub.services

import kotlinx.serialization.Serializable
import java.util.concurrent.ConcurrentLinkedDeque

@Serializable
data class ToastAction(
    val label: String,
    val entryLabel: String
)

@Serializable
data class Toast(
    val id: String,
    val type: String,
    val message: String,
    val action: ToastAction? = null,
    val timestamp: Long = System.currentTimeMillis()
)

@Serializable
data class CreateToastRequest(
    val type: String,
    val message: String,
    val action: ToastAction? = null
)

class ToastService {
    private val toasts = ConcurrentLinkedDeque<Toast>()
    private val maxSize = 50

    fun create(request: CreateToastRequest): Toast {
        val toast = Toast(
            id = java.util.UUID.randomUUID().toString(),
            type = request.type,
            message = request.message,
            action = request.action
        )
        toasts.addFirst(toast)
        while (toasts.size > maxSize) {
            toasts.removeLast()
        }
        return toast
    }

    fun getSince(sinceMs: Long): List<Toast> {
        return toasts.filter { it.timestamp > sinceMs }
    }
}
