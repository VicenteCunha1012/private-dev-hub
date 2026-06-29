package pt.cunha.core

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.sql.Connection

object DbExportImport {

    suspend fun exportTables(conn: Connection, tables: List<String>): String = withContext(Dispatchers.IO) {
        val sb = StringBuilder()
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

    suspend fun importSql(conn: Connection, sql: String, tables: List<String>) = withContext(Dispatchers.IO) {
        conn.createStatement().use { stmt ->
            for (table in tables.reversed()) {
                stmt.executeUpdate("DELETE FROM $table")
            }
        }
        for (line in sql.lines()) {
            val trimmed = line.trim()
            if (trimmed.isNotEmpty() && !trimmed.startsWith("--")) {
                conn.createStatement().use { it.executeUpdate(trimmed) }
            }
        }
    }
}
