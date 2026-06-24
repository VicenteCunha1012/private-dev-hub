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
    val workdir: String = System.getProperty("user.home") ?: "/home/cunvic",
    val command: String
)

class TuiManager {
    private val sessions = mutableMapOf<String, Pair<TuiSession, Process>>()
    private val portPool = (10604..10620).toMutableList()
    private var nextId = 1
    private val ttydPath = findTtyd()

    private fun findTtyd(): String {
        val candidates = listOf(
            System.getenv("HOME")?.let { "$it/.local/bin/ttyd" },
            "/usr/local/bin/ttyd",
            "/usr/bin/ttyd"
        ).filterNotNull()
        return candidates.firstOrNull { File(it).canExecute() } ?: "ttyd"
    }

    init {
        killOrphanTtydProcesses()
    }

    private fun killOrphanTtydProcesses() {
        try {
            val result = ProcessBuilder("pgrep", "-a", "ttyd")
                .redirectErrorStream(true).start()
            val lines = result.inputStream.bufferedReader().readLines()
            result.waitFor()
            for (line in lines) {
                val match = Regex("^(\\d+)\\s+ttyd\\s+-p\\s+(106\\d+)").find(line) ?: continue
                val pid = match.groupValues[1].toLong()
                ProcessHandle.of(pid).ifPresent { it.destroyForcibly() }
            }
        } catch (_: Exception) {}
    }

    @Synchronized
    fun create(name: String, workdir: String, command: String): TuiSession {
        cleanup()
        // Kill existing sessions with the same name to prevent port exhaustion
        val dupes = sessions.filter { it.value.first.name == name }.keys.toList()
        for (id in dupes) delete(id)
        if (portPool.isEmpty()) error("No available ports in range 10604–10620 (max 17 sessions)")
        val port = portPool.removeFirst()
        val id = (nextId++).toString()

        val dir = File(workdir).also { if (!it.exists()) it.mkdirs() }
        val cmdParts = listOf(ttydPath, "-p", port.toString(), "-W", "bash", "-c", command)

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
