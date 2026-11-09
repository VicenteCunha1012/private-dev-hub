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
        val previousAutoCommit = conn.autoCommit
        conn.autoCommit = false
        try {
            conn.createStatement().use { stmt ->
                for (table in tables.reversed()) {
                    stmt.executeUpdate("DELETE FROM $table")
                }
            }
            for (statement in splitStatements(sql)) {
                conn.createStatement().use { it.executeUpdate(statement) }
            }
            conn.commit()
        } catch (e: Exception) {
            conn.rollback()
            throw e
        } finally {
            conn.autoCommit = previousAutoCommit
        }
    }

    /** Splits on ';' outside single-quoted literals, so values containing newlines or ';' stay intact. */
    internal fun splitStatements(sql: String): List<String> {
        val out = mutableListOf<String>()
        val cur = StringBuilder()
        var inQuote = false
        for (ch in sql) {
            if (ch == '\'') inQuote = !inQuote // '' escapes toggle twice, which is correct
            if (ch == ';' && !inQuote) {
                addStatement(out, cur.toString()); cur.clear()
            } else cur.append(ch)
        }
        addStatement(out, cur.toString())
        return out
    }

    private fun addStatement(out: MutableList<String>, raw: String) {
        val stmt = raw.lines().dropWhile { it.trim().startsWith("--") || it.isBlank() }.joinToString("\n").trim()
        if (stmt.isNotEmpty()) out.add(stmt)
    }
}
