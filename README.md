# Image Annotation Tool (Web React)

React web rewrite of the https://github.com/parandyk/Image-Annotation-Tool Avalonia app.

## Getting started

```bash
cd /Web-Image-Annotation-Tool
npm install
npm run dev
```

Build:

```bash
npm run build
```

## Description

The tool allows for annotation of images and videos parsed into frames for standard object detection dataset exports. 

YOLO, COCO and Pascal VOC formats are currently supported for both importing and exporting.

## Shortcuts & hotkeys

Users can define their own hotkeys for specific classes from the class sections in the sidebar.

Backquote (`) is a built-in hotkey for switching between adding and editing mode.

Alt + arrow keys for incremental, discrete annotation moving, 1 px translation per move. Shift + Alt + arrow keys for 10 px translation per move.

Left and right arrow key are used for navigation between open images. Up and down arrow key are used for navigation between annotations in the currently selected image.

Ctrl + Z for undo, Ctrl + Shift + Z for redo. Delete works where applicable, e.g. for deleting selected annotations.

## Showcase

[Tool stable demo](https://parandyk.github.io/Web-Image-Annotation-Tool/)

[Neural network Inference beta demo](https://parandyk.github.io/Web-Image-Annotation-Tool/neural)


## Upcoming features

Automatic annotation using neural network inference - [now available in neural branch!](https://github.com/parandyk/Web-Image-Annotation-Tool/tree/neural)

[YOLO26n by Ultralytics](https://github.com/ultralytics/ultralytics) was utilized for demonstration purposes.

## Disclaimer

This tool was developed nearly exclusively using OpenAI Codex.

## Documentation

Coming soon!
