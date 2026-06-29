package pt.cunha.utils

import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*
import java.net.URI
import java.net.URLDecoder
import java.net.URLEncoder
import java.security.MessageDigest
import java.util.*
import java.util.regex.PatternSyntaxException

// --- Config (stateless, just returns empty) ---
fun Routing.configRoutes() {
    get("/config") { call.respond(mapOf("status" to "stateless")) }
    post("/config") { call.respond(mapOf("status" to "ok")) }
    get("/config/export") { call.respond(mapOf("status" to "stateless")) }
    post("/config/import") { call.respond(HttpStatusCode.OK, mapOf("status" to "ok")) }
}

// --- Regex ---
@Serializable
data class RegexRequest(val pattern: String, val text: String, val flags: String = "")

@Serializable
data class RegexMatch(val match: String, val start: Int, val end: Int, val groups: List<RegexGroup>)

@Serializable
data class RegexGroup(val index: Int, val name: String? = null, val value: String?)

@Serializable
data class RegexResponse(
    val valid: Boolean,
    val matches: List<RegexMatch> = emptyList(),
    val error: String? = null,
    val explanation: String? = null
)

fun Routing.regexRoutes() {
    post("/regex/test") {
        val req = call.receive<RegexRequest>()
        try {
            val options = mutableSetOf<RegexOption>()
            if (req.flags.contains("i")) options.add(RegexOption.IGNORE_CASE)
            if (req.flags.contains("m")) options.add(RegexOption.MULTILINE)
            if (req.flags.contains("s")) options.add(RegexOption.DOT_MATCHES_ALL)

            val regex = Regex(req.pattern, options)
            val matches = regex.findAll(req.text).map { mr ->
                val groups = mr.groups.mapIndexed { i, g ->
                    RegexGroup(i, null, g?.value)
                }
                RegexMatch(mr.value, mr.range.first, mr.range.last + 1, groups)
            }.toList()

            val explanation = explainRegex(req.pattern)
            call.respond(RegexResponse(true, matches, explanation = explanation))
        } catch (e: PatternSyntaxException) {
            call.respond(RegexResponse(false, error = e.message))
        }
    }
}

private fun explainRegex(pattern: String): String {
    val parts = mutableListOf<String>()
    var i = 0
    while (i < pattern.length) {
        when (pattern[i]) {
            '^' -> parts.add("^ = start of line")
            '$' -> parts.add("$ = end of line")
            '.' -> parts.add(". = any character")
            '*' -> parts.add("* = zero or more")
            '+' -> parts.add("+ = one or more")
            '?' -> parts.add("? = optional")
            '\\' -> {
                if (i + 1 < pattern.length) {
                    val next = pattern[i + 1]
                    when (next) {
                        'd' -> parts.add("\\d = digit")
                        'w' -> parts.add("\\w = word char")
                        's' -> parts.add("\\s = whitespace")
                        'D' -> parts.add("\\D = non-digit")
                        'W' -> parts.add("\\W = non-word char")
                        'S' -> parts.add("\\S = non-whitespace")
                        'b' -> parts.add("\\b = word boundary")
                        else -> parts.add("\\$next = literal '$next'")
                    }
                    i++
                }
            }
            '[' -> {
                val closeIdx = pattern.indexOf(']', i)
                if (closeIdx > i) {
                    val charClass = pattern.substring(i, closeIdx + 1)
                    parts.add("$charClass = character class")
                    i = closeIdx
                }
            }
            '(' -> {
                if (i + 1 < pattern.length && pattern[i + 1] == '?') {
                    parts.add("(? = non-capturing or special group")
                } else {
                    parts.add("( = capturing group start")
                }
            }
            ')' -> parts.add(") = group end")
            '{' -> {
                val closeIdx = pattern.indexOf('}', i)
                if (closeIdx > i) {
                    val quantifier = pattern.substring(i, closeIdx + 1)
                    parts.add("$quantifier = repetition")
                    i = closeIdx
                }
            }
            '|' -> parts.add("| = alternation (or)")
            else -> {}
        }
        i++
    }
    return parts.joinToString("; ")
}

// --- Cron ---
@Serializable
data class CronRequest(val expression: String, val count: Int = 5)

@Serializable
data class CronResponse(
    val valid: Boolean,
    val readable: String? = null,
    val nextExecutions: List<String> = emptyList(),
    val error: String? = null,
    val type: String? = null
)

fun Routing.cronRoutes() {
    post("/cron/parse") {
        val req = call.receive<CronRequest>()
        val expr = req.expression.trim()
        try {
            if (expr.startsWith("OnCalendar=") || expr.contains("--") || expr.all { it.isDigit() || it == '-' || it == ':' || it == ' ' || it == '*' || it == '/' }) {
                // Attempt systemd OnCalendar parsing
                val cleaned = expr.removePrefix("OnCalendar=").trim()
                val readable = parseSystemdCalendar(cleaned)
                call.respond(CronResponse(true, readable, type = "systemd"))
            } else {
                val parts = expr.split("\\s+".toRegex())
                if (parts.size < 5 || parts.size > 7) {
                    call.respond(CronResponse(false, error = "Expected 5-7 fields for cron expression"))
                    return@post
                }
                val readable = parseCronExpression(parts)
                val nextExecs = computeNextCronExecutions(parts, req.count)
                call.respond(CronResponse(true, readable, nextExecs, type = "cron"))
            }
        } catch (e: Exception) {
            call.respond(CronResponse(false, error = e.message))
        }
    }
}

private fun parseCronExpression(parts: List<String>): String {
    val minute = parts[0]
    val hour = parts[1]
    val dayOfMonth = parts[2]
    val month = parts[3]
    val dayOfWeek = parts[4]

    val sb = StringBuilder("Runs ")
    if (minute == "*" && hour == "*") sb.append("every minute")
    else if (minute == "0" && hour == "*") sb.append("every hour")
    else if (minute.startsWith("*/")) sb.append("every ${minute.removePrefix("*/")} minutes")
    else if (hour.startsWith("*/")) sb.append("at minute $minute, every ${hour.removePrefix("*/")} hours")
    else if (hour != "*" && minute != "*") sb.append("at ${hour.padStart(2,'0')}:${minute.padStart(2,'0')}")
    else if (hour != "*") sb.append("every minute during hour $hour")
    else sb.append("at minute $minute of every hour")

    if (dayOfMonth != "*") sb.append(", on day $dayOfMonth of the month")
    if (month != "*") sb.append(", in month $month")
    if (dayOfWeek != "*") {
        val days = mapOf("0" to "Sun","1" to "Mon","2" to "Tue","3" to "Wed","4" to "Thu","5" to "Fri","6" to "Sat","7" to "Sun")
        val dayName = days[dayOfWeek] ?: dayOfWeek
        sb.append(", on $dayName")
    }
    return sb.toString()
}

private fun parseSystemdCalendar(expr: String): String {
    return when {
        expr == "daily" -> "Runs daily at 00:00"
        expr == "hourly" -> "Runs at the start of every hour"
        expr == "weekly" -> "Runs every Monday at 00:00"
        expr == "monthly" -> "Runs on the 1st of every month at 00:00"
        expr == "yearly" || expr == "annually" -> "Runs on January 1st at 00:00"
        else -> "Runs on schedule: $expr"
    }
}

private fun computeNextCronExecutions(parts: List<String>, count: Int): List<String> {
    val executions = mutableListOf<String>()
    var cal = java.time.LocalDateTime.now().plusMinutes(1).withSecond(0).withNano(0)
    var attempts = 0
    while (executions.size < count && attempts < 525960) {
        if (matchesCron(cal, parts)) {
            executions.add(cal.toString())
        }
        cal = cal.plusMinutes(1)
        attempts++
    }
    return executions
}

private fun matchesCron(dt: java.time.LocalDateTime, parts: List<String>): Boolean {
    fun matches(value: Int, field: String): Boolean {
        if (field == "*") return true
        if (field.contains("/")) {
            val step = field.substringAfter("/").toIntOrNull() ?: return false
            val base = field.substringBefore("/").let { if (it == "*") 0 else it.toIntOrNull() ?: 0 }
            return (value - base) % step == 0 && value >= base
        }
        if (field.contains(",")) return field.split(",").any { it.trim().toIntOrNull() == value }
        if (field.contains("-")) {
            val range = field.split("-")
            val low = range[0].toIntOrNull() ?: return false
            val high = range[1].toIntOrNull() ?: return false
            return value in low..high
        }
        return field.toIntOrNull() == value
    }

    return matches(dt.minute, parts[0]) &&
            matches(dt.hour, parts[1]) &&
            matches(dt.dayOfMonth, parts[2]) &&
            matches(dt.monthValue, parts[3]) &&
            matches(dt.dayOfWeek.value % 7, parts[4])
}

// --- UUID/ULID ---
@Serializable
data class UuidRequest(val count: Int = 1, val format: String = "uuid4")

@Serializable
data class UuidResponse(val values: List<String>)

fun Routing.uuidRoutes() {
    post("/uuid/generate") {
        val req = call.receive<UuidRequest>()
        val count = req.count.coerceIn(1, 1000)
        val values = (1..count).map {
            when (req.format) {
                "uuid4" -> UUID.randomUUID().toString()
                "uuid4-upper" -> UUID.randomUUID().toString().uppercase()
                "uuid4-no-dashes" -> UUID.randomUUID().toString().replace("-", "")
                "ulid" -> generateUlid()
                else -> UUID.randomUUID().toString()
            }
        }
        call.respond(UuidResponse(values))
    }
}

private fun generateUlid(): String {
    val timestamp = System.currentTimeMillis()
    val chars = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
    val sb = StringBuilder()
    // 10 chars for timestamp (48 bits in base32)
    var t = timestamp
    for (i in 9 downTo 0) {
        sb.append(chars[(t % 32).toInt()])
        t /= 32
    }
    sb.reverse()
    // 16 chars random
    val random = java.security.SecureRandom()
    for (i in 0 until 16) {
        sb.append(chars[random.nextInt(32)])
    }
    return sb.toString()
}

// --- Hash ---
@Serializable
data class HashRequest(val text: String, val algorithm: String = "sha256")

@Serializable
data class HashResponse(val hash: String, val algorithm: String)

@Serializable
data class HashCompareRequest(val hash1: String, val hash2: String)

@Serializable
data class HashCompareResponse(val match: Boolean)

fun Routing.hashRoutes() {
    post("/hash/compute") {
        val req = call.receive<HashRequest>()
        val algo = when (req.algorithm.lowercase()) {
            "md5" -> "MD5"
            "sha1", "sha-1" -> "SHA-1"
            "sha256", "sha-256" -> "SHA-256"
            "sha384", "sha-384" -> "SHA-384"
            "sha512", "sha-512" -> "SHA-512"
            else -> throw IllegalArgumentException("Unsupported algorithm: ${req.algorithm}")
        }
        val digest = MessageDigest.getInstance(algo)
        val hash = digest.digest(req.text.toByteArray()).joinToString("") { "%02x".format(it) }
        call.respond(HashResponse(hash, algo))
    }

    post("/hash/compare") {
        val req = call.receive<HashCompareRequest>()
        call.respond(HashCompareResponse(req.hash1.equals(req.hash2, ignoreCase = true)))
    }
}

// --- URL ---
@Serializable
data class UrlParseRequest(val url: String)

@Serializable
data class UrlParseResponse(
    val valid: Boolean,
    val scheme: String? = null,
    val host: String? = null,
    val port: Int? = null,
    val path: String? = null,
    val query: String? = null,
    val fragment: String? = null,
    val queryParams: List<QueryParam> = emptyList(),
    val error: String? = null
)

@Serializable
data class QueryParam(val key: String, val value: String)

@Serializable
data class UrlEncodeRequest(val text: String, val decode: Boolean = false)

@Serializable
data class UrlEncodeResponse(val result: String)

fun Routing.urlRoutes() {
    post("/url/parse") {
        val req = call.receive<UrlParseRequest>()
        try {
            val uri = URI(req.url)
            val params = uri.query?.split("&")?.mapNotNull { param ->
                val parts = param.split("=", limit = 2)
                if (parts.isNotEmpty()) QueryParam(
                    URLDecoder.decode(parts[0], "UTF-8"),
                    if (parts.size > 1) URLDecoder.decode(parts[1], "UTF-8") else ""
                ) else null
            } ?: emptyList()

            call.respond(UrlParseResponse(
                valid = true,
                scheme = uri.scheme,
                host = uri.host,
                port = if (uri.port > 0) uri.port else null,
                path = uri.path,
                query = uri.query,
                fragment = uri.fragment,
                queryParams = params
            ))
        } catch (e: Exception) {
            call.respond(UrlParseResponse(false, error = e.message))
        }
    }

    post("/url/encode") {
        val req = call.receive<UrlEncodeRequest>()
        val result = if (req.decode) URLDecoder.decode(req.text, "UTF-8")
        else URLEncoder.encode(req.text, "UTF-8")
        call.respond(UrlEncodeResponse(result))
    }
}

// --- JWT ---
@Serializable
data class JwtDecodeRequest(val token: String)

@Serializable
data class JwtDecodeResponse(
    val valid: Boolean,
    val header: JsonObject? = null,
    val payload: JsonObject? = null,
    val error: String? = null
)

fun Routing.jwtRoutes() {
    post("/jwt/decode") {
        val req = call.receive<JwtDecodeRequest>()
        try {
            val parts = req.token.trim().split(".")
            if (parts.size < 2) {
                call.respond(JwtDecodeResponse(false, error = "Invalid JWT format"))
                return@post
            }
            val decoder = Base64.getUrlDecoder()
            val headerJson = String(decoder.decode(padBase64(parts[0])))
            val payloadJson = String(decoder.decode(padBase64(parts[1])))

            val header = Json.parseToJsonElement(headerJson).jsonObject
            val payload = Json.parseToJsonElement(payloadJson).jsonObject

            call.respond(JwtDecodeResponse(true, header, payload))
        } catch (e: Exception) {
            call.respond(JwtDecodeResponse(false, error = e.message))
        }
    }
}

private fun padBase64(s: String): String {
    val remainder = s.length % 4
    return if (remainder > 0) s + "=".repeat(4 - remainder) else s
}
