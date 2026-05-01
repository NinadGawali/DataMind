from __future__ import annotations

import math
import hashlib
from typing import Any, Dict, List, Optional

import pandas as pd
from langchain_google_genai import ChatGoogleGenerativeAI

from config.settings import settings


class FeatureEngineeringAgent:
    SUPPORTED_STRATEGIES = {"auto", "one_hot", "label", "frequency", "hashing"}

    def __init__(self):
        if settings.gemini_api_key:
            self.llm = ChatGoogleGenerativeAI(
                model="gemini-2.5-flash",
                google_api_key=settings.gemini_api_key,
                temperature=0.2,
            )
        else:
            self.llm = None

    def _candidate_columns(self, df: pd.DataFrame, columns: Optional[List[str]] = None) -> List[str]:
        if columns:
            return [col for col in columns if col in df.columns]

        categorical_cols = df.select_dtypes(include=["object", "category", "bool"]).columns.tolist()
        low_cardinality_numeric = [
            col
            for col in df.select_dtypes(include=["number"]).columns.tolist()
            if 1 < int(df[col].nunique(dropna=True)) <= 12
        ]
        ordered = categorical_cols + [col for col in low_cardinality_numeric if col not in categorical_cols]
        return ordered

    def _column_profile(self, df: pd.DataFrame, column: str) -> Dict[str, Any]:
        series = df[column]
        non_null = series.dropna()
        unique_count = int(non_null.nunique(dropna=True))
        total_count = int(len(series))
        missing_count = int(series.isna().sum())
        unique_ratio = round(unique_count / total_count, 4) if total_count else 0.0
        missing_rate = round((missing_count / total_count) * 100, 2) if total_count else 0.0
        value_counts = non_null.astype("string").value_counts(dropna=True)
        top_value = value_counts.index[0] if not value_counts.empty else None
        top_share = round((int(value_counts.iloc[0]) / len(non_null)) * 100, 2) if not value_counts.empty and len(non_null) else 0.0
        entropy = 0.0
        if len(non_null):
            proportions = (value_counts / len(non_null)).to_numpy()
            entropy = round(float(-sum(p * math.log2(p) for p in proportions if p > 0)), 4)

        return {
            "column": column,
            "dtype": str(series.dtype),
            "row_count": total_count,
            "missing_count": missing_count,
            "missing_rate": missing_rate,
            "unique_count": unique_count,
            "unique_ratio": unique_ratio,
            "top_value": None if top_value is None else str(top_value),
            "top_share_percent": top_share,
            "sample_values": [str(value) for value in value_counts.index[:5].tolist()],
            "entropy": entropy,
        }

    def _recommend_strategy(self, profile: Dict[str, Any]) -> str:
        unique_count = profile["unique_count"]
        unique_ratio = profile["unique_ratio"]
        top_share = profile["top_share_percent"]
        dtype = profile["dtype"].lower()
        column_name = profile["column"].lower()

        if unique_count <= 2:
            return "one_hot"
        if any(token in column_name for token in ["rank", "grade", "level", "tier", "size", "priority", "severity"]):
            return "label"
        if unique_count <= 8 and unique_ratio <= 0.08:
            return "one_hot"
        if unique_count <= 25 and top_share >= 35:
            return "frequency"
        if unique_count > 25:
            return "frequency"
        if dtype in {"object", "category", "string"} and unique_count <= 12:
            return "one_hot"
        return "label"

    def _build_summary(self, profiles: List[Dict[str, Any]]) -> str:
        if not profiles:
            return "No categorical or low-cardinality columns were found for feature encoding."

        parts = []
        for profile in profiles[:6]:
            parts.append(
                f"{profile['column']}: {profile['unique_count']} unique values, {profile['missing_rate']}% missing, suggested {profile['suggested_strategy']}."
            )
        return " ".join(parts)

    def _llm_summary(self, profiles: List[Dict[str, Any]]) -> Optional[str]:
        if not self.llm or not profiles:
            return None

        prompt = f"""
You are a feature engineering assistant.
Summarize the best encoding choices for these columns in 3-5 concise lines.
Focus on when to use one-hot, label, frequency, or hashing encoding.
Mention any obvious risks such as high cardinality or sparse expansion.

Column profiles:
{profiles}
"""
        try:
            response = self.llm.invoke(prompt)
            return str(response.content) if hasattr(response, "content") else str(response)
        except Exception:
            return None

    def _encode_one_hot(self, df: pd.DataFrame, columns: List[str]) -> Dict[str, Any]:
        if not columns:
            return {"updated_df": df.copy(), "changed_columns": [], "added_columns": [], "strategy": "one_hot"}

        updated_df = pd.get_dummies(df.copy(), columns=columns, prefix=columns, dummy_na=False, dtype=int)
        added_columns = [col for col in updated_df.columns if col not in df.columns]
        return {
            "updated_df": updated_df,
            "changed_columns": columns,
            "added_columns": added_columns,
            "removed_columns": columns,
            "strategy": "one_hot",
        }

    def _encode_label(self, df: pd.DataFrame, columns: List[str]) -> Dict[str, Any]:
        updated_df = df.copy()
        changed_columns = []
        for column in columns:
            encoded, _ = pd.factorize(updated_df[column].astype("string").fillna("Missing"), sort=True)
            updated_df[column] = encoded
            changed_columns.append(column)
        return {
            "updated_df": updated_df,
            "changed_columns": changed_columns,
            "added_columns": [],
            "removed_columns": [],
            "strategy": "label",
        }

    def _encode_frequency(self, df: pd.DataFrame, columns: List[str]) -> Dict[str, Any]:
        updated_df = df.copy()
        changed_columns = []
        for column in columns:
            series = updated_df[column].astype("string").fillna("Missing")
            frequencies = series.value_counts(dropna=False, normalize=True)
            updated_df[column] = series.map(frequencies).fillna(0.0)
            changed_columns.append(column)
        return {
            "updated_df": updated_df,
            "changed_columns": changed_columns,
            "added_columns": [],
            "removed_columns": [],
            "strategy": "frequency",
        }

    def _encode_hashing(self, df: pd.DataFrame, columns: List[str], hash_bins: int) -> Dict[str, Any]:
        if hash_bins <= 1:
            raise ValueError("hash_bins must be greater than 1")

        updated_df = df.copy()
        changed_columns = []
        for column in columns:
            hashed_values = updated_df[column].astype("string").fillna("Missing").map(
                lambda value: int(hashlib.md5(str(value).encode("utf-8")).hexdigest(), 16) % hash_bins
            )
            updated_df[column] = hashed_values
            changed_columns.append(column)
        return {
            "updated_df": updated_df,
            "changed_columns": changed_columns,
            "added_columns": [],
            "removed_columns": [],
            "strategy": "hashing",
            "hash_bins": hash_bins,
        }

    def analyze(self, df: pd.DataFrame, columns: Optional[List[str]] = None) -> Dict[str, Any]:
        target_columns = self._candidate_columns(df, columns)
        profiles = [self._column_profile(df, column) for column in target_columns]
        for profile in profiles:
            profile["suggested_strategy"] = self._recommend_strategy(profile)
            profile["recommended_reason"] = (
                "Very low cardinality is better as one-hot."
                if profile["suggested_strategy"] == "one_hot"
                else "Higher cardinality or sparse distributions are better with frequency or label encoding."
            )

        ai_summary = self._llm_summary(profiles) or self._build_summary(profiles)

        return {
            "row_count": int(len(df)),
            "column_count": int(df.shape[1]),
            "categorical_columns": target_columns,
            "profiles": profiles,
            "summary": ai_summary,
            "supported_strategies": ["auto", "one_hot", "label", "frequency", "hashing"],
        }

    def _choose_auto_strategy(self, profile: Dict[str, Any]) -> str:
        return profile.get("suggested_strategy") or self._recommend_strategy(profile)

    def apply(
        self,
        df: pd.DataFrame,
        strategy: str,
        columns: Optional[List[str]] = None,
        hash_bins: int = 16,
    ) -> Dict[str, Any]:
        if strategy not in self.SUPPORTED_STRATEGIES:
            raise ValueError(f"Unsupported feature engineering strategy: {strategy}")

        target_columns = self._candidate_columns(df, columns)
        if not target_columns:
            return {
                "updated_df": df.copy(),
                "strategy": strategy,
                "changed_columns": [],
                "added_columns": [],
                "removed_columns": [],
                "column_map": {},
            }

        profiles = {column: self._column_profile(df, column) for column in target_columns}
        updated_df = df.copy()
        changed_columns: List[str] = []
        added_columns: List[str] = []
        removed_columns: List[str] = []
        column_map: Dict[str, str] = {}

        def ensure_object(series: pd.Series) -> pd.Series:
            return series.astype("string").fillna("Missing")

        if strategy == "auto":
            for column in target_columns:
                chosen = self._choose_auto_strategy(profiles[column])
                column_map[column] = chosen
                if chosen == "one_hot":
                    encoded = pd.get_dummies(updated_df[[column]], columns=[column], prefix=[column], dummy_na=False, dtype=int)
                    updated_df = pd.concat([updated_df.drop(columns=[column]), encoded], axis=1)
                    added_columns.extend(encoded.columns.tolist())
                    removed_columns.append(column)
                elif chosen == "label":
                    encoded, _ = pd.factorize(ensure_object(updated_df[column]), sort=True)
                    updated_df[column] = encoded
                    changed_columns.append(column)
                elif chosen == "frequency":
                    frequencies = ensure_object(updated_df[column]).value_counts(normalize=True)
                    updated_df[column] = ensure_object(updated_df[column]).map(frequencies).fillna(0.0)
                    changed_columns.append(column)
                else:
                    hashed_values = ensure_object(updated_df[column]).map(
                        lambda value: int(hashlib.md5(str(value).encode("utf-8")).hexdigest(), 16) % hash_bins
                    )
                    updated_df[column] = hashed_values
                    changed_columns.append(column)
        elif strategy == "one_hot":
            encoded_result = self._encode_one_hot(updated_df, target_columns)
            updated_df = encoded_result["updated_df"]
            changed_columns = encoded_result["changed_columns"]
            added_columns = encoded_result["added_columns"]
            removed_columns = encoded_result.get("removed_columns", [])
        elif strategy == "label":
            encoded_result = self._encode_label(updated_df, target_columns)
            updated_df = encoded_result["updated_df"]
            changed_columns = encoded_result["changed_columns"]
        elif strategy == "frequency":
            encoded_result = self._encode_frequency(updated_df, target_columns)
            updated_df = encoded_result["updated_df"]
            changed_columns = encoded_result["changed_columns"]
        elif strategy == "hashing":
            encoded_result = self._encode_hashing(updated_df, target_columns, hash_bins)
            updated_df = encoded_result["updated_df"]
            changed_columns = encoded_result["changed_columns"]
        else:
            raise ValueError(f"Unsupported feature engineering strategy: {strategy}")

        return {
            "updated_df": updated_df,
            "strategy": strategy,
            "changed_columns": changed_columns,
            "added_columns": added_columns,
            "removed_columns": removed_columns,
            "column_map": column_map,
            "profiles": list(profiles.values()),
            "target_columns": target_columns,
            "hash_bins": hash_bins,
        }
