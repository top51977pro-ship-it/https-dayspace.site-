// Block registry. Each block names the atlas tiles for its faces and a few
// behaviour flags; flat lookup tables below keep the mesher's hot loop cheap.

export const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, PLANKS: 5, LOG: 6, LEAVES: 7,
  SAND: 8, WATER: 9, GLASS: 10, BRICK: 11, BEDROCK: 12, GRAVEL: 13, SNOW: 14,
  SNOWY_GRASS: 15, COAL: 16, IRON: 17, GOLD: 18, DIAMOND: 19, BOOKSHELF: 20,
  WOOL_WHITE: 21, WOOL_RED: 22, WOOL_BLUE: 23, WOOL_YELLOW: 24, WOOL_GREEN: 25,
  WOOL_BLACK: 26, TALLGRASS: 27, ROSE: 28, DANDELION: 29, SANDSTONE: 30,
  STONEBRICK: 31, MOSSY: 32, OBSIDIAN: 33, BIRCH_LOG: 34, BIRCH_LEAVES: 35,
  CRAFTING: 36, PUMPKIN: 37, TNT: 38, ICE: 39, CACTUS: 40,
}

const DEFS = {
  [B.GRASS]: { name: 'Grass Block', top: 'grass_top', side: 'grass_side', bottom: 'dirt', sound: 'grass' },
  [B.DIRT]: { name: 'Dirt', all: 'dirt', sound: 'gravel' },
  [B.STONE]: { name: 'Stone', all: 'stone' },
  [B.COBBLE]: { name: 'Cobblestone', all: 'cobblestone' },
  [B.PLANKS]: { name: 'Oak Planks', all: 'planks', sound: 'wood' },
  [B.LOG]: { name: 'Oak Log', top: 'log_top', bottom: 'log_top', side: 'log_side', sound: 'wood' },
  [B.LEAVES]: { name: 'Oak Leaves', all: 'leaves', opaque: false, cutout: true, selfCull: true, shadow: true, sound: 'grass' },
  [B.SAND]: { name: 'Sand', all: 'sand', sound: 'sand' },
  [B.WATER]: { name: 'Water', all: 'water', opaque: false, solid: false, liquid: true, sound: 'water' },
  [B.GLASS]: { name: 'Glass', all: 'glass', opaque: false, cutout: true, selfCull: true, sound: 'glass' },
  [B.BRICK]: { name: 'Bricks', all: 'brick' },
  [B.BEDROCK]: { name: 'Bedrock', all: 'bedrock' },
  [B.GRAVEL]: { name: 'Gravel', all: 'gravel', sound: 'gravel' },
  [B.SNOW]: { name: 'Snow', all: 'snow', sound: 'cloth' },
  [B.SNOWY_GRASS]: { name: 'Snowy Grass', top: 'snow', side: 'snow_side', bottom: 'dirt', sound: 'grass' },
  [B.COAL]: { name: 'Coal Ore', all: 'coal_ore' },
  [B.IRON]: { name: 'Iron Ore', all: 'iron_ore' },
  [B.GOLD]: { name: 'Gold Ore', all: 'gold_ore' },
  [B.DIAMOND]: { name: 'Diamond Ore', all: 'diamond_ore' },
  [B.BOOKSHELF]: { name: 'Bookshelf', top: 'planks', bottom: 'planks', side: 'bookshelf', sound: 'wood' },
  [B.WOOL_WHITE]: { name: 'White Wool', all: 'wool_white', sound: 'cloth' },
  [B.WOOL_RED]: { name: 'Red Wool', all: 'wool_red', sound: 'cloth' },
  [B.WOOL_BLUE]: { name: 'Blue Wool', all: 'wool_blue', sound: 'cloth' },
  [B.WOOL_YELLOW]: { name: 'Yellow Wool', all: 'wool_yellow', sound: 'cloth' },
  [B.WOOL_GREEN]: { name: 'Green Wool', all: 'wool_green', sound: 'cloth' },
  [B.WOOL_BLACK]: { name: 'Black Wool', all: 'wool_black', sound: 'cloth' },
  [B.TALLGRASS]: { name: 'Tall Grass', all: 'tallgrass', cross: true, replaceable: true, sound: 'grass' },
  [B.ROSE]: { name: 'Rose', all: 'rose', cross: true, sound: 'grass' },
  [B.DANDELION]: { name: 'Dandelion', all: 'dandelion', cross: true, sound: 'grass' },
  [B.SANDSTONE]: { name: 'Sandstone', top: 'sandstone_top', bottom: 'sandstone_top', side: 'sandstone_side' },
  [B.STONEBRICK]: { name: 'Stone Bricks', all: 'stonebrick' },
  [B.MOSSY]: { name: 'Mossy Cobblestone', all: 'mossy_cobble' },
  [B.OBSIDIAN]: { name: 'Obsidian', all: 'obsidian' },
  [B.BIRCH_LOG]: { name: 'Birch Log', top: 'birch_top', bottom: 'birch_top', side: 'birch_side', sound: 'wood' },
  [B.BIRCH_LEAVES]: { name: 'Birch Leaves', all: 'birch_leaves', opaque: false, cutout: true, selfCull: true, shadow: true, sound: 'grass' },
  [B.CRAFTING]: { name: 'Crafting Table', top: 'crafting_top', bottom: 'planks', side: 'crafting_side', sound: 'wood' },
  [B.PUMPKIN]: { name: 'Pumpkin', top: 'pumpkin_top', bottom: 'pumpkin_top', side: 'pumpkin_side', front: 'pumpkin_face', sound: 'wood' },
  [B.TNT]: { name: 'TNT', top: 'tnt_top', bottom: 'tnt_bottom', side: 'tnt_side', sound: 'grass' },
  [B.ICE]: { name: 'Ice', all: 'ice', opaque: false, cutout: false, selfCull: true, translucent: true, sound: 'glass' },
  [B.CACTUS]: { name: 'Cactus', top: 'cactus_top', bottom: 'cactus_top', side: 'cactus_side', opaque: false, cutout: true, sound: 'cloth' },
}

export const BLOCK_COUNT = 41

export const NAME = []
export const OPAQUE = new Uint8Array(256)
export const SOLID = new Uint8Array(256)
export const CUTOUT = new Uint8Array(256)
export const LIQUID = new Uint8Array(256)
export const CROSS = new Uint8Array(256)
export const SELF_CULL = new Uint8Array(256)
export const SHADOW = new Uint8Array(256)
export const TRANSLUCENT = new Uint8Array(256)
export const REPLACEABLE = new Uint8Array(256)
export const SOUND = []
// Tile names per face, in mesher face order: +x, -x, +y, -y, +z, -z
export const FACE_TILES = []

for (let id = 1; id < BLOCK_COUNT; id++) {
  const d = DEFS[id]
  NAME[id] = d.name
  const opaque = d.opaque ?? !d.cross
  OPAQUE[id] = opaque ? 1 : 0
  SOLID[id] = (d.solid ?? !d.cross) ? 1 : 0
  CUTOUT[id] = (d.cutout ?? !!d.cross) ? 1 : 0
  LIQUID[id] = d.liquid ? 1 : 0
  CROSS[id] = d.cross ? 1 : 0
  SELF_CULL[id] = d.selfCull ? 1 : 0
  SHADOW[id] = (opaque || d.shadow) ? 1 : 0
  TRANSLUCENT[id] = d.translucent ? 1 : 0
  REPLACEABLE[id] = d.replaceable || d.liquid ? 1 : 0
  SOUND[id] = d.sound || 'stone'
  const top = d.top || d.all, bottom = d.bottom || d.all, side = d.side || d.all
  FACE_TILES[id] = [side, side, top, bottom, d.front || side, side]
}
REPLACEABLE[B.AIR] = 1

// Order shown in the creative inventory.
export const CREATIVE = [
  B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.MOSSY, B.STONEBRICK, B.BRICK, B.PLANKS,
  B.LOG, B.BIRCH_LOG, B.LEAVES, B.BIRCH_LEAVES, B.GLASS, B.ICE, B.SAND, B.SANDSTONE,
  B.GRAVEL, B.SNOW, B.SNOWY_GRASS, B.COAL, B.IRON, B.GOLD, B.DIAMOND, B.OBSIDIAN,
  B.BEDROCK, B.BOOKSHELF, B.CRAFTING, B.PUMPKIN, B.TNT, B.CACTUS,
  B.WOOL_WHITE, B.WOOL_RED, B.WOOL_YELLOW, B.WOOL_GREEN, B.WOOL_BLUE, B.WOOL_BLACK,
  B.TALLGRASS, B.ROSE, B.DANDELION, B.WATER,
]

export const DEFAULT_HOTBAR = [B.GRASS, B.DIRT, B.STONE, B.COBBLE, B.PLANKS, B.LOG, B.GLASS, B.BRICK, B.TNT]
