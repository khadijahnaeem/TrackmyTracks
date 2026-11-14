from flask import Blueprint

from app.auth.session import require_user
from app.errors import ValidationError
from app.http import json_body
from app.reports.service import report_review, report_user, report_user_by_username

bp = Blueprint("reports", __name__, url_prefix="/api")


@bp.post("/reports")
def create_report():
    reporter = require_user()
    data = json_body()

    reported_username = data.get("reported_username")
    reported_user_id = data.get("reported_user_id")
    rating_id = data.get("rating_id")
    reason = data.get("reason")
    details = data.get("details")

    # Exactly one report target must be provided.
    targets = (reported_username, reported_user_id, rating_id)
    if sum(target is not None for target in targets) != 1:
        raise ValidationError("Specify exactly one report target")

    # Validate username or numeric target ID.
    if reported_username is not None:
        if not isinstance(reported_username, str) or not reported_username.strip():
            raise ValidationError("A valid username is required")
        reported_username = reported_username.strip()
    else:
        target_id = reported_user_id if reported_user_id is not None else rating_id
        if type(target_id) is not int or target_id <= 0:
            raise ValidationError("A valid target ID is required")

    # Validate the required reason.
    if not isinstance(reason, str) or not reason.strip():
        raise ValidationError("A report reason is required")

    reason = reason.strip()
    if len(reason) > 100:
        raise ValidationError("Reason cannot exceed 100 characters")

    # Validate optional details.
    if details is not None:
        if not isinstance(details, str):
            raise ValidationError("Details must be text")

        details = details.strip() or None
        if details is not None and len(details) > 1000:
            raise ValidationError("Details cannot exceed 1000 characters")

    if reported_username is not None:
        return report_user_by_username(reporter, reported_username, reason, details)

    if reported_user_id is not None:
        return report_user(reporter, reported_user_id, reason, details)

    return report_review(reporter, rating_id, reason, details)
