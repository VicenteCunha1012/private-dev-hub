package pt.cunha.githistory

import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable

@Serializable
data class ConfigUpdate(val directories: List<String>? = null)

fun Routing.configRoutes(gitService: GitService) {
    get("/config") {
        call.respond(gitService.getConfig())
    }
    post("/config") {
        val update = call.receive<ConfigUpdate>()
        if (update.directories != null) {
            gitService.updateConfig(update.directories)
        }
        call.respond(gitService.getConfig())
    }
    get("/config/export") {
        call.respond(gitService.getConfig())
    }
    post("/config/import") {
        call.respond(HttpStatusCode.OK, mapOf("status" to "ok"))
    }
}

fun Routing.repoRoutes(gitService: GitService) {
    get("/repos") {
        call.respond(gitService.getRepos())
    }

    get("/repos/{repo}/branches") {
        val repoPath = call.parameters["repo"] ?: throw IllegalArgumentException("Missing repo")
        val decoded = java.net.URLDecoder.decode(repoPath, "UTF-8")
        call.respond(gitService.getBranches(decoded))
    }

    get("/repos/{repo}/commits") {
        val repoPath = java.net.URLDecoder.decode(call.parameters["repo"]!!, "UTF-8")
        val branch = call.request.queryParameters["branch"] ?: "HEAD"
        val limit = call.request.queryParameters["limit"]?.toIntOrNull() ?: 50
        val offset = call.request.queryParameters["offset"]?.toIntOrNull() ?: 0
        call.respond(gitService.getCommits(repoPath, branch, limit, offset))
    }

    get("/repos/{repo}/commits/{hash}") {
        val repoPath = java.net.URLDecoder.decode(call.parameters["repo"]!!, "UTF-8")
        val hash = call.parameters["hash"]!!
        call.respond(gitService.getCommitDetail(repoPath, hash))
    }

    get("/repos/{repo}/tree") {
        val repoPath = java.net.URLDecoder.decode(call.parameters["repo"]!!, "UTF-8")
        val ref = call.request.queryParameters["ref"] ?: "HEAD"
        val path = call.request.queryParameters["path"] ?: ""
        call.respond(gitService.getTree(repoPath, ref, path))
    }

    get("/repos/{repo}/file") {
        val repoPath = java.net.URLDecoder.decode(call.parameters["repo"]!!, "UTF-8")
        val path = call.request.queryParameters["path"] ?: throw IllegalArgumentException("Missing path")
        val ref = call.request.queryParameters["ref"] ?: "HEAD"
        call.respond(gitService.getFileContent(repoPath, path, ref))
    }

    get("/repos/{repo}/file/history") {
        val repoPath = java.net.URLDecoder.decode(call.parameters["repo"]!!, "UTF-8")
        val path = call.request.queryParameters["path"] ?: throw IllegalArgumentException("Missing path")
        val branch = call.request.queryParameters["branch"] ?: "HEAD"
        val limit = call.request.queryParameters["limit"]?.toIntOrNull() ?: 50
        call.respond(gitService.getFileHistory(repoPath, path, branch, limit))
    }

    get("/repos/{repo}/blame") {
        val repoPath = java.net.URLDecoder.decode(call.parameters["repo"]!!, "UTF-8")
        val path = call.request.queryParameters["path"] ?: throw IllegalArgumentException("Missing path")
        val start = call.request.queryParameters["start"]?.toIntOrNull() ?: 1
        val end = call.request.queryParameters["end"]?.toIntOrNull() ?: start
        val ref = call.request.queryParameters["ref"] ?: "HEAD"
        call.respond(gitService.getBlame(repoPath, path, start, end, ref))
    }

    get("/repos/{repo}/line-history") {
        val repoPath = java.net.URLDecoder.decode(call.parameters["repo"]!!, "UTF-8")
        val path = call.request.queryParameters["path"] ?: throw IllegalArgumentException("Missing path")
        val start = call.request.queryParameters["start"]?.toIntOrNull() ?: throw IllegalArgumentException("Missing start")
        val end = call.request.queryParameters["end"]?.toIntOrNull() ?: start
        val limit = call.request.queryParameters["limit"]?.toIntOrNull()
        call.respond(gitService.getLineHistory(repoPath, path, start, end, limit))
    }
}
