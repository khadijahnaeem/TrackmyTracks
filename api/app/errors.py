from flask import Flask, jsonify
from werkzeug.exceptions import HTTPException


class ApiError(Exception):
    status = 500
    code = "internal_error"

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class ValidationError(ApiError):
    status, code = 422, "validation_error"


class Unauthorized(ApiError):
    status, code = 401, "unauthorized"


class NotFound(ApiError):
    status, code = 404, "not_found"


class Conflict(ApiError):
    status, code = 409, "conflict"


class CatalogUnavailable(ApiError):
    status, code = 502, "catalog_unavailable"


def _error_response(status: int, code: str, message: str, headers=None):
    return jsonify(error={"code": code, "message": message}), status, headers


def register_error_handlers(app: Flask) -> None:
    @app.errorhandler(ApiError)
    def handle_api_error(error: ApiError):
        return _error_response(error.status, error.code, error.message)

    # also receives unhandled exceptions wrapped as InternalServerError
    @app.errorhandler(HTTPException)
    def handle_http_error(error: HTTPException):
        code = error.name.lower().replace(" ", "_")
        # keep headers like Allow on a 405, minus the html content type
        headers = [(k, v) for k, v in error.get_headers() if k.lower() != "content-type"]
        return _error_response(error.code or 500, code, error.description or error.name, headers)
