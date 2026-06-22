package pt.cunha.kafbat

import kotlinx.serialization.Serializable
import org.apache.kafka.clients.admin.AdminClient
import org.apache.kafka.clients.admin.AdminClientConfig
import org.apache.kafka.clients.admin.NewTopic
import org.apache.kafka.clients.admin.OffsetSpec
import org.apache.kafka.clients.consumer.ConsumerConfig
import org.apache.kafka.clients.consumer.KafkaConsumer
import org.apache.kafka.clients.producer.KafkaProducer
import org.apache.kafka.clients.producer.ProducerConfig
import org.apache.kafka.clients.producer.ProducerRecord
import org.apache.kafka.common.TopicPartition
import org.apache.kafka.common.serialization.StringDeserializer
import org.apache.kafka.common.serialization.StringSerializer
import java.time.Duration
import java.util.Properties
import java.util.UUID

@Serializable
data class BrokerInfo(
    val id: Int,
    val host: String,
    val port: Int,
    val isController: Boolean = false
)

@Serializable
data class TopicInfo(
    val name: String,
    val partitions: Int,
    val replicationFactor: Int,
    val messageCount: Long = 0
)

@Serializable
data class TopicDetails(
    val name: String,
    val partitions: List<PartitionInfo>,
    val configs: Map<String, String> = emptyMap()
)

@Serializable
data class PartitionInfo(
    val partition: Int,
    val leader: Int,
    val replicas: List<Int>,
    val isr: List<Int>,
    val beginOffset: Long,
    val endOffset: Long
)

@Serializable
data class KafkaMessage(
    val partition: Int,
    val offset: Long,
    val timestamp: Long,
    val key: String?,
    val value: String?,
    val valuePreview: String? = null,
    val valueSize: Int = 0,
    val headers: Map<String, String> = emptyMap()
)

@Serializable
data class ProduceRequest(
    val key: String? = null,
    val value: String,
    val headers: Map<String, String>? = null,
    val partition: Int? = null
)

@Serializable
data class ProduceResult(
    val topic: String,
    val partition: Int,
    val offset: Long,
    val timestamp: Long
)

@Serializable
data class ClusterOverview(
    val brokers: List<BrokerInfo>,
    val topicCount: Int,
    val totalPartitions: Int,
    val controllerId: Int
)

class KafkaService() {

    private fun adminProps(brokers: String): Properties {
        val props = Properties()
        props[AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG] = brokers
        props[AdminClientConfig.REQUEST_TIMEOUT_MS_CONFIG] = "5000"
        props[AdminClientConfig.DEFAULT_API_TIMEOUT_MS_CONFIG] = "10000"
        return props
    }

    private fun <T> withAdmin(brokers: String, block: (AdminClient) -> T): T {
        val admin = AdminClient.create(adminProps(brokers))
        return admin.use { block(it) }
    }

    fun getClusterOverview(brokers: String): ClusterOverview = withAdmin(brokers) { admin ->
        val cluster = admin.describeCluster()
        val nodes = cluster.nodes().get()
        val controllerId = cluster.controller().get().id()
        val topics = admin.listTopics().names().get()
        val descriptions = admin.describeTopics(topics).allTopicNames().get()
        val totalPartitions = descriptions.values.sumOf { it.partitions().size }

        ClusterOverview(
            brokers = nodes.map { BrokerInfo(it.id(), it.host(), it.port(), it.id() == controllerId) },
            topicCount = topics.size,
            totalPartitions = totalPartitions,
            controllerId = controllerId
        )
    }

    fun getBrokers(brokers: String): List<BrokerInfo> = withAdmin(brokers) { admin ->
        val cluster = admin.describeCluster()
        val nodes = cluster.nodes().get()
        val controllerId = cluster.controller().get().id()
        nodes.map { BrokerInfo(it.id(), it.host(), it.port(), it.id() == controllerId) }
    }

    fun getTopics(brokers: String, search: String? = null, showInternal: Boolean = false): List<TopicInfo> = withAdmin(brokers) { admin ->
        val listOptions = org.apache.kafka.clients.admin.ListTopicsOptions().listInternal(showInternal)
        val topicNames = admin.listTopics(listOptions).names().get()
        val filtered = if (!search.isNullOrBlank()) {
            topicNames.filter { it.contains(search, ignoreCase = true) }
        } else topicNames

        if (filtered.isEmpty()) return@withAdmin emptyList()

        val descriptions = admin.describeTopics(filtered).allTopicNames().get()

        val endOffsets = mutableMapOf<String, Long>()
        val beginOffsets = mutableMapOf<String, Long>()

        try {
            val tps = descriptions.flatMap { (topic, desc) ->
                desc.partitions().map { TopicPartition(topic, it.partition()) }
            }
            val endMap = admin.listOffsets(
                tps.associateWith { OffsetSpec.latest() }
            ).all().get()
            val beginMap = admin.listOffsets(
                tps.associateWith { OffsetSpec.earliest() }
            ).all().get()

            for ((tp, result) in endMap) {
                endOffsets[tp.topic()] = (endOffsets[tp.topic()] ?: 0) + result.offset()
            }
            for ((tp, result) in beginMap) {
                beginOffsets[tp.topic()] = (beginOffsets[tp.topic()] ?: 0) + result.offset()
            }
        } catch (_: Exception) {}

        descriptions.map { (name, desc) ->
            val total = (endOffsets[name] ?: 0) - (beginOffsets[name] ?: 0)
            TopicInfo(
                name = name,
                partitions = desc.partitions().size,
                replicationFactor = desc.partitions().firstOrNull()?.replicas()?.size ?: 0,
                messageCount = maxOf(total, 0)
            )
        }.sortedBy { it.name }
    }

    fun getTopicDetails(brokers: String, topicName: String): TopicDetails = withAdmin(brokers) { admin ->
        val desc = admin.describeTopics(listOf(topicName)).allTopicNames().get()[topicName]
            ?: throw NoSuchElementException("Topic '$topicName' not found")

        val tps = desc.partitions().map { TopicPartition(topicName, it.partition()) }
        val endMap = admin.listOffsets(tps.associateWith { OffsetSpec.latest() }).all().get()
        val beginMap = admin.listOffsets(tps.associateWith { OffsetSpec.earliest() }).all().get()

        val configResource = org.apache.kafka.common.config.ConfigResource(
            org.apache.kafka.common.config.ConfigResource.Type.TOPIC, topicName
        )
        val configs = try {
            admin.describeConfigs(listOf(configResource)).all().get()[configResource]
                ?.entries()?.associate { it.name() to it.value() } ?: emptyMap()
        } catch (_: Exception) { emptyMap() }

        TopicDetails(
            name = topicName,
            partitions = desc.partitions().map { p ->
                val tp = TopicPartition(topicName, p.partition())
                PartitionInfo(
                    partition = p.partition(),
                    leader = p.leader()?.id() ?: -1,
                    replicas = p.replicas().map { it.id() },
                    isr = p.isr().map { it.id() },
                    beginOffset = beginMap[tp]?.offset() ?: 0,
                    endOffset = endMap[tp]?.offset() ?: 0
                )
            },
            configs = configs
        )
    }

    fun getMessages(
        brokers: String,
        topicName: String,
        limit: Int = 100,
        search: String? = null,
        key: String? = null,
        fromTimestamp: Long? = null,
        toTimestamp: Long? = null,
        partition: Int? = null
    ): List<KafkaMessage> {
        val props = Properties().apply {
            put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, brokers)
            put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer::class.java.name)
            put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer::class.java.name)
            put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "latest")
            put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, "false")
            put(ConsumerConfig.MAX_POLL_RECORDS_CONFIG, "500")
            put(ConsumerConfig.REQUEST_TIMEOUT_MS_CONFIG, "5000")
        }

        val consumer = KafkaConsumer<String, String>(props)
        return consumer.use { c ->
            val allPartitions = c.partitionsFor(topicName)
                ?.map { TopicPartition(topicName, it.partition()) }
                ?: throw NoSuchElementException("Topic '$topicName' not found")

            val targetPartitions = if (partition != null) {
                allPartitions.filter { it.partition() == partition }
            } else allPartitions

            if (fromTimestamp != null) {
                val timestampsToSearch = targetPartitions.associateWith { fromTimestamp }
                val offsets = c.offsetsForTimes(timestampsToSearch)
                c.assign(targetPartitions)
                for (tp in targetPartitions) {
                    val offsetAndTimestamp = offsets[tp]
                    if (offsetAndTimestamp != null) {
                        c.seek(tp, offsetAndTimestamp.offset())
                    } else {
                        c.seekToEnd(listOf(tp))
                    }
                }
            } else {
                c.assign(targetPartitions)
                val endOffsets = c.endOffsets(targetPartitions)
                for (tp in targetPartitions) {
                    val endOffset = endOffsets[tp] ?: 0
                    val seekTo = maxOf(endOffset - limit, 0)
                    c.seek(tp, seekTo)
                }
            }

            val messages = mutableListOf<KafkaMessage>()
            var emptyPolls = 0
            var gotData = false

            while (messages.size < limit * 2 && emptyPolls < 1) {
                val records = c.poll(Duration.ofMillis(if (gotData) 500 else 1500))
                if (records.isEmpty) {
                    emptyPolls++
                    continue
                }
                gotData = true

                for (record in records) {
                    if (toTimestamp != null && record.timestamp() > toTimestamp) continue
                    if (fromTimestamp != null && record.timestamp() < fromTimestamp) continue

                    val fullValue = record.value()
                    val msg = KafkaMessage(
                        partition = record.partition(),
                        offset = record.offset(),
                        timestamp = record.timestamp(),
                        key = record.key(),
                        value = null,
                        valuePreview = fullValue?.take(200),
                        valueSize = fullValue?.length ?: 0,
                        headers = record.headers().associate { it.key() to String(it.value() ?: ByteArray(0)) }
                    )

                    if (key != null && record.key() != key) continue
                    if (!search.isNullOrBlank() && record.value()?.contains(search, ignoreCase = true) != true) continue

                    messages.add(msg)
                }
            }

            messages.sortedByDescending { it.timestamp }.take(limit)
        }
    }

    fun getMessage(brokers: String, topicName: String, partition: Int, offset: Long): KafkaMessage? {
        val props = Properties().apply {
            put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, brokers)
            put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, StringDeserializer::class.java.name)
            put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, StringDeserializer::class.java.name)
            put(ConsumerConfig.AUTO_OFFSET_RESET_CONFIG, "none")
            put(ConsumerConfig.MAX_POLL_RECORDS_CONFIG, 1)
        }
        return KafkaConsumer<String, String>(props).use { c ->
            val tp = TopicPartition(topicName, partition)
            c.assign(listOf(tp))
            c.seek(tp, offset)
            val records = c.poll(Duration.ofMillis(1500))
            records.firstOrNull()?.let { record ->
                KafkaMessage(
                    partition = record.partition(),
                    offset = record.offset(),
                    timestamp = record.timestamp(),
                    key = record.key(),
                    value = record.value(),
                    valueSize = record.value()?.length ?: 0,
                    headers = record.headers().associate { it.key() to String(it.value() ?: ByteArray(0)) }
                )
            }
        }
    }

    fun produceMessage(brokers: String, topicName: String, request: ProduceRequest): ProduceResult {
        val props = Properties().apply {
            put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, brokers)
            put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, StringSerializer::class.java.name)
            put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer::class.java.name)
            put(ProducerConfig.ACKS_CONFIG, "all")
        }

        val producer = KafkaProducer<String, String>(props)
        return producer.use { p ->
            val record = ProducerRecord(
                topicName,
                request.partition,
                request.key,
                request.value
            )
            request.headers?.forEach { (k, v) ->
                record.headers().add(k, v.toByteArray())
            }
            val metadata = p.send(record).get()
            ProduceResult(
                topic = metadata.topic(),
                partition = metadata.partition(),
                offset = metadata.offset(),
                timestamp = metadata.timestamp()
            )
        }
    }

    fun createTopic(brokers: String, name: String, partitions: Int, replicationFactor: Short) = withAdmin(brokers) { admin ->
        admin.createTopics(listOf(NewTopic(name, partitions, replicationFactor))).all().get()
    }

    fun deleteTopic(brokers: String, name: String) = withAdmin(brokers) { admin ->
        admin.deleteTopics(listOf(name)).all().get()
    }
}
