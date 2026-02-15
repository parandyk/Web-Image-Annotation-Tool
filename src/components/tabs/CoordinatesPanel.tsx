import { useMemo } from 'react';
import { useAppStore } from '../../store/appStore';
import { useSelectedImage } from '../../store/selectors';
import { MiddleTruncate } from '../common/MiddleTruncate';

type CoordValue = {
  key: 'X1' | 'Y1' | 'X2' | 'Y2' | 'Width' | 'Height';
  value: string;
};

function formatPx(v: number | null): string {
  if (v === null) return '';
  return v.toFixed(1);
}

export function CoordinatesPanel(): JSX.Element {
  const selectedImage = useSelectedImage();
  const selectedAnnotationId = useAppStore((s) => s.selectedAnnotationId);
  const liveDraftBBox = useAppStore((s) => s.liveDraftBBox);
  const selectedClassId = useAppStore((s) => s.selectedClassId);
  const classes = useAppStore((s) => s.classes);

  const selectedAnnotation = useMemo(() => {
    if (!selectedImage || !selectedAnnotationId) return null;
    return selectedImage.annotations.find((a) => a.id === selectedAnnotationId) ?? null;
  }, [selectedAnnotationId, selectedImage]);

  const selectedBBox = selectedAnnotation?.bbox ?? null;
  // While drawing, live draft coordinates take precedence over selected annotation coordinates.
  const bbox = liveDraftBBox ?? selectedBBox;
  const sourceLabel = liveDraftBBox ? 'Drawing' : selectedBBox ? 'Selected annotation' : 'No active annotation';
  const classId = liveDraftBBox ? selectedClassId : selectedAnnotation?.classId ?? null;
  const classData = classes.find((c) => c.id === classId) ?? null;
  const classLabel = classData?.name ?? '';
  const classColor = classData?.color ?? '#9CA3AF';

  const values: CoordValue[] = useMemo(() => {
    if (!bbox) {
      return [
        { key: 'X1', value: '' },
        { key: 'Y1', value: '' },
        { key: 'X2', value: '' },
        { key: 'Y2', value: '' },
        { key: 'Width', value: '' },
        { key: 'Height', value: '' },
      ];
    }

    return [
      { key: 'X1', value: formatPx(bbox.x) },
      { key: 'Y1', value: formatPx(bbox.y) },
      { key: 'X2', value: formatPx(bbox.x + bbox.width) },
      { key: 'Y2', value: formatPx(bbox.y + bbox.height) },
      { key: 'Width', value: formatPx(bbox.width) },
      { key: 'Height', value: formatPx(bbox.height) },
    ];
  }, [bbox]);

  return (
    <div className="coords-panel">
      <div className="coords-source">{sourceLabel} (px)</div>
      <div className="coords-class-row">
        <span className="coord-key">Class</span>
        <span className="coords-class-badge">
          <span className="coords-class-value">
            {classData && <span className="color-dot" style={{ background: classColor }} />}
            <MiddleTruncate
              text={classLabel}
              className="coords-class-name"
              measureTarget="grandparent"
              reservePx={classData ? 18 : 0}
            />
          </span>
        </span>
      </div>
      <div className="coords-grid">
        {values.map((item) => (
          <div key={item.key} className="coord-item">
            <span className="coord-key">{item.key}</span>
            <span className="coord-value">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
