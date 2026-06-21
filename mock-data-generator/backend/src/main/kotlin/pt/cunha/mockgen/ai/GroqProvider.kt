package pt.cunha.mockgen.ai

import io.ktor.client.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.json.*
import pt.cunha.mockgen.models.GenerationSpec

class GroqProvider(
    private val apiKeyProvider: () -> String,
    private val modelProvider: () -> String
) : AiProvider {

    private val client = HttpClient(CIO) {
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) }
        engine { requestTimeout = 120_000 }
    }

    private val json = Json { ignoreUnknownKeys = true; prettyPrint = false }

    override suspend fun inferSpec(
        samples: List<String>,
        schema: String?,
        schemaType: String?,
        mode: String
    ): GenerationSpec {
        val apiKey = apiKeyProvider()
        val model = modelProvider()
        if (apiKey.isBlank()) throw IllegalStateException("Groq API key not configured")

        val systemPrompt = buildSystemPrompt(mode)
        val userPrompt = buildUserPrompt(samples, schema, schemaType, mode)

        val requestBody = buildJsonObject {
            put("model", model)
            putJsonArray("messages") {
                addJsonObject {
                    put("role", "system")
                    put("content", systemPrompt)
                }
                addJsonObject {
                    put("role", "user")
                    put("content", userPrompt)
                }
            }
            put("temperature", 0.1)
            put("max_tokens", 8192)
            putJsonObject("response_format") { put("type", "json_object") }
        }

        val response = client.post("https://api.groq.com/openai/v1/chat/completions") {
            header("Authorization", "Bearer $apiKey")
            contentType(ContentType.Application.Json)
            setBody(requestBody.toString())
        }

        val body = response.bodyAsText()
        if (response.status != HttpStatusCode.OK) {
            throw RuntimeException("Groq API error ${response.status}: $body")
        }

        val parsed = json.parseToJsonElement(body).jsonObject
        val content = parsed["choices"]!!.jsonArray[0].jsonObject["message"]!!.jsonObject["content"]!!.jsonPrimitive.content

        return json.decodeFromString<GenerationSpec>(content)
    }

    private fun buildSystemPrompt(mode: String): String = """
You are a mock data specification generator. You analyze JSON samples (and optionally an API schema) and produce a structured generation spec.

Output ONLY valid JSON matching this exact structure:
{
  "entities": [
    {
      "name": "entity_name",
      "fields": [
        {
          "name": "field_name",
          "type": "string|integer|number|boolean|array|object",
          "source": "enum-from-samples|regex-template|range|faker-provider|constant|reference-to-other-field",
          "fakerProvider": "optional faker provider name (e.g. uuid4, name, email, company, address, date_time_this_decade, random_int, sentence, url, phone_number, etc.)",
          "pattern": "optional regex pattern observed",
          "template": "optional string template like PREFIX-{###}",
          "enumValues": ["optional", "observed", "enum", "values"],
          "enumWeights": [0.5, 0.3, 0.15, 0.05],
          "rangeMin": null,
          "rangeMax": null,
          "constant": null,
          "nullable": false,
          "nullRate": 0.0,
          "unique": false,
          "isKey": false,
          "conditionalOn": "optional field name this depends on",
          "conditionalValue": "value the other field must have",
          "correlatedWith": "optional field name for correlation",
          "correlationType": "greater_than|subset_of|same_entity",
          "referenceEntity": "optional entity name for foreign key",
          "referenceField": "optional field name in referenced entity",
          "maxLength": null,
          "minLength": null,
          "children": null
        }
      ]
    }
  ],
  "mode": "$mode"${if (mode == "api") """,
  "apiBaseUrl": "inferred base URL",
  "apiEndpoints": [{"method": "POST", "path": "/endpoint", "entityName": "entity_name"}]""" else ""}
}

Rules:
- Analyze ALL sample values per field to infer the source type accurately
- For IDs/UUIDs: use faker-provider with uuid4, set unique=true, isKey=true
- For dates: use faker-provider with appropriate provider, detect correlations (updatedAt > createdAt)
- For enums: list ALL observed values with their frequency weights
- For references (foreign keys): set source=reference-to-other-field with referenceEntity and referenceField
- For nested objects: set type=object with children array containing sub-field specs
- For arrays: set type=array with children containing the element spec
- Detect null rates from samples (count nulls / total samples)
- Detect patterns (regex) for structured strings like codes, phone numbers, etc.
- If a field appears conditionally (only when another field has a certain value), set conditionalOn/conditionalValue
    """.trimIndent()

    private fun buildUserPrompt(samples: List<String>, schema: String?, schemaType: String?, mode: String): String {
        val sb = StringBuilder()
        sb.appendLine("Analyze these JSON samples and produce a generation spec:")
        sb.appendLine()
        samples.forEachIndexed { i, s ->
            sb.appendLine("--- Sample ${i + 1} ---")
            sb.appendLine(s.take(4000))
            sb.appendLine()
        }
        if (schema != null) {
            sb.appendLine("--- Schema ($schemaType) ---")
            sb.appendLine(schema.take(6000))
            sb.appendLine()
            sb.appendLine("The schema defines the structure. Use it for field types, required/optional, enums, and constraints. The samples refine the semantic meaning of each field.")
        }
        if (mode == "api") {
            sb.appendLine("Mode: API — infer the API base URL and endpoints from the schema. Include apiBaseUrl and apiEndpoints in the output.")
        } else {
            sb.appendLine("Mode: Kafka — no API endpoints needed, just the entity spec for message generation.")
        }
        return sb.toString()
    }
}
