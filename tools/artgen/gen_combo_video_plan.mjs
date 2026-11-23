// Writes tools/artgen/combo_video_plan.json for combo_video.py: one clip job per Who-does-what combination, starting
// from its chosen still (dev/games/art/combo/<name>.png), with a prompt in MiniMax-H3's own three-field format (see
// videogen/src/videogen/prompts.py compose_minimax_prompt). The motion clause says exactly what the action looks like
// and that nothing else changes, so the clip shows that one action as a short steady loop.
//   node tools/artgen/gen_combo_video_plan.mjs [seeds=0] [names=all]
import { writeFileSync } from 'node:fs';

const NAME = { dog: 'puppy', chicken: 'hen', cow: 'cow', rabbit: 'rabbit' };
const MOTION = {
  sleep: (a) => `The ${a} stays lying curled up fast asleep in the same spot for the whole clip, eyes closed; its body rises and falls slowly with each breath and one ear twitches once. Nothing else moves. The camera does not move.`,
  eat: {
    dog: 'The puppy keeps eating from the red bowl: its head dips into the bowl and comes up chewing, again and again, its tail wagging. It stays in the same spot. The camera does not move.',
    chicken: 'The hen keeps pecking at the corn grains on the ground: its head bobs down to the grains and up again, again and again, swallowing grains. It stays in the same spot. The camera does not move.',
    cow: 'The cow keeps eating the grass: it lowers its head, pulls up a mouthful of grass and chews it, its jaw moving side to side, again and again. It stays in the same spot. The camera does not move.',
    rabbit: 'The rabbit keeps nibbling the orange carrot held in its front paws, its mouth and nose moving quickly, little bites disappearing from the tip of the carrot. It stays in the same spot. The camera does not move.',
  },
  run: (a) => `The ${a} runs very fast in the direction it is facing, its legs moving quickly in a steady galloping running cycle${a === 'hen' ? ', wings flapping' : ', ears flapping'}; the camera tracks alongside so the ${a} stays in the middle of the picture while the fence and the grass stream past quickly behind it.`,
  walk: (a) => `The ${a} walks slowly and calmly in the direction it is facing, one step at a time, its legs moving in a slow relaxed walking cycle, head gently bobbing; the camera tracks alongside slowly so the ${a} stays in the middle of the picture while the fence slides slowly past behind it.`,
  drink: {
    dog: 'The puppy keeps drinking from the blue bowl of water, its pink tongue lapping the water quickly again and again, small ripples spreading in the bowl. It stays in the same spot. The camera does not move.',
    chicken: 'The hen keeps drinking: it dips its beak into the blue dish of water, then lifts its head up to swallow, again and again, ripples spreading in the water. It stays in the same spot. The camera does not move.',
    cow: 'The cow keeps drinking from the wooden trough, its muzzle in the water, slurping, ripples spreading across the water. It stays in the same spot. The camera does not move.',
    rabbit: 'The rabbit keeps drinking from the blue dish of water, its head down, mouth lapping the water, small ripples spreading in the dish. It stays in the same spot. The camera does not move.',
  },
};
const SOUND = { sleep: 'Soft slow breathing, a quiet sunny farmyard', eat: 'Soft munching and crunching', run: 'Quick light footsteps on grass', walk: 'Slow soft footsteps on grass', drink: 'Soft lapping of water' };
const SCENE = {
  dog: 'A small friendly tan puppy with a white chest and muzzle, floppy dark brown ears and a bright red collar',
  chicken: 'A plump white hen with a big bright red comb and wattle, a yellow beak and thin yellow legs',
  cow: 'A friendly white cow with large black patches, a big pink nose, short cream horns and a golden bell on a red strap',
  rabbit: 'A fluffy light grey rabbit with long upright ears with pink insides, a white belly and a pink nose',
};
const STYLE = 'Flat vector clip-art cartoon for a young children\'s picture book, simple flat shapes, bright solid colours, bold clean dark outlines';

const seeds = (process.argv[2] || '0').split(',').map(Number);
const only = process.argv[3] ? new Set(process.argv[3].split(',')) : null;
const order = ['dog', 'chicken', 'cow', 'rabbit'];
const acts = ['sleep', 'eat', 'run', 'walk', 'drink'];
const plan = [];
// level-1 combinations first (dog and hen; sleep and eat), so the first clips are the most used ones
const names = [];
for (const a of ['sleep', 'eat']) for (const s of ['dog', 'chicken']) names.push(`${s}_${a}`);
for (const s of order) for (const a of acts) if (!names.includes(`${s}_${a}`)) names.push(`${s}_${a}`);
for (const n of names) {
  if (only && !only.has(n)) continue;
  const [s, a] = n.split('_'), m = MOTION[a], motion = typeof m === 'function' ? m(NAME[s]) : m[s];
  const prompt = `integrated_multimodal_description: [Shot 1] ${STYLE}. ${SCENE[s]} on short green grass in a sunny farmyard, a low wooden fence behind, pale blue sky. ${motion} The ${NAME[s]} keeps exactly the same look, colours and flat cartoon style as in the first frame the whole time; one single ${NAME[s]}, no other animals.\noverall_soundscape: ${SOUND[a]}\nnon_diegetic_music: N/A`;
  plan.push({ name: n, still: `dev/games/art/combo/${n}.png`, prompt, seeds });
}
writeFileSync(new URL('./combo_video_plan.json', import.meta.url), JSON.stringify(plan, null, 1));
console.log(plan.length, 'clips x', seeds.length, 'seeds');
