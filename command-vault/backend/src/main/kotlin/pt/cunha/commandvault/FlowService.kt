package pt.cunha.commandvault

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.sql.Connection

class FlowService(private val conn: Connection) {

    suspend fun getAll(search: String? = null): List<Flow> = withContext(Dispatchers.IO) {
        val where = if (!search.isNullOrBlank()) "WHERE name ILIKE ?" else ""
        val sql = "SELECT id, name, graph_json, created_at, updated_at FROM flows $where ORDER BY updated_at DESC"
        val stmt = conn.prepareStatement(sql)
        if (!search.isNullOrBlank()) stmt.setString(1, "%$search%")
        val result = mutableListOf<Flow>()
        stmt.executeQuery().use { rs -> while (rs.next()) result.add(rowToFlow(rs)) }
        result
    }

    suspend fun getById(id: Int): Flow? = withContext(Dispatchers.IO) {
        val stmt = conn.prepareStatement(
            "SELECT id, name, graph_json, created_at, updated_at FROM flows WHERE id = ?"
        )
        stmt.setInt(1, id)
        stmt.executeQuery().use { rs -> if (rs.next()) rowToFlow(rs) else null }
    }

    suspend fun create(req: CreateFlowRequest): Flow = withContext(Dispatchers.IO) {
        val graphJson = req.graphJson ?: """{"nodes":[],"edges":[]}"""
        val stmt = conn.prepareStatement(
            "INSERT INTO flows (name, graph_json) VALUES (?, ?) RETURNING id, name, graph_json, created_at, updated_at"
        )
        stmt.setString(1, req.name)
        stmt.setString(2, graphJson)
        stmt.executeQuery().use { rs -> rs.next(); rowToFlow(rs) }
    }

    suspend fun update(id: Int, req: UpdateFlowRequest): Flow? = withContext(Dispatchers.IO) {
        val sets = mutableListOf<String>()
        val params = mutableListOf<Any?>()

        if (req.name != null) { sets.add("name = ?"); params.add(req.name) }
        if (req.graphJson != null) { sets.add("graph_json = ?"); params.add(req.graphJson) }

        if (sets.isEmpty()) return@withContext getById(id)

        sets.add("updated_at = NOW()")
        val sql = "UPDATE flows SET ${sets.joinToString(", ")} WHERE id = ? RETURNING id, name, graph_json, created_at, updated_at"
        val stmt = conn.prepareStatement(sql)
        params.forEachIndexed { i, v ->
            if (v == null) stmt.setNull(i + 1, java.sql.Types.VARCHAR)
            else stmt.setString(i + 1, v as String)
        }
        stmt.setInt(params.size + 1, id)
        stmt.executeQuery().use { rs -> if (rs.next()) rowToFlow(rs) else null }
    }

    suspend fun delete(id: Int): Boolean = withContext(Dispatchers.IO) {
        val stmt = conn.prepareStatement("DELETE FROM flows WHERE id = ?")
        stmt.setInt(1, id)
        stmt.executeUpdate() > 0
    }

    private fun rowToFlow(rs: java.sql.ResultSet): Flow = Flow(
        id = rs.getInt("id"),
        name = rs.getString("name"),
        graphJson = rs.getString("graph_json"),
        createdAt = rs.getString("created_at"),
        updatedAt = rs.getString("updated_at")
    )
}
