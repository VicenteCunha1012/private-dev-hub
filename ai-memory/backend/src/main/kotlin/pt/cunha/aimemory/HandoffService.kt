package pt.cunha.aimemory

import java.sql.Connection

class HandoffService(private val conn: Connection) {

    fun getLatest(project: String, context: String = "default"): Handoff? {
        val stmt = conn.prepareStatement(
            "SELECT id, project, context, content, tool, created_at, updated_at FROM handoffs WHERE project = ? AND context = ? ORDER BY updated_at DESC LIMIT 1"
        )
        stmt.setString(1, project)
        stmt.setString(2, context)
        return stmt.executeQuery().use { rs ->
            if (rs.next()) Handoff(
                rs.getInt("id"), rs.getString("project"), rs.getString("context"),
                rs.getString("content"), rs.getString("tool"),
                rs.getTimestamp("created_at")?.toString(), rs.getTimestamp("updated_at")?.toString()
            ) else null
        }
    }

    fun getAll(project: String? = null): List<Handoff> {
        val sql = if (project != null) {
            "SELECT id, project, context, content, tool, created_at, updated_at FROM handoffs WHERE project = ? ORDER BY updated_at DESC"
        } else {
            "SELECT id, project, context, content, tool, created_at, updated_at FROM handoffs ORDER BY updated_at DESC"
        }
        val stmt = conn.prepareStatement(sql)
        if (project != null) stmt.setString(1, project)
        val result = mutableListOf<Handoff>()
        stmt.executeQuery().use { rs ->
            while (rs.next()) result.add(Handoff(
                rs.getInt("id"), rs.getString("project"), rs.getString("context"),
                rs.getString("content"), rs.getString("tool"),
                rs.getTimestamp("created_at")?.toString(), rs.getTimestamp("updated_at")?.toString()
            ))
        }
        return result
    }

    fun write(req: CreateHandoffRequest): Handoff {
        // Upsert: if same project+context exists, update; otherwise insert
        val existing = getLatest(req.project, req.context)
        if (existing != null) {
            val stmt = conn.prepareStatement(
                "UPDATE handoffs SET content = ?, tool = ?, updated_at = NOW() WHERE id = ? RETURNING id, project, context, content, tool, created_at, updated_at"
            )
            stmt.setString(1, req.content)
            stmt.setString(2, req.tool)
            stmt.setInt(3, existing.id)
            return stmt.executeQuery().use { rs ->
                rs.next()
                Handoff(rs.getInt("id"), rs.getString("project"), rs.getString("context"),
                    rs.getString("content"), rs.getString("tool"),
                    rs.getTimestamp("created_at")?.toString(), rs.getTimestamp("updated_at")?.toString())
            }
        } else {
            val stmt = conn.prepareStatement(
                "INSERT INTO handoffs (project, context, content, tool) VALUES (?, ?, ?, ?) RETURNING id, project, context, content, tool, created_at, updated_at"
            )
            stmt.setString(1, req.project)
            stmt.setString(2, req.context)
            stmt.setString(3, req.content)
            stmt.setString(4, req.tool)
            return stmt.executeQuery().use { rs ->
                rs.next()
                Handoff(rs.getInt("id"), rs.getString("project"), rs.getString("context"),
                    rs.getString("content"), rs.getString("tool"),
                    rs.getTimestamp("created_at")?.toString(), rs.getTimestamp("updated_at")?.toString())
            }
        }
    }

    fun getHistory(project: String, context: String = "default", limit: Int = 20): List<Handoff> {
        val stmt = conn.prepareStatement(
            "SELECT id, project, context, content, tool, created_at, updated_at FROM handoffs WHERE project = ? AND context = ? ORDER BY updated_at DESC LIMIT ?"
        )
        stmt.setString(1, project)
        stmt.setString(2, context)
        stmt.setInt(3, limit)
        val result = mutableListOf<Handoff>()
        stmt.executeQuery().use { rs ->
            while (rs.next()) result.add(Handoff(
                rs.getInt("id"), rs.getString("project"), rs.getString("context"),
                rs.getString("content"), rs.getString("tool"),
                rs.getTimestamp("created_at")?.toString(), rs.getTimestamp("updated_at")?.toString()
            ))
        }
        return result
    }
}
