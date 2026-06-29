package pt.cunha.commandvault

import pt.cunha.core.BaseConfigService
import java.sql.Connection

class ConfigService(conn: Connection) : BaseConfigService(
    conn,
    configTable = "commandvault_config",
    allTables = listOf("commandvault_config", "snippets", "flows")
) {
    suspend fun getConfig(): VaultConfig {
        val map = getConfigMap()
        return VaultConfig(
            pgDumpPath = map["pg_dump_path"] ?: "/usr/bin/pg_dump",
            psqlPath = map["psql_path"] ?: "/usr/bin/psql",
            pgRestorePath = map["pg_restore_path"] ?: "/usr/bin/pg_restore"
        )
    }

    suspend fun updateConfig(pgDumpPath: String?, psqlPath: String?, pgRestorePath: String?): VaultConfig {
        setConfigs(mapOf(
            "pg_dump_path" to pgDumpPath,
            "psql_path" to psqlPath,
            "pg_restore_path" to pgRestorePath,
        ))
        return getConfig()
    }
}
