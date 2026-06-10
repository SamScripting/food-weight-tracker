from flask import Flask, jsonify, request, render_template
from database import get_db, init_db

app = Flask(__name__)


@app.before_request
def startup():
    init_db()


# ── Frontend ──────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


# ── Foods ─────────────────────────────────────────────────────────────────────

@app.route("/api/foods", methods=["GET"])
def get_foods():
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM foods ORDER BY LOWER(name)").fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/foods", methods=["POST"])
def add_food():
    data = request.get_json()
    name = data.get("name", "").strip()
    cal = data.get("calories_per_serving")
    pro = data.get("protein_per_serving")
    if not name or cal is None or pro is None:
        return jsonify({"error": "name, calories_per_serving, and protein_per_serving are required"}), 400
    try:
        with get_db() as conn:
            cur = conn.execute(
                "INSERT INTO foods (name, calories_per_serving, protein_per_serving) VALUES (?, ?, ?)",
                (name, cal, pro)
            )
            food_id = cur.lastrowid
        return jsonify({"id": food_id, "name": name, "calories_per_serving": cal, "protein_per_serving": pro}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 409


@app.route("/api/foods/<int:food_id>", methods=["PUT"])
def update_food(food_id):
    data = request.get_json()
    name = data.get("name", "").strip()
    cal = data.get("calories_per_serving")
    pro = data.get("protein_per_serving")
    if not name or cal is None or pro is None:
        return jsonify({"error": "name, calories_per_serving, and protein_per_serving are required"}), 400
    with get_db() as conn:
        conflict = conn.execute(
            "SELECT id FROM foods WHERE LOWER(name) = LOWER(?) AND id != ?", (name, food_id)
        ).fetchone()
        if conflict:
            return jsonify({"error": f'"{name}" already exists (case-insensitive match).'}), 409
        conn.execute(
            "UPDATE foods SET name=?, calories_per_serving=?, protein_per_serving=? WHERE id=?",
            (name, cal, pro, food_id)
        )
    return jsonify({"ok": True})


@app.route("/api/foods/<int:food_id>", methods=["DELETE"])
def delete_food(food_id):
    with get_db() as conn:
        in_use = conn.execute(
            "SELECT COUNT(*) FROM food_log WHERE food_id=?", (food_id,)
        ).fetchone()[0]
        if in_use:
            return jsonify({"error": "Food is referenced in the log. Remove those entries first."}), 409
        conn.execute("DELETE FROM foods WHERE id=?", (food_id,))
    return jsonify({"ok": True})


# ── Food Log ──────────────────────────────────────────────────────────────────

@app.route("/api/log", methods=["GET"])
def get_log():
    date = request.args.get("date")
    if not date:
        return jsonify({"error": "date query param required"}), 400
    with get_db() as conn:
        rows = conn.execute("""
            SELECT fl.id, fl.date, fl.food_id, fl.servings,
                   f.name, f.calories_per_serving, f.protein_per_serving,
                   ROUND(fl.servings * f.calories_per_serving, 0) AS total_calories,
                   ROUND(fl.servings * f.protein_per_serving, 0)  AS total_protein
            FROM food_log fl
            JOIN foods f ON f.id = fl.food_id
            WHERE fl.date = ?
            ORDER BY fl.id
        """, (date,)).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/log", methods=["POST"])
def add_log_entry():
    data = request.get_json()
    date = data.get("date", "").strip()
    food_id = data.get("food_id")
    servings = data.get("servings")
    if not date or food_id is None or servings is None:
        return jsonify({"error": "date, food_id, and servings are required"}), 400
    with get_db() as conn:
        exists = conn.execute(
            "SELECT id FROM food_log WHERE date = ? AND food_id = ?", (date, food_id)
        ).fetchone()
        if exists:
            food = conn.execute("SELECT name FROM foods WHERE id = ?", (food_id,)).fetchone()
            name = food["name"] if food else "That food"
            return jsonify({"error": f'"{name}" is already logged for this date. Edit the servings directly in the table.'}), 409
        cur = conn.execute(
            "INSERT INTO food_log (date, food_id, servings) VALUES (?, ?, ?)",
            (date, food_id, servings)
        )
    return jsonify({"id": cur.lastrowid}), 201


@app.route("/api/log/<int:entry_id>", methods=["PUT"])
def update_log_entry(entry_id):
    data = request.get_json()
    servings = data.get("servings")
    if servings is None:
        return jsonify({"error": "servings is required"}), 400
    with get_db() as conn:
        conn.execute("UPDATE food_log SET servings=? WHERE id=?", (servings, entry_id))
    return jsonify({"ok": True})


@app.route("/api/log/<int:entry_id>", methods=["DELETE"])
def delete_log_entry(entry_id):
    with get_db() as conn:
        conn.execute("DELETE FROM food_log WHERE id=?", (entry_id,))
    return jsonify({"ok": True})


# ── Weight ────────────────────────────────────────────────────────────────────

@app.route("/api/weight", methods=["GET"])
def get_weight():
    date = request.args.get("date")
    if not date:
        return jsonify({"error": "date query param required"}), 400
    with get_db() as conn:
        row = conn.execute("SELECT * FROM weight_log WHERE date=?", (date,)).fetchone()
    return jsonify(dict(row) if row else {})


@app.route("/api/weight", methods=["POST"])
def upsert_weight():
    data = request.get_json()
    date = data.get("date", "").strip()
    weight = data.get("weight_lbs")
    if not date or weight is None:
        return jsonify({"error": "date and weight_lbs are required"}), 400
    with get_db() as conn:
        conn.execute(
            "INSERT INTO weight_log (date, weight_lbs) VALUES (?, ?) "
            "ON CONFLICT(date) DO UPDATE SET weight_lbs=excluded.weight_lbs",
            (date, weight)
        )
    return jsonify({"ok": True})


# ── Summary ───────────────────────────────────────────────────────────────────

@app.route("/api/summary", methods=["GET"])
def get_summary():
    with get_db() as conn:
        rows = conn.execute("""
            SELECT
                d.date,
                ROUND(SUM(fl.servings * f.calories_per_serving), 0) AS total_calories,
                ROUND(SUM(fl.servings * f.protein_per_serving), 0)  AS total_protein,
                w.weight_lbs
            FROM (
                SELECT DISTINCT date FROM food_log
                UNION
                SELECT DISTINCT date FROM weight_log
            ) d
            LEFT JOIN food_log fl ON fl.date = d.date
            LEFT JOIN foods f ON f.id = fl.food_id
            LEFT JOIN weight_log w ON w.date = d.date
            GROUP BY d.date
            ORDER BY d.date DESC
        """).fetchall()
    return jsonify([dict(r) for r in rows])


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)