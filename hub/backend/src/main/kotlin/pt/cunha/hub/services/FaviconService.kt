package pt.cunha.hub.services

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URI
import java.security.cert.X509Certificate
import java.sql.Connection
import java.sql.Timestamp
import java.time.Instant
import javax.net.ssl.HttpsURLConnection
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManager
import javax.net.ssl.X509TrustManager

class FaviconService(private val conn: Connection) {

    private val trustAllSsl: SSLContext by lazy {
        val trustAll = arrayOf<TrustManager>(object : X509TrustManager {
            override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String) {}
            override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String) {}
            override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf()
        })
        SSLContext.getInstance("SSL").also { it.init(null, trustAll, java.security.SecureRandom()) }
    }

    suspend fun getIcon(entryId: Int): Pair<ByteArray, String>? = withContext(Dispatchers.IO) {
        conn.prepareStatement(
            "SELECT override_data, override_content_type, favicon_data, favicon_content_type FROM entry_icons WHERE entry_id = ?"
        ).also { it.setInt(1, entryId) }.executeQuery().use { rs ->
            if (!rs.next()) return@withContext null
            val overrideData = rs.getBytes("override_data")
            val overrideCt = rs.getString("override_content_type")
            if (overrideData != null && overrideCt != null) {
                return@withContext Pair(overrideData, overrideCt)
            }
            val faviconData = rs.getBytes("favicon_data")
            val faviconCt = rs.getString("favicon_content_type")
            if (faviconData != null && faviconCt != null) {
                return@withContext Pair(faviconData, faviconCt)
            }
            null
        }
    }

    suspend fun setOverrideFromUrl(entryId: Int, iconUrl: String) = withContext(Dispatchers.IO) {
        val (bytes, ct) = fetchBytes(iconUrl) ?: return@withContext
        upsertOverride(entryId, bytes, ct)
    }

    suspend fun setOverrideBytes(entryId: Int, bytes: ByteArray, contentType: String) = withContext(Dispatchers.IO) {
        upsertOverride(entryId, bytes, contentType)
    }

    suspend fun clearOverride(entryId: Int) = withContext(Dispatchers.IO) {
        conn.prepareStatement(
            "UPDATE entry_icons SET override_data = NULL, override_content_type = NULL, override_url = NULL WHERE entry_id = ?"
        ).also { it.setInt(1, entryId) }.executeUpdate()
    }

    suspend fun fetchAndCacheFavicon(entryId: Int, entryUrl: String) = withContext(Dispatchers.IO) {
        val favicon = tryFetchFavicon(entryUrl) ?: return@withContext
        val (bytes, ct) = favicon
        conn.prepareStatement("""
            INSERT INTO entry_icons (entry_id, favicon_data, favicon_content_type, last_fetched)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (entry_id) DO UPDATE SET
                favicon_data = EXCLUDED.favicon_data,
                favicon_content_type = EXCLUDED.favicon_content_type,
                last_fetched = EXCLUDED.last_fetched
        """).also { stmt ->
            stmt.setInt(1, entryId)
            stmt.setBytes(2, bytes)
            stmt.setString(3, ct)
            stmt.setTimestamp(4, Timestamp.from(Instant.now()))
        }.executeUpdate()
    }

    private fun tryFetchFavicon(entryUrl: String): Pair<ByteArray, String>? {
        return try {
            val uri = URI(entryUrl)
            val baseUrl = "${uri.scheme}://${uri.host}${if (uri.port > 0) ":${uri.port}" else ""}"
            fetchBytes("$baseUrl/favicon.ico")
                ?: fetchFaviconFromHtml(entryUrl)
        } catch (e: Exception) {
            null
        }
    }

    private fun fetchFaviconFromHtml(url: String): Pair<ByteArray, String>? {
        return try {
            val html = fetchText(url) ?: return null
            val pattern = Regex("""<link[^>]+rel=["'](?:icon|shortcut icon|apple-touch-icon)["'][^>]+href=["']([^"']+)["']""", RegexOption.IGNORE_CASE)
            val match = pattern.find(html) ?: return null
            var iconUrl = match.groupValues[1]
            if (!iconUrl.startsWith("http")) {
                val uri = URI(url)
                iconUrl = if (iconUrl.startsWith("/")) {
                    "${uri.scheme}://${uri.host}${if (uri.port > 0) ":${uri.port}" else ""}$iconUrl"
                } else {
                    "${url.trimEnd('/')}/$iconUrl"
                }
            }
            fetchBytes(iconUrl)
        } catch (e: Exception) {
            null
        }
    }

    private fun fetchBytes(url: String): Pair<ByteArray, String>? {
        return try {
            val conn = URI(url).toURL().openConnection() as HttpURLConnection
            conn.connectTimeout = 5000
            conn.readTimeout = 5000
            conn.setRequestProperty("User-Agent", "DevHub/1.0")
            if (conn is HttpsURLConnection) {
                conn.sslSocketFactory = trustAllSsl.socketFactory
                conn.hostnameVerifier = { _, _ -> true }
            }
            if (conn.responseCode == 200) {
                val ct = conn.contentType?.split(";")?.first()?.trim() ?: "image/x-icon"
                val bytes = conn.inputStream.use { it.readBytes() }
                if (bytes.isNotEmpty()) Pair(bytes, ct) else null
            } else null
        } catch (e: Exception) {
            null
        }
    }

    private fun fetchText(url: String): String? {
        return try {
            val conn = URI(url).toURL().openConnection() as HttpURLConnection
            conn.connectTimeout = 5000
            conn.readTimeout = 5000
            conn.setRequestProperty("User-Agent", "DevHub/1.0")
            if (conn is HttpsURLConnection) {
                conn.sslSocketFactory = trustAllSsl.socketFactory
                conn.hostnameVerifier = { _, _ -> true }
            }
            if (conn.responseCode == 200) {
                conn.inputStream.bufferedReader().use { it.readText() }
            } else null
        } catch (e: Exception) {
            null
        }
    }

    private fun upsertOverride(entryId: Int, bytes: ByteArray, contentType: String) {
        conn.prepareStatement("""
            INSERT INTO entry_icons (entry_id, override_data, override_content_type)
            VALUES (?, ?, ?)
            ON CONFLICT (entry_id) DO UPDATE SET
                override_data = EXCLUDED.override_data,
                override_content_type = EXCLUDED.override_content_type
        """).also { stmt ->
            stmt.setInt(1, entryId)
            stmt.setBytes(2, bytes)
            stmt.setString(3, contentType)
        }.executeUpdate()
    }
}
