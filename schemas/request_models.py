from pydantic import BaseModel, Field
from typing import Optional, List, Any

class VisualizeConfig(BaseModel):
    type: str = Field(..., description="histogram | scatter | boxplot | countplot")
    x: str
    y: Optional[str] = None
    hue: Optional[str] = None

class VisualizeRequest(BaseModel):
    session_id: str
    config: VisualizeConfig

class InsightRequest(BaseModel):
    session_id: str
    query: Optional[str] = None