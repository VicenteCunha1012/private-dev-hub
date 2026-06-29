package pt.cunha.arcade

import io.ktor.server.application.*
import io.ktor.server.routing.*
import pt.cunha.core.configDbRoutes
import pt.cunha.core.healthRoutes
import pt.cunha.core.installStandardPlugins

fun Application.module() {
    val db = Database(environment.config)
    db.init()

    val coinService = CoinService(db.connection)
    val playService = PlayService(db.connection)
    val scoreService = ScoreService(db.connection)
    val configService = ConfigService(db.connection)

    installStandardPlugins()

    routing {
        healthRoutes()
        configDbRoutes(configService)
        arcadeRoutes(coinService, playService, scoreService, configService)
    }
}
