package pt.cunha.kafbat

import java.sql.Connection

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
