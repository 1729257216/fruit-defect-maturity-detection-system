"""Lightweight building blocks used by the custom YOLOv8 rotten-grade detector."""

import torch
import torch.nn as nn

from ultralytics.nn.modules import Conv, DWConv


class LiteBottleneck(nn.Module):
    """A lightweight bottleneck that swaps standard 3x3 convs for depthwise separable convs."""

    def __init__(self, channels: int, shortcut: bool = False) -> None:
        super().__init__()
        self.dw = DWConv(channels, channels, k=3, s=1)
        self.pw = Conv(channels, channels, k=1, s=1)
        self.use_shortcut = shortcut

    def forward(self, x):
        y = self.pw(self.dw(x))
        return x + y if self.use_shortcut else y


class C2fLite(nn.Module):
    """Drop-in replacement for C2f with fewer hidden channels and depthwise bottlenecks."""

    def __init__(self, c1: int, c2: int, n: int = 1, shortcut: bool = False, g: int = 1, e: float = 0.375) -> None:
        super().__init__()
        del g
        self.c = int(c2 * e)
        self.cv1 = Conv(c1, 2 * self.c, k=1, s=1)
        self.cv2 = Conv((2 + n) * self.c, c2, k=1, s=1)
        self.m = nn.ModuleList(LiteBottleneck(self.c, shortcut=shortcut) for _ in range(n))

    def forward(self, x):
        y = list(self.cv1(x).chunk(2, 1))
        y.extend(block(y[-1]) for block in self.m)
        return self.cv2(torch.cat(y, 1))
