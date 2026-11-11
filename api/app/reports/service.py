from app.errors import NotFound, ValidationError
#if the review or user being reported does not exist or if the report sent has invalid data like an empty reason

from app.extensions import db
from app.models import Report, User

def report_user(reporter: User, reported_user_id: int, reason: str, details: str | None):

    #check the reported user exists
    reported_user = db.session.get(User, reported_user_id)
    if reported_user is None:
        raise NotFound("Reported user not found")

    #prevent users from reporting themselves
    if reported_user_id == reporter.id:
        raise ValidationError("You cannot report yourself")
    
    #if both of the above are clear, create the actual report
    report = Report(
        reporter_id = reporter.id,
        reported_user_id = reported_user.id,
        reason = reason,
        details = details,
        #can be a str or None, it's fine as it is
    )
    
    db.session.add(report)
    db.session.commit()


    return {"id": report.id, "status": report.status}, 201