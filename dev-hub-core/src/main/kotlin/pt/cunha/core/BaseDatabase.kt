package pt.cunha.core

import io.ktor.server.config.*
import java.sql.Connection
import java.sql.DriverManager

abstract class BaseDatabase(private val config: ApplicationConfig) {

    lateinit var connection: Connection
        private set

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
                println("DB connection attempt $attempts/30 failed: ${e.message}")
                Thread.sleep(2000)
            }
        }

        createSchema()
    }

    protected abstract fun createSchema()
}
