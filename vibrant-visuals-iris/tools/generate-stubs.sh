#!/usr/bin/env bash
# Generates the tiny per-program stub files. Each stub sets #version,
# the dimension and the program type, then includes the shared source
# from shaders/program/. Run from anywhere: ./tools/generate-stubs.sh
set -euo pipefail
cd "$(dirname "$0")/../shaders"

# program name -> PROG_* define
declare -A GBUFFERS=(
  [gbuffers_basic]=PROG_BASIC
  [gbuffers_line]=PROG_BASIC
  [gbuffers_textured]=PROG_TEXTURED
  [gbuffers_textured_lit]=PROG_TEXTURED
  [gbuffers_skybasic]=PROG_SKYBASIC
  [gbuffers_skytextured]=PROG_SKYTEXTURED
  [gbuffers_clouds]=PROG_CLOUDS
  [gbuffers_terrain]=PROG_TERRAIN
  [gbuffers_damagedblock]=PROG_DAMAGED
  [gbuffers_block]=PROG_BLOCK
  [gbuffers_beaconbeam]=PROG_EMISSIVE
  [gbuffers_entities]=PROG_ENTITIES
  [gbuffers_entities_glowing]=PROG_ENTITIES
  [gbuffers_armor_glint]=PROG_GLINT
  [gbuffers_spidereyes]=PROG_EMISSIVE
  [gbuffers_hand]=PROG_HAND
  [gbuffers_hand_water]=PROG_HAND
  [gbuffers_weather]=PROG_WEATHER
  [gbuffers_water]=PROG_WATER
)
FULLSCREEN=(deferred composite composite1 final)

# folder -> dimension define
declare -A DIMS=([.]=DIM_OVERWORLD [world-1]=DIM_NETHER [world1]=DIM_END)

stub() { # file dim prog source
  {
    echo "#version 330 compatibility"
    echo ""
    echo "#define $2"
    [ -n "$3" ] && echo "#define $3"
    echo ""
    echo "#include \"/program/$4\""
  } > "$1"
}

for dir in "${!DIMS[@]}"; do
  dim=${DIMS[$dir]}
  mkdir -p "$dir"
  for p in "${!GBUFFERS[@]}"; do
    stub "$dir/$p.vsh" "$dim" "${GBUFFERS[$p]}" gbuffers.vsh
    stub "$dir/$p.fsh" "$dim" "${GBUFFERS[$p]}" gbuffers.fsh
  done
  for p in "${FULLSCREEN[@]}"; do
    stub "$dir/$p.vsh" "$dim" "" fullscreen.vsh
    stub "$dir/$p.fsh" "$dim" "" "$p.fsh"
  done
done

# Only the overworld has a sun, so only it gets a shadow pass
stub shadow.vsh DIM_OVERWORLD "" shadow.vsh
stub shadow.fsh DIM_OVERWORLD "" shadow.fsh

echo "Stubs generated."
