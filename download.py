# -*- coding:utf-8 -*-

import aiohttp
from typing import Optional, Dict, Any
from fastapi.responses import StreamingResponse
import io

from suno_client import get_feed


async def get_audio_url(clip_id: str) -> Optional[str]:
    """Get the audio URL for a clip ID"""
    try:
        feed_data = await get_feed([clip_id])
        
        # The feed response structure may vary, try different paths
        if isinstance(feed_data, list) and len(feed_data) > 0:
            clip = feed_data[0]
            # Try different possible field names
            audio_url = clip.get("audio_url") or clip.get("audioUrl") or clip.get("audio")
            return audio_url
        elif isinstance(feed_data, dict):
            # If it's a dict, check for clips array
            clips = feed_data.get("clips", [])
            if clips and len(clips) > 0:
                clip = clips[0]
                audio_url = clip.get("audio_url") or clip.get("audioUrl") or clip.get("audio")
                return audio_url
            # Or check if the dict itself has the audio_url
            audio_url = feed_data.get("audio_url") or feed_data.get("audioUrl") or feed_data.get("audio")
            if audio_url:
                return audio_url
        
        return None
    except Exception as e:
        print(f"Error getting audio URL: {e}")
        return None


async def download_audio_stream(clip_id: str) -> Optional[StreamingResponse]:
    """Download audio file and return as streaming response"""
    audio_url = await get_audio_url(clip_id)
    
    if not audio_url:
        return None
    
    async def generate():
        async with aiohttp.ClientSession() as session:
            async with session.get(audio_url) as resp:
                if resp.status != 200:
                    error_text = await resp.text()
                    raise Exception(f"Failed to download audio: {resp.status} - {error_text}")
                
                # Stream the file in chunks
                async for chunk in resp.content.iter_chunked(8192):
                    if chunk:
                        yield chunk
    
    # Try to get filename from URL or use clip_id
    filename = f"{clip_id}.mp3"
    if audio_url:
        # Extract filename from URL if possible
        if "/" in audio_url:
            # Remove query parameters if any
            url_part = audio_url.split("?")[0]
            url_filename = url_part.split("/")[-1]
            if "." in url_filename:
                filename = url_filename
    
    return StreamingResponse(
        generate(),
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Type": "audio/mpeg"
        }
    )


async def get_audio_info(clip_id: str) -> Dict[str, Any]:
    """Get audio information including URL and metadata"""
    try:
        feed_data = await get_feed([clip_id])
        
        # Extract clip data
        clip = None
        if isinstance(feed_data, list) and len(feed_data) > 0:
            clip = feed_data[0]
        elif isinstance(feed_data, dict):
            clips = feed_data.get("clips", [])
            if clips and len(clips) > 0:
                clip = clips[0]
            elif feed_data.get("id"):
                clip = feed_data
        
        if not clip:
            return {"error": "Clip not found"}
        
        # Extract audio URL
        audio_url = clip.get("audio_url") or clip.get("audioUrl") or clip.get("audio")
        
        return {
            "clip_id": clip_id,
            "audio_url": audio_url,
            "title": clip.get("title"),
            "status": clip.get("status"),
            "metadata": clip.get("metadata", {}),
            "full_data": clip
        }
    except Exception as e:
        return {"error": str(e)}

