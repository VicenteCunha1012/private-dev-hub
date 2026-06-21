package pt.cunha.hub.models

import kotlinx.serialization.Serializable

@Serializable
data class Folder(
    val id: Int,
    val name: String,
    val position: Int
)

@Serializable
data class FolderWithEntries(
    val id: Int,
    val name: String,
    val position: Int,
    val entries: List<Entry>
)

@Serializable
data class CreateFolderRequest(val name: String)

@Serializable
data class UpdateFolderRequest(val name: String? = null, val position: Int? = null)

@Serializable
data class Entry(
    val id: Int,
    val label: String,
    val url: String? = null,
    val type: String,
    val folderId: Int? = null,
    val position: Int,
    val workdir: String? = null,
    val command: String? = null
)

@Serializable
data class CreateEntryRequest(
    val label: String,
    val url: String? = null,
    val type: String,
    val folderId: Int? = null,
    val position: Int = 0,
    val workdir: String? = null,
    val command: String? = null
)

@Serializable
data class UpdateEntryRequest(
    val label: String? = null,
    val url: String? = null,
    val type: String? = null,
    val folderId: Int? = null,
    val position: Int? = null,
    val workdir: String? = null,
    val command: String? = null
)

@Serializable
data class SetIconUrlRequest(val url: String)

@Serializable
data class EntryShortcut(
    val entryId: Int,
    val shortcut: String
)

@Serializable
data class KeybindsConfig(
    val goHome: String = "Escape",
    val focusSearch: String = "/",
    val navUp: String = "ArrowUp",
    val navDown: String = "ArrowDown",
    val openSettings: String = ",",
    val entryShortcuts: List<EntryShortcut> = emptyList()
)

@Serializable
data class PaletteConfig(
    val preset: String = "midnight",
    val customAccent: String? = null,
    val customAccent2: String? = null,
    val customBg: String? = null
)

@Serializable
data class HubConfig(
    val pgDumpPath: String,
    val psqlPath: String,
    val pgRestorePath: String,
    val keybinds: KeybindsConfig = KeybindsConfig(),
    val palette: PaletteConfig = PaletteConfig()
)

@Serializable
data class UpdateConfigRequest(
    val pgDumpPath: String? = null,
    val psqlPath: String? = null,
    val pgRestorePath: String? = null,
    val keybinds: KeybindsConfig? = null,
    val palette: PaletteConfig? = null
)

@Serializable
data class ExportedConfig(
    val version: String = "1.0",
    val exportedAt: String,
    val config: HubConfig,
    val folders: List<FolderWithEntries>
)
