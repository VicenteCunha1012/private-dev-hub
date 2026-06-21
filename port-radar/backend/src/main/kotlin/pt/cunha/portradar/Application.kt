package pt.cunha.portradar

import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.plugins.defaultheaders.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File

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
data class HealthResponse(val status: String)

@Serializable
data class ConfigResponse(val procNetPath: String, val procPath: String)

@Serializable
data class PortsResponse(val ports: List<PortInfo>, val scannedAt: Long)

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
    10310 to "port-radar-frontend",
    10410 to "port-radar-backend",
    10311 to "health-dashboard-frontend",
    10411 to "health-dashboard-backend",
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

fun Application.module() {
    val procNetPath = environment.config.propertyOrNull("portradar.procNetPath")?.getString() ?: "/host/proc/net"
    val procPath = environment.config.propertyOrNull("portradar.procPath")?.getString() ?: "/host/proc"

    install(ContentNegotiation) {
        json(Json { ignoreUnknownKeys = true; prettyPrint = false })
    }

    install(CORS) {
        allowMethod(HttpMethod.Options)
        allowMethod(HttpMethod.Get)
        allowHeader(HttpHeaders.ContentType)
        anyHost()
    }

    install(DefaultHeaders) {
        header("X-Engine", "Ktor")
    }

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
            call.respond(HealthResponse(status = "ok"))
        }

        get("/config") {
            call.respond(ConfigResponse(procNetPath = procNetPath, procPath = procPath))
        }

        get("/ports") {
            val range = call.request.queryParameters["range"]
            val inodeToProcess = buildInodeMap(procPath)
            val ports = mutableListOf<PortInfo>()

            ports.addAll(parseProcNet("$procNetPath/tcp", "tcp", inodeToProcess))
            ports.addAll(parseProcNet("$procNetPath/tcp6", "tcp6", inodeToProcess))

            val result = if (range == "portal") {
                ports.filter { it.isPortal }
            } else {
                ports
            }

            call.respond(PortsResponse(
                ports = result.sortedBy { it.port },
                scannedAt = System.currentTimeMillis()
            ))
        }
    }
}

private fun parseProcNet(path: String, protocol: String, inodeToProcess: Map<String, Pair<Int, String>>): List<PortInfo> {
    val file = File(path)
    if (!file.exists()) return emptyList()

    return file.readLines()
        .drop(1) // skip header
        .mapNotNull { line ->
            val fields = line.trim().split("\\s+".toRegex())
            if (fields.size < 10) return@mapNotNull null

            val localAddress = fields[1]
            val stateHex = fields[3]
            val inode = fields[9]

            val port = try {
                localAddress.substringAfter(":").toInt(16)
            } catch (_: NumberFormatException) {
                return@mapNotNull null
            }

            val state = STATE_MAP[stateHex.uppercase()] ?: "UNKNOWN($stateHex)"
            val processInfo = inodeToProcess[inode]
            val isPortal = port in PORTAL_PORT_RANGE
            val portalModule = if (isPortal) {
                KNOWN_MODULES[port] ?: if (port in 10604..10620) "ttyd-tui-session" else null
            } else null

            PortInfo(
                port = port,
                protocol = protocol,
                state = state,
                pid = processInfo?.first,
                process = processInfo?.second,
                isPortal = isPortal,
                portalModule = portalModule
            )
        }
}

private fun buildInodeMap(procPath: String): Map<String, Pair<Int, String>> {
    val map = mutableMapOf<String, Pair<Int, String>>()
    val procDir = File(procPath)
    if (!procDir.exists()) return map

    procDir.listFiles()?.filter { it.name.matches("\\d+".toRegex()) }?.forEach { pidDir ->
        val pid = pidDir.name.toIntOrNull() ?: return@forEach
        val processName = try {
            File(pidDir, "comm").readText().trim()
        } catch (_: Exception) {
            null
        }

        val fdDir = File(pidDir, "fd")
        if (!fdDir.exists()) return@forEach

        try {
            fdDir.listFiles()?.forEach fd@{ fd ->
                val link = try {
                    java.nio.file.Files.readSymbolicLink(fd.toPath()).toString()
                } catch (_: Exception) {
                    return@fd
                }
                if (link.startsWith("socket:[")) {
                    val inode = link.removePrefix("socket:[").removeSuffix("]")
                    map[inode] = Pair(pid, processName ?: "unknown")
                }
            }
        } catch (_: Exception) {
            // permission denied on some /proc entries is expected
        }
    }

    return map
}
