from __future__ import annotations

import datetime as dt
import os
from pathlib import Path

import boto3
from botocore.config import Config
from supabase import create_client


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def required(env: dict[str, str], name: str) -> str:
    value = env.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Falta {name} en backend/.env")
    return value


def local_today() -> str:
    return dt.date.today().isoformat()


def main() -> None:
    base_dir = Path(__file__).resolve().parents[1]
    env = load_env(base_dir / ".env")

    supabase_url = required(env, "SUPABASE_URL")
    supabase_key = required(env, "SUPABASE_KEY")
    r2_account_id = required(env, "R2_ACCOUNT_ID")
    r2_access_key_id = required(env, "R2_ACCESS_KEY_ID")
    r2_secret_access_key = required(env, "R2_SECRET_ACCESS_KEY")
    r2_bucket_name = required(env, "R2_BUCKET_NAME")
    r2_endpoint = env.get("R2_ENDPOINT") or f"https://{r2_account_id}.r2.cloudflarestorage.com"
    r2_public_base_url = (env.get("R2_PUBLIC_BASE_URL") or "").rstrip("/")

    s3 = boto3.client(
        "s3",
        endpoint_url=r2_endpoint,
        aws_access_key_id=r2_access_key_id,
        aws_secret_access_key=r2_secret_access_key,
        region_name="auto",
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path", "payload_signing_enabled": False},
            retries={"max_attempts": 8, "mode": "standard"},
            max_pool_connections=2,
        ),
    )
    supabase = create_client(supabase_url, supabase_key)

    demo_dir = base_dir / "demo-input"
    files = ["turno1.mp4", "turno2.mp4", "turno3.mp4", "turno4.mp4"]
    starts = ["08:00", "09:00", "10:00", "11:00"]
    day = local_today()

    rows: list[dict[str, str | None]] = []
    for idx, filename in enumerate(files):
        path = demo_dir / filename
        if not path.exists():
            raise RuntimeError(f"No existe el archivo {path}")

        key = f"demo/replays/{day}/{filename}"
        body = path.read_bytes()
        s3.put_object(
            Bucket=r2_bucket_name,
            Key=key,
            Body=body,
            ContentLength=len(body),
            ContentType="video/mp4",
            CacheControl="public, max-age=31536000, immutable",
        )

        if r2_public_base_url:
            url = f"{r2_public_base_url}/{key}"
        else:
            url = f"{r2_endpoint.rstrip('/')}/{r2_bucket_name}/{key}"

        rows.append(
            {
                "match_key": f"cancha-padel|{day}|{starts[idx]}",
                "video_url": url,
                "poster_url": None,
                "updated_at": dt.datetime.utcnow().isoformat() + "Z",
            }
        )

    data = supabase.table("replay_assets").upsert(rows, on_conflict="match_key").execute()
    if getattr(data, "error", None):
        raise RuntimeError(f"No se pudo upsert replay_assets: {data.error}")

    print("Demo cargada OK.")
    for row in rows:
        print(f"{row['match_key']} -> {row['video_url']}")


if __name__ == "__main__":
    main()
