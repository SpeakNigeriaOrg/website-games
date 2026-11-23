#!/bin/sh
# One Who-does-what clip per process (each takes and releases the GPU lock), until every clip in the plan exists.
#   sh tools/artgen/combo_video_each.sh        (from the repo root; log: dev/games/art_candidates/combo_videos.log)
cd "$(dirname "$0")/../.."
PLAN=tools/artgen/combo_video_plan.json OUT=dev/games/art_candidates/combo_videos
while :; do
  left=$(node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('$PLAN'));console.log(p.flatMap(j=>j.seeds.map(s=>'$OUT/'+j.name+'/s'+s+'.mp4')).filter(f=>!fs.existsSync(f)).length)")
  [ "$left" = 0 ] && echo "all clips done" && break
  echo "$(date +%H:%M) $left clips left"
  uv run --project C:/Dev/yoruba_student_dict_platform/imagegen python tools/artgen/combo_video.py $PLAN $OUT --max=1 || { echo "clip run failed; stopping"; break; }
done
