package pt.cunha.secretsvault

import io.ktor.server.config.*
import java.sql.Connection
import java.sql.DriverManager

class Database(private val config: ApplicationConfig) {

    lateinit var connection: Connection
        private set

    fun init() {
        Class.forName("org.postgresql.Driver")
        val url = config.property("postgres.url").getString()
        val user = config.property("postgres.user").getString()
        val password = config.property("postgres.password").getString()

        var attempts = 0
        while (true) {
            try {
                connection = DriverManager.getConnection(url, user, password)
                break
            } catch (e: Exception) {
                attempts++
                if (attempts >= 30) throw e
                println("DB connection attempt $attempts/30 failed: ${e.message}")
                Thread.sleep(2000)
            }
        }

        createSchema()
    }

    private fun createSchema() {
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
