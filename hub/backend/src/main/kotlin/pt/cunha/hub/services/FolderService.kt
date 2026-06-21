package pt.cunha.hub.services

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import pt.cunha.hub.models.Entry
import pt.cunha.hub.models.Folder
import pt.cunha.hub.models.FolderWithEntries
import java.sql.Connection

class FolderService(private val conn: Connection) {

    suspend fun getAll(): List<FolderWithEntries> = withContext(Dispatchers.IO) {
        val folders = mutableListOf<Folder>()
        conn.prepareStatement("SELECT id, name, position FROM folders ORDER BY position, id")
            .executeQuery().use { rs ->
                while (rs.next()) {
                    folders.add(Folder(rs.getInt("id"), rs.getString("name"), rs.getInt("position")))
                }
            }

        val entryMap = mutableMapOf<Int, MutableList<Entry>>()
        folders.forEach { entryMap[it.id] = mutableListOf() }

        conn.prepareStatement(
            "SELECT id, label, url, type, folder_id, position FROM entries WHERE folder_id IS NOT NULL ORDER BY position, id"
        ).executeQuery().use { rs ->
            while (rs.next()) {
                val fid = rs.getInt("folder_id")
                if (entryMap.containsKey(fid)) {
                    entryMap[fid]!!.add(
                        Entry(
                            id = rs.getInt("id"),
                            label = rs.getString("label"),
                            url = rs.getString("url"),
                            type = rs.getString("type"),
                            folderId = fid,
                            position = rs.getInt("position")
                        )
                    )
                }
            }
        }

        folders.map { f ->
            FolderWithEntries(f.id, f.name, f.position, entryMap[f.id] ?: emptyList())
        }
    }

    suspend fun create(name: String): Folder = withContext(Dispatchers.IO) {
        val nextPos = conn.createStatement().executeQuery(
            "SELECT COALESCE(MAX(position) + 1, 0) FROM folders"
        ).use { rs -> rs.next(); rs.getInt(1) }

        conn.prepareStatement("INSERT INTO folders (name, position) VALUES (?, ?) RETURNING id, name, position")
            .also { it.setString(1, name); it.setInt(2, nextPos) }
            .executeQuery().use { rs ->
                rs.next()
                Folder(rs.getInt("id"), rs.getString("name"), rs.getInt("position"))
            }
    }

    suspend fun update(id: Int, name: String?, position: Int?): Folder = withContext(Dispatchers.IO) {
        val current = findById(id) ?: throw NoSuchElementException("Folder $id not found")
        val newName = name ?: current.name
        val newPos = position ?: current.position
        conn.prepareStatement("UPDATE folders SET name = ?, position = ? WHERE id = ? RETURNING id, name, position")
            .also { it.setString(1, newName); it.setInt(2, newPos); it.setInt(3, id) }
            .executeQuery().use { rs ->
                rs.next()
                Folder(rs.getInt("id"), rs.getString("name"), rs.getInt("position"))
            }
    }

    suspend fun delete(id: Int) = withContext(Dispatchers.IO) {
        conn.prepareStatement("DELETE FROM folders WHERE id = ?")
            .also { it.setInt(1, id) }
            .executeUpdate()
    }

    private fun findById(id: Int): Folder? =
        conn.prepareStatement("SELECT id, name, position FROM folders WHERE id = ?")
            .also { it.setInt(1, id) }
            .executeQuery().use { rs ->
                if (rs.next()) Folder(rs.getInt("id"), rs.getString("name"), rs.getInt("position"))
                else null
            }
}
