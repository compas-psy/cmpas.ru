"""Alembic environment configuration."""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config import settings

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
from app.database import Base
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.

def _to_sync_url(url: str) -> str:
    """Convert async SQLAlchemy URLs to sync for Alembic.

    Examples:
    - sqlite+aiosqlite:///path.db -> sqlite:///path.db
    - postgresql+asyncpg://...    -> postgresql://...
    - mysql+aiomysql://...        -> mysql://...
    """
    if url.startswith("sqlite+aiosqlite:"):
        return url.replace("sqlite+aiosqlite", "sqlite", 1)
    if url.startswith("postgresql+asyncpg:"):
        return url.replace("postgresql+asyncpg", "postgresql", 1)
    if url.startswith("mysql+aiomysql:"):
        return url.replace("mysql+aiomysql", "mysql", 1)
    return url

def run_migrations_offline():
    """Run migrations in 'offline' mode."""
    url = _to_sync_url(settings.DATABASE_URL)
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """Run migrations in 'online' mode."""
    section = config.get_section(config.config_ini_section)
    if section is None:
        section = {}
    section["sqlalchemy.url"] = _to_sync_url(settings.DATABASE_URL)
    connectable = engine_from_config(
        section,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
