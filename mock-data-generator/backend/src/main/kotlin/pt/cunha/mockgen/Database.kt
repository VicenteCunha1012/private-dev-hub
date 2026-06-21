package pt.cunha.mockgen

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

        var retries = 30
        while (retries > 0) {
            try {
                connection = DriverManager.getConnection(url, user, password)
                break
            } catch (e: Exception) {
                retries--
                if (retries == 0) throw e
                Thread.sleep(2000)
            }
        }
        createSchema()
    }

    private fun createSchema() {
        connection.createStatement().use { stmt ->
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS mockgen_config (
                    key VARCHAR(255) PRIMARY KEY,
                    value TEXT NOT NULL
                )
            """)
            stmt.executeUpdate("""
                INSERT INTO mockgen_config (key, value) VALUES ('groq_api_key', '')
                ON CONFLICT (key) DO NOTHING
            """)
            stmt.executeUpdate("""
                INSERT INTO mockgen_config (key, value) VALUES ('groq_model', 'llama-3.3-70b-versatile')
                ON CONFLICT (key) DO NOTHING
            """)
            stmt.executeUpdate("""
                INSERT INTO mockgen_config (key, value) VALUES ('faker_locale', 'en_US')
                ON CONFLICT (key) DO NOTHING
            """)
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS specs (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    mode VARCHAR(50) NOT NULL DEFAULT 'kafka',
                    spec_json TEXT NOT NULL,
                    version INT NOT NULL DEFAULT 1,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS spec_versions (
                    id SERIAL PRIMARY KEY,
                    spec_id INT NOT NULL REFERENCES specs(id) ON DELETE CASCADE,
                    version INT NOT NULL,
                    spec_json TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
        }
    }
}
