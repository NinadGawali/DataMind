from fastapi import APIRouter, File, UploadFile, HTTPException
from schemas.response_models import UploadResponse, UploadDataMetrics
import pandas as pd
import uuid
import io
from state.session_store import session_store

router = APIRouter()

@router.post("/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    try:
        content = await file.read()
        df = pd.read_csv(io.BytesIO(content))
        
        if df.empty:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
            
        session_id = str(uuid.uuid4())
        session_store.save_session(session_id, df)
        
        metrics = UploadDataMetrics(
            shape=list(df.shape),
            columns=df.columns.tolist(),
            dtypes={col: str(dtype) for col, dtype in df.dtypes.items()}
        )
        
        return UploadResponse(
            session_id=session_id,
            data=metrics
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))