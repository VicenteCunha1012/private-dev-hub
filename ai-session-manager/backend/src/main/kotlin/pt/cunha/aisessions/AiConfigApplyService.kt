package pt.cunha.aisessions

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*
import java.io.File
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.time.Duration
import java.util.concurrent.TimeUnit

@Serializable
data class ApplyConfigStatus(
    val aiConfigPath: String,
    val isValidRepo: Boolean,
    val gitStatus: String,
    val lastCommit: String?,
    val files: List<ApplyConfigFileEntry>
)

@Serializable
data class ApplyConfigFileEntry(val path: String, val size: Long)

@Serializable
data class ApplyConfigResult(
    val success: Boolean,
    val output: String,
    val changed: List<String> = emptyList()
)

class AiConfigApplyService(
    private val aiConfigPath: String,
    private val claudeDir: String,
    private val openCodeConfigDir: String,
    private val homeMcpJson: String,
    private val rtkConfigDir: String
) {
    private val aiConfigDir get() = File(aiConfigPath)

    fun getStatus(): ApplyConfigStatus {
        val valid = aiConfigDir.exists() && File(aiConfigDir, ".git").exists()
        val gitStatus = if (valid) runGit("status", "--short").trim() else "Not a git repository"
        val lastCommit = if (valid) runGit("log", "-1", "--format=%h %s (%ar)").trim().ifEmpty { null } else null
        val files = if (valid) listRepoFiles() else emptyList()
        return ApplyConfigStatus(aiConfigPath, valid, gitStatus, lastCommit, files)
    }

    fun sync(): ApplyConfigResult {
        val log = StringBuilder("=== Sync: system → repo ===\n")
        val changed = mutableListOf<String>()
        return try {
            // Claude Code dirs
            for (dir in listOf("commands", "skills", "hooks")) {
                val src = File(claudeDir, dir)
                if (src.exists()) copyDir(src, File(aiConfigPath, "claude/$dir"), log, changed)
            }
            copyFile(File(claudeDir, "CLAUDE.md"), File(aiConfigPath, "claude/CLAUDE.md"), log, changed)
            copyFile(File(claudeDir, "RTK.md"), File(aiConfigPath, "claude/RTK.md"), log, changed)
            copyFile(File(claudeDir, "settings.json"), File(aiConfigPath, "claude/settings.json"), log, changed)
            extractMcpServers(log, changed)

            // OpenCode
            copyFile(File(openCodeConfigDir, "opencode.json"), File(aiConfigPath, "opencode/opencode.json"), log, changed)
            copyFile(File(openCodeConfigDir, "AGENTS.md"), File(aiConfigPath, "opencode/AGENTS.md"), log, changed)
            val ocPlugins = File(openCodeConfigDir, "plugins")
            if (ocPlugins.exists()) copyDir(ocPlugins, File(aiConfigPath, "opencode/plugins"), log, changed)

            // RTK
            copyFile(File(rtkConfigDir, "filters.toml"), File(aiConfigPath, "rtk/filters.toml"), log, changed)

            log.appendLine("\nDone. ${changed.size} file(s) updated.")
            ApplyConfigResult(true, log.toString(), changed)
        } catch (e: Exception) {
            log.appendLine("ERROR: ${e.message}")
            ApplyConfigResult(false, log.toString(), changed)
        }
    }

    fun apply(): ApplyConfigResult {
        val log = StringBuilder("=== Apply: repo → system ===\n")
        val changed = mutableListOf<String>()
        return try {
            // Claude Code dirs
            for (dir in listOf("commands", "skills", "hooks")) {
                val src = File(aiConfigPath, "claude/$dir")
                if (src.exists()) {
                    val dst = File(claudeDir, dir)
                    dst.mkdirs()
                    copyDir(src, dst, log, changed)
                }
            }
            copyFile(File(aiConfigPath, "claude/CLAUDE.md"), File(claudeDir, "CLAUDE.md"), log, changed)
            copyFile(File(aiConfigPath, "claude/RTK.md"), File(claudeDir, "RTK.md"), log, changed)
            copyFile(File(aiConfigPath, "claude/settings.json"), File(claudeDir, "settings.json"), log, changed)
            mergeMcpServers(log, changed)

            // OpenCode
            File(openCodeConfigDir).mkdirs()
            File(openCodeConfigDir, "plugins").mkdirs()
            copyFile(File(aiConfigPath, "opencode/opencode.json"), File(openCodeConfigDir, "opencode.json"), log, changed)
            copyFile(File(aiConfigPath, "opencode/AGENTS.md"), File(openCodeConfigDir, "AGENTS.md"), log, changed)
            val ocPluginsSrc = File(aiConfigPath, "opencode/plugins")
            if (ocPluginsSrc.exists()) copyDir(ocPluginsSrc, File(openCodeConfigDir, "plugins"), log, changed)

            // Symlink: opencode/command → claude/commands
            // Note: skipped in container — absolute path would differ on host.
            // Run restore-ai-config.sh on host to recreate the symlink if needed.
            log.appendLine("  [skipped] symlink opencode/command → claude/commands (run restore-ai-config.sh on host to recreate)")

            // RTK
            File(rtkConfigDir).mkdirs()
            copyFile(File(aiConfigPath, "rtk/filters.toml"), File(rtkConfigDir, "filters.toml"), log, changed)

            log.appendLine("\nDone. ${changed.size} file(s) updated.")
            ApplyConfigResult(true, log.toString(), changed)
        } catch (e: Exception) {
            log.appendLine("ERROR: ${e.message}")
            ApplyConfigResult(false, log.toString(), changed)
        }
    }

    fun pull(): ApplyConfigResult {
        return try {
            val out = runGit("pull", "--ff-only")
            ApplyConfigResult(true, "=== Git Pull ===\n$out")
        } catch (e: Exception) {
            ApplyConfigResult(false, "=== Git Pull ===\n${e.message}")
        }
    }

    fun push(message: String? = null): ApplyConfigResult {
        val log = StringBuilder()
        return try {
            val syncResult = sync()
            log.append(syncResult.output)
            if (!syncResult.success) return ApplyConfigResult(false, log.toString(), syncResult.changed)

            log.appendLine("\n=== Git Commit + Push ===")
            runGit("add", "-A")

            val msg = message ?: java.time.LocalDateTime.now().toString().substring(0, 19)
            val commitOut = try {
                runGitWithIdent("commit", "-m", msg)
            } catch (e: Exception) {
                val msg2 = e.message ?: ""
                if (msg2.contains("nothing to commit") || msg2.contains("nothing added")) {
                    log.appendLine("Nothing to commit.")
                    return ApplyConfigResult(true, log.toString(), syncResult.changed)
                }
                throw e
            }
            log.append(commitOut)

            val pushOut = runGit("push")
            log.append(pushOut)
            log.appendLine("\nPushed successfully.")
            ApplyConfigResult(true, log.toString(), syncResult.changed)
        } catch (e: Exception) {
            log.appendLine("ERROR: ${e.message}")
            ApplyConfigResult(false, log.toString())
        }
    }

    fun hostSetup(ttydManagerUrl: String = "http://host.docker.internal:10600"): ApplyConfigResult {
        val command = "ln -sfn \"\$HOME/.claude/commands\" \"\$HOME/.config/opencode/command\" && echo \"symlink created: \$HOME/.config/opencode/command -> \$HOME/.claude/commands\""
        return try {
            val body = """{"command":${Json.encodeToString(command)},"timeoutSeconds":10}"""
            val client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build()
            val req = HttpRequest.newBuilder()
                .uri(URI.create("$ttydManagerUrl/exec"))
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .header("Content-Type", "application/json")
                .build()
            val resp = client.send(req, HttpResponse.BodyHandlers.ofString())
            val respJson = Json.parseToJsonElement(resp.body()) as? JsonObject
            val exitCode = respJson?.get("exitCode")?.toString()?.toIntOrNull() ?: -1
            val stdout = respJson?.get("stdout")?.toString()?.trim('"') ?: ""
            val stderr = respJson?.get("stderr")?.toString()?.trim('"') ?: ""
            val out = buildString {
                if (stdout.isNotBlank()) appendLine(stdout)
                if (stderr.isNotBlank()) appendLine("stderr: $stderr")
            }
            if (exitCode == 0) ApplyConfigResult(true, out.ifBlank { "Symlink created." })
            else ApplyConfigResult(false, "Exit $exitCode\n$out")
        } catch (e: Exception) {
            ApplyConfigResult(false, "Could not reach ttyd-manager: ${e.message}")
        }
    }

    fun getFileContent(relativePath: String): String? {
        val file = File(aiConfigPath, relativePath)
        if (!file.canonicalPath.startsWith(aiConfigDir.canonicalPath)) return null
        if (!file.exists() || !file.isFile) return null
        return try { file.readText() } catch (e: Exception) { null }
    }

    // --- helpers ---

    private fun listRepoFiles(): List<ApplyConfigFileEntry> =
        aiConfigDir.walk()
            .filter { it.isFile && !it.path.contains("/.git/") && !it.path.contains("/.idea/") && !it.path.endsWith("package-lock.json") }
            .map { ApplyConfigFileEntry(it.relativeTo(aiConfigDir).path, it.length()) }
            .sortedBy { it.path }
            .toList()

    private fun copyFile(src: File, dst: File, log: StringBuilder, changed: MutableList<String>): Boolean {
        if (!src.exists()) return false
        dst.parentFile?.mkdirs()
        val before = if (dst.exists()) dst.readBytes().contentHashCode() else 0
        Files.copy(src.toPath(), dst.toPath(), StandardCopyOption.REPLACE_EXISTING)
        val after = dst.readBytes().contentHashCode()
        if (before != after) {
            changed.add(dst.absolutePath)
            log.appendLine("  updated: ${src.name}")
        }
        return true
    }

    private fun copyDir(src: File, dst: File, log: StringBuilder, changed: MutableList<String>) {
        dst.mkdirs()
        src.walkTopDown().filter { it.isFile }.forEach { file ->
            val rel = file.relativeTo(src)
            copyFile(file, File(dst, rel.path), log, changed)
        }
    }

    private fun extractMcpServers(log: StringBuilder, changed: MutableList<String>) {
        val srcFile = File(homeMcpJson)
        if (!srcFile.exists()) return
        try {
            val root = Json.parseToJsonElement(srcFile.readText()) as? JsonObject ?: return
            val mcpServers = root["mcpServers"] ?: return
            val out = buildJsonObject {
                put("mcpServers", mcpServers)
                val projects = root["projects"] as? JsonObject
                if (projects != null) {
                    val filtered = projects.entries.filter { (_, v) ->
                        (v as? JsonObject)?.containsKey("mcpServers") == true
                    }
                    if (filtered.isNotEmpty()) {
                        put("projects", buildJsonObject {
                            filtered.forEach { (k, v) ->
                                put(k, buildJsonObject {
                                    put("mcpServers", (v as JsonObject)["mcpServers"]!!)
                                })
                            }
                        })
                    }
                }
            }
            val dst = File(aiConfigPath, "claude/mcpServers.json")
            dst.parentFile?.mkdirs()
            val serialized = Json { prettyPrint = true }.encodeToString(JsonObject.serializer(), out)
            val before = if (dst.exists()) dst.readText() else ""
            dst.writeText(serialized)
            if (before != serialized) {
                changed.add(dst.absolutePath)
                log.appendLine("  updated: mcpServers.json")
            }
        } catch (e: Exception) {
            log.appendLine("  warning: could not extract mcpServers: ${e.message}")
        }
    }

    private fun mergeMcpServers(log: StringBuilder, changed: MutableList<String>) {
        val srcFile = File(aiConfigPath, "claude/mcpServers.json")
        val dstFile = File(homeMcpJson)
        if (!srcFile.exists()) return
        try {
            val src = Json.parseToJsonElement(srcFile.readText()) as? JsonObject ?: return
            val existing = if (dstFile.exists()) {
                try { (Json.parseToJsonElement(dstFile.readText()) as? JsonObject)?.toMutableMap() ?: mutableMapOf() }
                catch (e: Exception) { mutableMapOf() }
            } else mutableMapOf()

            src["mcpServers"]?.let { existing["mcpServers"] = it }

            val srcProjects = src["projects"] as? JsonObject
            if (srcProjects != null) {
                val existingProjects = (existing["projects"] as? JsonObject)?.toMutableMap() ?: mutableMapOf()
                for ((k, v) in srcProjects) {
                    val proj = (existingProjects[k] as? JsonObject)?.toMutableMap() ?: mutableMapOf()
                    (v as? JsonObject)?.get("mcpServers")?.let { proj["mcpServers"] = it }
                    existingProjects[k] = JsonObject(proj)
                }
                existing["projects"] = JsonObject(existingProjects)
            }

            val out = Json { prettyPrint = true }.encodeToString(JsonObject.serializer(), JsonObject(existing))
            dstFile.parentFile?.mkdirs()
            val before = if (dstFile.exists()) dstFile.readText() else ""
            dstFile.writeText(out)
            if (before != out) {
                changed.add(dstFile.absolutePath)
                log.appendLine("  merged: mcpServers into ${dstFile.name}")
            }
        } catch (e: Exception) {
            log.appendLine("  warning: could not merge mcpServers: ${e.message}")
        }
    }

    private fun runGitWithIdent(vararg args: String): String {
        val name = try { runGit("config", "user.name") } catch (e: Exception) { "Dev Hub" }
        val email = try { runGit("config", "user.email") } catch (e: Exception) { "devhub@localhost" }
        return runGit(
            "-c", "user.name=${name.trim()}",
            "-c", "user.email=${email.trim()}",
            *args
        )
    }

    private fun runGit(vararg args: String): String {
        val credHelper = "store --file=$aiConfigPath/.git/.credentials"
        val cmd = listOf("git",
            "-c", "safe.directory=$aiConfigPath",
            "-c", "credential.helper=$credHelper",
            "-C", aiConfigPath
        ) + args.toList()
        val proc = ProcessBuilder(cmd).redirectErrorStream(true).start()
        val out = proc.inputStream.bufferedReader().readText()
        val exited = proc.waitFor(60, TimeUnit.SECONDS)
        if (!exited) { proc.destroyForcibly(); throw RuntimeException("git timed out") }
        if (proc.exitValue() != 0) throw RuntimeException(out.trim())
        return out
    }
}
