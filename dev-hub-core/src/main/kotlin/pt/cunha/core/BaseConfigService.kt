package pt.cunha.core

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.sql.Connection

open class BaseConfigService(
    protected val conn: Connection,
    private val configTable: String,
    private val allTables: List<String>
) {

    suspend fun getConfigMap(): Map<String, String> = withContext(Dispatchers.IO) {
        val map = mutableMapOf<String, String>()
        conn.createStatement().executeQuery("SELECT key, value FROM $configTable").use { rs ->
            while (rs.next()) map[rs.getString("key")] = rs.getString("value")
        }
        map
    }

    suspend fun setConfig(key: String, value: String) = withContext(Dispatchers.IO) {
        val stmt = conn.prepareStatement(
            "INSERT INTO $configTable (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value"
        )
        stmt.setString(1, key)
        stmt.setString(2, value)
        stmt.executeUpdate()
    }

    suspend fun setConfigs(entries: Map<String, String?>) {
        for ((key, value) in entries) {
            if (value != null) setConfig(key, value)
        }
    }

    suspend fun getMaskedConfigMap(): Map<String, String> = withContext(Dispatchers.IO) {
        val map = mutableMapOf<String, String>()
        conn.createStatement().executeQuery("SELECT key, value FROM $configTable").use { rs ->
            while (rs.next()) {
                val key = rs.getString("key")
                val value = rs.getString("value")
                map[key] = if (key.contains("password", ignoreCase = true) || key.contains("secret", ignoreCase = true)) "****" else value
            }
        }
        map
    }

    suspend fun exportDatabase(): String = DbExportImport.exportTables(conn, allTables)

    suspend fun importDatabase(sql: String) = DbExportImport.importSql(conn, sql, allTables)
}
