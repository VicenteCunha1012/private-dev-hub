package pt.cunha.secretsvault

import pt.cunha.core.BaseConfigService
import java.sql.Connection

class ConfigService(conn: Connection) : BaseConfigService(conn, "secretsvault_config", listOf("secretsvault_config", "secrets")) {

    suspend fun getConfig(): VaultConfig {
        val map = getConfigMap()
        return VaultConfig(
            pgDumpPath = map["pg_dump_path"] ?: "/usr/bin/pg_dump",
            psqlPath = map["psql_path"] ?: "/usr/bin/psql",
            pgRestorePath = map["pg_restore_path"] ?: "/usr/bin/pg_restore"
        )
    }

    suspend fun getCryptoConfig(): VaultCryptoConfig {
        val map = getConfigMap()
        return VaultCryptoConfig(
            kdfSalt = map["kdf_salt"],
            verifySalt = map["verify_salt"],
            verifier = map["verifier"],
            iterations = map["iterations"]?.toIntOrNull(),
            initialized = map["verifier"] != null
        )
    }

    suspend fun updateCryptoConfig(req: UpdateCryptoConfigRequest) {
        setConfigs(mapOf(
            "kdf_salt" to req.kdfSalt,
            "verify_salt" to req.verifySalt,
            "verifier" to req.verifier,
            "iterations" to req.iterations?.toString()
        ))
    }
}
