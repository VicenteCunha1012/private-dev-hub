package pt.cunha.mockgen.models

import kotlinx.serialization.Serializable

@Serializable
data class FieldSpec(
    val name: String,
    val type: String = "string",
    val source: String = "faker-provider",
    val fakerProvider: String? = null,
    val fakerLocale: String? = null,
    val pattern: String? = null,
    val template: String? = null,
    val enumValues: List<String>? = null,
    val enumWeights: List<Double>? = null,
    val rangeMin: Double? = null,
    val rangeMax: Double? = null,
    val constant: String? = null,
    val nullable: Boolean = false,
    val nullRate: Double = 0.0,
    val unique: Boolean = false,
    val isKey: Boolean = false,
    val conditionalOn: String? = null,
    val conditionalValue: String? = null,
    val correlatedWith: String? = null,
    val correlationType: String? = null,
    val referenceEntity: String? = null,
    val referenceField: String? = null,
    val maxLength: Int? = null,
    val minLength: Int? = null,
    val children: List<FieldSpec>? = null
)

@Serializable
data class EntitySpec(
    val name: String,
    val fields: List<FieldSpec>
)

@Serializable
data class GenerationSpec(
    val entities: List<EntitySpec>,
    val mode: String = "kafka",
    val apiBaseUrl: String? = null,
    val apiEndpoints: List<ApiEndpoint>? = null
)

@Serializable
data class ApiEndpoint(
    val method: String = "POST",
    val path: String,
    val entityName: String,
    val headers: Map<String, String>? = null
)

@Serializable
data class SpecRecord(
    val id: Int,
    val name: String,
    val mode: String,
    val spec: GenerationSpec,
    val version: Int,
    val createdAt: String,
    val updatedAt: String
)

@Serializable
data class SpecVersionRecord(
    val id: Int,
    val specId: Int,
    val version: Int,
    val spec: GenerationSpec,
    val createdAt: String
)

@Serializable
data class InferRequest(
    val name: String,
    val mode: String = "kafka",
    val samples: List<String>,
    val schema: String? = null,
    val schemaType: String? = null
)

@Serializable
data class GenerateRequest(
    val specId: Int,
    val count: Int = 10,
    val profile: String = "valid",
    val seed: Long? = null,
    val entityName: String? = null
)

@Serializable
data class GenerateResponse(
    val records: List<String>,
    val profile: String,
    val count: Int,
    val entityName: String
)
