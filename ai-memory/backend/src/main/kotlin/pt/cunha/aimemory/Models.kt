package pt.cunha.aimemory

import kotlinx.serialization.Serializable

@Serializable
data class Handoff(
    val id: Int = 0,
    val project: String,
    val context: String = "default",
    val content: String,
    val tool: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null
)

@Serializable
data class CreateHandoffRequest(
    val project: String,
    val context: String = "default",
    val content: String,
    val tool: String? = null
)

@Serializable
data class Decision(
    val id: Int = 0,
    val title: String,
    val description: String,
    val reasoning: String? = null,
    val alternatives: String? = null,
    val tags: String? = null,
    val project: String? = null,
    val mrLink: String? = null,
    val ticketLink: String? = null,
    val tool: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null
)

@Serializable
data class CreateDecisionRequest(
    val title: String,
    val description: String,
    val reasoning: String? = null,
    val alternatives: String? = null,
    val tags: String? = null,
    val project: String? = null,
    val mrLink: String? = null,
    val ticketLink: String? = null,
    val tool: String? = null
)

@Serializable
data class UpdateDecisionRequest(
    val title: String? = null,
    val description: String? = null,
    val reasoning: String? = null,
    val alternatives: String? = null,
    val tags: String? = null,
    val project: String? = null,
    val mrLink: String? = null,
    val ticketLink: String? = null
)
