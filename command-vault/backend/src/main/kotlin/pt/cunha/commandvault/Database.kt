package pt.cunha.commandvault

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
        connection = connectWithRetry(url, user, password)
        createSchema()
    }

    private fun connectWithRetry(url: String, user: String, password: String): Connection {
        var lastException: Exception? = null
        repeat(10) { attempt ->
            try {
                return DriverManager.getConnection(url, user, password)
            } catch (e: Exception) {
                lastException = e
                println("DB connection attempt ${attempt + 1}/10 failed: ${e.message}")
                Thread.sleep(2000)
            }
        }
        throw lastException ?: IllegalStateException("Could not connect to database")
    }

    private fun createSchema() {
        connection.createStatement().use { stmt ->
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS commandvault_config (
                    key VARCHAR(255) PRIMARY KEY,
                    value TEXT NOT NULL
                )
            """)
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS snippets (
                    id SERIAL PRIMARY KEY,
                    title VARCHAR(255) NOT NULL,
                    command TEXT NOT NULL,
                    description TEXT,
                    tags TEXT,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
        }
        // Seed default config
        val configStmt = connection.prepareStatement(
            "INSERT INTO commandvault_config (key, value) VALUES (?, ?) ON CONFLICT (key) DO NOTHING"
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
