import argparse
import hashlib
import json
import os
import re
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

BASE_DIR = Path(__file__).resolve().parent
APP_DATA_DIR = Path(os.getenv("TEMP") or BASE_DIR) / "VerseBloom"
DB_PATH = APP_DATA_DIR / "versebloom.db"
PASSWORD_ITERATIONS = 240_000
SESSION_DAYS = 30
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8000
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
HANDLE_RE = re.compile(r"^[a-z0-9_]{3,24}$")


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


def utc_now():
    return datetime.now(timezone.utc).replace(microsecond=0)


def iso_now():
    return utc_now().isoformat()


def normalize_email(email):
    return str(email or "").strip().lower()


def normalize_handle(handle):
    return re.sub(r"\s+", "", str(handle or "").strip().lstrip("@").lower())


def hash_token(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_password(password, salt_hex=None):
    salt_hex = salt_hex or secrets.token_hex(16)
    salt = bytes.fromhex(salt_hex)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS
    )
    return salt_hex, digest.hex()


def verify_password(password, salt_hex, password_hash):
    _, candidate = hash_password(password, salt_hex)
    return secrets.compare_digest(candidate, password_hash)


def get_connection():
    APP_DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_db():
    with get_connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                handle TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL UNIQUE,
                bio TEXT NOT NULL DEFAULT '',
                password_hash TEXT NOT NULL,
                password_salt TEXT NOT NULL,
                joined_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS poems (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                theme TEXT NOT NULL DEFAULT '',
                content TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS poem_likes (
                poem_id INTEGER NOT NULL REFERENCES poems(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TEXT NOT NULL,
                PRIMARY KEY (poem_id, user_id)
            );

            CREATE TABLE IF NOT EXISTS comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                poem_id INTEGER NOT NULL REFERENCES poems(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                text TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS shares (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                poem_id INTEGER NOT NULL REFERENCES poems(id) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                thought TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token_hash TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_poems_author_id ON poems(author_id);
            CREATE INDEX IF NOT EXISTS idx_poems_created_at ON poems(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_comments_poem_id ON comments(poem_id);
            CREATE INDEX IF NOT EXISTS idx_shares_poem_id ON shares(poem_id);
            CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
            """
        )
        seed_demo_data(connection)


def seed_demo_data(connection):
    existing_users = connection.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    if existing_users:
        return

    demo_users = [
        {
            "name": "Aanya Sen",
            "handle": "aanya",
            "email": "aanya@versebloom.local",
            "bio": "I write about rain, unfinished trains, and the kindness of old cities.",
            "joined_at": "2026-04-10T07:30:00+00:00",
        },
        {
            "name": "Mateo Cruz",
            "handle": "mateo",
            "email": "mateo@versebloom.local",
            "bio": "Short poems, long silences, and notes from streetlight hours.",
            "joined_at": "2026-04-11T09:12:00+00:00",
        },
        {
            "name": "Leela Narang",
            "handle": "leela",
            "email": "leela@versebloom.local",
            "bio": "I chase image-heavy poems with a little ache in them.",
            "joined_at": "2026-04-14T14:40:00+00:00",
        },
    ]

    user_ids = {}
    for user in demo_users:
        salt_hex, password_hash = hash_password("verse123")
        cursor = connection.execute(
            """
            INSERT INTO users (name, handle, email, bio, password_hash, password_salt, joined_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user["name"],
                user["handle"],
                user["email"],
                user["bio"],
                password_hash,
                salt_hex,
                user["joined_at"],
            ),
        )
        user_ids[user["handle"]] = cursor.lastrowid

    poem_ids = {}
    poems = [
        {
            "author_id": user_ids["aanya"],
            "title": "Night Letters",
            "theme": "Monsoon",
            "content": (
                "The rain wrote to the window all evening,\n"
                "letter after letter in silver handwriting.\n"
                "I kept reading your name\n"
                "between the drips and the passing lights."
            ),
            "created_at": "2026-04-20T18:30:00+00:00",
            "key": "night_letters",
        },
        {
            "author_id": user_ids["mateo"],
            "title": "Platform 6",
            "theme": "Transit",
            "content": (
                "At platform six,\n"
                "a goodbye stood up before the train did.\n"
                "Even the announcements softened,\n"
                "as if the station had seen this happen before."
            ),
            "created_at": "2026-04-22T06:45:00+00:00",
            "key": "platform_6",
        },
        {
            "author_id": user_ids["leela"],
            "title": "Bowl of Light",
            "theme": "Home",
            "content": (
                "Morning sat on the kitchen table\n"
                "like a bowl filled to the edge.\n"
                "My mother moved through it slowly,\n"
                "careful not to spill the day."
            ),
            "created_at": "2026-04-23T09:20:00+00:00",
            "key": "bowl_of_light",
        },
    ]

    for poem in poems:
        cursor = connection.execute(
            """
            INSERT INTO poems (author_id, title, theme, content, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                poem["author_id"],
                poem["title"],
                poem["theme"],
                poem["content"],
                poem["created_at"],
            ),
        )
        poem_ids[poem["key"]] = cursor.lastrowid

    likes = [
        (poem_ids["night_letters"], user_ids["mateo"], "2026-04-20T18:50:00+00:00"),
        (poem_ids["night_letters"], user_ids["leela"], "2026-04-20T19:05:00+00:00"),
        (poem_ids["platform_6"], user_ids["aanya"], "2026-04-22T07:00:00+00:00"),
        (poem_ids["bowl_of_light"], user_ids["aanya"], "2026-04-23T10:20:00+00:00"),
        (poem_ids["bowl_of_light"], user_ids["mateo"], "2026-04-23T10:50:00+00:00"),
    ]
    connection.executemany(
        "INSERT INTO poem_likes (poem_id, user_id, created_at) VALUES (?, ?, ?)", likes
    )

    comments = [
        (
            poem_ids["night_letters"],
            user_ids["mateo"],
            "That image of silver handwriting is beautiful and very alive.",
            "2026-04-20T19:00:00+00:00",
        ),
        (
            poem_ids["night_letters"],
            user_ids["leela"],
            "The last two lines stay with me. It feels intimate without trying too hard.",
            "2026-04-20T19:20:00+00:00",
        ),
        (
            poem_ids["platform_6"],
            user_ids["aanya"],
            "The first line is such a strong opening. It sets the whole ache.",
            "2026-04-22T07:10:00+00:00",
        ),
    ]
    connection.executemany(
        "INSERT INTO comments (poem_id, user_id, text, created_at) VALUES (?, ?, ?, ?)",
        comments,
    )

    shares = [
        (
            poem_ids["night_letters"],
            user_ids["leela"],
            "Sharing this because it made the weather feel personal in the best way.",
            "2026-04-21T08:10:00+00:00",
        ),
        (
            poem_ids["bowl_of_light"],
            user_ids["aanya"],
            "Keeping this on my profile because it turns a simple room into something sacred.",
            "2026-04-23T11:00:00+00:00",
        ),
    ]
    connection.executemany(
        "INSERT INTO shares (poem_id, user_id, thought, created_at) VALUES (?, ?, ?, ?)",
        shares,
    )
    connection.commit()


def serialize_public_user(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "handle": row["handle"],
        "bio": row["bio"] or "",
        "joinedAt": row["joined_at"],
    }


def serialize_current_user(row):
    data = serialize_public_user(row)
    data["email"] = row["email"]
    return data


def community_stats(connection):
    row = connection.execute(
        """
        SELECT
            (SELECT COUNT(*) FROM users) AS writers,
            (SELECT COUNT(*) FROM poems) AS poems,
            (SELECT COUNT(*) FROM comments) AS comments,
            (SELECT COUNT(*) FROM shares) AS profile_shares,
            (SELECT COUNT(*) FROM poem_likes) AS total_likes,
            (SELECT COUNT(DISTINCT author_id) FROM poems) AS active_voices
        """
    ).fetchone()
    return {
        "writers": row["writers"],
        "poems": row["poems"],
        "comments": row["comments"],
        "profileShares": row["profile_shares"],
        "totalLikes": row["total_likes"],
        "activeVoices": row["active_voices"],
    }


def dashboard_payload(connection, user_id):
    current_user = connection.execute(
        "SELECT id, name, handle, email, bio, joined_at FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()
    if current_user is None:
        raise ApiError(401, "Your account could not be found.")

    poem_rows = connection.execute(
        """
        SELECT
            p.id,
            p.title,
            p.theme,
            p.content,
            p.created_at,
            u.id AS author_id,
            u.name AS author_name,
            u.handle AS author_handle,
            u.bio AS author_bio,
            u.joined_at AS author_joined_at,
            COUNT(DISTINCT pl.user_id) AS like_count,
            MAX(CASE WHEN pl.user_id = ? THEN 1 ELSE 0 END) AS liked_by_current_user
        FROM poems p
        JOIN users u ON u.id = p.author_id
        LEFT JOIN poem_likes pl ON pl.poem_id = p.id
        GROUP BY p.id
        ORDER BY p.created_at DESC, p.id DESC
        """,
        (user_id,),
    ).fetchall()

    comments_by_poem = {}
    for row in connection.execute(
        """
        SELECT
            c.id,
            c.poem_id,
            c.text,
            c.created_at,
            u.id AS user_id,
            u.name AS user_name,
            u.handle AS user_handle,
            u.bio AS user_bio,
            u.joined_at AS user_joined_at
        FROM comments c
        JOIN users u ON u.id = c.user_id
        ORDER BY c.created_at ASC, c.id ASC
        """
    ):
        comments_by_poem.setdefault(row["poem_id"], []).append(
            {
                "id": row["id"],
                "text": row["text"],
                "createdAt": row["created_at"],
                "user": {
                    "id": row["user_id"],
                    "name": row["user_name"],
                    "handle": row["user_handle"],
                    "bio": row["user_bio"] or "",
                    "joinedAt": row["user_joined_at"],
                },
            }
        )

    shares_by_poem = {}
    for row in connection.execute(
        """
        SELECT
            s.id,
            s.poem_id,
            s.thought,
            s.created_at,
            u.id AS user_id,
            u.name AS user_name,
            u.handle AS user_handle,
            u.bio AS user_bio,
            u.joined_at AS user_joined_at
        FROM shares s
        JOIN users u ON u.id = s.user_id
        ORDER BY s.created_at DESC, s.id DESC
        """
    ):
        shares_by_poem.setdefault(row["poem_id"], []).append(
            {
                "id": row["id"],
                "thought": row["thought"],
                "createdAt": row["created_at"],
                "user": {
                    "id": row["user_id"],
                    "name": row["user_name"],
                    "handle": row["user_handle"],
                    "bio": row["user_bio"] or "",
                    "joinedAt": row["user_joined_at"],
                },
            }
        )

    poems = []
    for row in poem_rows:
        shares = shares_by_poem.get(row["id"], [])
        poems.append(
            {
                "id": row["id"],
                "title": row["title"],
                "theme": row["theme"] or "",
                "content": row["content"],
                "createdAt": row["created_at"],
                "likeCount": row["like_count"],
                "likedByCurrentUser": bool(row["liked_by_current_user"]),
                "comments": comments_by_poem.get(row["id"], []),
                "shares": shares,
                "shareCount": len(shares),
                "author": {
                    "id": row["author_id"],
                    "name": row["author_name"],
                    "handle": row["author_handle"],
                    "bio": row["author_bio"] or "",
                    "joinedAt": row["author_joined_at"],
                },
            }
        )

    return {
        "user": serialize_current_user(current_user),
        "poems": poems,
        "communityStats": community_stats(connection),
    }


def read_json(request_handler):
    content_length = int(request_handler.headers.get("Content-Length", "0"))
    raw_body = request_handler.rfile.read(content_length) if content_length else b"{}"
    if not raw_body:
        raw_body = b"{}"
    try:
        return json.loads(raw_body.decode("utf-8"))
    except json.JSONDecodeError as error:
        raise ApiError(400, "Request body must be valid JSON.") from error


def prune_sessions(connection):
    connection.execute("DELETE FROM sessions WHERE expires_at <= ?", (iso_now(),))


def create_session(connection, user_id):
    token = secrets.token_urlsafe(32)
    created_at = iso_now()
    expires_at = (utc_now() + timedelta(days=SESSION_DAYS)).isoformat()
    connection.execute(
        """
        INSERT INTO sessions (user_id, token_hash, created_at, expires_at)
        VALUES (?, ?, ?, ?)
        """,
        (user_id, hash_token(token), created_at, expires_at),
    )
    return token


def require_user(connection, request_handler):
    prune_sessions(connection)
    auth_header = request_handler.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise ApiError(401, "Please sign in to continue.")

    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        raise ApiError(401, "Please sign in to continue.")

    row = connection.execute(
        """
        SELECT u.*
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > ?
        """,
        (hash_token(token), iso_now()),
    ).fetchone()

    if row is None:
        raise ApiError(401, "Your session has expired. Please sign in again.")
    return row, token


def validate_registration(data):
    name = str(data.get("name", "")).strip()
    handle = normalize_handle(data.get("handle", ""))
    email = normalize_email(data.get("email", ""))
    password = str(data.get("password", ""))
    bio = str(data.get("bio", "")).strip()

    if len(name) < 2:
        raise ApiError(400, "Please enter a display name with at least 2 characters.")
    if not EMAIL_RE.match(email):
        raise ApiError(400, "Please enter a valid email address.")
    if not HANDLE_RE.match(handle):
        raise ApiError(
            400,
            "Handles must be 3 to 24 characters and use only letters, numbers, or underscores.",
        )
    if len(password) < 8:
        raise ApiError(400, "Passwords must be at least 8 characters long.")
    if len(bio) > 240:
        raise ApiError(400, "Profile notes should stay under 240 characters.")

    return {
        "name": name,
        "handle": handle,
        "email": email,
        "password": password,
        "bio": bio,
    }


def validate_poem(data):
    title = str(data.get("title", "")).strip()
    theme = str(data.get("theme", "")).strip()
    content = str(data.get("content", "")).strip()

    if not title:
        raise ApiError(400, "Please add a title for the poem.")
    if len(title) > 80:
        raise ApiError(400, "Titles must be 80 characters or fewer.")
    if len(theme) > 60:
        raise ApiError(400, "Themes must be 60 characters or fewer.")
    if len(content) < 8:
        raise ApiError(400, "Please add a little more to the poem before publishing.")
    if len(content) > 4000:
        raise ApiError(400, "Poems must stay under 4000 characters.")

    return {"title": title, "theme": theme, "content": content}


def validate_comment(data):
    text = str(data.get("text", "")).strip()
    if len(text) < 2:
        raise ApiError(400, "Comments should have at least 2 characters.")
    if len(text) > 180:
        raise ApiError(400, "Comments must stay under 180 characters.")
    return text


def validate_share(data):
    thought = str(data.get("thought", "")).strip()
    if len(thought) < 4:
        raise ApiError(400, "Add a little more context before sharing a poem.")
    if len(thought) > 280:
        raise ApiError(400, "Profile share thoughts must stay under 280 characters.")
    return thought


def fetch_poem(connection, poem_id):
    poem = connection.execute("SELECT id FROM poems WHERE id = ?", (poem_id,)).fetchone()
    if poem is None:
        raise ApiError(404, "That poem could not be found.")
    return poem


class VerseBloomHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def log_message(self, format_string, *args):
        print("%s - - [%s] %s" % (self.address_string(), self.log_date_time_string(), format_string % args))

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self.handle_api("GET", parsed.path)
            return

        if parsed.path == "/":
            self.path = "/index.html"
        else:
            candidate = BASE_DIR / parsed.path.lstrip("/")
            if not candidate.exists() and "." not in Path(parsed.path).name:
                self.path = "/index.html"

        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/"):
            self.respond_json(404, {"error": "Not found."})
            return
        self.handle_api("POST", parsed.path)

    def handle_api(self, method, path):
        try:
            with get_connection() as connection:
                parts = [part for part in path.strip("/").split("/") if part]

                if method == "GET" and parts == ["api", "health"]:
                    self.respond_json(
                        200,
                        {
                            "status": "ok",
                            "database": DB_PATH.name,
                            "time": iso_now(),
                        },
                    )
                    return

                if method == "GET" and parts == ["api", "bootstrap"]:
                    user, _ = require_user(connection, self)
                    self.respond_json(200, dashboard_payload(connection, user["id"]))
                    return

                if method == "POST" and parts == ["api", "auth", "register"]:
                    data = validate_registration(read_json(self))

                    if connection.execute(
                        "SELECT 1 FROM users WHERE email = ?", (data["email"],)
                    ).fetchone():
                        raise ApiError(409, "That email is already registered.")

                    if connection.execute(
                        "SELECT 1 FROM users WHERE handle = ?", (data["handle"],)
                    ).fetchone():
                        raise ApiError(409, "That handle is already taken.")

                    salt_hex, password_hash = hash_password(data["password"])
                    cursor = connection.execute(
                        """
                        INSERT INTO users (name, handle, email, bio, password_hash, password_salt, joined_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            data["name"],
                            data["handle"],
                            data["email"],
                            data["bio"],
                            password_hash,
                            salt_hex,
                            iso_now(),
                        ),
                    )
                    user_id = cursor.lastrowid
                    token = create_session(connection, user_id)
                    connection.commit()
                    self.respond_json(
                        201,
                        {
                            "token": token,
                            "dashboard": dashboard_payload(connection, user_id),
                        },
                    )
                    return

                if method == "POST" and parts == ["api", "auth", "login"]:
                    data = read_json(self)
                    identifier = str(data.get("email") or data.get("identifier") or "").strip()
                    password = str(data.get("password", ""))
                    if not identifier or not password:
                        raise ApiError(400, "Please enter your email and password.")

                    email = normalize_email(identifier)
                    handle = normalize_handle(identifier)
                    user = connection.execute(
                        """
                        SELECT *
                        FROM users
                        WHERE email = ? OR handle = ?
                        LIMIT 1
                        """,
                        (email, handle),
                    ).fetchone()

                    if user is None or not verify_password(
                        password, user["password_salt"], user["password_hash"]
                    ):
                        raise ApiError(401, "Your email or password is incorrect.")

                    token = create_session(connection, user["id"])
                    connection.commit()
                    self.respond_json(
                        200,
                        {
                            "token": token,
                            "dashboard": dashboard_payload(connection, user["id"]),
                        },
                    )
                    return

                if method == "POST" and parts == ["api", "auth", "logout"]:
                    _, token = require_user(connection, self)
                    connection.execute(
                        "DELETE FROM sessions WHERE token_hash = ?",
                        (hash_token(token),),
                    )
                    connection.commit()
                    self.respond_json(200, {"ok": True})
                    return

                if method == "POST" and parts == ["api", "poems"]:
                    user, _ = require_user(connection, self)
                    data = validate_poem(read_json(self))
                    connection.execute(
                        """
                        INSERT INTO poems (author_id, title, theme, content, created_at)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        (
                            user["id"],
                            data["title"],
                            data["theme"],
                            data["content"],
                            iso_now(),
                        ),
                    )
                    connection.commit()
                    self.respond_json(
                        201,
                        {
                            "message": "Your poem is now live in the community feed.",
                            "dashboard": dashboard_payload(connection, user["id"]),
                        },
                    )
                    return

                if method == "POST" and len(parts) == 4 and parts[:2] == ["api", "poems"]:
                    user, _ = require_user(connection, self)
                    try:
                        poem_id = int(parts[2])
                    except ValueError as error:
                        raise ApiError(400, "That poem id is invalid.") from error

                    fetch_poem(connection, poem_id)

                    if parts[3] == "like":
                        liked = connection.execute(
                            """
                            SELECT 1
                            FROM poem_likes
                            WHERE poem_id = ? AND user_id = ?
                            """,
                            (poem_id, user["id"]),
                        ).fetchone()

                        if liked:
                            connection.execute(
                                "DELETE FROM poem_likes WHERE poem_id = ? AND user_id = ?",
                                (poem_id, user["id"]),
                            )
                            message = "Like removed."
                        else:
                            connection.execute(
                                """
                                INSERT INTO poem_likes (poem_id, user_id, created_at)
                                VALUES (?, ?, ?)
                                """,
                                (poem_id, user["id"], iso_now()),
                            )
                            message = "Poem liked."

                        connection.commit()
                        self.respond_json(
                            200,
                            {
                                "message": message,
                                "dashboard": dashboard_payload(connection, user["id"]),
                            },
                        )
                        return

                    if parts[3] == "comments":
                        text = validate_comment(read_json(self))
                        connection.execute(
                            """
                            INSERT INTO comments (poem_id, user_id, text, created_at)
                            VALUES (?, ?, ?, ?)
                            """,
                            (poem_id, user["id"], text, iso_now()),
                        )
                        connection.commit()
                        self.respond_json(
                            201,
                            {
                                "message": "Your comment has been added.",
                                "dashboard": dashboard_payload(connection, user["id"]),
                            },
                        )
                        return

                    if parts[3] == "shares":
                        thought = validate_share(read_json(self))
                        connection.execute(
                            """
                            INSERT INTO shares (poem_id, user_id, thought, created_at)
                            VALUES (?, ?, ?, ?)
                            """,
                            (poem_id, user["id"], thought, iso_now()),
                        )
                        connection.commit()
                        self.respond_json(
                            201,
                            {
                                "message": "The poem is now on your profile with your reflection.",
                                "dashboard": dashboard_payload(connection, user["id"]),
                            },
                        )
                        return

                raise ApiError(404, "That API route does not exist.")
        except ApiError as error:
            self.respond_json(error.status, {"error": error.message})
        except sqlite3.IntegrityError:
            self.respond_json(409, {"error": "That record already exists."})
        except Exception:
            self.respond_json(500, {"error": "Internal server error."})

    def respond_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def parse_args():
    parser = argparse.ArgumentParser(description="Run the VerseBloom poetry backend.")
    parser.add_argument("--host", default=DEFAULT_HOST, help="Host to bind to.")
    parser.add_argument(
        "--port", type=int, default=DEFAULT_PORT, help="Port to bind to."
    )
    return parser.parse_args()


def main():
    args = parse_args()
    init_db()
    server = ThreadingHTTPServer((args.host, args.port), VerseBloomHandler)
    print(f"VerseBloom is running at http://{args.host}:{args.port}")
    print(f"SQLite database: {DB_PATH}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping VerseBloom.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
