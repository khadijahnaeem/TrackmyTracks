from collections.abc import Callable
from math import ceil

from flask import request
from sqlalchemy import Select

from app.errors import ValidationError
from app.extensions import db

PER_PAGE = 20
# keeps OFFSET far below the bigint limit
MAX_PAGE = 10_000


def json_body() -> dict:
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ValidationError("Request body must be a JSON object")
    return data


def optional_text(data: dict, field: str, max_length: int) -> str | None:
    value = data.get(field)
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValidationError(f"{field.capitalize()} must be text")
    value = value.strip()
    if len(value) > max_length:
        raise ValidationError(f"{field.capitalize()} must be {max_length} characters or fewer")
    return value or None


def required_text(data: dict, field: str, max_length: int) -> str:
    value = optional_text(data, field, max_length)
    if value is None:
        raise ValidationError(f"{field.capitalize()} is required")
    return value


def page_arg() -> int:
    page = request.args.get("page", 1, type=int)
    if not 1 <= page <= MAX_PAGE:
        raise ValidationError(f"Page must be between 1 and {MAX_PAGE}")
    return page


def page_payload(items: list, page: int, total: int, per_page: int) -> dict:
    return {"items": items, "page": page, "pages": ceil(total / per_page), "total": total}


def paginate(query: Select, serialize: Callable, page: int, per_page: int = PER_PAGE) -> dict:
    result = db.paginate(query, page=page, per_page=per_page, error_out=False)
    return page_payload([serialize(row) for row in result.items], page, result.total, per_page)
