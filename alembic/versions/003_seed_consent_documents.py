"""seed consent documents

Revision ID: 003
Revises: 002
Create Date: 2025-10-12 19:32:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    consent_documents = sa.table(
        "consent_documents",
        sa.column("type", sa.Enum("terms", "privacy", "advertising", name="consenttype")),
        sa.column("version", sa.String()),
        sa.column("url", sa.String()),
        sa.column("effective_from", sa.DateTime(timezone=True)),
    )

    version_tag = "2025-10-12"

    op.bulk_insert(
        consent_documents,
        [
            {"type": "terms", "version": version_tag, "url": "/legal/terms", "effective_from": None},
            {"type": "privacy", "version": version_tag, "url": "/legal/privacy", "effective_from": None},
            {"type": "advertising", "version": version_tag, "url": "/legal/advertising", "effective_from": None},
        ],
    )


def downgrade() -> None:
    # Remove seeded rows by URL
    conn = op.get_bind()
    conn.execute(sa.text("DELETE FROM consent_documents WHERE url IN (:t, :p, :a)"),
                 {"t": "/legal/terms", "p": "/legal/privacy", "a": "/legal/advertising"})
