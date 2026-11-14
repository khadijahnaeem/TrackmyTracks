
"""Add user and review reporting.

Revision ID: 0003
Revises: 0002
"""

from alembic import op
import sqlalchemy as sa


revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "reports",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("reporter_id", sa.Integer(), nullable=False),
        sa.Column("reported_user_id", sa.Integer(), nullable=True),
        sa.Column("rating_id", sa.Integer(), nullable=True),
        sa.Column("reason", sa.String(100), nullable=False),
        sa.Column("details", sa.String(1000), nullable=True),
        sa.Column(
            "status",
            sa.String(20),
            server_default="pending",
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "num_nonnulls(reported_user_id, rating_id) = 1",
            name=op.f("ck_reports_report_one_target"),
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'reviewed', 'dismissed')",
            name=op.f("ck_reports_report_valid_status"),
        ),
        sa.CheckConstraint(
            "reason <> ''",
            name=op.f("ck_reports_report_reason_not_blank"),
        ),
        sa.ForeignKeyConstraint(
            ["reporter_id"],
            ["users.id"],
            name=op.f("fk_reports_reporter_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["reported_user_id"],
            ["users.id"],
            name=op.f("fk_reports_reported_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["rating_id"],
            ["ratings.id"],
            name=op.f("fk_reports_rating_id_ratings"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "id",
            name=op.f("pk_reports"),
        ),
    )

    with op.batch_alter_table("reports") as batch_op:
        batch_op.create_index(
            batch_op.f("ix_reports_reporter_id"),
            ["reporter_id"],
        )
        batch_op.create_index(
            batch_op.f("ix_reports_reported_user_id"),
            ["reported_user_id"],
        )
        batch_op.create_index(
            batch_op.f("ix_reports_rating_id"),
            ["rating_id"],
        )


def downgrade():
    op.drop_table("reports")
