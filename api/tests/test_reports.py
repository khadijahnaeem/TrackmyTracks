import pytest

from app.extensions import db
from app.models import Report

REPORTS = "/api/reports"

# testing if creating the report with no invalid args wworks in general


def test_create_user_report(client, make_user, login):

    # make the users
    reporter = make_user("reporter")
    reported_user = make_user("reported")

    # make sure the reporter is logged in

    login(reporter)

    response = client.post(
        REPORTS,
        json={
            "reported_user_id": reported_user.id,
            "reason": "spam",
            "details": "this is a test report",
        },
    )

    # make sure the HTTP status code and status of the report is good
    assert response.status_code == 201
    assert response.json["status"] == "pending"

    report = db.session.get(Report, response.json["id"])
    # IMPORTANT sql alchemy queries the Report table and retrieves the id
    # returned by the api
    # this db.session.get() retrieves the corresponding Report object with primary key report id
    # from the db session

    # Verify the saved report has the correct reporter ID.

    # making sure the reason, details, and status are all as they should be
    assert report is not None
    assert report.reporter_id == reporter.id
    assert report.reported_user_id == reported_user.id
    assert report.reason == "spam"
    assert report.details == "this is a test report"
    assert report.status == "pending"


# testing invalid input/ faulty reports do not get generated with bad args


def test_report_requires_login(client, make_user):
    reported_user = make_user("reported")  # user made

    response = client.post(
        REPORTS,
        json={
            "reported_user_id": reported_user.id,
            "reason": "Spam",
        },
    )

    # BUT really important: reported_user was made, but no one is logged in
    assert response.status_code == 401
    assert response.json["error"]["code"] == "unauthorized"


def test_cannot_report_yourself(client, make_user, login):
    reporter = make_user("reporter")
    login(reporter)

    response = client.post(
        REPORTS,
        json={
            "reported_user_id": reporter.id,
            "reason": "Spam",
        },
    )

    assert response.status_code == 422
    assert response.json["error"]["code"] == "validation_error"


def test_report_nonexistent_user(client, make_user, login):
    reporter = make_user("reporter")
    login(reporter)

    response = client.post(
        REPORTS,
        json={
            "reported_user_id": 99999,  # This user does not exist
            "reason": "spam",
        },
    )

    assert response.status_code == 404
    assert response.json["error"]["code"] == "not_found"


@pytest.mark.parametrize(
    "reason",
    [
        "",
        "   ",
        "x" * 101,  # if it's more than 100 chars
        123,  # only number
        None,  # null reason
    ],
)
def test_report_rejects_invalid_reason(client, make_user, login, reason):
    reporter = make_user("reporter")
    reported_user = make_user("reported")

    login(reporter)

    response = client.post(
        REPORTS,
        json={
            "reported_user_id": reported_user.id,
            "reason": reason,
        },
    )

    assert response.status_code == 422
    assert response.json["error"]["code"] == "validation_error"

    # test that a rating with a review can be reported


def test_create_review_report(client, make_user, login, make_artist, make_song, rate):
    reporter = make_user("reporter")
    reviewer = make_user("reviewer")

    artist = make_artist()
    song = make_song(artist)

    rating = rate(
        reviewer,
        song,
        stars=4.0,
        review="This is a sample review.",
    )

    login(reporter)  # make sure reporter is logged in

    response = client.post(
        REPORTS,
        json={
            "rating_id": rating.id,
            "reason": "spam",
            "details": "this review contains advertisements",
        },
    )

    # check that the API successfully created the report
    assert response.status_code == 201
    assert response.json["status"] == "pending"

    # retrieve the saved report using its primary key
    report = db.session.get(Report, response.json["id"])

    # verify the report targets the correct review
    assert report is not None
    assert report.reporter_id == reporter.id
    assert report.rating_id == rating.id
    assert report.reported_user_id is None
    # this last assert is because the report should targt the rating with a review this time
    # not a user
    # that has already been tested

    # verify the report info was saved correctly
    assert report.reason == "spam"
    assert report.details == "this review contains advertisements"
    assert report.status == "pending"


# user cannot report their own review
def test_cannot_report_own_review(client, make_user, login, make_artist, make_song, rate):
    reviewer = make_user("reviewer")
    artist = make_artist()
    song = make_song(artist)
    rating = rate(reviewer, song, stars=4.0, review="My review")

    login(reviewer)  # make sure reviewer is logged in

    response = client.post(
        REPORTS,
        json={"rating_id": rating.id, "reason": "Spam"},
    )

    assert response.status_code == 422
    assert response.json["error"]["code"] == "validation_error"


# can't report a view that doesn't exist - 404 error
def test_report_nonexistent_review(client, make_user, login):
    reporter = make_user("reporter")
    login(reporter)

    response = client.post(
        REPORTS,
        json={"rating_id": 99999, "reason": "Spam"},
    )

    assert response.status_code == 404
    assert response.json["error"]["code"] == "not_found"


# you cannot report only their starred rating w/o a reviwew
# at that point, it's just reporting because you don't agree with their rating
# only a written review or a specific user can be reported
def test_cannot_report_rating_without_review(
    client, make_user, login, make_artist, make_song, rate
):
    reporter = make_user("reporter")
    reviewer = make_user("reviewer")

    artist = make_artist()
    song = make_song(artist)
    rating = rate(reviewer, song, stars=4.0)

    login(reporter)

    response = client.post(
        REPORTS,
        json={"rating_id": rating.id, "reason": "Spam"},
    )

    assert response.status_code == 422
    assert response.json["error"]["code"] == "validation_error"


def test_create_user_report_by_username(client, make_user, login):
    reporter = make_user("reporter")
    reported_user = make_user("reported")

    login(reporter)

    response = client.post(
        REPORTS,
        json={
            "reported_username": reported_user.username,
            "reason": "spam",
            "details": "Testing username-based reporting",
        },
    )

    assert response.status_code == 201
    assert response.json["status"] == "pending"

    # make sure the user id is tied correctly to their username
    report = db.session.get(Report, response.json["id"])

    assert report is not None
    assert report.reporter_id == reporter.id
    assert report.reported_user_id == reported_user.id
    assert report.reason == "spam"
    assert report.details == "Testing username-based reporting"


def test_cannot_report_yourself_by_username(client, make_user, login):
    reporter = make_user("reporter")
    login(reporter)

    response = client.post(
        REPORTS,
        json={
            "reported_username": reporter.username,
            "reason": "spam",
        },
    )

    assert response.status_code == 422
