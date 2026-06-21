package pt.cunha.aisessions

import kotlinx.serialization.json.*
import java.io.File
import java.sql.DriverManager
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.DayOfWeek

private val json = Json { ignoreUnknownKeys = true }

// Pricing for Sonnet 4.6 via GitHub Copilot (per million tokens)
private const val INPUT_PRICE = 3.00
private const val OUTPUT_PRICE = 15.00
private const val CACHE_READ_PRICE = 0.30
private const val CACHE_WRITE_PRICE = 3.75
private const val MODEL = "claude-sonnet-4-6"

private data class StepRecord(
    val inputTokens: Long,
    val outputTokens: Long,
    val cacheReadTokens: Long,
    val cacheWriteTokens: Long,
    val timestampMs: Long
)

class OpenCodeScanner(private val dbPath: String) {

    private fun dbFile(): File = File(dbPath)

    private fun readSteps(): List<StepRecord> {
        val file = dbFile()
        if (!file.exists()) return emptyList()

        val steps = mutableListOf<StepRecord>()
        val url = "jdbc:sqlite:${file.absolutePath}"

        try {
            DriverManager.getConnection(url).use { conn ->
                conn.createStatement().use { stmt ->
                    val rs = stmt.executeQuery(
                        "SELECT data, time_created FROM part WHERE json_extract(data, '\$.type') = 'step-finish'"
                    )
                    while (rs.next()) {
                        try {
                            val dataStr = rs.getString("data")
                            val timeCreated = rs.getLong("time_created")
                            val obj = json.parseToJsonElement(dataStr).jsonObject
                            val tokens = obj["tokens"]?.jsonObject ?: continue
                            val cache = tokens["cache"]?.jsonObject

                            steps.add(StepRecord(
                                inputTokens = tokens["input"]?.jsonPrimitive?.long ?: 0,
                                outputTokens = tokens["output"]?.jsonPrimitive?.long ?: 0,
                                cacheReadTokens = cache?.get("read")?.jsonPrimitive?.long ?: 0,
                                cacheWriteTokens = cache?.get("write")?.jsonPrimitive?.long ?: 0,
                                timestampMs = timeCreated
                            ))
                        } catch (_: Exception) {}
                    }
                }
            }
        } catch (_: Exception) {}

        return steps
    }

    private fun estimateCost(input: Long, output: Long, cacheRead: Long, cacheWrite: Long): Double {
        return (input.toDouble() / 1_000_000) * INPUT_PRICE +
               (output.toDouble() / 1_000_000) * OUTPUT_PRICE +
               (cacheRead.toDouble() / 1_000_000) * CACHE_READ_PRICE +
               (cacheWrite.toDouble() / 1_000_000) * CACHE_WRITE_PRICE
    }

    fun getOpenCodeSessions(): List<SessionSummary> {
        val steps = readSteps()
        if (steps.isEmpty()) return emptyList()

        val zone = ZoneId.systemDefault()
        val byDay = steps.groupBy { step ->
            Instant.ofEpochMilli(step.timestampMs).atZone(zone).toLocalDate()
        }

        return byDay.map { (date, daySteps) ->
            val totalInput = daySteps.sumOf { it.inputTokens }
            val totalOutput = daySteps.sumOf { it.outputTokens }
            val totalCacheRead = daySteps.sumOf { it.cacheReadTokens }
            val totalCacheWrite = daySteps.sumOf { it.cacheWriteTokens }

            SessionSummary(
                id = "opencode-$date",
                title = "OpenCode — $date",
                project = "opencode",
                tool = "opencode",
                model = MODEL,
                lastActivity = daySteps.maxOf { it.timestampMs },
                messageCount = daySteps.size,
                totalInputTokens = totalInput,
                totalOutputTokens = totalOutput,
                totalCacheReadTokens = totalCacheRead,
                totalCacheCreationTokens = totalCacheWrite,
                estimatedCostUsd = estimateCost(totalInput, totalOutput, totalCacheRead, totalCacheWrite),
                version = null
            )
        }.sortedByDescending { it.lastActivity }
    }

    fun getOpenCodeSpending(): SpendingReport {
        val sessions = getOpenCodeSessions()
        val totalCost = sessions.sumOf { it.estimatedCostUsd }

        val modelSpending = if (sessions.isNotEmpty()) {
            mapOf(MODEL to ModelSpending(
                inputTokens = sessions.sumOf { it.totalInputTokens },
                outputTokens = sessions.sumOf { it.totalOutputTokens },
                estimatedCostUsd = totalCost
            ))
        } else emptyMap()

        return SpendingReport(
            tool = "opencode",
            totalSessions = sessions.size,
            totalInputTokens = sessions.sumOf { it.totalInputTokens },
            totalOutputTokens = sessions.sumOf { it.totalOutputTokens },
            totalCacheReadTokens = sessions.sumOf { it.totalCacheReadTokens },
            totalCacheCreationTokens = sessions.sumOf { it.totalCacheCreationTokens },
            estimatedCostUsd = totalCost,
            byModel = modelSpending,
            byProject = if (totalCost > 0) mapOf("opencode" to totalCost) else emptyMap()
        )
    }

    fun getOpenCodeTimeline(period: String): SpendingTimeline {
        val sessions = getOpenCodeSessions()

        val bucketFormat: (Long) -> String = when (period) {
            "weekly" -> { ts ->
                val ld = Instant.ofEpochMilli(ts).atZone(ZoneId.systemDefault()).toLocalDate()
                ld.with(DayOfWeek.MONDAY).toString()
            }
            "monthly" -> { ts ->
                val ld = Instant.ofEpochMilli(ts).atZone(ZoneId.systemDefault()).toLocalDate()
                "${ld.year}-${String.format("%02d", ld.monthValue)}"
            }
            else -> { ts ->
                Instant.ofEpochMilli(ts).atZone(ZoneId.systemDefault()).toLocalDate().toString()
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

        return SpendingTimeline("opencode", period, points)
    }

    fun getOpenCodeProjection(): SpendingProjection {
        val sessions = getOpenCodeSessions()
        if (sessions.isEmpty()) {
            return SpendingProjection("opencode", 0.0, 0.0, 0, 0.0)
        }

        val totalCost = sessions.sumOf { it.estimatedCostUsd }
        val activeDays = sessions.map {
            Instant.ofEpochMilli(it.lastActivity).atZone(ZoneId.systemDefault()).toLocalDate()
        }.toSet().size.toLong()
        val daysSpan = maxOf(activeDays, 1)
        val dailyAvg = totalCost / daysSpan

        return SpendingProjection(
            tool = "opencode",
            dailyAvgCostUsd = dailyAvg,
            projectedMonthlyCostUsd = dailyAvg * 30,
            daysOfData = daysSpan.toInt(),
            totalCostUsd = totalCost
        )
    }
}
