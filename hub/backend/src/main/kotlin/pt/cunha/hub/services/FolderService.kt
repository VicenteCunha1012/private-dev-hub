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
        conn.prepareStatement("SELECT id, name, position, parent_id FROM folders ORDER BY position, id")
            .executeQuery().use { rs ->
                while (rs.next()) {
                    val parentId = rs.getInt("parent_id").let { if (rs.wasNull()) null else it }
                    folders.add(Folder(rs.getInt("id"), rs.getString("name"), rs.getInt("position"), parentId))
                }
            }

        val entryMap = mutableMapOf<Int, MutableList<Entry>>()
        folders.forEach { entryMap[it.id] = mutableListOf() }

        conn.prepareStatement(
            "SELECT id, label, url, type, folder_id, position, workdir, command, emoji FROM entries WHERE folder_id IS NOT NULL ORDER BY position, id"
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
                            position = rs.getInt("position"),
                            workdir = rs.getString("workdir"),
                            command = rs.getString("command"),
                            emoji = rs.getString("emoji")
                        )
                    )
                }
            }
        }

        val flatFolders = folders.map { f ->
            FolderWithEntries(f.id, f.name, f.position, f.parentId, entryMap[f.id] ?: emptyList())
        }

        buildTree(flatFolders, null)
    }

    private fun buildTree(all: List<FolderWithEntries>, parentId: Int?): List<FolderWithEntries> {
        return all.filter { it.parentId == parentId }.map { folder ->
            folder.copy(children = buildTree(all, folder.id))
        }
    }

    suspend fun create(name: String, parentId: Int? = null): Folder = withContext(Dispatchers.IO) {
        val nextPos = conn.createStatement().executeQuery(
            "SELECT COALESCE(MAX(position) + 1, 0) FROM folders"
        ).use { rs -> rs.next(); rs.getInt(1) }

        conn.prepareStatement("INSERT INTO folders (name, position, parent_id) VALUES (?, ?, ?) RETURNING id, name, position, parent_id")
            .also {
                it.setString(1, name)
                it.setInt(2, nextPos)
                if (parentId != null) it.setInt(3, parentId) else it.setNull(3, java.sql.Types.INTEGER)
            }
            .executeQuery().use { rs ->
                rs.next()
                val pid = rs.getInt("parent_id").let { if (rs.wasNull()) null else it }
                Folder(rs.getInt("id"), rs.getString("name"), rs.getInt("position"), pid)
            }
    }

    suspend fun update(id: Int, name: String?, position: Int?, parentId: Int? = null): Folder = withContext(Dispatchers.IO) {
        val current = findById(id) ?: throw NoSuchElementException("Folder $id not found")
        val newName = name ?: current.name
        val newPos = position ?: current.position
        val newParent = parentId ?: current.parentId
        conn.prepareStatement("UPDATE folders SET name = ?, position = ?, parent_id = ? WHERE id = ? RETURNING id, name, position, parent_id")
            .also {
                it.setString(1, newName)
                it.setInt(2, newPos)
                if (newParent != null) it.setInt(3, newParent) else it.setNull(3, java.sql.Types.INTEGER)
                it.setInt(4, id)
            }
            .executeQuery().use { rs ->
                rs.next()
                val pid = rs.getInt("parent_id").let { if (rs.wasNull()) null else it }
                Folder(rs.getInt("id"), rs.getString("name"), rs.getInt("position"), pid)
            }
    }

    suspend fun delete(id: Int) = withContext(Dispatchers.IO) {
        conn.prepareStatement("DELETE FROM folders WHERE id = ?")
            .also { it.setInt(1, id) }
            .executeUpdate()
    }

    private fun findById(id: Int): Folder? =
        conn.prepareStatement("SELECT id, name, position, parent_id FROM folders WHERE id = ?")
            .also { it.setInt(1, id) }
            .executeQuery().use { rs ->
                if (rs.next()) {
                    val pid = rs.getInt("parent_id").let { if (rs.wasNull()) null else it }
                    Folder(rs.getInt("id"), rs.getString("name"), rs.getInt("position"), pid)
                }
                else null
            }
}
