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
}
