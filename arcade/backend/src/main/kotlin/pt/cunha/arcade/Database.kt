package pt.cunha.arcade

import io.ktor.server.config.*
import java.sql.Connection
import java.sql.DriverManager

class Database(private val config: ApplicationConfig) {
    lateinit var connection: Connection

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
                Thread.sleep(2000)
            }
        }

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
