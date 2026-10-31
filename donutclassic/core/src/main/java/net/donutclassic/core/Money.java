package net.donutclassic.core;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Locale;

/** Money is stored as cents (long). Parsing accepts 1.5k / 2m / 3b; negatives, NaN and overflow are rejected. */
public final class Money {
    private Money() { }

    /** @return cents, or -1 if invalid / negative / too large. */
    public static long parse(String s) {
        if (s == null) return -1;
        s = s.trim().toLowerCase(Locale.ROOT).replace(",", "").replace("$", "");
        if (s.isEmpty()) return -1;
        BigDecimal mult = BigDecimal.ONE;
        char last = s.charAt(s.length() - 1);
        switch (last) {
            case 'k' -> mult = BigDecimal.valueOf(1_000L);
            case 'm' -> mult = BigDecimal.valueOf(1_000_000L);
            case 'b' -> mult = BigDecimal.valueOf(1_000_000_000L);
            case 't' -> mult = BigDecimal.valueOf(1_000_000_000_000L);
            default -> { }
        }
        if (mult.compareTo(BigDecimal.ONE) != 0) s = s.substring(0, s.length() - 1);
        try {
            BigDecimal v = new BigDecimal(s).multiply(mult).multiply(BigDecimal.valueOf(100)).setScale(0, RoundingMode.DOWN);
            if (v.signum() < 0 || v.compareTo(BigDecimal.valueOf(Ledger.MAX_BALANCE)) > 0) return -1;
            return v.longValueExact();
        } catch (NumberFormatException | ArithmeticException e) { return -1; }
    }

    /** Whole-number parse for shards/keys/amounts; -1 if invalid. */
    public static long parseWhole(String s, long max) {
        try { long v = Long.parseLong(s.trim().replace(",", "")); return v < 0 || v > max ? -1 : v; }
        catch (Exception e) { return -1; }
    }

    /** $1.25K style. */
    public static String format(long cents) {
        double d = cents / 100.0;
        String[] suf = {"", "K", "M", "B", "T", "Q"};
        int i = 0;
        while (Math.abs(d) >= 1000 && i < suf.length - 1) { d /= 1000; i++; }
        String n = i == 0 ? (cents % 100 == 0 ? String.valueOf((long) d) : String.format(Locale.ROOT, "%.2f", d))
                          : trim(String.format(Locale.ROOT, "%.2f", d));
        return "$" + n + suf[i];
    }

    public static String formatWhole(long v) { return String.format(Locale.ROOT, "%,d", v); }

    private static String trim(String s) { return s.contains(".") ? s.replaceAll("0+$", "").replaceAll("\\.$", "") : s; }

    /** price * qty with overflow protection; -1 if overflow. */
    public static long mul(long price, long qty) {
        try { long v = Math.multiplyExact(price, qty); return v > Ledger.MAX_BALANCE ? -1 : v; }
        catch (ArithmeticException e) { return -1; }
    }

    /** Applies a percentage multiplier (e.g. 1.5x) safely; result floors to cents. */
    public static long applyMultiplier(long cents, double mult) {
        if (mult <= 0 || Double.isNaN(mult) || Double.isInfinite(mult)) return 0;
        BigDecimal v = BigDecimal.valueOf(cents).multiply(BigDecimal.valueOf(mult)).setScale(0, RoundingMode.DOWN);
        return v.compareTo(BigDecimal.valueOf(Ledger.MAX_BALANCE)) > 0 ? Ledger.MAX_BALANCE : v.longValue();
    }

    /** Fee in basis-points-free percent (e.g. 5.0 = 5%), floored. */
    public static long percent(long cents, double pct) { return applyMultiplier(cents, pct / 100.0); }
}
