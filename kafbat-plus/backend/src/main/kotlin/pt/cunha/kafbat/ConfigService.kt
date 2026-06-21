package pt.cunha.kafbat

import kotlinx.serialization.Serializable
import java.sql.Connection

@Serializable
data class ClusterConfig(
    val id: Int,
    val name: String,
    val brokers: String,
    val isDefault: Boolean
)

class ConfigService(private val conn: Connection) {

    fun get(key: String): String? {
        val stmt = conn.prepareStatement("SELECT value FROM kafbat_config WHERE key = ?")
        stmt.setString(1, key)
        return stmt.executeQuery().use { rs ->
            if (rs.next()) rs.getString("value") else null
        }
    }

    fun set(key: String, value: String) {
        val stmt = conn.prepareStatement(
            "INSERT INTO kafbat_config (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value"
        )
        stmt.setString(1, key)
        stmt.setString(2, value)
        stmt.executeUpdate()
    }

    fun getAll(): Map<String, String> {
        val result = mutableMapOf<String, String>()
        conn.createStatement().executeQuery("SELECT key, value FROM kafbat_config").use { rs ->
            while (rs.next()) {
                result[rs.getString("key")] = rs.getString("value")
            }
        }
        return result
    }

    fun getBrokers(): List<String> {
        val raw = get("brokers") ?: return emptyList()
        return raw.split(",").map { it.trim() }.filter { it.isNotEmpty() }
    }

    fun getDefaultLimit(): Int {
        return get("default_limit")?.toIntOrNull() ?: 100
    }

    // ── Cluster CRUD ────────────────────────────────────────────────────────────

    fun getClusters(): List<ClusterConfig> {
        val result = mutableListOf<ClusterConfig>()
        conn.createStatement().executeQuery("SELECT id, name, brokers, is_default FROM clusters ORDER BY id").use { rs ->
            while (rs.next()) {
                result.add(ClusterConfig(
                    id = rs.getInt("id"),
                    name = rs.getString("name"),
                    brokers = rs.getString("brokers"),
                    isDefault = rs.getBoolean("is_default")
                ))
            }
        }
        return result
    }

    fun getCluster(id: Int): ClusterConfig? {
        val stmt = conn.prepareStatement("SELECT id, name, brokers, is_default FROM clusters WHERE id = ?")
        stmt.setInt(1, id)
        return stmt.executeQuery().use { rs ->
            if (rs.next()) ClusterConfig(
                id = rs.getInt("id"),
                name = rs.getString("name"),
                brokers = rs.getString("brokers"),
                isDefault = rs.getBoolean("is_default")
            ) else null
        }
    }

    fun getDefaultCluster(): ClusterConfig? {
        val stmt = conn.prepareStatement("SELECT id, name, brokers, is_default FROM clusters WHERE is_default = true LIMIT 1")
        return stmt.executeQuery().use { rs ->
            if (rs.next()) ClusterConfig(
                id = rs.getInt("id"),
                name = rs.getString("name"),
                brokers = rs.getString("brokers"),
                isDefault = rs.getBoolean("is_default")
            ) else null
        }
    }

    fun createCluster(name: String, brokers: String): ClusterConfig {
        val stmt = conn.prepareStatement(
            "INSERT INTO clusters (name, brokers, is_default) VALUES (?, ?, false) RETURNING id"
        )
        stmt.setString(1, name)
        stmt.setString(2, brokers)
        val rs = stmt.executeQuery()
        rs.next()
        val id = rs.getInt("id")
        rs.close()
        return ClusterConfig(id, name, brokers, false)
    }

    fun updateCluster(id: Int, name: String, brokers: String): ClusterConfig? {
        val stmt = conn.prepareStatement("UPDATE clusters SET name = ?, brokers = ? WHERE id = ?")
        stmt.setString(1, name)
        stmt.setString(2, brokers)
        stmt.setInt(3, id)
        val updated = stmt.executeUpdate()
        return if (updated > 0) getCluster(id) else null
    }

    fun deleteCluster(id: Int): Boolean {
        val stmt = conn.prepareStatement("DELETE FROM clusters WHERE id = ? AND is_default = false")
        stmt.setInt(1, id)
        return stmt.executeUpdate() > 0
    }

    fun resolveBrokers(clusterId: Int?): String {
        if (clusterId != null) {
            val cluster = getCluster(clusterId)
            if (cluster != null) return cluster.brokers
        }
        val defaultCluster = getDefaultCluster()
        if (defaultCluster != null) return defaultCluster.brokers
        return getBrokers().joinToString(",").ifEmpty { "localhost:9092" }
    }

    fun exportDatabase(): String {
        val sb = StringBuilder()
        val rs = conn.createStatement().executeQuery("SELECT * FROM kafbat_config")
        val meta = rs.metaData
        val colCount = meta.columnCount
        while (rs.next()) {
            val values = (1..colCount).joinToString(", ") { i ->
                val v = rs.getObject(i)
                if (v == null) "NULL" else "'${v.toString().replace("'", "''")}'"
            }
            sb.appendLine("INSERT INTO kafbat_config VALUES ($values);")
        }
        rs.close()
        return sb.toString()
    }

    fun importDatabase(sql: String) {
        conn.createStatement().use { it.executeUpdate("DELETE FROM kafbat_config") }
        for (line in sql.lines()) {
            val trimmed = line.trim()
            if (trimmed.isNotEmpty() && !trimmed.startsWith("--")) {
                conn.createStatement().use { it.executeUpdate(trimmed) }
            }
        }
    }
}
