package com.memorylibrary.study;

import java.util.Calendar;
import java.util.TimeZone;

/** Local calendar time, including timezone changes and daylight-saving days. */
public final class ReminderTime {
    public static long next(long now, int hour, int minute, TimeZone zone) {
        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) throw new IllegalArgumentException("Invalid reminder time");
        Calendar time = Calendar.getInstance(zone);
        time.setTimeInMillis(now);
        time.set(Calendar.HOUR_OF_DAY, hour);
        time.set(Calendar.MINUTE, minute);
        time.set(Calendar.SECOND, 0);
        time.set(Calendar.MILLISECOND, 0);
        if (time.getTimeInMillis() <= now) time.add(Calendar.DAY_OF_YEAR, 1);
        return time.getTimeInMillis();
    }
}
