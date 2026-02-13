import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { useSortedFilteredClasses } from '../../store/selectors';
import { MiddleTruncate } from '../common/MiddleTruncate';
import { PortalMenu } from '../common/PortalMenu';

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

type DialogState =
  | null
  | { type: 'deleteClass'; classId: string }
  | { type: 'swapInstances'; classId: string }
  | { type: 'removeInstances'; classId: string };

export function ClassesTab(): JSX.Element {
  const [nameInput, setNameInput] = useState('');
  const [classSearch, setClassSearch] = useState('');
  const [renameMap, setRenameMap] = useState<Record<string, string>>({});
  const [captureHotkeyClassId, setCaptureHotkeyClassId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [classMenu, setClassMenu] = useState<{ classId: string; x: number; y: number } | null>(null);
  const classMenuRef = useRef<HTMLDivElement | null>(null);
  const [bulkDeleteClassIds, setBulkDeleteClassIds] = useState<string[] | null>(null);
  const [bulkSwapClassIds, setBulkSwapClassIds] = useState<string[] | null>(null);
  const [bulkRemoveClassIds, setBulkRemoveClassIds] = useState<string[] | null>(null);
  const [deleteMode, setDeleteMode] = useState<'deleteAffected' | 'toUnassigned' | 'toSpecific'>('toUnassigned');
  const [pickerFilter, setPickerFilter] = useState('');
  const [pickerSelected, setPickerSelected] = useState<string>('');

  const addClass = useAppStore((s) => s.addClass);
  const renameClass = useAppStore((s) => s.renameClass);
  const setClassHotkey = useAppStore((s) => s.setClassHotkey);
  const clearClassHotkey = useAppStore((s) => s.clearClassHotkey);
  const toggleClassVisibility = useAppStore((s) => s.toggleClassVisibility);
  const deleteClassToUnassigned = useAppStore((s) => s.deleteClassToUnassigned);
  const deleteClassSwapTo = useAppStore((s) => s.deleteClassSwapTo);
  const deleteClassAndAffected = useAppStore((s) => s.deleteClassAndAffected);
  const swapClassInstancesGlobal = useAppStore((s) => s.swapClassInstancesGlobal);
  const removeClassInstancesGlobal = useAppStore((s) => s.removeClassInstancesGlobal);
  const toggleClassInstancesAnchoringGlobal = useAppStore((s) => s.toggleClassInstancesAnchoringGlobal);
  const suppressRemoveClassInstancesWarning = useAppStore((s) => s.suppressRemoveClassInstancesWarningDialog);
  const setSuppressRemoveClassInstancesWarning = useAppStore((s) => s.setSuppressRemoveClassInstancesWarningDialog);
  const setStatusText = useAppStore((s) => s.setStatusText);

  const selectClass = useAppStore((s) => s.selectClass);
  const selectedClassId = useAppStore((s) => s.selectedClassId);
  const classSort = useAppStore((s) => s.classSort);
  const classFilter = useAppStore((s) => s.classFilter);
  const setClassSort = useAppStore((s) => s.setClassSort);
  const setClassFilter = useAppStore((s) => s.setClassFilter);

  const classes = useSortedFilteredClasses();
  const allClasses = useAppStore((s) => s.classes);
  const images = useAppStore((s) => s.images);

  const classForDialog = useMemo(
    () => (dialog ? allClasses.find((c) => c.id === dialog.classId) ?? null : null),
    [allClasses, dialog]
  );
  const displayedClasses = useMemo(
    () => classes.filter((c) => c.name.toLowerCase().includes(classSearch.toLowerCase())),
    [classSearch, classes]
  );
  const classById = useMemo(() => new Map(allClasses.map((c) => [c.id, c])), [allClasses]);
  const classUsageById = useMemo(() => {
    // Global per-class usage is reused by sort/filter and bulk safety checks.
    const m = new Map<string, number>();
    for (const c of allClasses) m.set(c.id, 0);
    for (const img of images) {
      for (const ann of img.annotations) {
        m.set(ann.classId, (m.get(ann.classId) ?? 0) + 1);
      }
    }
    return m;
  }, [allClasses, images]);

  const pickerCandidates = useMemo(() => {
    if (!classForDialog) return [];
    return allClasses
      .filter((c) => c.id !== classForDialog.id)
      .filter((c) => c.name.toLowerCase().includes(pickerFilter.toLowerCase()));
  }, [allClasses, classForDialog, pickerFilter]);
  const bulkPickerCandidates = useMemo(() => {
    const excluded = new Set([
      ...(bulkSwapClassIds ?? []),
      ...(bulkDeleteClassIds ?? []),
    ]);
    return allClasses
      .filter((c) => !excluded.has(c.id))
      .filter((c) => c.name.toLowerCase().includes(pickerFilter.toLowerCase()));
  }, [allClasses, bulkDeleteClassIds, bulkSwapClassIds, pickerFilter]);

  useEffect(() => {
    const valid = new Set(allClasses.map((c) => c.id));
    setSelectedClassIds((prev) => {
      const next = prev.filter((id) => valid.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [allClasses]);

  useEffect(() => {
    if (!classMenu) return;
    const closeDistancePx = 240;
    const onPointerDown = (e: PointerEvent): void => {
      const target = e.target as Node;
      if (classMenuRef.current?.contains(target)) return;
      setClassMenu(null);
    };
    const onPointerMove = (e: PointerEvent): void => {
      const menuEl = classMenuRef.current;
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
      // Keep context menu open while pointer is nearby.
      if (distance > closeDistancePx) {
        setClassMenu(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setClassMenu(null);
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [classMenu]);

  useEffect(() => {
    if (!captureHotkeyClassId) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        setCaptureHotkeyClassId(null);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) {
        setStatusText('Use a single letter (A-Z) or digit (0-9).');
        return;
      }
      if (e.key.length !== 1) {
        setStatusText('Use a single letter (A-Z) or digit (0-9).');
        return;
      }
      const hotkey = e.key.toUpperCase();
      if (!/^[A-Z0-9]$/.test(hotkey)) {
        setStatusText('Use a single letter (A-Z) or digit (0-9).');
        return;
      }
      setClassHotkey(captureHotkeyClassId, hotkey);
      setCaptureHotkeyClassId(null);
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [captureHotkeyClassId, setClassHotkey, setStatusText]);

  const isSelectionModifier = (evt: { ctrlKey?: boolean; metaKey?: boolean }): boolean =>
    Boolean(evt.ctrlKey || evt.metaKey);

  const selectClassRow = (classId: string, additive: boolean): void => {
    if (additive) {
      setSelectedClassIds((prev) => {
        const exists = prev.includes(classId);
        if (exists) {
          const next = prev.filter((id) => id !== classId);
          if (next.length > 0) selectClass(next[next.length - 1]);
          return next;
        }
        const next = [...prev, classId];
        selectClass(classId);
        return next;
      });
      return;
    }
    setSelectedClassIds([classId]);
    selectClass(classId);
  };

  const classIdsForMenu = (classId: string): string[] =>
    selectedClassIds.includes(classId) && selectedClassIds.length > 0 ? selectedClassIds : [classId];

  const openBulkDeleteDialog = (ids: string[]): void => {
    // Deleting default class is blocked; unassigned classes without usage can be removed directly.
    const deletable = ids.filter((id) => !classById.get(id)?.isDefault);
    if (deletable.length === 0) {
      setStatusText('Default class cannot be deleted.');
      return;
    }
    const hasAssigned = deletable.some((id) => (classUsageById.get(id) ?? 0) > 0);
    if (!hasAssigned) {
      for (const id of deletable) deleteClassToUnassigned(id);
      return;
    }
    setDeleteMode('toUnassigned');
    setPickerFilter('');
    const firstCandidate = allClasses.find((c) => !deletable.includes(c.id));
    setPickerSelected(firstCandidate?.id ?? '');
    setBulkDeleteClassIds(deletable);
  };

  const openBulkSwapDialog = (ids: string[]): void => {
    const unique = Array.from(new Set(ids));
    if (unique.length === 0) return;
    const firstCandidate = allClasses.find((c) => !unique.includes(c.id));
    if (!firstCandidate) {
      setStatusText('No target class available for swap.');
      return;
    }
    setPickerFilter('');
    setPickerSelected(firstCandidate.id);
    setBulkSwapClassIds(unique);
  };

  const openBulkRemoveDialog = (ids: string[]): void => {
    const unique = Array.from(new Set(ids));
    if (unique.length === 0) return;
    if (suppressRemoveClassInstancesWarning) {
      for (const id of unique) removeClassInstancesGlobal(id);
      return;
    }
    setBulkRemoveClassIds(unique);
  };

  const beginDialog = (next: DialogState): void => {
    // Centralized dialog bootstrap keeps picker state consistent across actions.
    setDialog(next);
    setDeleteMode('toUnassigned');
    setPickerFilter('');
    const id = next ? next.classId : '';
    const firstCandidate = allClasses.find((c) => c.id !== id);
    setPickerSelected(firstCandidate?.id ?? '');
  };

  return (
    <>
      <div className="panel-stack">
        <section>
          <h4>Add class</h4>
          <div className="row add-class-row">
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addClass(nameInput);
                  setNameInput('');
                }
              }}
              placeholder="Class name"
            />
            <button
              onClick={() => {
                addClass(nameInput);
                setNameInput('');
              }}
            >
              Add
            </button>
          </div>
        </section>

        <section>
          <h4>Class controls</h4>
          <label>
            Sort
            <select value={classSort} onChange={(e) => setClassSort(e.target.value as typeof classSort)}>
              <option value="none">None</option>
              <option value="alphabetical">Alphabetical</option>
              <option value="reversedAlphabetical">Reversed Alphabetical</option>
              <option value="countAscending">Count Ascending</option>
              <option value="countDescending">Count Descending</option>
            </select>
          </label>
          <label>
            Filter
            <select value={classFilter} onChange={(e) => setClassFilter(e.target.value as typeof classFilter)}>
              <option value="none">None</option>
              <option value="hideUsed">Hide Used</option>
              <option value="hideUnused">Hide Unused</option>
            </select>
          </label>
          <label>
            Search
            <input
              type="text"
              value={classSearch}
              onChange={(e) => setClassSearch(e.target.value)}
              placeholder="Filter by class name"
            />
          </label>
        </section>

        <section>
          <h4>Classes</h4>
          <div className="list">
            {displayedClasses.length === 0 && (
              <div className="list-row empty-row">
                <span>No classes available.</span>
              </div>
            )}
            {displayedClasses.map((cls) => {
              const rename = renameMap[cls.id] ?? cls.name;
              const classAnns = images.flatMap((img) => img.annotations.filter((a) => a.classId === cls.id));
              const hasUnanchored = classAnns.some((a) => !a.isAnchored);

              return (
                <div
                  key={cls.id}
                  className={`class-card ${selectedClassIds.includes(cls.id) || selectedClassId === cls.id ? 'selected' : ''}`}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest('button,input,select,textarea,label,a,[role="button"]')) return;
                    selectClassRow(cls.id, isSelectionModifier(e));
                  }}
                  onContextMenu={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.closest('input,select,textarea,label,a,[role="button"]')) return;
                    if (target.closest('button') && !target.closest('.class-name-btn')) return;
                    e.preventDefault();
                    if (!selectedClassIds.includes(cls.id)) {
                      setSelectedClassIds([cls.id]);
                      selectClass(cls.id);
                    }
                    setClassMenu({ classId: cls.id, x: e.clientX, y: e.clientY });
                  }}
                >
                  <div className="row between">
                    <button
                      className="grow class-name-btn"
                      onClick={(e) => selectClassRow(cls.id, isSelectionModifier(e))}
                    >
                      <span className="color-dot" style={{ background: cls.color }} />
                      <MiddleTruncate text={cls.name} className="class-name-mid" />
                    </button>
                    <div className="class-hotkey-controls">
                      <button
                        className={`class-hotkey-btn ${captureHotkeyClassId === cls.id ? 'active' : ''}`}
                        onClick={() =>
                          setCaptureHotkeyClassId((current) => (current === cls.id ? null : cls.id))
                        }
                        title={captureHotkeyClassId === cls.id ? 'Press A-Z or 0-9. Esc cancels.' : 'Assign class hotkey'}
                      >
                        {captureHotkeyClassId === cls.id ? 'Press key...' : cls.hotkey ? `Key: ${cls.hotkey}` : 'Set key'}
                      </button>
                      {cls.hotkey && (
                        <button
                          className="class-hotkey-clear"
                          onClick={() => clearClassHotkey(cls.id)}
                          title="Clear class hotkey"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="row actions-row class-actions-combined">
                    <div className="class-icon-actions">
                      <button
                        className="icon-action-btn"
                        title={cls.isVisible ? 'Hide class' : 'Show class'}
                        aria-label={cls.isVisible ? 'Hide class' : 'Show class'}
                        onClick={() => toggleClassVisibility(cls.id)}
                      >
                        <ActionIcon kind={cls.isVisible ? 'hide' : 'show'} />
                      </button>
                      <button
                        className="icon-action-btn"
                        title={hasUnanchored ? 'Anchor class instances' : 'Unanchor class instances'}
                        aria-label={hasUnanchored ? 'Anchor class instances' : 'Unanchor class instances'}
                        onClick={() => toggleClassInstancesAnchoringGlobal(cls.id)}
                      >
                        <ActionIcon kind={hasUnanchored ? 'anchor' : 'unanchor'} />
                      </button>
                      {!cls.isDefault && (
                        <button
                          className="icon-action-btn"
                          title="Delete class"
                          aria-label="Delete class"
                          onClick={() => {
                            if (classAnns.length === 0) {
                              deleteClassToUnassigned(cls.id);
                            } else {
                              beginDialog({ type: 'deleteClass', classId: cls.id });
                            }
                          }}
                        >
                          <ActionIcon kind="delete" />
                        </button>
                      )}
                    </div>
                    <div className="class-instance-actions">
                      <button onClick={() => beginDialog({ type: 'swapInstances', classId: cls.id })}>Swap instances</button>
                      <button
                        onClick={() => {
                          if (suppressRemoveClassInstancesWarning) {
                            removeClassInstancesGlobal(cls.id);
                            return;
                          }
                          beginDialog({ type: 'removeInstances', classId: cls.id });
                        }}
                      >
                        Remove instances
                      </button>
                    </div>
                  </div>

                  {!cls.isDefault && (
                    <div className="row rename-row">
                      <input
                        className="rename-input"
                        value={rename}
                        onChange={(e) =>
                          setRenameMap((prev) => ({
                            ...prev,
                            [cls.id]: e.target.value,
                          }))
                        }
                      />
                      <button onClick={() => renameClass(cls.id, rename)}>Rename</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {classMenu && (
        <PortalMenu x={classMenu.x} y={classMenu.y} menuRef={classMenuRef}>
          <button
            onClick={() => {
              const ids = classIdsForMenu(classMenu.classId);
              for (const id of ids) toggleClassVisibility(id);
              setClassMenu(null);
            }}
          >
            Toggle visibility
          </button>
          <button
            onClick={() => {
              const ids = classIdsForMenu(classMenu.classId);
              for (const id of ids) toggleClassInstancesAnchoringGlobal(id);
              setClassMenu(null);
            }}
          >
            Toggle anchoring
          </button>
          <button
            onClick={() => {
              openBulkDeleteDialog(classIdsForMenu(classMenu.classId));
              setClassMenu(null);
            }}
          >
            Delete selected
          </button>
          <button
            onClick={() => {
              openBulkSwapDialog(classIdsForMenu(classMenu.classId));
              setClassMenu(null);
            }}
          >
            Swap instances
          </button>
          <button
            onClick={() => {
              openBulkRemoveDialog(classIdsForMenu(classMenu.classId));
              setClassMenu(null);
            }}
          >
            Remove instances
          </button>
        </PortalMenu>
      )}

      {dialog && classForDialog && (
        <div className="modal-backdrop" onClick={() => setDialog(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="panel-stack">
              {dialog.type === 'deleteClass' && (
                <section>
                  <h4>Delete class: {classForDialog.name}</h4>
                  <label className="radio-row">
                    <input
                      type="radio"
                      checked={deleteMode === 'deleteAffected'}
                      onChange={() => setDeleteMode('deleteAffected')}
                    />
                    Delete affected annotations
                  </label>
                  <label className="radio-row">
                    <input
                      type="radio"
                      checked={deleteMode === 'toUnassigned'}
                      onChange={() => setDeleteMode('toUnassigned')}
                    />
                    Change affected annotations to Unassigned
                  </label>
                  <label className="radio-row">
                    <input
                      type="radio"
                      checked={deleteMode === 'toSpecific'}
                      onChange={() => setDeleteMode('toSpecific')}
                    />
                    Change affected annotations to specific class
                  </label>

                  {deleteMode === 'toSpecific' && (
                    <>
                      <input
                        placeholder="Filter classes"
                        value={pickerFilter}
                        onChange={(e) => setPickerFilter(e.target.value)}
                      />
                      <select value={pickerSelected} onChange={(e) => setPickerSelected(e.target.value)}>
                        {pickerCandidates.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </>
                  )}

                  <div className="row dialog-actions">
                    <button
                      onClick={() => {
                        if (deleteMode === 'deleteAffected') deleteClassAndAffected(classForDialog.id);
                        else if (deleteMode === 'toUnassigned') deleteClassToUnassigned(classForDialog.id);
                        else if (pickerSelected) deleteClassSwapTo(classForDialog.id, pickerSelected);
                        setDialog(null);
                      }}
                    >
                      Confirm
                    </button>
                    <button onClick={() => setDialog(null)}>Cancel</button>
                  </div>
                </section>
              )}

              {dialog.type === 'swapInstances' && (
                <section>
                  <h4>Swap instances: {classForDialog.name}</h4>
                  <p>Replace all instances of this class with another class, without deleting the class itself.</p>
                  <input placeholder="Filter classes" value={pickerFilter} onChange={(e) => setPickerFilter(e.target.value)} />
                  <select value={pickerSelected} onChange={(e) => setPickerSelected(e.target.value)}>
                    {pickerCandidates.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <div className="row dialog-actions">
                    <button
                      onClick={() => {
                        if (pickerSelected) swapClassInstancesGlobal(classForDialog.id, pickerSelected);
                        setDialog(null);
                      }}
                    >
                      Confirm
                    </button>
                    <button onClick={() => setDialog(null)}>Cancel</button>
                  </div>
                </section>
              )}

              {dialog.type === 'removeInstances' && (
                <section>
                  <h4>Remove instances: {classForDialog.name}</h4>
                  <p>Remove all annotations assigned to this class, while keeping the class.</p>
                  {!suppressRemoveClassInstancesWarning && <p className="warning-text">Warning: this deletes annotation instances and can be undone only via Undo.</p>}
                  <label className="inline-check">
                    <input
                      type="checkbox"
                      checked={suppressRemoveClassInstancesWarning}
                      onChange={(e) => setSuppressRemoveClassInstancesWarning(e.target.checked)}
                    />
                    <span>Don't ask again</span>
                  </label>
                  <div className="row dialog-actions">
                    <button
                      onClick={() => {
                        removeClassInstancesGlobal(classForDialog.id);
                        setDialog(null);
                      }}
                    >
                      Confirm
                    </button>
                    <button onClick={() => setDialog(null)}>Cancel</button>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      )}

      {bulkDeleteClassIds && (
        <div className="modal-backdrop" onClick={() => setBulkDeleteClassIds(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="panel-stack">
              <section>
                <h4>Delete classes</h4>
                <p>This will delete {bulkDeleteClassIds.length} selected classes.</p>
                <label className="radio-row">
                  <input
                    type="radio"
                    checked={deleteMode === 'deleteAffected'}
                    onChange={() => setDeleteMode('deleteAffected')}
                  />
                  Delete affected annotations
                </label>
                <label className="radio-row">
                  <input
                    type="radio"
                    checked={deleteMode === 'toUnassigned'}
                    onChange={() => setDeleteMode('toUnassigned')}
                  />
                  Change affected annotations to Unassigned
                </label>
                <label className="radio-row">
                  <input
                    type="radio"
                    checked={deleteMode === 'toSpecific'}
                    onChange={() => setDeleteMode('toSpecific')}
                  />
                  Change affected annotations to specific class
                </label>
                {deleteMode === 'toSpecific' && (
                  <>
                    <input
                      placeholder="Filter classes"
                      value={pickerFilter}
                      onChange={(e) => setPickerFilter(e.target.value)}
                    />
                    <select value={pickerSelected} onChange={(e) => setPickerSelected(e.target.value)}>
                      {bulkPickerCandidates.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </>
                )}
                <div className="row dialog-actions">
                  <button
                    onClick={() => {
                      if (deleteMode === 'deleteAffected') {
                        for (const id of bulkDeleteClassIds) deleteClassAndAffected(id);
                      } else if (deleteMode === 'toUnassigned') {
                        for (const id of bulkDeleteClassIds) deleteClassToUnassigned(id);
                      } else if (pickerSelected) {
                        for (const id of bulkDeleteClassIds) {
                          if (id !== pickerSelected) deleteClassSwapTo(id, pickerSelected);
                        }
                      } else {
                        setStatusText('Select a target class first.');
                        return;
                      }
                      setBulkDeleteClassIds(null);
                    }}
                  >
                    Confirm
                  </button>
                  <button onClick={() => setBulkDeleteClassIds(null)}>Cancel</button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {bulkSwapClassIds && (
        <div className="modal-backdrop" onClick={() => setBulkSwapClassIds(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="panel-stack">
              <section>
                <h4>Swap instances</h4>
                <p>Replace instances for {bulkSwapClassIds.length} selected classes.</p>
                <input
                  placeholder="Filter classes"
                  value={pickerFilter}
                  onChange={(e) => setPickerFilter(e.target.value)}
                />
                <select value={pickerSelected} onChange={(e) => setPickerSelected(e.target.value)}>
                  {bulkPickerCandidates.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <div className="row dialog-actions">
                  <button
                    onClick={() => {
                      if (!pickerSelected) {
                        setStatusText('Select a target class first.');
                        return;
                      }
                      for (const id of bulkSwapClassIds) {
                        if (id !== pickerSelected) swapClassInstancesGlobal(id, pickerSelected);
                      }
                      setBulkSwapClassIds(null);
                    }}
                  >
                    Confirm
                  </button>
                  <button onClick={() => setBulkSwapClassIds(null)}>Cancel</button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {bulkRemoveClassIds && (
        <div className="modal-backdrop" onClick={() => setBulkRemoveClassIds(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="panel-stack">
              <section>
                <h4>Remove instances</h4>
                <p>Remove annotation instances for {bulkRemoveClassIds.length} selected classes.</p>
                {!suppressRemoveClassInstancesWarning && <p className="warning-text">Warning: this deletes annotation instances and can be undone only via Undo.</p>}
                <label className="inline-check">
                  <input
                    type="checkbox"
                    checked={suppressRemoveClassInstancesWarning}
                    onChange={(e) => setSuppressRemoveClassInstancesWarning(e.target.checked)}
                  />
                  <span>Don't ask again</span>
                </label>
                <div className="row dialog-actions">
                  <button
                    onClick={() => {
                      for (const id of bulkRemoveClassIds) removeClassInstancesGlobal(id);
                      setBulkRemoveClassIds(null);
                    }}
                  >
                    Confirm
                  </button>
                  <button onClick={() => setBulkRemoveClassIds(null)}>Cancel</button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
