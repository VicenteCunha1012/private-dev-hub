package pt.cunha.aimemory

import pt.cunha.core.BaseConfigService
import java.sql.Connection

class ConfigService(conn: Connection) : BaseConfigService(
    conn, "aimemory_config", listOf("aimemory_config", "handoffs", "decisions")
)
