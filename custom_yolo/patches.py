"""Runtime patches for Ultralytics YOLOv8 detection with custom lightweight mango modules."""

from __future__ import annotations

import ast
import contextlib
from typing import Iterable, Sequence

import torch
import torch.nn as nn

from ultralytics.nn import tasks as yolo_tasks
from ultralytics.nn.modules import C2f, Concat, Conv, Detect, SPPF
from ultralytics.utils import LOGGER, colorstr
from ultralytics.utils.loss import v8DetectionLoss
from ultralytics.utils.tal import make_anchors
from ultralytics.utils.torch_utils import make_divisible

from .layers import C2fLite

_ORIGINAL_PARSE_MODEL = yolo_tasks.parse_model
_CUSTOM_MODULE_NAMES = {"C2fLite"}


def _build_positive_sample_weights(target_scores: torch.Tensor, class_weights: torch.Tensor, dtype: torch.dtype):
    sample_weights = torch.ones(target_scores.shape[:2], device=target_scores.device, dtype=dtype)
    positive_mask = target_scores.sum(-1) > 0
    if positive_mask.any():
        assigned_labels = target_scores.argmax(-1)
        sample_weights[positive_mask] = class_weights.to(dtype)[assigned_labels[positive_mask]]
    return sample_weights


class WeightedV8DetectionLoss(v8DetectionLoss):
    """Apply class-dependent sample weights to the classification branch."""

    def __init__(self, model, class_weights: Sequence[float]):
        super().__init__(model)
        if len(class_weights) != self.nc:
            raise ValueError(f"class_weights length {len(class_weights)} must equal nc={self.nc}")
        self.class_weights = torch.tensor(class_weights, dtype=torch.float32, device=self.device)

    def __call__(self, preds, batch):
        loss = torch.zeros(3, device=self.device)
        feats = preds[1] if isinstance(preds, tuple) else preds
        pred_distri, pred_scores = torch.cat([xi.view(feats[0].shape[0], self.no, -1) for xi in feats], 2).split(
            (self.reg_max * 4, self.nc),
            1,
        )

        pred_scores = pred_scores.permute(0, 2, 1).contiguous()
        pred_distri = pred_distri.permute(0, 2, 1).contiguous()

        dtype = pred_scores.dtype
        batch_size = pred_scores.shape[0]
        imgsz = torch.tensor(feats[0].shape[2:], device=self.device, dtype=dtype) * self.stride[0]
        anchor_points, stride_tensor = make_anchors(feats, self.stride, 0.5)

        targets = torch.cat((batch["batch_idx"].view(-1, 1), batch["cls"].view(-1, 1), batch["bboxes"]), 1)
        targets = self.preprocess(targets.to(self.device), batch_size, scale_tensor=imgsz[[1, 0, 1, 0]])
        gt_labels, gt_bboxes = targets.split((1, 4), 2)
        mask_gt = gt_bboxes.sum(2, keepdim=True).gt_(0)

        pred_bboxes = self.bbox_decode(anchor_points, pred_distri)
        _, target_bboxes, target_scores, fg_mask, _ = self.assigner(
            pred_scores.detach().sigmoid(),
            (pred_bboxes.detach() * stride_tensor).type(gt_bboxes.dtype),
            anchor_points * stride_tensor,
            gt_labels,
            gt_bboxes,
            mask_gt,
        )

        target_scores_sum = target_scores.sum().clamp(min=1.0)
        sample_weights = _build_positive_sample_weights(target_scores, self.class_weights, dtype)

        cls_loss_map = self.bce(pred_scores, target_scores.to(dtype))
        loss[1] = (cls_loss_map * sample_weights.unsqueeze(-1)).sum() / target_scores_sum

        if fg_mask.sum():
            target_bboxes /= stride_tensor
            loss[0], loss[2] = self.bbox_loss(
                pred_distri,
                pred_bboxes,
                anchor_points,
                target_bboxes,
                target_scores,
                target_scores_sum,
                fg_mask,
            )

        loss[0] *= self.hyp.box
        loss[1] *= self.hyp.cls
        loss[2] *= self.hyp.dfl
        return loss.sum() * batch_size, loss.detach()


def _resolve_module(module_name: str):
    if module_name.startswith("nn."):
        return getattr(torch.nn, module_name[3:])
    custom_modules = {
        "Conv": Conv,
        "C2f": C2f,
        "C2fLite": C2fLite,
        "SPPF": SPPF,
        "Concat": Concat,
        "Detect": Detect,
    }
    return custom_modules[module_name]


def _contains_custom_modules(model_dict: dict) -> bool:
    for _, _, module_name, _ in model_dict["backbone"] + model_dict["head"]:
        if module_name in _CUSTOM_MODULE_NAMES:
            return True
    return False


def _parse_model_with_custom_modules(d, ch, verbose=True):
    if not _contains_custom_modules(d):
        return _ORIGINAL_PARSE_MODEL(d, ch, verbose)

    max_channels = float("inf")
    nc, act, scales = (d.get(key) for key in ("nc", "activation", "scales"))
    depth, width = (d.get(key, 1.0) for key in ("depth_multiple", "width_multiple"))

    if scales:
        scale = d.get("scale")
        if not scale:
            scale = tuple(scales.keys())[0]
            LOGGER.warning(f"WARNING no model scale passed. Assuming scale='{scale}'.")
        depth, width, max_channels = scales[scale]

    if act:
        Conv.default_act = eval(act)
        if verbose:
            LOGGER.info(f"{colorstr('activation:')} {act}")

    if verbose:
        LOGGER.info(f"\n{'':>3}{'from':>20}{'n':>3}{'params':>10}  {'module':<45}{'arguments':<30}")

    ch = [ch]
    layers, save, c2 = [], [], ch[-1]

    for i, (f, n, m, args) in enumerate(d["backbone"] + d["head"]):
        m = _resolve_module(m)
        args = list(args)
        for j, a in enumerate(args):
            if isinstance(a, str):
                with contextlib.suppress(ValueError, SyntaxError):
                    args[j] = locals()[a] if a in locals() else ast.literal_eval(a)

        n = n_ = max(round(n * depth), 1) if n > 1 else n
        if m in (Conv, C2f, C2fLite, SPPF):
            c1, c2 = ch[f], args[0]
            if c2 != nc:
                c2 = make_divisible(min(c2, max_channels) * width, 8)
            args = [c1, c2, *args[1:]]
            if m in (C2f, C2fLite):
                args.insert(2, n)
                n = 1
        elif m is Concat:
            c2 = sum(ch[x] for x in f)
        elif m is Detect:
            args.append([ch[x] for x in f])
            c2 = sum(ch[x] for x in f)
        else:
            c2 = ch[f]

        m_ = nn.Sequential(*(m(*args) for _ in range(n))) if n > 1 else m(*args)
        t = str(m)[8:-2].replace("__main__.", "")
        m_.np = sum(x.numel() for x in m_.parameters())
        m_.i, m_.f, m_.type = i, f, t
        if verbose:
            LOGGER.info(f"{i:>3}{str(f):>20}{n_:>3}{m_.np:10.0f}  {t:<45}{str(args):<30}")
        save.extend(x % i for x in ([f] if isinstance(f, int) else f) if x != -1)
        layers.append(m_)
        if i == 0:
            ch = []
        ch.append(c2)

    return nn.Sequential(*layers), sorted(save)


def _register_parser() -> None:
    yolo_tasks.C2fLite = C2fLite
    yolo_tasks.parse_model = _parse_model_with_custom_modules


def apply_yolov8_patches(class_weights: Iterable[float]) -> None:
    """Register custom parse_model and weighted classification loss for detection."""

    class_weights = list(class_weights)
    _register_parser()

    def _init_criterion(self):
        return WeightedV8DetectionLoss(self, class_weights=class_weights)

    yolo_tasks.DetectionModel.init_criterion = _init_criterion
