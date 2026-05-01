from __future__ import annotations

from typing import Any, Dict, List, Optional

import pandas as pd


class NullValueAgent:
    SUPPORTED_STRATEGIES = {
        "drop_rows",
        "drop_columns",
        "fill_avg",
        "fill_mean",
        "fill_mode",
        "fill_median",
        "fill_forward",
        "fill_backward",
        "fill_interpolate",
    }

    def analyze(self, df: pd.DataFrame) -> Dict[str, Any]:
        row_count = int(len(df))
        null_counts = df.isna().sum()
        null_columns: List[Dict[str, Any]] = []

        for col, count in null_counts.items():
            count_int = int(count)
            if count_int <= 0:
                continue
            rate = round((count_int / row_count) * 100, 2) if row_count else 0.0
            null_columns.append(
                {
                    "column": col,
                    "count": count_int,
                    "rate_percent": rate,
                    "dtype": str(df[col].dtype),
                }
            )

        null_columns.sort(key=lambda item: item["count"], reverse=True)

        return {
            "row_count": row_count,
            "column_count": int(df.shape[1]),
            "total_nulls": int(null_counts.sum()),
            "null_columns": null_columns,
            "supported_strategies": [
                "drop_rows",
                "drop_columns",
                "fill_avg",
                "fill_mean",
                "fill_mode",
                "fill_median",
                "fill_forward",
                "fill_backward",
                "fill_interpolate",
            ],
        }

    def _resolve_columns(self, df: pd.DataFrame, columns: Optional[List[str]]) -> List[str]:
        if not columns:
            return [col for col in df.columns if df[col].isna().any()]

        existing = [col for col in columns if col in df.columns]
        return [col for col in existing if df[col].isna().any()]

    def _apply_fill(self, df: pd.DataFrame, columns: List[str], strategy: str) -> Dict[str, Any]:
        changed_columns: List[str] = []

        for col in columns:
            series = df[col]
            if not series.isna().any():
                continue

            if strategy in {"fill_avg", "fill_mean"}:
                if pd.api.types.is_numeric_dtype(series):
                    value = series.mean()
                    if pd.notna(value):
                        df[col] = series.fillna(value)
                        changed_columns.append(col)
            elif strategy == "fill_median":
                if pd.api.types.is_numeric_dtype(series):
                    value = series.median()
                    if pd.notna(value):
                        df[col] = series.fillna(value)
                        changed_columns.append(col)
            elif strategy == "fill_mode":
                modes = series.mode(dropna=True)
                if not modes.empty:
                    df[col] = series.fillna(modes.iloc[0])
                    changed_columns.append(col)
            elif strategy == "fill_forward":
                df[col] = series.ffill()
                changed_columns.append(col)
            elif strategy == "fill_backward":
                df[col] = series.bfill()
                changed_columns.append(col)
            elif strategy == "fill_interpolate":
                if pd.api.types.is_numeric_dtype(series):
                    df[col] = series.interpolate(method="linear", limit_direction="both")
                    changed_columns.append(col)

        return {
            "changed_columns": changed_columns,
            "strategy": strategy,
        }

    def apply(
        self,
        df: pd.DataFrame,
        strategy: str,
        columns: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        if strategy not in self.SUPPORTED_STRATEGIES:
            raise ValueError(f"Unsupported null-value strategy: {strategy}")

        before_shape = list(df.shape)
        before_total_nulls = int(df.isna().sum().sum())
        target_columns = self._resolve_columns(df, columns)

        updated_df = df.copy()
        changed_columns: List[str] = []

        if strategy == "drop_rows":
            if target_columns:
                updated_df = updated_df.dropna(axis=0, subset=target_columns)
            else:
                updated_df = updated_df.dropna(axis=0)
            changed_columns = target_columns
        elif strategy == "drop_columns":
            if not columns:
                drop_columns = [col for col in updated_df.columns if updated_df[col].isna().any()]
            else:
                drop_columns = [col for col in target_columns if col in updated_df.columns]
            if drop_columns:
                updated_df = updated_df.drop(columns=drop_columns)
            changed_columns = drop_columns
        else:
            result = self._apply_fill(updated_df, target_columns, strategy)
            changed_columns = result["changed_columns"]

        after_shape = list(updated_df.shape)
        after_total_nulls = int(updated_df.isna().sum().sum())

        return {
            "updated_df": updated_df,
            "strategy": strategy,
            "before_shape": before_shape,
            "after_shape": after_shape,
            "before_total_nulls": before_total_nulls,
            "after_total_nulls": after_total_nulls,
            "rows_changed": int(before_shape[0] - after_shape[0]),
            "columns_changed": changed_columns,
            "columns_requested": columns or [],
        }
