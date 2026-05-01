from datetime import datetime
from io import StringIO

import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from state.session_store import session_store
from services.eda_service import EDAService
from services.visualization_service import VisualizationService
from agents.insight_agent import InsightAgent
from agents.data_quality_agent import DataQualityAgent
from agents.feature_engineering_agent import FeatureEngineeringAgent
from agents.null_value_agent import NullValueAgent
from agents.outlier_agent import OutlierAgent
from agents.model_training_agent import ModelTrainingAgent
from schemas.request_models import (
    VisualizeRequest,
    InsightRequest,
    InsightChatRequest,
    DataQualityAnalyzeRequest,
    DataQualityChatRequest,
    NullAnalyzeRequest,
    NullApplyRequest,
    OutlierAnalyzeRequest,
    OutlierApplyRequest,
    FeatureEngineeringAnalyzeRequest,
    FeatureEngineeringApplyRequest,
    ModelTrainingAnalyzeRequest,
    ModelTrainingTrainRequest,
)
from schemas.response_models import (
    EDASummaryResponse, 
    EDACorrelationResponse, 
    VisualizeResponse, 
    InsightResponse,
    InsightChatResponse,
    DataQualityAgentResponse,
)

router = APIRouter()
eda_service = EDAService()
vis_service = VisualizationService()
insight_agent = InsightAgent()
data_quality_agent = DataQualityAgent()
feature_engineering_agent = FeatureEngineeringAgent()
null_value_agent = NullValueAgent()
outlier_agent = OutlierAgent()
model_training_agent = ModelTrainingAgent()

def get_df_or_404(session_id: str):
    df = session_store.get_session(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Invalid session_id")
    return df


def _to_json_safe_records(df: pd.DataFrame):
    safe_df = df.where(pd.notna(df), None)
    return safe_df.to_dict(orient="records")

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


@router.post("/data-quality/analyze", response_model=DataQualityAgentResponse)
async def data_quality_analyze(request: DataQualityAnalyzeRequest):
    df = get_df_or_404(request.session_id)
    try:
        result = data_quality_agent.analyze(df)
        return DataQualityAgentResponse(data=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/data-quality/chat", response_model=DataQualityAgentResponse)
async def data_quality_chat(request: DataQualityChatRequest):
    df = get_df_or_404(request.session_id)
    try:
        history = [{"role": m.role, "content": m.content} for m in request.history]
        result = data_quality_agent.converse(
            df=df,
            user_query=request.query,
            history=history,
            answered_question_ids=request.answered_question_ids,
        )
        return DataQualityAgentResponse(data=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/data-quality/nulls/analyze", response_model=DataQualityAgentResponse)
async def nulls_analyze(request: NullAnalyzeRequest):
    df = get_df_or_404(request.session_id)
    try:
        result = null_value_agent.analyze(df)
        return DataQualityAgentResponse(data=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/data-quality/nulls/apply", response_model=DataQualityAgentResponse)
async def nulls_apply(request: NullApplyRequest):
    df = get_df_or_404(request.session_id)
    try:
        result = null_value_agent.apply(
            df=df,
            strategy=request.strategy,
            columns=request.columns,
        )
        updated_df = result.pop("updated_df")
        session_store.save_session(request.session_id, updated_df)

        return DataQualityAgentResponse(
            data={
                **result,
                "profile": null_value_agent.analyze(updated_df),
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/data-quality/outliers/analyze", response_model=DataQualityAgentResponse)
async def outliers_analyze(request: OutlierAnalyzeRequest):
    df = get_df_or_404(request.session_id)
    try:
        result = outlier_agent.analyze(
            df=df,
            columns=request.columns,
            iqr_factor=request.iqr_factor,
        )
        return DataQualityAgentResponse(data=result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/data-quality/outliers/apply", response_model=DataQualityAgentResponse)
async def outliers_apply(request: OutlierApplyRequest):
    df = get_df_or_404(request.session_id)
    try:
        result = outlier_agent.apply(
            df=df,
            strategy=request.strategy,
            columns=request.columns,
            iqr_factor=request.iqr_factor,
        )
        updated_df = result.pop("updated_df")
        session_store.save_session(request.session_id, updated_df)

        return DataQualityAgentResponse(
            data={
                **result,
                "profile": outlier_agent.analyze(updated_df, request.columns, request.iqr_factor),
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/data-quality/features/analyze", response_model=DataQualityAgentResponse)
async def features_analyze(request: FeatureEngineeringAnalyzeRequest):
    df = get_df_or_404(request.session_id)
    try:
        result = feature_engineering_agent.analyze(df, request.columns)
        return DataQualityAgentResponse(data=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/data-quality/features/apply", response_model=DataQualityAgentResponse)
async def features_apply(request: FeatureEngineeringApplyRequest):
    df = get_df_or_404(request.session_id)
    try:
        result = feature_engineering_agent.apply(
            df=df,
            strategy=request.strategy,
            columns=request.columns,
            hash_bins=request.hash_bins,
        )
        updated_df = result.pop("updated_df")
        session_store.save_session(request.session_id, updated_df)

        return DataQualityAgentResponse(
            data={
                **result,
                "profile": feature_engineering_agent.analyze(updated_df, request.columns),
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dataset/{session_id}")
async def get_dataset_snapshot(
    session_id: str,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    df = get_df_or_404(session_id)
    try:
        total_rows = int(len(df))
        total_columns = int(df.shape[1])

        page_df = df.iloc[offset : offset + limit]
        rows = _to_json_safe_records(page_df)

        return {
            "session_id": session_id,
            "columns": df.columns.tolist(),
            "rows": rows,
            "row_count": total_rows,
            "column_count": total_columns,
            "offset": offset,
            "limit": limit,
            "returned_rows": int(len(page_df)),
            "refreshed_at": datetime.utcnow().isoformat() + "Z",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dataset/download/{session_id}")
async def download_dataset_csv(session_id: str):
    df = get_df_or_404(session_id)
    try:
        csv_buffer = StringIO()
        df.to_csv(csv_buffer, index=False)
        csv_buffer.seek(0)

        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        file_name = f"datamind_dataset_{session_id[:8]}_{timestamp}.csv"

        return StreamingResponse(
            iter([csv_buffer.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/model/analyze", response_model=DataQualityAgentResponse)
async def model_analyze(request: ModelTrainingAnalyzeRequest):
    df = get_df_or_404(request.session_id)
    try:
        result = model_training_agent.analyze(df, request.target_column)
        return DataQualityAgentResponse(data=result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/model/train", response_model=DataQualityAgentResponse)
async def model_train(request: ModelTrainingTrainRequest):
    df = get_df_or_404(request.session_id)
    try:
        result = model_training_agent.train(
            df=df,
            target_col=request.target_column,
            model_name=request.model_name,
            task_type=request.task_type,
            test_size=request.test_size,
            random_state=request.random_state,
        )
        
        # Store model metadata (without the trained_model object)
        model_metadata = {
            "model_name": result["model_name"],
            "task_type": result["task_type"],
            "target_column": result["target_column"],
            "metrics": result["metrics"],
            "data_split": result["data_split"],
            "feature_count": result["feature_count"],
            "model_bytes": result["model_bytes"],
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }
        session_store.save_model(request.session_id, model_metadata)
        
        # Return response without the trained_model object (not JSON serializable)
        return DataQualityAgentResponse(
            data={
                "model_name": result["model_name"],
                "task_type": result["task_type"],
                "target_column": result["target_column"],
                "metrics": result["metrics"],
                "data_split": result["data_split"],
                "feature_count": result["feature_count"],
                "status": "success",
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/model/download/{session_id}")
async def download_model(session_id: str):
    model_metadata = session_store.get_model(session_id)
    if model_metadata is None:
        raise HTTPException(status_code=404, detail="No trained model found for this session")
    
    try:
        model_bytes = model_metadata.get("model_bytes")
        if not model_bytes:
            raise HTTPException(status_code=404, detail="Model bytes not available")
        
        model_name = model_metadata.get("model_name", "model")
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        file_name = f"datamind_model_{model_name}_{session_id[:8]}_{timestamp}.pkl"
        
        return StreamingResponse(
            iter([model_bytes]),
            media_type="application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))