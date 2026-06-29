package pt.cunha.secretsvault

import io.ktor.server.config.*
import pt.cunha.core.BaseDatabase

class Database(config: ApplicationConfig) : BaseDatabase(config) {

    override fun createSchema() {
        connection.createStatement().use { stmt ->
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS secretsvault_config (
                    key VARCHAR(255) PRIMARY KEY,
                    value TEXT NOT NULL
                )
            """)
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS secrets (
                    id SERIAL PRIMARY KEY,
                    label VARCHAR(255) NOT NULL,
                    category VARCHAR(255),
                    tags TEXT,
                    iv TEXT NOT NULL,
                    ciphertext TEXT NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
        }

        val configStmt = connection.prepareStatement(
            "INSERT INTO secretsvault_config (key, value) VALUES (?, ?) ON CONFLICT (key) DO NOTHING"
        )
        fun insertConfig(key: String, value: String) {
            configStmt.setString(1, key)
            configStmt.setString(2, value)
            configStmt.executeUpdate()
        }
        insertConfig("pg_dump_path", "/usr/bin/pg_dump")
        insertConfig("psql_path", "/usr/bin/psql")
        insertConfig("pg_restore_path", "/usr/bin/pg_restore")
    }
}
