package com.runriver.app;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import org.json.JSONArray;
import org.json.JSONObject;

/** Native storage is authoritative even when the WebView is suspended. */
final class RunStore extends SQLiteOpenHelper {
    RunStore(Context context) { super(context, "run-river.db", null, 1); }

    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE session (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL)");
        db.execSQL("CREATE TABLE fixes (id INTEGER PRIMARY KEY AUTOINCREMENT, json TEXT NOT NULL)");
    }
    @Override public void onUpgrade(SQLiteDatabase db, int from, int to) { throw new IllegalStateException("Unsupported database version"); }

    JSONObject state() throws Exception {
        try (Cursor cursor = getReadableDatabase().rawQuery("SELECT json FROM session WHERE id=1", null)) {
            return cursor.moveToFirst() ? new JSONObject(cursor.getString(0)) : null;
        }
    }

    void save(JSONObject state, JSONObject point) {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            ContentValues values = new ContentValues(); values.put("id", 1); values.put("json", state.toString());
            db.replaceOrThrow("session", null, values);
            if (point != null) {
                values = new ContentValues(); values.put("json", point.toString());
                db.insertOrThrow("fixes", null, values);
            }
            db.setTransactionSuccessful();
        } finally { db.endTransaction(); }
    }

    JSONArray points() throws Exception {
        JSONArray result = new JSONArray();
        try (Cursor cursor = getReadableDatabase().rawQuery("SELECT json FROM fixes ORDER BY id", null)) {
            while (cursor.moveToNext()) result.put(new JSONObject(cursor.getString(0)));
        }
        return result;
    }

    void clear(String runId) throws Exception {
        JSONObject state = state();
        if (state == null) return;
        if (!state.getJSONObject("config").getString("runId").equals(runId) || !state.getString("status").equals("finished")) {
            throw new IllegalStateException("Only an exported finished run can be cleared");
        }
        SQLiteDatabase db = getWritableDatabase(); db.beginTransaction();
        try {
            db.delete("session", null, null); db.delete("fixes", null, null); db.setTransactionSuccessful();
        } finally { db.endTransaction(); }
    }
}
