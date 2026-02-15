import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { useSelectedImage, useSortedFilteredAnnotations, useSortedFilteredImages } from '../../store/selectors';
import { MiddleTruncate } from '../common/MiddleTruncate';
import { PortalMenu } from '../common/PortalMenu';

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

function ActionIcon({ kind }: { kind: 'hide' | 'show' | 'delete' | 'anchor' | 'unanchor' | 'bookmark' | 'unbookmark' }): JSX.Element {
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
  if (kind === 'bookmark') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M6 3.5h8a1 1 0 0 1 1 1V16l-5-2.7L5 16V4.5a1 1 0 0 1 1-1z" />
      </svg>
    );
  }
  if (kind === 'unbookmark') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M6 3.5h8a1 1 0 0 1 1 1V16l-5-2.7L5 16V4.5a1 1 0 0 1 1-1z" />
        <path d="M4 16L16 4" />
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
  const [confirmDeleteAnnIds, setConfirmDeleteAnnIds] = useState<string[] | null>(null);
  const [confirmDeleteImageIds, setConfirmDeleteImageIds] = useState<string[] | null>(null);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [listMenu, setListMenu] = useState<{ type: 'image' | 'annotation'; id: string; x: number; y: number } | null>(null);
  const [imageClassFilterMenu, setImageClassFilterMenu] = useState<{ x: number; y: number } | null>(null);
  const [imageClassFilterSearch, setImageClassFilterSearch] = useState('');
  const [imageSearch, setImageSearch] = useState('');
  const [annotationSearch, setAnnotationSearch] = useState('');
  const hotkeyScopeRef = useRef<HTMLDivElement | null>(null);
  const listMenuRef = useRef<HTMLDivElement | null>(null);
  const imageClassFilterMenuRef = useRef<HTMLDivElement | null>(null);
  const imageClassFilterButtonRef = useRef<HTMLButtonElement | null>(null);
  const imageSort = useAppStore((s) => s.imageSort);
  const imageFilter = useAppStore((s) => s.imageFilter);
  const imageClassFilterMode = useAppStore((s) => s.imageClassFilterMode);
  const imageClassFilterClassIds = useAppStore((s) => s.imageClassFilterClassIds);
  const annotationSort = useAppStore((s) => s.annotationSort);
  const annotationFilter = useAppStore((s) => s.annotationFilter);
  const selectedImageId = useAppStore((s) => s.selectedImageId);
  const selectedAnnotationId = useAppStore((s) => s.selectedAnnotationId);

  const setImageSort = useAppStore((s) => s.setImageSort);
  const setImageFilter = useAppStore((s) => s.setImageFilter);
  const setImageClassFilterMode = useAppStore((s) => s.setImageClassFilterMode);
  const setImageClassFilterClassIds = useAppStore((s) => s.setImageClassFilterClassIds);
  const setAnnotationSort = useAppStore((s) => s.setAnnotationSort);
  const setAnnotationFilter = useAppStore((s) => s.setAnnotationFilter);

  const selectImage = useAppStore((s) => s.selectImage);
  const toggleImageBookmark = useAppStore((s) => s.toggleImageBookmark);
  const setImagesBookmarked = useAppStore((s) => s.setImagesBookmarked);
  const deleteImage = useAppStore((s) => s.deleteImage);
  const deleteImages = useAppStore((s) => s.deleteImages);
  const selectAnnotation = useAppStore((s) => s.selectAnnotation);
  const setAnnotationSelection = useAppStore((s) => s.setAnnotationSelection);
  const selectedAnnotationIds = useAppStore((s) => s.selectedAnnotationIds);
  const toggleAnnotationSelection = useAppStore((s) => s.toggleAnnotationSelection);
  const deleteSelectedAnnotations = useAppStore((s) => s.deleteSelectedAnnotations);
  const deleteAnnotation = useAppStore((s) => s.deleteAnnotation);
  const setAnnotationClass = useAppStore((s) => s.setAnnotationClass);
  const toggleAnnotationVisibility = useAppStore((s) => s.toggleAnnotationVisibility);
  const toggleAnnotationAnchoring = useAppStore((s) => s.toggleAnnotationAnchoring);
  const toggleAnnotationsVisibility = useAppStore((s) => s.toggleAnnotationsVisibility);
  const toggleAnnotationsAnchoring = useAppStore((s) => s.toggleAnnotationsAnchoring);
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

  const imageNavigationIndex = images.findIndex((img) => img.id === selectedImageId);
  const imageNavigationCount = `${imageNavigationIndex >= 0 ? imageNavigationIndex + 1 : 0}/${images.length}`;
  const imageNavigationLabel = imageNavigationIndex >= 0 ? images[imageNavigationIndex].name : 'No selection';
  const canCycleImages = imageNavigationIndex >= 0 && images.length > 1;
  const canJumpToFirstImage = canCycleImages && imageNavigationIndex > 0;
  const canJumpToLastImage = canCycleImages && imageNavigationIndex < images.length - 1;

  const annotationNavigationIndex = annotations.findIndex((ann) => ann.id === selectedAnnotationId);
  const annotationNavigationCount = `${annotationNavigationIndex >= 0 ? annotationNavigationIndex + 1 : 0}/${annotations.length}`;
  const annotationNavigationLabel =
    annotationNavigationIndex >= 0
      ? `#${annotations[annotationNavigationIndex].displayId} ${
          classes.find((c) => c.id === annotations[annotationNavigationIndex].classId)?.name ?? 'Unknown'
        }`
      : 'No selection';
  const canCycleAnnotations = annotationNavigationIndex >= 0 && annotations.length > 1;
  const canJumpToFirstAnnotation = canCycleAnnotations && annotationNavigationIndex > 0;
  const canJumpToLastAnnotation = canCycleAnnotations && annotationNavigationIndex < annotations.length - 1;

  const selectedImageFilterClassSet = useMemo(
    () => new Set(imageClassFilterClassIds),
    [imageClassFilterClassIds]
  );
  const imageFilterClasses = useMemo(
    () =>
      classes.filter((cls) =>
        cls.name.toLowerCase().includes(imageClassFilterSearch.trim().toLowerCase())
      ),
    [classes, imageClassFilterSearch]
  );
  const selectedImageFilterClassNames = useMemo(
    () =>
      classes
        .filter((cls) => selectedImageFilterClassSet.has(cls.id))
        .map((cls) => cls.name),
    [classes, selectedImageFilterClassSet]
  );
  const imageClassFilterSummary =
    selectedImageFilterClassNames.length === 0
      ? 'All classes'
      : selectedImageFilterClassNames.join(', ');

  const selectedAnnotationIdsForCurrentImage = useMemo(() => {
    const available = new Set(annotations.map((ann) => ann.id));
    return selectedAnnotationIds.filter((id) => available.has(id));
  }, [annotations, selectedAnnotationIds]);

  const isSelectionModifier = (evt: { ctrlKey?: boolean; metaKey?: boolean }): boolean =>
    Boolean(evt.ctrlKey || evt.metaKey);

  useEffect(() => {
    const valid = new Set(images.map((img) => img.id));
    setSelectedImageIds((prev) => {
      const next = prev.filter((id) => valid.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [images]);

  useEffect(() => {
    const validClassIds = new Set(classes.map((cls) => cls.id));
    const next = imageClassFilterClassIds.filter((classId) => validClassIds.has(classId));
    if (next.length !== imageClassFilterClassIds.length) {
      setImageClassFilterClassIds(next);
    }
  }, [classes, imageClassFilterClassIds, setImageClassFilterClassIds]);

  useEffect(() => {
    if (!listMenu) return;
    const closeDistancePx = 240;
    const onPointerDown = (e: PointerEvent): void => {
      const target = e.target as Node;
      if (listMenuRef.current?.contains(target)) return;
      setListMenu(null);
    };
    const onPointerMove = (e: PointerEvent): void => {
      const menuEl = listMenuRef.current;
      if (!menuEl) return;
      const rect = menuEl.getBoundingClientRect();
      const px = e.clientX;
      const py = e.clientY;
      const inMenu =
        px >= rect.left - 12 &&
        px <= rect.right + 12 &&
        py >= rect.top - 12 &&
        py <= rect.bottom + 12;
      if (inMenu) return;
      const nearestX = Math.max(rect.left, Math.min(px, rect.right));
      const nearestY = Math.max(rect.top, Math.min(py, rect.bottom));
      const distance = Math.hypot(px - nearestX, py - nearestY);
      // Auto-close long-range pointer drift, consistent with topbar/flyout behavior.
      if (distance > closeDistancePx) {
        setListMenu(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setListMenu(null);
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [listMenu]);

  useEffect(() => {
    if (!imageClassFilterMenu) return;
    const closeDistancePx = 240;
    const onPointerDown = (e: PointerEvent): void => {
      const target = e.target as Node;
      if (imageClassFilterMenuRef.current?.contains(target)) return;
      if (imageClassFilterButtonRef.current?.contains(target)) return;
      setImageClassFilterMenu(null);
    };
    const onPointerMove = (e: PointerEvent): void => {
      const menuEl = imageClassFilterMenuRef.current;
      const buttonEl = imageClassFilterButtonRef.current;
      if (!menuEl) return;
      const px = e.clientX;
      const py = e.clientY;

      const withinRect = (rect: DOMRect): boolean =>
        px >= rect.left - 12 &&
        px <= rect.right + 12 &&
        py >= rect.top - 12 &&
        py <= rect.bottom + 12;

      if (withinRect(menuEl.getBoundingClientRect())) return;
      if (buttonEl && withinRect(buttonEl.getBoundingClientRect())) return;

      const rect = menuEl.getBoundingClientRect();
      const nearestX = Math.max(rect.left, Math.min(px, rect.right));
      const nearestY = Math.max(rect.top, Math.min(py, rect.bottom));
      if (Math.hypot(px - nearestX, py - nearestY) > closeDistancePx) {
        setImageClassFilterMenu(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      setImageClassFilterMenu(null);
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [imageClassFilterMenu]);

  const deleteAnnotationIdsWithWarning = (ids: string[]): void => {
    if (ids.length === 0) return;
    if (suppressDeleteAnnotationWarning) {
      if (ids.length === 1) {
        deleteAnnotation(ids[0]);
      } else {
        setAnnotationSelection(ids, ids[ids.length - 1] ?? null);
        deleteSelectedAnnotations();
      }
      return;
    }
    setConfirmDeleteAnnIds(ids);
  };

  const deleteImageIdsWithWarning = (ids: string[]): void => {
    if (ids.length === 0) return;
    if (suppressDeleteImageWarning) {
      if (ids.length === 1) deleteImage(ids[0]);
      else deleteImages(ids);
      return;
    }
    setConfirmDeleteImageIds(ids);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.defaultPrevented) return;
      if (e.repeat) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (document.querySelector('.modal-backdrop')) return;

      const active = document.activeElement as HTMLElement | null;
      if (active?.closest('input,textarea,select,[contenteditable="true"],.class-hotkey-btn.active')) return;

      const scope = hotkeyScopeRef.current;
      if (!scope || !active || !scope.contains(active)) return;

      const canDeleteAnnotations = view !== 'images';
      if (canDeleteAnnotations && selectedAnnotationIdsForCurrentImage.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        deleteAnnotationIdsWithWarning(selectedAnnotationIdsForCurrentImage);
        setListMenu(null);
        return;
      }

      const canDeleteImages = view !== 'annotations';
      if (!canDeleteImages) return;
      const imageIds = selectedImageIds.length > 0 ? selectedImageIds : selectedImageId ? [selectedImageId] : [];
      if (imageIds.length === 0) return;
      e.preventDefault();
      e.stopPropagation();
      deleteImageIdsWithWarning(imageIds);
      setListMenu(null);
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [
    deleteAnnotationIdsWithWarning,
    deleteImageIdsWithWarning,
    selectedAnnotationIdsForCurrentImage,
    selectedImageId,
    selectedImageIds,
    view,
  ]);

  const moveToFirstAnnotation = (): void => {
    if (annotations.length === 0) return;
    selectAnnotation(annotations[0].id);
  };

  const moveToLastAnnotation = (): void => {
    if (annotations.length === 0) return;
    selectAnnotation(annotations[annotations.length - 1].id);
  };

  const toggleImageClassFilterClass = (classId: string): void => {
    if (selectedImageFilterClassSet.has(classId)) {
      setImageClassFilterClassIds(imageClassFilterClassIds.filter((id) => id !== classId));
      return;
    }
    setImageClassFilterClassIds([...imageClassFilterClassIds, classId]);
  };

  const imagesPanel = (
    // Image panel: navigation + filtered list + multi-select + bulk delete context menu.
    <section className="split-panel">
      <h4>Image navigation</h4>
      <div className="row nav-row">
        <button className="icon-nav-btn" title="First image" onClick={moveToFirstImage} disabled={!canJumpToFirstImage}><NavIcon kind="first" /></button>
        <button className="icon-nav-btn" title="Previous image" onClick={moveToPrevImage} disabled={!canCycleImages}><NavIcon kind="prev" /></button>
        <button className="icon-nav-btn" title="Next image" onClick={moveToNextImage} disabled={!canCycleImages}><NavIcon kind="next" /></button>
        <button className="icon-nav-btn" title="Last image" onClick={moveToLastImage} disabled={!canJumpToLastImage}><NavIcon kind="last" /></button>
        <div className="nav-status" title={`${imageNavigationLabel} (${imageNavigationCount})`}>
          <span className="nav-status-label">{imageNavigationLabel}</span>
          <span className="nav-status-count">{imageNavigationCount}</span>
        </div>
      </div>
      <label>
        Sort
        <select value={imageSort} onChange={(e) => setImageSort(e.target.value as typeof imageSort)}>
          <option value="none">None</option>
          <option value="alphabetical">Alphabetical</option>
          <option value="reversedAlphabetical">Reversed alphabetical</option>
          <option value="largestFirst">Largest first</option>
          <option value="smallestFirst">Smallest first</option>
          <option value="mostAnnotations">Most annotations</option>
          <option value="fewestAnnotations">Fewest annotations</option>
        </select>
      </label>
      <label>
        Filter
        <select value={imageFilter} onChange={(e) => setImageFilter(e.target.value as typeof imageFilter)}>
          <option value="none">None</option>
          <option value="hideAnnotated">Hide annotated</option>
          <option value="hideUnannotated">Hide unannotated</option>
          <option value="hideBookmarked">Hide bookmarked</option>
          <option value="hideUnbookmarked">Hide unbookmarked</option>
        </select>
      </label>
      <label>
        Class filter
        <select
          value={imageClassFilterMode}
          onChange={(e) => setImageClassFilterMode(e.target.value as typeof imageClassFilterMode)}
        >
          <option value="none">None</option>
          <option value="hasAny">Has any selected</option>
          <option value="hasAll">Has all selected</option>
          <option value="hasNone">Has none selected</option>
        </select>
        <div className="row class-filter-row">
          <button
            ref={imageClassFilterButtonRef}
            type="button"
            className="grow class-filter-picker-btn"
            title={imageClassFilterSummary}
            onClick={(e) => {
              if (imageClassFilterMenu) {
                setImageClassFilterMenu(null);
                return;
              }
              const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
              setImageClassFilterMenu({ x: rect.left, y: rect.bottom + 6 });
            }}
          >
            <MiddleTruncate text={imageClassFilterSummary} className="truncate-mid" />
          </button>
          <button
            type="button"
            onClick={() => setImageClassFilterClassIds([])}
            disabled={imageClassFilterClassIds.length === 0}
          >
            Clear
          </button>
        </div>
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
          <div
            key={img.id}
            className={`list-row image-list-row ${selectedImageIds.includes(img.id) || selectedImage?.id === img.id ? 'selected' : ''}`}
            onContextMenu={(e) => {
              e.preventDefault();
              if (!selectedImageIds.includes(img.id)) {
                setSelectedImageIds([img.id]);
                selectImage(img.id);
              }
              setListMenu({ type: 'image', id: img.id, x: e.clientX, y: e.clientY });
            }}
          >
            <button
              className="grow image-name-btn"
              onClick={(e) => {
                if (isSelectionModifier(e)) {
                  setSelectedImageIds((prev) => {
                    if (prev.includes(img.id)) return prev.filter((id) => id !== img.id);
                    return [...prev, img.id];
                  });
                  selectImage(img.id);
                } else {
                  setSelectedImageIds([img.id]);
                  selectImage(img.id);
                }
              }}
            >
              <MiddleTruncate text={img.name} className="image-name-mid" />
            </button>
            <button
              className="icon-action-btn"
              title={img.isBookmarked ? 'Remove bookmark' : 'Bookmark image'}
              aria-label={img.isBookmarked ? 'Remove bookmark' : 'Bookmark image'}
              onClick={() => {
                toggleImageBookmark(img.id);
              }}
            >
              <ActionIcon kind={img.isBookmarked ? 'unbookmark' : 'bookmark'} />
            </button>
            <button
              className="icon-action-btn"
              title="Delete image"
              aria-label="Delete image"
              onClick={() => {
                deleteImageIdsWithWarning([img.id]);
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
    // Annotation panel: navigation + per-item controls + class reassignment.
    <section className="split-panel">
      <h4>Annotation navigation</h4>
      <div className="row nav-row">
        <button
          className="icon-nav-btn"
          title="First annotation"
          onClick={moveToFirstAnnotation}
          disabled={!canJumpToFirstAnnotation}
        >
          <NavIcon kind="first" />
        </button>
        <button
          className="icon-nav-btn"
          title="Previous annotation"
          onClick={moveToPrevAnnotation}
          disabled={!canCycleAnnotations}
        >
          <NavIcon kind="prev" />
        </button>
        <button
          className="icon-nav-btn"
          title="Next annotation"
          onClick={moveToNextAnnotation}
          disabled={!canCycleAnnotations}
        >
          <NavIcon kind="next" />
        </button>
        <button
          className="icon-nav-btn"
          title="Last annotation"
          onClick={moveToLastAnnotation}
          disabled={!canJumpToLastAnnotation}
        >
          <NavIcon kind="last" />
        </button>
        <div className="nav-status" title={`${annotationNavigationLabel} (${annotationNavigationCount})`}>
          <span className="nav-status-label">{annotationNavigationLabel}</span>
          <span className="nav-status-count">{annotationNavigationCount}</span>
        </div>
      </div>
      <label>
        Sort
        <select value={annotationSort} onChange={(e) => setAnnotationSort(e.target.value as typeof annotationSort)}>
          <option value="none">None</option>
          <option value="oldest">Oldest</option>
          <option value="newest">Newest</option>
          <option value="alphabetical">Alphabetical</option>
          <option value="reversedAlphabetical">Reversed alphabetical</option>
          <option value="largestFirst">Largest first</option>
          <option value="smallestFirst">Smallest first</option>
        </select>
      </label>
      <label>
        Filter
        <select value={annotationFilter} onChange={(e) => setAnnotationFilter(e.target.value as typeof annotationFilter)}>
          <option value="none">None</option>
          <option value="hideAssigned">Hide assigned</option>
          <option value="hideUnassigned">Hide unassigned</option>
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
            <div
              key={ann.id}
              className={`list-row annotation-item ${selectedAnnotationIds.includes(ann.id) ? 'selected' : ''}`}
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest('button,input,select,textarea,label,a,[role="button"]')) return;
                if (isSelectionModifier(e)) {
                  toggleAnnotationSelection(ann.id);
                } else {
                  selectAnnotation(ann.id);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                const target = e.target as HTMLElement;
                if (target.closest('.annotation-class-picker,.annotation-class-select,select,input,label')) {
                  return;
                }
                if (target.closest('button') && !target.closest('.annotation-title-btn')) {
                  return;
                }
                if (!selectedAnnotationIds.includes(ann.id)) {
                  selectAnnotation(ann.id);
                }
                setListMenu({ type: 'annotation', id: ann.id, x: e.clientX, y: e.clientY });
              }}
            >
              <div className="row between">
                <button
                  className="grow annotation-title-btn"
                  onClick={(e) => {
                    if (isSelectionModifier(e)) {
                      toggleAnnotationSelection(ann.id);
                    } else {
                      selectAnnotation(ann.id);
                    }
                  }}
                >
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
                    deleteAnnotationIdsWithWarning([ann.id]);
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
      <div ref={hotkeyScopeRef}>
        {view === 'all' && <div className="panel-stack images-tab-split">{imagesPanel}{annotationsPanel}</div>}
        {view === 'images' && <div className="panel-stack">{imagesPanel}</div>}
        {view === 'annotations' && <div className="panel-stack">{annotationsPanel}</div>}
      </div>

      {imageClassFilterMenu && (
        <PortalMenu
          x={imageClassFilterMenu.x}
          y={imageClassFilterMenu.y}
          menuRef={imageClassFilterMenuRef}
          className="annotation-menu class-filter-menu"
        >
          <label>
            Search classes
            <input
              type="text"
              value={imageClassFilterSearch}
              onChange={(e) => setImageClassFilterSearch(e.target.value)}
              placeholder="Filter classes"
            />
          </label>
          <div className="class-filter-actions">
            <button
              type="button"
              onClick={() => {
                const visibleIds = imageFilterClasses.map((cls) => cls.id);
                if (visibleIds.length === 0) return;
                setImageClassFilterClassIds([...new Set([...imageClassFilterClassIds, ...visibleIds])]);
              }}
              disabled={imageFilterClasses.length === 0}
            >
              Select all visible
            </button>
            <button
              type="button"
              onClick={() => setImageClassFilterClassIds([])}
              disabled={imageClassFilterClassIds.length === 0}
            >
              Clear
            </button>
          </div>
          <div className="class-filter-list">
            {imageFilterClasses.length === 0 && (
              <div className="class-filter-empty">No matching classes.</div>
            )}
            {imageFilterClasses.map((cls) => (
              <button
                key={cls.id}
                type="button"
                className={`class-filter-option ${selectedImageFilterClassSet.has(cls.id) ? 'selected' : ''}`}
                onClick={() => toggleImageClassFilterClass(cls.id)}
              >
                <span className="class-filter-check" aria-hidden="true">
                  {selectedImageFilterClassSet.has(cls.id) ? '✓' : ''}
                </span>
                <span className="color-dot" style={{ background: cls.color }} />
                <span className="class-filter-option-name">{cls.name}</span>
              </button>
            ))}
          </div>
        </PortalMenu>
      )}

      {listMenu && (
        <PortalMenu x={listMenu.x} y={listMenu.y} menuRef={listMenuRef}>
          {listMenu.type === 'image' ? (
            <>
              <button
                onClick={() => {
                  const ids = selectedImageIds.includes(listMenu.id) ? selectedImageIds : [listMenu.id];
                  setImagesBookmarked(ids, true);
                  setListMenu(null);
                }}
              >
                Bookmark selected
              </button>
              <button
                onClick={() => {
                  const ids = selectedImageIds.includes(listMenu.id) ? selectedImageIds : [listMenu.id];
                  setImagesBookmarked(ids, false);
                  setListMenu(null);
                }}
              >
                Remove bookmark from selected
              </button>
              <button
                onClick={() => {
                  const ids = selectedImageIds.includes(listMenu.id) ? selectedImageIds : [listMenu.id];
                  deleteImageIdsWithWarning(ids);
                  setListMenu(null);
                }}
              >
                Delete selected
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  const ids =
                    selectedAnnotationIds.includes(listMenu.id) && selectedAnnotationIds.length > 1
                      ? selectedAnnotationIds
                      : [listMenu.id];
                  if (ids.length > 1) toggleAnnotationsVisibility(ids);
                  else toggleAnnotationVisibility(listMenu.id);
                  setListMenu(null);
                }}
              >
                Toggle visibility
              </button>
              <button
                onClick={() => {
                  const ids =
                    selectedAnnotationIds.includes(listMenu.id) && selectedAnnotationIds.length > 1
                      ? selectedAnnotationIds
                      : [listMenu.id];
                  if (ids.length > 1) toggleAnnotationsAnchoring(ids);
                  else toggleAnnotationAnchoring(listMenu.id);
                  setListMenu(null);
                }}
              >
                Toggle anchoring
              </button>
              <button
                onClick={() => {
                  const ids =
                    selectedAnnotationIds.includes(listMenu.id) && selectedAnnotationIds.length > 1
                      ? selectedAnnotationIds
                      : [listMenu.id];
                  deleteAnnotationIdsWithWarning(ids);
                  setListMenu(null);
                }}
              >
                Delete selected
              </button>
            </>
          )}
        </PortalMenu>
      )}

      {confirmDeleteAnnIds && (
        <div className="modal-backdrop" onClick={() => setConfirmDeleteAnnIds(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="panel-stack">
              <section>
                <h4>Delete annotation</h4>
                <p>
                  {confirmDeleteAnnIds.length > 1
                    ? `This will permanently remove ${confirmDeleteAnnIds.length} selected annotations.`
                    : 'This will permanently remove the selected annotation.'}
                </p>
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
                      if (confirmDeleteAnnIds.length === 1) {
                        deleteAnnotation(confirmDeleteAnnIds[0]);
                      } else {
                        setAnnotationSelection(confirmDeleteAnnIds, confirmDeleteAnnIds[confirmDeleteAnnIds.length - 1] ?? null);
                        deleteSelectedAnnotations();
                      }
                      setConfirmDeleteAnnIds(null);
                    }}
                  >
                    Delete
                  </button>
                  <button onClick={() => setConfirmDeleteAnnIds(null)}>Cancel</button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
      {confirmDeleteImageIds && (
        <div className="modal-backdrop" onClick={() => setConfirmDeleteImageIds(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="panel-stack">
              <section>
                <h4>Delete image</h4>
                <p>
                  {confirmDeleteImageIds.length > 1
                    ? `This removes ${confirmDeleteImageIds.length} images and all annotations assigned to them.`
                    : 'This removes the image and all annotations assigned to it.'}
                </p>
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
                      if (confirmDeleteImageIds.length === 1) {
                        deleteImage(confirmDeleteImageIds[0]);
                      } else {
                        deleteImages(confirmDeleteImageIds);
                      }
                      setConfirmDeleteImageIds(null);
                    }}
                  >
                    Delete
                  </button>
                  <button onClick={() => setConfirmDeleteImageIds(null)}>Cancel</button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
