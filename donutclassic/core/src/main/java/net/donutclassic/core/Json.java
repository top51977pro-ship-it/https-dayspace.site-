package net.donutclassic.core;

import java.util.*;

/** Tiny JSON parser (objects -> Map, arrays -> List, numbers -> Double, true/false -> Boolean) for text components. */
public final class Json {
    private final String s; private int i;
    private Json(String s) { this.s = s; }
    /** Serialises Map/List/String/Number/Boolean/null (and arrays of those) to compact JSON. */
    public static String stringify(Object o) { StringBuilder sb = new StringBuilder(); write(sb, o); return sb.toString(); }

    private static void write(StringBuilder sb, Object o) {
        if (o == null) sb.append("null");
        else if (o instanceof String s) quote(sb, s);
        else if (o instanceof Boolean || o instanceof Integer || o instanceof Long || o instanceof Short || o instanceof Byte) sb.append(o);
        else if (o instanceof Number n) { double d = n.doubleValue(); sb.append(Double.isFinite(d) ? String.valueOf(d) : "null"); }
        else if (o instanceof Map<?, ?> m) {
            sb.append('{'); boolean first = true;
            for (var e : m.entrySet()) { if (!first) sb.append(','); first = false; quote(sb, String.valueOf(e.getKey())); sb.append(':'); write(sb, e.getValue()); }
            sb.append('}');
        } else if (o instanceof Iterable<?> it) {
            sb.append('['); boolean first = true;
            for (Object e : it) { if (!first) sb.append(','); first = false; write(sb, e); }
            sb.append(']');
        } else if (o instanceof Object[] arr) write(sb, java.util.Arrays.asList(arr));
        else quote(sb, String.valueOf(o));
    }

    private static void quote(StringBuilder sb, String s) {
        sb.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> { if (c < 0x20) sb.append(String.format("\\u%04x", (int) c)); else sb.append(c); }
            }
        }
        sb.append('"');
    }

    public static Object parse(String s) { Json j = new Json(s); Object v = j.value(); j.ws(); if (j.i != s.length()) throw new IllegalArgumentException("trailing"); return v; }

    private void ws() { while (i < s.length() && Character.isWhitespace(s.charAt(i))) i++; }
    private Object value() {
        ws();
        if (i >= s.length()) throw new IllegalArgumentException("eof");
        char c = s.charAt(i);
        if (c == '{') { i++; Map<String, Object> m = new LinkedHashMap<>(); ws(); if (s.charAt(i) == '}') { i++; return m; }
            while (true) { ws(); String k = str(); ws(); expect(':'); m.put(k, value()); ws(); if (s.charAt(i) == ',') { i++; continue; } expect('}'); return m; } }
        if (c == '[') { i++; List<Object> l = new ArrayList<>(); ws(); if (s.charAt(i) == ']') { i++; return l; }
            while (true) { l.add(value()); ws(); if (s.charAt(i) == ',') { i++; continue; } expect(']'); return l; } }
        if (c == '"') return str();
        if (s.startsWith("true", i)) { i += 4; return true; }
        if (s.startsWith("false", i)) { i += 5; return false; }
        if (s.startsWith("null", i)) { i += 4; return null; }
        int st = i; while (i < s.length() && "+-0123456789.eE".indexOf(s.charAt(i)) >= 0) i++;
        if (st == i) throw new IllegalArgumentException("bad json at " + i);
        return Double.parseDouble(s.substring(st, i));
    }
    private void expect(char c) { if (i >= s.length() || s.charAt(i) != c) throw new IllegalArgumentException("expected " + c); i++; }
    private String str() {
        expect('"'); StringBuilder sb = new StringBuilder();
        while (true) {
            char c = s.charAt(i++);
            if (c == '"') return sb.toString();
            if (c == '\\') {
                char e = s.charAt(i++);
                switch (e) {
                    case 'n' -> sb.append('\n'); case 't' -> sb.append('\t'); case 'r' -> sb.append('\r');
                    case 'b' -> sb.append('\b'); case 'f' -> sb.append('\f');
                    case 'u' -> { sb.append((char) Integer.parseInt(s.substring(i, i + 4), 16)); i += 4; }
                    default -> sb.append(e);
                }
            } else sb.append(c);
        }
    }
}
