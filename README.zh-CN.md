# 基于深度学习的水果成熟度缺陷检测系统

[English README](./README.md)

本仓库是一个面向芒果品质检测场景的深度学习水果缺陷与成熟度检测系统，包含模型训练代码、FastAPI 推理服务、React 前端演示、项目数据集以及保留的检测与训练产物。

## 项目亮点

- 基于 YOLOv8 的水果成熟度与缺陷检测
- 提供 FastAPI 图像推理接口
- 提供 React + TypeScript 可视化前端演示
- 保留模型权重、训练结果和检测产物
- 已清理为适合公开展示与复现的版本

## 技术栈

- Python
- PyTorch
- Ultralytics YOLOv8
- FastAPI
- React
- TypeScript
- Vite
- Tailwind CSS
- OpenCV

## 项目结构

- `train.py`：YOLOv8 检测模型训练入口
- `predict.py`：离线推理脚本
- `mobile_api/`：FastAPI 后端与静态演示页面
- `frontend/`：React 前端演示
- `custom_yolo/`：轻量化 YOLO 自定义模块
- `configs/`：模型配置文件
- `datasets/`：YOLO 格式数据集
- `runs/`：保留的模型权重与训练、验证结果
- `outputs/`：保留的检测输出产物

## 检测类别

- `unripe`：未成熟
- `ripe`：成熟
- `slight_rotten`：轻度腐烂
- `severe_rotten`：重度腐烂

## 环境准备

### 1. 安装 Python 依赖

建议使用 Python 3.9 或 3.10。

```bash
pip install -r requirements.txt
pip install -r requirements-server.txt
pip install -r requirements-mobile-api.txt
```

### 2. 安装前端依赖

```bash
cd frontend
npm install
cd ..
```

## 运行方式

### 方式一：分别启动后端与前端

后端：

```bash
python launch_backend.py
```

前端：

```bash
cd frontend
npm run dev -- --host 127.0.0.1 --port 3000
```

启动后访问：

- 前端页面：`http://127.0.0.1:3000`
- 后端接口文档：`http://127.0.0.1:8000/docs`

### 方式二：Windows 下使用启动脚本

```bat
start_demo.bat
```

## 模型权重

默认后端和推理脚本使用的模型权重路径为：

`runs/baseline_compare/baseline_yolov8n_original/weights/best.pt`

也可以通过环境变量覆盖：

```bash
set MANGO_MODEL_WEIGHTS=path\\to\\best.pt
```

## 模型训练

```bash
python train.py --data datasets/rotten_grade_det_4c/data.yaml --name exp
```

## 离线推理

```bash
python predict.py --source datasets/rotten_grade_det_4c/images/test
```

## 说明

- 本仓库不包含本地虚拟环境，请使用者自行安装依赖。
