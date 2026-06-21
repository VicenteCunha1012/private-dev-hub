package pt.cunha.kafbat

import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable

@Serializable
data class ConfigResponse(
    val brokers: String,
    val defaultLimit: String
)

@Serializable
data class ConfigUpdateRequest(
    val brokers: String? = null,
    val defaultLimit: String? = null
)

@Serializable
data class CreateTopicRequest(
    val name: String,
    val partitions: Int = 1,
    val replicationFactor: Short = 1
)

fun Routing.configRoutes(configService: ConfigService) {
    route("/config") {
        get {
            call.respond(configService.getAll())
        }
        post {
            val req = call.receive<ConfigUpdateRequest>()
            req.brokers?.let { configService.set("brokers", it) }
            req.defaultLimit?.let { configService.set("default_limit", it) }
            call.respond(configService.getAll())
        }
        get("/export") {
            call.respond(configService.getAll())
        }
        post("/import") {
            val data = call.receive<Map<String, String>>()
            data.forEach { (k, v) -> configService.set(k, v) }
            call.respond(HttpStatusCode.OK, mapOf("status" to "imported"))
        }
    }

    route("/db") {
        get("/export") {
            val dump = configService.exportDatabase()
            call.respondText(dump, ContentType.Text.Plain)
        }
        post("/import") {
            val sql = call.receiveText()
            configService.importDatabase(sql)
            call.respond(HttpStatusCode.OK, mapOf("status" to "imported"))
        }
    }
}

fun Routing.brokerRoutes(kafkaService: KafkaService) {
    route("/brokers") {
        get {
            try {
                call.respond(kafkaService.getBrokers())
            } catch (e: Exception) {
                call.respond(HttpStatusCode.ServiceUnavailable, mapOf("error" to "Cannot connect to Kafka: ${e.message}"))
            }
        }
    }
    get("/cluster") {
        try {
            call.respond(kafkaService.getClusterOverview())
        } catch (e: Exception) {
            call.respond(HttpStatusCode.ServiceUnavailable, mapOf("error" to "Cannot connect to Kafka: ${e.message}"))
        }
    }
}

fun Routing.topicRoutes(kafkaService: KafkaService) {
    route("/topics") {
        get {
            val search = call.request.queryParameters["search"]
            val showInternal = call.request.queryParameters["showInternal"]?.toBoolean() ?: false
            try {
                call.respond(kafkaService.getTopics(search, showInternal))
            } catch (e: Exception) {
                call.respond(HttpStatusCode.ServiceUnavailable, mapOf("error" to "Cannot connect to Kafka: ${e.message}"))
            }
        }

        post {
            val req = call.receive<CreateTopicRequest>()
            kafkaService.createTopic(req.name, req.partitions, req.replicationFactor)
            call.respond(HttpStatusCode.Created, mapOf("status" to "created", "topic" to req.name))
        }

        route("/{topic}") {
            get {
                val topic = call.parameters["topic"] ?: throw IllegalArgumentException("Topic required")
                call.respond(kafkaService.getTopicDetails(topic))
            }

            delete {
                val topic = call.parameters["topic"] ?: throw IllegalArgumentException("Topic required")
                kafkaService.deleteTopic(topic)
                call.respond(HttpStatusCode.NoContent)
            }

            get("/messages") {
                val topic = call.parameters["topic"] ?: throw IllegalArgumentException("Topic required")
                val limit = call.request.queryParameters["limit"]?.toIntOrNull() ?: 100
                val search = call.request.queryParameters["search"]
                val key = call.request.queryParameters["key"]
                val from = call.request.queryParameters["from"]?.toLongOrNull()
                val to = call.request.queryParameters["to"]?.toLongOrNull()
                val partition = call.request.queryParameters["partition"]?.toIntOrNull()

                try {
                    val messages = kafkaService.getMessages(topic, limit, search, key, from, to, partition)
                    call.respond(messages)
                } catch (e: Exception) {
                    call.respond(HttpStatusCode.ServiceUnavailable, mapOf("error" to "Failed to fetch messages: ${e.message}"))
                }
            }

            post("/produce") {
                val topic = call.parameters["topic"] ?: throw IllegalArgumentException("Topic required")
                val req = call.receive<ProduceRequest>()
                val result = kafkaService.produceMessage(topic, req)
                call.respond(HttpStatusCode.Created, result)
            }
        }
    }
}
