#!/usr/bin/env python3
"""Build compact ReViT 3D hero animations from the 24-angle render sheets."""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
IMAGE_DIR = ROOT / "static" / "images"

SHEETS = [
    ("mhd_combined_renders_velocity.jpg", "revit_3d_mhd_velocity"),
    ("mhd_combined_renders_magnetic.jpg", "revit_3d_mhd_magnetic"),
    ("tcf_combined_renders_velocity.jpg", "revit_3d_tcf_velocity"),
]

# The comparison sheet is a 12x2 montage of 400px-tall render strips.
# Each strip has 7 panels: AFNO, UNet3D, P3D, Swin3D, AViT, ReViT, Reference.
ROW_HEIGHT = 400
PANEL_SIZE = 400
STRIP_STARTS_X = (480, 3320)
REVIT_PANEL_X = 5 * PANEL_SIZE
REFERENCE_PANEL_X = 6 * PANEL_SIZE

# Remove the repeated top model label from the source render and keep the volume.
CROP_TOP = 40
CROP_HEIGHT = 340
PANEL_OUTPUT_SIZE = (480, 408)
OUTPUT_SIZE = (960, 408)

ANGLE_VALUES = [
    {"x": "0", "y": "0", "z": "0"},
    {"x": "pi/2", "y": "0", "z": "0"},
    {"x": "pi", "y": "0", "z": "0"},
    {"x": "3pi/2", "y": "0", "z": "0"},
    {"x": "0", "y": "pi/2", "z": "0"},
    {"x": "0", "y": "pi", "z": "0"},
    {"x": "0", "y": "3pi/2", "z": "0"},
    {"x": "0", "y": "0", "z": "pi/2"},
    {"x": "0", "y": "0", "z": "pi"},
    {"x": "0", "y": "0", "z": "3pi/2"},
    {"x": "pi/2", "y": "0", "z": "pi/2"},
    {"x": "3pi/2", "y": "0", "z": "3pi/2"},
    {"x": "pi/2", "y": "0", "z": "3pi/2"},
    {"x": "3pi/2", "y": "0", "z": "pi/2"},
    {"x": "3pi/2", "y": "0", "z": "pi/2"},
    {"x": "pi/2", "y": "0", "z": "3pi/2"},
    {"x": "3pi/2", "y": "0", "z": "3pi/2"},
    {"x": "pi/2", "y": "0", "z": "pi/2"},
    {"x": "pi/2", "y": "pi/2", "z": "0"},
    {"x": "pi/2", "y": "3pi/2", "z": "0"},
    {"x": "3pi/2", "y": "pi/2", "z": "0"},
    {"x": "3pi/2", "y": "3pi/2", "z": "0"},
    {"x": "0", "y": "pi/2", "z": "pi"},
    {"x": "0", "y": "3pi/2", "z": "pi"},
]

def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    names = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSerif-Regular.ttf",
    ]
    for name in names:
        try:
            return ImageFont.truetype(name, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def text_size(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont) -> tuple[int, int]:
    left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
    return right - left, bottom - top


def draw_math_value(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    axis: str,
    angle: str,
) -> tuple[int, int]:
    axis_font = load_font(24, bold=True)
    math_font = load_font(25)
    small_font = load_font(17)
    color = (255, 255, 255)
    pi = "\u03c0"

    prefix = f"{axis}: "
    prefix_w, prefix_h = text_size(draw, prefix, axis_font)
    draw.text((x, y + 5), prefix, font=axis_font, fill=color)
    value_x = x + prefix_w + 3

    if angle == "0":
        draw.text((value_x, y + 5), "0", font=math_font, fill=color)
        value_w, value_h = text_size(draw, "0", math_font)
        return prefix_w + 3 + value_w, max(prefix_h, value_h + 5)

    if angle == "pi":
        draw.text((value_x, y + 5), pi, font=math_font, fill=color)
        value_w, value_h = text_size(draw, pi, math_font)
        return prefix_w + 3 + value_w, max(prefix_h, value_h + 5)

    numerator = pi if angle == "pi/2" else f"3{pi}"
    denominator = "2"
    num_w, num_h = text_size(draw, numerator, small_font)
    den_w, den_h = text_size(draw, denominator, small_font)
    frac_w = max(num_w, den_w) + 8
    num_x = value_x + (frac_w - num_w) // 2
    den_x = value_x + (frac_w - den_w) // 2
    draw.text((num_x, y - 1), numerator, font=small_font, fill=color)
    line_y = y + num_h + 3
    draw.line((value_x, line_y, value_x + frac_w, line_y), fill=color, width=2)
    draw.text((den_x, line_y), denominator, font=small_font, fill=color)
    return prefix_w + 3 + frac_w, max(prefix_h, num_h + den_h + 5)


def draw_panel_label(frame: Image.Image, x: int, text: str) -> None:
    draw = ImageDraw.Draw(frame, "RGBA")
    font = load_font(22, bold=True)
    text_w, text_h = text_size(draw, text, font)
    y = 14
    draw.rounded_rectangle(
        (x + 14, y, x + text_w + 36, y + text_h + 14),
        radius=12,
        fill=(8, 16, 22, 178),
        outline=(255, 255, 255, 90),
        width=1,
    )
    draw.text((x + 25, y + 5), text, font=font, fill=(255, 255, 255, 255))


def compose_revit_reference_pair(revit: Image.Image, reference: Image.Image) -> Image.Image:
    left = revit.resize(PANEL_OUTPUT_SIZE, Image.Resampling.LANCZOS)
    right = reference.resize(PANEL_OUTPUT_SIZE, Image.Resampling.LANCZOS)
    frame = Image.new("RGB", OUTPUT_SIZE, (12, 18, 24))
    frame.paste(left, (0, 0))
    frame.paste(right, (PANEL_OUTPUT_SIZE[0], 0))

    draw = ImageDraw.Draw(frame, "RGBA")
    seam_x = PANEL_OUTPUT_SIZE[0]
    draw.rectangle((seam_x - 2, 0, seam_x + 2, OUTPUT_SIZE[1]), fill=(255, 255, 255, 120))
    draw_panel_label(frame, 0, "ReViT")
    draw_panel_label(frame, PANEL_OUTPUT_SIZE[0], "Reference")
    return frame


def draw_angle_badge(frame: Image.Image, angles: dict[str, str]) -> Image.Image:
    canvas = frame.copy()
    draw = ImageDraw.Draw(canvas, "RGBA")
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    axes = ("x", "y", "z")
    row_gap = 4
    pad_x = 12
    pad_y = 10
    margin = 16

    sizes = [draw_math_value(probe, 0, 0, axis, angles[axis]) for axis in axes]
    badge_w = max(width for width, _ in sizes) + 2 * pad_x
    badge_h = sum(height for _, height in sizes) + row_gap * (len(axes) - 1) + 2 * pad_y
    badge_x = canvas.width - badge_w - margin
    badge_y = canvas.height - badge_h - margin

    draw.rounded_rectangle(
        (badge_x, badge_y, badge_x + badge_w, badge_y + badge_h),
        radius=14,
        fill=(8, 16, 22, 190),
        outline=(180, 232, 207, 126),
        width=2,
    )

    y = badge_y + pad_y
    for axis, (_, height) in zip(axes, sizes):
        draw_math_value(draw, badge_x + pad_x, y, axis, angles[axis])
        y += height + row_gap

    return canvas

def crop_revit_frames(sheet_path: Path) -> list[Image.Image]:
    sheet = Image.open(sheet_path).convert("RGB")
    frames: list[Image.Image] = []

    for row in range(12):
        y0 = row * ROW_HEIGHT + CROP_TOP
        y1 = y0 + CROP_HEIGHT
        for strip_x in STRIP_STARTS_X:
            revit_x0 = strip_x + REVIT_PANEL_X
            revit_x1 = revit_x0 + PANEL_SIZE
            ref_x0 = strip_x + REFERENCE_PANEL_X
            ref_x1 = ref_x0 + PANEL_SIZE
            revit = sheet.crop((revit_x0, y0, revit_x1, y1))
            reference = sheet.crop((ref_x0, y0, ref_x1, y1))
            frame = compose_revit_reference_pair(revit, reference)
            frames.append(draw_angle_badge(frame, ANGLE_VALUES[len(frames)]))

    if len(frames) != 24:
        raise RuntimeError(f"Expected 24 frames, got {len(frames)}")
    if len(ANGLE_VALUES) != len(frames):
        raise RuntimeError("ANGLE_VALUES must match the 24 rendered frames")

    return frames


def build_smooth_frames(frames: list[Image.Image]) -> list[Image.Image]:
    smooth: list[Image.Image] = []

    for index, frame in enumerate(frames):
        nxt = frames[(index + 1) % len(frames)]
        smooth.extend(frame.copy() for _ in range(3))
        for step in range(1, 6):
            smooth.append(Image.blend(frame, nxt, step / 6.0))

    return smooth


def write_png_sequence(frames: list[Image.Image], target_dir: Path) -> None:
    target_dir.mkdir(parents=True, exist_ok=True)
    for index, frame in enumerate(frames):
        frame.save(target_dir / f"frame_{index:04d}.png", optimize=True)


def encode_mp4(frame_dir: Path, output_path: Path) -> None:
    cmd = [
        "ffmpeg",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-framerate",
        "18",
        "-i",
        str(frame_dir / "frame_%04d.png"),
        "-vf",
        "format=yuv420p",
        "-movflags",
        "+faststart",
        str(output_path),
    ]
    subprocess.run(cmd, check=True)


def encode_gif(frames: list[Image.Image], output_path: Path) -> None:
    gif_frames = [
        frame.resize((560, 238), Image.Resampling.LANCZOS).convert(
            "P", palette=Image.Palette.ADAPTIVE, colors=96
        )
        for frame in frames
    ]
    gif_frames[0].save(
        output_path,
        save_all=True,
        append_images=gif_frames[1:],
        duration=125,
        loop=0,
        optimize=True,
    )


def write_poster(frame: Image.Image, output_path: Path) -> None:
    frame.save(output_path, quality=88, optimize=True, progressive=True)


def main() -> None:
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("ffmpeg is required to encode MP4 animations")

    for source_name, slug in SHEETS:
        source = IMAGE_DIR / source_name
        frames = crop_revit_frames(source)
        smooth_frames = build_smooth_frames(frames)

        with tempfile.TemporaryDirectory(prefix=f"{slug}_") as tmp:
            frame_dir = Path(tmp)
            write_png_sequence(smooth_frames, frame_dir)
            encode_mp4(frame_dir, IMAGE_DIR / f"{slug}.mp4")

        encode_gif(frames, IMAGE_DIR / f"{slug}.gif")
        write_poster(frames[0], IMAGE_DIR / f"{slug}_poster.jpg")
        print(f"Wrote {slug}: {len(frames)} source frames, {len(smooth_frames)} MP4 frames")


if __name__ == "__main__":
    main()
