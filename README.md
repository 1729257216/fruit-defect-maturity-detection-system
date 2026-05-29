# Fruit Defect Maturity Detection System

[中文说明](./README.zh-CN.md)

This repository contains a deep-learning-based fruit defect and maturity detection system focused on mango quality inspection. It includes model training code, a FastAPI inference service, a React frontend, the dataset used by the project, and preserved detection outputs.

## Highlights

- Lightweight fruit defect and maturity detection based on YOLOv8
- FastAPI backend for image inference APIs
- React + TypeScript frontend for interactive demo
- Preserved training outputs, weights, and detection artifacts
- Cleaned public version suitable for portfolio display and reproduction

## Tech Stack

- Python
- PyTorch
- Ultralytics YOLOv8
- FastAPI
- React
- TypeScript
- Vite
- Tailwind CSS
- OpenCV

## Project Structure

- `train.py`: training entry for the YOLOv8 detector
- `predict.py`: offline inference script
- `mobile_api/`: FastAPI backend and static demo assets
- `frontend/`: React frontend demo
- `custom_yolo/`: lightweight YOLO custom modules
- `configs/`: model configuration files
- `datasets/`: YOLO-format dataset
- `runs/`: preserved model weights and training or validation outputs
- `outputs/`: preserved detection output artifacts

## Supported Classes

- `unripe`
- `ripe`
- `slight_rotten`
- `severe_rotten`

## Environment Setup

### 1. Install Python dependencies

Use Python 3.9 or 3.10.

```bash
pip install -r requirements.txt
pip install -r requirements-server.txt
pip install -r requirements-mobile-api.txt
```

### 2. Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

## Run the System

### Option A: start backend and frontend separately

Backend:

```bash
python launch_backend.py
```

Frontend:

```bash
cd frontend
npm run dev -- --host 127.0.0.1 --port 3000
```

Open:

- Frontend: `http://127.0.0.1:3000`
- Backend docs: `http://127.0.0.1:8000/docs`

### Option B: use the launcher on Windows

```bat
start_demo.bat
```

## Model Weights

Default backend and inference weight path:

`runs/baseline_compare/baseline_yolov8n_original/weights/best.pt`

You can also override it with:

```bash
set MANGO_MODEL_WEIGHTS=path\\to\\best.pt
```

## Training

```bash
python train.py --data datasets/rotten_grade_det_4c/data.yaml --name exp
```

## Inference

```bash
python predict.py --source datasets/rotten_grade_det_4c/images/test
```

## Notes

- This repository intentionally does not include local virtual environments.
- Install dependencies locally before running.
- The project has been cleaned to remove thesis-related materials, K230 deployment files, and personal machine paths.
