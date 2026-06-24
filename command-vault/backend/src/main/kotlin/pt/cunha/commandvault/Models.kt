package pt.cunha.commandvault

import kotlinx.serialization.Serializable

@Serializable
data class Snippet(
    val id: Int,
    val title: String,
    val command: String,
    val description: String? = null,
    val tags: String? = null,
    val createdAt: String,
    val updatedAt: String
)

@Serializable
data class CreateSnippetRequest(
    val title: String,
    val command: String,
    val description: String? = null,
    val tags: String? = null
)

@Serializable
data class UpdateSnippetRequest(
    val title: String? = null,
    val command: String? = null,
    val description: String? = null,
    val tags: String? = null
)

@Serializable
data class Flow(
    val id: Int,
    val name: String,
    val graphJson: String,
    val createdAt: String,
    val updatedAt: String
)

@Serializable
data class CreateFlowRequest(
    val name: String,
    val graphJson: String? = null
)

@Serializable
data class UpdateFlowRequest(
    val name: String? = null,
    val graphJson: String? = null
)

@Serializable
data class VaultConfig(
    val pgDumpPath: String,
    val psqlPath: String,
    val pgRestorePath: String
)

@Serializable
data class UpdateConfigRequest(
    val pgDumpPath: String? = null,
    val psqlPath: String? = null,
    val pgRestorePath: String? = null
)
