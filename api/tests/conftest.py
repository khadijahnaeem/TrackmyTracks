import os
from pathlib import Path

import pytest
from dotenv import load_dotenv

from app import create_app

load_dotenv(Path(__file__).resolve().parents[2] / ".env")


@pytest.fixture(scope="session")
def app():
    return create_app({"TESTING": True, "SQLALCHEMY_DATABASE_URI": os.environ["TEST_DATABASE_URL"]})


@pytest.fixture
def client(app):
    return app.test_client()
