from pydantic import BaseModel
from typing import Any, Dict, List, Optional

class ErrorResponse(BaseModel):
    status: str = "error"
    message: str

class UploadDataMetrics(BaseModel):
    shape: List[int]
    columns: List[str]
    dtypes: Dict[str, str]

class UploadResponse(BaseModel):
    status: str = "success"
    session_id: str
    data: UploadDataMetrics

class EDASummaryResponse(BaseModel):
    status: str = "success"
    data: Dict[str, Any]

class EDACorrelationResponse(BaseModel):
    status: str = "success"
    data: Dict[str, Any]

class ChartData(BaseModel):
    x: List[Any]
    y: Optional[List[Any]] = None
    series: Optional[List[Any]] = None

class VisualizeResponseData(BaseModel):
    type: str
    chart_data: ChartData
    meta: Dict[str, Any]

class VisualizeResponse(BaseModel):
    status: str = "success"
    data: VisualizeResponseData

class InsightResponse(BaseModel):
    status: str = "success"
    data: Dict[str, str]