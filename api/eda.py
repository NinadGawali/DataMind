from fastapi import APIRouter, HTTPException
from state.session_store import session_store
from services.eda_service import EDAService
from services.visualization_service import VisualizationService
from agents.insight_agent import InsightAgent
from schemas.request_models import VisualizeRequest, InsightRequest, InsightChatRequest
from schemas.response_models import (
    EDASummaryResponse, 
    EDACorrelationResponse, 
    VisualizeResponse, 
    InsightResponse,
    InsightChatResponse,
)

router = APIRouter()
eda_service = EDAService()
vis_service = VisualizationService()
insight_agent = InsightAgent()

def get_df_or_404(session_id: str):
    df = session_store.get_session(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Invalid session_id")
    return df

@router.get("/summary/{session_id}", response_model=EDASummaryResponse)
async def get_summary(session_id: str):
    df = get_df_or_404(session_id)
    try:
        res = eda_service.get_summary(df)
        return EDASummaryResponse(data=res)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/correlation/{session_id}", response_model=EDACorrelationResponse)
async def get_correlation(session_id: str):
    df = get_df_or_404(session_id)
    try:
        res = eda_service.get_correlation(df)
        return EDACorrelationResponse(data=res)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/visualize", response_model=VisualizeResponse)
async def visualize(request: VisualizeRequest):
    df = get_df_or_404(request.session_id)
    try:
        res_data = vis_service.process_visualization(df, request.config)
        return VisualizeResponse(data=res_data.dict())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/insight", response_model=InsightResponse)
async def get_insight(request: InsightRequest):
    df = get_df_or_404(request.session_id)
    try:
        insight = insight_agent.generate_insight(df, request.query or "Give me key statistical insights.")
        return InsightResponse(data={"insight": insight})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/insight/chat", response_model=InsightChatResponse)
async def insight_chat(request: InsightChatRequest):
    df = get_df_or_404(request.session_id)
    try:
        history = [{"role": m.role, "content": m.content} for m in request.history]
        response_text = insight_agent.chat(df=df, user_query=request.query, history=history)
        return InsightChatResponse(data={"reply": response_text})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))