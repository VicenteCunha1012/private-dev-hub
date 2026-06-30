package pt.cunha.hub

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
        connection = DriverManager.getConnection(url, user, password)
        createSchema()
        seedIfEmpty()
    }

    private fun createSchema() {
        connection.createStatement().use { stmt ->
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS folders (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    position INT NOT NULL DEFAULT 0
                )
            """)
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS entries (
                    id SERIAL PRIMARY KEY,
                    label VARCHAR(255) NOT NULL,
                    url TEXT,
                    type VARCHAR(50) NOT NULL,
                    folder_id INT REFERENCES folders(id) ON DELETE SET NULL,
                    position INT NOT NULL DEFAULT 0
                )
            """)
            stmt.executeUpdate("ALTER TABLE entries ADD COLUMN IF NOT EXISTS workdir TEXT")
            stmt.executeUpdate("ALTER TABLE entries ADD COLUMN IF NOT EXISTS command TEXT")
            stmt.executeUpdate("ALTER TABLE entries ADD COLUMN IF NOT EXISTS emoji VARCHAR(10)")
            stmt.executeUpdate("ALTER TABLE folders ADD COLUMN IF NOT EXISTS parent_id INT REFERENCES folders(id) ON DELETE SET NULL")
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS entry_icons (
                    entry_id INT PRIMARY KEY REFERENCES entries(id) ON DELETE CASCADE,
                    favicon_data BYTEA,
                    favicon_content_type VARCHAR(100),
                    override_data BYTEA,
                    override_content_type VARCHAR(100),
                    override_url TEXT,
                    last_fetched TIMESTAMPTZ
                )
            """)
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS hub_config (
                    key VARCHAR(255) PRIMARY KEY,
                    value TEXT NOT NULL
                )
            """)
            // merge port-radar + health-dashboard → infra-monitor
            stmt.executeUpdate("UPDATE entries SET label='Infra Monitor', url='http://localhost:10310', emoji='🖥️' WHERE label='Port Radar'")
            stmt.executeUpdate("DELETE FROM entries WHERE label='Health Dashboard'")
            // merge infra-monitor + json-tools + ai-memory + git-history into dev-utils / ai-sessions
            stmt.executeUpdate("DELETE FROM entries WHERE label='Infra Monitor'")
            stmt.executeUpdate("DELETE FROM entries WHERE label='JSON Tools'")
            stmt.executeUpdate("DELETE FROM entries WHERE label='AI Memory'")
            stmt.executeUpdate("DELETE FROM entries WHERE label='Git History'")
        }
    }

    private fun seedIfEmpty() {
        val count = connection.createStatement().use { stmt ->
            stmt.executeQuery("SELECT COUNT(*) FROM folders").use { rs ->
                rs.next(); rs.getInt(1)
            }
        }
        if (count > 0) return

        val folderStmt = connection.prepareStatement(
            "INSERT INTO folders (name, position) VALUES (?, ?) RETURNING id"
        )

        fun insertFolder(name: String, position: Int): Int {
            folderStmt.setString(1, name)
            folderStmt.setInt(2, position)
            return folderStmt.executeQuery().use { rs -> rs.next(); rs.getInt(1) }
        }

        val infraId = insertFolder("Infra", 0)
        val devId = insertFolder("Dev", 1)
        val obsId = insertFolder("Observabilidade", 2)

        val entryStmt = connection.prepareStatement(
            "INSERT INTO entries (label, url, type, folder_id, position, emoji) VALUES (?, ?, ?, ?, ?, ?)"
        )

        fun insertEntry(label: String, url: String, type: String, folderId: Int, position: Int, emoji: String? = null) {
            entryStmt.setString(1, label)
            entryStmt.setString(2, url)
            entryStmt.setString(3, type)
            entryStmt.setInt(4, folderId)
            entryStmt.setInt(5, position)
            entryStmt.setString(6, emoji)
            entryStmt.executeUpdate()
        }

        val toolsId = insertFolder("Tools", 3)

        insertEntry("Portainer", "https://localhost:9443", "redirect", infraId, 0, "🐳")
        insertEntry("GitLab", "https://gitlab.example.com", "redirect", devId, 0, "🦊")
        insertEntry("Confluence", "https://example.atlassian.net/wiki", "redirect", devId, 1, "📖")
        insertEntry("Jira", "https://example.atlassian.net", "redirect", devId, 2, "📋")
        insertEntry("Grafana", "https://grafana.example.com", "redirect", obsId, 0, "📊")

        insertEntry("Kafbat+", "http://localhost:10301", "tool", toolsId, 0, "📨")
        insertEntry("AI Sessions", "http://localhost:10302", "tool", toolsId, 1, "🤖")
        insertEntry("Mock Generator", "http://localhost:10308", "tool", toolsId, 2, "🎲")
        insertEntry("Command Vault", "http://localhost:10309", "tool", toolsId, 3, "💻")
        insertEntry("Todo", "http://localhost:10312", "tool", toolsId, 4, "✅")
        insertEntry("Secrets Vault", "http://localhost:10314", "tool", toolsId, 5, "🔐")
        insertEntry("Dev Utils", "http://localhost:10316", "tool", toolsId, 6, "🧰")

        val configStmt = connection.prepareStatement(
            "INSERT INTO hub_config (key, value) VALUES (?, ?) ON CONFLICT (key) DO NOTHING"
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
