package com.memorylibrary.study;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.Calendar;
import java.util.TimeZone;

public final class ReviewReminder {
    public static final String DAILY = "com.memorylibrary.study.DAILY_REVIEW";
    public static final String OPEN_TODAY = "com.memorylibrary.study.OPEN_TODAY";
    private static final String CHANNEL = "daily-review-v1";
    private static final int DAILY_ID = 501, TEST_ID = 502;

    static SharedPreferences prefs(Context context) { return context.getSharedPreferences("review-reminders", Context.MODE_PRIVATE); }

    public static void createChannel(Context context) {
        NotificationChannel channel = new NotificationChannel(CHANNEL, "每日复习", NotificationManager.IMPORTANCE_DEFAULT);
        channel.setDescription("每天提醒复习到期的记忆卡片");
        context.getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }

    public static boolean permitted(Context context) {
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        NotificationChannel channel = manager.getNotificationChannel(CHANNEL);
        return manager.areNotificationsEnabled() && channel != null && channel.getImportance() != NotificationManager.IMPORTANCE_NONE;
    }

    private static PendingIntent alarmIntent(Context context) {
        return PendingIntent.getBroadcast(context, 1001, new Intent(context, ReminderReceiver.class).setAction(DAILY), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    public static void schedule(Context context) {
        SharedPreferences settings = prefs(context);
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        alarms.cancel(alarmIntent(context));
        settings.edit().putLong("scheduledAt", 0).apply();
        if (!settings.getBoolean("enabled", false)) return;
        long next = ReminderTime.next(System.currentTimeMillis(), settings.getInt("hour", 20), settings.getInt("minute", 0), TimeZone.getDefault());
        try {
            // Inexact alarms avoid restricted exact-alarm access. Power saving can delay delivery.
            alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next, alarmIntent(context));
            settings.edit().putLong("scheduledAt", next).putString("error", "").apply();
        } catch (RuntimeException error) { settings.edit().putString("error", "系统未允许安排后台提醒，请检查卓易通的后台运行设置。").apply(); }
    }

    public static void configure(Context context, boolean enabled, int hour, int minute) {
        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return;
        prefs(context).edit().putBoolean("enabled", enabled).putInt("hour", hour).putInt("minute", minute).putString("error", "").apply();
        if (!enabled) context.getSystemService(NotificationManager.class).cancel(DAILY_ID);
        schedule(context);
    }

    public static void sync(Context context, String json) throws JSONException {
        if (json == null || json.length() > 5 * 1024 * 1024) throw new JSONException("Invalid review snapshot");
        JSONObject snapshot = new JSONObject(json);
        JSONArray cards = snapshot.getJSONArray("cards");
        int goal = snapshot.getInt("goal");
        if (goal < 2 || goal > 12 || cards.length() > 100000) throw new JSONException("Invalid review snapshot");
        JSONArray normalized = new JSONArray();
        for (int i = 0; i < cards.length(); i++) {
            JSONObject card = cards.getJSONObject(i);
            long due = card.getLong("dueAt");
            int streak = card.getInt("streak");
            if (due < 0 || streak < 0) throw new JSONException("Invalid card schedule");
            normalized.put(new JSONObject().put("dueAt", due).put("streak", streak));
        }
        if (!prefs(context).edit().putString("cards", normalized.toString()).putInt("goal", goal).commit())
            throw new JSONException("Reminder snapshot could not be saved");
        if (dueCount(context) == 0) context.getSystemService(NotificationManager.class).cancel(DAILY_ID);
    }

    public static int dueCount(Context context) {
        Calendar tomorrow = Calendar.getInstance();
        tomorrow.set(Calendar.HOUR_OF_DAY, 0); tomorrow.set(Calendar.MINUTE, 0);
        tomorrow.set(Calendar.SECOND, 0); tomorrow.set(Calendar.MILLISECOND, 0);
        tomorrow.add(Calendar.DAY_OF_YEAR, 1);
        int count = 0;
        try {
            JSONArray cards = new JSONArray(prefs(context).getString("cards", "[]"));
            int goal = prefs(context).getInt("goal", 6);
            for (int i = 0; i < cards.length(); i++) {
                JSONObject card = cards.getJSONObject(i);
                if (card.getLong("dueAt") < tomorrow.getTimeInMillis() && card.getInt("streak") < goal) count++;
            }
        } catch (JSONException error) { return 0; }
        return count;
    }

    public static boolean post(Context context, boolean test) {
        createChannel(context);
        if (!permitted(context)) return false;
        int count = dueCount(context);
        if (!test && count == 0) return false;
        Intent intent = new Intent(context, MainActivity.class).setAction(OPEN_TODAY)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent open = PendingIntent.getActivity(context, 1002, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        int icon = context.getResources().getIdentifier("notification_cards", "drawable", context.getPackageName());
        Notification notification = new Notification.Builder(context, CHANNEL)
            .setSmallIcon(icon).setColor(0xFFB9210C)
            .setContentTitle(test ? "复习通知测试" : "该翻翻今天的卡片了")
            .setContentText(test ? "通知已送达，点击进入今日复习。" : "今天有 " + count + " 张卡片等待复习，点击开始。")
            .setContentIntent(open).setAutoCancel(true)
            .setCategory(Notification.CATEGORY_REMINDER).build();
        try { context.getSystemService(NotificationManager.class).notify(test ? TEST_ID : DAILY_ID, notification); return true; }
        catch (SecurityException error) { return false; }
    }

    public static String status(Context context) {
        SharedPreferences settings = prefs(context);
        try {
            return new JSONObject().put("enabled", settings.getBoolean("enabled", false))
                .put("hour", settings.getInt("hour", 20)).put("minute", settings.getInt("minute", 0))
                .put("permitted", permitted(context)).put("scheduledAt", settings.getLong("scheduledAt", 0))
                .put("error", settings.getString("error", ""))
                .put("testMessage", settings.getString("testMessage", "")).toString();
        } catch (JSONException error) { return "{}"; }
    }
}
