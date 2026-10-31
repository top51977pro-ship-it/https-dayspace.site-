"""Creates a tiny .litematic (stone floor, stairs, a sign, a chest with diamonds, an armour-stand hologram and a
text display) used by the CI smoke test. Usage: python3 make_test_litematic.py out.litematic"""
import sys
from nbtlib import File, Compound, List, String, Int, Byte, Double, LongArray

def pack(idx, bits):
    out = [0] * ((len(idx) * bits + 63) // 64)
    for i, v in enumerate(idx):
        bit = i * bits; li, off = bit >> 6, bit & 63
        out[li] |= (v << off) & 0xFFFFFFFFFFFFFFFF
        if off + bits > 64: out[li + 1] |= v >> (64 - off)
    return [x - (1 << 64) if x >= (1 << 63) else x for x in out]

sx, sy, sz = 9, 4, 9
pal = [Compound({"Name": String("minecraft:air")}), Compound({"Name": String("minecraft:stone")}),
       Compound({"Name": String("minecraft:oak_stairs"), "Properties": Compound({"facing": String("north"), "half": String("bottom"), "shape": String("straight"), "waterlogged": String("false")})}),
       Compound({"Name": String("minecraft:oak_sign"), "Properties": Compound({"rotation": String("0"), "waterlogged": String("false")})}),
       Compound({"Name": String("minecraft:chest"), "Properties": Compound({"facing": String("south"), "type": String("single"), "waterlogged": String("false")})})]
idx = []
for y in range(sy):
    for z in range(sz):
        for x in range(sx):
            idx.append(1 if y == 0 else (2 if (y == 1 and x == 0) else 0))
idx[(1 * sz + 4) * sx + 4] = 3
idx[(1 * sz + 6) * sx + 6] = 4
msgs = List[String]([String('{"text":"Welcome","color":"gold"}'), String('{"text":"to spawn"}'), String('""'), String('""')])
sign = Compound({"id": String("minecraft:sign"), "x": Int(4), "y": Int(1), "z": Int(4),
                 "front_text": Compound({"messages": msgs, "color": String("black"), "has_glowing_text": Byte(0)}),
                 "back_text": Compound({"messages": msgs, "color": String("black"), "has_glowing_text": Byte(0)})})
chest = Compound({"id": String("minecraft:chest"), "x": Int(6), "y": Int(1), "z": Int(6),
                  "Items": List[Compound]([Compound({"Slot": Byte(0), "id": String("minecraft:diamond"), "count": Int(3)})])})
stand = Compound({"id": String("minecraft:armor_stand"), "Pos": List[Double]([Double(2.5), Double(2.0), Double(2.5)]),
                  "Invisible": Byte(1), "CustomNameVisible": Byte(1), "CustomName": String('{"text":"/shop","color":"aqua"}')})
disp = Compound({"id": String("minecraft:text_display"), "Pos": List[Double]([Double(5.0), Double(3.0), Double(5.0)]),
                 "text": String('{"text":"TOP MONEY","color":"green"}'), "billboard": String("center")})
region = Compound({"Position": Compound({"x": Int(0), "y": Int(0), "z": Int(0)}), "Size": Compound({"x": Int(sx), "y": Int(sy), "z": Int(sz)}),
                   "BlockStatePalette": List[Compound](pal), "BlockStates": LongArray(pack(idx, 3)),
                   "TileEntities": List[Compound]([sign, chest]), "Entities": List[Compound]([stand, disp])})
root = Compound({"MinecraftDataVersion": Int(4325), "Version": Int(7),
                 "Metadata": Compound({"Name": String("ci-test"), "Author": String("DonutClassic CI")}),
                 "Regions": Compound({"main": region})})
File(root).save(sys.argv[1], gzipped=True)
print("wrote", sys.argv[1])
