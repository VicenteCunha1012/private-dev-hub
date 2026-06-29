package pt.cunha.arcade

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.sql.Connection
import java.util.UUID

class CoinService(private val conn: Connection) {
    suspend fun earn(source: String = "git-push", amount: Int = 1): Int = withContext(Dispatchers.IO) {
        conn.prepareStatement("INSERT INTO coins (amount, source) VALUES (?, ?)")
            .also { it.setInt(1, amount); it.setString(2, source) }
            .executeUpdate()
        getBalance()
    }

    suspend fun getBalance(): Int = withContext(Dispatchers.IO) {
        conn.createStatement().executeQuery("SELECT COALESCE(SUM(amount), 0) FROM coins")
            .use { rs -> rs.next(); rs.getInt(1) }
    }

    suspend fun getSpentCoins(): Int = withContext(Dispatchers.IO) {
        conn.createStatement().executeQuery("SELECT COUNT(*) FROM play_sessions WHERE coin_consumed = true")
            .use { rs -> rs.next(); rs.getInt(1) }
    }

    suspend fun getCoinBalance(): CoinBalance = withContext(Dispatchers.IO) {
        val earned = getBalance()
        val spent = getSpentCoins()
        val balance = earned - spent
        val history = mutableListOf<CoinRecord>()
        conn.createStatement().executeQuery("SELECT id, amount, source, earned_at FROM coins ORDER BY earned_at DESC LIMIT 20")
            .use { rs ->
                while (rs.next()) {
                    history.add(CoinRecord(rs.getInt("id"), rs.getInt("amount"), rs.getString("source"), rs.getString("earned_at")))
                }
            }
        CoinBalance(balance, history)
    }
}

class PlayService(private val conn: Connection) {
    suspend fun insertCoin(balance: Int): InsertCoinResponse = withContext(Dispatchers.IO) {
        if (balance < 1) throw IllegalStateException("No coins available")
        val games = GAME_CATALOG.shuffled().take(3)
        val sessionId = UUID.randomUUID().toString().take(8)
        conn.prepareStatement("INSERT INTO play_sessions (id, offered_games) VALUES (?, ?)")
            .also { it.setString(1, sessionId); it.setString(2, games.joinToString(",") { it.id }) }
            .executeUpdate()
        InsertCoinResponse(sessionId, games)
    }

    suspend fun startGame(sessionId: String, gameId: String) = withContext(Dispatchers.IO) {
        val rs = conn.prepareStatement("SELECT offered_games, coin_consumed FROM play_sessions WHERE id = ?")
            .also { it.setString(1, sessionId) }
            .executeQuery()
        if (!rs.next()) throw NoSuchElementException("Session not found")
        if (rs.getBoolean("coin_consumed")) throw IllegalStateException("Coin already consumed")
        val offered = rs.getString("offered_games").split(",")
        if (gameId !in offered) throw IllegalArgumentException("Game not offered in this session")
        conn.prepareStatement("UPDATE play_sessions SET chosen_game = ?, coin_consumed = true WHERE id = ?")
            .also { it.setString(1, gameId); it.setString(2, sessionId) }
            .executeUpdate()
    }
}

class ScoreService(private val conn: Connection) {
    suspend fun submit(req: SubmitScoreRequest): SubmitScoreResponse = withContext(Dispatchers.IO) {
        val prevHigh = conn.prepareStatement("SELECT COALESCE(MAX(score), 0) FROM scores WHERE game_id = ?")
            .also { it.setString(1, req.gameId) }
            .executeQuery().use { rs -> rs.next(); rs.getInt(1) }

        conn.prepareStatement("INSERT INTO scores (game_id, score, duration_seconds, won) VALUES (?, ?, ?, ?)")
            .also {
                it.setString(1, req.gameId)
                it.setInt(2, req.score)
                if (req.durationSeconds != null) it.setInt(3, req.durationSeconds) else it.setNull(3, java.sql.Types.INTEGER)
                it.setBoolean(4, req.won ?: false)
            }
            .executeUpdate()

        SubmitScoreResponse(req.score > prevHigh, if (prevHigh > 0) prevHigh else null)
    }

    suspend fun getAllStats(): List<GameStats> = withContext(Dispatchers.IO) {
        val stats = mutableMapOf<String, GameStats>()
        GAME_CATALOG.forEach { g -> stats[g.id] = GameStats(g.id, g.name, g.icon) }

        conn.createStatement().executeQuery("""
            SELECT game_id, MAX(score) as high, COUNT(*) as cnt,
                   (SELECT score FROM scores s2 WHERE s2.game_id = scores.game_id ORDER BY played_at DESC LIMIT 1) as last_score,
                   MAX(played_at) as last_played
            FROM scores GROUP BY game_id
        """).use { rs ->
            while (rs.next()) {
                val gid = rs.getString("game_id")
                val game = GAME_CATALOG.find { it.id == gid } ?: continue
                stats[gid] = GameStats(gid, game.name, game.icon, rs.getInt("high"), rs.getInt("last_score"), rs.getInt("cnt"), rs.getString("last_played"))
            }
        }
        stats.values.toList()
    }

    suspend fun getGameStats(gameId: String): List<ScoreRecord> = withContext(Dispatchers.IO) {
        val records = mutableListOf<ScoreRecord>()
        conn.prepareStatement("SELECT id, game_id, score, duration_seconds, won, played_at FROM scores WHERE game_id = ? ORDER BY played_at DESC LIMIT 50")
            .also { it.setString(1, gameId) }
            .executeQuery().use { rs ->
                while (rs.next()) {
                    records.add(ScoreRecord(
                        rs.getInt("id"), rs.getString("game_id"), rs.getInt("score"),
                        rs.getInt("duration_seconds").let { if (rs.wasNull()) null else it },
                        rs.getBoolean("won"), rs.getString("played_at")
                    ))
                }
            }
        records
    }
}

class ConfigService(conn: Connection) : pt.cunha.core.BaseConfigService(
    conn, "arcade_config", listOf("arcade_config", "coins", "scores", "play_sessions")
) {
    suspend fun getConfig(): Map<String, String> = getConfigMap()

    suspend fun updateConfig(updates: Map<String, String>) = setConfigs(updates)
}
