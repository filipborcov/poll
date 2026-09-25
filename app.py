#!/usr/bin/env python3
"""
Team Rank Poll — MVP
Ранжирование участников 2 команд. Borda count.
Админ: /admin?key=SECRET
"""

import json
import os
import secrets
import time
from pathlib import Path

from flask import (
    Flask,
    render_template,
    request,
    redirect,
    url_for,
    session,
    flash,
    abort,
)

from config import TEAMS, ADMIN_SECRET, POLL_TITLE, POLL_SUBTITLE

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", secrets.token_hex(16))

DATA_DIR = Path(__file__).parent / "data"
VOTES_FILE = DATA_DIR / "votes.json"
DATA_DIR.mkdir(exist_ok=True)


def load_votes():
    if VOTES_FILE.exists():
        try:
            with open(VOTES_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return {"votes": [], "meta": {"created": time.time()}}


def save_votes(data):
    tmp = VOTES_FILE.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    tmp.replace(VOTES_FILE)


def has_voted(team_id: str) -> bool:
    voted = session.get("voted_teams", [])
    return team_id in voted


def mark_voted(team_id: str):
    voted = session.get("voted_teams", [])
    if team_id not in voted:
        voted.append(team_id)
        session["voted_teams"] = voted


def borda_scores(team_id: str, data: dict) -> list:
    """Aggregate Borda scores for a team. Rank 1 (most significant) = N points."""
    team = TEAMS.get(team_id)
    if not team:
        return []
    members = team["members"]
    n = len(members)
    scores = {m: 0 for m in members}
    vote_count = 0

    for vote in data.get("votes", []):
        if vote.get("team_id") != team_id:
            continue
        ranking = vote.get("ranking", [])
        # ranking: list of names from most to least significant
        vote_count += 1
        for pos, name in enumerate(ranking):
            if name in scores:
                # pos 0 = most significant → n points
                scores[name] += n - pos

    ranked = sorted(
        [{"name": name, "points": pts} for name, pts in scores.items()],
        key=lambda x: (-x["points"], x["name"]),
    )
    # add place numbers (handle ties by same points → same place concept simple)
    for i, item in enumerate(ranked):
        item["place"] = i + 1
        item["max_points"] = n * vote_count if vote_count else 0
    return ranked, vote_count


@app.route("/")
def index():
    return render_template(
        "index.html",
        title=POLL_TITLE,
        subtitle=POLL_SUBTITLE,
        teams=TEAMS,
        voted={tid: has_voted(tid) for tid in TEAMS},
    )


@app.route("/vote/<team_id>")
def vote_page(team_id):
    if team_id not in TEAMS:
        abort(404)
    if has_voted(team_id):
        flash("Вы уже проголосовали за эту команду.", "warning")
        return redirect(url_for("index"))

    team = TEAMS[team_id]
    # shuffle display order so no position bias? optional - keep original for MVP simplicity
    members = list(team["members"])
    return render_template(
        "vote.html",
        title=POLL_TITLE,
        team_id=team_id,
        team_name=team["name"],
        members=members,
    )


@app.route("/vote/<team_id>", methods=["POST"])
def submit_vote(team_id):
    if team_id not in TEAMS:
        abort(404)
    if has_voted(team_id):
        flash("Вы уже проголосовали за эту команду.", "warning")
        return redirect(url_for("index"))

    team = TEAMS[team_id]
    expected = set(team["members"])

    # ranking comes as ordered list from form: ranking[] = name1, name2, ...
    ranking = request.form.getlist("ranking")
    if not ranking:
        # fallback: parse from JSON body field
        raw = request.form.get("ranking_json", "")
        try:
            ranking = json.loads(raw) if raw else []
        except json.JSONDecodeError:
            ranking = []

    if set(ranking) != expected or len(ranking) != len(expected):
        flash("Нужно расставить ВСЕХ участников. Попробуйте ещё раз.", "error")
        return redirect(url_for("vote_page", team_id=team_id))

    data = load_votes()
    data["votes"].append(
        {
            "team_id": team_id,
            "ranking": ranking,
            "ts": time.time(),
            "ip": request.headers.get("X-Forwarded-For", request.remote_addr),
        }
    )
    save_votes(data)
    mark_voted(team_id)

    flash(f"Спасибо! Ваш рейтинг для «{team['name']}» сохранён.", "success")
    return redirect(url_for("index"))


@app.route("/admin")
def admin():
    key = request.args.get("key", "")
    if key != ADMIN_SECRET:
        abort(403)

    data = load_votes()
    results = {}
    for tid, team in TEAMS.items():
        ranked, count = borda_scores(tid, data)
        results[tid] = {
            "name": team["name"],
            "ranked": ranked,
            "vote_count": count,
            "member_count": len(team["members"]),
        }

    return render_template(
        "admin.html",
        title="Результаты — " + POLL_TITLE,
        results=results,
        admin_key=ADMIN_SECRET,
        total_ballots=len(data.get("votes", [])),
    )


@app.route("/admin/reset", methods=["POST"])
def admin_reset():
    key = request.form.get("key", "")
    if key != ADMIN_SECRET:
        abort(403)
    if request.form.get("confirm") == "yes":
        save_votes({"votes": [], "meta": {"created": time.time(), "reset_at": time.time()}})
        flash("Все голоса сброшены.", "success")
    return redirect(url_for("admin", key=key))


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    print(f"\n  Team Rank Poll")
    print(f"  Голосование:  http://0.0.0.0:{port}/")
    print(f"  Админ:        http://0.0.0.0:{port}/admin?key={ADMIN_SECRET}\n")
    app.run(host="0.0.0.0", port=port, debug=False)
