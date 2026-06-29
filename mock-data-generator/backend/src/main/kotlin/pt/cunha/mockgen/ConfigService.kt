package pt.cunha.mockgen

import pt.cunha.core.BaseConfigService
import java.sql.Connection

class ConfigService(conn: Connection) : BaseConfigService(
    conn, "mockgen_config", listOf("mockgen_config", "specs", "spec_versions")
) {

    fun get(key: String): String? {
        val stmt = conn.prepareStatement("SELECT value FROM mockgen_config WHERE key = ?")
        stmt.setString(1, key)
        return stmt.executeQuery().use { rs -> if (rs.next()) rs.getString("value") else null }
    }

    fun set(key: String, value: String) {
        val stmt = conn.prepareStatement(
            "INSERT INTO mockgen_config (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value"
        )
        stmt.setString(1, key); stmt.setString(2, value); stmt.executeUpdate()
    }

    fun getAll(): Map<String, String> {
        val result = mutableMapOf<String, String>()
        conn.createStatement().executeQuery("SELECT key, value FROM mockgen_config").use { rs ->
            while (rs.next()) result[rs.getString("key")] = rs.getString("value")
        }
        return result
    }

    fun getMasked(): Map<String, String> {
        return getAll().mapValues { (k, v) ->
            if (k.contains("key", ignoreCase = true) && v.isNotBlank()) "••••${v.takeLast(4)}" else v
        }
    }
}
