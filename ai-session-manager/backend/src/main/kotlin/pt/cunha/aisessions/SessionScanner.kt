package pt.cunha.aisessions

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*
import java.io.File
import java.time.Instant

@Serializable
data class SessionSummary(
    val id: String,
    val title: String,
    val project: String,
    val tool: String,
    val model: String?,
    val lastActivity: Long,
    val messageCount: Int,
    val totalInputTokens: Long,
    val totalOutputTokens: Long,
    val totalCacheReadTokens: Long,
    val totalCacheCreationTokens: Long,
    val estimatedCostUsd: Double,
    val version: String?
)

@Serializable
data class SessionDetail(
    val id: String,
    val title: String,
    val project: String,
    val tool: String,
    val model: String?,
    val lastActivity: Long,
    val messageCount: Int,
    val totalInputTokens: Long,
    val totalOutputTokens: Long,
    val totalCacheReadTokens: Long,
    val totalCacheCreationTokens: Long,
    val estimatedCostUsd: Double,
    val version: String?,
    val turns: List<TurnSummary>,
    val mcpTools: List<String>
)

@Serializable
data class TurnSummary(
    val role: String,
    val timestamp: Long?,
    val inputTokens: Long,
    val outputTokens: Long,
    val model: String?,
    val preview: String?
)

@Serializable
data class SpendingReport(
    val tool: String,
    val totalSessions: Int,
    val totalInputTokens: Long,
    val totalOutputTokens: Long,
    val totalCacheReadTokens: Long,
    val totalCacheCreationTokens: Long,
    val estimatedCostUsd: Double,
    val byModel: Map<String, ModelSpending>,
    val byProject: Map<String, Double>
)

@Serializable
data class ModelSpending(
    val inputTokens: Long,
    val outputTokens: Long,
    val estimatedCostUsd: Double
)

@Serializable
data class ProjectInfo(
    val path: String,
    val dirName: String,
    val sessionCount: Int,
    val lastActivity: Long
)

@Serializable
data class TimelinePoint(
    val date: String,
    val costUsd: Double,
    val inputTokens: Long,
    val outputTokens: Long,
    val sessions: Int
)

@Serializable
data class SpendingTimeline(
    val tool: String,
    val period: String,
    val points: List<TimelinePoint>
)

@Serializable
data class SpendingProjection(
    val tool: String,
    val dailyAvgCostUsd: Double,
    val projectedMonthlyCostUsd: Double,
    val daysOfData: Int,
    val totalCostUsd: Double
)

private val json = Json { ignoreUnknownKeys = true }

// Pricing per million tokens (approximate)
private val PRICING = mapOf(
    "claude-sonnet-4-6" to Pair(3.0, 15.0),
    "claude-sonnet-4-5" to Pair(3.0, 15.0),
    "claude-opus-4-8" to Pair(15.0, 75.0),
    "claude-opus-4-7" to Pair(15.0, 75.0),
    "claude-opus-4-6" to Pair(15.0, 75.0),
    "claude-haiku-4-5" to Pair(0.80, 4.0),
    "claude-fable-5" to Pair(3.0, 15.0),
)
private val DEFAULT_PRICING = Pair(3.0, 15.0)
private const val CACHE_READ_DISCOUNT = 0.1
private const val CACHE_CREATION_MULTIPLIER = 1.25

class SessionScanner(private val claudeDir: String) {

    private fun projectsDir(): File = File(claudeDir, "projects")

    fun getProjects(): List<ProjectInfo> {
        val dir = projectsDir()
        if (!dir.exists()) return emptyList()

        return dir.listFiles()?.filter { it.isDirectory }?.map { projectDir ->
            val sessions = projectDir.listFiles()?.filter { it.extension == "jsonl" } ?: emptyList()
            val lastMod = sessions.maxOfOrNull { it.lastModified() } ?: projectDir.lastModified()
            ProjectInfo(
                path = projectDir.name.replace("-", "/"),
                dirName = projectDir.name,
                sessionCount = sessions.size,
                lastActivity = lastMod
            )
        }?.sortedByDescending { it.lastActivity } ?: emptyList()
    }

    fun getSessions(tool: String): List<SessionSummary> {
        if (tool != "claude-code") return emptyList()

        val dir = projectsDir()
        if (!dir.exists()) return emptyList()

        val sessions = mutableListOf<SessionSummary>()

        dir.listFiles()?.filter { it.isDirectory }?.forEach { projectDir ->
            val projectPath = projectDir.name.replace("-", "/")
            projectDir.listFiles()?.filter { it.extension == "jsonl" }?.forEach { file ->
                try {
                    val summary = parseSessionFile(file, projectPath)
                    if (summary != null) sessions.add(summary)
                } catch (_: Exception) {}
            }
        }

        return sessions.sortedByDescending { it.lastActivity }
    }

    fun getSessionDetail(sessionId: String): SessionDetail? {
        val dir = projectsDir()
        if (!dir.exists()) return null

        dir.listFiles()?.filter { it.isDirectory }?.forEach { projectDir ->
            val file = File(projectDir, "$sessionId.jsonl")
            if (file.exists()) {
                val projectPath = projectDir.name.replace("-", "/")
                return parseSessionDetail(file, projectPath)
            }
        }
        return null
    }

    fun getSpending(tool: String): SpendingReport {
        val sessions = getSessions(tool)
        val byModel = mutableMapOf<String, MutableList<SessionSummary>>()
        val byProject = mutableMapOf<String, Double>()

        for (s in sessions) {
            val model = s.model ?: "unknown"
            byModel.getOrPut(model) { mutableListOf() }.add(s)
            byProject[s.project] = (byProject[s.project] ?: 0.0) + s.estimatedCostUsd
        }

        return SpendingReport(
            tool = tool,
            totalSessions = sessions.size,
            totalInputTokens = sessions.sumOf { it.totalInputTokens },
            totalOutputTokens = sessions.sumOf { it.totalOutputTokens },
            totalCacheReadTokens = sessions.sumOf { it.totalCacheReadTokens },
            totalCacheCreationTokens = sessions.sumOf { it.totalCacheCreationTokens },
            estimatedCostUsd = sessions.sumOf { it.estimatedCostUsd },
            byModel = byModel.mapValues { (_, v) ->
                ModelSpending(
                    inputTokens = v.sumOf { it.totalInputTokens },
                    outputTokens = v.sumOf { it.totalOutputTokens },
                    estimatedCostUsd = v.sumOf { it.estimatedCostUsd }
                )
            },
            byProject = byProject
        )
    }

    private fun parseSessionFile(file: File, project: String): SessionSummary? {
        var title = file.nameWithoutExtension
        var model: String? = null
        var version: String? = null
        var lastTimestamp: Long = file.lastModified()
        var messageCount = 0
        var totalInput = 0L
        var totalOutput = 0L
        var totalCacheRead = 0L
        var totalCacheCreation = 0L
        val sessionId = file.nameWithoutExtension

        file.bufferedReader().forEachLine { line ->
            try {
                val obj = json.parseToJsonElement(line).jsonObject
                when (obj["type"]?.jsonPrimitive?.content) {
                    "ai-title" -> {
                        title = obj["aiTitle"]?.jsonPrimitive?.content ?: title
                    }
                    "assistant" -> {
                        messageCount++
                        val ts = obj["timestamp"]?.jsonPrimitive?.content
                        if (ts != null) {
                            try { lastTimestamp = Instant.parse(ts).toEpochMilli() } catch (_: Exception) {}
                        }
                        val msg = obj["message"]?.jsonObject
                        if (msg != null) {
                            model = msg["model"]?.jsonPrimitive?.content ?: model
                            val usage = msg["usage"]?.jsonObject
                            if (usage != null) {
                                totalInput += usage["input_tokens"]?.jsonPrimitive?.long ?: 0
                                totalOutput += usage["output_tokens"]?.jsonPrimitive?.long ?: 0
                                totalCacheRead += usage["cache_read_input_tokens"]?.jsonPrimitive?.long ?: 0
                                totalCacheCreation += usage["cache_creation_input_tokens"]?.jsonPrimitive?.long ?: 0
                            }
                        }
                        version = obj["version"]?.jsonPrimitive?.content ?: version
                    }
                    "user" -> {
                        messageCount++
                        val ts = obj["timestamp"]?.jsonPrimitive?.content
                        if (ts != null) {
                            try { lastTimestamp = Instant.parse(ts).toEpochMilli() } catch (_: Exception) {}
                        }
                    }
                }
            } catch (_: Exception) {}
        }

        if (messageCount == 0) return null

        val cost = estimateCost(model, totalInput, totalOutput, totalCacheRead, totalCacheCreation)

        return SessionSummary(
            id = sessionId,
            title = title,
            project = project,
            tool = "claude-code",
            model = model,
            lastActivity = lastTimestamp,
            messageCount = messageCount,
            totalInputTokens = totalInput,
            totalOutputTokens = totalOutput,
            totalCacheReadTokens = totalCacheRead,
            totalCacheCreationTokens = totalCacheCreation,
            estimatedCostUsd = cost,
            version = version
        )
    }

    private fun parseSessionDetail(file: File, project: String): SessionDetail? {
        val summary = parseSessionFile(file, project) ?: return null
        val turns = mutableListOf<TurnSummary>()
        val mcpTools = mutableSetOf<String>()

        file.bufferedReader().forEachLine { line ->
            try {
                val obj = json.parseToJsonElement(line).jsonObject
                when (obj["type"]?.jsonPrimitive?.content) {
                    "assistant" -> {
                        val msg = obj["message"]?.jsonObject
                        val usage = msg?.get("usage")?.jsonObject
                        val content = msg?.get("content")?.jsonArray
                        val preview = content?.firstOrNull()?.jsonObject
                            ?.get("text")?.jsonPrimitive?.content?.take(200)

                        // Extract tool names from content blocks
                        content?.forEach { block ->
                            val blockObj = block.jsonObject
                            if (blockObj["type"]?.jsonPrimitive?.content == "tool_use") {
                                val toolName = blockObj["name"]?.jsonPrimitive?.content
                                if (toolName != null && toolName.startsWith("mcp__")) {
                                    mcpTools.add(toolName)
                                }
                            }
                        }

                        val ts = obj["timestamp"]?.jsonPrimitive?.content
                        val timestamp = try { ts?.let { Instant.parse(it).toEpochMilli() } } catch (_: Exception) { null }

                        turns.add(TurnSummary(
                            role = "assistant",
                            timestamp = timestamp,
                            inputTokens = usage?.get("input_tokens")?.jsonPrimitive?.long ?: 0,
                            outputTokens = usage?.get("output_tokens")?.jsonPrimitive?.long ?: 0,
                            model = msg?.get("model")?.jsonPrimitive?.content,
                            preview = preview
                        ))
                    }
                    "user" -> {
                        val content = obj["message"]?.jsonObject?.get("content")
                        val preview = when {
                            content is JsonPrimitive -> content.content.take(200)
                            content is JsonArray -> content.firstOrNull()?.jsonObject
                                ?.get("text")?.jsonPrimitive?.content?.take(200)
                            else -> null
                        }
                        val ts = obj["timestamp"]?.jsonPrimitive?.content
                        val timestamp = try { ts?.let { Instant.parse(it).toEpochMilli() } } catch (_: Exception) { null }

                        turns.add(TurnSummary(
                            role = "user",
                            timestamp = timestamp,
                            inputTokens = 0,
                            outputTokens = 0,
                            model = null,
                            preview = preview
                        ))
                    }
                }
            } catch (_: Exception) {}
        }

        return SessionDetail(
            id = summary.id,
            title = summary.title,
            project = summary.project,
            tool = summary.tool,
            model = summary.model,
            lastActivity = summary.lastActivity,
            messageCount = summary.messageCount,
            totalInputTokens = summary.totalInputTokens,
            totalOutputTokens = summary.totalOutputTokens,
            totalCacheReadTokens = summary.totalCacheReadTokens,
            totalCacheCreationTokens = summary.totalCacheCreationTokens,
            estimatedCostUsd = summary.estimatedCostUsd,
            version = summary.version,
            turns = turns,
            mcpTools = mcpTools.toList().sorted()
        )
    }

    private fun estimateCost(model: String?, input: Long, output: Long, cacheRead: Long, cacheCreation: Long): Double {
        val (inputPrice, outputPrice) = PRICING.entries
            .firstOrNull { model?.startsWith(it.key) == true }?.value ?: DEFAULT_PRICING

        val inputCost = (input.toDouble() / 1_000_000) * inputPrice
        val outputCost = (output.toDouble() / 1_000_000) * outputPrice
        val cacheReadCost = (cacheRead.toDouble() / 1_000_000) * inputPrice * CACHE_READ_DISCOUNT
        val cacheCreationCost = (cacheCreation.toDouble() / 1_000_000) * inputPrice * CACHE_CREATION_MULTIPLIER

        return inputCost + outputCost + cacheReadCost + cacheCreationCost
    }

    fun getSpendingTimeline(tool: String, period: String): SpendingTimeline {
        val sessions = getSessions(tool)
        val bucketFormat: (Long) -> String = when (period) {
            "weekly" -> { ts: Long ->
                val instant = Instant.ofEpochMilli(ts)
                val ld = instant.atZone(java.time.ZoneId.systemDefault()).toLocalDate()
                val weekStart = ld.with(java.time.DayOfWeek.MONDAY)
                weekStart.toString()
            }
            "monthly" -> { ts: Long ->
                val instant = Instant.ofEpochMilli(ts)
                val ld = instant.atZone(java.time.ZoneId.systemDefault()).toLocalDate()
                "${ld.year}-${String.format("%02d", ld.monthValue)}"
            }
            else -> { ts: Long ->
                val instant = Instant.ofEpochMilli(ts)
                instant.atZone(java.time.ZoneId.systemDefault()).toLocalDate().toString()
            }
        }

        val buckets = mutableMapOf<String, Triple<Double, Long, Long>>()
        val sessionCounts = mutableMapOf<String, Int>()

        for (s in sessions) {
            val key = bucketFormat(s.lastActivity)
            val (cost, input, output) = buckets.getOrDefault(key, Triple(0.0, 0L, 0L))
            buckets[key] = Triple(cost + s.estimatedCostUsd, input + s.totalInputTokens, output + s.totalOutputTokens)
            sessionCounts[key] = (sessionCounts[key] ?: 0) + 1
        }

        val points = buckets.entries.sortedBy { it.key }.map { (date, data) ->
            TimelinePoint(date, data.first, data.second, data.third, sessionCounts[date] ?: 0)
        }

        return SpendingTimeline(tool, period, points)
    }

    fun getProjection(tool: String): SpendingProjection {
        val sessions = getSessions(tool)
        if (sessions.isEmpty()) {
            return SpendingProjection(tool, 0.0, 0.0, 0, 0.0)
        }

        val totalCost = sessions.sumOf { it.estimatedCostUsd }
        val activeDays = sessions.map {
            Instant.ofEpochMilli(it.lastActivity).atZone(java.time.ZoneId.systemDefault()).toLocalDate()
        }.toSet().size.toLong()
        val daysSpan = maxOf(activeDays, 1)
        val dailyAvg = totalCost / daysSpan

        return SpendingProjection(
            tool = tool,
            dailyAvgCostUsd = dailyAvg,
            projectedMonthlyCostUsd = dailyAvg * 30,
            daysOfData = daysSpan.toInt(),
            totalCostUsd = totalCost
        )
    }
}
