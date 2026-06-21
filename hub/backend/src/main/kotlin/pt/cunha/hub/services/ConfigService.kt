package pt.cunha.hub.services

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import pt.cunha.hub.models.HubConfig
import pt.cunha.hub.models.KeybindsConfig
import pt.cunha.hub.models.PaletteConfig
import java.sql.Connection

private val json = Json { ignoreUnknownKeys = true }

class ConfigService(private val conn: Connection) {

    suspend fun getConfig(): HubConfig = withContext(Dispatchers.IO) {
        val map = mutableMapOf<String, String>()
        conn.createStatement().executeQuery("SELECT key, value FROM hub_config").use { rs ->
            while (rs.next()) map[rs.getString("key")] = rs.getString("value")
        }
        val keybinds = map["keybinds"]?.let {
            runCatching { json.decodeFromString<KeybindsConfig>(it) }.getOrNull()
        } ?: KeybindsConfig()

        val palette = map["palette"]?.let {
            runCatching { json.decodeFromString<PaletteConfig>(it) }.getOrNull()
        } ?: PaletteConfig()

        HubConfig(
            pgDumpPath = map["pg_dump_path"] ?: "/usr/bin/pg_dump",
            psqlPath = map["psql_path"] ?: "/usr/bin/psql",
            pgRestorePath = map["pg_restore_path"] ?: "/usr/bin/pg_restore",
            keybinds = keybinds,
            palette = palette
        )
    }

    suspend fun updateConfig(
        pgDumpPath: String?,
        psqlPath: String?,
        pgRestorePath: String?,
        keybinds: KeybindsConfig?,
        palette: PaletteConfig? = null
    ): HubConfig = withContext(Dispatchers.IO) {
        val stmt = conn.prepareStatement(
            "INSERT INTO hub_config (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value"
        )
        fun set(key: String, value: String?) {
            if (value != null) {
                stmt.setString(1, key)
                stmt.setString(2, value)
                stmt.executeUpdate()
            }
        }
        set("pg_dump_path", pgDumpPath)
        set("psql_path", psqlPath)
        set("pg_restore_path", pgRestorePath)
        if (keybinds != null) set("keybinds", json.encodeToString(keybinds))
        if (palette != null) set("palette", json.encodeToString(palette))
        getConfig()
    }

    fun getSync(key: String): String? {
        val stmt = conn.prepareStatement("SELECT value FROM hub_config WHERE key = ?")
        stmt.setString(1, key)
        return stmt.executeQuery().use { rs -> if (rs.next()) rs.getString("value") else null }
    }

    fun setSync(key: String, value: String) {
        val stmt = conn.prepareStatement(
            "INSERT INTO hub_config (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value"
        )
        stmt.setString(1, key)
        stmt.setString(2, value)
        stmt.executeUpdate()
    }

    fun exportDatabaseSync(): String {
        val sb = StringBuilder()
        val tables = listOf("folders", "entries", "entry_icons", "hub_config")
        for (table in tables) {
            val rs = conn.createStatement().executeQuery("SELECT * FROM $table")
            val meta = rs.metaData
            val colCount = meta.columnCount
            while (rs.next()) {
                val values = (1..colCount).joinToString(", ") { i ->
                    val v = rs.getObject(i)
                    when (v) {
                        null -> "NULL"
                        is ByteArray -> "decode('${v.joinToString("") { "%02x".format(it) }}', 'hex')"
                        is Number -> v.toString()
                        is Boolean -> v.toString()
                        else -> "'${v.toString().replace("'", "''")}'"
                    }
                }
                sb.appendLine("INSERT INTO $table VALUES ($values);")
            }
            rs.close()
        }
        return sb.toString()
    }

    suspend fun exportDatabase(): String = withContext(Dispatchers.IO) {
        val sb = StringBuilder()
        val tables = listOf("folders", "entries", "entry_icons", "hub_config")
        for (table in tables) {
            val rs = conn.createStatement().executeQuery("SELECT * FROM $table")
            val meta = rs.metaData
            val colCount = meta.columnCount
            while (rs.next()) {
                val values = (1..colCount).joinToString(", ") { i ->
                    val v = rs.getObject(i)
                    when (v) {
                        null -> "NULL"
                        is ByteArray -> "decode('${v.joinToString("") { "%02x".format(it) }}', 'hex')"
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
    }

    suspend fun importDatabase(sql: String) = withContext(Dispatchers.IO) {
        conn.createStatement().use { stmt ->
            stmt.executeUpdate("DELETE FROM entry_icons")
            stmt.executeUpdate("DELETE FROM entries")
            stmt.executeUpdate("DELETE FROM folders")
            stmt.executeUpdate("DELETE FROM hub_config")
        }
        for (line in sql.lines()) {
            val trimmed = line.trim()
            if (trimmed.isNotEmpty() && !trimmed.startsWith("--")) {
                conn.createStatement().use { it.executeUpdate(trimmed) }
            }
        }
    }
}
