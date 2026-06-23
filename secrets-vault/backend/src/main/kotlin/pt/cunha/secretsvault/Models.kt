package pt.cunha.secretsvault

import kotlinx.serialization.Serializable

@Serializable
data class Secret(
    val id: Int,
    val label: String,
    val category: String? = null,
    val tags: String? = null,
    val iv: String,
    val ciphertext: String,
    val createdAt: String,
    val updatedAt: String
)

@Serializable
data class CreateSecretRequest(
    val label: String,
    val category: String? = null,
    val tags: String? = null,
    val iv: String,
    val ciphertext: String
)

@Serializable
data class UpdateSecretRequest(
    val label: String? = null,
    val category: String? = null,
    val tags: String? = null,
    val iv: String? = null,
    val ciphertext: String? = null
)

@Serializable
data class VaultCryptoConfig(
    val kdfSalt: String? = null,
    val verifySalt: String? = null,
    val verifier: String? = null,
    val iterations: Int? = null,
    val initialized: Boolean = false
)

@Serializable
data class UpdateCryptoConfigRequest(
    val kdfSalt: String? = null,
    val verifySalt: String? = null,
    val verifier: String? = null,
    val iterations: Int? = null
)

@Serializable
data class VaultConfig(
    val pgDumpPath: String,
    val psqlPath: String,
    val pgRestorePath: String
)
