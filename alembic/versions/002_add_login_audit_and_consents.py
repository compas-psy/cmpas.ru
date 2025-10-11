"""add login audit and consent tables

Revision ID: 002
Revises: 001
Create Date: 2025-10-11 17:43:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

consent_type_enum = sa.Enum(
    "terms",
    "privacy",
    "advertising",
    name="consenttype",
)

consent_action_enum = sa.Enum(
    "accepted",
    "withdrawn",
    "updated",
    name="consentaction",
)

auth_provider_enum = sa.Enum(
    "TELEGRAM",
    "YANDEX",
    "EMAIL",
    name="authprovider",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    consent_type_enum.create(bind, checkfirst=True)
    consent_action_enum.create(bind, checkfirst=True)

    op.create_table(
        "login_audit",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("provider", auth_provider_enum, nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("path", sa.String(), nullable=True),
        sa.Column("ip_address", sa.String(), nullable=True),
        sa.Column("user_agent", sa.String(), nullable=True),
        sa.Column("device_type", sa.String(), nullable=True),
        sa.Column("browser", sa.String(), nullable=True),
        sa.Column("os", sa.String(), nullable=True),
        sa.Column("referer", sa.String(), nullable=True),
        sa.Column("accept_language", sa.String(), nullable=True),
        sa.Column("success", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("error", sa.String(), nullable=True),
    )
    op.create_index(op.f("ix_login_audit_user_id"), "login_audit", ["user_id"], unique=False)

    op.create_table(
        "consent_documents",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False, autoincrement=True),
        sa.Column("type", consent_type_enum, nullable=False),
        sa.Column("version", sa.String(), nullable=False),
        sa.Column("url", sa.String(), nullable=False),
        sa.Column("effective_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(op.f("ix_consent_documents_type"), "consent_documents", ["type"], unique=False)

    op.create_table(
        "user_consents",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("type", consent_type_enum, nullable=False),
        sa.Column("accepted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("document_id", sa.Integer(), sa.ForeignKey("consent_documents.id"), nullable=True),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(op.f("ix_user_consents_user_id"), "user_consents", ["user_id"], unique=False)
    op.create_index(op.f("ix_user_consents_type"), "user_consents", ["type"], unique=False)

    op.create_table(
        "user_consent_logs",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False, autoincrement=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("type", consent_type_enum, nullable=False),
        sa.Column("action", consent_action_enum, nullable=False),
        sa.Column("document_id", sa.Integer(), sa.ForeignKey("consent_documents.id"), nullable=True),
        sa.Column("document_version", sa.String(), nullable=True),
        sa.Column("document_url", sa.String(), nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("ip_address", sa.String(), nullable=True),
        sa.Column("user_agent", sa.String(), nullable=True),
        sa.Column("device_type", sa.String(), nullable=True),
        sa.Column("browser", sa.String(), nullable=True),
        sa.Column("os", sa.String(), nullable=True),
        sa.Column("referer", sa.String(), nullable=True),
        sa.Column("accept_language", sa.String(), nullable=True),
    )
    op.create_index(op.f("ix_user_consent_logs_user_id"), "user_consent_logs", ["user_id"], unique=False)
    op.create_index(op.f("ix_user_consent_logs_type"), "user_consent_logs", ["type"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_user_consent_logs_type"), table_name="user_consent_logs")
    op.drop_index(op.f("ix_user_consent_logs_user_id"), table_name="user_consent_logs")
    op.drop_table("user_consent_logs")

    op.drop_index(op.f("ix_user_consents_type"), table_name="user_consents")
    op.drop_index(op.f("ix_user_consents_user_id"), table_name="user_consents")
    op.drop_table("user_consents")

    op.drop_index(op.f("ix_consent_documents_type"), table_name="consent_documents")
    op.drop_table("consent_documents")

    op.drop_index(op.f("ix_login_audit_user_id"), table_name="login_audit")
    op.drop_table("login_audit")

    bind = op.get_bind()
    consent_action_enum.drop(bind, checkfirst=True)
    consent_type_enum.drop(bind, checkfirst=True)
