package pt.cunha.ttydmanager

import kotlinx.serialization.Serializable
import java.io.File

@Serializable
data class TuiSession(
    val id: String,
    val name: String,
    val workdir: String,
    val command: String,
    val port: Int,
    val url: String
)

@Serializable
data class CreateTuiRequest(
    val name: String,
    val workdir: String = "/root",
    val command: String
)

class TuiManager {
    private val sessions = mutableMapOf<String, Pair<TuiSession, Process>>()
    private val portPool = (10604..10620).toMutableList()
    private var nextId = 1

    @Synchronized
    fun create(name: String, workdir: String, command: String): TuiSession {
        // cleanup dead processes and reclaim ports before allocating
        cleanup()
        if (portPool.isEmpty()) error("No available ports in range 10604–10620 (max 17 sessions)")
        val port = portPool.removeFirst()
        val id = (nextId++).toString()

        val dir = File(workdir).also { if (!it.exists()) it.mkdirs() }
        val cmdParts = listOf("ttyd", "-p", port.toString(), "-W") +
            command.trim().split("\\s+".toRegex()).filter { it.isNotEmpty() }

        val process = ProcessBuilder(cmdParts)
            .directory(dir)
            .redirectErrorStream(true)
            .start()

        val session = TuiSession(id, name, workdir, command, port, "http://localhost:$port")
        sessions[id] = session to process
        return session
    }

    @Synchronized
    fun list(): List<TuiSession> {
        cleanup()
        return sessions.values.map { it.first }
    }

    @Synchronized
    fun delete(id: String): Boolean {
        val entry = sessions.remove(id) ?: return false
        entry.second.destroyForcibly()
        portPool.add(entry.first.port)
        portPool.sort()
        return true
    }

    private fun cleanup() {
        val dead = sessions.filterValues { !it.second.isAlive }.keys.toList()
        dead.forEach { id ->
            sessions.remove(id)?.let { portPool.add(it.first.port) }
        }
        portPool.sort()
    }
}
