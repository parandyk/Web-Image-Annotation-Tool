import { useMemo, useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { useSortedFilteredClasses } from '../../store/selectors';
import { MiddleTruncate } from '../common/MiddleTruncate';

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
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deleteMode, setDeleteMode] = useState<'deleteAffected' | 'toUnassigned' | 'toSpecific'>('toUnassigned');
  const [pickerFilter, setPickerFilter] = useState('');
  const [pickerSelected, setPickerSelected] = useState<string>('');

  const addClass = useAppStore((s) => s.addClass);
  const renameClass = useAppStore((s) => s.renameClass);
  const toggleClassVisibility = useAppStore((s) => s.toggleClassVisibility);
  const deleteClassToUnassigned = useAppStore((s) => s.deleteClassToUnassigned);
  const deleteClassSwapTo = useAppStore((s) => s.deleteClassSwapTo);
  const deleteClassAndAffected = useAppStore((s) => s.deleteClassAndAffected);
  const swapClassInstancesGlobal = useAppStore((s) => s.swapClassInstancesGlobal);
  const removeClassInstancesGlobal = useAppStore((s) => s.removeClassInstancesGlobal);
  const toggleClassInstancesAnchoringGlobal = useAppStore((s) => s.toggleClassInstancesAnchoringGlobal);
  const suppressRemoveClassInstancesWarning = useAppStore((s) => s.suppressRemoveClassInstancesWarningDialog);
  const setSuppressRemoveClassInstancesWarning = useAppStore((s) => s.setSuppressRemoveClassInstancesWarningDialog);

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

  const pickerCandidates = useMemo(() => {
    if (!classForDialog) return [];
    return allClasses
      .filter((c) => c.id !== classForDialog.id)
      .filter((c) => c.name.toLowerCase().includes(pickerFilter.toLowerCase()));
  }, [allClasses, classForDialog, pickerFilter]);

  const beginDialog = (next: DialogState): void => {
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
          <h4>Add Class</h4>
          <div className="row">
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
          <h4>Class Controls</h4>
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
                <div key={cls.id} className={`class-card ${selectedClassId === cls.id ? 'selected' : ''}`}>
                  <div className="row between">
                    <button className="grow class-name-btn" onClick={() => selectClass(cls.id)}>
                      <span className="color-dot" style={{ background: cls.color }} />
                      <MiddleTruncate text={cls.name} className="class-name-mid" />
                    </button>
                  </div>

                  <div className="row actions-row class-icon-actions">
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
                  <div className="row actions-row class-instance-actions">
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

                  {!cls.isDefault && (
                    <div className="row">
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
    </>
  );
}
