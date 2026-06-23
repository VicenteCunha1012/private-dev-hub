package pt.cunha.secretsvault

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.sql.Connection

class SecretService(private val conn: Connection) {

    suspend fun getAll(search: String? = null, category: String? = null): List<Secret> = withContext(Dispatchers.IO) {
        val conditions = mutableListOf<String>()
        val params = mutableListOf<String>()

        if (!search.isNullOrBlank()) {
            conditions.add("(label ILIKE ? OR category ILIKE ? OR tags ILIKE ?)")
            val pattern = "%$search%"
            params.add(pattern); params.add(pattern); params.add(pattern)
        }
        if (!category.isNullOrBlank()) {
            conditions.add("category ILIKE ?")
            params.add("%$category%")
        }

        val where = if (conditions.isNotEmpty()) "WHERE ${conditions.joinToString(" AND ")}" else ""
        val sql = "SELECT id, label, category, tags, iv, ciphertext, created_at, updated_at FROM secrets $where ORDER BY updated_at DESC"

        val stmt = conn.prepareStatement(sql)
        params.forEachIndexed { i, v -> stmt.setString(i + 1, v) }

        val result = mutableListOf<Secret>()
        stmt.executeQuery().use { rs -> while (rs.next()) result.add(rowToSecret(rs)) }
        result
    }

    suspend fun getById(id: Int): Secret? = withContext(Dispatchers.IO) {
        val stmt = conn.prepareStatement(
            "SELECT id, label, category, tags, iv, ciphertext, created_at, updated_at FROM secrets WHERE id = ?"
        )
        stmt.setInt(1, id)
        stmt.executeQuery().use { rs -> if (rs.next()) rowToSecret(rs) else null }
    }

    suspend fun create(req: CreateSecretRequest): Secret = withContext(Dispatchers.IO) {
        val stmt = conn.prepareStatement(
            "INSERT INTO secrets (label, category, tags, iv, ciphertext) VALUES (?, ?, ?, ?, ?) RETURNING id, label, category, tags, iv, ciphertext, created_at, updated_at"
        )
        stmt.setString(1, req.label)
        stmt.setString(2, req.category)
        stmt.setString(3, req.tags)
        stmt.setString(4, req.iv)
        stmt.setString(5, req.ciphertext)
        stmt.executeQuery().use { rs -> rs.next(); rowToSecret(rs) }
    }

    suspend fun update(id: Int, req: UpdateSecretRequest): Secret? = withContext(Dispatchers.IO) {
        val sets = mutableListOf<String>()
        val params = mutableListOf<Any?>()

        if (req.label != null) { sets.add("label = ?"); params.add(req.label) }
        if (req.category != null) { sets.add("category = ?"); params.add(req.category) }
        if (req.tags != null) { sets.add("tags = ?"); params.add(req.tags) }
        if (req.iv != null) { sets.add("iv = ?"); params.add(req.iv) }
        if (req.ciphertext != null) { sets.add("ciphertext = ?"); params.add(req.ciphertext) }

        if (sets.isEmpty()) return@withContext getById(id)

        sets.add("updated_at = NOW()")
        val sql = "UPDATE secrets SET ${sets.joinToString(", ")} WHERE id = ? RETURNING id, label, category, tags, iv, ciphertext, created_at, updated_at"
        val stmt = conn.prepareStatement(sql)
        params.forEachIndexed { i, v ->
            if (v == null) stmt.setNull(i + 1, java.sql.Types.VARCHAR)
            else stmt.setString(i + 1, v as String)
        }
        stmt.setInt(params.size + 1, id)
        stmt.executeQuery().use { rs -> if (rs.next()) rowToSecret(rs) else null }
    }

    suspend fun delete(id: Int): Boolean = withContext(Dispatchers.IO) {
        val stmt = conn.prepareStatement("DELETE FROM secrets WHERE id = ?")
        stmt.setInt(1, id)
        stmt.executeUpdate() > 0
    }

    suspend fun getCategories(): List<String> = withContext(Dispatchers.IO) {
        val categories = mutableSetOf<String>()
        conn.createStatement().executeQuery("SELECT DISTINCT category FROM secrets WHERE category IS NOT NULL AND category != ''").use { rs ->
            while (rs.next()) {
                val cat = rs.getString("category")?.trim()
                if (!cat.isNullOrEmpty()) categories.add(cat)
            }
        }
        categories.sorted()
    }

    private fun rowToSecret(rs: java.sql.ResultSet): Secret = Secret(
        id = rs.getInt("id"),
        label = rs.getString("label"),
        category = rs.getString("category"),
        tags = rs.getString("tags"),
        iv = rs.getString("iv"),
        ciphertext = rs.getString("ciphertext"),
        createdAt = rs.getString("created_at"),
        updatedAt = rs.getString("updated_at")
    )
}
