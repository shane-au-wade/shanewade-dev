import * as React from "react";

const in_progress = String.raw`
 __     __   __        ______   ______     ______     ______     ______     ______     ______     ______
/\ \   /\ "-.\ \      /\  == \ /\  == \   /\  __ \   /\  ___\   /\  == \   /\  ___\   /\  ___\   /\  ___\
\ \ \  \ \ \-.  \     \ \  _-/ \ \  __<   \ \ \/\ \  \ \ \__ \  \ \  __<   \ \  __\   \ \___  \  \ \___  \
 \ \_\  \ \_\\"\_\     \ \_\    \ \_\ \_\  \ \_____\  \ \_____\  \ \_\ \_\  \ \_____\  \/\_____\  \/\_____\
  \/_/   \/_/ \/_/      \/_/     \/_/ /_/   \/_____/   \/_____/   \/_/ /_/   \/_____/   \/_____/   \/_____/
`;

type RGB = { red: number; green: number; blue: number };

const lerp = (a: number, b: number, u: number) => (1 - u) * a + u * b;

function randRGB(): RGB {
  return {
    red: Math.floor(Math.random() * 256),
    green: Math.floor(Math.random() * 256),
    blue: Math.floor(Math.random() * 256),
  };
}

export default function RgbText({ height = "250px" }: { height?: string }) {
  const INIT: RGB = { red: 0, green: 0, blue: 0 };
  const INIT_END: RGB = { red: 70, green: 217, blue: 227 };
  const DURATION_MS = 3000;

  const [color, setColor] = React.useState<RGB>(INIT);
  const fromRef = React.useRef<RGB>(INIT);
  const toRef = React.useRef<RGB>(INIT_END);
  const startRef = React.useRef<number | null>(null);
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const elapsed = t - startRef.current;
      const u = Math.min(1, elapsed / DURATION_MS);

      const from = fromRef.current;
      const to = toRef.current;

      const next: RGB = {
        red: Math.round(lerp(from.red, to.red, u)),
        green: Math.round(lerp(from.green, to.green, u)),
        blue: Math.round(lerp(from.blue, to.blue, u)),
      };
      setColor(next);

      if (u >= 1) {
        // start next leg
        fromRef.current = toRef.current;
        toRef.current = randRGB();
        startRef.current = t;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="rgb-container">
      <div className="rgb-spacer" />
      <pre
        className="rgb-fig"
        style={{
          height,
          color: `rgb(${color.red},${color.green},${color.blue})`,
        }}
      >
        {in_progress}
      </pre>
    </div>
  );
}
