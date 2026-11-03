// Lumi's expressions, without touching the Meshy texture (its atlas is in pieces, so it can't be repainted).
// Small patches sit on the head's own sphere: fur-textured caps hide the painted brows / mouth / eyes,
// and hand-drawn strokes on top give the new expression. Everything hangs on the head bone, so it follows every animation.
import * as THREE from 'three';

const HEAD = { c: new THREE.Vector3(0, 0.05, 0), r: 0.428 };     // the head, measured as a sphere in head-bone space
const FUR_UV = [0.355, 0.031, 0.402, 0.078];                     // a plain patch of fur in the texture (u0, v0, u1, v1; glTF textures are not flipped)
// measured on the mesh (raycast in _face-check.html), in head-bone space: point and distance from the head centre
const EYE = { L: [-0.191, 0.224, 0.304, 0.399], R: [0.217, 0.224, 0.297, 0.407] };
const BROW = { L: [-0.24, 0.293, 0.306, 0.459], R: [0.244, 0.297, 0.277, 0.444] };
const MOUTH = [0, 0.085, 0.432, 0.434];

// a cap of the head sphere around a direction, as a geometry (for fur patches and stroke decals)
function cap(pt, angW, angH, segs = 16) {      // pt = [x, y, z, radius]: a point on the head and how far it is from the head centre
  const d = new THREE.Vector3(pt[0], pt[1], pt[2]).sub(HEAD.c).normalize();
  const phi = Math.atan2(d.z, -d.x), theta = Math.acos(THREE.MathUtils.clamp(d.y, -1, 1));
  const g = new THREE.SphereGeometry(pt[3] + 0.004, segs, segs, phi - angW / 2, angW, theta - angH / 2, angH);
  g.translate(HEAD.c.x, HEAD.c.y, HEAD.c.z);
  return g;
}
function furUV(geo) { return geo; }   // the fur colour comes from the map's offset/repeat (see makeFace), so the uv stays 0..1 for the feather mask
function featherTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 20, 64, 64, 64); gr.addColorStop(0, '#fff'); gr.addColorStop(.62, '#fff'); gr.addColorStop(1, '#000');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}
function strokeTex(draw) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
  g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#3a2418'; g.fillStyle = '#3a2418'; draw(g);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// the strokes, drawn in a 256² canvas (the sphere cap's uv: u left→right as seen from the front, v bottom→top)
const STROKES = {
  frown:   g => { g.lineWidth = 14; g.beginPath(); g.moveTo(128, 26); g.lineTo(128, 112); g.stroke(); g.beginPath(); g.moveTo(72, 156); g.quadraticCurveTo(128, 104, 184, 156); g.stroke(); },   // nose line down, then a ∩ mouth
  flat:    g => { g.lineWidth = 13; g.beginPath(); g.moveTo(128, 26); g.lineTo(128, 116); g.stroke(); g.beginPath(); g.moveTo(86, 136); g.quadraticCurveTo(128, 126, 170, 136); g.stroke(); },
  open:    g => { g.lineWidth = 12; g.beginPath(); g.moveTo(128, 26); g.lineTo(128, 104); g.stroke(); g.beginPath(); g.moveTo(66, 112); g.quadraticCurveTo(128, 212, 190, 112); g.quadraticCurveTo(128, 134, 66, 112); g.fill(); g.stroke();
                  g.fillStyle = '#c9584f'; g.beginPath(); g.moveTo(92, 120); g.quadraticCurveTo(128, 184, 164, 120); g.quadraticCurveTo(128, 132, 92, 120); g.fill(); },
  browSad: g => { g.lineWidth = 12; g.beginPath(); g.moveTo(60, 128); g.quadraticCurveTo(128, 150, 200, 96); g.stroke(); },   // outer end low, inner end up (worried)
  browUp:  g => { g.lineWidth = 12; g.beginPath(); g.moveTo(60, 110); g.quadraticCurveTo(128, 160, 200, 110); g.stroke(); },   // a raised, happy arc
  lid:     g => { g.lineWidth = 11; g.beginPath(); g.moveTo(52, 118); g.quadraticCurveTo(128, 80, 204, 118); g.stroke(); },     // closed-eye line (happy ^)
};

export function makeFace(head, bodyMaterial) {
  const grp = new THREE.Group(); head.add(grp);
  const fur = bodyMaterial.clone(); fur.polygonOffset = true; fur.polygonOffsetFactor = -1;   // same map + lighting as the body
  fur.transparent = true; fur.alphaMap = featherTex(); fur.depthWrite = false;                 // soft edges so the patch melts into the fur
  fur.map = fur.map.clone(); fur.map.offset.set(FUR_UV[0], FUR_UV[1]); fur.map.repeat.set(FUR_UV[2] - FUR_UV[0], FUR_UV[3] - FUR_UV[1]); fur.map.needsUpdate = true;
  if (fur.emissiveMap) fur.emissiveMap = fur.map;
  const inkMat = tex => new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
  const parts = {};
  const add = (name, dir, w, h, mat) => { const m = new THREE.Mesh(furUV(cap(dir, w, h)), mat); m.renderOrder = 2; m.visible = false; m.raycast = () => {}; grp.add(m); parts[name] = m; return m; };
  const addInk = (name, dir, w, h, stroke) => { const m = new THREE.Mesh(cap(dir, w, h), inkMat(strokeTex(STROKES[stroke]))); m.renderOrder = 3; m.visible = false; m.raycast = () => {}; grp.add(m); parts[name] = m; return m; };
  add('mouthFur', MOUTH, .62, .24, fur);
  addInk('frown', MOUTH, .62, .24, 'frown'); addInk('flat', MOUTH, .62, .24, 'flat'); addInk('open', MOUTH, .62, .28, 'open');
  for (const s of [-1, 1]) {
    const bd = s < 0 ? BROW.L : BROW.R, ed = s < 0 ? EYE.L : EYE.R;
    add('browFur' + s, bd, .36, .20, fur);
    const sad = addInk('browSad' + s, bd, .36, .20, 'browSad'); if (s > 0) sad.geometry = mirrorU(sad.geometry);
    addInk('browUp' + s, bd, .36, .20, 'browUp');
    add('lid' + s, ed, .52, .52, fur);                       // the eyelid: fur over the eye
    addInk('lidLine' + s, ed, .52, .52, 'lid');
  }
  // state: 0..1 per feature, eased every frame
  const want = { sad: 0, worried: 0, big: 0, closed: 0 }, now = { ...want };
  let blink = 0, nextBlink = Infinity;   // eyelids were not convincing: blinking is off
  const api = {
    group: grp,
    set(expr) {   // 'neutral' | 'sad' | 'worried' | 'big' (big open smile) | 'closed' (happy closed eyes)
      want.sad = expr === 'sad' ? 1 : 0; want.worried = expr === 'worried' ? 1 : 0; want.big = expr === 'big' ? 1 : 0; want.closed = expr === 'closed' ? 1 : 0;
    },
    blink() { blink = .18; },
    update(dt, t) {
      for (const k in want) now[k] += (want[k] - now[k]) * Math.min(1, dt * 6);
      if (t > nextBlink) { blink = .16; nextBlink = t + 2.5 + Math.random() * 3.5; }
      blink = Math.max(0, blink - dt);
      const closed = 0;   // (lids off)
      const mouthHidden = now.sad > .5 || now.worried > .5 || now.big > .5;
      const browHidden = false;   // brows barely read: the painted ones stay
      parts.mouthFur.visible = mouthHidden;
      parts.frown.visible = now.sad > .5; parts.flat.visible = now.worried > .5; parts.open.visible = now.big > .5;
      for (const s of [-1, 1]) {
        parts['browFur' + s].visible = browHidden;
        parts['browSad' + s].visible = false; parts['browUp' + s].visible = false;
        parts['lid' + s].visible = closed > .5; parts['lidLine' + s].visible = closed > .5;
      }
    },
  };
  return api;
}
function mirrorU(geo) { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i)); return geo; }
