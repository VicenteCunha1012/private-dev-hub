package pt.cunha.mockgen.ai

import pt.cunha.mockgen.models.GenerationSpec

interface AiProvider {
    suspend fun inferSpec(
        samples: List<String>,
        schema: String?,
        schemaType: String?,
        mode: String
    ): GenerationSpec
}
