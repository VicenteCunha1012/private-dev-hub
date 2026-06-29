package pt.cunha.githistory

import kotlinx.serialization.Serializable
import java.io.File

@Serializable
data class RepoInfo(val name: String, val path: String)

@Serializable
data class BranchInfo(val name: String, val current: Boolean)

@Serializable
data class CommitInfo(
    val hash: String,
    val shortHash: String,
    val message: String,
    val author: String,
    val authorEmail: String,
    val date: String,
    val relativeDate: String
)

@Serializable
data class CommitDetail(
    val hash: String,
    val shortHash: String,
    val message: String,
    val author: String,
    val authorEmail: String,
    val date: String,
    val files: List<DiffFile>
)

@Serializable
data class DiffFile(
    val path: String,
    val status: String,
    val hunks: List<DiffHunk>
)

@Serializable
data class DiffHunk(
    val header: String,
    val lines: List<DiffLine>
)

@Serializable
data class DiffLine(
    val type: String, // "add", "remove", "context"
    val content: String,
    val oldLineNum: Int? = null,
    val newLineNum: Int? = null
)

@Serializable
data class TreeEntry(
    val name: String,
    val path: String,
    val type: String, // "blob" or "tree"
    val size: Long? = null
)

@Serializable
data class FileContent(
    val path: String,
    val content: String,
    val lines: Int
)

@Serializable
data class BlameEntry(
    val lineStart: Int,
    val lineEnd: Int,
    val hash: String,
    val shortHash: String,
    val author: String,
    val authorEmail: String,
    val date: String,
    val relativeDate: String,
    val line: String
)

@Serializable
data class LineHistoryEntry(
    val hash: String,
    val shortHash: String,
    val author: String,
    val date: String,
    val message: String,
    val diff: String
)

class GitService(configDirs: String, private val defaultTraceDepth: Int) {
    @Volatile
    var repoDirs: List<String> = configDirs.split(",").map { it.trim() }.filter { it.isNotEmpty() }

    fun getRepos(): List<RepoInfo> {
        return repoDirs.mapNotNull { dir ->
            val f = File(dir)
            if (f.isDirectory && File(f, ".git").exists()) {
                RepoInfo(f.name, f.absolutePath)
            } else null
        }
    }

    fun getBranches(repoPath: String): List<BranchInfo> {
        validateRepoPath(repoPath)
        val output = runGit(repoPath, listOf("branch", "-a", "--no-color"))
        return output.lines().filter { it.isNotBlank() }.map { line ->
            val current = line.startsWith("*")
            val name = line.removePrefix("*").trim()
                .removePrefix("remotes/origin/")
                .removeSuffix(" -> origin/HEAD") // skip HEAD pointer
            BranchInfo(name, current)
        }.filter { !it.name.contains(" -> ") }.distinctBy { it.name }
    }

    fun getCommits(repoPath: String, branch: String, limit: Int = 50, offset: Int = 0): List<CommitInfo> {
        validateRepoPath(repoPath)
        validateRef(branch)
        val output = runGit(repoPath, listOf(
            "log", branch,
            "--format=%H%n%h%n%s%n%an%n%ae%n%aI%n%ar",
            "--skip=$offset", "-n", "$limit"
        ))
        return parseCommits(output)
    }

    fun getCommitDetail(repoPath: String, hash: String): CommitDetail {
        validateRepoPath(repoPath)
        validateRef(hash)
        val headerOutput = runGit(repoPath, listOf("show", hash, "--format=%H%n%h%n%B%n%an%n%ae%n%aI", "--no-patch"))
        val headerLines = headerOutput.lines()
        val fullHash = headerLines.getOrElse(0) { hash }
        val shortHash = headerLines.getOrElse(1) { hash.take(7) }
        val author = headerLines.getOrElse(3) { "" }
        val authorEmail = headerLines.getOrElse(4) { "" }
        val date = headerLines.getOrElse(5) { "" }
        val message = headerLines.getOrElse(2) { "" }

        val diffOutput = runGit(repoPath, listOf("show", hash, "--format=", "--patch", "--diff-algorithm=histogram"))
        val files = parseDiffOutput(diffOutput)

        return CommitDetail(fullHash, shortHash, message, author, authorEmail, date, files)
    }

    fun getTree(repoPath: String, ref: String, path: String = ""): List<TreeEntry> {
        validateRepoPath(repoPath)
        validateRef(ref)
        val treePath = if (path.isEmpty()) "$ref" else "$ref:$path"
        val output = runGit(repoPath, listOf("ls-tree", "-l", treePath))
        return output.lines().filter { it.isNotBlank() }.map { line ->
            // format: mode type hash size\tpath
            val parts = line.split("\t", limit = 2)
            val meta = parts[0].split("\\s+".toRegex())
            val name = parts.getOrElse(1) { "" }
            val type = if (meta.getOrElse(1) { "" } == "tree") "tree" else "blob"
            val size = meta.getOrElse(3) { "-" }.toLongOrNull()
            TreeEntry(name.substringAfterLast("/").ifEmpty { name }, name, type, size)
        }.sortedWith(compareBy({ it.type != "tree" }, { it.name.lowercase() }))
    }

    fun getFileContent(repoPath: String, path: String, ref: String): FileContent {
        validateRepoPath(repoPath)
        validateRef(ref)
        val content = runGit(repoPath, listOf("show", "$ref:$path"))
        return FileContent(path, content, content.lines().size)
    }

    fun getFileHistory(repoPath: String, path: String, branch: String = "HEAD", limit: Int = 50): List<CommitInfo> {
        validateRepoPath(repoPath)
        validateRef(branch)
        val output = runGit(repoPath, listOf(
            "log", branch, "--follow",
            "--format=%H%n%h%n%s%n%an%n%ae%n%aI%n%ar",
            "-n", "$limit", "--", path
        ))
        return parseCommits(output)
    }

    fun getBlame(repoPath: String, path: String, start: Int, end: Int, ref: String = "HEAD"): List<BlameEntry> {
        validateRepoPath(repoPath)
        validateRef(ref)
        val output = runGit(repoPath, listOf(
            "blame", "-L", "$start,$end", "--porcelain", ref, "--", path
        ))
        return parseBlameOutput(output, start)
    }

    fun getLineHistory(repoPath: String, path: String, start: Int, end: Int, limit: Int? = null): List<LineHistoryEntry> {
        validateRepoPath(repoPath)
        val effectiveLimit = limit ?: defaultTraceDepth
        val output = runGit(repoPath, listOf(
            "log", "-L", "$start,$end:$path",
            "--format=%H%n%h%n%an%n%aI%n%s",
            "-n", "$effectiveLimit"
        ))
        return parseLineHistory(output)
    }

    fun getConfig(): Map<String, String> = mapOf(
        "directories" to repoDirs.joinToString(","),
        "traceDepth" to defaultTraceDepth.toString()
    )

    fun updateConfig(dirs: List<String>) {
        repoDirs = dirs.filter { it.isNotEmpty() }
    }

    // --- internals ---

    private fun validateRepoPath(path: String) {
        val resolved = File(path).canonicalPath
        require(repoDirs.any { resolved.startsWith(File(it).canonicalPath) }) {
            "Repository path not in configured directories"
        }
    }

    private fun validateRef(ref: String) {
        require(ref.matches(Regex("^[a-zA-Z0-9_./-]+$"))) { "Invalid ref: $ref" }
    }

    private fun runGit(repoPath: String, args: List<String>, timeoutSec: Long = 30): String {
        val cmd = listOf("git", "-C", repoPath) + args
        val process = ProcessBuilder(cmd)
            .redirectErrorStream(true)
            .start()
        val output = process.inputStream.bufferedReader().readText()
        val exited = process.waitFor(timeoutSec, java.util.concurrent.TimeUnit.SECONDS)
        if (!exited) {
            process.destroyForcibly()
            throw RuntimeException("Git command timed out")
        }
        return output
    }

    private fun parseCommits(output: String): List<CommitInfo> {
        val lines = output.lines().filter { it.isNotEmpty() }
        val commits = mutableListOf<CommitInfo>()
        var i = 0
        while (i + 6 < lines.size) {
            commits.add(CommitInfo(
                hash = lines[i],
                shortHash = lines[i + 1],
                message = lines[i + 2],
                author = lines[i + 3],
                authorEmail = lines[i + 4],
                date = lines[i + 5],
                relativeDate = lines[i + 6]
            ))
            i += 7
        }
        return commits
    }

    private fun parseDiffOutput(diffOutput: String): List<DiffFile> {
        val files = mutableListOf<DiffFile>()
        val fileSections = diffOutput.split(Regex("(?=^diff --git )", RegexOption.MULTILINE)).filter { it.isNotBlank() }

        for (section in fileSections) {
            val lines = section.lines()
            // extract file path from +++ b/path or --- a/path
            val plusLine = lines.find { it.startsWith("+++ ") }
            val path = plusLine?.removePrefix("+++ b/")?.removePrefix("+++ /dev/null") ?: continue

            val statusLine = lines.find { it.startsWith("new file") || it.startsWith("deleted file") || it.startsWith("rename") }
            val status = when {
                statusLine?.startsWith("new file") == true -> "added"
                statusLine?.startsWith("deleted") == true -> "deleted"
                statusLine?.startsWith("rename") == true -> "renamed"
                else -> "modified"
            }

            val hunks = mutableListOf<DiffHunk>()
            var currentHunkHeader = ""
            var currentHunkLines = mutableListOf<DiffLine>()
            var oldLine = 0
            var newLine = 0

            for (line in lines) {
                if (line.startsWith("@@")) {
                    if (currentHunkLines.isNotEmpty()) {
                        hunks.add(DiffHunk(currentHunkHeader, currentHunkLines.toList()))
                    }
                    currentHunkHeader = line
                    currentHunkLines = mutableListOf()
                    // parse @@ -old,count +new,count @@
                    val match = Regex("@@ -(\\d+)(?:,\\d+)? \\+(\\d+)(?:,\\d+)? @@").find(line)
                    oldLine = match?.groupValues?.get(1)?.toIntOrNull() ?: 1
                    newLine = match?.groupValues?.get(2)?.toIntOrNull() ?: 1
                } else if (currentHunkHeader.isNotEmpty()) {
                    when {
                        line.startsWith("+") && !line.startsWith("+++") -> {
                            currentHunkLines.add(DiffLine("add", line.drop(1), newLineNum = newLine))
                            newLine++
                        }
                        line.startsWith("-") && !line.startsWith("---") -> {
                            currentHunkLines.add(DiffLine("remove", line.drop(1), oldLineNum = oldLine))
                            oldLine++
                        }
                        line.startsWith(" ") || (line.isEmpty() && currentHunkLines.isNotEmpty()) -> {
                            currentHunkLines.add(DiffLine("context", if (line.isNotEmpty()) line.drop(1) else "", oldLineNum = oldLine, newLineNum = newLine))
                            oldLine++; newLine++
                        }
                    }
                }
            }
            if (currentHunkLines.isNotEmpty()) {
                hunks.add(DiffHunk(currentHunkHeader, currentHunkLines.toList()))
            }

            files.add(DiffFile(path, status, hunks))
        }
        return files
    }

    private fun parseBlameOutput(output: String, startLine: Int): List<BlameEntry> {
        val entries = mutableListOf<BlameEntry>()
        val lines = output.lines()
        var i = 0
        var lineNum = startLine
        while (i < lines.size) {
            val headerLine = lines[i]
            if (!headerLine.matches(Regex("^[0-9a-f]{40}.*"))) { i++; continue }
            val hash = headerLine.substring(0, 40)
            var author = ""
            var authorEmail = ""
            var date = ""
            var relDate = ""
            var content = ""
            i++
            while (i < lines.size) {
                val l = lines[i]
                when {
                    l.startsWith("author ") -> author = l.removePrefix("author ")
                    l.startsWith("author-mail ") -> authorEmail = l.removePrefix("author-mail ").trim('<', '>')
                    l.startsWith("author-time ") -> {
                        val epoch = l.removePrefix("author-time ").toLongOrNull() ?: 0
                        date = java.time.Instant.ofEpochSecond(epoch).toString()
                    }
                    l.startsWith("committer-time ") -> {
                        val epoch = l.removePrefix("committer-time ").toLongOrNull() ?: 0
                        val instant = java.time.Instant.ofEpochSecond(epoch)
                        val dur = java.time.Duration.between(instant, java.time.Instant.now())
                        relDate = when {
                            dur.toDays() > 365 -> "${dur.toDays() / 365} years ago"
                            dur.toDays() > 30 -> "${dur.toDays() / 30} months ago"
                            dur.toDays() > 0 -> "${dur.toDays()} days ago"
                            dur.toHours() > 0 -> "${dur.toHours()} hours ago"
                            else -> "${dur.toMinutes()} minutes ago"
                        }
                    }
                    l.startsWith("\t") -> { content = l.removePrefix("\t"); i++; break }
                }
                i++
            }
            entries.add(BlameEntry(lineNum, lineNum, hash, hash.take(7), author, authorEmail, date, relDate, content))
            lineNum++
        }
        return entries
    }

    private fun parseLineHistory(output: String): List<LineHistoryEntry> {
        val entries = mutableListOf<LineHistoryEntry>()
        // Split by commit boundaries
        val sections = output.split(Regex("(?=^[0-9a-f]{40}$)", RegexOption.MULTILINE)).filter { it.isNotBlank() }
        for (section in sections) {
            val lines = section.lines().filter { it.isNotEmpty() }
            if (lines.size < 5) continue
            val hash = lines[0]
            val shortHash = lines[1]
            val author = lines[2]
            val date = lines[3]
            val message = lines[4]
            val diff = lines.drop(5).joinToString("\n")
            entries.add(LineHistoryEntry(hash, shortHash, author, date, message, diff))
        }
        return entries
    }
}
