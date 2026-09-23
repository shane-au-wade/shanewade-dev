import {
  animate,
  createDraggable,
  createDrawable,
  createTimeline,
  onScroll,
  scrambleText,
  splitText,
  spring,
  stagger,
  utils,
} from "animejs";

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function initAnimeLab() {
  const root = document.querySelector<HTMLElement>("#anime-lab");
  if (!root) return;

  const reduced = prefersReducedMotion();
  const notice = root.querySelector("#reduced-motion-notice");
  if (notice && reduced) notice.hidden = false;

  initBounceAndRotate(root, reduced);
  initKeyframes(root);
  initStagger(root);
  initTimeline(root);
  initEasings(root);
  initPlayback(root, reduced);
  initDraggable(root);
  initText(root);
  initSvg(root, reduced);
  initScroll(root, reduced);
}

function replayButton(root: HTMLElement, id: string, handler: () => void) {
  root.querySelector(`#${id}`)?.addEventListener("click", handler);
}

function initBounceAndRotate(root: HTMLElement, reduced: boolean) {
  const token = root.querySelector<HTMLElement>("#qs-token");
  const button = root.querySelector<HTMLElement>("#qs-rotate-btn");
  if (!token || !button) return;

  let rotations = 0;

  if (!reduced) {
    animate(token, {
      scale: [
        { to: 1.2, ease: "inOut(3)", duration: 200 },
        { to: 1, ease: spring({ bounce: 0.7 }) },
      ],
      loop: true,
      loopDelay: 250,
    });
  }

  createDraggable(token, {
    container: token.parentElement ?? undefined,
    releaseEase: spring({ bounce: 0.7 }),
  });

  button.addEventListener("click", () => {
    rotations += 1;
    button.textContent = `rotations: ${rotations}`;
    animate(token, {
      rotate: rotations * 360,
      ease: "out(4)",
      duration: 1500,
    });
  });
}

function initKeyframes(root: HTMLElement) {
  const play = () => {
    animate("#kf-token", {
      x: [
        { to: 80, duration: 400, ease: "out(3)" },
        { to: -40, duration: 500, ease: "inOut(2)" },
        { to: 0, duration: 450, ease: "out(4)" },
      ],
      rotate: [
        { to: 20, duration: 400 },
        { to: -12, duration: 500 },
        { to: 0, duration: 450 },
      ],
      backgroundColor: [
        { to: "#89181e", duration: 400 },
        { to: "#2f6fed", duration: 500 },
        { to: "#89181e", duration: 450 },
      ],
    });
  };

  replayButton(root, "kf-replay", play);
}

function initStagger(root: HTMLElement) {
  const grid = root.querySelector("#stagger-grid");
  if (!grid) return;

  const cols = 8;
  const rows = 5;
  for (let i = 0; i < cols * rows; i += 1) {
    const cell = document.createElement("span");
    cell.className = "anime-dot";
    grid.appendChild(cell);
  }

  const play = () => {
    animate("#stagger-grid .anime-dot", {
      scale: [
        { to: 1.35, ease: "inOut(3)", duration: 180 },
        { to: 1, ease: spring({ bounce: 0.45 }) },
      ],
      backgroundColor: [
        { to: "#e05545", duration: 180 },
        { to: "#89181e", ease: "out(2)" },
      ],
      delay: stagger(28, { grid: [cols, rows], from: "center" }),
    });
  };

  play();
  replayButton(root, "stagger-replay", play);
}

function initTimeline(root: HTMLElement) {
  const play = () => {
    createTimeline({ defaults: { ease: "out(3)" } })
      .add("#tl-a", { width: "100%", duration: 450 })
      .add("#tl-b", { width: "100%", duration: 450 }, "-=180")
      .add("#tl-c", { width: "100%", duration: 450 }, "-=180")
      .add(["#tl-a", "#tl-b", "#tl-c"], {
        opacity: [1, 0.35, 1],
        duration: 500,
      });
  };

  play();
  replayButton(root, "tl-replay", () => {
    utils.set(["#tl-a", "#tl-b", "#tl-c"], { width: "12%", opacity: 1 });
    play();
  });
}

function initEasings(root: HTMLElement) {
  const easings = [
    { id: "ease-linear", ease: "linear" },
    { id: "ease-out", ease: "out(4)" },
    { id: "ease-in-out", ease: "inOut(3)" },
    { id: "ease-spring", ease: spring({ bounce: 0.65 }) },
  ] as const;

  const play = () => {
    easings.forEach(({ id, ease }, index) => {
      animate(`#${id}`, {
        x: [0, 180, 0],
        duration: 1400,
        ease,
        delay: index * 80,
      });
    });
  };

  play();
  replayButton(root, "ease-replay", play);
}

function initPlayback(root: HTMLElement, reduced: boolean) {
  const token = root.querySelector("#play-token");
  if (!token) return;

  const animation = animate(token, {
    rotate: 360,
    ease: "linear",
    duration: 2400,
    loop: true,
    autoplay: !reduced,
  });

  root.querySelector("#play-play")?.addEventListener("click", () => {
    animation.play();
  });
  root.querySelector("#play-pause")?.addEventListener("click", () => {
    animation.pause();
  });
  root.querySelector("#play-restart")?.addEventListener("click", () => {
    animation.restart();
  });
  root.querySelector("#play-reverse")?.addEventListener("click", () => {
    animation.reverse();
  });
}

function initDraggable(root: HTMLElement) {
  const token = root.querySelector("#drag-token");
  if (!token) return;

  createDraggable(token, {
    container: "#drag-stage",
    releaseEase: spring({ bounce: 0.7 }),
  });
}

function initText(root: HTMLElement) {
  const splitTarget = root.querySelector("#split-target");
  if (splitTarget) {
    const split = splitText(splitTarget, { chars: true });
    const playSplit = () => {
      utils.set(split.chars, { y: 0, opacity: 1 });
      animate(split.chars, {
        y: [
          { to: "-0.6em", duration: 180, ease: "out(3)" },
          { to: 0, ease: spring({ bounce: 0.55 }) },
        ],
        opacity: [0, 1],
        delay: stagger(28),
      });
    };
    playSplit();
    replayButton(root, "split-replay", playSplit);
  }

  const scrambleTarget = root.querySelector("#scramble-target");
  if (scrambleTarget) {
    const phrases = ["animate anything", "design in motion", "anime.js v4"];
    let index = 0;
    const playScramble = () => {
      index = (index + 1) % phrases.length;
      animate(scrambleTarget, {
        innerHTML: scrambleText({
          text: phrases[index],
          chars: "lowercase",
          cursor: true,
        }),
      });
    };
    replayButton(root, "scramble-replay", playScramble);
  }
}

function initSvg(root: HTMLElement, reduced: boolean) {
  const paths = root.querySelectorAll("#svg-stage path");
  if (!paths.length) return;

  const play = () => {
    animate(createDrawable("#svg-stage path"), {
      draw: ["0 0", "0 1"],
      ease: "inOut(3)",
      duration: 1600,
      delay: stagger(180),
    });
  };

  play();
  replayButton(root, "svg-replay", play);

  if (!reduced) {
    animate("#svg-orb", {
      cx: [28, 172, 28],
      ease: "inOut(2)",
      duration: 2800,
      loop: true,
    });
  }
}

function initScroll(root: HTMLElement, reduced: boolean) {
  const bar = root.querySelector("#scroll-bar");
  if (!bar || reduced) return;

  animate(bar, {
    scaleX: [0, 1],
    ease: "linear",
    autoplay: onScroll({
      target: "#scroll-track",
      sync: true,
    }),
  });

  animate("#scroll-card", {
    y: [32, 0],
    opacity: [0.2, 1],
    autoplay: onScroll({
      target: "#scroll-card",
      enter: "bottom top+=80",
      leave: "top bottom",
    }),
  });
}
