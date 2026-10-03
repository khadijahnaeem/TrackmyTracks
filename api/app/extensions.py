from datetime import datetime

from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import DateTime, MetaData
from sqlalchemy.orm import DeclarativeBase, registry


class Base(DeclarativeBase):
    # explicit registry since SQLAlchemy 2.1 rejects a type map on a subclassed base
    registry = registry(
        # stable constraint names keep migrations reviewable
        metadata=MetaData(
            naming_convention={
                "ix": "ix_%(column_0_label)s",
                "uq": "uq_%(table_name)s_%(column_0_N_name)s",
                "ck": "ck_%(table_name)s_%(constraint_name)s",
                "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
                "pk": "pk_%(table_name)s",
            }
        ),
        type_annotation_map={datetime: DateTime(timezone=True)},
    )


db = SQLAlchemy(model_class=Base)
migrate = Migrate()
