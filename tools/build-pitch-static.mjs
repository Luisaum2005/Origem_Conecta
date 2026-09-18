import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "dist");
const pitchOutput = resolve(output, "pitch");

const response = await fetch("http://127.0.0.1:8080/pitch");
if (!response.ok) throw new Error(`Falha ao renderizar o pitch: ${response.status}`);

const renderedHtml = await response.text();
if (!renderedHtml.includes("Apresentação do pitch Origem Conecta")) {
  throw new Error("A página renderizada não contém a apresentação esperada.");
}

const bodyStart = renderedHtml.indexOf("<body>") + "<body>".length;
const scriptStart = renderedHtml.indexOf("<script", bodyStart);
const bodyMarkup = renderedHtml
  .slice(bodyStart, scriptStart)
  .replaceAll("/output/imagegen/agricultor-horizontal-panfleto.png", "/assets/farmer.png")
  .replaceAll("/src/assets/logo.png", "/assets/logo.png")
  .replace(
    'href="/" aria-label="Sair da apresentação"',
    'href="https://origem-conecta.vercel.app" aria-label="Visitar o Origem Conecta"',
  );

const pitchCss = await readFile(resolve(root, "src", "features", "pitch", "pitch.css"), "utf8");
const pitchScript = `
(() => {
  const slides = [...document.querySelectorAll('.pitch-slide')];
  const labels = ['Gancho', 'Conexão', 'Persona', 'O problema', 'A solução', 'Validação', 'Convite'];
  const durations = [30, 20, 35, 30, 55, 50, 20];
  const previous = document.querySelector('[aria-label="Slide anterior"]');
  const next = document.querySelector('[aria-label="Próximo slide"]');
  const fullscreen = document.querySelector('[aria-label="Alternar tela cheia"]');
  const dots = [...document.querySelectorAll('[aria-label^="Ir para o slide"]')];
  const meta = document.querySelectorAll('.pitch-progress-meta span');
  const progress = document.querySelector('.pitch-progress span');
  let current = 0;
  let touchStart = null;

  const goTo = (index) => {
    current = Math.max(0, Math.min(slides.length - 1, index));
    slides.forEach((slide, slideIndex) => {
      const active = slideIndex === current;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', String(!active));
    });
    previous.disabled = current === 0;
    next.disabled = current === slides.length - 1;
    meta[0].textContent = String(current + 1).padStart(2, '0') + ' / ' + String(slides.length).padStart(2, '0');
    meta[1].textContent = labels[current] + ' · ' + durations[current] + 's';
    progress.style.width = ((current + 1) / slides.length * 100) + '%';
    dots.forEach((dot, index) => {
      dot.classList.toggle('is-current', index === current);
      if (index === current) dot.setAttribute('aria-current', 'step');
      else dot.removeAttribute('aria-current');
    });
  };

  previous.addEventListener('click', () => goTo(current - 1));
  next.addEventListener('click', () => goTo(current + 1));
  dots.forEach((dot, index) => dot.addEventListener('click', () => goTo(index)));
  fullscreen.addEventListener('click', async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen?.();
  });
  window.addEventListener('keydown', (event) => {
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(event.key)) { event.preventDefault(); goTo(current + 1); }
    if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key)) { event.preventDefault(); goTo(current - 1); }
    if (event.key === 'Home') goTo(0);
    if (event.key === 'End') goTo(slides.length - 1);
    if (event.key.toLowerCase() === 'f') fullscreen.click();
  });
  document.querySelector('.pitch-shell').addEventListener('touchstart', (event) => {
    touchStart = event.changedTouches[0]?.clientX ?? null;
  }, { passive: true });
  document.querySelector('.pitch-shell').addEventListener('touchend', (event) => {
    const end = event.changedTouches[0]?.clientX;
    if (touchStart === null || end === undefined) return;
    const delta = end - touchStart;
    if (Math.abs(delta) > 48) goTo(current + (delta < 0 ? 1 : -1));
    touchStart = null;
  }, { passive: true });
  goTo(0);
})();`;

const pitchHtml = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="Apresentação web do Origem Conecta para um pitch de quatro minutos." />
    <title>Pitch de 4 minutos — Origem Conecta</title>
    <link rel="icon" type="image/png" href="/assets/logo.png" />
    <style>html,body{margin:0;overflow:hidden}button,a{font:inherit}a{text-decoration:none}${pitchCss}</style>
  </head>
  <body>${bodyMarkup}<script>${pitchScript}</script></body>
</html>`;

await rm(output, { recursive: true, force: true });
await mkdir(pitchOutput, { recursive: true });
await mkdir(resolve(output, "assets"), { recursive: true });
await mkdir(resolve(output, ".openai"), { recursive: true });
await cp(resolve(root, "src", "assets", "logo.png"), resolve(output, "assets", "logo.png"));
await cp(
  resolve(root, "output", "imagegen", "agricultor-horizontal-panfleto.png"),
  resolve(output, "assets", "farmer.png"),
);

const rootHtml = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="0; url=/pitch/" />
    <title>Pitch Origem Conecta</title>
    <link rel="canonical" href="/pitch/" />
  </head>
  <body>
    <p><a href="/pitch/">Abrir apresentação do Origem Conecta</a></p>
  </body>
</html>`;

await writeFile(resolve(output, "index.html"), rootHtml, "utf8");
await writeFile(resolve(pitchOutput, "index.html"), pitchHtml, "utf8");
await writeFile(
  resolve(output, ".openai", "hosting.json"),
  await readFile(resolve(root, ".openai", "hosting.json"), "utf8"),
  "utf8",
);

console.log("Apresentação estática criada em dist/pitch/index.html");
