from pydantic import BaseModel, Field
from typing import Optional, List, Any

class VisualizeConfig(BaseModel):
    type: str = Field(..., description="histogram | scatter | boxplot | countplot | line | area | pie")
    x: str
    y: Optional[str] = None
    hue: Optional[str] = None

class VisualizeRequest(BaseModel):
    session_id: str
    config: VisualizeConfig

class InsightRequest(BaseModel):
    session_id: str
    query: Optional[str] = None


class ChatMessage(BaseModel):
    role: str = Field(..., description="user or assistant")
    content: str


class InsightChatRequest(BaseModel):
    session_id: str
    query: str
    history: List[ChatMessage] = Field(default_factory=list)


class DataQualityAnalyzeRequest(BaseModel):
    session_id: str


class DataQualityChatRequest(BaseModel):
    session_id: str
    query: str
    history: List[ChatMessage] = Field(default_factory=list)
    answered_question_ids: List[str] = Field(default_factory=list)


class NullAnalyzeRequest(BaseModel):
    session_id: str


class NullApplyRequest(BaseModel):
    session_id: str
    strategy: str = Field(
        ...,
        description="drop_rows | drop_columns | fill_avg | fill_mean | fill_mode | fill_median | fill_forward | fill_backward | fill_interpolate",
    )
    columns: List[str] = Field(default_factory=list)


class OutlierAnalyzeRequest(BaseModel):
    session_id: str
    columns: List[str] = Field(default_factory=list)
    iqr_factor: float = 1.5


class OutlierApplyRequest(BaseModel):
    session_id: str
    strategy: str = Field(..., description="drop_rows | iqr_rescale")
    columns: List[str] = Field(default_factory=list)
    iqr_factor: float = 1.5


class FeatureEngineeringAnalyzeRequest(BaseModel):
    session_id: str
    columns: List[str] = Field(default_factory=list)


class FeatureEngineeringApplyRequest(BaseModel):
    session_id: str
    strategy: str = Field(..., description="auto | one_hot | label | frequency | hashing")
    columns: List[str] = Field(default_factory=list)
    hash_bins: int = 16


class ModelTrainingAnalyzeRequest(BaseModel):
    session_id: str
    target_column: str


class ModelTrainingTrainRequest(BaseModel):
    session_id: str
    target_column: str
    model_name: str = Field(..., description="linear_regression | elastic_net | random_forest | decision_tree | svm | knn | logistic_regression | xgboost")
    task_type: str = Field(..., description="regression | classification")
    test_size: float = 0.2
    random_state: int = 42