import pandas as pd
from typing import Dict, Optional

class SessionStore:
    def __init__(self):
        self._sessions: Dict[str, pd.DataFrame] = {}

    def save_session(self, session_id: str, df: pd.DataFrame):
        self._sessions[session_id] = df

    def get_session(self, session_id: str) -> Optional[pd.DataFrame]:
        return self._sessions.get(session_id)

    def delete_session(self, session_id: str):
        if session_id in self._sessions:
            del self._sessions[session_id]

session_store = SessionStore()