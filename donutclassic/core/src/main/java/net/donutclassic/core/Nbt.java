package net.donutclassic.core;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

/**
 * Minimal NBT reader/writer (Java edition, big-endian). Compounds -> LinkedHashMap, lists -> ArrayList,
 * arrays -> byte[]/int[]/long[], numbers -> boxed primitives. Enough to read Litematica files and to
 * re-encode item compounds for Paper's ItemStack.deserializeBytes.
 */
public final class Nbt {
    private Nbt() { }

    public static Map<String, Object> readGzip(File f) throws IOException {
        try (DataInputStream in = new DataInputStream(new BufferedInputStream(new GZIPInputStream(new FileInputStream(f), 1 << 16), 1 << 16))) {
            return readRoot(in);
        }
    }

    @SuppressWarnings("unchecked")
    public static Map<String, Object> readRoot(DataInputStream in) throws IOException {
        int type = in.readByte();
        if (type != 10) throw new IOException("Root is not a compound (" + type + ")");
        in.readUTF();
        return (Map<String, Object>) read(in, 10, 0);
    }

    private static Object read(DataInputStream in, int type, int depth) throws IOException {
        if (depth > 512) throw new IOException("NBT too deep");
        switch (type) {
            case 1: return in.readByte();
            case 2: return in.readShort();
            case 3: return in.readInt();
            case 4: return in.readLong();
            case 5: return in.readFloat();
            case 6: return in.readDouble();
            case 7: { byte[] b = new byte[len(in)]; in.readFully(b); return b; }
            case 8: return in.readUTF();
            case 9: {
                int t = in.readByte(); int n = in.readInt();
                if (n < 0) throw new IOException("negative list length");
                List<Object> l = new ArrayList<>(Math.min(n, 1 << 16));
                for (int i = 0; i < n; i++) l.add(read(in, t, depth + 1));
                return l;
            }
            case 10: {
                Map<String, Object> m = new LinkedHashMap<>();
                while (true) {
                    int t = in.readByte();
                    if (t == 0) return m;
                    String k = in.readUTF();
                    m.put(k, read(in, t, depth + 1));
                }
            }
            case 11: { int[] a = new int[len(in)]; for (int i = 0; i < a.length; i++) a[i] = in.readInt(); return a; }
            case 12: { long[] a = new long[len(in)]; for (int i = 0; i < a.length; i++) a[i] = in.readLong(); return a; }
            default: throw new IOException("Unknown NBT tag " + type);
        }
    }

    private static int len(DataInputStream in) throws IOException {
        int n = in.readInt();
        if (n < 0 || n > 200_000_000) throw new IOException("bad array length " + n);
        return n;
    }

    // ------------------------------------------------------------------ writer
    public static byte[] writeGzip(Map<String, Object> root) {
        try (ByteArrayOutputStream bo = new ByteArrayOutputStream()) {
            try (DataOutputStream out = new DataOutputStream(new GZIPOutputStream(bo))) {
                out.writeByte(10); out.writeUTF(""); writePayload(out, root);
            }
            return bo.toByteArray();
        } catch (IOException e) { throw new UncheckedIOException(e); }
    }

    public static void writeGzip(File f, Map<String, Object> root) throws IOException {
        try (FileOutputStream fo = new FileOutputStream(f)) { fo.write(writeGzip(root)); }
    }

    static int typeOf(Object o) {
        if (o instanceof Byte) return 1; if (o instanceof Short) return 2; if (o instanceof Integer) return 3;
        if (o instanceof Long) return 4; if (o instanceof Float) return 5; if (o instanceof Double) return 6;
        if (o instanceof byte[]) return 7; if (o instanceof String) return 8; if (o instanceof List) return 9;
        if (o instanceof Map) return 10; if (o instanceof int[]) return 11; if (o instanceof long[]) return 12;
        if (o instanceof Boolean) return 1;
        throw new IllegalArgumentException("Not NBT: " + o);
    }

    @SuppressWarnings("unchecked")
    private static void writePayload(DataOutputStream out, Object o) throws IOException {
        switch (typeOf(o)) {
            case 1 -> out.writeByte(o instanceof Boolean b ? (b ? 1 : 0) : (Byte) o);
            case 2 -> out.writeShort((Short) o);
            case 3 -> out.writeInt((Integer) o);
            case 4 -> out.writeLong((Long) o);
            case 5 -> out.writeFloat((Float) o);
            case 6 -> out.writeDouble((Double) o);
            case 7 -> { byte[] b = (byte[]) o; out.writeInt(b.length); out.write(b); }
            case 8 -> out.writeUTF((String) o);
            case 9 -> {
                List<Object> l = (List<Object>) o;
                int t = l.isEmpty() ? 0 : typeOf(l.get(0));
                out.writeByte(t); out.writeInt(l.size());
                for (Object e : l) writePayload(out, e);
            }
            case 10 -> {
                for (var e : ((Map<String, Object>) o).entrySet()) {
                    out.writeByte(typeOf(e.getValue())); out.writeUTF(e.getKey()); writePayload(out, e.getValue());
                }
                out.writeByte(0);
            }
            case 11 -> { int[] a = (int[]) o; out.writeInt(a.length); for (int v : a) out.writeInt(v); }
            case 12 -> { long[] a = (long[]) o; out.writeInt(a.length); for (long v : a) out.writeLong(v); }
            default -> throw new IllegalStateException();
        }
    }

    // ------------------------------------------------------------------ helpers
    @SuppressWarnings("unchecked") public static Map<String, Object> map(Object o) { return o instanceof Map ? (Map<String, Object>) o : Map.of(); }
    @SuppressWarnings("unchecked") public static List<Object> list(Object o) { return o instanceof List ? (List<Object>) o : List.of(); }
    public static int i(Object o) { return o instanceof Number n ? n.intValue() : 0; }
    public static double d(Object o) { return o instanceof Number n ? n.doubleValue() : 0; }
    public static boolean b(Object o) { return o instanceof Number n && n.intValue() != 0; }
    public static String s(Object o) { return o instanceof String s ? s : null; }

    /** Text component (JSON string, plain string, compound or list) -> legacy &-coloured text. */
    public static String text(Object o) {
        StringBuilder sb = new StringBuilder();
        appendText(sb, o, 0);
        return sb.toString();
    }

    private static final Map<String, Character> COLORS = Map.ofEntries(Map.entry("black", '0'), Map.entry("dark_blue", '1'),
        Map.entry("dark_green", '2'), Map.entry("dark_aqua", '3'), Map.entry("dark_red", '4'), Map.entry("dark_purple", '5'),
        Map.entry("gold", '6'), Map.entry("gray", '7'), Map.entry("dark_gray", '8'), Map.entry("blue", '9'), Map.entry("green", 'a'),
        Map.entry("aqua", 'b'), Map.entry("red", 'c'), Map.entry("light_purple", 'd'), Map.entry("yellow", 'e'), Map.entry("white", 'f'));

    private static void appendText(StringBuilder sb, Object o, int depth) {
        if (o == null || depth > 32) return;
        if (o instanceof String s) {
            String t = s.trim();
            if ((t.startsWith("{") || t.startsWith("[") || t.startsWith("\"")) && t.length() > 1) {
                try { appendText(sb, Json.parse(t), depth + 1); return; } catch (RuntimeException ignored) { }
            }
            sb.append(s); return;
        }
        if (o instanceof List<?> l) { for (Object e : l) appendText(sb, e, depth + 1); return; }
        if (o instanceof Map<?, ?> m) {
            Object c = m.get("color");
            if (c instanceof String cs && COLORS.containsKey(cs)) sb.append('&').append(COLORS.get(cs));
            else if (c instanceof String cs && cs.startsWith("#") && cs.length() == 7) {
                sb.append("&x"); for (char ch : cs.substring(1).toCharArray()) sb.append('&').append(ch);
            }
            if (truthy(m.get("bold"))) sb.append("&l");
            if (truthy(m.get("italic"))) sb.append("&o");
            if (truthy(m.get("underlined"))) sb.append("&n");
            if (truthy(m.get("strikethrough"))) sb.append("&m");
            Object t = m.containsKey("text") ? m.get("text") : m.get("");
            if (t != null) appendText(sb, t instanceof String ts ? ts : t, depth + 1);
            if (m.get("translate") instanceof String tr && t == null) sb.append(tr);
            appendText(sb, m.get("extra"), depth + 1);
        }
    }

    private static boolean truthy(Object o) { return o instanceof Boolean b ? b : o instanceof Number n && n.intValue() != 0; }
}
