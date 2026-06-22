package pt.cunha.todo

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
        seedDefaults()
    }

    private fun connectWithRetry(url: String, user: String, password: String): Connection {
        var lastException: Exception? = null
        repeat(30) { attempt ->
            try {
                return DriverManager.getConnection(url, user, password)
            } catch (e: Exception) {
                lastException = e
                println("DB connection attempt ${attempt + 1}/30 failed: ${e.message}")
                Thread.sleep(2000)
            }
        }
        throw lastException ?: IllegalStateException("Could not connect to database")
    }

    private fun createSchema() {
        connection.createStatement().use { stmt ->
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS todo_config (
                    key VARCHAR(255) PRIMARY KEY,
                    value TEXT
                )
            """)
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS lists (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    color VARCHAR(20) DEFAULT '#8b5cf6',
                    icon VARCHAR(10) DEFAULT '📋',
                    position INT NOT NULL DEFAULT 0,
                    parent_id INT REFERENCES lists(id) ON DELETE SET NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS tasks (
                    id SERIAL PRIMARY KEY,
                    list_id INT REFERENCES lists(id) ON DELETE CASCADE,
                    title TEXT NOT NULL,
                    notes TEXT,
                    completed BOOLEAN DEFAULT FALSE,
                    priority INT DEFAULT 0,
                    due_date DATE,
                    tags TEXT,
                    position INT NOT NULL DEFAULT 0,
                    parent_id INT REFERENCES tasks(id) ON DELETE CASCADE,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    completed_at TIMESTAMPTZ
                )
            """)
        }
    }

    private fun seedDefaults() {
        val count = connection.createStatement().executeQuery("SELECT COUNT(*) FROM lists").use { rs ->
            rs.next(); rs.getInt(1)
        }
        if (count == 0) {
            val stmt = connection.prepareStatement(
                "INSERT INTO lists (name, icon, color, position) VALUES (?, ?, ?, ?)"
            )
            fun insertList(name: String, icon: String, color: String, position: Int) {
                stmt.setString(1, name)
                stmt.setString(2, icon)
                stmt.setString(3, color)
                stmt.setInt(4, position)
                stmt.executeUpdate()
            }
            insertList("My Day", "☀️", "#f59e0b", 0)
            insertList("Important", "⭐", "#ef4444", 1)
            insertList("Tasks", "📋", "#8b5cf6", 2)
        }
    }
}
