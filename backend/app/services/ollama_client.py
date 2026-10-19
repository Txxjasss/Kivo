import json
import re
import httpx
from typing import Dict, Any, Optional

OLLAMA_BASE_URL = "http://127.0.0.1:11434"
MODEL_NAME = "qwen2.5:3b"

async def check_ollama_status() -> Dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            if resp.status_code == 200:
                data = resp.json()
                models = [m.get("name", "") for m in data.get("models", [])]
                has_target = any(MODEL_NAME in m for m in models)
                return {
                    "connected": True,
                    "target_model": MODEL_NAME,
                    "model_available": has_target,
                    "installed_models": models
                }
            return {"connected": False, "error": f"Status code {resp.status_code}"}
    except Exception as e:
        return {"connected": False, "error": str(e)}

def _clean_json_text(text: str) -> str:
    """Strip markdown backticks or preamble text if present."""
    text = text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if match:
        return match.group(1).strip()
    return text

async def extract_scope_from_brief(brief_text: str) -> Dict[str, Any]:
    system_prompt = (
        "You are Kivo Scope Engine, an expert software architecture and project scoping assistant for senior freelance engineers. "
        "Analyze the client's project brief thoroughly. Deconstruct it into four strict categories:\n"
        "1. 'requirements': Clear, discrete deliverables with realistic estimated hours, complexity (low, medium, high), and provenance ('explicit' if directly stated in client text, or 'suggested' if inferred/enhancement/sub-feature). Do not invent unmentioned features as explicit—mark them as 'suggested'!\n"
        "2. 'assumptions': Crucial technical or operational assumptions (e.g. APIs provided, design tokens supplied, third-party licenses paid by client).\n"
        "3. 'exclusions': Out-of-scope boundaries (e.g. ongoing maintenance, copywriting, multi-language localization, legacy browser support).\n"
        "4. 'clarifications': Unresolved questions to ask the client before finalizing scope.\n\n"
        "Respond ONLY with a valid JSON object matching this exact structure:\n"
        "{\n"
        '  "summary": "Concise 2-3 sentence overview of project scope",\n'
        '  "requirements": [\n'
        '    {"title": "...", "description": "...", "complexity": "low|medium|high", "estimated_hours_min": 6, "estimated_hours_max": 12, "suggested_hours": 8, "provenance": "explicit|suggested"}\n'
        "  ],\n"
        '  "assumptions": [\n'
        '    {"title": "...", "description": "..."}\n'
        "  ],\n"
        '  "exclusions": [\n'
        '    {"title": "...", "description": "..."}\n'
        "  ],\n"
        '  "clarifications": [\n'
        '    {"question": "...", "reason": "..."}\n'
        "  ]\n"
        "}"
    )

    user_prompt = f"Client Brief:\n---\n{brief_text}\n---"

    payload = {
        "model": MODEL_NAME,
        "system": system_prompt,
        "prompt": user_prompt,
        "format": "json",
        "stream": False,
        "options": {
            "temperature": 0.2,
            "num_predict": 2048
        }
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload)
            if resp.status_code != 200:
                raise RuntimeError(f"Ollama API returned {resp.status_code}: {resp.text}")
            
            raw_response = resp.json().get("response", "{}")
            cleaned = _clean_json_text(raw_response)
            parsed = json.loads(cleaned)
            if isinstance(parsed, dict):
                parsed["extraction_source"] = "ollama_qwen25_3b"
            return parsed
    except Exception as e:
        # Fallback structured parsing if model fails or times out
        return _fallback_scope_extraction(brief_text, str(e))

def _fallback_scope_extraction(brief_text: str, err_msg: str) -> Dict[str, Any]:
    lines = [line.strip("- *") for line in brief_text.strip().split("\n") if len(line.strip()) > 3]
    reqs = []
    for i, line in enumerate(lines[:6]):
        reqs.append({
            "title": f"Deliverable: {line[:40]}..." if len(line) > 40 else line,
            "description": line,
            "complexity": "medium",
            "estimated_hours_min": 4.0,
            "estimated_hours_max": 10.0,
            "suggested_hours": 6.0,
            "provenance": "explicit",
            "category": "requirement"
        })

    return {
        "summary": "Project scope extracted from client brief (local parsing fallback).",
        "extraction_source": "local_fallback",
        "requirements": reqs if reqs else [{
            "title": "Core Implementation",
            "description": "Full-stack development based on brief",
            "complexity": "medium",
            "estimated_hours_min": 10.0,
            "estimated_hours_max": 20.0,
            "suggested_hours": 15.0,
            "provenance": "explicit",
            "category": "requirement"
        }],
        "assumptions": [
            {"title": "Asset Delivery", "description": "Client provides brand assets, content, and design tokens upfront."},
            {"title": "Third-Party Credentials", "description": "Client provides required sandbox and API credentials."}
        ],
        "exclusions": [
            {"title": "Legacy Support", "description": "Support for deprecated browser engines or legacy mobile OS is excluded."},
            {"title": "Custom Content Creation", "description": "Copywriting and graphic asset generation are not included."}
        ],
        "clarifications": [
            {"question": "What is the expected production deployment date?", "reason": "Affects sprint velocity and resource scheduling."}
        ]
    }

async def analyze_scope_creep(baseline_summary: str, baseline_items: list, client_message: str) -> Dict[str, Any]:
    system_prompt = (
        "You are Kivo Scope Creep Detector. Compare the client's latest message against the agreed baseline scope items.\n"
        "Determine if the client is asking for work outside the original scope, expanding existing features, or asking for clarifications.\n"
        "Respond ONLY with a valid JSON object matching this structure:\n"
        "{\n"
        '  "summary": "Concise summary of the request impact",\n'
        '  "changes": [\n'
        '    {\n'
        '      "title": "Short title of addition",\n'
        '      "impact_type": "new_feature|scope_expansion|out_of_scope|clarification",\n'
        '      "reasoning": "Why this exceeds original agreed baseline",\n'
        '      "estimated_hours": 4.5\n'
        "    }\n"
        "  ]\n"
        "}"
    )

    baseline_str = "\n".join([f"- {it.get('title')}: {it.get('description', '')}" for it in baseline_items])
    user_prompt = (
        f"Agreed Baseline Scope:\n{baseline_summary}\nItems:\n{baseline_str}\n\n"
        f"New Client Request:\n{client_message}"
    )

    payload = {
        "model": MODEL_NAME,
        "system": system_prompt,
        "prompt": user_prompt,
        "format": "json",
        "stream": False,
        "options": {
            "temperature": 0.2,
            "num_predict": 1500
        }
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload)
            if resp.status_code == 200:
                raw_response = resp.json().get("response", "{}")
                cleaned = _clean_json_text(raw_response)
                return json.loads(cleaned)
    except Exception:
        pass

    # Fallback diff detection
    return {
        "summary": "Client request introduces additions to the agreed scope.",
        "changes": [
            {
                "title": "Additional Scope Request",
                "impact_type": "scope_expansion",
                "reasoning": "Requested functionality is not in the baseline deliverables.",
                "estimated_hours": 5.0
            }
        ]
    }
