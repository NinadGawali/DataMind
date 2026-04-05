import pandas as pd
from typing import Dict, Any

class EDAService:
    @staticmethod
    def get_summary(df: pd.DataFrame) -> Dict[str, Any]:
        
        desc = df.describe(include='all').to_dict()
        
        # Format dict
        summary = {}
        for col, stats in desc.items():
            summary[col] = {k: (v if not pd.isna(v) else None) for k, v in stats.items()}
        
        return {"summary": summary}
        
    @staticmethod
    def get_correlation(df: pd.DataFrame) -> Dict[str, Any]:
        num_cols = df.select_dtypes(include=['number']).columns
        if not len(num_cols):
            return {"correlation": {}}
        corr = df[num_cols].corr().to_dict()
        return {"correlation": corr}