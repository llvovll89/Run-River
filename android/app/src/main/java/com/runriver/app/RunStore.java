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
    private boolean configStored;
    RunStore(Context context) { super(context, "run-river.db", null, 2); }

    @Override public void onCreate(SQLiteDatabase db) {
        db.execSQL("CREATE TABLE session (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL)");
        db.execSQL("CREATE TABLE fixes (id INTEGER PRIMARY KEY AUTOINCREMENT, json TEXT NOT NULL)");
        db.execSQL("CREATE TABLE config (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL)");
    }
    @Override public void onUpgrade(SQLiteDatabase db, int from, int to) {
        if (from != 1 || to != 2) throw new IllegalStateException("Unsupported database version");
        db.execSQL("CREATE TABLE config (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL)");
        try (Cursor cursor = db.rawQuery("SELECT json FROM session WHERE id=1", null)) {
            if (cursor.moveToFirst()) {
                JSONObject state = new JSONObject(cursor.getString(0));
                if (state.has("config")) {
                    db.execSQL("INSERT INTO config(id,json) VALUES(1,?)", new Object[]{state.getJSONObject("config").toString()});
                    state.remove("config");
                    db.execSQL("UPDATE session SET json=? WHERE id=1", new Object[]{state.toString()});
                }
            }
        } catch (Exception error) { throw new IllegalStateException("운동 저장소를 업데이트하지 못했어요.", error); }
    }

    JSONObject state() throws Exception {
        try (Cursor cursor = getReadableDatabase().rawQuery("SELECT json FROM session WHERE id=1", null)) {
            if (!cursor.moveToFirst()) return null;
            JSONObject state = new JSONObject(cursor.getString(0));
            try (Cursor config = getReadableDatabase().rawQuery("SELECT json FROM config WHERE id=1", null)) {
                if (config.moveToFirst()) state.put("config", new JSONObject(config.getString(0)));
            }
            return state;
        }
    }

    void save(JSONObject state, JSONObject point) throws Exception {
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            if (!configStored && state.has("config") && android.database.DatabaseUtils.longForQuery(db, "SELECT count(*) FROM config", null) == 0) {
                ContentValues config = new ContentValues(); config.put("id", 1); config.put("json", state.getJSONObject("config").toString());
                db.insertOrThrow("config", null, config);
            }
            JSONObject metrics = new JSONObject();
            java.util.Iterator<String> keys = state.keys();
            while (keys.hasNext()) { String key = keys.next(); if (!key.equals("config")) metrics.put(key, state.get(key)); }
            ContentValues values = new ContentValues(); values.put("id", 1); values.put("json", metrics.toString());
            db.replaceOrThrow("session", null, values);
            if (point != null) {
                values = new ContentValues(); values.put("json", point.toString());
                db.insertOrThrow("fixes", null, values);
            }
            db.setTransactionSuccessful();
        } finally { db.endTransaction(); }
        configStored = state.has("config");
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
            db.delete("session", null, null); db.delete("fixes", null, null); db.delete("config", null, null); db.setTransactionSuccessful();
        } finally { db.endTransaction(); }
        configStored = false;
    }
}
