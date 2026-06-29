package pt.cunha.aimemory

import java.sql.Connection

class DecisionService(private val conn: Connection) {

    fun getAll(search: String? = null, tag: String? = null, project: String? = null): List<Decision> {
        val conditions = mutableListOf<String>()
        val params = mutableListOf<String>()

        if (!search.isNullOrBlank()) {
            conditions.add("(title ILIKE ? OR description ILIKE ? OR reasoning ILIKE ?)")
            val term = "%$search%"
            params.addAll(listOf(term, term, term))
        }
        if (!tag.isNullOrBlank()) {
            conditions.add("tags ILIKE ?")
            params.add("%$tag%")
        }
        if (!project.isNullOrBlank()) {
            conditions.add("project = ?")
            params.add(project)
        }

        val where = if (conditions.isNotEmpty()) "WHERE ${conditions.joinToString(" AND ")}" else ""
        val stmt = conn.prepareStatement("SELECT * FROM decisions $where ORDER BY created_at DESC")
        params.forEachIndexed { i, p -> stmt.setString(i + 1, p) }

        val result = mutableListOf<Decision>()
        stmt.executeQuery().use { rs ->
            while (rs.next()) result.add(mapDecision(rs))
        }
        return result
    }

    fun getById(id: Int): Decision? {
        val stmt = conn.prepareStatement("SELECT * FROM decisions WHERE id = ?")
        stmt.setInt(1, id)
        return stmt.executeQuery().use { rs -> if (rs.next()) mapDecision(rs) else null }
    }

    fun create(req: CreateDecisionRequest): Decision {
        val stmt = conn.prepareStatement(
            """INSERT INTO decisions (title, description, reasoning, alternatives, tags, project, mr_link, ticket_link, tool)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *"""
        )
        stmt.setString(1, req.title)
        stmt.setString(2, req.description)
        stmt.setString(3, req.reasoning)
        stmt.setString(4, req.alternatives)
        stmt.setString(5, req.tags)
        stmt.setString(6, req.project)
        stmt.setString(7, req.mrLink)
        stmt.setString(8, req.ticketLink)
        stmt.setString(9, req.tool)
        return stmt.executeQuery().use { rs -> rs.next(); mapDecision(rs) }
    }

    fun update(id: Int, req: UpdateDecisionRequest): Decision? {
        val sets = mutableListOf<String>()
        val params = mutableListOf<Any?>()

        req.title?.let { sets.add("title = ?"); params.add(it) }
        req.description?.let { sets.add("description = ?"); params.add(it) }
        req.reasoning?.let { sets.add("reasoning = ?"); params.add(it) }
        req.alternatives?.let { sets.add("alternatives = ?"); params.add(it) }
        req.tags?.let { sets.add("tags = ?"); params.add(it) }
        req.project?.let { sets.add("project = ?"); params.add(it) }
        req.mrLink?.let { sets.add("mr_link = ?"); params.add(it) }
        req.ticketLink?.let { sets.add("ticket_link = ?"); params.add(it) }

        if (sets.isEmpty()) return getById(id)

        sets.add("updated_at = NOW()")
        val stmt = conn.prepareStatement("UPDATE decisions SET ${sets.joinToString(", ")} WHERE id = ? RETURNING *")
        params.forEachIndexed { i, p -> stmt.setString(i + 1, p as String) }
        stmt.setInt(params.size + 1, id)
        return stmt.executeQuery().use { rs -> if (rs.next()) mapDecision(rs) else null }
    }

    fun delete(id: Int): Boolean {
        return conn.prepareStatement("DELETE FROM decisions WHERE id = ?").also { it.setInt(1, id) }.executeUpdate() > 0
    }

    fun getTags(): List<String> {
        val tags = mutableSetOf<String>()
        conn.createStatement().executeQuery("SELECT DISTINCT tags FROM decisions WHERE tags IS NOT NULL AND tags != ''").use { rs ->
            while (rs.next()) {
                rs.getString("tags").split(",").map { it.trim() }.filter { it.isNotEmpty() }.forEach { tags.add(it) }
            }
        }
        return tags.sorted()
    }

    fun getProjects(): List<String> {
        val projects = mutableListOf<String>()
        conn.createStatement().executeQuery("SELECT DISTINCT project FROM decisions WHERE project IS NOT NULL AND project != '' ORDER BY project").use { rs ->
            while (rs.next()) projects.add(rs.getString("project"))
        }
        return projects
    }

    fun search(query: String, limit: Int = 20): List<Decision> {
        val stmt = conn.prepareStatement(
            "SELECT * FROM decisions WHERE title ILIKE ? OR description ILIKE ? OR tags ILIKE ? ORDER BY created_at DESC LIMIT ?"
        )
        val term = "%$query%"
        stmt.setString(1, term); stmt.setString(2, term); stmt.setString(3, term); stmt.setInt(4, limit)
        val result = mutableListOf<Decision>()
        stmt.executeQuery().use { rs -> while (rs.next()) result.add(mapDecision(rs)) }
        return result
    }

    private fun mapDecision(rs: java.sql.ResultSet) = Decision(
        id = rs.getInt("id"),
        title = rs.getString("title"),
        description = rs.getString("description"),
        reasoning = rs.getString("reasoning"),
        alternatives = rs.getString("alternatives"),
        tags = rs.getString("tags"),
        project = rs.getString("project"),
        mrLink = rs.getString("mr_link"),
        ticketLink = rs.getString("ticket_link"),
        tool = rs.getString("tool"),
        createdAt = rs.getTimestamp("created_at")?.toString(),
        updatedAt = rs.getTimestamp("updated_at")?.toString()
    )
}
