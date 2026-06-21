package pt.cunha.hub.services

import kotlinx.coroutines.*
import kotlinx.serialization.Serializable
import java.io.File
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

@Serializable
data class BackupInfo(
    val filename: String,
    val timestamp: String,
    val sizeBytes: Long
)

@Serializable
data class BackupConfig(
    val enabled: Boolean = false,
    val intervalMinutes: Int = 60,
    val path: String = "/tmp/dev-hub-backups",
    val retention: Int = 10
)

class BackupService(private val configService: ConfigService) {

    private var job: Job? = null
    private val fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm-ss").withZone(ZoneId.systemDefault())

    fun getConfig(): BackupConfig {
        return BackupConfig(
            enabled = configService.getSync("backup_enabled") == "true",
            intervalMinutes = configService.getSync("backup_interval")?.toIntOrNull() ?: 60,
            path = configService.getSync("backup_path") ?: "/tmp/dev-hub-backups",
            retention = configService.getSync("backup_retention")?.toIntOrNull() ?: 10
        )
    }

    fun updateConfig(config: BackupConfig) {
        configService.setSync("backup_enabled", config.enabled.toString())
        configService.setSync("backup_interval", config.intervalMinutes.toString())
        configService.setSync("backup_path", config.path)
        configService.setSync("backup_retention", config.retention.toString())
        if (config.enabled) startScheduler() else stopScheduler()
    }

    fun listBackups(): List<BackupInfo> {
        val config = getConfig()
        val dir = File(config.path)
        if (!dir.exists()) return emptyList()
        return dir.listFiles()
            ?.filter { it.extension == "sql" }
            ?.sortedByDescending { it.lastModified() }
            ?.map { BackupInfo(it.name, Instant.ofEpochMilli(it.lastModified()).toString(), it.length()) }
            ?: emptyList()
    }

    suspend fun runBackup(): BackupInfo {
        val config = getConfig()
        val dir = File(config.path).also { it.mkdirs() }
        val ts = fmt.format(Instant.now())
        val filename = "hub-backup-$ts.sql"
        val file = File(dir, filename)

        val sql = configService.exportDatabaseSync()
        file.writeText(sql)

        enforceRetention(dir, config.retention)

        return BackupInfo(filename, Instant.now().toString(), file.length())
    }

    fun startScheduler() {
        stopScheduler()
        val config = getConfig()
        if (!config.enabled) return

        job = CoroutineScope(Dispatchers.IO).launch {
            while (isActive) {
                delay(config.intervalMinutes * 60_000L)
                try {
                    runBackup()
                } catch (e: Exception) {
                    System.err.println("Backup failed: ${e.message}")
                }
            }
        }
    }

    private fun stopScheduler() {
        job?.cancel()
        job = null
    }

    private fun enforceRetention(dir: File, retention: Int) {
        val files = dir.listFiles()?.filter { it.extension == "sql" }?.sortedByDescending { it.lastModified() } ?: return
        if (files.size > retention) {
            files.drop(retention).forEach { it.delete() }
        }
    }
}
