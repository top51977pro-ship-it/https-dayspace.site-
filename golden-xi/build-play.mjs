// Assemble the self-contained single-file build (play.html) from the www/ sources.
import fs from 'node:fs';
const R = (f) => fs.readFileSync('www/' + f, 'utf8');

const css   = R('style.css');
const three = R('three.min.js');
const ai    = R('ai.js');
const rules = R('rules.js');
const scene = R('scene3d.js');
const game  = R('game.js');

// Pull the <body> inner HTML out of index.html and strip the external <link>/<script src> tags.
let html = R('index.html');
let body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
body = body
  .replace(/\s*<script\s+src=[^>]*><\/script>/g, '')
  .replace(/\s*<link\s+rel="stylesheet"[^>]*>/g, '');

const out = [
  '<style>', css, '</style>',
  body.trim(),
  '<script>', ai, '</script>',
  '<script>', rules, '</script>',
  '<script>', three, '</script>',
  '<script>', scene, '</script>',
  '<script>', game, '</script>',
  ''
].join('\n');

fs.writeFileSync('play.html', out);
console.log('play.html written:', out.length, 'bytes');
