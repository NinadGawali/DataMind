import pandas as pd
import numpy as np
from typing import Dict, Any, List

from langchain_google_genai import ChatGoogleGenerativeAI

from config.settings import settings
from schemas.request_models import VisualizeConfig
from schemas.response_models import ChartData, VisualizeResponseData

class VisualizationService:
    def __init__(self):
        if settings.gemini_api_key:
            self.llm = ChatGoogleGenerativeAI(
                model="gemini-2.5-flash",
                google_api_key=settings.gemini_api_key,
                temperature=0.2,
            )
        else:
            self.llm = None

    @staticmethod
    def _numeric_summary(series: pd.Series) -> Dict[str, Any]:
        cleaned = series.dropna()
        if cleaned.empty:
            return {"count": 0}
        return {
            "count": int(cleaned.shape[0]),
            "mean": float(cleaned.mean()),
            "median": float(cleaned.median()),
            "std": float(cleaned.std(ddof=1)) if cleaned.shape[0] > 1 else 0.0,
            "min": float(cleaned.min()),
            "max": float(cleaned.max()),
            "q1": float(cleaned.quantile(0.25)),
            "q3": float(cleaned.quantile(0.75)),
            "iqr": float(cleaned.quantile(0.75) - cleaned.quantile(0.25)),
        }

    @staticmethod
    def _categorical_summary(series: pd.Series) -> Dict[str, Any]:
        cleaned = series.dropna().astype(str)
        counts = cleaned.value_counts(dropna=False)
        top = counts.head(10)
        return {
            "count": int(cleaned.shape[0]),
            "unique": int(cleaned.nunique()),
            "mode": cleaned.mode().iloc[0] if not cleaned.mode().empty else None,
            "top_categories": [{"category": str(idx), "count": int(val)} for idx, val in top.items()],
        }

    def _build_ai_insight(
        self,
        config: VisualizeConfig,
        math_summary: Dict[str, Any],
        chart_preview: List[Dict[str, Any]],
    ) -> str:
        if not self.llm:
            return "AI insight unavailable. Set gemini_api_key in .env to enable chart insights."

        prompt = f"""
You are an expert data analyst.

Given a chart configuration, mathematical summary, and chart data preview, provide concise and useful insights.

Chart type: {config.type}
X column: {config.x}
Y column: {config.y}
Hue: {config.hue}

Mathematical summary:
{math_summary}

Chart data preview:
{chart_preview}

Rules:
- Mention specific metrics from the summary.
- Identify trends, skew, potential outliers, or group differences when relevant.
- Keep response under 120 words.
"""

        response = self.llm.invoke(prompt)
        return str(response.content) if hasattr(response, "content") else str(response)

    @staticmethod
    def _build_points(x_values: List[Any], y_values: List[Any] = None, series_values: List[Any] = None) -> List[Dict[str, Any]]:
        points = []
        if y_values is None:
            for idx, x_val in enumerate(x_values):
                points.append({"index": idx, "x": x_val})
            return points

        for idx, x_val in enumerate(x_values):
            point = {"index": idx, "x": x_val, "y": y_values[idx]}
            if series_values is not None and idx < len(series_values):
                point["series"] = series_values[idx]
            points.append(point)
        return points

    def process_visualization(self, df: pd.DataFrame, config: VisualizeConfig) -> VisualizeResponseData:
        if config.x not in df.columns:
            raise ValueError(f"Column '{config.x}' not found")
        if config.y and config.y not in df.columns:
            raise ValueError(f"Column '{config.y}' not found")
            
        chart_data = ChartData(x=[], y=[], series=[])
        meta = {"x_label": config.x, "y_label": config.y}
        math_summary: Dict[str, Any] = {}

        if config.type == "histogram":
            numeric = pd.to_numeric(df[config.x], errors="coerce").dropna()
            if numeric.empty:
                raise ValueError("Histogram requires a numeric x column")
            bins = int(np.sqrt(numeric.shape[0])) or 1
            counts, edges = np.histogram(numeric.values, bins=bins)
            labels = [f"{edges[i]:.4g} to {edges[i+1]:.4g}" for i in range(len(edges) - 1)]
            chart_data.x = labels
            chart_data.y = counts.astype(int).tolist()
            chart_data.labels = labels
            chart_data.points = self._build_points(chart_data.x, chart_data.y)
            meta["bin_edges"] = edges.tolist()
            meta["raw_values"] = numeric.tolist()
            math_summary = {
                "distribution": self._numeric_summary(numeric),
                "bin_count": bins,
                "total_observations": int(numeric.shape[0]),
            }
            
        elif config.type == "scatter":
            if not config.y:
                raise ValueError("Scatter plot requires both x and y")
            tmp_df = df.dropna(subset=[config.x, config.y]).copy()
            tmp_df[config.x] = pd.to_numeric(tmp_df[config.x], errors="coerce")
            tmp_df[config.y] = pd.to_numeric(tmp_df[config.y], errors="coerce")
            tmp_df = tmp_df.dropna(subset=[config.x, config.y])
            chart_data.x = tmp_df[config.x].tolist()
            chart_data.y = tmp_df[config.y].tolist()
            if config.hue and config.hue in df.columns:
                chart_data.series = tmp_df[config.hue].tolist()
            chart_data.points = self._build_points(chart_data.x, chart_data.y, chart_data.series)
            correlation = float(tmp_df[config.x].corr(tmp_df[config.y])) if len(tmp_df) > 1 else 0.0
            math_summary = {
                "x_summary": self._numeric_summary(tmp_df[config.x]),
                "y_summary": self._numeric_summary(tmp_df[config.y]),
                "pearson_correlation": correlation,
                "point_count": int(tmp_df.shape[0]),
            }
                
        elif config.type == "boxplot":
            numeric = pd.to_numeric(df[config.x], errors="coerce").dropna()
            if numeric.empty:
                raise ValueError("Box plot requires a numeric x column")
            chart_data.x = numeric.tolist()
            chart_data.points = self._build_points(chart_data.x)
            math_summary = {
                "distribution": self._numeric_summary(numeric),
                "whiskers": {
                    "lower": float(numeric.quantile(0.25) - 1.5 * (numeric.quantile(0.75) - numeric.quantile(0.25))),
                    "upper": float(numeric.quantile(0.75) + 1.5 * (numeric.quantile(0.75) - numeric.quantile(0.25))),
                },
            }
            
        elif config.type == "countplot":
            counts = df[config.x].value_counts()
            chart_data.x = counts.index.tolist()
            chart_data.y = counts.values.tolist()
            chart_data.points = self._build_points(chart_data.x, chart_data.y)
            meta["full_category_counts"] = [{"category": str(k), "count": int(v)} for k, v in counts.items()]
            math_summary = self._categorical_summary(df[config.x])

        elif config.type == "line":
            if not config.y:
                raise ValueError("Line chart requires both x and y")
            tmp_df = df.dropna(subset=[config.x, config.y]).copy()
            tmp_df[config.y] = pd.to_numeric(tmp_df[config.y], errors="coerce")
            tmp_df = tmp_df.dropna(subset=[config.y]).sort_values(by=config.x)
            chart_data.x = tmp_df[config.x].tolist()
            chart_data.y = tmp_df[config.y].tolist()
            chart_data.points = self._build_points(chart_data.x, chart_data.y)
            math_summary = {
                "y_summary": self._numeric_summary(tmp_df[config.y]),
                "point_count": int(tmp_df.shape[0]),
            }

        elif config.type == "area":
            if not config.y:
                raise ValueError("Area chart requires both x and y")
            tmp_df = df.dropna(subset=[config.x, config.y]).copy()
            tmp_df[config.y] = pd.to_numeric(tmp_df[config.y], errors="coerce")
            tmp_df = tmp_df.dropna(subset=[config.y]).sort_values(by=config.x)
            chart_data.x = tmp_df[config.x].tolist()
            chart_data.y = tmp_df[config.y].tolist()
            chart_data.points = self._build_points(chart_data.x, chart_data.y)
            math_summary = {
                "y_summary": self._numeric_summary(tmp_df[config.y]),
                "point_count": int(tmp_df.shape[0]),
                "approx_area_under_curve": float(np.trapz(tmp_df[config.y].values)),
            }

        elif config.type == "pie":
            grouped = None
            if config.y:
                tmp_df = df.dropna(subset=[config.x, config.y]).copy()
                tmp_df[config.y] = pd.to_numeric(tmp_df[config.y], errors="coerce")
                tmp_df = tmp_df.dropna(subset=[config.y])
                grouped = tmp_df.groupby(config.x)[config.y].sum().sort_values(ascending=False)
                meta["aggregation"] = "sum"
            else:
                grouped = df[config.x].value_counts()
                meta["aggregation"] = "count"

            chart_data.labels = grouped.index.astype(str).tolist()
            chart_data.y = grouped.values.astype(float).tolist()
            chart_data.x = chart_data.labels
            chart_data.points = [
                {"label": chart_data.labels[i], "value": chart_data.y[i]}
                for i in range(len(chart_data.labels))
            ]
            total = float(sum(chart_data.y)) if chart_data.y else 0.0
            math_summary = {
                "category_count": len(chart_data.labels),
                "total": total,
                "shares": [
                    {
                        "label": chart_data.labels[i],
                        "value": chart_data.y[i],
                        "share": (chart_data.y[i] / total) if total else 0.0,
                    }
                    for i in range(len(chart_data.labels))
                ],
            }
            
        else:
            raise ValueError(f"Unsupported chart type '{config.type}'")

        preview = chart_data.points[:20] if chart_data.points else []
        ai_insight = self._build_ai_insight(config, math_summary, preview)

        return VisualizeResponseData(
            type=config.type,
            chart_data=chart_data,
            meta=meta,
            math_summary=math_summary,
            ai_insight=ai_insight,
        )