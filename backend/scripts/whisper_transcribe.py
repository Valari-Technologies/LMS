#!/usr/bin/env python3
"""
OneTutor Whisper Tamil->English Subtitle Generator
===================================================
Detects spoken language (Tamil/other) in a video/audio file,
transcribes it using OpenAI Whisper, and translates to English WebVTT.

Usage:
    python whisper_transcribe.py <input_video_or_audio> <output_vtt_path> [model_size] [lesson_title] [lesson_description]
"""

import sys
import os
import re

# Ensure ffmpeg is available in PATH
try:
    import imageio_ffmpeg
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    ffmpeg_dir = os.path.dirname(ffmpeg_exe)
    if ffmpeg_dir not in os.environ.get("PATH", ""):
        os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")
except Exception:
    pass

# Also add Python Scripts directory if not present
python_scripts = os.path.join(os.path.dirname(sys.executable), "Scripts")
if os.path.isdir(python_scripts) and python_scripts not in os.environ.get("PATH", ""):
    os.environ["PATH"] = python_scripts + os.pathsep + os.environ.get("PATH", "")


def format_vtt_timestamp(seconds):
    total_ms = int(seconds * 1000)
    ms = total_ms % 1000
    total_s = total_ms // 1000
    secs = total_s % 60
    total_m = total_s // 60
    mins = total_m % 60
    hrs = total_m // 60
    return f"{hrs:02d}:{mins:02d}:{secs:02d}.{ms:03d}"


def clean_caption_text(text):
    text = text.strip()
    text = re.sub(r'\[[\w\s]+\]', '', text).strip()
    text = re.sub(r'\([\w\s]+\)', '', text).strip()
    text = re.sub(r'  +', ' ', text)
    return text


def normalize_for_dedup(text):
    return re.sub(r'[^a-zA-Z0-9]', '', text).lower()


def generate_vtt_from_segments(segments):
    lines = ["WEBVTT", ""]
    cue_index = 1
    
    # Deduplicate and merge consecutive repetitive segments (anti-hallucination)
    merged_segments = []
    last_norm = ""
    repeat_count = 0
    
    for seg in segments:
        start = seg.get("start", 0.0)
        end = seg.get("end", start + 1.0)
        text = seg.get("text", "").strip()
        if not text:
            continue
        text = clean_caption_text(text)
        if not text or len(text) < 2:
            continue
            
        norm = normalize_for_dedup(text)
        if norm == last_norm:
            repeat_count += 1
            # If repeated, extend the previous cue up to a maximum duration of 6s, then ignore
            if repeat_count <= 2 and merged_segments:
                prev = merged_segments[-1]
                if end - prev["start"] <= 6.0:
                    prev["end"] = end
            continue
        else:
            repeat_count = 0
            last_norm = norm
            merged_segments.append({"start": start, "end": end, "text": text})

    for seg in merged_segments:
        start = seg["start"]
        end = seg["end"]
        if end <= start:
            end = start + 1.0
        lines.append(str(cue_index))
        lines.append(f"{format_vtt_timestamp(start)} --> {format_vtt_timestamp(end)}")
        lines.append(seg["text"])
        lines.append("")
        cue_index += 1
        
    return "\n".join(lines)


def build_initial_prompt(title="", description=""):
    terms = [
        "MERN stack", "MongoDB", "Express.js", "React.js", "Node.js",
        "JavaScript", "REST API", "Database", "Backend", "Frontend",
        "Full stack", "JSON", "V8 Engine", "Web application", "Server"
    ]
    prompt_parts = []
    if title and title.strip():
        prompt_parts.append(title.strip())
    if description and description.strip():
        prompt_parts.append(description.strip())
    prompt_parts.append(", ".join(terms))
    prompt_parts.append("Educational programming tutorial in Tamil translated to English.")
    return ". ".join(prompt_parts)


def transcribe_and_translate(input_path, output_vtt_path, model_size="base", title="", description=""):
    try:
        import whisper
    except ImportError:
        raise RuntimeError(
            "openai-whisper is not installed. Run: pip install openai-whisper"
        )

    if not os.path.isfile(input_path):
        raise FileNotFoundError(f"Input file not found: {input_path}")

    print(f"[whisper_transcribe] Loading model '{model_size}'...", file=sys.stderr)
    model = whisper.load_model(model_size)

    print(f"[whisper_transcribe] Detecting language in: {input_path}", file=sys.stderr)
    audio = whisper.load_audio(input_path)
    audio_30s = whisper.pad_or_trim(audio)
    mel = whisper.log_mel_spectrogram(audio_30s).to(model.device)
    _, probs = model.detect_language(mel)
    detected_lang = max(probs, key=probs.get)
    detected_prob = probs[detected_lang]
    print(f"[whisper_transcribe] Detected language: {detected_lang} (confidence: {detected_prob:.2%})", file=sys.stderr)

    if detected_lang == "en":
        task = "transcribe"
        print(f"[whisper_transcribe] Audio is English -- using transcribe task.", file=sys.stderr)
    else:
        task = "translate"
        print(f"[whisper_transcribe] Audio is {detected_lang} -- using translate task for English output.", file=sys.stderr)

    initial_prompt = build_initial_prompt(title, description)
    print(f"[whisper_transcribe] Initial prompt: {initial_prompt[:120]}...", file=sys.stderr)
    print(f"[whisper_transcribe] Running Whisper '{task}' task on full audio...", file=sys.stderr)

    # Hook tqdm to emit PROGRESS:0..100 for live status tracking
    try:
        import tqdm
        class ProgressTqdm(tqdm.tqdm):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, **kwargs)
                print("PROGRESS:0", file=sys.stderr, flush=True)

            def update(self, n=1):
                super().update(n)
                if self.total and self.total > 0:
                    pct = min(100, max(0, int((self.n / self.total) * 100)))
                    print(f"PROGRESS:{pct}", file=sys.stderr, flush=True)

        tqdm.tqdm = ProgressTqdm
    except Exception:
        pass

    result = model.transcribe(
        input_path,
        task=task,
        language=detected_lang if detected_lang != "en" else None,
        initial_prompt=initial_prompt,
        condition_on_previous_text=False,
        compression_ratio_threshold=2.2,
        no_speech_threshold=0.6,
        word_timestamps=False,
        verbose=False,
        temperature=0.0,
        fp16=False
    )

    segments = result.get("segments", [])
    if not segments:
        print("[whisper_transcribe] WARNING: No segments found.", file=sys.stderr)
        segments = [{"start": 0.0, "end": 5.0, "text": result.get("text", "").strip()}]

    vtt_content = generate_vtt_from_segments(segments)

    os.makedirs(os.path.dirname(os.path.abspath(output_vtt_path)), exist_ok=True)
    with open(output_vtt_path, "w", encoding="utf-8") as f:
        f.write(vtt_content)

    print(f"[whisper_transcribe] Done! Wrote {len(segments)} raw segments into clean VTT to: {output_vtt_path}", file=sys.stderr)
    print(vtt_content)
    return vtt_content


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <input_media> <output_vtt> [model_size] [title] [description]", file=sys.stderr)
        sys.exit(1)

    input_path = sys.argv[1]
    output_vtt_path = sys.argv[2]
    model_size = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3].strip() else "base"
    title = sys.argv[4] if len(sys.argv) > 4 else ""
    description = sys.argv[5] if len(sys.argv) > 5 else ""

    try:
        transcribe_and_translate(input_path, output_vtt_path, model_size, title, description)
        sys.exit(0)
    except Exception as e:
        print(f"[whisper_transcribe] ERROR: {e}", file=sys.stderr)
        sys.exit(1)
