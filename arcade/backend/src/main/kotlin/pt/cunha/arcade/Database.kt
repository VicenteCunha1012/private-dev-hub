package pt.cunha.arcade

import io.ktor.server.config.*
import pt.cunha.core.BaseDatabase

class Database(config: ApplicationConfig) : BaseDatabase(config) {

    override fun createSchema() {
        connection.createStatement().use { stmt ->
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS arcade_config (
                    key VARCHAR(255) PRIMARY KEY,
                    value TEXT
                )
            """)
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS coins (
                    id SERIAL PRIMARY KEY,
                    amount INT NOT NULL DEFAULT 1,
                    source VARCHAR(50) NOT NULL DEFAULT 'git-push',
                    earned_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS scores (
                    id SERIAL PRIMARY KEY,
                    game_id VARCHAR(50) NOT NULL,
                    score INT NOT NULL,
                    duration_seconds INT,
                    won BOOLEAN DEFAULT FALSE,
                    played_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS play_sessions (
                    id VARCHAR(50) PRIMARY KEY,
                    offered_games TEXT NOT NULL,
                    chosen_game VARCHAR(50),
                    coin_consumed BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
        }
    }
}
