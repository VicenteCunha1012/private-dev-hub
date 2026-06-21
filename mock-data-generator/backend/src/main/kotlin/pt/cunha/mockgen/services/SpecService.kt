package pt.cunha.mockgen.services

import kotlinx.serialization.json.Json
import pt.cunha.mockgen.models.GenerationSpec
import pt.cunha.mockgen.models.SpecRecord
import pt.cunha.mockgen.models.SpecVersionRecord
import java.sql.Connection

private val json = Json { ignoreUnknownKeys = true; prettyPrint = false }

class SpecService(private val conn: Connection) {

    fun getAll(): List<SpecRecord> {
        val rs = conn.createStatement().executeQuery(
            "SELECT id, name, mode, spec_json, version, created_at, updated_at FROM specs ORDER BY updated_at DESC"
        )
        val list = mutableListOf<SpecRecord>()
        while (rs.next()) {
            list.add(SpecRecord(
                id = rs.getInt("id"),
                name = rs.getString("name"),
                mode = rs.getString("mode"),
                spec = json.decodeFromString(rs.getString("spec_json")),
                version = rs.getInt("version"),
                createdAt = rs.getString("created_at"),
                updatedAt = rs.getString("updated_at")
            ))
        }
        rs.close()
        return list
    }

    fun getById(id: Int): SpecRecord {
        val stmt = conn.prepareStatement(
            "SELECT id, name, mode, spec_json, version, created_at, updated_at FROM specs WHERE id = ?"
        )
        stmt.setInt(1, id)
        val rs = stmt.executeQuery()
        if (!rs.next()) throw NoSuchElementException("Spec $id not found")
        val record = SpecRecord(
            id = rs.getInt("id"),
            name = rs.getString("name"),
            mode = rs.getString("mode"),
            spec = json.decodeFromString(rs.getString("spec_json")),
            version = rs.getInt("version"),
            createdAt = rs.getString("created_at"),
            updatedAt = rs.getString("updated_at")
        )
        rs.close()
        return record
    }

    fun create(name: String, mode: String, spec: GenerationSpec): SpecRecord {
        val specJson = json.encodeToString(GenerationSpec.serializer(), spec)
        val stmt = conn.prepareStatement(
            "INSERT INTO specs (name, mode, spec_json, version) VALUES (?, ?, ?, 1) RETURNING id, created_at, updated_at"
        )
        stmt.setString(1, name)
        stmt.setString(2, mode)
        stmt.setString(3, specJson)
        val rs = stmt.executeQuery()
        rs.next()
        val id = rs.getInt("id")
        val createdAt = rs.getString("created_at")
        rs.close()

        saveVersion(id, 1, specJson)

        return SpecRecord(id, name, mode, spec, 1, createdAt, createdAt)
    }

    fun update(id: Int, spec: GenerationSpec): SpecRecord {
        val current = getById(id)
        val newVersion = current.version + 1
        val specJson = json.encodeToString(GenerationSpec.serializer(), spec)

        val stmt = conn.prepareStatement(
            "UPDATE specs SET spec_json = ?, version = ?, updated_at = NOW() WHERE id = ?"
        )
        stmt.setString(1, specJson)
        stmt.setInt(2, newVersion)
        stmt.setInt(3, id)
        stmt.executeUpdate()

        saveVersion(id, newVersion, specJson)

        return getById(id)
    }

    fun delete(id: Int) {
        val stmt = conn.prepareStatement("DELETE FROM specs WHERE id = ?")
        stmt.setInt(1, id)
        stmt.executeUpdate()
    }

    fun getHistory(specId: Int): List<SpecVersionRecord> {
        val stmt = conn.prepareStatement(
            "SELECT id, spec_id, version, spec_json, created_at FROM spec_versions WHERE spec_id = ? ORDER BY version DESC"
        )
        stmt.setInt(1, specId)
        val rs = stmt.executeQuery()
        val list = mutableListOf<SpecVersionRecord>()
        while (rs.next()) {
            list.add(SpecVersionRecord(
                id = rs.getInt("id"),
                specId = rs.getInt("spec_id"),
                version = rs.getInt("version"),
                spec = json.decodeFromString(rs.getString("spec_json")),
                createdAt = rs.getString("created_at")
            ))
        }
        rs.close()
        return list
    }

    fun rollback(specId: Int, version: Int): SpecRecord {
        val stmt = conn.prepareStatement(
            "SELECT spec_json FROM spec_versions WHERE spec_id = ? AND version = ?"
        )
        stmt.setInt(1, specId)
        stmt.setInt(2, version)
        val rs = stmt.executeQuery()
        if (!rs.next()) throw NoSuchElementException("Version $version not found for spec $specId")
        val specJson = rs.getString("spec_json")
        rs.close()

        val spec = json.decodeFromString<GenerationSpec>(specJson)
        return update(specId, spec)
    }

    private fun saveVersion(specId: Int, version: Int, specJson: String) {
        val stmt = conn.prepareStatement(
            "INSERT INTO spec_versions (spec_id, version, spec_json) VALUES (?, ?, ?)"
        )
        stmt.setInt(1, specId)
        stmt.setInt(2, version)
        stmt.setString(3, specJson)
        stmt.executeUpdate()
    }
}
