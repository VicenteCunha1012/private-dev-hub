package pt.cunha.hub.services

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import pt.cunha.hub.models.Entry
import java.sql.Connection

class EntryService(private val conn: Connection) {

    private fun rowToEntry(rs: java.sql.ResultSet) = Entry(
        id = rs.getInt("id"),
        label = rs.getString("label"),
        url = rs.getString("url"),
        type = rs.getString("type"),
        folderId = rs.getObject("folder_id") as? Int,
        position = rs.getInt("position"),
        workdir = rs.getString("workdir"),
        command = rs.getString("command"),
        emoji = rs.getString("emoji")
    )

    suspend fun getAll(): List<Entry> = withContext(Dispatchers.IO) {
        val entries = mutableListOf<Entry>()
        conn.prepareStatement(
            "SELECT id, label, url, type, folder_id, position, workdir, command, emoji FROM entries ORDER BY folder_id NULLS LAST, position, id"
        ).executeQuery().use { rs ->
            while (rs.next()) entries.add(rowToEntry(rs))
        }
        entries
    }

    suspend fun getById(id: Int): Entry = withContext(Dispatchers.IO) {
        conn.prepareStatement(
            "SELECT id, label, url, type, folder_id, position, workdir, command, emoji FROM entries WHERE id = ?"
        ).also { it.setInt(1, id) }.executeQuery().use { rs ->
            if (!rs.next()) throw NoSuchElementException("Entry $id not found")
            rowToEntry(rs)
        }
    }

    suspend fun create(
        label: String, url: String?, type: String, folderId: Int?, position: Int,
        workdir: String? = null, command: String? = null, emoji: String? = null
    ): Entry = withContext(Dispatchers.IO) {
        conn.prepareStatement(
            "INSERT INTO entries (label, url, type, folder_id, position, workdir, command, emoji) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id, label, url, type, folder_id, position, workdir, command, emoji"
        ).also { stmt ->
            stmt.setString(1, label)
            stmt.setString(2, url)
            stmt.setString(3, type)
            if (folderId != null) stmt.setInt(4, folderId) else stmt.setNull(4, java.sql.Types.INTEGER)
            stmt.setInt(5, position)
            stmt.setString(6, workdir)
            stmt.setString(7, command)
            stmt.setString(8, emoji)
        }.executeQuery().use { rs ->
            rs.next()
            rowToEntry(rs)
        }
    }

    suspend fun update(
        id: Int, label: String?, url: String?, type: String?, folderId: Int?, position: Int?,
        workdir: String? = null, command: String? = null, emoji: String? = null
    ): Entry = withContext(Dispatchers.IO) {
        val current = getById(id)
        val newLabel = label ?: current.label
        val newUrl = url ?: current.url
        val newType = type ?: current.type
        val newFolderId = folderId ?: current.folderId
        val newPosition = position ?: current.position
        val newWorkdir = workdir ?: current.workdir
        val newCommand = command ?: current.command
        val newEmoji = emoji ?: current.emoji

        conn.prepareStatement(
            "UPDATE entries SET label=?, url=?, type=?, folder_id=?, position=?, workdir=?, command=?, emoji=? WHERE id=? RETURNING id, label, url, type, folder_id, position, workdir, command, emoji"
        ).also { stmt ->
            stmt.setString(1, newLabel)
            stmt.setString(2, newUrl)
            stmt.setString(3, newType)
            if (newFolderId != null) stmt.setInt(4, newFolderId) else stmt.setNull(4, java.sql.Types.INTEGER)
            stmt.setInt(5, newPosition)
            stmt.setString(6, newWorkdir)
            stmt.setString(7, newCommand)
            stmt.setString(8, newEmoji)
            stmt.setInt(9, id)
        }.executeQuery().use { rs ->
            rs.next()
            rowToEntry(rs)
        }
    }

    suspend fun delete(id: Int) = withContext(Dispatchers.IO) {
        conn.prepareStatement("DELETE FROM entries WHERE id = ?")
            .also { it.setInt(1, id) }
            .executeUpdate()
    }
}
