import os

from dotenv import load_dotenv

load_dotenv()


def _require(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(
            f"{name} is not set. Copy .env.example to .env and fill in a value."
        )
    return value


SECRET_KEY = _require("SECRET_KEY")
DATABASE_URL = _require("DATABASE_URL")

# Not environment-driven on purpose: allowing this to be overridden at deploy
# time invites a weak or "none" algorithm being configured by accident.
ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
