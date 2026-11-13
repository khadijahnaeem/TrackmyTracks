from flask import Blueprint

from app.auth.session import require_user
from app.errors import ValidationError
from app.http import json_body
from app.reports.service import report_review, report_user

bp = Blueprint("reports", __name__, url_prefix="/api")


@bp.post("/reports")
def create_report():
    reporter = require_user()
    data = json_body()

    reported_user_id = data.get("reported_user_id")
    rating_id = data.get("rating_id")
    reason = data.get("reason")
    details = data.get("details")

    # a report targets either a user or a rating, but not both
    # note: used to only report a user, now a rating, or a user
    if (reported_user_id is None) == (rating_id is None):
        raise ValidationError("Specify either reported_user_id or rating_id")

    # validate the selected target ID
    target_id = reported_user_id if reported_user_id is not None else rating_id

    if type(target_id) is not int or target_id <= 0:
        raise ValidationError("A valid target ID is required")

    # validate the reason
    if not isinstance(reason, str) or not reason.strip():
        raise ValidationError("A report reason is required")

    reason = reason.strip()

    if len(reason) > 100:
        raise ValidationError("Reason cannot exceed 100 characters")

    # validate optional details
    if details is not None:
        if not isinstance(details, str):
            raise ValidationError("Details must be text")

        details = details.strip() or None

        if details is not None and len(details) > 1000:
            raise ValidationError("Details cannot exceed 1000 characters")

    # send the report to the appropriate service, either report a user (reported_user_id)
    # or a rating (rating_id)
    if reported_user_id is not None:
        return report_user(reporter, reported_user_id, reason, details)

    return report_review(reporter, rating_id, reason, details)
