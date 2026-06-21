package pt.cunha.commandvault

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.sql.Connection

class SnippetService(private val conn: Connection) {

    suspend fun getAll(search: String? = null, tag: String? = null): List<Snippet> = withContext(Dispatchers.IO) {
        val conditions = mutableListOf<String>()
        val params = mutableListOf<String>()

        if (!search.isNullOrBlank()) {
            conditions.add("(title ILIKE ? OR command ILIKE ? OR description ILIKE ?)")
            val pattern = "%$search%"
            params.add(pattern)
            params.add(pattern)
            params.add(pattern)
        }
        if (!tag.isNullOrBlank()) {
            conditions.add("tags ILIKE ?")
            params.add("%$tag%")
        }

        val where = if (conditions.isNotEmpty()) "WHERE ${conditions.joinToString(" AND ")}" else ""
        val sql = "SELECT id, title, command, description, tags, created_at, updated_at FROM snippets $where ORDER BY updated_at DESC"

        val stmt = conn.prepareStatement(sql)
        params.forEachIndexed { i, v -> stmt.setString(i + 1, v) }

        val result = mutableListOf<Snippet>()
        stmt.executeQuery().use { rs ->
            while (rs.next()) {
                result.add(rowToSnippet(rs))
            }
        }
        result
    }

    suspend fun getById(id: Int): Snippet? = withContext(Dispatchers.IO) {
        val stmt = conn.prepareStatement(
            "SELECT id, title, command, description, tags, created_at, updated_at FROM snippets WHERE id = ?"
        )
        stmt.setInt(1, id)
        stmt.executeQuery().use { rs ->
            if (rs.next()) rowToSnippet(rs) else null
        }
    }

    suspend fun create(req: CreateSnippetRequest): Snippet = withContext(Dispatchers.IO) {
        val stmt = conn.prepareStatement(
            "INSERT INTO snippets (title, command, description, tags) VALUES (?, ?, ?, ?) RETURNING id, title, command, description, tags, created_at, updated_at"
        )
        stmt.setString(1, req.title)
        stmt.setString(2, req.command)
        stmt.setString(3, req.description)
        stmt.setString(4, req.tags)
        stmt.executeQuery().use { rs ->
            rs.next()
            rowToSnippet(rs)
        }
    }

    suspend fun update(id: Int, req: UpdateSnippetRequest): Snippet? = withContext(Dispatchers.IO) {
        val sets = mutableListOf<String>()
        val params = mutableListOf<Any?>()

        if (req.title != null) { sets.add("title = ?"); params.add(req.title) }
        if (req.command != null) { sets.add("command = ?"); params.add(req.command) }
        if (req.description != null) { sets.add("description = ?"); params.add(req.description) }
        if (req.tags != null) { sets.add("tags = ?"); params.add(req.tags) }

        if (sets.isEmpty()) return@withContext getById(id)

        sets.add("updated_at = NOW()")
        val sql = "UPDATE snippets SET ${sets.joinToString(", ")} WHERE id = ? RETURNING id, title, command, description, tags, created_at, updated_at"
        val stmt = conn.prepareStatement(sql)
        params.forEachIndexed { i, v ->
            if (v == null) stmt.setNull(i + 1, java.sql.Types.VARCHAR)
            else stmt.setString(i + 1, v as String)
        }
        stmt.setInt(params.size + 1, id)
        stmt.executeQuery().use { rs ->
            if (rs.next()) rowToSnippet(rs) else null
        }
    }

    suspend fun delete(id: Int): Boolean = withContext(Dispatchers.IO) {
        val stmt = conn.prepareStatement("DELETE FROM snippets WHERE id = ?")
        stmt.setInt(1, id)
        stmt.executeUpdate() > 0
    }

    suspend fun getTags(): List<String> = withContext(Dispatchers.IO) {
        val tags = mutableSetOf<String>()
        conn.createStatement().executeQuery("SELECT DISTINCT tags FROM snippets WHERE tags IS NOT NULL AND tags != ''").use { rs ->
            while (rs.next()) {
                rs.getString("tags")?.split(",")?.forEach { t ->
                    val trimmed = t.trim()
                    if (trimmed.isNotEmpty()) tags.add(trimmed)
                }
            }
        }
        tags.sorted()
    }

    private fun rowToSnippet(rs: java.sql.ResultSet): Snippet = Snippet(
        id = rs.getInt("id"),
        title = rs.getString("title"),
        command = rs.getString("command"),
        description = rs.getString("description"),
        tags = rs.getString("tags"),
        createdAt = rs.getString("created_at"),
        updatedAt = rs.getString("updated_at")
    )
}
