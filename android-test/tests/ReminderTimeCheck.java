package com.memorylibrary.study;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.TimeZone;

public final class ReminderTimeCheck {
    private static long time(String local, String zone) {
        return LocalDateTime.parse(local).atZone(ZoneId.of(zone)).toInstant().toEpochMilli();
    }
    private static void check(String now, int hour, int minute, String expected, String zone) {
        long actual = ReminderTime.next(time(now, zone), hour, minute, TimeZone.getTimeZone(zone));
        if (actual != time(expected, zone)) throw new AssertionError(now + " -> " + actual + ", expected " + expected);
    }
    public static void main(String[] args) {
        check("2026-10-28T19:00:00", 20, 0, "2026-10-28T20:00:00", "Asia/Shanghai");
        check("2026-10-28T20:00:00", 20, 0, "2026-10-29T20:00:00", "Asia/Shanghai");
        check("2026-12-31T20:00:01", 20, 0, "2027-01-01T20:00:00", "Asia/Shanghai");
        check("2026-10-28T23:59:59", 0, 0, "2026-10-29T00:00:00", "Asia/Shanghai");
        check("2026-03-07T20:01:00", 20, 0, "2026-03-08T20:00:00", "America/New_York");
        check("2026-10-31T20:01:00", 20, 0, "2026-11-01T20:00:00", "America/New_York");
        try { ReminderTime.next(0, 24, 0, TimeZone.getDefault()); throw new AssertionError("Invalid time accepted"); }
        catch (IllegalArgumentException expected) { }
        System.out.println("PASS: reminder wall-clock times, equal-time rollover, midnight, year rollover and daylight-saving days.");
    }
}
