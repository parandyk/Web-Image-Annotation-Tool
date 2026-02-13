import { MutableRefObject, ReactNode, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

type PortalMenuProps = {
  x: number;
  y: number;
  menuRef: MutableRefObject<HTMLDivElement | null>;
  className?: string;
  children: ReactNode;
};

export function PortalMenu({ x, y, menuRef, className = 'annotation-menu', children }: PortalMenuProps): JSX.Element {
  const [position, setPosition] = useState<{ left: number; top: number }>({ left: x, top: y });

  useLayoutEffect(() => {
    const updatePosition = (): void => {
      const el = menuRef.current;
      const margin = 8;
      if (!el) {
        setPosition({ left: x, top: y });
        return;
      }
      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let left = x;
      let top = y;

      // Flip placement near viewport edges and keep a fixed safety margin.
      if (left + rect.width > vw - margin) {
        left = x - rect.width;
      }
      if (top + rect.height > vh - margin) {
        top = y - rect.height;
      }

      left = Math.min(Math.max(margin, left), Math.max(margin, vw - rect.width - margin));
      top = Math.min(Math.max(margin, top), Math.max(margin, vh - rect.height - margin));
      setPosition({ left, top });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [menuRef, x, y]);

  // Render to body so menu is never clipped by scroll/overflow containers.
  return createPortal(
    <div ref={menuRef} className={className} style={{ left: position.left, top: position.top }}>
      {children}
    </div>,
    document.body
  );
}
