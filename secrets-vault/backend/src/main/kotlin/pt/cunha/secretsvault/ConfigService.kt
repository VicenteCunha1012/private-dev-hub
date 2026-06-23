package pt.cunha.secretsvault

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.sql.Connection

class ConfigService(private val conn: Connection) {

    suspend fun getConfig(): VaultConfig = withContext(Dispatchers.IO) {
        val map = mutableMapOf<String, String>()
        conn.createStatement().executeQuery("SELECT key, value FROM secretsvault_config").use { rs ->
            while (rs.next()) map[rs.getString("key")] = rs.getString("value")
        }
        VaultConfig(
            pgDumpPath = map["pg_dump_path"] ?: "/usr/bin/pg_dump",
            psqlPath = map["psql_path"] ?: "/usr/bin/psql",
            pgRestorePath = map["pg_restore_path"] ?: "/usr/bin/pg_restore"
        )
    }

    suspend fun getCryptoConfig(): VaultCryptoConfig = withContext(Dispatchers.IO) {
        val map = mutableMapOf<String, String>()
        conn.createStatement().executeQuery("SELECT key, value FROM secretsvault_config").use { rs ->
            while (rs.next()) map[rs.getString("key")] = rs.getString("value")
        }
        VaultCryptoConfig(
            kdfSalt = map["kdf_salt"],
            verifySalt = map["verify_salt"],
            verifier = map["verifier"],
            iterations = map["iterations"]?.toIntOrNull(),
            initialized = map["verifier"] != null
        )
    }

    suspend fun updateCryptoConfig(req: UpdateCryptoConfigRequest) = withContext(Dispatchers.IO) {
        val stmt = conn.prepareStatement(
            "INSERT INTO secretsvault_config (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value"
        )
        fun set(key: String, value: String?) {
            if (value != null) {
                stmt.setString(1, key)
                stmt.setString(2, value)
                stmt.executeUpdate()
            }
        }
        set("kdf_salt", req.kdfSalt)
        set("verify_salt", req.verifySalt)
        set("verifier", req.verifier)
        set("iterations", req.iterations?.toString())
    }

    suspend fun exportDatabase(): String = withContext(Dispatchers.IO) {
        val sb = StringBuilder()
        val tables = listOf("secretsvault_config", "secrets")
        for (table in tables) {
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
    }

    suspend fun importDatabase(sql: String) = withContext(Dispatchers.IO) {
        conn.createStatement().use { stmt ->
            stmt.executeUpdate("DELETE FROM secrets")
            stmt.executeUpdate("DELETE FROM secretsvault_config")
        }
        for (line in sql.lines()) {
            val trimmed = line.trim()
            if (trimmed.isNotEmpty() && !trimmed.startsWith("--")) {
                conn.createStatement().use { it.executeUpdate(trimmed) }
            }
        }
    }
}
