package com.memorylibrary.study;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public final class ReminderReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        ReviewReminder.createChannel(context);
        if (ReviewReminder.DAILY.equals(intent.getAction()) && ReviewReminder.prefs(context).getBoolean("enabled", false)) {
            ReviewReminder.post(context, false);
        }
        ReviewReminder.schedule(context);
    }
}
