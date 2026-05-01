from __future__ import annotations

from typing import Any, Dict, List, Optional

import pandas as pd


class OutlierAgent:
    SUPPORTED_STRATEGIES = {"drop_rows", "iqr_rescale"}

    def _numeric_columns(self, df: pd.DataFrame) -> List[str]:
        return df.select_dtypes(include=["number"]).columns.tolist()

    def _resolve_columns(self, df: pd.DataFrame, columns: Optional[List[str]]) -> List[str]:
        numeric = set(self._numeric_columns(df))
        if not columns:
            return list(numeric)
        return [col for col in columns if col in numeric]

    def _iqr_stats(self, series: pd.Series, iqr_factor: float) -> Optional[Dict[str, float]]:
        clean = series.dropna()
        if len(clean) < 4:
            return None

        q1 = float(clean.quantile(0.25))
        q3 = float(clean.quantile(0.75))
        iqr = q3 - q1
        if iqr == 0:
            return None

        lower = q1 - iqr_factor * iqr
        upper = q3 + iqr_factor * iqr
        return {"q1": q1, "q3": q3, "iqr": iqr, "lower": lower, "upper": upper}

    def analyze(self, df: pd.DataFrame, columns: Optional[List[str]] = None, iqr_factor: float = 1.5) -> Dict[str, Any]:
        target_columns = self._resolve_columns(df, columns)
        row_count = int(len(df))
        outlier_columns: List[Dict[str, Any]] = []

        for col in target_columns:
            stats = self._iqr_stats(df[col], iqr_factor)
            if not stats:
                continue

            mask = (df[col] < stats["lower"]) | (df[col] > stats["upper"])
            count = int(mask.sum())
            if count <= 0:
                continue

            outlier_columns.append(
                {
                    "column": col,
                    "count": count,
                    "rate_percent": round((count / row_count) * 100, 2) if row_count else 0.0,
                    "lower_bound": stats["lower"],
                    "upper_bound": stats["upper"],
                }
            )

        outlier_columns.sort(key=lambda item: item["count"], reverse=True)

        return {
            "row_count": row_count,
            "column_count": int(df.shape[1]),
            "numeric_columns": target_columns,
            "outlier_columns": outlier_columns,
            "supported_strategies": ["drop_rows", "iqr_rescale"],
            "iqr_factor": iqr_factor,
        }

    def apply(
        self,
        df: pd.DataFrame,
        strategy: str,
        columns: Optional[List[str]] = None,
        iqr_factor: float = 1.5,
    ) -> Dict[str, Any]:
        if strategy not in self.SUPPORTED_STRATEGIES:
            raise ValueError(f"Unsupported outlier strategy: {strategy}")

        if iqr_factor <= 0:
            raise ValueError("iqr_factor must be > 0")

        target_columns = self._resolve_columns(df, columns)
        updated_df = df.copy()
        before_shape = list(updated_df.shape)

        bounds_by_column: Dict[str, Dict[str, float]] = {}
        for col in target_columns:
            stats = self._iqr_stats(updated_df[col], iqr_factor)
            if stats:
                bounds_by_column[col] = {"lower": stats["lower"], "upper": stats["upper"]}

        if not bounds_by_column:
            return {
                "updated_df": updated_df,
                "strategy": strategy,
                "before_shape": before_shape,
                "after_shape": list(updated_df.shape),
                "rows_changed": 0,
                "columns_changed": [],
                "iqr_factor": iqr_factor,
                "bounds_by_column": {},
            }

        if strategy == "drop_rows":
            combined_mask = pd.Series(False, index=updated_df.index)
            for col, bounds in bounds_by_column.items():
                combined_mask = combined_mask | (updated_df[col] < bounds["lower"]) | (updated_df[col] > bounds["upper"])
            updated_df = updated_df.loc[~combined_mask].copy()
            columns_changed = list(bounds_by_column.keys())
        else:
            for col, bounds in bounds_by_column.items():
                updated_df[col] = updated_df[col].clip(lower=bounds["lower"], upper=bounds["upper"])
            columns_changed = list(bounds_by_column.keys())

        after_shape = list(updated_df.shape)
        return {
            "updated_df": updated_df,
            "strategy": strategy,
            "before_shape": before_shape,
            "after_shape": after_shape,
            "rows_changed": int(before_shape[0] - after_shape[0]),
            "columns_changed": columns_changed,
            "iqr_factor": iqr_factor,
            "bounds_by_column": bounds_by_column,
        }
