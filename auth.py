# -*- coding:utf-8 -*-

import os
import time
import base64
import json
import uuid
from http.cookies import SimpleCookie
from threading import Lock
from typing import Optional

import aiohttp
import jwt


class SunoAuth:
    """Manages Suno authentication with automatic token renewal"""
    
    def __init__(self):
        self.cookie_str = os.getenv("COOKIE", "")
        self.session_id = os.getenv("SESSION_ID", "")
        self.device_id = os.getenv("DEVICE_ID", str(uuid.uuid4()))
        
        self.token: Optional[str] = None
        self.token_expiry: Optional[float] = None
        self.lock = Lock()
        
    def _decode_jwt(self, token: str) -> dict:
        """Decode JWT without verification to get expiry"""
        try:
            # Decode without verification (we just need the payload)
            payload = jwt.decode(token, options={"verify_signature": False})
            return payload
        except Exception as e:
            print(f"Error decoding JWT: {e}")
            return {}
    
    def _is_token_valid(self) -> bool:
        """Check if current token is still valid"""
        if not self.token:
            return False
        
        # If we have expiry info, check it
        if self.token_expiry:
            # Renew 5 minutes before expiry
            return time.time() < (self.token_expiry - 300)
        
        # Otherwise decode and check
        try:
            payload = self._decode_jwt(self.token)
            exp = payload.get("exp")
            if exp:
                self.token_expiry = exp
                # Renew 5 minutes before expiry
                return time.time() < (exp - 300)
        except:
            pass
        
        return True
    
    async def _get_token_from_clerk(self) -> str:
        """Get a new JWT token from Clerk"""
        if not self.session_id:
            raise ValueError("SESSION_ID environment variable is required")
        
        url = f"https://clerk.suno.com/v1/client/sessions/{self.session_id}/tokens?_clerk_js_version=5.103.1"
        
        headers = {
            "cookie": self.cookie_str,
            "accept": "*/*",
            "accept-language": "en-US,en;q=0.9",
            "origin": "https://suno.com",
            "referer": "https://suno.com/",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36"
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers) as resp:
                if resp.status != 200:
                    error_text = await resp.text()
                    raise Exception(f"Failed to get token from Clerk: {resp.status} - {error_text}")
                
                # Update cookies from response
                set_cookie = resp.headers.get("Set-Cookie")
                if set_cookie:
                    cookie = SimpleCookie()
                    cookie.load(set_cookie)
                    # Merge new cookies
                    existing_cookie = SimpleCookie()
                    existing_cookie.load(self.cookie_str)
                    for key in cookie.keys():
                        existing_cookie[key] = cookie[key]
                    self.cookie_str = ";".join([f"{k}={existing_cookie[k].value}" for k in existing_cookie.keys()])
                
                data = await resp.json()
                jwt_token = data.get("jwt")
                
                if not jwt_token:
                    raise Exception("No JWT token in Clerk response")
                
                return jwt_token
    
    async def get_token(self) -> str:
        """Get a valid token, renewing if necessary"""
        with self.lock:
            if self._is_token_valid():
                return self.token
            
            # Need to renew
            print("Renewing Suno authentication token...")
            self.token = await self._get_token_from_clerk()
            
            # Decode to get expiry
            payload = self._decode_jwt(self.token)
            exp = payload.get("exp")
            if exp:
                self.token_expiry = exp
                print(f"Token renewed, expires at {time.ctime(exp)}")
            
            return self.token
    
    def get_device_id(self) -> str:
        """Get device ID for requests"""
        return self.device_id
    
    def generate_browser_token(self) -> str:
        """Generate browser-token header value"""
        # Based on sunoCreate.js, it's a base64 encoded timestamp JSON
        # The timestamp is in milliseconds
        timestamp = int(time.time() * 1000)
        token_data = {"timestamp": timestamp}
        token_json = json.dumps(token_data)
        token_b64 = base64.b64encode(token_json.encode()).decode()
        return f'{{"token":"{token_b64}"}}'


# Global auth instance
suno_auth = SunoAuth()

