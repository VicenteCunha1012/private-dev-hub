package pt.cunha.mockgen.services

import kotlinx.serialization.json.Json
import pt.cunha.mockgen.models.GenerationSpec

private val json = Json { ignoreUnknownKeys = true; prettyPrint = true }

class ScriptGenerator {

    fun generatePythonScript(spec: GenerationSpec, locale: String): String {
        val specJson = json.encodeToString(GenerationSpec.serializer(), spec)
            .replace("\\", "\\\\").replace("\"", "\\\"")

        return """#!/usr/bin/env python3
\"\"\"
Mock Data Generator — generate.py
Generated from spec. Runs offline with Faker.
Usage: python generate.py [--count N] [--profile valid|invalid|edge] [--seed N] [--entity name]
\"\"\"
import argparse, json, random, sys, re, uuid, string
from datetime import datetime, timedelta, timezone

try:
    from faker import Faker
except ImportError:
    print("Install faker: pip install faker", file=sys.stderr)
    sys.exit(1)

SPEC = json.loads("$specJson")

def parse_args():
    p = argparse.ArgumentParser(description="Generate mock data from spec")
    p.add_argument("--count", type=int, default=10)
    p.add_argument("--profile", choices=["valid", "invalid", "edge"], default="valid")
    p.add_argument("--seed", type=int, default=None)
    p.add_argument("--entity", type=str, default=None)
    p.add_argument("--output", type=str, default=None, help="Output file (default: stdout)")
    return p.parse_args()

fake = Faker("$locale")
id_pools = {}

def faker_value(provider, field_type):
    try:
        if provider == "uuid4": return str(uuid.uuid4())
        if provider == "random_int": return fake.random_int(min=1, max=999999)
        if provider == "pyfloat": return round(fake.pyfloat(min_value=0, max_value=10000), 2)
        if provider == "boolean": return fake.boolean()
        if provider == "date_time_this_decade": return fake.date_time_this_decade(tzinfo=timezone.utc).isoformat()
        if provider == "iso8601": return fake.date_time_this_decade(tzinfo=timezone.utc).isoformat()
        if hasattr(fake, provider):
            val = getattr(fake, provider)()
            if isinstance(val, datetime): return val.isoformat()
            return val
    except Exception:
        pass
    if field_type == "integer": return random.randint(1, 999999)
    if field_type == "number": return round(random.uniform(0, 10000), 2)
    if field_type == "boolean": return random.choice([True, False])
    return fake.word()

def generate_field(field, record, profile, is_pass2=False):
    source = field.get("source", "faker-provider")
    ftype = field.get("type", "string")
    nullable = field.get("nullable", False)
    null_rate = field.get("nullRate", 0.0)

    cond_on = field.get("conditionalOn")
    if cond_on and cond_on in record:
        if str(record[cond_on]) != str(field.get("conditionalValue")):
            return None

    if nullable and random.random() < null_rate:
        return None

    if profile == "invalid" and random.random() < 0.15:
        v = random.choice(["null_req", "wrong_type", "overflow"])
        if v == "null_req" and not nullable: return None
        if v == "wrong_type":
            if ftype == "integer": return "not_a_number"
            if ftype == "number": return "NaN"
        if v == "overflow":
            ml = field.get("maxLength")
            if ml: return "X" * (ml + 50)

    if profile == "edge":
        if ftype == "integer":
            return random.choice([int(field.get("rangeMin", 0)), int(field.get("rangeMax", 2147483647)), 0, -1])
        if ftype == "string":
            return random.choice(["", "X" * field.get("maxLength", 255)])

    if source == "reference-to-other-field" and is_pass2:
        pool = id_pools.get(f"{field.get('referenceEntity','')}.{field.get('referenceField','id')}", [])
        return random.choice(pool) if pool else str(uuid.uuid4())

    if source == "constant": return field.get("constant")

    if source == "enum-from-samples":
        enums = field.get("enumValues", [])
        weights = field.get("enumWeights")
        if enums:
            return random.choices(enums, weights=weights, k=1)[0] if weights and len(weights) == len(enums) else random.choice(enums)

    if source == "regex-template":
        t = field.get("template", "")
        if t:
            while "{###}" in t: t = t.replace("{###}", str(random.randint(100, 999)), 1)
            while "{##}" in t: t = t.replace("{##}", str(random.randint(10, 99)), 1)
            while "{#}" in t: t = t.replace("{#}", str(random.randint(0, 9)), 1)
            return t

    if source == "range":
        r_min, r_max = field.get("rangeMin", 0), field.get("rangeMax", 1000)
        return random.randint(int(r_min), int(r_max)) if ftype == "integer" else round(random.uniform(r_min, r_max), 2)

    return faker_value(field.get("fakerProvider", "word"), ftype)

def generate_record(fields, profile, is_pass2=False):
    record = {}
    for f in fields:
        if f.get("type") == "object" and f.get("children"):
            record[f["name"]] = generate_record(f["children"], profile, is_pass2)
        elif f.get("type") == "array" and f.get("children"):
            child = f["children"][0] if f["children"] else f
            record[f["name"]] = [generate_field(child, record, profile, is_pass2) for _ in range(random.randint(1, 3))]
        else:
            val = generate_field(f, record, profile, is_pass2)
            if val is not None or f.get("nullable", False):
                record[f["name"]] = val
    return record

def main():
    args = parse_args()
    if args.seed is not None:
        random.seed(args.seed)
        fake.seed_instance(args.seed)

    entities = SPEC.get("entities", [])
    target = next((e for e in entities if e["name"] == args.entity), None) if args.entity else (entities[0] if entities else None)
    if not target:
        print("No entity found", file=sys.stderr)
        sys.exit(1)

    fields = target["fields"]
    records = []

    # Pass 1
    for _ in range(args.count):
        rec = generate_record(fields, args.profile)
        records.append(rec)
        for f in fields:
            if f.get("isKey") or f.get("unique"):
                key = f"{target['name']}.{f['name']}"
                id_pools.setdefault(key, [])
                if f["name"] in rec and rec[f["name"]] is not None:
                    id_pools[key].append(rec[f["name"]])

    # Pass 2
    for rec in records:
        for f in fields:
            if f.get("source") == "reference-to-other-field":
                val = generate_field(f, rec, args.profile, is_pass2=True)
                if val is not None: rec[f["name"]] = val
            corr = f.get("correlatedWith")
            if corr and f.get("correlationType") == "greater_than" and corr in rec:
                try:
                    base = datetime.fromisoformat(str(rec[corr]).replace("Z", "+00:00"))
                    rec[f["name"]] = (base + timedelta(hours=random.randint(1, 720))).isoformat()
                except: pass

    out = sys.stdout if not args.output else open(args.output, "w")
    for rec in records:
        print(json.dumps(rec, default=str), file=out)
    if args.output: out.close()

if __name__ == "__main__":
    main()
"""
    }

    fun generateCallApiScript(spec: GenerationSpec, locale: String): String {
        val specJson = json.encodeToString(GenerationSpec.serializer(), spec)
            .replace("\\", "\\\\").replace("\"", "\\\"")

        return """#!/usr/bin/env python3
\"\"\"
Mock Data Generator — call_api.py
Generates mock data and sends to API endpoints.
Usage: python call_api.py [--count N] [--profile valid|invalid|edge] [--seed N] [--dry-run]
\"\"\"
import argparse, json, random, sys, uuid, string, requests
from datetime import datetime, timedelta, timezone

try:
    from faker import Faker
except ImportError:
    print("Install faker: pip install faker", file=sys.stderr)
    sys.exit(1)

import auth_util

SPEC = json.loads("$specJson")

fake = Faker("$locale")
id_pools = {}

def parse_args():
    p = argparse.ArgumentParser(description="Generate and send mock data to API")
    p.add_argument("--count", type=int, default=10)
    p.add_argument("--profile", choices=["valid", "invalid", "edge"], default="valid")
    p.add_argument("--seed", type=int, default=None)
    p.add_argument("--dry-run", action="store_true", help="Generate but don't send")
    p.add_argument("--base-url", type=str, default=None, help="Override API base URL")
    return p.parse_args()

def faker_value(provider, field_type):
    try:
        if provider == "uuid4": return str(uuid.uuid4())
        if provider == "random_int": return fake.random_int(min=1, max=999999)
        if provider == "pyfloat": return round(fake.pyfloat(min_value=0, max_value=10000), 2)
        if provider == "boolean": return fake.boolean()
        if provider == "date_time_this_decade": return fake.date_time_this_decade(tzinfo=timezone.utc).isoformat()
        if provider == "iso8601": return fake.date_time_this_decade(tzinfo=timezone.utc).isoformat()
        if hasattr(fake, provider):
            val = getattr(fake, provider)()
            if isinstance(val, datetime): return val.isoformat()
            return val
    except Exception:
        pass
    if field_type == "integer": return random.randint(1, 999999)
    if field_type == "number": return round(random.uniform(0, 10000), 2)
    if field_type == "boolean": return random.choice([True, False])
    return fake.word()

def generate_field(field, record, profile, is_pass2=False):
    source = field.get("source", "faker-provider")
    ftype = field.get("type", "string")
    nullable = field.get("nullable", False)
    null_rate = field.get("nullRate", 0.0)

    cond_on = field.get("conditionalOn")
    if cond_on and cond_on in record:
        if str(record[cond_on]) != str(field.get("conditionalValue")): return None

    if nullable and random.random() < null_rate: return None

    if source == "reference-to-other-field" and is_pass2:
        pool = id_pools.get(f"{field.get('referenceEntity','')}.{field.get('referenceField','id')}", [])
        return random.choice(pool) if pool else str(uuid.uuid4())
    if source == "constant": return field.get("constant")
    if source == "enum-from-samples":
        enums = field.get("enumValues", [])
        weights = field.get("enumWeights")
        if enums:
            return random.choices(enums, weights=weights, k=1)[0] if weights and len(weights) == len(enums) else random.choice(enums)
    if source == "regex-template":
        t = field.get("template", "")
        while "{###}" in t: t = t.replace("{###}", str(random.randint(100, 999)), 1)
        while "{##}" in t: t = t.replace("{##}", str(random.randint(10, 99)), 1)
        while "{#}" in t: t = t.replace("{#}", str(random.randint(0, 9)), 1)
        return t
    if source == "range":
        r_min, r_max = field.get("rangeMin", 0), field.get("rangeMax", 1000)
        return random.randint(int(r_min), int(r_max)) if ftype == "integer" else round(random.uniform(r_min, r_max), 2)
    return faker_value(field.get("fakerProvider", "word"), ftype)

def generate_record(fields, profile, is_pass2=False):
    record = {}
    for f in fields:
        if f.get("type") == "object" and f.get("children"):
            record[f["name"]] = generate_record(f["children"], profile, is_pass2)
        elif f.get("type") == "array" and f.get("children"):
            child = f["children"][0] if f["children"] else f
            record[f["name"]] = [generate_field(child, record, profile, is_pass2) for _ in range(random.randint(1, 3))]
        else:
            val = generate_field(f, record, profile, is_pass2)
            if val is not None or f.get("nullable", False):
                record[f["name"]] = val
    return record

def main():
    args = parse_args()
    if args.seed is not None:
        random.seed(args.seed)
        fake.seed_instance(args.seed)

    base_url = args.base_url or SPEC.get("apiBaseUrl", "http://localhost:8080")
    endpoints = SPEC.get("apiEndpoints", [])
    token = auth_util.get_token()
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}

    for ep in endpoints:
        entity = next((e for e in SPEC["entities"] if e["name"] == ep["entityName"]), None)
        if not entity:
            print(f"Entity {ep['entityName']} not found, skipping", file=sys.stderr)
            continue

        fields = entity["fields"]
        records = []
        for _ in range(args.count):
            rec = generate_record(fields, args.profile)
            records.append(rec)
            for f in fields:
                if f.get("isKey") or f.get("unique"):
                    key = f"{entity['name']}.{f['name']}"
                    id_pools.setdefault(key, [])
                    if f["name"] in rec and rec[f["name"]] is not None:
                        id_pools[key].append(rec[f["name"]])

        for rec in records:
            for f in fields:
                if f.get("source") == "reference-to-other-field":
                    val = generate_field(f, rec, args.profile, is_pass2=True)
                    if val is not None: rec[f["name"]] = val

        url = f"{base_url}{ep['path']}"
        method = ep.get("method", "POST").upper()
        merged_headers = {**headers, **(ep.get("headers") or {})}

        for i, rec in enumerate(records):
            if args.dry_run:
                print(f"[DRY-RUN] {method} {url}")
                print(json.dumps(rec, indent=2, default=str))
            else:
                try:
                    resp = requests.request(method, url, json=rec, headers=merged_headers)
                    status = "OK" if resp.ok else f"FAIL({resp.status_code})"
                    print(f"[{i+1}/{len(records)}] {method} {url} → {status}")
                    if not resp.ok:
                        print(f"  Response: {resp.text[:200]}", file=sys.stderr)
                except Exception as e:
                    print(f"[{i+1}/{len(records)}] {method} {url} → ERROR: {e}", file=sys.stderr)

if __name__ == "__main__":
    main()
"""
    }
}
