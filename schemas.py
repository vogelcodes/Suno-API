# -*- coding:utf-8 -*-

from typing import Any, List, Optional
from pydantic import BaseModel, Field


class Response(BaseModel):
    code: int = 0
    msg: str = "success"
    data: Optional[Any] = None


class GenerateSongRequest(BaseModel):
    """Generate a song using GPT description"""
    
    gpt_description_prompt: str = Field(
        ...,
        description="Description of the song you want to generate",
        example="Faça uma musica sobre o The Strokes"
    )
    prompt: str = Field(
        default="",
        description="Optional prompt (usually empty for description mode)",
    )
    make_instrumental: bool = Field(
        default=False,
        description="Whether to make the song instrumental",
    )
    mv: str = Field(
        default="chirp-crow",
        description="Model version to use",
        examples=["chirp-crow", "chirp-v3-0", "chirp-v3-5", "chirp-v4"]
    )
    project_id: Optional[str] = Field(
        default=None,
        description="Optional project ID (auto-generated if not provided)",
    )


class GetFeedRequest(BaseModel):
    """Get clip/song information by IDs"""
    
    clip_ids: List[str] = Field(
        ...,
        description="List of clip IDs to retrieve",
        example=["clip-id-1", "clip-id-2"]
    )


class GetFeedResponse(BaseModel):
    """Response from feed endpoint"""
    pass  # Will be the actual response from Suno API
