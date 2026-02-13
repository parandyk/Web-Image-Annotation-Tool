import { useEffect, useMemo, useRef, useState } from 'react';

export function MiddleTruncate(props: { text: string; className?: string; title?: string; charPx?: number }): JSX.Element {
  const { text, className, title } = props;
  const ref = useRef<HTMLSpanElement | null>(null);
  const [width, setWidth] = useState(0);
  const [font, setFont] = useState('');

  const measure = (value: string): number => {
    if (!font) return value.length * 8;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return value.length * 8;
    ctx.font = font;
    return ctx.measureText(value).width;
  };

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current.parentElement ?? ref.current;
    const computed = window.getComputedStyle(el);
    setFont(
      `${computed.fontStyle} ${computed.fontVariant} ${computed.fontWeight} ${computed.fontSize} / ${computed.lineHeight} ${computed.fontFamily}`
    );
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setWidth(Math.max(0, w - 4));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const rendered = useMemo(() => {
    // Binary-search the largest keep-size that fits so both start and end remain visible.
    if (!width || width <= 0) return text;
    if (measure(text) <= width) return text;

    const dots = '...';
    let lo = 1;
    let hi = Math.max(1, Math.floor((text.length - dots.length) / 2));
    let best = `${text[0]}${dots}${text[text.length - 1]}`;

    while (lo <= hi) {
      const keep = Math.floor((lo + hi) / 2);
      const candidate = `${text.slice(0, keep)}${dots}${text.slice(text.length - keep)}`;
      if (measure(candidate) <= width) {
        best = candidate;
        lo = keep + 1;
      } else {
        hi = keep - 1;
      }
    }

    return best;
  }, [font, text, width]);

  return (
    <span ref={ref} className={className} title={title ?? text}>
      {rendered}
    </span>
  );
}
