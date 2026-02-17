Place local ONNX model files in this folder.

Recommended default for this app:

- File path: `webapp/public/models/yolo26n.onnx`
- Runtime URL in app settings: `/models/yolo26n.onnx`

Notes:

- Keep model filenames stable so settings and CI stay reproducible.
- If you replace a model, preserve the same filename or update the configured model URL in Settings.
