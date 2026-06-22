package pt.cunha.kafbat

import io.ktor.http.*
import io.ktor.server.application.*
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

@Serializable
data class ClusterRequest(
    val name: String,
    val brokers: String
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

fun Routing.clusterRoutes(configService: ConfigService) {
    route("/clusters") {
        get {
            call.respond(configService.getClusters())
        }
        post {
            val req = call.receive<ClusterRequest>()
            val cluster = configService.createCluster(req.name, req.brokers)
            call.respond(HttpStatusCode.Created, cluster)
        }
        route("/{id}") {
            put {
                val id = call.parameters["id"]?.toIntOrNull() ?: throw IllegalArgumentException("Invalid cluster id")
                val req = call.receive<ClusterRequest>()
                val cluster = configService.updateCluster(id, req.name, req.brokers)
                    ?: return@put call.respond(HttpStatusCode.NotFound, mapOf("error" to "Cluster not found"))
                call.respond(cluster)
            }
            delete {
                val id = call.parameters["id"]?.toIntOrNull() ?: throw IllegalArgumentException("Invalid cluster id")
                if (configService.deleteCluster(id)) {
                    call.respond(HttpStatusCode.NoContent)
                } else {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Cannot delete default cluster"))
                }
            }
        }
    }
}

private fun ApplicationCall.resolveBrokers(configService: ConfigService): String {
    val clusterId = request.queryParameters["cluster"]?.toIntOrNull()
    return configService.resolveBrokers(clusterId)
}

fun Routing.brokerRoutes(kafkaService: KafkaService, configService: ConfigService) {
    route("/brokers") {
        get {
            try {
                val brokers = call.resolveBrokers(configService)
                call.respond(kafkaService.getBrokers(brokers))
            } catch (e: Exception) {
                call.respond(HttpStatusCode.ServiceUnavailable, mapOf("error" to "Cannot connect to Kafka: ${e.message}"))
            }
        }
    }
    get("/cluster") {
        try {
            val brokers = call.resolveBrokers(configService)
            call.respond(kafkaService.getClusterOverview(brokers))
        } catch (e: Exception) {
            call.respond(HttpStatusCode.ServiceUnavailable, mapOf("error" to "Cannot connect to Kafka: ${e.message}"))
        }
    }
}

fun Routing.topicRoutes(kafkaService: KafkaService, configService: ConfigService) {
    route("/topics") {
        get {
            val search = call.request.queryParameters["search"]
            val showInternal = call.request.queryParameters["showInternal"]?.toBoolean() ?: false
            try {
                val brokers = call.resolveBrokers(configService)
                call.respond(kafkaService.getTopics(brokers, search, showInternal))
            } catch (e: Exception) {
                call.respond(HttpStatusCode.ServiceUnavailable, mapOf("error" to "Cannot connect to Kafka: ${e.message}"))
            }
        }

        post {
            val req = call.receive<CreateTopicRequest>()
            val brokers = call.resolveBrokers(configService)
            kafkaService.createTopic(brokers, req.name, req.partitions, req.replicationFactor)
            call.respond(HttpStatusCode.Created, mapOf("status" to "created", "topic" to req.name))
        }

        route("/{topic}") {
            get {
                val topic = call.parameters["topic"] ?: throw IllegalArgumentException("Topic required")
                val brokers = call.resolveBrokers(configService)
                call.respond(kafkaService.getTopicDetails(brokers, topic))
            }

            delete {
                val topic = call.parameters["topic"] ?: throw IllegalArgumentException("Topic required")
                val brokers = call.resolveBrokers(configService)
                kafkaService.deleteTopic(brokers, topic)
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
                    val brokers = call.resolveBrokers(configService)
                    val messages = kafkaService.getMessages(brokers, topic, limit, search, key, from, to, partition)
                    call.respond(messages)
                } catch (e: Exception) {
                    call.respond(HttpStatusCode.ServiceUnavailable, mapOf("error" to "Failed to fetch messages: ${e.message}"))
                }
            }

            get("/messages/{partition}/{offset}") {
                val topic = call.parameters["topic"] ?: throw IllegalArgumentException("Topic required")
                val partition = call.parameters["partition"]?.toIntOrNull() ?: throw IllegalArgumentException("Partition required")
                val offset = call.parameters["offset"]?.toLongOrNull() ?: throw IllegalArgumentException("Offset required")
                val brokers = call.resolveBrokers(configService)
                val msg = kafkaService.getMessage(brokers, topic, partition, offset)
                if (msg != null) call.respond(msg) else call.respond(HttpStatusCode.NotFound, mapOf("error" to "Message not found"))
            }

            post("/produce") {
                val topic = call.parameters["topic"] ?: throw IllegalArgumentException("Topic required")
                val req = call.receive<ProduceRequest>()
                val brokers = call.resolveBrokers(configService)
                val result = kafkaService.produceMessage(brokers, topic, req)
                call.respond(HttpStatusCode.Created, result)
            }
        }
    }
}
