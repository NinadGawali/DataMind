import pandas as pd
from typing import Dict, Any
from schemas.request_models import VisualizeConfig
from schemas.response_models import ChartData, VisualizeResponseData

class VisualizationService:
    @staticmethod
    def process_visualization(df: pd.DataFrame, config: VisualizeConfig) -> VisualizeResponseData:
        if config.x not in df.columns:
            raise ValueError(f"Column '{config.x}' not found")
        if config.y and config.y not in df.columns:
            raise ValueError(f"Column '{config.y}' not found")
            
        chart_data = ChartData(x=[], y=[], series=[])
        meta = {"x_label": config.x, "y_label": config.y}

        if config.type == "histogram":
            counts, bins = pd.cut(df[config.x].dropna(), bins=10, retbins=True)
            chart_data.x = bins[:-1].tolist()
            chart_data.y = counts.value_counts().sort_index().tolist()
            
        elif config.type == "scatter":
            if not config.y:
                raise ValueError("Scatter plot requires both x and y")
            tmp_df = df.dropna(subset=[config.x, config.y])
            chart_data.x = tmp_df[config.x].tolist()
            chart_data.y = tmp_df[config.y].tolist()
            if config.hue and config.hue in df.columns:
                chart_data.series = tmp_df[config.hue].tolist()
                
        elif config.type == "boxplot":
            chart_data.x = df[config.x].dropna().tolist()
            
        elif config.type == "countplot":
            counts = df[config.x].value_counts()
            chart_data.x = counts.index.tolist()
            chart_data.y = counts.values.tolist()
            
        else:
            raise ValueError(f"Unsupported chart type '{config.type}'")

        return VisualizeResponseData(
            type=config.type,
            chart_data=chart_data,
            meta=meta
        )