package pt.cunha.mockgen

import io.ktor.server.application.*
import io.ktor.server.routing.*
import pt.cunha.core.configDbRoutes
import pt.cunha.core.healthRoutes
import pt.cunha.core.installStandardPlugins
import pt.cunha.mockgen.ai.GroqProvider
import pt.cunha.mockgen.routes.configRoutes
import pt.cunha.mockgen.routes.generateRoutes
import pt.cunha.mockgen.routes.specRoutes
import pt.cunha.mockgen.services.GeneratorService
import pt.cunha.mockgen.services.ScriptGenerator
import pt.cunha.mockgen.services.SpecService

fun Application.module() {
    val db = Database(environment.config)
    db.init()

    val configService = ConfigService(db.connection)
    val specService = SpecService(db.connection)
    val localeProvider = { configService.get("faker_locale") ?: "en_US" }
    val generatorService = GeneratorService(localeProvider)
    val scriptGenerator = ScriptGenerator()

    val groqProvider = GroqProvider(
        apiKeyProvider = { configService.get("groq_api_key") ?: "" },
        modelProvider = { configService.get("groq_model") ?: "llama-3.3-70b-versatile" }
    )

    installStandardPlugins()

    routing {
        healthRoutes()
        configDbRoutes(configService)
        configRoutes(configService)
        specRoutes(specService, groqProvider)
        generateRoutes(specService, generatorService, scriptGenerator, localeProvider)
    }
}
