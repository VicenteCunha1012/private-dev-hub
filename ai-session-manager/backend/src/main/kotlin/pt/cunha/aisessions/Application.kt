package pt.cunha.aisessions

import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import io.ktor.server.application.*
import io.ktor.server.plugins.contentnegotiation.*
import io.ktor.server.plugins.cors.routing.*
import io.ktor.server.plugins.defaultheaders.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.json.Json

fun Application.module() {
    val claudeDir = environment.config.propertyOrNull("sessions.claudeDir")?.getString() ?: "/home/user/.claude"
    val openCodeDb = environment.config.propertyOrNull("sessions.openCodeDb")?.getString() ?: "/home/user/.opencode/opencode.db"
    val openCodeDir = environment.config.propertyOrNull("sessions.openCodeDir")?.getString() ?: "/home/user/.opencode-config"
    val homeMcpJson = environment.config.propertyOrNull("sessions.homeMcpJson")?.getString() ?: "/home/user/.claude.json"
    val sessionScanner = SessionScanner(claudeDir)
    val openCodeScanner = OpenCodeScanner(openCodeDb)
    val aiConfigScanner = AiConfigScanner(claudeDir, openCodeDir, homeMcpJson)

    install(ContentNegotiation) {
        json(Json { ignoreUnknownKeys = true; prettyPrint = false; encodeDefaults = true })
    }

    install(CORS) {
        allowMethod(HttpMethod.Options)
        allowMethod(HttpMethod.Get)
        allowMethod(HttpMethod.Post)
        allowMethod(HttpMethod.Put)
        allowMethod(HttpMethod.Delete)
        allowHeader(HttpHeaders.ContentType)
        anyHost()
    }

    install(DefaultHeaders) { header("X-Engine", "Ktor") }

    install(StatusPages) {
        exception<IllegalArgumentException> { call, cause ->
            call.respond(HttpStatusCode.BadRequest, mapOf("error" to (cause.message ?: "Bad request")))
        }
        exception<Throwable> { call, cause ->
            call.application.log.error("Unhandled error", cause)
            call.respond(HttpStatusCode.InternalServerError, mapOf("error" to (cause.message ?: "Internal error")))
        }
    }

    routing {
        get("/health") {
            call.respond(mapOf("status" to "ok"))
        }

        get("/config") {
            call.respond(mapOf("claudeDir" to claudeDir))
        }

        get("/config/export") {
            call.respond(mapOf("claudeDir" to claudeDir))
        }

        post("/config/import") {
            call.respond(HttpStatusCode.OK, mapOf("status" to "imported", "note" to "claudeDir is set via application.yaml"))
        }

        get("/sessions") {
            val tool = call.request.queryParameters["tool"]
            val sessions = when (tool) {
                "opencode" -> openCodeScanner.getOpenCodeSessions()
                "claude-code" -> sessionScanner.getSessions("claude-code")
                null, "" -> {
                    val claude = sessionScanner.getSessions("claude-code")
                    val opencode = openCodeScanner.getOpenCodeSessions()
                    (claude + opencode).sortedByDescending { it.lastActivity }
                }
                else -> sessionScanner.getSessions(tool)
            }
            call.respond(sessions)
        }

        get("/sessions/{id}") {
            val id = call.parameters["id"] ?: throw IllegalArgumentException("Session ID required")
            val detail = sessionScanner.getSessionDetail(id)
            if (detail == null) {
                call.respond(HttpStatusCode.NotFound, mapOf("error" to "Session not found"))
            } else {
                call.respond(detail)
            }
        }

        get("/spending") {
            val tool = call.request.queryParameters["tool"]
            val spending = when (tool) {
                "opencode" -> openCodeScanner.getOpenCodeSpending()
                null, "", "all" -> {
                    val cc = sessionScanner.getSpending("claude-code")
                    val oc = openCodeScanner.getOpenCodeSpending()
                    cc.copy(
                        tool = "all",
                        totalSessions = cc.totalSessions + oc.totalSessions,
                        totalInputTokens = cc.totalInputTokens + oc.totalInputTokens,
                        totalOutputTokens = cc.totalOutputTokens + oc.totalOutputTokens,
                        totalCacheReadTokens = cc.totalCacheReadTokens + oc.totalCacheReadTokens,
                        totalCacheCreationTokens = cc.totalCacheCreationTokens + oc.totalCacheCreationTokens,
                        estimatedCostUsd = cc.estimatedCostUsd + oc.estimatedCostUsd,
                        byModel = (cc.byModel.toList() + oc.byModel.toList())
                            .groupBy({ it.first }, { it.second })
                            .mapValues { (_, v) -> v.reduce { a, b -> a.copy(
                                inputTokens = a.inputTokens + b.inputTokens,
                                outputTokens = a.outputTokens + b.outputTokens,
                                estimatedCostUsd = a.estimatedCostUsd + b.estimatedCostUsd
                            ) } },
                        byProject = (cc.byProject.toList() + oc.byProject.toList())
                            .groupBy({ it.first }, { it.second })
                            .mapValues { (_, v) -> v.sum() }
                    )
                }
                else -> sessionScanner.getSpending(tool)
            }
            call.respond(spending)
        }

        get("/projects") {
            val projects = sessionScanner.getProjects()
            call.respond(projects)
        }

        get("/spending/timeline") {
            val tool = call.request.queryParameters["tool"]
            val period = call.request.queryParameters["period"] ?: "daily"
            val timeline = when (tool) {
                "opencode" -> openCodeScanner.getOpenCodeTimeline(period)
                null, "", "all" -> {
                    val cc = sessionScanner.getSpendingTimeline("claude-code", period)
                    val oc = openCodeScanner.getOpenCodeTimeline(period)
                    val merged = (cc.points + oc.points)
                        .groupBy { it.date }
                        .map { (date, pts) -> pts.reduce { a, b -> a.copy(
                            costUsd = a.costUsd + b.costUsd,
                            inputTokens = a.inputTokens + b.inputTokens,
                            outputTokens = a.outputTokens + b.outputTokens,
                            sessions = a.sessions + b.sessions
                        ) } }
                        .sortedBy { it.date }
                    cc.copy(tool = "all", points = merged)
                }
                else -> sessionScanner.getSpendingTimeline(tool, period)
            }
            call.respond(timeline)
        }

        get("/spending/projection") {
            val tool = call.request.queryParameters["tool"]
            val projection = when (tool) {
                "opencode" -> openCodeScanner.getOpenCodeProjection()
                null, "", "all" -> {
                    val cc = sessionScanner.getProjection("claude-code")
                    val oc = openCodeScanner.getOpenCodeProjection()
                    cc.copy(
                        tool = "all",
                        dailyAvgCostUsd = cc.dailyAvgCostUsd + oc.dailyAvgCostUsd,
                        projectedMonthlyCostUsd = cc.projectedMonthlyCostUsd + oc.projectedMonthlyCostUsd,
                        daysOfData = maxOf(cc.daysOfData, oc.daysOfData),
                        totalCostUsd = cc.totalCostUsd + oc.totalCostUsd
                    )
                }
                else -> sessionScanner.getProjection(tool)
            }
            call.respond(projection)
        }

        get("/aiconfig") {
            call.respond(aiConfigScanner.scan())
        }

        get("/aiconfig/file") {
            val path = call.request.queryParameters["path"] ?: throw IllegalArgumentException("path required")
            val content = aiConfigScanner.readFile(path)
            if (content != null) {
                call.respond(mapOf("path" to path, "content" to content))
            } else {
                call.respond(HttpStatusCode.NotFound, mapOf("error" to "File not found or not allowed"))
            }
        }
    }
}
