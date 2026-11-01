from sqlalchemy import Select, and_, or_, select
from sqlalchemy.exc import IntegrityError

from app.auth.serializers import public_user
from app.errors import Conflict, NotFound, ValidationError
from app.extensions import db
from app.models import Friendship, User


def _between(user: User, other: User) -> Friendship | None:
    return db.session.scalar(
        select(Friendship).where(
            or_(
                and_(Friendship.requester_id == user.id, Friendship.addressee_id == other.id),
                and_(Friendship.requester_id == other.id, Friendship.addressee_id == user.id),
            )
        )
    )


def friend_ids(user: User) -> Select:
    other_id = db.case(
        (Friendship.requester_id == user.id, Friendship.addressee_id),
        else_=Friendship.requester_id,
    )
    return select(other_id).where(
        Friendship.accepted_at.is_not(None),
        or_(Friendship.requester_id == user.id, Friendship.addressee_id == user.id),
    )


def friends_payload(user: User) -> dict:
    rows = db.session.scalars(
        select(Friendship)
        .where(or_(Friendship.requester_id == user.id, Friendship.addressee_id == user.id))
        .order_by(Friendship.created_at.desc(), Friendship.id.desc())
    ).all()
    friends, incoming, outgoing = [], [], []
    for row in rows:
        other = row.addressee if row.requester_id == user.id else row.requester
        if row.accepted_at is not None:
            friends.append({"user": public_user(other), "since": row.accepted_at.isoformat()})
        elif row.addressee_id == user.id:
            incoming.append({"user": public_user(other), "sent_at": row.created_at.isoformat()})
        else:
            outgoing.append({"user": public_user(other), "sent_at": row.created_at.isoformat()})
    friends.sort(key=lambda friend: friend["user"]["username"])
    return {"friends": friends, "incoming": incoming, "outgoing": outgoing}


def _accept(row: Friendship) -> None:
    row.accepted_at = db.func.now()
    db.session.commit()


def send_request(user: User, target: User) -> str:
    if target.id == user.id:
        raise ValidationError("You can't add yourself")
    existing = _between(user, target)
    if existing is not None:
        if existing.accepted_at is not None:
            raise Conflict("Already friends")
        if existing.requester_id == user.id:
            raise Conflict("Request already sent")
        _accept(existing)
        return "friends"
    db.session.add(Friendship(requester_id=user.id, addressee_id=target.id))
    try:
        db.session.commit()
    except IntegrityError:
        # a simultaneous request for the same pair won the unique index
        db.session.rollback()
        existing = _between(user, target)
        if existing is None or existing.accepted_at is not None:
            raise Conflict("Already friends") from None
        if existing.requester_id == user.id:
            raise Conflict("Request already sent") from None
        _accept(existing)
        return "friends"
    return "sent"


def accept_request(user: User, requester: User) -> None:
    row = db.session.scalar(
        select(Friendship).where(
            Friendship.requester_id == requester.id,
            Friendship.addressee_id == user.id,
            Friendship.accepted_at.is_(None),
        )
    )
    if row is None:
        raise NotFound("Friend request not found")
    _accept(row)


def remove_friend(user: User, other: User) -> None:
    row = _between(user, other)
    if row is None:
        raise NotFound("Not friends or requested")
    db.session.delete(row)
    db.session.commit()
