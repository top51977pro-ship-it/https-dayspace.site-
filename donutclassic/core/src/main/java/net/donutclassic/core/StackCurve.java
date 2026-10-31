package net.donutclassic.core;

import java.util.Map;
import java.util.TreeMap;

/**
 * Diminishing-returns curve for stacked spawners. APPROXIMATION: the historical wiki only says each
 * extra spawner in a stack adds less than a separate block; the exact official formula is unknown.
 *
 * mode "power":  effective = stack ^ exponent             (default exponent 0.85)
 * mode "table":  piecewise-linear interpolation of (stack -> effective) points from config.
 * Effective output is always >= 1 for stack >= 1, monotonic and never above the stack size.
 */
public final class StackCurve {
    private final String mode;
    private final double exponent;
    private final TreeMap<Integer, Double> table;
    private final int maxStack;

    public StackCurve(String mode, double exponent, Map<Integer, Double> table, int maxStack) {
        this.mode = mode == null ? "power" : mode;
        this.exponent = Math.max(0.1, Math.min(1.0, exponent));
        this.table = new TreeMap<>(table == null ? Map.of() : table);
        this.table.putIfAbsent(1, 1.0);
        this.maxStack = Math.max(1, maxStack);
    }

    public static StackCurve defaults() { return new StackCurve("power", 0.85, null, 10_000); }

    public int maxStack() { return maxStack; }

    public double effective(long stack) {
        if (stack <= 0) return 0;
        long s = Math.min(stack, maxStack);
        double v;
        if ("table".equalsIgnoreCase(mode) && table.size() > 1) {
            Map.Entry<Integer, Double> lo = table.floorEntry((int) s), hi = table.ceilingEntry((int) s);
            if (lo == null) v = hi.getValue();
            else if (hi == null || hi.getKey().equals(lo.getKey())) v = lo.getValue() * (hi == null ? (double) s / lo.getKey() : 1);
            else {
                double t = (double) (s - lo.getKey()) / (hi.getKey() - lo.getKey());
                v = lo.getValue() + t * (hi.getValue() - lo.getValue());
            }
        } else v = Math.pow(s, exponent);
        return Math.max(1.0, Math.min(v, s));
    }
}
