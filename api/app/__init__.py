import os

from flask import Flask

from app import models  # noqa: F401
from app.auth.routes import bp as auth_bp
from app.catalog.routes import bp as catalog_bp
from app.errors import register_error_handlers
from app.extensions import db, migrate
from app.musicbrainz import MusicBrainzClient
from app.playlists.routes import bp as playlists_bp
from app.ratings.routes import bp as ratings_bp


def create_app(overrides: dict | None = None) -> Flask:
    app = Flask(__name__)
    app.config.from_mapping(
        SQLALCHEMY_DATABASE_URI=os.environ["DATABASE_URL"],
        SECRET_KEY=os.environ["SECRET_KEY"],
        MB_USER_AGENT=os.environ["MB_USER_AGENT"],
        SESSION_COOKIE_SAMESITE="Lax",
    )
    app.config.update(overrides or {})

    db.init_app(app)
    migrate.init_app(app, db)
    register_error_handlers(app)
    app.extensions["musicbrainz"] = MusicBrainzClient(app.config["MB_USER_AGENT"])
    for blueprint in (auth_bp, catalog_bp, ratings_bp, playlists_bp):
        app.register_blueprint(blueprint)
    return app
