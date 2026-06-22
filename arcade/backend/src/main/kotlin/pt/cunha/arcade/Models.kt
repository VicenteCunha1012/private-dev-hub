package pt.cunha.arcade

import kotlinx.serialization.Serializable

@Serializable
data class CoinRecord(val id: Int = 0, val amount: Int = 1, val source: String = "git-push", val earnedAt: String = "")

@Serializable
data class CoinBalance(val balance: Int, val history: List<CoinRecord> = emptyList())

@Serializable
data class ScoreRecord(val id: Int = 0, val gameId: String, val score: Int, val durationSeconds: Int? = null, val won: Boolean = false, val playedAt: String = "")

@Serializable
data class GameStats(val gameId: String, val gameName: String, val gameIcon: String = "", val highScore: Int = 0, val lastScore: Int = 0, val timesPlayed: Int = 0, val lastPlayed: String? = null)

@Serializable
data class SubmitScoreRequest(val gameId: String, val score: Int, val durationSeconds: Int? = null, val won: Boolean? = null)

@Serializable
data class SubmitScoreResponse(val isHighScore: Boolean, val previousHigh: Int?)

@Serializable
data class InsertCoinResponse(val sessionId: String, val games: List<GameInfo>)

@Serializable
data class StartGameRequest(val sessionId: String, val gameId: String)

@Serializable
data class PlaySession(val id: String, val offeredGames: String, val chosenGame: String? = null, val coinConsumed: Boolean = false)
