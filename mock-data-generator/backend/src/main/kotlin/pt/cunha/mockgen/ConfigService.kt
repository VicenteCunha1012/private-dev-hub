package pt.cunha.mockgen

import java.sql.Connection

class ConfigService(private val conn: Connection) {

    fun get(key: String): String? {
        val stmt = conn.prepareStatement("SELECT value FROM mockgen_config WHERE key = ?")
        stmt.setString(1, key)
        return stmt.executeQuery().use { rs -> if (rs.next()) rs.getString("value") else null }
    }

    fun set(key: String, value: String) {
        val stmt = conn.prepareStatement(
            "INSERT INTO mockgen_config (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value"
        )
        stmt.setString(1, key)
        stmt.setString(2, value)
        stmt.executeUpdate()
    }

    fun getAll(): Map<String, String> {
        val result = mutableMapOf<String, String>()
        conn.createStatement().executeQuery("SELECT key, value FROM mockgen_config").use { rs ->
            while (rs.next()) result[rs.getString("key")] = rs.getString("value")
        }
        return result
    }

    fun getMasked(): Map<String, String> {
        val all = getAll()
        return all.mapValues { (k, v) ->
            if (k.contains("key", ignoreCase = true) && v.isNotBlank()) "••••${v.takeLast(4)}" else v
        }
    }

    fun exportDatabase(): String {
        val sb = StringBuilder()
        for (table in listOf("mockgen_config", "specs", "spec_versions")) {
            val rs = conn.createStatement().executeQuery("SELECT * FROM $table")
            val meta = rs.metaData
            val colCount = meta.columnCount
            while (rs.next()) {
                val values = (1..colCount).joinToString(", ") { i ->
                    val v = rs.getObject(i)
                    when (v) {
                        null -> "NULL"
                        is Number -> v.toString()
                        is Boolean -> v.toString()
                        else -> "'${v.toString().replace("'", "''")}'"
                    }
                }
                sb.appendLine("INSERT INTO $table VALUES ($values);")
            }
            rs.close()
        }
        sb.toString()
        return sb.toString()
    }

    fun importDatabase(sql: String) {
        conn.createStatement().use { stmt ->
            stmt.executeUpdate("DELETE FROM spec_versions")
            stmt.executeUpdate("DELETE FROM specs")
            stmt.executeUpdate("DELETE FROM mockgen_config")
        }
        for (line in sql.lines()) {
            val trimmed = line.trim()
            if (trimmed.isNotEmpty() && !trimmed.startsWith("--")) {
                conn.createStatement().use { it.executeUpdate(trimmed) }
            }
        }
    }
}
