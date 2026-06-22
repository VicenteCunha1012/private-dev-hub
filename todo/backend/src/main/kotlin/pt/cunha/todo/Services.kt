package pt.cunha.todo

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.sql.Connection
import java.sql.Types

class ConfigService(private val conn: Connection) {

    suspend fun getAll(): Map<String, String> = withContext(Dispatchers.IO) {
        val map = mutableMapOf<String, String>()
        conn.createStatement().executeQuery("SELECT key, value FROM todo_config").use { rs ->
            while (rs.next()) map[rs.getString("key")] = rs.getString("value") ?: ""
        }
        map
    }

    suspend fun update(config: Map<String, String>) = withContext(Dispatchers.IO) {
        val stmt = conn.prepareStatement(
            "INSERT INTO todo_config (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value"
        )
        for ((key, value) in config) {
            stmt.setString(1, key)
            stmt.setString(2, value)
            stmt.executeUpdate()
        }
    }

    suspend fun exportConfig(): Map<String, String> = getAll()

    suspend fun importConfig(config: Map<String, String>) = withContext(Dispatchers.IO) {
        conn.createStatement().executeUpdate("DELETE FROM todo_config")
        update(config)
    }

    suspend fun exportDatabase(): String = withContext(Dispatchers.IO) {
        val sb = StringBuilder()
        val tables = listOf("todo_config", "lists", "tasks")
        for (table in tables) {
            val rs = conn.createStatement().executeQuery("SELECT * FROM $table")
            val meta = rs.metaData
            val colCount = meta.columnCount
            while (rs.next()) {
                val values = (1..colCount).joinToString(", ") { i ->
                    val v = rs.getObject(i)
                    when (v) {
                        null -> "NULL"
                        is Number -> v.toString()
                        is Boolean -> v.toString()
                        else -> "'${v.toString().replace("'", "''")}'"
                    }
                }
                sb.appendLine("INSERT INTO $table VALUES ($values);")
            }
            rs.close()
        }
        sb.toString()
    }

    suspend fun importDatabase(sql: String) = withContext(Dispatchers.IO) {
        conn.createStatement().use { stmt ->
            stmt.executeUpdate("DELETE FROM tasks")
            stmt.executeUpdate("DELETE FROM lists")
            stmt.executeUpdate("DELETE FROM todo_config")
        }
        for (line in sql.lines()) {
            val trimmed = line.trim()
            if (trimmed.isNotEmpty() && !trimmed.startsWith("--")) {
                conn.createStatement().use { it.executeUpdate(trimmed) }
            }
        }
    }
}

class ListService(private val conn: Connection) {

    suspend fun getAll(): List<TodoList> = withContext(Dispatchers.IO) {
        val allLists = mutableListOf<TodoList>()
        val rs = conn.createStatement().executeQuery("""
            SELECT l.*, COALESCE(tc.cnt, 0) AS task_count
            FROM lists l
            LEFT JOIN (SELECT list_id, COUNT(*) AS cnt FROM tasks WHERE completed = FALSE AND parent_id IS NULL GROUP BY list_id) tc ON tc.list_id = l.id
            ORDER BY l.position, l.id
        """)
        while (rs.next()) {
            allLists.add(TodoList(
                id = rs.getInt("id"),
                name = rs.getString("name"),
                color = rs.getString("color") ?: "#8b5cf6",
                icon = rs.getString("icon") ?: "📋",
                position = rs.getInt("position"),
                parentId = rs.getObject("parent_id") as? Int,
                createdAt = rs.getString("created_at") ?: "",
                taskCount = rs.getInt("task_count")
            ))
        }
        rs.close()
        // Build tree: nest children under parents
        val byId = allLists.associateBy { it.id }
        val roots = mutableListOf<TodoList>()
        val childMap = allLists.filter { it.parentId != null }.groupBy { it.parentId }
        for (list in allLists) {
            if (list.parentId == null) {
                roots.add(list.copy(children = childMap[list.id] ?: emptyList()))
            }
        }
        roots
    }

    suspend fun create(req: CreateListRequest): TodoList = withContext(Dispatchers.IO) {
        val maxPos = conn.createStatement().executeQuery("SELECT COALESCE(MAX(position), -1) FROM lists").use { rs ->
            rs.next(); rs.getInt(1)
        }
        val stmt = conn.prepareStatement(
            "INSERT INTO lists (name, color, icon, position, parent_id) VALUES (?, ?, ?, ?, ?) RETURNING id, name, color, icon, position, parent_id, created_at"
        )
        stmt.setString(1, req.name)
        stmt.setString(2, req.color ?: "#8b5cf6")
        stmt.setString(3, req.icon ?: "📋")
        stmt.setInt(4, maxPos + 1)
        if (req.parentId != null) stmt.setInt(5, req.parentId) else stmt.setNull(5, Types.INTEGER)
        stmt.executeQuery().use { rs ->
            rs.next()
            TodoList(
                id = rs.getInt("id"),
                name = rs.getString("name"),
                color = rs.getString("color") ?: "#8b5cf6",
                icon = rs.getString("icon") ?: "📋",
                position = rs.getInt("position"),
                parentId = rs.getObject("parent_id") as? Int,
                createdAt = rs.getString("created_at") ?: ""
            )
        }
    }

    suspend fun update(id: Int, req: UpdateListRequest): TodoList? = withContext(Dispatchers.IO) {
        val sets = mutableListOf<String>()
        val params = mutableListOf<Any?>()
        val types = mutableListOf<Int>()

        if (req.name != null) { sets.add("name = ?"); params.add(req.name); types.add(Types.VARCHAR) }
        if (req.color != null) { sets.add("color = ?"); params.add(req.color); types.add(Types.VARCHAR) }
        if (req.icon != null) { sets.add("icon = ?"); params.add(req.icon); types.add(Types.VARCHAR) }
        if (req.position != null) { sets.add("position = ?"); params.add(req.position); types.add(Types.INTEGER) }
        if (req.parentId != null) { sets.add("parent_id = ?"); params.add(req.parentId); types.add(Types.INTEGER) }

        if (sets.isEmpty()) return@withContext getById(id)

        val sql = "UPDATE lists SET ${sets.joinToString(", ")} WHERE id = ? RETURNING id, name, color, icon, position, parent_id, created_at"
        val stmt = conn.prepareStatement(sql)
        params.forEachIndexed { i, v ->
            when {
                v == null -> stmt.setNull(i + 1, types[i])
                v is Int -> stmt.setInt(i + 1, v)
                else -> stmt.setString(i + 1, v as String)
            }
        }
        stmt.setInt(params.size + 1, id)
        stmt.executeQuery().use { rs ->
            if (rs.next()) TodoList(
                id = rs.getInt("id"),
                name = rs.getString("name"),
                color = rs.getString("color") ?: "#8b5cf6",
                icon = rs.getString("icon") ?: "📋",
                position = rs.getInt("position"),
                parentId = rs.getObject("parent_id") as? Int,
                createdAt = rs.getString("created_at") ?: ""
            ) else null
        }
    }

    suspend fun delete(id: Int): Boolean = withContext(Dispatchers.IO) {
        conn.prepareStatement("DELETE FROM lists WHERE id = ?").let { stmt ->
            stmt.setInt(1, id)
            stmt.executeUpdate() > 0
        }
    }

    private fun getById(id: Int): TodoList? {
        val stmt = conn.prepareStatement(
            "SELECT id, name, color, icon, position, parent_id, created_at FROM lists WHERE id = ?"
        )
        stmt.setInt(1, id)
        return stmt.executeQuery().use { rs ->
            if (rs.next()) TodoList(
                id = rs.getInt("id"),
                name = rs.getString("name"),
                color = rs.getString("color") ?: "#8b5cf6",
                icon = rs.getString("icon") ?: "📋",
                position = rs.getInt("position"),
                parentId = rs.getObject("parent_id") as? Int,
                createdAt = rs.getString("created_at") ?: ""
            ) else null
        }
    }
}

class TaskService(private val conn: Connection) {

    suspend fun getAll(
        listId: Int? = null,
        completed: Boolean? = null,
        search: String? = null,
        tag: String? = null,
        priority: Int? = null
    ): List<Task> = withContext(Dispatchers.IO) {
        val conditions = mutableListOf<String>()
        val params = mutableListOf<Any>()

        conditions.add("t.parent_id IS NULL")

        if (listId != null) { conditions.add("t.list_id = ?"); params.add(listId) }
        if (completed != null) { conditions.add("t.completed = ?"); params.add(completed) }
        if (!search.isNullOrBlank()) {
            conditions.add("(t.title ILIKE ? OR t.notes ILIKE ?)")
            params.add("%$search%"); params.add("%$search%")
        }
        if (!tag.isNullOrBlank()) { conditions.add("t.tags ILIKE ?"); params.add("%$tag%") }
        if (priority != null) { conditions.add("t.priority = ?"); params.add(priority) }

        val where = "WHERE ${conditions.joinToString(" AND ")}"
        val sql = """
            SELECT id, list_id, title, notes, completed, priority, due_date, tags, position, parent_id, created_at, completed_at
            FROM tasks t $where
            ORDER BY t.completed ASC, t.position ASC, t.id DESC
        """

        val stmt = conn.prepareStatement(sql)
        var idx = 1
        for (p in params) {
            when (p) {
                is Int -> stmt.setInt(idx++, p)
                is Boolean -> stmt.setBoolean(idx++, p)
                is String -> stmt.setString(idx++, p)
            }
        }

        val tasks = mutableListOf<Task>()
        stmt.executeQuery().use { rs ->
            while (rs.next()) {
                val task = rowToTask(rs)
                val subtasks = getSubtasks(task.id)
                tasks.add(task.copy(subtasks = subtasks))
            }
        }
        tasks
    }

    private fun getSubtasks(parentId: Int): List<Task> {
        val stmt = conn.prepareStatement(
            "SELECT id, list_id, title, notes, completed, priority, due_date, tags, position, parent_id, created_at, completed_at FROM tasks WHERE parent_id = ? ORDER BY position ASC, id ASC"
        )
        stmt.setInt(1, parentId)
        val subtasks = mutableListOf<Task>()
        stmt.executeQuery().use { rs ->
            while (rs.next()) subtasks.add(rowToTask(rs))
        }
        return subtasks
    }

    suspend fun create(req: CreateTaskRequest): Task = withContext(Dispatchers.IO) {
        val maxPos = conn.prepareStatement(
            "SELECT COALESCE(MAX(position), -1) FROM tasks WHERE list_id ${if (req.listId != null) "= ?" else "IS NULL"} AND parent_id ${if (req.parentId != null) "= ?" else "IS NULL"}"
        ).let { stmt ->
            var i = 1
            if (req.listId != null) stmt.setInt(i++, req.listId)
            if (req.parentId != null) stmt.setInt(i, req.parentId)
            stmt.executeQuery().use { rs -> rs.next(); rs.getInt(1) }
        }

        val stmt = conn.prepareStatement(
            "INSERT INTO tasks (title, list_id, notes, priority, due_date, tags, position, parent_id) VALUES (?, ?, ?, ?, ?::date, ?, ?, ?) RETURNING id, list_id, title, notes, completed, priority, due_date, tags, position, parent_id, created_at, completed_at"
        )
        stmt.setString(1, req.title)
        if (req.listId != null) stmt.setInt(2, req.listId) else stmt.setNull(2, Types.INTEGER)
        stmt.setString(3, req.notes)
        stmt.setInt(4, req.priority ?: 0)
        if (req.dueDate != null) stmt.setString(5, req.dueDate) else stmt.setNull(5, Types.VARCHAR)
        stmt.setString(6, req.tags)
        stmt.setInt(7, maxPos + 1)
        if (req.parentId != null) stmt.setInt(8, req.parentId) else stmt.setNull(8, Types.INTEGER)

        stmt.executeQuery().use { rs ->
            rs.next()
            rowToTask(rs)
        }
    }

    suspend fun update(id: Int, req: UpdateTaskRequest): Task? = withContext(Dispatchers.IO) {
        val sets = mutableListOf<String>()
        val params = mutableListOf<Any?>()
        val types = mutableListOf<Int>()

        if (req.title != null) { sets.add("title = ?"); params.add(req.title); types.add(Types.VARCHAR) }
        if (req.notes != null) { sets.add("notes = ?"); params.add(req.notes); types.add(Types.VARCHAR) }
        if (req.completed != null) {
            sets.add("completed = ?"); params.add(req.completed); types.add(Types.BOOLEAN)
            if (req.completed) {
                sets.add("completed_at = NOW()")
            } else {
                sets.add("completed_at = NULL")
            }
        }
        if (req.priority != null) { sets.add("priority = ?"); params.add(req.priority); types.add(Types.INTEGER) }
        if (req.dueDate != null) { sets.add("due_date = ?::date"); params.add(req.dueDate); types.add(Types.VARCHAR) }
        if (req.tags != null) { sets.add("tags = ?"); params.add(req.tags); types.add(Types.VARCHAR) }
        if (req.position != null) { sets.add("position = ?"); params.add(req.position); types.add(Types.INTEGER) }
        if (req.listId != null) { sets.add("list_id = ?"); params.add(req.listId); types.add(Types.INTEGER) }
        if (req.parentId != null) { sets.add("parent_id = ?"); params.add(req.parentId); types.add(Types.INTEGER) }

        if (sets.isEmpty()) return@withContext getById(id)

        val sql = "UPDATE tasks SET ${sets.joinToString(", ")} WHERE id = ? RETURNING id, list_id, title, notes, completed, priority, due_date, tags, position, parent_id, created_at, completed_at"
        val stmt = conn.prepareStatement(sql)
        var idx = 1
        for (i in params.indices) {
            val v = params[i]
            when {
                v == null -> stmt.setNull(idx++, types[i])
                v is Boolean -> stmt.setBoolean(idx++, v)
                v is Int -> stmt.setInt(idx++, v)
                else -> stmt.setString(idx++, v as String)
            }
        }
        stmt.setInt(idx, id)
        stmt.executeQuery().use { rs ->
            if (rs.next()) {
                val task = rowToTask(rs)
                val subtasks = getSubtasks(task.id)
                task.copy(subtasks = subtasks)
            } else null
        }
    }

    suspend fun delete(id: Int): Boolean = withContext(Dispatchers.IO) {
        conn.prepareStatement("DELETE FROM tasks WHERE id = ?").let { stmt ->
            stmt.setInt(1, id)
            stmt.executeUpdate() > 0
        }
    }

    suspend fun getTags(): List<String> = withContext(Dispatchers.IO) {
        val tags = mutableSetOf<String>()
        conn.createStatement().executeQuery("SELECT DISTINCT tags FROM tasks WHERE tags IS NOT NULL AND tags != ''").use { rs ->
            while (rs.next()) {
                rs.getString("tags")?.split(",")?.forEach { t ->
                    val trimmed = t.trim()
                    if (trimmed.isNotEmpty()) tags.add(trimmed)
                }
            }
        }
        tags.sorted()
    }

    private fun getById(id: Int): Task? {
        val stmt = conn.prepareStatement(
            "SELECT id, list_id, title, notes, completed, priority, due_date, tags, position, parent_id, created_at, completed_at FROM tasks WHERE id = ?"
        )
        stmt.setInt(1, id)
        return stmt.executeQuery().use { rs ->
            if (rs.next()) rowToTask(rs) else null
        }
    }

    private fun rowToTask(rs: java.sql.ResultSet): Task = Task(
        id = rs.getInt("id"),
        listId = rs.getObject("list_id") as? Int,
        title = rs.getString("title"),
        notes = rs.getString("notes"),
        completed = rs.getBoolean("completed"),
        priority = rs.getInt("priority"),
        dueDate = rs.getString("due_date"),
        tags = rs.getString("tags"),
        position = rs.getInt("position"),
        parentId = rs.getObject("parent_id") as? Int,
        createdAt = rs.getString("created_at") ?: "",
        completedAt = rs.getString("completed_at")
    )
}
