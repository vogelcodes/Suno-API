# -*- coding:utf-8 -*-

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

import schemas
from suno_client import generate_song, get_feed, get_billing_info, get_session
from download import download_audio_stream, get_audio_url, get_audio_info

app = FastAPI(
    title="Suno API",
    description="Unofficial Suno API for generating and retrieving songs",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Suno API",
        "version": "2.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy"}


@app.post("/generate", response_model=schemas.Response)
async def generate(request: schemas.GenerateSongRequest):
    """Generate a song using GPT description"""
    try:
        result = await generate_song(
            gpt_description_prompt=request.gpt_description_prompt,
            prompt=request.prompt,
            make_instrumental=request.make_instrumental,
            mv=request.mv,
            project_id=request.project_id
        )
        return schemas.Response(data=result)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/feed", response_model=schemas.Response)
async def feed(request: schemas.GetFeedRequest):
    """Get song/clip information by IDs"""
    try:
        result = await get_feed(request.clip_ids)
        return schemas.Response(data=result)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/feed/{clip_id}", response_model=schemas.Response)
async def get_single_feed(clip_id: str):
    """Get single song/clip information by ID"""
    try:
        result = await get_feed([clip_id])
        return schemas.Response(data=result)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/session", response_model=schemas.Response)
async def session():
    """Get session information"""
    try:
        result = await get_session()
        return schemas.Response(data=result)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/credits", response_model=schemas.Response)
async def credits():
    """Get billing/credits information"""
    try:
        result = await get_billing_info()
        return schemas.Response(data=result)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/download/{clip_id}")
async def download(clip_id: str):
    """Download audio file for a clip ID"""
    try:
        stream = await download_audio_stream(clip_id)
        if not stream:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Audio not found for clip ID: {clip_id}"
            )
        return stream
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/download-url/{clip_id}", response_model=schemas.Response)
async def get_download_url(clip_id: str):
    """Get the direct download URL for a clip ID"""
    try:
        audio_url = await get_audio_url(clip_id)
        if not audio_url:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Audio URL not found for clip ID: {clip_id}"
            )
        return schemas.Response(data={"audio_url": audio_url, "clip_id": clip_id})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/audio-info/{clip_id}", response_model=schemas.Response)
async def audio_info(clip_id: str):
    """Get audio information including URL and metadata"""
    try:
        result = await get_audio_info(clip_id)
        return schemas.Response(data=result)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
