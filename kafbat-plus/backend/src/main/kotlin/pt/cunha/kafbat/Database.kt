package pt.cunha.kafbat

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
                CREATE TABLE IF NOT EXISTS kafbat_config (
                    key VARCHAR(255) PRIMARY KEY,
                    value TEXT NOT NULL
                )
            """)
            stmt.executeUpdate("""
                INSERT INTO kafbat_config (key, value) VALUES ('brokers', 'localhost:9092')
                ON CONFLICT (key) DO NOTHING
            """)
            stmt.executeUpdate("""
                INSERT INTO kafbat_config (key, value) VALUES ('default_limit', '100')
                ON CONFLICT (key) DO NOTHING
            """)
            stmt.executeUpdate("""
                CREATE TABLE IF NOT EXISTS clusters (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    brokers VARCHAR(1024) NOT NULL,
                    is_default BOOLEAN DEFAULT false
                )
            """)
        }
        seedDefaultCluster()
    }

    private fun seedDefaultCluster() {
        val rs = connection.createStatement().executeQuery("SELECT COUNT(*) FROM clusters")
        rs.next()
        val count = rs.getInt(1)
        rs.close()
        if (count == 0) {
            val brokerRs = connection.prepareStatement("SELECT value FROM kafbat_config WHERE key = 'brokers'").executeQuery()
            val brokers = if (brokerRs.next()) brokerRs.getString("value") else "localhost:9092"
            brokerRs.close()
            val stmt = connection.prepareStatement("INSERT INTO clusters (name, brokers, is_default) VALUES (?, ?, true)")
            stmt.setString(1, "Default")
            stmt.setString(2, brokers)
            stmt.executeUpdate()
        }
    }
}
