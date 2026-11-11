from flask import Blueprint

from app.auth.session import require_user
from app.errors import ValidationError
from app.http import json_body
from app.reports.service import report_user

bp = Blueprint("reports", __name__, url_prefix="/api")


@bp.post("/reports")
def create_report():
    reporter = require_user()
    data = json_body()

    reported_user_id = data.get("reported_user_id")
    reason = data.get("reason")
    details = data.get("details")

    #validate reported user's id
    if type(reported_user_id) is not int or reported_user_id <= 0:
        raise ValidationError("A valid reported_user_id is required")

    # Validate reason
    if not isinstance(reason, str) or not reason.strip():
        raise ValidationError("A report reason is required")

    reason = reason.strip()

    if len(reason) > 100:
        raise ValidationError("Reason cannot exceed 100 characters")

    # Validate optional details
    if details is not None:
        if not isinstance(details, str):
            raise ValidationError("Details must be text")

        details = details.strip() or None

        if details is not None and len(details) > 1000:
            raise ValidationError("Details cannot exceed 1000 characters")

    return report_user(reporter, reported_user_id, reason, details)