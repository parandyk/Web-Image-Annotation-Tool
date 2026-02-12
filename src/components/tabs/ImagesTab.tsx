import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { useSelectedImage, useSortedFilteredAnnotations, useSortedFilteredImages } from '../../store/selectors';
import { MiddleTruncate } from '../common/MiddleTruncate';

function NavIcon({ kind }: { kind: 'first' | 'prev' | 'next' | 'last' }): JSX.Element {
  if (kind === 'first') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M6 4v12" />
        <path d="M14 5l-6 5 6 5" />
      </svg>
    );
  }
  if (kind === 'last') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M14 4v12" />
        <path d="M6 5l6 5-6 5" />
      </svg>
    );
  }
  if (kind === 'prev') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M12.5 5l-5 5 5 5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M7.5 5l5 5-5 5" />
    </svg>
  );
}

function ActionIcon({ kind }: { kind: 'hide' | 'show' | 'delete' | 'anchor' | 'unanchor' }): JSX.Element {
  if (kind === 'delete') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M4 5.8h12" />
        <path d="M7.4 5.8V4.6h5.2v1.2" />
        <path d="M6 5.8l0.9 10h6.2l0.9-10" />
        <path d="M8.8 8.2v5.2" />
        <path d="M11.2 8.2v5.2" />
      </svg>
    );
  }
  if (kind === 'anchor') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M6 7.5V6.7a4 4 0 0 1 8 0v0.8" />
        <rect x="5" y="7.5" width="10" height="8" rx="1.6" ry="1.6" />
      </svg>
    );
  }
  if (kind === 'unanchor') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M6 7.5V6.7a4 4 0 0 1 8 0v0.8" />
        <rect x="5" y="7.5" width="10" height="8" rx="1.6" ry="1.6" />
        <path d="M4 16L16 4" />
      </svg>
    );
  }
  if (kind === 'show') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5z" />
        <circle cx="10" cy="10" r="2.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5z" />
      <circle cx="10" cy="10" r="2.5" />
      <path d="M3 17L17 3" />
    </svg>
  );
}

export function ImagesTab({ view = 'all' }: { view?: 'all' | 'images' | 'annotations' }): JSX.Element {
  const [confirmDeleteAnnId, setConfirmDeleteAnnId] = useState<string | null>(null);
  const [confirmDeleteImageId, setConfirmDeleteImageId] = useState<string | null>(null);
  const [imageSearch, setImageSearch] = useState('');
  const [annotationSearch, setAnnotationSearch] = useState('');
  const imageSort = useAppStore((s) => s.imageSort);
  const imageFilter = useAppStore((s) => s.imageFilter);
  const annotationSort = useAppStore((s) => s.annotationSort);
  const annotationFilter = useAppStore((s) => s.annotationFilter);

  const setImageSort = useAppStore((s) => s.setImageSort);
  const setImageFilter = useAppStore((s) => s.setImageFilter);
  const setAnnotationSort = useAppStore((s) => s.setAnnotationSort);
  const setAnnotationFilter = useAppStore((s) => s.setAnnotationFilter);

  const selectImage = useAppStore((s) => s.selectImage);
  const deleteImage = useAppStore((s) => s.deleteImage);
  const selectAnnotation = useAppStore((s) => s.selectAnnotation);
  const selectedAnnotationId = useAppStore((s) => s.selectedAnnotationId);
  const deleteAnnotation = useAppStore((s) => s.deleteAnnotation);
  const setAnnotationClass = useAppStore((s) => s.setAnnotationClass);
  const toggleAnnotationVisibility = useAppStore((s) => s.toggleAnnotationVisibility);
  const toggleAnnotationAnchoring = useAppStore((s) => s.toggleAnnotationAnchoring);
  const moveToNextImage = useAppStore((s) => s.moveToNextImage);
  const moveToPrevImage = useAppStore((s) => s.moveToPrevImage);
  const moveToFirstImage = useAppStore((s) => s.moveToFirstImage);
  const moveToLastImage = useAppStore((s) => s.moveToLastImage);
  const moveToNextAnnotation = useAppStore((s) => s.moveToNextAnnotation);
  const moveToPrevAnnotation = useAppStore((s) => s.moveToPrevAnnotation);
  const suppressDeleteAnnotationWarning = useAppStore((s) => s.suppressDeleteAnnotationWarningDialog);
  const setSuppressDeleteAnnotationWarning = useAppStore((s) => s.setSuppressDeleteAnnotationWarningDialog);
  const suppressDeleteImageWarning = useAppStore((s) => s.suppressDeleteImageWarningDialog);
  const setSuppressDeleteImageWarning = useAppStore((s) => s.setSuppressDeleteImageWarningDialog);

  const classes = useAppStore((s) => s.classes);
  const images = useSortedFilteredImages();
  const selectedImage = useSelectedImage();
  const annotations = useSortedFilteredAnnotations(selectedImage);
  const displayedImages = images.filter((img) => img.name.toLowerCase().includes(imageSearch.toLowerCase()));
  const displayedAnnotations = annotations.filter((ann) => {
    const cls = classes.find((c) => c.id === ann.classId);
    const label = `#${ann.displayId} ${cls?.name ?? 'Unknown'}`.toLowerCase();
    return label.includes(annotationSearch.toLowerCase());
  });

  const moveToFirstAnnotation = (): void => {
    if (annotations.length === 0) return;
    selectAnnotation(annotations[0].id);
  };

  const moveToLastAnnotation = (): void => {
    if (annotations.length === 0) return;
    selectAnnotation(annotations[annotations.length - 1].id);
  };

  const imagesPanel = (
    <section className="split-panel">
      <h4>Image Navigation</h4>
      <div className="row">
        <button className="icon-nav-btn" title="First image" onClick={moveToFirstImage}><NavIcon kind="first" /></button>
        <button className="icon-nav-btn" title="Previous image" onClick={moveToPrevImage}><NavIcon kind="prev" /></button>
        <button className="icon-nav-btn" title="Next image" onClick={moveToNextImage}><NavIcon kind="next" /></button>
        <button className="icon-nav-btn" title="Last image" onClick={moveToLastImage}><NavIcon kind="last" /></button>
      </div>
      <label>
        Sort
        <select value={imageSort} onChange={(e) => setImageSort(e.target.value as typeof imageSort)}>
          <option value="none">None</option>
          <option value="alphabetical">Alphabetical</option>
          <option value="reversedAlphabetical">Reversed Alphabetical</option>
          <option value="largestFirst">Largest First</option>
          <option value="smallestFirst">Smallest First</option>
          <option value="mostAnnotations">Most Annotations</option>
          <option value="fewestAnnotations">Fewest Annotations</option>
        </select>
      </label>
      <label>
        Filter
        <select value={imageFilter} onChange={(e) => setImageFilter(e.target.value as typeof imageFilter)}>
          <option value="none">None</option>
          <option value="hideAnnotated">Hide Annotated</option>
          <option value="hideUnannotated">Hide Unannotated</option>
        </select>
      </label>
      <label>
        Search
        <input
          type="text"
          value={imageSearch}
          onChange={(e) => setImageSearch(e.target.value)}
          placeholder="Filter by image name"
        />
      </label>

      <h4>Images</h4>
      <div className="list split-list-scroll annotation-list-scroll">
        {displayedImages.length === 0 && (
          <div className="list-row empty-row">
            <span>No images loaded yet.</span>
          </div>
        )}
        {displayedImages.map((img) => (
          <div key={img.id} className={`list-row image-list-row ${selectedImage?.id === img.id ? 'selected' : ''}`}>
            <button className="grow image-name-btn" onClick={() => selectImage(img.id)}>
              <MiddleTruncate text={img.name} className="image-name-mid" />
            </button>
            <button
              className="icon-action-btn"
              title="Delete image"
              aria-label="Delete image"
              onClick={() => {
                if (suppressDeleteImageWarning) {
                  deleteImage(img.id);
                } else {
                  setConfirmDeleteImageId(img.id);
                }
              }}
            >
              <ActionIcon kind="delete" />
            </button>
          </div>
        ))}
      </div>
    </section>
  );

  const annotationsPanel = (
    <section className="split-panel">
      <h4>Annotation Navigation</h4>
      <div className="row">
        <button className="icon-nav-btn" title="First annotation" onClick={moveToFirstAnnotation}><NavIcon kind="first" /></button>
        <button className="icon-nav-btn" title="Previous annotation" onClick={moveToPrevAnnotation}><NavIcon kind="prev" /></button>
        <button className="icon-nav-btn" title="Next annotation" onClick={moveToNextAnnotation}><NavIcon kind="next" /></button>
        <button className="icon-nav-btn" title="Last annotation" onClick={moveToLastAnnotation}><NavIcon kind="last" /></button>
      </div>
      <label>
        Sort
        <select value={annotationSort} onChange={(e) => setAnnotationSort(e.target.value as typeof annotationSort)}>
          <option value="none">None</option>
          <option value="oldest">Oldest</option>
          <option value="newest">Newest</option>
          <option value="alphabetical">Alphabetical</option>
          <option value="reversedAlphabetical">Reversed Alphabetical</option>
          <option value="largestFirst">Largest First</option>
          <option value="smallestFirst">Smallest First</option>
        </select>
      </label>
      <label>
        Filter
        <select value={annotationFilter} onChange={(e) => setAnnotationFilter(e.target.value as typeof annotationFilter)}>
          <option value="none">None</option>
          <option value="hideAssigned">Hide Assigned</option>
          <option value="hideUnassigned">Hide Unassigned</option>
        </select>
      </label>
      <label>
        Search
        <input
          type="text"
          value={annotationSearch}
          onChange={(e) => setAnnotationSearch(e.target.value)}
          placeholder="Filter by annotation label"
        />
      </label>

      <h4>Annotations</h4>
      <div className="list split-list-scroll annotation-list-scroll">
        {displayedAnnotations.length === 0 && (
          <div className="list-row empty-row">
            <span>No annotations in current image.</span>
          </div>
        )}
        {displayedAnnotations.map((ann) => {
          const cls = classes.find((c) => c.id === ann.classId);
          return (
            <div key={ann.id} className={`list-row annotation-item ${selectedAnnotationId === ann.id ? 'selected' : ''}`}>
              <div className="row between">
                <button className="grow annotation-title-btn" onClick={() => selectAnnotation(ann.id)}>
                  <MiddleTruncate text={`#${ann.displayId} ${cls?.name ?? 'Unknown'}`} className="truncate-mid" />
                </button>
              </div>

              <div className="row annotation-actions-inline">
                <button
                  className="icon-action-btn"
                  title={ann.isVisible ? 'Hide annotation' : 'Show annotation'}
                  aria-label={ann.isVisible ? 'Hide annotation' : 'Show annotation'}
                  onClick={() => toggleAnnotationVisibility(ann.id)}
                >
                  <ActionIcon kind={ann.isVisible ? 'hide' : 'show'} />
                </button>
                <button
                  className="icon-action-btn"
                  title={ann.isAnchored ? 'Unanchor annotation' : 'Anchor annotation'}
                  aria-label={ann.isAnchored ? 'Unanchor annotation' : 'Anchor annotation'}
                  onClick={() => toggleAnnotationAnchoring(ann.id)}
                >
                  <ActionIcon kind={ann.isAnchored ? 'unanchor' : 'anchor'} />
                </button>
                <button
                  className="icon-action-btn"
                  title="Delete annotation"
                  aria-label="Delete annotation"
                  onClick={() => {
                    if (suppressDeleteAnnotationWarning) {
                      deleteAnnotation(ann.id);
                    } else {
                      setConfirmDeleteAnnId(ann.id);
                    }
                  }}
                >
                  <ActionIcon kind="delete" />
                </button>
                <span className="annotation-size-chip">
                  {ann.bbox.width.toFixed(0)}x{ann.bbox.height.toFixed(0)}
                </span>
              </div>

              <label>
                Class
                <div className="annotation-class-picker">
                  <span className="color-dot picker-dot" style={{ background: cls?.color ?? '#9CA3AF' }} />
                  <select className="annotation-class-select" value={ann.classId} onChange={(e) => setAnnotationClass(ann.id, e.target.value)}>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
            </div>
          );
        })}
      </div>
    </section>
  );

  return (
    <>
      {view === 'all' && <div className="panel-stack images-tab-split">{imagesPanel}{annotationsPanel}</div>}
      {view === 'images' && <div className="panel-stack">{imagesPanel}</div>}
      {view === 'annotations' && <div className="panel-stack">{annotationsPanel}</div>}

      {confirmDeleteAnnId && (
        <div className="modal-backdrop" onClick={() => setConfirmDeleteAnnId(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="panel-stack">
              <section>
                <h4>Delete annotation</h4>
                <p>This will permanently remove the selected annotation.</p>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={suppressDeleteAnnotationWarning}
                    onChange={(e) => setSuppressDeleteAnnotationWarning(e.target.checked)}
                  />
                  <span>Don't ask again</span>
                </label>
                <div className="row dialog-actions">
                  <button
                    onClick={() => {
                      deleteAnnotation(confirmDeleteAnnId);
                      setConfirmDeleteAnnId(null);
                    }}
                  >
                    Delete
                  </button>
                  <button onClick={() => setConfirmDeleteAnnId(null)}>Cancel</button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
      {confirmDeleteImageId && (
        <div className="modal-backdrop" onClick={() => setConfirmDeleteImageId(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="panel-stack">
              <section>
                <h4>Delete image</h4>
                <p>This removes the image and all annotations assigned to it.</p>
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={suppressDeleteImageWarning}
                    onChange={(e) => setSuppressDeleteImageWarning(e.target.checked)}
                  />
                  <span>Don't ask again</span>
                </label>
                <div className="row dialog-actions">
                  <button
                    onClick={() => {
                      deleteImage(confirmDeleteImageId);
                      setConfirmDeleteImageId(null);
                    }}
                  >
                    Delete
                  </button>
                  <button onClick={() => setConfirmDeleteImageId(null)}>Cancel</button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
