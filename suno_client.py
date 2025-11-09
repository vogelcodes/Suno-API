# -*- coding:utf-8 -*-

import json
import uuid
from typing import Optional, Dict, Any

import aiohttp

from auth import suno_auth

BASE_URL = "https://studio-api.prod.suno.com"


async def get_session() -> Dict[str, Any]:
    """Get session info from Suno API"""
    token = await suno_auth.get_token()
    device_id = suno_auth.get_device_id()
    browser_token = suno_auth.generate_browser_token()
    
    headers = {
        "accept": "*/*",
        "accept-language": "en-US,en;q=0.9",
        "authorization": f"Bearer {token}",
        "browser-token": browser_token,
        "cache-control": "no-cache",
        "device-id": device_id,
        "origin": "https://suno.com",
        "pragma": "no-cache",
        "referer": "https://suno.com/",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
    }
    
    async with aiohttp.ClientSession() as session:
        async with session.get(f"{BASE_URL}/api/session/", headers=headers) as resp:
            if resp.status != 200:
                error_text = await resp.text()
                raise Exception(f"Failed to get session: {resp.status} - {error_text}")
            return await resp.json()


async def generate_song(
    gpt_description_prompt: str,
    prompt: str = "",
    make_instrumental: bool = False,
    mv: str = "chirp-crow",
    project_id: Optional[str] = None,
    create_session_token: Optional[str] = None,
    user_tier: Optional[str] = None,
    **kwargs
) -> Dict[str, Any]:
    """Generate a song using Suno API"""
    token = await suno_auth.get_token()
    device_id = suno_auth.get_device_id()
    browser_token = suno_auth.generate_browser_token()
    
    # Get session to get default values
    try:
        session_data = await get_session()
        if not user_tier:
            # Extract user tier from session if available
            roles = session_data.get("roles", {})
            # You may need to adjust this based on actual session response
            user_tier = roles.get("tier_id") if isinstance(roles, dict) else None
        
        # Get generate endpoint from config
        gen_endpoint = session_data.get("configs", {}).get("gen-endpoint", {}).get("endpoint", "/api/generate/v2-web/")
    except:
        gen_endpoint = "/api/generate/v2-web/"
    
    # Generate IDs if not provided
    if not project_id:
        project_id = str(uuid.uuid4())
    if not create_session_token:
        create_session_token = str(uuid.uuid4())
    if not user_tier:
        user_tier = "e1235dd7-9f4d-4738-aeb2-1470466cba27"  # Default tier, may need to get from session
    
    transaction_uuid = str(uuid.uuid4())
    
    payload = {
        "project_id": project_id,
        "token": None,
        "generation_type": "TEXT",
        "mv": mv,
        "prompt": prompt,
        "gpt_description_prompt": gpt_description_prompt,
        "make_instrumental": make_instrumental,
        "user_uploaded_images_b64": None,
        "metadata": {
            "web_client_pathname": "/create",
            "is_max_mode": False,
            "is_mumble": False,
            "create_mode": "simple",
            "user_tier": user_tier,
            "create_session_token": create_session_token,
            "disable_volume_normalization": False,
            "can_control_sliders": [],
            "lyrics_model": "default"
        },
        "override_fields": [],
        "cover_clip_id": None,
        "cover_start_s": None,
        "cover_end_s": None,
        "persona_id": None,
        "artist_clip_id": None,
        "artist_start_s": None,
        "artist_end_s": None,
        "continue_clip_id": None,
        "continued_aligned_prompt": None,
        "continue_at": None,
        "transaction_uuid": transaction_uuid
    }
    
    # Merge any additional kwargs
    payload.update(kwargs)
    
    headers = {
        "accept": "*/*",
        "accept-language": "en-US,en;q=0.9",
        "authorization": f"Bearer {token}",
        "browser-token": browser_token,
        "cache-control": "no-cache",
        "content-type": "application/json",
        "device-id": device_id,
        "origin": "https://suno.com",
        "pragma": "no-cache",
        "referer": "https://suno.com/",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
    }
    
    url = f"{BASE_URL}{gen_endpoint}"
    
    async with aiohttp.ClientSession() as session:
        async with session.post(url, headers=headers, json=payload) as resp:
            if resp.status != 200:
                error_text = await resp.text()
                raise Exception(f"Failed to generate song: {resp.status} - {error_text}")
            return await resp.json()


async def get_feed(clip_ids: list) -> Dict[str, Any]:
    """Get feed/clip information by IDs"""
    token = await suno_auth.get_token()
    device_id = suno_auth.get_device_id()
    browser_token = suno_auth.generate_browser_token()
    
    ids_str = ",".join(clip_ids) if isinstance(clip_ids, list) else clip_ids
    
    headers = {
        "accept": "*/*",
        "accept-language": "en-US,en;q=0.9",
        "authorization": f"Bearer {token}",
        "browser-token": browser_token,
        "cache-control": "no-cache",
        "device-id": device_id,
        "origin": "https://suno.com",
        "pragma": "no-cache",
        "referer": "https://suno.com/",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
    }
    
    url = f"{BASE_URL}/api/feed/?ids={ids_str}"
    
    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers=headers) as resp:
            if resp.status != 200:
                error_text = await resp.text()
                raise Exception(f"Failed to get feed: {resp.status} - {error_text}")
            return await resp.json()


async def get_billing_info() -> Dict[str, Any]:
    """Get billing/credits information"""
    token = await suno_auth.get_token()
    device_id = suno_auth.get_device_id()
    browser_token = suno_auth.generate_browser_token()
    
    headers = {
        "accept": "*/*",
        "accept-language": "en-US,en;q=0.9",
        "authorization": f"Bearer {token}",
        "browser-token": browser_token,
        "cache-control": "no-cache",
        "device-id": device_id,
        "origin": "https://suno.com",
        "pragma": "no-cache",
        "referer": "https://suno.com/",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
    }
    
    url = f"{BASE_URL}/api/billing/info/"
    
    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers=headers) as resp:
            if resp.status != 200:
                error_text = await resp.text()
                raise Exception(f"Failed to get billing info: {resp.status} - {error_text}")
            return await resp.json()

