package pt.cunha.kafbat

import io.ktor.server.application.*
import io.ktor.server.routing.*
import pt.cunha.core.configDbRoutes
import pt.cunha.core.healthRoutes
import pt.cunha.core.installStandardPlugins

fun Application.module() {
    val db = Database(environment.config)
    db.init()

    val configService = ConfigService(db.connection)
    val kafkaService = KafkaService()

    installStandardPlugins()

    routing {
        healthRoutes()
        configDbRoutes(configService)
        configRoutes(configService)
        clusterRoutes(configService)
        brokerRoutes(kafkaService, configService)
        topicRoutes(kafkaService, configService)
    }
}
