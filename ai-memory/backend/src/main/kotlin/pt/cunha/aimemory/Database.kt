package pt.cunha.aimemory

import io.ktor.server.config.*
import pt.cunha.core.BaseDatabase

class Database(config: ApplicationConfig) : BaseDatabase(config) {

    override fun createSchema() {
        connection.createStatement().use { stmt ->
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS aimemory_config (
                    key VARCHAR(255) PRIMARY KEY,
                    value TEXT NOT NULL
                )
            """)
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS handoffs (
                    id SERIAL PRIMARY KEY,
                    project VARCHAR(255) NOT NULL,
                    context VARCHAR(255) DEFAULT 'default',
                    content TEXT NOT NULL,
                    tool VARCHAR(50),
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS decisions (
                    id SERIAL PRIMARY KEY,
                    title VARCHAR(500) NOT NULL,
                    description TEXT NOT NULL,
                    reasoning TEXT,
                    alternatives TEXT,
                    tags TEXT,
                    project VARCHAR(255),
                    mr_link TEXT,
                    ticket_link TEXT,
                    tool VARCHAR(50),
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
        }
    }
}
