from __future__ import annotations

from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from langchain_google_genai import ChatGoogleGenerativeAI

from config.settings import settings


class DataQualityAgent:
    def __init__(self):
        if settings.gemini_api_key:
            self.llm = ChatGoogleGenerativeAI(
                model="gemini-2.5-flash",
                google_api_key=settings.gemini_api_key,
                temperature=0.2,
            )
        else:
            self.llm = None

    def _safe_float(self, value: Any) -> float:
        try:
            return float(value)
        except Exception:
            return 0.0

    def _build_profile(self, df: pd.DataFrame) -> Dict[str, Any]:
        row_count = int(len(df))
        null_counts = df.isna().sum().to_dict()
        null_rates = {
            col: round((count / row_count) * 100, 2) if row_count else 0.0
            for col, count in null_counts.items()
        }

        numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()
        outlier_counts: Dict[str, int] = {}
        outlier_rates: Dict[str, float] = {}

        for col in numeric_cols:
            series = df[col].dropna()
            if len(series) < 4:
                outlier_counts[col] = 0
                outlier_rates[col] = 0.0
                continue

            q1 = series.quantile(0.25)
            q3 = series.quantile(0.75)
            iqr = q3 - q1
            if iqr == 0:
                outlier_counts[col] = 0
                outlier_rates[col] = 0.0
                continue

            lower = q1 - 1.5 * iqr
            upper = q3 + 1.5 * iqr
            count = int(((series < lower) | (series > upper)).sum())
            outlier_counts[col] = count
            outlier_rates[col] = round((count / row_count) * 100, 2) if row_count else 0.0

        null_columns = [
            {"column": col, "count": int(count), "rate_percent": self._safe_float(null_rates[col])}
            for col, count in sorted(null_counts.items(), key=lambda kv: kv[1], reverse=True)
            if int(count) > 0
        ]
        outlier_columns = [
            {"column": col, "count": int(count), "rate_percent": self._safe_float(outlier_rates[col])}
            for col, count in sorted(outlier_counts.items(), key=lambda kv: kv[1], reverse=True)
            if int(count) > 0
        ]

        return {
            "row_count": row_count,
            "column_count": int(df.shape[1]),
            "null_counts": {k: int(v) for k, v in null_counts.items()},
            "null_rates": null_rates,
            "outlier_counts": outlier_counts,
            "outlier_rates": outlier_rates,
            "numeric_columns": numeric_cols,
            "null_columns": null_columns,
            "outlier_columns": outlier_columns,
        }

    def _build_question_pool(self, profile: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Build a pool of contextual questions based on dataset profile."""
        pool: List[Dict[str, Any]] = []

        null_cols = profile.get("null_columns", [])
        outlier_cols = profile.get("outlier_columns", [])

        if null_cols:
            top_null = null_cols[0]
            col_name = top_null.get("column", "")
            null_pct = top_null.get("rate_percent", 0)
            pool.append(
                {
                    "id": "null_meaning",
                    "question": f"I see '{col_name}' has {null_pct}% missing values. Do these represent a real business state (e.g., not applicable), or are they data collection errors?",
                    "category": "null_interpretation",
                }
            )
            pool.append(
                {
                    "id": "null_strategy",
                    "question": "Should records with missing values be preserved for analysis, or can some rows be removed?",
                    "category": "null_handling",
                }
            )

        if outlier_cols:
            top_outlier = outlier_cols[0]
            col_name = top_outlier.get("column", "")
            out_pct = top_outlier.get("rate_percent", 0)
            pool.append(
                {
                    "id": "outlier_nature",
                    "question": f"In '{col_name}', I found {out_pct}% outlier values (by IQR). Are these expected rare events or measurement/data entry errors?",
                    "category": "outlier_interpretation",
                }
            )
            pool.append(
                {
                    "id": "outlier_strategy",
                    "question": "For extreme values in numeric columns, do you prefer to rescale (RobustScaler) to preserve rank, or clip/winsorize to cap extremes?",
                    "category": "outlier_handling",
                }
            )

        if not pool:
            pool.append(
                {
                    "id": "no_issues",
                    "question": "Your dataset looks clean with no major null or outlier hotspots. Would you like custom field-level validation rules?",
                    "category": "general",
                }
            )

        return pool

    def _get_next_questions(
        self,
        profile: Dict[str, Any],
        answered_ids: List[str],
        history: List[Dict[str, str]],
    ) -> List[Dict[str, Any]]:
        """Get the next unasked questions based on conversation history."""
        all_questions = self._build_question_pool(profile)
        unanswered = [q for q in all_questions if q["id"] not in answered_ids]
        return unanswered

    def _default_questions(self, profile: Dict[str, Any]) -> List[str]:
        """Backward compat: return question strings."""
        return [q["question"] for q in self._build_question_pool(profile)]

    def _fallback_summary(self, profile: Dict[str, Any]) -> str:
        top_null = profile.get("null_columns", [])[:5]
        top_outliers = profile.get("outlier_columns", [])[:5]

        if not top_null and not top_outliers:
            return (
                "No significant null values or IQR outliers were detected in this dataset. "
                "You can still review column-level rules for domain-specific anomalies."
            )

        null_text = (
            ", ".join([f"{it['column']} ({it['count']} nulls, {it['rate_percent']}%)" for it in top_null])
            if top_null
            else "No null-heavy columns"
        )
        outlier_text = (
            ", ".join([f"{it['column']} ({it['count']} outliers, {it['rate_percent']}%)" for it in top_outliers])
            if top_outliers
            else "No major numeric outlier columns"
        )

        return f"Null profile: {null_text}. Outlier profile: {outlier_text}."

    def _llm_summary(self, profile: Dict[str, Any]) -> Optional[str]:
        if not self.llm:
            return None

        prompt = f"""
You are a senior data quality analyst.
Summarize null values and IQR-based outliers from this dataset profile in 4-6 concise lines.
Focus on actionable interpretation and risk.

Dataset profile:
{profile}
"""
        try:
            response = self.llm.invoke(prompt)
            return str(response.content) if hasattr(response, "content") else str(response)
        except Exception:
            return None

    def _extract_user_signals(self, history: List[Dict[str, str]]) -> Dict[str, bool]:
        user_text = " ".join(
            m.get("content", "") for m in history if m.get("role") == "user"
        ).lower()

        return {
            "missing_is_meaningful": any(
                phrase in user_text
                for phrase in ["not applicable", "expected", "real missing", "legitimate missing", "unknown"]
            ),
            "missing_is_error": any(
                phrase in user_text
                for phrase in ["data issue", "collection issue", "error", "bad data", "entry issue", "incomplete"]
            ),
            "preserve_rows": any(
                phrase in user_text
                for phrase in ["preserve", "keep rows", "do not drop", "retain"]
            ),
            "drop_rows_ok": any(
                phrase in user_text
                for phrase in ["drop rows", "remove rows", "delete rows"]
            ),
            "outliers_expected": any(
                phrase in user_text
                for phrase in ["expected", "rare event", "real spike", "real extreme", "seasonal peak"]
            ),
            "outliers_are_errors": any(
                phrase in user_text
                for phrase in ["measurement error", "entry error", "bad outlier", "sensor error", "wrong value"]
            ),
            "prefer_scaling": any(
                phrase in user_text
                for phrase in ["scale", "scaling", "robust scaler", "normalize", "standardize"]
            ),
            "prefer_clipping": any(
                phrase in user_text
                for phrase in ["clip", "winsor", "capping", "cap values"]
            ),
        }

    def _build_recommendations(self, profile: Dict[str, Any], signals: Dict[str, bool]) -> List[Dict[str, Any]]:
        recs: List[Dict[str, Any]] = []

        null_cols = profile.get("null_columns", [])
        outlier_cols = profile.get("outlier_columns", [])

        if null_cols:
            if signals.get("missing_is_meaningful"):
                recs.append(
                    {
                        "title": "Keep missingness as signal",
                        "category": "imputation",
                        "why": "User intent suggests nulls carry business meaning.",
                        "actions": [
                            "Add binary missing-indicator features per null-heavy column.",
                            "Impute with a sentinel category/value (e.g., 'Unknown') where appropriate.",
                            "Avoid dropping rows that might remove meaningful cases.",
                        ],
                    }
                )
            else:
                recs.append(
                    {
                        "title": "Model-friendly imputation",
                        "category": "imputation",
                        "why": "Missing values likely represent incompleteness and can bias models if untreated.",
                        "actions": [
                            "Numeric: median imputation for skewed columns; mean for symmetric columns.",
                            "Categorical: mode or 'Unknown' bucket.",
                            "If column null rate > 40%, consider dropping the feature unless business-critical.",
                        ],
                    }
                )

            if signals.get("drop_rows_ok"):
                recs.append(
                    {
                        "title": "Row filtering option",
                        "category": "imputation",
                        "why": "User allows removal of incomplete records.",
                        "actions": [
                            "Drop rows only when key target or mandatory columns are null.",
                            "Track removed row percentage to avoid representation drift.",
                        ],
                    }
                )

        if outlier_cols:
            if signals.get("outliers_expected") or signals.get("prefer_scaling"):
                recs.append(
                    {
                        "title": "Rescale but keep extremes",
                        "category": "rescaling",
                        "why": "Outliers may be real signal; robust scaling preserves rank while reducing leverage.",
                        "actions": [
                            "Apply RobustScaler on impacted columns.",
                            "For highly skewed positives, use log1p transform before scaling.",
                            "Validate downstream model residuals before and after transform.",
                        ],
                    }
                )

            if signals.get("outliers_are_errors") or signals.get("prefer_clipping") or not signals.get("outliers_expected"):
                recs.append(
                    {
                        "title": "Clip or winsorize extremes",
                        "category": "rescaling",
                        "why": "Potential data-quality errors or unstable tails can distort statistics.",
                        "actions": [
                            "Clip values to 1st-99th percentile (or domain limits).",
                            "Compare model metrics against no-clipping baseline.",
                            "Log all capped rows for auditability.",
                        ],
                    }
                )

        if not recs:
            recs.append(
                {
                    "title": "No immediate remediation needed",
                    "category": "imputation",
                    "why": "No null/outlier hotspots were detected.",
                    "actions": [
                        "Proceed with baseline modeling.",
                        "Monitor drift in null and outlier rates over time.",
                    ],
                }
            )

        return recs

    def analyze(self, df: pd.DataFrame) -> Dict[str, Any]:
        profile = self._build_profile(df)
        summary_text = self._llm_summary(profile) or self._fallback_summary(profile)
        questions = self._get_next_questions(profile, [], [])

        return {
            "summary": summary_text,
            "profile": profile,
            "visuals": {
                "null_columns": profile.get("null_columns", []),
                "outlier_columns": profile.get("outlier_columns", []),
            },
            "questions": questions,
            "recommendations": [],
            "answered_question_ids": [],
        }

    def converse(
        self,
        df: pd.DataFrame,
        user_query: str,
        history: Optional[List[Dict[str, str]]] = None,
        answered_question_ids: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        profile = self._build_profile(df)
        existing_history = history or []
        full_history = [*existing_history, {"role": "user", "content": user_query}]
        answered_ids = answered_question_ids or []
        signals = self._extract_user_signals(full_history)

        all_questions = self._build_question_pool(profile)
        next_unasked = self._get_next_questions(profile, answered_ids, full_history)

        if not next_unasked:
            reply = (
                "Great! I have all the context needed. Based on your answers, I've generated tailored imputation and rescaling strategies. "
                "Review the recommendations below and decide which strategies fit your workflow best."
            )
            recommendations = self._build_recommendations(profile, signals)
        else:
            reply = (
                f"Thanks for that insight. I have {len(next_unasked)} more question{'s' if len(next_unasked) > 1 else ''} to help refine the recommendations:\n\n"
                + f"- {next_unasked[0]['question']}"
            )
            recommendations = []

        return {
            "reply": reply,
            "summary": self._llm_summary(profile) or self._fallback_summary(profile),
            "visuals": {
                "null_columns": profile.get("null_columns", []),
                "outlier_columns": profile.get("outlier_columns", []),
            },
            "next_questions": next_unasked,
            "recommendations": recommendations,
            "all_questions_answered": len(next_unasked) == 0,
        }
