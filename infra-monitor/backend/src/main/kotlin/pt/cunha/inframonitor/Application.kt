package pt.cunha.inframonitor

import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
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
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File
import java.time.Instant

// ── Port Radar types ──────────────────────────────────────────────────────────

@Serializable
data class PortInfo(
    val port: Int,
    val protocol: String,
    val state: String,
    val pid: Int?,
    val process: String?,
    val isPortal: Boolean,
    val portalModule: String?
)

@Serializable
data class PortsResponse(val ports: List<PortInfo>, val scannedAt: Long)

// ── Health Dashboard types ─────────────────────────────────────────────────────

@Serializable
data class ServiceConfig(val name: String, val url: String)

@Serializable
data class ServiceStatus(
    val name: String,
    val url: String,
    val status: String,
    val responseTimeMs: Long,
    val error: String? = null
)

@Serializable
data class StatusResponse(val services: List<ServiceStatus>, val checkedAt: String)

// ── Port Radar constants ───────────────────────────────────────────────────────

private val PORTAL_PORT_RANGE = 10300..10620

private val KNOWN_MODULES = mapOf(
    10300 to "hub-frontend",
    10303 to "hub-backend",
    10403 to "hub-db",
    10301 to "kafbat-plus-frontend",
    10401 to "kafbat-plus-backend",
    10501 to "kafbat-plus-db",
    10302 to "ai-sessions-frontend",
    10402 to "ai-sessions-backend",
    10306 to "json-tools-frontend",
    10406 to "json-tools-backend",
    10308 to "mock-generator-frontend",
    10408 to "mock-generator-backend",
    10508 to "mock-generator-db",
    10309 to "command-vault-frontend",
    10409 to "command-vault-backend",
    10509 to "command-vault-db",
    10310 to "infra-monitor-frontend",
    10410 to "infra-monitor-backend",
    10600 to "ttyd-manager"
)

private val STATE_MAP = mapOf(
    "01" to "ESTABLISHED",
    "02" to "SYN_SENT",
    "03" to "SYN_RECV",
    "04" to "FIN_WAIT1",
    "05" to "FIN_WAIT2",
    "06" to "TIME_WAIT",
    "07" to "CLOSE",
    "08" to "CLOSE_WAIT",
    "09" to "LAST_ACK",
    "0A" to "LISTEN",
    "0B" to "CLOSING"
)

// ── Health Dashboard state ─────────────────────────────────────────────────────

private val defaultServices = listOf(
    ServiceConfig("hub-backend", "http://hub-backend:10303/health"),
    ServiceConfig("kafbat-plus-backend", "http://kafbat-plus-backend:10401/health"),
    ServiceConfig("ai-session-manager-backend", "http://ai-session-manager-backend:10402/health"),
    ServiceConfig("json-tools-backend", "http://json-tools-backend:10406/health"),
    ServiceConfig("mock-data-generator-backend", "http://mock-data-generator-backend:10408/health"),
    ServiceConfig("command-vault-backend", "http://command-vault-backend:10409/health"),
    ServiceConfig("infra-monitor-backend", "http://infra-monitor-backend:10410/health"),
    ServiceConfig("ttyd-manager", "http://host.docker.internal:10600/health"),
)

private var services: MutableList<ServiceConfig> = defaultServices.toMutableList()

private val httpClient = HttpClient(CIO) {
    engine { requestTimeout = 5000 }
}

// ── Application ────────────────────────────────────────────────────────────────

fun Application.module() {
    val procNetPath = environment.config.propertyOrNull("inframonitor.procNetPath")?.getString() ?: "/host/proc/1/net"
    val procPath = environment.config.propertyOrNull("inframonitor.procPath")?.getString() ?: "/host/proc"

    install(ContentNegotiation) {
        json(Json { ignoreUnknownKeys = true; prettyPrint = false; isLenient = true })
    }
    install(CORS) {
        anyHost()
        allowHeader(HttpHeaders.ContentType)
        allowMethod(HttpMethod.Options)
        allowMethod(HttpMethod.Get)
        allowMethod(HttpMethod.Post)
        allowMethod(HttpMethod.Put)
        allowMethod(HttpMethod.Delete)
    }
    install(DefaultHeaders)
    install(StatusPages) {
        exception<IllegalArgumentException> { call, cause ->
            call.respond(HttpStatusCode.BadRequest, mapOf("error" to (cause.message ?: "Bad request")))
        }
        exception<Throwable> { call, cause ->
            call.application.log.error("Unhandled error", cause)
            call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (cause.message ?: "Internal error")))
        }
    }

    routing {
        get("/health") {
            call.respond(mapOf("status" to "ok"))
        }

        // ── Port Radar ──

        get("/ports") {
            val range = call.request.queryParameters["range"]
            val inodeToProcess = buildInodeMap(procPath)
            val ports = mutableListOf<PortInfo>()
            ports.addAll(parseProcNet("$procNetPath/tcp", "tcp", inodeToProcess))
            ports.addAll(parseProcNet("$procNetPath/tcp6", "tcp6", inodeToProcess))
            val deduped = ports.filter { it.state == "LISTEN" }
                .distinctBy { Triple(it.port, it.protocol, it.state) }
            val result = if (range == "portal") deduped.filter { it.isPortal } else deduped
            call.respond(PortsResponse(ports = result.sortedBy { it.port }, scannedAt = System.currentTimeMillis()))
        }

        // ── Health Dashboard ──

        get("/status") {
            val results = coroutineScope {
                services.map { service -> async { checkService(service) } }.awaitAll()
            }
            call.respond(StatusResponse(services = results, checkedAt = Instant.now().toString()))
        }

        get("/config") {
            call.respond(services.toList())
        }

        post("/config") {
            services = call.receive<List<ServiceConfig>>().toMutableList()
            call.respond(services.toList())
        }
    }
}

// ── Port Radar helpers ─────────────────────────────────────────────────────────

private fun parseProcNet(path: String, protocol: String, inodeToProcess: Map<String, Pair<Int, String>>): List<PortInfo> {
    val file = File(path)
    if (!file.exists()) return emptyList()
    return file.readLines().drop(1).mapNotNull { line ->
        val fields = line.trim().split("\\s+".toRegex())
        if (fields.size < 10) return@mapNotNull null
        val localAddress = fields[1]
        val stateHex = fields[3]
        val inode = fields[9]
        val port = try {
            localAddress.substringAfter(":").toInt(16)
        } catch (_: NumberFormatException) { return@mapNotNull null }
        val state = STATE_MAP[stateHex.uppercase()] ?: "UNKNOWN($stateHex)"
        val processInfo = inodeToProcess[inode]
        val isPortal = port in PORTAL_PORT_RANGE
        val portalModule = if (isPortal) KNOWN_MODULES[port] ?: if (port in 10604..10620) "ttyd-tui-session" else null else null
        PortInfo(port, protocol, state, processInfo?.first, processInfo?.second, isPortal, portalModule)
    }
}

private fun buildInodeMap(procPath: String): Map<String, Pair<Int, String>> {
    val map = mutableMapOf<String, Pair<Int, String>>()
    val procDir = File(procPath)
    if (!procDir.exists()) return map
    procDir.listFiles()?.filter { it.name.matches("\\d+".toRegex()) }?.forEach { pidDir ->
        val pid = pidDir.name.toIntOrNull() ?: return@forEach
        val processName = try { File(pidDir, "comm").readText().trim() } catch (_: Exception) { null }
        val fdDir = File(pidDir, "fd")
        if (!fdDir.exists()) return@forEach
        try {
            fdDir.listFiles()?.forEach fd@{ fd ->
                val link = try { java.nio.file.Files.readSymbolicLink(fd.toPath()).toString() } catch (_: Exception) { return@fd }
                if (link.startsWith("socket:[")) {
                    val inode = link.removePrefix("socket:[").removeSuffix("]")
                    map[inode] = Pair(pid, processName ?: "unknown")
                }
            }
        } catch (_: Exception) {}
    }
    return map
}

// ── Health Dashboard helpers ───────────────────────────────────────────────────

private suspend fun checkService(service: ServiceConfig): ServiceStatus {
    val start = System.currentTimeMillis()
    return try {
        val response = httpClient.get(service.url)
        val elapsed = System.currentTimeMillis() - start
        val body = response.bodyAsText()
        when {
            response.status.value == 200 && body.contains("ok", ignoreCase = true) ->
                ServiceStatus(service.name, service.url, "up", elapsed)
            response.status.value == 200 ->
                ServiceStatus(service.name, service.url, "degraded", elapsed)
            else ->
                ServiceStatus(service.name, service.url, "down", elapsed, "HTTP ${response.status.value}")
        }
    } catch (e: Exception) {
        ServiceStatus(service.name, service.url, "down", System.currentTimeMillis() - start, e.message)
    }
}
