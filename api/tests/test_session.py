import pytest
from flask import session

from app.auth.session import current_user, log_in, log_out, require_user
from app.errors import Unauthorized


def test_logged_out_has_no_user(app):
    with app.test_request_context():
        assert current_user() is None
        with pytest.raises(Unauthorized):
            require_user()


def test_log_in_and_out(app, make_user):
    user = make_user()
    with app.test_request_context():
        log_in(user)
        assert current_user() == user
        assert require_user() == user

        log_out()
        assert current_user() is None


def test_session_for_deleted_user_acts_logged_out(app):
    with app.test_request_context():
        session["user_id"] = 999

        assert current_user() is None
        assert "user_id" not in session
