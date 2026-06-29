package pt.cunha.mockgen

import io.ktor.server.config.*
import pt.cunha.core.BaseDatabase

class Database(config: ApplicationConfig) : BaseDatabase(config) {

    override fun createSchema() {
        connection.createStatement().use { stmt ->
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS mockgen_config (
                    key VARCHAR(255) PRIMARY KEY,
                    value TEXT NOT NULL
                )
            """)
            stmt.executeUpdate("INSERT INTO mockgen_config (key, value) VALUES ('groq_api_key', '') ON CONFLICT (key) DO NOTHING")
            stmt.executeUpdate("INSERT INTO mockgen_config (key, value) VALUES ('groq_model', 'llama-3.3-70b-versatile') ON CONFLICT (key) DO NOTHING")
            stmt.executeUpdate("INSERT INTO mockgen_config (key, value) VALUES ('faker_locale', 'en_US') ON CONFLICT (key) DO NOTHING")
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
