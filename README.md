# Image Annotation Tool (Web React)

React web rewrite of the `Workspace_VM` Avalonia app, focused on preserving annotation behavior and workflow.

## Run

```bash
cd /Users/michal/Documents/New\ project/webapp
npm install
npm run dev
```

Build:

```bash
npm run build
```

## Implemented Core Behavior

- Image workspace with pan/zoom matrix transform (Konva stage transform).
- Annotation drawing modes:
  - click-click,
  - drag draw.
- Annotation editing:
  - thumb-based resizing,
  - dragging,
  - anchoring (disables drag and resize),
  - per-annotation visibility.
- Class management:
  - add, rename, visibility toggle,
  - delete with swap substitute,
  - delete with affected annotations.
- Image management:
  - open multiple images,
  - select/delete,
  - filter/sort.
- Annotation list operations in sidebar:
  - select/delete/change class,
  - visibility/anchoring toggles,
  - filter/sort.
- Undo/redo stack with shortcuts:
  - Windows/Linux: `Ctrl+Z`, `Ctrl+Y`,
  - macOS: `Cmd+Z`, `Cmd+Shift+Z`.
- Export:
  - classes to `.txt`,
  - annotations to YOLO (`.zip` dataset),
  - annotations to COCO (`instances_default.json`).

## Notes

- Right click on an annotation supports quick actions:
  - `Shift + right click`: toggle visibility,
  - `Alt + right click`: toggle anchoring,
  - `Ctrl/Cmd + right click`: delete.
