package pt.cunha.jsontools

import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.plugins.defaultheaders.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*

private val json = Json { ignoreUnknownKeys = true; prettyPrint = false }

@Serializable
data class FormatRequest(val json: String, val indent: Int = 2)

@Serializable
data class FormatResponse(val result: String, val valid: Boolean, val error: String? = null)

@Serializable
data class DiffRequest(val left: String, val right: String)

@Serializable
data class DiffEntry(
    val path: String,
    val type: String,
    val leftValue: String? = null,
    val rightValue: String? = null
)

@Serializable
data class DiffResponse(
    val equal: Boolean,
    val differences: List<DiffEntry>,
    val leftValid: Boolean,
    val rightValid: Boolean,
    val error: String? = null
)

fun Application.module() {
    install(ContentNegotiation) {
        json(Json { ignoreUnknownKeys = true; prettyPrint = false; encodeDefaults = true })
    }

    install(CORS) {
        allowMethod(HttpMethod.Options)
        allowMethod(HttpMethod.Get)
        allowMethod(HttpMethod.Post)
        allowHeader(HttpHeaders.ContentType)
        anyHost()
    }

    install(DefaultHeaders) { header("X-Engine", "Ktor") }

    install(StatusPages) {
        exception<Throwable> { call, cause ->
            call.application.log.error("Unhandled error", cause)
            call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (cause.message ?: "Internal error")))
        }
    }

    routing {
        get("/health") {
            call.respond(mapOf("status" to "ok"))
        }

        post("/format") {
            val req = call.receive<FormatRequest>()
            try {
                val parsed = json.parseToJsonElement(req.json)
                val pretty = Json { prettyPrint = true; prettyPrintIndent = " ".repeat(req.indent) }
                call.respond(FormatResponse(result = pretty.encodeToString(JsonElement.serializer(), parsed), valid = true))
            } catch (e: Exception) {
                call.respond(FormatResponse(result = req.json, valid = false, error = e.message))
            }
        }

        post("/compact") {
            val req = call.receive<FormatRequest>()
            try {
                val parsed = json.parseToJsonElement(req.json)
                val compact = Json { prettyPrint = false }
                call.respond(FormatResponse(result = compact.encodeToString(JsonElement.serializer(), parsed), valid = true))
            } catch (e: Exception) {
                call.respond(FormatResponse(result = req.json, valid = false, error = e.message))
            }
        }

        post("/diff") {
            val req = call.receive<DiffRequest>()
            val leftParsed = try { json.parseToJsonElement(req.left) } catch (_: Exception) { null }
            val rightParsed = try { json.parseToJsonElement(req.right) } catch (_: Exception) { null }

            if (leftParsed == null || rightParsed == null) {
                call.respond(DiffResponse(
                    equal = false, differences = emptyList(),
                    leftValid = leftParsed != null, rightValid = rightParsed != null,
                    error = buildString {
                        if (leftParsed == null) append("Left JSON is invalid. ")
                        if (rightParsed == null) append("Right JSON is invalid.")
                    }
                ))
                return@post
            }

            val diffs = mutableListOf<DiffEntry>()
            diffElements("$", leftParsed, rightParsed, diffs)
            call.respond(DiffResponse(
                equal = diffs.isEmpty(), differences = diffs,
                leftValid = true, rightValid = true
            ))
        }
    }
}

private fun diffElements(path: String, left: JsonElement, right: JsonElement, diffs: MutableList<DiffEntry>) {
    if (left == right) return

    when {
        left is JsonObject && right is JsonObject -> {
            val allKeys = (left.keys + right.keys).toSortedSet()
            for (key in allKeys) {
                val childPath = "$path.$key"
                val l = left[key]
                val r = right[key]
                when {
                    l == null -> diffs.add(DiffEntry(childPath, "added", rightValue = r.toString()))
                    r == null -> diffs.add(DiffEntry(childPath, "removed", leftValue = l.toString()))
                    else -> diffElements(childPath, l, r, diffs)
                }
            }
        }
        left is JsonArray && right is JsonArray -> {
            val maxLen = maxOf(left.size, right.size)
            for (i in 0 until maxLen) {
                val childPath = "$path[$i]"
                val l = left.getOrNull(i)
                val r = right.getOrNull(i)
                when {
                    l == null -> diffs.add(DiffEntry(childPath, "added", rightValue = r.toString()))
                    r == null -> diffs.add(DiffEntry(childPath, "removed", leftValue = l.toString()))
                    else -> diffElements(childPath, l, r, diffs)
                }
            }
        }
        else -> {
            diffs.add(DiffEntry(path, "changed", leftValue = left.toString(), rightValue = right.toString()))
        }
    }
}
