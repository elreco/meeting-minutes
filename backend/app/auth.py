import jwt
import httpx
import os
import logging
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional, Dict, Any
import json
from datetime import datetime

logger = logging.getLogger(__name__)

security = HTTPBearer()

class SupabaseAuth:
    def __init__(self):
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_jwt_secret = os.getenv('SUPABASE_JWT_SECRET')
        self.anthropic_api_key = os.getenv('ANTHROPIC_API_KEY')

        if not self.supabase_url or not self.supabase_jwt_secret:
            logger.warning("Supabase configuration missing. Authentication will be disabled.")

        if not self.anthropic_api_key:
            logger.error("ANTHROPIC_API_KEY environment variable is required")
            raise ValueError("ANTHROPIC_API_KEY must be set")

    def get_anthropic_api_key(self) -> str:
        return self.anthropic_api_key

    async def verify_token(self, token: str) -> Dict[str, Any]:
        try:
            # Decode JWT token
            payload = jwt.decode(
                token,
                self.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated"
            )

            # Check if token is expired
            if payload.get('exp', 0) < datetime.now().timestamp():
                raise HTTPException(status_code=401, detail="Token expired")

            return payload

        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired")
        except jwt.InvalidTokenError as e:
            logger.error(f"Invalid token: {str(e)}")
            raise HTTPException(status_code=401, detail="Invalid token")
        except Exception as e:
            logger.error(f"Token verification error: {str(e)}")
            raise HTTPException(status_code=401, detail="Authentication failed")

    async def get_user_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        try:
            async with httpx.AsyncClient() as client:
                headers = {
                    'apikey': os.getenv('SUPABASE_ANON_KEY'),
                    'Authorization': f'Bearer {os.getenv("SUPABASE_SERVICE_ROLE_KEY")}',
                    'Content-Type': 'application/json'
                }

                response = await client.get(
                    f"{self.supabase_url}/rest/v1/user_profiles?id=eq.{user_id}&select=*,organizations(*)",
                    headers=headers
                )

                if response.status_code == 200:
                    data = response.json()
                    return data[0] if data else None
                else:
                    logger.error(f"Failed to fetch user profile: {response.status_code}")
                    return None

        except Exception as e:
            logger.error(f"Error fetching user profile: {str(e)}")
            return None

supabase_auth = SupabaseAuth()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    token = credentials.credentials
    payload = await supabase_auth.verify_token(token)

    user_id = payload.get('sub')
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user ID in token")

    # Get user profile with organization info
    user_profile = await supabase_auth.get_user_profile(user_id)
    if not user_profile:
        raise HTTPException(status_code=404, detail="User profile not found")

    return {
        'id': user_id,
        'email': payload.get('email'),
        'organization_id': user_profile.get('organization_id'),
        'role': user_profile.get('role', 'member'),
        'full_name': user_profile.get('full_name')
    }

def get_anthropic_api_key() -> str:
    return supabase_auth.get_anthropic_api_key()
