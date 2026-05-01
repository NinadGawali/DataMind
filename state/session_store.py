import pandas as pd
from typing import Dict, Optional, Any

class SessionStore:
    def __init__(self):
        self._sessions: Dict[str, pd.DataFrame] = {}
        self._models: Dict[str, Dict[str, Any]] = {}

    def save_session(self, session_id: str, df: pd.DataFrame):
        self._sessions[session_id] = df

    def get_session(self, session_id: str) -> Optional[pd.DataFrame]:
        return self._sessions.get(session_id)

    def delete_session(self, session_id: str):
        if session_id in self._sessions:
            del self._sessions[session_id]

    def save_model(self, session_id: str, model_metadata: Dict[str, Any]):
        """Store trained model metadata and bytes."""
        self._models[session_id] = model_metadata

    def get_model(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve trained model metadata and bytes."""
        return self._models.get(session_id)

    def delete_model(self, session_id: str):
        if session_id in self._models:
            del self._models[session_id]

session_store = SessionStore()