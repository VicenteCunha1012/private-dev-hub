package pt.cunha.arcade

import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*

fun Routing.arcadeRoutes(coinService: CoinService, playService: PlayService, scoreService: ScoreService, configService: ConfigService) {
    get("/health") { call.respond(mapOf("status" to "ok")) }

    route("/config") {
        get { call.respond(configService.getConfig()) }
        post {
            val updates = call.receive<Map<String, String>>()
            configService.updateConfig(updates)
            call.respond(configService.getConfig())
        }
        get("/export") { call.respond(configService.getConfig()) }
        post("/import") {
            val updates = call.receive<Map<String, String>>()
            configService.updateConfig(updates)
            call.respond(mapOf("status" to "imported"))
        }
    }

    route("/db") {
        get("/export") {
            val sql = configService.exportDb()
            call.respondText(sql, ContentType.Text.Plain)
        }
        post("/import") {
            val sql = call.receiveText()
            configService.importDb(sql)
            call.respond(mapOf("status" to "imported"))
        }
    }

    get("/catalog") { call.respond(GAME_CATALOG) }

    route("/coins") {
        get {
            call.respond(coinService.getCoinBalance())
        }
        post("/earn") {
            val balance = coinService.earn()
            call.respond(mapOf("balance" to balance))
        }
    }

    route("/play") {
        post("/insert-coin") {
            val coinData = coinService.getCoinBalance()
            val response = playService.insertCoin(coinData.balance)
            call.respond(response)
        }
        post("/start") {
            val req = call.receive<StartGameRequest>()
            playService.startGame(req.sessionId, req.gameId)
            call.respond(mapOf("ok" to true))
        }
    }

    route("/scores") {
        get { call.respond(scoreService.getAllStats()) }
        post {
            val req = call.receive<SubmitScoreRequest>()
            call.respond(scoreService.submit(req))
        }
        get("/{gameId}") {
            val gameId = call.parameters["gameId"] ?: throw IllegalArgumentException("gameId required")
            call.respond(scoreService.getGameStats(gameId))
        }
    }
}
