import pandas as pd
from langchain_google_genai import ChatGoogleGenerativeAI
from config.settings import settings


class InsightAgent:
    def __init__(self):
        if settings.gemini_api_key:
            self.llm = ChatGoogleGenerativeAI(
                model="gemini-2.5-flash",
                google_api_key=settings.gemini_api_key,
                temperature=0.2
            )
        else:
            self.llm = None

    def _prepare_context(self, df: pd.DataFrame) -> str:
        """
        Generate structured statistical context from dataframe
        """
        try:
            shape = df.shape
            columns = df.columns.tolist()
            dtypes = df.dtypes.astype(str).to_dict()
            missing = df.isnull().sum().to_dict()

            # Sample to avoid token explosion
            df_sample = df.sample(min(len(df), 200))

            stats = df_sample.describe(include='all').fillna("").to_string()

            context = f"""
            Dataset Shape: {shape}

            Columns: {columns}

            Data Types:
            {dtypes}

            Missing Values:
            {missing}

            Statistical Summary (sampled):
            {stats}
            """

            return context

        except Exception as e:
            return f"Error preparing dataset context: {str(e)}"

    def generate_insight(self, df: pd.DataFrame, user_query: str = "") -> str:
        """
        Generate AI-driven statistical insights
        """
        if not self.llm:
            return "Gemini API Key missing. Please configure .env with gemini_api_key."

        try:
            dataset_context = self._prepare_context(df)

            prompt = f"""
You are a senior data scientist.

STRICT RULES:
- Use actual dataset statistics provided below
- Mention column names explicitly
- Include numeric reasoning (mean, distribution, correlations where possible)
- Avoid generic statements like "data looks good"
- Highlight anomalies, patterns, and relationships

DATASET CONTEXT:
{dataset_context}

USER QUESTION:
{user_query}

Now provide clear, professional insights:
"""

            response = self.llm.invoke(prompt)

            # Robust response handling
            if hasattr(response, "content"):
                return response.content

            return str(response)

        except Exception as e:
            return f"Error generating insight: {str(e)}"