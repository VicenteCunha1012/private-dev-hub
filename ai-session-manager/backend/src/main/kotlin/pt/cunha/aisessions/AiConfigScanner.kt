package pt.cunha.aisessions

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.*
import java.io.File

@Serializable
data class ConfigItem(
    val name: String,
    val source: String,
    val tool: String,
    val category: String,
    val filePath: String,
    val content: String? = null
)

@Serializable
data class SyncStatus(
    val claudeCode: Boolean,
    val openCode: Boolean
)

@Serializable
data class ConfigCategory(
    val name: String,
    val items: List<ConfigItem>,
    val sync: SyncStatus
)

@Serializable
data class AiConfigResult(
    val categories: List<ConfigCategory>,
    val scanPaths: Map<String, String>
)

class AiConfigScanner(
    private val claudeDir: String,
    private val openCodeDir: String,
    private val homeMcpJson: String
) {
    private val json = Json { ignoreUnknownKeys = true; prettyPrint = false }

    fun scan(): AiConfigResult {
        val items = mutableListOf<ConfigItem>()

        scanClaudeCommands(items)
        scanClaudeSkills(items)
        scanClaudeMcps(items)
        scanClaudeRules(items)
        scanClaudeAgents(items)
        scanOpenCodeMcps(items)
        scanOpenCodeAgents(items)
        scanOpenCodePlugins(items)

        val grouped = items.groupBy { it.category }

        val categories = listOf("Commands", "Skills", "MCPs", "Rules", "Agents", "Plugins").mapNotNull { cat ->
            val catItems = grouped[cat] ?: return@mapNotNull null
            val hasCC = catItems.any { it.tool == "claude-code" }
            val hasOC = catItems.any { it.tool == "opencode" }
            ConfigCategory(cat, catItems, SyncStatus(hasCC, hasOC))
        }

        return AiConfigResult(
            categories = categories,
            scanPaths = mapOf(
                "claudeDir" to claudeDir,
                "openCodeDir" to openCodeDir,
                "homeMcpJson" to homeMcpJson
            )
        )
    }

    fun readFile(path: String): String? {
        val allowed = listOf(claudeDir, openCodeDir, homeMcpJson)
        if (allowed.none { path.startsWith(it) || path == it }) return null
        val file = File(path)
        return if (file.exists() && file.isFile) file.readText() else null
    }

    private fun scanClaudeCommands(items: MutableList<ConfigItem>) {
        val dir = File(claudeDir, "commands")
        if (!dir.isDirectory) return
        dir.listFiles()?.filter { it.extension == "md" }?.forEach { f ->
            items.add(ConfigItem(
                name = f.nameWithoutExtension,
                source = "global",
                tool = "claude-code",
                category = "Commands",
                filePath = f.absolutePath,
                content = f.readText().take(500)
            ))
        }
    }

    private fun scanClaudeSkills(items: MutableList<ConfigItem>) {
        val dir = File(claudeDir, "skills")
        if (!dir.isDirectory) return
        dir.walk().filter { it.isFile && it.extension == "md" }.forEach { f ->
            items.add(ConfigItem(
                name = f.nameWithoutExtension,
                source = "global",
                tool = "claude-code",
                category = "Skills",
                filePath = f.absolutePath,
                content = f.readText().take(500)
            ))
        }
    }

    private fun scanClaudeMcps(items: MutableList<ConfigItem>) {
        val mcpFile = File(homeMcpJson)
        if (!mcpFile.exists()) return
        try {
            val root = json.parseToJsonElement(mcpFile.readText()).jsonObject
            val servers = root["mcpServers"]?.jsonObject ?: return
            servers.forEach { (name, config) ->
                items.add(ConfigItem(
                    name = name,
                    source = "~/.claude.json",
                    tool = "claude-code",
                    category = "MCPs",
                    filePath = mcpFile.absolutePath,
                    content = json.encodeToString(JsonElement.serializer(), config).take(500)
                ))
            }
        } catch (_: Exception) {}
    }

    private fun scanClaudeRules(items: MutableList<ConfigItem>) {
        val claudeMd = File(claudeDir, "CLAUDE.md")
        if (claudeMd.exists()) {
            items.add(ConfigItem(
                name = "CLAUDE.md (global)",
                source = "global",
                tool = "claude-code",
                category = "Rules",
                filePath = claudeMd.absolutePath,
                content = claudeMd.readText().take(500)
            ))
        }
        val rtk = File(claudeDir, "RTK.md")
        if (rtk.exists()) {
            items.add(ConfigItem(
                name = "RTK.md",
                source = "global",
                tool = "claude-code",
                category = "Rules",
                filePath = rtk.absolutePath,
                content = rtk.readText().take(500)
            ))
        }
    }

    private fun scanClaudeAgents(items: MutableList<ConfigItem>) {
        // Check project-level AGENTS.md files
        val projectsDir = File(claudeDir, "projects")
        if (!projectsDir.isDirectory) return
        projectsDir.listFiles()?.forEach { projDir ->
            if (!projDir.isDirectory) return@forEach
            val agentsMd = File(projDir, "AGENTS.md")
            // Not present, skip
            if (!agentsMd.exists()) return@forEach
        }
    }

    private fun scanOpenCodeMcps(items: MutableList<ConfigItem>) {
        val configFile = File(openCodeDir, "opencode.json")
        if (!configFile.exists()) return
        try {
            val root = json.parseToJsonElement(configFile.readText()).jsonObject
            val mcps = root["mcp"]?.jsonObject ?: return
            mcps.forEach { (name, config) ->
                items.add(ConfigItem(
                    name = name,
                    source = "opencode.json",
                    tool = "opencode",
                    category = "MCPs",
                    filePath = configFile.absolutePath,
                    content = json.encodeToString(JsonElement.serializer(), config).take(500)
                ))
            }
        } catch (_: Exception) {}
    }

    private fun scanOpenCodeAgents(items: MutableList<ConfigItem>) {
        val agentsMd = File(openCodeDir, "AGENTS.md")
        if (agentsMd.exists()) {
            items.add(ConfigItem(
                name = "AGENTS.md",
                source = "global",
                tool = "opencode",
                category = "Agents",
                filePath = agentsMd.absolutePath,
                content = agentsMd.readText().take(500)
            ))
        }
    }

    private fun scanOpenCodePlugins(items: MutableList<ConfigItem>) {
        val pluginsDir = File(openCodeDir, "plugins")
        if (!pluginsDir.isDirectory) return
        pluginsDir.walk().filter { it.isFile }.forEach { f ->
            items.add(ConfigItem(
                name = f.nameWithoutExtension,
                source = "plugins/",
                tool = "opencode",
                category = "Plugins",
                filePath = f.absolutePath,
                content = f.readText().take(500)
            ))
        }
    }
}
