from app.models import User


def user_payload(user: User) -> dict:
    return {"id": user.id, "username": user.username, "email": user.email}


def public_user(user: User) -> dict:
    return {"username": user.username}
