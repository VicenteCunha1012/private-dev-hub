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
            // Add workdir/command columns idempotently for existing deployments
            stmt.executeUpdate("ALTER TABLE entries ADD COLUMN IF NOT EXISTS workdir TEXT")
            stmt.executeUpdate("ALTER TABLE entries ADD COLUMN IF NOT EXISTS command TEXT")
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
            "INSERT INTO entries (label, url, type, folder_id, position) VALUES (?, ?, ?, ?, ?)"
        )

        fun insertEntry(label: String, url: String, folderId: Int, position: Int) {
            entryStmt.setString(1, label)
            entryStmt.setString(2, url)
            entryStmt.setString(3, "redirect")
            entryStmt.setInt(4, folderId)
            entryStmt.setInt(5, position)
            entryStmt.executeUpdate()
        }

        val toolsId = insertFolder("Tools", 3)

        insertEntry("Portainer", "https://localhost:9443", infraId, 0)
        insertEntry("GitLab", "https://gitlab.example.com", devId, 0)
        insertEntry("Confluence", "https://example.atlassian.net/wiki", devId, 1)
        insertEntry("Jira", "https://example.atlassian.net", devId, 2)
        insertEntry("Grafana", "https://grafana.example.com", obsId, 0)

        entryStmt.setString(1, "Kafbat+")
        entryStmt.setString(2, "http://localhost:10301")
        entryStmt.setString(3, "tool")
        entryStmt.setInt(4, toolsId)
        entryStmt.setInt(5, 0)
        entryStmt.executeUpdate()

        entryStmt.setString(1, "AI Sessions")
        entryStmt.setString(2, "http://localhost:10302")
        entryStmt.setString(3, "tool")
        entryStmt.setInt(4, toolsId)
        entryStmt.setInt(5, 1)
        entryStmt.executeUpdate()

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
