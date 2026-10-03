import pytest
from sqlalchemy import select

from app.errors import ValidationError
from app.http import (
    MAX_PAGE,
    json_body,
    optional_text,
    page_arg,
    page_payload,
    paginate,
    required_text,
)
from app.models import User


def test_json_body_requires_an_object(app):
    with app.test_request_context(json=[1, 2]), pytest.raises(ValidationError, match="JSON object"):
        json_body()


def test_optional_text_trims_and_stores_blank_as_none():
    assert optional_text({"review": "  great  "}, "review", 10) == "great"
    assert optional_text({"review": "   "}, "review", 10) is None
    assert optional_text({}, "review", 10) is None


def test_optional_text_enforces_type_and_length():
    with pytest.raises(ValidationError, match="Review must be text"):
        optional_text({"review": 5}, "review", 10)
    with pytest.raises(ValidationError, match="Review must be 10 characters or fewer"):
        optional_text({"review": "x" * 11}, "review", 10)


def test_required_text_rejects_blank():
    with pytest.raises(ValidationError, match="Name is required"):
        required_text({"name": "  "}, "name", 100)


def test_page_arg(app):
    with app.test_request_context("/?page=3"):
        assert page_arg() == 3
    with app.test_request_context("/"):
        assert page_arg() == 1
    with app.test_request_context("/?page=0"), pytest.raises(ValidationError):
        page_arg()


def test_page_arg_rejects_pages_past_the_cap(app):
    with app.test_request_context(f"/?page={MAX_PAGE}"):
        assert page_arg() == MAX_PAGE
    with app.test_request_context("/?page=999999999999999999"), pytest.raises(ValidationError):
        page_arg()


def test_page_payload_counts_pages():
    assert page_payload(["a"], 2, 41, 20) == {"items": ["a"], "page": 2, "pages": 3, "total": 41}


def test_paginate_serializes_requested_page(make_user):
    for name in ("ana", "ben", "cal"):
        make_user(name)

    result = paginate(select(User).order_by(User.username), lambda u: u.username, 2, per_page=2)

    assert result == {"items": ["cal"], "page": 2, "pages": 2, "total": 3}
