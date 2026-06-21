package pt.cunha.mockgen.services

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import pt.cunha.mockgen.models.EntitySpec
import pt.cunha.mockgen.models.GenerateResponse
import pt.cunha.mockgen.models.GenerationSpec
import java.io.File

class GeneratorService(private val localeProvider: () -> String) {

    suspend fun generate(
        spec: GenerationSpec,
        count: Int,
        profile: String,
        seed: Long?,
        entityName: String?
    ): GenerateResponse = withContext(Dispatchers.IO) {
        val entity = if (entityName != null) {
            spec.entities.find { it.name == entityName }
                ?: throw NoSuchElementException("Entity '$entityName' not found in spec")
        } else {
            spec.entities.firstOrNull() ?: throw IllegalStateException("Spec has no entities")
        }

        val script = buildGenerateScript(spec, entity, count, profile, seed, localeProvider())
        val records = runPythonScript(script)
        GenerateResponse(records = records, profile = profile, count = records.size, entityName = entity.name)
    }

    private fun runPythonScript(script: String): List<String> {
        val tmpFile = File.createTempFile("mockgen_", ".py")
        try {
            tmpFile.writeText(script)
            val process = ProcessBuilder("python3", tmpFile.absolutePath)
                .redirectErrorStream(true)
                .start()
            val output = process.inputStream.bufferedReader().readText()
            val exitCode = process.waitFor()
            if (exitCode != 0) throw RuntimeException("Python script failed (exit $exitCode): $output")
            return output.lines().filter { it.isNotBlank() }
        } finally {
            tmpFile.delete()
        }
    }

    companion object {
        fun buildGenerateScript(
            spec: GenerationSpec,
            entity: EntitySpec,
            count: Int,
            profile: String,
            seed: Long?,
            locale: String
        ): String {
            val specJson = kotlinx.serialization.json.Json.encodeToString(
                EntitySpec.serializer(), entity
            ).replace("\\", "\\\\").replace("\"", "\\\"")

            return """
import json, random, sys, re, uuid, string
from datetime import datetime, timedelta, timezone

try:
    from faker import Faker
    fake = Faker("$locale")
except ImportError:
    fake = None

${if (seed != null) "random.seed($seed)\nif fake: fake.seed_instance($seed)" else ""}

spec = json.loads("$specJson")
PROFILE = "$profile"
COUNT = $count

id_pools = {}

def faker_value(provider, field_type):
    if fake is None:
        return fallback_value(provider, field_type)
    try:
        if provider == "uuid4": return str(uuid.uuid4())
        if provider == "random_int": return fake.random_int(min=1, max=999999)
        if provider == "pyfloat": return round(fake.pyfloat(min_value=0, max_value=10000), 2)
        if provider == "boolean": return fake.boolean()
        if provider == "date_time_this_decade": return fake.date_time_this_decade(tzinfo=timezone.utc).isoformat()
        if provider == "date_this_decade": return str(fake.date_this_decade())
        if provider == "iso8601": return fake.date_time_this_decade(tzinfo=timezone.utc).isoformat()
        if hasattr(fake, provider):
            val = getattr(fake, provider)()
            if isinstance(val, datetime): return val.isoformat()
            return val
        return fallback_value(provider, field_type)
    except Exception:
        return fallback_value(provider, field_type)

def fallback_value(provider, field_type):
    if field_type == "integer": return random.randint(1, 999999)
    if field_type == "number": return round(random.uniform(0, 10000), 2)
    if field_type == "boolean": return random.choice([True, False])
    if "date" in (provider or "") or "time" in (provider or ""):
        return datetime.now(timezone.utc).isoformat()
    if "uuid" in (provider or "") or "id" in (provider or ""):
        return str(uuid.uuid4())
    if "email" in (provider or ""): return f"user{random.randint(1,9999)}@example.com"
    if "url" in (provider or "") or "uri" in (provider or ""): return f"https://example.com/{uuid.uuid4().hex[:8]}"
    return ''.join(random.choices(string.ascii_lowercase, k=random.randint(5, 15)))

def generate_field(field, record, is_pass2=False):
    name = field["name"]
    source = field.get("source", "faker-provider")
    ftype = field.get("type", "string")
    nullable = field.get("nullable", False)
    null_rate = field.get("nullRate", 0.0)
    unique = field.get("unique", False)

    # Conditional check
    cond_on = field.get("conditionalOn")
    if cond_on and cond_on in record:
        cond_val = field.get("conditionalValue")
        if str(record[cond_on]) != str(cond_val):
            return None

    # Null handling
    if nullable and random.random() < null_rate:
        return None

    # Profile: invalid — randomly violate constraints
    if PROFILE == "invalid" and random.random() < 0.15:
        violation = random.choice(["null_required", "wrong_type", "overflow"])
        if violation == "null_required" and not nullable: return None
        if violation == "wrong_type":
            if ftype == "integer": return "not_a_number"
            if ftype == "boolean": return "maybe"
            if ftype == "number": return "NaN_string"
        if violation == "overflow":
            max_len = field.get("maxLength")
            if max_len: return "X" * (max_len + 50)

    # Profile: edge — boundary values
    if PROFILE == "edge":
        if ftype == "integer":
            r_min = field.get("rangeMin", 0)
            r_max = field.get("rangeMax", 2147483647)
            return random.choice([int(r_min), int(r_max), 0, -1])
        if ftype == "string":
            max_len = field.get("maxLength", 255)
            min_len = field.get("minLength", 0)
            return random.choice(["", "X" * max_len, "X" * min_len])
        if ftype == "number":
            r_min = field.get("rangeMin", 0.0)
            r_max = field.get("rangeMax", 999999.99)
            return random.choice([r_min, r_max, 0.0])

    if source == "reference-to-other-field" and is_pass2:
        ref_entity = field.get("referenceEntity", "")
        ref_field = field.get("referenceField", "id")
        pool = id_pools.get(f"{ref_entity}.{ref_field}", [])
        if pool: return random.choice(pool)
        return str(uuid.uuid4())

    if source == "constant":
        return field.get("constant")

    if source == "enum-from-samples":
        enums = field.get("enumValues", [])
        weights = field.get("enumWeights")
        if enums:
            if weights and len(weights) == len(enums):
                return random.choices(enums, weights=weights, k=1)[0]
            return random.choice(enums)

    if source == "regex-template":
        template = field.get("template", "")
        pattern = field.get("pattern", "")
        if template:
            result = template
            while "{###}" in result:
                result = result.replace("{###}", str(random.randint(100, 999)), 1)
            while "{##}" in result:
                result = result.replace("{##}", str(random.randint(10, 99)), 1)
            while "{#}" in result:
                result = result.replace("{#}", str(random.randint(0, 9)), 1)
            return result
        return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

    if source == "range":
        r_min = field.get("rangeMin", 0)
        r_max = field.get("rangeMax", 1000)
        if ftype == "integer":
            return random.randint(int(r_min), int(r_max))
        return round(random.uniform(r_min, r_max), 2)

    if source == "faker-provider":
        provider = field.get("fakerProvider", "word")
        val = faker_value(provider, ftype)
        if ftype == "integer" and not isinstance(val, int):
            try: val = int(val)
            except: val = random.randint(1, 99999)
        if ftype == "number" and not isinstance(val, (int, float)):
            try: val = float(val)
            except: val = round(random.uniform(0, 1000), 2)
        return val

    return faker_value(None, ftype)

def generate_record(fields, is_pass2=False):
    record = {}
    for field in fields:
        ftype = field.get("type", "string")
        if ftype == "object" and field.get("children"):
            record[field["name"]] = generate_record(field["children"], is_pass2)
        elif ftype == "array" and field.get("children"):
            arr_len = random.randint(1, 3)
            child_spec = field["children"][0] if field["children"] else field
            record[field["name"]] = [generate_field(child_spec, record, is_pass2) for _ in range(arr_len)]
        else:
            val = generate_field(field, record, is_pass2)
            if val is not None or field.get("nullable", False):
                record[field["name"]] = val
    return record

# Pass 1: generate records, collect IDs
entity_name = spec["name"]
fields = spec["fields"]
records = []

for _ in range(COUNT):
    rec = generate_record(fields, is_pass2=False)
    records.append(rec)
    for field in fields:
        if field.get("isKey") or field.get("unique"):
            pool_key = f"{entity_name}.{field['name']}"
            if pool_key not in id_pools:
                id_pools[pool_key] = []
            if field["name"] in rec and rec[field["name"]] is not None:
                id_pools[pool_key].append(rec[field["name"]])

# Pass 2: resolve references
for rec in records:
    for field in fields:
        if field.get("source") == "reference-to-other-field":
            val = generate_field(field, rec, is_pass2=True)
            if val is not None:
                rec[field["name"]] = val
    # Handle correlations
    for field in fields:
        corr = field.get("correlatedWith")
        corr_type = field.get("correlationType")
        if corr and corr_type == "greater_than" and corr in rec and field["name"] in rec:
            try:
                base = rec[corr]
                if isinstance(base, str):
                    base_dt = datetime.fromisoformat(base.replace("Z", "+00:00"))
                    rec[field["name"]] = (base_dt + timedelta(hours=random.randint(1, 720))).isoformat()
            except: pass

for rec in records:
    print(json.dumps(rec, default=str))
""".trimIndent()
        }
    }
}
