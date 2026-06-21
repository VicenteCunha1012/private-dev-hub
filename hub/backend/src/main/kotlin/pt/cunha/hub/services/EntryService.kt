package pt.cunha.hub.services

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import pt.cunha.hub.models.Entry
import java.sql.Connection

class EntryService(private val conn: Connection) {

    suspend fun getAll(): List<Entry> = withContext(Dispatchers.IO) {
        val entries = mutableListOf<Entry>()
        conn.prepareStatement(
            "SELECT id, label, url, type, folder_id, position FROM entries ORDER BY folder_id NULLS LAST, position, id"
        ).executeQuery().use { rs ->
            while (rs.next()) {
                entries.add(
                    Entry(
                        id = rs.getInt("id"),
                        label = rs.getString("label"),
                        url = rs.getString("url"),
                        type = rs.getString("type"),
                        folderId = rs.getObject("folder_id") as? Int,
                        position = rs.getInt("position")
                    )
                )
            }
        }
        entries
    }

    suspend fun getById(id: Int): Entry = withContext(Dispatchers.IO) {
        conn.prepareStatement(
            "SELECT id, label, url, type, folder_id, position FROM entries WHERE id = ?"
        ).also { it.setInt(1, id) }.executeQuery().use { rs ->
            if (!rs.next()) throw NoSuchElementException("Entry $id not found")
            Entry(
                id = rs.getInt("id"),
                label = rs.getString("label"),
                url = rs.getString("url"),
                type = rs.getString("type"),
                folderId = rs.getObject("folder_id") as? Int,
                position = rs.getInt("position")
            )
        }
    }

    suspend fun create(label: String, url: String?, type: String, folderId: Int?, position: Int): Entry =
        withContext(Dispatchers.IO) {
            conn.prepareStatement(
                "INSERT INTO entries (label, url, type, folder_id, position) VALUES (?, ?, ?, ?, ?) RETURNING id, label, url, type, folder_id, position"
            ).also { stmt ->
                stmt.setString(1, label)
                stmt.setString(2, url)
                stmt.setString(3, type)
                if (folderId != null) stmt.setInt(4, folderId) else stmt.setNull(4, java.sql.Types.INTEGER)
                stmt.setInt(5, position)
            }.executeQuery().use { rs ->
                rs.next()
                Entry(
                    id = rs.getInt("id"),
                    label = rs.getString("label"),
                    url = rs.getString("url"),
                    type = rs.getString("type"),
                    folderId = rs.getObject("folder_id") as? Int,
                    position = rs.getInt("position")
                )
            }
        }

    suspend fun update(id: Int, label: String?, url: String?, type: String?, folderId: Int?, position: Int?): Entry =
        withContext(Dispatchers.IO) {
            val current = getById(id)
            val newLabel = label ?: current.label
            val newUrl = url ?: current.url
            val newType = type ?: current.type
            val newFolderId = folderId ?: current.folderId
            val newPosition = position ?: current.position

            conn.prepareStatement(
                "UPDATE entries SET label=?, url=?, type=?, folder_id=?, position=? WHERE id=? RETURNING id, label, url, type, folder_id, position"
            ).also { stmt ->
                stmt.setString(1, newLabel)
                stmt.setString(2, newUrl)
                stmt.setString(3, newType)
                if (newFolderId != null) stmt.setInt(4, newFolderId) else stmt.setNull(4, java.sql.Types.INTEGER)
                stmt.setInt(5, newPosition)
                stmt.setInt(6, id)
            }.executeQuery().use { rs ->
                rs.next()
                Entry(
                    id = rs.getInt("id"),
                    label = rs.getString("label"),
                    url = rs.getString("url"),
                    type = rs.getString("type"),
                    folderId = rs.getObject("folder_id") as? Int,
                    position = rs.getInt("position")
                )
            }
        }

    suspend fun delete(id: Int) = withContext(Dispatchers.IO) {
        conn.prepareStatement("DELETE FROM entries WHERE id = ?")
            .also { it.setInt(1, id) }
            .executeUpdate()
    }
}
